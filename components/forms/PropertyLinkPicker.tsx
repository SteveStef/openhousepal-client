'use client'

import { useEffect, useRef, useState } from 'react'
import { Home, Loader2, Search, X } from 'lucide-react'
import { LinkedProperty } from '@/types'
import api from '@/lib/api-service'

export default function PropertyLinkPicker({ value, onChange }: { value: LinkedProperty | null; onChange: (property: LinkedProperty | null) => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ address: string; lat: number; lng: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [error, setError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  return (
    <div ref={wrapRef} className="relative">
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
    </div>
  )
}
