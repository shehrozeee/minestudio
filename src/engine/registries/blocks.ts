import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BlockDef } from '../types'

export const BLOCK_REGISTRY: BlockDef[] = [
  // ── Basic ──────────────────────────────────────────────────────────────────
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
    id: 'stair',
    label: 'Stair',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Two-tier stair: lower step (full width, half height, half depth)
      // + upper step (full width, full height, half depth) side by side
      const geo = new THREE.BufferGeometry()
      const h = s, w = s, d = s
      // Lower tier: occupies back half, bottom half in Y
      // Upper tier: occupies front half, full height
      // Vertices for lower tier (back half, lower half)
      // Lower box: x in [-w/2, w/2], y in [0, h/2], z in [0, d/2]
      // Upper box: x in [-w/2, w/2], y in [0, h],   z in [-d/2, 0]
      const v = new Float32Array([
        // Lower step (back half of depth, bottom half of height)
        -w/2,   0,    0,   // 0
         w/2,   0,    0,   // 1
         w/2,   0,   d/2,  // 2
        -w/2,   0,   d/2,  // 3
        -w/2, h/2,    0,   // 4
         w/2, h/2,    0,   // 5
         w/2, h/2,   d/2,  // 6
        -w/2, h/2,   d/2,  // 7

        // Upper step (front half of depth, full height)
        -w/2,   0, -d/2,  // 8
         w/2,   0, -d/2,  // 9
         w/2,   0,    0,  // 10  (shared with lower at bottom)
        -w/2,   0,    0,  // 11
        -w/2,   h, -d/2,  // 12
         w/2,   h, -d/2,  // 13
         w/2,   h,    0,  // 14
        -w/2,   h,    0,  // 15
      ])
      const idx = new Uint16Array([
        // Lower step faces
        0,2,1, 0,3,2,          // bottom
        4,5,6, 4,6,7,          // top of lower step
        3,7,6, 3,6,2,          // front
        0,1,5, 0,5,4,          // back of lower (shared plane with upper front)
        0,4,7, 0,7,3,          // left
        1,2,6, 1,6,5,          // right

        // Upper step faces
        8,10,9, 8,11,10,       // bottom
        12,13,14, 12,14,15,    // top
        8,9,13, 8,13,12,       // back
        // front of upper step = back of lower step (interior, skip)
        8,12,15, 8,15,11,      // left
        9,10,14, 9,14,13,      // right
        // step riser: connects top of lower to bottom of upper front
        4,14,5,  4,15,14,      // riser face (y=h/2 plane, z=0)
      ])
      geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
      geo.setIndex(new THREE.BufferAttribute(idx, 1))
      geo.computeVertexNormals()
      return geo
    },
  },
  {
    id: 'wall',
    label: 'Wall',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s, s * 0.75, s * 0.2),
  },
  {
    id: 'post',
    label: 'Post',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.25, s, s * 0.25),
  },
  {
    id: 'pane',
    label: 'Pane',
    category: 'basic',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s, s, s * 0.05),
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

  // ── Round ──────────────────────────────────────────────────────────────────
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
    id: 'tube',
    label: 'Tube',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    // Thin-walled cylinder to visually distinguish from solid cylinder
    makeGeometry: (s) => new THREE.CylinderGeometry(s * 0.5, s * 0.5, s, 16, 1, true),
  },
  {
    id: 'arch',
    label: 'Arch',
    category: 'round',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    // Half-torus (180° arc)
    makeGeometry: (s) => new THREE.TorusGeometry(s * 0.35, s * 0.15, 8, 16, Math.PI),
  },

  // ── Connector ──────────────────────────────────────────────────────────────
  {
    id: 'ball-joint',
    label: 'Ball Joint',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Sphere on a post — represented as a sphere (dominant visual)
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
      // Half-sphere cup shape using phiLength = Math.PI
      return new THREE.SphereGeometry(s * 0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    },
  },
  {
    id: 'peg-1x',
    label: 'Peg 1×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.2, s * 0.3),
  },
  {
    id: 'peg-2x',
    label: 'Peg 2×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.4, s * 0.3),
  },
  {
    id: 'peg-3x',
    label: 'Peg 3×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.6, s * 0.3),
  },
  {
    id: 'slot-1x',
    label: 'Slot 1×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'clearance-required',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.2, s * 0.3),
  },
  {
    id: 'slot-2x',
    label: 'Slot 2×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'clearance-required',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.4, s * 0.3),
  },
  {
    id: 'slot-3x',
    label: 'Slot 3×',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'clearance-required',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.6, s * 0.3),
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
    makeGeometry: (s) => new THREE.BoxGeometry(s * 0.3, s * 0.8, s * 0.3),
  },
  {
    id: 'chain-hook',
    label: 'Chain Hook',
    category: 'connector',
    isPrintable: true,
    exportBehavior: 'isolated',
    availableSizes: ['normal', 'large', 'xl'],
    makeGeometry: (s) => {
      // Post cylinder — just the cylinder as primary visual
      // (can't merge geometries without BufferGeometryUtils in this file)
      return new THREE.CylinderGeometry(s * 0.15, s * 0.15, s * 0.3, 8)
    },
  },

  // ── Utility ────────────────────────────────────────────────────────────────
  {
    id: 'torch',
    label: 'Torch',
    category: 'utility',
    isPrintable: false,
    exportBehavior: 'standard',
    availableSizes: ['normal'],
    // Wood handle + flame (sphere on top). Merged into one geometry.
    makeGeometry: (s) => {
      const handle = new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.55, 8)
      handle.translate(0, -s * 0.05, 0)
      const flame = new THREE.SphereGeometry(s * 0.16, 10, 8)
      flame.translate(0, s * 0.3, 0)
      const merged = mergeGeometries([handle, flame])
      return merged ?? handle
    },
  },
  {
    id: 'lantern',
    label: 'Lantern',
    category: 'utility',
    isPrintable: false,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large'],
    // Cage box + bright glowing core inside + handle on top
    makeGeometry: (s) => {
      const cage = new THREE.BoxGeometry(s * 0.44, s * 0.44, s * 0.44)
      const core = new THREE.SphereGeometry(s * 0.18, 10, 8)
      const top = new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.08, 8)
      top.translate(0, s * 0.26, 0)
      const ring = new THREE.TorusGeometry(s * 0.06, s * 0.015, 6, 12)
      ring.translate(0, s * 0.32, 0)
      ring.rotateX(Math.PI / 2)
      const merged = mergeGeometries([cage, core, top, ring])
      return merged ?? cage
    },
  },

  // ── Partial ────────────────────────────────────────────────────────────────
  {
    id: 'fillet-corner',
    label: 'Fillet Corner',
    category: 'partial',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    // Quarter-sphere (corner fillet)
    makeGeometry: (s) =>
      new THREE.SphereGeometry(s * 0.5, 8, 8, 0, Math.PI / 2, 0, Math.PI / 2),
  },
  {
    id: 'fillet-edge',
    label: 'Fillet Edge',
    category: 'partial',
    isPrintable: true,
    exportBehavior: 'standard',
    availableSizes: ['normal', 'large', 'xl'],
    // Quarter-torus (edge fillet)
    makeGeometry: (s) =>
      new THREE.TorusGeometry(s * 0.5, s * 0.1, 8, 8, Math.PI / 2),
  },
]

export function getBlockDef(id: string): BlockDef | undefined {
  return BLOCK_REGISTRY.find(b => b.id === id)
}

export const DEFAULT_HOTBAR: string[] = [
  'cube', 'slab', 'sphere', 'cylinder', 'wedge', 'ball-joint', 'socket', 'peg-1x', 'chain-hook',
]
