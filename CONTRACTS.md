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

## src/engine/systems/*.ts
- `InputSystem`, `PlacementSystem`, `RenderSystem`, `ConnectorSystem`, `CSGSystem`, `ValidationSystem`, `ExportSystem`, `StorageSystem`, `MigrationSystem`, `ImportSystem`

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
