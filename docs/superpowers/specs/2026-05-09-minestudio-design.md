# MineStudio — Design Spec
**Date:** 2026-05-09  
**Status:** Approved for implementation planning

---

## 1. Overview

MineStudio is a browser-based, first-person 3D builder targeting the Bambu Lab A1 FDM printer (256×256×256 mm build volume). The player stands on the printer's build plate, places and sculpts blocks, and exports print-ready STL or 3MF files.

Built by a dad for his kids. Open source, hosted on GitHub Pages or Cloudflare Pages, free forever.

**Design principle:** All registries (blocks, tools, connectors, hints) are data, not code. Kids give feedback → add a row, not rewrite a system.

---

## 2. Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript | Types = fewer agent mistakes, clear contracts |
| UI framework | React + Vite | Isolated components, vast training data, fast builds |
| 3D engine | Three.js r160 | Existing code base, well-documented |
| Materials | MeshStandardMaterial | Correct multi-light handling, looks better |
| State bridge | Zustand | Lightweight, no boilerplate, engine→React |
| CSG | three-bvh-csg | Best maintained, Web Worker compatible |
| Hosting | CF Pages / GitHub Pages | Static, free |

React owns UI. Three.js owns the canvas. They never touch each other — Zustand bridges them.

---

## 3. World

- Player spawns centered on a Bambu A1 build plate (256×256 mm)
- Printer body (frame, gantry beam, extruder carriage) rendered as static decorative mesh — uncollidable
- Sky uses Three.js `Sky` shader. Sun moves on a slow cycle (1 real minute = full day)
- Ambient + directional light tracks sun angle. Stars fade in at night
- XYZ position shown on HUD in mm, updates every frame
- **Lamps** (Torch / Lantern): placed like blocks, emit `PointLight`, `isPrintable: false`, capped at 6 per scene, excluded from all exports

---

## 4. Engine Architecture

### 4.1 Sub-systems

```
BuildEngine
  ├── WorldSystem       — scene, sky, day/night, printer mesh, lamps
  ├── InputSystem       — keyboard, mouse, gamepad (with mapping layer)
  ├── PlacementSystem   — raycasting, ghost preview, snapping, cell occupancy
  ├── RenderSystem      — InstancedMesh batching by defId+color+size
  ├── ConnectorSystem   — connector registry, chain links, mate annotations
  ├── CSGSystem         — three-bvh-csg, Web Worker, deferred build-mode ops
  ├── ValidationSystem  — body cluster checks, clearance checks, export warnings
  ├── ExportSystem      — STL/3MF serialization, multi-body, scale dialog
  ├── StorageSystem     — localStorage, IndexedDB, file I/O, quota management
  └── MigrationSystem   — versioned .minstudio save file migrations
```

Each sub-system = one file, one responsibility. `BuildEngine` wires them, does not implement them.

### 4.2 Command Pattern (Undo/Redo)

Every mutation is a `Command` object:

```typescript
interface Command {
  execute(): void
  undo(): void
  serialize(): string    // for future multiplayer
}
```

Stack: `history: Command[]`, cursor index. Cap: 100 steps general, 20 steps for CSG commands (warned before commit). Commands: `PlaceCommand`, `DeleteCommand`, `PaintCommand`, `TransformCommand`, `GroupCommand`, `CSGCommand`, `TextCommand`, `ChainCommand`, `MateCommand`.

### 4.3 Zustand Store

```typescript
// Engine writes, React reads
{
  selectedTool, ringOpen, ringType,
  selectedBlockDefId, selectedSize, selectedColor,
  inventoryOpen, inventoryTab,
  objectCount, undoAvailable, redoAvailable,
  timeOfDay, playerPosition,
  mateStep, sinkDepth,
  flyMode, supportMode, mode2D,
  bodyList: BodyDef[],
  validationWarnings: Warning[],
}
```

### 4.4 Gamepad Mapping

```typescript
// Check standard layout first
if (pad.mapping === 'standard') use STANDARD_MAP
else run one-time calibration wizard → store in localStorage keyed by pad.id
```

---

## 5. Grid System

```typescript
const GRID_BASE = 2          // mm — smallest unit
const SIZE_IN_UNITS = { normal: 1, large: 2, xl: 3 }

interface GridPos { gx: number; gy: number; gz: number }

// All positions stored as GridPos integers
// Convert to world coords only at render time
function toWorld(pos: GridPos): THREE.Vector3 {
  return new THREE.Vector3(pos.gx * GRID_BASE, pos.gy * GRID_BASE, pos.gz * GRID_BASE)
}
```

**Cell occupancy map:**
```typescript
const occupied = new Set<string>()
// key = "gx,gy,gz"
// each block registers ALL cells it occupies on placement
// O(1) lookup, works for all sizes
```

**Rotations: 90° snaps only.** Free rotation disabled — preserves grid alignment and print predictability.

**Mixed sizes:** Normal (2mm) is base unit. Large occupies 2×2×2 Normal cells. XL occupies 3×3×3. All sizes align because 4 and 6 are multiples of 2.

---

## 6. Block System

### 6.1 Sizes

| Size | MM | Grid step | Fits in XL |
|---|---|---|---|
| Normal | 2mm | 2mm | 27 (3³) |
| Large | 4mm | 4mm | — |
| XL | 6mm | 6mm | 1 |

### 6.2 Block Data Model

```typescript
interface BlockDef {
  id: string
  label: string
  category: 'basic' | 'round' | 'partial' | 'connector' | 'utility' | 'custom'
  isPrintable: boolean
  exportBehavior: 'standard' | 'isolated' | 'clearance-required'
  availableSizes: BlockSize[]
  makeGeometry: (unitSize: number) => THREE.BufferGeometry
}

interface PlacedObject {
  id: number
  defId: string
  size: BlockSize
  position: GridPos
  rotation: { x: 0|90|180|270, y: 0|90|180|270, z: 0|90|180|270 }
  color: string
  faceColors?: string[6]          // set only when face-painted
  isNegative: boolean             // red/transparent, CSG subtract on export
  isPrintable: boolean
  isSupport: boolean
  light?: THREE.PointLight        // lamps only
  bodyId?: string                 // auto-assigned by union-find on export
}
```

**ObjectStorage — hybrid:**
```typescript
type ObjectStorage =
  | { kind: 'grid' }                      // unmodified, uses PlacedObject.position
  | { kind: 'imported'; geometry: ArrayBuffer; scaleBlocks: number }  // STL/3MF/GLB imports
```

### 6.3 Block Catalog

| Category | Items |
|---|---|
| Basic | Cube, Slab (½h), Stair, Wedge/ramp, Wall (¾h), Post (¼×¼), Pane (thin sheet), Carpet (5%), Door, Trapdoor |
| Round | Sphere, Cylinder, Cone, Torus, Tube (hollow), Arch |
| Connector | Ball joint (3 sizes), Socket (3 sizes), Chain hook, Peg 1×/2×/3×, Slot 1×/2×/3× |
| Utility | Torch (warm PointLight), Lantern (neutral PointLight) — not printable |
| Custom | User-saved block groups (IndexedDB) |

**Partial depth elements (Peg/Slot):** 1× = 20% depth, 2× = 40%, 3× = 60% of unit size. Stackable.

**Fillet block:** Quarter-sphere (corners), quarter-torus (edges). Placed manually or auto-inserted when two flat axis-aligned faces share an edge.

### 6.4 Color System

- 16 base colors mapped to Bambu filament palette
- Paint tool: whole block (RT) or single face (LB+RT)
- Color stored per `PlacedObject`. Face colors stored in `faceColors[6]` only when face-painted
- Eyedropper tool samples color from any placed block

---

## 7. Connector System

### 7.1 Connector Registry

```typescript
interface ConnectorDef {
  id: string
  label: string
  matesWith: string[]
  clearance: number       // mm gap required for function after print
  bodyRule: 'different'   // mating connectors must be on separate export bodies
  role: 'male' | 'female' | 'neutral'
}

const CONNECTORS: ConnectorDef[] = [
  { id: 'peg',    label: 'Peg',        matesWith: ['slot'],   clearance: 0.2, bodyRule: 'different', role: 'male'    },
  { id: 'slot',   label: 'Slot',       matesWith: ['peg'],    clearance: 0.2, bodyRule: 'different', role: 'female'  },
  { id: 'ball',   label: 'Ball Joint', matesWith: ['socket'], clearance: 0.3, bodyRule: 'different', role: 'male'    },
  { id: 'socket', label: 'Socket',     matesWith: ['ball'],   clearance: 0.3, bodyRule: 'different', role: 'female'  },
  { id: 'hook',   label: 'Chain Hook', matesWith: ['hook'],   clearance: 0.5, bodyRule: 'different', role: 'neutral' },
]
```

Adding a new connector type = one entry. All validation and alignment logic applies automatically.

### 7.2 Chain System

Chain is a connection between two blocks, not a standalone block:

1. Place Block A → attach Chain Hook to a face (snaps to face, exported as part of that block's body)
2. Place Block B → attach Chain Hook to a face
3. Select Chain tool → click Hook A → click Hook B → engine auto-calculates link count from distance, places links with correct droop
4. Links = `clearance-required`, separate export body, never merged with blocks

Link count rounding: round to nearest integer, distribute spacing evenly (±0.3mm spread — invisible at scale).

`ChainCommand` wraps hook placement + all link generation as one undoable unit.

### 7.3 Mate Annotations

Visual assembly guide — never exported.

```typescript
interface MateAnnotation {
  id: number
  connectorAId: number
  connectorBId: number
  color: string            // auto-assigned unique per pair
  line: THREE.Line         // bezier arc curving over geometry
  label: THREE.Sprite      // "Joint 1" at arc midpoint
}
```

**Workflow:** Equip Mate tool → RT on connector A → RT on compatible connector B → arc appears. Unmatched connectors pulse softly. Matched connectors show ring in pair color. Toggle visibility: `Tab` / `Back+LB`.

Saved in `.minstudio` JSON. Excluded from STL/3MF export.

### 7.4 Placement-time Feedback

- Select male connector → nearby compatible females on different bodies glow green
- Same-body conflict → glow red, toast: `"⛔ Ball and socket on same part — won't articulate"`
- Chain placed within 0.5mm of non-chain geometry → toast: `"⚠ Chain may fuse when printed"`

---

## 8. CSG System

### 8.1 Build Mode vs CSG Mode

**Build mode (default):** All operations are grid-based. Negative blocks placed like normal blocks — red wireframe, ~40% opacity. Text stamps placed as negative markers on faces. Sink positions block with overlap, marks pending. Nothing computed. Full undo at `GridPos` cost.

**CSG Preview (explicit):** User clicks "Preview CSG" or triggers export. Web Worker runs all pending operations. Result rendered in viewport. User can revert to build mode — grid objects untouched.

**Export:** Always runs CSG pipeline before serialization. User never has to manually preview before export.

### 8.2 Web Worker Protocol

Only `ArrayBuffer` (typed arrays, transferable, zero-copy) crosses the thread boundary. No Three.js objects sent to worker.

```typescript
// Main → Worker
{ op: 'subtract' | 'union', targetBuffer: ArrayBuffer, toolBuffer: ArrayBuffer }

// Worker → Main
{ resultBuffer: ArrayBuffer }
```

### 8.3 Text Tool

Aim at block face → RT/Space → mouse freed → dialog: text input, font size (S/M/L), depth (1×/2×/3×), mode (emboss/deboss). Confirm → `TextGeometry` generated using bundled Helvetiker font → placed as negative (deboss) or positive (emboss) marker. CSG applied on preview/export. `TextCommand` = one undoable unit.

### 8.4 Sink Tool

Equip Sink tool → place block normally → hold RT to push it into adjacent block. Left stick / scroll = fine depth control. HUD shows depth % live. Release = commit marker. Offset preset mode: D-pad offers -20/-40/-60% snaps.

---

## 9. Validation System

Runs before every export. Also fires placement-time checks.

```
Pre-export pass:
  For each PlacedObject with ConnectorDef:
    if mating pair in same body cluster → hard error, block export
    if clearance gap < ConnectorDef.clearance → warning
  For each chain-link:
    if within 0.5mm of non-chain geometry → warning
  For each isolated object:
    if fully inside another object → warning

Show dialog:
  ⛔ [errors] — must fix before export
  ⚠ [warnings] — can export anyway
  [Fix it] [Export anyway]
```

---

## 10. Tools

### 10.1 Tool List

| Tool | Action |
|---|---|
| Place | Place selected block from hotbar |
| Erase | Remove aimed block |
| Paint | Color block (RT) or face (LB+RT) |
| Eyedropper | Sample color from block |
| Text | Emboss/deboss text on block face |
| Select+Move | Grab and reposition placed block |
| Sink | Push block into adjacent (A+B modes) |
| Mate | Link compatible connectors |
| Fillet | Auto-insert fillet at shared flat edge |
| Support | Place/remove manual support rod |
| Measure | Display mm distance between two points |

### 10.2 Radial Tool Ring

Hold `X (controller)` / Hold `T (keyboard)` → ring appears centered on screen. Right stick / mouse = direction → nearest segment highlights + expands with one-line context description. Release → selects. Ring stays live (no slowdown — nothing moves during building).

12-segment clock-face layout. Center shows current active tool.

**Category Ring:** Hold `D-pad Up` → category ring, right stick selects tab, release opens inventory at that tab.

### 10.3 Contextual Hint Strip

Bottom-left, always visible, max 4 hints. Driven by Zustand state via `HintDef[]` registry:

```typescript
interface HintDef {
  condition: (state: AppState) => boolean
  hints: { binding: string; label: string }[]
}
```

New tool/mode → new `HintDef` entry. Nothing else changes.

---

## 11. Input Mapping

### 11.1 Xbox Controller

```
Left stick       Walk / strafe
Right stick      Look
RT               Primary action (place / paint / confirm)
LT               Erase (always, any tool)
X (hold)         Tool ring
X (tap)          Reserved
Y                Cycle block size (Normal → Large → XL)
LB               Prev hotbar slot (tap) / Descend in fly mode
RB               Next hotbar slot (tap) / Rise in fly mode
D-pad Left/Right Cycle hotbar slot
D-pad Up (tap)   Open full inventory
D-pad Up (hold)  Category ring
D-pad Down       Cycle hotbar row
Back             Undo
Back + A         Redo
Back + LB        Toggle mate annotation layer
Start            Pause / main menu
A (double-tap)   Toggle fly mode

── Select+Move tool ──
D-pad            Move on XZ plane
RB / LB          Move up / down
RT               Drop (confirm)
B                Cancel (restore original position)

── Text tool ──
RT on face       Free mouse, open text dialog
Enter            Confirm text
B / Esc          Cancel
```

### 11.2 Mouse + Keyboard

```
WASD / Arrows    Walk
Mouse            Look
Space / LMB      Primary action
X                Erase
R / F            Fly up / down
Double-tap 0     Toggle fly mode
Scroll wheel     Cycle hotbar
1–9              Select hotbar slot
Tab              Open / close inventory
T (hold)         Tool ring
[ / ]            Block size down / up
Q / E            Prev / next color
Ctrl+Z           Undo
Ctrl+Shift+Z     Redo
Shift+Space      Paint single face (paint tool)
G                Grab / move mode
Esc              Pause
Double-click     Free mouse (menu mode)
```

---

## 12. Inventory + Hotbar

- **Hotbar:** 9 slots, bottom of screen, Minecraft-style. Drag to reorder.
- **Full inventory:** `Tab` / `D-pad Up` → full-screen overlay, tabs per category, search bar.
- **My Blocks tab:** user-saved custom block groups, stored in IndexedDB.
- **Body list panel:** lists all export bodies, user can name them (`Torso`, `Left Arm`). Names used in export filenames.

---

## 13. Import

| Format | Loader | Notes |
|---|---|---|
| STL | `STLLoader` | Normalize to 9-block preview, no unit assumption |
| 3MF | `3MFLoader` | Preserve multi-body structure where possible |
| GLB | `GLTFLoader` | Community models, session inventory only |

**STL import flow:**
```
Load → compute bounding box →
normalize: longest axis = 9 Normal blocks (18mm), aspect ratio kept →
preview in viewport (green wireframe + bounding box + grid cell highlight) →
LB/- = scale down 1 block | RB/+ = scale up 1 block →
HUD shows: "18mm × 12mm × 6mm · 9×6×3 blocks" →
RT/Space = confirm place | B/Esc = cancel →
Toast: "Save as reusable block? [Y]"
```

Imported objects stored as `{ kind: 'imported', geometryBuffer: ArrayBuffer, scaleBlocks: number }`.

---

## 14. Export

### 14.1 Export Pipeline

```
1. ValidationSystem.check() → show errors/warnings dialog
2. Filter isPrintable === false (lamps, annotations, measure lines)
3. Union-find cluster standard objects (touching/overlapping)
4. Isolate connectors per exportBehavior
5. Apply connector clearance gaps (baked into geometry)
6. CSGSystem.bake() — apply all pending negative/sink/text ops via Web Worker
7. Serialize → chosen format
8. Offer download
```

### 14.2 Export Options

| Option | Output |
|---|---|
| Export all (3MF) | Full plate, all bodies, one `.3mf` multi-body |
| Export selected body (3MF) | Chosen cluster only, one `.3mf` |
| Export all (STL) | One `.zip`, one `.stl` per body, named by body label |
| Export selected body (STL) | Single `.stl`, merged geometry |

### 14.3 3MF Multi-body Structure

```
3MF file
  ├── Body clusters (standard)    → <object type="model"> per cluster
  ├── Isolated connectors         → <object type="model"> each
  ├── Chain links                 → <object type="model"> per chain
  └── Support rods                → <object type="support"> (Bambu removes these)
```

Mate annotations, lamps, measure lines → excluded entirely.

---

## 15. Save / Load

**Auto-save:** `StorageSystem` writes scene to `localStorage` every 30 seconds + on every command execute. Restores on app load.

**Named slots:** 5 slots in `localStorage`. User names them in pause menu.

**File format (`.minstudio`):**
```typescript
{
  version: number,
  objects: PlacedObject[],      // GridPos integers — no float drift
  importedObjects: ImportedObjectRecord[],
  mates: MateAnnotation[],
  customBlocks: CustomBlockDef[],
  bodies: BodyDef[],            // names
  camera: { position: GridPos, rotationY: number }
}
```

File import: drag-and-drop onto canvas or file picker. Validates version, runs migrations.

**Custom blocks:** IndexedDB, GLB blobs. Storage usage shown in Settings. Toast warning at 50MB. "Clear custom blocks" button.

### 15.1 Migration System

```typescript
const MIGRATIONS: ((data: any) => any)[] = [
  null,          // v0 (unused)
  (d) => d,      // v1 → identity (current version)
  // v2+ added here as features ship
]

function migrate(data: any): any {
  let d = data
  for (let v = data.version; v < CURRENT_VERSION; v++) {
    d = MIGRATIONS[v + 1](d)
  }
  return d
}
```

---

## 16. Controls Reference + UI

### 16.1 Controls Page
Full-screen overlay from pause menu. Two panels: Xbox controller diagram with callouts (left), keyboard/mouse reference (right). Tabbed: `General` · `Building` · `Tools` · `Connectors` · `Export`.

### 16.2 Contextual Hints
Always-visible strip bottom-left. Max 4 hints. Changes per tool/mode via `HintDef[]`. See Section 10.3.

### 16.3 HUD Elements
- XYZ position (mm)
- Current tool
- Selected block + size
- Selected color
- Object count (printable only)
- Body count
- Fly mode indicator
- Negative mode indicator (when negative block selected)
- CSG pending indicator (when unsaved CSG ops exist)

---

## 17. Performance

- `RenderSystem` groups `PlacedObject[]` by `defId+color+size` → `InstancedMesh` batches
- Updates on every command (not every frame)
- Imported objects = individual meshes (not instanced, arbitrary geometry)
- MeshStandardMaterial throughout
- PointLight cap: 6 lamps max per scene
- TextGeometry font: bundled Helvetiker JSON in `/assets` — no CDN dependency

---

## 18. v2 Multiplayer (Architecture Note)

Multiplayer is out of scope for v1 but the architecture is ready. Command pattern already serializable. Recommended approach:

**PartyKit** — managed WebSocket service built on Cloudflare Durable Objects. Zero deployment, free tier, works across internet (not just local network). Kids on separate devices, separate rooms, anywhere.

```typescript
import PartySocket from "partysocket"
const socket = new PartySocket({ host: PARTYKIT_HOST, room: sessionCode })
socket.onmessage = (e) => commandBus.executeRemote(Command.deserialize(e.data))
commandBus.onExecute = (cmd) => socket.send(cmd.serialize())
```

- 6-character room code, no accounts
- Each player sees other's ghost (coloured)
- Undo affects own commands only
- CSG preview = local only
- 2 players max for v2

`NetworkSystem` sub-system slot already reserved in `BuildEngine`.

---

## 20. Out of Scope (v1)

- Multiplayer (v2 — Cloudflare Durable Objects or PartyKit, architecture ready)
- Mobile / tablet (PointerLockControls = desktop only)
- Touch controls
- Voice / chat
- User accounts
- Cloud save
- Free rotation (90° snaps only in v1)
- Curved surface auto-fillet (flat faces only)
- Free-form mesh smoothing

---

## 21. Project Structure

```
/
├── src/
│   ├── engine/
│   │   ├── BuildEngine.ts
│   │   ├── systems/
│   │   │   ├── WorldSystem.ts
│   │   │   ├── InputSystem.ts
│   │   │   ├── PlacementSystem.ts
│   │   │   ├── RenderSystem.ts
│   │   │   ├── ConnectorSystem.ts
│   │   │   ├── CSGSystem.ts
│   │   │   ├── ValidationSystem.ts
│   │   │   ├── ExportSystem.ts
│   │   │   ├── StorageSystem.ts
│   │   │   └── MigrationSystem.ts
│   │   ├── commands/
│   │   ├── registries/
│   │   │   ├── blocks.ts
│   │   │   ├── connectors.ts
│   │   │   └── hints.ts
│   │   └── workers/
│   │       └── csg.worker.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── Hotbar.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── HUD.tsx
│   │   │   ├── ToolRing.tsx
│   │   │   ├── ContextualHints.tsx
│   │   │   ├── ControlsPage.tsx
│   │   │   ├── ExportDialog.tsx
│   │   │   ├── TextDialog.tsx
│   │   │   ├── ImportPreview.tsx
│   │   │   └── BodyList.tsx
│   │   └── store.ts             (Zustand)
│   └── assets/
│       └── fonts/
│           └── helvetiker.json
├── public/
├── index.html
└── vite.config.ts
```
