import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { BlockSize } from '../types'
import { snapToGrid, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'
import { PlaceCommand } from '../commands/PlaceCommand'
import { DeleteCommand } from '../commands/DeleteCommand'
import { PaintCommand } from '../commands/PaintCommand'

const CENTER = new THREE.Vector2(0, 0)

export class PlacementSystem {
  private engine: BuildEngine
  private raycaster = new THREE.Raycaster()
  private ghostMesh: THREE.Mesh | null = null
  private ghostDefId = ''
  private ghostSize: BlockSize = 'normal'
  private ghostPos: { gx: number; gy: number; gz: number } | null = null
  private storeCache: typeof import('../../ui/store') | null = null

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    const { renderer } = this.engine
    renderer.domElement.addEventListener('click', this.onLeftClick)
    renderer.domElement.addEventListener('contextmenu', this.onRightClick)
    document.addEventListener('keydown', this.onKeyDown)
  }

  private getStore(): typeof import('../../ui/store') | null {
    return this.storeCache
  }

  private getRaycastTargets(): THREE.Mesh[] {
    const targets: THREE.Mesh[] = []
    this.engine.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj !== this.ghostMesh &&
        (obj.userData['isPlate'] === true || typeof obj.userData['objectId'] === 'number')
      ) {
        targets.push(obj)
      }
    })
    return targets
  }

  private castRay(): THREE.Intersection | null {
    if (!this.engine.input.isLocked()) return null
    this.raycaster.setFromCamera(CENTER, this.engine.camera)
    const hits = this.raycaster.intersectObjects(this.getRaycastTargets(), false)
    return hits[0] ?? null
  }

  private getPlacementPos(hit: THREE.Intersection): { gx: number; gy: number; gz: number } | null {
    if (!hit.face) return null
    const normal = hit.face.normal.clone()
    normal.transformDirection(hit.object.matrixWorld)
    // Offset slightly along surface normal to land in the adjacent cell
    const pt = hit.point.clone().addScaledVector(normal, 0.01)
    return snapToGrid(pt)
  }

  private onLeftClick = (): void => {
    if (!this.engine.input.isLocked()) return
    const store = this.getStore()
    if (!store) return
    const state = store.useStore.getState()

    if (state.selectedTool === 'paint') {
      // Paint mode: color the aimed block
      const hit = this.castRay()
      if (!hit) return
      const objectId = hit.object.userData['objectId'] as number | undefined
      if (typeof objectId !== 'number') return
      const obj = this.engine.objects.find(o => o.id === objectId)
      if (!obj) return
      if (obj.color === state.selectedColor) return  // no-op if same color
      this.engine.commandBus.execute(new PaintCommand(this.engine, obj, state.selectedColor))
      return
    }

    if (state.selectedTool === 'erase') {
      this.eraseAimed()
      return
    }

    // Default: place tool
    if (!this.ghostPos) return
    const defId = state.hotbarSlots[state.selectedSlot]
    if (!defId) return
    const def = getBlockDef(defId)
    if (!def) return
    if (this.engine.occupancy.isOccupied(this.ghostPos, state.selectedSize)) return

    this.engine.commandBus.execute(
      new PlaceCommand(this.engine, {
        id: this.engine.getNextId(),
        defId,
        size: state.selectedSize,
        position: { ...this.ghostPos },
        rotation: { x: 0 as 0, y: 0 as 0, z: 0 as 0 },
        color: state.selectedColor,
        isNegative: state.negativeMode,
        isPrintable: def.isPrintable,
        isSupport: false,
        storageKind: 'grid',
      }),
    )
  }

  private onRightClick = (e: MouseEvent): void => {
    e.preventDefault()
    this.eraseAimed()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyX') this.eraseAimed()
  }

  private eraseAimed(): void {
    if (!this.engine.input.isLocked()) return
    const hit = this.castRay()
    if (!hit) return
    const objectId = hit.object.userData['objectId'] as number | undefined
    if (typeof objectId !== 'number') return
    const obj = this.engine.objects.find(o => o.id === objectId)
    if (!obj) return
    this.engine.commandBus.execute(new DeleteCommand(this.engine, obj))
  }

  tick(_dt: number): void {
    // Load store lazily on first tick
    if (!this.storeCache) {
      import('../../ui/store').then(m => { this.storeCache = m })
      return
    }

    const hit = this.castRay()
    if (!hit) {
      this.setGhostVisible(false)
      this.ghostPos = null
      return
    }

    const pos = this.getPlacementPos(hit)
    if (!pos) {
      this.setGhostVisible(false)
      this.ghostPos = null
      return
    }

    const state = this.storeCache.useStore.getState()
    const defId = state.hotbarSlots[state.selectedSlot] ?? 'cube'
    const size = state.selectedSize

    this.ghostPos = pos
    this.updateGhost(pos, defId, size, state.negativeMode)
  }

  private updateGhost(
    pos: { gx: number; gy: number; gz: number },
    defId: string,
    size: BlockSize,
    negativeMode: boolean,
  ): void {
    const def = getBlockDef(defId)
    if (!def) return
    const unitSize = GRID_BASE * SIZE_IN_UNITS[size]

    // Rebuild ghost if block type or size changed
    if (!this.ghostMesh || this.ghostDefId !== defId || this.ghostSize !== size) {
      if (this.ghostMesh) {
        this.engine.scene.remove(this.ghostMesh)
        this.ghostMesh.geometry.dispose()
      }
      const geo = def.makeGeometry(unitSize)
      const mat = new THREE.MeshBasicMaterial({
        color: negativeMode ? 0xff2020 : 0x00d563,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
      })
      this.ghostMesh = new THREE.Mesh(geo, mat)
      this.engine.scene.add(this.ghostMesh)
      this.ghostDefId = defId
      this.ghostSize = size
    } else {
      // Update color when negativeMode toggles without rebuilding geometry
      const mat = this.ghostMesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(negativeMode ? 0xff2020 : 0x00d563)
    }

    const half = unitSize / 2
    this.ghostMesh.position.set(
      pos.gx * GRID_BASE + half,
      pos.gy * GRID_BASE + half,
      pos.gz * GRID_BASE + half,
    )
    this.ghostMesh.visible = true
  }

  private setGhostVisible(v: boolean): void {
    if (this.ghostMesh) this.ghostMesh.visible = v
  }

  dispose(): void {
    const { renderer } = this.engine
    renderer.domElement.removeEventListener('click', this.onLeftClick)
    renderer.domElement.removeEventListener('contextmenu', this.onRightClick)
    document.removeEventListener('keydown', this.onKeyDown)
    if (this.ghostMesh) {
      this.engine.scene.remove(this.ghostMesh)
      this.ghostMesh.geometry.dispose()
    }
  }
}
