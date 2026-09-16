import * as THREE from 'three'
import * as fflate from 'fflate'

/**
 * Minimal 3MF reader that understands the production extension (OPC part
 * splitting), where `<component p:path="/3D/Objects/object_N.model">` points at
 * geometry living in a separate part of the archive. Bambu Studio, Orca and
 * PrusaSlicer all write files this way, and three's ThreeMFLoader does not
 * follow those references — it only resolves object ids within the root model.
 *
 * Meshes are built non-indexed so `computeVertexNormals()` yields flat shading;
 * 3MF stores no normals, so faceted is the faithful interpretation.
 */

const DEFAULT_ROOT_MODEL = '3D/3dmodel.model'

interface RawMesh {
  positions: Float32Array
  indices: Uint32Array
}

interface RawComponent {
  path: string | null
  objectid: string
  transform: THREE.Matrix4 | null
}

interface RawObject {
  mesh: RawMesh | null
  components: RawComponent[]
}

type ModelFile = Map<string, RawObject>

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name.replace(':', '\\:')}="([^"]*)"`))
  return match ? match[1] : null
}

/** 3MF transforms are 12 numbers: three basis rows followed by the translation row. */
function parseTransform(value: string | null): THREE.Matrix4 | null {
  if (!value) return null
  const n = value.trim().split(/\s+/).map(Number)
  if (n.length !== 12 || n.some(Number.isNaN)) return null
  // prettier-ignore
  return new THREE.Matrix4().set(
    n[0], n[3], n[6], n[9],
    n[1], n[4], n[7], n[10],
    n[2], n[5], n[8], n[11],
    0, 0, 0, 1
  )
}

function parseMesh(body: string): RawMesh | null {
  const meshMatch = body.match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/)
  if (!meshMatch) return null
  const meshBody = meshMatch[1]

  const verts: number[] = []
  const vertexRe = /<vertex\b[^>]*?x="([^"]*)"[^>]*?y="([^"]*)"[^>]*?z="([^"]*)"/g
  for (let m = vertexRe.exec(meshBody); m; m = vertexRe.exec(meshBody)) {
    verts.push(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  if (verts.length === 0) return null

  const tris: number[] = []
  const triangleRe = /<triangle\b[^>]*?v1="([^"]*)"[^>]*?v2="([^"]*)"[^>]*?v3="([^"]*)"/g
  for (let m = triangleRe.exec(meshBody); m; m = triangleRe.exec(meshBody)) {
    tris.push(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  if (tris.length === 0) return null

  return { positions: new Float32Array(verts), indices: new Uint32Array(tris) }
}

function parseModelFile(text: string): ModelFile {
  const objects: ModelFile = new Map()
  const objectRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g
  for (let m = objectRe.exec(text); m; m = objectRe.exec(text)) {
    const id = attr(m[1], 'id')
    if (!id) continue
    const body = m[2]

    const components: RawComponent[] = []
    const componentRe = /<component\b([^>]*?)\/?>/g
    for (let c = componentRe.exec(body); c; c = componentRe.exec(body)) {
      const objectid = attr(c[1], 'objectid')
      if (!objectid) continue
      components.push({
        path: attr(c[1], 'p:path'),
        objectid,
        transform: parseTransform(attr(c[1], 'transform'))
      })
    }

    objects.set(id, { mesh: parseMesh(body), components })
  }
  return objects
}

/** Resolves an OPC part name ("/3D/Objects/x.model") to a zip entry key. */
function normalizePath(path: string): string {
  return path.replace(/^\/+/, '')
}

function findRootModelPath(entries: Record<string, Uint8Array>): string {
  const rels = entries['_rels/.rels']
  if (rels) {
    const text = new TextDecoder().decode(rels)
    const relRe = /<Relationship\b([^>]*)\/?>/g
    for (let m = relRe.exec(text); m; m = relRe.exec(text)) {
      const type = attr(m[1], 'Type') ?? ''
      const target = attr(m[1], 'Target')
      if (target && type.endsWith('3dmodel')) {
        const key = normalizePath(target)
        if (entries[key]) return key
      }
    }
  }
  if (entries[DEFAULT_ROOT_MODEL]) return DEFAULT_ROOT_MODEL
  const fallback = Object.keys(entries).find((k) => k.toLowerCase().endsWith('.model'))
  if (!fallback) throw new Error('3MF archive contains no model part')
  return fallback
}

/** True when the archive relies on the production extension that ThreeMFLoader cannot follow. */
export function is3MFProductionExtension(buffer: ArrayBuffer): boolean {
  try {
    const entries = fflate.unzipSync(new Uint8Array(buffer))
    const rootPath = findRootModelPath(entries)
    return new TextDecoder().decode(entries[rootPath]).includes('p:path')
  } catch {
    return false
  }
}

export function parse3MFProduction(buffer: ArrayBuffer, material: THREE.Material): THREE.Group {
  const entries = fflate.unzipSync(new Uint8Array(buffer))
  const rootPath = findRootModelPath(entries)
  const decoder = new TextDecoder()

  const parsedFiles = new Map<string, ModelFile>()
  const loadFile = (path: string): ModelFile => {
    const cached = parsedFiles.get(path)
    if (cached) return cached
    const entry = entries[path]
    if (!entry) throw new Error(`3MF references missing part: ${path}`)
    const parsed = parseModelFile(decoder.decode(entry))
    parsedFiles.set(path, parsed)
    return parsed
  }

  const geometryCache = new Map<string, THREE.BufferGeometry>()
  const buildGeometry = (key: string, mesh: RawMesh): THREE.BufferGeometry => {
    const cached = geometryCache.get(key)
    if (cached) return cached
    // Expand to non-indexed so each face gets its own normal.
    const positions = new Float32Array(mesh.indices.length * 3)
    for (let i = 0; i < mesh.indices.length; i++) {
      const v = mesh.indices[i] * 3
      positions[i * 3] = mesh.positions[v]
      positions[i * 3 + 1] = mesh.positions[v + 1]
      positions[i * 3 + 2] = mesh.positions[v + 2]
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    geometryCache.set(key, geometry)
    return geometry
  }

  const buildObject = (path: string, id: string, stack: Set<string>): THREE.Object3D | null => {
    const key = `${path}#${id}`
    if (stack.has(key)) return null // malformed file with a component cycle
    const object = loadFile(path).get(id)
    if (!object) return null

    stack.add(key)
    const group = new THREE.Group()
    if (object.mesh) {
      group.add(new THREE.Mesh(buildGeometry(key, object.mesh), material))
    }
    for (const component of object.components) {
      const childPath = component.path ? normalizePath(component.path) : path
      const child = buildObject(childPath, component.objectid, stack)
      if (!child) continue
      if (component.transform) child.applyMatrix4(component.transform)
      group.add(child)
    }
    stack.delete(key)

    return group.children.length > 0 ? group : null
  }

  const rootText = decoder.decode(entries[rootPath])
  parsedFiles.set(rootPath, parseModelFile(rootText))

  const root = new THREE.Group()
  const buildSection = rootText.match(/<build\b[^>]*>([\s\S]*?)<\/build>/)
  const itemRe = /<item\b([^>]*?)\/?>/g
  const itemSource = buildSection ? buildSection[1] : ''
  for (let m = itemRe.exec(itemSource); m; m = itemRe.exec(itemSource)) {
    const objectid = attr(m[1], 'objectid')
    if (!objectid) continue
    const itemPath = attr(m[1], 'p:path')
    const child = buildObject(itemPath ? normalizePath(itemPath) : rootPath, objectid, new Set())
    if (!child) continue
    const transform = parseTransform(attr(m[1], 'transform'))
    if (transform) child.applyMatrix4(transform)
    root.add(child)
  }

  if (root.children.length === 0) throw new Error('3MF build section produced no geometry')
  return root
}
