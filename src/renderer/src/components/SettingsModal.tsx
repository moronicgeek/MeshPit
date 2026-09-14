import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.meshpit.getSettings().then(setSettings)
  }, [])

  if (!settings) return <></>

  const pickBambuPath = async (): Promise<void> => {
    const path = await window.meshpit.selectExecutable()
    if (!path) return
    const updated = await window.meshpit.setSettings({ bambuStudioPath: path })
    setSettings(updated)
  }

  const clearBambuPath = async (): Promise<void> => {
    const updated = await window.meshpit.setSettings({ bambuStudioPath: null })
    setSettings(updated)
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <div className="settings-row">
          <label>Bambu Studio</label>
          <div className="settings-value">
            <span className="mono" title={settings.bambuStudioPath ?? ''}>
              {settings.bambuStudioPath ?? 'Using system default handler'}
            </span>
            <div className="settings-buttons">
              <button className="btn" onClick={pickBambuPath}>
                Choose…
              </button>
              {settings.bambuStudioPath && (
                <button className="btn" onClick={clearBambuPath}>
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="settings-row">
          <label>Thumbnail size</label>
          <select
            value={settings.thumbnailSize}
            onChange={async (e) => {
              const updated = await window.meshpit.setSettings({
                thumbnailSize: Number(e.target.value)
              })
              setSettings(updated)
            }}
          >
            <option value={160}>Small (160px)</option>
            <option value={320}>Medium (320px)</option>
            <option value={512}>Large (512px)</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
