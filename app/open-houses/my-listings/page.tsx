'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Inbox, Loader2, Layers, CalendarCheck, AlertCircle, Building2, Users, Star, SortDesc, Check, Home, RefreshCw, UsersRound } from 'lucide-react'
import Footer from '@/components/Footer'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import api from '@/lib/api-service'
import { MyListingsResponse } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import ListingCard from '@/components/open-house-manager/ListingCard'
import { WeekendCell, WeekendCalendarOpen } from '@/components/open-house-manager/WeekendCalendarCards'
import SummaryMetricCard from '@/components/open-house-manager/SummaryMetricCard'
import EmptyState from '@/components/open-house-manager/EmptyState'
import HostRequestsPanel from '@/components/open-house-manager/HostRequestsPanel'
import ManageHostsModal from '@/components/open-house-manager/ManageHostsModal'
import OpenHouseInsightsModal from '@/components/open-house-manager/OpenHouseInsightsModal'
import OpenHouseTeamPanel from '@/components/open-house-manager/OpenHouseTeamPanel'
import WarningConfirmModal from '@/components/WarningConfirmModal'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import PageReveal from '@/components/ui/PageReveal'
import ExpandOnFocus from '@/components/ui/ExpandOnFocus'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { useImagesReady } from '@/hooks/useImagesReady'
import { useIsPhone } from '@/components/ui/windowMotion'

type SortOption = 'dom_high' | 'dom_low' | 'price_high' | 'price_low'

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Days on Market: High to Low', value: 'dom_high' },
  { label: 'Days on Market: Low to High', value: 'dom_low' },
  { label: 'Price: High to Low', value: 'price_high' },
  { label: 'Price: Low to High', value: 'price_low' },
]

export default function MyListingsPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireMlsAccess>
          <MyListingsContent />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function MyListingsContent() {
  const { showToast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { listingAgentUnseenUpdates } = useOpenHouseActionCounts()
  const [data, setData] = useState<MyListingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('dom_high')
  const [isHostRequestsOpen, setIsHostRequestsOpen] = useState(false)
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false)
  const [manageHostsKey, setManageHostsKey] = useState<string | null>(null)
  const [manageHostsPrefillDate, setManageHostsPrefillDate] = useState<string | null>(null)
  const [manageHostsFocusNotes, setManageHostsFocusNotes] = useState(false)
  const [manageHostsFindOnly, setManageHostsFindOnly] = useState(false)
  const [insightsKey, setInsightsKey] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [removeTargetKey, setRemoveTargetKey] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const pageReady = useImagesReady(pageRef, !isLoading, { count: 6 })
  const isPhone = useIsPhone()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Taps inside a pull-up sheet (the phone sort sheet) aren't "outside".
      if ((event.target as HTMLElement | null)?.closest?.('[data-scroll-lock="off"]')) return
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mouseup', handleClickOutside)
    return () => document.removeEventListener('mouseup', handleClickOutside)
  }, [])

  // Portaled to <body> (see render site for why) - position tracks the trigger button, right-
  // aligned to it same as the old inline version. Closes on scroll rather than re-tracking, since
  // a scrolling background while picking a sort order isn't a real use case.
  useEffect(() => {
    if (!showSortDropdown || isPhone) return
    const updatePosition = () => {
      const rect = sortDropdownRef.current?.getBoundingClientRect()
      if (rect) setSortMenuPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - 224), width: 224 })
    }
    updatePosition()
    const close = () => setShowSortDropdown(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [showSortDropdown, isPhone])

  const [pendingDates, setPendingDates] = useState<Record<string, string[]>>({})
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true)
    setLoadError('')
    const [{ success, data, error }, pending] = await Promise.all([
      api.openHouseManager.getMyListings(), api.openHouseManager.getHostRequests('pending'),
    ])
    if (success && data) setData(data)
    // A day another agent has asked to host reads "Request in" on the card, not "Needs Host".
    if (pending.success && pending.data) {
      const byKey: Record<string, string[]> = {}
      for (const r of pending.data) (byKey[r.listing_key] ||= []).push(String(r.requested_date))
      setPendingDates(byKey)
    }
    else if (!opts?.silent) setLoadError(error || 'Unable to load your listings right now.')
    if (!opts?.silent) setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
    // A kit can get built (or a request approved/negotiated) from a completely different page
    // (the wizard on /open-houses, a notification deep link, another tab) - refetch on refocus so
    // counts here don't go stale until a manual refresh/reload, matching the same pattern
    // useOpenHouseActionCounts already uses for its own badges. Silent - swapping the whole grid
    // out for the big loading spinner on every window refocus (e.g. clicking back into the tab)
    // was blowing away in-progress clicks and scroll position, forcing a second click.
    const handleFocus = () => load({ silent: true })
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [load])

  // Listings come straight from our own database (the global Bright MLS sync refreshes that DB
  // every 5 minutes on its own cron - see scheduled_property_sync). Re-pull silently on the same
  // cadence so an agent who leaves this tab open still sees new/updated/sold listings without
  // touching the Refresh button, matching how Showcases and Discovery stay live.
  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  // Deep links from notifications land here with either a specific listing (opens Manage Hosts
  // directly for it, most precise) or a panel name (opens the panel that actually shows that
  // notification's context) - see the link= values in open_house_manager_service.py.
  useEffect(() => {
    const listingKeyParam = searchParams.get('listingKey')
    if (listingKeyParam) setManageHostsKey(listingKeyParam)

    const panel = searchParams.get('panel')
    if (panel === 'host-requests') setIsHostRequestsOpen(true)
    // "My Requests" (sent requests, team invites, broadcast opportunities) lives only on
    // Discovery now - that's where a hosting agent actually deals with this, not here. Old
    // notifications minted before that move can still carry this link, so redirect rather than
    // leaving them dead.
    else if (panel === 'my-requests') router.replace('/discovery?myRequests=1')
    else if (panel === 'team') setIsTeamPanelOpen(true)
  }, [searchParams, router])

  const handleRefreshListings = async () => {
    setIsRefreshing(true)
    // Re-pull from our own database immediately - that's the source of truth this page reads, and
    // it's already kept current by the every-5-minute Bright MLS sync. We still nudge that sync in
    // the background (best effort - ignore the cooldown 429 and any error, the button is not the
    // thing keeping listings fresh), then quietly reload once more in case it pulled something new.
    await load({ silent: true })
    api.openHouseManager.refreshListings().catch(() => {})
    setTimeout(async () => {
      await load({ silent: true })
      setIsRefreshing(false)
    }, 12000)
  }

  const handleConfirmRemoveListing = async () => {
    if (!removeTargetKey) return
    setIsRemoving(true)
    const { success, error } = await api.openHouseManager.removeManualListing(removeTargetKey)
    setIsRemoving(false)
    if (!success) {
      showToast(error || 'Unable to remove this listing right now.', 'error')
      return
    }
    showToast('Listing removed.', 'success')
    setRemoveTargetKey(null)
    load()
  }

  // Clicking a weekend cell on a listing card jumps straight into Manage Hosts already primed for
  // that date - an empty cell prefills a direct request, a filled one jumps to Host Notes (the
  // thing worth checking before you commit that date to someone else).
  const handleCalendarCellClick = (listingKey: string, cell: WeekendCell, open?: WeekendCalendarOpen) => {
    setManageHostsKey(listingKey)
    if (open) {
      setManageHostsFocusNotes(true)
      setManageHostsPrefillDate(null)
      setManageHostsFindOnly(false)
    } else {
      // A day that needs a host opens ONLY the Find a Host pull-up (user, 10/24 - it used to open
      // Manage Hosts behind it too, two windows on a phone).
      setManageHostsPrefillDate(cell.date)
      setManageHostsFocusNotes(false)
      setManageHostsFindOnly(true)
    }
  }

  const closeManageHosts = () => {
    setManageHostsKey(null)
    setManageHostsPrefillDate(null)
    setManageHostsFocusNotes(false)
    setManageHostsFindOnly(false)
  }

  const totalPending = useMemo(() => (data?.listings || []).reduce((sum, l) => sum + l.pending_request_count, 0), [data])
  const removeTargetListing = useMemo(() => (data?.listings || []).find(l => l.listing_key === removeTargetKey) || null, [data, removeTargetKey])

  const filteredListings = useMemo(() => {
    const listings = data?.listings || []
    const term = search.trim().toLowerCase()
    const filtered = term
      ? listings.filter(l => `${l.address} ${l.city || ''} ${l.state || ''} ${l.zipcode || ''}`.toLowerCase().includes(term))
      : listings
    const sorted = [...filtered]
    if (sortBy === 'dom_high') {
      sorted.sort((a, b) => (b.days_on_market || 0) - (a.days_on_market || 0))
    } else if (sortBy === 'dom_low') {
      sorted.sort((a, b) => (a.days_on_market || 0) - (b.days_on_market || 0))
    } else if (sortBy === 'price_high') {
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0))
    } else {
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0))
    }
    return sorted
  }, [data, search, sortBy])

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-[#0B0B0B] flex flex-col">
      {/* Opening (user, 10/24): the house loader until your listings AND their first photos are
          in, then the whole page rises into place. */}
      <PageReveal ready={pageReady} label="Loading your listings" className="flex flex-grow flex-col">
      <main ref={pageRef} className="flex-grow container mx-auto px-4 py-4 sm:py-6 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
        {/* Header + Stats + Actions + Search, all one section instead of floating pieces */}
        {/* Header - the shared luxe header: same stats on the right, the three actions built into
            its bottom bar; search + sort sit in their own card right under it. */}
        <LuxeHero
          compact
          className="mb-4"
          kicker="Manager"
          icon={Building2}
          backHref="/open-houses"
          backLabel="Open Houses"
          title={<>Every open, <em>covered.</em></>}
          subtitle="Coordinate opens - find hosts, approve requests, and track results in one place."
          asideClassName="w-full lg:w-[620px] lg:-mt-[18px]"
          aside={data && (
            <LuxeStats
              large
              stats={[
                { label: 'Scheduled', value: data.summary.open_scheduled, icon: CalendarCheck },
                { label: 'Needs host', value: data.summary.needs_host, icon: AlertCircle, urgent: data.summary.needs_host > 0 },
                { label: 'Avg guests', value: data.summary.avg_guests_per_open, icon: Users },
                { label: 'Priority', value: data.summary.high_priority, icon: Star, alert: data.summary.high_priority > 0, title: 'A listing is flagged high priority once one of its open houses has actually drawn a guest - it\'s proven to convert, so it\'s worth getting re-hosted.' },
              ]}
            />
          )}
          tabs={data ? (
<div className="-mx-2 -my-2 grid grid-cols-3 divide-x divide-[#C9A24D]/20 dark:divide-white/[0.07] sm:-mx-4">
              <button
                onClick={handleRefreshListings}
                disabled={isRefreshing}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-3.5 text-[10.5px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-widest text-[#111827] dark:text-white transition hover:bg-white/60 dark:hover:bg-white/[0.05] disabled:opacity-50"
              >
                {isRefreshing ? <Loader2 size={14} className="animate-spin text-[#C9A24D]" /> : <RefreshCw size={14} className="text-[#C9A24D]" />} <span>Refresh<span className="hidden sm:inline"> Listings</span></span>
              </button>
              <button
                onClick={() => setIsTeamPanelOpen(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-3.5 text-[10.5px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-widest text-[#111827] dark:text-white transition hover:bg-white/60 dark:hover:bg-white/[0.05]"
              >
                <UsersRound size={14} className="text-[#C9A24D]" /> My Team
              </button>
              <button
                onClick={() => setIsHostRequestsOpen(true)}
                className="relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-3.5 text-[10.5px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-widest text-[#8b7355] dark:text-[#e8cf8a] bg-[#C9A24D]/10 transition hover:bg-[#C9A24D]/20 sm:rounded-br-3xl"
              >
                <Inbox size={14} /> <span><span className="hidden sm:inline">Host </span>Requests</span>
                {(totalPending + listingAgentUnseenUpdates) > 0 && (
                  <span className="absolute right-2 top-1.5 sm:right-3 sm:top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-red-300 shadow-lg shadow-red-500/50 dark:ring-red-500/50">
                    {totalPending + listingAgentUnseenUpdates}
                  </span>
                )}
              </button>
            </div>
          ) : undefined}
        />

        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] shadow-sm empty:hidden">
          {/* Search + Sort - only meaningful once there's something to search */}
          {data && data.listings.length > 0 && (
            <div className="flex flex-row items-center gap-2 p-3 sm:gap-3 sm:p-5">
              <ExpandOnFocus className="min-w-0 flex-1 sm:max-w-md" label="Search your listings">
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  enterKeyHint="search"
                  placeholder={`Search ${data.listings.length === 1 ? 'your listing' : `your ${data.listings.length} listings`}...`}
                  className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-[#fafafb] dark:bg-[#0B0B0B] py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                />
              </div>
              </ExpandOnFocus>
              <div className="relative shrink-0 sm:ml-auto" ref={sortDropdownRef}>
                <button
                  onClick={() => setShowSortDropdown(v => !v)}
                  aria-label={`Sort: ${SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}`}
                  className={`flex h-[46px] w-[46px] sm:h-auto sm:w-auto items-center justify-center gap-2 rounded-2xl border sm:px-4 sm:py-3 text-xs font-black uppercase tracking-widest transition ${
                    showSortDropdown
                      ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]'
                      : 'border-gray-100 dark:border-gray-800 bg-[#fafafb] dark:bg-[#0B0B0B] text-[#111827] dark:text-white hover:border-[#C9A24D]/50'
                  }`}
                >
                  <SortDesc size={16} className="sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">{SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}</span>
                </button>
                {/* Portaled to body, not rendered inline - the header card this lives in clips
                    overflow (to keep the flat action-button grid's square corners from poking
                    past its own rounded corners), which was silently clipping this panel away
                    the moment it tried to render below the button. */}
                {/* Phones: the sort is a pull-up sheet that drags down to close (user, 10/24). */}
                <OhSheet open={isPhone && showSortDropdown} onClose={() => setShowSortDropdown(false)} title="Sort your listings" icon={<SortDesc size={18} />}>
                  <div className="space-y-2">
                    {SORT_OPTIONS.map((option, i) => (
                      <motion.button key={option.value} type="button" whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        onClick={() => { setSortBy(option.value); setShowSortDropdown(false) }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-[13px] font-black transition-colors ${sortBy === option.value
                          ? 'border-[#C9A24D] bg-[#FCF9F1] text-[#8b6a2b] dark:bg-[#C9A24D]/10 dark:text-[#e8c97a]'
                          : 'border-gray-100 bg-white text-[#111827] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
                        {option.label}
                        {sortBy === option.value && <span className="grid h-6 w-6 place-items-center rounded-full bg-[#C9A24D] text-white"><Check size={13} strokeWidth={3.5} /></span>}
                      </motion.button>
                    ))}
                  </div>
                </OhSheet>
                {!isPhone && showSortDropdown && sortMenuPos && createPortal(
                  <div
                    style={{ position: 'fixed', top: sortMenuPos.top, left: sortMenuPos.left, width: sortMenuPos.width }}
                    className="z-[100] overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1A1A1C] shadow-xl"
                  >
                    <div className="p-2">
                      {SORT_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => { setSortBy(option.value); setShowSortDropdown(false) }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${
                            sortBy === option.value
                              ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          {option.label}
                          {sortBy === option.value && <Check size={10} strokeWidth={4} />}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
              {/* how many listings - right-most on the search row, the sort sits to its left */}
              <span className="hidden sm:inline shrink-0 rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">
                {data.listings.length} {data.listings.length === 1 ? 'Listing' : 'Listings'}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#C9A24D]" /></div>
        ) : loadError ? (
          <EmptyState icon={AlertCircle} title="Couldn't load your listings" description={loadError} />
        ) : !data || data.listings.length === 0 ? (
          <EmptyState icon={Home} title="No active listings found" description="Listings where you're the MLS listing agent will show up here automatically once synced." />
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {filteredListings.length === 0 ? (
              <EmptyState icon={Search} title="No listings match your search" description="Try a different address, city, or ZIP code." />
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map(listing => (
                  <ListingCard
                    key={listing.listing_key}
                    listing={listing}
                    onViewInsights={setInsightsKey}
                    onManageHosts={setManageHostsKey}
                    onRequestRemove={setRemoveTargetKey}
                    onCalendarCellClick={handleCalendarCellClick}
                    pendingDates={pendingDates[listing.listing_key]}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>
      </PageReveal>
      <Footer />

      <HostRequestsPanel
        isOpen={isHostRequestsOpen}
        onClose={() => setIsHostRequestsOpen(false)}
        onActionComplete={load}
      />
      <OpenHouseTeamPanel
        isOpen={isTeamPanelOpen}
        onClose={() => setIsTeamPanelOpen(false)}
        listings={data?.listings || []}
        onActionComplete={load}
      />
      <ManageHostsModal
        listingKey={manageHostsKey}
        onClose={closeManageHosts}
        onActionComplete={load}
        prefillDirectDate={manageHostsPrefillDate}
        focusHostNotes={manageHostsFocusNotes}
        findOnly={manageHostsFindOnly}
        hostingWindow={data?.listings.find(l => l.listing_key === manageHostsKey)}
      />
      <OpenHouseInsightsModal
        listingKey={insightsKey}
        onClose={() => setInsightsKey(null)}
      />
      <WarningConfirmModal
        isOpen={!!removeTargetKey}
        onClose={() => setRemoveTargetKey(null)}
        onConfirm={handleConfirmRemoveListing}
        title="Remove this listing?"
        message={`This will permanently remove ${removeTargetListing?.address || 'this manually added listing'} and delete any open houses, host requests, and notes tied to it. This can't be undone.`}
        confirmText="Yes, remove it"
        isLoading={isRemoving}
      />
    </div>
  )
}
