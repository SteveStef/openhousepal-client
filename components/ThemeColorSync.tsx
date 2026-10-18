'use client'

// Phones (user, 10/17): pulling past the top of a page (refresh) or past the footer showed the
// phone's own white/black instead of the page's colour, and the browser bar didn't match either -
// other sites look like one continuous colour. The rubber-band area shows the <html> background and
// the bar uses <meta name="theme-color">, so both are kept equal to the page's own background:
// sampled from the page itself (the left edge, half way down - almost always the page background,
// never a card), on load, on every navigation, on light/dark changes and as content arrives. Works
// for the app (ivory / near-black) and for agents' public pages with their own colours.
//
// 10/18 (user, iPhone): past an Agent Hub's footer / above its header showed the plain ivory <body>
// with a hard line - Safari paints that strip with the BODY's colour, and the Luxe background was
// still changing colour right at its edges. A page that paints its own full-page background marks
// it with data-page-edge; its edge colour (--hub-edge: the solid colour the Luxe background settles
// into at its very top and bottom, else its plain background colour) goes on html, body and the
// browser bar, so the page runs on past its edges in one colour.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// A page painted with a gradient (no solid colour - e.g. the Luxe Agent Hub) reported "transparent"
// and fell through to the plain body colour (user, 10/17: the hub's peach vs white past the edges).
// Use its base gradient's middle colour stop - the colour most of the page reads as.
function gradientStops(el: HTMLElement, cs: CSSStyleDeclaration): string[] {
  const img = cs.backgroundImage
  if (!img || img === 'none' || !/gradient\(/.test(img)) return []
  if (el.getBoundingClientRect().width < window.innerWidth * 0.9) return []
  const at = Math.max(img.lastIndexOf('linear-gradient('), img.lastIndexOf('radial-gradient('), img.lastIndexOf('conic-gradient('))
  return (img.slice(at).match(/rgba?\([^)]*\)/g) || []).filter(c => {
    const m = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/.exec(c)
    return !m || parseFloat(m[1]) > 0.9
  })
}
function gradientColor(el: HTMLElement, cs: CSSStyleDeclaration): string | null {
  const stops = gradientStops(el, cs)
  return stops.length ? stops[Math.floor((stops.length - 1) / 2)] : null
}

function bgAt(x: number, y: number): string | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null
  while (el) {
    const cs = getComputedStyle(el)
    const c = cs.backgroundColor
    if (c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c)) {
      // a semi-transparent layer isn't the page colour - keep looking underneath
      const m = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/.exec(c)
      if (!m || parseFloat(m[1]) > 0.9) return c
    }
    const g = gradientColor(el, cs)
    if (g) return g
    el = el.parentElement
  }
  return null
}

function sync() {
  if (typeof document === 'undefined') return
  const y = Math.round(window.innerHeight * 0.5)
  const color = bgAt(1, y) || bgAt(window.innerWidth - 2, y) || getComputedStyle(document.body).backgroundColor
  if (!color) return
  const body = document.body
  let bodyColor = ''
  let pageColor = color
  const layer = document.querySelector('[data-page-edge]') as HTMLElement | null
  if (layer) {
    const cs = getComputedStyle(layer)
    const edge = cs.getPropertyValue('--hub-edge').trim() || cs.backgroundColor
    if (edge && !/^transparent$|rgba\([^)]*,\s*0\s*\)/.test(edge)) pageColor = bodyColor = edge
  }
  if (document.documentElement.dataset.ohpBg !== pageColor) {
    document.documentElement.style.backgroundColor = pageColor
    document.documentElement.dataset.ohpBg = pageColor
  }
  // Written only when it changes - body's style is watched below, so an equal write would loop.
  if (body.dataset.ohpBg !== bodyColor) {
    body.style.backgroundColor = bodyColor
    body.dataset.ohpBg = bodyColor
  }
  let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if (meta.content !== pageColor) meta.content = pageColor
}

export default function ThemeColorSync() {
  const pathname = usePathname()
  useEffect(() => {
    let t: number | undefined
    const soon = (ms = 120) => { window.clearTimeout(t); t = window.setTimeout(sync, ms) }
    soon(0)
    // content (and a page's own colours) arrive a moment after navigation
    const timers = [400, 1200, 2500, 5000].map(ms => window.setTimeout(sync, ms))
    const mo = new MutationObserver(() => soon())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-ohp-forced-light'] })
    mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] })
    window.addEventListener('resize', soon as () => void)
    // a page whose look loads late (an Agent Hub's theme arrives with its config) says so
    const changed = () => { soon(60); window.setTimeout(sync, 700) }
    window.addEventListener('ohp-page-colors', changed)
    return () => {
      window.clearTimeout(t); timers.forEach(window.clearTimeout); mo.disconnect()
      window.removeEventListener('resize', soon as () => void)
      window.removeEventListener('ohp-page-colors', changed)
    }
  }, [pathname])
  return null
}
