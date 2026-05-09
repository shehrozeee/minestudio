import { describe, it, expect, vi } from 'vitest'
import { PaintCommand } from '../../src/engine/commands/PaintCommand'
import { OccupancyMap } from '../../src/engine/grid'
import type { PlacedObject } from '../../src/engine/types'

function makeObj(): PlacedObject {
  return {
    id: 1, defId: 'cube', size: 'normal',
    position: { gx: 0, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#ff0000',
    isNegative: false, isPrintable: true, isSupport: false, storageKind: 'grid',
  }
}

function makeEngine(obj: PlacedObject) {
  const updateColor = vi.fn()
  return {
    objects: [obj],
    occupancy: new OccupancyMap(),
    render: { sync: vi.fn(), updateColor },
    commandBus: { onChange: vi.fn() },
  } as unknown as import('../../src/engine/BuildEngine').BuildEngine
}

describe('PaintCommand', () => {
  it('changes object color on execute', () => {
    const obj = makeObj()
    const engine = makeEngine(obj)
    const cmd = new PaintCommand(engine, obj, '#0000ff')
    cmd.execute()
    expect(obj.color).toBe('#0000ff')
  })

  it('calls render.updateColor on execute', () => {
    const obj = makeObj()
    const engine = makeEngine(obj)
    const cmd = new PaintCommand(engine, obj, '#0000ff')
    cmd.execute()
    expect(engine.render.updateColor).toHaveBeenCalledWith(1, '#0000ff')
  })

  it('restores old color on undo', () => {
    const obj = makeObj()
    const engine = makeEngine(obj)
    const cmd = new PaintCommand(engine, obj, '#0000ff')
    cmd.execute()
    cmd.undo()
    expect(obj.color).toBe('#ff0000')
  })

  it('calls render.updateColor with old color on undo', () => {
    const obj = makeObj()
    const engine = makeEngine(obj)
    const cmd = new PaintCommand(engine, obj, '#0000ff')
    cmd.execute()
    cmd.undo()
    expect(engine.render.updateColor).toHaveBeenLastCalledWith(1, '#ff0000')
  })
})

import { describe as d2, it as i2, expect as e2 } from 'vitest'
import { cycleColor, COLORS } from '../../src/engine/registries/colors'

d2('cycleColor', () => {
  i2('cycles forward', () => {
    const first = COLORS[0].hex
    const second = COLORS[1].hex
    e2(cycleColor(first, 1)).toBe(second)
  })
  i2('wraps around at end', () => {
    const last = COLORS[COLORS.length - 1].hex
    const first = COLORS[0].hex
    e2(cycleColor(last, 1)).toBe(first)
  })
  i2('cycles backward', () => {
    const second = COLORS[1].hex
    const first = COLORS[0].hex
    e2(cycleColor(second, -1)).toBe(first)
  })
})
