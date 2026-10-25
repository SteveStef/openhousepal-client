'use client'

import { HUB_ICON, HUB_ICON_TILE, HubCollapse, hubCardClass, useHubPanelOpen } from './HubPanelChrome'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronRight, Pencil, Tag, Trash2 } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useOptionalAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'
import QuickAddHomeSheet, { quickHomeToEntry, type QuickHome } from './QuickAddHomeSheet'
import { AgentSale, formatSaleStatus, getEligibleListings, getSaleStatusClass, getStreetOnly, shouldAutoShowListing } from '@/lib/agentSales'
import { SettingToggleRow } from './RecentSalesPanel'

const MANUAL_LISTING_STATUSES = ['Active', 'Pending', 'Under Contract', 'Coming Soon']

// Mirrors RecentSalesPanel.tsx, but pulls from the agent's own current Property matches
// (api.openHouseManager.getMyListings) instead of Bright's sold-transaction history - so this
// only ever shows what's actively/pending/coming-soon on the market, never sold/closed listings.
export default function MyListingsPanel({ listings, setListings, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave, ready = true, plain = false, incomplete }: {
  listings: AgentSale[]
  setListings: React.Dispatch<React.SetStateAction<AgentSale[]>>
  carousel: boolean
  setCarousel: React.Dispatch<React.SetStateAction<boolean>>
  autoScroll: boolean
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>
  onChange: () => void
  onSave: (overrides?: { myListings?: AgentSale[]; listingsCarousel?: boolean; listingsAutoScroll?: boolean }) => void
  // False only while the parent's real saved Agent Hub config is still loading - see the matching
  // prop on RecentSalesPanel.tsx for the full race this guards against (auto-load-if-empty firing
  // on a still-blank `listings` and saving that incomplete list over real saved data).
  ready?: boolean
  // Settings uses the plain look so this card matches the other white/bordered settings cards,
  // same as RecentSalesPanel.tsx's `plain` prop.
  plain?: boolean
  // When set (Settings `plain` mode), shows the same Complete / Incomplete badge the other
  // settings cards use. Undefined elsewhere = no badge.
  incomplete?: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useHubPanelOpen('listings')
  // No-MLS plans: no Bright listings to pull (that call 403s) - listings are added by hand.
  const authUser = useOptionalAuth()?.user
  const noMls = !!authUser?.plan_tier && !hasMlsAccess(authUser.plan_tier)
  const listingsSubtitle = noMls
    ? 'Add your active and coming-soon listings by hand.'
    : 'Active, pending, and coming-soon listings pulled from your properties.'
  const [sortMode, setSortMode] = useState<'recent' | 'price-high' | 'price-low'>('recent')
  const [page, setPage] = useState(1)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const addQuickListing = (home: QuickHome) => {
    const nextListings = [...getEligibleListings(listings), quickHomeToEntry(home, 'listing') as AgentSale]
    setListings(nextListings)
    onSave({ myListings: nextListings })
    setQuickAddOpen(false)
    setPage(1)
  }
  const [editingListingId, setEditingListingId] = useState<string | null>(null)
  const [manualListingDraft, setManualListingDraft] = useState({
    street: '',
    city: '',
    state: '',
    zipcode: '',
    price: '',
    status: 'Active',
    image: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [manualPhotoUploading, setManualPhotoUploading] = useState(false)
  const [manualPhotoError, setManualPhotoError] = useState('')
  const pageSize = 6
  const eligibleListings = getEligibleListings(listings)
  const sortedListings = useMemo(() => {
    const sortable = [...eligibleListings]
    if (sortMode === 'price-high') return sortable.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sortMode === 'price-low') return sortable.sort((a, b) => (a.price || 0) - (b.price || 0))
    return sortable
  }, [eligibleListings, sortMode])
  const totalPages = Math.max(1, Math.ceil(sortedListings.length / pageSize))
  const visibleCount = eligibleListings.filter(listing => listing.visible).length
  const pagedListings = sortedListings.slice((page - 1) * pageSize, page * pageSize)
  const pageNumbers = useMemo(() => {
    const maxButtons = 4
    const start = Math.min(Math.max(1, page - 1), Math.max(1, totalPages - maxButtons + 1))
    return Array.from({ length: Math.min(maxButtons, totalPages) }, (_, index) => start + index)
  }, [page, totalPages])

  const loadListings = async () => {
    setIsLoading(true)
    const response = await api.openHouseManager.getMyListings()
    const currentById = new Map(listings.map(listing => [listing.id, listing]))
    const fetchedListings: AgentSale[] = response.success && response.data
      ? response.data.listings.map(listing => {
          const mapped: AgentSale = {
            id: listing.listing_key,
            address: listing.address,
            city: listing.city || '',
            state: listing.state || '',
            zipcode: listing.zipcode || undefined,
            price: listing.price || undefined,
            status: listing.status || 'Active',
            image: listing.image || undefined,
            photos: listing.photos && listing.photos.length ? listing.photos : undefined,
            source: 'listing' as const,
            beds: listing.bedrooms || undefined,
            baths: listing.bathrooms || undefined,
            sqft: listing.living_area || undefined,
            acres: listing.lot_size_acres || undefined,
          }
          return { ...mapped, visible: currentById.get(listing.listing_key)?.visible ?? shouldAutoShowListing(mapped) }
        })
      : []

    // Manual entries are never re-fetched from anywhere - preserve them across every refresh.
    const manualListings = getEligibleListings(listings).filter(listing => listing.source === 'manual')

    const nextListings = [...manualListings, ...fetchedListings]
    setListings(nextListings)
    onSave({ myListings: nextListings })
    setPage(1)
    setIsLoading(false)
  }

  useEffect(() => {
    if (ready && !noMls && !getEligibleListings(listings).length) loadListings()
  }, [ready, noMls])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleListing = (id: string) => {
    const nextListings = getEligibleListings(listings).map(listing => listing.id === id ? { ...listing, visible: !listing.visible } : listing)
    setListings(nextListings)
    onSave({ myListings: nextListings })
  }

  const deleteManualListing = (id: string) => {
    const nextListings = getEligibleListings(listings).filter(listing => listing.id !== id)
    setListings(nextListings)
    onSave({ myListings: nextListings })
    if (editingListingId === id) {
      setEditingListingId(null)
      setManualAddOpen(false)
    }
    setPage(1)
  }

  const editManualListing = (listing: AgentSale) => {
    setEditingListingId(listing.id)
    setManualListingDraft({
      street: getStreetOnly(listing.address),
      city: listing.city,
      state: listing.state,
      zipcode: listing.zipcode || '',
      price: listing.price ? String(listing.price) : '',
      status: formatSaleStatus(listing.status),
      image: listing.image || '',
    })
    setManualAddOpen(true)
  }

  const updateManualDraft = (field: keyof typeof manualListingDraft, value: string) => {
    setManualListingDraft(current => ({ ...current, [field]: value }))
    onChange()
  }

  const handleManualPhoto = async (file?: File) => {
    if (!file) return
    setManualPhotoUploading(true)
    setManualPhotoError('')
    const response = await api.agentHub.uploadSalePhoto(file)
    if (response.success && response.data) {
      updateManualDraft('image', resolveMediaUrl(response.data.photo_url))
    } else {
      setManualPhotoError(response.error || 'Unable to upload photo. Please try a JPG under 5MB.')
    }
    setManualPhotoUploading(false)
  }

  const saveManualListing = () => {
    const street = manualListingDraft.street.trim()
    const city = manualListingDraft.city.trim()
    const state = manualListingDraft.state.trim().toUpperCase()
    const zipcode = manualListingDraft.zipcode.trim()
    const price = Number(String(manualListingDraft.price).replace(/[^0-9.]/g, ''))
    if (!street || !city || !state || !zipcode || !price || !manualListingDraft.image.trim()) return

    const address = `${street}, ${city}, ${state} ${zipcode}`
    const eligible = getEligibleListings(listings)
    const nextListings = editingListingId
      ? eligible.map(listing => listing.id === editingListingId
        ? { ...listing, address, city, state, zipcode, price, image: manualListingDraft.image, status: manualListingDraft.status }
        : listing)
      : [...eligible, {
          id: `manual-${Date.now()}`,
          address,
          city,
          state,
          zipcode,
          price,
          status: manualListingDraft.status,
          image: manualListingDraft.image,
          visible: true,
          source: 'manual' as const,
        }]

    setListings(nextListings)
    onSave({ myListings: nextListings })
    setManualListingDraft({ street: '', city: '', state: '', zipcode: '', price: '', status: 'Active', image: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    setManualAddOpen(false)
    setEditingListingId(null)
    setPage(1)
  }

  return (
    <section className={plain
      ? `overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors duration-300 dark:bg-[#151517] ${incomplete ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-800'}`
      : hubCardClass(isOpen)}>
      {plain ? (
        <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">My Listings</h2>
              {incomplete !== undefined && (
                incomplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" /> Incomplete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Complete
                  </span>
                )
              )}
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-800 dark:text-gray-400">{visibleCount}/{eligibleListings.length} shown</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{listingsSubtitle}</p>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
      <div className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className={HUB_ICON_TILE}>
            <Tag className={HUB_ICON} />
          </span>
          <div>
            <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">My Listings</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{listingsSubtitle}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{visibleCount}/{eligibleListings.length}</span>
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} My Listings`}>
            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      )}

      <HubCollapse open={isOpen}>
        <div className={plain ? 'border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6' : 'border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-700 dark:bg-gray-800'}>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">Choose which listings appear on your public Agent Hub.</p>

            <div className="mt-3 space-y-2">
              <SettingToggleRow
                label="Carousel view"
                hint="On mobile, auto-swipes through one large listing at a time - cycling its own photos when you only have the one - instead of a scrolling row."
                checked={carousel}
                onChange={next => { setCarousel(next); onSave({ listingsCarousel: next, myListings: listings }); onChange() }}
              />
              <SettingToggleRow
                label="Auto scroll"
                hint="Scrolls this row on its own, taking turns with your other sections, when the page sits idle."
                checked={autoScroll}
                onChange={next => { setAutoScroll(next); onSave({ listingsAutoScroll: next, myListings: listings }); onChange() }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={sortMode} onChange={event => { setSortMode(event.target.value as 'recent' | 'price-high' | 'price-low'); setPage(1) }} className="ohp-select rounded-xl border bg-white px-4 py-2.5 text-sm font-black text-gray-800 shadow-sm dark:bg-[#0B0B0B] dark:text-white">
                <option value="recent">Newest</option>
                <option value="price-high">Price High</option>
                <option value="price-low">Price Low</option>
              </select>
              <button
                onClick={() => {
                  // Quick-add window (pull-up sheet on phones) - Where / Details / Photos.
                  setManualAddOpen(false)
                  setEditingListingId(null)
                  setQuickAddOpen(true)
                }}
                className={`rounded-xl border px-3.5 py-2.5 text-sm font-black shadow-sm ${manualAddOpen ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : noMls ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-[#fbfaf7] text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white'}`}
              >
                {noMls ? '+ Add a listing' : 'Manually Add'}
              </button>
              {!noMls && <button onClick={loadListings} disabled={isLoading} className="rounded-xl bg-[#111827] px-3.5 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60">{isLoading ? 'Refreshing...' : 'Refresh Listings'}</button>}
            </div>
          </div>

          {manualAddOpen && (
            <div className="mt-4 rounded-2xl border border-[#C9A24D]/30 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="mb-3 text-sm font-black text-gray-800 dark:text-white">{editingListingId ? 'Edit Listing' : 'Add Listing'}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Street Address</span>
                  <input
                    value={manualListingDraft.street}
                    onChange={(event) => updateManualDraft('street', event.target.value)}
                    placeholder="123 Main Street"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">City</span>
                  <input
                    value={manualListingDraft.city}
                    onChange={(event) => updateManualDraft('city', event.target.value)}
                    placeholder="Dover"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">State</span>
                  <input
                    value={manualListingDraft.state}
                    onChange={(event) => updateManualDraft('state', event.target.value)}
                    placeholder="PA"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Zip</span>
                  <input
                    value={manualListingDraft.zipcode}
                    onChange={(event) => updateManualDraft('zipcode', event.target.value)}
                    placeholder="19000"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Price</span>
                  <input
                    inputMode="decimal"
                    value={manualListingDraft.price}
                    onChange={(event) => updateManualDraft('price', event.target.value)}
                    placeholder="1,000,000"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Status</span>
                  <select
                    value={manualListingDraft.status}
                    onChange={(event) => updateManualDraft('status', event.target.value)}
                    className="ohp-select mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {MANUAL_LISTING_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Photo</span>
                  <div className={`mt-2 flex cursor-pointer items-center rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800 ${manualListingDraft.image ? 'gap-4' : ''}`}>
                    {manualListingDraft.image && <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${manualListingDraft.image})` }} />}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg"
                      disabled={manualPhotoUploading}
                      onChange={(event) => handleManualPhoto(event.target.files?.[0])}
                      className="hidden"
                    />
                    {/* Same button look as Recent Sales' photo row (no browser "Choose File"). */}
                    <span className={`inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3.5 py-2 text-sm font-black text-white transition active:scale-95 dark:bg-white dark:text-[#111827] ${manualPhotoUploading ? 'opacity-60' : ''}`}>
                      {manualPhotoUploading ? 'Uploading...' : manualListingDraft.image ? 'Replace photo' : 'Upload photo'}
                    </span>
                    {!manualListingDraft.image && !manualPhotoUploading && <span className="ml-3 text-xs font-semibold text-gray-400">JPG, under 5MB</span>}
                  </div>
                  {manualPhotoUploading && <p className="mt-1 text-xs font-semibold text-gray-400">Uploading photo...</p>}
                  {manualPhotoError && <p className="mt-1 text-xs font-semibold text-rose-500">{manualPhotoError}</p>}
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveManualListing}
                  disabled={manualPhotoUploading}
                  className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
                >
                  {editingListingId ? 'Save Changes' : 'Add Listing'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualAddOpen(false)
                    setEditingListingId(null)
                    setManualListingDraft({ street: '', city: '', state: '', zipcode: '', price: '', status: 'Active', image: '' })
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* No inner max-height / scroll here on purpose - matches RecentSalesPanel.tsx exactly
              (it used to trap the mouse wheel so the page wouldn't scroll while hovering this
              list). Pagination (6 per page, same page-number + prev/next controls below) keeps
              this short instead, same "many items" behavior as Recent Sales. */}
          <div className="mt-4 space-y-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {isLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">Finding your listings...</div>
            ) : eligibleListings.length ? (
              pagedListings.map(listing => (
                <div key={listing.id} className={`grid grid-cols-[56px_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[68px_minmax(0,1fr)_auto] sm:gap-3 ${listing.visible ? 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900' : 'border-dashed border-gray-300 bg-gray-100 shadow-inner dark:border-gray-700 dark:bg-gray-950'}`}>
                  <div className={`h-14 w-14 shrink-0 rounded-lg bg-cover bg-center sm:w-[68px] ${listing.visible ? '' : 'grayscale opacity-60'}`} style={{ backgroundImage: `url(${listing.image || '/placeholder.jpg'})` }} />
                  <div className="min-w-0 self-center">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(listing.status)}`}>{formatSaleStatus(listing.status)}</span>
                      {listing.source === 'manual' && <span className="rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Manual</span>}
                    </div>
                    <p className={`truncate text-sm font-black leading-snug ${listing.visible ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{getStreetOnly(listing.address)}</p>
                    <p className={`mt-1 truncate text-sm font-semibold ${listing.visible ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{[listing.city, listing.state].filter(Boolean).join(', ') || 'Location unavailable'}</p>
                  </div>
                  {/* Phones: price + buttons on their own row (they squeezed the address to "88 ..."). */}
                  <div className="self-center text-right max-sm:col-span-2 max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-2 max-sm:border-t max-sm:border-gray-100 max-sm:pt-2 dark:max-sm:border-gray-800">
                    <p className={`whitespace-nowrap text-sm font-black ${listing.visible ? 'text-[#8b7355]' : 'text-gray-400 dark:text-gray-500'}`}>{listing.price ? `$${listing.price.toLocaleString()}` : 'No price'}</p>
                    <div className="flex flex-nowrap items-center justify-end gap-2 sm:mt-1">
                      {listing.source === 'manual' && (
                        <>
                          <button
                            type="button"
                            onClick={() => editManualListing(listing)}
                            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            aria-label="Edit manual listing"
                            title="Edit manual listing"
                          >
                            <Pencil className="ohp-icon-draw h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteManualListing(listing.id)}
                            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
                            aria-label="Delete manual listing"
                            title="Delete manual listing"
                          >
                            <Trash2 className="ohp-icon-draw h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleListing(listing.id)}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-black ${listing.visible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-gray-200 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}
                      >
                        {listing.visible ? 'Shown' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">
                No active, pending, or coming-soon listings found yet.
              </div>
            )}
          </div>

          {eligibleListings.length > pageSize && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <span className="min-w-[96px] whitespace-nowrap leading-6">Page {page} of {totalPages}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Previous listings page">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                {pageNumbers[0] > 1 && <span className="px-1 text-gray-400">...</span>}
                {pageNumbers.map(pageNumber => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-10 rounded-lg border px-3 py-2 ${pageNumber === page ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                  >
                    {pageNumber}
                  </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-1 text-gray-400">...</span>}
                <button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Next listings page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </HubCollapse>
      <QuickAddHomeSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} kind="listing" onSave={addQuickListing} />
    </section>
  )
}
