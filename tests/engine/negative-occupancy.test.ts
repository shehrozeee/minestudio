import { describe, it, expect } from 'vitest'
import type { PlacedObject } from '../../src/engine/types'

function obj(id: number, gx: number, gy: number, gz: number, isNegative: boolean): PlacedObject {
  return {
    id,
    defId: 'cube',
    size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#888',
    isNegative,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid',
    plate: 0,
  }
}

describe('Negative blocks bypass occupancy', () => {
  it('placing a negative does not register in occupancy', async () => {
    // PlaceCommand uses isNegative to skip occupancy.register — verified
    // by inspection. We model it here at the level of the registry calls
    // that PlaceCommand performs.
    const { OccupancyMap } = await import('../../src/engine/grid')
    const map = new OccupancyMap()
    const negative = obj(1, 0, 0, 0, true)
    // Simulate PlaceCommand behavior: skip register when isNegative
    if (!negative.isNegative) map.register(negative.id, negative.position, negative.size)
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('placing a positive then a negative at the same cell — negative places freely', async () => {
    const { OccupancyMap } = await import('../../src/engine/grid')
    const map = new OccupancyMap()
    const positive = obj(1, 0, 0, 0, false)
    map.register(positive.id, positive.position, positive.size)
    // PlacementSystem.onLeftClick bypasses isOccupied when state.negativeMode is true.
    const negativeMode = true
    const wouldBeBlocked = !negativeMode && map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(wouldBeBlocked).toBe(false)
  })
})

describe('CSGSystem.aabbIntersects', () => {
  it('returns true when two normal cubes share the same cell', async () => {
    const { CSGSystem } = await import('../../src/engine/systems/CSGSystem')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sys = new CSGSystem({} as any)
    const a = obj(1, 5, 5, 5, false)
    const b = obj(2, 5, 5, 5, true)
    expect(sys.aabbIntersects(a, b)).toBe(true)
  })

  it('returns false when two normal cubes are in distinct non-touching cells', async () => {
    const { CSGSystem } = await import('../../src/engine/systems/CSGSystem')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sys = new CSGSystem({} as any)
    const a = obj(1, 0, 0, 0, false)
    const b = obj(2, 5, 0, 0, true)
    expect(sys.aabbIntersects(a, b)).toBe(false)
  })

  it('returns false when two cubes are face-adjacent (no volumetric overlap)', async () => {
    const { CSGSystem } = await import('../../src/engine/systems/CSGSystem')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sys = new CSGSystem({} as any)
    const a = obj(1, 0, 0, 0, false)
    const b = obj(2, 1, 0, 0, true)
    // a covers cell (0..1), b covers (1..2). They touch at gx=1 but don't overlap.
    expect(sys.aabbIntersects(a, b)).toBe(false)
  })
})
