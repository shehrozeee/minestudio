import type { BuildEngine } from '../BuildEngine'
import type { ValidationWarning } from '../types'
import { occupiedCells } from '../grid'

export class ValidationSystem {
  private engine: BuildEngine

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  check(): ValidationWarning[] {
    const warnings: ValidationWarning[] = []
    const { objects, occupancy } = this.engine

    for (const obj of objects) {
      if (!obj.isPrintable) continue

      // Check if object is fully floating (nothing below it and not on the plate)
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
}
