'use client'

import { Clock, Sparkles } from 'lucide-react'

// "What did that AI run cost me?" (user, 10/24) - the same two pills the finished CMA analysis
// shows: how much of the monthly AI allowance this one run used, and how long it took. Used by
// AI Media (photo edits + videos) and the blog AI writer; before a run those pages show the live
// MonthlyAiUsageMeter, after it this receipt.

export function aiShareText(costUsd: number | null | undefined, monthlyBudgetUsd: number | null | undefined): string | null {
  if (costUsd == null || !monthlyBudgetUsd || monthlyBudgetUsd <= 0) return null
  const pct = (costUsd / monthlyBudgetUsd) * 100
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`
}

export function tookText(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0 || seconds >= 6 * 3600) return null
  const s = Math.round(seconds)
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Seconds between two timestamps (start -> finish), or null. */
export function secondsBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? (b - a) / 1000 : null
}

export default function AiRunReceipt({ costUsd, monthlyBudgetUsd, tookSeconds, label = 'This run', className = '' }: {
  costUsd: number | null | undefined
  monthlyBudgetUsd: number | null | undefined
  tookSeconds: number | null | undefined
  /** Small caps word in front of the pills ("This edit", "This article"). Empty = none. */
  label?: string
  className?: string
}) {
  const used = aiShareText(costUsd, monthlyBudgetUsd)
  const took = tookText(tookSeconds)
  if (!used && !took) return null
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      {label && <span className="mr-0.5 hidden text-[9.5px] sm:inline font-black uppercase tracking-[0.16em] text-gray-400">{label}</span>}
      {used && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#C9A24D]/30 bg-white/80 px-2 py-1 text-[11px] font-black text-[#8b7355] dark:bg-black/30 dark:text-[#d7b974]">
          <Sparkles className="h-3 w-3 shrink-0" /> {used} of monthly AI
        </span>
      )}
      {took && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-200 bg-white/80 px-2 py-1 text-[11px] font-black tabular-nums text-emerald-700 dark:border-emerald-900/40 dark:bg-black/30 dark:text-emerald-300">
          <Clock className="h-3 w-3 shrink-0" /> Took {took}
        </span>
      )}
    </div>
  )
}
