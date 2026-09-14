import type { MeshFileRecord } from '../../../shared/types'
import { FileCard } from './FileCard'

interface GalleryProps {
  files: MeshFileRecord[]
  selectedIds: Set<string>
  loading: boolean
  onSelect: (id: string, additive: boolean) => void
  onOpenInBambu: (id: string) => void
}

export function Gallery({ files, selectedIds, loading, onSelect, onOpenInBambu }: GalleryProps): JSX.Element {
  if (!loading && files.length === 0) {
    return (
      <div className="gallery-empty">
        <p>No files here yet.</p>
        <p className="hint">Add a folder from the sidebar to start indexing STL, OBJ and 3MF files.</p>
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          selected={selectedIds.has(file.id)}
          onSelect={onSelect}
          onOpenInBambu={onOpenInBambu}
        />
      ))}
    </div>
  )
}
