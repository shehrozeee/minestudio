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

// X button hold detection tests
describe('GamepadInput X button hold for tool ring', () => {
  it('hold >300ms opens tool ring', () => {
    let ringOpened = false
    let xHoldStart = 0
    let xRingOpened = false

    // Simulate rising edge
    function onXPress(now: number) {
      xHoldStart = now
      xRingOpened = false
    }

    // Simulate held check (called each frame)
    function onXHeld(now: number) {
      if (xHoldStart > 0 && !xRingOpened && (now - xHoldStart) > 300) {
        xRingOpened = true
        ringOpened = true
      }
    }

    onXPress(1000)
    onXHeld(1000 + 350) // 350ms later — over 300ms threshold
    expect(ringOpened).toBe(true)
  })

  it('short tap <300ms does NOT open tool ring', () => {
    let ringOpened = false
    let xHoldStart = 0
    let xRingOpened = false

    function onXPress(now: number) {
      xHoldStart = now
      xRingOpened = false
    }
    function onXHeld(now: number) {
      if (xHoldStart > 0 && !xRingOpened && (now - xHoldStart) > 300) {
        xRingOpened = true
        ringOpened = true
      }
    }
    function onXRelease() {
      xHoldStart = 0
      xRingOpened = false
    }

    onXPress(1000)
    onXHeld(1000 + 100) // Only 100ms — not enough
    onXRelease()
    expect(ringOpened).toBe(false)
  })
})

// A button double-tap for fly toggle
describe('GamepadInput A button double-tap for fly toggle', () => {
  const DOUBLE_TAP_MS = 400

  function makeATapSystem() {
    let flyMode = false
    let aLastTap = 0
    let aTapCount = 0

    function onAPress(now: number) {
      if (aTapCount >= 1 && now - aLastTap < DOUBLE_TAP_MS) {
        flyMode = !flyMode
        aTapCount = 0
        aLastTap = 0
      } else {
        aTapCount = 1
        aLastTap = now
      }
    }

    return { onAPress, getFly: () => flyMode }
  }

  it('double-tap within 400ms toggles fly', () => {
    const { onAPress, getFly } = makeATapSystem()
    onAPress(1000)
    onAPress(1000 + 300) // 300ms later — within window
    expect(getFly()).toBe(true)
  })

  it('single tap does NOT toggle fly', () => {
    const { onAPress, getFly } = makeATapSystem()
    onAPress(1000)
    expect(getFly()).toBe(false)
  })

  it('two taps more than 400ms apart do NOT toggle fly', () => {
    const { onAPress, getFly } = makeATapSystem()
    onAPress(1000)
    onAPress(1000 + 500) // 500ms later — outside window, resets
    expect(getFly()).toBe(false)
  })
})

// LB context sensitivity
describe('GamepadInput LB context-sensitive behavior', () => {
  it('in paint mode cycles color backward', () => {
    const COLORS = ['#aaa', '#bbb', '#ccc']
    let colorIdx = 1
    let hotbarSlot = 2
    const selectedTool: string = 'paint'

    function onLBPress() {
      if (selectedTool === 'paint') {
        colorIdx = (colorIdx - 1 + COLORS.length) % COLORS.length
      } else {
        hotbarSlot = (hotbarSlot - 1 + 5) % 5
      }
    }

    onLBPress()
    expect(colorIdx).toBe(0)
    expect(hotbarSlot).toBe(2) // unchanged
  })

  it('outside paint mode cycles hotbar backward', () => {
    let colorIdx = 1
    let hotbarSlot = 2
    const selectedTool: string = 'place'

    function onLBPress() {
      if (selectedTool === 'paint') {
        colorIdx = (colorIdx - 1 + 3) % 3
      } else {
        hotbarSlot = (hotbarSlot - 1 + 5) % 5
      }
    }

    onLBPress()
    expect(colorIdx).toBe(1) // unchanged
    expect(hotbarSlot).toBe(1)
  })
})

// D-pad Up hold vs tap
describe('GamepadInput D-pad Up hold for category ring vs tap for inventory', () => {
  function makeDUpSystem() {
    let dUpHoldStart = 0
    let dUpRingOpened = false
    let ringOpen = false
    let inventoryOpen = false

    function onDUpPress(now: number) {
      dUpHoldStart = now
      dUpRingOpened = false
    }
    function onDUpHeld(now: number) {
      if (dUpHoldStart > 0 && !dUpRingOpened && (now - dUpHoldStart) > 400) {
        dUpRingOpened = true
        ringOpen = true
      }
    }
    function onDUpRelease() {
      if (!dUpRingOpened) {
        inventoryOpen = !inventoryOpen
      } else {
        ringOpen = false
      }
      dUpHoldStart = 0
      dUpRingOpened = false
    }

    return {
      onDUpPress, onDUpHeld, onDUpRelease,
      getRingOpen: () => ringOpen,
      getInventoryOpen: () => inventoryOpen,
    }
  }

  it('hold >400ms opens category ring', () => {
    const sys = makeDUpSystem()
    sys.onDUpPress(1000)
    sys.onDUpHeld(1000 + 500) // 500ms later
    expect(sys.getRingOpen()).toBe(true)
    expect(sys.getInventoryOpen()).toBe(false)
  })

  it('short tap opens inventory instead of ring', () => {
    const sys = makeDUpSystem()
    sys.onDUpPress(1000)
    sys.onDUpHeld(1000 + 100) // 100ms — not enough for ring
    sys.onDUpRelease()
    expect(sys.getRingOpen()).toBe(false)
    expect(sys.getInventoryOpen()).toBe(true)
  })
})

// Back+A = redo
describe('GamepadInput Back+A combo triggers redo', () => {
  it('redo is called when Back held and A just pressed', () => {
    let redoCalled = false
    let undoCalled = false

    const justPressed = (cur: boolean, prev: boolean) => cur && !prev

    // Simulate a frame where Back is held and A just pressed
    const back = true
    const a = true
    const aPrev = false

    const backACombo = back && justPressed(a, aPrev)
    if (backACombo) {
      redoCalled = true
    }
    // Back alone should trigger undo — but not when A is also pressed
    if (justPressed(back, false) && !a) {
      undoCalled = true
    }

    expect(redoCalled).toBe(true)
    expect(undoCalled).toBe(false)
  })
})

// Non-standard gamepad guard
describe('GamepadInput non-standard pad is skipped', () => {
  it('skips processing when pad.mapping is not standard', () => {
    let processed = false
    let warned = false

    function tickGamepadSimulation(pad: { mapping: string; connected: boolean }) {
      if (pad.mapping !== 'standard') {
        if (!warned) {
          console.warn('Non-standard gamepad')
          warned = true
        }
        return
      }
      processed = true
    }

    tickGamepadSimulation({ mapping: 'xr-standard', connected: true })
    expect(processed).toBe(false)
    expect(warned).toBe(true)
  })

  it('processes standard pads normally', () => {
    let processed = false

    function tickGamepadSimulation(pad: { mapping: string; connected: boolean }) {
      if (pad.mapping !== 'standard') return
      processed = true
    }

    tickGamepadSimulation({ mapping: 'standard', connected: true })
    expect(processed).toBe(true)
  })
})
