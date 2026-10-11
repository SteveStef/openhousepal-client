'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Coffee, HeartPulse, Loader2, MapPin, ShoppingBag, ShoppingBasket, Trees, Utensils } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { SiteTheme } from './types'

// Two-stage, backend-controlled Explore Nearby - the browser NEVER calls Google Places directly.
// Every paid Places lookup goes browser -> /api/website-nearby (this Next.js route, proxying to
// our FastAPI backend's /public/sites/.../nearby and /places/{id}/details) -> Google, so the
// existing DB-backed daily/monthly Places Search & Details limits and the platform-wide $100/day
// / $200/month emergency brake (usage_budget_service.py) actually gate this traffic. An earlier
// version of this component used Google's native Places UI Kit web components
// (<gmp-place-search> etc.), which call Google straight from the browser with zero visibility on
// our side - a bot or a traffic spike could run up real Google spend while our own usage
// counters still read zero. Deliberately not using Places UI Kit here for that reason; the only
// Google JS API surface this file still touches is the plain (non-Places) Maps JavaScript API,
// for rendering pins on the results map - see PropertyLocationMap.tsx for the same pattern.
type NearbyKind = 'area' | 'property' | 'property_site'

interface ExploreOrigin {
  lat: number
  lng: number
}

// Mirrors backend/app/models/property.py's ExploreNearbyPlace/ExploreNearbyResponse exactly -
// Stage 1 (nearby search) never populates rating/review_count (a deliberately minimal field
// mask server-side - see nearby_amenities_service.EXPLORE_NEARBY_FIELD_MASK); those only arrive
// from Stage 2 below, once a visitor actually selects one place.
interface NearbyPlace {
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
  origin: ExploreOrigin
  radius_miles: number
  places: NearbyPlace[]
  cache_hit?: boolean
  sku?: string
}

// Mirrors backend/app/models/property.py's ExploreNearbyPlaceDetails.
interface PlaceDetails {
  place_id: string
  rating?: number | null
  review_count?: number | null
  cache_hit?: boolean
}

const CATEGORIES = [
  { key: 'restaurants', label: 'Restaurants', icon: Utensils },
  { key: 'coffee', label: 'Coffee', icon: Coffee },
  { key: 'grocery', label: 'Grocery', icon: ShoppingBasket },
  { key: 'parks', label: 'Parks', icon: Trees },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'medical', label: 'Medical', icon: HeartPulse },
]

const REQUEST_TIMEOUT_MS = 12000

const escapeHtml = (value?: string | null) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

function friendlyErrorFor(status: number, detail: unknown): string {
  const detailText = typeof detail === 'string' ? detail : null
  if (status === 429) return detailText || 'Nearby places have reached their usage limit for now. Please try again later.'
  if (status === 422) return detailText || 'This category is unavailable right now.'
  if (status === 503) return 'Nearby places are temporarily unavailable.'
  if (status === 502) return 'Nearby places lookup failed. Please try again.'
  return 'Nearby places are unavailable right now.'
}

export default function ExploreNearby({
  siteId,
  kind,
  slug,
  listingKey,
  title,
  originLabel,
  origin,
  theme,
  variant = 'light',
  embedded = false,
}: {
  siteId: string
  kind: NearbyKind
  slug?: string
  listingKey?: string
  title: string
  originLabel: string
  origin?: ExploreOrigin | null
  theme: SiteTheme
  // 'dark' for dark page templates (Spotlight's Cinematic Luxury) - same content, dark surfaces.
  variant?: 'light' | 'dark'
  /** Inside a page section that already sets the width and padding (the town page). */
  embedded?: boolean
}) {
  const dark = variant === 'dark'
  // null = still checking, so nothing renders yet rather than flashing the section then hiding it.
  const [available, setAvailable] = useState<boolean | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [resultsByCategory, setResultsByCategory] = useState<Record<string, NearbyResult>>({})
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  // undefined = not yet requested, null = requested but failed/no data, object = loaded.
  const [placeDetailsByPlace, setPlaceDetailsByPlace] = useState<Record<string, PlaceDetails | null>>({})
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  const activeResult = active ? resultsByCategory[active] : null
  const activeCategory = useMemo(() => CATEGORIES.find(c => c.key === active) || null, [active])
  const activeLabel = activeCategory?.label || 'Nearby'
  const selectedPlace = useMemo(
    () => activeResult?.places.find(place => place.place_id === selectedPlaceId) || null,
    [activeResult, selectedPlaceId],
  )
  const selectedPlaceDetails = selectedPlaceId ? placeDetailsByPlace[selectedPlaceId] : undefined
  const isLoadingSelectedDetails = loadingDetailsFor === selectedPlaceId

  // Proactively hides the whole section once the monthly Places Search budget is exhausted, rather
  // than only finding out after a visitor clicks a category and gets an error. Read-only check, no
  // Google call, no budget reservation - see is_explore_nearby_available on the backend. Naturally
  // comes back on its own once the monthly period rolls over, since that check reads the current
  // month's counter fresh on every page load.
  useEffect(() => {
    let cancelled = false
    const availabilityKind = kind === 'property_site' ? 'property_site_availability' : 'availability'
    fetch(`/api/website-nearby?site_id=${encodeURIComponent(siteId)}&kind=${availabilityKind}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(body => { if (!cancelled) setAvailable(body?.available !== false) })
      .catch(() => { if (!cancelled) setAvailable(true) }) // fail open - an availability-check hiccup shouldn't hide the feature
    return () => { cancelled = true }
  }, [siteId, kind])

  // Stage 1: browser -> /api/website-nearby -> backend Places Nearby Search (minimal fields) ->
  // our DB-backed cost guard -> results. Only fires on an explicit category click, never on load.
  async function fetchNearby(category: string): Promise<{ response?: NearbyResult; errorMessage?: string }> {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const qs = new URLSearchParams({ site_id: siteId, kind, category })
      if (kind === 'area' && slug) qs.set('slug', slug)
      if (kind === 'property' && listingKey) qs.set('listing_key', listingKey)

      const res = await fetch(`/api/website-nearby?${qs.toString()}`, { signal: controller.signal })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { errorMessage: friendlyErrorFor(res.status, body?.detail) }
      return { response: body as NearbyResult }
    } catch (err: any) {
      if (err?.name === 'AbortError') return { errorMessage: 'Nearby places took too long to load. Please try that category again.' }
      return { errorMessage: 'Nearby places are unavailable right now.' }
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  async function selectCategory(category: string) {
    setActive(category)
    setError(null)
    setSelectedPlaceId(null)
    if (resultsByCategory[category]) return
    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
      setError('Nearby places are unavailable because this page does not have a usable map center yet.')
      return
    }
    setLoadingCategory(category)
    const { response, errorMessage } = await fetchNearby(category)
    setLoadingCategory(current => (current === category ? null : current))
    if (errorMessage) {
      setError(errorMessage)
      return
    }
    if (response) {
      setResultsByCategory(prev => ({ ...prev, [category]: response }))
    }
  }

  // Stage 2: browser -> /api/website-nearby -> backend Place Details (rating/review count only) ->
  // our DB-backed cost guard -> details. Only fires when a visitor selects one specific place -
  // never for every result in a list, and never on page load.
  async function selectPlace(placeId: string) {
    setSelectedPlaceId(placeId)
    if (placeDetailsByPlace[placeId] !== undefined) return
    setLoadingDetailsFor(placeId)
    try {
      const detailsKind = kind === 'property_site' ? 'property_site_place_details' : 'place_details'
      const qs = new URLSearchParams({ site_id: siteId, kind: detailsKind, place_id: placeId })
      const res = await fetch(`/api/website-nearby?${qs.toString()}`)
      const body = await res.json().catch(() => null)
      setPlaceDetailsByPlace(prev => ({ ...prev, [placeId]: res.ok ? (body as PlaceDetails) : null }))
    } catch {
      setPlaceDetailsByPlace(prev => ({ ...prev, [placeId]: null }))
    } finally {
      setLoadingDetailsFor(current => (current === placeId ? null : current))
    }
  }

  // Results map - plain Maps JavaScript API only (Map/Marker/InfoWindow), no Places library and
  // no Places calls of any kind. Markers are drawn from Stage 1's already-fetched results; the
  // InfoWindow's rating/review line is filled in (or shown loading) from Stage 2's cache once the
  // visitor selects a place - see the effect below re-running when that cache updates.
  useEffect(() => {
    if (!activeResult || !mapDivRef.current || !activeResult.places.length) return
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !mapDivRef.current) return
      const originPoint = { lat: activeResult.origin.lat, lng: activeResult.origin.lng }
      const map = new google.maps.Map(mapDivRef.current, {
        center: originPoint,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        zoomControl: true,
      })
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(originPoint)
      new google.maps.Marker({
        map,
        position: originPoint,
        title: originLabel,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: theme.secondary_color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      let selectedMarker: google.maps.Marker | null = null
      activeResult.places.forEach((place, index) => {
        const position = { lat: place.latitude, lng: place.longitude }
        bounds.extend(position)
        const isSelected = place.place_id === selectedPlaceId
        const marker = new google.maps.Marker({
          map,
          position,
          title: place.name,
          label: { text: String(index + 1), color: '#ffffff', fontSize: '11px', fontWeight: '700' },
          zIndex: isSelected ? 1000 : undefined,
          icon: isSelected ? {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: theme.secondary_color,
            fillOpacity: 1,
            strokeColor: theme.primary_color,
            strokeWeight: 4,
          } : undefined,
        })
        marker.addListener('click', () => selectPlace(place.place_id))
        if (isSelected) selectedMarker = marker
      })
      map.fitBounds(bounds, 44)
      if (selectedPlace && selectedMarker) {
        const details = placeDetailsByPlace[selectedPlace.place_id]
        const ratingLine = isLoadingSelectedDetails
          ? '<div style="margin-top:6px;color:#9ca3af;font-size:11px;">Loading details…</div>'
          : details?.rating != null
            ? `<div style="margin-top:6px;color:#374151;font-size:12px;font-weight:700;">★ ${details.rating.toFixed(1)}${details.review_count != null ? ` (${details.review_count})` : ''}</div>`
            : ''
        new google.maps.InfoWindow({
          content: `
            <div style="max-width:230px;padding:2px 0 4px;font-family:Inter,Arial,sans-serif;color:#111827;">
              <div style="font-weight:900;font-size:14px;line-height:1.2;">${escapeHtml(selectedPlace.name)}</div>
              <div style="margin-top:4px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml([selectedPlace.category, selectedPlace.distance_miles != null ? `${selectedPlace.distance_miles.toFixed(selectedPlace.distance_miles < 1 ? 1 : 0)} mi` : null].filter(Boolean).join(' - '))}</div>
              ${ratingLine}
              ${selectedPlace.address ? `<div style="margin-top:6px;color:#6b7280;font-size:12px;line-height:1.35;">${escapeHtml(selectedPlace.address)}</div>` : ''}
            </div>
          `,
        }).open({ map, anchor: selectedMarker })
      }
    }).catch(() => { if (!cancelled) setMapError(true) })
    return () => { cancelled = true }
  }, [activeResult, originLabel, selectedPlace, selectedPlaceId, placeDetailsByPlace, isLoadingSelectedDetails, theme.primary_color, theme.secondary_color])

  if (!available) return null

  return (
    <section id="explore-nearby" className={embedded ? '' : 'mx-auto max-w-6xl px-6 pb-14'}>
      <div className={`rounded-[1.25rem] border p-5 shadow-sm sm:p-7 ${dark ? 'border-white/10 bg-[#111111]' : 'border-gray-100 bg-white'}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: theme.secondary_color }}>Explore Nearby</p>
            <h2 className="ohp-site-heading mt-2 text-2xl font-black sm:text-3xl" style={{ color: dark ? '#ffffff' : 'var(--site-heading)' }}>{title}</h2>
            <p className={`mt-2 text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>Restaurants, coffee, parks and everyday essentials near {originLabel}.</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const selected = active === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectCategory(key)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition hover:-translate-y-0.5"
                style={dark ? {
                  borderColor: selected ? theme.secondary_color : 'rgba(255,255,255,0.14)',
                  backgroundColor: selected ? theme.secondary_color : 'transparent',
                  color: selected ? '#111111' : 'rgba(255,255,255,0.75)',
                } : {
                  borderColor: selected ? theme.primary_color : '#e5e7eb',
                  backgroundColor: selected ? theme.primary_color : '#ffffff',
                  color: selected ? '#ffffff' : '#4b5563',
                }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            )
          })}
        </div>

        {!active && (
          <div className={`mt-6 rounded-2xl p-6 text-sm ${dark ? 'bg-white/[0.04] text-white/55' : 'bg-gray-50 text-gray-500'}`}>
            Pick a category to see what&apos;s nearby, with distances from the home.
          </div>
        )}

        {loadingCategory && (
          <div className={`mt-6 flex items-center gap-2 rounded-2xl p-6 text-sm font-semibold ${dark ? 'bg-white/[0.04] text-white/60' : 'bg-gray-50 text-gray-500'}`}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {activeLabel.toLowerCase()}...
          </div>
        )}

        {error && <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error}</div>}

        {activeResult && !loadingCategory && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className={`h-[360px] overflow-hidden rounded-2xl border ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-gray-100 bg-gray-50'}`}>
              {mapError ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">Map unavailable right now.</div>
              ) : activeResult.places.length > 0 ? (
                <div ref={mapDivRef} className="h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No nearby places found for this category.</div>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1">
              <div className="space-y-3">
                {activeResult.places.map((place, index) => {
                  const selected = selectedPlaceId === place.place_id
                  return (
                    <button
                      key={place.place_id}
                      type="button"
                      onClick={() => selectPlace(place.place_id)}
                      className={`block w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${dark ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'bg-gray-50/70 hover:bg-white'}`}
                      style={{ borderColor: selected ? theme.secondary_color : dark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ backgroundColor: dark ? theme.secondary_color : theme.primary_color, color: dark ? '#111111' : '#ffffff' }}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-black ${dark ? 'text-white' : 'text-gray-800'}`}>{place.name}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                            {[place.category, place.distance_miles != null ? `${place.distance_miles.toFixed(place.distance_miles < 1 ? 1 : 0)} mi` : null].filter(Boolean).join(' - ')}
                          </p>
                          {place.address && <p className={`mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed ${dark ? 'text-white/55' : 'text-gray-500'}`}><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{place.address}</p>}
                          <p className="mt-2 text-xs font-black uppercase tracking-wide" style={{ color: theme.secondary_color }}>
                            {selected && isLoadingSelectedDetails ? 'Loading details…' : selected ? 'Shown on the map' : 'Show on map & rating'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
                Results and selected-place details from <span translate="no">Google Maps</span>. OpenHousePal calculates straight-line distance locally.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
