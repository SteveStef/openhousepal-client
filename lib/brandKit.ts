// ============================================================================================
// THE BRAND KIT - the one central look for each agent (Studio -> Brand Kit, or the setup flow's
// Brand step). Every feature that can be styled (Agent Hub, IDX website, forms, Email Signature)
// wears it by default ("My Brand Kit") until the agent picks "Choose my own" in that feature.
//
// Exports (import from '@/lib/brandKit'):
//   BRAND_COLORS            {color,label}[] - the palette. EXACTLY the Agent Hub / IDX / Signature
//                           colors (lib/accentSwatches - one list) incl. the newer everyday colors.
//   BRAND_COLOR_GROUPS      the same palette in display rows (gold + colors / everyday / black).
//   BRAND_MAIN_COLORS       picks for a main / background color (the palette + silver + white).
//   BRAND_LOOKS             the looks: Classic, Luxe (Luxe = IDX plan only).
//   BRAND_FINISHES          Luxe's three finishes: Gold, Silver, Bronze (lib/luxeMetals).
//   BRAND_MODES             Ivory (light) / Midnight (dark) - the user-facing names for light / dark.
//   modeLabel(dark)         'Ivory' | 'Midnight'.
//   brandColorName(hex)     palette name for a color, or null.
//   type BrandLook          { theme, metal, dark, accent, primary, saved }.
//   DEFAULT_BRAND_LOOK
//   brandLookOf(kit)        BrandKit (API) -> BrandLook (always complete).
//   brandClassicAccent(hex) a kit color made safe as a Classic accent (near-white -> Original gold).
//   luxeAllowedFor(user)    Luxe is IDX only.
//   useBrandKit()           { kit, look, loading, save(patch), reload } - shared, cached, and every
//                           mounted copy updates when any of them saves.
//   resolveLook(feature, kit)  "brand kit unless the feature overrides": feature = { source?:
//                           'brand' | 'own' | null, theme?, accent?, metal?, dark? } -> the look to
//                           show + fromBrandKit. No source and no own values = the brand kit.
//   brandFormLook(kit, luxeAllowed)       -> lib/formLook FormLook (forms on "My Brand Kit").
//   brandHubPatch(look)                   -> Agent Hub config keys (hubTheme, hubAccent, ...).
//   brandSignaturePatch(look, luxeAllowed)-> Email Signature config keys.
//   siteThemeWithBrand(theme, kit)        -> IDX SiteTheme while it follows the Brand Kit.
//
// Storage (no migration): colors / fonts / logos on studio_brand_kits; the look (theme, metal,
// Ivory/Midnight) on users.setup_state.brand_look - both via GET/PUT /studio/brand-kit. The backend
// twin is backend/app/services/brand_look_service.py (same rules, used by the public pages).
// ============================================================================================

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api-service'
import type { BrandKit, BrandKitLook, SiteTheme } from '@/types'
import { ACCENT_COLORS, ACCENT_SWATCHES } from '@/lib/accentSwatches'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import type { FormLook } from '@/lib/formLook'

export type BrandColor = { color: string; label: string }

// The metal swatches are Luxe's finishes (BRAND_FINISHES), and white would vanish on buttons - so,
// exactly like the Agent Hub's Classic colors, the palette is the hub's Original gold + every other
// color. The IDX website's Classic colors are the same list minus the gold.
const NOT_A_COLOR = new Set(['bronze', 'silver', 'gold', 'white'])
const ORIGINAL_GOLD: BrandColor = { color: '#C9A24D', label: 'Original' } // the Agent Hub's own name for it (HubClassicTheme)

/** BRAND_COLORS in display rows (the dividers of lib/accentSwatches). */
export const BRAND_COLOR_GROUPS: BrandColor[][] = ACCENT_SWATCHES.reduce<BrandColor[][]>((rows, s) => {
  if ('divider' in s) rows.push([])
  else if (!NOT_A_COLOR.has(s.label.toLowerCase())) rows[rows.length - 1].push(s)
  return rows
}, [[]]).filter(r => r.length).map((r, i) => (i === 0 ? [ORIGINAL_GOLD, ...r] : r))

/** The palette - the same list the Agent Hub, IDX website and Email Signature offer. */
export const BRAND_COLORS: BrandColor[] = BRAND_COLOR_GROUPS.flat()

/** For a main / background color, light picks are fine too. */
export const BRAND_MAIN_COLORS: BrandColor[] = [...BRAND_COLORS.filter(c => c !== ORIGINAL_GOLD), ...ACCENT_COLORS.filter(c => ['silver', 'white'].includes(c.label.toLowerCase()))]

export const BRAND_LOOKS = [
  { id: 'classic', label: 'Classic', blurb: 'Clean and bright, in your color.', idxOnly: false },
  { id: 'luxe', label: 'Luxe', blurb: 'Metal shine, serif type, cinematic light.', idxOnly: true },
] as const
export type BrandLookTheme = (typeof BRAND_LOOKS)[number]['id']

export const BRAND_FINISHES = LUXE_METAL_ORDER.map(id => ({ id, label: LUXE_METALS[id].label, palette: LUXE_METALS[id] }))

export const BRAND_MODES = [
  { id: 'ivory', dark: false, label: 'Ivory', blurb: 'Bright pages, dark text.' },
  { id: 'midnight', dark: true, label: 'Midnight', blurb: 'Deep pages, light text.' },
] as const

export const modeLabel = (dark: boolean | null | undefined) => (dark ? 'Midnight' : 'Ivory')

export function brandColorName(hex: string | null | undefined): string | null {
  const v = (hex || '').toLowerCase()
  return [...BRAND_COLORS, ...BRAND_MAIN_COLORS].find(c => c.color.toLowerCase() === v)?.label || null
}

export type BrandLook = {
  theme: BrandLookTheme
  metal: LuxeMetal
  dark: boolean
  /** The Classic color (secondary_color, safe for buttons). */
  accent: string
  /** The main / panel color (primary_color). */
  primary: string
  /** The agent picked a look (not just the defaults). */
  saved: boolean
}

export const HUB_ORIGINAL_GOLD = '#C9A24D'

export const DEFAULT_BRAND_LOOK: BrandLook = { theme: 'classic', metal: 'gold', dark: false, accent: HUB_ORIGINAL_GOLD, primary: '#111827', saved: false }

const hex6 = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  let h = v.trim()
  if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map(c => c + c).join('')
  return /^#[0-9a-f]{6}$/i.test(h) ? h.toUpperCase() : null
}
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 }

/** A Brand Kit color as a Classic accent - near-white would vanish on buttons, so it falls back
 *  to the Original gold. Same rule as the backend's brand_look_service.classic_accent. */
export function brandClassicAccent(value: unknown): string {
  const h = hex6(value)
  return h && lum(h) <= 0.85 ? h : HUB_ORIGINAL_GOLD
}

export function brandLookOf(kit: Partial<BrandKit> | null | undefined): BrandLook {
  const l: Partial<BrandKitLook> = kit?.look || {}
  return {
    theme: l.theme === 'luxe' ? 'luxe' : 'classic',
    metal: metalOf(l.metal),
    dark: l.dark === true,
    accent: brandClassicAccent(kit?.secondary_color),
    primary: hex6(kit?.primary_color) || '#111827',
    saved: !!l.saved,
  }
}

export const luxeAllowedFor = (user: { plan_tier?: string | null } | null | undefined) => user?.plan_tier === 'IDX'

// ---------- the shared hook ----------

let cache: BrandKit | null = null
let inflight: Promise<BrandKit | null> | null = null
const listeners = new Set<(kit: BrandKit | null) => void>()
const emit = (kit: BrandKit | null) => { cache = kit; listeners.forEach(fn => fn(kit)) }

function fetchKit(force = false): Promise<BrandKit | null> {
  if (cache && !force) return Promise.resolve(cache)
  if (inflight && !force) return inflight
  inflight = api.studio.getBrandKit().then(r => {
    inflight = null
    const kit = r.success && r.data ? r.data : null
    if (kit) emit(kit)
    return kit
  })
  return inflight
}

export type BrandKitPatch = Partial<Pick<BrandKit, 'primary_color' | 'secondary_color' | 'accent_color' | 'heading_font' | 'body_font' | 'disclaimer_text'>> & {
  look?: { theme?: BrandLookTheme; metal?: LuxeMetal; dark?: boolean }
}

/** The agent's Brand Kit. `save` writes it (the backend pushes it to every feature on "My Brand
 *  Kit") and updates every component using this hook. */
export function useBrandKit() {
  const [kit, setKit] = useState<BrandKit | null>(cache)
  const [loading, setLoading] = useState(!cache)
  useEffect(() => {
    listeners.add(setKit)
    // Always refresh once on mount - another tab may have changed it.
    fetchKit(true).then(k => { if (k) setKit(k); setLoading(false) })
    return () => { listeners.delete(setKit) }
  }, [])
  const save = useCallback(async (patch: BrandKitPatch) => {
    const r = await api.studio.updateBrandKit(patch)
    if (r.success && r.data) emit(r.data)
    return r
  }, [])
  const reload = useCallback(() => fetchKit(true), [])
  return { kit, look: brandLookOf(kit), loading, save, reload, setLocal: (k: BrandKit) => emit(k) }
}

// ---------- "brand kit unless the feature overrides" ----------

export type FeatureLookSetting = {
  /** 'brand' = My Brand Kit, 'own' = Choose my own. Missing = decided by whether own values exist. */
  source?: 'brand' | 'own' | null
  theme?: BrandLookTheme | null
  accent?: string | null
  metal?: LuxeMetal | string | null
  dark?: boolean | null
}

export function resolveLook(feature: FeatureLookSetting | null | undefined, kit: Partial<BrandKit> | BrandLook | null | undefined): BrandLook & { fromBrandKit: boolean } {
  const brand = kit && 'theme' in kit ? kit as BrandLook : brandLookOf(kit as Partial<BrandKit> | null | undefined)
  const f = feature || {}
  const hasOwn = f.theme != null || f.accent != null || f.metal != null || f.dark === true
  const fromBrandKit = f.source === 'brand' || (f.source !== 'own' && !hasOwn)
  if (fromBrandKit) return { ...brand, fromBrandKit: true }
  return {
    theme: f.theme === 'luxe' ? 'luxe' : 'classic',
    metal: metalOf(f.metal),
    dark: f.dark === true,
    accent: hex6(f.accent) || brand.accent,
    primary: brand.primary,
    saved: brand.saved,
    fromBrandKit: false,
  }
}

/** A form on "My Brand Kit" (lib/formLook). */
export function brandFormLook(kit: Partial<BrandKit> | BrandLook | null | undefined, luxeAllowed: boolean): FormLook {
  const l = resolveLook({ source: 'brand' }, kit)
  return { theme: l.theme === 'luxe' && luxeAllowed ? 'luxe' : 'classic', accent: l.accent, metal: l.metal, dark: l.dark }
}

/** Agent Hub config keys for the brand look (+ lookSource 'brand'). */
export function brandHubPatch(look: BrandLook) {
  return { hubTheme: look.theme, hubAccent: look.accent, hubLuxeMetal: look.metal, visitorDarkMode: look.dark, lookSource: 'brand' as const }
}

/** Email Signature config keys for the brand look (+ lookSource 'brand'). */
export function brandSignaturePatch(look: BrandLook, luxeAllowed: boolean) {
  const luxe = look.theme === 'luxe' && luxeAllowed
  return { lookSource: 'brand' as const, luxe, luxeMetal: look.metal, accentColor: luxe ? LUXE_METALS[look.metal].base : look.accent, darkMode: look.dark }
}

/** The IDX site theme while it follows the Brand Kit (mirrors content_adapters.resolve_theme):
 *  colors, fonts and logo always; the look only once the agent saved one. */
export function siteThemeWithBrand(theme: SiteTheme, kit: BrandKit | null | undefined): SiteTheme {
  if (!kit || theme.follow_brand_kit === false) return theme
  const look = brandLookOf(kit)
  const next: SiteTheme = {
    ...theme,
    primary_color: kit.primary_color || theme.primary_color,
    secondary_color: kit.secondary_color || theme.secondary_color,
    heading_font: kit.heading_font || theme.heading_font,
    body_font: kit.body_font || theme.body_font,
    logo_url: kit.personal_logo_url || kit.team_logo_url || kit.brokerage_logo_url || theme.logo_url,
  }
  if (look.saved) {
    next.template = look.theme === 'luxe' ? 'luxe' : 'default'
    next.mode = look.dark ? 'dark' : 'light'
    next.luxe_metal = look.metal
    if (look.theme !== 'luxe') next.secondary_color = look.accent
  }
  return next
}
