export const IpcChannels = {
  selectFolder: 'library:selectFolder',
  selectExecutable: 'library:selectExecutable',
  addFolder: 'library:addFolder',
  removeFolder: 'library:removeFolder',
  listFolders: 'library:listFolders',
  rescanFolder: 'library:rescanFolder',
  rescanAll: 'library:rescanAll',

  getFiles: 'library:getFiles',
  getFile: 'library:getFile',
  deleteFiles: 'library:deleteFiles',
  revealFile: 'library:revealFile',
  openInBambuStudio: 'library:openInBambuStudio',
  renameFile: 'library:renameFile',

  listTags: 'library:listTags',
  addTagToFile: 'library:addTagToFile',
  addTagToFiles: 'library:addTagToFiles',
  removeTagFromFile: 'library:removeTagFromFile',
  removeTagFromFiles: 'library:removeTagFromFiles',
  renameTag: 'library:renameTag',
  deleteTag: 'library:deleteTag',

  listCollections: 'library:listCollections',
  createCollection: 'library:createCollection',
  renameCollection: 'library:renameCollection',
  deleteCollection: 'library:deleteCollection',
  addFileToCollection: 'library:addFileToCollection',
  addFilesToCollection: 'library:addFilesToCollection',
  removeFileFromCollection: 'library:removeFileFromCollection',
  removeFilesFromCollection: 'library:removeFilesFromCollection',

  getSettings: 'library:getSettings',
  setSettings: 'library:setSettings',

  onIndexProgress: 'library:onIndexProgress',
  onLibraryChanged: 'library:onLibraryChanged',

  // thumbnail render host <-> main process
  thumbnailRenderRequest: 'thumbnail:renderRequest',
  thumbnailRenderResult: 'thumbnail:renderResult'
} as const
