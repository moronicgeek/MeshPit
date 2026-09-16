import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MeshFileRecord } from '../../../shared/types'
import { buildMeshObject, disposeObject } from '../three/meshLoader'
import { buildStepObject } from '../three/stepGeometry'

interface ModelViewerProps {
  file: MeshFileRecord
}

/** Interactive orbit view of a mesh file. Supports STL, OBJ, 3MF and STEP. */
export function ModelViewer({ file }: ModelViewerProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null)
  const resetViewRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    let disposed = false
    setStatus('loading')
    setError(null)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.classList.add('model-viewer-canvas')
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1f3d, 1.15))

    // Parented to the camera so the model stays lit from every orbit angle.
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(5, 10, 7)
    const rim = new THREE.DirectionalLight(0xb388ff, 0.7)
    rim.position.set(-6, -2, -6)
    camera.add(key, rim)
    scene.add(camera)

    const material = new THREE.MeshStandardMaterial({
      color: 0xcdbdfb,
      metalness: 0.1,
      roughness: 0.55
    })

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.9
    controls.zoomSpeed = 0.9
    controls.panSpeed = 0.8

    let object: THREE.Object3D | null = null
    let grid: THREE.GridHelper | null = null
    let homeCamera = new THREE.Vector3(1, 1, 1)

    const resize = (): void => {
      const width = mount.clientWidth || 1
      const height = mount.clientHeight || 1
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const frameObject = (target: THREE.Object3D): void => {
      const box = new THREE.Box3().setFromObject(target)
      if (box.isEmpty()) return
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())

      target.position.sub(center)

      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const distance = maxDim * 2.2
      homeCamera = new THREE.Vector3(distance, distance * 0.85, distance)
      camera.near = Math.max(0.01, maxDim / 1000)
      camera.far = Math.max(1000, maxDim * 100)
      camera.position.copy(homeCamera)
      camera.updateProjectionMatrix()

      controls.target.set(0, 0, 0)
      controls.minDistance = maxDim * 0.1
      controls.maxDistance = maxDim * 20
      controls.update()

      grid = new THREE.GridHelper(maxDim * 3, 12, 0x4c3f66, 0x2d2640)
      grid.position.y = -size.y / 2
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
      for (const mat of gridMaterials) {
        mat.transparent = true
        mat.opacity = 0.35
      }
      scene.add(grid)
    }

    resetViewRef.current = () => {
      camera.position.copy(homeCamera)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let frameId = 0
    const animate = (): void => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    void (async () => {
      try {
        // STEP is triangulated in the offscreen host — OpenCascade needs eval,
        // which this window's CSP forbids — so only geometry comes back here.
        let built: THREE.Object3D
        if (file.ext === 'step') {
          built = buildStepObject(await window.meshpit.triangulateStep(file.id), material)
        } else {
          const { ext, buffer } = await window.meshpit.readFileBuffer(file.id)
          if (disposed) return
          built = await buildMeshObject(ext, buffer, material)
        }
        if (disposed) {
          disposeObject(built, material)
          return
        }
        object = built
        scene.add(object)
        frameObject(object)
        setStatus('ready')
      } catch (e) {
        if (disposed) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      disposed = true
      resetViewRef.current = null
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      if (object) {
        scene.remove(object)
        disposeObject(object, material)
      }
      if (grid) {
        scene.remove(grid)
        grid.geometry.dispose()
        const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
        for (const mat of gridMaterials) mat.dispose()
      }
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [file.id])

  return (
    <div className="model-viewer">
      <div className="model-viewer-mount" ref={mountRef} />
      {status === 'loading' && <div className="model-viewer-overlay">Loading 3D model…</div>}
      {status === 'error' && (
        <div className="model-viewer-overlay error">
          <span>Could not render this file</span>
          {error && <span className="model-viewer-error-detail">{error}</span>}
        </div>
      )}
      {status === 'ready' && (
        <div className="model-viewer-toolbar">
          <span className="model-viewer-hint">Drag to orbit · Scroll to zoom · Right-drag to pan</span>
          <button className="icon-btn" title="Reset view" onClick={() => resetViewRef.current?.()}>
            ⟲
          </button>
        </div>
      )}
    </div>
  )
}
