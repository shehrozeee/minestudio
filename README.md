# MineStudio

First-person 3D voxel builder that exports print-ready 3MF for the **Bambu Lab A1**. Block out a model in your browser, paint each piece, hit export, drop the file into Bambu Studio. Multi-color via AMS works automatically — every paint color becomes its own filament slot.

> **Live demo:** https://minestudio.inniapps.com
>
> **License:** PolyForm Noncommercial 1.0.0 — free for personal, hobby, educational, and noncommercial organizational use. Commercial use requires a separate license.

---

## What it's for

A friendlier-than-CAD on-ramp for kids (and adults) who want to build a real, printable 3D thing without learning Fusion or Blender. You walk around a virtual 256×256mm Bambu A1 build plate in first person, snap blocks together, paint them, and export. The file lands in Bambu Studio with colors mapped to AMS slots; you press print.

## Features

- **First-person voxel builder** — WASD or controller, mouse-look or right stick.
- **Multi-color via Bambu AMS** — paint any block, each unique color becomes a filament slot in the exported 3MF.
- **Multi-plate** — keep separate prints in one project; switch with `Ctrl+1..9`.
- **Bambu-compatible 3MF export** — full `paint_color` per triangle, `project_settings.config`, per-plate `plate_N.json`, production-extension XML structure that matches what Bambu Studio reads.
- **STL ZIP export** — when you want one STL per body or per plate.
- **Connector blocks** — pegs, sockets, ball joints, chains. Compatible connectors glow green when you place a mating piece.
- **Lamps with real light** — torches and lanterns emit warm point lights and glow.
- **Aim highlight** — the block your crosshair touches gets outlined so you know what you'll hit.
- **Save slots** — 5 named save slots in localStorage.
- **Xbox controller support** — full first-class controller play.

## Quick start

```bash
git clone https://github.com/shehrozeee/minestudio.git
cd minestudio
npm install
npm run dev
```

Open http://localhost:5173. Click anywhere (or press **A** on a controller) to start.

## Controls

### Keyboard + mouse

| Action | Key |
|---|---|
| Move | WASD / arrows |
| Look | Mouse |
| Place block | Left click |
| Erase | Right click / X |
| Fly toggle | Double-tap 0 |
| Rise / sink (fly) | Space / Ctrl-or-F |
| Hotbar 1–9 | 1..9 |
| Cycle tool | T (tap) — open ring on hold |
| Inventory | Tab |
| Cycle color | Q / E |
| Cycle size | [ / ] |
| Negative block | N |
| Paint tool toggle | P |
| Rotate placement | R (yaw) · Shift+R (pitch) · Ctrl+R (roll) |
| Switch plate | Ctrl+1..9 |
| Add plate | Ctrl+= |
| Pause menu | Esc |
| Controls page | F1 or ? |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z |
| Export | Ctrl+Shift+E |
| Save | Ctrl+S |

### Xbox controller

| Action | Button |
|---|---|
| Start game | A |
| Move | Left stick |
| Look | Right stick |
| Place block | RT |
| Erase | LT |
| Fly toggle | Double-tap A or B |
| Rise / sink (fly) | RB / LB |
| Hotbar prev/next | LB / RB (walking) |
| Color prev/next (paint mode) | D-pad ←→ |
| Inventory | D-pad ↑ tap (B closes any menu) |
| Tool ring | Hold X — flick left stick to choose, release to commit |
| Category ring | Hold D-pad ↑ |
| Rotate placement | Y (yaw), Back+Y (pitch), Start+Y (roll) |
| Cycle size | D-pad ↓ |
| Pause menu | Start |
| Undo | Back |
| Redo | Back + A |
| Toggle annotations | Back + LB |

## Export

`Ctrl+Shift+E` opens the export dialog:

- **3MF (all)** — everything across all plates as a single `.3mf` Bambu Studio loads with one click. Every distinct color becomes its own filament slot. Multi-plate projects emit one `<plate>` block per plate.
- **STL (all)** — all printable blocks merged into one `.stl`.
- **STL ZIP** — one `.stl` per named body group; multi-plate gets one folder per plate.

## Architecture (one-paragraph tour)

`src/engine/BuildEngine.ts` owns a Three.js scene plus a stack of systems: `WorldSystem` (lighting, plate, sky), `InputSystem` (keyboard, mouse-look via PointerLockControls, gamepad polling), `PlacementSystem` (raycast → ghost preview → command-bus PlaceCommand), `RenderSystem` (mesh-per-object, plate-aware visibility), `ConnectorSystem` (glow when compatible mate is selected, mate annotations), `CSGSystem` (negative-block subtraction via three-bvh-csg), `ValidationSystem` (floating block warnings, connector body-rule errors), `ExportSystem` (3MF + STL writer), `StorageSystem` (5 named save slots in localStorage). State lives in a single Zustand store (`src/ui/store.ts`); React renders the HUD/hotbar/menus on top of the canvas. Commands go through a `CommandBus` for undo/redo. There is no build step at runtime — Vite + ES modules.

## Acknowledgements

Built for kids who wanted to print stuff without learning CAD. The 3MF format reverse-engineered from sample files exported by Bambu Studio.

Three.js · React · Zustand · JSZip · three-bvh-csg.

## Contributing

PRs welcome for bug fixes, controller mappings, new block types, and printer profiles. Please keep the codebase free of hard dependencies on commercial APIs.

## License

Source under [PolyForm Noncommercial License 1.0.0](LICENSE). You can read it, run it, modify it, share modifications, and use it for any noncommercial purpose. You cannot use it commercially without a separate written agreement.
