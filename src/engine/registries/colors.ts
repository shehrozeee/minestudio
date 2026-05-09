export interface ColorDef {
  name: string
  hex: string
}

export const COLORS: ColorDef[] = [
  { name: 'Black',   hex: '#1a1a1a' },
  { name: 'White',   hex: '#f5f5f5' },
  { name: 'Gray',    hex: '#808080' },
  { name: 'Red',     hex: '#e03030' },
  { name: 'Orange',  hex: '#e87020' },
  { name: 'Yellow',  hex: '#e8c820' },
  { name: 'Lime',    hex: '#60c020' },
  { name: 'Green',   hex: '#208050' },
  { name: 'Teal',    hex: '#209090' },
  { name: 'Cyan',    hex: '#20b0e0' },
  { name: 'Blue',    hex: '#2060d0' },
  { name: 'Purple',  hex: '#8030c0' },
  { name: 'Pink',    hex: '#e040a0' },
  { name: 'Brown',   hex: '#906030' },
  { name: 'Gold',    hex: '#d0a020' },
  { name: 'Silver',  hex: '#c0c0c0' },
]

export function getColorIndex(hex: string): number {
  return COLORS.findIndex(c => c.hex === hex)
}

export function cycleColor(hex: string, delta: 1 | -1): string {
  const idx = getColorIndex(hex)
  const next = (idx + delta + COLORS.length) % COLORS.length
  return COLORS[next].hex
}
