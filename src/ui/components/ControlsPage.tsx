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
          {/* Left column — keyboard / mouse */}
          <div>
            <Section title="Movement — Keyboard">
              <Row keys="WASD / Arrows" label="Walk / strafe" />
              <Row keys="Mouse" label="Look" />
              <Row keys="Space" label="Fly up (in fly mode)" />
              <Row keys="Ctrl / F" label="Fly down (in fly mode)" />
              <Row keys="0 0" label="Toggle fly mode" />
              <Row keys="Scroll" label="Cycle hotbar slot" />
            </Section>

            <Section title="Building — Keyboard">
              <Row keys="LClick" label="Place block" />
              <Row keys="RClick / X" label="Delete block" />
              <Row keys="[ ]" label="Block size — / +" />
              <Row keys="Q / E" label="Prev / next color" />
              <Row keys="R" label="Rotate yaw (Y axis)" />
              <Row keys="Shift+R" label="Rotate pitch (X axis)" />
              <Row keys="Ctrl+R" label="Rotate roll (Z axis)" />
              <Row keys="P" label="Toggle paint mode" />
              <Row keys="N" label="Toggle negative mode" />
              <Row keys="G" label="Grab / move tool" />
              <Row keys="T (hold)" label="Tool ring" />
            </Section>

            <Section title="Plates / Inventory / UI">
              <Row keys="Ctrl+1..9" label="Switch plate" />
              <Row keys="Ctrl+=" label="Add new plate" />
              <Row keys="Tab" label="Open / close inventory" />
              <Row keys="1–9" label="Select hotbar slot" />
              <Row keys="F1 / ?" label="Controls reference" />
              <Row keys="Esc" label="Pause menu / close overlay" />
            </Section>

            <Section title="Undo / Save / Export">
              <Row keys="Ctrl+Z" label="Undo" />
              <Row keys="Ctrl+⇧Z" label="Redo" />
              <Row keys="Ctrl+S" label="Save .minstudio file" />
              <Row keys="Ctrl+⇧E" label="Export dialog (3MF / STL)" />
              <Row keys="Ctrl+⇧B" label="Bake CSG preview" />
              <Row keys="Ctrl+I" label="Import STL / GLB" />
            </Section>
          </div>

          {/* Right column — controller */}
          <div>
            <Section title="Movement — Xbox Controller">
              <Row keys="L stick" label="Walk / strafe" />
              <Row keys="R stick" label="Look" />
              <Row keys="A" label="Start game (first press) · hold to fly UP (in fly mode)" />
              <Row keys="A A" label="Toggle fly mode" />
              <Row keys="B" label="Hold to fly DOWN (in fly mode) · close any menu" />
              <Row keys="B B" label="Toggle fly mode (alt)" />
              <Row keys="RB / LB (fly)" label="Rise / descend (alias for A / B)" />
            </Section>

            <Section title="Building — Controller">
              <Row keys="RT" label="Place block" />
              <Row keys="LT" label="Break / erase block" />
              <Row keys="D-pad ↑ tap" label="Rotate yaw (Y axis)" />
              <Row keys="Back + D-pad ↑" label="Rotate pitch (X axis)" />
              <Row keys="Start + D-pad ↑" label="Rotate roll (Z axis)" />
              <Row keys="X (hold)" label="Tool ring — left stick aims, release to commit" />
              <Row keys="D-pad ↓" label="Cycle block size" />
              <Row keys="LB / RB (walk)" label="Hotbar prev / next" />
              <Row keys="D-pad ←→" label="Hotbar OR color (in paint mode)" />
            </Section>

            <Section title="Inventory / Plates / Menu — Controller">
              <Row keys="Y" label="Open / close inventory" />
              <Row keys="D-pad ↑ hold" label="Category ring" />
              <Row keys="D-pad in inv" label="Move cursor — A picks block" />
              <Row keys="LB / RB in inv" label="Switch tab" />
              <Row keys="Back + D-pad ←" label="Previous plate" />
              <Row keys="Back + D-pad →" label="Next plate (auto-adds new)" />
              <Row keys="Start" label="Pause menu (with Export button)" />
              <Row keys="B" label="Close any open menu" />
            </Section>

            <Section title="Undo / Export / Misc — Controller">
              <Row keys="Back (release)" label="Undo (deferred — won't fire if you chord with Back)" />
              <Row keys="Back + A" label="Redo" />
              <Row keys="Back + RT" label="Open export dialog" />
              <Row keys="Back + LB" label="Toggle annotations" />
              <Row keys="In export dialog" label="D-pad ↑↓ choose · A confirm · B cancel" />
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
