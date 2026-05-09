import { describe, it, expect } from 'vitest'

// Test key set logic (pure data structure)
describe('InputSystem key tracking', () => {
  it('Set correctly tracks keys', () => {
    const keys = new Set<string>()
    keys.add('KeyW')
    expect(keys.has('KeyW')).toBe(true)
    keys.delete('KeyW')
    expect(keys.has('KeyW')).toBe(false)
  })

  it('multiple keys can be held simultaneously', () => {
    const keys = new Set<string>()
    keys.add('KeyW')
    keys.add('KeyA')
    expect(keys.size).toBe(2)
    expect(keys.has('KeyW')).toBe(true)
    expect(keys.has('KeyA')).toBe(true)
  })
})

// Test fly toggle double-tap timing logic
describe('Fly mode double-tap detection', () => {
  it('taps within 350ms trigger toggle', () => {
    let flyMode = false
    let lastTap = 0

    function tap() {
      const now = Date.now()
      if (now - lastTap < 350) flyMode = !flyMode
      lastTap = now
    }

    tap()
    // simulate quick second tap
    lastTap -= 200  // fake 200ms ago
    tap()
    expect(flyMode).toBe(true)
  })

  it('taps more than 350ms apart do NOT toggle', () => {
    let flyMode = false
    let lastTap = 0

    function tap() {
      const now = Date.now()
      if (now - lastTap < 350) flyMode = !flyMode
      lastTap = now
    }

    tap()
    lastTap -= 400  // fake 400ms ago
    tap()
    expect(flyMode).toBe(false)
  })
})
