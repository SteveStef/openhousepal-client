'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, Loader2, Search, ArrowRight } from 'lucide-react'
import api from '@/lib/api-service'
import { MyListingItem } from '@/types'
import { normalizeImageUrl } from '@/lib/utils'
import { formatMoney } from '@/lib/cma'
import MoneyInput from '@/components/MoneyInput'

export interface ManualPropertyInput {
  street_address: string
  city: string
  state: string
  zipcode: string
  list_price: number | null
  annual_taxes: number | null
}

const emptyManualInput: ManualPropertyInput = { street_address: '', city: '', state: '', zipcode: '', list_price: null, annual_taxes: null }

function SegmentedControl<T extends string>({ options, value, onChange, embedded }: { options: { value: T, label: string }[], value: T, onChange: (v: T) => void, embedded?: boolean }) {
  if (embedded) {
    // Fills the narrow editor column: equal thirds, the chosen one in a sliding pill.
    return (
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative min-w-0 rounded-lg px-1 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
              value === opt.value ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {value === opt.value && <motion.span layoutId="psp-mode" className="absolute inset-0 rounded-lg bg-[#111827] shadow-sm dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative block truncate">{opt.label}</span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-[#151517]">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
            value === opt.value ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Reusable "select a property" flow shared by the Financial Tools (Seller Net Sheet, Buyer Cash
// Needed) and the Showcase editor's compare home - search the OpenHousePal database (never live
// MLS), pick one of the agent's own listings, or enter manually. Generic over T so each tool maps
// the raw record into its own property-snapshot shape.
// `embedded` = sits inside a narrow card (the Showcase editor column): full-width tabs, results in
// the flow instead of a floating dropdown (the card clips overflow), and "Type it in" FINDS that
// home in our records (the match % has to score against a real home) instead of taking free-form
// details.
export default function PropertySearchPicker({ onSelectFromLookup, onSelectFromListing, onManual, embedded = false }: {
  onSelectFromLookup: (raw: any) => void
  onSelectFromListing: (listing: MyListingItem) => void
  onManual?: (data: ManualPropertyInput) => void
  embedded?: boolean
}) {
  const [mode, setMode] = useState<'search' | 'mine' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [myListings, setMyListings] = useState<MyListingItem[] | null>(null)
  const [manual, setManual] = useState<ManualPropertyInput>(emptyManualInput)
  const [findError, setFindError] = useState('')

  useEffect(() => {
    if (mode !== 'mine' || myListings !== null) return
    api.openHouseManager.getMyListings().then(r => {
      setMyListings(r.success && r.data ? r.data.listings : [])
    })
  }, [mode, myListings])

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 4) { setSuggestions([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      api.properties.address(query.trim()).then(r => {
        if (cancelled) return
        if (r.success && r.data) setSuggestions(r.data.results || [])
        setSearching(false)
      })
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, mode])

  const selectAddress = async (address: string) => {
    setSearching(true)
    const response = await api.properties.lookup(address)
    setSearching(false)
    if (response.success && response.data) {
      onSelectFromLookup(response.data)
      setSuggestions([])
      setQuery('')
    }
  }

  // Embedded "Type it in": find the typed address in our records.
  const findTyped = async () => {
    const street = manual.street_address.trim()
    if (!street) return
    const full = [street, manual.city.trim(), [manual.state.trim(), manual.zipcode.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    setFindError('')
    setSearching(true)
    const response = await api.properties.lookup(full)
    setSearching(false)
    if (response.success && response.data) {
      onSelectFromLookup(response.data)
      setManual(emptyManualInput)
    } else {
      setFindError("We couldn't find that home in the MLS records. Check the street and ZIP, or try Search.")
    }
  }

  const listingButton = (listing: MyListingItem, k: number) => (
    <motion.button
      key={listing.listing_key}
      type="button"
      onClick={() => onSelectFromListing(listing)}
      initial={embedded ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(k, 8) * 0.04 } }}
      whileHover={embedded ? { x: 3 } : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border text-left transition ${embedded ? 'border-transparent bg-white p-2 hover:border-[#C9A24D]/40 dark:bg-[#151517]' : 'border-gray-100 p-2.5 hover:border-[#C9A24D]/40 dark:border-gray-800'}`}
    >
      {listing.image ? <img src={normalizeImageUrl(listing.image || undefined)} alt="" className={`${embedded ? 'h-10 w-10' : 'h-12 w-14'} shrink-0 rounded-lg object-cover`} /> : <div className={`flex ${embedded ? 'h-10 w-10' : 'h-12 w-14'} shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800`}><Home className="h-4 w-4 text-gray-300" /></div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{listing.address}</p>
        <p className="truncate text-xs font-semibold text-gray-400">{listing.price ? formatMoney(listing.price) : ''} {listing.bedrooms ? `· ${listing.bedrooms} bd` : ''} {listing.bathrooms ? `· ${listing.bathrooms} ba` : ''}</p>
      </div>
    </motion.button>
  )

  if (embedded) {
    const field = 'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#151517] dark:text-white'
    return (
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-[#FAFAF7] p-3 dark:border-white/[0.07] dark:bg-[#0B0B0B]">
        <p className="text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Any home in the MLS records works, sold ones too.</p>
        <SegmentedControl
          embedded
          options={[{ value: 'search', label: 'Search' }, { value: 'mine', label: 'My listings' }, { value: 'manual', label: 'Type it in' }]}
          value={mode}
          onChange={(m) => { setMode(m); setFindError('') }}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            {mode === 'search' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Start typing an address..." className={`${field} pl-9 pr-9`} />
                  {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#C9A24D]" />}
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={`${s.address}-${i}`}
                        type="button"
                        onClick={() => selectAddress(s.address)}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0 }}
                        whileHover={{ x: 3 }}
                        className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-white p-2 text-left transition-colors hover:border-[#C9A24D]/40 dark:bg-[#151517]"
                      >
                        {s.image ? <img src={normalizeImageUrl(s.image || undefined)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{s.address}</p>
                          {s.price && <p className="text-xs font-semibold text-gray-400">{formatMoney(s.price)}</p>}
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {query.trim().length >= 4 && !searching && suggestions.length === 0 && (
                    <p className="px-1 py-2 text-xs font-semibold text-gray-400">No homes found for that address.</p>
                  )}
                </div>
              </div>
            )}

            {mode === 'mine' && (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {myListings === null
                  ? <p className="flex items-center justify-center gap-2 py-6 text-xs font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> Loading your listings</p>
                  : myListings.length === 0
                    ? <p className="py-6 text-center text-sm font-semibold text-gray-400">No active listings found.</p>
                    : myListings.map(listingButton)}
              </div>
            )}

            {mode === 'manual' && (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); findTyped() }}>
                <input autoFocus value={manual.street_address} onChange={e => setManual(m => ({ ...m, street_address: e.target.value }))} placeholder="Street address" aria-label="Street address" className={field} />
                <div className="grid grid-cols-[minmax(0,1fr)_56px_76px] gap-2">
                  <input value={manual.city} onChange={e => setManual(m => ({ ...m, city: e.target.value }))} placeholder="City" aria-label="City" className={field} />
                  <input value={manual.state} onChange={e => setManual(m => ({ ...m, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="PA" aria-label="State" className={`${field} px-2 text-center`} />
                  <input value={manual.zipcode} inputMode="numeric" onChange={e => setManual(m => ({ ...m, zipcode: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) }))} placeholder="ZIP" aria-label="ZIP" className={`${field} px-2 text-center`} />
                </div>
                <AnimatePresence>
                  {findError && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">{findError}</motion.p>
                  )}
                </AnimatePresence>
                <motion.button type="submit" disabled={!manual.street_address.trim() || searching} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                  {searching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding</> : <>Find this home <ArrowRight className="h-3.5 w-3.5" /></>}
                </motion.button>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <p className="text-sm font-black text-[#111827] dark:text-white">Select Property</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-400">Search your OpenHousePal database, pick one of your listings, or enter it manually.</p>

      <div className="mt-3">
        <SegmentedControl
          options={[{ value: 'search', label: 'Search Address' }, { value: 'mine', label: 'My Listings' }, { value: 'manual', label: 'Enter Manually' }]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'search' && (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Start typing an address..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
          {suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-[#151517]">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => selectAddress(s.address)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-[#C9A24D]/10 dark:border-gray-800"
                >
                  {s.image ? <img src={normalizeImageUrl(s.image || undefined)} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{s.address}</p>
                    {s.price && <p className="text-xs font-semibold text-gray-400">{formatMoney(s.price)}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'mine' && (
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {myListings !== null && myListings.length === 0 && <p className="py-6 text-center text-sm font-semibold text-gray-400">No active listings found.</p>}
          {myListings === null && <p className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading</p>}
          {(myListings || []).map(listingButton)}
        </div>
      )}

      {mode === 'manual' && (
        <div className="mt-4 space-y-3">
          <div>
            <label className={manualLabelClass}>Street Address</label>
            <input value={manual.street_address} onChange={e => setManual(m => ({ ...m, street_address: e.target.value }))} placeholder="123 Main St" className={manualFieldClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={manualLabelClass}>City</label><input value={manual.city} onChange={e => setManual(m => ({ ...m, city: e.target.value }))} className={manualFieldClass} /></div>
            <div><label className={manualLabelClass}>State</label><input value={manual.state} onChange={e => setManual(m => ({ ...m, state: e.target.value }))} placeholder="PA" className={manualFieldClass} /></div>
            <div><label className={manualLabelClass}>Zip</label><input value={manual.zipcode} onChange={e => setManual(m => ({ ...m, zipcode: e.target.value }))} className={manualFieldClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={manualLabelClass}>Price</label><MoneyInput value={manual.list_price} onChange={v => setManual(m => ({ ...m, list_price: v }))} /></div>
            <div><label className={manualLabelClass}>Annual Taxes</label><MoneyInput value={manual.annual_taxes} onChange={v => setManual(m => ({ ...m, annual_taxes: v }))} /></div>
          </div>
          <button
            onClick={() => onManual?.(manual)}
            disabled={!manual.street_address.trim()}
            className="w-full rounded-xl bg-[#111827] px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#111827]"
          >
            Use This Property
          </button>
        </div>
      )}
    </div>
  )
}

const manualFieldClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
const manualLabelClass = "mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
