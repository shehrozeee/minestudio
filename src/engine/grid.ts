import * as THREE from 'three'
import type { BlockSize, GridPos } from './types'

// 4 mm per grid cell (was 2mm — too small to print reliably).
// Block sizes scale: normal = 4mm cube, large = 8mm, xl = 12mm.
export const GRID_BASE = 4

// Build plate is 256 mm = PLATE_CELLS * GRID_BASE.
// Halved from 128 cells when GRID_BASE doubled, so plate stays at 256mm.
export const PLATE_CELLS = 64

export const SIZE_IN_UNITS: Record<BlockSize, number> = {
  normal: 1,
  large: 2,
  xl: 3,
}

export function toWorld(pos: GridPos): THREE.Vector3 {
  return new THREE.Vector3(
    pos.gx * GRID_BASE,
    pos.gy * GRID_BASE,
    pos.gz * GRID_BASE,
  )
}

export function snapToGrid(world: { x: number; y: number; z: number }): GridPos {
  return {
    gx: Math.round(world.x / GRID_BASE),
    gy: Math.round(world.y / GRID_BASE),
    gz: Math.round(world.z / GRID_BASE),
  }
}

export function cellKey(pos: GridPos): string {
  return `${pos.gx},${pos.gy},${pos.gz}`
}

export function occupiedCells(origin: GridPos, size: BlockSize): string[] {
  const units = SIZE_IN_UNITS[size]
  const keys: string[] = []
  for (let dx = 0; dx < units; dx++) {
    for (let dy = 0; dy < units; dy++) {
      for (let dz = 0; dz < units; dz++) {
        keys.push(cellKey({
          gx: origin.gx + dx,
          gy: origin.gy + dy,
          gz: origin.gz + dz,
        }))
      }
    }
  }
  return keys
}

export class OccupancyMap {
  private cells = new Map<string, number>()

  register(id: number, origin: GridPos, size: BlockSize): void {
    for (const key of occupiedCells(origin, size)) {
      this.cells.set(key, id)
    }
  }

  unregister(id: number, origin: GridPos, size: BlockSize): void {
    for (const key of occupiedCells(origin, size)) {
      if (this.cells.get(key) === id) this.cells.delete(key)
    }
  }

  isOccupied(origin: GridPos, size: BlockSize): boolean {
    return occupiedCells(origin, size).some(k => this.cells.has(k))
  }

  getOccupant(key: string): number | undefined {
    return this.cells.get(key)
  }

  clear(): void {
    this.cells.clear()
  }
}
