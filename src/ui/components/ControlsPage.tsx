import { useStore } from '../store'

const KEY_STYLE: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'monospace',
  fontSize: 12,
  minWidth: 28,
  textAlign: 'center',
}

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={KEY_STYLE}>{keys}</span>
      <span style={{ color: '#c8cad0', fontSize: 12 }}>{label}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: '#5a8fff',
        textTransform: 'uppercase',
        marginBottom: 10,
        borderBottom: '1px solid rgba(90,143,255,0.25)',
        paddingBottom: 4,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export function ControlsPage() {
  const setShowControls = useStore(s => s.setShowControls)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#f4f5f7',
    }}>
      <div style={{
        background: 'rgba(13,15,18,0.95)',
        border: '1px solid #2a2f37',
        borderRadius: 16,
        padding: '32px 40px',
        maxWidth: 720,
        width: '90vw',
        maxHeight: '85vh',
        overflowY: 'auto',
        position: 'relative',
      }}>
        <button
          onClick={() => setShowControls(false)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid #2a2f37',
            borderRadius: 6,
            color: '#f4f5f7',
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 10px',
          }}
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em' }}>
          Controls Reference
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <Section title="Movement">
            <Row keys="WASD" label="Move" />
            <Row keys="Space" label="Jump" />
            <Row keys="0 0" label="Toggle fly mode" />
          </Section>

          <Section title="Building">
            <Row keys="LClick" label="Place block" />
            <Row keys="RClick" label="Delete block" />
            <Row keys="X" label="Erase aimed" />
            <Row keys="[ ]" label="Size cycle" />
          </Section>

          <Section title="View">
            <Row keys="Mouse" label="Look" />
            <Row keys="F1 / ?" label="This screen" />
          </Section>

          <Section title="Colors / Tools">
            <Row keys="Q / E" label="Color cycle" />
            <Row keys="P" label="Paint mode" />
            <Row keys="N" label="Negative mode" />
            <Row keys="T" label="Tool ring" />
          </Section>

          <Section title="Undo / Save">
            <Row keys="Ctrl+Z" label="Undo" />
            <Row keys="Ctrl+⇧Z" label="Redo" />
          </Section>

          <Section title="Export">
            <Row keys="Ctrl+S" label="Save .minstudio" />
            <Row keys="Ctrl+⇧E" label="Export STL" />
            <Row keys="Ctrl+⇧B" label="Bake CSG preview" />
            <Row keys="Ctrl+I" label="Import STL/GLB" />
          </Section>
        </div>
      </div>
    </div>
  )
}
