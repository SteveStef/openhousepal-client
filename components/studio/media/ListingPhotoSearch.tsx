'use client'

import { useEffect, useRef, useState } from 'react'
import { Bath, Bed, Home, Loader2, MapPin, Maximize, Search, Tag, Upload, X } from 'lucide-react'
import api from '@/lib/api-service'
import { getEligibleSales } from '@/lib/agentSales'
import type { LinkedProperty, MyListingItem } from '@/types'
import { tidyAllCaps } from '@/lib/cheatSheetContent'  // keeps state codes: "Exton, PA", not "Pa"

type RecentSale = { id: string; address: string; city?: string; state?: string; price?: number; status?: string; image?: string; sold_date?: string }

export type PhotoSearchTab = 'mine' | 'sales' | 'search' | 'upload'

const TAB_ORDER: PhotoSearchTab[] = ['mine', 'sales', 'search', 'upload']

/**
 * The same MLS property search the "Generate Kit" flow uses (CreateOpenHouseWizard's ADDRESS
 * step): a live address search with a rich suggestion dropdown (thumbnail, MLS status, price),
 * plus a "My Listings" grid. On pick it runs /api/properties/lookup and returns a
 * LinkedProperty (whose `photos` array feeds the media tool's photo grid).
 *
 * MLS-only by construction - only rendered for tiers with Bright data. Non-MLS tiers
 * (PRO_NO_MLS) never see this; they upload photos instead.
 */

type Suggestion = { address: string; lat: number; lng: number; image?: string | null; status?: string | null; price?: number | null }

function formatStatus(status?: string | null): string {
  if (!status) return 'Listing'
  const s = status.toLowerCase()
  if (s.includes('active') && s.includes('under')) return 'Under Contract'
  if (s.includes('active')) return 'Active'
  if (s.includes('pending')) return 'Pending'
  if (s.includes('closed') || s.includes('sold')) return 'Sold'
  if (s.includes('coming')) return 'Coming Soon'
  return status
}

// Mirrors the "Generate Kit" address dropdown (CreateOpenHouseWizard.getStatusBadgeClass):
// active = green, coming soon = light green, pending / under contract = yellow, sold = red.
function statusBadgeClass(status?: string | null): string {
  const label = formatStatus(status).toLowerCase()
  if (label.includes('coming')) return 'border-lime-300 bg-lime-100 text-lime-700 dark:border-lime-300 dark:bg-lime-500 dark:text-[#111827]'
  if (label.includes('active')) return 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-600 dark:text-white'
  if (label.includes('sold') || label.includes('closed')) return 'border-red-300 bg-red-100 text-red-700 dark:border-red-400 dark:bg-red-600 dark:text-white'
  if (label.includes('pending') || label.includes('contract')) return 'border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-300 dark:bg-yellow-500 dark:text-[#111827]'
  return 'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-500 dark:bg-gray-700 dark:text-white'
}

function formatPrice(price?: number | string | null): string {
  const n = typeof price === 'string' ? parseFloat(price) : price
  if (!n || Number.isNaN(n)) return 'Price N/A'
  return `$${Math.round(n).toLocaleString()}`
}

function toLinkedProperty(data: any, fallbackAddress: string): LinkedProperty {
  return {
    listing_key: data.ListingKey || data.listing_key || undefined,
    address: data.FullStreetAddress || data.UnparsedAddress || fallbackAddress,
    city: data.City || undefined,
    state: data.StateOrProvince || undefined,
    zipcode: data.PostalCode || undefined,
    price: data.ListPrice ?? undefined,
    original_price: data.OriginalListPrice ?? undefined,
    beds: data.BedroomsTotal ?? undefined,
    baths: data.BathroomsTotal ?? undefined,
    sqft: data.LivingArea ?? undefined,
    acres: data.LotSizeAcres ?? undefined,
    image_url: data.ListPictureURL || (data.photos && data.photos[0]) || undefined,
    photos: data.photos && data.photos.length > 0 ? data.photos : undefined,
    status: data.MlsStatus || undefined,
    description: data.PublicRemarks || undefined,
    year_built: data.YearBuilt ?? undefined,
    property_type: data.PropertyType || undefined,
    lot_size: data.LotSizeSquareFeet ?? undefined,
  }
}

export default function ListingPhotoSearch({
  value, onChange, tab: tabProp, onTabChange, uploadSlot, fullHeight = false, currentListingsOnly = false,
}: {
  value: LinkedProperty | null
  onChange: (property: LinkedProperty | null) => void
  /** Controlled tab (optional). When omitted the component manages its own tab state. */
  tab?: PhotoSearchTab
  onTabChange?: (t: PhotoSearchTab) => void
  /** When provided, an "Upload Photos" tab is shown that renders this node. */
  uploadSlot?: React.ReactNode
  /** Show every listing/sale at once (the caller's own page or modal scrolls) instead of a
   *  short scrolling box - the Spotlight "Which home" window uses this. */
  fullHeight?: boolean
  /** Listing Spotlight: only the agent's own homes still on the market - no My Sales, no address
   *  search (a Spotlight is the listing agent's page for their own listing). */
  currentListingsOnly?: boolean
}) {
  const [tabState, setTabState] = useState<PhotoSearchTab>('mine')
  const tab = tabProp ?? tabState
  // Direction the new tab's panel slides in from, based on which way along the tab row you moved.
  const [tabDir, setTabDir] = useState<'left' | 'right'>('right')
  const setTab = (t: PhotoSearchTab) => {
    setTabDir(TAB_ORDER.indexOf(t) >= TAB_ORDER.indexOf(tab) ? 'right' : 'left')
    setTabState(t)
    onTabChange?.(t)
  }
  const [sales, setSales] = useState<RecentSale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [salesLoaded, setSalesLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  // Address currently being looked up - drives a spinner on just that one tile, instead of
  // dimming the whole grid (which read as glitchy when the panel then swapped out).
  const [pendingAddr, setPendingAddr] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [myListings, setMyListings] = useState<MyListingItem[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMine(true)
    api.openHouseManager.getMyListings().then(res => {
      if (res.success && res.data) setMyListings(currentListingsOnly ? res.data.listings.filter(l => !/closed|sold|expired|withdrawn|cancel/i.test(l.status || '')) : res.data.listings)
      setLoadingMine(false)
    })
  }, [])

  useEffect(() => {
    if (tab !== 'sales' || salesLoaded) return
    setLoadingSales(true)
    ;(async () => {
      // Use the Recent Sales the agent curates in Settings / Agent Hub - this already includes
      // their manually-added sold properties and respects visibility - instead of a raw re-pull
      // from the MLS. Falls back to the live pull only if they've never set any up.
      const mine = await api.agentHub.getMine()
      const config: any = (mine.success && mine.data?.config) || {}
      let list = getEligibleSales(Array.isArray(config.recentSales) ? config.recentSales : [])
      if (!list.length) {
        const res = await api.agentHub.getRecentSales()
        list = getEligibleSales(Array.isArray(res.data) ? (res.data as any[]) : [])
      }
      const ordered = [...list].sort((a, b) => {
        const av = a.visible === false ? 1 : 0
        const bv = b.visible === false ? 1 : 0
        if (av !== bv) return av - bv
        return String(b.sold_date || '').localeCompare(String(a.sold_date || ''))
      })
      setSales(ordered.map(s => ({
        id: s.id, address: s.address, city: s.city, state: s.state,
        price: s.price, status: s.status, image: s.image, sold_date: s.sold_date,
      })))
      setLoadingSales(false)
      setSalesLoaded(true)
    })()
  }, [tab, salesLoaded])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) { setSuggestions([]); return }
    setSearching(true)
    const id = setTimeout(async () => {
      const { success, data } = await api.properties.address(trimmed)
      if (success && data?.results) setSuggestions(data.results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  // The dropdown renders directly under the input, but this whole component can sit inside a
  // caller's own scroll container (e.g. the property-sites "Create" modal's max-h-[420px] box) -
  // if the input isn't already at the top of that box, a plain absolutely-positioned dropdown
  // gets clipped at the box's edge instead of the agent seeing it appear. Scrolling it into view
  // the moment real results land fixes that without changing the dropdown's positioning.
  useEffect(() => {
    if (showSuggestions && suggestions.length > 0) {
      suggestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [showSuggestions, suggestions.length])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const pick = async (address: string) => {
    setLookingUp(true); setPendingAddr(address); setError(''); setShowSuggestions(false)
    const { success, data, error: e } = await api.properties.lookup(address)
    if (success && data) {
      onChange(toLinkedProperty(data, address))
      setQuery(''); setSuggestions([])
    } else {
      setError(e || 'Unable to load this property. Try another address.')
    }
    setLookingUp(false); setPendingAddr(null)
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-[#151517]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
          {value.image_url ? <img src={value.image_url} alt={value.address} className="h-full w-full object-cover" /> : <Home className="h-6 w-6 text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-[#111827] dark:text-white">{value.address}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-gray-500 dark:text-gray-400">
            {value.price ? <span>${Number(value.price).toLocaleString()}</span> : null}
            {value.beds ? <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" />{value.beds}</span> : null}
            {value.baths ? <span className="inline-flex items-center gap-1"><Bath className="h-3 w-3" />{value.baths}</span> : null}
            {value.sqft ? <span className="inline-flex items-center gap-1"><Maximize className="h-3 w-3" />{Number(value.sqft).toLocaleString()} sqft</span> : null}
            {value.photos ? <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#8b7355]">{value.photos.length} photos</span> : null}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Change property" title="Change property">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      {!currentListingsOnly && <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-[#fbfaf7] p-1 dark:border-gray-700 dark:bg-[#151517]">
        {((uploadSlot ? ['mine', 'sales', 'search', 'upload'] : ['mine', 'sales', 'search']) as PhotoSearchTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
              tab === t
                ? 'bg-white text-[#111827] shadow-sm ring-1 ring-black/5 dark:bg-[#1A1A1C] dark:text-white dark:ring-white/10'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {t === 'mine' ? 'My Listings' : t === 'sales' ? 'My Sales' : t === 'search' ? 'Search Any Address' : 'Upload Photos'}
          </button>
        ))}
      </div>}

      <div key={tab} className={tabDir === 'right' ? 'animate-tab-in-right' : 'animate-tab-in-left'}>
      {tab === 'upload' && uploadSlot && <div>{uploadSlot}</div>}

      {tab === 'search' && (
        <div className="relative">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Enter a property address..."
              disabled={lookingUp}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-9 font-semibold outline-none focus:border-[#C9A24D] disabled:opacity-60 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
            />
            {(searching || lookingUp) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} className="absolute z-[60] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-[#151517]">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => pick(s.address)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left transition last:border-0 hover:bg-[#fbfaf7] dark:border-gray-800 dark:hover:bg-[#1A1A1C]"
                >
                  <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                    {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-300"><MapPin className="h-4 w-4" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#111827] dark:text-white">
                      {tidyAllCaps(s.address)}
                    </p>
                    <p className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusBadgeClass(s.status)}`}>{formatStatus(s.status)}</span>
                      <span className="text-[11px] font-black text-[#8b7355] dark:text-[#C9A24D]">{formatPrice(s.price)}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
        </div>
      )}

      {tab === 'mine' && (
        <div className={`grid auto-rows-max gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 ${fullHeight ? '' : 'max-h-[300px] overflow-y-auto pr-1'}`}>
          {loadingMine && (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-xs font-bold text-gray-400 dark:border-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your listings...
            </div>
          )}
          {!loadingMine && myListings.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
              {currentListingsOnly ? 'No current listings found under your MLS ID. When you list a home it shows up here.' : 'No listings found. Use "Search Any Address" instead.'}
            </div>
          )}
          {myListings.map(listing => (
            <button
              key={listing.listing_key}
              onClick={() => pick(listing.address)}
              disabled={lookingUp}
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-colors hover:border-[#C9A24D] disabled:cursor-default dark:border-gray-700 dark:bg-[#151517]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
                {listing.image ? <img src={listing.image} alt={listing.address} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-gray-300" /></div>}
                {pendingAddr === listing.address && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-[#151517]/70">
                    <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <p className="truncate text-[11px] font-black leading-tight text-[#111827] dark:text-white">{listing.address}</p>
                <p className="mt-0.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">{listing.price ? `$${Number(listing.price).toLocaleString()}` : '—'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'sales' && (
        <div className={`grid auto-rows-max gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 ${fullHeight ? '' : 'max-h-[300px] overflow-y-auto pr-1'}`}>
          {loadingSales && (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-xs font-bold text-gray-400 dark:border-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your recent sales...
            </div>
          )}
          {!loadingSales && sales.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
              No recent sales found. Add your license number in Agent Hub settings, or use another tab.
            </div>
          )}
          {sales.map(sale => (
            <button
              key={sale.id}
              onClick={() => pick(sale.address)}
              disabled={lookingUp}
              className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-colors hover:border-[#C9A24D] disabled:cursor-default dark:border-gray-700 dark:bg-[#151517]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
                {sale.image ? <img src={sale.image} alt={sale.address} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><Tag className="h-5 w-5 text-gray-300" /></div>}
                <span className="absolute left-1 top-1 rounded bg-red-600/90 px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">Sold</span>
                {pendingAddr === sale.address && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-[#151517]/70">
                    <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <p className="truncate text-[11px] font-black leading-tight text-[#111827] dark:text-white">{sale.address}</p>
                <p className="mt-0.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  {sale.price ? `$${Number(sale.price).toLocaleString()}` : '—'}{sale.sold_date ? ` · ${new Date(sale.sold_date).getFullYear()}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      </div>

      {lookingUp && <p className="flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading property photos…</p>}
    </div>
  )
}
