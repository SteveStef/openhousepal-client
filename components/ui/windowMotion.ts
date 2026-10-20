'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'framer-motion'

// One open/close feel for the Showcase's windows (tour, comments, adjust search, home details):
// the backdrop fades, the window springs up into place, and on close it drops away quickly. Spread
// these onto framer-motion elements inside an <AnimatePresence>. No backdrop blur - blurring the
// page behind a window re-renders it every frame and makes scrolling lag.
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.2, delay: 0.04 } },
} as const

export const panelMotion = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } },
  exit: { opacity: 0, y: 26, scale: 0.98, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
} as const

/** The last non-null value - keeps a window's content on screen while it animates closed (the
 *  page usually clears the selected home the moment the window is told to close). */
export function useLastValue<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(null)
  if (value != null) ref.current = value
  return ref.current
}

/** Escape closes the window (pass `enabled = false` while something is mid-send). */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, enabled])
}

// ---------------------------------------------------------------------------------------------
// Phone sheets (user, 10/19 - "make the mobile experience stunning"): on a phone a Showcase
// window is a sheet that slides up from the bottom edge, slides back down on close, and can be
// pulled down to close like an iPhone sheet. Desktop keeps panelMotion above.

const PHONE_QUERY = '(max-width: 639px)'

/** True on a phone-width screen (below Tailwind's `sm`) - where windows become bottom sheets. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const

/** panelMotion, but on a phone the window slides up from below the screen and back down on close.
 *  Reduced motion: a plain fade everywhere. */
export function useSheetMotion() {
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.16 } },
      exit: { opacity: 0, transition: { duration: 0.14 } },
    }
  }
  if (!phone) return panelMotion
  const off = typeof window !== 'undefined' ? window.innerHeight : 900
  return {
    initial: { y: off },
    animate: { y: 0, transition: SHEET_SPRING },
    exit: { y: off, transition: { duration: 0.26, ease: [0.32, 0, 0.67, 0] as const } },
  }
}

// iOS-style resistance past an edge: the further you pull, the less it moves.
const rubber = (d: number, dim = 600) => (1 - 1 / ((d * 0.55) / dim + 1)) * dim

/** Pull a phone sheet down to close it. Attach `sheetRef` to the sheet and `style={{ y }}` on it.
 *  A downward pull starts only when whatever is under the finger is scrolled to its top (so it
 *  never fights scrolling), only for a mostly-vertical move (photo carousels keep their swipes),
 *  and never on a map or a text box. Past ~a quarter of the sheet, or with a quick flick, the sheet
 *  closes and its exit animation carries on from where the finger left it; otherwise it springs
 *  back. Pulling up past the top rubber-bands. */
export function useSwipeToClose(onClose: () => void, enabled: boolean): { sheetRef: (el: HTMLDivElement | null) => void; y: MotionValue<number> } {
  // A callback ref, so the pull works even when the sheet mounts after the window does.
  const [sheet, sheetRef] = useState<HTMLDivElement | null>(null)
  const y = useMotionValue(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!enabled || !sheet) return
    let startX = 0, startY = 0, lastY = 0, lastT = 0, vel = 0
    let decided = false, active = false
    const scrolledAbove = (target: EventTarget | null) => {
      for (let el = target as HTMLElement | null; el && el !== sheet.parentElement; el = el.parentElement) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 1) return true
      }
      return false
    }
    const blocked = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.('[data-no-sheet-drag], .gm-style, input, textarea, select, [contenteditable="true"]')
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { decided = true; active = false; return }
      const t = e.touches[0]
      startX = t.clientX; startY = t.clientY; lastY = t.clientY; lastT = e.timeStamp; vel = 0
      decided = false; active = false
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX, dy = t.clientY - startY
      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        decided = true
        active = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2 && !blocked(e.target) && !scrolledAbove(e.target)
        if (active) startY = t.clientY // start from here so the sheet doesn't jump by the slop
      }
      if (!active) return
      if (e.cancelable) e.preventDefault()
      const d = t.clientY - startY
      y.set(d >= 0 ? d : -rubber(-d, 300))
      const dt = Math.max(1, e.timeStamp - lastT)
      vel = ((t.clientY - lastY) / dt) * 1000
      lastY = t.clientY; lastT = e.timeStamp
    }
    const onEnd = () => {
      if (!active) return
      active = false
      const h = sheet.offsetHeight || window.innerHeight
      if (y.get() > Math.min(150, h * 0.22) || (vel > 650 && y.get() > 24)) closeRef.current()
      else animate(y, 0, { type: 'spring', stiffness: 520, damping: 42 })
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, sheet, y])
  return { sheetRef, y }
}

/** The page behind a window can't scroll while it's open: it's pinned in place (position: fixed at
 *  its current scroll) and put back at exactly the same spot once the window has finished closing.
 *  Laid down before the first paint (useLayoutEffect) so the page never scrolls a frame first. The
 *  overlay should opt out of the site-wide ScrollLockWatcher (data-scroll-lock="off") - two locks
 *  fighting over <body> is what made a phone jump to the top and back when details closed (10/19).
 *  Returns the handler for the window's <AnimatePresence onExitComplete>, which releases the pin. */
export function usePagePin(isOpen: boolean): () => void {
  const unlockRef = useRef<(() => void) | null>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  useLayoutEffect(() => {
    if (!isOpen || unlockRef.current) return // reopened mid-close: the page is still pinned
    const body = document.body
    const html = document.documentElement
    if (body.style.position === 'fixed') return // something else already pinned it
    const scrollY = window.scrollY
    const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, html: html.style.overflow }
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    html.style.overflow = 'hidden'
    unlockRef.current = () => {
      unlockRef.current = null
      body.style.overflow = saved.overflow
      body.style.position = saved.position
      body.style.top = saved.top
      body.style.left = saved.left
      body.style.right = saved.right
      body.style.width = saved.width
      html.style.overflow = saved.html
      // Same frame, no smooth scrolling: the page is back exactly where it was, no jump or flash.
      const behavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)
      html.style.scrollBehavior = behavior
    }
  }, [isOpen])
  // Normally released by the close animation finishing (onExitComplete); this is the backstop for a
  // close with nothing left to animate.
  useEffect(() => {
    if (isOpen) return
    const t = window.setTimeout(() => { if (!isOpenRef.current) unlockRef.current?.() }, 700)
    return () => window.clearTimeout(t)
  }, [isOpen])
  useEffect(() => () => unlockRef.current?.(), [])
  return useCallback(() => { if (!isOpenRef.current) unlockRef.current?.() }, [])
}
