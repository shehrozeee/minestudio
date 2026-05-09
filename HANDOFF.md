# MineStudio — Session Handoff

## What This Is

A dad is rebuilding a 3D printer builder app his kid made (single HTML file) into a proper open source app. The kid uses it to design shapes for a Bambu Lab A1 FDM printer.

## Current State

All phases through Phase 6 plus full spec gap audit are COMPLETE.

**Build status:** `npx tsc --noEmit` → 0 errors. `npx vitest run` → 167 tests passing (16 test files).

### What's Been Built

**Engine systems (src/engine/):**
- `BuildEngine.ts` — orchestrator; wires all systems; animates at 60 fps; subscribes store for annotation visibility sync
- `types.ts` — canonical type definitions (PlacedObject, BlockDef, ConnectorDef, MateAnnotation, SaveFile, AppState, ...)
- `grid.ts` — OccupancyMap, toWorld, snapToGrid, GRID_BASE=2
- `commands/` — Command + CommandBus (100-step undo), PlaceCommand, DeleteCommand, PaintCommand, BulkPlaceCommand, SetBodyNameCommand, ChainCommand
- `systems/WorldSystem.ts` — build plate, sky/day cycle, lamp PointLights (torch/lantern, max 12), syncLamps()
- `systems/InputSystem.ts` — keyboard + full Xbox gamepad mapping (all buttons, sticks, triggers, combos)
- `systems/PlacementSystem.ts` — ghost preview, raycast, place/erase/paint/connector-glow
- `systems/RenderSystem.ts` — Three.js mesh lifecycle, getMesh()
- `systems/ConnectorSystem.ts` — mate annotation arcs (bezier + sprite label), unmatched connector pulse, getMates(), setAnnotationsVisible()
- `systems/CSGSystem.ts` — negative block CSG (deferred, web worker)
- `systems/ValidationSystem.ts` — floating block, overlap, volume checks
- `systems/ExportSystem.ts` — STL, STL-zip, 3MF export; full exportAll() pipeline with validation gate
- `systems/StorageSystem.ts` — auto-save, 5 named save slots, drag-drop import (.minstudio / .stl / .glb)
- `systems/MigrationSystem.ts` — save file versioning
- `systems/ImportSystem.ts` — STL + GLB import → grid voxels

**Registries:**
- `registries/blocks.ts` — full block catalog: basic shapes, round, partial, connectors, lamps (torch, lantern), fillet, peg/slot variants, chain hook
- `registries/connectors.ts` — connector mating rules
- `registries/hints.ts` — contextual hint definitions

**UI (src/ui/):**
- `store.ts` — Zustand store (all AppState fields + actions)
- `App.tsx` — canvas + all overlays; handleExport → engine.exporter.exportAll()
- `components/HUD.tsx`, `Hotbar.tsx`, `ColorPicker.tsx`, `ContextualHints.tsx`, `ToolRing.tsx`
- `components/BodyNamePanel.tsx`, `BodyList.tsx`
- `components/ControlsPage.tsx` — full controls reference
- `components/Inventory.tsx` — Tab-open block catalog by category
- `components/ExportDialog.tsx` — format picker
- `components/PauseMenu.tsx` — save/load named slots (fires CustomEvents to StorageSystem)
- `components/ImportPreview.tsx` — confirm/cancel imported block placement

**Key wiring:**
- `commandBus.onChange` → `world.syncLamps(objects)` (lamps stay in sync after every undo/redo)
- store `annotationsVisible` subscriber → `connector.setAnnotationsVisible()` (annotation toggle works from gamepad Back+LB)
- `connector.tick(dt)` + `placement.tick(dt)` called in animate loop
- `StorageSystem` listens for `minestudio:save-slot` + `minestudio:load-slot` from PauseMenu
- `ExportSystem.getMates()` used by StorageSystem.buildSaveFile()

### Original Files (reference only, do not modify)
- `shape_studio.html` — original working app
- `docs/superpowers/specs/2026-05-09-minestudio-design.md` — FULL design spec
- `docs/superpowers/plans/2026-05-09-master-roadmap.md` — all phases overview
- `docs/superpowers/plans/2026-05-09-phase1-foundation.md` — Phase 1 detailed plan

## Known Issues

None. All TypeScript errors resolved, all tests passing.

The `HTMLCanvasElement.prototype.getContext` stderr messages in `connector.test.ts` are expected jsdom limitations (canvas API not available in Node.js without the `canvas` npm package). These do not cause test failures — all 17 connector tests pass. The label sprite in `createMateVisual` gracefully handles `ctx === null`.

## What To Build Next

Phase 7 candidates (from master roadmap):
- Multiplayer via PartyKit (see `memory/project_multiplayer_partykit.md`)
- CSG preview (negative block rendering in build mode)
- Text tool (THREE.TextGeometry with helvetiker font)
- Fillet tool (live mesh rounding on selected faces)
- Measure tool (distance readout between two points)
- Deploy to Cloudflare Pages / GitHub Pages

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
