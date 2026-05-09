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
        maxWidth: 800,
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
          {/* Left column */}
          <div>
            <Section title="Movement — Keyboard">
              <Row keys="WASD / Arrows" label="Walk / strafe" />
              <Row keys="Space / R" label="Fly up" />
              <Row keys="Ctrl / F" label="Fly down" />
              <Row keys="0 0" label="Toggle fly mode" />
              <Row keys="Scroll" label="Cycle hotbar slot" />
            </Section>

            <Section title="Building — Keyboard">
              <Row keys="LClick" label="Place block" />
              <Row keys="RClick / X" label="Delete block" />
              <Row keys="[ ]" label="Size smaller / larger" />
              <Row keys="Q / E" label="Prev / next color" />
              <Row keys="P" label="Toggle paint mode" />
              <Row keys="N" label="Toggle negative mode" />
              <Row keys="G" label="Grab / move tool" />
              <Row keys="T (hold)" label="Tool ring" />
            </Section>

            <Section title="Inventory / UI">
              <Row keys="Tab" label="Open / close inventory" />
              <Row keys="1–9" label="Select hotbar slot" />
              <Row keys="F1 / ?" label="Controls reference" />
              <Row keys="Esc" label="Close overlays" />
            </Section>

            <Section title="Undo / Save / Export">
              <Row keys="Ctrl+Z" label="Undo" />
              <Row keys="Ctrl+⇧Z" label="Redo" />
              <Row keys="Ctrl+S" label="Save .minstudio" />
              <Row keys="Ctrl+⇧E" label="Export STL zip (by body)" />
              <Row keys="Ctrl+⇧B" label="Bake CSG preview" />
              <Row keys="Ctrl+I" label="Import STL / GLB" />
            </Section>
          </div>

          {/* Right column */}
          <div>
            <Section title="Xbox Controller">
              <Row keys="L stick" label="Walk / strafe" />
              <Row keys="R stick" label="Look" />
              <Row keys="RT" label="Place block (primary)" />
              <Row keys="LT" label="Delete block (always)" />
              <Row keys="A" label="Toggle fly mode" />
              <Row keys="B B" label="Double-tap — toggle fly" />
              <Row keys="X" label="Next color" />
              <Row keys="Y" label="Cycle block size" />
              <Row keys="LB / RB (fly)" label="Descend / ascend" />
              <Row keys="LB / RB (walk)" label="Prev / next hotbar" />
              <Row keys="D-pad ←→" label="Cycle hotbar slot" />
              <Row keys="D-pad ↑" label="Open inventory" />
              <Row keys="D-pad ↓" label="Block size smaller" />
              <Row keys="Back" label="Undo" />
              <Row keys="Start" label="Controls page" />
            </Section>

            <Section title="Tools">
              <Row keys="place" label="Place selected block" />
              <Row keys="erase" label="Remove aimed block" />
              <Row keys="paint" label="Color block / face" />
              <Row keys="eyedropper" label="Sample color" />
              <Row keys="text" label="Emboss / deboss text" />
              <Row keys="select" label="Grab + reposition" />
              <Row keys="sink" label="Push block into adjacent" />
              <Row keys="mate" label="Link compatible connectors" />
              <Row keys="fillet" label="Auto-insert corner fillet" />
              <Row keys="support" label="Manual support rod" />
              <Row keys="measure" label="MM distance between points" />
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
