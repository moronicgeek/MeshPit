import { useEffect, useState } from 'react'

interface PromptModalProps {
  title: string
  message?: string
  defaultValue?: string
  confirmLabel?: string
  danger?: boolean
  requireInput?: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptModal({
  title,
  message,
  defaultValue = '',
  confirmLabel = 'Confirm',
  danger = false,
  requireInput = true,
  onConfirm,
  onCancel
}: PromptModalProps): JSX.Element {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        {requireInput && (
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) onConfirm(value.trim())
            }}
          />
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            disabled={requireInput && !value.trim()}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
