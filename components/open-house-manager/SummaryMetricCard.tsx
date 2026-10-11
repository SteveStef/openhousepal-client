'use client'

import { LucideIcon } from 'lucide-react'
import InfoTooltip from './InfoTooltip'

export type MetricAccent = 'gold' | 'green' | 'red' | 'yellow' | 'blue'

// Same "accent tied to what it means" recipe as Discovery's STAT_ACCENTS: a soft colored fill,
// a matching border, and the icon in its own colored chip - so a row of these reads as vivid
// tiles with real hierarchy, not four near-white boxes with a hairline tinted edge. `highlight`
// intensifies the card's OWN accent rather than switching everything to gold.
const ACCENTS: Record<MetricAccent, {
  bg: string; border: string; chip: string; icon: string; hiBg: string; hiBorder: string
}> = {
  gold: {
    bg: 'bg-[#FCF9F1] dark:bg-[#C9A24D]/5', border: 'border-[#C9A24D]/30 dark:border-[#C9A24D]/20',
    chip: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20', icon: 'text-[#C9A24D]',
    hiBg: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/10', hiBorder: 'border-[#C9A24D]/55 dark:border-[#C9A24D]/40',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/5', border: 'border-emerald-200 dark:border-emerald-500/20',
    chip: 'bg-emerald-100 dark:bg-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400',
    hiBg: 'bg-emerald-100/70 dark:bg-emerald-500/10', hiBorder: 'border-emerald-300 dark:border-emerald-500/40',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-500/5', border: 'border-red-200 dark:border-red-500/20',
    chip: 'bg-red-100 dark:bg-red-500/20', icon: 'text-red-500 dark:text-red-400',
    hiBg: 'bg-red-100/70 dark:bg-red-500/10', hiBorder: 'border-red-300 dark:border-red-500/40',
  },
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-500/5', border: 'border-amber-200 dark:border-amber-500/20',
    chip: 'bg-amber-100 dark:bg-amber-500/20', icon: 'text-amber-600 dark:text-amber-400',
    hiBg: 'bg-amber-100/70 dark:bg-amber-500/10', hiBorder: 'border-amber-300 dark:border-amber-500/40',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/5', border: 'border-blue-200 dark:border-blue-500/20',
    chip: 'bg-blue-100 dark:bg-blue-500/20', icon: 'text-blue-600 dark:text-blue-400',
    hiBg: 'bg-blue-100/70 dark:bg-blue-500/10', hiBorder: 'border-blue-300 dark:border-blue-500/40',
  },
}

// Three sizes: 'lg' (default - the original roomy card), 'sm' (the original `compact` - very
// tight, e.g. Discovery/My Listings/Insights modal), and 'md' (in between - e.g. the Leads page
// header, where 'sm' read as too cramped but 'lg' was mostly dead space around a 1-2 digit
// number). `compact` is kept as a boolean alias for 'sm' so existing call sites don't need to
// change.
type MetricSize = 'lg' | 'md' | 'sm'

const SIZE_STYLES: Record<MetricSize, {
  pad: string; rowGap: string; chip: string; iconSize: number; iconClass: string; value: string; label: string
}> = {
  lg: {
    pad: 'p-2.5 sm:p-4', rowGap: 'gap-1.5 sm:gap-2', chip: 'h-6 w-6 sm:h-7 sm:w-7',
    iconSize: 13, iconClass: 'sm:w-[15px] sm:h-[15px]', value: 'text-lg sm:text-2xl', label: 'text-[9px] sm:text-[11px] tracking-wide sm:tracking-widest',
  },
  md: {
    pad: 'p-2 sm:p-3', rowGap: 'gap-1.5', chip: 'h-5 w-5 sm:h-6 sm:w-6',
    iconSize: 11, iconClass: '', value: 'text-base sm:text-xl', label: 'text-[8px] sm:text-[9px] tracking-wide',
  },
  sm: {
    pad: 'p-1.5 sm:p-2', rowGap: 'gap-1', chip: 'h-4 w-4',
    iconSize: 10, iconClass: '', value: 'text-sm', label: 'text-[8px] tracking-wide',
  },
}

export default function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  highlight = false,
  infoText,
  compact = false,
  size,
  accent = 'gold',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  highlight?: boolean
  infoText?: string
  compact?: boolean
  size?: MetricSize
  accent?: MetricAccent
}) {
  const a = ACCENTS[accent]
  const s = SIZE_STYLES[size ?? (compact ? 'sm' : 'lg')]

  return (
    <div
      className={`rounded-xl border ${s.pad} ${
        highlight ? `${a.hiBg} ${a.hiBorder}` : `${a.bg} ${a.border}`
      }`}
    >
      <div className={`flex items-center ${s.rowGap}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-lg ${a.chip} ${s.chip}`}>
          <Icon size={s.iconSize} className={`${a.icon} ${s.iconClass}`} />
        </span>
        <p className={`font-black text-[#111827] dark:text-white ${s.value}`}>{value}</p>
      </div>
      <div className="mt-1 flex items-start gap-1">
        <p className={`font-bold uppercase leading-snug text-gray-500 dark:text-gray-400 ${s.label}`}>{label}</p>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
    </div>
  )
}
