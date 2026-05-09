import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import JSZip from 'jszip'
import type { BuildEngine } from '../BuildEngine'
import type { PlacedObject } from '../types'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

export class ExportSystem {
  private engine: BuildEngine
  private exporter = new STLExporter()

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

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'body'
  }

  // Groups printable non-negative objects by bodyName.
  // Objects without bodyName go into a "default" group.
  private groupByBody(objects: PlacedObject[]): Map<string, PlacedObject[]> {
    const groups = new Map<string, PlacedObject[]>()
    for (const obj of objects) {
      if (!obj.isPrintable || obj.isNegative) continue
      const key = obj.bodyName ? this.sanitizeName(obj.bodyName) : 'body'
      const arr = groups.get(key) ?? []
      arr.push(obj)
      groups.set(key, arr)
    }
    return groups
  }

  // Single-body STL — all printable objects merged into one file
  exportSTL(): void {
    const warnings = this.engine.validation.check()
    const errors = warnings.filter(w => w.type === 'error')
    if (errors.length > 0) {
      alert(`Export blocked:\n${errors.map(e => e.message).join('\n')}`)
      return
    }

    import('../../ui/store').then(({ useStore }) => {
      useStore.getState().setValidationWarnings(warnings)
    })

    const printable = this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    if (printable.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    const scene = this.sceneForObjects(printable)
    const stl = this.exporter.parse(scene, { binary: false })
    this.downloadText(stl as string, `minestudio_export_${Date.now()}.stl`, 'text/plain')
  }

  // Multi-body STL zip — one .stl per body group, named by bodyName
  async exportSTLZip(): Promise<void> {
    const warnings = this.engine.validation.check()
    const errors = warnings.filter(w => w.type === 'error')
    if (errors.length > 0) {
      alert(`Export blocked:\n${errors.map(e => e.message).join('\n')}`)
      return
    }

    import('../../ui/store').then(({ useStore }) => {
      useStore.getState().setValidationWarnings(warnings)
    })

    const groups = this.groupByBody(this.engine.objects)
    if (groups.size === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    if (groups.size === 1) {
      // Single body — just download the STL directly, no zip needed
      const [name, objects] = [...groups.entries()][0]
      const scene = this.sceneForObjects(objects)
      const stl = this.exporter.parse(scene, { binary: false })
      this.downloadText(stl as string, `${name}_${Date.now()}.stl`, 'text/plain')
      return
    }

    // Multiple bodies — zip them up
    const zip = new JSZip()
    const usedNames = new Set<string>()

    for (const [rawName, objects] of groups) {
      let fileName = rawName
      let suffix = 1
      while (usedNames.has(fileName)) {
        fileName = `${rawName}_${suffix++}`
      }
      usedNames.add(fileName)

      const scene = this.sceneForObjects(objects)
      const stl = this.exporter.parse(scene, { binary: false }) as string
      zip.file(`${fileName}.stl`, stl)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    this.downloadBlob(blob, `minestudio_export_${Date.now()}.zip`)
  }

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
