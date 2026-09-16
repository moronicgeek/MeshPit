/// <reference types="vite/client" />
import type { MeshPitApi } from '../../preload/index'

declare module 'occt-import-js' {
  interface OcctMesh {
    name: string
    color?: [number, number, number]
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index: { array: number[] }
  }

  interface OcctResult {
    success: boolean
    meshes: OcctMesh[]
  }

  interface OcctImporter {
    ReadStepFile(content: Uint8Array, params: unknown): OcctResult
  }

  export default function occtimportjs(options?: {
    locateFile?: (path: string) => string
  }): Promise<OcctImporter>
}

declare global {
  interface Window {
    meshpit: MeshPitApi
  }
}

export {}
