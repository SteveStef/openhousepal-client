// OpenHousePal Luxe "finish": the same Luxe look (light, shimmer, motion) in gold, silver or
// bronze. Every Luxe surface (Email Signature, Agent Hub) reads its metal from here; the backend
// mirrors these values in LUXE_METALS (email_signature_service.py) for the email images.

export type LuxeMetal = 'gold' | 'silver' | 'bronze'

export type MetalPalette = {
  label: string
  base: string   // the main metal tone
  light: string  // highlight
  deep: string   // shadow
  mid: string    // in-between (gradient stops)
  pale: string   // brightest glint
  rgb: string; lightRgb: string; deepRgb: string; paleRgb: string
}

export const LUXE_METALS: Record<LuxeMetal, MetalPalette> = {
  gold: { label: 'Gold', base: '#C9A24D', light: '#e8c97a', deep: '#8b6a2b', mid: '#a8803a', pale: '#fff3cf', rgb: '201,162,77', lightRgb: '232,201,122', deepRgb: '139,106,43', paleRgb: '255,243,207' },
  silver: { label: 'Silver', base: '#A9AFB7', light: '#e3e7ec', deep: '#6b717a', mid: '#8c939c', pale: '#ffffff', rgb: '169,175,183', lightRgb: '227,231,236', deepRgb: '107,113,122', paleRgb: '255,255,255' },
  bronze: { label: 'Bronze', base: '#A9714B', light: '#dba47c', deep: '#6e4426', mid: '#8c5a37', pale: '#f6d9c2', rgb: '169,113,75', lightRgb: '219,164,124', deepRgb: '110,68,38', paleRgb: '246,217,194' },
}

export const LUXE_METAL_ORDER: LuxeMetal[] = ['gold', 'silver', 'bronze']

export function metalOf(value: unknown): LuxeMetal {
  return value === 'silver' || value === 'bronze' ? value : 'gold'
}

/** Inline CSS custom properties (--m-*) a Luxe surface's stylesheet reads instead of hard-coded gold. */
export function metalVars(metal: LuxeMetal): string {
  const m = LUXE_METALS[metal]
  return `--m-base:${m.base};--m-light:${m.light};--m-deep:${m.deep};--m-mid:${m.mid};--m-pale:${m.pale};--m-rgb:${m.rgb};--m-light-rgb:${m.lightRgb};--m-deep-rgb:${m.deepRgb};--m-pale-rgb:${m.paleRgb};`
}

export function metalStyle(metal: LuxeMetal): Record<string, string> {
  const m = LUXE_METALS[metal]
  return {
    '--m-base': m.base, '--m-light': m.light, '--m-deep': m.deep, '--m-mid': m.mid, '--m-pale': m.pale,
    '--m-rgb': m.rgb, '--m-light-rgb': m.lightRgb, '--m-deep-rgb': m.deepRgb, '--m-pale-rgb': m.paleRgb,
  }
}
