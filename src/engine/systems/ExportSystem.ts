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

/** Group all printable objects by plate, then by body. */
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

/** Build deduplicated filament palette (color → 1-based index). Index 0 reserved for "no paint". */
export function buildFilamentPalette(objects: PlacedObject[]): { palette: string[]; indexOf: (color: string) => number } {
  const palette: string[] = []
  const map = new Map<string, number>()
  for (const obj of objects) {
    const c = (obj.color || '#000000').toUpperCase()
    if (!map.has(c)) {
      palette.push(c)
      map.set(c, palette.length) // 1-based — 0 means "use base extruder, no paint"
    }
  }
  return { palette, indexOf: (color: string) => map.get((color || '#000000').toUpperCase()) ?? 1 }
}

// ─── 3MF static metadata ──────────────────────────────────────────────────

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="config" ContentType="text/plain"/>
</Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const MODEL_RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

// ─── Inner per-object .model XML (geometry + paint_color per triangle) ────

interface BuiltMesh {
  positions: number[]   // flat xyz triples, Z-up
  triangles: { v: [number, number, number]; paintColor: number }[]
}

/** Build mesh data for a single PlacedObject in world coords (Z-up), with paint indices per triangle. */
function buildMeshData(
  obj: PlacedObject,
  paintIndex: number,
): BuiltMesh | null {
  const def = getBlockDef(obj.defId)
  if (!def) return null
  const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
  const geo = def.makeGeometry(unitSize)

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
  const nonIndexed = transformed.index ? transformed.toNonIndexed() : transformed
  const posAttr = nonIndexed.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr) return null

  const positions: number[] = []
  const triangles: { v: [number, number, number]; paintColor: number }[] = []

  const triCount = posAttr.count / 3
  for (let t = 0; t < triCount; t++) {
    const base = t * 3
    const baseVtx = positions.length / 3
    for (let v = 0; v < 3; v++) {
      const x = posAttr.getX(base + v)
      const y = posAttr.getY(base + v)
      const z = posAttr.getZ(base + v)
      // Y-up → Z-up: (x, y, z) → (x, -z, y)
      positions.push(x, -z, y)
    }
    triangles.push({ v: [baseVtx, baseVtx + 1, baseVtx + 2], paintColor: paintIndex })
  }
  return { positions, triangles }
}

/** Merge multiple objects (same body) into one mesh, preserving per-triangle paint indices. */
function buildMergedMesh(
  objects: PlacedObject[],
  indexOfColor: (color: string) => number,
): BuiltMesh {
  const merged: BuiltMesh = { positions: [], triangles: [] }
  for (const obj of objects) {
    const paintIdx = indexOfColor(obj.color)
    const m = buildMeshData(obj, paintIdx)
    if (!m) continue
    const vtxOffset = merged.positions.length / 3
    for (const p of m.positions) merged.positions.push(p)
    for (const tri of m.triangles) {
      merged.triangles.push({
        v: [tri.v[0] + vtxOffset, tri.v[1] + vtxOffset, tri.v[2] + vtxOffset],
        paintColor: paintIdx,
      })
    }
  }
  return merged
}

/** Render an inner per-object .model XML. */
function renderInnerObjectModel(objectId: number, mesh: BuiltMesh): string {
  let verticesXML = ''
  for (let i = 0; i < mesh.positions.length; i += 3) {
    verticesXML += `      <vertex x="${mesh.positions[i].toFixed(4)}" y="${mesh.positions[i + 1].toFixed(4)}" z="${mesh.positions[i + 2].toFixed(4)}"/>\n`
  }
  let trianglesXML = ''
  for (const tri of mesh.triangles) {
    const pc = tri.paintColor.toString(16).toUpperCase().padStart(2, '0')
    trianglesXML += `      <triangle v1="${tri.v[0]}" v2="${tri.v[1]}" v3="${tri.v[2]}" paint_color="${pc}"/>\n`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
  <object id="${objectId}" type="model">
   <mesh>
    <vertices>
${verticesXML}    </vertices>
    <triangles>
${trianglesXML}    </triangles>
   </mesh>
  </object>
 </resources>
 <build/>
</model>`
}

/** Compute placement bbox (min/max XY in mm Z-up world coords) for a list of meshes. */
function computeBBox(meshes: BuiltMesh[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const m of meshes) {
    for (let i = 0; i < m.positions.length; i += 3) {
      const x = m.positions[i], y = m.positions[i + 1]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!isFinite(minX)) return [0, 0, 0, 0]
  return [minX, minY, maxX, maxY]
}

/** A1 build plate is 256mm. Center the plate's content there. */
const PLATE_BED_SIZE = 256

interface PlateExport {
  plateIdx: number       // 0-based source plate index
  plateNumber: number    // 1-based plate number for filenames
  objects: { id: number; bodyName: string; mesh: BuiltMesh; primaryColor: number }[]
  bbox: [number, number, number, number]  // bbox of all objects in this plate
}

// ─── Main 3MF builder ─────────────────────────────────────────────────────

interface BuildResult {
  modelXml: string
  innerModels: { name: string; xml: string }[]
  modelSettingsXml: string
  projectSettingsJson: string
  filamentSequenceJson: string
  plateJsons: { name: string; json: string }[]
  modelRels: string
}

function build3MFContents(
  objectsAllPlates: PlacedObject[],
  applicationName = 'MineStudio',
): BuildResult {
  // Build per-plate, per-body merged meshes. One <object> per body group.
  const { palette, indexOf } = buildFilamentPalette(objectsAllPlates)
  // Always at least one filament so Bambu Studio doesn't choke
  const filamentColours = palette.length > 0 ? palette : ['#FFFFFF']

  const byPlate = groupByPlateAndBody(objectsAllPlates)
  const plateNums = [...byPlate.keys()].sort((a, b) => a - b)

  const plateExports: PlateExport[] = []
  let nextObjectId = 1

  for (let i = 0; i < plateNums.length; i++) {
    const plateIdx = plateNums[i]
    const plate: PlateExport = {
      plateIdx,
      plateNumber: i + 1,
      objects: [],
      bbox: [0, 0, 0, 0],
    }
    const groups = byPlate.get(plateIdx)!
    for (const [bodyName, objs] of groups) {
      if (objs.length === 0) continue
      const mesh = buildMergedMesh(objs, indexOf)
      const primaryColor = indexOf(objs[0].color)
      plate.objects.push({ id: nextObjectId++, bodyName, mesh, primaryColor })
    }
    plate.bbox = computeBBox(plate.objects.map(o => o.mesh))
    plateExports.push(plate)
  }

  // Top-level 3dmodel.model — references each inner object via component
  let topObjects = ''
  let topBuild = ''
  for (const plate of plateExports) {
    for (const inner of plate.objects) {
      const wrapperId = inner.id + 1000  // wrapper object holds the component
      const innerPath = `/3D/Objects/object_${inner.id}.model`
      topObjects += `  <object id="${wrapperId}" type="model">
   <components>
    <component p:path="${innerPath}" objectid="${inner.id}"/>
   </components>
  </object>\n`
      // Center the bbox of this plate around the bed center
      const bbox = plate.bbox
      const cxOffset = (PLATE_BED_SIZE - (bbox[2] - bbox[0])) / 2 - bbox[0]
      const cyOffset = (PLATE_BED_SIZE - (bbox[3] - bbox[1])) / 2 - bbox[1]
      topBuild += `  <item objectid="${wrapperId}" transform="1 0 0 0 1 0 0 0 1 ${cxOffset.toFixed(3)} ${cyOffset.toFixed(3)} 0" printable="1"/>\n`
    }
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" unit="millimeter" xml:lang="en-US" requiredextensions="p" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
 <metadata name="Application">${applicationName}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
 <resources>
${topObjects} </resources>
 <build>
${topBuild} </build>
</model>`

  // Inner per-object .model files
  const innerModels: { name: string; xml: string }[] = []
  for (const plate of plateExports) {
    for (const inner of plate.objects) {
      innerModels.push({
        name: `3D/Objects/object_${inner.id}.model`,
        xml: renderInnerObjectModel(inner.id, inner.mesh),
      })
    }
  }

  // model_settings.config — object→extruder + per-plate listing
  let modelSettingsObjects = ''
  for (const plate of plateExports) {
    for (const inner of plate.objects) {
      const wrapperId = inner.id + 1000
      modelSettingsObjects += `  <object id="${wrapperId}">
    <metadata key="name" value="${inner.bodyName}"/>
    <metadata key="extruder" value="${inner.primaryColor}"/>
    <part id="${inner.id}" subtype="normal_part">
      <metadata key="name" value="${inner.bodyName}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="source_object_id" value="${inner.id - 1}"/>
      <metadata key="source_volume_id" value="0"/>
    </part>
  </object>\n`
    }
  }
  let modelSettingsPlates = ''
  for (const plate of plateExports) {
    let instances = ''
    for (const inner of plate.objects) {
      const wrapperId = inner.id + 1000
      instances += `    <model_instance>
      <metadata key="object_id" value="${wrapperId}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>\n`
    }
    const filamentMaps = filamentColours.map(() => '1').join(' ')
    modelSettingsPlates += `  <plate>
    <metadata key="plater_id" value="${plate.plateNumber}"/>
    <metadata key="plater_name" value="Plate ${plate.plateNumber}"/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_maps" value="${filamentMaps}"/>
${instances}  </plate>\n`
  }
  const modelSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${modelSettingsObjects}${modelSettingsPlates}</config>`

  // project_settings.config — minimal but with the filament colour array
  const projectSettings: Record<string, unknown> = {
    filament_colour: filamentColours,
    filament_settings_id: filamentColours.map(() => 'Generic PLA @BBL A1'),
    filament_type: filamentColours.map(() => 'PLA'),
    nozzle_diameter: ['0.4'],
    printer_settings_id: 'Bambu Lab A1 0.4 nozzle',
    printer_model: 'Bambu Lab A1',
    print_settings_id: '0.20mm Standard @BBL A1',
    version: '02.05.00.00',
  }
  const projectSettingsJson = JSON.stringify(projectSettings, null, 4)

  // filament_sequence.json — what AMS slots are required, in order
  const filamentSequenceJson = JSON.stringify(
    { filament_sequence: filamentColours.map((_c, i) => i + 1) },
    null, 4,
  )

  // plate_N.json — bbox + filament mapping per plate
  const plateJsons: { name: string; json: string }[] = []
  for (const plate of plateExports) {
    const bboxObjects = plate.objects.map((o, i) => {
      const m = o.mesh
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let j = 0; j < m.positions.length; j += 3) {
        const x = m.positions[j], y = m.positions[j + 1]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      return {
        area: 0,
        bbox: [minX, minY, maxX, maxY].map(v => isFinite(v) ? v : 0),
        id: o.id + i,
        layer_height: 0.2,
        name: o.bodyName,
      }
    })
    const plateJson = {
      bbox_all: plate.bbox,
      bbox_objects: bboxObjects,
      bed_type: 'textured_plate',
      filament_colors: filamentColours,
      filament_ids: filamentColours.map((_c, i) => i + 1),
      first_extruder: 0,
      is_seq_print: false,
      nozzle_diameter: 0.4,
      version: 2,
    }
    plateJsons.push({
      name: `Metadata/plate_${plate.plateNumber}.json`,
      json: JSON.stringify(plateJson),
    })
  }

  return {
    modelXml,
    innerModels,
    modelSettingsXml,
    projectSettingsJson,
    filamentSequenceJson,
    plateJsons,
    modelRels: MODEL_RELS_XML,
  }
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

  /** Export all printable objects across all plates as a single .3mf file. */
  async export3MF(objects: PlacedObject[], _bodies: BodyDef[]): Promise<void> {
    const printable = objects.filter(o => o.isPrintable && !o.isNegative)
    if (printable.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const built = build3MFContents(printable)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
    zip.folder('_rels')!.file('.rels', ROOT_RELS_XML)

    const dir3D = zip.folder('3D')!
    dir3D.file('3dmodel.model', built.modelXml)
    dir3D.folder('_rels')!.file('3dmodel.model.rels', built.modelRels)
    const dirObjects = dir3D.folder('Objects')!
    for (const inner of built.innerModels) {
      dirObjects.file(inner.name.split('/').pop()!, inner.xml)
    }

    const meta = zip.folder('Metadata')!
    meta.file('model_settings.config', built.modelSettingsXml)
    meta.file('project_settings.config', built.projectSettingsJson)
    meta.file('filament_sequence.json', built.filamentSequenceJson)
    for (const p of built.plateJsons) {
      meta.file(p.name.split('/').pop()!, p.json)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.3mf`)
  }

  // ── Pipeline ──────────────────────────────────────────────────────────

  async exportAll(format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'): Promise<void> {
    const state = this.engine.store.getState()
    const objects = state.objects
    const warnings = this.engine.validation.check(objects)
    const errors = warnings.filter(w => w.type === 'error')
    state.setValidationWarnings(warnings)
    if (errors.length > 0) {
      window.dispatchEvent(new CustomEvent('minestudio:show-validation-dialog'))
      return
    }
    await this._doExport(format, objects, state.bodyList)
  }

  async exportAnyway(format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'): Promise<void> {
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

  // ── STL exports ──────────────────────────────────────────────────────

  exportSTL(printableObjects?: PlacedObject[]): void {
    const objects = printableObjects ?? this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    if (!printableObjects) {
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

  /** Multi-body STL zip — one .stl per body group, named by bodyName. Multi-plate aware. */
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
        while (usedNames.has(`${baseKey}/${fileName}`)) {
          fileName = `${rawName}_${suffix++}`
        }
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
