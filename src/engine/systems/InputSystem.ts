import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { BuildEngine } from '../BuildEngine'
import { GRID_BASE } from '../grid'
import { cycleColor } from '../registries/colors'

const WALK_SPEED = 80    // mm/s
const FLY_SPEED = 120    // mm/s
const GAMEPAD_DEAD = 0.15
const GAMEPAD_LOOK_SPEED = 600  // px/s equivalent at full deflection
const GAMEPAD_FLY_DOUBLE_TAP_MS = 400

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

export class InputSystem {
  private engine: BuildEngine
  private controls!: PointerLockControls
  private keys = new Set<string>()
  private lastZeroTap = 0
  private flyMode = false
  private store: typeof import('../../ui/store') | null = null

  // Gamepad state
  private gamepadPrev: GamepadPrev = { ...EMPTY_PREV }
  private gamepadFlyTaps = 0
  private gamepadFlyLastTap = 0

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

    renderer.domElement.addEventListener('click', () => {
      if (!this.controls.isLocked) this.controls.lock()
    })

    this.controls.addEventListener('lock', () => {
      this.getStore().then(({ useStore }) => {
        useStore.getState().setFlyMode(this.flyMode)
      })
    })

    // Gamepad connection toasts
    window.addEventListener('gamepadconnected', (e) => {
      const name = (e as GamepadEvent).gamepad.id.split('(')[0].trim()
      console.info(`[MineStudio] Gamepad connected: ${name}`)
    })
    window.addEventListener('gamepaddisconnected', () => {
      console.info('[MineStudio] Gamepad disconnected')
    })

    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)

    // Scroll wheel → cycle hotbar slot
    renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true })
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.controls?.isLocked) return
    const delta = e.deltaY > 0 ? 1 : -1
    this.getStore().then(({ useStore }) => {
      const { selectedSlot, hotbarSlots } = useStore.getState()
      const next = (selectedSlot + delta + hotbarSlots.length) % hotbarSlots.length
      useStore.getState().setHotbarSlot(next)
    })
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)

    // Double-tap 0 = toggle fly
    if (e.code === 'Digit0') {
      const now = Date.now()
      if (now - this.lastZeroTap < 350) {
        this.flyMode = !this.flyMode
        this.getStore().then(({ useStore }) => {
          useStore.getState().setFlyMode(this.flyMode)
        })
      }
      this.lastZeroTap = now
    }

    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
      e.preventDefault()
      this.engine.commandBus.undo()
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey) {
      e.preventDefault()
      this.engine.commandBus.redo()
    }

    // Block size cycle: [ and ]
    if (e.code === 'BracketLeft') {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const cur = useStore.getState().selectedSize
        const idx = sizes.indexOf(cur)
        useStore.getState().setSize(sizes[Math.max(0, idx - 1)])
      })
    }
    if (e.code === 'BracketRight') {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const cur = useStore.getState().selectedSize
        const idx = sizes.indexOf(cur)
        useStore.getState().setSize(sizes[Math.min(2, idx + 1)])
      })
    }

    // Color cycle: Q = prev, E = next
    if (e.code === 'KeyQ') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedColor
        useStore.getState().setColor(cycleColor(cur, -1))
      })
    }
    if (e.code === 'KeyE') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedColor
        useStore.getState().setColor(cycleColor(cur, 1))
      })
    }

    // P key = toggle paint / place tool
    if (e.code === 'KeyP') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedTool
        useStore.getState().setTool(cur === 'paint' ? 'place' : 'paint')
      })
    }

    // N key = toggle negative block mode
    if (e.code === 'KeyN') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().negativeMode
        useStore.getState().setNegativeMode(!cur)
      })
    }

    // Tab = open/close inventory
    if (e.code === 'Tab') {
      e.preventDefault()
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().inventoryOpen
        useStore.getState().setInventoryOpen(!cur)
      })
    }

    // Escape / F1 / Slash(?) = toggle controls page
    if (e.code === 'F1' || e.code === 'Slash') {
      e.preventDefault()
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().showControls
        useStore.getState().setShowControls(!cur)
      })
    }

    // G = grab/select+move tool
    if (e.code === 'KeyG') {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedTool
        useStore.getState().setTool(cur === 'select' ? 'place' : 'select')
      })
    }

    // Escape = unlock pointer / close overlays
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
  }

  isLocked(): boolean {
    return this.controls?.isLocked ?? false
  }

  // Called from BuildEngine.loop every frame
  tickGamepad(dt: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    let pad: Gamepad | null = null
    for (const p of pads) {
      if (p && p.connected) { pad = p; break }
    }
    if (!pad) return

    const lx = dz(pad.axes[0] ?? 0)
    const ly = dz(pad.axes[1] ?? 0)
    const rx = dz(pad.axes[2] ?? 0)
    const ry = dz(pad.axes[3] ?? 0)

    const btn = (i: number) => !!(pad!.buttons[i]?.pressed)
    const trig = (i: number) => (pad!.buttons[i]?.value ?? 0) > 0.5

    const rt      = trig(7)
    const lt      = trig(6)
    const a       = btn(0)
    const b       = btn(1)
    const x       = btn(2)
    const y       = btn(3)
    const lb      = btn(4)
    const rb      = btn(5)
    const back    = btn(8)
    const start   = btn(9)
    const dpadUp    = btn(12)
    const dpadDown  = btn(13)
    const dpadLeft  = btn(14)
    const dpadRight = btn(15)

    const justPressed = (cur: boolean, prev: boolean) => cur && !prev

    // --- Movement (left stick) ---
    if (this.controls?.isLocked && (lx !== 0 || ly !== 0)) {
      const speed = this.flyMode ? FLY_SPEED : WALK_SPEED
      if (lx !== 0) this.controls.moveRight(lx * speed * dt)
      if (ly !== 0) this.controls.moveForward(-ly * speed * dt)
    }

    // --- Look (right stick) via PointerLockControls internal handler ---
    if (this.controls?.isLocked && (rx !== 0 || ry !== 0)) {
      const movementX = rx * GAMEPAD_LOOK_SPEED * dt
      const movementY = ry * GAMEPAD_LOOK_SPEED * dt
      // PointerLockControls exposes onMouseMove as a public method in r160
      const ctrl = this.controls as unknown as { onMouseMove?: (e: { movementX: number; movementY: number }) => void }
      if (typeof ctrl.onMouseMove === 'function') {
        ctrl.onMouseMove({ movementX, movementY })
      } else {
        // Fallback: manual euler rotation
        const obj = this.controls.object
        obj.rotation.y -= movementX * 0.002
        const pitchObj = obj.children[0] as THREE.Object3D | undefined
        if (pitchObj) {
          pitchObj.rotation.x = Math.max(
            -Math.PI / 2 + 0.01,
            Math.min(Math.PI / 2 - 0.01, pitchObj.rotation.x - movementY * 0.002)
          )
        }
      }
    }

    // --- Fly vertical (bumpers while flying) ---
    if (this.flyMode && this.controls?.isLocked) {
      const obj = this.controls.object
      if (rb) obj.position.y += FLY_SPEED * dt
      if (lb) obj.position.y -= FLY_SPEED * dt
      const MAX = 128 * GRID_BASE + 60
      obj.position.y = Math.max(2, Math.min(MAX, obj.position.y))
    }

    // --- Buttons with edge detection ---

    // RT = place (primary action)
    if (justPressed(rt, this.gamepadPrev.rt) && this.controls?.isLocked) {
      this.engine.renderer.domElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }

    // LT = delete (always)
    if (justPressed(lt, this.gamepadPrev.lt) && this.controls?.isLocked) {
      this.engine.renderer.domElement.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      )
    }

    // A = toggle fly (single press in new spec, no double-tap needed)
    if (justPressed(a, this.gamepadPrev.a)) {
      this.flyMode = !this.flyMode
      this.getStore().then(({ useStore }) => {
        useStore.getState().setFlyMode(this.flyMode)
      })
    }

    // B = double-tap to toggle fly mode (original shape_studio behavior)
    if (justPressed(b, this.gamepadPrev.b)) {
      const now = Date.now()
      this.gamepadFlyTaps++
      if (this.gamepadFlyTaps >= 2 && now - this.gamepadFlyLastTap < GAMEPAD_FLY_DOUBLE_TAP_MS) {
        this.flyMode = !this.flyMode
        this.getStore().then(({ useStore }) => {
          useStore.getState().setFlyMode(this.flyMode)
        })
        this.gamepadFlyTaps = 0
      }
      this.gamepadFlyLastTap = now
    }

    // X = next color (cycle forward)
    if (justPressed(x, this.gamepadPrev.x)) {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().selectedColor
        useStore.getState().setColor(cycleColor(cur, 1))
      })
    }

    // Y = cycle block size
    if (justPressed(y, this.gamepadPrev.y)) {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const cur = useStore.getState().selectedSize
        const idx = sizes.indexOf(cur)
        useStore.getState().setSize(sizes[(idx + 1) % 3])
      })
    }

    // LB (no fly) = prev hotbar slot
    if (justPressed(lb, this.gamepadPrev.lb) && !this.flyMode) {
      this.getStore().then(({ useStore }) => {
        const { selectedSlot, hotbarSlots } = useStore.getState()
        const next = (selectedSlot - 1 + hotbarSlots.length) % hotbarSlots.length
        useStore.getState().setHotbarSlot(next)
      })
    }

    // RB (no fly) = next hotbar slot
    if (justPressed(rb, this.gamepadPrev.rb) && !this.flyMode) {
      this.getStore().then(({ useStore }) => {
        const { selectedSlot, hotbarSlots } = useStore.getState()
        const next = (selectedSlot + 1) % hotbarSlots.length
        useStore.getState().setHotbarSlot(next)
      })
    }

    // D-pad left/right = hotbar cycle
    if (justPressed(dpadLeft, this.gamepadPrev.dpadLeft)) {
      this.getStore().then(({ useStore }) => {
        const { selectedSlot, hotbarSlots } = useStore.getState()
        useStore.getState().setHotbarSlot((selectedSlot - 1 + hotbarSlots.length) % hotbarSlots.length)
      })
    }
    if (justPressed(dpadRight, this.gamepadPrev.dpadRight)) {
      this.getStore().then(({ useStore }) => {
        const { selectedSlot, hotbarSlots } = useStore.getState()
        useStore.getState().setHotbarSlot((selectedSlot + 1) % hotbarSlots.length)
      })
    }

    // D-pad up = open inventory
    if (justPressed(dpadUp, this.gamepadPrev.dpadUp)) {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().inventoryOpen
        useStore.getState().setInventoryOpen(!cur)
      })
    }

    // D-pad down = cycle block size down
    if (justPressed(dpadDown, this.gamepadPrev.dpadDown)) {
      this.getStore().then(({ useStore }) => {
        const sizes = ['normal', 'large', 'xl'] as const
        const cur = useStore.getState().selectedSize
        const idx = sizes.indexOf(cur)
        useStore.getState().setSize(sizes[Math.max(0, idx - 1)])
      })
    }

    // Back = undo
    if (justPressed(back, this.gamepadPrev.back)) {
      this.engine.commandBus.undo()
    }

    // Start = toggle controls page
    if (justPressed(start, this.gamepadPrev.start)) {
      this.getStore().then(({ useStore }) => {
        const cur = useStore.getState().showControls
        useStore.getState().setShowControls(!cur)
      })
    }

    this.gamepadPrev = { rt, lt, a, b, x, y, lb, rb, back, start, dpadUp, dpadDown, dpadLeft, dpadRight }
  }

  tick(dt: number): void {
    this.tickGamepad(dt)

    if (!this.controls?.isLocked) return

    const speed = this.flyMode ? FLY_SPEED : WALK_SPEED
    const { camera } = this.engine

    // Build forward/right vectors on XZ plane only
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() > 0) forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      camera.position.addScaledVector(forward, speed * dt)
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))
      camera.position.addScaledVector(forward, -speed * dt)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
      camera.position.addScaledVector(right, -speed * dt)
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      camera.position.addScaledVector(right, speed * dt)

    // Vertical
    if (this.keys.has('Space') || this.keys.has('KeyR'))
      camera.position.y += speed * dt
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyF'))
      camera.position.y -= speed * dt

    // Clamp within build volume + margin
    const MAX = 128 * GRID_BASE + 60
    camera.position.x = Math.max(-MAX, Math.min(MAX, camera.position.x))
    camera.position.y = Math.max(2, Math.min(MAX, camera.position.y))
    camera.position.z = Math.max(-MAX, Math.min(MAX, camera.position.z))

    // Update store player position
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
    this.engine.renderer.domElement.removeEventListener('wheel', this.onWheel)
    this.controls?.dispose()
  }
}
