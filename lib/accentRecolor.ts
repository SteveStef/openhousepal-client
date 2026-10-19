'use client'

// Re-tints a page built in OpenHousePal gold to another accent, without touching its code: every
// stylesheet rule that paints one of our golds gets a twin, appended after it, painting the same
// shade of the new accent (lighter golds -> a lighter accent, darker -> darker, see-through levels
// kept). Used by the Showcase when it opens inside an agent's IDX site (?accent=) so it wears the
// site's colour (user, 10/18 - "the colors match whatever the agent customizes their site with").
// Inline style colours aren't covered; Tailwind classes - nearly all of the gold - are.

const GOLDS = ['#C9A24D', '#CAA65E', '#D2B16F', '#E8C97A', '#B08D42', '#A8843A', '#7A5F22', '#D7B974', '#DFC37F', '#B8923F', '#8B7355', '#D8C08A']

type RGB = [number, number, number]
const hexRgb = (h: string): RGB => { const n = parseInt(h.replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255] }

function rgbHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hslRgb([h, s, l]: [number, number, number]): RGB {
  if (!s) return [l, l, l].map(v => Math.round(v * 255)) as RGB
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)) as RGB
}

/** gold rgb "r g b" / "r, g, b" -> the accent's matching shade. */
function shadeMap(accent: string): Map<string, RGB> {
  const base = rgbHsl(hexRgb('#C9A24D'))
  const acc = rgbHsl(hexRgb(accent))
  const out = new Map<string, RGB>()
  for (const g of GOLDS) {
    const rgb = hexRgb(g)
    const hsl = rgbHsl(rgb)
    const l = Math.min(0.96, Math.max(0.06, acc[2] + (hsl[2] - base[2])))
    out.set(rgb.join(','), hslRgb([acc[0], acc[1], l]))
  }
  return out
}

function recolorText(css: string, map: Map<string, RGB>): string | null {
  let changed = false
  // rgb(201 162 77 / .1), rgb(201, 162, 77), rgba(201,162,77,.3)
  let out = css.replace(/(rgba?\(\s*)(\d{1,3})([\s,]+)(\d{1,3})([\s,]+)(\d{1,3})/g, (m, pre, r, s1, g, s2, b) => {
    const to = map.get(`${r},${g},${b}`)
    if (!to) return m
    changed = true
    return `${pre}${to[0]}${s1}${to[1]}${s2}${to[2]}`
  })
  out = out.replace(/#([0-9a-f]{6})\b/gi, (m, hex) => {
    const to = map.get(hexRgb(hex).join(','))
    if (!to) return m
    changed = true
    return `rgb(${to.join(' ')})`
  })
  return changed ? out : null
}

function collect(rules: CSSRuleList, map: Map<string, RGB>, out: string[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const next = recolorText(rule.style.cssText, map)
      if (next) out.push(`${rule.selectorText}{${next}}`)
    } else if (rule instanceof CSSMediaRule) {
      const inner: string[] = []
      collect(rule.cssRules, map, inner)
      if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join('')}}`)
    } else if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) {
      const inner: string[] = []
      collect(rule.cssRules, map, inner)
      if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join('')}}`)
    }
  }
}

const STYLE_ID = 'ohp-accent-recolor'

/** Paint the page's golds in `accent` (#rrggbb). Re-runs as new stylesheets arrive. Returns a stop. */
export function applyAccentRecolor(accent: string): () => void {
  if (!/^#[0-9a-f]{6}$/i.test(accent) || accent.toUpperCase() === '#C9A24D') return () => {}
  const map = shadeMap(accent)
  const done = new WeakSet<CSSStyleSheet>()
  const parts: string[] = []
  const el = document.createElement('style')
  el.id = STYLE_ID
  const run = () => {
    let added = false
    for (const sheet of Array.from(document.styleSheets)) {
      if (done.has(sheet) || sheet.ownerNode === el) continue
      let rules: CSSRuleList
      try { rules = sheet.cssRules } catch { continue } // another site's sheet (fonts) - not ours to read
      done.add(sheet)
      const out: string[] = []
      collect(rules, map, out)
      if (out.length) { parts.push(out.join('\n')); added = true }
    }
    if (added) el.textContent = parts.join('\n')
    // Always last, so its twins win - moved only when something landed after it (a move is itself a
    // change the watcher below sees, so moving it every time would never settle).
    if (document.head.lastElementChild !== el) document.head.appendChild(el)
  }
  run()
  const mo = new MutationObserver(() => run())
  mo.observe(document.head, { childList: true })
  return () => { mo.disconnect(); el.remove() }
}
