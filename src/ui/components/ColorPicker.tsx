import { useStore } from '../store'
import { COLORS } from '../../engine/registries/colors'

export function ColorPicker() {
  const selectedColor = useStore(s => s.selectedColor)
  const setColor = useStore(s => s.setColor)
  const selectedTool = useStore(s => s.selectedTool)

  return (
    <div style={{
      position: 'absolute',
      right: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      background: 'rgba(13,15,18,0.75)',
      border: '1px solid #2a2f37',
      borderRadius: 10,
      padding: 8,
      pointerEvents: 'all',
    }}>
      <div style={{ fontSize: 9, color: '#8b8f97', fontFamily: 'monospace', textAlign: 'center', marginBottom: 2 }}>
        COLOR
      </div>
      {COLORS.map(c => (
        <div
          key={c.hex}
          onClick={() => { setColor(c.hex) }}
          title={c.name}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: c.hex,
            border: c.hex === selectedColor
              ? '2px solid #00d563'
              : '2px solid transparent',
            cursor: 'pointer',
            boxShadow: c.hex === selectedColor ? '0 0 6px #00d56380' : 'none',
            opacity: selectedTool === 'paint' ? 1 : 0.7,
          }}
        />
      ))}
      <div style={{ fontSize: 9, color: '#8b8f97', fontFamily: 'monospace', textAlign: 'center', marginTop: 2 }}>
        Q/E
      </div>
    </div>
  )
}
