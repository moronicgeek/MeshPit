import * as THREE from 'three'
import type { StepMeshData } from '../../../shared/types'

/**
 * Builds a Three.js group from STEP solids triangulated elsewhere (the offscreen
 * host — see thumbnail/occt.ts for why). Meshes carrying their own colour get a
 * cloned material; the rest share the one passed in.
 */
export function buildStepObject(meshes: StepMeshData[], material: THREE.Material): THREE.Group {
  const group = new THREE.Group()

  for (const mesh of meshes) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.position, 3))
    if (mesh.normal) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normal, 3))
    }
    geometry.setIndex(new THREE.BufferAttribute(mesh.index, 1))
    if (!mesh.normal) geometry.computeVertexNormals()

    let meshMaterial = material
    if (mesh.color) {
      const cloned = (material as THREE.MeshStandardMaterial).clone()
      cloned.color.setRGB(mesh.color[0], mesh.color[1], mesh.color[2])
      meshMaterial = cloned
    }
    group.add(new THREE.Mesh(geometry, meshMaterial))
  }

  return group
}
