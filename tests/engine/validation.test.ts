import { describe, it, expect } from 'vitest'
import { ValidationSystem } from '../../src/engine/systems/ValidationSystem'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

function makePrintableObj(id: number, gx: number, gy: number, gz: number): PlacedObject {
  return {
    id, defId: 'cube', size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#fff', isNegative: false,
    isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

function makeEngine(objects: PlacedObject[]) {
  const occupancy = new OccupancyMap()
  for (const o of objects) occupancy.register(o.id, o.position, o.size)
  return { objects, occupancy } as unknown as import('../../src/engine/BuildEngine').BuildEngine
}

describe('ValidationSystem', () => {
  it('no warnings for block on plate (gy=0)', () => {
    const obj = makePrintableObj(1, 0, 0, 0)
    const engine = makeEngine([obj])
    const v = new ValidationSystem(engine)
    expect(v.check()).toHaveLength(0)
  })

  it('warning for floating block with nothing below', () => {
    const obj = makePrintableObj(1, 0, 5, 0)
    const engine = makeEngine([obj])
    const v = new ValidationSystem(engine)
    const warns = v.check()
    expect(warns.length).toBeGreaterThan(0)
    expect(warns[0].type).toBe('warning')
    expect(warns[0].objectId).toBe(1)
  })

  it('no warning for stacked block', () => {
    const bottom = makePrintableObj(1, 0, 0, 0)
    const top    = makePrintableObj(2, 0, 1, 0)
    const engine = makeEngine([bottom, top])
    const v = new ValidationSystem(engine)
    const warns = v.check()
    // top block is supported by bottom
    const topWarn = warns.find(w => w.objectId === 2)
    expect(topWarn).toBeUndefined()
  })

  it('returns empty array when no objects', () => {
    const engine = makeEngine([])
    const v = new ValidationSystem(engine)
    expect(v.check()).toEqual([])
  })
})
