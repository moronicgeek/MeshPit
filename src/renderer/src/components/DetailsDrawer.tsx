import { useMemo, useState } from 'react'
import type { Collection, MeshFileRecord, Tag } from '../../../shared/types'
import { formatBytes, formatDate, thumbnailUrl } from '../utils/format'

interface DetailsDrawerProps {
  files: MeshFileRecord[]
  collections: Collection[]
  allTags: Tag[]
  onClose: () => void
  onOpenInBambu: (id: string) => void
  onReveal: (id: string) => void
  onDelete: (ids: string[], alsoFromDisk: boolean) => void
  onRenameFile: (file: MeshFileRecord) => void
  onAddTag: (fileIds: string[], tag: string) => void
  onRemoveTag: (fileIds: string[], tag: string) => void
  onToggleCollection: (collectionId: string, fileIds: string[], currentlyAllIn: boolean) => void
}

export function DetailsDrawer({
  files,
  collections,
  allTags,
  onClose,
  onOpenInBambu,
  onReveal,
  onDelete,
  onRenameFile,
  onAddTag,
  onRemoveTag,
  onToggleCollection
}: DetailsDrawerProps): JSX.Element {
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const isSingle = files.length === 1
  const primary = files[0]
  const fileIds = files.map((f) => f.id)

  const tagCounts = new Map<string, number>()
  for (const file of files) {
    for (const tag of file.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }
  const tagList = Array.from(tagCounts.entries())

  const addTag = (tag: string): void => {
    onAddTag(fileIds, tag)
    setTagInput('')
    setShowSuggestions(false)
  }

  const suggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase()
    const alreadyOnAll = new Set(
      tagList.filter(([, count]) => count === files.length).map(([tag]) => tag)
    )
    return allTags
      .filter((t) => !alreadyOnAll.has(t.name))
      .filter((t) => (query ? t.name.toLowerCase().includes(query) : true))
      .slice(0, 8)
  }, [allTags, tagInput, tagList, files.length])

  return (
    <aside className="details-drawer">
      <div className="details-header">
        <h3>{isSingle ? primary.name : `${files.length} files selected`}</h3>
        <button className="icon-btn" onClick={onClose}>
          ×
        </button>
      </div>

      {isSingle ? (
        <>
          <div className="details-preview">
            {thumbnailUrl(primary.thumbnailPath) ? (
              <img src={thumbnailUrl(primary.thumbnailPath)!} alt={primary.name} />
            ) : (
              <div className="thumb-fallback large">{primary.ext.toUpperCase()}</div>
            )}
          </div>
          <div className="details-info">
            <div className="details-row">
              <span>Path</span>
              <span className="mono" title={primary.path}>
                {primary.path}
              </span>
            </div>
            <div className="details-row">
              <span>Size</span>
              <span>{formatBytes(primary.sizeBytes)}</span>
            </div>
            <div className="details-row">
              <span>Modified</span>
              <span>{formatDate(primary.mtimeMs)}</span>
            </div>
            <div className="details-row">
              <span>Added</span>
              <span>{formatDate(primary.addedAt)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="details-section">
          <h4>Selected items</h4>
          <ul className="multi-file-list">
            {files.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="details-section">
        <h4>Tags</h4>
        <div className="tag-cloud">
          {tagList.map(([tag, count]) => {
            const isAll = count === files.length
            return (
              <span key={tag} className={`chip ${!isAll ? 'partial' : ''}`}>
                {tag}
                {!isAll && <span className="tag-partial">({count}/{files.length})</span>}
                <button onClick={() => onRemoveTag(fileIds, tag)}>×</button>
              </span>
            )
          })}
        </div>
        <div className="tag-input-row">
          <input
            type="text"
            placeholder={isSingle ? 'Add tag and press Enter' : `Add tag to ${files.length} items`}
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                addTag(tagInput.trim())
              } else if (e.key === 'Escape') {
                setShowSuggestions(false)
              }
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="tag-suggestions">
              {suggestions.map((tag) => (
                <li key={tag.id}>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => addTag(tag.name)}>
                    {tag.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="details-section">
        <h4>Collections</h4>
        {collections.length === 0 && <div className="empty-hint">No collections yet</div>}
        {collections.map((collection) => {
          const count = files.filter((f) => f.collections.includes(collection.id)).length
          const allIn = count === files.length
          const someIn = count > 0 && !allIn
          return (
            <label key={collection.id} className="collection-toggle">
              <input
                type="checkbox"
                checked={allIn}
                ref={(el) => {
                  if (el) el.indeterminate = someIn
                }}
                onChange={() => onToggleCollection(collection.id, fileIds, allIn)}
              />
              <span className="collection-name">{collection.name}</span>
              {!isSingle && count > 0 && (
                <span className="count">
                  ({count}/{files.length})
                </span>
              )}
            </label>
          )
        })}
      </div>

      <div className="details-actions">
        {isSingle && (
          <>
            <button className="btn primary" onClick={() => onOpenInBambu(primary.id)}>
              Open in Bambu Studio
            </button>
            <button className="btn" onClick={() => onReveal(primary.id)}>
              Reveal in Finder
            </button>
            <button className="btn" onClick={() => onRenameFile(primary)}>
              Rename File
            </button>
          </>
        )}
        <button className="btn danger" onClick={() => onDelete(fileIds, false)}>
          Remove {isSingle ? '' : `${files.length} items `}from Library
        </button>
        <button className="btn danger" onClick={() => onDelete(fileIds, true)}>
          Delete {isSingle ? '' : `${files.length} items `}from Disk
        </button>
      </div>
    </aside>
  )
}
