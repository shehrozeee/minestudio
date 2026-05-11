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
  const exportDialogOpen = useStore(s => s.exportDialogOpen)
  const setExportDialogOpen = useStore(s => s.setExportDialogOpen)
  const [showStartScreen, setShowStartScreen] = useState(true)
  const [gamepadConnected, setGamepadConnected] = useState(false)

  useEffect(() => {
    const onStarted = () => setShowStartScreen(false)
    const onConnect = () => setGamepadConnected(true)
    const onDisconnect = () => setGamepadConnected(
      Array.from(navigator.getGamepads?.() ?? []).some(p => p?.connected)
    )
    window.addEventListener('minestudio:started', onStarted)
    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    return () => {
      window.removeEventListener('minestudio:started', onStarted)
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  const showControls = useStore(s => s.showControls)
  const inventoryOpen = useStore(s => s.inventoryOpen)
  const pauseMenuOpen = useStore(s => s.pauseMenuOpen)
  const importPreviewObjects = useStore(s => s.importPreviewObjects)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new BuildEngine(canvasRef.current)
    engineRef.current = engine
    engine.init()
    if (typeof window !== 'undefined') (window as unknown as { __engine: BuildEngine }).__engine = engine
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
    const onOpenExport = () => setExportDialogOpen(true)
    window.addEventListener('minestudio:open-export-dialog', onOpenExport)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('minestudio:open-export-dialog', onOpenExport)
    }
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
      {showStartScreen && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 50, userSelect: 'none',
        }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 3, marginBottom: 12 }}>MineStudio</div>
          {gamepadConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, opacity: 0.9 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%',
                background: '#4caf50', color: '#fff', fontWeight: 700, fontSize: 16,
              }}>A</span>
              <span>Press A to play</span>
            </div>
          ) : (
            <div style={{ fontSize: 18, opacity: 0.9 }}>Click anywhere to play</div>
          )}
          <div style={{ fontSize: 13, opacity: 0.45, marginTop: 10 }}>ESC to pause · ? for controls</div>
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
