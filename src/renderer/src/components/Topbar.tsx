import type { LibraryQuery } from '../../../shared/types'
import type { ActiveView } from '../hooks/useLibrary'

interface TopbarProps {
  activeView: ActiveView
  search: string
  onSearchChange: (v: string) => void
  sortBy: LibraryQuery['sortBy']
  sortDir: LibraryQuery['sortDir']
  onSortChange: (by: LibraryQuery['sortBy'], dir: LibraryQuery['sortDir']) => void
  onAddFolder: () => void
  onRescanAll: () => void
  resultCount: number
}

function viewTitle(view: ActiveView): string {
  if (view.type === 'all') return 'All Files'
  if (view.type === 'folder') return 'Folder'
  if (view.type === 'collection') return 'Collection'
  return `#${view.name}`
}

export function Topbar({
  activeView,
  search,
  onSearchChange,
  sortBy,
  sortDir,
  onSortChange,
  onAddFolder,
  onRescanAll,
  resultCount
}: TopbarProps): JSX.Element {
  return (
    <div className="topbar">
      <div className="topbar-title">
        <h2>{viewTitle(activeView)}</h2>
        <span className="count">{resultCount} items</span>
      </div>
      <div className="topbar-controls">
        <input
          type="search"
          placeholder="Search files…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(':') as [
              NonNullable<LibraryQuery['sortBy']>,
              NonNullable<LibraryQuery['sortDir']>
            ]
            onSortChange(by, dir)
          }}
        >
          <option value="addedAt:desc">Recently added</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="sizeBytes:desc">Largest first</option>
          <option value="mtimeMs:desc">Recently modified</option>
        </select>
        <button className="btn" onClick={onRescanAll}>
          ⟳ Rescan All
        </button>
        <button className="btn primary" onClick={onAddFolder}>
          + Add Folder
        </button>
      </div>
    </div>
  )
}
