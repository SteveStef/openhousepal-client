'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// The hero's "Built by real estate agents." / "Used by real estate agents." line. Each word rises
// in out of a soft blur behind a gold highlight that sweeps across, holds, then the line leaves
// the same way it came - words lifting away into the blur one after another, a gold glint
// passing through - before the next line builds itself in.
const LINES = ['Built by real estate agents.', 'Used by real estate agents.']
const HOLD_MS = 3800

export default function HeroTagline() {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    const id = window.setInterval(() => setI(n => (n + 1) % LINES.length), HOLD_MS)
    return () => window.clearInterval(id)
  }, [])
  const words = LINES[i].split(' ')

  return (
    <span className="relative inline-flex h-9 items-center justify-center" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          className="relative isolate inline-flex flex-wrap justify-center gap-x-[0.3em] rounded-md px-[0.35em] py-[0.08em] font-semibold text-[#0B0B0B] dark:text-white"
          initial="hidden"
          animate="shown"
          exit="gone"
          variants={{ hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : 0.07 } }, gone: { transition: { staggerChildren: reduce ? 0 : 0.045 } } }}
        >
          {/* Gold highlight that wipes in behind the words, and wipes out to the right on exit. */}
          <motion.span
            aria-hidden
            className="absolute inset-0 z-0 origin-left rounded-md bg-gradient-to-r from-[#C9A24D]/35 via-[#e8c97a]/30 to-[#C9A24D]/25"
            variants={{
              hidden: { scaleX: 0, opacity: 1 },
              shown: { scaleX: 1, opacity: 1, transition: { duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] } },
              gone: { scaleX: 0, opacity: 0, originX: 1, transition: { duration: reduce ? 0 : 0.45, ease: [0.55, 0, 0.75, 0.25] } },
            }}
          />
          {/* A glint of light that passes through as the line leaves - kept inside the highlight's
              own box, so it never shows as a dark bar out past the words (phones, user 10/27). */}
          {!reduce && (
            <span aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md">
              <motion.span
                className="absolute inset-y-0 -left-1/4 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-[#fff3cf]/40"
                variants={{ hidden: { x: '0%', opacity: 0 }, shown: { x: '0%', opacity: 0 }, gone: { x: '560%', opacity: [0, 1, 0], transition: { duration: 0.55, ease: 'easeInOut' } } }}
              />
            </span>
          )}
          {words.map((w, k) => (
            <motion.span
              key={k}
              className="relative z-10 inline-block"
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 14 },
                shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
                gone: { opacity: 0, y: reduce ? 0 : -12, transition: { duration: 0.35, ease: [0.55, 0, 0.75, 0.25] } },
              }}
            >
              {w}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
