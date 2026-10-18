'use client'

// Phones (user, 10/17): pulling past the top of a page (refresh) or past the footer showed the
// phone's own white/black instead of the page's colour, and the browser bar didn't match either -
// other sites look like one continuous colour. The rubber-band area shows the page's background
// colour (iPhone Safari paints it from <body> / <html>) and the bar uses <meta name="theme-color">.
//
// 10/18 (user, iPhone): a page's top and bottom are often different colours (a light page with a
// dark footer, a dark header over a light page), so one colour for both edges left a hard line at
// one of them. Now each edge's colour is read from the page itself - whatever actually paints the
// very top / very bottom of the document (a gradient's first / last stop) - and html + body take
// the TOP colour while the visitor is near the top and the BOTTOM colour once they scroll down, so
// whichever edge they can pull past matches. A page that paints its own full-page background marks
// it with data-page-edge (--hub-edge = the solid colour the Luxe hub settles into at both ends).
// Body is only recoloured where it is never visible itself (a page with see-through gaps keeps it).

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const CLEAR = /^transparent$|rgba\([^)]*,\s*0(\.0+)?\s*\)$/
const alphaOf = (c: string) => {
  const m = /rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)/.exec(c)
  return m ? parseFloat(m[1]) : 1
}

function gradientStops(cs: CSSStyleDeclaration): string[] {
  const img = cs.backgroundImage
  if (!img || img === 'none' || !/gradient\(/.test(img)) return []
  // the base layer = the last gradient listed (the ones before it are glows painted on top)
  const at = Math.max(img.lastIndexOf('linear-gradient('), img.lastIndexOf('radial-gradient('), img.lastIndexOf('conic-gradient('))
  return (img.slice(at).match(/rgba?\([^)]*\)/g) || []).filter(c => alphaOf(c) > 0.9)
}

/** What this element paints at its top or bottom edge (null = see-through). */
function paintAt(el: Element, edge: 'top' | 'bottom'): string | null {
  const cs = getComputedStyle(el)
  const vertical = /linear-gradient\((?:to bottom|180deg|to top|0deg)?/.test(cs.backgroundImage)
  const stops = gradientStops(cs)
  if (stops.length && cs.backgroundImage.startsWith('linear-gradient') && vertical) {
    const dirUp = /linear-gradient\((to top|0deg)/.test(cs.backgroundImage)
    return (edge === 'top') !== dirUp ? stops[0] : stops[stops.length - 1]
  }
  if (stops.length) return edge === 'top' ? stops[0] : stops[stops.length - 1]
  const c = cs.backgroundColor
  return c && !CLEAR.test(c) && alphaOf(c) > 0.9 ? c : null
}

/** The colour at the very top / bottom of the document: follow the elements that reach that edge
 *  (full width, touching it) down from <body>; the deepest one that paints wins. */
function edgeColor(edge: 'top' | 'bottom'): string | null {
  const docH = document.documentElement.scrollHeight
  const vw = window.innerWidth
  let el: Element | null = document.body
  let color: string | null = paintAt(document.body, edge) || paintAt(document.documentElement, edge)
  for (let depth = 0; el && depth < 40; depth++) {
    let next: Element | null = null
    for (const child of Array.from(el.children)) {
      const cs = getComputedStyle(child)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      // something fixed floats over the page - it isn't the page's edge (a bottom action bar)
      if (edge === 'bottom' && cs.position === 'fixed') continue
      const r = child.getBoundingClientRect()
      if (r.width < vw * 0.9 || r.height < 2) continue
      const top = r.top + window.scrollY, bottom = r.bottom + window.scrollY
      const touches = edge === 'top' ? top <= 2 : bottom >= docH - 2
      if (touches) next = child
    }
    if (!next) break
    const c = paintAt(next, edge)
    if (c) color = c
    el = next
  }
  return color
}

/** Body shows through somewhere (a see-through gap) - recolouring it would tint the page itself. */
function bodyVisible(): boolean {
  const pts = [[0.5, 0.5], [0.08, 0.3], [0.92, 0.7], [0.5, 0.9]]
  return pts.some(([fx, fy]) => {
    const els = document.elementsFromPoint(window.innerWidth * fx, window.innerHeight * fy)
    for (const e of els) {
      if (e === document.body || e === document.documentElement) return true
      if (paintAt(e, 'top')) return false
    }
    return false
  })
}

let edges: { top: string; bottom: string; body: boolean } | null = null

function measure() {
  if (typeof document === 'undefined') return
  const layer = document.querySelector('[data-page-edge]') as HTMLElement | null
  const own = layer ? (getComputedStyle(layer).getPropertyValue('--hub-edge').trim() || paintAt(layer, 'bottom')) : null
  const fallback = getComputedStyle(document.body).backgroundColor
  const top = own || edgeColor('top') || fallback
  const bottom = own || edgeColor('bottom') || fallback
  edges = { top, bottom, body: !!own || !bodyVisible() }
  apply()
  let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if (meta.content !== top) meta.content = top
}

/** html + body take the colour of whichever edge the visitor is nearest. */
function apply() {
  if (!edges) return
  const nearTop = window.scrollY < Math.max(200, window.innerHeight * 0.5)
  const color = nearTop ? edges.top : edges.bottom
  const html = document.documentElement, body = document.body
  if (html.dataset.ohpBg !== color) { html.style.backgroundColor = color; html.dataset.ohpBg = color }
  const bodyColor = edges.body ? color : ''
  // Written only when it changes - body's style is watched below, so an equal write would loop.
  if (body.dataset.ohpBg !== bodyColor) { body.style.backgroundColor = bodyColor; body.dataset.ohpBg = bodyColor }
}

export default function ThemeColorSync() {
  const pathname = usePathname()
  useEffect(() => {
    let t: number | undefined
    const soon = (ms = 120) => { window.clearTimeout(t); t = window.setTimeout(measure, ms) }
    // Body back to the page's own colour before measuring a new page (a dark footer colour from the
    // last page must not be read as this page's background).
    document.body.style.backgroundColor = ''
    document.body.dataset.ohpBg = ''
    soon(0)
    // content (and a page's own colours) arrive a moment after navigation
    const timers = [400, 1200, 2500, 5000].map(ms => window.setTimeout(measure, ms))
    const mo = new MutationObserver(() => soon())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-ohp-forced-light'] })
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('resize', soon as () => void)
    let raf = 0
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply() }) }
    window.addEventListener('scroll', onScroll, { passive: true })
    // a page whose look loads late (an Agent Hub's theme arrives with its config) says so
    const changed = () => { soon(60); window.setTimeout(measure, 700) }
    window.addEventListener('ohp-page-colors', changed)
    return () => {
      window.clearTimeout(t); timers.forEach(window.clearTimeout); mo.disconnect()
      window.removeEventListener('resize', soon as () => void)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('ohp-page-colors', changed)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [pathname])
  return null
}
