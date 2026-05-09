import { describe, it, expect, vi } from 'vitest'
import { PlaceCommand } from '../../src/engine/commands/PlaceCommand'
import { DeleteCommand } from '../../src/engine/commands/DeleteCommand'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

function makeObj(id: number): PlacedObject {
  return {
    id,
    defId: 'cube',
    size: 'normal',
    position: { gx: 0, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#ffffff',
    isNegative: false,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid',
  }
}

function makeEngine(objects: PlacedObject[] = []) {
  const occupancy = new OccupancyMap()
  const sync = vi.fn()
  return {
    objects,
    occupancy,
    render: { sync },
  } as unknown as import('../../src/engine/BuildEngine').BuildEngine
}

describe('PlaceCommand', () => {
  it('adds object to engine.objects on execute', () => {
    const engine = makeEngine()
    const obj = makeObj(1)
    const cmd = new PlaceCommand(engine, obj)
    cmd.execute()
    expect(engine.objects).toContain(obj)
  })

  it('registers occupancy on execute', () => {
    const engine = makeEngine()
    const obj = makeObj(1)
    const cmd = new PlaceCommand(engine, obj)
    cmd.execute()
    expect(engine.occupancy.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(true)
  })

  it('removes object on undo', () => {
    const engine = makeEngine()
    const obj = makeObj(1)
    const cmd = new PlaceCommand(engine, obj)
    cmd.execute()
    cmd.undo()
    expect(engine.objects).not.toContain(obj)
  })

  it('frees occupancy on undo', () => {
    const engine = makeEngine()
    const obj = makeObj(1)
    const cmd = new PlaceCommand(engine, obj)
    cmd.execute()
    cmd.undo()
    expect(engine.occupancy.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('calls render.sync on execute and undo', () => {
    const engine = makeEngine()
    const obj = makeObj(1)
    const cmd = new PlaceCommand(engine, obj)
    cmd.execute()
    cmd.undo()
    expect(engine.render.sync).toHaveBeenCalledTimes(2)
  })
})

describe('DeleteCommand', () => {
  it('removes object on execute', () => {
    const obj = makeObj(1)
    const engine = makeEngine([obj])
    engine.occupancy.register(obj.id, obj.position, obj.size)
    const cmd = new DeleteCommand(engine, obj)
    cmd.execute()
    expect(engine.objects).not.toContain(obj)
  })

  it('restores object on undo', () => {
    const obj = makeObj(1)
    const engine = makeEngine([obj])
    engine.occupancy.register(obj.id, obj.position, obj.size)
    const cmd = new DeleteCommand(engine, obj)
    cmd.execute()
    cmd.undo()
    expect(engine.objects).toContain(obj)
  })

  it('calls render.sync on execute and undo', () => {
    const obj = makeObj(1)
    const engine = makeEngine([obj])
    engine.occupancy.register(obj.id, obj.position, obj.size)
    const cmd = new DeleteCommand(engine, obj)
    cmd.execute()
    cmd.undo()
    expect(engine.render.sync).toHaveBeenCalledTimes(2)
  })
})
