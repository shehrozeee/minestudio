import { describe, it, expect } from 'vitest'
import { ConnectorSystem } from '../../src/engine/systems/ConnectorSystem'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

function makeObj(id: number, defId: string): PlacedObject {
  return {
    id, defId, size: 'normal',
    position: { gx: id, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#fff', isNegative: false,
    isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

function makeEngine(objects: PlacedObject[]) {
  return { objects, occupancy: new OccupancyMap() } as unknown as import('../../src/engine/BuildEngine').BuildEngine
}

describe('ConnectorSystem', () => {
  it('identifies connector objects', () => {
    const peg = makeObj(1, 'peg')
    const cube = makeObj(2, 'cube')
    const engine = makeEngine([peg, cube])
    const cs = new ConnectorSystem(engine)
    expect(cs.isConnector(peg)).toBe(true)
    expect(cs.isConnector(cube)).toBe(false)
  })

  it('peg mates with slot', () => {
    const peg = makeObj(1, 'peg')
    const slot = makeObj(2, 'slot')
    const engine = makeEngine([peg, slot])
    const cs = new ConnectorSystem(engine)
    expect(cs.canMate(peg, slot)).toBe(true)
  })

  it('peg does not mate with ball-joint', () => {
    const peg = makeObj(1, 'peg')
    const ball = makeObj(2, 'ball-joint')
    const engine = makeEngine([peg, ball])
    const cs = new ConnectorSystem(engine)
    expect(cs.canMate(peg, ball)).toBe(false)
  })

  it('ball-joint mates with socket', () => {
    const ball = makeObj(1, 'ball-joint')
    const socket = makeObj(2, 'socket')
    const engine = makeEngine([ball, socket])
    const cs = new ConnectorSystem(engine)
    expect(cs.canMate(ball, socket)).toBe(true)
  })

  it('finishMate creates annotation for compatible pair', () => {
    const ball = makeObj(1, 'ball-joint')
    const socket = makeObj(2, 'socket')
    const engine = makeEngine([ball, socket])
    const cs = new ConnectorSystem(engine)
    cs.startMate(ball.id)
    const mate = cs.finishMate(socket.id)
    expect(mate).not.toBeNull()
    expect(mate?.objectAId).toBe(1)
    expect(mate?.objectBId).toBe(2)
  })

  it('finishMate returns null for incompatible pair', () => {
    const peg = makeObj(1, 'peg')
    const ball = makeObj(2, 'ball-joint')
    const engine = makeEngine([peg, ball])
    const cs = new ConnectorSystem(engine)
    cs.startMate(peg.id)
    const mate = cs.finishMate(ball.id)
    expect(mate).toBeNull()
  })
})
