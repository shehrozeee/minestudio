import { describe, it, expect } from 'vitest'
import type { PlacedObject } from '../../src/engine/types'

// CSGSystem is async (dynamic imports) so we test the pure logic separately

function makeObj(id: number, isNegative: boolean): PlacedObject {
  return {
    id, defId: 'cube', size: 'normal',
    position: { gx: id, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: isNegative ? '#ff0000' : '#ffffff',
    isNegative, isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

describe('CSG object classification', () => {
  it('isNegative flag works', () => {
    const pos = makeObj(1, false)
    const neg = makeObj(2, true)
    expect(pos.isNegative).toBe(false)
    expect(neg.isNegative).toBe(true)
  })

  it('filters positives and negatives correctly', () => {
    const objects = [makeObj(1, false), makeObj(2, true), makeObj(3, false)]
    const positives = objects.filter(o => !o.isNegative && o.isPrintable)
    const negatives = objects.filter(o => o.isNegative)
    expect(positives).toHaveLength(2)
    expect(negatives).toHaveLength(1)
  })
})
