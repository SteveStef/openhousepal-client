// The two Spotlight templates share their interactive pieces (lead form, payment estimator,
// share sheet, calendar menu...) but not their look: Cinematic Luxury is dark, rounded and
// glowing; Editorial Estate is paper-light, hairline-ruled and square. Each shared component takes
// a `tone` and pulls its class names from here. The accent color itself comes from the
// template root's --sp-accent / --sp-on-accent CSS variables (the agent's brand kit color).
export type Tone = 'dark' | 'light'

export const TONE = {
  dark: {
    text: 'text-white',
    muted: 'text-white/60',
    faint: 'text-white/40',
    card: 'rounded-3xl border border-white/10 bg-white/[0.035]',
    cardSolid: 'rounded-3xl border border-white/10 bg-[#121212]',
    input: 'w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder:text-white/35 outline-none transition focus:border-[color:var(--sp-accent)] focus:bg-white/[0.07]',
    label: 'text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45',
    chip: 'rounded-xl border border-white/[0.12] bg-white/[0.03] text-white/75 hover:border-white/30',
    chipOn: 'rounded-xl border border-[color:var(--sp-accent)] bg-[color:color-mix(in_srgb,var(--sp-accent)_16%,transparent)] text-white',
    primaryBtn: 'rounded-full bg-[color:var(--sp-accent)] text-[color:var(--sp-on-accent)] shadow-[0_18px_40px_-18px_var(--sp-accent)] hover:brightness-110',
    ghostBtn: 'rounded-full border border-white/20 text-white hover:border-white/50 hover:bg-white/5',
    divider: 'border-white/10',
    menu: 'rounded-2xl border border-white/10 bg-[#161616] text-white shadow-2xl',
    menuItem: 'hover:bg-white/[0.06]',
    error: 'text-rose-300',
    heading: 'sp-display',
    modal: 'rounded-3xl border border-white/10 bg-[#111] text-white',
  },
  light: {
    text: 'text-[#172522]',
    muted: 'text-[#172522]/65',
    faint: 'text-[#172522]/45',
    card: 'rounded-[2px] border border-[#172522]/15 bg-white/60',
    cardSolid: 'rounded-[2px] border border-[#172522]/15 bg-white',
    input: 'w-full rounded-none border-0 border-b border-[#172522]/30 bg-transparent px-0 py-3.5 text-[15px] text-[#172522] placeholder:text-[#172522]/40 outline-none transition focus:border-[#172522]',
    label: 'sp-mono text-[10px] uppercase tracking-[0.18em] text-[#172522]/55',
    chip: 'rounded-[2px] border border-[#172522]/20 bg-transparent text-[#172522]/75 hover:border-[#172522]/50',
    chipOn: 'rounded-[2px] border border-[#172522] bg-[#172522] text-[#f3efe6]',
    primaryBtn: 'rounded-[2px] bg-[#172522] text-[#f3efe6] hover:bg-[#0c1614]',
    ghostBtn: 'rounded-[2px] border border-[#172522]/35 text-[#172522] hover:border-[#172522] hover:bg-[#172522]/[0.04]',
    divider: 'border-[#172522]/15',
    menu: 'rounded-[2px] border border-[#172522]/15 bg-[#fbf9f4] text-[#172522] shadow-2xl',
    menuItem: 'hover:bg-[#172522]/[0.05]',
    error: 'text-[#9f1d1d]',
    heading: 'sp-display',
    modal: 'rounded-[2px] border border-[#172522]/10 bg-[#f7f3ea] text-[#172522]',
  },
} as const

// Pick black or white text for a given accent so a pale brand color never gets white-on-cream.
export function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return '#111111'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.6 ? '#111111' : '#ffffff'
}

// A brand kit color that's nearly black/white would vanish against one of the two templates'
// backgrounds - fall back to the template's own signature accent in that case.
export function usableAccent(hex: string | null | undefined, fallback: string, tone: Tone): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (tone === 'dark' && lum < 0.18) return fallback
  if (tone === 'light' && lum > 0.85) return fallback
  return `#${m[1]}`
}
