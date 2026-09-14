import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Collection,
  LibraryQuery,
  MeshFileRecord,
  Tag,
  WatchedFolder
} from '../../../shared/types'

export type ActiveView =
  | { type: 'all' }
  | { type: 'folder'; id: string }
  | { type: 'collection'; id: string }
  | { type: 'tag'; name: string }

export function useLibrary(): {
  folders: WatchedFolder[]
  collections: Collection[]
  tags: Tag[]
  files: MeshFileRecord[]
  loading: boolean
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void
  search: string
  setSearch: (s: string) => void
  sortBy: LibraryQuery['sortBy']
  sortDir: LibraryQuery['sortDir']
  setSort: (by: LibraryQuery['sortBy'], dir: LibraryQuery['sortDir']) => void
  refreshAll: () => Promise<void>
  addFolder: () => Promise<void>
  removeFolder: (id: string) => Promise<void>
  rescanFolder: (id: string) => Promise<void>
  rescanAll: () => Promise<void>
  createCollection: (name: string) => Promise<void>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  deleteTag: (id: string) => Promise<void>
} {
  const [folders, setFolders] = useState<WatchedFolder[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [files, setFiles] = useState<MeshFileRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'all' })
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<LibraryQuery['sortBy']>('addedAt')
  const [sortDir, setSortDir] = useState<LibraryQuery['sortDir']>('desc')

  const query = useMemo<LibraryQuery>(() => {
    const q: LibraryQuery = { search: search || undefined, sortBy, sortDir }
    if (activeView.type === 'folder') q.folderId = activeView.id
    if (activeView.type === 'collection') q.collectionId = activeView.id
    if (activeView.type === 'tag') q.tag = activeView.name
    return q
  }, [activeView, search, sortBy, sortDir])

  const refreshFiles = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.meshpit.getFiles(query)
      setFiles(result)
    } finally {
      setLoading(false)
    }
  }, [query])

  const refreshSidebar = useCallback(async () => {
    const [f, c, t] = await Promise.all([
      window.meshpit.listFolders(),
      window.meshpit.listCollections(),
      window.meshpit.listTags()
    ])
    setFolders(f)
    setCollections(c)
    setTags(t)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshFiles(), refreshSidebar()])
  }, [refreshFiles, refreshSidebar])

  useEffect(() => {
    void refreshFiles()
  }, [refreshFiles])

  useEffect(() => {
    void refreshSidebar()
  }, [refreshSidebar])

  useEffect(() => {
    const offChanged = window.meshpit.onLibraryChanged(() => {
      void refreshFiles()
      void refreshSidebar()
    })
    return () => offChanged()
  }, [refreshFiles, refreshSidebar])

  const addFolder = useCallback(async () => {
    const folderPath = await window.meshpit.selectFolder()
    if (!folderPath) return
    await window.meshpit.addFolder(folderPath)
    await refreshSidebar()
  }, [refreshSidebar])

  const removeFolder = useCallback(
    async (id: string) => {
      await window.meshpit.removeFolder(id)
      if (activeView.type === 'folder' && activeView.id === id) setActiveView({ type: 'all' })
      await refreshAll()
    },
    [activeView, refreshAll]
  )

  const rescanFolder = useCallback(async (id: string) => {
    await window.meshpit.rescanFolder(id)
  }, [])

  const rescanAll = useCallback(async () => {
    await window.meshpit.rescanAll()
  }, [])

  const createCollection = useCallback(
    async (name: string) => {
      await window.meshpit.createCollection(name, null)
      await refreshSidebar()
    },
    [refreshSidebar]
  )

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      await window.meshpit.renameCollection(id, name)
      await refreshSidebar()
    },
    [refreshSidebar]
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      await window.meshpit.deleteCollection(id)
      if (activeView.type === 'collection' && activeView.id === id) setActiveView({ type: 'all' })
      await refreshAll()
    },
    [activeView, refreshAll]
  )

  const deleteTag = useCallback(
    async (id: string) => {
      const tagName = tags.find((t) => t.id === id)?.name
      await window.meshpit.deleteTag(id)
      if (activeView.type === 'tag' && tagName && activeView.name === tagName) {
        setActiveView({ type: 'all' })
      }
      await refreshAll()
    },
    [activeView, tags, refreshAll]
  )

  const setSort = useCallback((by: LibraryQuery['sortBy'], dir: LibraryQuery['sortDir']) => {
    setSortBy(by)
    setSortDir(dir)
  }, [])

  return {
    folders,
    collections,
    tags,
    files,
    loading,
    activeView,
    setActiveView,
    search,
    setSearch,
    sortBy,
    sortDir,
    setSort,
    refreshAll,
    addFolder,
    removeFolder,
    rescanFolder,
    rescanAll,
    createCollection,
    renameCollection,
    deleteCollection,
    deleteTag
  }
}
