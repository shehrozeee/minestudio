import { useState } from 'react'
import { useStore } from '../store'

export function BodyList() {
  const bodyList = useStore(s => s.bodyList)
  const objects = useStore(s => s.objects)
  const updateObjectBodyName = useStore(s => s.updateObjectBodyName)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  if (bodyList.length === 0) return null

  const startEdit = (bodyId: string, currentLabel: string) => {
    setEditingId(bodyId)
    setEditValue(currentLabel)
  }

  const confirmEdit = (bodyId: string) => {
    const body = bodyList.find(b => b.id === bodyId)
    if (!body) { setEditingId(null); return }
    const trimmed = editValue.trim()
    for (const objId of body.objectIds) {
      const obj = objects.find(o => o.id === objId)
      if (obj) {
        updateObjectBodyName(objId, trimmed || undefined)
      }
    }
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      right: 16,
      background: 'rgba(13,15,18,0.92)',
      border: '1px solid #2a2f37',
      borderRadius: 10,
      padding: '12px 14px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      color: '#f4f5f7',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 220,
      maxWidth: 280,
      maxHeight: 240,
    }}>
      <div style={{ color: '#8b8f97', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
        Bodies
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {bodyList.map(body => {
          const count = body.objectIds.length
          const isEditing = editingId === body.id

          return (
            <div
              key={body.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #2a2f37',
                borderRadius: 6,
                padding: '5px 8px',
              }}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(body.id) }
                    if (e.key === 'Escape') cancelEdit()
                    e.stopPropagation()
                  }}
                  onBlur={() => confirmEdit(body.id)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid #5a8fff',
                    borderRadius: 4,
                    color: '#f4f5f7',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    padding: '2px 6px',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c8cdd5' }}>
                  {body.label} <span style={{ color: '#8b8f97' }}>({count})</span>
                </span>
              )}

              {!isEditing && (
                <button
                  onClick={() => startEdit(body.id, body.label)}
                  title="Rename body"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b8f97',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '1px 4px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ✏
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
