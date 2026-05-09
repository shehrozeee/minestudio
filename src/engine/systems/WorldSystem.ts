import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { GRID_BASE, toWorld } from '../grid'

const PLATE_CELLS = 128
const PLATE_SIZE = PLATE_CELLS * GRID_BASE

export const PLAYER_HEIGHT = 28

export class WorldSystem {
  private engine: BuildEngine
  private hemi!: THREE.HemisphereLight
  private sun!: THREE.DirectionalLight
  private sky!: Sky
  private sunDir = new THREE.Vector3()
  private dayTime = 0.25
  private onTimeUpdate?: (t: number) => void
  private scene!: THREE.Scene
  private lamps: Map<number, THREE.PointLight> = new Map()
  private readonly LAMP_CAP = 12
  // Printer ambient lights — always on, intensify at night
  private printerLights: THREE.PointLight[] = []

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  setTimeUpdateCallback(cb: (t: number) => void): void {
    this.onTimeUpdate = cb
  }

  init(): void {
    const { scene, camera } = this.engine
    this.scene = scene

    // Sky shader — Rayleigh/Mie atmospheric scattering
    this.sky = new Sky()
    this.sky.scale.setScalar(10000)
    scene.add(this.sky)

    const skyUniforms = this.sky.material.uniforms
    skyUniforms['turbidity'].value = 4
    skyUniforms['rayleigh'].value = 0.8
    skyUniforms['mieCoefficient'].value = 0.005
    skyUniforms['mieDirectionalG'].value = 0.92

    scene.fog = new THREE.Fog(0xa8c8e8, 400, 1500)

    this.hemi = new THREE.HemisphereLight(0xddeeff, 0x443322, 0.6)
    scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xfffbe8, 1.4)
    this.sun.castShadow = false
    scene.add(this.sun)

    // Set initial sun position
    this.updateSky()

    this.buildPlate()
    this.buildPrinterLights(scene)

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

  private buildPrinterLights(scene: THREE.Scene): void {
    const H = PLATE_SIZE / 2
    // Four corner uplights along frame edge — cool blue-white like Bambu LED strips
    const positions = [
      [-H, -8,  H], [ H, -8,  H],
      [-H, -8, -H], [ H, -8, -H],
    ]
    for (const [x, y, z] of positions) {
      const light = new THREE.PointLight(0x99ccff, 0, 180)  // starts at 0, ramps up at night
      light.position.set(x, y, z)
      scene.add(light)
      this.printerLights.push(light)
    }
    // Central under-plate glow — warm amber like heated bed
    const bedGlow = new THREE.PointLight(0xff6600, 0, 120)
    bedGlow.position.set(0, -12, 0)
    scene.add(bedGlow)
    this.printerLights.push(bedGlow)
  }

  private updateSky(): void {
    // dayTime 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset, 1=midnight
    const angle = this.dayTime * Math.PI * 2 - Math.PI / 2
    const elevation = Math.sin(angle)  // -1 to 1
    const azimuth = Math.cos(angle)

    // Sun direction for Sky shader (elevation above horizon in radians)
    const phi = THREE.MathUtils.degToRad(90 - elevation * 90)
    const theta = Math.atan2(azimuth, 1)
    this.sunDir.setFromSphericalCoords(1, phi, theta)

    this.sky.material.uniforms['sunPosition'].value.copy(this.sunDir)
    this.sun.position.copy(this.sunDir).multiplyScalar(500)

    const dayFactor = Math.max(0, elevation)
    const nightFactor = 1 - dayFactor           // 1 at midnight, 0 at noon
    const duskFactor = Math.max(0, 1 - Math.abs(elevation) * 3)  // peaks at horizon

    this.sun.intensity = 0.05 + dayFactor * 1.8
    this.sun.color.setHSL(0.1 - duskFactor * 0.05, 0.8 + duskFactor * 0.2, 0.5 + dayFactor * 0.5)
    // Minimum ambient so blocks never disappear in darkness
    this.hemi.intensity = 0.25 + dayFactor * 0.55
    this.hemi.color.setHSL(0.6 - duskFactor * 0.1, 0.5, 0.5 + dayFactor * 0.3)

    // Printer LED strips — ramp up as sun goes down
    if (this.printerLights.length > 0) {
      const ledIntensity = 0.2 + nightFactor * 1.6
      for (let i = 0; i < 4; i++) {
        const l = this.printerLights[i]
        if (l) l.intensity = ledIntensity
      }
      const bed = this.printerLights[4]
      if (bed) bed.intensity = 0.1 + nightFactor * 0.8
    }

    // Night sky — darken scene background via fog color
    const nightFog = new THREE.Color(0x0a0a18)
    const dayFog = new THREE.Color(0xa8c8e8)
    const fogColor = nightFog.clone().lerp(dayFog, dayFactor)
    if (this.engine.scene.fog instanceof THREE.Fog) {
      this.engine.scene.fog.color.copy(fogColor)
    }

    // Night: dim sky shader turbidity to simulate stars (Sky fades to black naturally)
    this.sky.material.uniforms['rayleigh'].value = 0.1 + dayFactor * 0.7
    this.sky.material.uniforms['turbidity'].value = 1 + dayFactor * 5
  }

  tick(dt: number): void {
    this.dayTime = (this.dayTime + dt / 60) % 1
    this.updateSky()
    this.onTimeUpdate?.(this.dayTime)
  }

  addLamp(objectId: number, defId: string, position: THREE.Vector3): boolean {
    if (this.lamps.size >= this.LAMP_CAP) return false
    const isLantern = defId === 'lantern'
    const light = new THREE.PointLight(
      isLantern ? 0xfff5e0 : 0xff8844,
      isLantern ? 1.5 : 1.0,
      isLantern ? 40 : 20,
    )
    light.position.copy(position)
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

    // Remove lights for objects that no longer exist
    for (const [id, light] of this.lamps) {
      if (!lampIds.has(id)) {
        this.scene.remove(light)
        this.lamps.delete(id)
      }
    }

    // Add lights for new lamps (up to cap)
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
