import { describe, it, expect } from 'vitest'

// Pure logic extracted for testing — no Three.js dependency

function makeDeadzone(dead: number) {
  return (v: number) => Math.abs(v) < dead ? 0 : v
}

describe('GamepadInput dead zone', () => {
  const dz = makeDeadzone(0.15)

  it('passes values above dead zone', () => {
    expect(dz(0.5)).toBe(0.5)
    expect(dz(-0.5)).toBe(-0.5)
  })

  it('zeros values within dead zone', () => {
    expect(dz(0.1)).toBe(0)
    expect(dz(-0.1)).toBe(0)
    expect(dz(0.14)).toBe(0)
  })

  it('passes value exactly at boundary (boundary is NOT zeroed — strictly less than)', () => {
    // dead zone is |v| < 0.15, so exactly 0.15 passes through
    expect(dz(0.15)).toBe(0.15)
    expect(dz(0.14)).toBe(0)
  })
})

describe('GamepadInput button edge detection', () => {
  it('justPressed only fires on transition false→true', () => {
    const prev: Record<number, boolean> = {}
    const buttons = [false, false, false]

    const pressed = (i: number) => buttons[i]
    const justPressed = (i: number) => pressed(i) && !prev[i]

    // Initial state: no press
    expect(justPressed(0)).toBe(false)

    // Button goes down
    buttons[0] = true
    expect(justPressed(0)).toBe(true)

    // Update prev
    prev[0] = pressed(0)

    // Still held — should NOT fire again
    expect(justPressed(0)).toBe(false)

    // Release
    buttons[0] = false
    prev[0] = pressed(0)

    // Not pressed
    expect(justPressed(0)).toBe(false)

    // Press again — fires again
    buttons[0] = true
    expect(justPressed(0)).toBe(true)
  })

  it('multiple buttons can be edge-detected independently', () => {
    const prev: Record<number, boolean> = {}
    const buttons = [false, false, false]

    const pressed = (i: number) => buttons[i]
    const justPressed = (i: number) => pressed(i) && !prev[i]

    buttons[0] = true
    buttons[1] = true

    expect(justPressed(0)).toBe(true)
    expect(justPressed(1)).toBe(true)
    expect(justPressed(2)).toBe(false)
  })
})

describe('GamepadInput fly double-tap (B button)', () => {
  it('toggles fly when B pressed twice within 400ms', () => {
    let flyMode = false
    let flyTaps = 0
    let flyLastTap = 0

    function tapB(now: number) {
      flyTaps++
      if (flyTaps >= 2 && now - flyLastTap < 400) {
        flyMode = !flyMode
        flyTaps = 0
      }
      flyLastTap = now
    }

    tapB(0)
    tapB(200)  // 200ms later — within 400ms
    expect(flyMode).toBe(true)
  })

  it('does NOT toggle when B tapped twice more than 400ms apart', () => {
    let flyMode = false
    let flyTaps = 0
    let flyLastTap = 0

    function tapB(now: number) {
      flyTaps++
      if (flyTaps >= 2 && now - flyLastTap < 400) {
        flyMode = !flyMode
        flyTaps = 0
      }
      flyLastTap = now
    }

    tapB(0)
    tapB(500)  // 500ms later — too slow
    expect(flyMode).toBe(false)
  })
})

describe('GamepadInput tickGamepad no-op without connected pad', () => {
  it('returns early when navigator.getGamepads returns no pads', () => {
    const called: string[] = []

    // Simulate tickGamepad minimal logic
    function tickGamepad(getPads: () => (Gamepad | null)[]) {
      const pads = getPads()
      const pad = pads.find(p => p && p.connected) ?? null
      if (!pad) { called.push('early-return'); return }
      called.push('processed')
    }

    tickGamepad(() => [])
    expect(called).toEqual(['early-return'])

    tickGamepad(() => [null, null])
    expect(called).toEqual(['early-return', 'early-return'])
  })
})

describe('GamepadInput trigger threshold', () => {
  it('trigger counts as pressed when value > 0.5', () => {
    const isTrigPressed = (value: number) => value > 0.5
    expect(isTrigPressed(0.0)).toBe(false)
    expect(isTrigPressed(0.5)).toBe(false)
    expect(isTrigPressed(0.51)).toBe(true)
    expect(isTrigPressed(1.0)).toBe(true)
  })
})
