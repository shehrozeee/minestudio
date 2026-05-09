import type { SaveFile } from '../types'

const CURRENT_VERSION = 1

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: MigrationFn[] = [
  // v0 → v1: identity (first version)
  (d) => d,
]

export class MigrationSystem {
  migrate(data: unknown): SaveFile {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid save data')
    }
    let d = data as Record<string, unknown>
    const version = typeof d['version'] === 'number' ? d['version'] : 0
    for (let v = version; v < CURRENT_VERSION; v++) {
      const fn = MIGRATIONS[v]
      if (fn) d = fn(d)
    }
    d['version'] = CURRENT_VERSION
    return d as unknown as SaveFile
  }
}
