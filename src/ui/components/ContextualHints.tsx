import { useStore } from '../store'
import { HINT_REGISTRY } from '../../engine/registries/hints'

interface HintRow {
  icon: string
  binding: string
  label: string
}

function HintChip({ icon: _icon, binding, label }: HintRow) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, fontFamily: 'monospace' }}>
      <span style={{
        background: 'rgba(13,15,18,0.85)',
        border: '1px solid #3a3f47',
        borderRadius: 4,
        padding: '1px 6px',
        color: '#c8cdd5',
        fontSize: 10,
        whiteSpace: 'nowrap',
      }}>{binding}</span>
      <span style={{ color: 'rgba(200,205,213,0.7)' }}>{label}</span>
    </div>
  )
}

export function ContextualHints() {
  const state = useStore(s => s)
  const activeHints = HINT_REGISTRY
    .filter(h => h.condition(state))
    .flatMap(h => h.hints)
    .slice(0, 4)

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
      {activeHints.map((h, i) => <HintChip key={i} icon={h.icon} binding={h.binding} label={h.label} />)}
    </div>
  )
}
