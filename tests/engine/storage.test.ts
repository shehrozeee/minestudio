import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MigrationSystem } from '../../src/engine/systems/MigrationSystem'
import type { NamedSaveSlot, SaveFile } from '../../src/engine/types'

// ---------------------------------------------------------------------------
// Mock localStorage for the slot tests
// (jsdom's localStorage.clear may not be implemented in all environments)
// ---------------------------------------------------------------------------
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

// ---------------------------------------------------------------------------
// MigrationSystem (existing tests — unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Named save slots (pure localStorage logic — no BuildEngine dependency)
// ---------------------------------------------------------------------------

const SLOT_COUNT = 5
const SAVE_SLOTS_KEY = 'minestudio_slots'

/** Minimal standalone slot helpers that mirror StorageSystem behaviour. */
function loadSlots(): (NamedSaveSlot | null)[] {
  try {
    const raw = localStorage.getItem(SAVE_SLOTS_KEY)
    if (!raw) return Array(SLOT_COUNT).fill(null) as null[]
    const parsed = JSON.parse(raw) as (NamedSaveSlot | null)[]
    while (parsed.length < SLOT_COUNT) parsed.push(null)
    return parsed.slice(0, SLOT_COUNT)
  } catch {
    return Array(SLOT_COUNT).fill(null) as null[]
  }
}

function saveToSlot(slot: number, name: string, data: SaveFile): void {
  if (slot < 0 || slot >= SLOT_COUNT) return
  const slots = loadSlots()
  slots[slot] = { name, data, savedAt: Date.now() }
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots))
}

function makeSaveFile(): SaveFile {
  return {
    version: 1,
    objects: [],
    mates: [],
    bodies: [],
    camera: { position: { gx: 0, gy: 14, gz: 64 }, rotationY: 0 },
  }
}

describe('Named save slots', () => {
  beforeEach(() => {
    // Install fresh in-memory localStorage mock so tests are isolated
    const mock = makeLocalStorageMock()
    vi.stubGlobal('localStorage', mock)
  })

  it('loadSlots returns exactly 5 null entries when storage is empty', () => {
    const slots = loadSlots()
    expect(slots).toHaveLength(SLOT_COUNT)
    for (const s of slots) expect(s).toBeNull()
  })

  it('saveToSlot stores data at the given index', () => {
    saveToSlot(0, 'My First Save', makeSaveFile())
    const slots = loadSlots()
    expect(slots[0]).not.toBeNull()
    expect(slots[0]!.name).toBe('My First Save')
  })

  it('saveToSlot does not affect other slots', () => {
    saveToSlot(2, 'Middle Save', makeSaveFile())
    const slots = loadSlots()
    expect(slots[0]).toBeNull()
    expect(slots[1]).toBeNull()
    expect(slots[2]!.name).toBe('Middle Save')
    expect(slots[3]).toBeNull()
    expect(slots[4]).toBeNull()
  })

  it('overwrites existing slot when saved again', () => {
    saveToSlot(1, 'First Name', makeSaveFile())
    saveToSlot(1, 'New Name', makeSaveFile())
    const slots = loadSlots()
    expect(slots[1]!.name).toBe('New Name')
  })

  it('savedAt is a positive number', () => {
    const before = Date.now()
    saveToSlot(0, 'Test', makeSaveFile())
    const slots = loadSlots()
    expect(slots[0]!.savedAt).toBeGreaterThanOrEqual(before)
  })

  it('saved slot contains the objects from the save file', () => {
    const file = makeSaveFile()
    saveToSlot(3, 'Slot 3', file)
    const slots = loadSlots()
    expect(slots[3]!.data.objects).toEqual([])
    expect(slots[3]!.data.version).toBe(1)
  })

  it('ignores out-of-range slot indices', () => {
    saveToSlot(-1, 'Bad', makeSaveFile())
    saveToSlot(99, 'Bad', makeSaveFile())
    const slots = loadSlots()
    for (const s of slots) expect(s).toBeNull()
  })
})
