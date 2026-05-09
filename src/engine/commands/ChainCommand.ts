import type { Command } from './Command'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { toWorld, GRID_BASE } from '../grid'

export class ChainCommand implements Command {
  private links: PlacedObject[] = []

  constructor(
    private hookAId: number,
    private hookBId: number,
    private engine: BuildEngine,
  ) {}

  execute(): void {
    const objects = this.engine.objects
    const hookA = objects.find(o => o.id === this.hookAId)
    const hookB = objects.find(o => o.id === this.hookBId)
    if (!hookA || !hookB) return

    const posA = toWorld(hookA.position)
    const posB = toWorld(hookB.position)
    const dist = posA.distanceTo(posB)
    const linkCount = Math.max(1, Math.round(dist / (GRID_BASE * 2)))

    this.links = []
    for (let i = 0; i < linkCount; i++) {
      const t = (i + 0.5) / linkCount
      // Parabolic droop: max sag at midpoint
      const droop = Math.sin(t * Math.PI) * (dist * 0.1)
      const x = posA.x + (posB.x - posA.x) * t
      const y = posA.y + (posB.y - posA.y) * t - droop
      const z = posA.z + (posB.z - posA.z) * t

      const gx = Math.round(x / GRID_BASE)
      const gy = Math.max(0, Math.round(y / GRID_BASE))
      const gz = Math.round(z / GRID_BASE)

      const link: PlacedObject = {
        id: this.engine.getNextId(),
        defId: 'cube',
        size: hookA.size,
        position: { gx, gy, gz },
        rotation: { x: 0, y: 0, z: 0 },
        color: hookA.color,
        isNegative: false,
        isPrintable: true,
        isSupport: false,
        storageKind: 'grid',
        bodyName: `chain-${this.hookAId}-${this.hookBId}`,
      }
      this.links.push(link)
    }

    for (const link of this.links) {
      this.engine.objects.push(link)
      this.engine.occupancy.register(link.id, link.position, link.size)
    }
    this.engine.render.sync(this.engine.objects)
  }

  undo(): void {
    const linkIds = new Set(this.links.map(l => l.id))
    for (const link of this.links) {
      const idx = this.engine.objects.indexOf(link)
      if (idx !== -1) this.engine.objects.splice(idx, 1)
      this.engine.occupancy.unregister(link.id, link.position, link.size)
    }
    // Also remove any that may have been added without reference equality
    for (let i = this.engine.objects.length - 1; i >= 0; i--) {
      if (linkIds.has(this.engine.objects[i].id)) {
        this.engine.objects.splice(i, 1)
      }
    }
    this.engine.render.sync(this.engine.objects)
  }
}
