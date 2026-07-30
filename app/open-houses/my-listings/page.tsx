'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Inbox, Loader2, Layers, CalendarCheck, AlertCircle, Users, Star, ArrowUpDown, Home, RefreshCw, Plus, UsersRound } from 'lucide-react'
import Footer from '@/components/Footer'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import api from '@/lib/api-service'
import { MyListingsResponse } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import ListingCard from '@/components/open-house-manager/ListingCard'
import SummaryMetricCard from '@/components/open-house-manager/SummaryMetricCard'
import EmptyState from '@/components/open-house-manager/EmptyState'
import HostRequestsPanel from '@/components/open-house-manager/HostRequestsPanel'
import ManageHostsModal from '@/components/open-house-manager/ManageHostsModal'
import OpenHouseInsightsModal from '@/components/open-house-manager/OpenHouseInsightsModal'
import AddManualListingModal from '@/components/open-house-manager/AddManualListingModal'
import OpenHouseTeamPanel from '@/components/open-house-manager/OpenHouseTeamPanel'
import WarningConfirmModal from '@/components/WarningConfirmModal'

type SortOption = 'days_on_market' | 'price' | 'needs_host_first'

export default function MyListingsPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredPlan="BASIC">
          <MyListingsContent />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function MyListingsContent() {
  const { showToast } = useToast()
  const [data, setData] = useState<MyListingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('needs_host_first')
  const [isHostRequestsOpen, setIsHostRequestsOpen] = useState(false)
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false)
  const [manageHostsKey, setManageHostsKey] = useState<string | null>(null)
  const [insightsKey, setInsightsKey] = useState<string | null>(null)
  const [isAddListingOpen, setIsAddListingOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [removeTargetKey, setRemoveTargetKey] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getMyListings()
    if (success && data) setData(data)
    else setLoadError(error || 'Unable to load your listings right now.')
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRefreshListings = async () => {
    setIsRefreshing(true)
    const { success, error } = await api.openHouseManager.refreshListings()
    if (!success) {
      setIsRefreshing(false)
      showToast(error || 'Unable to start a refresh right now.', 'error')
      return
    }
    // No toast here on purpose - the spinning button icon is the only loading signal. Reload
    // quietly once the sync has had time to run, then stop the spinner.
    setTimeout(async () => {
      await load()
      setIsRefreshing(false)
    }, 15000)
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

  const totalPending = useMemo(() => (data?.listings || []).reduce((sum, l) => sum + l.pending_request_count, 0), [data])
  const removeTargetListing = useMemo(() => (data?.listings || []).find(l => l.listing_key === removeTargetKey) || null, [data, removeTargetKey])

  const filteredListings = useMemo(() => {
    const listings = data?.listings || []
    const term = search.trim().toLowerCase()
    const filtered = term
      ? listings.filter(l => `${l.address} ${l.city || ''} ${l.state || ''} ${l.zipcode || ''}`.toLowerCase().includes(term))
      : listings
    const sorted = [...filtered]
    if (sortBy === 'days_on_market') {
      sorted.sort((a, b) => (b.days_on_market || 0) - (a.days_on_market || 0))
    } else if (sortBy === 'price') {
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0))
    } else {
      sorted.sort((a, b) => {
        if (a.open_house_status === b.open_house_status) return (b.days_on_market || 0) - (a.days_on_market || 0)
        return a.open_house_status === 'needs_host' ? -1 : 1
      })
    }
    return sorted
  }, [data, search, sortBy])

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-[#0B0B0B] flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-10 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
        <Link href="/open-houses" className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors mb-8 group">
          <div className="p-1.5 rounded-full bg-white dark:bg-[#151517] border border-gray-100 dark:border-gray-800 group-hover:border-gray-200 dark:group-hover:border-gray-700 shadow-sm transition-all">
            <ArrowLeft size={14} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Open Houses</span>
        </Link>

        <div className="mb-8 flex flex-row items-start md:items-end justify-between gap-4 md:gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-[#C9A24D]/10 flex items-center justify-center text-[#C9A24D]">
                <Layers size={18} />
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-[#111827] dark:text-white tracking-tight">Your Listings</h1>
              {data && (
                <span className="hidden sm:inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {data.listings.length} Listings
                </span>
              )}
            </div>
            <p className="hidden sm:block text-gray-500 dark:text-gray-400 font-medium max-w-2xl leading-relaxed">
              Coordinate open houses across your listings - find hosts, approve requests, and track results in one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setIsAddListingOpen(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355]"
            >
              <Plus size={15} /> Add Property
            </button>
            <button
              onClick={handleRefreshListings}
              disabled={isRefreshing}
              className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-50"
            >
              {isRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Refresh Listings
            </button>
            <button
              onClick={() => setIsTeamPanelOpen(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355]"
            >
              <UsersRound size={15} /> My Team
            </button>
            <button
              onClick={() => setIsHostRequestsOpen(true)}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-[#111827] dark:bg-white px-3 py-2.5 sm:px-5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200"
            >
              <Inbox size={14} className="sm:w-[15px] sm:h-[15px]" /> Host Requests
              {totalPending > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A24D] px-1 text-[10px] font-black text-white">
                  {totalPending}
                </span>
              )}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#C9A24D]" /></div>
        ) : loadError ? (
          <EmptyState icon={AlertCircle} title="Couldn't load your listings" description={loadError} />
        ) : !data || data.listings.length === 0 ? (
          <EmptyState icon={Home} title="No active listings found" description="Listings where you're the MLS listing agent will show up here automatically once synced." />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-4 gap-1.5 sm:gap-3">
              <SummaryMetricCard icon={CalendarCheck} label="Open Scheduled" value={data.summary.open_scheduled} />
              <SummaryMetricCard icon={AlertCircle} label="Needs Host" value={data.summary.needs_host} />
              <SummaryMetricCard icon={Users} label="Avg Guests/Open" value={data.summary.avg_guests_per_open} />
              <SummaryMetricCard
                icon={Star}
                label="High Priority"
                value={data.summary.high_priority}
                highlight={data.summary.high_priority > 0}
                infoText="A listing is flagged high priority once one of its open houses has actually drawn a guest - it's proven to convert, so it's worth getting re-hosted."
              />
            </div>

            <div className="mb-3 sm:mb-6 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search your listings..."
                  className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                />
              </div>
              <div className="relative flex w-full sm:w-auto items-center gap-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] px-4 py-3">
                <ArrowUpDown size={14} className="text-gray-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs font-black uppercase tracking-widest text-[#111827] dark:text-white outline-none"
                >
                  <option value="needs_host_first">Needs Host First</option>
                  <option value="days_on_market">Days on Market</option>
                  <option value="price">Price</option>
                </select>
              </div>
            </div>

            <div className="mb-6 flex md:hidden flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsAddListingOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355]"
              >
                <Plus size={14} /> Add Property
              </button>
              <button
                onClick={handleRefreshListings}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-50"
              >
                {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
              </button>
              <button
                onClick={() => setIsTeamPanelOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white transition hover:border-[#C9A24D] hover:text-[#8b7355]"
              >
                <UsersRound size={14} /> My Team
              </button>
            </div>

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
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
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
        onClose={() => setManageHostsKey(null)}
        onActionComplete={load}
      />
      <OpenHouseInsightsModal
        listingKey={insightsKey}
        onClose={() => setInsightsKey(null)}
      />
      <AddManualListingModal
        isOpen={isAddListingOpen}
        onClose={() => setIsAddListingOpen(false)}
        onAdded={load}
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
