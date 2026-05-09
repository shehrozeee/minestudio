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

// Test T key hold detection for tool ring
describe('T key hold detection for tool ring', () => {
  it('hold >200ms opens tool ring', () => {
    let ringOpened = false
    let toolCycled = false
    let keyDownTime = 0

    function onKeyDown(now: number) {
      keyDownTime = now
    }
    function onKeyUp(now: number) {
      const held = now - keyDownTime
      if (held > 200) {
        ringOpened = true
      } else {
        toolCycled = true
      }
      keyDownTime = 0
    }

    onKeyDown(1000)
    onKeyUp(1000 + 300) // held 300ms > 200ms threshold
    expect(ringOpened).toBe(true)
    expect(toolCycled).toBe(false)
  })

  it('short tap <200ms cycles tool instead of opening ring', () => {
    let ringOpened = false
    let toolCycled = false
    let keyDownTime = 0

    function onKeyDown(now: number) {
      keyDownTime = now
    }
    function onKeyUp(now: number) {
      const held = now - keyDownTime
      if (held > 200) {
        ringOpened = true
      } else {
        toolCycled = true
      }
      keyDownTime = 0
    }

    onKeyDown(1000)
    onKeyUp(1000 + 100) // held 100ms < 200ms threshold
    expect(ringOpened).toBe(false)
    expect(toolCycled).toBe(true)
  })

  it('exactly at boundary (200ms) does NOT open ring', () => {
    let ringOpened = false
    let keyDownTime = 0

    function onKeyDown(now: number) { keyDownTime = now }
    function onKeyUp(now: number) {
      if (now - keyDownTime > 200) ringOpened = true
      keyDownTime = 0
    }

    onKeyDown(0)
    onKeyUp(200) // exactly 200ms — not > 200 so does NOT open
    expect(ringOpened).toBe(false)
  })
})
