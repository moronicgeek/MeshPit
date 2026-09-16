import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc'
import type { StepMeshData } from '@shared/types'
import { getPendingThumbnailFiles, resetFailedThumbnails, setThumbnail, getSettings } from '../db/database'

interface QueueItem {
  id: string
  path: string
  ext: string
}

interface PendingStepRequest {
  resolve: (meshes: StepMeshData[]) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

/** A large assembly can take a while to triangulate; give up rather than hang the viewer. */
const STEP_TIMEOUT_MS = 120_000
const HOST_READY_TIMEOUT_MS = 30_000

let hostWindow: BrowserWindow | null = null
let processing = false
const queue: QueueItem[] = []
let onUpdated: (() => void) | null = null
const pendingStepRequests = new Map<string, PendingStepRequest>()
let stepRequestCounter = 0
let hostReady: Promise<void> | null = null
let resolveHostReady: (() => void) | null = null

function thumbnailsDir(): string {
  const dir = path.join(app.getPath('userData'), 'thumbnails')
  return dir
}

async function ensureHostWindow(): Promise<BrowserWindow> {
  if (hostWindow && !hostWindow.isDestroyed() && hostReady) {
    await hostReady
    return hostWindow
  }

  hostReady = new Promise<void>((resolve) => {
    resolveHostReady = resolve
  })

  hostWindow = new BrowserWindow({
    show: false,
    width: 512,
    height: 512,
    webPreferences: {
      preload: path.join(__dirname, '../preload/thumbnail.js'),
      contextIsolation: true,
      sandbox: false,
      offscreen: true
    }
  })

  hostWindow.on('closed', () => {
    hostWindow = null
    hostReady = null
    resolveHostReady = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await hostWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/thumbnail.html`)
  } else {
    await hostWindow.loadFile(path.join(__dirname, '../renderer/thumbnail.html'))
  }

  // loadURL resolves before the page's modules have run, so wait for the host to
  // say its IPC listeners are attached. Time-boxed so a broken host surfaces as
  // an error instead of hanging every caller forever.
  await Promise.race([
    hostReady,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Thumbnail host failed to start')), HOST_READY_TIMEOUT_MS)
    )
  ])

  return hostWindow
}

export function cleanupThumbnailManager(): void {
  queue.length = 0
  processing = false
  for (const pending of pendingStepRequests.values()) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Shutting down'))
  }
  pendingStepRequests.clear()
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.destroy()
    hostWindow = null
  }
}

/**
 * Triangulates a STEP file in the offscreen host window. That window has no CSP,
 * which OpenCascade's embind glue requires (it builds invokers via new Function);
 * the main window forbids that on purpose, so only geometry crosses back.
 */
export async function triangulateStepFile(buffer: ArrayBuffer): Promise<StepMeshData[]> {
  const win = await ensureHostWindow()
  const requestId = `step-${++stepRequestCounter}`

  return new Promise<StepMeshData[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingStepRequests.delete(requestId)
      reject(new Error('Timed out triangulating STEP file'))
    }, STEP_TIMEOUT_MS)

    pendingStepRequests.set(requestId, { resolve, reject, timer })
    win.webContents.send(IpcChannels.stepTriangulateRequest, { requestId, buffer })
  })
}

export function initThumbnailManager(onLibraryChanged: () => void): void {
  onUpdated = onLibraryChanged
  fs.mkdir(thumbnailsDir(), { recursive: true }).catch(() => undefined)

  ipcMain.on(IpcChannels.thumbnailRenderResult, async (_event, result: {
    id: string
    success: boolean
    dataUrl?: string
  }) => {
    if (result.success && result.dataUrl) {
      const outPath = path.join(thumbnailsDir(), `${result.id}.png`)
      const base64 = result.dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
      await fs.writeFile(outPath, Buffer.from(base64, 'base64'))
      setThumbnail(result.id, outPath, 'ready')
    } else {
      setThumbnail(result.id, null, 'failed')
    }
    onUpdated?.()
    processing = false
    processNext()
  })

  ipcMain.on(IpcChannels.hostReady, () => {
    resolveHostReady?.()
  })

  ipcMain.on(IpcChannels.stepTriangulateResult, (_event, result: {
    requestId: string
    success: boolean
    meshes?: StepMeshData[]
    error?: string
  }) => {
    const pending = pendingStepRequests.get(result.requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingStepRequests.delete(result.requestId)
    if (result.success && result.meshes) {
      pending.resolve(result.meshes)
    } else {
      pending.reject(new Error(result.error ?? 'Could not triangulate STEP file'))
    }
  })
}

export function enqueueThumbnailScan(): void {
  resetFailedThumbnails()
  const settings = getSettings()
  const pending = getPendingThumbnailFiles(200)
  for (const file of pending) {
    if (!queue.find((q) => q.id === file.id)) {
      queue.push({ id: file.id, path: file.path, ext: file.ext })
    }
  }
  void settings
  processNext()
}

async function processNext(): Promise<void> {
  if (processing) return
  const item = queue.shift()
  if (!item) return
  processing = true

  try {
    const buffer = await fs.readFile(item.path)
    const win = await ensureHostWindow()
    const settings = getSettings()
    win.webContents.send(IpcChannels.thumbnailRenderRequest, {
      id: item.id,
      ext: item.ext,
      size: settings.thumbnailSize,
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    })
  } catch {
    setThumbnail(item.id, null, 'failed')
    processing = false
    processNext()
  }
}
