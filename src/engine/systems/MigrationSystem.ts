import type { SaveFile } from '../types'
export class MigrationSystem {
  migrate(data: unknown): SaveFile {
    return data as SaveFile
  }
}
