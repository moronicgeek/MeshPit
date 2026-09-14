import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import { IpcChannels } from '@shared/ipc'
import type { DeleteFileOptions, LibraryQuery } from '@shared/types'
import * as db from '../db/database'
import { scanFolder, unwatchFolder, watchFolder } from '../indexer/indexer'
import { enqueueThumbnailScan } from '../thumbnails/thumbnailManager'
import { openInBambuStudio } from '../bambu/launcher'

function broadcastLibraryChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.onLibraryChanged)
  }
}

function handleLiveFolderChange(): void {
  broadcastLibraryChanged()
  enqueueThumbnailScan()
}

function broadcastProgress(progress: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.onIndexProgress, progress)
  }
}

async function runFolderScan(folderId: string, folderPath: string): Promise<void> {
  watchFolder(folderId, folderPath, handleLiveFolderChange)
  await scanFolder(folderId, folderPath, broadcastProgress, broadcastLibraryChanged)
  enqueueThumbnailScan()
}

export function registerIpcHandlers(): void {
  for (const folder of db.listFolders()) {
    watchFolder(folder.id, folder.path, handleLiveFolderChange)
  }
  ipcMain.handle(IpcChannels.selectFolder, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.selectExecutable, async () => {
    const filters =
      process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe'] }]
        : process.platform === 'darwin'
          ? [{ name: 'Application', extensions: ['app'] }]
          : []
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.addFolder, async (_e, folderPath: string) => {
    const folder = db.addFolder(folderPath)
    void runFolderScan(folder.id, folder.path)
    return folder
  })

  ipcMain.handle(IpcChannels.removeFolder, (_e, folderId: string) => {
    unwatchFolder(folderId)
    db.removeFolder(folderId)
    broadcastLibraryChanged()
  })

  ipcMain.handle(IpcChannels.listFolders, () => db.listFolders())

  ipcMain.handle(IpcChannels.rescanFolder, async (_e, folderId: string) => {
    const folder = db.listFolders().find((f) => f.id === folderId)
    if (folder) void runFolderScan(folder.id, folder.path)
  })

  ipcMain.handle(IpcChannels.rescanAll, async () => {
    for (const folder of db.listFolders()) {
      void runFolderScan(folder.id, folder.path)
    }
  })

  ipcMain.handle(IpcChannels.getFiles, (_e, query: LibraryQuery) => db.queryFiles(query))
  ipcMain.handle(IpcChannels.getFile, (_e, id: string) => db.getFileById(id))

  ipcMain.handle(IpcChannels.deleteFiles, async (_e, options: DeleteFileOptions) => {
    if (options.alsoFromDisk) {
      for (const id of options.ids) {
        const file = db.getFileById(id)
        if (file) {
          await fs.rm(file.path, { force: true }).catch(() => undefined)
        }
      }
    }
    db.deleteFilesFromIndex(options.ids)
    broadcastLibraryChanged()
  })

  ipcMain.handle(IpcChannels.revealFile, (_e, id: string) => {
    const file = db.getFileById(id)
    if (file) shell.showItemInFolder(file.path)
  })

  ipcMain.handle(IpcChannels.openInBambuStudio, (_e, id: string) => {
    const file = db.getFileById(id)
    if (file) openInBambuStudio(file.path)
  })

  ipcMain.handle(IpcChannels.listTags, () => db.listTags())
  ipcMain.handle(IpcChannels.addTagToFile, (_e, fileId: string, tagName: string) => {
    db.addTagToFile(fileId, tagName)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.addTagToFiles, (_e, fileIds: string[], tagName: string) => {
    db.addTagToFiles(fileIds, tagName)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.removeTagFromFile, (_e, fileId: string, tagName: string) => {
    db.removeTagFromFile(fileId, tagName)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.removeTagFromFiles, (_e, fileIds: string[], tagName: string) => {
    db.removeTagFromFiles(fileIds, tagName)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.renameTag, (_e, tagId: string, name: string) => {
    db.renameTag(tagId, name)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.deleteTag, (_e, tagId: string) => {
    db.deleteTag(tagId)
    broadcastLibraryChanged()
  })

  ipcMain.handle(IpcChannels.listCollections, () => db.listCollections())
  ipcMain.handle(IpcChannels.createCollection, (_e, name: string, color: string | null) => {
    const collection = db.createCollection(name, color)
    broadcastLibraryChanged()
    return collection
  })
  ipcMain.handle(IpcChannels.renameCollection, (_e, id: string, name: string) => {
    db.renameCollection(id, name)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.deleteCollection, (_e, id: string) => {
    db.deleteCollection(id)
    broadcastLibraryChanged()
  })
  ipcMain.handle(IpcChannels.addFileToCollection, (_e, collectionId: string, fileId: string) => {
    db.addFileToCollection(collectionId, fileId)
    broadcastLibraryChanged()
  })
  ipcMain.handle(
    IpcChannels.addFilesToCollection,
    (_e, collectionId: string, fileIds: string[]) => {
      db.addFilesToCollection(collectionId, fileIds)
      broadcastLibraryChanged()
    }
  )
  ipcMain.handle(
    IpcChannels.removeFileFromCollection,
    (_e, collectionId: string, fileId: string) => {
      db.removeFileFromCollection(collectionId, fileId)
      broadcastLibraryChanged()
    }
  )
  ipcMain.handle(
    IpcChannels.removeFilesFromCollection,
    (_e, collectionId: string, fileIds: string[]) => {
      db.removeFilesFromCollection(collectionId, fileIds)
      broadcastLibraryChanged()
    }
  )

  ipcMain.handle(IpcChannels.getSettings, () => db.getSettings())
  ipcMain.handle(IpcChannels.setSettings, (_e, partial) => {
    const settings = db.setSettings(partial)
    broadcastLibraryChanged()
    return settings
  })
}
