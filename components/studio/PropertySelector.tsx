'use client'

import { useEffect, useRef, useState } from 'react'
import { formatStatus } from '@/components/website-public/listingFormat'
import { Bed, Bath, Home, Loader2, Maximize, Search, X } from 'lucide-react'
import { LinkedProperty, MyListingItem } from '@/types'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'
import { normalizeImageUrl } from '@/lib/utils'
import PropertyLinkPicker from '@/components/forms/PropertyLinkPicker'
import { PROPERTY_RULE_NOTE, type PropertyRule } from '@/lib/studio/designCompliance'

interface PropertySelectorProps {
  value: LinkedProperty | null
  onChange: (property: LinkedProperty | null) => void
  compact?: boolean
  // Studio advertising rules (lib/studio/designCompliance): only the homes this agent may advertise
  // for the design's situation. Unset = every tab (e.g. blogs).
  only?: PropertyRule | null
}

export default function PropertySelector(props: PropertySelectorProps) {
  // No-MLS plans have no Bright listings to pick from or search - both tabs below call MLS-only
  // endpoints. They attach a property by typing its details in (plus their saved properties),
  // which is what their plan card promises: "auto-filled from the property details you enter".
  const { user } = useAuth()
  if (user && !hasMlsAccess(user.plan_tier)) {
    return <PropertyLinkPicker value={props.value} onChange={props.onChange} />
  }
  return <MlsPropertySelector {...props} />
}

type PickerTab = 'mine' | 'sold' | 'hosting' | 'search'

export interface RecentSaleItem { id: string; address: string; city?: string; state?: string; price?: number; image?: string; sold_date?: string; beds?: number; baths?: number; sqft?: number; acres?: number }

const money = (n?: number | null) => (n ? `$${Number(n).toLocaleString()}` : '')

const TABS_FOR: Record<PropertyRule | 'any', PickerTab[]> = {
  any: ['mine', 'sold', 'search'],
  listings: ['mine'],
  sales: ['sold'],
  open_house: ['mine', 'hosting'],
}

function MlsPropertySelector({ value, onChange, compact = false, only = null }: PropertySelectorProps) {
  const allowed = TABS_FOR[only || 'any']
  const [tab, setTab] = useState<PickerTab>(allowed[0])
  const [hosting, setHosting] = useState<{ id: string; address: string; image?: string | null; when: string }[] | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ address: string; image?: string | null; price?: number | null; status?: string | null }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [myListings, setMyListings] = useState<MyListingItem[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [sales, setSales] = useState<RecentSaleItem[] | null>(null)
  const [loadingSales, setLoadingSales] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMine(true)
    api.openHouseManager.getMyListings().then(response => {
      if (response.success && response.data) setMyListings(response.data.listings)
      setLoadingMine(false)
    })
  }, [])

  // Hosting: open houses another agent's listing agent approved this agent to host.
  useEffect(() => {
    if (tab !== 'hosting' || hosting !== null) return
    api.openHouseManager.getMyRequests().then(res => {
      const seen = new Set<string>()
      const list = (res.success ? res.data || [] : [])
        .filter(r => r.status === 'approved' && r.property_address)
        .filter(r => (seen.has(r.listing_key) ? false : (seen.add(r.listing_key), true)))
        .map(r => ({ id: r.id, address: r.property_address as string, image: r.property_image, when: r.counter_date || r.requested_date }))
      setHosting(list)
    })
  }, [tab, hosting])

  // Recent Sales: the sales the agent curated in their Agent Hub (already stored - no MLS call).
  // Only if they've never curated any does it fall back to the same MLS lookup the Agent Hub uses.
  useEffect(() => {
    if (tab !== 'sold' || sales !== null) return
    let cancelled = false
    setLoadingSales(true)
    const load = async () => {
      const hub = await api.agentHub.getMine().catch(() => null)
      const configured = hub?.data?.config?.recentSales
      let list: RecentSaleItem[] = (Array.isArray(configured) ? configured : []).filter((s: any) => s?.visible !== false)
      if (!list.length) {
        const res = await api.agentHub.getRecentSales().catch(() => null)
        list = (res?.success ? res.data || [] : []).filter((s: any) => (s?.price || 0) > 0)
      }
      if (cancelled) return
      setSales(list)
      setLoadingSales(false)
    }
    load()
    return () => { cancelled = true }
  }, [tab, sales])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      return
    }
    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      const { success, data } = await api.properties.address(trimmed)
      if (success && data?.results) setSuggestions(data.results)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  // `sale` = picked from Recent Sales: its recorded price becomes the close price, so Just Sold
  // designs can say "Sold for" truthfully.
  const lookupAndSelect = async (address: string, key: string, sale?: RecentSaleItem) => {
    setIsLookingUp(key)
    setError('')
    const { property, error: lookupError } = await fetchLinkedProperty(address, sale)
    if (property) {
      onChange(property)
      setQuery('')
      setSuggestions([])
    } else {
      setError(lookupError || 'Unable to load this property. Please try another address.')
    }
    setIsLookingUp(null)
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-[#151517]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
          {value.image_url ? (
            <img src={value.image_url} alt={value.address} className="h-full w-full object-cover" />
          ) : (
            <Home className="h-6 w-6 text-gray-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-[#111827] dark:text-white">{value.address}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-gray-500 dark:text-gray-400">
            {value.close_price ? <span>Sold {money(value.close_price)}</span> : value.price ? <span>{money(value.price)}</span> : null}
            {value.beds ? <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" />{value.beds}</span> : null}
            {value.baths ? <span className="inline-flex items-center gap-1"><Bath className="h-3 w-3" />{value.baths}</span> : null}
            {value.sqft ? <span className="inline-flex items-center gap-1"><Maximize className="h-3 w-3" />{Number(value.sqft).toLocaleString()} sqft</span> : null}
            {value.status && formatStatus(value.status) ? <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#8b7355]">{formatStatus(value.status)}</span> : null}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Change property" title="Change property">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const LABELS: Record<PickerTab, string> = { mine: 'My Listings', sold: 'Recent Sales', hosting: 'Approved to Host', search: 'Search Any Address' }
  const TABS = allowed.map(id => ({ id, label: LABELS[id] }))
  const grid = `grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`
  const card = (key: string, image: string | null | undefined, address: string, sub: string, onPick: () => void, badge?: string) => (
    <button
      key={key}
      onClick={onPick}
      disabled={!!isLookingUp}
      className="ohp-lift group relative overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-[#C9A24D] hover:shadow-md disabled:opacity-60 dark:border-gray-700 dark:bg-[#151517]"
    >
      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800">
        {image ? <img src={normalizeImageUrl(image)} alt={address} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
        {badge && <span className="absolute left-2 top-2 rounded-full bg-[#111827]/85 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{badge}</span>}
        <span className="absolute inset-0 flex items-center justify-center bg-[#111827]/0 text-[11px] font-black uppercase tracking-wide text-white opacity-0 transition group-hover:bg-[#111827]/40 group-hover:opacity-100">
          {isLookingUp === key ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Use this property'}
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-black text-[#111827] dark:text-white">{address}</p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{sub}</p>
      </div>
    </button>
  )
  const empty = (text: string) => <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm font-bold text-gray-400 dark:border-gray-700">{text}</div>
  const loading = (text: string) => <div className="col-span-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-6 text-sm font-bold text-gray-400 dark:border-gray-700"><Loader2 className="h-4 w-4 animate-spin" /> {text}</div>

  return (
    <div ref={wrapRef} className="space-y-3">
      {only && <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{PROPERTY_RULE_NOTE[only]}</p>}
      {TABS.length > 1 && <div className="inline-flex rounded-xl border border-gray-200 bg-[#fbfaf7] p-1 dark:border-gray-700 dark:bg-[#151517]">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wide transition ${
              tab === t.id ? 'bg-white text-[#111827] shadow-sm dark:bg-[#1A1A1C] dark:text-white' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>}

      {tab === 'search' && (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a property address..."
              disabled={!!isLookingUp}
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-9 font-semibold outline-none focus:border-[#C9A24D] disabled:opacity-60 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
            />
            {(isSearching || isLookingUp) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
          </div>
          {suggestions.length > 0 && (
            <div className="ohp-modal-pop absolute z-20 mt-1 max-h-[340px] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-[#151517]">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => lookupAndSelect(suggestion.address, `s${index}`)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-[#C9A24D]/10 dark:border-gray-800"
                >
                  {suggestion.image
                    ? <img src={normalizeImageUrl(suggestion.image)} alt="" className="h-11 w-14 shrink-0 rounded-lg object-cover" />
                    : <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{suggestion.address}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-gray-400">
                      {suggestion.price ? <span>{money(suggestion.price)}</span> : null}
                      {suggestion.status && formatStatus(suggestion.status) ? <span className="rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-300">{formatStatus(suggestion.status)}</span> : null}
                    </p>
                  </div>
                  {isLookingUp === `s${index}` && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
                </button>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
        </div>
      )}

      {tab === 'mine' && (
        <div className={grid}>
          {loadingMine && loading('Loading your listings...')}
          {!loadingMine && myListings.length === 0 && empty(only ? 'No listings of yours found yet. Once your listing is in the MLS it shows up here.' : 'No active listings found yet. Try Recent Sales or Search Any Address.')}
          {myListings.map(listing => card(`m${listing.listing_key}`, listing.image, listing.address, listing.price ? money(listing.price) : 'Price unavailable', () => lookupAndSelect(listing.address, `m${listing.listing_key}`)))}
        </div>
      )}

      {tab === 'hosting' && (
        <div className={grid}>
          {hosting === null && loading('Loading the open houses you’re hosting...')}
          {hosting && hosting.length === 0 && empty('No approved hosting yet. Once a listing agent approves your request to host, the home shows up here.')}
          {(hosting || []).map(h => card(`h${h.id}`, h.image, h.address, 'Approved to host', () => lookupAndSelect(h.address, `h${h.id}`), 'Hosting'))}
        </div>
      )}

      {tab === 'sold' && (
        <div className={grid}>
          {loadingSales && loading('Loading your recent sales...')}
          {!loadingSales && sales && sales.length === 0 && empty(only ? 'No sales of yours found yet - they show up here once they close in the MLS (or add them in Agent Hub > Recent Sales).' : 'No sales found yet - add them in your Agent Hub (Studio > Site > Recent Sales), or search the address.')}
          {(sales || []).map(sale => card(
            `r${sale.id}`, sale.image, sale.address,
            [sale.price ? `Sold ${money(sale.price)}` : 'Sold', sale.city].filter(Boolean).join(' · '),
            () => lookupAndSelect(sale.address, `r${sale.id}`, sale), 'Sold',
          ))}
        </div>
      )}
    </div>
  )
}

// Full listing details for an address (MLS lookup) as a design's LinkedProperty - shared by the
// picker above and Studio's "Your newest listing / latest sale" shortcuts. `sale` = picked from
// Recent Sales: its recorded price becomes the close price, so Just Sold designs say "Sold for"
// truthfully; a sale not in our MLS data falls back to what the sale record has.
// listingKey: the exact listing - an address alone can land on another unit in the same building
// (the AI helper made "191 Presidential Blvd #R-605" with a different unit's details, owner 10/30).
export async function fetchLinkedProperty(address: string, sale?: RecentSaleItem, listingKey?: string): Promise<{ property: LinkedProperty | null; error?: string }> {
  const full = sale && sale.city ? `${address}, ${sale.city}${sale.state ? `, ${sale.state}` : ''}` : address
  const { success, data, error } = await api.properties.lookup(listingKey ? { listingKey } : full)
  if (success && data) {
    return { property: {
      listing_key: data.ListingKey || data.listing_key || undefined,
      address: data.FullStreetAddress || data.UnparsedAddress || address,
      city: data.City || undefined,
      state: data.StateOrProvince || undefined,
      zipcode: data.PostalCode || undefined,
      price: data.ListPrice ?? undefined,
      original_price: data.OriginalListPrice ?? undefined,
      close_price: sale?.price ?? data.ClosePrice ?? undefined,
      close_date: sale?.sold_date ?? data.CloseDate ?? undefined,
      beds: data.BedroomsTotal ?? undefined,
      baths: data.BathroomsTotal ?? undefined,
      sqft: data.LivingArea ?? undefined,
      acres: data.LotSizeAcres ?? undefined,
      image_url: data.ListPictureURL || (data.photos && data.photos[0]) || undefined,
      photos: data.photos && data.photos.length > 0 ? data.photos : undefined,
      status: sale ? 'CLOSED' : data.MlsStatus || undefined,
      description: data.PublicRemarks || undefined,
      year_built: data.YearBuilt ?? undefined,
      property_type: data.PropertyType || undefined,
      lot_size: data.LotSizeSquareFeet ?? undefined,
    } }
  }
  if (sale) {
    return { property: {
      address: sale.address, city: sale.city || undefined, state: sale.state || undefined,
      price: sale.price ?? undefined, close_price: sale.price ?? undefined, close_date: sale.sold_date ?? undefined,
      beds: sale.beds ?? undefined, baths: sale.baths ?? undefined, sqft: sale.sqft ?? undefined, acres: sale.acres ?? undefined,
      image_url: sale.image || undefined, photos: sale.image ? [sale.image] : undefined, status: 'CLOSED',
    } }
  }
  return { property: null, error }
}
