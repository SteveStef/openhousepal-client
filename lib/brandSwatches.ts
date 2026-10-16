// The quick color picks for an agent's brand - Setup's "Your brand" step and Studio's Brand Kit read
// the same lists, so both offer exactly the same choices. Designs already handle a light main color
// (white, silver): lib/studio/designTheme.ts brandPalette switches to dark type on it.
export type BrandSwatch = { color: string; label: string }

/** Main color - headers and backgrounds. */
export const BRAND_MAIN_COLORS: BrandSwatch[] = [
  { color: '#111827', label: 'Charcoal' },
  { color: '#000000', label: 'Black' },
  { color: '#1E3A5F', label: 'Navy' },
  { color: '#4A6741', label: 'Green' },
  { color: '#7C3AED', label: 'Purple' },
  { color: '#9B2C2C', label: 'Red' },
  { color: '#2563EB', label: 'Blue' },
  { color: '#C5C9CA', label: 'Silver' },
  { color: '#FFFFFF', label: 'White' },
]

/** Accent color - buttons and highlights. The metals first. */
export const BRAND_ACCENT_COLORS: BrandSwatch[] = [
  { color: '#C9A24D', label: 'Gold' },
  { color: '#C5C9CA', label: 'Silver' },
  { color: '#9B7659', label: 'Bronze' },
  { color: '#F1746B', label: 'Light Red' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#2563EB', label: 'Blue' },
  { color: '#4A6741', label: 'Green' },
  { color: '#7C3AED', label: 'Purple' },
  { color: '#1E3A5F', label: 'Navy' },
  { color: '#111827', label: 'Charcoal' },
  { color: '#000000', label: 'Black' },
  { color: '#FFFFFF', label: 'White' },
]
