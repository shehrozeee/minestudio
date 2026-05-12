import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { BlockSize } from '../types'
import { snapToGrid, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'
import { CONNECTOR_REGISTRY } from '../registries/connectors'
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
  private glowingMeshes: { mesh: THREE.Mesh; originalEmissive: THREE.Color }[] = []
  // Aim highlight — wireframe outline shown around the targeted block
  private aimHighlight: THREE.LineSegments | null = null
  private aimHighlightForId: number | null = null

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
        obj.visible &&
        (
          obj.userData['isPlate'] === true ||
          typeof obj.userData['objectId'] === 'number' ||
          obj.userData['isCsgPreview'] === true
        )
      ) {
        targets.push(obj)
      }
    })
    return targets
  }

  private castRay(): THREE.Intersection | null {
    if (!this.engine.input.isActive()) return null
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
    if (!this.engine.input.isActive()) return
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
    // Negative blocks ARE allowed to overlap positives — that's how material is carved.
    // Only block placement if there's already a solid (non-negative) there AND we're not
    // placing a negative.
    if (!state.negativeMode && this.engine.occupancy.isOccupied(this.ghostPos, state.selectedSize)) return

    this.engine.commandBus.execute(
      new PlaceCommand(this.engine, {
        id: this.engine.getNextId(),
        defId,
        size: state.selectedSize,
        position: { ...this.ghostPos },
        rotation: { ...state.placementRotation },
        color: state.selectedColor,
        isNegative: state.negativeMode,
        isPrintable: def.isPrintable,
        isSupport: false,
        storageKind: 'grid',
        plate: state.activePlate,
      }),
    )
    this.ghostPos = null
    this.setGhostVisible(false)
  }

  private onRightClick = (e: MouseEvent): void => {
    e.preventDefault()
    this.eraseAimed()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyX') this.eraseAimed()
  }

  private eraseAimed(): void {
    if (!this.engine.input.isActive()) return
    // Paint mode is non-destructive: never delete blocks
    const tool = this.storeCache?.useStore.getState().selectedTool
    if (tool === 'paint' || tool === 'eyedropper') return
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
      this.clearGlows()
      this.clearAimHighlight()
      return
    }

    // Aim highlight on the hovered block (skip plate)
    const hitObjectId = hit.object.userData['objectId'] as number | undefined
    if (typeof hitObjectId === 'number') {
      this.updateAimHighlight(hit.object as THREE.Mesh, hitObjectId)
    } else {
      this.clearAimHighlight()
    }

    const pos = this.getPlacementPos(hit)
    if (!pos) {
      this.setGhostVisible(false)
      this.ghostPos = null
      this.clearGlows()
      return
    }

    const state = this.storeCache.useStore.getState()
    const defId = state.hotbarSlots[state.selectedSlot] ?? 'cube'
    const size = state.selectedSize

    this.ghostPos = pos
    this.updateGhost(pos, defId, size, state.negativeMode)
    this.updateConnectorGlows()
  }

  private updateAimHighlight(targetMesh: THREE.Mesh, objectId: number): void {
    const tool = this.storeCache?.useStore.getState().selectedTool
    // Color hint: red for delete tools, yellow for paint, cyan for general
    const color = tool === 'erase' ? 0xff3030 : tool === 'paint' ? 0xffd54a : 0x00e5ff

    if (this.aimHighlightForId !== objectId || !this.aimHighlight) {
      if (this.aimHighlight) {
        this.engine.scene.remove(this.aimHighlight)
        this.aimHighlight.geometry.dispose()
        ;(this.aimHighlight.material as THREE.LineBasicMaterial).dispose()
      }
      const edges = new THREE.EdgesGeometry(targetMesh.geometry)
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.95, depthTest: false })
      this.aimHighlight = new THREE.LineSegments(edges, mat)
      this.aimHighlight.renderOrder = 999
      this.engine.scene.add(this.aimHighlight)
      this.aimHighlightForId = objectId
    } else {
      ;(this.aimHighlight.material as THREE.LineBasicMaterial).color.setHex(color)
    }
    this.aimHighlight.position.copy(targetMesh.position)
    this.aimHighlight.quaternion.copy(targetMesh.quaternion)
    this.aimHighlight.scale.copy(targetMesh.scale)
    this.aimHighlight.visible = true
  }

  private clearAimHighlight(): void {
    if (this.aimHighlight) this.aimHighlight.visible = false
    this.aimHighlightForId = null
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
    const rot = this.storeCache?.useStore.getState().placementRotation
    if (rot) {
      this.ghostMesh.rotation.set(
        (rot.x * Math.PI) / 180,
        (rot.y * Math.PI) / 180,
        (rot.z * Math.PI) / 180,
      )
    }
    this.ghostMesh.visible = true
  }

  private setGhostVisible(v: boolean): void {
    if (this.ghostMesh) this.ghostMesh.visible = v
  }

  private clearGlows(): void {
    for (const { mesh, originalEmissive } of this.glowingMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissive.copy(originalEmissive)
        mesh.material.emissiveIntensity = 0
      }
    }
    this.glowingMeshes = []
  }

  private updateConnectorGlows(): void {
    this.clearGlows()
    if (!this.storeCache) return
    const state = this.storeCache.useStore.getState()
    const defId = state.hotbarSlots[state.selectedSlot]
    if (!defId) return
    const selectedDef = getBlockDef(defId)
    if (!selectedDef || selectedDef.category !== 'connector') return

    const connectorDef = CONNECTOR_REGISTRY.find(c => c.id === defId)
    if (!connectorDef) return

    const objects = this.engine.objects
    for (const obj of objects) {
      const objDef = getBlockDef(obj.defId)
      if (!objDef || objDef.category !== 'connector') continue
      const mesh = this.engine.render.getMesh(obj.id)
      if (!mesh || !(mesh.material instanceof THREE.MeshStandardMaterial)) continue

      const objConnDef = CONNECTOR_REGISTRY.find(c => c.id === obj.defId)
      const isCompatible = objConnDef !== undefined &&
        (connectorDef.matesWith.includes(obj.defId) || objConnDef.matesWith.includes(defId))

      const originalEmissive = mesh.material.emissive.clone()

      if (isCompatible) {
        mesh.material.emissive.set(0x00ff00)
        mesh.material.emissiveIntensity = 0.5
        this.glowingMeshes.push({ mesh, originalEmissive })
      } else {
        mesh.material.emissive.set(0xff0000)
        mesh.material.emissiveIntensity = 0.3
        this.glowingMeshes.push({ mesh, originalEmissive })
      }
    }
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
    if (this.aimHighlight) {
      this.engine.scene.remove(this.aimHighlight)
      this.aimHighlight.geometry.dispose()
      ;(this.aimHighlight.material as THREE.LineBasicMaterial).dispose()
      this.aimHighlight = null
    }
    this.clearGlows()
  }
}
