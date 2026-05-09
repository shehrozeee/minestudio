import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { CONNECTOR_REGISTRY } from '../registries/connectors'

export interface MateAnnotation {
  id: number
  objectAId: number
  objectBId: number
  color: string
  label: string
}

const MATE_COLORS = [
  '#e03030', '#20b0e0', '#60c020', '#e8c820',
  '#e040a0', '#8030c0', '#ff8844', '#44ffff',
]

export class ConnectorSystem {
  private engine: BuildEngine
  private mates: MateAnnotation[] = []
  private nextMateId = 1
  private pendingConnectorId: number | null = null

  // Runtime visual storage (not in store — THREE objects can't be serialized)
  private mateLines: Map<number, THREE.Line> = new Map()
  private mateLabels: Map<number, THREE.Sprite> = new Map()
  private unmatchedConnectorMeshes: Map<number, THREE.Mesh> = new Map()

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {}

  isConnector(obj: PlacedObject): boolean {
    return CONNECTOR_REGISTRY.some(c => c.id === obj.defId)
  }

  getCompatibleIds(defId: string): string[] {
    const def = CONNECTOR_REGISTRY.find(c => c.id === defId)
    return def?.matesWith ?? []
  }

  canMate(a: PlacedObject, b: PlacedObject): boolean {
    const aDef = CONNECTOR_REGISTRY.find(c => c.id === a.defId)
    const bDef = CONNECTOR_REGISTRY.find(c => c.id === b.defId)
    if (!aDef || !bDef) return false
    return aDef.matesWith.includes(b.defId) || bDef.matesWith.includes(a.defId)
  }

  startMate(objectId: number): void {
    this.pendingConnectorId = objectId
  }

  finishMate(objectId: number): MateAnnotation | null {
    if (this.pendingConnectorId === null || this.pendingConnectorId === objectId) {
      this.pendingConnectorId = null
      return null
    }
    const a = this.engine.objects.find(o => o.id === this.pendingConnectorId)
    const b = this.engine.objects.find(o => o.id === objectId)
    this.pendingConnectorId = null
    if (!a || !b || !this.canMate(a, b)) return null

    const mate: MateAnnotation = {
      id: this.nextMateId++,
      objectAId: a.id,
      objectBId: b.id,
      color: MATE_COLORS[this.mates.length % MATE_COLORS.length],
      label: `Joint ${this.mates.length + 1}`,
    }
    this.mates.push(mate)
    this.createMateVisual(mate)
    // Remove these connectors from unmatched set
    this.unmatchedConnectorMeshes.delete(a.id)
    this.unmatchedConnectorMeshes.delete(b.id)
    return mate
  }

  registerConnector(id: number, mesh: THREE.Mesh): void {
    this.unmatchedConnectorMeshes.set(id, mesh)
  }

  unregisterConnector(id: number): void {
    this.unmatchedConnectorMeshes.delete(id)
  }

  createMateVisual(mate: MateAnnotation): void {
    const meshA = this.engine.render.getMesh(mate.objectAId)
    const meshB = this.engine.render.getMesh(mate.objectBId)
    if (!meshA || !meshB) return

    const posA = meshA.position
    const posB = meshB.position

    // Bezier arc: control point above midpoint
    const mid = posA.clone().add(posB).multiplyScalar(0.5)
    mid.y += Math.max(20, posA.distanceTo(posB) * 0.5)

    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB)
    const points = curve.getPoints(20)

    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({ color: mate.color, linewidth: 2 })
    const line = new THREE.Line(geo, mat)
    line.renderOrder = 999
    this.engine.scene.add(line)
    this.mateLines.set(mate.id, line)

    // Label sprite at midpoint
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = mate.color
      ctx.fillRect(0, 0, 128, 32)
      ctx.fillStyle = 'white'
      ctx.font = '16px monospace'
      ctx.fillText(mate.label, 8, 22)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.copy(curve.getPoint(0.5))
    sprite.position.y += 4
    sprite.scale.set(20, 5, 1)
    this.engine.scene.add(sprite)
    this.mateLabels.set(mate.id, sprite)

    // Sync visibility with current annotation state
    const state = this.engine.store.getState()
    line.visible = state.annotationsVisible
    sprite.visible = state.annotationsVisible
  }

  setAnnotationsVisible(visible: boolean): void {
    for (const line of this.mateLines.values()) line.visible = visible
    for (const sprite of this.mateLabels.values()) sprite.visible = visible
  }

  removeMateVisual(mateId: number): void {
    const line = this.mateLines.get(mateId)
    if (line) {
      this.engine.scene.remove(line)
      line.geometry.dispose()
      this.mateLines.delete(mateId)
    }
    const sprite = this.mateLabels.get(mateId)
    if (sprite) {
      this.engine.scene.remove(sprite)
      this.mateLabels.delete(mateId)
    }
  }

  removeMatesForObject(objectId: number): void {
    const toRemove = this.mates.filter(
      m => m.objectAId === objectId || m.objectBId === objectId,
    )
    for (const mate of toRemove) {
      this.removeMateVisual(mate.id)
    }
    this.mates = this.mates.filter(
      m => m.objectAId !== objectId && m.objectBId !== objectId,
    )
    this.unmatchedConnectorMeshes.delete(objectId)
  }

  getMates(): MateAnnotation[] {
    return this.mates
  }

  tick(_dt: number): void {
    // Pulse unmatched connector meshes
    const t = Date.now() / 1000
    const pulse = 0.6 + Math.sin(t * 2) * 0.4
    for (const [, mesh] of this.unmatchedConnectorMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissiveIntensity = pulse * 0.3
      }
    }
  }

  dispose(): void {
    for (const mateId of [...this.mateLines.keys()]) {
      this.removeMateVisual(mateId)
    }
    this.mates = []
    this.unmatchedConnectorMeshes.clear()
  }
}
