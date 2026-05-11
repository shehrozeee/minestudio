import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { ToolId } from '../../engine/types'

const TOOLS: ToolId[] = [
  'place', 'erase', 'paint', 'eyedropper',
  'select', 'sink', 'mate', 'fillet',
  'support', 'measure', 'text', 'place',
]

const TOOL_DESCRIPTIONS: Record<ToolId, string> = {
  place:       'Place selected block from hotbar',
  erase:       'Remove aimed block',
  paint:       'Color block (RT) or face (Shift+LMB)',
  eyedropper:  'Sample color from block',
  text:        'Emboss/deboss text on face',
  select:      'Grab and reposition a block',
  sink:        'Push block into adjacent block',
  mate:        'Link compatible connectors',
  fillet:      'Auto-insert fillet at shared edge',
  support:     'Place/remove manual support rod',
  measure:     'Show mm distance between points',
}

export function ToolRing() {
  const ringOpen = useStore(s => s.ringOpen)
  const setRingOpen = useStore(s => s.setRingOpen)
  const setTool = useStore(s => s.setTool)
  const activeTool = useStore(s => s.selectedTool)
  const hoveredIdx = useStore(s => s.ringHoverIdx)
  const setRingHoverIdx = useStore(s => s.setRingHoverIdx)
  const angleRef = useRef<number | null>(null)

  useEffect(() => {
    // T key hold/tap is handled in InputSystem — ring closing on T up is handled here
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyT') {
        const idx = useStore.getState().ringHoverIdx
        if (idx !== null) {
          const tool = TOOLS[idx]
          if (tool) setTool(tool)
        }
        setRingOpen(false)
        setRingHoverIdx(null)
        angleRef.current = null
      }
    }
    document.addEventListener('keyup', onUp)
    return () => {
      document.removeEventListener('keyup', onUp)
    }
  }, [setRingOpen, setTool, setRingHoverIdx])

  useEffect(() => {
    if (!ringOpen) {
      setRingHoverIdx(null)
      return
    }
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx)
      angleRef.current = angle
      const idx = Math.round(((angle / (Math.PI * 2)) * 12 + 12)) % 12
      setRingHoverIdx(idx)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [ringOpen, setRingHoverIdx])

  if (!ringOpen) return null

  const hoveredTool = hoveredIdx !== null ? TOOLS[hoveredIdx] : null
  const centerTool = hoveredTool ?? activeTool
  const centerDescription = TOOL_DESCRIPTIONS[centerTool] ?? ''

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
          const isHovered = hoveredIdx === i
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <span style={{
                fontSize: isHovered ? 11 : 10,
                color: isHovered ? '#ffffff' : '#c8cdd5',
                fontFamily: 'monospace',
                fontWeight: isHovered ? 'bold' : 'normal',
                background: isHovered ? 'rgba(80,130,200,0.25)' : 'transparent',
                padding: isHovered ? '1px 4px' : '0',
                borderRadius: 3,
              }}>{tool}</span>
              {isHovered && (
                <span style={{
                  fontSize: 8,
                  color: '#8ab4f8',
                  fontFamily: 'monospace',
                  marginTop: 2,
                  maxWidth: 80,
                  textWrap: 'wrap' as never,
                  lineHeight: 1.2,
                }}>{TOOL_DESCRIPTIONS[tool]}</span>
              )}
            </div>
          )
        })}
        {/* Center: active or hovered tool + description */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: 4,
          maxWidth: 80,
          textAlign: 'center',
        }}>
          <span style={{ color: '#ffffff', fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }}>
            {centerTool}
          </span>
          <span style={{ color: '#8b8f97', fontSize: 8, fontFamily: 'monospace', lineHeight: 1.3 }}>
            {centerDescription}
          </span>
        </div>
      </div>
    </div>
  )
}
