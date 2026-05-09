import { describe, it, expect, vi } from 'vitest'
import { CommandBus } from '../../src/engine/commands/Command'

describe('CommandBus', () => {
  it('executes a command', () => {
    const bus = new CommandBus()
    const executed: string[] = []
    bus.execute({
      execute: () => { executed.push('run') },
      undo: () => { executed.push('undo') },
    })
    expect(executed).toEqual(['run'])
  })

  it('undo calls the command undo and removes from history', () => {
    const bus = new CommandBus()
    const log: string[] = []
    bus.execute({ execute: () => log.push('a'), undo: () => log.push('undo-a') })
    bus.undo()
    expect(log).toEqual(['a', 'undo-a'])
  })

  it('redo re-executes after undo', () => {
    const bus = new CommandBus()
    const log: string[] = []
    bus.execute({ execute: () => log.push('a'), undo: () => log.push('undo-a') })
    bus.undo()
    bus.redo()
    expect(log).toEqual(['a', 'undo-a', 'a'])
  })

  it('new command after undo clears redo stack', () => {
    const bus = new CommandBus()
    bus.execute({ execute: () => {}, undo: () => {} })
    bus.undo()
    bus.execute({ execute: () => {}, undo: () => {} })
    expect(bus.canRedo).toBe(false)
  })

  it('canUndo is false on empty stack', () => {
    expect(new CommandBus().canUndo).toBe(false)
  })

  it('canRedo is false on empty redo stack', () => {
    expect(new CommandBus().canRedo).toBe(false)
  })

  it('respects max stack size of 100', () => {
    const bus = new CommandBus(100)
    for (let i = 0; i < 110; i++) {
      bus.execute({ execute: () => {}, undo: () => {} })
    }
    let undoCount = 0
    while (bus.canUndo) { bus.undo(); undoCount++ }
    expect(undoCount).toBe(100)
  })

  it('fires onChange when state changes', () => {
    const bus = new CommandBus()
    const cb = vi.fn()
    bus.onChange(cb)
    bus.execute({ execute: () => {}, undo: () => {} })
    expect(cb).toHaveBeenCalledWith({ canUndo: true, canRedo: false })
  })
})
