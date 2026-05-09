import { useEffect } from 'react'
import { useStore } from '../store'
import { getBlockDef } from '../../engine/registries/blocks'

export function Hotbar() {
  const hotbarSlots = useStore(s => s.hotbarSlots)
  const selectedSlot = useStore(s => s.selectedSlot)
  const setHotbarSlot = useStore(s => s.setHotbarSlot)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.code.match(/^Digit([1-9])$/)
      if (m) setHotbarSlot(parseInt(m[1]) - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setHotbarSlot])

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      background: 'rgba(13,15,18,0.75)',
      border: '1px solid #2a2f37',
      borderRadius: 10,
      padding: '6px 8px',
      pointerEvents: 'none',
    }}>
      {hotbarSlots.map((defId, i) => {
        const def = getBlockDef(defId)
        const active = i === selectedSlot
        return (
          <div key={i} style={{
            width: 52,
            height: 52,
            border: active ? '2px solid #00d563' : '2px solid #3a3f47',
            borderRadius: 6,
            background: active ? 'rgba(0,213,99,0.12)' : 'rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}>
            <span style={{ fontSize: 9, color: '#8b8f97', fontFamily: 'monospace' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 10, color: active ? '#00d563' : '#c8cdd5', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.1 }}>
              {def?.label ?? '?'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
