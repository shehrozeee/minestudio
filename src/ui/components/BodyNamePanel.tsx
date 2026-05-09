import { useRef, useEffect, useState } from 'react'
import { useStore } from '../store'

export function BodyNamePanel() {
  const selectedObjectId = useStore(s => s.selectedObjectId)
  const setSelectedObjectId = useStore(s => s.setSelectedObjectId)
  const objects = useStore(s => s.objects)
  const selectedObj = selectedObjectId !== null
    ? objects.find(o => String(o.id) === selectedObjectId)
    : undefined

  const [value, setValue] = useState(selectedObj?.bodyName ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(selectedObj?.bodyName ?? '')
    if (selectedObjectId !== null) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [selectedObjectId])

  if (selectedObjectId === null) return null

  const updateName = useStore.getState().updateObjectBodyName

  const confirm = () => {
    if (selectedObjectId !== null) {
      const id = Number(selectedObjectId)
      if (!isNaN(id)) {
        updateName(id, value.trim() || undefined)
      }
    }
    setSelectedObjectId(null)
  }

  const cancel = () => setSelectedObjectId(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirm()
    if (e.key === 'Escape') cancel()
    e.stopPropagation()
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      right: 16,
      background: 'rgba(13,15,18,0.92)',
      border: '1px solid #2a2f37',
      borderRadius: 10,
      padding: '12px 16px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      color: '#f4f5f7',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 200,
    }}>
      <span style={{ color: '#8b8f97', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Body Name
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Unnamed"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid #2a2f37',
          borderRadius: 6,
          color: '#f4f5f7',
          fontFamily: 'inherit',
          fontSize: 13,
          padding: '6px 8px',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={cancel}
          style={{
            background: 'transparent',
            border: '1px solid #2a2f37',
            borderRadius: 5,
            color: '#8b8f97',
            cursor: 'pointer',
            fontSize: 11,
            padding: '4px 10px',
          }}
        >
          Esc
        </button>
        <button
          onClick={confirm}
          style={{
            background: 'rgba(90,143,255,0.2)',
            border: '1px solid rgba(90,143,255,0.4)',
            borderRadius: 5,
            color: '#5a8fff',
            cursor: 'pointer',
            fontSize: 11,
            padding: '4px 10px',
          }}
        >
          Enter
        </button>
      </div>
    </div>
  )
}
