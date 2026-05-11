import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { getBlockDef } from '../registries/blocks'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'

export class RenderSystem {
  private engine: BuildEngine
  private meshMap = new Map<number, THREE.Mesh>()
  private objectMap = new Map<number, PlacedObject>()
  private activePlate = 0

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {}

  setActivePlate(idx: number): void {
    this.activePlate = idx
    for (const [id, mesh] of this.meshMap) {
      const obj = this.objectMap.get(id)
      mesh.visible = (obj?.plate ?? 0) === idx
    }
  }

  sync(objects: PlacedObject[]): void {
    const { scene } = this.engine
    const liveIds = new Set(objects.map(o => o.id))

    // Remove meshes for deleted objects
    for (const [id, mesh] of this.meshMap) {
      if (!liveIds.has(id)) {
        scene.remove(mesh)
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) mesh.material.dispose()
        this.meshMap.delete(id)
        this.objectMap.delete(id)
      }
    }
    // Refresh objectMap for live objects (so plate filter knows)
    for (const obj of objects) this.objectMap.set(obj.id, obj)

    // Add meshes for new objects
    for (const obj of objects) {
      if (this.meshMap.has(obj.id)) continue
      const def = getBlockDef(obj.defId)
      if (!def) continue

      const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
      const geo = def.makeGeometry(unitSize)
      const isLamp = obj.defId === 'torch' || obj.defId === 'lantern'
      const mat = new THREE.MeshStandardMaterial({
        color: isLamp ? 0xffe6a8 : obj.color,
        emissive: isLamp ? (obj.defId === 'torch' ? 0xff7822 : 0xfff0c0) : 0x000000,
        emissiveIntensity: isLamp ? 1.4 : 0,
        transparent: obj.isNegative,
        opacity: obj.isNegative ? 0.4 : 1,
        wireframe: obj.isNegative,
      })
      const mesh = new THREE.Mesh(geo, mat)

      const wp = toWorld(obj.position)
      const half = unitSize / 2
      mesh.position.set(wp.x + half, wp.y + half, wp.z + half)
      mesh.rotation.x = (obj.rotation.x * Math.PI) / 180
      mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
      mesh.rotation.z = (obj.rotation.z * Math.PI) / 180

      mesh.userData['objectId'] = obj.id
      mesh.visible = (obj.plate ?? 0) === this.activePlate
      scene.add(mesh)
      this.meshMap.set(obj.id, mesh)
    }
  }

  getMesh(id: number): THREE.Mesh | undefined {
    return this.meshMap.get(id)
  }

  updateColor(id: number, color: string): void {
    const mesh = this.meshMap.get(id)
    if (!mesh) return
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.color.set(color)
    }
  }

  getRaycastTargets(): THREE.Mesh[] {
    return Array.from(this.meshMap.values())
  }

  tick(_dt: number): void {}

  dispose(): void {
    for (const mesh of this.meshMap.values()) {
      this.engine.scene.remove(mesh)
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    this.meshMap.clear()
  }
}
