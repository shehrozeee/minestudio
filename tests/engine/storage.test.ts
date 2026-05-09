import { describe, it, expect } from 'vitest'
import { MigrationSystem } from '../../src/engine/systems/MigrationSystem'
import type { SaveFile } from '../../src/engine/types'

describe('MigrationSystem', () => {
  it('accepts valid v1 save and returns it unchanged', () => {
    const migrator = new MigrationSystem()
    const save: SaveFile = {
      version: 1,
      objects: [],
      mates: [],
      bodies: [],
      camera: { position: { gx: 0, gy: 14, gz: 64 }, rotationY: 0 },
    }
    const result = migrator.migrate(save)
    expect(result.version).toBe(1)
    expect(result.objects).toEqual([])
  })

  it('migrates v0 save to v1', () => {
    const migrator = new MigrationSystem()
    const oldSave = {
      version: 0,
      objects: [],
      mates: [],
      bodies: [],
      camera: { position: { gx: 0, gy: 0, gz: 0 }, rotationY: 0 },
    }
    const result = migrator.migrate(oldSave)
    expect(result.version).toBe(1)
  })

  it('throws on null data', () => {
    const migrator = new MigrationSystem()
    expect(() => migrator.migrate(null)).toThrow()
  })

  it('handles missing version field (treats as v0)', () => {
    const migrator = new MigrationSystem()
    const data = { objects: [], mates: [], bodies: [], camera: { position: { gx: 0, gy: 0, gz: 0 }, rotationY: 0 } }
    const result = migrator.migrate(data)
    expect(result.version).toBe(1)
  })
})
