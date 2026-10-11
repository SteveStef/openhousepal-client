'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Page numbers for a long list: "‹ Newer  1 2 … 7  Older ›". Shows nothing when it all fits on
 * one page. Numbers collapse around the current page so it never gets wide on a phone. */
export default function Pager({ page, pages, onChange, prevLabel = 'Prev', nextLabel = 'Next', className = '' }: {
  page: number
  pages: number
  onChange: (page: number) => void
  prevLabel?: string
  nextLabel?: string
  className?: string
}) {
  if (pages <= 1) return null
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .filter(n => pages <= 5 || n === 1 || n === pages || Math.abs(n - page) <= 1)
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:pointer-events-none disabled:opacity-35 dark:border-white/10 dark:text-gray-300'
  return (
    <nav aria-label="Pages" className={`flex items-center justify-between gap-2 ${className}`}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className={btn} aria-label={prevLabel}>
        <ChevronLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">{prevLabel}</span>
      </button>
      <div className="flex min-w-0 items-center gap-0.5">
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-0.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-0.5 text-xs font-bold text-gray-300">…</span>}
            <button type="button" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-black tabular-nums transition ${n === page
                ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/[0.06] dark:hover:text-white'}`}>
              {n}
            </button>
          </span>
        ))}
      </div>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} className={btn} aria-label={nextLabel}>
        <span className="hidden sm:inline">{nextLabel}</span><ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  )
}
