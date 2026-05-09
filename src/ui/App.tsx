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
import { useStore } from './store'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BuildEngine | null>(null)
  const [ready, setReady] = useState(false)
  const showControls = useStore(s => s.showControls)

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' || e.code === 'F1') {
        e.preventDefault()
        useStore.getState().setShowControls(!useStore.getState().showControls)
      }
      if (e.key === 'Escape' && useStore.getState().showControls) {
        useStore.getState().setShowControls(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
        </div>
      )}
      {showControls && <ControlsPage />}
    </div>
  )
}
