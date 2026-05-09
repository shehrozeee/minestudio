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
- `InputSystem`, `PlacementSystem`, `RenderSystem`, `ConnectorSystem`, `CSGSystem`, `ValidationSystem`, `ExportSystem`, `StorageSystem`, `MigrationSystem`
