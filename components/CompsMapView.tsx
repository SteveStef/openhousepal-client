'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { normalizeImageUrl } from '@/lib/utils'
import { formatMoney, formatDate, COMP_STATUS_HEX, COMP_STATUS_LABEL } from '@/lib/cma'
import { sqftToAcres } from '@/lib/matchScore'
import { CmaCompCandidate } from '@/types'

const GOLD = '#C9A24D'
const DEFAULT_STATUS_COLOR = '#374151'

interface CompsMapViewProps {
  subject: { latitude?: number | null, longitude?: number | null, street_address?: string | null }
  candidates: CmaCompCandidate[]
  addedKeys: Set<string | null | undefined>
  radiusMiles: number
  onRadiusChange: (miles: number) => void
  onToggleAdd: (candidate: CmaCompCandidate) => void
  onOpenDetails: (candidate: CmaCompCandidate) => void
  matchScoreFor: (candidate: CmaCompCandidate) => number
  heightClassName?: string
  /** The listing keys on the results page being shown - when it changes, those homes bounce on the
   *  map so the agent sees where the new page of cards sits (CMA comp step, 10/20). */
  pulseKeys?: string[]
}

const MILES_TO_METERS = 1609.34

function formatRadiusMiles(miles: number) {
  const rounded = Math.round(miles * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

// Black circle + gold ring + white star, matching the reference design for the subject marker.
function subjectIcon(): google.maps.Icon {
  const size = 34
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#111827" stroke="${GOLD}" stroke-width="3" />
      <text x="${size / 2}" y="${size / 2 + 5}" font-size="15" text-anchor="middle" fill="#ffffff">&#9733;</text>
    </svg>
  `
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

// Colored price-tag pin (status-colored: green active / amber pending/under contract / red sold,
// same palette as COMP_STATUS_HEX elsewhere in the app) with the price as its label, matching the
// reference design. A comp already added to the CMA gets a black ring + a black checkmark badge in
// the top-right corner (same black used by the subject marker), so "selected" reads as a distinct
// color change rather than just a slightly different outline shade.
function priceTagIcon(label: string, color: string, added: boolean): google.maps.Icon {
  const fontSize = 12
  const paddingX = 8
  const textWidth = Math.max(label.length * 7.1, 10)
  const tagWidth = Math.round(textWidth + paddingX * 2)
  const tagHeight = 24
  const tail = 7
  const midX = tagWidth / 2
  const SELECTED = '#111827'
  const ringColor = added ? SELECTED : '#ffffff'
  const ringWidth = added ? 3 : 1.5
  const badgeR = 8
  const padTop = added ? badgeR : 0
  const padRight = added ? badgeR : 0
  const width = tagWidth + padRight
  const totalHeight = tagHeight + tail + padTop
  // Extra-wide white stroke gives a clean buffer between the black badge and the colored tag
  // underneath it, so anti-aliasing doesn't blend the two into a muddy edge color at small sizes.
  const badge = added ? `
      <circle cx="${tagWidth}" cy="${padTop}" r="${badgeR}" fill="${SELECTED}" stroke="#ffffff" stroke-width="3" />
      <path d="M${tagWidth - 4},${padTop} L${tagWidth - 1.2},${padTop + 2.8} L${tagWidth + 4},${padTop - 3.2}" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  ` : ''
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}">
      <g transform="translate(0, ${padTop})">
        <path d="M4,0 H${tagWidth - 4} A4,4 0 0 1 ${tagWidth},4 V${tagHeight - 4} A4,4 0 0 1 ${tagWidth - 4},${tagHeight} H${midX + 5} L${midX},${tagHeight + tail} L${midX - 5},${tagHeight} H4 A4,4 0 0 1 0,${tagHeight - 4} V4 A4,4 0 0 1 4,0 Z"
              fill="${color}" stroke="${ringColor}" stroke-width="${ringWidth}" />
        <text x="${midX}" y="${tagHeight / 2 + 4}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" text-anchor="middle">${label}</text>
      </g>
      ${badge}
    </svg>
  `
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(width, totalHeight),
    anchor: new google.maps.Point(midX, totalHeight),
  }
}

export default function CompsMapView({ subject, candidates, addedKeys, radiusMiles, onRadiusChange, onToggleAdd, onOpenDetails, matchScoreFor, heightClassName = 'h-[560px]', pulseKeys }: CompsMapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const subjectMarkerRef = useRef<google.maps.Marker | null>(null)
  const candidateMarkersRef = useRef<google.maps.Marker[]>([])
  // listing key -> its marker, for the page-change bounce
  const markerByKeyRef = useRef<Map<string, google.maps.Marker>>(new Map())
  // the result set the markers were last dropped in for (a new set drops in; an added/removed
  // toggle on the same set just redraws in place)
  const droppedForRef = useRef("")
  const dropTimersRef = useRef<number[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const radiusMilesRef = useRef(radiusMiles)
  const onRadiusChangeRef = useRef(onRadiusChange)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [displayRadiusMiles, setDisplayRadiusMiles] = useState(radiusMiles)

  radiusMilesRef.current = radiusMiles
  onRadiusChangeRef.current = onRadiusChange

  const hasSubjectLocation = subject.latitude != null && subject.longitude != null

  // Init the map + circle once.
  useEffect(() => {
    if (!hasSubjectLocation || !mapDivRef.current) return
    let cancelled = false

    googleMapsLoader.load().then(() => {
      if (cancelled || !mapDivRef.current) return
      const center = { lat: subject.latitude as number, lng: subject.longitude as number }

      const map = new google.maps.Map(mapDivRef.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      })
      mapRef.current = map

      subjectMarkerRef.current = new google.maps.Marker({
        map, position: center, icon: subjectIcon(), zIndex: 999, title: subject.street_address || 'Subject Property',
      })

      const circle = new google.maps.Circle({
        map,
        center,
        radius: radiusMilesRef.current * MILES_TO_METERS,
        editable: true,
        draggable: false,
        fillColor: GOLD,
        fillOpacity: 0.08,
        strokeColor: GOLD,
        strokeOpacity: 0.6,
        strokeWeight: 2,
      })
      circleRef.current = circle
      map.fitBounds(circle.getBounds() as google.maps.LatLngBounds)

      circle.addListener('radius_changed', () => {
        const meters = circle.getRadius()
        const preciseMiles = Math.max(1, meters / MILES_TO_METERS)
        const roundedMiles = Math.round(preciseMiles)
        setDisplayRadiusMiles(preciseMiles)
        if (roundedMiles !== radiusMilesRef.current) onRadiusChangeRef.current(roundedMiles)
      })

      infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 220 })
      setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoadError("Map couldn't load. Double-check the Maps JavaScript API is enabled for this Google Cloud project.")
    })

    return () => {
      cancelled = true
      candidateMarkersRef.current.forEach(m => m.setMap(null))
      candidateMarkersRef.current = []
      subjectMarkerRef.current?.setMap(null)
      circleRef.current?.setMap(null)
      infoWindowRef.current?.close()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubjectLocation, subject.latitude, subject.longitude])

  // Keep the circle's radius in sync when it changes from the slider (not a drag).
  useEffect(() => {
    const circle = circleRef.current
    if (!circle) return
    const currentMiles = Math.round(circle.getRadius() / MILES_TO_METERS)
    if (currentMiles !== radiusMiles) circle.setRadius(radiusMiles * MILES_TO_METERS)
    setDisplayRadiusMiles(radiusMiles)
  }, [radiusMiles])

  // Rebuild candidate markers whenever the result set or added-state changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    candidateMarkersRef.current.forEach(m => m.setMap(null))
    dropTimersRef.current.forEach(t => window.clearTimeout(t))
    dropTimersRef.current = []
    markerByKeyRef.current = new Map()
    // A NEW result set's price tags appear from the subject outward (user, 10/21: no more dropping
    // in): the nearest ones pop in slowly and a little irregularly, then the rest fill in faster
    // and faster toward the edge. Toggling a comp on the same set just redraws in place.
    // Reduced motion: everything appears at once.
    const setKey = candidates.map(c => c.listing_key).join('|')
    const byDistance = candidates.filter(c => c.latitude != null && c.longitude != null)
      .map(c => c.listing_key).sort((a, b) => {
        const da = candidates.find(c => c.listing_key === a)?.distance_miles ?? 99
        const db = candidates.find(c => c.listing_key === b)?.distance_miles ?? 99
        return da - db
      })
    const ringRank = new Map(byDistance.map((k, i) => [k, i]))
    const lastRank = Math.max(1, byDistance.length - 1)
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dropIn = setKey !== droppedForRef.current && !reduce
    droppedForRef.current = setKey
    candidateMarkersRef.current = candidates
      .filter(c => c.latitude != null && c.longitude != null)
      .map((candidate, i) => {
        const added = addedKeys.has(candidate.listing_key)
        const price = candidate.sale_price ?? candidate.list_price
        const statusColor = COMP_STATUS_HEX[candidate.status] || DEFAULT_STATUS_COLOR
        const marker = new google.maps.Marker({
          map: dropIn ? null : map,
          position: { lat: candidate.latitude as number, lng: candidate.longitude as number },
          icon: priceTagIcon(price ? formatMoney(price, { compact: true }) : '—', statusColor, added),
          title: candidate.street_address || 'Comparable',
          zIndex: added ? 500 : 1,
        })
        marker.addListener('click', () => {
          const iw = infoWindowRef.current
          if (!iw) return
          const score = matchScoreFor(candidate)

          // Top-right-of-photo badge: sold comps show their close date; anything still on-market
          // shows its status instead, since there's no close date yet. The sold-%-vs-asking gap
          // (when both prices are known) gets its own line below, since it doesn't fit cleanly
          // alongside a date/status badge.
          const topRightBadge = candidate.status === 'sold' && candidate.sale_date
            ? `Closed ${formatDate(candidate.sale_date)}`
            : COMP_STATUS_LABEL[candidate.status] || candidate.status
          let soldPctLine = ''
          if (candidate.status === 'sold' && candidate.sale_price && candidate.list_price) {
            const pct = ((candidate.sale_price - candidate.list_price) / candidate.list_price) * 100
            const rounded = Math.round(pct * 10) / 10
            const label = Math.abs(rounded) < 0.1 ? 'Sold at asking' : `Sold ${Math.abs(rounded)}% ${rounded > 0 ? 'above' : 'below'} asking`
            soldPctLine = `<p style="margin:2px 0 0;font-size:10px;font-weight:700;color:#6B7280;">${label}</p>`
          }

          const acres = candidate.lot_size ? sqftToAcres(candidate.lot_size) : null
          const stat = (value: string | number | null | undefined, label: string) => value != null && value !== ''
            ? `<div style="text-align:center;min-width:0;"><p style="margin:0;font-size:10px;font-weight:800;color:#111827;">${value}</p><p style="margin:0;font-size:7px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.03em;">${label}</p></div>`
            : ''
          const stats = [
            stat(candidate.beds, 'Beds'),
            stat(candidate.baths, 'Baths'),
            stat(candidate.sqft ? candidate.sqft.toLocaleString() : null, 'SF'),
            stat(candidate.price_per_sqft ? `$${candidate.price_per_sqft}/SF` : null, ''),
            stat(acres ? acres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null, 'AC'),
            stat(candidate.days_on_market, 'DOM'),
          ].filter(Boolean).join('')

          const container = document.createElement('div')
          container.className = 'comps-map-infowindow'
          // Explicit color on every piece of text here, not inherited - this HTML is injected
          // straight into Google's InfoWindow DOM, outside Tailwind/dark-mode's normal cascade,
          // so an ambient/global text color (e.g. from dark mode) can otherwise land white text
          // on this popup's own white background and make it unreadable.
          container.innerHTML = `
            <div style="width:200px;font-family:inherit;color:#111827;margin:0;">
              <div style="position:relative;">
                ${candidate.photo_url ? `<img src="${normalizeImageUrl(candidate.photo_url) || ''}" style="display:block;width:100%;height:150px;aspect-ratio:4/3;object-fit:contain;border-radius:10px;background:#F3F4F6;" />` : `<div style="width:100%;height:150px;aspect-ratio:4/3;border-radius:10px;background:#F3F4F6;"></div>`}
                <span style="position:absolute;top:6px;left:6px;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;color:#fff;background:${score >= 70 ? '#059669' : '#6B7280'};">${score}% Match</span>
                <span style="position:absolute;top:6px;right:6px;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;color:#fff;background:${statusColor};">${topRightBadge}</span>
              </div>
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-top:7px;">
                <p style="margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:800;color:#111827;">${candidate.street_address || 'Comparable Property'}</p>
                <p style="margin:0;flex-shrink:0;font-size:13px;font-weight:800;color:#111827;">${price ? formatMoney(price) : '—'}</p>
              </div>
              <p style="margin:0;font-size:9px;font-weight:700;color:#9CA3AF;">${[candidate.city, candidate.state, candidate.zipcode].filter(Boolean).join(', ')}</p>
              ${soldPctLine}
              <div style="display:flex;justify-content:space-between;gap:2px;padding:6px 0;margin-top:5px;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">${stats}</div>
              <div style="display:flex;gap:5px;margin-top:7px;">
                <button data-action="details" style="flex:1;border:1px solid #E5E7EB;border-radius:8px;padding:5px 6px;font-size:9px;font-weight:800;cursor:pointer;color:#111827;background:#fff;">Details</button>
                <button data-action="toggle" style="flex:1;border:none;border-radius:8px;padding:5px 6px;font-size:9px;font-weight:800;cursor:pointer;color:#fff;background:${added ? '#059669' : '#111827'};">${added ? 'Added ✓' : 'Add'}</button>
              </div>
            </div>
          `
          container.querySelector('[data-action="details"]')?.addEventListener('click', () => onOpenDetails(candidate))
          container.querySelector('[data-action="toggle"]')?.addEventListener('click', () => { onToggleAdd(candidate); iw.close() })
          iw.setContent(container)
          iw.open({ map, anchor: marker })
        })
        markerByKeyRef.current.set(candidate.listing_key, marker)
        if (dropIn) {
          // time ~ sqrt(rank): wide gaps for the first few, then bunched up - plus some jitter
          const r = ringRank.get(candidate.listing_key) ?? i
          const at = 200 + 1700 * Math.sqrt(r / lastRank) * (0.82 + Math.random() * 0.36)
          dropTimersRef.current.push(window.setTimeout(() => {
            marker.setOpacity(0)
            marker.setMap(map)
            const start = performance.now()
            const fade = (now: number) => {
              const t = Math.min(1, (now - start) / 260)
              marker.setOpacity(t)
              if (t < 1) requestAnimationFrame(fade)
            }
            requestAnimationFrame(fade)
          }, at))
        }
        return marker
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, addedKeys, loaded])
  useEffect(() => () => { dropTimersRef.current.forEach(t => window.clearTimeout(t)) }, [])

  // A new page of result cards: those homes bounce twice on the map, so the agent can see where
  // the cards they're now looking at sit. The first page on load is covered by the drop-in.
  const pulseKey = (pulseKeys || []).join('|')
  const lastPulseRef = useRef<string | null>(null)
  useEffect(() => {
    if (!loaded || !pulseKey) return
    const first = lastPulseRef.current === null
    lastPulseRef.current = pulseKey
    if (first || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const markers = pulseKey.split('|').map(k => markerByKeyRef.current.get(k)).filter(Boolean) as google.maps.Marker[]
    markers.forEach(m => m.setAnimation(google.maps.Animation.BOUNCE))
    const t = window.setTimeout(() => markers.forEach(m => m.setAnimation(null)), 1400)
    return () => { window.clearTimeout(t); markers.forEach(m => m.setAnimation(null)) }
  }, [pulseKey, loaded])

  if (!hasSubjectLocation) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-800">
        <AlertTriangle className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-black text-gray-500 dark:text-gray-400">Subject property is missing coordinates</p>
        <p className="max-w-xs text-xs font-semibold text-gray-400">Re-select the subject address from the search step to enable the map.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-red-200 py-16 text-center dark:border-red-900/40">
        <AlertTriangle className="h-6 w-6 text-red-400" />
        <p className="text-sm font-black text-red-500">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="cma-map-in relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/70 text-sm font-bold text-gray-400 dark:bg-[#151517]/70">
          <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /> Loading map...
        </div>
      )}
      <div ref={mapDivRef} className={`${heightClassName} w-full`} />
      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-600 shadow-sm dark:border-gray-700 dark:bg-[#151517]/90 dark:text-gray-300">
        {formatRadiusMiles(displayRadiusMiles)} mi radius
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/90 px-3 py-2 text-[10px] font-bold text-gray-500 shadow dark:bg-[#151517]/90 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: GOLD, backgroundColor: '#111827' }} /> Subject</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COMP_STATUS_HEX.active }} /> Active</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COMP_STATUS_HEX.pending }} /> Under Contract</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COMP_STATUS_HEX.sold }} /> Sold</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: GOLD, backgroundColor: '#9CA3AF' }} /> Added</span>
        <span>Drag the circle&apos;s edge to adjust radius</span>
      </div>
    </div>
  )
}
