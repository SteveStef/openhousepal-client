import { BrandKit, DesignColorMode } from '@/types'
import { LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'

// A design's color choice can carry a Luxe finish - the Email Signature's gold, silver or bronze -
// as "<theme>@<metal>" (e.g. "dark@gold"). The theme still decides the paper and ink; the metal
// takes over every accent (buttons, rules, kickers, the price). No metal = the theme's own accent.
export function splitColorMode(value: string | null | undefined): { base: DesignColorMode; metal: LuxeMetal | null } {
  const [b, m] = String(value || 'light').split('@')
  return { base: (b || 'light') as DesignColorMode, metal: (LUXE_METAL_ORDER as string[]).includes(m) ? (m as LuxeMetal) : null }
}
export function joinColorMode(base: string, metal: LuxeMetal | null): DesignColorMode {
  return (metal ? `${base}@${metal}` : base) as DesignColorMode
}

export interface ResolvedColor {
  bodyBg: string
  bodyText: string
  onDark: boolean
  // Poster layout only - the gradient laid over the hero photo behind text. Empty when the
  // active Style floods a solid color block instead (see DesignStyleTokens.solidColorBlock).
  scrimClass: string
}

// Standard WCAG-style relative luminance - used so an agent's own Brand primary color, however
// light or dark it happens to be, never produces unreadable body text under "Brand" mode.
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function isDark(hex: string): boolean {
  if (!/^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(hex)) return false
  return relativeLuminance(hex) < 0.5
}

function contrastingTextColor(hex: string): string {
  return isDark(hex) ? '#ffffff' : '#111827'
}

// Color is a fully independent, later-applied axis - it composes with any Style, and switching it
// never touches block content. See DesignCanvas.tsx for where this feeds into rendering.
//
// Deliberately no pure black or navy here - those flood a large body panel, and on anything
// actually printed (flyers, postcards, mailers, door hangers) that's real ink cost for no real
// benefit. "Dark" is a warm, soft charcoal instead of near-black; Stone and Forest are two
// additional modern-luxury-appropriate neutrals so "not white" doesn't mean "goes dark" - a
// premium warm greige and a muted deep green both work as their own on-brand look.
export function resolveColorMode(mode: DesignColorMode | null | undefined, brandKit: BrandKit | null): ResolvedColor {
  if (mode === 'dark') {
    return { bodyBg: '#3A342C', bodyText: '#F5F1EA', onDark: true, scrimClass: 'bg-gradient-to-t from-[#221F1A] via-[#221F1A]/55 to-[#221F1A]/15' }
  }
  if (mode === 'stone') {
    return { bodyBg: '#EAE3D6', bodyText: '#2E2A22', onDark: false, scrimClass: 'bg-gradient-to-t from-[#EAE3D6]/95 via-[#EAE3D6]/45 to-transparent' }
  }
  if (mode === 'forest') {
    return { bodyBg: '#33402F', bodyText: '#F2F1EA', onDark: true, scrimClass: 'bg-gradient-to-t from-[#222B20] via-[#222B20]/55 to-[#222B20]/15' }
  }
  if (mode === 'luxe') {
    return { bodyBg: '#0E1116', bodyText: '#F6F0E2', onDark: true, scrimClass: 'bg-gradient-to-t from-[#0B0E12] via-[#0B0E12]/55 to-[#0B0E12]/15' }
  }
  if (mode === 'brand') {
    const primary = brandKit?.primary_color || '#111827'
    return { bodyBg: primary, bodyText: contrastingTextColor(primary), onDark: isDark(primary), scrimClass: '' }
  }
  return { bodyBg: '#ffffff', bodyText: '#111827', onDark: false, scrimClass: 'bg-gradient-to-t from-black/85 via-black/20 to-transparent' }
}

// `swatch` = [background, accent] - used by the wizard/editor theme pickers' color chips.
// The full palette each mode resolves to lives in lib/studio/designTheme.ts.
export const DESIGN_COLOR_MODES: { id: DesignColorMode; label: string; description: string; swatch: [string, string] }[] = [
  { id: 'light', label: 'Ivory', description: 'Bright white paper with antique-gold accents.', swatch: ['#FFFFFF', '#A07E45'] },
  { id: 'stone', label: 'Stone', description: 'Warm greige with bronze - a premium neutral.', swatch: ['#ECE6DB', '#8A6638'] },
  { id: 'dark', label: 'Charcoal', description: 'Soft warm charcoal with champagne accents.', swatch: ['#23221F', '#CDAE72'] },
  { id: 'forest', label: 'Forest', description: 'Deep muted green with brass accents.', swatch: ['#1E2921', '#C9B27B'] },
  { id: 'brand', label: 'Brand', description: "Your Brand Kit's own colors.", swatch: ['#111827', '#C9A24D'] },
  { id: 'luxe', label: 'Luxe', description: 'Midnight and gold - the OpenHousePal signature.', swatch: ['#0E1116', '#E2C27A'] },
]
