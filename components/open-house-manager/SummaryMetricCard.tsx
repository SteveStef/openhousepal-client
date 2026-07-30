'use client'

import { LucideIcon } from 'lucide-react'
import InfoTooltip from './InfoTooltip'

export default function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  highlight = false,
  infoText,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  highlight?: boolean
  infoText?: string
}) {
  return (
    <div className={`rounded-2xl border p-2.5 sm:p-4 ${highlight ? 'border-[#C9A24D]/40 bg-[#C9A24D]/10' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517]'}`}>
      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 dark:text-gray-500">
        <Icon size={14} className="shrink-0 sm:w-[15px] sm:h-[15px]" />
        <p className="text-lg sm:text-2xl font-black text-[#111827] dark:text-white">{value}</p>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <p className="truncate text-[9px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
    </div>
  )
}
