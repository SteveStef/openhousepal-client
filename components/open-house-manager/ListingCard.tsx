'use client'

import { Users, CalendarCheck, Star, BarChart3, UserCog, Home, Trash2, Bed, Bath, Ruler, Clock } from 'lucide-react'
import { MyListingItem, ScheduledOpen } from '@/types'
import WeekendCalendarCards, { WeekendCell, WeekendCalendarOpen, hostingNote } from './WeekendCalendarCards'
import { formatShortDateWithDay, formatTimeRangeCompact } from './formatters'

function formatPrice(price?: number | null) {
  if (!price) return 'Price unavailable'
  return `$${Number(price).toLocaleString()}`
}

export default function ListingCard({
  listing,
  onViewInsights,
  onManageHosts,
  onRequestRemove,
  onCalendarCellClick,
  pendingDates,
}: {
  listing: MyListingItem
  onViewInsights: (listingKey: string) => void
  onManageHosts: (listingKey: string) => void
  onRequestRemove?: (listingKey: string) => void
  // Clicking a weekend cell jumps straight into Manage Hosts already primed for that date - an
  // empty cell prefills a direct request for it, a filled one jumps to Host Notes (see
  // my-listings/page.tsx for what each does with cell/open).
  onCalendarCellClick?: (listingKey: string, cell: WeekendCell, open?: WeekendCalendarOpen) => void
  /** Days another agent has asked to host - "Request in" instead of "Needs Host". */
  pendingDates?: string[]
}) {
  const allOpens: ScheduledOpen[] = [...listing.scheduled_opens, ...listing.confirmed_pending_kit]
    .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
  // Open houses the agent posted straight into Bright - every upcoming one, with its time, so
  // dates beyond the two weekends below (or weekday ones) are visible right on the card too.
  const brightOpens = allOpens.filter(o => o.hosting_agent_id === 'BRIGHT-MLS' && o.scheduled_date)
    .sort((a, b) => `${a.scheduled_date} ${a.scheduled_start_time || ''}`.localeCompare(`${b.scheduled_date} ${b.scheduled_start_time || ''}`))

  return (
    <div className={`flex flex-col rounded-2xl border bg-white dark:bg-[#151517] shadow-sm transition hover:shadow-md ${listing.is_high_priority ? 'border-[#C9A24D]/50' : 'border-gray-100 dark:border-gray-800'}`}>
      {/* Photo - full width, true 4:3 (Bright MLS's own ratio), never stretched/cropped. */}
      <div className="relative w-full aspect-[4/3] shrink-0 overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-800">
        {listing.image ? (
          <img src={listing.image} alt={listing.address} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700">
            <Home size={28} />
          </div>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          {listing.is_high_priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D] px-2 py-1 text-[9px] font-black text-white">
              <Star size={9} fill="currentColor" />
            </span>
          )}
          {listing.is_manual && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white">Manual</span>
          )}
        </div>
        {listing.is_manual && onRequestRemove && (
          <button
            onClick={() => onRequestRemove(listing.listing_key)}
            className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-red-600"
            aria-label="Remove this manually added listing"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-8">
          <span className="text-lg font-black text-white tracking-tight">{formatPrice(listing.price)}</span>
          {typeof listing.days_on_market === 'number' && (
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white whitespace-nowrap">
              {listing.days_on_market === 0 ? 'Just Listed' : `${listing.days_on_market}d on Market`}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Address top-left, mini stats top-right on the same line - the address itself still gets
            its own full-width line below (for a long street address), this row is just about
            sharing the TOP line's height instead of giving stats a whole separate row+divider. */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="min-w-0 truncate text-base font-black text-[#111827] dark:text-white leading-tight">{listing.address}</p>
            {(listing.city || listing.state) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{listing.city}{listing.city && listing.state ? ', ' : ''}{listing.state}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
            <span className="flex items-center gap-1 whitespace-nowrap text-[9px] font-bold text-gray-500 dark:text-gray-400" title="Average guests per open">
              <Users size={10} className="shrink-0" /> {listing.avg_guests_per_open} <span className="text-gray-400 dark:text-gray-500">avg guests</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-[9px] font-bold text-gray-500 dark:text-gray-400" title="Opens hosted">
              <CalendarCheck size={10} className="shrink-0" /> {listing.opens_hosted_count} <span className="text-gray-400 dark:text-gray-500">hosted</span>
            </span>
          </div>
        </div>

        {(listing.bedrooms || listing.bathrooms || listing.living_area || typeof listing.days_on_market === 'number') && (
          <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
            {typeof listing.bedrooms === 'number' && (
              <div className="flex items-center gap-1.5">
                <Bed size={13} />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{listing.bedrooms}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Beds</span>
              </div>
            )}
            {typeof listing.bathrooms === 'number' && (
              <div className="flex items-center gap-1.5">
                <Bath size={13} />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{listing.bathrooms}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Baths</span>
              </div>
            )}
            {typeof listing.living_area === 'number' && (
              <div className="flex items-center gap-1.5">
                <Ruler size={13} />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{listing.living_area.toLocaleString()}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">Sqft</span>
              </div>
            )}
            {typeof listing.days_on_market === 'number' && (
              <div className="flex items-center gap-1.5">
                <Clock size={13} />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{listing.days_on_market}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">DOM</span>
              </div>
            )}
          </div>
        )}

        {/* Weekend mini calendar - fixed at exactly 4 cells (this Sat/Sun, next Sat/Sun) no matter
            how many opens the listing actually has, so this never grows or shrinks the card.
            Clicking a cell jumps into Manage Hosts already primed for that date. */}
        {hostingNote(listing) && (
          <p className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-center text-[10.5px] font-bold text-gray-500 dark:bg-white/[0.05] dark:text-gray-400">{hostingNote(listing)}</p>
        )}
        <WeekendCalendarCards
          opens={allOpens}
          hostingWindow={listing}
          pendingDates={pendingDates}
          pendingLabel="Request in"
          pendingTitle="An agent asked to host this date - review it"
          onCellClick={onCalendarCellClick ? (cell, open) => onCalendarCellClick(listing.listing_key, cell, open) : undefined}
        />

        {brightOpens.length > 0 && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-2.5 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Scheduled in Bright MLS</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {brightOpens.map(o => {
                const time = formatTimeRangeCompact(o.scheduled_start_time, o.scheduled_end_time)
                return (
                  <span key={o.id} className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 ring-1 ring-emerald-100 tabular-nums dark:bg-white/5 dark:text-gray-200 dark:ring-emerald-500/20">
                    {formatShortDateWithDay(o.scheduled_date)}{time ? ` · ${time}` : ''}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onViewInsights(listing.listing_key)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <BarChart3 size={14} /> View Insights
          </button>
          <button
            onClick={() => onManageHosts(listing.listing_key)}
            className="relative flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-3 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200"
          >
            <UserCog size={14} /> Manage Hosts
            {listing.pending_request_count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-red-300 shadow-lg shadow-red-500/50 dark:ring-red-500/50">
                {listing.pending_request_count}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
