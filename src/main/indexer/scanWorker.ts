import { parentPort, workerData } from 'node:worker_threads'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// Runs in a worker thread so directory walking never blocks the UI or main process.
const EXTENSIONS = new Set(['.stl', '.obj', '.3mf', '.step', '.stp'])
const BATCH_SIZE = 50

interface ScanEntry {
  path: string
  name: string
  ext: 'stl' | 'obj' | '3mf' | 'step'
  sizeBytes: number
  mtimeMs: number
}

async function yieldToScheduler(): Promise<void> {
  // Give the OS scheduler / other work a chance so background scanning stays low-impact.
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function walk(
  dir: string,
  batch: ScanEntry[],
  onBatch: (b: ScanEntry[]) => Promise<void>,
  visitedDirs: Set<string> = new Set()
): Promise<void> {
  let realDir = dir
  try {
    realDir = await fs.realpath(dir)
  } catch {
    realDir = dir
  }
  if (visitedDirs.has(realDir)) return
  visitedDirs.add(realDir)

  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  let processed = 0
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    let isDir = entry.isDirectory()
    let isFile = entry.isFile()

    if (entry.isSymbolicLink()) {
      try {
        const stat = await fs.stat(fullPath)
        isDir = stat.isDirectory()
        isFile = stat.isFile()
      } catch {
        continue
      }
    }

    if (isDir) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      await walk(fullPath, batch, onBatch, visitedDirs)
    } else if (isFile) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!EXTENSIONS.has(ext)) continue
      try {
        const stat = await fs.stat(fullPath)
        batch.push({
          path: fullPath,
          name: entry.name,
          ext: ext === '.stp' ? 'step' : (ext.slice(1) as ScanEntry['ext']),
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs
        })
      } catch {
        continue
      }
      if (batch.length >= BATCH_SIZE) {
        await onBatch(batch.splice(0, batch.length))
      }
    }
    processed++
    if (processed % 25 === 0) await yieldToScheduler()
  }
}

async function main(): Promise<void> {
  try {
    // Best-effort: lower this thread's OS scheduling priority (POSIX only).
    os.setPriority?.(process.pid, 19)
  } catch {
    /* not supported on this platform, ignore */
  }

  const { rootPath, folderId } = workerData as { rootPath: string; folderId: string }
  const pending: ScanEntry[] = []
  let scanned = 0

  const flush = async (entries: ScanEntry[]): Promise<void> => {
    scanned += entries.length
    parentPort?.postMessage({ type: 'batch', folderId, entries, scanned })
    await yieldToScheduler()
  }

  await walk(rootPath, pending, flush)
  if (pending.length) {
    scanned += pending.length
    parentPort?.postMessage({ type: 'batch', folderId, entries: pending, scanned })
  }
  parentPort?.postMessage({ type: 'done', folderId, scanned })
}

main().catch((err) => {
  parentPort?.postMessage({ type: 'error', message: String(err) })
})
