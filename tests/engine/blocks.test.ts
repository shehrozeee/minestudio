import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { BLOCK_REGISTRY, getBlockDef, DEFAULT_HOTBAR } from '../../src/engine/registries/blocks'
import { GRID_BASE, SIZE_IN_UNITS } from '../../src/engine/grid'

describe('BLOCK_REGISTRY', () => {
  it('has at least 6 blocks', () => {
    expect(BLOCK_REGISTRY.length).toBeGreaterThanOrEqual(6)
  })

  it('all blocks have required fields', () => {
    for (const def of BLOCK_REGISTRY) {
      expect(def.id).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(def.availableSizes.length).toBeGreaterThan(0)
      expect(typeof def.makeGeometry).toBe('function')
    }
  })

  it('cube block exists with correct properties', () => {
    const cube = getBlockDef('cube')
    expect(cube).toBeDefined()
    expect(cube!.category).toBe('basic')
    expect(cube!.isPrintable).toBe(true)
    expect(cube!.availableSizes).toContain('normal')
    expect(cube!.availableSizes).toContain('large')
    expect(cube!.availableSizes).toContain('xl')
  })

  it('makeGeometry returns a BufferGeometry for all blocks', () => {
    const unitSize = GRID_BASE * SIZE_IN_UNITS.normal
    for (const def of BLOCK_REGISTRY) {
      const geo = def.makeGeometry(unitSize)
      expect(geo).toBeInstanceOf(THREE.BufferGeometry)
    }
  })

  it('getBlockDef returns undefined for unknown id', () => {
    expect(getBlockDef('unknown-xyz')).toBeUndefined()
  })

  it('torch block isPrintable === false', () => {
    const torch = getBlockDef('torch')
    expect(torch).toBeDefined()
    expect(torch!.isPrintable).toBe(false)
  })

  it('lantern block isPrintable === false', () => {
    const lantern = getBlockDef('lantern')
    expect(lantern).toBeDefined()
    expect(lantern!.isPrintable).toBe(false)
  })

  it('all peg variants have exportBehavior isolated', () => {
    for (const id of ['peg-1x', 'peg-2x', 'peg-3x']) {
      const def = getBlockDef(id)
      expect(def).toBeDefined()
      expect(def!.exportBehavior).toBe('isolated')
    }
  })

  it('chain-hook block exists with category connector', () => {
    const hook = getBlockDef('chain-hook')
    expect(hook).toBeDefined()
    expect(hook!.category).toBe('connector')
  })

  it('fillet-corner exists with category partial', () => {
    const fc = getBlockDef('fillet-corner')
    expect(fc).toBeDefined()
    expect(fc!.category).toBe('partial')
  })

  it('fillet-edge exists with category partial', () => {
    const fe = getBlockDef('fillet-edge')
    expect(fe).toBeDefined()
    expect(fe!.category).toBe('partial')
  })
})

describe('DEFAULT_HOTBAR', () => {
  it('has 9 slots', () => {
    expect(DEFAULT_HOTBAR).toHaveLength(9)
  })

  it('all slots reference valid block ids', () => {
    for (const id of DEFAULT_HOTBAR) {
      expect(getBlockDef(id)).toBeDefined()
    }
  })
})
