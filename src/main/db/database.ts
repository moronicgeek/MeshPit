import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { nanoid } from 'nanoid'
import type {
  AppSettings,
  Collection,
  LibraryQuery,
  MeshFileRecord,
  MeshFileType,
  Tag,
  WatchedFolder
} from '@shared/types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  added_at INTEGER NOT NULL,
  last_scan_at INTEGER
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  ext TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  thumbnail_path TEXT,
  thumbnail_status TEXT NOT NULL DEFAULT 'pending',
  missing INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_files (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, file_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`

let db: Database.Database

export function getDb(): Database.Database {
  if (db) return db
  const dbPath = path.join(app.getPath('userData'), 'meshpit.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

export function closeDb(): void {
  if (db && db.open) {
    try {
      db.close()
    } catch {
      /* ignore */
    }
  }
}

// ---------- Folders ----------

export function addFolder(folderPath: string): WatchedFolder {
  const d = getDb()
  const existing = d.prepare('SELECT * FROM folders WHERE path = ?').get(folderPath) as
    | WatchedFolder
    | undefined
  if (existing) return rowToFolder(existing)
  const id = nanoid()
  const addedAt = Date.now()
  d.prepare('INSERT INTO folders (id, path, added_at, last_scan_at) VALUES (?, ?, ?, NULL)').run(
    id,
    folderPath,
    addedAt
  )
  return { id, path: folderPath, addedAt, lastScanAt: null }
}

export function removeFolder(id: string): void {
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
}

export function listFolders(): WatchedFolder[] {
  const rows = getDb().prepare('SELECT * FROM folders ORDER BY added_at ASC').all() as any[]
  return rows.map(rowToFolder)
}

export function touchFolderScanTime(id: string): void {
  getDb().prepare('UPDATE folders SET last_scan_at = ? WHERE id = ?').run(Date.now(), id)
}

function rowToFolder(row: any): WatchedFolder {
  return { id: row.id, path: row.path, addedAt: row.added_at, lastScanAt: row.last_scan_at }
}

// ---------- Files ----------

export interface UpsertFileInput {
  path: string
  name: string
  ext: MeshFileType
  sizeBytes: number
  mtimeMs: number
  folderId: string
}

export function upsertFile(input: UpsertFileInput): { id: string; isNew: boolean } {
  const d = getDb()
  const existing = d.prepare('SELECT id, mtime_ms FROM files WHERE path = ?').get(input.path) as
    | { id: string; mtime_ms: number }
    | undefined
  if (existing) {
    if (existing.mtime_ms !== input.mtimeMs) {
      d.prepare(
        'UPDATE files SET size_bytes = ?, mtime_ms = ?, missing = 0, thumbnail_status = ? WHERE id = ?'
      ).run(input.sizeBytes, input.mtimeMs, 'pending', existing.id)
    } else {
      d.prepare('UPDATE files SET missing = 0 WHERE id = ?').run(existing.id)
    }
    return { id: existing.id, isNew: false }
  }
  const id = nanoid()
  d.prepare(
    `INSERT INTO files (id, folder_id, path, name, ext, size_bytes, mtime_ms, added_at, thumbnail_status, missing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`
  ).run(
    id,
    input.folderId,
    input.path,
    input.name,
    input.ext,
    input.sizeBytes,
    input.mtimeMs,
    Date.now()
  )
  return { id, isNew: true }
}

export function markFolderFilesMissingExcept(folderId: string, keepPaths: Set<string>): void {
  const d = getDb()
  const rows = d.prepare('SELECT id, path FROM files WHERE folder_id = ?').all(folderId) as {
    id: string
    path: string
  }[]
  const toMiss = rows.filter((r) => !keepPaths.has(r.path))
  const stmt = d.prepare('UPDATE files SET missing = 1 WHERE id = ?')
  const tx = d.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(id)
  })
  tx(toMiss.map((r) => r.id))
}

export function setThumbnail(fileId: string, thumbnailPath: string | null, status: string): void {
  getDb()
    .prepare('UPDATE files SET thumbnail_path = ?, thumbnail_status = ? WHERE id = ?')
    .run(thumbnailPath, status, fileId)
}

export function resetFailedThumbnails(): void {
  getDb().prepare("UPDATE files SET thumbnail_status = 'pending' WHERE thumbnail_status = 'failed'").run()
}

export function getPendingThumbnailFiles(limit: number): { id: string; path: string; ext: string }[] {
  return getDb()
    .prepare(
      `SELECT id, path, ext FROM files WHERE thumbnail_status = 'pending' AND missing = 0 LIMIT ?`
    )
    .all(limit) as any[]
}

export function getFileById(id: string): MeshFileRecord | null {
  const row = getDb().prepare('SELECT * FROM files WHERE id = ?').get(id) as any
  if (!row) return null
  return rowToFile(row)
}

export function renameFile(id: string, newPath: string, newName: string): void {
  getDb().prepare('UPDATE files SET path = ?, name = ? WHERE id = ?').run(newPath, newName, id)
}

export function queryFiles(query: LibraryQuery): MeshFileRecord[] {
  const d = getDb()
  const clauses: string[] = ['f.missing = 0']
  const params: Record<string, unknown> = {}

  if (query.folderId) {
    clauses.push('f.folder_id = @folderId')
    params.folderId = query.folderId
  }
  if (query.ext) {
    clauses.push('f.ext = @ext')
    params.ext = query.ext
  }
  if (query.search) {
    clauses.push('f.name LIKE @search')
    params.search = `%${query.search}%`
  }
  if (query.collectionId) {
    clauses.push(
      'f.id IN (SELECT file_id FROM collection_files WHERE collection_id = @collectionId)'
    )
    params.collectionId = query.collectionId
  }
  if (query.tag) {
    clauses.push(
      'f.id IN (SELECT ft.file_id FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE t.name = @tag)'
    )
    params.tag = query.tag
  }

  const sortColumns: Record<string, string> = {
    name: 'f.name',
    addedAt: 'f.added_at',
    sizeBytes: 'f.size_bytes',
    mtimeMs: 'f.mtime_ms'
  }
  const sortColumn = sortColumns[query.sortBy ?? 'addedAt'] ?? 'f.added_at'
  const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC'

  const rows = d
    .prepare(
      `SELECT f.* FROM files f WHERE ${clauses.join(' AND ')} ORDER BY ${sortColumn} ${sortDir}`
    )
    .all(params) as any[]

  return rows.map(rowToFile)
}

export function deleteFilesFromIndex(ids: string[]): void {
  const d = getDb()
  const stmt = d.prepare('DELETE FROM files WHERE id = ?')
  const tx = d.transaction((list: string[]) => {
    for (const id of list) stmt.run(id)
  })
  tx(ids)
}

export function deleteFileByPath(filePath: string): void {
  getDb().prepare('DELETE FROM files WHERE path = ?').run(filePath)
}

function rowToFile(row: any): MeshFileRecord {
  const d = getDb()
  const tags = (
    d
      .prepare(
        'SELECT t.name FROM tags t JOIN file_tags ft ON ft.tag_id = t.id WHERE ft.file_id = ?'
      )
      .all(row.id) as { name: string }[]
  ).map((r) => r.name)
  const collections = (
    d
      .prepare(
        'SELECT c.id FROM collections c JOIN collection_files cf ON cf.collection_id = c.id WHERE cf.file_id = ?'
      )
      .all(row.id) as { id: string }[]
  ).map((r) => r.id)

  return {
    id: row.id,
    path: row.path,
    name: row.name,
    ext: row.ext,
    sizeBytes: row.size_bytes,
    mtimeMs: row.mtime_ms,
    addedAt: row.added_at,
    folderId: row.folder_id,
    thumbnailPath: row.thumbnail_path,
    thumbnailStatus: row.thumbnail_status,
    tags,
    collections,
    missing: !!row.missing
  }
}

// ---------- Tags ----------

export function listTags(): Tag[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.name, COUNT(ft.file_id) as fileCount
       FROM tags t LEFT JOIN file_tags ft ON ft.tag_id = t.id
       GROUP BY t.id ORDER BY t.name ASC`
    )
    .all() as Tag[]
}

export function addTagToFiles(fileIds: string[], tagName: string): void {
  const d = getDb()
  const normalized = tagName.trim().toLowerCase()
  if (!normalized || fileIds.length === 0) return
  let tag = d.prepare('SELECT id FROM tags WHERE name = ?').get(normalized) as
    | { id: string }
    | undefined
  if (!tag) {
    const id = nanoid()
    d.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, normalized)
    tag = { id }
  }
  const stmt = d.prepare('INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)')
  const tx = d.transaction((ids: string[]) => {
    for (const fileId of ids) stmt.run(fileId, tag.id)
  })
  tx(fileIds)
}

export function addTagToFile(fileId: string, tagName: string): void {
  addTagToFiles([fileId], tagName)
}

export function removeTagFromFiles(fileIds: string[], tagName: string): void {
  const d = getDb()
  const normalized = tagName.trim().toLowerCase()
  if (!normalized || fileIds.length === 0) return
  const tag = d.prepare('SELECT id FROM tags WHERE name = ?').get(normalized) as
    | { id: string }
    | undefined
  if (!tag) return
  const stmt = d.prepare('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?')
  const tx = d.transaction((ids: string[]) => {
    for (const fileId of ids) stmt.run(fileId, tag.id)
  })
  tx(fileIds)
}

export function removeTagFromFile(fileId: string, tagName: string): void {
  removeTagFromFiles([fileId], tagName)
}

export function renameTag(tagId: string, newName: string): void {
  getDb().prepare('UPDATE tags SET name = ? WHERE id = ?').run(newName.trim().toLowerCase(), tagId)
}

export function deleteTag(tagId: string): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(tagId)
}

// ---------- Collections ----------

export function listCollections(): Collection[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.color, c.created_at as createdAt, COUNT(cf.file_id) as fileCount
       FROM collections c LEFT JOIN collection_files cf ON cf.collection_id = c.id
       GROUP BY c.id ORDER BY c.created_at ASC`
    )
    .all() as Collection[]
}

export function createCollection(name: string, color: string | null): Collection {
  const d = getDb()
  const id = nanoid()
  const createdAt = Date.now()
  d.prepare('INSERT INTO collections (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    color,
    createdAt
  )
  return { id, name, color, createdAt, fileCount: 0 }
}

export function renameCollection(id: string, name: string): void {
  getDb().prepare('UPDATE collections SET name = ? WHERE id = ?').run(name, id)
}

export function deleteCollection(id: string): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

export function addFilesToCollection(collectionId: string, fileIds: string[]): void {
  if (fileIds.length === 0) return
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO collection_files (collection_id, file_id) VALUES (?, ?)'
  )
  const tx = getDb().transaction((ids: string[]) => {
    for (const fileId of ids) stmt.run(collectionId, fileId)
  })
  tx(fileIds)
}

export function addFileToCollection(collectionId: string, fileId: string): void {
  addFilesToCollection(collectionId, [fileId])
}

export function removeFilesFromCollection(collectionId: string, fileIds: string[]): void {
  if (fileIds.length === 0) return
  const stmt = getDb().prepare(
    'DELETE FROM collection_files WHERE collection_id = ? AND file_id = ?'
  )
  const tx = getDb().transaction((ids: string[]) => {
    for (const fileId of ids) stmt.run(collectionId, fileId)
  })
  tx(fileIds)
}

export function removeFileFromCollection(collectionId: string, fileId: string): void {
  removeFilesFromCollection(collectionId, [fileId])
}

// ---------- Settings ----------

const DEFAULT_SETTINGS: AppSettings = {
  bambuStudioPath: null,
  thumbnailSize: 320,
  maxConcurrentThumbnails: 2
}

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
  return { ...DEFAULT_SETTINGS, ...map }
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  const d = getDb()
  const stmt = d.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = d.transaction((entries: [string, unknown][]) => {
    for (const [k, v] of entries) stmt.run(k, JSON.stringify(v))
  })
  tx(Object.entries(partial))
  return getSettings()
}
