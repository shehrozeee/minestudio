import type { BuildEngine } from '../BuildEngine'
import type { SaveFile } from '../types'
import { ImportSystem } from './ImportSystem'
import { BulkPlaceCommand } from '../commands/BulkPlaceCommand'

const AUTO_SAVE_KEY = 'minestudio_autosave'
const CURRENT_VERSION = 1
const AUTO_SAVE_INTERVAL_MS = 30_000

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
  }

  private buildSaveFile(): SaveFile {
    const { objects } = this.engine
    return {
      version: CURRENT_VERSION,
      objects: objects.map(o => ({ ...o })),
      mates: [],
      bodies: [],
      camera: {
        position: {
          gx: this.engine.camera.position.x / 2,
          gy: this.engine.camera.position.y / 2,
          gz: this.engine.camera.position.z / 2,
        },
        rotationY: this.engine.camera.rotation.y,
      },
    }
  }

  saveToLocalStorage(): void {
    try {
      const data = this.buildSaveFile()
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data))
    } catch {
      // quota exceeded or private mode
    }
  }

  loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(AUTO_SAVE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as unknown
      this.restoreFromSave(data)
    } catch {
      // corrupted save — ignore
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
        this.engine.camera.position.set(gx * 2, gy * 2, gz * 2)
        this.engine.camera.rotation.y = save.camera.rotationY
      }
    } catch {
      // bad save file
    }
  }

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
