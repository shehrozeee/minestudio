import { useStore } from '../store'

const PLACE_HINTS = [
  { binding: 'Click', label: 'Place block' },
  { binding: 'RMB / X', label: 'Delete block' },
  { binding: '1–9', label: 'Select hotbar slot' },
  { binding: 'Ctrl+Z', label: 'Undo' },
]

export function ContextualHints() {
  const tool = useStore(s => s.selectedTool)
  void tool // will be used to switch hint sets in Phase 4C

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      pointerEvents: 'none',
    }}>
      {PLACE_HINTS.map(h => (
        <div key={h.binding} style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: 11,
          fontFamily: 'monospace',
        }}>
          <span style={{
            background: 'rgba(13,15,18,0.8)',
            border: '1px solid #3a3f47',
            borderRadius: 4,
            padding: '1px 6px',
            color: '#c8cdd5',
            fontSize: 10,
          }}>{h.binding}</span>
          <span style={{ color: 'rgba(200,205,213,0.7)' }}>{h.label}</span>
        </div>
      ))}
    </div>
  )
}
