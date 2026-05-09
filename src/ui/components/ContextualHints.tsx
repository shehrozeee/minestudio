import { useStore } from '../store'
import type { ToolId } from '../../engine/types'

interface HintRow {
  binding: string
  label: string
}

const HINTS_BY_TOOL: Record<ToolId, HintRow[]> = {
  place: [
    { binding: 'Click / RT', label: 'Place block' },
    { binding: 'RMB / LT / X', label: 'Delete block' },
    { binding: '1–9 / D-pad', label: 'Select hotbar slot' },
    { binding: 'Ctrl+Z / Back', label: 'Undo' },
  ],
  erase: [
    { binding: 'Click / RT', label: 'Erase block' },
    { binding: 'Ctrl+Z / Back', label: 'Undo' },
    { binding: 'P', label: 'Switch to paint' },
  ],
  paint: [
    { binding: 'Click / RT', label: 'Paint block' },
    { binding: 'Q / LB', label: 'Prev color' },
    { binding: 'E / RB', label: 'Next color' },
    { binding: 'P', label: 'Back to place' },
  ],
  eyedropper: [
    { binding: 'Click / RT', label: 'Sample color' },
    { binding: 'P', label: 'Back to place' },
  ],
  text: [
    { binding: 'Click / RT', label: 'Stamp text on face' },
    { binding: 'Esc / B', label: 'Cancel' },
  ],
  select: [
    { binding: 'Click / RT', label: 'Grab block' },
    { binding: 'G', label: 'Back to place' },
    { binding: 'Esc / B', label: 'Drop' },
  ],
  sink: [
    { binding: 'Hold RT', label: 'Push block in' },
    { binding: 'Scroll / D-pad', label: 'Adjust depth' },
    { binding: 'Release', label: 'Commit' },
  ],
  mate: [
    { binding: 'Click', label: 'Select connector A' },
    { binding: 'Click', label: 'Select connector B' },
    { binding: 'Esc', label: 'Cancel mate' },
  ],
  fillet: [
    { binding: 'Click / RT', label: 'Insert fillet at edge' },
    { binding: 'Ctrl+Z', label: 'Undo' },
  ],
  support: [
    { binding: 'Click / RT', label: 'Place support rod' },
    { binding: 'RMB / LT', label: 'Remove support' },
  ],
  measure: [
    { binding: 'Click / RT', label: 'Set point A' },
    { binding: 'Click / RT', label: 'Set point B → shows mm' },
    { binding: 'Esc', label: 'Clear measure' },
  ],
}

function HintChip({ binding, label }: HintRow) {
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
  const tool = useStore(s => s.selectedTool)
  const hints = HINTS_BY_TOOL[tool] ?? HINTS_BY_TOOL.place
  const shown = hints.slice(0, 4)  // max 4 per spec

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
      {shown.map((h, i) => <HintChip key={i} {...h} />)}
    </div>
  )
}
