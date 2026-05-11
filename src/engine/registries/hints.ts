import type { HintDef } from '../types'

export type { HintDef }

// Always-on hints — stay visible in normal placement
const COMMON_BASE = [
  { icon: 'RT', binding: 'RT / LMB', label: 'Place' },
  { icon: 'LT', binding: 'LT / X', label: 'Erase' },
  { icon: '↕', binding: 'D-pad ↓ / [ ]', label: 'Block size' },
  { icon: 'R', binding: 'Y / R', label: 'Rotate' },
  { icon: 'D↑', binding: 'D-up / Tab', label: 'Inventory' },
  { icon: 'X', binding: 'Hold X / T', label: 'Tool ring' },
]

export const HINT_REGISTRY: HintDef[] = [
  {
    condition: s => s.selectedTool === 'place' && !s.ringOpen && !s.inventoryOpen && !s.pauseMenuOpen && !s.exportDialogOpen,
    hints: COMMON_BASE,
  },
  {
    condition: s => s.ringOpen,
    hints: [
      { icon: '🕹', binding: 'Left stick / Mouse', label: 'Aim at tool' },
      { icon: 'X', binding: 'Release X / T', label: 'Confirm' },
      { icon: 'B', binding: 'B / Esc', label: 'Cancel' },
    ],
  },
  {
    condition: s => s.selectedTool === 'paint',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Paint aimed block' },
      { icon: '◀▶', binding: 'D-pad ←→ / Q E', label: 'Cycle color' },
      { icon: 'P', binding: 'P', label: 'Back to place' },
      { icon: 'B', binding: 'Back', label: 'Undo last paint' },
    ],
  },
  {
    condition: s => s.selectedTool === 'erase',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Erase aimed block' },
      { icon: '↶', binding: 'Back / Ctrl+Z', label: 'Undo' },
    ],
  },
  {
    condition: s => s.selectedTool === 'eyedropper',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Sample color' },
    ],
  },
  {
    condition: s => s.selectedTool === 'mate' && s.mateStep === 0,
    hints: [{ icon: 'RT', binding: 'RT / LMB', label: 'Pick first connector' }],
  },
  {
    condition: s => s.selectedTool === 'mate' && s.mateStep === 1,
    hints: [{ icon: 'RT', binding: 'RT / LMB', label: 'Pick second connector' }],
  },
  {
    condition: s => s.selectedTool === 'select',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Grab block' },
      { icon: 'WASD', binding: 'L stick / WASD', label: 'Move on XZ' },
      { icon: '↑↓', binding: 'RB / LB', label: 'Move up / down' },
      { icon: 'B', binding: 'B / Esc', label: 'Cancel' },
    ],
  },
  {
    condition: s => s.selectedTool === 'sink',
    hints: [
      { icon: 'RT', binding: 'Hold RT', label: 'Push block in' },
      { icon: 'D-pad', binding: 'D-pad', label: '−20 / −40 / −60% presets' },
    ],
  },
  {
    condition: s => s.selectedTool === 'fillet',
    hints: [{ icon: 'RT', binding: 'RT / LMB', label: 'Insert fillet at edge' }],
  },
  {
    condition: s => s.selectedTool === 'support',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Place support rod' },
      { icon: 'LT', binding: 'LT / X', label: 'Remove support' },
    ],
  },
  {
    condition: s => s.selectedTool === 'measure',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Set point A' },
      { icon: 'RT', binding: 'RT / LMB again', label: 'Set point B — shows mm' },
    ],
  },
  {
    condition: s => s.flyMode,
    hints: [
      { icon: '↑', binding: 'RB / Space', label: 'Rise' },
      { icon: '↓', binding: 'LB / Ctrl', label: 'Descend' },
      { icon: 'A×2', binding: 'A×2 / 0×0', label: 'Exit fly mode' },
    ],
  },
  {
    condition: s => s.negativeMode,
    hints: [{ icon: '⬛', binding: 'N', label: 'Negative — subtracts on export' }],
  },
  {
    condition: s => s.plateCount > 1,
    hints: [{ icon: '#', binding: 'Ctrl+1..9', label: 'Switch plate' }],
  },
]
