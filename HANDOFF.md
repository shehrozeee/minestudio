# MineStudio — Session Handoff

## What This Is

A dad is rebuilding a 3D printer builder app his kid made (single HTML file) into a proper open source app. The kid uses it to design shapes for a Bambu Lab A1 FDM printer.

## Current State

- `shape_studio.html` — original working app (reference only, do not modify)
- `docs/superpowers/specs/2026-05-09-minestudio-design.md` — FULL design spec (read this first)
- `docs/superpowers/plans/2026-05-09-master-roadmap.md` — all phases overview
- `docs/superpowers/plans/2026-05-09-phase1-foundation.md` — Phase 1 detailed plan (start here)
- **Git NOT initialized yet** — must do `git init` as first step
- **No app code written yet** — everything is spec + plan only

## What Needs To Happen

Execute Phase 1 from `docs/superpowers/plans/2026-05-09-phase1-foundation.md`.

**Critical first steps (in order):**
1. `git init` in the project root
2. Commit existing files (CLAUDE.md, shape_studio.html, docs/)
3. Create branch `feat/phase1-foundation`
4. Create `src/engine/types.ts` FIRST — this is the source of truth for all type names
5. Create `CONTRACTS.md` — lists all exported symbols so agents don't invent their own names
6. Then implement remaining tasks

## Tech Stack Decisions (Final, No Changes)

```
Language:      TypeScript (strict)
UI:            React 18 + Vite 5
3D:            Three.js r160
State:         Zustand 4
Testing:       Vitest + @testing-library/react
Materials:     MeshStandardMaterial (not Lambert)
CSG:           three-bvh-csg (Web Worker, deferred)
Grid base:     2mm (GRID_BASE = 2)
Rotations:     90° snaps only (no free rotate v1)
Hosting:       Cloudflare Pages or GitHub Pages (static)
```

## Key Architecture Decisions

- **React owns UI** (Hotbar, Inventory, HUD, ToolRing, Hints, Dialogs)
- **Three.js engine owns canvas** — React NEVER touches Three.js directly
- **Zustand bridges them** — engine writes state, React reads it
- **Command pattern** — every mutation is a Command with execute() + undo(), 100-step stack
- **CSG is deferred** — negative blocks are markers in build mode, CSG runs only on Preview/Export
- **Grid is integer coords** — GridPos {gx, gy, gz}, toWorld() only at render time
- **All positions are GridPos** — no floating point in scene data

## Source of Truth Rules

**The `src/engine/types.ts` file defines ALL shared interfaces.** Every agent must read it before writing code. No agent may invent type names not in that file.

**The `CONTRACTS.md` file maps every file to its exact exports.** Agents must check it before importing anything.

Key type names (DO NOT deviate):
- `BlockSize = 'normal' | 'large' | 'xl'`
- `GridPos = { gx: number; gy: number; gz: number }`
- `PlacedObject` — see types.ts for full shape
- `BlockDef` — see types.ts
- `ConnectorDef` — see types.ts
- `AppState` — see types.ts
- `GRID_BASE = 2` — in grid.ts
- `SIZE_IN_UNITS = { normal: 1, large: 2, xl: 3 }` — in grid.ts
- `CommandBus` — in commands/Command.ts
- `OccupancyMap` — in grid.ts
- `BuildEngine` — in BuildEngine.ts
- `useStore` — in ui/store.ts

## File Structure (Create Exactly This)

```
src/
  engine/
    types.ts                    ← SOURCE OF TRUTH — create first
    grid.ts                     ← toWorld, snapToGrid, OccupancyMap
    BuildEngine.ts
    commands/
      Command.ts                ← Command interface + CommandBus
    systems/
      WorldSystem.ts
      InputSystem.ts
      PlacementSystem.ts
      RenderSystem.ts
      ConnectorSystem.ts
      CSGSystem.ts
      ValidationSystem.ts
      ExportSystem.ts
      StorageSystem.ts
      MigrationSystem.ts
    registries/
      blocks.ts
      connectors.ts
      hints.ts
    workers/
      csg.worker.ts
  ui/
    store.ts                    ← Zustand store
    App.tsx
    App.css
    components/                 ← all React components here
  assets/
    fonts/
      helvetiker.json
  main.tsx
tests/
  engine/
    grid.test.ts
    commands.test.ts
  ui/
    store.test.ts
  setup.ts
index.html
vite.config.ts
tsconfig.json
package.json
CONTRACTS.md
```

## Phase 1 Goal

`npm run dev` opens browser showing Three.js build plate (dark surface, green grid dots, sky).
`npm test` passes 30 tests (grid: 14, commands: 8, store: 8).

## What Went Wrong This Session

- Git init kept failing with internal tool errors
- Agent dispatch got stuck trying to read skill template files
- Bash tool had repeated internal errors

## User Preferences (Important)

- Caveman mode ULTRA — terse responses
- User is a dad building this for his kids, not a dev
- Trust Claude's architecture decisions, don't ask user to choose tech
- Do NOT prompt for confirmation between tasks — just execute
- Tests required for everything
- Source of truth doc must exist before any parallel agent work
- Audit code quality at end of each phase

## What To Build After Phase 1

See `docs/superpowers/plans/2026-05-09-master-roadmap.md` for all phases.
Phase 2 runs three parallel streams: World System, Block Registry, UI Shell.
