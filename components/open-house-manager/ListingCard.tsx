'use client'

import { Clock, Users, CalendarCheck, Calendar, CalendarClock, AlertCircle, Star, BarChart3, UserCog, Home, Trash2, MapPin } from 'lucide-react'
import { MyListingItem } from '@/types'
import { formatShortDate, formatTime } from './formatters'

function formatPrice(price?: number | null) {
  if (!price) return 'Price unavailable'
  return `$${Number(price).toLocaleString()}`
}

export default function ListingCard({
  listing,
  onViewInsights,
  onManageHosts,
  onRequestRemove,
}: {
  listing: MyListingItem
  onViewInsights: (listingKey: string) => void
  onManageHosts: (listingKey: string) => void
  onRequestRemove?: (listingKey: string) => void
}) {
  const hasScheduledOpens = listing.scheduled_opens.length > 0
  const hasConfirmedPendingKit = listing.confirmed_pending_kit.length > 0

  return (
    // No overflow-hidden on the outer card - it was clipping the "Manage Hosts" pending-request
    // badge below (positioned to poke past the button's own corner) along with the photo's rounded
    // top corners. The photo wrapper below has its own overflow-hidden + rounded-t-2xl so it still
    // clips correctly on its own, without taking the rest of the card's content down with it.
    <div className={`flex flex-col rounded-2xl border bg-white dark:bg-[#151517] shadow-sm transition hover:shadow-md ${listing.is_high_priority ? 'border-[#C9A24D]/50' : 'border-gray-100 dark:border-gray-800'}`}>
      {/* Photo - full width on top, city overlaid bottom-center. */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-800">
        {listing.image ? (
          <img src={listing.image} alt={listing.address} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700">
            <Home size={28} />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-2">
          {typeof listing.days_on_market === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white">
              <Clock size={10} /> {listing.days_on_market} days
            </span>
          )}
          {listing.is_high_priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D] px-2.5 py-1 text-[10px] font-black text-white">
              <Star size={10} fill="currentColor" /> Priority
            </span>
          )}
          {listing.is_manual && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white">Manual</span>
          )}
        </div>
        {listing.is_manual && onRequestRemove && (
          <button
            onClick={() => onRequestRemove(listing.listing_key)}
            className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-red-600"
            aria-label="Remove this manually added listing"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        )}

        {listing.city && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pb-2 pt-8">
            <MapPin size={11} className="shrink-0 text-white" />
            <span className="max-w-[80%] truncate text-[10px] font-black uppercase tracking-wide text-white">{listing.city}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-base font-black text-[#111827] dark:text-white">{listing.address}</p>
          <p className="shrink-0 text-lg font-black text-[#111827] dark:text-white">{formatPrice(listing.price)}</p>
        </div>

        {/* Host status - the main focus of the card now that beds/baths/sqft are gone */}
        <div className={`mt-3 rounded-xl border p-3 ${
          hasScheduledOpens ? 'border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5'
            : hasConfirmedPendingKit ? 'border-blue-200/60 bg-blue-50/60 dark:border-blue-500/20 dark:bg-blue-500/5'
            : 'border-amber-200/60 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5'
        }`}>
          {hasScheduledOpens ? (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                <CalendarCheck size={12} strokeWidth={3} />
                {listing.scheduled_opens.length} Open{listing.scheduled_opens.length > 1 ? 's' : ''} Scheduled
              </div>
              <div className="flex flex-wrap gap-1.5">
                {listing.scheduled_opens.map(open => {
                  const time = open.scheduled_start_time && open.scheduled_end_time
                    ? `${formatTime(open.scheduled_start_time)}-${formatTime(open.scheduled_end_time)}`
                    : null
                  const firstName = open.hosting_agent_name?.split(' ')[0]
                  return (
                    <span
                      key={open.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 shadow-sm dark:border-emerald-500/10 dark:bg-[#151517] dark:text-emerald-400"
                    >
                      <Calendar size={10} />
                      {open.scheduled_date ? `${formatShortDate(open.scheduled_date)}${time ? ` · ${time}` : ''}` : 'Ongoing'}
                      {firstName ? ` · ${firstName}` : ''}
                    </span>
                  )
                })}
              </div>
            </>
          ) : hasConfirmedPendingKit ? (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                <CalendarClock size={12} strokeWidth={3} />
                Host Confirmed &middot; Kit Pending
              </div>
              <div className="flex flex-wrap gap-1.5">
                {listing.confirmed_pending_kit.map(open => {
                  const time = open.scheduled_start_time && open.scheduled_end_time
                    ? `${formatTime(open.scheduled_start_time)}-${formatTime(open.scheduled_end_time)}`
                    : null
                  const firstName = open.hosting_agent_name?.split(' ')[0]
                  return (
                    <span
                      key={open.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm dark:border-blue-500/10 dark:bg-[#151517] dark:text-blue-400"
                    >
                      <Calendar size={10} />
                      {open.scheduled_date ? `${formatShortDate(open.scheduled_date)}${time ? ` · ${time}` : ''}` : 'Ongoing'}
                      {firstName ? ` · ${firstName}` : ''}
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle size={14} strokeWidth={3} />
              <span className="text-xs font-black uppercase tracking-widest">Needs Host</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs font-bold text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1"><Users size={13} /> {listing.avg_guests_per_open} avg guests/open</span>
          <span className="inline-flex items-center gap-1"><CalendarCheck size={13} /> {listing.opens_hosted_count} opens hosted</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
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
