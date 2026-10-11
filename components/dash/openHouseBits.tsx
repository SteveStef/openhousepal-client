'use client'

// Small shared pieces for Dash's two open-house cards (Manager = your listings, Discovery = homes
// you could host): the photo cover with its price tag, the "2 of 4 days covered" meter, stat
// tiles and status pills - one look for both cards so they read as a matched pair side by side.
import { Home } from 'lucide-react'
import { getUpcomingWeekendCells, WeekendCalendarOpen } from '@/components/open-house-manager/WeekendCalendarCards'
import { formatShortDateWithDay, formatTimeRangeCompact } from '@/components/open-house-manager/formatters'

export const niceAddress = (s?: string | null) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s || '')
export const whenText = (date?: string | null, start?: string | null, end?: string | null) =>
  [formatShortDateWithDay(date), formatTimeRangeCompact(start, end)].filter(Boolean).join(' · ')
export const compactPrice = (n?: number | null) =>
  n == null ? null : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`

/** The listing photo, with a price tag in the corner and an optional chip (distance / DOM) on top. */
export function ListingCover({ src, price, chip, className = 'h-[76px] w-[104px]' }: {
  src?: string | null
  price?: string | null
  chip?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] shadow-[0_10px_24px_-14px_rgba(17,24,39,.7)] ring-1 ring-black/5 ${className}`}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="h-full w-full object-cover transition duration-500 group-hover/oh:scale-[1.06]" />
        : <span className="grid h-full w-full place-items-center"><Home className="h-5 w-5 text-[#e8c97a]/60" /></span>}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
      {price && <span className="absolute bottom-1 left-1.5 text-[11px] font-black tracking-tight text-white drop-shadow">{price}</span>}
      {chip && <span className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-px text-[9px] font-black text-[#111827] shadow-sm dark:bg-black/60 dark:text-white">{chip}</span>}
    </div>
  )
}

/** The next 4 open-house days as 4 segments: green = hosted, blue = request waiting, amber = open. */
export function CoverageMeter({ opens, pendingDates = [], openLabel = 'need a host' }: {
  opens: WeekendCalendarOpen[]
  pendingDates?: string[]
  openLabel?: string
}) {
  const dates = new Set(opens.map(o => o.scheduled_date).filter((d): d is string => !!d))
  const cells = getUpcomingWeekendCells(dates)
  const covered = cells.filter(c => dates.has(c.date)).length
  const waiting = cells.filter(c => !dates.has(c.date) && pendingDates.includes(c.date)).length
  const open = cells.length - covered - waiting
  return (
    <div className="min-w-0">
      <div className="flex gap-1">
        {cells.map(c => (
          <span key={c.date} className={`h-1.5 flex-1 rounded-full ${
            dates.has(c.date) ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : pendingDates.includes(c.date) ? 'bg-sky-400/80'
              : 'bg-amber-200 dark:bg-amber-500/25'}`} />
        ))}
      </div>
      <p className="mt-1 text-[10.5px] font-bold leading-snug text-gray-500 dark:text-gray-400">
        {open === 0 && waiting === 0
          ? <span className="text-emerald-600 dark:text-emerald-400">All {cells.length} days covered</span>
          : <>
              <span className="text-emerald-600 dark:text-emerald-400">{covered} of {cells.length} covered</span>
              {waiting > 0 && <> · <span className="text-sky-600 dark:text-sky-300">{waiting} requested</span></>}
              {open > 0 && <> · <span className="text-amber-600 dark:text-amber-400">{open} {openLabel}</span></>}
            </>}
      </p>
    </div>
  )
}

export type PillTone = 'green' | 'amber' | 'sky' | 'red' | 'gold' | 'muted'
const PILL: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  red: 'bg-red-500 text-white ring-red-500 shadow-sm shadow-red-500/30',
  gold: 'bg-[#C9A24D]/10 text-[#8b7355] ring-[#C9A24D]/35 dark:text-[#e8c97a]',
  muted: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:ring-white/10',
}
export function Pill({ tone, icon: Icon, children, title }: { tone: PillTone; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide ring-1 ${PILL[tone]}`}>
      {Icon && <Icon className="h-2.5 w-2.5 shrink-0" />}<span className="truncate">{children}</span>
    </span>
  )
}

/** One of the three numbers across the top of a card. */
export function StatTile({ icon: Icon, value, label, tone }: { icon: React.ComponentType<{ className?: string }>; value: React.ReactNode; label: string; tone: 'green' | 'amber' | 'gold' | 'sky' | 'red' }) {
  const t = {
    green: 'from-emerald-50 to-white text-emerald-600 ring-emerald-200/70 dark:from-emerald-500/10 dark:to-transparent dark:text-emerald-300 dark:ring-emerald-500/20',
    amber: 'from-amber-50 to-white text-amber-600 ring-amber-200/70 dark:from-amber-500/10 dark:to-transparent dark:text-amber-300 dark:ring-amber-500/20',
    gold: 'from-[#fbf3df] to-white text-[#8b7355] ring-[#C9A24D]/25 dark:from-[#C9A24D]/10 dark:to-transparent dark:text-[#e8c97a] dark:ring-[#C9A24D]/20',
    sky: 'from-sky-50 to-white text-sky-600 ring-sky-200/70 dark:from-sky-500/10 dark:to-transparent dark:text-sky-300 dark:ring-sky-500/20',
    red: 'from-red-50 to-white text-red-600 ring-red-200/70 dark:from-red-500/10 dark:to-transparent dark:text-red-300 dark:ring-red-500/20',
  }[tone]
  return (
    <div className={`min-w-0 rounded-xl bg-gradient-to-br px-2.5 py-2 ring-1 ${t}`}>
      <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider opacity-80 sm:tracking-widest"><Icon className="hidden h-3 w-3 shrink-0 sm:block" /><span className="truncate">{label}</span></p>
      <p className="mt-0.5 font-serif text-[22px] font-black leading-none text-[#111827] tabular-nums dark:text-white">{value}</p>
    </div>
  )
}

/** Small-caps section label with a fading gold hairline. */
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <p className="shrink-0 text-[9.5px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{children}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/35 to-transparent" />
      {right}
    </div>
  )
}
