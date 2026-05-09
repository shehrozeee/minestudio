import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import JSZip from 'jszip'
import type { BuildEngine } from '../BuildEngine'
import type { BodyDef, PlacedObject } from '../types'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

// ---------------------------------------------------------------------------
// Pure helper — exported for testing without DOM/Three dependency
// ---------------------------------------------------------------------------

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'body'
}

/**
 * Groups printable non-negative objects by their bodyName.
 * Objects with no bodyName are placed in the "body" group.
 */
export function groupObjectsByBody(
  objects: PlacedObject[],
): Map<string, PlacedObject[]> {
  const groups = new Map<string, PlacedObject[]>()
  for (const obj of objects) {
    if (!obj.isPrintable || obj.isNegative) continue
    const key = obj.bodyName ? sanitizeName(obj.bodyName) : 'body'
    const arr = groups.get(key) ?? []
    arr.push(obj)
    groups.set(key, arr)
  }
  return groups
}

// ---------------------------------------------------------------------------
// 3MF XML builders
// ---------------------------------------------------------------------------

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

/**
 * Build a merged BufferGeometry for a group of PlacedObjects.
 * The geometry is already in world coordinates.
 */
function buildMergedGeometry(objects: PlacedObject[]): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  for (const obj of objects) {
    const def = getBlockDef(obj.defId)
    if (!def) continue

    const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
    const geo = def.makeGeometry(unitSize)

    // Build a mesh to apply transformations and update the geometry
    const mesh = new THREE.Mesh(geo)
    const wp = toWorld(obj.position)
    const half = unitSize / 2
    mesh.position.set(wp.x + half, wp.y + half, wp.z + half)
    mesh.rotation.x = (obj.rotation.x * Math.PI) / 180
    mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
    mesh.rotation.z = (obj.rotation.z * Math.PI) / 180
    mesh.updateMatrixWorld(true)

    // Apply the world matrix to the geometry to get final positions
    const transformedGeo = geo.clone()
    transformedGeo.applyMatrix4(mesh.matrixWorld)

    // Ensure non-indexed geometry for simplicity
    const nonIndexed = transformedGeo.index
      ? transformedGeo.toNonIndexed()
      : transformedGeo

    const posAttr = nonIndexed.getAttribute('position') as THREE.BufferAttribute
    if (!posAttr) continue

    const triCount = posAttr.count / 3
    for (let t = 0; t < triCount; t++) {
      const base = t * 3
      for (let v = 0; v < 3; v++) {
        // Convert Three.js Y-up → 3MF Z-up: (x, y, z) → (x, -z, y)
        const x = posAttr.getX(base + v)
        const y = posAttr.getY(base + v)
        const z = posAttr.getZ(base + v)
        positions.push(x, -z, y)
      }
      indices.push(
        vertexOffset + base,
        vertexOffset + base + 1,
        vertexOffset + base + 2,
      )
    }
    vertexOffset += posAttr.count
  }

  // Return a simple container (not actually used as Three geo — just carries data)
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  result.setIndex(indices)
  return result
}

/**
 * Convert a merged geometry to 3MF model XML.
 * Assumes the geometry has been built with buildMergedGeometry (coords already Z-up).
 */
function geometryToModelXML(
  groups: Map<string, PlacedObject[]>,
): string {
  let objectsXML = ''
  let buildXML = ''
  let objectId = 1

  for (const [name, objects] of groups) {
    if (objects.length === 0) continue

    const geo = buildMergedGeometry(objects)
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const indexAttr = geo.getIndex()
    if (!posAttr || !indexAttr) continue

    let verticesXML = ''
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i).toFixed(4)
      const y = posAttr.getY(i).toFixed(4)
      const z = posAttr.getZ(i).toFixed(4)
      verticesXML += `          <vertex x="${x}" y="${y}" z="${z}"/>\n`
    }

    let trianglesXML = ''
    const idxArr = indexAttr.array
    for (let i = 0; i < idxArr.length; i += 3) {
      trianglesXML += `          <triangle v1="${idxArr[i]}" v2="${idxArr[i + 1]}" v3="${idxArr[i + 2]}"/>\n`
    }

    objectsXML += `    <object id="${objectId}" type="model" name="${name}">\n`
    objectsXML += `      <mesh>\n`
    objectsXML += `        <vertices>\n${verticesXML}        </vertices>\n`
    objectsXML += `        <triangles>\n${trianglesXML}        </triangles>\n`
    objectsXML += `      </mesh>\n`
    objectsXML += `    </object>\n`

    buildXML += `    <item objectid="${objectId}"/>\n`
    objectId++
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${objectsXML}  </resources>
  <build>
${buildXML}  </build>
</model>`
}

// ---------------------------------------------------------------------------
// ExportSystem class
// ---------------------------------------------------------------------------

export class ExportSystem {
  private engine: BuildEngine
  private stlExporter = new STLExporter()

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        this.exportSTLZip()
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Internal mesh builder (for STL)
  // ---------------------------------------------------------------------------

  private buildMeshForObject(obj: PlacedObject): THREE.Mesh | null {
    const def = getBlockDef(obj.defId)
    if (!def) return null
    const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
    const geo = def.makeGeometry(unitSize)
    const mesh = new THREE.Mesh(geo)
    const wp = toWorld(obj.position)
    const half = unitSize / 2
    mesh.position.set(wp.x + half, wp.y + half, wp.z + half)
    mesh.rotation.x = (obj.rotation.x * Math.PI) / 180
    mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
    mesh.rotation.z = (obj.rotation.z * Math.PI) / 180
    return mesh
  }

  private sceneForObjects(objects: PlacedObject[]): THREE.Scene {
    const scene = new THREE.Scene()
    for (const obj of objects) {
      const mesh = this.buildMeshForObject(obj)
      if (mesh) scene.add(mesh)
    }
    return scene
  }

  // ---------------------------------------------------------------------------
  // Legacy body grouping (used by STL exports)
  // ---------------------------------------------------------------------------

  private groupByBody(objects: PlacedObject[]): Map<string, PlacedObject[]> {
    return groupObjectsByBody(objects)
  }

  // ---------------------------------------------------------------------------
  // 3MF export
  // ---------------------------------------------------------------------------

  /** Export all printable objects as a single .3mf file. */
  async export3MF(objects: PlacedObject[], _bodies: BodyDef[]): Promise<void> {
    const groups = groupObjectsByBody(objects)
    if (groups.size === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const modelXML = geometryToModelXML(groups)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
    zip.folder('_rels')!.file('.rels', RELS_XML)
    zip.folder('3D')!.file('3dmodel.model', modelXML)

    const blob = await zip.generateAsync({ type: 'blob' })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.3mf`)
  }

  // ---------------------------------------------------------------------------
  // Full export pipeline
  // ---------------------------------------------------------------------------

  /**
   * Run the full export pipeline:
   * 1. Validate (blocks if errors)
   * 2. Filter non-printable
   * 3. Export in chosen format
   *
   * If there are hard errors, dispatches `minestudio:show-validation-dialog`
   * and stores warnings in the UI store, then returns without exporting.
   */
  async exportAll(
    format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected',
  ): Promise<void> {
    const state = this.engine.store.getState()
    const objects = state.objects

    const warnings = this.engine.validation.check(objects)
    const errors = warnings.filter(w => w.type === 'error')

    // Always surface warnings in the UI store
    state.setValidationWarnings(warnings)

    if (errors.length > 0) {
      window.dispatchEvent(new CustomEvent('minestudio:show-validation-dialog'))
      return
    }

    await this._doExport(format, objects, state.bodyList)
  }

  /**
   * Export without running validation — used by [Export anyway] button.
   */
  async exportAnyway(
    format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected',
  ): Promise<void> {
    const state = this.engine.store.getState()
    await this._doExport(format, state.objects, state.bodyList)
  }

  private async _doExport(
    format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected',
    objects: PlacedObject[],
    bodies: BodyDef[],
  ): Promise<void> {
    const printable = objects.filter(o => o.isPrintable && !o.isNegative)

    if (printable.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    if (format === '3mf-all' || format === '3mf-selected') {
      await this.export3MF(printable, bodies)
    } else if (format === 'stl-all') {
      this.exportSTL(printable)
    } else {
      await this.exportSTLZip(printable)
    }
  }

  // ---------------------------------------------------------------------------
  // STL exports
  // ---------------------------------------------------------------------------

  /** Single-body STL — all printable objects merged into one file. */
  exportSTL(printableObjects?: PlacedObject[]): void {
    const objects = printableObjects ?? this.engine.objects.filter(o => o.isPrintable && !o.isNegative)

    if (!printableObjects) {
      // When called standalone, run validation first
      const warnings = this.engine.validation.check()
      const errors = warnings.filter(w => w.type === 'error')
      if (errors.length > 0) {
        alert(`Export blocked:\n${errors.map(e => e.message).join('\n')}`)
        return
      }
      import('../../ui/store').then(({ useStore }) => {
        useStore.getState().setValidationWarnings(warnings)
      })
    }

    if (objects.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const scene = this.sceneForObjects(objects)
    const stl = this.stlExporter.parse(scene, { binary: false })
    this.downloadText(stl as string, `minestudio_export_${Date.now()}.stl`, 'text/plain')
  }

  /** Multi-body STL zip — one .stl per body group, named by bodyName. */
  async exportSTLZip(printableObjects?: PlacedObject[]): Promise<void> {
    let objects: PlacedObject[]

    if (printableObjects) {
      objects = printableObjects
    } else {
      const warnings = this.engine.validation.check()
      const errors = warnings.filter(w => w.type === 'error')
      if (errors.length > 0) {
        alert(`Export blocked:\n${errors.map(e => e.message).join('\n')}`)
        return
      }
      import('../../ui/store').then(({ useStore }) => {
        useStore.getState().setValidationWarnings(warnings)
      })
      objects = this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    }

    const groups = this.groupByBody(objects)
    if (groups.size === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    if (groups.size === 1) {
      const [name, objs] = [...groups.entries()][0]
      const scene = this.sceneForObjects(objs)
      const stl = this.stlExporter.parse(scene, { binary: false })
      this.downloadText(stl as string, `${name}_${Date.now()}.stl`, 'text/plain')
      return
    }

    const zip = new JSZip()
    const usedNames = new Set<string>()

    for (const [rawName, objs] of groups) {
      let fileName = rawName
      let suffix = 1
      while (usedNames.has(fileName)) {
        fileName = `${rawName}_${suffix++}`
      }
      usedNames.add(fileName)

      const scene = this.sceneForObjects(objs)
      const stl = this.stlExporter.parse(scene, { binary: false }) as string
      zip.file(`${fileName}.stl`, stl)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.zip`)
  }

  // ---------------------------------------------------------------------------
  // Download helpers
  // ---------------------------------------------------------------------------

  private downloadText(text: string, filename: string, mimeType: string): void {
    const blob = new Blob([text], { type: mimeType })
    this.downloadBlob(blob, filename)
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
