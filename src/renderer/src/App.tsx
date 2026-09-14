import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Gallery } from './components/Gallery'
import { DetailsDrawer } from './components/DetailsDrawer'
import { SettingsModal } from './components/SettingsModal'
import { PromptModal } from './components/PromptModal'
import { useLibrary } from './hooks/useLibrary'

export default function App(): JSX.Element {
  const lib = useLibrary()
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

  const selectedFiles = useMemo(
    () => lib.files.filter((f) => selectedIds.has(f.id)),
    [lib.files, selectedIds]
  )

  const handleSelect = (id: string, additive: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(additive ? prev : [])
      if (next.has(id) && additive) next.delete(id)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (selectedIds.size === 0) return
      if (settingsOpen || collectionPromptOpen || deleteConfirm || deleteCollectionConfirm || deleteTagConfirm)
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedIds,
    settingsOpen,
    collectionPromptOpen,
    deleteConfirm,
    deleteCollectionConfirm,
    deleteTagConfirm
  ])

  return (
    <div className="app-shell">
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
        />
        <Gallery
          files={lib.files}
          selectedIds={selectedIds}
          loading={lib.loading}
          onSelect={handleSelect}
          onOpenInBambu={handleOpenInBambu}
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
