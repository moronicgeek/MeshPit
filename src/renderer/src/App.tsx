import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Gallery } from './components/Gallery'
import { DetailsDrawer } from './components/DetailsDrawer'
import { SettingsModal } from './components/SettingsModal'
import { PromptModal } from './components/PromptModal'
import { useLibrary } from './hooks/useLibrary'
import appIcon from '../../../resources/icon.svg'

export default function App(): JSX.Element {
  const lib = useLibrary()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collectionPromptOpen, setCollectionPromptOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; alsoFromDisk: boolean } | null>(
    null
  )
  const [deleteCollectionConfirm, setDeleteCollectionConfirm] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<{ id: string; name: string } | null>(
    null
  )
  const [renameCollectionTarget, setRenameCollectionTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [renameFileTarget, setRenameFileTarget] = useState<{ id: string; baseName: string } | null>(
    null
  )

  const selectedFiles = useMemo(
    () => lib.files.filter((f) => selectedIds.has(f.id)),
    [lib.files, selectedIds]
  )
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null)
  const [selectionFocus, setSelectionFocus] = useState<string | null>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const handleSelect = (id: string, modifiers: { shift: boolean; meta: boolean }): void => {
    setSelectionFocus(id)
    if (modifiers.shift && selectionAnchor) {
      const ids = lib.files.map((f) => f.id)
      const anchorIndex = ids.indexOf(selectionAnchor)
      const clickedIndex = ids.indexOf(id)
      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const [start, end] = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex]
        setSelectedIds(new Set(ids.slice(start, end + 1)))
        return
      }
    }

    setSelectionAnchor(id)
    setSelectedIds((prev) => {
      const next = new Set(modifiers.meta ? prev : [])
      if (next.has(id) && modifiers.meta) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenInBambu = (id: string): void => {
    void window.meshpit.openInBambuStudio(id)
  }

  const handleReveal = (id: string): void => {
    void window.meshpit.revealFile(id)
  }

  const handleDeleteRequest = (ids: string[], alsoFromDisk: boolean): void => {
    setDeleteConfirm({ ids, alsoFromDisk })
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteConfirm) return
    await window.meshpit.deleteFiles({ ids: deleteConfirm.ids, alsoFromDisk: deleteConfirm.alsoFromDisk })
    setSelectedIds(new Set())
    setDeleteConfirm(null)
    await lib.refreshAll()
  }

  const handleAddTag = (fileIds: string[], tag: string): void => {
    void window.meshpit.addTagToFiles(fileIds, tag)
  }
  const handleRemoveTag = (fileIds: string[], tag: string): void => {
    void window.meshpit.removeTagFromFiles(fileIds, tag)
  }
  const handleToggleCollection = (collectionId: string, fileIds: string[], currentlyAllIn: boolean): void => {
    if (currentlyAllIn) void window.meshpit.removeFilesFromCollection(collectionId, fileIds)
    else void window.meshpit.addFilesToCollection(collectionId, fileIds)
  }

  const handleRenameFileRequest = (file: { id: string; name: string; ext: string }): void => {
    const baseName = file.name.replace(new RegExp(`\\.${file.ext}$`, 'i'), '')
    setRenameFileTarget({ id: file.id, baseName })
  }

  const confirmRenameFile = async (newBaseName: string): Promise<void> => {
    if (!renameFileTarget) return
    try {
      await lib.renameFile(renameFileTarget.id, newBaseName)
      setRenameFileTarget(null)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to rename file')
    }
  }

  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    const handleArrowNav = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
        return
      if (
        settingsOpen ||
        collectionPromptOpen ||
        deleteConfirm ||
        deleteCollectionConfirm ||
        deleteTagConfirm ||
        renameCollectionTarget ||
        renameFileTarget
      )
        return

      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (isInput) return

      const ids = lib.files.map((f) => f.id)
      if (ids.length === 0) return

      e.preventDefault()

      let columns = 1
      const grid = galleryRef.current
      if (grid) {
        columns = window.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1
      }

      const delta =
        e.key === 'ArrowLeft'
          ? -1
          : e.key === 'ArrowRight'
            ? 1
            : e.key === 'ArrowUp'
              ? -columns
              : columns

      const focusId = selectionFocus ?? selectionAnchor ?? ids[0]
      const currentIndex = Math.max(ids.indexOf(focusId), 0)
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), ids.length - 1)
      const nextId = ids[nextIndex]

      const anchorId = selectionAnchor ?? focusId
      if (!selectionAnchor) setSelectionAnchor(anchorId)
      setSelectionFocus(nextId)

      const anchorIndex = ids.indexOf(anchorId)
      const [start, end] = anchorIndex < nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex]
      setSelectedIds(new Set(ids.slice(start, end + 1)))

      grid?.querySelector(`[data-file-id="${nextId}"]`)?.scrollIntoView({ block: 'nearest' })
    }

    window.addEventListener('keydown', handleArrowNav)
    return () => window.removeEventListener('keydown', handleArrowNav)
  }, [
    lib.files,
    selectionAnchor,
    selectionFocus,
    settingsOpen,
    collectionPromptOpen,
    deleteConfirm,
    deleteCollectionConfirm,
    deleteTagConfirm,
    renameCollectionTarget,
    renameFileTarget
  ])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (selectedIds.size === 0) return
      if (
        settingsOpen ||
        collectionPromptOpen ||
        deleteConfirm ||
        deleteCollectionConfirm ||
        deleteTagConfirm ||
        renameCollectionTarget ||
        renameFileTarget
      )
        return

      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isInput) return

      if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        handleDeleteRequest(Array.from(selectedIds), true)
      } else if (!e.metaKey && !e.ctrlKey && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        handleDeleteRequest(Array.from(selectedIds), false)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r' && selectedFiles.length === 1) {
        e.preventDefault()
        handleRenameFileRequest(selectedFiles[0])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedIds,
    selectedFiles,
    settingsOpen,
    collectionPromptOpen,
    deleteConfirm,
    deleteCollectionConfirm,
    deleteTagConfirm,
    renameCollectionTarget,
    renameFileTarget
  ])

  return (
    <div className="app-shell">
      <div className="window-brand">
        <img src={appIcon} alt="" />
        <span>MeshPit</span>
      </div>
      <Sidebar
        folders={lib.folders}
        collections={lib.collections}
        tags={lib.tags}
        activeView={lib.activeView}
        onSelectView={(v) => {
          lib.setActiveView(v)
          setSelectedIds(new Set())
        }}
        onAddFolder={lib.addFolder}
        onRemoveFolder={lib.removeFolder}
        onRescanFolder={lib.rescanFolder}
        onCreateCollection={() => setCollectionPromptOpen(true)}
        onRenameCollection={(id) => {
          const collection = lib.collections.find((c) => c.id === id)
          setRenameCollectionTarget({ id, name: collection?.name ?? '' })
        }}
        onDeleteCollection={(id) => {
          const collection = lib.collections.find((c) => c.id === id)
          setDeleteCollectionConfirm({ id, name: collection?.name ?? 'this collection' })
        }}
        onDeleteTag={(id) => {
          const tag = lib.tags.find((t) => t.id === id)
          setDeleteTagConfirm({ id, name: tag?.name ?? 'this tag' })
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        totalCount={lib.files.length}
      />

      <main className="main-panel">
        <Topbar
          activeView={lib.activeView}
          search={lib.search}
          onSearchChange={lib.setSearch}
          sortBy={lib.sortBy}
          sortDir={lib.sortDir}
          onSortChange={lib.setSort}
          onAddFolder={lib.addFolder}
          onRescanAll={lib.rescanAll}
          resultCount={lib.files.length}
          searchInputRef={searchInputRef}
        />
        <Gallery
          files={lib.files}
          selectedIds={selectedIds}
          loading={lib.loading}
          onSelect={handleSelect}
          onOpenInBambu={handleOpenInBambu}
          containerRef={galleryRef}
        />
      </main>

      {selectedFiles.length > 0 && (
        <DetailsDrawer
          files={selectedFiles}
          collections={lib.collections}
          allTags={lib.tags}
          onClose={() => setSelectedIds(new Set())}
          onOpenInBambu={handleOpenInBambu}
          onReveal={handleReveal}
          onDelete={handleDeleteRequest}
          onRenameFile={handleRenameFileRequest}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onToggleCollection={handleToggleCollection}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {collectionPromptOpen && (
        <PromptModal
          title="New Collection"
          confirmLabel="Create"
          onCancel={() => setCollectionPromptOpen(false)}
          onConfirm={(name) => {
            void lib.createCollection(name)
            setCollectionPromptOpen(false)
          }}
        />
      )}

      {renameCollectionTarget && (
        <PromptModal
          title="Rename Collection"
          defaultValue={renameCollectionTarget.name}
          confirmLabel="Rename"
          onCancel={() => setRenameCollectionTarget(null)}
          onConfirm={(name) => {
            void lib.renameCollection(renameCollectionTarget.id, name)
            setRenameCollectionTarget(null)
          }}
        />
      )}

      {renameFileTarget && (
        <PromptModal
          title="Rename File"
          message="The file will be renamed on disk. The file extension stays the same."
          defaultValue={renameFileTarget.baseName}
          confirmLabel="Rename"
          onCancel={() => setRenameFileTarget(null)}
          onConfirm={(name) => void confirmRenameFile(name)}
        />
      )}

      {deleteConfirm && (
        <PromptModal
          title={deleteConfirm.alsoFromDisk ? 'Delete from disk?' : 'Remove from library?'}
          message={
            deleteConfirm.alsoFromDisk
              ? `This will permanently delete ${deleteConfirm.ids.length} file(s) from your file system. This cannot be undone.`
              : `This removes ${deleteConfirm.ids.length} file(s) from the MeshPit index only. The original files stay on disk.`
          }
          confirmLabel={deleteConfirm.alsoFromDisk ? 'Delete Permanently' : 'Remove'}
          danger
          requireInput={false}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {deleteCollectionConfirm && (
        <PromptModal
          title="Delete collection?"
          message={`This deletes "${deleteCollectionConfirm.name}" from your library. Files inside it are not deleted.`}
          confirmLabel="Delete"
          danger
          requireInput={false}
          onCancel={() => setDeleteCollectionConfirm(null)}
          onConfirm={() => {
            lib.deleteCollection(deleteCollectionConfirm.id)
            setDeleteCollectionConfirm(null)
          }}
        />
      )}

      {deleteTagConfirm && (
        <PromptModal
          title="Delete tag?"
          message={`This removes the "${deleteTagConfirm.name}" tag from all files. Files themselves are not deleted.`}
          confirmLabel="Delete"
          danger
          requireInput={false}
          onCancel={() => setDeleteTagConfirm(null)}
          onConfirm={() => {
            lib.deleteTag(deleteTagConfirm.id)
            setDeleteTagConfirm(null)
          }}
        />
      )}
    </div>
  )
}
