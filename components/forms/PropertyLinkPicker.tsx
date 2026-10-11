'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, Home, Loader2, Search, Trash2, X } from 'lucide-react'
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
      <div className="rounded-xl border border-[#C9A24D]/30 bg-white p-4 dark:border-gray-700 dark:bg-[#151517]">
        <p className="mb-3 text-sm font-black text-[#111827] dark:text-white">Enter property manually</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Address</span>
            <input
              value={manualDraft.address}
              onChange={(event) => updateManualDraft('address', event.target.value)}
              placeholder="123 Main Street, Dover, PA 17315"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">City</span>
            <input
              value={manualDraft.city}
              onChange={(event) => updateManualDraft('city', event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">State</span>
            <input
              value={manualDraft.state}
              onChange={(event) => updateManualDraft('state', event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Price</span>
            <input
              inputMode="decimal"
              value={manualDraft.price}
              onChange={(event) => updateManualDraft('price', event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="500,000"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Sqft</span>
            <input
              inputMode="numeric"
              value={manualDraft.sqft}
              onChange={(event) => updateManualDraft('sqft', event.target.value.replace(/[^0-9.]/g, ''))}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Beds</span>
            <input
              inputMode="decimal"
              value={manualDraft.beds}
              onChange={(event) => updateManualDraft('beds', event.target.value.replace(/[^0-9.]/g, ''))}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Baths</span>
            <input
              inputMode="decimal"
              value={manualDraft.baths}
              onChange={(event) => updateManualDraft('baths', event.target.value.replace(/[^0-9.]/g, ''))}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Photo</span>
            <div className="mt-2 flex items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cover bg-center bg-gray-100 dark:bg-gray-900" style={{ backgroundImage: manualDraft.image_url ? `url(${manualDraft.image_url})` : 'none' }} />
              <input
                ref={manualFileInputRef}
                type="file"
                accept="image/jpeg"
                disabled={manualPhotoUploading}
                onChange={(event) => handleManualPhoto(event.target.files?.[0])}
                className="block w-full text-sm font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white disabled:opacity-60"
              />
            </div>
            {manualPhotoUploading && <p className="mt-1 text-xs font-semibold text-gray-400">Uploading photo...</p>}
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
      </div>
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
                  className="shrink-0 rounded-lg p-2 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
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
