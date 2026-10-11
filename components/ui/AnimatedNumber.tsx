'use client'

import { useEffect, useRef, useState } from 'react'

// A number that counts to its value - from 0 on first show, then from the old value whenever it
// changes (a new lead arrives, the period picker switches). Keeps the target's decimal places
// (2.5 guests stays 2.5) and shows the final value straight away under reduced motion.
export default function AnimatedNumber({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  const decimals = Number.isInteger(value) ? 0 : Math.min(String(value).split('.')[1]?.length || 0, 2)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(value)) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(begin + (value - begin) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])

  const rounded = Number(shown.toFixed(decimals))
  return <>{format ? format(rounded) : rounded.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}
