import { MlsOpenHouse, formatOpenHouse, upcomingOpenHouses } from '@/lib/mlsOpenHouses'

// The small "Open House · Sat, Oct 4 · 1–3 PM" pill on a listing photo (Agent Hub cards, IDX
// cards) - the next scheduled open house, "+1 more" when there are several. Renders nothing when
// the listing has none. Sits on a dark photo gradient, so both looks are built for that:
//   classic - white pill, emerald "live" dot (matches the Active status badge family);
//   luxe    - glassy dark pill edged and lettered in the hub's metal (--m-* vars), so gold,
//             silver and bronze all follow.
export default function OpenHouseChip({ openHouses, variant = 'classic', compact = false, className = '' }: {
  openHouses?: MlsOpenHouse[] | null
  variant?: 'classic' | 'luxe'
  /** Tight cards (the hub's small shelf cards): "Open · Sat 10/4 · 1–3 PM", "+1" instead of "+1 more". */
  compact?: boolean
  className?: string
}) {
  const upcoming = upcomingOpenHouses(openHouses)
  if (!upcoming.length) return null
  const extra = upcoming.length - 1
  const title = upcoming.map(oh => formatOpenHouse(oh)).join('\n')
  const look = variant === 'luxe'
    ? 'bg-black/55 text-[var(--m-light)] ring-1 ring-[rgba(var(--m-rgb),0.55)] '
    : 'bg-white/95 text-[#111827] ring-1 ring-black/5'
  const dot = variant === 'luxe' ? 'bg-[var(--m-light)]' : 'bg-emerald-500'
  return (
    <span title={`Open house${upcoming.length > 1 ? 's' : ''}:\n${title}`} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'} font-bold leading-4 shadow-sm ${look} ${className}`}>
      <span aria-hidden className="relative flex h-1.5 w-1.5 shrink-0">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      <span className="min-w-0 truncate">
        <span className="font-black uppercase tracking-wide">{compact ? 'Open' : 'Open House'}</span>
        <span className="opacity-60"> · </span>
        {formatOpenHouse(upcoming[0], compact)}
      </span>
      {extra > 0 && <span className="shrink-0 opacity-70">+{extra}{compact ? '' : ' more'}</span>}
    </span>
  )
}
