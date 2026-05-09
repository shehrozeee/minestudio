import { create } from 'zustand'
import type { AppState, ToolId, BlockSize, BlockCategory, GridPos, BodyDef, ValidationWarning, SupportMode, RingType, PlacedObject } from '../engine/types'

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
  setSinkDepth: (depth: number) => void
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
  hotbarSlots: ['cube', 'slab', 'sphere', 'cylinder', 'cone', 'torus', 'wedge', 'cube', 'cube'],
  selectedSlot: 0,
  showControls: false,
  selectedObjectId: null,
  objects: [],
  annotationsVisible: true,
  activeFirstMateId: null,
  importPreviewObjects: null,
  pauseMenuOpen: false,
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
  setSinkDepth: (sinkDepth) => set({ sinkDepth }),
}))

export function resetStore(): void {
  useStore.setState(initialState)
}
