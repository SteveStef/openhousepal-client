'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// The header every Dash card shares, all on one line: gold icon chip + serif title (+ count
// badge), a short status beside it ("1 needs a reply", "5 due"...), the card's own extras and a
// "View all" pill on the right, and a soft gold hairline underneath so each card reads as one unit.
export type DashStatusTone = 'red' | 'gold' | 'green' | 'muted'
const TONE: Record<DashStatusTone, string> = {
  red: 'text-red-600 dark:text-red-400',
  gold: 'text-[#8b7355] dark:text-[#d7b974]',
  green: 'text-emerald-600 dark:text-emerald-400',
  muted: 'text-gray-400 dark:text-gray-500',
}

export default function DashCardHeader({
  icon: Icon, title, href, badgeCount, badgeExact, status, statusTone = 'muted', extra, viewHref, viewLabel = 'View all', large = true,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  href?: string
  badgeCount?: number
  badgeExact?: boolean
  /** A short line under the title - plain text (coloured by statusTone) or a custom node. */
  status?: React.ReactNode
  statusTone?: DashStatusTone
  extra?: React.ReactNode
  viewHref?: string
  viewLabel?: string
  large?: boolean
}) {
  // A text status already says the number ("3 due"), so it replaces the separate count badge -
  // the urgent ones become a single red pill instead of a badge plus the same number in words.
  const textStatus = typeof status === 'string'
  const showBadge = !!badgeCount && badgeCount > 0 && !textStatus
  const heading = (
    <>
      <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a] shadow-sm dark:bg-white/10 ${large ? 'h-8 w-8' : 'h-7 w-7'}`}><Icon className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} /></span>
      <span className="min-w-0 truncate">{title}</span>
      {showBadge && (
        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
          {!badgeExact && badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </>
  )
  const titleCls = `flex max-w-full items-center gap-2 font-serif font-black text-[#111827] dark:text-white ${large ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`
  return (
    <div>
      {/* One line: title, its status right beside it, extras + View all on the right - the
          header never adds height to the card (wraps only when the screen is too narrow). */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-0.5">
          {href
            ? <Link href={href} className={`${titleCls} transition hover:text-[#8b7355] dark:hover:text-[#d7b974]`}>{heading}</Link>
            : <span className={titleCls}>{heading}</span>}
          {status && (textStatus && statusTone === 'red'
            ? <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white shadow-sm shadow-red-500/30">{status}</span>
            : <div className={`text-[11px] font-bold ${textStatus ? TONE[statusTone] : ''}`}>{status}</div>)}
        </div>
        {(extra || viewHref) && (
          <div className="flex shrink-0 items-center gap-2">
            {extra}
            {viewHref && (
              <Link href={viewHref} className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-[#C9A24D]/35 bg-[#C9A24D]/[0.06] px-2.5 py-1 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-white dark:text-[#d7b974] dark:hover:text-[#111827]">
                {viewLabel} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-[#C9A24D]/55 via-[#C9A24D]/15 to-transparent" />
    </div>
  )
}
