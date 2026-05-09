import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { ConnectorSystem } from '../../src/engine/systems/ConnectorSystem'
import { ChainCommand } from '../../src/engine/commands/ChainCommand'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeObj(id: number, defId: string, gx = 0, gy = 0, gz = 0): PlacedObject {
  return {
    id, defId, size: 'normal',
    position: { gx, gy, gz },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#fff', isNegative: false,
    isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

/** Minimal scene stub that tracks add/remove calls */
function makeScene() {
  const added: THREE.Object3D[] = []
  const removed: THREE.Object3D[] = []
  return {
    add: (o: THREE.Object3D) => { added.push(o) },
    remove: (o: THREE.Object3D) => { removed.push(o) },
    _added: added,
    _removed: removed,
  }
}

/** Minimal render stub with controllable mesh map */
function makeRender(meshMap: Map<number, THREE.Mesh> = new Map()) {
  return {
    getMesh: (id: number) => meshMap.get(id),
    sync: () => {},
  }
}

function makeMeshAt(x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial(),
  )
  mesh.position.set(x, y, z)
  return mesh
}

interface StoreState {
  annotationsVisible: boolean
}

function makeStore(state: Partial<StoreState> = {}) {
  const s: StoreState = { annotationsVisible: true, ...state }
  return { getState: () => s }
}

function makeEngine(
  objects: PlacedObject[],
  meshMap: Map<number, THREE.Mesh> = new Map(),
  sceneOverride?: ReturnType<typeof makeScene>,
) {
  const scene = sceneOverride ?? makeScene()
  const occupancy = new OccupancyMap()
  const render = makeRender(meshMap)
  const store = makeStore()
  let nextId = 1000
  return {
    objects,
    occupancy,
    scene,
    render,
    store,
    getNextId: () => nextId++,
  } as unknown as import('../../src/engine/BuildEngine').BuildEngine
}

// ── ConnectorSystem ──────────────────────────────────────────────────────────

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

  it('finishMate assigns label', () => {
    const ball = makeObj(1, 'ball-joint')
    const socket = makeObj(2, 'socket')
    const engine = makeEngine([ball, socket])
    const cs = new ConnectorSystem(engine)
    cs.startMate(ball.id)
    const mate = cs.finishMate(socket.id)
    expect(mate?.label).toBe('Joint 1')
  })

  it('finishMate assigns color from palette', () => {
    const ball = makeObj(1, 'ball-joint')
    const socket = makeObj(2, 'socket')
    const engine = makeEngine([ball, socket])
    const cs = new ConnectorSystem(engine)
    cs.startMate(ball.id)
    const mate = cs.finishMate(socket.id)
    expect(mate?.color).toBeTruthy()
    expect(typeof mate?.color).toBe('string')
  })

  describe('createMateVisual', () => {
    it('adds a Line to the scene when meshes exist', () => {
      const ball = makeObj(1, 'ball-joint', 0, 0, 0)
      const socket = makeObj(2, 'socket', 10, 0, 0)
      const meshMap = new Map<number, THREE.Mesh>()
      meshMap.set(1, makeMeshAt(0, 0, 0))
      meshMap.set(2, makeMeshAt(20, 0, 0))
      const scene = makeScene()
      const engine = makeEngine([ball, socket], meshMap, scene)
      const cs = new ConnectorSystem(engine)

      cs.startMate(ball.id)
      cs.finishMate(socket.id)

      // Should have added: a Line and a Sprite
      const lines = scene._added.filter(o => o instanceof THREE.Line)
      const sprites = scene._added.filter(o => o instanceof THREE.Sprite)
      expect(lines.length).toBe(1)
      expect(sprites.length).toBe(1)
    })

    it('does not add visual when meshes are missing', () => {
      const ball = makeObj(1, 'ball-joint')
      const socket = makeObj(2, 'socket')
      const scene = makeScene()
      const engine = makeEngine([ball, socket], new Map(), scene)
      const cs = new ConnectorSystem(engine)

      cs.startMate(ball.id)
      cs.finishMate(socket.id)

      expect(scene._added.length).toBe(0)
    })
  })

  describe('setAnnotationsVisible', () => {
    it('hides and shows all mate lines and sprites', () => {
      const ball = makeObj(1, 'ball-joint')
      const socket = makeObj(2, 'socket')
      const meshMap = new Map<number, THREE.Mesh>()
      meshMap.set(1, makeMeshAt(0, 0, 0))
      meshMap.set(2, makeMeshAt(20, 0, 0))
      const scene = makeScene()
      const engine = makeEngine([ball, socket], meshMap, scene)
      const cs = new ConnectorSystem(engine)

      cs.startMate(ball.id)
      cs.finishMate(socket.id)

      cs.setAnnotationsVisible(false)
      for (const obj of scene._added) {
        expect(obj.visible).toBe(false)
      }

      cs.setAnnotationsVisible(true)
      for (const obj of scene._added) {
        expect(obj.visible).toBe(true)
      }
    })
  })

  describe('removeMatesForObject', () => {
    it('removes mate annotation and cleans up visual', () => {
      const ball = makeObj(1, 'ball-joint')
      const socket = makeObj(2, 'socket')
      const meshMap = new Map<number, THREE.Mesh>()
      meshMap.set(1, makeMeshAt(0, 0, 0))
      meshMap.set(2, makeMeshAt(20, 0, 0))
      const scene = makeScene()
      const engine = makeEngine([ball, socket], meshMap, scene)
      const cs = new ConnectorSystem(engine)

      cs.startMate(ball.id)
      cs.finishMate(socket.id)

      expect(cs.getMates().length).toBe(1)
      cs.removeMatesForObject(ball.id)

      expect(cs.getMates().length).toBe(0)
      // Line and sprite should be in removed list
      const lines = scene._removed.filter(o => o instanceof THREE.Line)
      const sprites = scene._removed.filter(o => o instanceof THREE.Sprite)
      expect(lines.length).toBe(1)
      expect(sprites.length).toBe(1)
    })
  })
})

// ── ChainCommand ─────────────────────────────────────────────────────────────

describe('ChainCommand', () => {
  let objects: PlacedObject[]
  let engine: ReturnType<typeof makeEngine>

  beforeEach(() => {
    // hookA at (0,0,0), hookB at (20,0,0) in grid units → world coords 0,0,0 and 40,0,0
    const hookA = makeObj(1, 'hook', 0, 0, 0)
    const hookB = makeObj(2, 'hook', 20, 0, 0)
    objects = [hookA, hookB]
    engine = makeEngine(objects)
  })

  it('execute creates link objects between two hook positions', () => {
    const cmd = new ChainCommand(1, 2, engine as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()

    // Should have added links — objects array grows
    expect(engine.objects.length).toBeGreaterThan(2)
    // All links should be cubes
    const links = engine.objects.slice(2)
    for (const link of links) {
      expect(link.defId).toBe('cube')
      expect(link.bodyName).toBe('chain-1-2')
    }
  })

  it('execute places at least 1 link', () => {
    const hookA = makeObj(3, 'hook', 0, 0, 0)
    const hookB = makeObj(4, 'hook', 1, 0, 0)
    const eng = makeEngine([hookA, hookB])
    const cmd = new ChainCommand(3, 4, eng as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    expect(eng.objects.length).toBeGreaterThanOrEqual(3)
  })

  it('undo removes all created link objects', () => {
    const cmd = new ChainCommand(1, 2, engine as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    const countAfterExecute = engine.objects.length
    expect(countAfterExecute).toBeGreaterThan(2)

    cmd.undo()
    // Back to just the two hooks
    expect(engine.objects.length).toBe(2)
    expect(engine.objects.map(o => o.id)).toContain(1)
    expect(engine.objects.map(o => o.id)).toContain(2)
  })

  it('returns early when hook objects are missing', () => {
    const eng = makeEngine([])
    const cmd = new ChainCommand(99, 100, eng as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    expect(eng.objects.length).toBe(0)
  })

  it('links have drooping Y positions (midpoint lower than endpoints)', () => {
    // hooks at same height, far apart — mid-links should be lower
    const hookA = makeObj(5, 'hook', 0, 10, 0)
    const hookB = makeObj(6, 'hook', 30, 10, 0)
    const eng = makeEngine([hookA, hookB])
    const cmd = new ChainCommand(5, 6, eng as unknown as import('../../src/engine/BuildEngine').BuildEngine)
    cmd.execute()
    const links = eng.objects.slice(2)
    if (links.length >= 3) {
      const midLink = links[Math.floor(links.length / 2)]
      const endLink = links[0]
      // Mid link should be at or below the endpoint's Y
      expect(midLink.position.gy).toBeLessThanOrEqual(endLink.position.gy)
    }
  })
})
