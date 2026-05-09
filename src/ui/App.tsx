import { useEffect, useRef, useState } from 'react'
import './App.css'
import { BuildEngine } from '../engine/BuildEngine'
import { Hotbar } from './components/Hotbar'
import { HUD } from './components/HUD'
import { ContextualHints } from './components/ContextualHints'
import { ToolRing } from './components/ToolRing'
import { ColorPicker } from './components/ColorPicker'
import { ControlsPage } from './components/ControlsPage'
import { BodyNamePanel } from './components/BodyNamePanel'
import { Inventory } from './components/Inventory'
import { ExportDialog } from './components/ExportDialog'
import { PauseMenu } from './components/PauseMenu'
import { BodyList } from './components/BodyList'
import { ImportPreview } from './components/ImportPreview'
import { useStore } from './store'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BuildEngine | null>(null)
  const [ready, setReady] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const showControls = useStore(s => s.showControls)
  const inventoryOpen = useStore(s => s.inventoryOpen)
  const pauseMenuOpen = useStore(s => s.pauseMenuOpen)
  const importPreviewObjects = useStore(s => s.importPreviewObjects)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new BuildEngine(canvasRef.current)
    engineRef.current = engine
    engine.init()
    setReady(true)

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyI') {
        e.preventDefault()
        engine.importSystem.triggerImport(engine)
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // Ctrl+Shift+E → open ExportDialog (intercept before ExportSystem's listener)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setExportDialogOpen(true)
      }
    }
    // Use capture so we can stop propagation before ExportSystem hears it
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Controls toggle + global Escape handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' || e.code === 'F1') {
        e.preventDefault()
        useStore.getState().setShowControls(!useStore.getState().showControls)
        return
      }

      if (e.key === 'Escape') {
        const state = useStore.getState()
        // Close overlays in priority order
        if (state.showControls) {
          state.setShowControls(false)
          return
        }
        if (state.inventoryOpen) {
          state.setInventoryOpen(false)
          return
        }
        if (state.ringOpen) {
          state.setRingOpen(false)
          return
        }
        // Toggle pause menu
        state.setPauseMenuOpen(!state.pauseMenuOpen)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleExport = (format: string) => {
    const engine = engineRef.current
    if (!engine) return
    const fmt = format as 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'
    void engine.exporter.exportAll(fmt)
  }

  return (
    <div className="app">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      {ready && (
        <div className="ui-overlay">
          <HUD engine={engineRef.current ?? undefined} />
          <ContextualHints />
          <Hotbar />
          <ToolRing />
          <ColorPicker />
          <BodyNamePanel />
          <BodyList />
          {importPreviewObjects && <ImportPreview />}
        </div>
      )}
      {showControls && <ControlsPage />}
      {inventoryOpen && <Inventory />}
      {pauseMenuOpen && <PauseMenu />}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
      />
    </div>
  )
}
