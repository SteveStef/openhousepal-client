'use client'

import { useEffect, useState } from 'react'

// Shared motion plumbing for both Spotlight templates (10/22 speed pass).
//
// 1. Looping decoration (the header's slow zoom, the ticker, sparks, gold shimmer, "live" rings...)
//    only runs while it is on screen. Anything inside an element marked `sp-loop` is paused the
//    moment that element scrolls out of view and picks up where it left off when it comes back -
//    so a visitor reading the Details section isn't paying for a header animation they can't see.
// 2. Pop-up windows (photos, share, menus, the full story) animate closed as well as open:
//    usePresence keeps a window on the page for its closing animation.

/** Paste into a template's <style>: the pause switch the observer below flips. */
export const SP_MOTION_CSS = `
.sp-paused,.sp-paused *,.sp-paused::before,.sp-paused::after,.sp-paused *::before,.sp-paused *::after{animation-play-state:paused!important}
`

/** Pause every `.sp-loop` block under root while it is off screen. */
export function useOffscreenPause(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('sp-paused', !e.isIntersecting))
    }, { rootMargin: '160px 0px' })
    const seen = new WeakSet<Element>()
    const scan = () => root.querySelectorAll('.sp-loop').forEach(el => {
      if (seen.has(el)) return
      seen.add(el)
      io.observe(el)
    })
    scan()
    // Sections that render a beat later (town facts, guest tools) - one late look is enough.
    const t = window.setTimeout(scan, 2000)
    return () => { window.clearTimeout(t); io.disconnect() }
  }, [rootRef])
}

/** Keep a window mounted for `exitMs` after it's told to close, so it can animate away.
 *  `closing` is true during that time - add the closing class with it. */
export function usePresence(open: boolean, exitMs = 240): { show: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs)
    return () => window.clearTimeout(t)
  }, [open, exitMs])
  return { show: open || mounted, closing: !open && mounted }
}
