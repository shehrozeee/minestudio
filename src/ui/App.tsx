import { useEffect, useRef, useState } from 'react'
import './App.css'
import { BuildEngine } from '../engine/BuildEngine'
import { Hotbar } from './components/Hotbar'
import { HUD } from './components/HUD'
import { ContextualHints } from './components/ContextualHints'
import { ToolRing } from './components/ToolRing'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BuildEngine | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new BuildEngine(canvasRef.current)
    engineRef.current = engine
    engine.init()
    setReady(true)
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return (
    <div className="app">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      {ready && (
        <div className="ui-overlay">
          <HUD />
          <ContextualHints />
          <Hotbar />
          <ToolRing />
        </div>
      )}
    </div>
  )
}
