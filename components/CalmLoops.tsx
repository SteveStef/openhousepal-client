'use client'

import { RefObject, useEffect, useRef, useState } from 'react'

// A page's endless decorations (glows, shimmers, sparkles, spinning badges...) never run a phone
// hot (owner, 11/01 - the homepage left open on a phone got very hot: ~30 loops plus the tagline
// and demo timers kept it redrawing 60 times a second). Loops only play while they're on screen,
// and once nobody has touched or scrolled for `idleMs` the page rests - the next touch, scroll or
// key wakes it. Entrance animations (they end on their own) are never touched. JavaScript loops
// (the tagline, the demo player) use usePlayWhenSeen below.
const SWEEP_MS = 1500
const SCROLL_SWEEP_MS = 300 // while scrolling; every frame made the browser re-measure the whole page (owner, 11/06: lag)
const MARGIN = 400 // loops wake well before they reach the screen, so none is caught paused

// Resting = nobody has touched the page for a while (shared by CalmLoops and usePlayWhenSeen).
let resting = false
const listeners = new Set<(r: boolean) => void>()
function setResting(r: boolean) {
  if (r === resting) return
  resting = r
  listeners.forEach(l => l(r))
}

export default function CalmLoops({ idleMs = 40000 }: { idleMs?: number }) {
  useEffect(() => {
    if (typeof document.getAnimations !== 'function') return
    const rested = new Set<Animation>()
    let idle = false
    let covered = false   // a pop-up or the helper is open: what's behind it rests (11/01)
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let sweepTimer: ReturnType<typeof setInterval> | null = null
    let frame = 0

    const targetOf = (a: Animation) => ((a.effect as KeyframeEffect | null)?.target ?? null) as Element | null
    const onScreen = (a: Animation) => {
      const t = targetOf(a)
      if (!t) return true
      const r = t.getBoundingClientRect()
      return r.width > 0 && r.bottom > -MARGIN && r.top < window.innerHeight + MARGIN
    }
    const isLoop = (a: Animation) => a.effect?.getComputedTiming().iterations === Infinity

    const sweep = () => {
      frame = 0
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running' || !isLoop(a)) continue
        if (idle || !onScreen(a)) { a.pause(); rested.add(a) }
      }
      if (idle) return
      rested.forEach(a => {
        if (!targetOf(a)?.isConnected) { rested.delete(a); return }
        if (onScreen(a)) { a.play(); rested.delete(a) }
      })
    }
    const startSweeps = () => { if (!sweepTimer) sweepTimer = setInterval(sweep, SWEEP_MS) }
    const goIdle = () => {
      idle = true
      setResting(true)
      sweep()
      // Nothing new to check while everything rests - the next touch starts the sweeps again.
      if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null }
    }
    const wake = () => {
      if (idleTimer) clearTimeout(idleTimer)
      if (covered) return
      idleTimer = setTimeout(goIdle, idleMs)
      if (idle) { idle = false; setResting(false); sweep(); startSweeps() }
    }
    // ScrollLockWatcher hides <html>'s scrollbar while a pop-up / the helper is open
    const html = document.documentElement
    const coverMo = new MutationObserver(() => {
      const now = html.style.overflow === 'hidden'
      if (now === covered) return
      covered = now
      if (covered) goIdle()
      else wake()
    })
    coverMo.observe(html, { attributes: true, attributeFilter: ['style'] })
    const onScroll = () => {
      wake()
      if (!frame) frame = window.setTimeout(sweep, SCROLL_SWEEP_MS)
    }

    const opts = { passive: true } as AddEventListenerOptions
    window.addEventListener('scroll', onScroll, opts)
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'] as const) window.addEventListener(ev, wake, opts)
    wake()
    startSweeps()
    sweep()

    return () => {
      window.removeEventListener('scroll', onScroll)
      for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'] as const) window.removeEventListener(ev, wake)
      coverMo.disconnect()
      if (idleTimer) clearTimeout(idleTimer)
      if (sweepTimer) clearInterval(sweepTimer)
      if (frame) clearTimeout(frame)
      rested.forEach(a => { try { a.play() } catch {} })
      setResting(false)
    }
  }, [idleMs])

  return null
}

/**
 * For a JavaScript loop (timers, framer-motion): true while `ref` is on screen and, unless
 * `keepWhileWatched`, while the page isn't resting. A demo someone is watching keeps playing.
 */
export function usePlayWhenSeen(ref: RefObject<Element | null>, { keepWhileWatched = false } = {}) {
  const [seen, setSeen] = useState(true)
  const [rest, setRest] = useState(resting)
  // Watches whatever element the ref holds after each render (it may only appear later).
  const watching = useRef<{ el: Element; io: IntersectionObserver } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (watching.current?.el === el || typeof IntersectionObserver === 'undefined') return
    watching.current?.io.disconnect()
    watching.current = null
    if (!el) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: `${MARGIN}px 0px` })
    io.observe(el)
    watching.current = { el, io }
  })
  useEffect(() => () => { watching.current?.io.disconnect() }, [])
  useEffect(() => {
    listeners.add(setRest)
    return () => { listeners.delete(setRest) }
  }, [])
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    const html = document.documentElement
    const mo = new MutationObserver(() => setCovered(html.style.overflow === 'hidden'))
    mo.observe(html, { attributes: true, attributeFilter: ['style'] })
    return () => mo.disconnect()
  }, [])
  return seen && !covered && (keepWhileWatched || !rest)
}
