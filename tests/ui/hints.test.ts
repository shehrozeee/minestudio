import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, resetStore } from '../../src/ui/store'

// The hint system is data-driven: each tool has its own hint set.
// We test the store state that drives it.

describe('ContextualHints — store-driven tool hints', () => {
  beforeEach(() => resetStore())

  it('default tool is "place"', () => {
    expect(useStore.getState().selectedTool).toBe('place')
  })

  it('switching to "paint" updates selectedTool', () => {
    useStore.getState().setTool('paint')
    expect(useStore.getState().selectedTool).toBe('paint')
  })

  it('all 11 tool ids are valid ToolId values', () => {
    const tools = ['place', 'erase', 'paint', 'eyedropper', 'text', 'select', 'sink', 'mate', 'fillet', 'support', 'measure'] as const
    for (const t of tools) {
      useStore.getState().setTool(t)
      expect(useStore.getState().selectedTool).toBe(t)
    }
  })

  it('toggling paint off returns to place via P-key logic', () => {
    useStore.getState().setTool('paint')
    const cur = useStore.getState().selectedTool
    useStore.getState().setTool(cur === 'paint' ? 'place' : 'paint')
    expect(useStore.getState().selectedTool).toBe('place')
  })
})
