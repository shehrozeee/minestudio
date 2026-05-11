import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { NamedSaveSlot, SaveFile } from '../types'
import { GRID_BASE } from '../grid'
import { ImportSystem } from './ImportSystem'
import { BulkPlaceCommand } from '../commands/BulkPlaceCommand'

const AUTO_SAVE_KEY = 'minestudio_autosave'
const AUTO_SAVE_BACKUP_KEY = 'minestudio_autosave_backup'
const SAVE_SLOTS_KEY = 'minestudio_slots'
const SAVE_SLOTS_META_KEY = 'minestudio_slots_meta'
const CURRENT_VERSION = 1
const AUTO_SAVE_INTERVAL_MS = 30_000
const SLOT_COUNT = 5

export class StorageSystem {
  private engine: BuildEngine
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    // Hook into commandBus to save on every command
    this.engine.commandBus.onChange(() => {
      this.saveToLocalStorage()
    })

    // Also auto-save on interval
    this.intervalId = setInterval(() => {
      this.saveToLocalStorage()
    }, AUTO_SAVE_INTERVAL_MS)

    // Restore on startup
    this.loadFromLocalStorage()

    // Listen for drag-drop file import
    document.addEventListener('dragover', (e) => e.preventDefault())
    document.addEventListener('drop', this.onDrop)

    // Listen for save-slot events from the PauseMenu / UI
    window.addEventListener('minestudio:save-slot', (e: Event) => {
      const { slot, name } = (e as CustomEvent<{ slot: number; name: string }>).detail
      this.saveToSlot(slot, name)
      // Write slot metadata for the UI to read without full data
      this.updateSlotMeta()
    })

    // Listen for load-slot events
    window.addEventListener('minestudio:load-slot', (e: Event) => {
      const { slot } = (e as CustomEvent<{ slot: number }>).detail
      this.loadFromSlot(slot)
    })
  }

  // ---------------------------------------------------------------------------
  // Named save slots
  // ---------------------------------------------------------------------------

  /** Returns the full slot array (5 entries, may be null). */
  loadSlots(): (NamedSaveSlot | null)[] {
    try {
      const raw = localStorage.getItem(SAVE_SLOTS_KEY)
      if (!raw) return Array(SLOT_COUNT).fill(null) as null[]
      const parsed = JSON.parse(raw) as (NamedSaveSlot | null)[]
      // Ensure exactly SLOT_COUNT entries
      while (parsed.length < SLOT_COUNT) parsed.push(null)
      return parsed.slice(0, SLOT_COUNT)
    } catch {
      return Array(SLOT_COUNT).fill(null) as null[]
    }
  }

  /** Save current state to a named slot (0-indexed). */
  saveToSlot(slot: number, name: string): void {
    if (slot < 0 || slot >= SLOT_COUNT) return
    try {
      const slots = this.loadSlots()
      const saveFile = this.buildSaveFile()
      // SAFETY: warn if user is saving an empty state on top of an existing
      // non-empty save (almost certainly a mistake — usually means restore failed)
      if (saveFile.objects.length === 0) {
        const existing = slots[slot]
        if (existing && existing.data?.objects?.length > 0) {
          const proceed = window.confirm(
            `Slot ${slot + 1} ("${existing.name}") has ${existing.data.objects.length} blocks. ` +
            `Current scene is empty. Overwrite anyway?`
          )
          if (!proceed) return
        }
      }
      slots[slot] = { name, data: saveFile, savedAt: Date.now() }
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots))
      this.updateSlotMeta()
    } catch (err) {
      console.warn('[MineStudio] saveToSlot failed:', err)
    }
  }

  /** Load state from a named slot (0-indexed). */
  loadFromSlot(slot: number): void {
    if (slot < 0 || slot >= SLOT_COUNT) return
    try {
      const slots = this.loadSlots()
      const saved = slots[slot]
      if (!saved) return
      this.restoreFromSave(saved.data)
    } catch {
      // bad slot data
    }
  }

  /** Write lightweight slot metadata (name + savedAt) for the UI. */
  private updateSlotMeta(): void {
    try {
      const slots = this.loadSlots()
      const meta = slots.map(s => s ? { name: s.name, savedAt: s.savedAt } : null)
      localStorage.setItem(SAVE_SLOTS_META_KEY, JSON.stringify(meta))
    } catch {
      // quota
    }
  }

  // ---------------------------------------------------------------------------
  // Save file construction
  // ---------------------------------------------------------------------------

  buildSaveFile(): SaveFile {
    const state = this.engine.store.getState()
    const mates = this.engine.connector.getMates() as unknown as SaveFile['mates']
    const q = this.engine.camera.quaternion
    return {
      version: CURRENT_VERSION,
      // Source of truth is engine.objects (PlaceCommand mutates this array).
      // The store's `objects` array is leftover scaffolding never wired up.
      objects: this.engine.objects.map(o => ({ ...o })),
      mates,
      bodies: state.bodyList,
      camera: {
        position: {
          gx: this.engine.camera.position.x / GRID_BASE,
          gy: this.engine.camera.position.y / GRID_BASE,
          gz: this.engine.camera.position.z / GRID_BASE,
        },
        quaternion: [q.x, q.y, q.z, q.w],
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-save / localStorage
  // ---------------------------------------------------------------------------

  saveToLocalStorage(): void {
    try {
      const data = this.buildSaveFile()
      // SAFETY: never overwrite a non-empty autosave with an empty one.
      // Prevents catastrophic data loss when restore fails silently and the
      // empty state gets persisted on top of real work.
      if (data.objects.length === 0) {
        const existing = localStorage.getItem(AUTO_SAVE_KEY)
        if (existing) {
          try {
            const prev = JSON.parse(existing) as { objects?: unknown[] }
            if (Array.isArray(prev.objects) && prev.objects.length > 0) {
              console.warn('[MineStudio] Refusing to overwrite non-empty autosave with empty state.')
              return
            }
          } catch { /* fall through and overwrite a corrupted save */ }
        }
      }
      // Keep one rotation as backup before overwriting
      const prev = localStorage.getItem(AUTO_SAVE_KEY)
      if (prev) {
        try { localStorage.setItem(AUTO_SAVE_BACKUP_KEY, prev) } catch { /* quota */ }
      }
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('[MineStudio] saveToLocalStorage failed:', err)
    }
  }

  loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(AUTO_SAVE_KEY)
      if (!raw) {
        console.info('[MineStudio] No autosave found.')
        return
      }
      const data = JSON.parse(raw) as unknown
      this.restoreFromSave(data)
      console.info('[MineStudio] Autosave restored.')
    } catch (err) {
      console.error('[MineStudio] Autosave restore failed:', err)
    }
  }

  private restoreFromSave(data: unknown): void {
    try {
      const save = this.engine.migration.migrate(data)
      // Clear existing scene
      for (const obj of [...this.engine.objects]) {
        this.engine.occupancy.unregister(obj.id, obj.position, obj.size)
      }
      this.engine.objects.length = 0

      // Restore objects
      for (const obj of save.objects) {
        this.engine.objects.push(obj)
        this.engine.occupancy.register(obj.id, obj.position, obj.size)
      }
      this.engine.sync()

      // Restore camera
      if (save.camera) {
        const { gx, gy, gz } = save.camera.position
        this.engine.camera.position.set(gx * GRID_BASE, gy * GRID_BASE, gz * GRID_BASE)
        if (save.camera.quaternion) {
          // Preferred: deterministic restore from saved quaternion
          this.engine.camera.quaternion.fromArray(save.camera.quaternion)
        } else if (typeof save.camera.rotationY === 'number') {
          // Legacy: just yaw, no pitch/roll. Build a YXZ euler with that yaw.
          const e = new THREE.Euler(0, save.camera.rotationY, 0, 'YXZ')
          this.engine.camera.quaternion.setFromEuler(e)
        } else {
          this.engine.camera.lookAt(0, this.engine.camera.position.y, 0)
        }
      }

      // Recompute plateCount from highest plate index in restored objects.
      // Set state directly (don't use addPlate — it side-effect-jumps activePlate).
      const maxPlate = save.objects.reduce((m, o) => Math.max(m, o.plate ?? 0), 0)
      const desiredPlateCount = Math.max(1, maxPlate + 1)
      this.engine.store.setState({ plateCount: desiredPlateCount, activePlate: 0 })
      this.engine.render.setActivePlate(0)
      console.info(`[MineStudio] Restored ${save.objects.length} objects across ${desiredPlateCount} plate(s).`)
    } catch (err) {
      console.error('[MineStudio] restoreFromSave failed:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // File export / import
  // ---------------------------------------------------------------------------

  exportToFile(): void {
    const data = this.buildSaveFile()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minestudio_${Date.now()}.minstudio`
    a.click()
    URL.revokeObjectURL(url)
  }

  private onDrop = (e: DragEvent): void => {
    e.preventDefault()
    const file = e.dataTransfer?.files[0]
    if (!file) return

    const name = file.name.toLowerCase()

    if (name.endsWith('.minstudio')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as unknown
          this.restoreFromSave(data)
        } catch {
          // invalid file
        }
      }
      reader.readAsText(file)
      return
    }

    if (name.endsWith('.stl')) {
      file.arrayBuffer().then((buffer) => {
        const blocks = ImportSystem.importSTL(buffer)
        if (blocks.length > 0) {
          this.engine.commandBus.execute(new BulkPlaceCommand(blocks, this.engine))
        }
      }).catch(() => {})
      return
    }

    if (name.endsWith('.glb')) {
      file.arrayBuffer().then((buffer) => {
        return ImportSystem.importGLB(buffer)
      }).then((blocks) => {
        if (blocks.length > 0) {
          this.engine.commandBus.execute(new BulkPlaceCommand(blocks, this.engine))
        }
      }).catch(() => {})
      return
    }
  }

  dispose(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    document.removeEventListener('drop', this.onDrop)
  }
}
