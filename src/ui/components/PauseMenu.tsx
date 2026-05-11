import { useState, useEffect } from 'react'
import { useStore } from '../store'

interface SaveSlotMeta {
  name: string
  savedAt: number
}

type SlotData = SaveSlotMeta | null

function loadSlots(): SlotData[] {
  try {
    const raw = localStorage.getItem('minestudio_slots')
    if (!raw) return Array(5).fill(null)
    const parsed = JSON.parse(raw) as (SaveSlotMeta | null)[]
    // Ensure exactly 5 slots
    const result: SlotData[] = []
    for (let i = 0; i < 5; i++) {
      result.push(parsed[i] ?? null)
    }
    return result
  } catch {
    return Array(5).fill(null)
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function PauseMenu() {
  const pauseMenuOpen = useStore(s => s.pauseMenuOpen)
  const setPauseMenuOpen = useStore(s => s.setPauseMenuOpen)
  const setShowControls = useStore(s => s.setShowControls)

  const [slots, setSlots] = useState<SlotData[]>(Array(5).fill(null))

  useEffect(() => {
    if (pauseMenuOpen) {
      setSlots(loadSlots())
    }
  }, [pauseMenuOpen])

  useEffect(() => {
    if (!pauseMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleContinue()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pauseMenuOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pauseMenuOpen) return null

  const handleContinue = () => {
    setPauseMenuOpen(false)
    setTimeout(() => {
      const canvas = document.querySelector('canvas')
      if (canvas) canvas.requestPointerLock()
    }, 50)
  }

  const handleSave = (index: number) => {
    const name = window.prompt(`Save to Slot ${index + 1}:`, slots[index]?.name ?? `Slot ${index + 1}`)
    if (name === null) return
    window.dispatchEvent(new CustomEvent('minestudio:save-slot', { detail: { slot: index, name: name.trim() || `Slot ${index + 1}` } }))
    // Optimistic update
    const updated = [...slots]
    updated[index] = { name: name.trim() || `Slot ${index + 1}`, savedAt: Date.now() }
    setSlots(updated)
  }

  const handleLoad = (index: number) => {
    const slot = slots[index]
    if (!slot) return
    if (!window.confirm(`Load "${slot.name}"? Current build will be replaced.`)) return
    window.dispatchEvent(new CustomEvent('minestudio:load-slot', { detail: { slot: index } }))
    setPauseMenuOpen(false)
  }

  const handleControls = () => {
    setShowControls(true)
  }

  const handleExport = () => {
    setPauseMenuOpen(false)
    window.dispatchEvent(new CustomEvent('minestudio:open-export-dialog'))
  }

  const handleQuit = () => {
    if (window.confirm('Quit to browser? Unsaved progress will be lost.')) {
      window.location.reload()
    }
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 250,
    fontFamily: "'JetBrains Mono', monospace",
    color: '#f4f5f7',
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,15,18,0.97)',
    border: '1px solid #2a2f37',
    borderRadius: 14,
    padding: '32px 36px',
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
  }

  const btnBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid #2a2f37',
    borderRadius: 7,
    color: '#f4f5f7',
    cursor: 'pointer',
    fontSize: 12,
    padding: '8px 20px',
    fontFamily: 'inherit',
    width: '100%',
  }

  const saveBtnStyle: React.CSSProperties = {
    background: 'rgba(90,143,255,0.15)',
    border: '1px solid rgba(90,143,255,0.4)',
    borderRadius: 5,
    color: '#5a8fff',
    cursor: 'pointer',
    fontSize: 10,
    padding: '4px 10px',
    fontFamily: 'inherit',
    flexShrink: 0,
  }
  const loadBtnStyle: React.CSSProperties = {
    background: 'rgba(0,213,99,0.15)',
    border: '1px solid rgba(0,213,99,0.4)',
    borderRadius: 5,
    color: '#00d563',
    cursor: 'pointer',
    fontSize: 10,
    padding: '4px 10px',
    fontFamily: 'inherit',
    flexShrink: 0,
  }
  const loadBtnDisabledStyle: React.CSSProperties = {
    ...loadBtnStyle,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2f37',
    color: '#3a3f47',
    cursor: 'not-allowed',
  }

  return (
    <div style={panelStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
          MineStudio
        </div>

        <button onClick={handleContinue} style={{ ...btnBase, background: 'rgba(0,213,99,0.15)', border: '1px solid rgba(0,213,99,0.5)', color: '#00d563' }}>
          Continue
        </button>

        {/* Save slots */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ color: '#8b8f97', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>
            Saved Games
          </div>
          {slots.map((slot, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #2a2f37',
                borderRadius: 6,
                padding: '6px 10px',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: slot ? '#f4f5f7' : '#3a3f47', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {slot ? `${slot.name} · ${formatDate(slot.savedAt)}` : `Slot ${i + 1}: empty`}
              </span>
              <button
                onClick={() => slot && handleLoad(i)}
                disabled={!slot}
                style={slot ? loadBtnStyle : loadBtnDisabledStyle}
              >
                Load
              </button>
              <button onClick={() => handleSave(i)} style={saveBtnStyle}>
                Save
              </button>
            </div>
          ))}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          style={{ ...btnBase, background: 'rgba(255,159,64,0.12)', border: '1px solid rgba(255,159,64,0.4)', color: '#ff9f40' }}
        >
          Export 3D Print Files…
        </button>

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button onClick={handleControls} style={{ ...btnBase, width: 'auto', flex: 1 }}>
            Controls
          </button>
          <button
            onClick={handleQuit}
            style={{ ...btnBase, width: 'auto', flex: 1, background: 'rgba(255,64,64,0.1)', border: '1px solid rgba(255,64,64,0.3)', color: '#ff6060' }}
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  )
}
