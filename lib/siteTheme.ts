import type { CSSProperties } from 'react'
import type { SiteTheme } from '@/types'
import { LUXE_METALS, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import { ACCENT_COLORS } from '@/lib/accentSwatches'

// Turns a site's saved theme into the CSS custom properties + data attributes the public
// stylesheet (app/(sitepublic)/site-theme.css) reads. One place for the math, shared by the
// public layout/page and the editor's live preview so both render identically.
//
//   --site-accent        the agent's accent (theme.secondary_color - the "one click" color)
//   --site-accent-light  / -deep / -pale   derived tints for metallic gradients and washes
//   --site-primary       the brand's dark "ink" color (theme.primary_color) - panels, buttons
//   data-template        'luxe' | 'default'     (two looks on the same sections)
//   data-mode            'light' | 'dark'       (what visitors see first; they can flip it)

export type SiteTemplate = 'luxe' | 'default'
export type SiteMode = 'light' | 'dark'

export function siteTemplate(theme: Partial<SiteTheme> | null | undefined): SiteTemplate {
  return theme?.template === 'default' ? 'default' : 'luxe'
}

export function siteMode(theme: Partial<SiteTheme> | null | undefined): SiteMode {
  return theme?.mode === 'dark' ? 'dark' : 'light'
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = (hex || '').trim().replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/** Mix `hex` toward `target` (0 = hex, 1 = target). */
export function mix(hex: string, target: [number, number, number], amount: number): string {
  const rgb = hexToRgb(hex) || [201, 162, 77]
  return rgbToHex([
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ])
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  // Relative luminance, good enough to pick readable text on an accent button.
  const [r, g, b] = rgb.map(v => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex) || [0, 0, 0]
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two hex colors (1-21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `hex` darkened (light page) or lightened (dark page) just enough to read as small text on `bg`
 *  (WCAG AA 4.5:1) - the agent's color where it already passes, its nearest readable shade where
 *  it doesn't (gold or a light accent on white, navy on a dark page). */
export function readableOn(hex: string, bg: string, min = 4.5): string {
  const toward: [number, number, number] = luminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255]
  for (let k = 0; k <= 20; k++) {
    const c = mix(hex, toward, k * 0.05)
    if (contrastRatio(c, bg) >= min) return c
  }
  return toward[0] ? '#ffffff' : '#111111'
}

/** The accent as small text on this mode's page (same rule as --site-accent-text / -dm), as a hex -
 *  for components that build colors from a hex (e.g. `${accent}22`) and can't take a CSS var. */
export function accentTextFor(accent: string, mode: 'light' | 'dark', luxe = false): string {
  if (mode === 'dark') {
    const rgb = hexToRgb(accent) || [201, 162, 77]
    const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
    return readableOn(lum < 0.42 ? mix(accent, [255, 255, 255], 0.5) : accent, luxe ? '#16161b' : '#191c25')
  }
  return readableOn(accent, luxe ? '#f3f1ea' : '#f6f7f9', 5)
}

export interface SiteThemeVars {
  style: CSSProperties
  template: SiteTemplate
  mode: SiteMode
  accent: string
  accentLight: string
  accentDeep: string
  accentPale: string
  onAccent: string
}

// The two looks have their own color sets:
//   Luxe    - a metal finish: gold, silver or bronze, the EXACT tones the Email Signature and Agent
//             Hub use (lib/luxeMetals), so the site, the signature in its footer and the hub match.
//   Classic - every other accent color (lib/accentSwatches minus the three metals and white).
export const CLASSIC_DEFAULT_ACCENT = '#1E3A5F'
const METAL_SWATCH_LABELS = ['Bronze', 'Silver', 'Gold']
export const CLASSIC_ACCENTS = ACCENT_COLORS.filter(c => !METAL_SWATCH_LABELS.includes(c.label) && c.label !== 'White')

export function siteLuxeMetal(theme: Partial<SiteTheme> | null | undefined): LuxeMetal {
  if (theme?.luxe_metal) return metalOf(theme.luxe_metal)
  // Sites from before the metal choice: read it off the accent they picked.
  const a = (theme?.secondary_color || '').toLowerCase()
  if (['#c5c9ca', '#a9afb7'].includes(a)) return 'silver'
  if (['#9b7659', '#a9714b'].includes(a)) return 'bronze'
  return 'gold'
}

const isMetalHex = (hex: string) => {
  const a = hex.toLowerCase()
  return ['#9b7659', '#c5c9ca', '#d8b86a'].includes(a) || Object.values(LUXE_METALS).some(m => m.base.toLowerCase() === a)
}

/** The theme as the page renders it: Luxe's accent snapped to its metal, Classic's accent never a
 *  metal (or white). Every public page and the editor preview run the saved theme through this,
 *  so components that read theme.secondary_color directly get the right color too. */
export function normalizeSiteTheme<T extends Partial<SiteTheme>>(theme: T): T {
  if (!theme) return theme
  if (siteTemplate(theme) === 'luxe') {
    const metal = siteLuxeMetal(theme)
    return { ...theme, luxe_metal: metal, secondary_color: LUXE_METALS[metal].base }
  }
  const accent = theme.secondary_color || ''
  const ok = /^#[0-9a-f]{6}$/i.test(accent) && !isMetalHex(accent) && accent.toLowerCase() !== '#ffffff'
  return { ...theme, secondary_color: ok ? accent : CLASSIC_DEFAULT_ACCENT }
}

export function siteThemeVars(rawTheme: Partial<SiteTheme> | null | undefined): SiteThemeVars {
  const theme = rawTheme ? normalizeSiteTheme(rawTheme) : rawTheme
  const luxe = siteTemplate(theme) === 'luxe'
  const metal = LUXE_METALS[siteLuxeMetal(theme)]
  const accent = theme?.secondary_color || '#C9A24D'
  const primary = theme?.primary_color || '#111827'
  const accentRgb = hexToRgb(accent) || [201, 162, 77]
  const primaryRgb = hexToRgb(primary) || [17, 24, 39]
  const accentLight = luxe ? metal.light : mix(accent, [255, 255, 255], 0.38)
  const accentDeep = luxe ? metal.deep : mix(accent, [0, 0, 0], 0.32)
  const accentPale = luxe ? metal.pale : mix(accent, [255, 255, 255], 0.84)
  const onAccent = isLightColor(accent) ? '#111827' : '#ffffff'
  // Dark mode: a dark accent (navy, charcoal...) would vanish on a dark page - visitors who switch
  // to dark get a lighter tint of it instead (site-theme.css swaps these in under data-mode=dark).
  const rgb = hexToRgb(accent) || [201, 162, 77]
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  const accentOnDark = lum < 0.42 ? mix(accent, [255, 255, 255], 0.5) : accent
  const style = {
    '--site-accent-dm': accentOnDark,
    '--site-accent-dm-rgb': (hexToRgb(accentOnDark) || rgb).join(','),
    // The lightened tint sits mid-tone, so dark text reads better on it than white.
    '--site-on-accent-dm': isLightColor(accentOnDark) || accentOnDark !== accent ? '#0f172a' : '#ffffff',
    // The metal set (Luxe) - the same --m-* names the hub and signature stylesheets read.
    '--m-base': luxe ? metal.base : accent, '--m-light': accentLight, '--m-deep': accentDeep, '--m-mid': luxe ? metal.mid : accent, '--m-pale': accentPale,
    '--m-rgb': luxe ? metal.rgb : accentRgb.join(','), '--m-light-rgb': luxe ? metal.lightRgb : (hexToRgb(accentLight) || accentRgb).join(','),
    '--m-deep-rgb': luxe ? metal.deepRgb : (hexToRgb(accentDeep) || accentRgb).join(','),
    '--site-accent': accent,
    '--site-accent-rgb': accentRgb.join(','),
    '--site-accent-light': accentLight,
    '--site-accent-deep': accentDeep,
    '--site-accent-pale': accentPale,
    // Accent as small TEXT / icons on the page (labels, "View home", map pins' captions): the
    // agent's color, nudged until it reads (AA) on this look's light or dark surfaces. Dark mode
    // swaps in the -dm value (site-theme.css).
    '--site-accent-text': readableOn(accent, luxe ? '#f3f1ea' : '#f6f7f9'),
    '--site-accent-text-dm': readableOn(accentOnDark, luxe ? '#16161b' : '#191c25'),
    '--site-on-accent': onAccent,
    '--site-primary': primary,
    '--site-primary-rgb': primaryRgb.join(','),
    // Legacy names the older components still read.
    '--site-gold': accent,
    '--site-gold-soft': `rgba(${accentRgb.join(',')},0.12)`,
  } as CSSProperties
  return { style, template: siteTemplate(theme), mode: siteMode(theme), accent, accentLight, accentDeep, accentPale, onAccent }
}

/** The localStorage key a visitor's own light/dark choice is kept under, per site. */
export function siteModeStorageKey(siteKey: string): string {
  return `ohp-site-mode:${siteKey}`
}
