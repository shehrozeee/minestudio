import { useEffect } from 'react'
import { useStore } from '../store'

export function ImportPreview() {
  const importPreviewObjects = useStore(s => s.importPreviewObjects)
  const setImportPreviewObjects = useStore(s => s.setImportPreviewObjects)

  useEffect(() => {
    if (!importPreviewObjects) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === '-') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('minestudio:import-scale-down'))
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('minestudio:import-scale-up'))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setImportPreviewObjects(null)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('minestudio:confirm-import'))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [importPreviewObjects, setImportPreviewObjects])

  if (!importPreviewObjects) return null

  const count = importPreviewObjects.length

  // Compute bounding box info (in grid units)
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const obj of importPreviewObjects) {
    const { gx, gy, gz } = obj.position
    if (gx < minX) minX = gx
    if (gy < minY) minY = gy
    if (gz < minZ) minZ = gz
    if (gx > maxX) maxX = gx
    if (gy > maxY) maxY = gy
    if (gz > maxZ) maxZ = gz
  }

  const dx = maxX - minX + 1
  const dy = maxY - minY + 1
  const dz = maxZ - minZ + 1
  // Each grid unit = 2mm
  const toMm = (u: number) => `${u * 2}mm`

  const handlePlace = () => {
    window.dispatchEvent(new CustomEvent('minestudio:confirm-import'))
  }

  const handleCancel = () => {
    setImportPreviewObjects(null)
  }

  const handleScaleDown = () => {
    window.dispatchEvent(new CustomEvent('minestudio:import-scale-down'))
  }

  const handleScaleUp = () => {
    window.dispatchEvent(new CustomEvent('minestudio:import-scale-up'))
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(13,15,18,0.92)',
      border: '1px solid #2a2f37',
      borderRadius: 10,
      padding: '10px 18px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      color: '#f4f5f7',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'center',
      whiteSpace: 'nowrap',
      pointerEvents: 'auto',
    }}>
      <div style={{ color: '#8b8f97', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Import Preview
      </div>

      <div style={{ fontSize: 11, color: '#c8cdd5' }}>
        {toMm(dx)} × {toMm(dy)} × {toMm(dz)}
        <span style={{ color: '#8b8f97' }}> · {count} block{count !== 1 ? 's' : ''} · {dx}×{dy}×{dz} grid</span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 10, color: '#8b8f97' }}>
        <button
          onClick={handleScaleDown}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid #2a2f37',
            borderRadius: 5,
            color: '#c8cdd5',
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 10px',
            fontFamily: 'inherit',
          }}
        >
          LB / - Scale down
        </button>
        <button
          onClick={handleScaleUp}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid #2a2f37',
            borderRadius: 5,
            color: '#c8cdd5',
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 10px',
            fontFamily: 'inherit',
          }}
        >
          RB / + Scale up
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleCancel}
          style={{
            background: 'transparent',
            border: '1px solid #2a2f37',
            borderRadius: 6,
            color: '#8b8f97',
            cursor: 'pointer',
            fontSize: 11,
            padding: '5px 14px',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handlePlace}
          style={{
            background: 'rgba(0,213,99,0.15)',
            border: '1px solid rgba(0,213,99,0.5)',
            borderRadius: 6,
            color: '#00d563',
            cursor: 'pointer',
            fontSize: 11,
            padding: '5px 14px',
            fontFamily: 'inherit',
          }}
        >
          Place
        </button>
      </div>
    </div>
  )
}
