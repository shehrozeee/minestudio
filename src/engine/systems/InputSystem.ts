import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { BuildEngine } from '../BuildEngine'
import { GRID_BASE, PLATE_CELLS } from '../grid'
import { cycleColor, COLORS, getColorIndex } from '../registries/colors'

const WALK_SPEED = 70           // doubled when GRID_BASE went 2→4
const FLY_SPEED = 88            // 1.25× walk
const FLY_VERTICAL_SPEED = 50   // vertical fly slower than horizontal for fine placement
const GAMEPAD_DEAD = 0.15
const GAMEPAD_LOOK_SPEED = 1.4   // rad/sec at full stick deflection
const GAMEPAD_DOUBLE_TAP_MS = 400
// Trigger hysteresis — Xbox triggers oscillate around any single threshold mid-pull,
// firing multiple justPressed events per actual squeeze ("controller keeps placing").
// Enter pressed at 0.6, exit only below 0.25.
const TRIGGER_PRESS_HI = 0.6
const TRIGGER_RELEASE_LO = 0.25

function dz(v: number): number {
  return Math.abs(v) < GAMEPAD_DEAD ? 0 : v
}

interface GamepadPrev {
  rt: boolean; lt: boolean
  a: boolean; b: boolean; x: boolean; y: boolean
  lb: boolean; rb: boolean
  start: boolean; back: boolean
  dpadUp: boolean; dpadDown: boolean; dpadLeft: boolean; dpadRight: boolean
}

const EMPTY_PREV: GamepadPrev = {
  rt: false, lt: false,
  a: false, b: false, x: false, y: false,
  lb: false, rb: false,
  start: false, back: false,
  dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
}

let _nonStandardWarnShown = false

export class InputSystem {
  private engine: BuildEngine
  private controls!: PointerLockControls
  private keys = new Set<string>()
  private flyMode = false
  private store: typeof import('../../ui/store') | null = null
  private _docClickHandler: ((e: Event) => void) | null = null
  private _cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ')

  // Sticky: true once the user activates the game (click, A button, or any stick movement)
  private _started = false

  // Keyboard
  private tKeyDownTime = 0
  private lastZeroTap = 0

  // Gamepad
  private gamepadPrev: GamepadPrev = { ...EMPTY_PREV }
  private xHoldStart = 0
  private xRingOpened = false
  private dUpHoldStart = 0
  private dUpRingOpened = false
  private dUpRotateAxis: 'x' | 'y' | 'z' = 'y'
  private aLastTap = 0
  private aTapCount = 0
  private bLastTap = 0
  private bTapCount = 0
  // Trigger hysteresis state — see TRIGGER_PRESS_HI/LO constants
  private _rtPressed = false
  private _ltPressed = false
  // Back is a chord modifier (plate cycle, redo, export, etc). Defer the
  // bare-undo action to Back-release so chords don't fire an unwanted undo first.
  private _backChorded = false

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  private async getStore() {
    if (!this.store) this.store = await import('../../ui/store')
    return this.store
  }

  init(): void {
    const { camera, renderer } = this.engine
    this.controls = new PointerLockControls(camera, renderer.domElement)

    // Lock pointer ONLY when click is directly on the canvas (not bubbling from a UI element).
    // Otherwise modal buttons would re-acquire pointer lock on every click.
    this._docClickHandler = (e: Event) => {
      if (this.controls?.isLocked) return
      if (this._anyMenuOpen()) return
      const target = e.target as HTMLElement | null
      if (target !== this.engine.renderer.domElement) return
      this._markStarted()
      this.controls.lock()
    }
    document.addEventListener('click', this._docClickHandler)

    this.controls.addEventListener('lock', () => {
      this._markStarted()
      this.getStore().then(({ useStore }) => {
        useStore.getState().setFlyMode(this.flyMode)
      })
    })

    window.addEventListener('gamepadconnected', (e) => {
      const name = (e as GamepadEvent).gamepad.id.split('(')[0].trim()
      console.info(`[MineStudio] Gamepad connected: ${name}`)
    })
    window.addEventListener('gamepaddisconnected', () => {
      console.info('[MineStudio] Gamepad disconnected')
    })

    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('dblclick', this.onDblClick)
    renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true })
  }

  private _markStarted(): void {
    if (this._started) return
    this._started = true
    window.dispatchEvent(new CustomEvent('minestudio:started'))
  }

  private _anyMenuOpen(): boolean {
    const state = this.store?.useStore.getState()
    if (!state) return false
    return state.inventoryOpen || state.pauseMenuOpen || state.showControls || state.exportDialogOpen
  }

  /** Pointer lock is held (mouse capture). Used for mouse-look + keyboard movement. */
  isLocked(): boolean {
    return this.controls?.isLocked ?? false
  }

  /** Game is active and accepting movement/placement input. */
  isActive(): boolean {
    return this._started && !this._anyMenuOpen()
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────
  private onDblClick = (): void => {
    if (this.controls?.isLocked) this.controls.unlock()
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.isActive()) return
    const delta = e.deltaY > 0 ? 1 : -1
    this.getStore().then(({ useStore }) => {
      const { selectedSlot, hotbarSlots } = useStore.getState()
      useStore.getState().setHotbarSlot((selectedSlot + delta + hotbarSlots.length) % hotbarSlots.length)
    })
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)

    if (e.code === 'Digit0') {
      const now = Date.now()
      if (now - this.lastZeroTap < 350) {
        this.flyMode = !this.flyMode
        this.getStore().then(({ useStore }) => useStore.getState().setFlyMode(this.flyMode))
      }
      this.lastZeroTap = now
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
      e.preventDefault(); this.engine.commandBus.undo()
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey) {
      e.preventDefault(); this.engine.commandBus.redo()
    }

    if (e.code === 'BracketLeft') {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const idx = sizes.indexOf(useStore.getState().selectedSize)
        useStore.getState().setSize(sizes[Math.max(0, idx - 1)])
      })
    }
    if (e.code === 'BracketRight') {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const idx = sizes.indexOf(useStore.getState().selectedSize)
        useStore.getState().setSize(sizes[Math.min(2, idx + 1)])
      })
    }

    if (e.code === 'KeyQ') {
      this.getStore().then(({ useStore }) => useStore.getState().setColor(cycleColor(useStore.getState().selectedColor, -1)))
    }
    if (e.code === 'KeyE') {
      this.getStore().then(({ useStore }) => useStore.getState().setColor(cycleColor(useStore.getState().selectedColor, 1)))
    }

    if (e.code === 'KeyP') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedTool
        useStore.getState().setTool(cur === 'paint' ? 'place' : 'paint')
      })
    }
    if (e.code === 'KeyN') {
      this.getStore().then(({ useStore }) => useStore.getState().setNegativeMode(!useStore.getState().negativeMode))
    }
    if (e.code === 'Tab') {
      e.preventDefault()
      this.getStore().then(({ useStore }) => useStore.getState().setInventoryOpen(!useStore.getState().inventoryOpen))
    }
    if (e.code === 'F1' || e.code === 'Slash') {
      e.preventDefault()
      this.getStore().then(({ useStore }) => useStore.getState().setShowControls(!useStore.getState().showControls))
    }
    if (e.code === 'KeyG') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedTool
        useStore.getState().setTool(cur === 'select' ? 'place' : 'select')
      })
    }

    // R = rotate placement preview. Plain=Y axis, Shift=X axis, Ctrl=Z axis
    if (e.code === 'KeyR' && !e.repeat) {
      e.preventDefault()
      const axis: 'x' | 'y' | 'z' = e.shiftKey ? 'x' : (e.ctrlKey || e.metaKey) ? 'z' : 'y'
      this.getStore().then(({ useStore }) => useStore.getState().cyclePlacementRotation(axis))
    }

    // Ctrl+1..9 = switch plate. Ctrl+= add new plate.
    if ((e.ctrlKey || e.metaKey) && /^Digit[1-9]$/.test(e.code)) {
      e.preventDefault()
      const idx = parseInt(e.code.slice(5), 10) - 1
      this.getStore().then(({ useStore }) => useStore.getState().setActivePlate(idx))
    }
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
      e.preventDefault()
      this.getStore().then(({ useStore }) => useStore.getState().addPlate())
    }
    if (e.code === 'KeyT' && !e.repeat) {
      this.tKeyDownTime = Date.now()
    }

    if (e.code === 'Escape') {
      this.getStore().then(({ useStore }) => {
        const state = useStore.getState()
        if (state.showControls) { state.setShowControls(false); return }
        if (state.inventoryOpen) { state.setInventoryOpen(false); return }
        if (state.ringOpen) { state.setRingOpen(false); return }
      })
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
    if (e.code === 'KeyT') {
      const held = Date.now() - this.tKeyDownTime
      if (held > 200) {
        this.getStore().then(({ useStore }) => useStore.getState().setRingOpen(true, 'tools'))
      } else {
        this.getStore().then(({ useStore }) => {
          const TOOL_CYCLE = ['place', 'erase', 'paint', 'eyedropper', 'select', 'sink', 'mate', 'fillet', 'support', 'measure', 'text'] as const
          const cur = useStore.getState().selectedTool
          const idx = TOOL_CYCLE.indexOf(cur as typeof TOOL_CYCLE[number])
          useStore.getState().setTool(TOOL_CYCLE[(idx + 1) % TOOL_CYCLE.length])
        })
      }
      this.tKeyDownTime = 0
    }
  }

  // ─── Gamepad ─────────────────────────────────────────────────────────────
  private tickGamepad(dt: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    let pad: Gamepad | null = null
    for (const p of pads) {
      if (p && p.connected) { pad = p; break }
    }
    if (!pad) return

    if (pad.mapping !== 'standard') {
      if (!_nonStandardWarnShown) {
        console.warn('[MineStudio] Non-standard gamepad mapping — skipping gamepad input.')
        _nonStandardWarnShown = true
      }
      return
    }

    const now = Date.now()
    const lx = dz(pad.axes[0] ?? 0)
    const ly = dz(pad.axes[1] ?? 0)
    const rx = dz(pad.axes[2] ?? 0)
    const ry = dz(pad.axes[3] ?? 0)

    const btn = (i: number) => !!(pad!.buttons[i]?.pressed)
    // Trigger hysteresis: use HI to enter pressed, LO to release.
    // Prevents value-oscillation from firing multiple justPressed events per squeeze.
    const rtVal = pad!.buttons[7]?.value ?? 0
    const ltVal = pad!.buttons[6]?.value ?? 0
    if (!this._rtPressed && rtVal > TRIGGER_PRESS_HI) this._rtPressed = true
    else if (this._rtPressed && rtVal < TRIGGER_RELEASE_LO) this._rtPressed = false
    if (!this._ltPressed && ltVal > TRIGGER_PRESS_HI) this._ltPressed = true
    else if (this._ltPressed && ltVal < TRIGGER_RELEASE_LO) this._ltPressed = false
    const rt = this._rtPressed, lt = this._ltPressed
    const a = btn(0), b = btn(1), x = btn(2), y = btn(3)
    const lb = btn(4), rb = btn(5)
    const back = btn(8), start = btn(9)
    const dpadUp = btn(12), dpadDown = btn(13), dpadLeft = btn(14), dpadRight = btn(15)

    const justPressed = (cur: boolean, prev: boolean) => cur && !prev
    const justReleased = (cur: boolean, prev: boolean) => !cur && prev

    const prev = this.gamepadPrev
    const writePrev = () => {
      this.gamepadPrev = { rt, lt, a, b, x, y, lb, rb, back, start, dpadUp, dpadDown, dpadLeft, dpadRight }
    }

    // ── Activation: A button or any stick movement starts the game ──
    if (!this._started) {
      if (justPressed(a, prev.a) || lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0) {
        this._markStarted()
      }
      writePrev()
      return
    }

    // ── B button: close any open menu first ──
    if (justPressed(b, prev.b)) {
      const state = this.store?.useStore.getState()
      if (state) {
        if (state.exportDialogOpen) { state.setExportDialogOpen(false); writePrev(); return }
        if (state.inventoryOpen) { state.setInventoryOpen(false); writePrev(); return }
        if (state.showControls) { state.setShowControls(false); writePrev(); return }
        if (state.pauseMenuOpen) { state.setPauseMenuOpen(false); writePrev(); return }
        if (state.ringOpen) { state.setRingOpen(false); writePrev(); return }
      }
      // No menu — double-tap to toggle fly
      this.bTapCount++
      if (this.bTapCount >= 2 && now - this.bLastTap < GAMEPAD_DOUBLE_TAP_MS) {
        this.flyMode = !this.flyMode
        state?.setFlyMode(this.flyMode)
        this.bTapCount = 0
      }
      this.bLastTap = now
    }

    // ── Inventory navigation (when open) ──
    const stateNow = this.store?.useStore.getState()
    if (stateNow?.inventoryOpen) {
      // Y toggles inventory closed (mirrors Y open from main handler).
      if (justPressed(y, prev.y)) {
        stateNow.setInventoryOpen(false)
        writePrev()
        return
      }
      const fire = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      if (justPressed(dpadLeft, prev.dpadLeft))  fire('ArrowLeft')
      if (justPressed(dpadRight, prev.dpadRight)) fire('ArrowRight')
      if (justPressed(dpadUp, prev.dpadUp))      fire('ArrowUp')
      if (justPressed(dpadDown, prev.dpadDown))  fire('ArrowDown')
      if (justPressed(a, prev.a))                fire('Enter')
      if (justPressed(lb, prev.lb) || justPressed(rb, prev.rb)) {
        const TABS: import('../types').BlockCategory[] = ['basic', 'round', 'partial', 'connector', 'utility']
        const cur = TABS.indexOf(stateNow.inventoryTab)
        const dir = justPressed(rb, prev.rb) ? 1 : -1
        const next = TABS[(cur + dir + TABS.length) % TABS.length]
        stateNow.setInventoryOpen(true, next)
      }
      writePrev()
      return
    }

    // ── Export dialog navigation (when open) ──
    if (stateNow?.exportDialogOpen) {
      const fire = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      if (justPressed(dpadUp, prev.dpadUp))     fire('ArrowUp')
      if (justPressed(dpadDown, prev.dpadDown)) fire('ArrowDown')
      if (justPressed(a, prev.a))               fire('Enter')
      writePrev()
      return
    }

    // ── Active gate: no movement/placement when menu is open ──
    if (!this.isActive()) {
      writePrev()
      return
    }

    // ── Tool ring: X release commits selection (must run before ringActive gate) ──
    if (justReleased(x, prev.x) && this.xRingOpened) {
      const TOOL_CYCLE = ['place', 'erase', 'paint', 'eyedropper', 'select', 'sink', 'mate', 'fillet', 'support', 'measure', 'text', 'place'] as const
      const idx = this.store?.useStore.getState().ringHoverIdx
      const setRingOpen = this.store?.useStore.getState().setRingOpen
      const setRingHoverIdx = this.store?.useStore.getState().setRingHoverIdx
      const setTool = this.store?.useStore.getState().setTool
      if (idx !== null && idx !== undefined && setTool) {
        const tool = TOOL_CYCLE[idx]
        if (tool) setTool(tool)
      }
      setRingOpen?.(false)
      setRingHoverIdx?.(null)
      this.xHoldStart = 0
      this.xRingOpened = false
      writePrev()
      return
    }

    // ── Tool ring active: left stick selects a segment, no player movement ──
    const ringActive = this.store?.useStore.getState().ringOpen ?? false
    if (ringActive) {
      const mag = Math.hypot(lx, ly)
      if (mag > 0.4) {
        // ToolRing places idx 0 at top: angle_render = (i/12)*2π - π/2
        // Invert: idx = round((stick_angle + π/2) / 2π * 12)
        const angle = Math.atan2(ly, lx)
        const idx = ((Math.round(((angle + Math.PI / 2) / (Math.PI * 2)) * 12) % 12) + 12) % 12
        this.store?.useStore.getState().setRingHoverIdx(idx)
      }
      writePrev()
      return
    }

    // ── Movement (left stick) — direct camera position update.
    // Don't use controls.moveRight/Forward: they depend on PointerLockControls internals
    // that have changed across three.js versions (r160 renamed .object → .camera).
    if (lx !== 0 || ly !== 0) {
      const speed = this.flyMode ? FLY_SPEED : WALK_SPEED
      const camera = this.engine.camera
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      forward.y = 0
      if (forward.lengthSq() > 0) forward.normalize()
      const right = new THREE.Vector3()
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
      if (ly !== 0) camera.position.addScaledVector(forward, -ly * speed * dt)
      if (lx !== 0) camera.position.addScaledVector(right, lx * speed * dt)
    }

    // ── Look (right stick) — direct quaternion update ──
    if (rx !== 0 || ry !== 0) {
      const yawDelta = -rx * GAMEPAD_LOOK_SPEED * dt
      const pitchDelta = -ry * GAMEPAD_LOOK_SPEED * dt
      const obj = this.engine.camera
      this._cameraEuler.setFromQuaternion(obj.quaternion)
      this._cameraEuler.y += yawDelta
      this._cameraEuler.x += pitchDelta
      this._cameraEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._cameraEuler.x))
      obj.quaternion.setFromEuler(this._cameraEuler)
    }

    // ── Fly vertical (A/B or bumpers held while flying) ──
    // MC-creative-style: A=up, B=down. Bumpers kept as aliases.
    if (this.flyMode) {
      const obj = this.engine.camera
      if (a || rb) obj.position.y += FLY_VERTICAL_SPEED * dt
      if (b || lb) obj.position.y -= FLY_VERTICAL_SPEED * dt
    }

    // Clamp camera within build volume
    {
      const obj = this.engine.camera
      const MAX = PLATE_CELLS * GRID_BASE + 60
      obj.position.x = Math.max(-MAX, Math.min(MAX, obj.position.x))
      obj.position.y = Math.max(2, Math.min(MAX, obj.position.y))
      obj.position.z = Math.max(-MAX, Math.min(MAX, obj.position.z))
    }

    // ── Buttons ──

    // Back+RT = open export dialog (chord takes priority over plain RT place)
    const backRtCombo = back && justPressed(rt, prev.rt)
    if (backRtCombo) {
      window.dispatchEvent(new CustomEvent('minestudio:open-export-dialog'))
    }
    // RT = place
    else if (justPressed(rt, prev.rt)) {
      this.engine.renderer.domElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    // LT = delete
    if (justPressed(lt, prev.lt) && !back) {
      this.engine.renderer.domElement.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    }

    const backACombo = back && justPressed(a, prev.a)
    const backLbCombo = back && justPressed(lb, prev.lb)
    if (backACombo) { this.engine.commandBus.redo(); this._backChorded = true }
    if (backLbCombo) {
      this._backChorded = true
      this.getStore().then(({ useStore }) => useStore.getState().setAnnotationsVisible(!useStore.getState().annotationsVisible))
    }
    // Mark Back chorded if user pressed any chord button while Back is held.
    // (BACK+RT/LT export/cancel-place is handled near the trigger handlers above
    //  but also gate them here for plate/rotate chords.)
    if (back && (justPressed(rt, prev.rt) || justPressed(lt, prev.lt) || justPressed(y, prev.y) ||
                 justPressed(dpadLeft, prev.dpadLeft) || justPressed(dpadRight, prev.dpadRight) ||
                 justPressed(dpadUp, prev.dpadUp) || justPressed(dpadDown, prev.dpadDown) ||
                 justPressed(x, prev.x))) {
      this._backChorded = true
    }
    if (justPressed(back, prev.back)) {
      this._backChorded = false
    }
    // Bare undo fires on Back RELEASE if nothing was chorded with it.
    if (justReleased(back, prev.back) && !this._backChorded) {
      this.engine.commandBus.undo()
    }

    // A double-tap = fly toggle (skip if Back+A combo)
    if (!backACombo && justPressed(a, prev.a)) {
      if (this.aTapCount >= 1 && now - this.aLastTap < GAMEPAD_DOUBLE_TAP_MS) {
        this.flyMode = !this.flyMode
        this.getStore().then(({ useStore }) => useStore.getState().setFlyMode(this.flyMode))
        this.aTapCount = 0
      } else {
        this.aTapCount = 1
        this.aLastTap = now
      }
    }

    // X = tool ring on hold (>300ms)
    if (justPressed(x, prev.x)) {
      this.xHoldStart = now
      this.xRingOpened = false
    }
    if (x && this.xHoldStart > 0 && !this.xRingOpened && (now - this.xHoldStart) > 300) {
      this.xRingOpened = true
      this.getStore().then(({ useStore }) => useStore.getState().setRingOpen(true, 'tools'))
    }
    // X release without ring is a no-op (release-with-ring handled before movement gate)
    if (justReleased(x, prev.x)) {
      this.xHoldStart = 0
      this.xRingOpened = false
    }

    // Y = open/close inventory (MC Bedrock convention).
    // Rotate moved to DPAD ↑ tap (with Back/Start for X/Z axes).
    if (justPressed(y, prev.y)) {
      this.getStore().then(({ useStore }) => useStore.getState().setInventoryOpen(!useStore.getState().inventoryOpen))
    }

    // LB: in fly mode = vertical descent ONLY (handled in fly block above).
    // Out of fly: paint→color back, else hotbar prev.
    if (!backLbCombo && justPressed(lb, prev.lb) && !this.flyMode) {
      this.getStore().then(({ useStore }) => {
        const state = useStore.getState()
        if (state.selectedTool === 'paint') {
          const idx = getColorIndex(state.selectedColor)
          state.setColor(COLORS[(idx - 1 + COLORS.length) % COLORS.length].hex)
        } else {
          state.setHotbarSlot((state.selectedSlot - 1 + state.hotbarSlots.length) % state.hotbarSlots.length)
        }
      })
    }

    // RB: same logic
    if (justPressed(rb, prev.rb) && !this.flyMode) {
      this.getStore().then(({ useStore }) => {
        const state = useStore.getState()
        if (state.selectedTool === 'paint') {
          const idx = getColorIndex(state.selectedColor)
          state.setColor(COLORS[(idx + 1) % COLORS.length].hex)
        } else {
          state.setHotbarSlot((state.selectedSlot + 1) % state.hotbarSlots.length)
        }
      })
    }

    // D-pad left/right:
    //   BACK + DPAD ← / → = plate prev / next  (highest priority)
    //   paint mode        = color cycle (works during fly)
    //   default           = hotbar prev / next
    if (justPressed(dpadLeft, prev.dpadLeft)) {
      if (back) {
        this.getStore().then(({ useStore }) => {
          const s = useStore.getState()
          s.setActivePlate(Math.max(0, s.activePlate - 1))
        })
      } else {
        this.getStore().then(({ useStore }) => {
          const state = useStore.getState()
          if (state.selectedTool === 'paint') {
            const idx = getColorIndex(state.selectedColor)
            state.setColor(COLORS[(idx - 1 + COLORS.length) % COLORS.length].hex)
          } else {
            state.setHotbarSlot((state.selectedSlot - 1 + state.hotbarSlots.length) % state.hotbarSlots.length)
          }
        })
      }
    }
    if (justPressed(dpadRight, prev.dpadRight)) {
      if (back) {
        this.getStore().then(({ useStore }) => {
          const s = useStore.getState()
          // Auto-extend plateCount up to max if cycling past current count
          if (s.activePlate + 1 < s.plateCount) {
            s.setActivePlate(s.activePlate + 1)
          } else if (s.plateCount < 9) {
            s.addPlate() // addPlate jumps activePlate to the new plate
          }
        })
      } else {
        this.getStore().then(({ useStore }) => {
          const state = useStore.getState()
          if (state.selectedTool === 'paint') {
            const idx = getColorIndex(state.selectedColor)
            state.setColor(COLORS[(idx + 1) % COLORS.length].hex)
          } else {
            state.setHotbarSlot((state.selectedSlot + 1) % state.hotbarSlots.length)
          }
        })
      }
    }

    // D-pad Up: hold>400ms = category ring, tap = rotate placement.
    // Inventory moved to Y button (MC Bedrock convention).
    // Tap rotates yaw by default; Back+DPAD↑ = pitch (X), Start+DPAD↑ = roll (Z).
    if (justPressed(dpadUp, prev.dpadUp)) {
      this.dUpHoldStart = now
      this.dUpRingOpened = false
      // Latch the rotation axis at the press moment so a chord-modifier release
      // during a long press doesn't change which axis we rotate.
      this.dUpRotateAxis = back ? 'x' : start ? 'z' : 'y'
    }
    if (dpadUp && this.dUpHoldStart > 0 && !this.dUpRingOpened && (now - this.dUpHoldStart) > 400) {
      this.dUpRingOpened = true
      this.getStore().then(({ useStore }) => useStore.getState().setRingOpen(true, 'categories'))
    }
    if (justReleased(dpadUp, prev.dpadUp)) {
      if (!this.dUpRingOpened) {
        const axis = this.dUpRotateAxis
        this.getStore().then(({ useStore }) => useStore.getState().cyclePlacementRotation(axis))
      } else {
        this.getStore().then(({ useStore }) => useStore.getState().setRingOpen(false))
      }
      this.dUpHoldStart = 0
      this.dUpRingOpened = false
    }

    if (justPressed(dpadDown, prev.dpadDown)) {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const idx = sizes.indexOf(useStore.getState().selectedSize)
        // Cycle forward so the user can ALWAYS change size with one button
        useStore.getState().setSize(sizes[(idx + 1) % sizes.length])
      })
    }

    // Start = pause menu (closes start screen on first press)
    if (justPressed(start, prev.start)) {
      this.getStore().then(({ useStore }) => useStore.getState().setPauseMenuOpen(!useStore.getState().pauseMenuOpen))
    }

    writePrev()
  }

  // ─── Per-frame tick ──────────────────────────────────────────────────────
  tick(dt: number): void {
    this.tickGamepad(dt)

    // Keyboard movement requires both pointer lock AND active state
    if (!this.controls?.isLocked || !this.isActive()) return

    const speed = this.flyMode ? FLY_SPEED : WALK_SPEED
    const { camera } = this.engine

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() > 0) forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))   camera.position.addScaledVector(forward, speed * dt)
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) camera.position.addScaledVector(forward, -speed * dt)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) camera.position.addScaledVector(right, -speed * dt)
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight'))camera.position.addScaledVector(right, speed * dt)
    if (this.keys.has('Space'))     camera.position.y += speed * dt
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyF'))
      camera.position.y -= speed * dt

    const MAX = PLATE_CELLS * GRID_BASE + 60
    camera.position.x = Math.max(-MAX, Math.min(MAX, camera.position.x))
    camera.position.y = Math.max(2, Math.min(MAX, camera.position.y))
    camera.position.z = Math.max(-MAX, Math.min(MAX, camera.position.z))

    this.getStore().then(({ useStore }) => {
      useStore.getState().setPlayerPosition({
        gx: camera.position.x / GRID_BASE,
        gy: camera.position.y / GRID_BASE,
        gz: camera.position.z / GRID_BASE,
      })
    })
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('dblclick', this.onDblClick)
    this.engine.renderer.domElement.removeEventListener('wheel', this.onWheel)
    if (this._docClickHandler) document.removeEventListener('click', this._docClickHandler)
    this.controls?.dispose()
  }
}
