import { describe, it, expect } from 'vitest'
import type { PlacedObject } from '../../src/engine/types'

// Pure body-grouping logic extracted for testing — no Three.js / DOM dependency

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'body'
}

function groupByBody(objects: PlacedObject[]): Map<string, PlacedObject[]> {
  const groups = new Map<string, PlacedObject[]>()
  for (const obj of objects) {
    if (!obj.isPrintable || obj.isNegative) continue
    const key = obj.bodyName ? sanitizeName(obj.bodyName) : 'body'
    const arr = groups.get(key) ?? []
    arr.push(obj)
    groups.set(key, arr)
  }
  return groups
}

function makeObj(id: number, opts: Partial<PlacedObject> = {}): PlacedObject {
  return {
    id,
    defId: 'cube',
    size: 'normal',
    position: { gx: id, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#ffffff',
    isNegative: false,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid',
    ...opts,
  }
}

describe('ExportSystem groupByBody', () => {
  it('single object with no bodyName goes to "body" group', () => {
    const groups = groupByBody([makeObj(1)])
    expect(groups.size).toBe(1)
    expect(groups.has('body')).toBe(true)
    expect(groups.get('body')).toHaveLength(1)
  })

  it('objects with same bodyName go into same group', () => {
    const groups = groupByBody([
      makeObj(1, { bodyName: 'Torso' }),
      makeObj(2, { bodyName: 'Torso' }),
    ])
    expect(groups.size).toBe(1)
    expect(groups.get('Torso')).toHaveLength(2)
  })

  it('objects with different bodyNames go into different groups', () => {
    const groups = groupByBody([
      makeObj(1, { bodyName: 'Arm' }),
      makeObj(2, { bodyName: 'Leg' }),
    ])
    expect(groups.size).toBe(2)
    expect(groups.get('Arm')).toHaveLength(1)
    expect(groups.get('Leg')).toHaveLength(1)
  })

  it('negative objects are excluded', () => {
    const groups = groupByBody([
      makeObj(1),
      makeObj(2, { isNegative: true }),
    ])
    expect(groups.get('body')).toHaveLength(1)
  })

  it('non-printable objects are excluded', () => {
    const groups = groupByBody([
      makeObj(1),
      makeObj(2, { isPrintable: false }),
    ])
    expect(groups.get('body')).toHaveLength(1)
  })

  it('sanitizeName strips illegal characters', () => {
    expect(sanitizeName('Left Arm!')).toBe('Left_Arm_')
    expect(sanitizeName('')).toBe('body')
    expect(sanitizeName('valid_name-123')).toBe('valid_name-123')
  })

  it('empty object list produces empty groups', () => {
    const groups = groupByBody([])
    expect(groups.size).toBe(0)
  })
})
