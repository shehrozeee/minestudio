import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { CONNECTOR_REGISTRY } from '../registries/connectors'

export interface MateAnnotation {
  id: number
  objectAId: number
  objectBId: number
  color: string
}

const MATE_COLORS = ['#e03030', '#20b0e0', '#60c020', '#e8c820', '#e040a0', '#8030c0']

export class ConnectorSystem {
  private engine: BuildEngine
  private mates: MateAnnotation[] = []
  private nextMateId = 1
  private pendingConnectorId: number | null = null

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
    }
    this.mates.push(mate)
    return mate
  }

  removeMatesForObject(objectId: number): void {
    this.mates = this.mates.filter(m => m.objectAId !== objectId && m.objectBId !== objectId)
  }

  getMates(): MateAnnotation[] {
    return this.mates
  }

  tick(_dt: number): void {}

  dispose(): void {
    this.mates = []
  }
}
