'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

// "Open Showcase" - wherever a form answer that built someone their Showcase shows up (the form's
// results, Today's Rundown, the Dash), one tap straight to that Showcase (user, 10/28).
// `href` is the full link (/showcases?showcase=<id>), or pass `showcaseId`. `onGo` = navigate
// yourself (a window that has to close first).
export default function OpenShowcaseButton({ href, showcaseId, small = false, className = '', onGo }: {
  href?: string | null; showcaseId?: string | null; small?: boolean; className?: string; onGo?: (href: string) => void
}) {
  const to = href || (showcaseId ? `/showcases?showcase=${showcaseId}` : null)
  if (!to) return null
  const look = `inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:text-[#06140d] dark:hover:bg-emerald-400 ${
    small ? 'h-6 px-2 text-[10.5px]' : 'h-8 px-3 text-xs'} ${className}`
  const label = <><Sparkles className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> Open Showcase <ArrowRight className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} /></>
  if (onGo) return (
    <button type="button" data-testid="open-showcase" className={look} onClick={e => { e.stopPropagation(); onGo(to) }}>{label}</button>
  )
  return <Link href={to} onClick={e => e.stopPropagation()} data-testid="open-showcase" className={look}>{label}</Link>
}
