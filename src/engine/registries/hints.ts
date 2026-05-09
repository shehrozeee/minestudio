import type { HintDef } from '../types'

export type { HintDef }

export const HINT_REGISTRY: HintDef[] = [
  {
    condition: s => s.selectedTool === 'place' && !s.ringOpen,
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Place block' },
      { icon: 'LT', binding: 'LT / X', label: 'Erase' },
      { icon: 'X', binding: 'Hold X / T', label: 'Tool ring' },
      { icon: 'D↑', binding: 'D-Up / Tab', label: 'Inventory' },
    ],
  },
  {
    condition: s => s.ringOpen,
    hints: [
      { icon: '🕹', binding: 'Right stick / Mouse', label: 'Select tool' },
      { icon: 'B', binding: 'B / Esc', label: 'Cancel' },
    ],
  },
  {
    condition: s => s.selectedTool === 'paint',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Paint whole block' },
      { icon: 'LB', binding: 'Shift+LMB', label: 'Paint single face' },
      { icon: 'Q/E', binding: 'LB / RB', label: 'Cycle color' },
    ],
  },
  {
    condition: s => s.selectedTool === 'mate' && s.mateStep === 0,
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Select first connector' },
    ],
  },
  {
    condition: s => s.selectedTool === 'mate' && s.mateStep === 1,
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Select second connector' },
    ],
  },
  {
    condition: s => s.selectedTool === 'erase',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Erase aimed block' },
      { icon: 'LT', binding: 'LT / X', label: 'Also erases' },
    ],
  },
  {
    condition: s => s.selectedTool === 'eyedropper',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Sample color from block' },
    ],
  },
  {
    condition: s => s.selectedTool === 'select',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Grab block' },
      { icon: 'D-pad', binding: 'D-pad / WASD', label: 'Move on XZ' },
      { icon: 'RB/LB', binding: 'RB / LB', label: 'Move up / down' },
      { icon: 'B', binding: 'B / Esc', label: 'Cancel' },
    ],
  },
  {
    condition: s => s.selectedTool === 'sink',
    hints: [
      { icon: 'RT', binding: 'Hold RT / LMB', label: 'Push block in' },
      { icon: 'D-pad', binding: 'D-pad', label: '-20/-40/-60% presets' },
    ],
  },
  {
    condition: s => s.selectedTool === 'fillet',
    hints: [
      { icon: 'RT', binding: 'RT / LMB', label: 'Insert fillet at shared edge' },
    ],
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
      { icon: 'RB', binding: 'RB / R', label: 'Rise' },
      { icon: 'LB', binding: 'LB / F', label: 'Descend' },
      { icon: 'A×2', binding: 'A×2 / 0×2', label: 'Exit fly mode' },
    ],
  },
  {
    condition: s => s.negativeMode,
    hints: [
      { icon: '⬛', binding: 'N', label: 'Negative mode ON — blocks subtract on export' },
    ],
  },
]
