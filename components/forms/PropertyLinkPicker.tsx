'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Home, Loader2, Search, Trash2, Upload, X } from 'lucide-react'
import { LinkedProperty, SavedManualProperty } from '@/types'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'

const emptyManualDraft = { address: '', city: '', state: '', zipcode: '', price: '', beds: '', baths: '', sqft: '', image_url: '' }

export default function PropertyLinkPicker({ value, onChange }: { value: LinkedProperty | null; onChange: (property: LinkedProperty | null) => void }) {
  // No-MLS plans (both tiers) can't search Bright MLS at all - the address search is hidden and
  // the picker is just "type it in" + their own saved properties.
  const { user } = useAuth()
  const manualOnly = !hasMlsAccess(user?.plan_tier)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ address: string; lat: number; lng: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [error, setError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // No-MLS agents (and anyone else who just can't find a listing via search - off-market,
  // coming soon, out of area) have no Bright-backed search to fall back on. This lets them
  // attach a property to the form by typing its details directly, same manual-entry pattern
  // as Agent Hub's "Manually Add" recent sale.
  const [manualMode, setManualMode] = useState(false)
  const [manualDraft, setManualDraft] = useState(emptyManualDraft)
  const [manualPhotoUploading, setManualPhotoUploading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [saveForLater, setSaveForLater] = useState(true)
  const manualFileInputRef = useRef<HTMLInputElement>(null)

  // A personal library of properties typed in by hand before, so the same one can be reused
  // with a click instead of retyped every time. Saving here is only a convenience cache - it
  // never creates a real Open House Manager listing or an Agent Hub recent sale, the agent still
  // adds those deliberately on their own pages.
  const [savedProperties, setSavedProperties] = useState<SavedManualProperty[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(true)

  useEffect(() => {
    api.savedProperties.getAll().then(({ success, data }) => {
      if (success && data) setSavedProperties(data)
      setIsLoadingSaved(false)
    })
  }, [])

  // No-MLS: the homes they already typed in elsewhere - their Agent Hub listings + sales (Settings /
  // Agent Hub) and their open house kits - one tap away here, never retyped.
  type YourHome = LinkedProperty & { tag: 'Listing' | 'Sold' | 'Open house'; key: string }
  const [yourHomes, setYourHomes] = useState<YourHome[]>([])
  useEffect(() => {
    if (!manualOnly) return
    let alive = true
    Promise.all([api.agentHub.getMine().catch(() => null), api.openHouses.getAll().catch(() => null)]).then(([hub, oh]) => {
      if (!alive) return
      const cfg: Record<string, any> = (hub && hub.success && hub.data?.config) || {}
      const out: YourHome[] = []
      const seen = new Set<string>()
      const street = (a?: string | null) => String(a || '').split(',')[0].trim()
      const push = (p: LinkedProperty, tag: YourHome['tag']) => {
        const k = street(p.address).toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!k || seen.has(k)) return
        seen.add(k)
        out.push({ ...p, address: street(p.address), tag, key: `${tag}-${k}` })
      }
      for (const l of (Array.isArray(cfg.myListings) ? cfg.myListings : [])) {
        if (l?.source !== 'manual') continue
        push({ address: l.address, city: l.city, state: l.state, zipcode: l.zipcode, price: l.price, beds: l.beds, baths: l.baths, sqft: l.sqft, image_url: l.image, photos: l.photos, status: l.status }, 'Listing')
      }
      for (const s of (Array.isArray(cfg.recentSales) ? cfg.recentSales : [])) {
        if (s?.source !== 'manual') continue
        push({ address: s.address, city: s.city, state: s.state, zipcode: s.zipcode, price: s.price, close_price: s.price, close_date: s.sold_date, beds: s.beds, baths: s.baths, sqft: s.sqft, image_url: s.image, photos: s.photos, status: 'Sold' }, 'Sold')
      }
      for (const o of (oh && oh.success ? oh.data || [] : [])) {
        push({ address: o.address, city: o.city, state: o.state, zipcode: o.zipcode, price: o.price ?? o.ListPrice, beds: o.bedrooms, baths: o.bathrooms, sqft: o.livingArea, image_url: o.coverImageUrl || undefined }, 'Open house')
      }
      setYourHomes(out)
    })
    return () => { alive = false }
  }, [manualOnly])

  const updateManualDraft = (field: keyof typeof manualDraft, fieldValue: string) => {
    setManualDraft(current => ({ ...current, [field]: fieldValue }))
  }

  const handleSelectSaved = (saved: SavedManualProperty) => {
    onChange({
      address: saved.address,
      city: saved.city ?? undefined,
      state: saved.state ?? undefined,
      zipcode: saved.zipcode ?? undefined,
      price: saved.price ?? undefined,
      beds: saved.beds ?? undefined,
      baths: saved.baths ?? undefined,
      sqft: saved.sqft ?? undefined,
      image_url: saved.image_url ?? undefined,
    })
  }

  const handleDeleteSaved = async (event: React.MouseEvent, propertyId: string) => {
    event.stopPropagation()
    setSavedProperties(current => current.filter(p => p.id !== propertyId))
    await api.savedProperties.remove(propertyId)
  }

  const handleManualPhoto = async (file?: File) => {
    if (!file) return
    setManualPhotoUploading(true)
    setManualError('')
    const response = await api.studio.uploadMedia(file)
    if (response.success && response.data) {
      updateManualDraft('image_url', resolveMediaUrl(response.data.url))
    } else {
      setManualError(response.error || 'Unable to upload photo. Please try a JPG under 10MB.')
    }
    setManualPhotoUploading(false)
  }

  const saveManualProperty = () => {
    const address = manualDraft.address.trim()
    if (!address) return
    const property = {
      address,
      city: manualDraft.city.trim() || undefined,
      state: manualDraft.state.trim() || undefined,
      zipcode: manualDraft.zipcode.trim() || undefined,
      price: manualDraft.price ? Number(manualDraft.price.replace(/[^0-9.]/g, '')) : undefined,
      beds: manualDraft.beds ? Number(manualDraft.beds) : undefined,
      baths: manualDraft.baths ? Number(manualDraft.baths) : undefined,
      sqft: manualDraft.sqft ? Number(manualDraft.sqft.replace(/[^0-9.]/g, '')) : undefined,
      image_url: manualDraft.image_url || undefined,
    }
    onChange(property)

    // Just a personal library entry for reuse - never touches Open House Manager listings or
    // Agent Hub recent sales, which the agent still has to add deliberately on their own pages.
    if (saveForLater) {
      api.savedProperties.create(property).then(({ success, data }) => {
        if (success && data) setSavedProperties(current => [data, ...current])
      })
    }

    setManualDraft(emptyManualDraft)
    setManualMode(false)
    setManualError('')
    if (manualFileInputRef.current) manualFileInputRef.current.value = ''
  }

  const cancelManualEntry = () => {
    setManualMode(false)
    setManualDraft(emptyManualDraft)
    setManualError('')
    if (manualFileInputRef.current) manualFileInputRef.current.value = ''
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (manualOnly || trimmed.length < 3) {
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
  }, [query, manualOnly])

  const handleSelect = async (address: string) => {
    setShowSuggestions(false)
    setIsLookingUp(true)
    setError('')
    const { success, data, error: lookupError } = await api.properties.lookup(address)
    if (success && data) {
      onChange({
        listing_key: data.ListingKey || data.listing_key || undefined,
        address: data.FullStreetAddress || data.UnparsedAddress || address,
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
      })
      setQuery('')
    } else {
      setError(lookupError || 'Unable to load this property. Please try another address.')
    }
    setIsLookingUp(false)
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#151517]">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {value.image_url ? (
            <img src={value.image_url} alt={value.address} className="h-full w-full object-cover" />
          ) : (
            <Home className="h-6 w-6 text-gray-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-[#111827] dark:text-white">{value.address}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {value.price ? `$${Number(value.price).toLocaleString()}` : 'Price unavailable'}
            {value.beds ? ` · ${value.beds} bd` : ''}
            {value.baths ? ` · ${value.baths} ba` : ''}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove linked property" title="Remove linked property">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (manualMode) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
        className="rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-white to-[#fbf6ea] p-4 shadow-[0_14px_34px_-28px_rgba(139,115,85,.8)] dark:border-gray-700 dark:from-[#151517] dark:to-[#151517] sm:p-5">
        <p className="mb-0.5 flex items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white"><Home className="h-4 w-4 text-[#C9A24D]" /> The home&apos;s details</p>
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{manualOnly ? 'No Bright MLS needed - type it in once, reuse it anytime.' : 'Not on the MLS? Type it in once, reuse it anytime.'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Address</span>
            <input
              value={manualDraft.address}
              onChange={(event) => updateManualDraft('address', event.target.value)}
              placeholder="123 Main Street, Dover, PA 17315"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold shadow-sm transition focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">City</span>
            <input
              value={manualDraft.city}
              onChange={(event) => updateManualDraft('city', event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold shadow-sm transition focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">State</span>
            <input
              value={manualDraft.state}
              onChange={(event) => updateManualDraft('state', event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold shadow-sm transition focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Price</span>
            <input
              inputMode="decimal"
              value={manualDraft.price ? `$${Number(manualDraft.price).toLocaleString()}` : ''}
              onChange={(event) => updateManualDraft('price', event.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="$500,000"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold shadow-sm transition focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Sqft</span>
            <input
              inputMode="numeric"
              value={manualDraft.sqft}
              onChange={(event) => updateManualDraft('sqft', event.target.value.replace(/[^0-9.]/g, ''))}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold shadow-sm transition focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          {/* Beds / baths: one tap, no keyboard (same chips as the open house kit's Home details). */}
          {([['beds', 'Beds', ['1', '2', '3', '4', '5', '6']], ['baths', 'Baths', ['1', '1.5', '2', '2.5', '3', '3.5', '4', '5']]] as const).map(([field, label, opts]) => (
            <div key={field} className="sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
              <div className={`mt-2 grid gap-1.5 ${opts.length > 6 ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-6'}`}>
                {opts.map(o => {
                  const on = manualDraft[field] === o
                  return (
                    <button key={o} type="button" onClick={() => updateManualDraft(field, on ? '' : o)}
                      className={`h-11 rounded-xl border text-sm font-black transition active:scale-95 ${on ? 'border-[#111827] bg-[#111827] text-white shadow-md dark:border-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]' : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
                      {o === opts[opts.length - 1] ? `${o}+` : o}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <label className="block cursor-pointer sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Photo</span>
            <div className={`mt-2 flex items-center rounded-xl border border-dashed border-[#C9A24D]/45 bg-[#C9A24D]/[0.04] p-3 transition hover:border-[#C9A24D] dark:bg-white/[0.03] ${manualDraft.image_url ? 'gap-4' : 'gap-3'}`}>
              {manualDraft.image_url
                ? <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${manualDraft.image_url})` }} />
                : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#111827] text-[#e8c97a]">{manualPhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>}
              <input
                ref={manualFileInputRef}
                type="file"
                accept="image/jpeg"
                disabled={manualPhotoUploading}
                onChange={(event) => handleManualPhoto(event.target.files?.[0])}
                className="hidden"
              />
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#111827] dark:text-white">{manualPhotoUploading ? 'Uploading...' : manualDraft.image_url ? 'Replace photo' : 'Add a photo'}</span>
                <span className="block text-xs font-semibold text-gray-400">JPG - it fills the design</span>
              </span>
            </div>
          </label>
        </div>
        {manualError && <p className="mt-3 text-sm font-bold text-red-600">{manualError}</p>}
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={saveForLater}
            onChange={(event) => setSaveForLater(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#C9A24D] focus:ring-[#C9A24D]"
          />
          Save to my properties so I can reuse it without retyping
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveManualProperty}
            disabled={!manualDraft.address.trim() || manualPhotoUploading}
            className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            Attach Property
          </button>
          <button
            type="button"
            onClick={cancelManualEntry}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      {manualOnly ? (
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/5 px-4 py-3.5 text-sm font-black text-[#8b7355] transition-colors hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
        >
          <Home className="h-4 w-4" /> Enter the property details
        </button>
      ) : (
      <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search a property address..."
          disabled={isLookingUp}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-9 font-semibold outline-none focus:border-[#C9A24D] disabled:opacity-60 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
        />
        {(isSearching || isLookingUp) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-[#151517]">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelect(suggestion.address)}
              className="block w-full border-b border-gray-50 px-4 py-3 text-left text-sm font-semibold last:border-0 hover:bg-[#fbfaf7] dark:border-gray-800 dark:hover:bg-[#1A1A1C]"
            >
              {suggestion.address}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => { setManualMode(true); setShowSuggestions(false) }}
        className="mt-2 text-xs font-bold text-[#8b7355] underline decoration-dotted underline-offset-2 hover:text-[#111827] dark:hover:text-white"
      >
        Can't find it? Enter it manually instead
      </button>
      </>
      )}

      {manualOnly && yourHomes.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-400">
            <Home className="h-3.5 w-3.5" /> Your homes
          </p>
          <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {yourHomes.map((home, i) => (
              <motion.button key={home.key} type="button" onClick={() => { const { tag: _tag, key: _key, ...p } = home; onChange(p) }}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-[#C9A24D] active:scale-[0.99] dark:border-gray-700 dark:bg-[#151517]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  {home.image_url ? <img src={home.image_url} alt="" className="h-full w-full object-cover" /> : <Home className="h-4 w-4 text-gray-300" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#111827] dark:text-white">{home.address}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wider ${home.tag === 'Sold' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]'}`}>{home.tag}</span>
                    {home.price ? `$${Number(home.price).toLocaleString()}` : ''}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {!isLoadingSaved && savedProperties.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-400">
            <Bookmark className="h-3.5 w-3.5" /> Previously Entered
          </p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {savedProperties.map((saved) => (
              <button
                key={saved.id}
                type="button"
                onClick={() => handleSelectSaved(saved)}
                className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 text-left transition-colors hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  {saved.image_url ? (
                    <img src={saved.image_url} alt={saved.address} className="h-full w-full object-cover" />
                  ) : (
                    <Home className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{saved.address}</p>
                  {saved.price != null && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">${Number(saved.price).toLocaleString()}</p>}
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => handleDeleteSaved(event, saved.id)}
                  className="shrink-0 rounded-lg p-2 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label="Remove from saved properties"
                  title="Remove from saved properties"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
