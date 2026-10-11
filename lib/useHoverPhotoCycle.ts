'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface HoverPhotoCycleOptions {
  /** ms the first photo is shown before the first flip. Default 500 (a quick "there's more here"). */
  firstMs?: number
  /** ms each subsequent photo is shown. Default 3000. */
  stepMs?: number
}

/**
 * Hover-to-cycle a photo array. While the pointer is over the element the photos advance: the
 * first flip lands after `firstMs`, every one after that `stepMs` apart. `slotMs` is how long the
 * currently-shown photo will stay up (feed it to a progress bar's animation-duration, and key the
 * bar on `${index}-${slotMs}` so it restarts on every flip). No-op when there are <2 photos.
 */
export function useHoverPhotoCycle(count: number, opts?: HoverPhotoCycleOptions) {
  const firstMs = opts?.firstMs ?? 500
  const stepMs = opts?.stepMs ?? 3000
  const [index, setIndex] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [slotMs, setSlotMs] = useState(stepMs)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const onEnter = useCallback(() => {
    if (count < 2 || timeoutRef.current || intervalRef.current) return
    setHovering(true)
    setSlotMs(firstMs)
    timeoutRef.current = setTimeout(() => {
      setIndex(i => (i + 1) % count)
      setSlotMs(stepMs)
      intervalRef.current = setInterval(() => setIndex(i => (i + 1) % count), stepMs)
      timeoutRef.current = null
    }, firstMs)
  }, [count, firstMs, stepMs])

  const onLeave = useCallback(() => {
    clear()
    setHovering(false)
    setIndex(0)
    setSlotMs(stepMs)
  }, [clear, stepMs])

  useEffect(() => clear, [clear])

  return { index, hovering, slotMs, onEnter, onLeave }
}
