// Agent Hub Classic - the agent's accent colour. Classic gets the same colour set as the Email
// Signature (lib/accentSwatches.ts) minus the metal finishes (those are Luxe's gold/silver/bronze)
// and White (it would vanish on the buttons). "Original" is the warm gold Classic always had.
//
// The lead buttons are styled here for every Classic hub (Save Contact solid in the accent, the
// rest tinted with it); the gold text/borders across the page only swap when the agent picked a
// colour other than Original (`hub-accent-custom`), so the original look stays byte-for-byte.
import { ACCENT_COLORS } from '@/lib/accentSwatches'

export const HUB_CLASSIC_DEFAULT_ACCENT = '#C9A24D'
const METALS_AND_WHITE = new Set(['bronze', 'silver', 'gold', 'white'])
export const HUB_CLASSIC_ACCENTS: { color: string; label: string }[] = [
  { color: HUB_CLASSIC_DEFAULT_ACCENT, label: 'Original' },
  ...ACCENT_COLORS.filter(s => !METALS_AND_WHITE.has(s.label.toLowerCase())),
]

export function hubAccentOf(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : ''
  if (HUB_CLASSIC_ACCENTS.some(a => a.color.toLowerCase() === v.toLowerCase())) return v
  // A Brand Kit color outside the swatches (the hub follows the Brand Kit by default - lib/brandKit)
  // is fine too, unless it's so light it would vanish on the buttons.
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    const [r, g, b] = rgbOf(v)
    if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 <= 0.85) return v
  }
  return HUB_CLASSIC_DEFAULT_ACCENT
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Root classes for a Classic hub (empty on Luxe). */
export function hubClassicClass(theme: string, accent: string): string {
  if (theme === 'luxe') return ''
  return `hub-classic${hubAccentOf(accent).toLowerCase() !== HUB_CLASSIC_DEFAULT_ACCENT.toLowerCase() ? ' hub-accent-custom' : ''}`
}

/** Inline CSS variables the Classic stylesheet reads. */
export function hubAccentStyle(accent: string): React.CSSProperties {
  const color = hubAccentOf(accent)
  const [r, g, b] = rgbOf(color)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return {
    '--hub-accent': color,
    '--hub-accent-rgb': `${r},${g},${b}`,
    '--hub-accent-ink': luminance > 0.6 ? '#111827' : '#ffffff',
  } as React.CSSProperties
}

const CSS = String.raw`
.hub-classic { --hub-accent-deep: color-mix(in srgb, var(--hub-accent) 72%, #111827); --hub-accent-soft: color-mix(in srgb, var(--hub-accent) 58%, #ffffff); }

/* Lead buttons. Hover lifts a touch and deepens the shadow - no colour swap. Doubled classes so
   these outrank the hub's generic dark-mode overrides in globals.css. */
.hub-classic.hub-classic .hub-btn-save.hub-btn-save { background: var(--hub-accent) !important; color: var(--hub-accent-ink) !important; border-color: var(--hub-accent) !important; box-shadow: 0 10px 22px -14px rgba(var(--hub-accent-rgb),.95) !important; }
.dark .hub-classic.hub-classic .hub-btn-save.hub-btn-save { border-color: color-mix(in srgb, var(--hub-accent) 70%, #ffffff) !important; }
.hub-classic.hub-classic .hub-btn-buy.hub-btn-buy, .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell { background: linear-gradient(180deg, rgba(var(--hub-accent-rgb),.13), rgba(var(--hub-accent-rgb),.05)), #ffffff !important; border-color: rgba(var(--hub-accent-rgb),.45) !important; color: #111827 !important; }
.hub-classic.hub-classic .hub-btn-buy.hub-btn-buy svg, .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell svg { color: var(--hub-accent-deep); }
.dark .hub-classic.hub-classic .hub-btn-buy.hub-btn-buy, .dark .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell { background: linear-gradient(180deg, rgba(var(--hub-accent-rgb),.22), rgba(var(--hub-accent-rgb),.08)), #151517 !important; border-color: rgba(var(--hub-accent-rgb),.5) !important; color: #ffffff !important; }
.dark .hub-classic.hub-classic .hub-btn-buy.hub-btn-buy svg, .dark .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell svg { color: var(--hub-accent-soft); }
.hub-classic.hub-classic .hub-btn-worth.hub-btn-worth { background: radial-gradient(120% 160% at 100% 0%, rgba(var(--hub-accent-rgb),.16), transparent 60%), #ffffff !important; border-color: var(--hub-accent) !important; }
.hub-classic.hub-classic .hub-btn-worth.hub-btn-worth svg { color: var(--hub-accent-deep) !important; }
.dark .hub-classic.hub-classic .hub-btn-worth.hub-btn-worth { background: radial-gradient(120% 160% at 100% 0%, rgba(var(--hub-accent-rgb),.26), transparent 60%), #151517 !important; border-color: rgba(var(--hub-accent-rgb),.75) !important; }
.dark .hub-classic.hub-classic .hub-btn-worth.hub-btn-worth svg { color: var(--hub-accent-soft) !important; }
.hub-classic.hub-classic .hub-btn-show.hub-btn-show { background: linear-gradient(135deg, var(--hub-accent), color-mix(in srgb, var(--hub-accent) 78%, #ffffff)) !important; color: var(--hub-accent-ink) !important; box-shadow: 0 12px 24px -14px rgba(var(--hub-accent-rgb),.95) !important; }
.hub-classic.hub-classic .hub-btn-save.hub-btn-save, .hub-classic.hub-classic .hub-btn-buy.hub-btn-buy, .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell, .hub-classic.hub-classic .hub-btn-worth.hub-btn-worth, .hub-classic.hub-classic .hub-btn-show.hub-btn-show { transition: transform .25s cubic-bezier(.22,.61,.36,1), box-shadow .25s; }
.hub-classic.hub-classic .hub-btn-save.hub-btn-save:hover, .hub-classic.hub-classic .hub-btn-buy.hub-btn-buy:hover, .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell:hover, .hub-classic.hub-classic .hub-btn-worth.hub-btn-worth:hover, .hub-classic.hub-classic .hub-btn-show.hub-btn-show:hover { transform: translateY(-2px); box-shadow: 0 16px 28px -16px rgba(var(--hub-accent-rgb),.95) !important; }
.hub-classic.hub-classic .hub-btn-save.hub-btn-save:active, .hub-classic.hub-classic .hub-btn-buy.hub-btn-buy:active, .hub-classic.hub-classic .hub-btn-sell.hub-btn-sell:active, .hub-classic.hub-classic .hub-btn-worth.hub-btn-worth:active, .hub-classic.hub-classic .hub-btn-show.hub-btn-show:active { transform: translateY(0) scale(.985); }

/* A colour other than Original: every gold touch on the page follows it. */
.hub-accent-custom .text-\[\#caa65e\], .hub-accent-custom .text-\[\#C9A24D\], .hub-accent-custom .text-\[\#d0ad65\], .hub-accent-custom .text-\[\#8b7355\] { color: var(--hub-accent-deep) !important; }
/* The light gold used on dark photo cards ("Read the story") stays light. */
.hub-accent-custom .text-\[\#e8c97a\] { color: var(--hub-accent-soft) !important; }
.dark .hub-accent-custom .dark\:text-\[\#d7b974\], .dark .hub-accent-custom .dark\:text-\[\#e8c97a\], .dark .hub-accent-custom .text-\[\#caa65e\], .dark .hub-accent-custom .text-\[\#C9A24D\], .dark .hub-accent-custom .text-\[\#d0ad65\], .dark .hub-accent-custom .text-\[\#8b7355\] { color: var(--hub-accent-soft) !important; }
.hub-accent-custom .border-\[\#d2b16f\], .hub-accent-custom .border-\[\#cdaa64\], .hub-accent-custom .border-\[\#d7b974\], .hub-accent-custom .border-\[\#C9A24D\], .hub-accent-custom .hover\:border-\[\#C9A24D\]:hover { border-color: var(--hub-accent) !important; }
.hub-accent-custom .border-\[\#d8c08a\], .hub-accent-custom .border-\[\#d8c08a\]\/40, .hub-accent-custom .border-\[\#d8c08a\]\/50, .hub-accent-custom .border-\[\#C9A24D\]\/25, .hub-accent-custom .border-\[\#C9A24D\]\/40 { border-color: rgba(var(--hub-accent-rgb),.45) !important; }
.dark .hub-accent-custom .dark\:border-\[\#d8c08a\]\/25, .dark .hub-accent-custom .dark\:border-\[\#d7b974\]\/60 { border-color: rgba(var(--hub-accent-rgb),.5) !important; }
.hub-accent-custom .bg-\[\#d2b16f\], .hub-accent-custom .bg-\[\#C9A24D\], .dark .hub-accent-custom .dark\:bg-\[\#caa65e\] { background-color: var(--hub-accent) !important; }
.hub-accent-custom .bg-\[\#8b7355\] { background-color: var(--hub-accent-deep) !important; }
.hub-accent-custom .fill-\[\#C9A24D\] { fill: var(--hub-accent) !important; }
`

export function HubClassicStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}
