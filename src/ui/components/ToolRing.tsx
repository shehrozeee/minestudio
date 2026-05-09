import { useEffect, useRef } from 'react'
import { useStore } from '../store'

const TOOLS = [
  'place', 'erase', 'paint', 'eyedropper',
  'select', 'sink', 'mate', 'fillet',
  'support', 'measure', 'text', 'place',
] as const

export function ToolRing() {
  const ringOpen = useStore(s => s.ringOpen)
  const setRingOpen = useStore(s => s.setRingOpen)
  const setTool = useStore(s => s.setTool)
  const angleRef = useRef<number | null>(null)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !e.repeat) setRingOpen(true, 'tools')
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') {
        if (angleRef.current !== null) {
          const idx = Math.round(((angleRef.current / (Math.PI * 2)) * 12 + 12)) % 12
          const tool = TOOLS[idx]
          if (tool) setTool(tool)
        }
        setRingOpen(false)
        angleRef.current = null
      }
    }
    document.addEventListener('keydown', onDown)
    document.addEventListener('keyup', onUp)
    return () => {
      document.removeEventListener('keydown', onDown)
      document.removeEventListener('keyup', onUp)
    }
  }, [setRingOpen, setTool])

  useEffect(() => {
    if (!ringOpen) return
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      angleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [ringOpen])

  if (!ringOpen) return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 280,
        height: 280,
        borderRadius: '50%',
        background: 'rgba(13,15,18,0.85)',
        border: '1px solid #3a3f47',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {TOOLS.slice(0, 12).map((tool, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
          const r = 100
          const x = Math.cos(angle) * r
          const y = Math.sin(angle) * r
          return (
            <span key={i} style={{
              position: 'absolute',
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              fontSize: 10,
              color: '#c8cdd5',
              fontFamily: 'monospace',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>{tool}</span>
          )
        })}
        <span style={{ color: '#8b8f97', fontSize: 11, fontFamily: 'monospace' }}>TOOLS</span>
      </div>
    </div>
  )
}
