import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type { StepMeshData } from '../shared/types'

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

export interface StepTriangulateRequest {
  requestId: string
  buffer: ArrayBuffer
}

export interface StepTriangulateResult {
  requestId: string
  success: boolean
  meshes?: StepMeshData[]
  error?: string
}

contextBridge.exposeInMainWorld('meshpitThumbnailHost', {
  sendReady: (): void => {
    ipcRenderer.send(IpcChannels.hostReady)
  },
  onRenderRequest: (cb: (req: ThumbnailRenderRequest) => void): void => {
    ipcRenderer.on(IpcChannels.thumbnailRenderRequest, (_e, req: ThumbnailRenderRequest) =>
      cb(req)
    )
  },
  sendRenderResult: (result: ThumbnailRenderResult): void => {
    ipcRenderer.send(IpcChannels.thumbnailRenderResult, result)
  },
  onStepRequest: (cb: (req: StepTriangulateRequest) => void): void => {
    ipcRenderer.on(IpcChannels.stepTriangulateRequest, (_e, req: StepTriangulateRequest) => cb(req))
  },
  sendStepResult: (result: StepTriangulateResult): void => {
    ipcRenderer.send(IpcChannels.stepTriangulateResult, result)
  }
})
