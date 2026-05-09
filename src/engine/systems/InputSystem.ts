import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { BuildEngine } from '../BuildEngine'
import { GRID_BASE } from '../grid'
import { cycleColor } from '../registries/colors'

const WALK_SPEED = 80   // mm/s
const FLY_SPEED = 120   // mm/s

export class InputSystem {
  private engine: BuildEngine
  private controls!: PointerLockControls
  private keys = new Set<string>()
  private lastZeroTap = 0
  private flyMode = false
  private store: typeof import('../../ui/store') | null = null

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

    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
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
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  isLocked(): boolean {
    return this.controls?.isLocked ?? false
  }

  tick(dt: number): void {
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

    // Update store player position (fractional grid coords for display)
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
    this.controls?.dispose()
  }
}
