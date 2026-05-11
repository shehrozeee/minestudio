import * as THREE from 'three'
import { CommandBus } from './commands/Command'
import { OccupancyMap } from './grid'
import type { PlacedObject } from './types'
import { WorldSystem } from './systems/WorldSystem'
import { InputSystem } from './systems/InputSystem'
import { PlacementSystem } from './systems/PlacementSystem'
import { RenderSystem } from './systems/RenderSystem'
import { ConnectorSystem } from './systems/ConnectorSystem'
import { CSGSystem } from './systems/CSGSystem'
import { ValidationSystem } from './systems/ValidationSystem'
import { ExportSystem } from './systems/ExportSystem'
import { StorageSystem } from './systems/StorageSystem'
import { MigrationSystem } from './systems/MigrationSystem'
import { ImportSystem } from './systems/ImportSystem'
import { useStore } from '../ui/store'

export class BuildEngine {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly commandBus: CommandBus
  readonly occupancy: OccupancyMap
  readonly objects: PlacedObject[] = []
  readonly store = useStore

  readonly world: WorldSystem
  readonly input: InputSystem
  readonly placement: PlacementSystem
  readonly render: RenderSystem
  readonly connector: ConnectorSystem
  readonly csg: CSGSystem
  readonly validation: ValidationSystem
  readonly exporter: ExportSystem
  readonly storage: StorageSystem
  readonly migration: MigrationSystem
  readonly importSystem: ImportSystem

  private animFrameId = 0
  private lastTime = 0
  private nextId = 1

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      55,
      canvas.clientWidth / canvas.clientHeight,
      0.5,
      3000
    )
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    this.commandBus = new CommandBus()
    this.occupancy = new OccupancyMap()

    this.world = new WorldSystem(this)
    this.input = new InputSystem(this)
    this.placement = new PlacementSystem(this)
    this.render = new RenderSystem(this)
    this.connector = new ConnectorSystem(this)
    this.csg = new CSGSystem(this)
    this.validation = new ValidationSystem(this)
    this.exporter = new ExportSystem(this)
    this.migration = new MigrationSystem()
    this.storage = new StorageSystem(this)
    this.importSystem = new ImportSystem()
  }

  getNextId(): number { return this.nextId++ }

  init(): void {
    this.world.init()
    this.input.init()
    this.placement.init()
    this.render.init()
    this.storage.init()
    this.exporter.init()

    this.world.setTimeUpdateCallback((t) => {
      import('../ui/store').then(({ useStore }) => {
        useStore.getState().setTimeOfDay(t)
      })
    })

    this.commandBus.onChange(({ canUndo, canRedo }) => {
      this.render.sync(this.objects)
      this.world.syncLamps(this.objects)
      import('../ui/store').then(({ useStore }) => {
        useStore.getState().setUndoState({ canUndo, canRedo })
        useStore.getState().setObjectCount(
          this.objects.filter(o => o.isPrintable).length
        )
      })
    })

    // Sync annotation visibility from store to ConnectorSystem
    let prevAnnotationsVisible = this.store.getState().annotationsVisible
    let prevActivePlate = this.store.getState().activePlate
    this.store.subscribe((state) => {
      if (state.annotationsVisible !== prevAnnotationsVisible) {
        prevAnnotationsVisible = state.annotationsVisible
        this.connector.setAnnotationsVisible(state.annotationsVisible)
      }
      if (state.activePlate !== prevActivePlate) {
        prevActivePlate = state.activePlate
        this.render.setActivePlate(state.activePlate)
      }
    })

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        this.storage.exportToFile()
      }
    })

    window.addEventListener('resize', this.onResize)
    this.loop(0)
  }

  sync(): void {
    this.render.sync(this.objects)
  }

  private loop = (time: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (time - this.lastTime) / 1000)
    this.lastTime = time

    this.input.tick(dt)
    this.placement.tick(dt)
    this.render.tick(dt)
    this.connector.tick(dt)
    this.world.tick(dt)

    this.renderer.render(this.scene, this.camera)
  }

  private onResize = (): void => {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.onResize)
    this.world.dispose()
    this.input.dispose()
    this.placement.dispose()
    this.render.dispose()
    this.connector.dispose()
    this.renderer.dispose()
  }
}
