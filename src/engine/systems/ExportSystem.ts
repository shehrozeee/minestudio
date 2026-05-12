import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import JSZip from 'jszip'
import type { BuildEngine } from '../BuildEngine'
import type { BodyDef, PlacedObject } from '../types'
import { SIZE_IN_UNITS } from '../grid'
import { COLORS } from '../registries/colors'
import type { CSGSystem } from './CSGSystem'

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

/** Two grid AABBs are connected if they share a face OR overlap volumetrically. */
export function aabbConnected(a: PlacedObject, b: PlacedObject): boolean {
  const aS = SIZE_IN_UNITS[a.size]
  const bS = SIZE_IN_UNITS[b.size]
  const ax1 = a.position.gx, ax2 = a.position.gx + aS
  const ay1 = a.position.gy, ay2 = a.position.gy + aS
  const az1 = a.position.gz, az2 = a.position.gz + aS
  const bx1 = b.position.gx, bx2 = b.position.gx + bS
  const by1 = b.position.gy, by2 = b.position.gy + bS
  const bz1 = b.position.gz, bz2 = b.position.gz + bS
  // Closed-interval overlap on every axis (touching counts).
  return ax2 >= bx1 && bx2 >= ax1
      && ay2 >= by1 && by2 >= ay1
      && az2 >= bz1 && bz2 >= az1
}

/**
 * Partition a list of blocks into connected components by face/edge adjacency.
 * Each component is a maximal set of blocks reachable by AABB touching.
 */
export function connectedComponents(blocks: PlacedObject[]): PlacedObject[][] {
  const n = blocks.length
  if (n === 0) return []
  // Build adjacency lists. O(n^2) — fine for plate-scale (low hundreds).
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (aabbConnected(blocks[i], blocks[j])) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }
  const seen = new Array<boolean>(n).fill(false)
  const components: PlacedObject[][] = []
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue
    const comp: PlacedObject[] = []
    const stack: number[] = [i]
    while (stack.length) {
      const k = stack.pop()!
      if (seen[k]) continue
      seen[k] = true
      comp.push(blocks[k])
      for (const m of adj[k]) if (!seen[m]) stack.push(m)
    }
    components.push(comp)
  }
  return components
}

// ─── 3MF static metadata ──────────────────────────────────────────────────

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/plain"/>
  <Default Extension="json" ContentType="application/json"/>
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

/**
 * Extract 3MF vertices+triangles from a single pre-built world-space mesh
 * (e.g. the output of CSGSystem.unionAndCarve — already in absolute coords,
 * already CSG-unioned and CSG-carved). Y-up → Z-up + reversed winding for
 * Bambu compatibility.
 */
function buildMeshXMLFromWorldMesh(mesh: THREE.Mesh): ExtractedMesh {
  let vertsXML = ''
  let trisXML = ''
  mesh.updateMatrixWorld(true)
  const transformed = (mesh.geometry as THREE.BufferGeometry).clone()
  transformed.applyMatrix4(mesh.matrixWorld)
  const pos = transformed.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return { vertsXML: '', trisXML: '' }

  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k)
    vertsXML += `      <vertex x="${x.toFixed(4)}" y="${(-z).toFixed(4)}" z="${y.toFixed(4)}"/>\n`
  }
  const ix = transformed.getIndex()
  if (ix) {
    const ia = ix.array
    for (let k = 0; k < ia.length; k += 3) {
      trisXML += `      <triangle v1="${ia[k]}" v2="${ia[k + 2]}" v3="${ia[k + 1]}"/>\n`
    }
  } else {
    for (let k = 0; k < pos.count; k += 3) {
      trisXML += `      <triangle v1="${k}" v2="${k + 2}" v3="${k + 1}"/>\n`
    }
  }
  return { vertsXML, trisXML }
}

// ─── 3MF builder (single-file structure that Bambu actually loads) ───────

interface ExportPlate {
  plateNumber: number  // 1-based
  // One <object> per (color cluster within body) so Bambu sees per-color objects
  meshes: { color: string; mesh: ExtractedMesh; bodyName: string }[]
}

interface BuildArtifacts {
  modelXml: string
  modelSettingsXml: string
  projectSettingsJson: string
}

/**
 * Build palette ordered by canonical COLOR_REGISTRY index, then by hex for
 * any non-registry colors. This makes the AMS slot mapping stable per color
 * across exports — slot N is always the same color in your scenes.
 *
 * Exported so the HUD can render the same mapping users will get in Bambu.
 */
export function buildPalette(objectsAllPlates: PlacedObject[]): { palette: string[]; colorIndex: Map<string, number> } {
  const usedColors = new Set<string>()
  for (const o of objectsAllPlates) {
    usedColors.add((o.color || '#000000').toUpperCase())
  }
  const registryOrder = new Map<string, number>()
  for (let i = 0; i < COLORS.length; i++) {
    registryOrder.set(COLORS[i].hex.toUpperCase(), i)
  }
  const sorted = [...usedColors].sort((a, b) => {
    const ai = registryOrder.get(a) ?? Number.MAX_SAFE_INTEGER
    const bi = registryOrder.get(b) ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return a.localeCompare(b)
  })
  const palette = sorted.length > 0 ? sorted : ['#FFFFFF']
  const colorIndex = new Map<string, number>()
  for (let i = 0; i < palette.length; i++) colorIndex.set(palette[i], i)
  return { palette, colorIndex }
}

async function build3MFXml(
  objectsAllPlates: PlacedObject[],
  csg: CSGSystem,
  allNegatives: PlacedObject[],
): Promise<BuildArtifacts> {
  const byPlate = groupByPlateAndBody(objectsAllPlates)
  const plateNums = [...byPlate.keys()].sort((a, b) => a - b)

  const { palette, colorIndex } = buildPalette(objectsAllPlates)

  // Build all per-plate, per-body, per-color, per-connected-component meshes.
  const plates: ExportPlate[] = []
  let nextOid = 2
  let objectsXml = ''
  let buildXml = ''
  // Track each emitted <object>'s id and AMS slot for model_settings.config
  const emittedObjects: { oid: number; extruder: number; bodyName: string }[] = []

  for (let i = 0; i < plateNums.length; i++) {
    const plateNum = i + 1
    const groups = byPlate.get(plateNums[i])!
    const plateBucket: ExportPlate = { plateNumber: plateNum, meshes: [] }

    for (const [bodyName, bodyObjs] of groups) {
      const colorClusters = clusterByColor(bodyObjs)
      for (const cluster of colorClusters) {
        const color = (cluster[0].color || '#000000').toUpperCase()
        // Connected components: each becomes a single fused solid in 3MF.
        const components = connectedComponents(cluster)
        for (const comp of components) {
          const worldMesh = await csg.unionAndCarve(comp, allNegatives)
          if (!worldMesh) continue
          const mesh = buildMeshXMLFromWorldMesh(worldMesh)
          if (!mesh.vertsXML || !mesh.trisXML) continue
          plateBucket.meshes.push({ color, mesh, bodyName })

          const oid = nextOid++
          const pindex = colorIndex.get(color) ?? 0
          const extruder = pindex + 1  // AMS slots are 1-based in Bambu Studio
          emittedObjects.push({ oid, extruder, bodyName })
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
    }
    plates.push(plateBucket)
  }

  // basematerials: one <base> per filament color
  let materialsXml = ''
  for (let i = 0; i < palette.length; i++) {
    const hex = palette[i].replace('#', '').padStart(6, '0').toUpperCase()
    materialsXml += `    <base name="Color ${i + 1}" displaycolor="#${hex}FF"/>\n`
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
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

  // Bambu Studio reads filament assignment from model_settings.config (per-object
  // <metadata key="extruder" value="N"/>) and the actual color list from
  // project_settings.config "filament_colour".
  let modelSettingsObjects = ''
  for (const o of emittedObjects) {
    modelSettingsObjects += `  <object id="${o.oid}">
    <metadata key="name" value="${o.bodyName}"/>
    <metadata key="extruder" value="${o.extruder}"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${o.bodyName}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="source_object_id" value="${o.oid}"/>
      <metadata key="source_volume_id" value="0"/>
    </part>
  </object>
`
  }
  // Single plate listing — instances reference each emitted object
  let plateInstances = ''
  for (const o of emittedObjects) {
    plateInstances += `    <model_instance>
      <metadata key="object_id" value="${o.oid}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
`
  }
  const filamentMaps = palette.map((_, i) => i + 1).join(' ')
  const modelSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${modelSettingsObjects}  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1"/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_maps" value="${filamentMaps}"/>
${plateInstances}  </plate>
</config>`

  // project_settings.config — filament_colour drives the AMS slot colors
  const projectSettings: Record<string, unknown> = {
    filament_colour: palette,
    filament_settings_id: palette.map(() => 'Generic PLA @BBL A1'),
    filament_type: palette.map(() => 'PLA'),
    nozzle_diameter: ['0.4'],
    printer_settings_id: 'Bambu Lab A1 0.4 nozzle',
    printer_model: 'Bambu Lab A1',
    print_settings_id: '0.20mm Standard @BBL A1',
    version: '02.05.00.00',
  }
  const projectSettingsJson = JSON.stringify(projectSettings, null, 4)

  return { modelXml, modelSettingsXml, projectSettingsJson }
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

  /**
   * Build a scene where each connected component of same-color blocks is
   * CSG-unioned into one solid mesh (with overlapping negatives carved).
   * The STL output is then a bag of fused solids, not adjacent cubes.
   */
  private async sceneFromUnions(
    objects: PlacedObject[],
    allObjects: PlacedObject[],
  ): Promise<THREE.Scene> {
    const negatives = allObjects.filter(o => o.isNegative)
    const scene = new THREE.Scene()
    const byPlate = groupByPlateAndBody(objects)
    for (const [, groups] of byPlate) {
      for (const [, bodyObjs] of groups) {
        for (const cluster of clusterByColor(bodyObjs)) {
          for (const comp of connectedComponents(cluster)) {
            const mesh = await this.engine.csg.unionAndCarve(comp, negatives)
            if (mesh) scene.add(mesh)
          }
        }
      }
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
    const negatives = objects.filter(o => o.isNegative)

    // Each connected component (same-color same-body adjacent blocks) is
    // CSG-unioned into a single solid mesh, with overlapping negatives carved
    // out at the same time. Bambu Studio then sees one watertight <object>
    // per component — splittable, paintable, AMS-routable.
    const built = await build3MFXml(printable, this.engine.csg, negatives)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
    zip.folder('_rels')!.file('.rels', ROOT_RELS_XML)
    zip.folder('3D')!.file('3dmodel.model', built.modelXml)
    const meta = zip.folder('Metadata')!
    meta.file('model_settings.config', built.modelSettingsXml)
    meta.file('project_settings.config', built.projectSettingsJson)

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
      await this.exportSTL(printable)
    } else {
      await this.exportSTLZip(printable)
    }
  }

  // ── STL exports ──────────────────────────────────────────────────────

  async exportSTL(printableObjects?: PlacedObject[]): Promise<void> {
    const objects = printableObjects ?? this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    if (objects.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }
    // CSG-union per connected component + carve overlapping negatives.
    const scene = await this.sceneFromUnions(objects, this.engine.objects)
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
    const negatives = this.engine.objects.filter(o => o.isNegative)

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
        // Build a scene of unioned-then-carved meshes for this body.
        const scene = new THREE.Scene()
        for (const cluster of clusterByColor(objs)) {
          for (const comp of connectedComponents(cluster)) {
            const mesh = await this.engine.csg.unionAndCarve(comp, negatives)
            if (mesh) scene.add(mesh)
          }
        }
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
