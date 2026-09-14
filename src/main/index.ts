import { app, BrowserWindow, net, protocol, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { cleanupThumbnailManager, initThumbnailManager, enqueueThumbnailScan } from './thumbnails/thumbnailManager'
import { stopAllScans, unwatchAllFolders } from './indexer/indexer'
import { closeDb, getDb } from './db/database'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'meshpit-thumb',
    privileges: { secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true, standard: true }
  }
])

function performCleanup(): void {
  cleanupThumbnailManager()
  unwatchAllFolders()
  stopAllScans()
  closeDb()
}

function createMainWindow(): void {
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const hasIcon = fs.existsSync(iconPath)

  if (process.platform === 'darwin' && app.dock && hasIcon) {
    try {
      app.dock.setIcon(iconPath)
    } catch {
      /* ignore if icon fail */
    }
  }

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#14111a',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(hasIcon ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.meshpit.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('meshpit-thumb', (request) => {
    const filePath = decodeURIComponent(request.url.replace('meshpit-thumb://thumb/', ''))
    return net.fetch(`file://${filePath}`)
  })

  getDb() // ensure schema exists before anything touches it
  registerIpcHandlers()
  initThumbnailManager(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('library:onLibraryChanged')
    }
  })
  // Pick up any files left pending from a previous session.
  enqueueThumbnailScan()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().filter((w) => w.isVisible()).length === 0) createMainWindow()
  })
})

app.on('before-quit', () => {
  performCleanup()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
