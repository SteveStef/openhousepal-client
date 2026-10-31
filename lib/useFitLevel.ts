'use client'

import { useEffect, useLayoutEffect, useState, type DependencyList, type RefObject } from 'react'

// A row that must stay on one line (owner 10/31: a home's Beds / Baths / Sq Ft / Acres chips must
// never drop Acres onto a second line). Starts at level 0 (the full words) and steps up one level
// at a time while the row is wider than its box - the caller draws shorter words at each level
// (10,500 -> 10.5K, 0.80 -> .8, then bd / ba / sf / ac). Re-measured whenever the box resizes or
// the deps change, before paint, so the long version never flashes.
export function useFitLevel(ref: RefObject<HTMLElement | null>, max: number, deps: DependencyList = []) {
  const [level, setLevel] = useState(0)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  useLayoutEffect(() => { setLevel(0) }, [width, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (el && level < max && el.scrollWidth > el.clientWidth + 1) setLevel(l => l + 1)
  })
  return level
}

/** Square feet, shortened when asked: 2,450 -> 2.5K, 10,500 -> 10.5K, 125,000 -> 125K. */
export function sqftText(n: number, short = false): string {
  if (!short || n < 1000) return Math.round(n).toLocaleString('en-US')
  return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}K`
}

/** Acres without the dead zeros: 0.80 -> 0.8 (short: .8), 0.25 -> 0.25 (.25), 1.44 -> 1.4, 12.3 -> 12. */
export function acresText(a: number, short = false): string {
  const s = (a < 1 ? a.toFixed(2) : a < 10 ? a.toFixed(1) : String(Math.round(a))).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return short ? s.replace(/^0\./, '.') : s
}
