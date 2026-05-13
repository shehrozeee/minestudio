import { describe, it, expect } from 'vitest'
import { aabbConnected, connectedComponents, buildPalette } from '../../src/engine/systems/ExportSystem'
import type { PlacedObject } from '../../src/engine/types'

function obj(
  id: number,
  gx: number,
  gy: number,
  gz: number,
  color: string,
  opts: { bodyName?: string; plate?: number } = {},
): PlacedObject {
  return {
    id,
    defId: 'cube',
    size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color,
    isNegative: false,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid',
    plate: opts.plate ?? 0,
    bodyName: opts.bodyName,
  }
}

describe('aabbConnected', () => {
  it('face-touching cubes connect', () => {
    expect(aabbConnected(obj(1, 0, 0, 0, '#fff'), obj(2, 1, 0, 0, '#fff'))).toBe(true)
  })

  it('one-cell gap does not connect', () => {
    expect(aabbConnected(obj(1, 0, 0, 0, '#fff'), obj(2, 2, 0, 0, '#fff'))).toBe(false)
  })

  it('diagonal neighbors connect (share edge)', () => {
    expect(aabbConnected(obj(1, 0, 0, 0, '#fff'), obj(2, 1, 1, 0, '#fff'))).toBe(true)
  })

  it('overlapping cubes connect', () => {
    expect(aabbConnected(obj(1, 0, 0, 0, '#fff'), obj(2, 0, 0, 0, '#fff'))).toBe(true)
  })
})

describe('connectedComponents', () => {
  it('two face-touching cubes → one component', () => {
    const blocks = [obj(1, 0, 0, 0, '#fff'), obj(2, 1, 0, 0, '#fff')]
    const comps = connectedComponents(blocks)
    expect(comps).toHaveLength(1)
    expect(comps[0]).toHaveLength(2)
  })

  it('two disjoint cubes → two components', () => {
    const blocks = [obj(1, 0, 0, 0, '#fff'), obj(2, 5, 0, 0, '#fff')]
    const comps = connectedComponents(blocks)
    expect(comps).toHaveLength(2)
  })

  it('chain of 3 face-touching cubes → one component', () => {
    const blocks = [
      obj(1, 0, 0, 0, '#fff'),
      obj(2, 1, 0, 0, '#fff'),
      obj(3, 2, 0, 0, '#fff'),
    ]
    const comps = connectedComponents(blocks)
    expect(comps).toHaveLength(1)
    expect(comps[0]).toHaveLength(3)
  })

  it('empty input → empty result', () => {
    expect(connectedComponents([])).toEqual([])
  })
})

describe('buildPalette — canonical color ordering', () => {
  it('orders by COLOR_REGISTRY index regardless of placement order', () => {
    // Blue (#2060D0) is index 10 in COLOR_REGISTRY. Red (#E03030) is index 3.
    // Even if we place Blue first then Red, the palette should be [Red, Blue].
    const blocks = [
      obj(1, 0, 0, 0, '#2060D0'),  // Blue
      obj(2, 5, 0, 0, '#E03030'),  // Red
    ]
    const { palette, colorIndex } = buildPalette(blocks)
    expect(palette[0]).toBe('#E03030')  // Red first (lower registry index)
    expect(palette[1]).toBe('#2060D0')  // Blue second
    expect(colorIndex.get('#E03030')).toBe(0)
    expect(colorIndex.get('#2060D0')).toBe(1)
  })

  it('deduplicates same color', () => {
    const blocks = [
      obj(1, 0, 0, 0, '#E03030'),
      obj(2, 1, 0, 0, '#E03030'),
      obj(3, 2, 0, 0, '#E03030'),
    ]
    const { palette } = buildPalette(blocks)
    expect(palette).toHaveLength(1)
  })

  it('non-registry colors come after registry colors', () => {
    const blocks = [
      obj(1, 0, 0, 0, '#ABC123'),  // unknown
      obj(2, 5, 0, 0, '#E03030'),  // Red (registry index 3)
    ]
    const { palette } = buildPalette(blocks)
    expect(palette[0]).toBe('#E03030')
    expect(palette[1]).toBe('#ABC123')
  })

  it('case-insensitive matching with registry', () => {
    const blocks = [obj(1, 0, 0, 0, '#e03030')]  // lowercase Red
    const { palette } = buildPalette(blocks)
    expect(palette[0]).toBe('#E03030')
  })

  // Regression — old build emitted a duplicate red entry when the same color
  // was used in multiple bodies / plates. Confirms one palette slot per color
  // no matter how the blocks are grouped downstream.
  it('same color across different bodies → ONE palette entry', () => {
    const blocks = [
      obj(1, 0, 0, 0, '#E03030', { bodyName: 'wall_a' }),
      obj(2, 5, 0, 0, '#E03030', { bodyName: 'wall_b' }),
      obj(3, 10, 0, 0, '#E03030', { bodyName: 'wall_c' }),
    ]
    const { palette, colorIndex } = buildPalette(blocks)
    expect(palette).toEqual(['#E03030'])
    expect(colorIndex.get('#E03030')).toBe(0)
  })

  it('same color across different plates → ONE palette entry', () => {
    const blocks = [
      obj(1, 0, 0, 0, '#E03030', { plate: 0 }),
      obj(2, 5, 0, 0, '#E03030', { plate: 1 }),
      obj(3, 10, 0, 0, '#E03030', { plate: 2 }),
    ]
    const { palette } = buildPalette(blocks)
    expect(palette).toHaveLength(1)
    expect(palette[0]).toBe('#E03030')
  })

  it('mixed: 2 colors × 3 bodies × 2 plates → exactly 2 palette entries', () => {
    const colors = ['#E03030', '#2060D0']
    const bodies = ['a', 'b', 'c']
    const plates = [0, 1]
    let id = 1
    const blocks: PlacedObject[] = []
    for (const c of colors) for (const b of bodies) for (const p of plates) {
      blocks.push(obj(id++, id, 0, 0, c, { bodyName: b, plate: p }))
    }
    const { palette } = buildPalette(blocks)
    expect(palette).toHaveLength(2)
    // Sorted by registry: Red (3) < Blue (10)
    expect(palette).toEqual(['#E03030', '#2060D0'])
  })
})
