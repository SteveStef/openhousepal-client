'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

// A brief "Thanks for signing in" at the top of the page a guest lands on right after signing in at
// an open house (the sign-in goes straight there - no thank-you screen in between).
export default function SignedInToast({ show, name }: { show: boolean; name?: string | null }) {
  const [open, setOpen] = useState(false)
  // Shows once per page load - even if the page tidies the URL afterwards.
  const fired = useRef(false)
  const timers = useRef<number[]>([])
  useEffect(() => {
    if (!show || fired.current) return
    fired.current = true
    timers.current = [window.setTimeout(() => setOpen(true), 350), window.setTimeout(() => setOpen(false), 4200)]
  }, [show])
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 top-4 z-[90] mx-auto flex w-fit max-w-[92vw] cursor-pointer items-center gap-2.5 rounded-full border border-black/[0.06] bg-white/95 py-2 pl-2 pr-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,.35)] dark:border-white/10 dark:bg-[#151517]/95"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <span className="text-sm font-black text-[#111827] dark:text-white">Thanks for signing in{name ? `, ${name}` : ''}!</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
