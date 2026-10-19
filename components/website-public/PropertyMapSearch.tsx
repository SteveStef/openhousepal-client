'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Bath, BedDouble, Bell, Check, ChevronDown, Grid3x3, Heart, List, Loader2, Map as MapIcon, Pencil, Ruler, Search, SlidersHorizontal, X } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { cleanStreet, formatCompactPrice, formatStatus, listedAgo, statusBadgeColor } from './listingFormat'
import OpenHouseChip from '@/components/OpenHouseChip'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { SearchFilterParams, SiteTheme } from './types'
import SiteLoader from './SiteLoader'
import { createPinLayer, type PinLayer } from './mapPins'
import { IMG } from '@/lib/siteImage'
import SitePhoto from './SitePhoto'

export interface MapListing {
  listing_key: string
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  lot_size_acres?: number | null
  status?: string | null
  photo?: string | null
  latitude?: number | null
  longitude?: number | null
  open_houses?: MlsOpenHouse[] | null
  list_office_name?: string | null
  days_on_market?: number | null
}

const VIEWED_STORAGE_KEY = 'ohp_viewed_listings'

function loadViewedKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(VIEWED_STORAGE_KEY)
    try { return raw ? new Set(JSON.parse(raw)) : new Set() } catch { return new Set() }
  } catch {
    return new Set()
  }
}

const BEDS = ['', '1', '2', '3', '4', '5']
const BATHS = ['', '1', '1.5', '2', '3', '4']
const TYPES: { value: string; label: string }[] = [
  { value: 'single_family', label: 'Single family' },
  { value: 'town_house', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'multi_family', label: 'Multi-family' },
]
const SORTS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'sqft_desc', label: 'Largest' },
]
const ACRE_STEPS = ['0.25', '0.5', '1', '2', '5', '10']
const YEAR_STEPS = ['1950', '1970', '1990', '2000', '2010', '2020']
const PRICE_STEPS = [250000, 400000, 500000, 750000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000, 4000000, 5000000, 7500000, 10000000]

const digits = (v: string) => v.replace(/[^0-9]/g, '')
const short = (n?: string | number | null) => (n ? formatCompactPrice(Number(n)) : '')

/** One filter button + its little panel. */
function Pop({ label, active, children, align = 'left' }: { label: ReactNode; active: boolean; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] font-bold transition"
        style={active ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)', borderColor: 'transparent' } : { backgroundColor: 'var(--site-surface)', color: 'var(--site-heading)', borderColor: 'var(--site-line-strong)' }}>
        {label}<ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
            // Phones: a sheet at the bottom of the screen (the filter row scrolls sideways and would
            // clip a dropdown); computers: a dropdown under the button.
            className={`fixed inset-x-3 bottom-24 z-50 rounded-2xl border p-4 shadow-2xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:top-full lg:mt-2 lg:w-[300px] ${align === 'right' ? 'lg:right-0' : 'lg:left-0'}`}
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)' }}>
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// The Search page - Zillow-simple: one search box, four tidy filter buttons (Price, Beds & baths,
// Home type, More), a "Save this search" that opens the agent's Showcase request (a private page
// that finds new matches - the site's best lead), and the results as price-tag pins on a map
// beside a list of cards (phones: the cards, with a Map button). Every filter is a real field of
// one GET form, so applying re-runs the full-MLS search server-side (content_adapters.
// get_search_results); the view is client state over what the server returned. Applying a filter
// swaps the results in place (client navigation, no page reload): the map stays where the
// visitor left it, the site's loading mark shows over it until the new homes arrive.
export default function PropertyMapSearch({ listings, theme, basePrefix = '', filters, towns = [] }: {
  listings: MapListing[]
  theme: SiteTheme
  basePrefix?: string
  filters: SearchFilterParams
  // The towns this search covered (server-side) - what "Save this search" watches.
  towns?: string[]
}) {
  const luxe = theme.template !== 'default'
  const formRef = useRef<HTMLFormElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const pinsRef = useRef<PinLayer | null>(null)
  const fittedRef = useRef<string | null>(null)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [view, setView] = useState<'map' | 'grid'>('map')
  const [phoneMap, setPhoneMap] = useState(false)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [viewed, setViewed] = useState<Set<string>>(() => loadViewedKeys())

  // Form values (applied on Apply / Enter).
  const [minPrice, setMinPrice] = useState(filters.min_price || '')
  const [maxPrice, setMaxPrice] = useState(filters.max_price || '')
  const [beds, setBeds] = useState(filters.min_beds || '')
  const [baths, setBaths] = useState(filters.min_baths || '')
  // Home type: any number of types at once (comma list in the URL), like a Showcase.
  const [ptypes, setPtypes] = useState<string[]>(() => (filters.property_type || '').split(',').filter(Boolean))
  const ptype = ptypes.join(',')
  const [sqft, setSqft] = useState(filters.min_sqft || '')
  const [maxSqft, setMaxSqft] = useState(filters.max_sqft || '')
  const [acres, setAcres] = useState(filters.min_acres || '')
  const [yearBuilt, setYearBuilt] = useState(filters.min_year_built || '')
  const [school, setSchool] = useState(filters.school_district || '')
  const [rentals, setRentals] = useState(filters.include_rentals === 'true')
  // New results can carry filters read from the typed search ("4 beds under $2M") - show them
  // in the bar. The page doesn't reload between searches, so follow the server's values here.
  useEffect(() => {
    setMinPrice(filters.min_price || ''); setMaxPrice(filters.max_price || '')
    setBeds(filters.min_beds || ''); setBaths(filters.min_baths || '')
    setPtypes((filters.property_type || '').split(',').filter(Boolean))
    setSqft(filters.min_sqft || ''); setMaxSqft(filters.max_sqft || ''); setAcres(filters.min_acres || ''); setYearBuilt(filters.min_year_built || '')
    setSchool(filters.school_district || ''); setRentals(filters.include_rentals === 'true'); setArea(filters.area || '')
  }, [filters])
  // Runs the search without reloading the page - the same URL the GET form would build.
  const go = (url: string) => startTransition(() => router.push(url, { scroll: false }))
  const runSearch = () => {
    const form = formRef.current
    if (!form) return
    const qs = new URLSearchParams()
    new FormData(form).forEach((v, k) => { if (typeof v === 'string' && v.trim()) qs.set(k, v.trim()) })
    if (qs.get('sort') === 'newest') qs.delete('sort')
    const text = qs.toString()
    go(`${basePrefix}/search${text ? `?${text}` : ''}`)
  }
  const submit = () => setTimeout(runSearch, 0)

  // Draw an area: the visitor traces a shape on the map with a finger or the mouse; the search
  // re-runs for homes inside it (backend geography.polygon_from_param), every other filter kept.
  // The shape rides in the URL ("lat,lng;lat,lng;...") so it can be shared, and into "Save this
  // search" so their Showcase alerts follow the same shape.
  const [area, setArea] = useState(filters.area || '')
  const [drawing, setDrawing] = useState(false)
  const shapeRef = useRef<google.maps.Polygon | null>(null)
  const lineRef = useRef<google.maps.Polyline | null>(null)
  const drawPts = useRef<{ x: number; y: number }[]>([])
  const areaPath = (text: string) => text.split(';')
    .map(pair => pair.split(',').map(Number))
    .filter(pt => pt.length === 2 && pt.every(Number.isFinite))
    .map(([lat, lng]) => ({ lat, lng }))

  const mappable = useMemo(() => listings.filter(l => l.latitude != null && l.longitude != null), [listings])
  const href = (l: MapListing) => `${basePrefix}/search/properties/${encodeURIComponent(l.listing_key)}`
  const markViewed = (key: string) => {
    if (viewed.has(key)) return
    const next = new Set(viewed); next.add(key); setViewed(next)
    try { window.localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(Array.from(next))) } catch {}
  }

  const accentHex = theme.secondary_color || '#C9A24D'
  const pinColors = luxe
    ? { ['--pin-bg' as any]: theme.primary_color || '#111827', ['--pin-fg' as any]: '#ffffff' }
    : { ['--pin-bg' as any]: 'var(--site-accent)', ['--pin-fg' as any]: 'var(--site-on-accent)' }

  // The map itself: made once per view (not per search), so new results never reset it.
  useEffect(() => {
    if (view !== 'map' || !mapDivRef.current) return
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !mapDivRef.current) return
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 40.0, lng: -75.3 }, zoom: 11,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { featureType: 'water', stylers: [{ color: '#c9dcea' }] },
          { featureType: 'landscape', stylers: [{ color: '#f3f2ee' }] },
        ],
      })
      mapRef.current = map
      pinsRef.current = createPinLayer(map, {
        click: key => {
          setActiveKey(key)
          cardRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        },
        hover: key => setHoverKey(key),
      })
      fittedRef.current = null
      map.addListener('click', () => setActiveKey(null))
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoadError("The map couldn't load right now.") })
    return () => {
      cancelled = true
      pinsRef.current?.destroy(); pinsRef.current = null
      shapeRef.current?.setMap(null); shapeRef.current = null
      mapRef.current = null
      setLoaded(false)
    }
  }, [view, phoneMap])

  // New results: swap the pins in place. The map only moves on its own the first time, when the
  // drawn area changes, or when none of the new homes are in view - otherwise it stays put.
  useEffect(() => {
    const map = mapRef.current
    if (!loaded || !map || !pinsRef.current) return
    pinsRef.current.setItems(mappable.map(l => ({ key: l.listing_key, lat: l.latitude as number, lng: l.longitude as number, label: l.price ? short(l.price) : 'Home' })))
    shapeRef.current?.setMap(null); shapeRef.current = null
    const shape = filters.area ? areaPath(filters.area) : []
    if (shape.length >= 3) shapeRef.current = new google.maps.Polygon({ map, paths: shape, strokeColor: accentHex, strokeWeight: 2.5, strokeOpacity: 0.95, fillColor: accentHex, fillOpacity: 0.08, clickable: false, zIndex: 0 })
    const view = map.getBounds()
    const anyInView = !!view && mappable.some(l => view.contains({ lat: l.latitude as number, lng: l.longitude as number }))
    const areaKey = filters.area || ''
    if (fittedRef.current === null || fittedRef.current !== areaKey || (!anyInView && mappable.length)) {
      const bounds = new google.maps.LatLngBounds()
      if (shape.length >= 3) { shape.forEach(pt => bounds.extend(pt)); map.fitBounds(bounds, 40) }
      else if (mappable.length === 1) { map.setCenter({ lat: mappable[0].latitude as number, lng: mappable[0].longitude as number }); map.setZoom(14) }
      else if (mappable.length) { mappable.forEach(l => bounds.extend({ lat: l.latitude as number, lng: l.longitude as number })); map.fitBounds(bounds, 56) }
      fittedRef.current = areaKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappable, loaded, filters.area])

  // Pin states follow the list (hover) and the selection (click).
  useEffect(() => {
    pinsRef.current?.setState({ active: activeKey, hover: hoverKey, seen: viewed })
  }, [activeKey, hoverKey, loaded, viewed, mappable])

  // While drawing, the map holds still so the finger draws instead of panning.
  useEffect(() => {
    mapRef.current?.setOptions({ gestureHandling: drawing ? 'none' : 'greedy', draggable: !drawing })
    if (drawing) setActiveKey(null)
  }, [drawing])

  const toLatLng = (x: number, y: number) => pinsRef.current?.projection()?.fromContainerPixelToLatLng(new google.maps.Point(x, y)) || null
  const pointIn = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const startDraw = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mapRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointIn(e)
    drawPts.current = [p]
    lineRef.current?.setMap(null)
    const first = toLatLng(p.x, p.y)
    lineRef.current = new google.maps.Polyline({ map: mapRef.current, path: first ? [first] : [], strokeColor: accentHex, strokeWeight: 3, clickable: false, zIndex: 5 })
  }
  const moveDraw = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lineRef.current || !drawPts.current.length) return
    const p = pointIn(e)
    const last = drawPts.current[drawPts.current.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) < 4) return
    drawPts.current.push(p)
    const ll = toLatLng(p.x, p.y)
    if (ll) lineRef.current.getPath().push(ll)
  }
  const endDraw = () => {
    const pts = drawPts.current
    drawPts.current = []
    lineRef.current?.setMap(null)
    lineRef.current = null
    if (pts.length < 8) return // a tap, not a shape - keep drawing mode on
    const step = Math.max(1, Math.ceil(pts.length / 80))
    const ll = pts.filter((_, i) => i % step === 0).map(p => toLatLng(p.x, p.y)).filter(Boolean) as google.maps.LatLng[]
    if (ll.length < 3) return
    setDrawing(false)
    setArea(ll.map(p => `${p.lat().toFixed(5)},${p.lng().toFixed(5)}`).join(';'))
    submit()
  }

  const priceActive = !!(minPrice || maxPrice)
  const bbActive = !!(beds || baths)
  const moreActive = !!(sqft || maxSqft || acres || yearBuilt || school || rentals)
  const active = mappable.find(l => l.listing_key === activeKey) || null
  const saveTitle = filters.q ? `Save "${filters.q}"` : 'Save this search'
  const savePrefill = JSON.stringify({
    search: [area ? 'My drawn area on the map' : '', filters.q, priceActive ? `${short(minPrice) || 'Any'}-${short(maxPrice) || 'Any'}` : '', beds ? `${beds}+ beds` : ''].filter(Boolean).join(' · '),
    ...(area ? { search_area: area } : {}),
  })
  // Everything on screen right now - the Save window shows it back and the Showcase uses it.
  // Applied (searched) values, so it matches the homes the visitor is looking at.
  const saveCriteria = JSON.stringify({
    kind: 'search', cities: towns, q: filters.q || '', area: filters.area || '',
    min_price: filters.min_price, max_price: filters.max_price, min_beds: filters.min_beds, min_baths: filters.min_baths,
    types: (filters.property_type || '').split(',').filter(Boolean), min_sqft: filters.min_sqft, max_sqft: filters.max_sqft,
    min_acres: filters.min_acres, min_year_built: filters.min_year_built, school_district: filters.school_district,
  })
  // The heart on a home: homes like it - same town, a price band around it, at least its bedrooms.
  const homeCriteria = (l: MapListing) => JSON.stringify({
    kind: 'home', cities: l.city ? [l.city] : towns,
    min_price: l.price ? Math.round(l.price * 0.8 / 5000) * 5000 : undefined,
    max_price: l.price ? Math.round(l.price * 1.2 / 5000) * 5000 : undefined,
    min_beds: l.bedrooms || undefined,
    home: { address: [cleanStreet(l.address, l.city), l.city].filter(Boolean).join(', '), photo: l.photo || null, price: l.price || null },
  })

  const card = (l: MapListing, compact = false) => {
    const badge = statusBadgeColor(l.status)
    const on = l.listing_key === activeKey || l.listing_key === hoverKey
    const street = cleanStreet(l.address, l.city)
    return (
      <div key={l.listing_key} ref={el => { if (el) cardRefs.current.set(l.listing_key, el) }}
        onMouseEnter={() => setHoverKey(l.listing_key)} onMouseLeave={() => setHoverKey(k => (k === l.listing_key ? null : k))}
        className={`ohp-home-card group relative overflow-hidden border transition duration-300 ${luxe ? 'rounded-[22px]' : 'rounded-2xl'} ${on ? '-translate-y-0.5' : ''}`}
        style={{ backgroundColor: 'var(--site-surface)', borderColor: on ? 'var(--site-accent)' : 'var(--site-line)', boxShadow: on ? '0 0 0 2px rgba(var(--site-accent-rgb),.35), var(--site-shadow)' : 'var(--site-shadow)' }}>
        <a href={href(l)} onClick={() => markViewed(l.listing_key)} className="block">
          <div className={`relative overflow-hidden ${compact ? 'h-40' : 'h-48'}`} style={{ backgroundColor: 'var(--site-bg-alt)' }}>
            {/* A real lazy <img>: the list holds up to 120 homes - background photos all downloaded at once. */}
            <SitePhoto src={l.photo} widths={IMG.card} sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {l.status && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(l.status)}</span>}
              {l.days_on_market != null && l.days_on_market <= 7 && <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>New</span>}
              {viewed.has(l.listing_key) && <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Seen</span>}
            </div>
            <p className="absolute bottom-2.5 left-3 text-xl font-black text-white drop-shadow">{l.price ? `$${l.price.toLocaleString()}` : 'Price on request'}</p>
          </div>
          <div className="p-3.5">
            <p className="truncate text-sm font-bold" style={{ color: 'var(--site-heading)' }}>{street}</p>
            <p className="truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{[l.city, l.state].filter(Boolean).join(', ')}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold" style={{ color: 'var(--site-ink-soft)' }}>
              {l.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{l.bedrooms} bd</span>}
              {l.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{l.bathrooms} ba</span>}
              {l.living_area != null && <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{Math.round(l.living_area).toLocaleString()} sqft</span>}
            </div>
            <OpenHouseChip openHouses={l.open_houses} compact className="mt-2" />
            <p className="mt-2 truncate text-[10px] font-medium" style={{ color: 'var(--site-faint)' }}>
              {listedAgo(l.days_on_market) ? <span className="mr-1 font-black" style={{ color: 'var(--site-accent-deep)' }}>{listedAgo(l.days_on_market)} ·</span> : null}
              {l.list_office_name ? `Courtesy of ${l.list_office_name}` : ''}
            </p>
          </div>
        </a>
        <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title="Get homes like this first"
          data-ohp-prefill={JSON.stringify({ property_of_interest: [street, l.city].filter(Boolean).join(', ') })} data-ohp-criteria={homeCriteria(l)}
          aria-label="Get homes like this first" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow transition hover:scale-110 hover:text-rose-500"><Heart className="h-4 w-4" /></a>
      </div>
    )
  }

  const empty = (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)', color: 'var(--site-accent)' }}><Search className="h-6 w-6" /></span>
      <p className="mt-4 text-lg font-black" style={{ color: 'var(--site-heading)' }}>No homes match - yet.</p>
      <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--site-muted)' }}>Widen the search, or save it and you&apos;ll hear the moment one lists.</p>
      <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={saveTitle} data-ohp-prefill={savePrefill} data-ohp-criteria={saveCriteria}
        className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Bell className="h-4 w-4" /> Tell me when one lists</a>
    </div>
  )

  const input = 'w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-[color:var(--site-accent)]'
  const inputStyle = { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-bg)', color: 'var(--site-ink)' }
  const applyBtn = (close: () => void) => (
    <button type="button" onClick={() => { close(); submit() }} className="mt-4 w-full rounded-xl py-2.5 text-sm font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Apply</button>
  )
  const seg = (vals: string[], value: string, set: (v: string) => void) => (
    <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: 'var(--site-line-strong)' }}>
      {vals.map(v => (
        <button key={v || 'any'} type="button" onClick={() => set(v)} className="flex-1 py-2 text-xs font-black transition"
          style={value === v ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)' } : { color: 'var(--site-ink-soft)' }}>{v ? `${v}+` : 'Any'}</button>
      ))}
    </div>
  )

  return (
    <div data-testid="site-search">
      <form id="site-search-form" ref={formRef} action={`${basePrefix}/search`} method="GET" onSubmit={e => { e.preventDefault(); runSearch() }} className="relative z-30 border-b px-4 py-3 sm:px-6" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-bg)' }}>
        {/* the real query fields */}
        <input type="hidden" name="min_price" value={minPrice} />
        <input type="hidden" name="max_price" value={maxPrice} />
        <input type="hidden" name="min_beds" value={beds} />
        <input type="hidden" name="min_baths" value={baths} />
        <input type="hidden" name="property_type" value={ptype} />
        <input type="hidden" name="min_sqft" value={sqft} />
        <input type="hidden" name="max_sqft" value={maxSqft} />
        <input type="hidden" name="min_acres" value={acres} />
        <input type="hidden" name="min_year_built" value={yearBuilt} />
        <input type="hidden" name="school_district" value={school} />
        {rentals && <input type="hidden" name="include_rentals" value="true" />}
        {area && <input type="hidden" name="area" value={area} />}

        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border p-1.5 pl-4 shadow-sm focus-within:border-[color:var(--site-accent)] lg:max-w-xl" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--site-faint)' }} />
            <input type="text" name="q" defaultValue={filters.q || ''} placeholder="Town, address, school, or “4 beds under $2M”" aria-label="Search homes"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none" style={{ color: 'var(--site-ink)' }} />
            <button type="submit" className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide ${luxe ? 'ohp-gold-sheen text-white' : ''}`} style={luxe ? { backgroundColor: theme.primary_color } : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Search</button>
          </div>

          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
            <Pop label={priceActive ? `${short(minPrice) || 'Any'} – ${short(maxPrice) || 'Any'}` : 'Price'} active={priceActive}>
              {close => (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Price range</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <select value={minPrice} onChange={e => setMinPrice(e.target.value)} className={input} style={inputStyle} aria-label="Minimum price">
                      <option value="">No min</option>{PRICE_STEPS.map(p => <option key={p} value={p}>{short(p)}</option>)}
                    </select>
                    <select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className={input} style={inputStyle} aria-label="Maximum price">
                      <option value="">No max</option>{PRICE_STEPS.map(p => <option key={p} value={p}>{short(p)}</option>)}
                    </select>
                  </div>
                  {applyBtn(close)}
                </>
              )}
            </Pop>
            <Pop label={bbActive ? `${beds ? `${beds}+ bd` : 'Any bd'} · ${baths ? `${baths}+ ba` : 'any ba'}` : 'Beds & baths'} active={bbActive}>
              {close => (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Bedrooms</p>
                  <div className="mt-2">{seg(BEDS, beds, setBeds)}</div>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Bathrooms</p>
                  <div className="mt-2">{seg(BATHS, baths, setBaths)}</div>
                  {applyBtn(close)}
                </>
              )}
            </Pop>
            <Pop label={ptypes.length === 0 ? 'Home type' : ptypes.length === 1 ? TYPES.find(t => t.value === ptypes[0])?.label || 'Home type' : `${ptypes.length} home types`} active={ptypes.length > 0}>
              {close => (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Pick any</p>
                  <div className="mt-2 space-y-1">
                    {TYPES.map(t => {
                      const on = ptypes.includes(t.value)
                      return (
                        <button key={t.value} type="button" onClick={() => setPtypes(cur => (on ? cur.filter(v => v !== t.value) : [...cur, t.value]))}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition hover:bg-[rgba(var(--site-accent-rgb),.08)]" style={{ color: 'var(--site-heading)' }}>
                          {t.label}
                          <span className="flex h-5 w-5 items-center justify-center rounded-md border transition" style={on ? { backgroundColor: 'var(--site-accent)', borderColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { borderColor: 'var(--site-line-strong)' }}>{on && <Check className="h-3.5 w-3.5" />}</span>
                        </button>
                      )
                    })}
                  </div>
                  {applyBtn(close)}
                </>
              )}
            </Pop>
            <Pop label={<><SlidersHorizontal className="h-3.5 w-3.5" />More</>} active={moreActive} align="right">
              {close => (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Square feet</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={sqft} onChange={e => setSqft(digits(e.target.value))} inputMode="numeric" placeholder="No min" aria-label="Minimum square feet" className={input} style={inputStyle} />
                    <input value={maxSqft} onChange={e => setMaxSqft(digits(e.target.value))} inputMode="numeric" placeholder="No max" aria-label="Maximum square feet" className={input} style={inputStyle} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Lot size</p>
                      <select value={acres} onChange={e => setAcres(e.target.value)} aria-label="Minimum lot size" className={`mt-2 ${input}`} style={inputStyle}>
                        <option value="">Any</option>{ACRE_STEPS.map(a => <option key={a} value={a}>{a}+ acres</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>Year built</p>
                      <select value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} aria-label="Built after" className={`mt-2 ${input}`} style={inputStyle}>
                        <option value="">Any</option>{YEAR_STEPS.map(y => <option key={y} value={y}>{y} or newer</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>School district</p>
                  <input value={school} onChange={e => setSchool(e.target.value)} placeholder="Any district" className={`mt-2 ${input}`} style={inputStyle} />
                  <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
                    Include rentals
                    <input type="checkbox" checked={rentals} onChange={e => setRentals(e.target.checked)} className="h-4 w-4 accent-[color:var(--site-accent)]" />
                  </label>
                  {applyBtn(close)}
                </>
              )}
            </Pop>
            {(priceActive || bbActive || moreActive || ptype || area) && (
              <a href={`${basePrefix}/search${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}`} onClick={e => { e.preventDefault(); setMinPrice(''); setMaxPrice(''); setBeds(''); setBaths(''); setPtypes([]); setSqft(''); setMaxSqft(''); setAcres(''); setYearBuilt(''); setSchool(''); setRentals(false); setArea(''); go(`${basePrefix}/search${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}`) }} className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2.5 text-xs font-bold" style={{ color: 'var(--site-muted)' }}><X className="h-3.5 w-3.5" />Clear</a>
            )}
            <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={saveTitle} data-ohp-prefill={savePrefill} data-ohp-criteria={saveCriteria}
              className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-black transition hover:-translate-y-0.5 ${luxe ? 'ohp-gold-sheen' : ''}`}
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
              <Bell className="h-4 w-4" /> Save this search
            </a>
          </div>
        </div>
      </form>

      {/* results bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
        <p className="text-sm font-bold" style={{ color: 'var(--site-heading)' }}>
          {listings.length >= 120 ? '120+' : listings.length.toLocaleString()} {listings.length === 1 ? 'home' : 'homes'} <span className="font-semibold" style={{ color: 'var(--site-muted)' }}>{filters.include_rentals === 'true' ? 'for sale & rent' : 'for sale'}{area ? ' in your drawn area' : ''}</span>
        </p>
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Sort</span>
            <select form="site-search-form" name="sort" defaultValue={filters.sort || 'newest'} onChange={submit}
              className="appearance-none rounded-full border py-2 pl-3.5 pr-8 text-xs font-bold outline-none" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-heading)' }}>
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5" style={{ color: 'var(--site-muted)' }} />
          </label>
          <div className="hidden items-center rounded-full border p-0.5 lg:flex" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)' }}>
            {([['map', MapIcon, 'Map'], ['grid', Grid3x3, 'Grid']] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => setView(v)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition"
                style={view === v ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)' } : { color: 'var(--site-muted)' }}><Icon className="h-3.5 w-3.5" />{label}</button>
            ))}
          </div>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          {pending ? <div className="flex justify-center py-24"><SiteLoader label="Finding homes" /></div> : listings.length === 0 ? empty : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{listings.map(l => card(l))}</div>}
        </div>
      ) : (
        <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className={`px-4 pb-24 transition-opacity duration-300 sm:px-6 lg:block lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto lg:pb-8 ${phoneMap ? 'hidden' : ''} ${pending ? 'pointer-events-none opacity-50' : ''}`}>
            {listings.length === 0 ? empty : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{listings.map(l => card(l, true))}</div>}
          </div>
          <div className={`lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-180px)] ${phoneMap ? 'fixed inset-x-0 bottom-0 top-[64px] z-30 block' : 'hidden'}`}>
            <div className="relative h-full w-full overflow-hidden lg:rounded-l-[28px]" style={pinColors}>
                {!loaded && !loadError && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <SiteLoader label="Loading the map" />
                  </div>
                )}
                {loadError && <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold" style={{ color: 'var(--site-faint)' }}>{loadError}</div>}
                <div ref={mapDivRef} className="h-full w-full" />
                <AnimatePresence>
                  {pending && (
                    <motion.div key="veil" className="ohp-map-veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="ohp-map-veil-card"><SiteLoader size="sm" label="Updating homes" /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {loaded && !pending && mappable.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center">
                    <span className="rounded-full px-4 py-2 text-xs font-black shadow-lg" style={{ backgroundColor: 'var(--site-surface)', color: 'var(--site-heading)' }}>No homes on the map for this search</span>
                  </div>
                )}
                {/* Draw an area */}
                {loaded && (
                  <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2">
                    {drawing ? (
                      <>
                        <span className="rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-[#111827] shadow-lg">Draw around where you want to live</span>
                        <button type="button" onClick={() => setDrawing(false)} className="rounded-full bg-[#111827] px-3.5 py-2 text-xs font-black text-white shadow-lg">Cancel</button>
                      </>
                    ) : area ? (
                      <>
                        <button type="button" onClick={() => setDrawing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-[#111827] shadow-lg transition hover:-translate-y-0.5"><Pencil className="h-3.5 w-3.5" /> Redraw</button>
                        <button type="button" onClick={() => { setArea(''); submit() }} className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-[#111827] shadow-lg transition hover:-translate-y-0.5"><X className="h-3.5 w-3.5" /> Remove area</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setDrawing(true)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-black shadow-lg transition hover:-translate-y-0.5"
                        style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                        <Pencil className="h-3.5 w-3.5" /> Draw an area
                      </button>
                    )}
                  </div>
                )}
                {drawing && (
                  <div className="absolute inset-0 z-[15] cursor-crosshair" style={{ touchAction: 'none' }}
                    onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerCancel={endDraw} />
                )}
                <AnimatePresence>
                  {active && (
                    <motion.div key={active.listing_key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-sm">
                      <div className="relative">
                        <button type="button" onClick={() => setActiveKey(null)} aria-label="Close" className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#111827] shadow-lg"><X className="h-3.5 w-3.5" /></button>
                        {card(active, true)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          </div>
        </div>
      )}

      {/* Phones: switch between the list and the map. */}
      {view === 'map' && (
        <button type="button" onClick={() => { setPhoneMap(v => !v); setActiveKey(null); window.scrollTo({ top: 0 }) }}
          className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white shadow-2xl lg:hidden"
          style={{ backgroundColor: theme.primary_color || '#111827' }}>
          {phoneMap ? <><List className="h-4 w-4" /> List</> : <><MapIcon className="h-4 w-4" /> Map</>}
        </button>
      )}
    </div>
  )
}
