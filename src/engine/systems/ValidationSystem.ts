import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject, ValidationWarning } from '../types'
import { occupiedCells, toWorld, GRID_BASE } from '../grid'
import { getBlockDef } from '../registries/blocks'

export class ValidationSystem {
  private engine: BuildEngine

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  // ---------------------------------------------------------------------------
  // Floating check (original)
  // ---------------------------------------------------------------------------
  private checkFloating(objects: PlacedObject[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = []
    const { occupancy } = this.engine

    for (const obj of objects) {
      if (!obj.isPrintable) continue

      const belowCells = occupiedCells(
        { gx: obj.position.gx, gy: obj.position.gy - 1, gz: obj.position.gz },
        obj.size,
      )
      const onPlate = obj.position.gy === 0
      const hasSupport = onPlate || belowCells.some(k => {
        const occupantId = occupancy.getOccupant(k)
        return occupantId !== undefined && occupantId !== obj.id
      })

      if (!hasSupport) {
        warnings.push({
          type: 'warning',
          message: `Block "${obj.defId}" at (${obj.position.gx},${obj.position.gy},${obj.position.gz}) may need support`,
          objectId: obj.id,
        })
      }
    }

    return warnings
  }

  // ---------------------------------------------------------------------------
  // Connector body-cluster check — error if two isolated connectors share a body
  // ---------------------------------------------------------------------------
  checkConnectorBodies(objects: PlacedObject[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    // Only objects whose block def has exportBehavior === 'isolated'
    const connectors = objects.filter(obj => {
      const def = getBlockDef(obj.defId)
      return def?.exportBehavior === 'isolated'
    })

    for (let i = 0; i < connectors.length; i++) {
      for (let j = i + 1; j < connectors.length; j++) {
        const a = connectors[i]
        const b = connectors[j]
        // Both have the same explicit body name → they're on the same body
        if (a.bodyName && b.bodyName && a.bodyName === b.bodyName) {
          warnings.push({
            type: 'error',
            message: `Connectors on same body "${a.bodyName}" — they won't articulate after printing`,
            objectId: a.id,
          })
        }
      }
    }

    return warnings
  }

  // ---------------------------------------------------------------------------
  // Chain clearance check — warning if chain objects are too close to others
  // ---------------------------------------------------------------------------
  checkChainClearance(objects: PlacedObject[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    const chains = objects.filter(o => o.defId.startsWith('chain'))
    const nonChains = objects.filter(o => !o.defId.startsWith('chain'))

    for (const chain of chains) {
      const chainWorld = toWorld(chain.position)
      for (const other of nonChains) {
        const otherWorld = toWorld(other.position)
        const dist = chainWorld.distanceTo(otherWorld)
        if (dist < GRID_BASE * 0.5) {
          warnings.push({
            type: 'warning',
            message: `Chain hook at (${chain.position.gx},${chain.position.gy},${chain.position.gz}) may fuse with ${other.defId} — too close`,
            objectId: chain.id,
          })
        }
      }
    }

    return warnings
  }

  // ---------------------------------------------------------------------------
  // Main check — runs all sub-checks
  // ---------------------------------------------------------------------------
  check(objects?: PlacedObject[]): ValidationWarning[] {
    const objs = objects ?? this.engine.objects
    return [
      ...this.checkFloating(objs),
      ...this.checkConnectorBodies(objs),
      ...this.checkChainClearance(objs),
    ]
  }
}
