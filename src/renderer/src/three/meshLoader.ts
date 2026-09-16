import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { is3MFProductionExtension, parse3MFProduction } from './parse3mf'

const stlLoader = new STLLoader()
const objLoader = new OBJLoader()
const threeMfLoader = new ThreeMFLoader()

/**
 * Parses the raw bytes of a supported mesh file into a Three.js object.
 * `material` is used for formats that carry no material of their own.
 *
 * STEP is deliberately absent: OpenCascade needs eval-class execution, so it is
 * triangulated in the offscreen host instead (see thumbnail/occt.ts) and
 * assembled by buildStepObject. Keeping it out also keeps the 7.6 MB wasm out
 * of the main window's bundle.
 */
export async function buildMeshObject(
  ext: string,
  buffer: ArrayBuffer,
  material: THREE.Material
): Promise<THREE.Object3D> {
  if (ext === 'stl') {
    const geometry = stlLoader.parse(buffer)
    geometry.computeVertexNormals()
    return new THREE.Mesh(geometry, material)
  }
  if (ext === 'obj') {
    const text = new TextDecoder().decode(buffer)
    const group = objLoader.parse(text)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material = material
    })
    return group
  }
  if (ext === '3mf') {
    // ThreeMFLoader keeps the file's own materials, so prefer it whenever it can
    // handle the archive; fall back for production-extension files it cannot read.
    if (is3MFProductionExtension(buffer)) return parse3MFProduction(buffer, material)
    try {
      const group = threeMfLoader.parse(buffer)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.material || (Array.isArray(child.material) && child.material.length === 0)) {
            child.material = material
          }
        }
      })
      return group
    } catch (e) {
      console.warn('[MeshPit] ThreeMFLoader failed, falling back to built-in 3MF parser:', e)
      return parse3MFProduction(buffer, material)
    }
  }
  throw new Error(`Unsupported extension: ${ext}`)
}

/** Frees the geometries and any per-mesh materials cloned while building `object`. */
export function disposeObject(object: THREE.Object3D, sharedMaterial: THREE.Material): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry?.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const mat of materials) {
      if (mat && mat !== sharedMaterial) mat.dispose()
    }
  })
}
