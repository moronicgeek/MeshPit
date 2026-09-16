import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import * as fflate from 'fflate'
import occtimportjs from 'occt-import-js'
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'

declare global {
  interface Window {
    meshpitThumbnailHost: {
      onRenderRequest: (cb: (req: { id: string; ext: string; size: number; buffer: ArrayBuffer }) => void) => void
      sendRenderResult: (result: { id: string; success: boolean; dataUrl?: string; error?: string }) => void
    }
  }
}

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
})
renderer.setClearColor(0x000000, 0)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000)

scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1f3d, 1.15))
const key = new THREE.DirectionalLight(0xffffff, 1.2)
key.position.set(5, 10, 7)
scene.add(key)
const rim = new THREE.DirectionalLight(0xb388ff, 0.7)
rim.position.set(-6, -2, -6)
scene.add(rim)

const material = new THREE.MeshStandardMaterial({
  color: 0xcdbdfb,
  metalness: 0.1,
  roughness: 0.55
})

const stlLoader = new STLLoader()
const objLoader = new OBJLoader()
const threeMfLoader = new ThreeMFLoader()
const occtImporter = occtimportjs({ locateFile: () => occtWasmUrl })

let currentMesh: THREE.Object3D | null = null

function clearMesh(): void {
  if (currentMesh) {
    scene.remove(currentMesh)
    currentMesh = null
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 0x8000
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

function extract3MFThumbnail(buffer: ArrayBuffer): string | null {
  try {
    const unzipped = fflate.unzipSync(new Uint8Array(buffer))
    const files = Object.keys(unzipped)
    if (files.length === 0) return null

    const scoreKey = (key: string): number => {
      const k = key.toLowerCase()
      if (!k.endsWith('.png') && !k.endsWith('.jpg') && !k.endsWith('.jpeg')) return -1

      if (k === 'metadata/thumbnail.png' || k === 'metadata/thumbnail.jpg' || k === 'metadata/thumbnail.jpeg') return 100
      if (k === '3d/metadata/thumbnail.png' || k === '3d/metadata/thumbnail.jpg') return 95
      if (k === 'metadata/plate_1.png' || k === 'metadata/plate_1_small.png') return 90
      if (k.includes('metadata/plate_')) return 85
      if (k.includes('metadata') && (k.includes('thumb') || k.includes('plate') || k.includes('preview'))) return 80
      if (k.includes('metadata')) return 70
      if (k.includes('thumb') || k.includes('plate') || k.includes('preview')) return 60
      return -1
    }

    let bestKey: string | null = null
    let bestScore = -1

    for (const key of files) {
      const score = scoreKey(key)
      if (score > bestScore) {
        bestScore = score
        bestKey = key
      }
    }

    if (bestKey && unzipped[bestKey] && unzipped[bestKey].length > 0) {
      const bytes = unzipped[bestKey]
      const mime = bestKey.toLowerCase().endsWith('.jpg') || bestKey.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png'
      const base64 = uint8ArrayToBase64(bytes)
      return `data:${mime};base64,${base64}`
    }
  } catch (e) {
    console.warn('[MeshPit] Could not extract embedded 3MF thumbnail:', e)
  }
  return null
}

function frameObject(object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)

  object.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const distance = maxDim * 2.2
  camera.position.set(distance, distance * 0.85, distance)
  camera.near = Math.max(0.1, maxDim / 100)
  camera.far = Math.max(1000, maxDim * 100)
  camera.updateProjectionMatrix()
  camera.lookAt(0, 0, 0)
}

async function buildObjectFromGeometry(ext: string, buffer: ArrayBuffer): Promise<THREE.Object3D> {
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
    const group = threeMfLoader.parse(buffer)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.material || (Array.isArray(child.material) && child.material.length === 0)) {
          child.material = material
        }
      }
    })
    return group
  }
  if (ext === 'step') {
    const result = (await occtImporter).ReadStepFile(new Uint8Array(buffer), {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.001,
      angularDeflection: 0.5
    })
    if (!result.success || result.meshes.length === 0) throw new Error('Could not triangulate STEP file')

    const group = new THREE.Group()
    for (const mesh of result.meshes) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3))
      if (mesh.attributes.normal) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3))
      } else {
        geometry.computeVertexNormals()
      }
      geometry.setIndex(mesh.index.array)
      const meshMaterial = mesh.color
        ? material.clone()
        : material
      if (mesh.color) meshMaterial.color.setRGB(mesh.color[0], mesh.color[1], mesh.color[2])
      group.add(new THREE.Mesh(geometry, meshMaterial))
    }
    return group
  }
  throw new Error(`Unsupported extension: ${ext}`)
}

window.meshpitThumbnailHost.onRenderRequest(async ({ id, ext, size, buffer }) => {
  try {
    renderer.setSize(size, size, false)
    camera.aspect = 1
    camera.updateProjectionMatrix()
    clearMesh()

    if (ext === '3mf') {
      const embeddedDataUrl = extract3MFThumbnail(buffer)
      if (embeddedDataUrl) {
        window.meshpitThumbnailHost.sendRenderResult({ id, success: true, dataUrl: embeddedDataUrl })
        return
      }
    }

    const object = await buildObjectFromGeometry(ext, buffer)
    scene.add(object)
    currentMesh = object
    frameObject(object)

    renderer.render(scene, camera)
    const dataUrl = canvas.toDataURL('image/png')
    window.meshpitThumbnailHost.sendRenderResult({ id, success: true, dataUrl })
  } catch (error) {
    console.error(`[MeshPit] Thumbnail generation failed for ${id} (${ext}):`, error)
    window.meshpitThumbnailHost.sendRenderResult({ id, success: false, error: String(error) })
  } finally {
    clearMesh()
  }
})
