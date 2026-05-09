import type * as THREE from 'three'

export type BlockSize = 'normal' | 'large' | 'xl'
export type ExportBehavior = 'standard' | 'isolated' | 'clearance-required'
export type BlockCategory = 'basic' | 'round' | 'partial' | 'connector' | 'utility' | 'custom'
export type ToolId =
  | 'place' | 'erase' | 'paint' | 'eyedropper' | 'text'
  | 'select' | 'sink' | 'mate' | 'fillet' | 'support' | 'measure'
export type RingType = 'tools' | 'categories'
export type SupportMode = 'off' | 'vertical' | 'horizontal'
export type ObjectStorageKind = 'grid' | 'imported'

export interface GridPos {
  gx: number
  gy: number
  gz: number
}

export type BlockRotationAngle = 0 | 90 | 180 | 270
export interface BlockRotation {
  x: BlockRotationAngle
  y: BlockRotationAngle
  z: BlockRotationAngle
}

export interface PlacedObject {
  id: number
  defId: string
  size: BlockSize
  position: GridPos
  rotation: BlockRotation
  color: string
  faceColors?: [string, string, string, string, string, string]
  isNegative: boolean
  isPrintable: boolean
  isSupport: boolean
  storageKind: ObjectStorageKind
  geometryBuffer?: ArrayBuffer
  scaleBlocks?: number
}

export interface BlockDef {
  id: string
  label: string
  category: BlockCategory
  isPrintable: boolean
  exportBehavior: ExportBehavior
  availableSizes: BlockSize[]
  makeGeometry: (unitSize: number) => THREE.BufferGeometry
}

export interface ConnectorDef {
  id: string
  label: string
  matesWith: string[]
  clearance: number
  bodyRule: 'different'
  role: 'male' | 'female' | 'neutral'
}

export interface MateAnnotation {
  id: number
  connectorAId: number
  connectorBId: number
  color: string
}

export interface BodyDef {
  id: string
  label: string
  objectIds: number[]
}

export interface ValidationWarning {
  type: 'error' | 'warning'
  message: string
  objectId?: number
}

export interface SaveFile {
  version: number
  objects: PlacedObject[]
  mates: MateAnnotation[]
  bodies: BodyDef[]
  camera: { position: GridPos; rotationY: number }
}

export interface AppState {
  selectedTool: ToolId
  ringOpen: boolean
  ringType: RingType | null
  selectedBlockDefId: string
  selectedSize: BlockSize
  selectedColor: string
  inventoryOpen: boolean
  inventoryTab: BlockCategory
  objectCount: number
  undoAvailable: boolean
  redoAvailable: boolean
  timeOfDay: number
  playerPosition: GridPos
  mateStep: 0 | 1 | 2
  sinkDepth: number
  flyMode: boolean
  supportMode: SupportMode
  mode2D: boolean
  bodyList: BodyDef[]
  validationWarnings: ValidationWarning[]
  csgPending: boolean
  hotbarSlots: string[]
  selectedSlot: number
}
