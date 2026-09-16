import { useState } from 'react'
import type { DuplicateFileGroup } from '../../../shared/types'
import { formatBytes } from '../utils/format'

interface DuplicateModalProps {
  groups: DuplicateFileGroup[]
  onClose: () => void
  onDelete: (ids: string[]) => void
}

export function DuplicateModal({ groups, onClose, onDelete }: DuplicateModalProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(groups.flatMap((group) => group.files.slice(1).map((file) => file.id)))
  )
  const duplicateCount = selectedIds.size

  const toggleFile = (id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal duplicate-modal" onMouseDown={(event) => event.stopPropagation()}>
        <h3>Duplicate Files</h3>
        <p className="modal-message">
          {groups.length === 0
            ? 'No duplicate files were found.'
            : `Choose the copies to delete. One file in each matching group is kept by default.`}
        </p>
        {groups.length > 0 && (
          <div className="duplicate-groups">
            {groups.map((group) => (
              <section key={group.hash} className="duplicate-group">
                <div className="duplicate-group-heading">
                  {group.files.length} identical files · {formatBytes(group.files[0].sizeBytes)}
                </div>
                {group.files.map((file, index) => (
                  <label key={file.id} className="duplicate-file">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      disabled={index === 0}
                      onChange={() => toggleFile(file.id)}
                    />
                    <span>
                      <strong>{file.name}</strong>
                      <small>{file.path}</small>
                    </span>
                    {index === 0 && <em>Keep</em>}
                  </label>
                ))}
              </section>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          {groups.length > 0 && (
            <button
              className="btn danger"
              disabled={duplicateCount === 0}
              onClick={() => onDelete([...selectedIds])}
            >
              Delete {duplicateCount} {duplicateCount === 1 ? 'Copy' : 'Copies'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}