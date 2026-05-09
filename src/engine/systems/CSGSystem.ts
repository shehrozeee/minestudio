import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

export class CSGSystem {
  private engine: BuildEngine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private evaluator: any = null

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    // Ctrl+Shift+B = bake CSG preview
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        void this.bakePreview()
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getEvaluator(): Promise<any> {
    if (!this.evaluator) {
      // @ts-ignore — three-bvh-csg may not have bundled types for this three version
      const { Evaluator } = await import('three-bvh-csg')
      this.evaluator = new Evaluator()
    }
    return this.evaluator
  }

  private objectToMesh(obj: PlacedObject): THREE.Mesh | null {
    const def = getBlockDef(obj.defId)
    if (!def) return null
    const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
    const geo = def.makeGeometry(unitSize)
    const mat = new THREE.MeshStandardMaterial({ color: obj.color })
    const mesh = new THREE.Mesh(geo, mat)
    const wp = toWorld(obj.position)
    const half = unitSize / 2
    mesh.position.set(wp.x + half, wp.y + half, wp.z + half)
    mesh.rotation.x = (obj.rotation.x * Math.PI) / 180
    mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
    mesh.rotation.z = (obj.rotation.z * Math.PI) / 180
    mesh.updateMatrixWorld()
    return mesh
  }

  async bakePreview(): Promise<THREE.Mesh[]> {
    // @ts-ignore — three-bvh-csg may not have bundled types for this three version
    const { SUBTRACTION, ADDITION } = await import('three-bvh-csg')
    const evaluator = await this.getEvaluator()

    const positives = this.engine.objects.filter(o => !o.isNegative && o.isPrintable)
    const negatives = this.engine.objects.filter(o => o.isNegative)

    if (positives.length === 0) return []

    // Build union of all positive meshes
    let result: THREE.Mesh | null = null
    for (const obj of positives) {
      const mesh = this.objectToMesh(obj)
      if (!mesh) continue
      if (!result) {
        result = mesh
      } else {
        result = evaluator.evaluate(result, mesh, ADDITION)
      }
    }

    if (!result) return []

    // Subtract all negative meshes
    for (const obj of negatives) {
      const mesh = this.objectToMesh(obj)
      if (!mesh) continue
      result = evaluator.evaluate(result, mesh, SUBTRACTION)
    }

    import('../../ui/store').then(({ useStore }) => {
      useStore.getState().setCsgPending(false)
    })

    if (!result) return []
    return [result]
  }

  dispose(): void {}
}
