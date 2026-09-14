import { Worker } from 'node:worker_threads'
import path from 'node:path'
import fs from 'node:fs'
import chokidar, { FSWatcher } from 'chokidar'
import { is } from '@electron-toolkit/utils'
import {
  deleteFileByPath,
  markFolderFilesMissingExcept,
  touchFolderScanTime,
  upsertFile,
  type UpsertFileInput
} from '../db/database'
import type { IndexProgress } from '@shared/types'

type ProgressListener = (progress: IndexProgress) => void
type ChangedListener = () => void

const activeScans = new Set<string>()
const activeWorkers = new Set<Worker>()
const watchers = new Map<string, FSWatcher>()
const EXTENSIONS = new Set(['.stl', '.obj', '.3mf'])

function workerScriptPath(): string {
  // In dev, electron-vite serves main output from out/main; in prod it's alongside index.js.
  return path.join(__dirname, 'scanWorker.js')
}

export function unwatchAllFolders(): void {
  for (const [, watcher] of watchers) {
    void watcher.close()
  }
  watchers.clear()
}

export function stopAllScans(): void {
  for (const worker of activeWorkers) {
    void worker.terminate()
  }
  activeWorkers.clear()
  activeScans.clear()
}

export function watchFolder(folderId: string, folderPath: string, onChanged: ChangedListener): void {
  if (watchers.has(folderId)) return

  const watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])(\..|node_modules)/,
    persistent: true,
    ignoreInitial: true,
    depth: 99
  })

  const handleAddOrChange = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase()
    if (!EXTENSIONS.has(ext)) return
    try {
      const stat = fs.statSync(filePath)
      upsertFile({
        path: filePath,
        name: path.basename(filePath),
        ext: ext.slice(1) as any,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        folderId
      })
      onChanged()
    } catch {
      /* ignore */
    }
  }

  watcher.on('add', handleAddOrChange)
  watcher.on('change', handleAddOrChange)
  watcher.on('unlink', (filePath) => {
    const ext = path.extname(filePath).toLowerCase()
    if (!EXTENSIONS.has(ext)) return
    deleteFileByPath(filePath)
    onChanged()
  })

  watchers.set(folderId, watcher)
}

export function unwatchFolder(folderId: string): void {
  const watcher = watchers.get(folderId)
  if (watcher) {
    void watcher.close()
    watchers.delete(folderId)
  }
}

export function scanFolder(
  folderId: string,
  folderPath: string,
  onProgress: ProgressListener,
  onChanged: ChangedListener
): Promise<void> {
  if (activeScans.has(folderId)) return Promise.resolve()
  activeScans.add(folderId)

  return new Promise((resolve) => {
    const seenPaths = new Set<string>()
    const worker = new Worker(workerScriptPath(), {
      workerData: { rootPath: folderPath, folderId }
    })
    activeWorkers.add(worker)

    worker.on('message', (msg: any) => {
      if (msg.type === 'batch') {
        for (const entry of msg.entries as UpsertFileInput[]) {
          seenPaths.add(entry.path)
          upsertFile({ ...entry, folderId })
        }
        onChanged()
        onProgress({ folderId, scanned: msg.scanned, total: null, phase: 'scanning' })
      } else if (msg.type === 'done') {
        markFolderFilesMissingExcept(folderId, seenPaths)
        touchFolderScanTime(folderId)
        onProgress({ folderId, scanned: msg.scanned, total: msg.scanned, phase: 'idle' })
        onChanged()
      } else if (msg.type === 'error') {
        console.error('[MeshPit] scan worker error:', msg.message)
      }
    })

    worker.on('error', (err) => console.error('[MeshPit] scan worker crashed:', err))
    worker.on('exit', () => {
      activeWorkers.delete(worker)
      activeScans.delete(folderId)
      resolve()
    })
  })
}

export function isDev(): boolean {
  return is.dev
}
