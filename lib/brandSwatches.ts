// The quick color picks for an agent's brand - Setup's "Your brand" step and Studio's Brand Kit read
// the same lists, so both offer exactly the same choices. Both now come from the one palette in
// lib/brandKit.ts (= the Agent Hub / IDX / Email Signature colors). Designs already handle a light
// main color (white, silver): lib/studio/designTheme.ts brandPalette switches to dark type on it.
import { BRAND_COLORS, BRAND_MAIN_COLORS as MAIN } from '@/lib/brandKit'

export type BrandSwatch = { color: string; label: string }

/** Main color - headers and backgrounds. */
export const BRAND_MAIN_COLORS: BrandSwatch[] = MAIN

/** Accent color - buttons and highlights (the color every feature on "My Brand Kit" uses). */
export const BRAND_ACCENT_COLORS: BrandSwatch[] = BRAND_COLORS
