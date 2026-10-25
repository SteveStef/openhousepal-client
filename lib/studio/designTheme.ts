import { BrandKit, DesignColorMode, DesignStyleId } from '@/types'
import { DESIGN_FONTS } from '@/lib/studio/designFonts'
import { isDark, relativeLuminance, splitColorMode } from '@/lib/studio/designColors'
import { LUXE_METALS, type LuxeMetal } from '@/lib/luxeMetals'
import { brandClassicAccent } from '@/lib/brandKit'

// The fully-resolved look of one design: Style (typography system + ornament language) composed
// with Color (a curated palette). Every composition in DesignCanvas.tsx reads ONLY from this, so
// all 4 styles x 5 color modes stay consistent across every format and layout.

export interface DesignPalette {
  bg: string // page / panel background
  surface: string // a second, slightly deeper panel tone (bands, cards)
  ink: string // primary text on bg
  muted: string // secondary text on bg
  accent: string // kicker, rules, price - on bg
  accentInk: string // text drawn ON an accent fill
  photoAccent: string // accent used over a darkened photo (always a light, luminous tone)
  rule: string // hairlines on bg
  scrim: string // 'r,g,b' - the fade laid over photos behind text: the paper tone on light themes
  // (dark type on it), a tinted dark tone on dark themes (white type) - so themes look different
  isDark: boolean
}

export interface DesignTheme extends DesignPalette {
  styleId: DesignStyleId
  colorMode: DesignColorMode
  align: 'left' | 'center'
  fonts: { display: string; body: string; label: string; kicker: string; price: string }
  display: { weight: number; transform: 'none' | 'uppercase'; tracking: string; leading: number }
  kicker: { weight: number; transform: 'none' | 'uppercase'; tracking: string; italic: boolean; scale: number; treatment: 'rule' | 'flanked' | 'dot' | 'block' }
  price: { weight: number; tracking: string; scale: number }
  label: { weight: number; tracking: string }
  ornament: 'hairline' | 'double' | 'bar' | 'none'
  frame: boolean // hairline inset frame on solid panels (Modern Luxury)
  photoRadius: number // cqmin - corner radius on inset photos
  // Bold floods a solid color block behind text over photos instead of a gradient scrim.
  colorBlock: boolean
}

const PALETTES: Record<Exclude<DesignColorMode, 'brand'>, DesignPalette> = {
  light: { bg: '#FFFFFF', surface: '#F4F1EB', ink: '#16181C', muted: '#62666E', accent: '#9C7A43', accentInk: '#FFFFFF', photoAccent: '#E2C58F', rule: 'rgba(22,24,28,0.14)', scrim: '255,255,255', isDark: false },
  stone: { bg: '#EDE7DC', surface: '#E3DACB', ink: '#29241E', muted: '#6C6356', accent: '#8A6638', accentInk: '#FFFFFF', photoAccent: '#E6CB98', rule: 'rgba(41,36,30,0.16)', scrim: '237,231,220', isDark: false },
  dark: { bg: '#23221F', surface: '#2D2B27', ink: '#F4F0E8', muted: '#B3AB9E', accent: '#CDAE72', accentInk: '#1E1D1A', photoAccent: '#DCC08A', rule: 'rgba(244,240,232,0.16)', scrim: '40,37,33', isDark: true },
  luxe: { bg: '#0E1116', surface: '#161A21', ink: '#F6F0E2', muted: '#BDB29C', accent: '#D4B068', accentInk: '#111318', photoAccent: '#E9CC86', rule: 'rgba(233,204,134,0.30)', scrim: '9,14,28', isDark: true },
  forest: { bg: '#1E2921', surface: '#27342A', ink: '#F0EEE4', muted: '#AEB5A4', accent: '#CBB47D', accentInk: '#1B241D', photoAccent: '#DCC795', rule: 'rgba(240,238,228,0.16)', scrim: '22,42,30', isDark: true },
}

function normalizeHex(hex: string | null | undefined, fallback: string): string {
  if (!hex) return fallback
  const clean = hex.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(clean)) return `#${clean.split('').map(c => c + c).join('')}`
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`
  return fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

function mix(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const out = a.map((v, i) => Math.round(v * (1 - weightB) + b[i] * weightB))
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// "Brand" mode: the agent's own primary floods the background and their secondary becomes the
// accent - but only where it's actually legible. A brand secondary that doesn't clear 2.4:1 against
// the background falls back to a tint of the text color instead, so no Brand Kit (however light,
// dark or saturated) can produce an unreadable kicker or price.
// The Brand color is EXACTLY the one in Branding (owner 10/24: "Brand doesn't match my Brand Kit
// color"): the Classic color made safe for buttons (brandDesignAccent), or the Luxe finish when the
// brand look is Luxe. When it can't be read on the print background it stays the same hue, just
// lighter / deeper - never swapped for a tint of the background.
export function brandDesignAccent(brandKit: BrandKit | null | undefined, onDarkBg = true): string {
  const look = brandKit?.look
  if (look && (look.shown_theme || look.theme) === 'luxe' && look.metal && LUXE_METALS[look.metal]) {
    const m = LUXE_METALS[look.metal]
    return onDarkBg ? m.light : m.deep
  }
  return brandClassicAccent(normalizeHex(brandKit?.secondary_color, '#C9A24D'))
}

/** The two chips on a "Brand" theme tile: [print background, the brand color]. */
export function brandSwatch(brandKit: BrandKit | null | undefined): [string, string] {
  const primary = normalizeHex(brandKit?.primary_color, '#111827')
  return [primary, brandDesignAccent(brandKit, isDark(primary))]
}

function brandPalette(brandKit: BrandKit | null): DesignPalette {
  const primary = normalizeHex(brandKit?.primary_color, '#111827')
  const dark = isDark(primary)
  const secondary = brandDesignAccent(brandKit, dark)
  const ink = dark ? '#FFFFFF' : '#14161A'
  const accent = contrastRatio(secondary, primary) >= 2.4 ? secondary
    : (dark ? mix(secondary, '#FFFFFF', 0.5) : mix(secondary, '#000000', 0.45))
  const accentInk = isDark(accent) ? '#FFFFFF' : '#14161A'
  const scrimBase = dark ? primary : mix(primary, '#000000', 0.78)
  const photoAccent = isDark(secondary) ? mix(secondary, '#FFFFFF', 0.55) : secondary
  return {
    bg: primary,
    surface: dark ? mix(primary, '#FFFFFF', 0.07) : mix(primary, '#000000', 0.06),
    ink,
    muted: dark ? 'rgba(255,255,255,0.72)' : 'rgba(20,22,26,0.66)',
    accent,
    accentInk,
    photoAccent,
    rule: dark ? 'rgba(255,255,255,0.18)' : 'rgba(20,22,26,0.16)',
    // Dark brand color: a deep tint of it behind white type. Light brand color: the color itself,
    // as paper behind dark type (same rule as Ivory/Stone).
    scrim: dark ? hexToRgb(mix(scrimBase, '#000000', 0.25)).join(',') : hexToRgb(primary).join(','),
    isDark: dark,
  }
}

export function resolvePalette(mode: DesignColorMode | null | undefined, brandKit: BrandKit | null): DesignPalette {
  if (mode === 'brand') return brandPalette(brandKit)
  return PALETTES[(mode && mode in PALETTES ? mode : 'light') as keyof typeof PALETTES]
}

// A Luxe finish: the metal replaces the theme's accent - its deeper tone on light paper (so it
// still reads as type), its bright tone on dark grounds and over photos.
function withMetal(p: DesignPalette, metal: LuxeMetal | null): DesignPalette {
  if (!metal) return p
  const m = LUXE_METALS[metal]
  return { ...p, accent: p.isDark ? m.light : m.deep, accentInk: p.isDark ? '#15161A' : '#FFFFFF', photoAccent: m.light }
}

export function resolveDesignTheme(styleId: DesignStyleId | string, mode: DesignColorMode | null | undefined, brandKit: BrandKit | null): DesignTheme {
  const { base, metal } = splitColorMode(mode)
  const palette = withMetal(resolvePalette(base, brandKit), metal)
  const colorMode = base
  const F = DESIGN_FONTS
  switch (styleId) {
    case 'modern_luxury':
      return {
        ...palette, styleId: 'modern_luxury', colorMode, align: 'center',
        fonts: { display: F.cormorant, body: F.jost, label: F.jost, kicker: F.jost, price: F.cormorant },
        display: { weight: 500, transform: 'uppercase', tracking: '0.06em', leading: 1.04 },
        kicker: { weight: 500, transform: 'uppercase', tracking: '0.42em', italic: false, scale: 0.9, treatment: 'flanked' },
        price: { weight: 500, tracking: '0.04em', scale: 1.05 },
        label: { weight: 500, tracking: '0.28em' },
        ornament: 'hairline', frame: true, photoRadius: 0, colorBlock: false,
      }
    case 'minimal':
      return {
        ...palette, styleId: 'minimal', colorMode, align: 'left',
        fonts: { display: F.manrope, body: F.manrope, label: F.manrope, kicker: F.manrope, price: F.manrope },
        display: { weight: 600, transform: 'none', tracking: '-0.03em', leading: 1.02 },
        kicker: { weight: 700, transform: 'uppercase', tracking: '0.22em', italic: false, scale: 0.82, treatment: 'dot' },
        price: { weight: 500, tracking: '-0.02em', scale: 0.95 },
        label: { weight: 700, tracking: '0.18em' },
        ornament: 'none', frame: false, photoRadius: 1.4, colorBlock: false,
      }
    case 'bold':
      return {
        ...palette, styleId: 'bold', colorMode, align: 'left',
        fonts: { display: F.anton, body: F.archivo, label: F.archivo, kicker: F.archivo, price: F.anton },
        display: { weight: 400, transform: 'uppercase', tracking: '0.005em', leading: 0.94 },
        kicker: { weight: 800, transform: 'uppercase', tracking: '0.12em', italic: false, scale: 0.95, treatment: 'block' },
        price: { weight: 400, tracking: '0.01em', scale: 1.2 },
        label: { weight: 800, tracking: '0.12em' },
        ornament: 'bar', frame: false, photoRadius: 0, colorBlock: true,
      }
    case 'editorial':
    default:
      return {
        ...palette, styleId: 'editorial', colorMode, align: 'left',
        fonts: { display: F.playfair, body: F.inter, label: F.inter, kicker: F.playfair, price: F.playfair },
        display: { weight: 500, transform: 'none', tracking: '-0.01em', leading: 1.06 },
        kicker: { weight: 400, transform: 'none', tracking: '0.01em', italic: true, scale: 1.25, treatment: 'rule' },
        price: { weight: 500, tracking: '0', scale: 1 },
        label: { weight: 600, tracking: '0.16em' },
        ornament: 'hairline', frame: false, photoRadius: 0, colorBlock: false,
      }
  }
}
