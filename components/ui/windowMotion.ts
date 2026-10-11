'use client'

import { useEffect, useRef } from 'react'

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
