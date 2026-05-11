import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import JSZip from 'jszip'
import type { BuildEngine } from '../BuildEngine'
import type { BodyDef, PlacedObject } from '../types'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

// ─── Pure helpers (testable) ──────────────────────────────────────────────

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'body'
}

/** Group printable, non-negative objects by bodyName within a single plate. */
export function groupObjectsByBody(objects: PlacedObject[]): Map<string, PlacedObject[]> {
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

export function groupByPlateAndBody(
  objects: PlacedObject[],
): Map<number, Map<string, PlacedObject[]>> {
  const byPlate = new Map<number, PlacedObject[]>()
  for (const obj of objects) {
    if (!obj.isPrintable || obj.isNegative) continue
    const p = obj.plate ?? 0
    const arr = byPlate.get(p) ?? []
    arr.push(obj)
    byPlate.set(p, arr)
  }
  const result = new Map<number, Map<string, PlacedObject[]>>()
  for (const [plate, objs] of byPlate) result.set(plate, groupObjectsByBody(objs))
  return result
}

/** Group overlapping objects of the same color into one mesh cluster. */
function clusterByColor(objects: PlacedObject[]): PlacedObject[][] {
  // Group by color first; each color gets its own object so it can be
  // assigned a different material/extruder.
  const byColor = new Map<string, PlacedObject[]>()
  for (const obj of objects) {
    const c = (obj.color || '#000000').toUpperCase()
    const arr = byColor.get(c) ?? []
    arr.push(obj)
    byColor.set(c, arr)
  }
  return [...byColor.values()]
}

// ─── 3MF static metadata ──────────────────────────────────────────────────

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel-1" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

// ─── Mesh extraction ─────────────────────────────────────────────────────

interface ExtractedMesh {
  vertsXML: string   // XML lines for <vertex .../> tags
  trisXML: string    // XML lines for <triangle .../> tags
}

/** Extract one merged mesh's XML from a list of objects (their geometry merged). */
function buildMeshXML(objects: PlacedObject[]): ExtractedMesh {
  let vertsXML = ''
  let trisXML = ''
  let vOff = 0

  for (const obj of objects) {
    const def = getBlockDef(obj.defId)
    if (!def) continue
    const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
    const geo = def.makeGeometry(unitSize)

    // Apply position + rotation
    const tmp = new THREE.Mesh(geo)
    const wp = toWorld(obj.position)
    const half = unitSize / 2
    tmp.position.set(wp.x + half, wp.y + half, wp.z + half)
    tmp.rotation.x = (obj.rotation.x * Math.PI) / 180
    tmp.rotation.y = (obj.rotation.y * Math.PI) / 180
    tmp.rotation.z = (obj.rotation.z * Math.PI) / 180
    tmp.updateMatrixWorld(true)
    const transformed = geo.clone()
    transformed.applyMatrix4(tmp.matrixWorld)

    const pos = transformed.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!pos) continue

    // Vertices: Y-up → Z-up via (x, -z, y)
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k)
      vertsXML += `      <vertex x="${x.toFixed(4)}" y="${(-z).toFixed(4)}" z="${y.toFixed(4)}"/>\n`
    }

    // Triangles: REVERSED winding (v1, v3, v2) for Bambu compatibility after Y-up→Z-up
    const ix = transformed.getIndex()
    if (ix) {
      const ia = ix.array
      for (let k = 0; k < ia.length; k += 3) {
        trisXML += `      <triangle v1="${ia[k] + vOff}" v2="${ia[k + 2] + vOff}" v3="${ia[k + 1] + vOff}"/>\n`
      }
    } else {
      for (let k = 0; k < pos.count; k += 3) {
        trisXML += `      <triangle v1="${k + vOff}" v2="${k + 2 + vOff}" v3="${k + 1 + vOff}"/>\n`
      }
    }
    vOff += pos.count
  }

  return { vertsXML, trisXML }
}

// ─── 3MF builder (single-file structure that Bambu actually loads) ───────

interface ExportPlate {
  plateNumber: number  // 1-based
  // One <object> per (color cluster within body) so Bambu sees per-color objects
  meshes: { color: string; mesh: ExtractedMesh; bodyName: string }[]
}

function build3MFXml(objectsAllPlates: PlacedObject[]): string {
  const byPlate = groupByPlateAndBody(objectsAllPlates)
  const plateNums = [...byPlate.keys()].sort((a, b) => a - b)

  // Build deduped color palette across ALL plates (one basematerials list)
  const palette: string[] = []
  const colorIndex = new Map<string, number>()
  for (const objs of byPlate.values()) {
    for (const list of objs.values()) {
      for (const o of list) {
        const c = (o.color || '#000000').toUpperCase()
        if (!colorIndex.has(c)) {
          colorIndex.set(c, palette.length)
          palette.push(c)
        }
      }
    }
  }
  if (palette.length === 0) palette.push('#FFFFFF')

  // Build all per-plate, per-body, per-color clusters
  const plates: ExportPlate[] = []
  let nextOid = 2
  let objectsXml = ''
  let buildXml = ''

  for (let i = 0; i < plateNums.length; i++) {
    const plateNum = i + 1
    const groups = byPlate.get(plateNums[i])!
    const plateBucket: ExportPlate = { plateNumber: plateNum, meshes: [] }

    for (const [bodyName, bodyObjs] of groups) {
      const colorClusters = clusterByColor(bodyObjs)
      for (const cluster of colorClusters) {
        const color = (cluster[0].color || '#000000').toUpperCase()
        const mesh = buildMeshXML(cluster)
        if (!mesh.vertsXML || !mesh.trisXML) continue
        plateBucket.meshes.push({ color, mesh, bodyName })

        const oid = nextOid++
        const pindex = colorIndex.get(color) ?? 0
        objectsXml += `  <object id="${oid}" type="model" pid="1" pindex="${pindex}">
    <mesh>
      <vertices>
${mesh.vertsXML}      </vertices>
      <triangles>
${mesh.trisXML}      </triangles>
    </mesh>
  </object>
`
        // Identity transform — geometry is already in absolute world coords
        buildXml += `    <item objectid="${oid}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n`
      }
    }
    plates.push(plateBucket)
  }

  // basematerials: one <base> per filament color
  let materialsXml = ''
  for (let i = 0; i < palette.length; i++) {
    const hex = palette[i].replace('#', '').padStart(6, '0').toUpperCase()
    materialsXml += `    <base name="Color ${i + 1}" displaycolor="#${hex}FF"/>\n`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">MineStudio</metadata>
  <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
  <metadata name="Title">MineStudio Export</metadata>
  <resources>
    <basematerials id="1">
${materialsXml}    </basematerials>
${objectsXml}  </resources>
  <build>
${buildXml}  </build>
</model>`
}

// ─── ExportSystem class ───────────────────────────────────────────────────

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
        void this.exportSTLZip()
      }
    })
  }

  // ── STL helpers ────────────────────────────────────────────────────────
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

  // ── 3MF export ────────────────────────────────────────────────────────

  async export3MF(objects: PlacedObject[], _bodies: BodyDef[]): Promise<void> {
    const printable = objects.filter(o => o.isPrintable && !o.isNegative)
    if (printable.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const modelXml = build3MFXml(printable)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
    zip.folder('_rels')!.file('.rels', ROOT_RELS_XML)
    zip.folder('3D')!.file('3dmodel.model', modelXml)

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'model/3mf',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.3mf`)
  }

  // ── Pipeline ──────────────────────────────────────────────────────────

  async exportAll(format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'): Promise<void> {
    const state = this.engine.store.getState()
    const objects = this.engine.objects
    const warnings = this.engine.validation.check(objects)
    const errors = warnings.filter(w => w.type === 'error')
    state.setValidationWarnings(warnings)
    if (errors.length > 0) {
      window.dispatchEvent(new CustomEvent('minestudio:show-validation-dialog'))
      const proceed = window.confirm(
        `Export blocked by ${errors.length} error(s):\n\n${errors.map(e => '• ' + e.message).join('\n')}\n\nClick OK to export anyway, Cancel to fix first.`
      )
      if (!proceed) return
    }
    await this._doExport(format, objects, state.bodyList)
  }

  async exportAnyway(format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'): Promise<void> {
    const state = this.engine.store.getState()
    await this._doExport(format, this.engine.objects, state.bodyList)
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

  // ── STL exports ──────────────────────────────────────────────────────

  exportSTL(printableObjects?: PlacedObject[]): void {
    const objects = printableObjects ?? this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    if (objects.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }
    const scene = this.sceneForObjects(objects)
    const stl = this.stlExporter.parse(scene, { binary: false })
    this.downloadText(stl as string, `minestudio_export_${Date.now()}.stl`, 'text/plain')
  }

  async exportSTLZip(printableObjects?: PlacedObject[]): Promise<void> {
    const objects = printableObjects ?? this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    const byPlate = groupByPlateAndBody(objects)
    if (byPlate.size === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const zip = new JSZip()
    const plateNums = [...byPlate.keys()].sort((a, b) => a - b)
    const usedNames = new Set<string>()

    for (let i = 0; i < plateNums.length; i++) {
      const plateIdx = plateNums[i]
      const groups = byPlate.get(plateIdx)!
      const plateFolderName = plateNums.length > 1 ? `plate_${i + 1}` : ''
      const folder = plateFolderName ? zip.folder(plateFolderName)! : zip
      for (const [rawName, objs] of groups) {
        const baseKey = `${plateFolderName}/${rawName}`
        let fileName = rawName
        let suffix = 1
        while (usedNames.has(`${baseKey}/${fileName}`)) fileName = `${rawName}_${suffix++}`
        usedNames.add(`${baseKey}/${fileName}`)
        const scene = this.sceneForObjects(objs)
        const stl = this.stlExporter.parse(scene, { binary: false }) as string
        folder.file(`${fileName}.stl`, stl)
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.zip`)
  }

  // ── Download helpers ─────────────────────────────────────────────────

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
