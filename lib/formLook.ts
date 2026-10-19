// A form's look (user, 10/18 - "make forms colors customizable just like agent hub, same colors
// and themes"): Classic in one of the hub's colours, or Luxe in gold / silver / bronze, light or
// dark. The backend resolves it (matching the Agent Hub unless the form has its own) and the public
// form page, the form's link preview and the editors' previews all paint from here.
import { HUB_CLASSIC_DEFAULT_ACCENT } from '@/components/agent-hub/HubClassicTheme'
import { LUXE_METALS, metalOf, type LuxeMetal } from '@/lib/luxeMetals'

export type FormLook = { theme: 'classic' | 'luxe'; accent: string; metal: LuxeMetal; dark: boolean }

export const DEFAULT_FORM_LOOK: FormLook = { theme: 'classic', accent: HUB_CLASSIC_DEFAULT_ACCENT, metal: 'gold', dark: false }

export function formLookOf(raw: any, fallbackDark = false): FormLook {
  const accent = typeof raw?.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : HUB_CLASSIC_DEFAULT_ACCENT
  return { theme: raw?.theme === 'luxe' ? 'luxe' : 'classic', accent, metal: metalOf(raw?.metal), dark: typeof raw?.dark === 'boolean' ? raw.dark : fallbackDark }
}

const rgbOf = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const }
const lum = (hex: string) => { const [r, g, b] = rgbOf(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a), y = rgbOf(b)
  return '#' + [0, 1, 2].map(i => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0')).join('')
}

export type FormPaint = {
  /** Text, borders, tints - readable on this look's background. */
  text: string
  /** Solid buttons / bars: a colour, or Luxe's metal gradient. */
  fill: string
  /** Text on a fill. */
  ink: string
  /** The page's golds re-tinted to this (lib/accentRecolor); null = keep gold. */
  recolor: string | null
  rgb: string
}

export function formPaint(look: FormLook): FormPaint {
  if (look.theme === 'luxe') {
    const m = LUXE_METALS[look.metal]
    return {
      text: look.dark ? m.light : m.deep,
      fill: `linear-gradient(135deg, ${m.light} 0%, ${m.base} 52%, ${m.deep} 100%)`,
      ink: '#16130e',
      recolor: look.metal === 'gold' ? null : m.base,
      rgb: m.rgb,
    }
  }
  const a = look.accent
  const l = lum(a)
  // Black on a dark page would vanish - it flips to near-white there.
  const fill = look.dark && l < 0.12 ? '#f3f4f6' : a
  const text = look.dark ? (l < 0.2 ? mix(a, '#ffffff', 0.78) : l < 0.45 ? mix(a, '#ffffff', 0.4) : a) : (l > 0.55 ? mix(a, '#111827', 0.3) : a)
  return {
    text,
    fill,
    ink: lum(fill) > 0.6 ? '#111827' : '#ffffff',
    // On a dark page the golds follow the readable shade (navy / black labels vanished there).
    recolor: a.toUpperCase() === HUB_CLASSIC_DEFAULT_ACCENT ? null : look.dark ? text : a,
    rgb: rgbOf(a).join(','),
  }
}

/** Inline CSS variables for a form's root. */
export function formLookVars(look: FormLook): Record<string, string> {
  const p = formPaint(look)
  const m = LUXE_METALS[look.metal]
  return {
    '--fr-fill': p.fill, '--fr-ink': p.ink, '--fr-text': p.text, '--fr-rgb': p.rgb,
    '--fr-m-light': m.light, '--fr-m-base': m.base, '--fr-m-deep': m.deep, '--fr-m-pale': m.pale,
    '--fr-m-rgb': m.rgb, '--fr-m-light-rgb': m.lightRgb,
  }
}

/** Root classes: every look recolours fills; Luxe adds its finish. */
export const formLookClass = (look: FormLook) => `fr-look ${look.theme === 'luxe' ? 'fr-luxe' : 'fr-classic'}`

// Fills ([data-fill]) take the look's colour or metal; Luxe gets warm ivory / jewel black, a serif
// headline with a slow metal glint, a hairline frame and a shimmering metal line along the top.
// No animated blur anywhere (it lagged big layers - see the blur fix).
export const FORM_LOOK_CSS = String.raw`
.fr-look [data-fill] { background: var(--fr-fill) !important; color: var(--fr-ink) !important; }
.fr-look [data-fill] svg { color: var(--fr-ink); }
.fr-luxe.fr-root { background:
  radial-gradient(110% 60% at 88% -8%, rgba(var(--fr-m-rgb),.20), transparent 62%),
  radial-gradient(80% 55% at -12% 108%, rgba(var(--fr-m-light-rgb),.20), transparent 62%),
  linear-gradient(180deg, #fffdf8 0%, #f8f3e9 100%) !important; }
.dark .fr-luxe.fr-root { background:
  radial-gradient(110% 60% at 88% -8%, rgba(var(--fr-m-rgb),.16), transparent 62%),
  radial-gradient(80% 55% at -12% 108%, rgba(var(--fr-m-rgb),.10), transparent 62%),
  linear-gradient(180deg, #0c0c0e 0%, #121116 100%) !important; }
.fr-luxe .fr-veil { color: #fffcf6 !important; }
.dark .fr-luxe .fr-veil { color: #0e0e11 !important; }
.fr-luxe.fr-root::before { content: ""; position: absolute; z-index: 30; left: 0; right: 0; top: 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, var(--fr-m-deep) 18%, var(--fr-m-light) 42%, var(--fr-m-pale) 50%, var(--fr-m-light) 58%, var(--fr-m-deep) 82%, transparent 100%);
  background-size: 200% 100%; animation: frLxLine 7s ease-in-out infinite; }
@media (min-width: 640px) {
  .fr-luxe.fr-root::after { content: ""; position: absolute; z-index: 0; inset: 16px; border-radius: 26px; pointer-events: none; border: 1px solid rgba(var(--fr-m-rgb),.28); box-shadow: inset 0 0 0 5px rgba(var(--fr-m-rgb),.05); }
}
.fr-luxe .fr-title { font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif; font-weight: 800; letter-spacing: -.012em; line-height: 1.12;
  background-image: linear-gradient(100deg, #15120c 0%, #15120c 40%, var(--fr-m-deep) 46%, var(--fr-m-base) 50%, var(--fr-m-deep) 54%, #15120c 60%, #15120c 100%);
  background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent !important; animation: frLxGlint 6s ease-in-out infinite; padding-bottom: .06em; }
.dark .fr-luxe .fr-title { background-image: linear-gradient(100deg, #fff 0%, #fff 40%, var(--fr-m-light) 47%, var(--fr-m-pale) 50%, var(--fr-m-light) 53%, #fff 60%, #fff 100%); }
.fr-luxe .fr-eyebrow { letter-spacing: .3em; }
.fr-luxe [data-fill] { box-shadow: 0 14px 30px -14px rgba(var(--fr-m-rgb),.9), inset 0 1px 0 rgba(255,255,255,.45) !important; }
/* Google's address suggestions hang off <body>: rounded like the form, and dark on a dark form. */
.pac-container { border-radius: 14px; margin-top: 6px; border: 1px solid rgba(17,24,39,.08); box-shadow: 0 18px 40px -18px rgba(17,24,39,.45); overflow: hidden; font-family: inherit; }
.dark .pac-container { background: #151517; border-color: rgba(255,255,255,.1); box-shadow: 0 18px 40px -16px rgba(0,0,0,.8); }
.dark .pac-item { border-top-color: rgba(255,255,255,.07); color: #9ca3af; }
.dark .pac-item:hover, .dark .pac-item-selected { background: rgba(255,255,255,.07); }
.dark .pac-item-query, .dark .pac-matched { color: #ffffff; }
.dark .pac-icon { filter: invert(1) brightness(1.6); opacity: .7; }
.dark .pac-logo:after { filter: invert(1) hue-rotate(180deg) brightness(1.3); }
@keyframes frLxLine { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
@keyframes frLxGlint { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .fr-luxe .fr-title, .fr-luxe.fr-root::before { animation: none; } }
`

/** A form's saved look fields -> what visitors see (the hub's look when it matches the hub). */
export type FormLookFields = { look_mode?: 'hub' | 'custom' | null; look_theme?: 'classic' | 'luxe' | null; accent_color?: string | null; luxe_metal?: string | null; dark_mode?: boolean | null }

export function resolveFormLook(f: FormLookFields, hub: FormLook, luxeAllowed: boolean): FormLook {
  const own = f.look_mode === 'custom'
  const look = own ? formLookOf({ theme: f.look_theme || 'classic', accent: f.accent_color, metal: f.luxe_metal, dark: !!f.dark_mode }) : hub
  return look.theme === 'luxe' && !luxeAllowed ? { ...look, theme: 'classic' } : look
}

/** "Luxe · Gold · Light" / "Classic · Navy · Dark" */
export function formLookLabel(look: FormLook, colorName: (hex: string) => string | null): string {
  const pick = look.theme === 'luxe' ? LUXE_METALS[look.metal].label : colorName(look.accent) || 'Custom color'
  return `${look.theme === 'luxe' ? 'Luxe' : 'Classic'} · ${pick} · ${look.dark ? 'Dark' : 'Light'}`
}
