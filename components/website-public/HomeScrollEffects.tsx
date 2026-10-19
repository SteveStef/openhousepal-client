'use client'

import { ReactNode, useEffect } from 'react'

// IDX home: each section fades up the first time it comes on screen (globals.css
// .ohp-home-scroll-section rules).
//
// 10/19 rewrite (owner: "laggy, glitchy"):
// - an IntersectionObserver at threshold 0.18 never fired for a section taller than ~5 phone
//   screens (the Featured homes), and never fires at all for a section a fast fling jumps over -
//   those sections stayed invisible (blank screen while scrolling). Now: any section whose top has
//   reached 88% of the screen (or is above it) is shown, checked once per frame while scrolling;
//   the listener removes itself once every section is shown.
// - the old MutationObserver re-queried the whole page on EVERY DOM change (carousels, hover
//   photos...) - the sections are server-rendered, so one scan is enough.
export default function HomeScrollEffects({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    root.classList.add('ohp-home-snap-active')
    let pending = Array.from(document.querySelectorAll<HTMLElement>('.ohp-home-scroll-section'))
    pending.forEach(s => s.classList.add('ohp-section-observed'))

    let frame = 0
    const check = () => {
      frame = 0
      const line = window.innerHeight * 0.88
      pending = pending.filter(s => {
        if (s.getBoundingClientRect().top < line) { s.classList.add('ohp-section-visible'); return false }
        return true
      })
      if (!pending.length) window.removeEventListener('scroll', onScroll)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    check()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
      document.querySelectorAll('.ohp-home-scroll-section').forEach(s => s.classList.remove('ohp-section-observed', 'ohp-section-visible'))
      root.classList.remove('ohp-home-snap-active')
    }
  }, [enabled])

  return <>{children}</>
}
