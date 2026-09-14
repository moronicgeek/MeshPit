import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc'

export interface ThumbnailRenderRequest {
  id: string
  ext: string
  size: number
  buffer: ArrayBuffer
}

export interface ThumbnailRenderResult {
  id: string
  success: boolean
  dataUrl?: string
  error?: string
}

contextBridge.exposeInMainWorld('meshpitThumbnailHost', {
  onRenderRequest: (cb: (req: ThumbnailRenderRequest) => void): void => {
    ipcRenderer.on(IpcChannels.thumbnailRenderRequest, (_e, req: ThumbnailRenderRequest) =>
      cb(req)
    )
  },
  sendRenderResult: (result: ThumbnailRenderResult): void => {
    ipcRenderer.send(IpcChannels.thumbnailRenderResult, result)
  }
})
