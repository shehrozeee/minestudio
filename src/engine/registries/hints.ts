import type { AppState } from '../types'

export interface HintDef {
  condition: (state: AppState) => boolean
  hints: { binding: string; label: string }[]
}

export const HINT_REGISTRY: HintDef[] = []
