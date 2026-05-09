import { useStore } from '../store'
import { getBlockDef } from '../../engine/registries/blocks'
import type { BuildEngine } from '../../engine/BuildEngine'

export function HUD({ engine }: { engine?: BuildEngine }) {
  const pos = useStore(s => s.playerPosition)
  const tool = useStore(s => s.selectedTool)
  const size = useStore(s => s.selectedSize)
  const color = useStore(s => s.selectedColor)
  const count = useStore(s => s.objectCount)
  const undo = useStore(s => s.undoAvailable)
  const redo = useStore(s => s.redoAvailable)
  const fly = useStore(s => s.flyMode)
  const csg = useStore(s => s.csgPending)
  const negativeMode = useStore(s => s.negativeMode)
  const hotbarSlots = useStore(s => s.hotbarSlots)
  const selectedSlot = useStore(s => s.selectedSlot)
  const bodyList = useStore(s => s.bodyList)
  const warnings = useStore(s => s.validationWarnings)
  const def = getBlockDef(hotbarSlots[selectedSlot] ?? 'cube')

  const mm = (g: number) => `${Math.round(g * 2)}mm`
  const warnCount = warnings.filter(w => w.type === 'warning').length
  const errCount  = warnings.filter(w => w.type === 'error').length

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(13,15,18,0.75)',
      backdropFilter: 'blur(12px)',
      border: '1px solid #2a2f37',
      borderRadius: 12,
      padding: '8px 16px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      color: '#f4f5f7',
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      <span><span style={{ color: '#8b8f97' }}>XYZ </span>{mm(pos.gx)}, {mm(pos.gy)}, {mm(pos.gz)}</span>
      <span><span style={{ color: '#8b8f97' }}>TOOL </span>{tool}</span>
      <span><span style={{ color: '#8b8f97' }}>BLOCK </span>{def?.label ?? '?'} [{size}]</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#8b8f97' }}>COLOR </span>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid #444' }} />
      </span>
      <span><span style={{ color: '#8b8f97' }}>SHAPES </span>{count}</span>
      {bodyList.length > 0 && (
        <span><span style={{ color: '#8b8f97' }}>BODIES </span>{bodyList.length}</span>
      )}
      {fly && <span style={{ color: '#4da6ff' }}>FLY</span>}
      {negativeMode && <span style={{ color: '#ff4040' }}>NEG</span>}
      {csg && (
        <span
          title="Ctrl+Shift+B — bake CSG preview"
          onClick={() => engine && void engine.csg.bakePreview()}
          style={{ color: '#ff9f40', cursor: engine ? 'pointer' : 'default', pointerEvents: engine ? 'auto' : 'none' }}
        >
          CSG⏳
        </span>
      )}
      {errCount > 0 && (
        <span title={`${errCount} export error(s)`} style={{ color: '#ff4040' }}>⛔{errCount}</span>
      )}
      {warnCount > 0 && errCount === 0 && (
        <span title={`${warnCount} floating block warning(s)`} style={{ color: '#ff9f40' }}>⚠{warnCount}</span>
      )}
      <span style={{ color: undo ? '#00d563' : '#3a3f47' }}>↩</span>
      <span style={{ color: redo ? '#00d563' : '#3a3f47' }}>↪</span>
    </div>
  )
}
