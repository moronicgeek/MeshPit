/// <reference types="vite/client" />
import type { MeshPitApi } from '../../preload/index'

declare global {
  interface Window {
    meshpit: MeshPitApi
  }
}

export {}
