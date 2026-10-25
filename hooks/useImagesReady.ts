'use client'

import { useEffect, useState, type RefObject } from 'react'

/**
 * True once the page's data is in (`dataReady`) AND the first `count` photos inside `rootRef` have
 * finished loading (or failed) - so a page can stay on its logo loader and then reveal itself whole,
 * never half-drawn with grey photo boxes (user, 10/24). Capped by `maxWait` ms so one slow photo
 * never holds the page hostage. Once true it stays true (later re-fetches don't bring the loader back).
 * The photos must be in the DOM (render the page underneath the loader, invisible) and not lazy -
 * pass loading="eager" / priority for the first few.
 */
export function useImagesReady(rootRef: RefObject<HTMLElement | null>, dataReady: boolean, { count = 6, maxWait = 4500 } = {}): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (ready || !dataReady) return
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }
    const cap = window.setTimeout(finish, maxWait)
    const cleanups: (() => void)[] = []
    // Next frame: the rows have rendered their <img> tags by then.
    const raf = requestAnimationFrame(() => {
      const imgs = Array.from(rootRef.current?.querySelectorAll('img') || []).slice(0, count) as HTMLImageElement[]
      let left = imgs.filter(img => !img.complete).length
      if (!left) { finish(); return }
      for (const img of imgs) {
        if (img.complete) continue
        const one = () => { left -= 1; if (left <= 0) finish() }
        img.addEventListener('load', one, { once: true })
        img.addEventListener('error', one, { once: true })
        cleanups.push(() => { img.removeEventListener('load', one); img.removeEventListener('error', one) })
      }
    })
    return () => { window.clearTimeout(cap); cancelAnimationFrame(raf); cleanups.forEach(f => f()) }
  }, [dataReady, ready, rootRef, count, maxWait])
  return ready
}
