'use client'

import { useState } from 'react'
import StatDetailModal from './StatDetailModal'
import { StatMetric, StatSummaryEntry } from '@/types'

interface StatCardProps {
  metric: StatMetric
  label: string
  // Shown instead of `label` below the `sm` breakpoint, where a card is too narrow to fit the
  // full label without it getting visually clipped by the `truncate` class.
  shortLabel?: string
  icon: React.ComponentType<{ className?: string }>
  entry: StatSummaryEntry
  isPercent?: boolean
  // Tighter padding/text below the `sm` breakpoint only (sm: and up match the default look) -
  // for Dash's KPI strip, where 6 cards need to read cleanly at 3-per-row on a phone. Off by
  // default so every other page using this card (Discovery, Studio, ...) is unchanged.
  compact?: boolean
}

function formatPercentChange(percent: number): string {
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : ''}${percent}%`
}

export default function StatCard({ metric, label, shortLabel, icon: Icon, entry, isPercent, compact }: StatCardProps) {
  const [open, setOpen] = useState(false)
  const tone = entry.percent > 0 ? 'text-emerald-600 dark:text-emerald-400' : entry.percent < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`block w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/40 hover:shadow-md dark:border-gray-800 dark:bg-[#151517] ${compact ? 'px-1.5 py-1.5 sm:px-3 sm:py-2.5 lg:px-4 lg:py-3.5' : 'px-3 py-2.5 lg:px-4 lg:py-3.5'}`}
      >
        <div className={`flex items-center ${compact ? 'gap-1 sm:gap-1.5' : 'gap-1.5'}`}>
          <Icon className={`shrink-0 text-[#8b7355] ${compact ? 'h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5' : 'h-3 w-3 lg:h-3.5 lg:w-3.5'}`} />
          <p className={`min-w-0 truncate font-black uppercase leading-tight tracking-normal text-gray-400 ${compact ? 'text-[7.5px] sm:text-[9px] lg:text-[10px]' : 'text-[9px] lg:text-[10px]'}`}>
            {shortLabel ? <span className="sm:hidden">{shortLabel}</span> : null}
            <span className={shortLabel ? 'hidden sm:inline' : undefined}>{label}</span>
          </p>
        </div>
        <div className={`flex min-w-0 items-baseline justify-between gap-x-1.5 ${compact ? 'mt-0.5 sm:mt-1 lg:mt-2' : 'mt-1 lg:mt-2'}`}>
          <p className={`min-w-0 truncate font-black leading-none text-[#111827] dark:text-white ${compact ? 'text-sm sm:text-xl lg:text-2xl' : 'text-xl lg:text-2xl'}`}>{entry.current}{isPercent ? '%' : ''}</p>
          <p className={`shrink-0 font-black leading-none ${compact ? 'text-[8px] sm:text-[10px] lg:text-xs' : 'text-[10px] lg:text-xs'} ${tone}`}>{formatPercentChange(entry.percent)}</p>
        </div>
      </button>
      {open && <StatDetailModal metric={metric} label={label} isPercent={isPercent} onClose={() => setOpen(false)} />}
    </>
  )
}
