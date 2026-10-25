'use client'

// The "100+ homes match" note (owner, 10/24): shown wherever a Showcase's search is edited or
// previewed once it matches more homes than a Showcase holds. Luxe gold, works on light, dark and
// on a dark header (`onDark`). Folds in / out smoothly so the screen never jumps.
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { SHOWCASE_MAX_HOMES } from '@/lib/showcaseLimit'

export default function ShowcaseLimitNote({ show, audience = 'agent', onDark = false, className = '' }: {
  show: boolean
  /** 'client' talks to the buyer ("your search"); 'agent' to the agent. */
  audience?: 'agent' | 'client'
  onDark?: boolean
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div key="showcase-limit" role="status"
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }} className={`overflow-hidden ${className}`}>
          <div className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 ${onDark
            ? 'border-[#e8c97a]/35 bg-[#e8c97a]/10 text-[#f3dfa8]'
            : 'border-[#C9A24D]/35 bg-gradient-to-r from-[#fbf3df] to-[#fffaf0] text-[#6b5320] dark:border-[#C9A24D]/30 dark:from-[#C9A24D]/[0.12] dark:to-[#C9A24D]/[0.05] dark:text-[#e8cf8a]'}`}>
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${onDark ? 'bg-[#e8c97a]/20 text-[#e8c97a]' : 'bg-[#C9A24D]/20 text-[#8b6a2b] dark:text-[#e8c97a]'}`}>
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
            <p className="text-[12.5px] font-semibold leading-snug">
              <span className="font-black">{SHOWCASE_MAX_HOMES}+ homes match</span> - that&apos;s the most a Showcase holds.{' '}
              {audience === 'client'
                ? 'Tighten your search (price, beds, towns or the distance) so the right homes make the cut.'
                : 'Tighten the search (price, beds, towns or the map area) so the right homes make the cut.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
