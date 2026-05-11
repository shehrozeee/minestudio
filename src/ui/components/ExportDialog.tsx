import { useState, useEffect } from 'react'

type ExportFormat = '3mf-all' | '3mf-selected' | 'stl-zip' | 'stl-selected'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (format: ExportFormat) => void
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: '3mf-all', label: '3MF — All bodies' },
  { id: '3mf-selected', label: '3MF — Selected body' },
  { id: 'stl-zip', label: 'STL ZIP — All bodies' },
  { id: 'stl-selected', label: 'STL — Selected body' },
]

export function ExportDialog({ open, onClose, onExport }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('stl-zip')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedFormat(cur => {
          const i = FORMAT_OPTIONS.findIndex(o => o.id === cur)
          return FORMAT_OPTIONS[(i + 1) % FORMAT_OPTIONS.length].id
        })
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedFormat(cur => {
          const i = FORMAT_OPTIONS.findIndex(o => o.id === cur)
          return FORMAT_OPTIONS[(i - 1 + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length].id
        })
      }
      if (e.key === 'Enter') { e.preventDefault(); onExport(selectedFormat); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, onExport, selectedFormat])

  if (!open) return null

  const handleExport = () => {
    onExport(selectedFormat)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'rgba(13,15,18,0.98)',
        border: '1px solid #2a2f37',
        borderRadius: 12,
        padding: '24px 28px',
        minWidth: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#f4f5f7',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.05em' }}>
          Export
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FORMAT_OPTIONS.map(opt => (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 12,
                color: selectedFormat === opt.id ? '#f4f5f7' : '#8b8f97',
              }}
            >
              <input
                type="radio"
                name="export-format"
                value={opt.id}
                checked={selectedFormat === opt.id}
                onChange={() => setSelectedFormat(opt.id)}
                style={{ accentColor: '#00d563', cursor: 'pointer' }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #2a2f37',
              borderRadius: 6,
              color: '#8b8f97',
              cursor: 'pointer',
              fontSize: 11,
              padding: '7px 16px',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              background: 'rgba(0,213,99,0.15)',
              border: '1px solid rgba(0,213,99,0.5)',
              borderRadius: 6,
              color: '#00d563',
              cursor: 'pointer',
              fontSize: 11,
              padding: '7px 16px',
              fontFamily: 'inherit',
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
