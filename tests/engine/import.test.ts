import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { ImportSystem } from '../../src/engine/systems/ImportSystem'
import { BulkPlaceCommand } from '../../src/engine/commands/BulkPlaceCommand'
import type { PlacedObject } from '../../src/engine/types'

function makeMinimalSTLBuffer(): ArrayBuffer {
  // Binary STL: 80-byte header + uint32 tri count + 1 triangle (50 bytes)
  const buf = new ArrayBuffer(80 + 4 + 50)
  const view = new DataView(buf)
  // tri count = 1
  view.setUint32(80, 1, true)
  // normal (0,0,1)
  view.setFloat32(84, 0, true)
  view.setFloat32(88, 0, true)
  view.setFloat32(92, 1, true)
  // v1
  view.setFloat32(96, 0, true)
  view.setFloat32(100, 0, true)
  view.setFloat32(104, 0, true)
  // v2
  view.setFloat32(108, 10, true)
  view.setFloat32(112, 0, true)
  view.setFloat32(116, 0, true)
  // v3
  view.setFloat32(120, 0, true)
  view.setFloat32(124, 10, true)
  view.setFloat32(128, 0, true)
  // attribute byte count
  view.setUint16(132, 0, true)
  return buf
}

function makeMinimalEngine() {
  const objects: PlacedObject[] = []
  const registered: Array<{ id: number; pos: PlacedObject['position']; size: PlacedObject['size'] }> = []
  const unregistered: number[] = []

  const occupancy = {
    register: (id: number, position: PlacedObject['position'], size: PlacedObject['size']) => {
      registered.push({ id, pos: position, size })
    },
    unregister: (id: number, _position: PlacedObject['position'], _size: PlacedObject['size']) => {
      unregistered.push(id)
    },
  }
  const render = { sync: () => {} }

  return { objects, occupancy, render, registered, unregistered } as unknown as {
    objects: PlacedObject[]
    occupancy: typeof occupancy
    render: typeof render
    registered: typeof registered
    unregistered: typeof unregistered
  }
}

describe('ImportSystem', () => {
  it('normalizeToGrid returns array of GridPos', () => {
    const geo = new THREE.BoxGeometry(10, 10, 10)
    const positions = ImportSystem.normalizeToGrid(geo)
    expect(Array.isArray(positions)).toBe(true)
    expect(positions.length).toBeGreaterThan(0)
    expect(positions[0]).toHaveProperty('gx')
    expect(positions[0]).toHaveProperty('gy')
    expect(positions[0]).toHaveProperty('gz')
  })

  it('STL buffer with single triangle produces at least one block', () => {
    const buf = makeMinimalSTLBuffer()
    const blocks = ImportSystem.importSTL(buf)
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('result blocks all have defId cube', () => {
    const buf = makeMinimalSTLBuffer()
    const blocks = ImportSystem.importSTL(buf)
    for (const b of blocks) {
      expect(b.defId).toBe('cube')
    }
  })

  it('result blocks all have unique ids', () => {
    const buf = makeMinimalSTLBuffer()
    const blocks = ImportSystem.importSTL(buf)
    const ids = blocks.map(b => b.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('normalization fits within 9x9x9 grid', () => {
    const geo = new THREE.BoxGeometry(100, 100, 100)
    const positions = ImportSystem.normalizeToGrid(geo, 9)
    for (const p of positions) {
      expect(Math.abs(p.gx)).toBeLessThanOrEqual(9)
      expect(Math.abs(p.gz)).toBeLessThanOrEqual(9)
    }
  })
})

describe('BulkPlaceCommand', () => {
  let engine: ReturnType<typeof makeMinimalEngine>

  beforeEach(() => {
    engine = makeMinimalEngine()
  })

  function makePlacedObject(id: number): PlacedObject {
    return {
      id,
      defId: 'cube',
      position: { gx: id, gy: 0, gz: 0 },
      size: 'normal',
      color: '#ffffff',
      rotation: { x: 0, y: 0, z: 0 },
      storageKind: 'placed' as const,
      isNegative: false,
      isPrintable: true,
      isSupport: false,
    } as unknown as PlacedObject
  }

  it('BulkPlaceCommand execute adds all objects to store', () => {
    const objs = [makePlacedObject(1), makePlacedObject(2), makePlacedObject(3)]
    const cmd = new BulkPlaceCommand(objs, engine as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    expect(engine.objects.length).toBe(3)
  })

  it('BulkPlaceCommand undo removes all objects from store', () => {
    const objs = [makePlacedObject(1), makePlacedObject(2), makePlacedObject(3)]
    const cmd = new BulkPlaceCommand(objs, engine as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    expect(engine.objects.length).toBe(3)
    cmd.undo()
    expect(engine.objects.length).toBe(0)
  })
})
