import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, resetStore } from '../../src/ui/store'

describe('useStore initial state', () => {
  beforeEach(() => resetStore())

  it('selectedTool defaults to place', () => {
    expect(useStore.getState().selectedTool).toBe('place')
  })

  it('selectedSize defaults to normal', () => {
    expect(useStore.getState().selectedSize).toBe('normal')
  })

  it('flyMode defaults to false', () => {
    expect(useStore.getState().flyMode).toBe(false)
  })

  it('objectCount defaults to 0', () => {
    expect(useStore.getState().objectCount).toBe(0)
  })
})

describe('useStore mutations', () => {
  beforeEach(() => resetStore())

  it('setTool updates selectedTool', () => {
    useStore.getState().setTool('paint')
    expect(useStore.getState().selectedTool).toBe('paint')
  })

  it('setSize updates selectedSize', () => {
    useStore.getState().setSize('xl')
    expect(useStore.getState().selectedSize).toBe('xl')
  })

  it('setFlyMode updates flyMode', () => {
    useStore.getState().setFlyMode(true)
    expect(useStore.getState().flyMode).toBe(true)
  })

  it('setUndoState updates both flags', () => {
    useStore.getState().setUndoState({ canUndo: true, canRedo: false })
    expect(useStore.getState().undoAvailable).toBe(true)
    expect(useStore.getState().redoAvailable).toBe(false)
  })
})
