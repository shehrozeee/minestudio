# MineStudio — Module Contracts

Every exported symbol is listed here. Agents must check this file before importing.

## src/engine/types.ts
- `BlockSize` (type)
- `ExportBehavior` (type)
- `BlockCategory` (type)
- `ToolId` (type)
- `RingType` (type)
- `SupportMode` (type)
- `ObjectStorageKind` (type)
- `GridPos` (interface)
- `BlockRotationAngle` (type)
- `BlockRotation` (interface)
- `PlacedObject` (interface)
- `BlockDef` (interface)
- `ConnectorDef` (interface)
- `MateAnnotation` (interface)
- `BodyDef` (interface)
- `ValidationWarning` (interface)
- `SaveFile` (interface)
- `AppState` (interface)

## src/engine/grid.ts
- `GRID_BASE` (const = 2)
- `SIZE_IN_UNITS` (const)
- `toWorld(pos: GridPos): THREE.Vector3`
- `snapToGrid(world): GridPos`
- `cellKey(pos: GridPos): string`
- `occupiedCells(origin: GridPos, size: BlockSize): string[]`
- `OccupancyMap` (class)

## src/engine/commands/Command.ts
- `Command` (interface)
- `CommandBusState` (interface)
- `CommandBus` (class)

## src/ui/store.ts
- `useStore` (Zustand store)
- `resetStore()` (test helper)

## src/engine/BuildEngine.ts
- `BuildEngine` (class)

## src/engine/systems/WorldSystem.ts
- `WorldSystem` (class)
- `PLAYER_HEIGHT` (const = 28)

## src/engine/systems/InputSystem.ts
- `InputSystem` (class)
  - `init(): void` — sets up keyboard, mouse wheel, gamepad listeners, PointerLockControls
  - `tick(dt: number): void` — calls `tickGamepad(dt)`, then handles keyboard movement
  - `tickGamepad(dt: number): void` — polls `navigator.getGamepads()`, maps Xbox standard layout to engine actions (left stick = move, right stick = look, RT = place, LT = delete, A = fly, B = double-tap fly, X = next color, Y = size cycle, LB/RB = hotbar, D-pad, back = undo, start = controls)
  - `isLocked(): boolean` — returns whether PointerLockControls is locked
  - `dispose(): void`

## src/engine/systems/*.ts (other systems)
- `PlacementSystem`, `RenderSystem`, `ConnectorSystem`, `CSGSystem`, `ValidationSystem`, `StorageSystem`, `MigrationSystem`, `ImportSystem`

## src/engine/systems/ExportSystem.ts
- `sanitizeName(name: string): string` — strips illegal filename chars, max 64 chars
- `groupObjectsByBody(objects: PlacedObject[]): Map<string, PlacedObject[]>` — groups printable non-negative objects by bodyName
- `ExportSystem` (class)
  - `init(): void` — registers Ctrl+Shift+E shortcut
  - `exportSTL(printableObjects?: PlacedObject[]): void` — single merged STL of all printable objects
  - `exportSTLZip(printableObjects?: PlacedObject[]): Promise<void>` — multi-body zip: groups objects by `bodyName`, one `.stl` per group
  - `export3MF(objects: PlacedObject[], bodies: BodyDef[]): Promise<void>` — exports as 3MF ZIP (Bambu Studio compatible)
  - `exportAll(format: 'stl-all' | 'stl-zip' | '3mf-all' | '3mf-selected'): Promise<void>` — full pipeline with validation gate
  - `exportAnyway(format: ...): Promise<void>` — bypass validation gate

## src/engine/systems/ImportSystem.ts
- `ImportSystem` (class)
  - `static normalizeToGrid(geometry: BufferGeometry, maxCells?: number): GridPos[]`
  - `static importSTL(buffer: ArrayBuffer): PlacedObject[]`
  - `static importGLB(buffer: ArrayBuffer): Promise<PlacedObject[]>`
  - `triggerImport(engine: BuildEngine): void` — opens file picker, runs BulkPlaceCommand

## src/engine/commands/BulkPlaceCommand.ts
- `BulkPlaceCommand` (class, implements `Command`)
  - `constructor(objects: PlacedObject[], engine: BuildEngine)`
  - `execute(): void` — pushes all objects to store, registers in occupancy, calls render.sync
  - `undo(): void` — removes all objects from store, unregisters from occupancy, calls render.sync

## src/engine/commands/SetBodyNameCommand.ts
- `SetBodyNameCommand` (class, implements `Command`)
  - `constructor(id: number, name: string, engine: BuildEngine)`
  - `execute(): void` — saves old name, sets new bodyName via store, calls render.sync
  - `undo(): void` — restores old bodyName via store, calls render.sync

## src/ui/components/ControlsPage.tsx
- `ControlsPage` (component) — full-screen controls reference overlay; shown when `showControls` is true in store

## src/ui/components/BodyNamePanel.tsx
- `BodyNamePanel` (component) — bottom-right panel for naming a selected object body; visible when `selectedObjectId !== null`

## src/engine/commands/ChainCommand.ts
- `ChainCommand` (class, implements `Command`)
  - `constructor(hookAId: number, hookBId: number, engine: BuildEngine)`
  - `execute(): void` — generates parabolic chain of cube links between two hook objects, pushes to engine.objects
  - `undo(): void` — removes all generated links

## src/engine/systems/WorldSystem.ts (updated)
- `WorldSystem` (class)
  - `addLamp(objectId: number, defId: string, position: THREE.Vector3): boolean` — adds PointLight for torch/lantern (max 12)
  - `removeLamp(objectId: number): void` — removes PointLight for object
  - `syncLamps(objects: PlacedObject[]): void` — diff-sync all lamp objects vs active PointLights; called after every command

## src/engine/systems/ConnectorSystem.ts (updated)
- `ConnectorSystem` (class)
  - `getMates(): MateAnnotation[]` — returns current mate list (used by StorageSystem.buildSaveFile)
  - `setAnnotationsVisible(visible: boolean): void` — shows/hides all mate arc lines and label sprites
  - `tick(dt: number): void` — pulses unmatched connector emissive intensity
  - `createMateVisual(mate: MateAnnotation): void` — draws bezier arc + label sprite in scene

## src/ui/components/Inventory.tsx
- `Inventory` (component) — full-screen block catalog overlay; opens on Tab / D-pad Up tap; tabs by BlockCategory

## src/ui/components/ExportDialog.tsx
- `ExportDialog` (component) — export format picker dialog
  - Props: `open: boolean`, `onClose: () => void`, `onExport: (format: string) => void`

## src/ui/components/PauseMenu.tsx
- `PauseMenu` (component) — pause/save/load overlay; fires `minestudio:save-slot` and `minestudio:load-slot` CustomEvents

## src/ui/components/ImportPreview.tsx
- `ImportPreview` (component) — shows imported STL/GLB block count with confirm/cancel; reads `importPreviewObjects` from store
