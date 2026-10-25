'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Landmark } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import api from '@/lib/api-service'
import BoundaryCanvas, { CanvasBadge, CanvasMarker, CanvasShape } from './BoundaryCanvas'

// One home on a map with the real lines around it (user, 10/18): the township / borough / city it
// sits in, the ones it borders, and its school district - drawn by the same animated BoundaryCanvas
// as the IDX town map. Used by every property map (Showcase home details, IDX property page, Guest
// Pass, Spotlight). The lines are free Census data (backend boundary_service.home_areas, saved once
// and shared); the Google map itself is what costs, so it only loads when the visitor scrolls near it.

type Shape = { name: string; geoid: string; rings: number[][][] }
type Areas = { municipality: Shape | null; neighbors: Shape[]; school_districts: Shape[] }
type Layer = 'town' | 'schools'

const DISTRICTS = ['#2563eb', '#059669', '#7c3aed']
const LIGHT: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#c9dcea' }] },
  { featureType: 'landscape', stylers: [{ color: '#f3f2ee' }] },
]
const DARK: google.maps.MapTypeStyle[] = [
  ...LIGHT.slice(0, 3),
  { elementType: 'geometry', stylers: [{ color: '#1d2027' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0aa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2027' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c313b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a404c' }] },
  { featureType: 'water', stylers: [{ color: '#0f1720' }] },
  { featureType: 'landscape', stylers: [{ color: '#1d2027' }] },
]

const kindOf = (name: string) => name.match(/(Township|Borough|Town|City|Village|County)$/i)?.[1] || ''
const shortDistrict = (name: string) => name.replace(/\s+(School District|Sch Dist|SD)$/i, '').replace(/\s+Area$/i, ' Area')

export default function HomeAreaMap({ latitude, longitude, accent: accentProp = '#C9A24D', dark: darkProp, className = 'h-full w-full', rounded = 'rounded-2xl', places, activePlace, onActivePlace, showHome = true, homeLabel, holdCamera = false, gestures = 'cooperative' }: {
  latitude: number
  longitude: number
  address?: string | null
  /** The page's accent (pin + the home's own township line) - a colour, or var(--x) of the page. */
  accent?: string
  /** Force light / dark; otherwise follows the page (<html class="dark">). */
  dark?: boolean
  className?: string
  rounded?: string
  /** Explore Nearby's places for the picked category - numbered pins; the map frames them + the home. */
  places?: CanvasMarker[]
  activePlace?: string | null
  onActivePlace?: (id: string | null) => void
  /** The house marker at the point (off for a town page, where the point is the town, not a home). */
  showHome?: boolean
  homeLabel?: string
  /** A category's places are on their way - leave the camera where it is until they land (one
   *  smooth move, not a jump back to the township and then out to the places). */
  holdCamera?: boolean
  /** 'cooperative' = two fingers to move on a phone (the page scrolls past it); 'greedy' = one. */
  gestures?: 'cooperative' | 'greedy'
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [failed, setFailed] = useState(false)
  const [pageDark, setPageDark] = useState(false)
  const dark = darkProp ?? pageDark
  const [accent, setAccent] = useState(accentProp.startsWith('var(') ? '#C9A24D' : accentProp)
  useEffect(() => {
    const v = /^var\((--[\w-]+)\)$/.exec(accentProp)
    if (!v) { setAccent(accentProp); return }
    const got = boxRef.current ? getComputedStyle(boxRef.current).getPropertyValue(v[1]).trim() : ''
    if (got) setAccent(got)
  }, [accentProp])

  useEffect(() => {
    if (darkProp !== undefined) return
    const read = () => setPageDark(document.documentElement.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [darkProp])

  // Only once it's (nearly) on screen - a map nobody scrolls to costs nothing.
  useEffect(() => {
    const el = boxRef.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !divRef.current) return
      const m = new google.maps.Map(divRef.current, {
        center: { lat: latitude, lng: longitude }, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
        zoomControl: true, gestureHandling: gestures, styles: dark ? DARK : LIGHT,
      })
      setMap(m)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, latitude, longitude])

  useEffect(() => { map?.setOptions({ styles: dark ? DARK : LIGHT }) }, [map, dark])

  const placed = className.split(' ').includes('absolute')   // the caller positions the box itself
  if (failed) return <div className={`${className} flex items-center justify-center text-sm text-gray-400 dark:text-gray-500`}>Map unavailable right now.</div>
  return (
    <div ref={boxRef} className={`${placed ? '' : 'relative'} overflow-hidden ${rounded} ${className}`}>
      <div ref={divRef} className="h-full w-full" />
      <HomeAreaOverlay map={map} latitude={latitude} longitude={longitude} accent={accent} dark={dark} showHome={showHome} label={homeLabel}
        markers={places} activeMarker={activePlace} onActiveMarker={onActivePlace} holdCamera={holdCamera} />
    </div>
  )
}

type Bounds = { n: number; s: number; e: number; w: number }
function boundsOfShapes(shapes: Shape[]): Bounds | null {
  let n = -90, s = 90, e = -180, w = 180, any = false
  shapes.forEach(sh => sh.rings.forEach(r => r.forEach(([lng, lat]) => {
    any = true; if (lat > n) n = lat; if (lat < s) s = lat; if (lng > e) e = lng; if (lng < w) w = lng
  })))
  return any ? { n, s, e, w } : null
}
const spanOf = (b: Bounds | null) => (b ? (b.n - b.s) * (b.e - b.w) : 0)

/** The lines + the layer switch, on any Google map already showing this home (HomeAreaMap's own,
 *  or the CMA's comparables map - fit={false} leaves that map's framing alone). Sits in the map's
 *  positioned box. */
export function HomeAreaOverlay({ map, latitude, longitude, accent = '#C9A24D', dark = false, fit = true, showHome = false, label, markers, activeMarker, onActiveMarker, holdCamera = false }: {
  map: google.maps.Map | null
  latitude: number
  longitude: number
  accent?: string
  dark?: boolean
  fit?: boolean
  /** Draw the home as a little house with "This home" under it (the CMA map has its own S pin). */
  showHome?: boolean
  label?: string
  markers?: CanvasMarker[]
  activeMarker?: string | null
  onActiveMarker?: (id: string | null) => void
  /** Places are loading - keep the camera still until they're in. */
  holdCamera?: boolean
}) {
  const [areas, setAreas] = useState<Areas | null>(null)
  // `layer` = the switch (moves the moment it's tapped); `shown` = the lines actually drawn, which
  // follow it through the switch animation below (null = between the two, old line fading out).
  const [layer, setLayer] = useState<Layer>('town')
  const [shown, setShown] = useState<Layer | null>('town')
  const switching = useRef(0)

  useEffect(() => {
    if (!map) return
    let cancelled = false
    api.properties.homeAreasPublic(latitude, longitude).then(r => { if (!cancelled && r.success && r.data) setAreas(r.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [map, latitude, longitude])

  const muni = areas?.municipality || null
  const districts = useMemo(() => areas?.school_districts || [], [areas])
  const layers = ([
    muni ? { id: 'town' as const, label: kindOf(muni.name) ? `${kindOf(muni.name)} lines` : 'Town lines', icon: Landmark } : null,
    districts.length ? { id: 'schools' as const, label: 'School district', icon: GraduationCap } : null,
  ].filter(Boolean)) as { id: Layer; label: string; icon: typeof Landmark }[]
  const valid = (l: Layer | null) => (l && layers.some(x => x.id === l) ? l : null)
  const active: Layer = valid(layer) || layers[0]?.id || 'town'
  const drawn: Layer | null = shown === null ? null : valid(shown) || active

  const shapes: CanvasShape[] = useMemo(() => {
    if (drawn === 'schools') return districts.map((d, i) => ({ id: `sd:${d.geoid}`, rings: d.rings, color: DISTRICTS[i % DISTRICTS.length], fill: 0.13, width: 3 }))
    if (drawn !== 'town' || !muni) return []
    return [{ id: `mu:${muni.geoid}`, rings: muni.rings, color: accent, fill: 0.12, width: 3 }]
  }, [drawn, muni, districts, accent])

  const badges: CanvasBadge[] = useMemo(() => {
    if (drawn === 'schools') return districts.map((d, i) => ({ id: `b:sd:${d.geoid}`, shapeId: `sd:${d.geoid}`, title: shortDistrict(d.name), color: DISTRICTS[i % DISTRICTS.length], icon: 'school' as const }))
    if (drawn !== 'town' || !muni) return []
    return [{ id: `b:mu:${muni.geoid}`, shapeId: `mu:${muni.geoid}`, title: muni.name, short: muni.name.replace(/\s+(Township|Borough|Town|City|Village|County)$/i, ''), color: accent, icon: 'gov' as const }]
  }, [drawn, muni, districts, accent])

  const focusOf = useCallback((l: Layer) => (l === 'schools' ? districts : muni ? [muni] : []), [districts, muni])
  // The area + the home - the house pin is always in the frame.
  const frame = useCallback((l: Layer) => {
    if (!map) return
    const focus = focusOf(l)
    if (!focus.length) return
    const b = new google.maps.LatLngBounds()
    focus.forEach(s => s.rings.forEach(r => r.forEach(([lng, lat]) => b.extend({ lat, lng }))))
    b.extend({ lat: latitude, lng: longitude })
    map.fitBounds(b, { top: 52, bottom: 8, left: 8, right: 8 })
  }, [map, focusOf, latitude, longitude])

  // Camera: the home's own township (or district). With nearby places showing, the home + those
  // places instead (and back to the area when they're cleared). Not on a layer switch - that one
  // moves the camera itself (switchTo).
  const placesKey = (markers || []).map(m => m.id).join('|')
  const layerRef = useRef<Layer>(active)
  layerRef.current = active
  useEffect(() => {
    if (!map || !fit || holdCamera) return
    if (markers?.length) {
      const b = new google.maps.LatLngBounds()
      markers.forEach(mk => b.extend({ lat: mk.lat, lng: mk.lng }))
      b.extend({ lat: latitude, lng: longitude })
      map.fitBounds(b, { top: 64, bottom: 28, left: 28, right: 28 })
      return
    }
    frame(layerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fit, muni, districts, latitude, longitude, placesKey, holdCamera])

  // Township lines <-> school district lines (user, 10/24): to a bigger area - zoom out first, then
  // the old line fades and the new one draws itself in, then its name; to a smaller one - the old
  // line fades, the map zooms in, then the new line draws. The home stays in view throughout.
  const switchTo = (next: Layer) => {
    if (next === active && shown === next) return
    setLayer(next)
    const run = ++switching.current
    const alive = () => switching.current === run
    if (!map || !fit || markers?.length) { setShown(next); return }
    const afterMove = (cb: () => void) => {
      let done = false
      const go = () => { if (done) return; done = true; if (alive()) cb() }
      google.maps.event.addListenerOnce(map, 'idle', go)
      window.setTimeout(go, 900) // the view did not need to move (no idle)
    }
    const bigger = spanOf(boundsOfShapes(focusOf(next))) > spanOf(boundsOfShapes(focusOf(active)))
    if (bigger) {
      frame(next)
      afterMove(() => setShown(next))
    } else {
      setShown(null)
      window.setTimeout(() => {
        if (!alive()) return
        frame(next)
        afterMove(() => setShown(next))
      }, 360)
    }
  }

  // A place tapped (on the map or in the list): the map glides to it, set a little low so its card
  // opens above it in the clear - never under the township / district switch.
  useEffect(() => {
    if (!map || !activeMarker) return
    const mk = (markers || []).find(m => m.id === activeMarker)
    if (!mk) return
    const proj = map.getProjection()
    const z = map.getZoom()
    const target = new google.maps.LatLng(mk.lat, mk.lng)
    if (!proj || z == null) { map.panTo(target); return }
    const pt = proj.fromLatLngToPoint(target)
    if (!pt) { map.panTo(target); return }
    const h = map.getDiv().clientHeight || 300
    const lift = Math.min(120, h * 0.2) / 2 ** z
    const c = proj.fromPointToLatLng(new google.maps.Point(pt.x, pt.y - lift))
    map.panTo(c || target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeMarker])

  return (
    <>
      <BoundaryCanvas map={map} shapes={shapes} badges={badges} dark={dark} animKey={drawn || 'none'} avoid={[{ lat: latitude, lng: longitude }]} topInset={layers.length ? 58 : 14}
        drawSeconds={switching.current ? 0.75 : 1.3}
        markers={markers || []} activeMarker={activeMarker} onActiveMarker={onActiveMarker}
        home={showHome ? { lat: latitude, lng: longitude, color: accent, label } : null} />
      {layers.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2.5">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto flex gap-1 rounded-full border p-1 shadow-lg ${dark ? 'border-white/10 bg-[#141416]/95' : 'border-black/[0.06] bg-white/95'}`}>
            {layers.map(l => (
              <button key={l.id} type="button" onClick={() => switchTo(l.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-colors ${active === l.id ? 'text-[#111827]' : dark ? 'text-gray-300' : 'text-gray-500'}`}>
                {active === l.id && <motion.span layoutId={`home-area-pill-${latitude}-${longitude}`} className="absolute inset-0 rounded-full" style={{ backgroundColor: accent }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <l.icon className="relative h-3.5 w-3.5" /><span className="relative whitespace-nowrap">{l.label}</span>
              </button>
            ))}
          </motion.div>
        </div>
      )}
    </>
  )
}
