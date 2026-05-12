import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

// Lazy-loaded three-bvh-csg handles. Set once at init.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Evaluator = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Brush = any

export type CsgPreviewListener = (mesh: THREE.Mesh | null) => void

export class CSGSystem {
  private engine: BuildEngine
  private evaluator: Evaluator | null = null
  private BrushCtor: Brush | null = null
  private SUBTRACTION_OP: number | null = null
  private ADDITION_OP: number | null = null
  private ready = false
  private loadingPromise: Promise<void> | null = null

  private rebuildTimer: ReturnType<typeof setTimeout> | null = null
  private rebuildSerial = 0
  private listener: CsgPreviewListener | null = null

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    // Pre-load three-bvh-csg in the background so the first carve doesn't block.
    void this.ensureLoaded()

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        this.scheduleRebuild(0)
      }
    })
  }

  onPreview(listener: CsgPreviewListener): void {
    this.listener = listener
  }

  isReady(): boolean {
    return this.ready
  }

  private async ensureLoaded(): Promise<void> {
    if (this.ready) return
    if (this.loadingPromise) return this.loadingPromise
    this.loadingPromise = (async () => {
      // @ts-ignore — three-bvh-csg may not have bundled types
      const csg = await import('three-bvh-csg')
      this.evaluator = new csg.Evaluator()
      this.evaluator.useGroups = false
      this.BrushCtor = csg.Brush
      this.SUBTRACTION_OP = csg.SUBTRACTION
      this.ADDITION_OP = csg.ADDITION
      this.ready = true
    })()
    return this.loadingPromise
  }

  /** AABB cell-grid overlap test (ignores rotation — conservative). */
  aabbIntersects(a: PlacedObject, b: PlacedObject): boolean {
    const aSize = SIZE_IN_UNITS[a.size]
    const bSize = SIZE_IN_UNITS[b.size]
    return !(
      a.position.gx + aSize <= b.position.gx ||
      b.position.gx + bSize <= a.position.gx ||
      a.position.gy + aSize <= b.position.gy ||
      b.position.gy + bSize <= a.position.gy ||
      a.position.gz + aSize <= b.position.gz ||
      b.position.gz + bSize <= a.position.gz
    )
  }

  /** Schedule a debounced preview rebuild. Pass 0 for immediate. */
  scheduleRebuild(delayMs = 250): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer)
      this.rebuildTimer = null
    }
    const ms = Math.max(0, delayMs)
    this.engine.store.setState({ csgPending: true })
    const runIt = () => {
      this.rebuildTimer = null
      void this.runRebuild()
    }
    if (ms === 0) runIt()
    else this.rebuildTimer = setTimeout(runIt, ms)
  }

  private buildBrush(obj: PlacedObject): Brush | null {
    if (!this.BrushCtor) return null
    const def = getBlockDef(obj.defId)
    if (!def) return null
    const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
    const geo = def.makeGeometry(unitSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brush = new (this.BrushCtor as any)(geo)
    const wp = toWorld(obj.position)
    const half = unitSize / 2
    brush.position.set(wp.x + half, wp.y + half, wp.z + half)
    brush.rotation.x = (obj.rotation.x * Math.PI) / 180
    brush.rotation.y = (obj.rotation.y * Math.PI) / 180
    brush.rotation.z = (obj.rotation.z * Math.PI) / 180
    brush.updateMatrixWorld()
    return brush
  }

  private async runRebuild(): Promise<void> {
    const serial = ++this.rebuildSerial
    await this.ensureLoaded()
    // A newer rebuild was scheduled while we waited — drop this one.
    if (serial !== this.rebuildSerial) return

    const positives = this.engine.objects.filter(o => !o.isNegative && o.isPrintable)
    const negatives = this.engine.objects.filter(o => o.isNegative)

    // Nothing to carve — emit null so the renderer falls back to per-block rendering.
    if (negatives.length === 0 || positives.length === 0) {
      this.engine.store.setState({ csgPending: false })
      this.listener?.(null)
      return
    }

    try {
      // Union the positives
      let result: Brush | null = null
      for (const obj of positives) {
        const brush = this.buildBrush(obj)
        if (!brush) continue
        if (!result) {
          result = brush
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = (this.evaluator as any).evaluate(result, brush, this.ADDITION_OP)
        }
      }
      if (!result) {
        this.engine.store.setState({ csgPending: false })
        this.listener?.(null)
        return
      }
      // Subtract negatives
      for (const obj of negatives) {
        const brush = this.buildBrush(obj)
        if (!brush) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (this.evaluator as any).evaluate(result, brush, this.SUBTRACTION_OP)
      }

      // Build a renderable mesh. The Brush IS a Mesh subclass; clone its geometry
      // into a fresh mesh so we don't accidentally re-use it in subsequent rebuilds.
      const geo = (result as THREE.Mesh).geometry.clone()
      const mat = new THREE.MeshStandardMaterial({
        color: 0xc8cdd5,
        roughness: 0.7,
        metalness: 0.0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData['isCsgPreview'] = true

      this.engine.store.setState({ csgPending: false })
      this.listener?.(mesh)
    } catch (err) {
      console.warn('[MineStudio] CSG rebuild failed:', err)
      this.engine.store.setState({ csgPending: false })
      this.listener?.(null)
    }
  }

  /** Synchronous, full-scene bake — used by ExportSystem before writing 3MF/STL. */
  async bakePreview(): Promise<THREE.Mesh[]> {
    await this.ensureLoaded()
    const positives = this.engine.objects.filter(o => !o.isNegative && o.isPrintable)
    const negatives = this.engine.objects.filter(o => o.isNegative)
    if (positives.length === 0) return []

    let result: Brush | null = null
    for (const obj of positives) {
      const brush = this.buildBrush(obj)
      if (!brush) continue
      if (!result) result = brush
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else result = (this.evaluator as any).evaluate(result, brush, this.ADDITION_OP)
    }
    if (!result) return []
    for (const obj of negatives) {
      const brush = this.buildBrush(obj)
      if (!brush) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = (this.evaluator as any).evaluate(result, brush, this.SUBTRACTION_OP)
    }
    this.engine.store.setState({ csgPending: false })
    return [result as THREE.Mesh]
  }

  /**
   * Per-positive carve: returns a geometry for `positive` with all overlapping
   * negatives subtracted. Returns null if not ready or nothing to subtract.
   */
  async carveOne(
    positive: PlacedObject,
    negatives: PlacedObject[],
  ): Promise<THREE.BufferGeometry | null> {
    await this.ensureLoaded()
    const overlapping = negatives.filter(n => this.aabbIntersects(positive, n))
    if (overlapping.length === 0) return null
    let result: Brush | null = this.buildBrush(positive)
    if (!result) return null
    for (const neg of overlapping) {
      const brush = this.buildBrush(neg)
      if (!brush) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = (this.evaluator as any).evaluate(result, brush, this.SUBTRACTION_OP)
    }
    // CSG result is in world coordinates. Transform geometry back into local
    // space (relative to the positive's mesh transform) so the rest of the
    // renderer/exporter can place/rotate the result like any other block.
    const inv = new THREE.Matrix4()
    const tmp = new THREE.Mesh()
    const def = getBlockDef(positive.defId)
    if (def) {
      const unitSize = GRID_BASE * SIZE_IN_UNITS[positive.size]
      const wp = toWorld(positive.position)
      const half = unitSize / 2
      tmp.position.set(wp.x + half, wp.y + half, wp.z + half)
      tmp.rotation.x = (positive.rotation.x * Math.PI) / 180
      tmp.rotation.y = (positive.rotation.y * Math.PI) / 180
      tmp.rotation.z = (positive.rotation.z * Math.PI) / 180
      tmp.updateMatrixWorld()
      inv.copy(tmp.matrixWorld).invert()
    }
    const geo = (result as THREE.Mesh).geometry.clone()
    geo.applyMatrix4(inv)
    return geo
  }

  dispose(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer)
      this.rebuildTimer = null
    }
    this.listener = null
  }
}
