'use client'

// Phones (user, 10/17): pulling past the top of a page (refresh) or past the footer showed the
// phone's own white/black instead of the page's colour, and the browser bar didn't match either -
// other sites look like one continuous colour. The rubber-band area shows the <html> background and
// the bar uses <meta name="theme-color">, so both are kept equal to the page's own background:
// sampled from the page itself (the left edge, half way down - almost always the page background,
// never a card), on load, on every navigation, on light/dark changes and as content arrives. Works
// for the app (ivory / near-black) and for agents' public pages with their own colours.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function bgAt(x: number, y: number): string | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null
  while (el) {
    const c = getComputedStyle(el).backgroundColor
    if (c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c)) {
      // a semi-transparent layer isn't the page colour - keep looking underneath
      const m = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/.exec(c)
      if (!m || parseFloat(m[1]) > 0.9) return c
    }
    el = el.parentElement
  }
  return null
}

function sync() {
  if (typeof document === 'undefined') return
  const y = Math.round(window.innerHeight * 0.5)
  const color = bgAt(1, y) || bgAt(window.innerWidth - 2, y) || getComputedStyle(document.body).backgroundColor
  if (!color) return
  document.documentElement.style.backgroundColor = color
  let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if (meta.content !== color) meta.content = color
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
    return () => {
      window.clearTimeout(t); timers.forEach(window.clearTimeout); mo.disconnect()
      window.removeEventListener('resize', soon as () => void)
    }
  }, [pathname])
  return null
}
