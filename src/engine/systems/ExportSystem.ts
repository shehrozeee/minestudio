import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { BuildEngine } from '../BuildEngine'
import { toWorld, GRID_BASE, SIZE_IN_UNITS } from '../grid'
import { getBlockDef } from '../registries/blocks'

export class ExportSystem {
  private engine: BuildEngine
  private exporter = new STLExporter()

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    // Ctrl+Shift+E = export STL
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        this.exportSTL()
      }
    })
  }

  exportSTL(): void {
    const warnings = this.engine.validation.check()
    const errors = warnings.filter(w => w.type === 'error')
    if (errors.length > 0) {
      alert(`Export blocked:\n${errors.map(e => e.message).join('\n')}`)
      return
    }

    // Update store with warnings
    import('../../ui/store').then(({ useStore }) => {
      useStore.getState().setValidationWarnings(warnings)
    })

    const printable = this.engine.objects.filter(o => o.isPrintable && !o.isNegative)
    if (printable.length === 0) {
      alert('Nothing to export — place some blocks first.')
      return
    }

    // Build a merged scene with all printable blocks
    const exportScene = new THREE.Scene()
    for (const obj of printable) {
      const def = getBlockDef(obj.defId)
      if (!def) continue
      const unitSize = GRID_BASE * SIZE_IN_UNITS[obj.size]
      const geo = def.makeGeometry(unitSize)
      const mesh = new THREE.Mesh(geo)
      const wp = toWorld(obj.position)
      const half = unitSize / 2
      mesh.position.set(wp.x + half, wp.y + half, wp.z + half)
      mesh.rotation.x = (obj.rotation.x * Math.PI) / 180
      mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
      mesh.rotation.z = (obj.rotation.z * Math.PI) / 180
      exportScene.add(mesh)
    }

    const stl = this.exporter.parse(exportScene, { binary: false })
    const blob = new Blob([stl as string], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `minestudio_export_${Date.now()}.stl`
    a.click()
    URL.revokeObjectURL(url)
  }
}
