import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GRID_BASE } from '../grid'
import type { PlacedObject, GridPos, BlockRotation } from '../types'
import { BulkPlaceCommand } from '../commands/BulkPlaceCommand'
import type { BuildEngine } from '../BuildEngine'

const DEFAULT_ROTATION: BlockRotation = { x: 0, y: 0, z: 0 }

let idCounter = 100_000

function nextId(): number {
  return idCounter++
}

export function normalizeToGrid(geometry: THREE.BufferGeometry, maxCells = 9): GridPos[] {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim === 0) return []
  const scale = (maxCells * GRID_BASE) / maxDim
  const offset = new THREE.Vector3()
  box.getCenter(offset)

  const positions = geometry.attributes['position'] as THREE.BufferAttribute
  const occupied = new Set<string>()
  for (let i = 0; i < positions.count; i++) {
    const x = (positions.getX(i) - offset.x) * scale
    const y = (positions.getY(i) - offset.y) * scale
    const z = (positions.getZ(i) - offset.z) * scale
    const gx = Math.round(x / GRID_BASE)
    const gy = Math.round(y / GRID_BASE)
    const gz = Math.round(z / GRID_BASE)
    occupied.add(`${gx},${gy},${gz}`)
  }
  return Array.from(occupied).map(k => {
    const [gx, gy, gz] = k.split(',').map(Number)
    return { gx, gy: Math.max(0, gy), gz }
  })
}

function gridPosToPlacedObjects(positions: GridPos[]): PlacedObject[] {
  return positions.map(pos => ({
    id: nextId(),
    defId: 'cube',
    size: 'normal' as const,
    position: pos,
    rotation: DEFAULT_ROTATION,
    color: '#888888',
    isNegative: false,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid' as const,
  }))
}

export class ImportSystem {
  static normalizeToGrid(geometry: THREE.BufferGeometry, maxCells = 9): GridPos[] {
    return normalizeToGrid(geometry, maxCells)
  }

  static importSTL(buffer: ArrayBuffer): PlacedObject[] {
    const loader = new STLLoader()
    const geometry = loader.parse(buffer)
    const positions = normalizeToGrid(geometry)
    return gridPosToPlacedObjects(positions)
  }

  static async importGLB(buffer: ArrayBuffer): Promise<PlacedObject[]> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.parse(buffer, '', (gltf) => {
        const geometries: THREE.BufferGeometry[] = []

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            const geo = mesh.geometry.clone()
            geo.applyMatrix4(mesh.matrixWorld)
            geometries.push(geo)
          }
        })

        if (geometries.length === 0) {
          resolve([])
          return
        }

        const merged = mergeGeometries(geometries) ?? geometries[0]
        const positions = normalizeToGrid(merged)
        resolve(gridPosToPlacedObjects(positions))
      }, reject)
    })
  }

  triggerImport(engine: BuildEngine): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.stl,.glb'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const buffer = await file.arrayBuffer()
      let blocks: PlacedObject[]
      if (file.name.toLowerCase().endsWith('.stl')) {
        blocks = ImportSystem.importSTL(buffer)
      } else {
        blocks = await ImportSystem.importGLB(buffer)
      }
      if (blocks.length > 0) {
        engine.commandBus.execute(new BulkPlaceCommand(blocks, engine))
      }
    }
    input.click()
  }
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null
  const positions: number[] = []
  for (const geo of geometries) {
    const attr = geo.attributes['position'] as THREE.BufferAttribute
    for (let i = 0; i < attr.count; i++) {
      positions.push(attr.getX(i), attr.getY(i), attr.getZ(i))
    }
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return merged
}
