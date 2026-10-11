// The one accent palette every "pick your color" surface shares - the Email Signature editor and
// the IDX website's Design tab both read from here, so an agent sees the same bronze/silver/gold
// finishes and the same color set everywhere (and one click applies the whole site).

export type AccentSwatch = { color: string; label: string } | { divider: true }

export const ACCENT_SWATCHES: AccentSwatch[] = [
  // True, recognizable metal tones - their own group, since these read as a "finish" choice, not
  // just another color. Tuned to read as polished bronze/silver/gold at small sizes.
  { color: '#9B7659', label: 'Bronze' },
  { color: '#C5C9CA', label: 'Silver' },
  { color: '#D8B86A', label: 'Gold' },
  { divider: true },
  { color: '#F1746B', label: 'Light Red' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#2563EB', label: 'Blue' },
  { color: '#4A6741', label: 'Green' },
  { color: '#7C3AED', label: 'Purple' },
  { color: '#1E3A5F', label: 'Navy' },
  { color: '#111827', label: 'Charcoal' },
  { divider: true },
  { color: '#000000', label: 'Black' },
  { color: '#FFFFFF', label: 'White' },
]

export const ACCENT_COLORS = ACCENT_SWATCHES.filter((s): s is { color: string; label: string } => 'color' in s)

export function accentLabel(color: string | null | undefined): string | null {
  const hit = ACCENT_COLORS.find(s => s.color.toLowerCase() === (color || '').toLowerCase())
  return hit ? hit.label : null
}
