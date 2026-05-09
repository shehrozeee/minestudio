# MineStudio Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a working Vite + React + TypeScript app with Three.js scene, grid system, command pattern, and Zustand store. Running `npm run dev` shows a Three.js build plate. Running `npm test` passes all tests.

**Architecture:** React UI layer bridges to a pure TypeScript `BuildEngine` via Zustand. Three.js scene mounts into a div ref. No blocks yet — just types, grid math, command infrastructure, and a flat plate scene.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Three.js r160, Zustand 4, Vitest, @testing-library/react

---

## File Map

| File | Purpose |
|---|---|
| `package.json` | Dependencies + scripts |
| `vite.config.ts` | Vite + React plugin + test config |
| `tsconfig.json` | TypeScript strict config |
| `index.html` | Entry HTML |
| `src/main.tsx` | React entry point |
| `src/ui/App.tsx` | Root component — canvas div + UI overlay |
| `src/ui/store.ts` | Zustand store — all app state |
| `src/engine/types.ts` | All shared interfaces and types |
| `src/engine/grid.ts` | Grid math — toWorld, fromWorld, occupancy |
| `src/engine/commands/Command.ts` | Command interface + CommandBus + UndoStack |
| `src/engine/BuildEngine.ts` | Engine class — wires systems, exposes API |
| `src/engine/systems/WorldSystem.ts` | Three.js scene, renderer, camera, plate |
| `tests/engine/grid.test.ts` | Grid math unit tests |
| `tests/engine/commands.test.ts` | CommandBus + UndoStack tests |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "minestudio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.160.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.7",
    "@types/node": "^20.12.7",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MineStudio</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
      body { background: #0d0f12; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 6: Create tests/setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Errors about missing files (App.tsx etc) — that's fine, scaffold not complete yet. No config errors.

---

## Task 2: Shared Types

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 1: Write all shared types**

```typescript
// src/engine/types.ts
import type * as THREE from 'three'

export type BlockSize = 'normal' | 'large' | 'xl'
export type ExportBehavior = 'standard' | 'isolated' | 'clearance-required'
export type BlockCategory = 'basic' | 'round' | 'partial' | 'connector' | 'utility' | 'custom'
export type ToolId =
  | 'place' | 'erase' | 'paint' | 'eyedropper' | 'text'
  | 'select' | 'sink' | 'mate' | 'fillet' | 'support' | 'measure'
export type RingType = 'tools' | 'categories'
export type SupportMode = 'off' | 'vertical' | 'horizontal'
export type ObjectStorageKind = 'grid' | 'imported'

export interface GridPos {
  gx: number
  gy: number
  gz: number
}

export type BlockRotationAngle = 0 | 90 | 180 | 270
export interface BlockRotation {
  x: BlockRotationAngle
  y: BlockRotationAngle
  z: BlockRotationAngle
}

export interface PlacedObject {
  id: number
  defId: string
  size: BlockSize
  position: GridPos
  rotation: BlockRotation
  color: string
  faceColors?: [string, string, string, string, string, string]
  isNegative: boolean
  isPrintable: boolean
  isSupport: boolean
  storageKind: ObjectStorageKind
  geometryBuffer?: ArrayBuffer  // imported objects only
  scaleBlocks?: number          // imported objects only
}

export interface BlockDef {
  id: string
  label: string
  category: BlockCategory
  isPrintable: boolean
  exportBehavior: ExportBehavior
  availableSizes: BlockSize[]
  makeGeometry: (unitSize: number) => THREE.BufferGeometry
}

export interface ConnectorDef {
  id: string
  label: string
  matesWith: string[]
  clearance: number
  bodyRule: 'different'
  role: 'male' | 'female' | 'neutral'
}

export interface MateAnnotation {
  id: number
  connectorAId: number
  connectorBId: number
  color: string
}

export interface BodyDef {
  id: string
  label: string
  objectIds: number[]
}

export interface ValidationWarning {
  type: 'error' | 'warning'
  message: string
  objectId?: number
}

export interface SaveFile {
  version: number
  objects: PlacedObject[]
  mates: MateAnnotation[]
  bodies: BodyDef[]
  camera: { position: GridPos; rotationY: number }
}

export interface AppState {
  selectedTool: ToolId
  ringOpen: boolean
  ringType: RingType | null
  selectedBlockDefId: string
  selectedSize: BlockSize
  selectedColor: string
  inventoryOpen: boolean
  inventoryTab: BlockCategory
  objectCount: number
  undoAvailable: boolean
  redoAvailable: boolean
  timeOfDay: number
  playerPosition: GridPos
  mateStep: 0 | 1 | 2
  sinkDepth: number
  flyMode: boolean
  supportMode: SupportMode
  mode2D: boolean
  bodyList: BodyDef[]
  validationWarnings: ValidationWarning[]
  csgPending: boolean
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Only errors about missing files, not type errors in types.ts.

---

## Task 3: Grid System

**Files:**
- Create: `src/engine/grid.ts`
- Create: `tests/engine/grid.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/grid.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  GRID_BASE,
  SIZE_IN_UNITS,
  toWorld,
  snapToGrid,
  cellKey,
  occupiedCells,
  OccupancyMap,
} from '../../src/engine/grid'

describe('GRID_BASE', () => {
  it('is 2mm', () => {
    expect(GRID_BASE).toBe(2)
  })
})

describe('SIZE_IN_UNITS', () => {
  it('normal = 1 unit', () => expect(SIZE_IN_UNITS.normal).toBe(1))
  it('large = 2 units', () => expect(SIZE_IN_UNITS.large).toBe(2))
  it('xl = 3 units', () => expect(SIZE_IN_UNITS.xl).toBe(3))
})

describe('toWorld', () => {
  it('converts grid origin to world origin', () => {
    const v = toWorld({ gx: 0, gy: 0, gz: 0 })
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
    expect(v.z).toBe(0)
  })

  it('converts gx=3 to x=6mm', () => {
    const v = toWorld({ gx: 3, gy: 0, gz: 0 })
    expect(v.x).toBe(6)
  })

  it('converts gy=1 to y=2mm', () => {
    const v = toWorld({ gx: 0, gy: 1, gz: 0 })
    expect(v.y).toBe(2)
  })
})

describe('snapToGrid', () => {
  it('snaps 3.1 to nearest grid cell gx=2 (4mm / 2 = 2)', () => {
    const pos = snapToGrid({ x: 3.1, y: 0, z: 0 })
    expect(pos.gx).toBe(2)
  })

  it('snaps negative coordinates correctly', () => {
    const pos = snapToGrid({ x: -5, y: 0, z: 0 })
    expect(pos.gx).toBe(-2) // -5/2 rounds to -2, -2*2 = -4 closest
  })
})

describe('cellKey', () => {
  it('returns "gx,gy,gz" string', () => {
    expect(cellKey({ gx: 1, gy: 2, gz: 3 })).toBe('1,2,3')
  })
})

describe('occupiedCells', () => {
  it('normal block at origin occupies exactly 1 cell', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(cells).toHaveLength(1)
    expect(cells[0]).toBe('0,0,0')
  })

  it('large block at origin occupies 8 cells (2x2x2)', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'large')
    expect(cells).toHaveLength(8)
  })

  it('xl block at origin occupies 27 cells (3x3x3)', () => {
    const cells = occupiedCells({ gx: 0, gy: 0, gz: 0 }, 'xl')
    expect(cells).toHaveLength(27)
  })
})

describe('OccupancyMap', () => {
  let map: OccupancyMap

  beforeEach(() => { map = new OccupancyMap() })

  it('reports empty cell as unoccupied', () => {
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('reports occupied after register', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(true)
  })

  it('returns occupant id', () => {
    map.register(42, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.getOccupant('0,0,0')).toBe(42)
  })

  it('frees cells on unregister', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    map.unregister(1, { gx: 0, gy: 0, gz: 0 }, 'normal')
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })

  it('large block occupancy prevents normal block placement', () => {
    map.register(1, { gx: 0, gy: 0, gz: 0 }, 'large')
    // Cell (0,0,0) is taken by the large block
    expect(map.isOccupied({ gx: 0, gy: 0, gz: 0 }, 'normal')).toBe(true)
    // Cell (2,0,0) is outside the large block (large = 2 units = cells 0,1 in each axis)
    expect(map.isOccupied({ gx: 2, gy: 0, gz: 0 }, 'normal')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- grid`

Expected: FAIL — "Cannot find module '../../src/engine/grid'"

- [ ] **Step 3: Implement grid.ts**

```typescript
// src/engine/grid.ts
import * as THREE from 'three'
import type { BlockSize, GridPos } from './types'

export const GRID_BASE = 2  // mm per grid unit

export const SIZE_IN_UNITS: Record<BlockSize, number> = {
  normal: 1,
  large: 2,
  xl: 3,
}

export function toWorld(pos: GridPos): THREE.Vector3 {
  return new THREE.Vector3(
    pos.gx * GRID_BASE,
    pos.gy * GRID_BASE,
    pos.gz * GRID_BASE,
  )
}

export function snapToGrid(world: { x: number; y: number; z: number }): GridPos {
  return {
    gx: Math.round(world.x / GRID_BASE),
    gy: Math.round(world.y / GRID_BASE),
    gz: Math.round(world.z / GRID_BASE),
  }
}

export function cellKey(pos: GridPos): string {
  return `${pos.gx},${pos.gy},${pos.gz}`
}

export function occupiedCells(origin: GridPos, size: BlockSize): string[] {
  const units = SIZE_IN_UNITS[size]
  const keys: string[] = []
  for (let dx = 0; dx < units; dx++) {
    for (let dy = 0; dy < units; dy++) {
      for (let dz = 0; dz < units; dz++) {
        keys.push(cellKey({
          gx: origin.gx + dx,
          gy: origin.gy + dy,
          gz: origin.gz + dz,
        }))
      }
    }
  }
  return keys
}

export class OccupancyMap {
  private cells = new Map<string, number>()  // key → objectId

  register(id: number, origin: GridPos, size: BlockSize): void {
    for (const key of occupiedCells(origin, size)) {
      this.cells.set(key, id)
    }
  }

  unregister(id: number, origin: GridPos, size: BlockSize): void {
    for (const key of occupiedCells(origin, size)) {
      if (this.cells.get(key) === id) this.cells.delete(key)
    }
  }

  isOccupied(origin: GridPos, size: BlockSize): boolean {
    return occupiedCells(origin, size).some(k => this.cells.has(k))
  }

  getOccupant(key: string): number | undefined {
    return this.cells.get(key)
  }

  clear(): void {
    this.cells.clear()
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- grid`

Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/grid.ts src/engine/types.ts tests/engine/grid.test.ts tests/setup.ts
git commit -m "feat: grid system — toWorld, snapToGrid, OccupancyMap"
```

---

## Task 4: Command Pattern + CommandBus

**Files:**
- Create: `src/engine/commands/Command.ts`
- Create: `tests/engine/commands.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/engine/commands.test.ts
import { describe, it, expect, vi } from 'vitest'
import { CommandBus } from '../../src/engine/commands/Command'

describe('CommandBus', () => {
  it('executes a command', () => {
    const bus = new CommandBus()
    const executed: string[] = []
    bus.execute({
      execute: () => { executed.push('run') },
      undo: () => { executed.push('undo') },
    })
    expect(executed).toEqual(['run'])
  })

  it('undo calls the command undo and removes from history', () => {
    const bus = new CommandBus()
    const log: string[] = []
    bus.execute({ execute: () => log.push('a'), undo: () => log.push('undo-a') })
    bus.undo()
    expect(log).toEqual(['a', 'undo-a'])
  })

  it('redo re-executes after undo', () => {
    const bus = new CommandBus()
    const log: string[] = []
    bus.execute({ execute: () => log.push('a'), undo: () => log.push('undo-a') })
    bus.undo()
    bus.redo()
    expect(log).toEqual(['a', 'undo-a', 'a'])
  })

  it('new command after undo clears redo stack', () => {
    const bus = new CommandBus()
    const log: string[] = []
    bus.execute({ execute: () => log.push('a'), undo: () => {} })
    bus.undo()
    bus.execute({ execute: () => log.push('b'), undo: () => {} })
    expect(bus.canRedo).toBe(false)
  })

  it('canUndo is false on empty stack', () => {
    expect(new CommandBus().canUndo).toBe(false)
  })

  it('canRedo is false on empty redo stack', () => {
    expect(new CommandBus().canRedo).toBe(false)
  })

  it('respects max stack size of 100', () => {
    const bus = new CommandBus(100)
    for (let i = 0; i < 110; i++) {
      bus.execute({ execute: () => {}, undo: () => {} })
    }
    // Only 100 items in history
    let undoCount = 0
    while (bus.canUndo) { bus.undo(); undoCount++ }
    expect(undoCount).toBe(100)
  })

  it('fires onChange when state changes', () => {
    const bus = new CommandBus()
    const cb = vi.fn()
    bus.onChange(cb)
    bus.execute({ execute: () => {}, undo: () => {} })
    expect(cb).toHaveBeenCalledWith({ canUndo: true, canRedo: false })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- commands`

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement Command.ts**

```typescript
// src/engine/commands/Command.ts

export interface Command {
  execute(): void
  undo(): void
  serialize?(): string  // optional, for future multiplayer
}

export interface CommandBusState {
  canUndo: boolean
  canRedo: boolean
}

type ChangeListener = (state: CommandBusState) => void

export class CommandBus {
  private history: Command[] = []
  private cursor = -1  // index of last executed command
  private readonly maxSize: number
  private listeners: ChangeListener[] = []

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  execute(cmd: Command): void {
    // Clear redo stack
    this.history = this.history.slice(0, this.cursor + 1)
    // Enforce max size
    if (this.history.length >= this.maxSize) {
      this.history.shift()
      this.cursor--
    }
    cmd.execute()
    this.history.push(cmd)
    this.cursor++
    this.notify()
  }

  undo(): void {
    if (!this.canUndo) return
    this.history[this.cursor].undo()
    this.cursor--
    this.notify()
  }

  redo(): void {
    if (!this.canRedo) return
    this.cursor++
    this.history[this.cursor].execute()
    this.notify()
  }

  get canUndo(): boolean {
    return this.cursor >= 0
  }

  get canRedo(): boolean {
    return this.cursor < this.history.length - 1
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  private notify(): void {
    const state: CommandBusState = { canUndo: this.canUndo, canRedo: this.canRedo }
    for (const l of this.listeners) l(state)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- commands`

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/commands/Command.ts tests/engine/commands.test.ts
git commit -m "feat: command pattern — CommandBus with undo/redo stack"
```

---

## Task 5: Zustand Store

**Files:**
- Create: `src/ui/store.ts`
- Create: `tests/ui/store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/ui/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, resetStore } from '../../src/ui/store'

describe('useStore initial state', () => {
  beforeEach(() => resetStore())

  it('selectedTool defaults to place', () => {
    expect(useStore.getState().selectedTool).toBe('place')
  })

  it('selectedSize defaults to normal', () => {
    expect(useStore.getState().selectedSize).toBe('normal')
  })

  it('flyMode defaults to false', () => {
    expect(useStore.getState().flyMode).toBe(false)
  })

  it('objectCount defaults to 0', () => {
    expect(useStore.getState().objectCount).toBe(0)
  })
})

describe('useStore mutations', () => {
  beforeEach(() => resetStore())

  it('setTool updates selectedTool', () => {
    useStore.getState().setTool('paint')
    expect(useStore.getState().selectedTool).toBe('paint')
  })

  it('setSize updates selectedSize', () => {
    useStore.getState().setSize('xl')
    expect(useStore.getState().selectedSize).toBe('xl')
  })

  it('setFlyMode updates flyMode', () => {
    useStore.getState().setFlyMode(true)
    expect(useStore.getState().flyMode).toBe(true)
  })

  it('setUndoState updates both flags', () => {
    useStore.getState().setUndoState({ canUndo: true, canRedo: false })
    expect(useStore.getState().undoAvailable).toBe(true)
    expect(useStore.getState().redoAvailable).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- store`

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement store.ts**

```typescript
// src/ui/store.ts
import { create } from 'zustand'
import type { AppState, ToolId, BlockSize, BlockCategory, GridPos, BodyDef, ValidationWarning, SupportMode } from '../engine/types'

interface StoreActions {
  setTool: (tool: ToolId) => void
  setSize: (size: BlockSize) => void
  setColor: (color: string) => void
  setFlyMode: (on: boolean) => void
  setSupportMode: (mode: SupportMode) => void
  setMode2D: (on: boolean) => void
  setRingOpen: (open: boolean, type?: 'tools' | 'categories') => void
  setInventoryOpen: (open: boolean, tab?: BlockCategory) => void
  setObjectCount: (count: number) => void
  setUndoState: (state: { canUndo: boolean; canRedo: boolean }) => void
  setPlayerPosition: (pos: GridPos) => void
  setTimeOfDay: (t: number) => void
  setBodyList: (bodies: BodyDef[]) => void
  setValidationWarnings: (warnings: ValidationWarning[]) => void
  setCsgPending: (pending: boolean) => void
  setMateStep: (step: 0 | 1 | 2) => void
  setSelectedBlockDefId: (id: string) => void
}

type Store = AppState & StoreActions

const initialState: AppState = {
  selectedTool: 'place',
  ringOpen: false,
  ringType: null,
  selectedBlockDefId: 'cube',
  selectedSize: 'normal',
  selectedColor: '#1a1a1a',
  inventoryOpen: false,
  inventoryTab: 'basic',
  objectCount: 0,
  undoAvailable: false,
  redoAvailable: false,
  timeOfDay: 0.3,
  playerPosition: { gx: 0, gy: 14, gz: 64 },
  mateStep: 0,
  sinkDepth: 0,
  flyMode: false,
  supportMode: 'off',
  mode2D: false,
  bodyList: [],
  validationWarnings: [],
  csgPending: false,
}

export const useStore = create<Store>()((set) => ({
  ...initialState,
  setTool: (selectedTool) => set({ selectedTool }),
  setSize: (selectedSize) => set({ selectedSize }),
  setColor: (selectedColor) => set({ selectedColor }),
  setFlyMode: (flyMode) => set({ flyMode }),
  setSupportMode: (supportMode) => set({ supportMode }),
  setMode2D: (mode2D) => set({ mode2D }),
  setRingOpen: (ringOpen, ringType = null) => set({ ringOpen, ringType }),
  setInventoryOpen: (inventoryOpen, inventoryTab) =>
    set(inventoryTab ? { inventoryOpen, inventoryTab } : { inventoryOpen }),
  setObjectCount: (objectCount) => set({ objectCount }),
  setUndoState: ({ canUndo, canRedo }) =>
    set({ undoAvailable: canUndo, redoAvailable: canRedo }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setBodyList: (bodyList) => set({ bodyList }),
  setValidationWarnings: (validationWarnings) => set({ validationWarnings }),
  setCsgPending: (csgPending) => set({ csgPending }),
  setMateStep: (mateStep) => set({ mateStep }),
  setSelectedBlockDefId: (selectedBlockDefId) => set({ selectedBlockDefId }),
}))

// Test helper — resets store to initial state
export function resetStore(): void {
  useStore.setState(initialState)
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- store`

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/store.ts tests/ui/store.test.ts
git commit -m "feat: Zustand store — app state with typed actions"
```

---

## Task 6: BuildEngine Skeleton

**Files:**
- Create: `src/engine/BuildEngine.ts`
- Create: `src/engine/systems/WorldSystem.ts` (stub)
- Create: `src/engine/systems/InputSystem.ts` (stub)
- Create: `src/engine/systems/PlacementSystem.ts` (stub)
- Create: `src/engine/systems/RenderSystem.ts` (stub)
- Create: `src/engine/systems/ConnectorSystem.ts` (stub)
- Create: `src/engine/systems/CSGSystem.ts` (stub)
- Create: `src/engine/systems/ValidationSystem.ts` (stub)
- Create: `src/engine/systems/ExportSystem.ts` (stub)
- Create: `src/engine/systems/StorageSystem.ts` (stub)
- Create: `src/engine/systems/MigrationSystem.ts` (stub)

- [ ] **Step 1: Create system stubs**

Each stub follows this pattern. Create all 10 files:

```typescript
// src/engine/systems/InputSystem.ts
export class InputSystem {
  init(): void {}
  tick(_dt: number): void {}
  dispose(): void {}
}
```

```typescript
// src/engine/systems/PlacementSystem.ts
export class PlacementSystem {
  init(): void {}
  tick(_dt: number): void {}
  dispose(): void {}
}
```

```typescript
// src/engine/systems/RenderSystem.ts
export class RenderSystem {
  init(): void {}
  tick(_dt: number): void {}
  dispose(): void {}
}
```

```typescript
// src/engine/systems/ConnectorSystem.ts
export class ConnectorSystem {
  init(): void {}
  tick(_dt: number): void {}
  dispose(): void {}
}
```

```typescript
// src/engine/systems/CSGSystem.ts
export class CSGSystem {
  init(): void {}
  dispose(): void {}
}
```

```typescript
// src/engine/systems/ValidationSystem.ts
import type { ValidationWarning } from '../types'
export class ValidationSystem {
  check(): ValidationWarning[] { return [] }
}
```

```typescript
// src/engine/systems/ExportSystem.ts
export class ExportSystem {
  init(): void {}
}
```

```typescript
// src/engine/systems/StorageSystem.ts
export class StorageSystem {
  init(): void {}
}
```

```typescript
// src/engine/systems/MigrationSystem.ts
import type { SaveFile } from '../types'
export class MigrationSystem {
  migrate(data: unknown): SaveFile {
    return data as SaveFile
  }
}
```

- [ ] **Step 2: Create BuildEngine.ts**

```typescript
// src/engine/BuildEngine.ts
import * as THREE from 'three'
import { CommandBus } from './commands/Command'
import { OccupancyMap } from './grid'
import type { PlacedObject } from './types'
import { WorldSystem } from './systems/WorldSystem'
import { InputSystem } from './systems/InputSystem'
import { PlacementSystem } from './systems/PlacementSystem'
import { RenderSystem } from './systems/RenderSystem'
import { ConnectorSystem } from './systems/ConnectorSystem'
import { CSGSystem } from './systems/CSGSystem'
import { ValidationSystem } from './systems/ValidationSystem'
import { ExportSystem } from './systems/ExportSystem'
import { StorageSystem } from './systems/StorageSystem'
import { MigrationSystem } from './systems/MigrationSystem'

export class BuildEngine {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly commandBus: CommandBus
  readonly occupancy: OccupancyMap
  readonly objects: PlacedObject[] = []

  readonly world: WorldSystem
  readonly input: InputSystem
  readonly placement: PlacementSystem
  readonly render: RenderSystem
  readonly connector: ConnectorSystem
  readonly csg: CSGSystem
  readonly validation: ValidationSystem
  readonly exporter: ExportSystem
  readonly storage: StorageSystem
  readonly migration: MigrationSystem

  private animFrameId = 0
  private lastTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.5,
      3000
    )
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

    this.commandBus = new CommandBus()
    this.occupancy = new OccupancyMap()

    this.world = new WorldSystem(this)
    this.input = new InputSystem()
    this.placement = new PlacementSystem()
    this.render = new RenderSystem()
    this.connector = new ConnectorSystem()
    this.csg = new CSGSystem()
    this.validation = new ValidationSystem()
    this.exporter = new ExportSystem()
    this.storage = new StorageSystem()
    this.migration = new MigrationSystem()
  }

  init(): void {
    this.world.init()
    this.input.init()
    this.placement.init()
    this.render.init()
    this.storage.init()
    this.exporter.init()

    window.addEventListener('resize', this.onResize)
    this.loop(0)
  }

  private loop = (time: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (time - this.lastTime) / 1000)
    this.lastTime = time

    this.input.tick(dt)
    this.placement.tick(dt)
    this.render.tick(dt)
    this.connector.tick(dt)
    this.world.tick(dt)

    this.renderer.render(this.scene, this.camera)
  }

  private onResize = (): void => {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('resize', this.onResize)
    this.world.dispose()
    this.input.dispose()
    this.placement.dispose()
    this.render.dispose()
    this.connector.dispose()
    this.renderer.dispose()
  }
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep -v "Cannot find module 'three'"` (Three types will resolve after install)

Expected: No structural type errors in BuildEngine or system files.

- [ ] **Step 4: Commit**

```bash
git add src/engine/BuildEngine.ts src/engine/systems/
git commit -m "feat: BuildEngine skeleton with all system stubs"
```

---

## Task 7: WorldSystem — Three.js Scene

**Files:**
- Modify: `src/engine/systems/WorldSystem.ts`

- [ ] **Step 1: Implement WorldSystem with plate + lighting**

```typescript
// src/engine/systems/WorldSystem.ts
import * as THREE from 'three'
import type { BuildEngine } from '../BuildEngine'
import { GRID_BASE } from '../grid'

const PLATE_CELLS = 128              // 128 × 2mm = 256mm plate
const PLATE_SIZE = PLATE_CELLS * GRID_BASE
const PLATE_HEIGHT_CELLS = 128
export const PLAYER_HEIGHT = 28      // mm above plate

export class WorldSystem {
  private engine: BuildEngine
  private hemi!: THREE.HemisphereLight
  private sun!: THREE.DirectionalLight
  private plate!: THREE.Mesh
  private dayTime = 0.25             // 0-1, starts at day

  constructor(engine: BuildEngine) {
    this.engine = engine
  }

  init(): void {
    const { scene, camera } = this.engine

    // Background
    scene.background = new THREE.Color(0x88bbe8)
    scene.fog = new THREE.Fog(0xa8c8e8, 400, 1500)

    // Lighting
    this.hemi = new THREE.HemisphereLight(0xddeeff, 0x665544, 0.9)
    scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xffffff, 1.0)
    this.sun.position.set(200, 400, 250)
    scene.add(this.sun)

    // Build plate
    this.buildPlate()

    // Plate volume boundary lines
    const edges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(PLATE_SIZE, PLATE_SIZE, PLATE_SIZE)
    )
    const volLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00d563, transparent: true, opacity: 0.3 })
    )
    volLines.position.y = PLATE_SIZE / 2
    scene.add(volLines)

    // Camera start position
    camera.position.set(0, PLAYER_HEIGHT, PLATE_SIZE / 2 - 30)
    camera.lookAt(0, PLAYER_HEIGHT, 0)
  }

  private buildPlate(): void {
    const { scene } = this.engine
    const half = PLATE_SIZE / 2

    // Dark plate surface
    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_SIZE, 4, PLATE_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x222831 })
    )
    plateMesh.position.y = -2
    scene.add(plateMesh)
    this.plate = plateMesh

    // Grid texture on top
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2a3038'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#3a4048'
    for (let x = 8; x < 512; x += 16)
      for (let y = 8; y < 512; y += 16) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill()
      }
    ctx.fillStyle = '#00d563'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('MineStudio · 256×256mm', 16, 490)

    const tex = new THREE.CanvasTexture(canvas)
    const gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_SIZE - 4, PLATE_SIZE - 4),
      new THREE.MeshStandardMaterial({ map: tex })
    )
    gridMesh.rotation.x = -Math.PI / 2
    gridMesh.position.y = 0.05
    scene.add(gridMesh)

    // Outer frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_SIZE + 24, 8, PLATE_SIZE + 24),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8 })
    )
    frame.position.y = -6
    scene.add(frame)

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x555a62 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -10.1
    scene.add(ground)
  }

  tick(dt: number): void {
    // Day/night cycle: advance time
    this.dayTime = (this.dayTime + dt / 60) % 1  // 60 second full day

    const angle = this.dayTime * Math.PI * 2 - Math.PI / 2
    const sunX = Math.cos(angle) * 500
    const sunY = Math.sin(angle) * 500
    this.sun.position.set(sunX, sunY, 200)

    // Fade sky + light with time
    const dayFactor = Math.max(0, Math.sin(angle))
    const skyColor = new THREE.Color().lerpColors(
      new THREE.Color(0x0a0a1a),  // night
      new THREE.Color(0x88bbe8),  // day
      dayFactor
    )
    this.engine.scene.background = skyColor
    this.sun.intensity = dayFactor * 1.2
    this.hemi.intensity = 0.3 + dayFactor * 0.6

    // Write time to store
    const { useStore } = require('../../ui/store') // lazy import to avoid circular
    useStore.getState().setTimeOfDay(this.dayTime)
  }

  dispose(): void {
    // Three.js disposes geometry/material when scene is cleared
  }
}
```

> **Note on circular import:** The `require()` call in `tick()` is a lazy import to break the circular dependency between engine and store. In the next phase, replace with an event emitter pattern for cleaner decoupling.

- [ ] **Step 2: Commit**

```bash
git add src/engine/systems/WorldSystem.ts
git commit -m "feat: WorldSystem — Three.js plate, lighting, day/night cycle"
```

---

## Task 8: React App Shell

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/App.css`

- [ ] **Step 1: Create App.css**

```css
/* src/ui/App.css */
.app {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas-wrap {
  position: absolute;
  inset: 0;
}

.canvas-wrap canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.ui-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hud-top {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(13, 15, 18, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid #2a2f37;
  border-radius: 12px;
  padding: 10px 18px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #f4f5f7;
  display: flex;
  gap: 16px;
  pointer-events: none;
}

.hud-label { color: #8b8f97; margin-right: 4px; }
```

- [ ] **Step 2: Create App.tsx**

```typescript
// src/ui/App.tsx
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { BuildEngine } from '../engine/BuildEngine'
import { useStore } from './store'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BuildEngine | null>(null)
  const [ready, setReady] = useState(false)

  const playerPosition = useStore(s => s.playerPosition)
  const objectCount = useStore(s => s.objectCount)
  const selectedTool = useStore(s => s.selectedTool)

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BuildEngine(canvasRef.current)
    engineRef.current = engine
    engine.init()
    setReady(true)

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return (
    <div className="app">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {ready && (
        <div className="ui-overlay">
          <div className="hud-top">
            <span>
              <span className="hud-label">XYZ</span>
              {playerPosition.gx * 2}mm, {playerPosition.gy * 2}mm, {playerPosition.gz * 2}mm
            </span>
            <span>
              <span className="hud-label">SHAPES</span>
              {objectCount}
            </span>
            <span>
              <span className="hud-label">TOOL</span>
              {selectedTool}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Fix circular import in WorldSystem.tick**

Replace the `require()` in `WorldSystem.ts tick()` with a callback approach:

```typescript
// In WorldSystem, replace the require line with:
// Add to constructor parameter and class field:
private onTimeUpdate?: (t: number) => void

// Add method:
setTimeUpdateCallback(cb: (t: number) => void): void {
  this.onTimeUpdate = cb
}

// In tick, replace the require line with:
this.onTimeUpdate?.(this.dayTime)
```

Then in `BuildEngine.init()`, after `this.world.init()`:
```typescript
this.world.setTimeUpdateCallback((t) => {
  // Import store only in browser context
  import('../ui/store').then(({ useStore }) => {
    useStore.getState().setTimeOfDay(t)
  })
})
```

- [ ] **Step 4: Run dev server**

Run: `npm run dev`

Open browser at `http://localhost:5173`

Expected: Three.js scene visible — dark build plate with green grid dots, "MineStudio · 256×256mm" text on plate, sky with lighting. HUD shows "XYZ 0mm 28mm 228mm | SHAPES 0 | TOOL place".

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: All tests PASS (grid: 14, commands: 8, store: 8 = 30 total).

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/App.css src/engine/systems/WorldSystem.ts src/engine/BuildEngine.ts
git commit -m "feat: React shell + Three.js scene — Phase 1 complete"
```

---

## Phase 1 Done ✓

**Deliverables:**
- `npm run dev` → browser shows Three.js build plate with day/night cycle
- `npm test` → 30 tests pass
- Clean TypeScript, no `any` types
- All sub-system stubs in place, ready for Phase 2

**Next:** Run Phase 2A (World System), 2B (Block Registry), and 2C (UI Shell) in parallel — see `2026-05-09-master-roadmap.md`.
