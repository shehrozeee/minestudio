import { describe, it, expect, beforeEach } from 'vitest'
import {
  GRID_BASE,
  SIZE_IN_UNITS,
  toWorld,
  snapToGrid,
  cellKey,
  occupiedCells,
  OccupancyMap,
} from '../../src/engine/grid'

describe('GRID_BASE', () => {
  it('is 2mm', () => {
    expect(GRID_BASE).toBe(2)
  })
})

describe('SIZE_IN_UNITS', () => {
  it('normal = 1 unit', () => expect(SIZE_IN_UNITS.normal).toBe(1))
  it('large = 2 units', () => expect(SIZE_IN_UNITS.large).toBe(2))
  it('xl = 3 units', () => expect(SIZE_IN_UNITS.xl).toBe(3))
})

describe('toWorld', () => {
  it('converts grid origin to world origin', () => {
    const v = toWorld({ gx: 0, gy: 0, gz: 0 })
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
    expect(v.z).toBe(0)
  })

  it('converts gx=3 to x=6mm', () => {
    const v = toWorld({ gx: 3, gy: 0, gz: 0 })
    expect(v.x).toBe(6)
  })

  it('converts gy=1 to y=2mm', () => {
    const v = toWorld({ gx: 0, gy: 1, gz: 0 })
    expect(v.y).toBe(2)
  })
})

describe('snapToGrid', () => {
  it('snaps 3.1 to nearest grid cell gx=2', () => {
    const pos = snapToGrid({ x: 3.1, y: 0, z: 0 })
    expect(pos.gx).toBe(2)
  })

  it('snaps negative coordinates correctly', () => {
    const pos = snapToGrid({ x: -5, y: 0, z: 0 })
    expect(pos.gx).toBe(-2)
  })
})

describe('cellKey', () => {
  it('returns "gx,gy,gz" string', () => {
    expect(cellKey({ gx: 1, gy: 2, gz: 3 })).toBe('1,2,3')
  })
})

describe('occupiedCells', () => {
  it('normal block at origin occupies exactly 1 cell', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(cells).toHaveLength(1)
    expect(cells[0]).toBe('0,0,0')
  })

  it('large block at origin occupies 8 cells (2x2x2)', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'large')
    expect(cells).toHaveLength(8)
  })

  it('xl block at origin occupies 27 cells (3x3x3)', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'xl')
    expect(cells).toHaveLength(27)
  })
})

describe('OccupancyMap', () => {
  let map: OccupancyMap

  beforeEach(() => { map = new OccupancyMap() })

  it('reports empty cell as unoccupied', () => {
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('reports occupied after register', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(true)
  })

  it('returns occupant id', () => {
    map.register(42, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.getOccupant('0,0,0')).toBe(42)
  })

  it('frees cells on unregister', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    map.unregister(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('large block occupancy prevents normal block placement', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'large')
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(true)
    expect(map.isOccupied({ gx: 2, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })
})
