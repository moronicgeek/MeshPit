import type { Collection, Tag, WatchedFolder } from '../../../shared/types'
import type { ActiveView } from '../hooks/useLibrary'

interface SidebarProps {
  folders: WatchedFolder[]
  collections: Collection[]
  tags: Tag[]
  activeView: ActiveView
  onSelectView: (v: ActiveView) => void
  onAddFolder: () => void
  onRemoveFolder: (id: string) => void
  onRescanFolder: (id: string) => void
  onCreateCollection: () => void
  onDeleteCollection: (id: string) => void
  onDeleteTag: (id: string) => void
  onOpenSettings: () => void
  totalCount: number
}

export function Sidebar({
  folders,
  collections,
  tags,
  activeView,
  onSelectView,
  onAddFolder,
  onRemoveFolder,
  onRescanFolder,
  onCreateCollection,
  onDeleteCollection,
  onDeleteTag,
  onOpenSettings,
  totalCount
}: SidebarProps): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">◆</span>
        <span className="brand-name">MeshPit</span>
      </div>

      <button
        className={`nav-item ${activeView.type === 'all' ? 'active' : ''}`}
        onClick={() => onSelectView({ type: 'all' })}
      >
        <span>All Files</span>
        <span className="count">{totalCount}</span>
      </button>

      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Folders</span>
          <button className="icon-btn" title="Add folder" onClick={onAddFolder}>
            +
          </button>
        </div>
        {folders.length === 0 && <div className="empty-hint">No folders indexed yet</div>}
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`nav-item nested ${
              activeView.type === 'folder' && activeView.id === folder.id ? 'active' : ''
            }`}
          >
            <button
              className="nav-item-label"
              title={folder.path}
              onClick={() => onSelectView({ type: 'folder', id: folder.id })}
            >
              {folder.path.split('/').pop() || folder.path}
            </button>
            <button className="icon-btn small" title="Rescan" onClick={() => onRescanFolder(folder.id)}>
              ⟳
            </button>
            <button
              className="icon-btn small"
              title="Stop watching"
              onClick={() => onRemoveFolder(folder.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Collections</span>
          <button className="icon-btn" title="New collection" onClick={onCreateCollection}>
            +
          </button>
        </div>
        {collections.length === 0 && <div className="empty-hint">No collections yet</div>}
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={`nav-item nested ${
              activeView.type === 'collection' && activeView.id === collection.id ? 'active' : ''
            }`}
          >
            <button
              className="nav-item-label"
              onClick={() => onSelectView({ type: 'collection', id: collection.id })}
            >
              {collection.name}
            </button>
            <span className="count">{collection.fileCount}</span>
            <button
              className="icon-btn small"
              title="Delete collection"
              onClick={() => onDeleteCollection(collection.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span>Tags</span>
        </div>
        {tags.length === 0 && <div className="empty-hint">No tags yet</div>}
        <div className="tag-cloud">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={`chip tag-chip ${
                activeView.type === 'tag' && activeView.name === tag.name ? 'active' : ''
              }`}
            >
              <button className="tag-chip-label" onClick={() => onSelectView({ type: 'tag', name: tag.name })}>
                {tag.name} <span className="count">{tag.fileCount}</span>
              </button>
              <button className="icon-btn small" title="Delete tag" onClick={() => onDeleteTag(tag.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="btn" onClick={onOpenSettings}>
          ⚙ Settings
        </button>
      </div>
    </aside>
  )
}
