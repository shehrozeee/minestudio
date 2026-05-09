# MineStudio — Master Roadmap

> **For agentic workers:** Each phase has its own detailed plan. Execute phases sequentially. Within a phase, tasks marked [PARALLEL] can run as concurrent subagents.

---

## Phase Dependency Graph

```
Phase 1: Foundation
  └─► Phase 2A: World + Scene        [PARALLEL]
  └─► Phase 2B: Block Registry       [PARALLEL]
  └─► Phase 2C: UI Shell             [PARALLEL]
        └─► Phase 3A: Input System
        └─► Phase 3B: Placement System
              └─► Phase 4A: Connector System   [PARALLEL]
              └─► Phase 4B: CSG System         [PARALLEL]
              └─► Phase 4C: Tools + Paint      [PARALLEL]
                    └─► Phase 5A: Validation + Export
                    └─► Phase 5B: Import System
                    └─► Phase 5C: Save / Load
                          └─► Phase 6: Polish + Controls Page
```

## Phase Summary

| Phase | Plan File | Goal | Milestone |
|---|---|---|---|
| 1 | `2026-05-09-phase1-foundation.md` | Scaffold + types + grid + commands + store + scene | `npm run dev` shows Three.js plate |
| 2A | `phase2a-world-system.md` | Printer mesh, sky, day/night, lamps | Full world visible |
| 2B | `phase2b-block-registry.md` | BlockDef registry, all geometries, RenderSystem instancing | Blocks placeable |
| 2C | `phase2c-ui-shell.md` | Hotbar, HUD, Inventory skeleton, ToolRing, Hints | UI overlay live |
| 3A | `phase3a-input-system.md` | Keyboard, mouse, gamepad + mapping layer | Full controls working |
| 3B | `phase3b-placement-system.md` | Raycasting, ghost, snapping, cell occupancy | Place + delete blocks |
| 4A | `phase4a-connector-system.md` | Connector registry, chain, ball/socket, pegs, mate annotations | Connectors + visual links |
| 4B | `phase4b-csg-system.md` | Web Worker, negative blocks, text, sink tool | CSG preview works |
| 4C | `phase4c-tools-paint.md` | Paint, eyedropper, fillet, measure, support, select+move | All tools complete |
| 5A | `phase5a-validation-export.md` | ValidationSystem, STL/3MF multi-body export | Export working |
| 5B | `phase5b-import.md` | STL/3MF/GLB import, 9-block normalize preview | Import working |
| 5C | `phase5c-save-load.md` | localStorage, .minstudio file, IndexedDB, migrations | Save/load complete |
| 6 | `phase6-polish.md` | Controls page, body naming, CSG mode toggle, full QA | Ship ready |
