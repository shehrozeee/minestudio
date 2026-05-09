import { describe, it, expect } from 'vitest'
import type { PlacedObject } from '../../src/engine/types'
import { groupObjectsByBody, sanitizeName } from '../../src/engine/systems/ExportSystem'

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function makeObj(id: number, opts: Partial<PlacedObject> = {}): PlacedObject {
  return {
    id,
    defId: 'cube',
    size: 'normal',
    position: { gx: id, gy: 0, gz: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    color: '#ffffff',
    isNegative: false,
    isPrintable: true,
    isSupport: false,
    storageKind: 'grid',
    ...opts,
  }
}

// ---------------------------------------------------------------------------
// groupObjectsByBody
// ---------------------------------------------------------------------------

describe('ExportSystem groupObjectsByBody', () => {
  it('single object with no bodyName goes to "body" group', () => {
    const groups = groupObjectsByBody([makeObj(1)])
    expect(groups.size).toBe(1)
    expect(groups.has('body')).toBe(true)
    expect(groups.get('body')).toHaveLength(1)
  })

  it('objects with same bodyName go into same group', () => {
    const groups = groupObjectsByBody([
      makeObj(1, { bodyName: 'Torso' }),
      makeObj(2, { bodyName: 'Torso' }),
    ])
    expect(groups.size).toBe(1)
    expect(groups.get('Torso')).toHaveLength(2)
  })

  it('objects with different bodyNames go into different groups', () => {
    const groups = groupObjectsByBody([
      makeObj(1, { bodyName: 'Arm' }),
      makeObj(2, { bodyName: 'Leg' }),
    ])
    expect(groups.size).toBe(2)
    expect(groups.get('Arm')).toHaveLength(1)
    expect(groups.get('Leg')).toHaveLength(1)
  })

  it('negative objects are excluded', () => {
    const groups = groupObjectsByBody([
      makeObj(1),
      makeObj(2, { isNegative: true }),
    ])
    expect(groups.get('body')).toHaveLength(1)
  })

  it('non-printable objects are excluded', () => {
    const groups = groupObjectsByBody([
      makeObj(1),
      makeObj(2, { isPrintable: false }),
    ])
    expect(groups.get('body')).toHaveLength(1)
  })

  it('sanitizeName strips illegal characters', () => {
    expect(sanitizeName('Left Arm!')).toBe('Left_Arm_')
    expect(sanitizeName('')).toBe('body')
    expect(sanitizeName('valid_name-123')).toBe('valid_name-123')
  })

  it('empty object list produces empty groups', () => {
    const groups = groupObjectsByBody([])
    expect(groups.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3MF XML structure (pure string tests — no DOM/Three)
// ---------------------------------------------------------------------------

describe('3MF export XML structure', () => {
  /**
   * Minimal hand-rolled 3MF model XML builder for testing — mirrors the shape
   * of what export3MF produces, without needing Three.js geometry.
   */
  function make3MFModel(bodyName: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model" name="${bodyName}">
      <mesh>
        <vertices>
          <vertex x="0.0000" y="0.0000" z="0.0000"/>
          <vertex x="2.0000" y="0.0000" z="0.0000"/>
          <vertex x="0.0000" y="2.0000" z="0.0000"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`
  }

  it('model XML contains <model> root element', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('<model')
    expect(xml).toContain('</model>')
  })

  it('model XML contains <resources> and <build>', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('<resources>')
    expect(xml).toContain('<build>')
  })

  it('model XML contains <object> with expected id and name', () => {
    const xml = make3MFModel('TestBody')
    expect(xml).toContain('id="1"')
    expect(xml).toContain('name="TestBody"')
  })

  it('model XML contains <mesh> with <vertices> and <triangles>', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('<mesh>')
    expect(xml).toContain('<vertices>')
    expect(xml).toContain('<triangles>')
  })

  it('model XML contains <item objectid="1"/>', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('<item objectid="1"/>')
  })

  it('unit attribute is millimeter', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('unit="millimeter"')
  })

  it('xmlns is the 3dmanufacturing namespace', () => {
    const xml = make3MFModel('body')
    expect(xml).toContain('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"')
  })
})
