import { useEffect, useRef, useState } from 'react'
import './App.css'
import { BuildEngine } from '../engine/BuildEngine'
import { useStore } from './store'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BuildEngine | null>(null)
  const [ready, setReady] = useState(false)

  const playerPosition = useStore(s => s.playerPosition)
  const objectCount = useStore(s => s.objectCount)
  const selectedTool = useStore(s => s.selectedTool)

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
          <div className="hud-top">
            <span>
              <span className="hud-label">XYZ</span>
              {playerPosition.gx * 2}mm, {playerPosition.gy * 2}mm, {playerPosition.gz * 2}mm
            </span>
            <span>
              <span className="hud-label">SHAPES</span>
              {objectCount}
            </span>
            <span>
              <span className="hud-label">TOOL</span>
              {selectedTool}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
