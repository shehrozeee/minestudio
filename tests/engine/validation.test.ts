import { describe, it, expect } from 'vitest'
import { ValidationSystem } from '../../src/engine/systems/ValidationSystem'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePrintableObj(id: number, gx: number, gy: number, gz: number): PlacedObject {
  return {
    id, defId: 'cube', size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#fff', isNegative: false,
    isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

function makeConnectorObj(
  id: number,
  defId: string,
  gx: number,
  gy: number,
  gz: number,
  bodyName?: string,
): PlacedObject {
  return {
    id, defId, size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#fff', isNegative: false,
    isPrintable: true, isSupport: false, storageKind: 'grid',
    bodyName,
  }
}

function makeChainObj(id: number, gx: number, gy: number, gz: number): PlacedObject {
  return {
    id, defId: 'chain-hook', size: 'normal',
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

// ---------------------------------------------------------------------------
// Floating check (existing tests)
// ---------------------------------------------------------------------------

describe('ValidationSystem — floating check', () => {
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
    const topWarn = warns.find(w => w.objectId === 2)
    expect(topWarn).toBeUndefined()
  })

  it('returns empty array when no objects', () => {
    const engine = makeEngine([])
    const v = new ValidationSystem(engine)
    expect(v.check()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Connector body checks
// ---------------------------------------------------------------------------

describe('ValidationSystem — checkConnectorBodies', () => {
  it('returns error when two isolated connectors share the same bodyName', () => {
    const a = makeConnectorObj(1, 'ball-joint', 0, 0, 0, 'Arm')
    const b = makeConnectorObj(2, 'socket',     2, 0, 0, 'Arm')
    const engine = makeEngine([a, b])
    const v = new ValidationSystem(engine)
    const warnings = v.checkConnectorBodies([a, b])
    expect(warnings.length).toBeGreaterThan(0)
    const err = warnings[0]
    expect(err.type).toBe('error')
    expect(err.message).toContain('Arm')
    expect(err.objectId).toBe(1)
  })

  it('no error when connectors have different bodyNames', () => {
    const a = makeConnectorObj(1, 'ball-joint', 0, 0, 0, 'BodyA')
    const b = makeConnectorObj(2, 'socket',     2, 0, 0, 'BodyB')
    const engine = makeEngine([a, b])
    const v = new ValidationSystem(engine)
    const warnings = v.checkConnectorBodies([a, b])
    expect(warnings.filter(w => w.type === 'error')).toHaveLength(0)
  })

  it('no error when connectors have no bodyName (undeclared — no cluster overlap)', () => {
    const a = makeConnectorObj(1, 'peg', 0, 0, 0)
    const b = makeConnectorObj(2, 'slot', 2, 0, 0)
    const engine = makeEngine([a, b])
    const v = new ValidationSystem(engine)
    const warnings = v.checkConnectorBodies([a, b])
    expect(warnings.filter(w => w.type === 'error')).toHaveLength(0)
  })

  it('no error for standard (non-isolated) blocks on same body', () => {
    const a: PlacedObject = { ...makePrintableObj(1, 0, 0, 0), bodyName: 'Body' }
    const b: PlacedObject = { ...makePrintableObj(2, 1, 0, 0), bodyName: 'Body' }
    const engine = makeEngine([a, b])
    const v = new ValidationSystem(engine)
    // cube has exportBehavior: 'standard' — not isolated
    const warnings = v.checkConnectorBodies([a, b])
    expect(warnings.filter(w => w.type === 'error')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Chain clearance checks
// ---------------------------------------------------------------------------

describe('ValidationSystem — checkChainClearance', () => {
  it('returns warning when chain hook is too close to another object', () => {
    // chain at (0,0,0), cube at (0,0,0) — distance = 0 → warning
    const chain = makeChainObj(1, 0, 0, 0)
    const cube  = makePrintableObj(2, 0, 0, 0)
    const engine = makeEngine([chain, cube])
    const v = new ValidationSystem(engine)
    const warnings = v.checkChainClearance([chain, cube])
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0].type).toBe('warning')
    expect(warnings[0].objectId).toBe(1)
    expect(warnings[0].message.toLowerCase()).toContain('chain hook')
  })

  it('no warning when chain hook is far from other objects', () => {
    // chain at (0,0,0), cube at (100,0,0) — clearly far apart
    const chain = makeChainObj(1, 0, 0, 0)
    const cube  = makePrintableObj(2, 100, 0, 0)
    const engine = makeEngine([chain, cube])
    const v = new ValidationSystem(engine)
    const warnings = v.checkChainClearance([chain, cube])
    expect(warnings).toHaveLength(0)
  })

  it('no warning when there are no non-chain objects', () => {
    const chain1 = makeChainObj(1, 0, 0, 0)
    const chain2 = makeChainObj(2, 1, 0, 0)
    const engine = makeEngine([chain1, chain2])
    const v = new ValidationSystem(engine)
    const warnings = v.checkChainClearance([chain1, chain2])
    expect(warnings).toHaveLength(0)
  })

  it('no warning when there are no chain objects', () => {
    const cube1 = makePrintableObj(1, 0, 0, 0)
    const cube2 = makePrintableObj(2, 1, 0, 0)
    const engine = makeEngine([cube1, cube2])
    const v = new ValidationSystem(engine)
    const warnings = v.checkChainClearance([cube1, cube2])
    expect(warnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// check() aggregation
// ---------------------------------------------------------------------------

describe('ValidationSystem — check() aggregates all sub-checks', () => {
  it('check() includes results from all sub-checks', () => {
    // One floating cube + two same-body connectors
    const floating = makePrintableObj(10, 0, 5, 0)
    const connA = makeConnectorObj(11, 'ball-joint', 5, 0, 0, 'SharedBody')
    const connB = makeConnectorObj(12, 'socket',     7, 0, 0, 'SharedBody')
    const objects = [floating, connA, connB]
    const engine = makeEngine(objects)
    const v = new ValidationSystem(engine)
    const warnings = v.check(objects)

    const floatWarning = warnings.find(w => w.objectId === 10)
    const bodyError = warnings.find(w => w.type === 'error')

    expect(floatWarning).toBeDefined()
    expect(bodyError).toBeDefined()
  })

  it('check() accepts explicit objects array', () => {
    const obj = makePrintableObj(1, 0, 0, 0)
    const engine = makeEngine([obj])
    const v = new ValidationSystem(engine)
    // Pass explicitly — should work the same as using engine.objects
    expect(v.check([obj])).toHaveLength(0)
  })
})
