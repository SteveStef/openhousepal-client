'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Page numbers + arrows with the sliding dark pill (same look as FourPager in OhSheet.tsx), for
 * lists that page themselves (Opens cards, Disclosure & Second Visit requests). `page` is 0-based.
 * Folds the middle away on long lists: 1 … 4 5 6 … 12. Renders nothing for a single page.
 * Pair it with `scrollListTop(ref)` so a new page brings the top of THAT list into view.
 */
export default function NumberPager({ page, pages, onChange, total, size, className = '' }: {
  page: number
  pages: number
  onChange: (page: number) => void
  /** With `size`: shows "7–12 of 23" under the numbers. */
  total?: number
  size?: number
  className?: string
}) {
  const id = useId()
  if (pages <= 1) return null
  const go = (n: number) => { if (n >= 0 && n <= pages - 1 && n !== page) onChange(n) }
  const nums = Array.from({ length: pages }, (_, i) => i).filter(n => pages <= 5 || n === 0 || n === pages - 1 || Math.abs(n - page) <= 1)
  const arrow = 'grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-[#C9A24D] disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-3">
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous page" className={arrow}>
          <ChevronLeft className="h-4 w-4" />
        </motion.button>
        <div className="flex items-center gap-1">
          {nums.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-0.5 text-xs font-bold text-gray-300">…</span>}
              <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => go(n)} aria-label={`Page ${n + 1}`} aria-current={n === page ? 'page' : undefined}
                className={`relative grid h-9 min-w-9 place-items-center rounded-full px-2 text-xs font-black tabular-nums transition-colors ${n === page ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'}`}>
                {n === page && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-[#111827] shadow-md dark:bg-[#e8c97a]" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative">{n + 1}</span>
              </motion.button>
            </span>
          ))}
        </div>
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => go(page + 1)} disabled={page === pages - 1} aria-label="Next page" className={arrow}>
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </div>
      {total !== undefined && size ? (
        <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 tabular-nums">
          {page * size + 1}–{Math.min(total, page * size + size)} of {total}
        </p>
      ) : null}
    </div>
  )
}

/** After a page change: bring the top of this list back into view (not the top of the page) -
 *  only when it has scrolled off (or far down) the screen. Leaves room for the sticky site header. */
export function scrollListTop(el: HTMLElement | null, headerOffset = 84) {
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.top >= headerOffset && r.top <= window.innerHeight * 0.5) return
  window.scrollTo({ top: window.scrollY + r.top - headerOffset, behavior: 'smooth' })
}
