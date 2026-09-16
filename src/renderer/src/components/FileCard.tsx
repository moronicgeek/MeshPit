import type { MeshFileRecord } from '../../../shared/types'
import { formatBytes, thumbnailUrl } from '../utils/format'

interface FileCardProps {
  file: MeshFileRecord
  selected: boolean
  onSelect: (id: string, modifiers: { shift: boolean; meta: boolean }) => void
  onOpenInBambu: (id: string) => void
}

export function FileCard({ file, selected, onSelect, onOpenInBambu }: FileCardProps): JSX.Element {
  const src = thumbnailUrl(file.thumbnailPath)

  return (
    <div
      className={`file-card ext-${file.ext} ${selected ? 'selected' : ''}`}
      data-file-id={file.id}
      onClick={(e) => onSelect(file.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })}
      onDoubleClick={() => onOpenInBambu(file.id)}
    >
      <div className="thumb">
        {src ? (
          <img src={src} alt={file.name} draggable={false} />
        ) : (
          <div className="thumb-fallback">
            <span>{file.ext.toUpperCase()}</span>
            {file.thumbnailStatus === 'pending' && <div className="spinner" />}
          </div>
        )}
        <span className={`badge ext-badge ext-badge-${file.ext}`}>{file.ext}</span>
      </div>
      <div className="file-meta">
        <div className="file-name" title={file.name}>
          {file.name}
        </div>
        <div className="file-sub">{formatBytes(file.sizeBytes)}</div>
      </div>
      {file.tags.length > 0 && (
        <div className="file-tags">
          {file.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="chip mini">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
