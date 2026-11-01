'use client'

import { RefObject, useEffect, useState } from 'react'

// The helper's round button never sits on a page's own button (owner, 11/01: on phones it covered
// the Continue buttons at the bottom right). Where it would sit, look at what the page has there - a
// bar stuck to the bottom (fixed / sticky), a button, a field - and move up just above it; then look
// again at the new spot (a list of buttons can sit above a bar), up to the middle of the screen.
// Checked on scroll, resize, page change and every couple of seconds (pages open their own bars).
const SIZE = 60
const EDGE = 24 // bottom-6 / right-6
const GAP = 10
const TRIES = 6

const CLICKABLE = 'button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="tab"]'

// Page content that scrolls only counts when the page can't scroll any further (a Continue button at
// the very end); anything pinned to the screen (a bottom bar, a sticky button) always counts - on a
// long list some button is always passing under the corner, and scrolling uncovers it.
function pinned(el: HTMLElement): HTMLElement | null {
  let n: HTMLElement | null = el
  while (n && n !== document.body) {
    const pos = getComputedStyle(n).position
    if (pos === 'fixed' || pos === 'sticky') return n
    n = n.parentElement
  }
  return null
}

// -> the top of what's in the way, and whether it's pinned to the screen (vs page content)
function obstacleTop(fab: HTMLElement | null, left: number, top: number, h: number, atEnd: boolean): { top: number; pinned: boolean } | null {
  let highest = Infinity
  let anyPinned = false
  const docEnd = (document.scrollingElement || document.documentElement).scrollHeight - window.scrollY
  const xs = [left + 4, left + SIZE / 2, left + SIZE - 4]
  const ys = [top + 4, top + SIZE / 2, top + SIZE - 4]
  for (const x of xs) for (const y of ys) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement) || el === document.body || el === document.documentElement) continue
      if (fab && (fab === el || fab.contains(el))) continue
      if (el.closest('[data-ohp-fab-ignore]')) continue
      const hit = el.closest(CLICKABLE) as HTMLElement | null
      if (hit) {
        const r = hit.getBoundingClientRect()
        const pin = !!pinned(hit)
        // page content: only the last thing on the page (a Continue button at the end) - never a
        // list's rows, or the button would climb half the screen through them
        if (r.height < h * 0.45 && (pin || (atEnd && docEnd - r.bottom < 120))) { highest = Math.min(highest, r.top); anyPinned = anyPinned || pin }
        break
      }
      // a bar stuck to the bottom of the screen (its nearest fixed / sticky box)
      const bar = pinned(el)
      if (bar) {
        const r = bar.getBoundingClientRect()
        // a full-screen layer (a pop-up's backdrop, a page wrapper) or the top header isn't a bar to clear
        if (r.height < h * 0.45 && r.bottom >= h - 2) { highest = Math.min(highest, r.top); anyPinned = true; break }
      }
    }
  }
  return highest === Infinity ? null : { top: highest, pinned: anyPinned }
}

export function useFabLift(fabRef: RefObject<HTMLElement | null>, deps: unknown[] = []): number {
  const [lift, setLift] = useState(0)
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const fab = fabRef.current
      const w = window.innerWidth, h = window.innerHeight
      const left = w - EDGE - SIZE
      const cap = h * 0.55
      const doc = document.scrollingElement || document.documentElement
      const atEnd = doc.scrollTop + h >= doc.scrollHeight - 8
      let bottom = h - EDGE           // the button's bottom edge, starting where it normally sits
      for (let i = 0; i < TRIES; i++) {
        const t = obstacleTop(fab, left, bottom - SIZE, h, atEnd)
        if (t === null) break
        bottom = Math.min(bottom, t.top - GAP)
        if (!t.pinned || h - EDGE - bottom > cap) break   // page content: one step, no climbing
      }
      const next = Math.max(0, Math.min(cap, h - EDGE - bottom))
      setLift(l => (Math.abs(l - next) > 2 ? Math.round(next) : l))
    }
    const soon = () => { if (!frame) frame = requestAnimationFrame(measure) }
    soon()
    const t = setInterval(soon, 1800)
    window.addEventListener('scroll', soon, { passive: true })
    window.addEventListener('resize', soon)
    return () => { clearInterval(t); window.removeEventListener('scroll', soon); window.removeEventListener('resize', soon); if (frame) cancelAnimationFrame(frame) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return lift
}
