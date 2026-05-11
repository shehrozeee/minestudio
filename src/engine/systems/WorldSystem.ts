import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { GRID_BASE, PLATE_CELLS, toWorld } from '../grid'

const PLATE_SIZE = PLATE_CELLS * GRID_BASE

export const PLAYER_HEIGHT = 56

export class WorldSystem {
  private engine: BuildEngine
  private hemi!: THREE.HemisphereLight
  private fillLight!: THREE.DirectionalLight
  private scene!: THREE.Scene
  private lamps: Map<number, THREE.PointLight> = new Map()
  private readonly LAMP_CAP = 12

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  setTimeUpdateCallback(_cb: (t: number) => void): void {
    // No-op — sun system removed. Time-of-day HUD reads a fixed value.
  }

  init(): void {
    const { scene, camera } = this.engine
    this.scene = scene

    // Solid bright sky color (no Sky shader, no day/night)
    scene.background = new THREE.Color(0xa8c8e8)
    scene.fog = new THREE.Fog(0xa8c8e8, 600, 2000)

    // Bright global ambient — never goes dark
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6a7280, 1.4)
    scene.add(this.hemi)

    // Soft top-down fill so blocks have depth/shading without a moving sun
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
    this.fillLight.position.set(80, 200, 60)
    this.fillLight.castShadow = false
    scene.add(this.fillLight)

    this.buildPlate()

    const edges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(PLATE_SIZE, PLATE_SIZE, PLATE_SIZE)
    )
    const volLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00d563, transparent: true, opacity: 0.3 })
    )
    volLines.position.y = PLATE_SIZE / 2
    scene.add(volLines)

    camera.position.set(0, PLAYER_HEIGHT, PLATE_SIZE / 2 - 30)
    camera.lookAt(0, PLAYER_HEIGHT, 0)
  }

  private buildPlate(): void {
    const { scene } = this.engine

    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_SIZE, 4, PLATE_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x222831 })
    )
    plateMesh.position.y = -2
    plateMesh.userData['isPlate'] = true
    scene.add(plateMesh)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2a3038'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#3a4048'
    for (let x = 8; x < 512; x += 16)
      for (let y = 8; y < 512; y += 16) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill()
      }
    ctx.fillStyle = '#00d563'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('MineStudio · 256×256mm', 16, 490)

    const tex = new THREE.CanvasTexture(canvas)
    const gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_SIZE - 4, PLATE_SIZE - 4),
      new THREE.MeshStandardMaterial({ map: tex })
    )
    gridMesh.rotation.x = -Math.PI / 2
    gridMesh.position.y = 0.05
    scene.add(gridMesh)

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_SIZE + 24, 8, PLATE_SIZE + 24),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8 })
    )
    frame.position.y = -6
    scene.add(frame)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x555a62 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -10.1
    scene.add(ground)
  }

  tick(_dt: number): void {
    // No-op — no day/night cycle
  }

  addLamp(objectId: number, defId: string, position: THREE.Vector3): boolean {
    if (this.lamps.size >= this.LAMP_CAP) return false
    const isLantern = defId === 'lantern'
    const light = new THREE.PointLight(
      isLantern ? 0xfff5e0 : 0xff9444,
      isLantern ? 4.0 : 2.5,
      isLantern ? 80 : 50,
      2,
    )
    // Position is the cell corner; offset to cell center
    light.position.set(position.x + GRID_BASE / 2, position.y + GRID_BASE / 2, position.z + GRID_BASE / 2)
    this.scene.add(light)
    this.lamps.set(objectId, light)
    return true
  }

  removeLamp(objectId: number): void {
    const light = this.lamps.get(objectId)
    if (light) {
      this.scene.remove(light)
      this.lamps.delete(objectId)
    }
  }

  syncLamps(objects: PlacedObject[]): void {
    const lampIds = new Set(
      objects
        .filter(o => o.defId === 'torch' || o.defId === 'lantern')
        .map(o => o.id),
    )

    for (const [id, light] of this.lamps) {
      if (!lampIds.has(id)) {
        this.scene.remove(light)
        this.lamps.delete(id)
      }
    }

    for (const obj of objects) {
      if ((obj.defId !== 'torch' && obj.defId !== 'lantern') || this.lamps.has(obj.id)) continue
      if (this.lamps.size >= this.LAMP_CAP) break
      const worldPos = toWorld(obj.position)
      this.addLamp(obj.id, obj.defId, worldPos)
    }
  }

  dispose(): void {
    for (const [, light] of this.lamps) {
      this.scene.remove(light)
    }
    this.lamps.clear()
  }
}
