import * as THREE from 'three'
import type { BlockDef } from '../types'

export const BLOCK_REGISTRY: BlockDef[] = [
  {
    id: 'cube',
    label: 'Cube',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s, s, s),
  },
  {
    id: 'slab',
    label: 'Slab',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s, s * 0.5, s),
  },
  {
    id: 'sphere',
    label: 'Sphere',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.SphereGeometry(s * 0.5, 16, 12),
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.CylinderGeometry(s * 0.5, s * 0.5, s, 16),
  },
  {
    id: 'cone',
    label: 'Cone',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.ConeGeometry(s * 0.5, s, 16),
  },
  {
    id: 'torus',
    label: 'Torus',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.TorusGeometry(s * 0.35, s * 0.15, 8, 16),
  },
  {
    id: 'wedge',
    label: 'Wedge',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Triangular prism: ramp shape
      const geo = new THREE.BufferGeometry()
      const h = s, w = s, d = s
      const v = new Float32Array([
        -w/2, 0,   -d/2,   // 0 bottom-back-left
         w/2, 0,   -d/2,   // 1 bottom-back-right
         w/2, 0,    d/2,   // 2 bottom-front-right
        -w/2, 0,    d/2,   // 3 bottom-front-left
        -w/2, h,    d/2,   // 4 top-front-left
         w/2, h,    d/2,   // 5 top-front-right
      ])
      const idx = new Uint16Array([
        0,2,1, 0,3,2,   // bottom
        3,4,5, 3,5,2,   // front face (vertical)
        0,1,5, 0,5,4,   // slope face
        0,4,3,          // left triangle
        1,2,5,          // right triangle
      ])
      geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
      geo.setIndex(new THREE.BufferAttribute(idx, 1))
      geo.computeVertexNormals()
      return geo
    },
  },
  {
    id: 'ball-joint',
    label: 'Ball Joint',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Simplified: just a sphere (ball) for Phase 4A
      return new THREE.SphereGeometry(s * 0.4, 14, 10)
    },
  },
  {
    id: 'socket',
    label: 'Socket',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Cup: outer torus-like ring
      return new THREE.TorusGeometry(s * 0.28, s * 0.08, 8, 16)
    },
  },
  {
    id: 'peg',
    label: 'Peg',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.CylinderGeometry(s * 0.12, s * 0.12, s * 0.8, 12),
  },
  {
    id: 'slot',
    label: 'Slot',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Rectangular slot as a thin flat box with notch
      return new THREE.BoxGeometry(s * 0.3, s * 0.8, s * 0.3)
    },
  },
]

export function getBlockDef(id: string): BlockDef | undefined {
  return BLOCK_REGISTRY.find(b => b.id === id)
}

export const DEFAULT_HOTBAR: string[] = [
  'cube', 'slab', 'sphere', 'cylinder', 'cone', 'ball-joint', 'peg', 'socket', 'slot',
]
