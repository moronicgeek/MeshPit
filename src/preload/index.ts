import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type {
  AppSettings,
  Collection,
  DeleteFileOptions,
  LibraryQuery,
  MeshFileRecord,
  Tag,
  WatchedFolder
} from '../shared/types'

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.selectFolder),
  selectExecutable: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.selectExecutable),
  addFolder: (folderPath: string): Promise<WatchedFolder> =>
    ipcRenderer.invoke(IpcChannels.addFolder, folderPath),
  removeFolder: (folderId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.removeFolder, folderId),
  listFolders: (): Promise<WatchedFolder[]> => ipcRenderer.invoke(IpcChannels.listFolders),
  rescanFolder: (folderId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.rescanFolder, folderId),
  rescanAll: (): Promise<void> => ipcRenderer.invoke(IpcChannels.rescanAll),

  getFiles: (query: LibraryQuery): Promise<MeshFileRecord[]> =>
    ipcRenderer.invoke(IpcChannels.getFiles, query),
  getFile: (id: string): Promise<MeshFileRecord | null> =>
    ipcRenderer.invoke(IpcChannels.getFile, id),
  deleteFiles: (options: DeleteFileOptions): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.deleteFiles, options),
  revealFile: (id: string): Promise<void> => ipcRenderer.invoke(IpcChannels.revealFile, id),
  openInBambuStudio: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.openInBambuStudio, id),

  listTags: (): Promise<Tag[]> => ipcRenderer.invoke(IpcChannels.listTags),
  addTagToFile: (fileId: string, tagName: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.addTagToFile, fileId, tagName),
  addTagToFiles: (fileIds: string[], tagName: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.addTagToFiles, fileIds, tagName),
  removeTagFromFile: (fileId: string, tagName: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.removeTagFromFile, fileId, tagName),
  removeTagFromFiles: (fileIds: string[], tagName: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.removeTagFromFiles, fileIds, tagName),
  renameTag: (tagId: string, name: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.renameTag, tagId, name),
  deleteTag: (tagId: string): Promise<void> => ipcRenderer.invoke(IpcChannels.deleteTag, tagId),

  listCollections: (): Promise<Collection[]> => ipcRenderer.invoke(IpcChannels.listCollections),
  createCollection: (name: string, color: string | null): Promise<Collection> =>
    ipcRenderer.invoke(IpcChannels.createCollection, name, color),
  renameCollection: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.renameCollection, id, name),
  deleteCollection: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.deleteCollection, id),
  addFileToCollection: (collectionId: string, fileId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.addFileToCollection, collectionId, fileId),
  addFilesToCollection: (collectionId: string, fileIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.addFilesToCollection, collectionId, fileIds),
  removeFileFromCollection: (collectionId: string, fileId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.removeFileFromCollection, collectionId, fileId),
  removeFilesFromCollection: (collectionId: string, fileIds: string[]): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.removeFilesFromCollection, collectionId, fileIds),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.getSettings),
  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.setSettings, partial),

  onIndexProgress: (cb: (progress: unknown) => void): (() => void) => {
    const listener = (_e: unknown, progress: unknown): void => cb(progress)
    ipcRenderer.on(IpcChannels.onIndexProgress, listener)
    return () => ipcRenderer.removeListener(IpcChannels.onIndexProgress, listener)
  },
  onLibraryChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IpcChannels.onLibraryChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.onLibraryChanged, listener)
  }
}

contextBridge.exposeInMainWorld('meshpit', api)

export type MeshPitApi = typeof api
