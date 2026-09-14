import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IpcChannels } from '@shared/ipc'
import { getPendingThumbnailFiles, resetFailedThumbnails, setThumbnail, getSettings } from '../db/database'

interface QueueItem {
  id: string
  path: string
  ext: string
}

let hostWindow: BrowserWindow | null = null
let processing = false
const queue: QueueItem[] = []
let onUpdated: (() => void) | null = null

function thumbnailsDir(): string {
  const dir = path.join(app.getPath('userData'), 'thumbnails')
  return dir
}

async function ensureHostWindow(): Promise<BrowserWindow> {
  if (hostWindow && !hostWindow.isDestroyed()) return hostWindow

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
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await hostWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/thumbnail.html`)
  } else {
    await hostWindow.loadFile(path.join(__dirname, '../renderer/thumbnail.html'))
  }
  return hostWindow
}

export function cleanupThumbnailManager(): void {
  queue.length = 0
  processing = false
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.destroy()
    hostWindow = null
  }
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
