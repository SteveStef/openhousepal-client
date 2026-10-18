'use client'

// Explore Nearby's data, shared by every place it shows (IDX property + town pages, Spotlight's
// map). The browser never calls Google Places itself: every lookup goes through /api/website-nearby
// -> our backend -> Google, so the backend's daily/monthly Places limits and the platform spend
// brake (usage_budget_service) gate it. Two stages, both only on a tap: a category's places (minimal
// fields), then one place's rating when the visitor picks it.
import { useCallback, useEffect, useState } from 'react'
import { Coffee, HeartPulse, ShoppingBag, ShoppingBasket, Trees, Utensils, type LucideIcon } from 'lucide-react'

export type NearbyKind = 'area' | 'property' | 'property_site'

export interface NearbyPlace {
  place_id: string
  name: string
  category: string
  address?: string | null
  rating?: number | null
  review_count?: number | null
  distance_miles?: number | null
  latitude: number
  longitude: number
}

interface NearbyResult {
  available: boolean
  category: string
  origin: { lat: number; lng: number }
  radius_miles: number
  places: NearbyPlace[]
}

export interface PlaceDetails { place_id: string; rating?: number | null; review_count?: number | null }

export const NEARBY_CATEGORIES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'restaurants', label: 'Restaurants', icon: Utensils },
  { key: 'coffee', label: 'Coffee', icon: Coffee },
  { key: 'grocery', label: 'Grocery', icon: ShoppingBasket },
  { key: 'parks', label: 'Parks', icon: Trees },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'medical', label: 'Medical', icon: HeartPulse },
]

const TIMEOUT_MS = 12000

function friendlyError(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : null
  if (status === 429) return text || 'Nearby places have reached their limit for now. Please try again later.'
  if (status === 422) return text || 'This category is unavailable right now.'
  if (status === 503) return 'Nearby places are temporarily unavailable.'
  return 'Nearby places are unavailable right now.'
}

export const milesText = (d?: number | null) => (d == null ? null : `${d.toFixed(d < 1 ? 1 : 0)} mi`)

export default function useNearby({ siteId, kind, slug, listingKey, enabled = true }: {
  siteId: string
  kind: NearbyKind
  slug?: string
  listingKey?: string
  enabled?: boolean
}) {
  // null = still checking (render nothing yet, rather than flash the chips then hide them)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, NearbyResult>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  // undefined = not asked yet, null = asked and nothing came back
  const [details, setDetails] = useState<Record<string, PlaceDetails | null>>({})
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null)

  // The month's Places budget spent = the whole feature hides (a read-only check, no Google call).
  useEffect(() => {
    if (!enabled || !siteId) return
    let cancelled = false
    const k = kind === 'property_site' ? 'property_site_availability' : 'availability'
    fetch(`/api/website-nearby?site_id=${encodeURIComponent(siteId)}&kind=${k}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(b => { if (!cancelled) setAvailable(b?.available !== false) })
      .catch(() => { if (!cancelled) setAvailable(true) }) // a hiccup here shouldn't hide the feature
    return () => { cancelled = true }
  }, [siteId, kind, enabled])

  const select = useCallback(async (category: string | null) => {
    setActive(category)
    setError(null)
    setSelected(null)
    if (!category || results[category]) return
    setLoading(category)
    const ctl = new AbortController()
    const t = window.setTimeout(() => ctl.abort(), TIMEOUT_MS)
    try {
      const qs = new URLSearchParams({ site_id: siteId, kind, category })
      if (kind === 'area' && slug) qs.set('slug', slug)
      if (kind === 'property' && listingKey) qs.set('listing_key', listingKey)
      const res = await fetch(`/api/website-nearby?${qs}`, { signal: ctl.signal })
      const body = await res.json().catch(() => null)
      if (!res.ok) setError(friendlyError(res.status, body?.detail))
      else setResults(prev => ({ ...prev, [category]: body as NearbyResult }))
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'That took too long - tap the category again.' : 'Nearby places are unavailable right now.')
    } finally {
      window.clearTimeout(t)
      setLoading(cur => (cur === category ? null : cur))
    }
  }, [results, siteId, kind, slug, listingKey])

  const selectPlace = useCallback(async (placeId: string | null) => {
    setSelected(placeId)
    if (!placeId || details[placeId] !== undefined) return
    setLoadingDetails(placeId)
    try {
      const k = kind === 'property_site' ? 'property_site_place_details' : 'place_details'
      const res = await fetch(`/api/website-nearby?${new URLSearchParams({ site_id: siteId, kind: k, place_id: placeId })}`)
      const body = await res.json().catch(() => null)
      setDetails(prev => ({ ...prev, [placeId]: res.ok ? (body as PlaceDetails) : null }))
    } catch {
      setDetails(prev => ({ ...prev, [placeId]: null }))
    } finally {
      setLoadingDetails(cur => (cur === placeId ? null : cur))
    }
  }, [details, siteId, kind])

  const places = active ? results[active]?.places || null : null
  return { available, active, select, places, loading, error, selected, selectPlace, details, loadingDetails }
}

export type Nearby = ReturnType<typeof useNearby>
