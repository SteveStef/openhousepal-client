'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Pages for a chat card's homes (owner, 11/09: "6 ... and it's like a page 2 in the ui not just making
 *  it longer"): Back, the page numbers, Next. Long runs of pages show the ends and the ones around. */
export default function ChatPager({ page, pages, onPage, testid = 'ai-pager' }: { page: number; pages: number; onPage: (p: number) => void; testid?: string }) {
  if (pages <= 1) return null
  const nums: (number | '...')[] = []
  for (let n = 0; n < pages; n++) {
    if (pages <= 7 || n === 0 || n === pages - 1 || Math.abs(n - page) <= 1) nums.push(n)
    else if (nums[nums.length - 1] !== '...') nums.push('...')
  }
  return (
    <div className="mt-2 flex items-center justify-between gap-2" data-testid={testid}>
      <button type="button" onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} data-testid={`${testid}-prev`}
        className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black text-[#111827] disabled:opacity-30 dark:border-zinc-700 dark:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>
      <span className="flex min-w-0 items-center gap-0.5 overflow-hidden">
        {nums.map((n, i) => n === '...'
          ? <span key={`d${i}`} className="px-0.5 text-[11px] font-black text-gray-400">…</span>
          : (
            <button key={n} type="button" onClick={() => onPage(n)} aria-label={`Page ${n + 1}`} aria-current={n === page ? 'page' : undefined} data-testid={`${testid}-num`}
              className={`h-7 min-w-7 rounded-full px-2 text-[11px] font-black transition-colors ${n === page ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
              {n + 1}
            </button>
          ))}
      </span>
      <button type="button" onClick={() => onPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} data-testid={`${testid}-next`}
        className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-30 dark:bg-[#C9A24D] dark:text-[#111827]">
        Next <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Next / Previous for the home window over a list: the window walks every home, and the card's page follows. */
export function listNav(keys: string[], viewing: string | null, open: (key: string, dir: 1 | -1) => void) {
  const at = viewing ? keys.indexOf(viewing) : -1
  if (!viewing || keys.length < 2 || at < 0) return null
  return { index: at, total: keys.length, onPrev: at > 0 ? () => open(keys[at - 1], -1) : null, onNext: at < keys.length - 1 ? () => open(keys[at + 1], 1) : null }
}
