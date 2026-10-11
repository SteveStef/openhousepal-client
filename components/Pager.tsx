'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Windowed page-number pager: at most `maxButtons` numbered buttons at once, with prev/next
// chevrons and first/last anchors + an ellipsis when the window doesn't reach an end - so a
// list with 20 pages still shows a compact ~5-button strip instead of 20 buttons.
export default function Pager({
  page,
  totalPages,
  onChange,
  maxButtons = 5,
  className = '',
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  maxButtons?: number
  className?: string
}) {
  const windowPages = useMemo(() => {
    const count = Math.min(maxButtons, Math.max(1, totalPages))
    // Keep the current page roughly centered, clamped so the window never runs past either end.
    const start = Math.min(
      Math.max(1, page - Math.floor(maxButtons / 2)),
      Math.max(1, totalPages - maxButtons + 1),
    )
    return Array.from({ length: count }, (_, i) => start + i)
  }, [page, totalPages, maxButtons])

  if (totalPages <= 1) return null

  const go = (p: number) => onChange(Math.min(totalPages, Math.max(1, p)))
  const numBtn = 'h-8 min-w-8 rounded-lg border px-2 text-xs font-black transition'
  const idleBtn = 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/50 dark:border-gray-700 dark:text-gray-400'

  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
      >
        <ChevronLeft size={15} />
      </button>

      {windowPages[0] > 1 && (
        <>
          <button onClick={() => go(1)} className={`${numBtn} ${idleBtn}`}>1</button>
          {windowPages[0] > 2 && <span className="px-0.5 text-xs text-gray-400">…</span>}
        </>
      )}

      {windowPages.map(p => (
        <button
          key={p}
          onClick={() => go(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`${numBtn} ${p === page ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]' : idleBtn}`}
        >
          {p}
        </button>
      ))}

      {windowPages[windowPages.length - 1] < totalPages && (
        <>
          {windowPages[windowPages.length - 1] < totalPages - 1 && <span className="px-0.5 text-xs text-gray-400">…</span>}
          <button onClick={() => go(totalPages)} className={`${numBtn} ${idleBtn}`}>{totalPages}</button>
        </>
      )}

      <button
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
