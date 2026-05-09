# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Single-file browser app: `shape_studio.html`. First-person 3D shape placer targeting the Bambu Lab A1 printer (256×256×256 mm build volume). No build step, no dependencies to install. Open in any modern browser.

## Running

```
# Just open the file — no server needed for most browsers.
# Chrome/Edge require a local server for ES modules:
npx serve .
# or
python -m http.server 8080
```

## Architecture

Everything lives in `shape_studio.html` as one ES module `<script type="module">`. Three major sections:

**Rendering (Three.js r160, CDN)**
- `PointerLockControls` for first-person mouse look
- Ghost preview mesh follows the raycast hit point, snapped to `SHAPE_SIZE`=6mm grid
- `camStateChanged()` throttles the raycast to only fire when player or scene changes

**Object model**
- `objects[]` array: `{ id, mesh, type, color, colorName, isSupport }`
- Shapes can be `THREE.Mesh` (primitives) or `THREE.Group` (chain, ball joint, socket, hand, claw, fist)
- `isSupport: true` marks auto-generated and manual support rods — they export as `type="support"` in 3MF so Bambu Studio treats them as removable supports

**Placement modes** (mutually exclusive flags):
- `mode2D` — flat disc only
- `sideways` — rotates shape 90° on Z (or X for 2D)
- `chainMode` / `ballMode` / `socketMode` / `handMode` — special compound geometry modes
- `supportMode` — `'off' | 'vertical' | 'horizontal'`

**Export (`build3mf`)**
- Uses JSZip (Skypack CDN) to produce a valid 3MF ZIP
- Overlapping regular shapes are union-found into clusters and merged into one `<object>` each to avoid Bambu Studio collision warnings
- Supports stay as separate `type="support"` objects
- Coordinate system conversion: Three.js Y-up → 3MF Z-up (`x, -z, y`)

**Input**
- Keyboard: `keydown`/`keyup` on `document`
- Gamepad: `tickGamepad(dt)` polls `navigator.getGamepads()` each frame, edge-detects buttons via `gamepadState.prev`
- Double-tap `0` = fly toggle; double-tap `P` = grab/drop shape

## Key Constants

```js
PLATE_SIZE = 256   // mm, matches Bambu A1 bed
PLATE_HEIGHT = 256
SHAPE_SIZE = 6     // mm grid unit and default shape size
REACH = 90         // max raycast distance in mm
WALK_SPEED = 80    // mm/s
FLY_SPEED = 120    // mm/s
```

## Shape Geometry Helpers

Each returns a `THREE.Group` or `THREE.Mesh` centered at origin, occupying one `SHAPE_SIZE` cell:

- `makeGeometry(type, s)` — primitives (cube/sphere/cylinder/cone/pyramid/torus)
- `makeBallJoint(hex, isGhost)` — Lego-style ball-on-post
- `makeSocketJoint(hex, isGhost)` — Lego-style cup receiver
- `makeHand(hex, isGhost)` — 4-finger glove
- `makeFist(hex, isGhost)` / `makeClaw(hex, isGhost)` — chain end pieces
- `makeChainLink(hex, isGhost, axis)` — single oval ring, `axis='flat'|'edge'` alternates for interlock
- `makeWholeChain(linkCount, hex, isGhost, droop)` — full chain with glue block + end piece; `droop 0→1` curves it from horizontal to hanging

Ghost variants use `MeshBasicMaterial` with `wireframe: true`; real shapes use `MeshLambertMaterial`.

## Auto-Support Logic

`maybeAddSupports(obj)` fires after placing a floating sphere/cone/pyramid/torus. It adds a thin cylinder below the shape only if there's nothing underneath and the shape is more than half a grid cell above the floor.

`findClearY(mesh)` walks a horizontal support rod up/down in 2mm steps to find a Y that doesn't collide with any non-support object.
