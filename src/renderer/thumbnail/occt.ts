import occtimportjs from 'occt-import-js'
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'
import type { StepMeshData } from '../../shared/types'

/**
 * STEP triangulation lives only in this offscreen host entry, never in the main
 * window. OpenCascade is compiled with Emscripten's embind, which crafts its
 * invoker functions with `new Function(...)` — eval-class execution that the
 * main window's Content-Security-Policy forbids by design. This window has no
 * CSP, so the work happens here and only the resulting geometry crosses IPC.
 */

let importer: ReturnType<typeof occtimportjs> | null = null

function getImporter(): ReturnType<typeof occtimportjs> {
  if (!importer) importer = occtimportjs({ locateFile: () => occtWasmUrl })
  return importer
}

export async function triangulateStep(buffer: ArrayBuffer): Promise<StepMeshData[]> {
  const occt = await getImporter()
  const result = occt.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: 'millimeter',
    linearDeflectionType: 'bounding_box_ratio',
    linearDeflection: 0.001,
    angularDeflection: 0.5
  })
  if (!result.success || result.meshes.length === 0) {
    throw new Error('Could not triangulate STEP file')
  }

  return result.meshes.map((mesh) => ({
    position: new Float32Array(mesh.attributes.position.array),
    normal: mesh.attributes.normal ? new Float32Array(mesh.attributes.normal.array) : null,
    index: new Uint32Array(mesh.index.array),
    color: mesh.color ?? null
  }))
}
