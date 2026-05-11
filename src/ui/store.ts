import { create } from 'zustand'
import type { AppState, ToolId, BlockSize, BlockCategory, GridPos, BodyDef, ValidationWarning, SupportMode, RingType, PlacedObject, BlockRotation } from '../engine/types'

interface StoreActions {
  setTool: (tool: ToolId) => void
  setSize: (size: BlockSize) => void
  setColor: (color: string) => void
  setFlyMode: (on: boolean) => void
  setSupportMode: (mode: SupportMode) => void
  setMode2D: (on: boolean) => void
  setRingOpen: (open: boolean, type?: RingType | null) => void
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
  setHotbarSlot: (slot: number) => void
  setHotbarSlots: (slots: string[]) => void
  setNegativeMode: (on: boolean) => void
  setShowControls: (v: boolean) => void
  setSelectedObjectId: (id: string | null) => void
  updateObjectBodyName: (id: number, name: string | undefined) => void
  setAnnotationsVisible: (v: boolean) => void
  setActiveFirstMateId: (id: number | null) => void
  setImportPreviewObjects: (objs: PlacedObject[] | null) => void
  setPauseMenuOpen: (v: boolean) => void
  setExportDialogOpen: (v: boolean) => void
  setSinkDepth: (depth: number) => void
  setRingHoverIdx: (idx: number | null) => void
  setPlacementRotation: (rot: BlockRotation) => void
  cyclePlacementRotation: (axis: 'x' | 'y' | 'z') => void
  setActivePlate: (idx: number) => void
  addPlate: () => void
  removePlate: (idx: number) => void
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
  negativeMode: false,
  hotbarSlots: ['cube', 'slab', 'sphere', 'cylinder', 'wedge', 'ball-joint', 'socket', 'peg-1x', 'chain-hook'],
  selectedSlot: 0,
  showControls: false,
  selectedObjectId: null,
  objects: [],
  annotationsVisible: true,
  activeFirstMateId: null,
  importPreviewObjects: null,
  pauseMenuOpen: false,
  exportDialogOpen: false,
  ringHoverIdx: null,
  placementRotation: { x: 0, y: 0, z: 0 },
  activePlate: 0,
  plateCount: 1,
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
  setHotbarSlot: (selectedSlot) => set({ selectedSlot }),
  setHotbarSlots: (hotbarSlots) => set({ hotbarSlots }),
  setNegativeMode: (negativeMode) => set({ negativeMode }),
  setShowControls: (showControls) => set({ showControls }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  updateObjectBodyName: (id, name) => set((state: Store) => ({
    objects: state.objects.map((o: PlacedObject) => o.id === id ? { ...o, bodyName: name } : o),
  })),
  setAnnotationsVisible: (annotationsVisible) => set({ annotationsVisible }),
  setActiveFirstMateId: (activeFirstMateId) => set({ activeFirstMateId }),
  setImportPreviewObjects: (importPreviewObjects) => set({ importPreviewObjects }),
  setPauseMenuOpen: (pauseMenuOpen) => set({ pauseMenuOpen }),
  setExportDialogOpen: (exportDialogOpen) => set({ exportDialogOpen }),
  setSinkDepth: (sinkDepth) => set({ sinkDepth }),
  setRingHoverIdx: (ringHoverIdx) => set({ ringHoverIdx }),
  setPlacementRotation: (placementRotation) => set({ placementRotation }),
  cyclePlacementRotation: (axis) => set((state) => {
    const ANGLES = [0, 90, 180, 270] as const
    const cur = state.placementRotation[axis]
    const next = ANGLES[(ANGLES.indexOf(cur as 0 | 90 | 180 | 270) + 1) % 4]
    return { placementRotation: { ...state.placementRotation, [axis]: next } }
  }),
  setActivePlate: (activePlate) => set((state) => ({
    activePlate: Math.max(0, Math.min(state.plateCount - 1, activePlate)),
  })),
  addPlate: () => set((state) => ({
    plateCount: Math.min(9, state.plateCount + 1),
    activePlate: Math.min(9, state.plateCount), // jump to the new plate
  })),
  removePlate: (idx) => set((state) => {
    if (state.plateCount <= 1) return state
    const newCount = state.plateCount - 1
    // Re-pack objects: blocks on removed plate are deleted; higher plates shift down
    const newObjects = state.objects
      .filter(o => (o.plate ?? 0) !== idx)
      .map(o => (o.plate ?? 0) > idx ? { ...o, plate: (o.plate ?? 0) - 1 } : o)
    return {
      plateCount: newCount,
      activePlate: Math.min(newCount - 1, state.activePlate > idx ? state.activePlate - 1 : state.activePlate),
      objects: newObjects,
    }
  }),
}))

export function resetStore(): void {
  useStore.setState(initialState)
}
