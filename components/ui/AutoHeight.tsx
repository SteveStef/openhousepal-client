'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A box whose height glides to fit whatever is inside it (user, 10/24: a pop-up that grows when the
// times load must not jump - "every mobile pop-up resizes smoothly, never a glitch jump"). The
// content is measured with a ResizeObserver and the box springs to the new height; a bottom sheet
// sitting on the screen's bottom edge then rises / settles smoothly instead of snapping.
// Pair it with AnimatePresence mode="popLayout" (not "wait") inside, so swapping one step for the
// next never leaves a moment with nothing in the box (that dip is what made windows bounce).
export default function AutoHeight({ children, className = '', innerClassName = '' }: { children: ReactNode; className?: string; innerClassName?: string }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const reduce = useReducedMotion()
  useLayoutEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 38, mass: 0.9 }}
      style={{ overflow: 'hidden' }}
    >
      <div ref={inner} className={`relative ${innerClassName}`}>{children}</div>
    </motion.div>
  )
}
