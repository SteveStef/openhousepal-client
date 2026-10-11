'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Bath, Bed, CalendarCheck, Clock, Hand, Maximize, MessageSquareReply, Search, XCircle } from 'lucide-react'
import WeekendCalendarCards, { WeekendCalendarOpen, getUpcomingWeekendCells } from '@/components/open-house-manager/WeekendCalendarCards'
import { useAuth } from '@/contexts/AuthContext'
import type { HostRequest } from '@/types'
import { DiscoveryListing, DASH_OPENS_MIN_HEIGHT_CLASS } from './DashOpensPanel'
import { ListingCover, Pill, PillTone, SectionLabel, niceAddress, whenText } from './openHouseBits'
import { formatShortDateWithDay } from '@/components/open-house-manager/formatters'

export type DiscoveryListingStatus = {
  status: string
  scheduled_opens?: WeekendCalendarOpen[]
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Where each request you sent stands, in plain words - a counter-offer is the only one that needs
// you (red); approved = you're hosting (green); pending = waiting on the listing agent (blue).
function requestState(r: HostRequest): { tone: PillTone; label: string; icon: React.ComponentType<{ className?: string }>; when: string; href: string } {
  if (r.status === 'countered') {
    return { tone: 'red', label: 'New time offered - reply', icon: MessageSquareReply,
      when: whenText(r.counter_date || r.requested_date, r.counter_start_time || r.requested_start_time, r.counter_end_time || r.requested_end_time),
      href: '/discovery?myRequests=1' }
  }
  const when = whenText(r.requested_date, r.requested_start_time, r.requested_end_time)
  if (r.status === 'approved') return { tone: 'green', label: "You're hosting", icon: CalendarCheck, when, href: `/open-houses?build=${encodeURIComponent(r.id)}` }
  if (r.status === 'pending') return { tone: 'sky', label: 'Waiting on listing agent', icon: Clock, when, href: '/discovery?myRequests=1' }
  return { tone: 'muted', label: 'Not this time', icon: XCircle, when, href: '/discovery?myRequests=1' }
}

// A quick shortcut to Discovery, not a replacement for it: first what's going on with homes you
// asked to host (a counter to answer, dates you're confirmed for, asks still waiting), then a
// handful of nearby listings with the same 4-day calendar Manager uses - so "does this one still
// need a host this weekend" is visible without leaving Dash. Clicking an open date jumps straight
// to Discovery to request hosting there.
export default function DashDiscoveryPanel({ listings, statuses, hasSearchPreferences, myRequests = [], incomingAsks = 0 }: {
  listings: DiscoveryListing[]
  statuses: Record<string, DiscoveryListingStatus>
  // Whether the agent has ever saved Discovery search preferences - see the matching prop on
  // DashOpensPanel for why the empty state needs to tell these two cases apart.
  hasSearchPreferences: boolean
  /** Hosting requests this agent sent (any status). */
  myRequests?: HostRequest[]
  /** Listing agents asking THIS agent to host (team broadcasts / direct asks) not yet answered. */
  incomingAsks?: number
}) {
  const router = useRouter()
  const { user } = useAuth()
  const today = todayIso()

  // Your hosting: counters first (they need you), then confirmed dates, then waiting, then a
  // recent "not this time" so a decline doesn't just vanish. Past dates drop off.
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const rank: Record<string, number> = { countered: 0, approved: 1, pending: 2, declined: 3 }
  const mine = myRequests
    .filter(r => String(r.counter_date || r.requested_date) >= today)
    .filter(r => r.status !== 'declined' || (r.responded_at || r.created_at) >= weekAgo)
    .sort((a, b) => (rank[a.status] - rank[b.status]) || String(a.requested_date).localeCompare(String(b.requested_date)))

  const topListings = [...listings]
    .sort((a, b) => (a.DistanceFromLandmark ?? Infinity) - (b.DistanceFromLandmark ?? Infinity))
    .slice(0, 3)

  const asksBanner = incomingAsks > 0 && (
    <Link href="/discovery?myRequests=1"
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#3a2e18] p-3 text-white shadow-[0_16px_34px_-22px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 transition hover:-translate-y-0.5">
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(232,201,122,.35),transparent_65%)]" />
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-md"><Hand className="h-4 w-4" /></span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[13px] font-black">{incomingAsks === 1 ? 'A listing agent asked you to host' : `${incomingAsks} listing agents asked you to host`}</span>
        <span className="block truncate text-[11px] font-semibold text-white/60">Say yes or offer another time</span>
      </span>
      <span className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8c97a] px-3 py-1 text-[11px] font-black text-[#111827] transition group-hover:bg-white">Respond <ArrowRight className="h-3 w-3" /></span>
    </Link>
  )

  const hostingList = mine.length > 0 && (
    <div>
      <SectionLabel right={<Link href="/discovery?myRequests=1" className="text-[10px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">All my requests</Link>}>Your hosting</SectionLabel>
      <div className="space-y-1.5">
        {mine.slice(0, 3).map(r => {
          const st = requestState(r)
          return (
            <Link key={r.id} href={st.href}
              className={`group/oh flex min-w-0 items-center gap-2.5 rounded-xl border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 dark:bg-[#151517] ${
                st.tone === 'red' ? 'border-red-200 hover:border-red-300 dark:border-red-500/30'
                  : st.tone === 'green' ? 'border-emerald-200 hover:border-emerald-300 dark:border-emerald-500/25'
                  : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
              <ListingCover src={r.property_image} className="h-10 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{niceAddress(r.property_address) || 'Listing'}</p>
                <p className="truncate text-[10.5px] font-bold text-gray-500 dark:text-gray-400">{st.when}</p>
                {/* phones: the status goes under the address so the address never gets cut short */}
                <span className="mt-1 flex sm:hidden"><Pill tone={st.tone} icon={st.icon}>{st.label}</Pill></span>
              </div>
              <span className="hidden sm:flex"><Pill tone={st.tone} icon={st.icon}>{st.label}</Pill></span>
            </Link>
          )
        })}
        {mine.length > 3 && <p className="text-center text-[10px] font-bold text-gray-400">+{mine.length - 3} more in My Requests</p>}
      </div>
    </div>
  )

  if (topListings.length === 0) {
    return (
      <div className={`min-w-0 space-y-4 ${DASH_OPENS_MIN_HEIGHT_CLASS}`}>
        {asksBanner}
        {hostingList}
        <div className="flex min-h-[260px] min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#C9A24D]/35 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(201,162,77,.08),transparent_60%)] p-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md"><Search className="h-5 w-5" /></span>
          {hasSearchPreferences ? (
            <>
              <div>
                <p className="font-serif text-base font-black text-[#111827] dark:text-white">Nothing nearby needs a host right now</p>
                <p className="mt-0.5 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">New listings land here the moment they match your search.</p>
              </div>
              <Link href="/discovery" className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/40 bg-white px-3.5 py-1.5 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-white dark:bg-white/5 dark:text-[#d7b974]">
                <Search className="h-3 w-3" /> Widen my search
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="font-serif text-base font-black text-[#111827] dark:text-white">Find open houses to host</p>
                <p className="mt-0.5 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Set your area once - nearby listings that need a host show up here.</p>
              </div>
              <Link href="/discovery" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2 text-[11px] font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5">
                Set up my search <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`min-w-0 space-y-4 ${DASH_OPENS_MIN_HEIGHT_CLASS}`}>
      {asksBanner}
      {hostingList}

      <div>
        <SectionLabel right={<span className="text-[10px] font-bold text-gray-400">Closest first</span>}>Near you to host</SectionLabel>
        <div className="space-y-2.5">
          {topListings.map((listing, i) => {
            const opens = statuses[listing.ListingKey]?.scheduled_opens || []
            const myAsks = myRequests.filter(r => r.listing_key === listing.ListingKey)
            const pendingDates = myAsks.filter(r => r.status === 'pending' || r.status === 'countered').map(r => String(r.requested_date))
            const hostingMine = opens.find(o => o.hosting_agent_id && o.hosting_agent_id === user?.id)
              || myAsks.find(r => r.status === 'approved' && String(r.requested_date) >= today)
            const taken = new Set(opens.map(o => o.scheduled_date).filter(Boolean) as string[])
            const openDays = getUpcomingWeekendCells(taken).filter(c => !taken.has(c.date) && !pendingDates.includes(c.date)).length
            const hostingDate = hostingMine ? ('scheduled_date' in hostingMine ? hostingMine.scheduled_date : (hostingMine as HostRequest).requested_date) : null
            const go = () => router.push(`/discovery?listingKey=${encodeURIComponent(listing.ListingKey)}`)
            return (
              <motion.div
                key={listing.ListingKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 26 }}
                className={`group/oh relative min-w-0 overflow-hidden rounded-2xl border bg-white p-2.5 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-26px_rgba(201,162,77,.8)] dark:bg-[#151517] ${
                  hostingMine ? 'border-emerald-300 dark:border-emerald-500/30' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}
              >
                {hostingMine && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-emerald-300 to-emerald-500" />}
                <button type="button" onClick={go} className="flex w-full min-w-0 items-center gap-3 text-left">
                  <ListingCover
                    src={listing.Image}
                    price={listing.Price || null}
                    chip={listing.DistanceFromLandmark != null ? `${listing.DistanceFromLandmark.toFixed(1)} mi` : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[14.5px] font-black leading-tight text-[#111827] dark:text-white">{listing.Street || 'Property'}</p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[10.5px] font-bold text-gray-400">
                      {listing.City && <span className="truncate">{listing.City}</span>}
                      {listing.Beds != null && <span className="inline-flex items-center gap-0.5"><Bed className="h-2.5 w-2.5" />{listing.Beds}</span>}
                      {listing.Baths != null && <span className="inline-flex items-center gap-0.5"><Bath className="h-2.5 w-2.5" />{listing.Baths}</span>}
                      {listing.SquareFeet != null && <span className="inline-flex items-center gap-0.5"><Maximize className="h-2.5 w-2.5" />{Number(listing.SquareFeet).toLocaleString()}</span>}
                      {listing.DaysOnMarket != null && <span>{listing.DaysOnMarket}d on market</span>}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      {hostingDate
                        ? <Pill tone="green" icon={CalendarCheck}>Hosting {formatShortDateWithDay(hostingDate)}</Pill>
                        : pendingDates.length > 0
                        ? <Pill tone="sky" icon={Clock} title="You asked to host - waiting on the listing agent">Requested {formatShortDateWithDay(pendingDates[0])}</Pill>
                        : openDays > 0
                        ? <Pill tone="amber" icon={Hand}>{openDays} open date{openDays === 1 ? '' : 's'} to host</Pill>
                        : <Pill tone="muted">Fully hosted</Pill>}
                    </div>
                  </div>
                </button>
                <div className="mt-2">
                  <WeekendCalendarCards
                    opens={opens}
                    onCellClick={go}
                    size="sm"
                    filledClickable={false}
                    emptyCellTitle="Click to request hosting this date"
                    viewerId={user?.id}
                    othersMuted
                    pendingDates={pendingDates}
                    pendingLabel="Requested"
                    pendingTitle="You asked to host this date - waiting on the listing agent"
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <Link href="/discovery" className="group flex items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.05] py-2 text-[10.5px] font-black uppercase tracking-wide text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-white dark:text-[#d7b974] dark:hover:text-[#111827]">
        <Search className="h-3 w-3" /> Browse all of Discovery <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}
