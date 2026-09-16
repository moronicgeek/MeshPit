export type MeshFileType = 'stl' | 'obj' | '3mf' | 'step'

export interface MeshFileRecord {
  id: string
  path: string
  name: string
  ext: MeshFileType
  sizeBytes: number
  mtimeMs: number
  addedAt: number
  folderId: string
  thumbnailPath: string | null
  thumbnailStatus: 'pending' | 'ready' | 'failed' | 'unsupported'
  tags: string[]
  collections: string[]
  missing: boolean
}

export interface WatchedFolder {
  id: string
  path: string
  addedAt: number
  lastScanAt: number | null
}

export interface Collection {
  id: string
  name: string
  color: string | null
  createdAt: number
  fileCount: number
}

export interface Tag {
  id: string
  name: string
  fileCount: number
}

export interface LibraryQuery {
  search?: string
  folderId?: string
  collectionId?: string
  tag?: string
  ext?: MeshFileType
  sortBy?: 'name' | 'addedAt' | 'sizeBytes' | 'mtimeMs'
  sortDir?: 'asc' | 'desc'
}

export interface IndexProgress {
  folderId: string
  scanned: number
  total: number | null
  phase: 'scanning' | 'thumbnailing' | 'idle'
}

export interface AppSettings {
  bambuStudioPath: string | null
  thumbnailSize: number
  maxConcurrentThumbnails: number
}

export interface DeleteFileOptions {
  ids: string[]
  alsoFromDisk: boolean
}

export interface DuplicateFileGroup {
  hash: string
  files: MeshFileRecord[]
}
