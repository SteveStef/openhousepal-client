'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Landmark } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import api from '@/lib/api-service'
import BoundaryCanvas, { CanvasBadge, CanvasShape } from './BoundaryCanvas'

// One home on a map with the real lines around it (user, 10/18): the township / borough / city it
// sits in, the ones it borders, and its school district - drawn by the same animated BoundaryCanvas
// as the IDX town map. Used by every property map (Showcase home details, IDX property page, Guest
// Pass, Spotlight). The lines are free Census data (backend boundary_service.home_areas, saved once
// and shared); the Google map itself is what costs, so it only loads when the visitor scrolls near it.

type Shape = { name: string; geoid: string; rings: number[][][] }
type Areas = { municipality: Shape | null; neighbors: Shape[]; school_districts: Shape[] }
type Layer = 'town' | 'schools'

const NEIGHBOR = '#64748b'
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

const kindOf = (name: string) => name.match(/(Township|Borough|Town|City|Village)$/i)?.[1] || ''
const bare = (name: string) => name.replace(/\s+(Township|Borough|Town|City|Village)$/i, '')
const shortDistrict = (name: string) => name.replace(/\s+(School District|Sch Dist|SD)$/i, '').replace(/\s+Area$/i, ' Area')

export default function HomeAreaMap({ latitude, longitude, address, accent = '#C9A24D', dark: darkProp, className = 'h-full w-full', rounded = 'rounded-2xl' }: {
  latitude: number
  longitude: number
  address?: string | null
  /** The page's accent (pin + the home's own township line). */
  accent?: string
  /** Force light / dark; otherwise follows the page (<html class="dark">). */
  dark?: boolean
  className?: string
  rounded?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [areas, setAreas] = useState<Areas | null>(null)
  const [layer, setLayer] = useState<Layer>('town')
  const [failed, setFailed] = useState(false)
  const [pageDark, setPageDark] = useState(false)
  const dark = darkProp ?? pageDark

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
        zoomControl: true, gestureHandling: 'cooperative', styles: dark ? DARK : LIGHT,
      })
      new google.maps.Marker({
        map: m, position: { lat: latitude, lng: longitude }, title: address || 'Property location', zIndex: 999,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: accent, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 },
      })
      setMap(m)
    }).catch(() => { if (!cancelled) setFailed(true) })
    api.properties.homeAreasPublic(latitude, longitude).then(r => { if (!cancelled && r.success && r.data) setAreas(r.data) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, latitude, longitude])

  useEffect(() => { map?.setOptions({ styles: dark ? DARK : LIGHT }) }, [map, dark])

  const muni = areas?.municipality || null
  const neighbors = areas?.neighbors || []
  const districts = areas?.school_districts || []
  const layers = ([
    muni ? { id: 'town' as const, label: kindOf(muni.name) ? `${kindOf(muni.name)} lines` : 'Town lines', icon: Landmark } : null,
    districts.length ? { id: 'schools' as const, label: 'School district', icon: GraduationCap } : null,
  ].filter(Boolean)) as { id: Layer; label: string; icon: typeof Landmark }[]
  const active: Layer = layers.some(l => l.id === layer) ? layer : (layers[0]?.id || 'town')

  const shapes: CanvasShape[] = useMemo(() => {
    if (active === 'schools') return districts.map((d, i) => ({ id: `sd:${d.geoid}`, rings: d.rings, color: DISTRICTS[i % DISTRICTS.length], fill: 0.13, width: 3 }))
    if (!muni) return []
    return [
      ...neighbors.map(n => ({ id: `nb:${n.geoid}`, rings: n.rings, color: NEIGHBOR, fill: 0.035, width: 1.5 })),
      { id: `mu:${muni.geoid}`, rings: muni.rings, color: accent, fill: 0.14, width: 3.5 },
    ]
  }, [active, muni, neighbors, districts, accent])

  const badges: CanvasBadge[] = useMemo(() => {
    if (active === 'schools') return districts.map((d, i) => ({ id: `b:sd:${d.geoid}`, shapeId: `sd:${d.geoid}`, title: shortDistrict(d.name), sub: 'School district', color: DISTRICTS[i % DISTRICTS.length], icon: 'school' as const }))
    if (!muni) return []
    return [
      { id: `b:mu:${muni.geoid}`, shapeId: `mu:${muni.geoid}`, title: bare(muni.name), sub: `${kindOf(muni.name) || 'Town'} · this home`, color: accent, icon: 'gov' as const },
      ...neighbors.map(n => ({ id: `b:nb:${n.geoid}`, shapeId: `nb:${n.geoid}`, title: bare(n.name), color: NEIGHBOR, icon: 'gov' as const, small: true })),
    ]
  }, [active, muni, neighbors, districts, accent])

  // Camera: the home's own township (or district), the home always in view.
  useEffect(() => {
    if (!map) return
    const focus = active === 'schools' ? districts : muni ? [muni] : []
    if (!focus.length) return
    const b = new google.maps.LatLngBounds()
    focus.forEach(s => s.rings.forEach(r => r.forEach(([lng, lat]) => b.extend({ lat, lng }))))
    b.extend({ lat: latitude, lng: longitude })
    map.fitBounds(b, { top: 52, bottom: 8, left: 8, right: 8 })
  }, [map, active, muni, districts, latitude, longitude])

  if (failed) return <div className={`${className} flex items-center justify-center text-sm text-gray-400 dark:text-gray-500`}>Map unavailable right now.</div>
  return (
    <div ref={boxRef} className={`relative overflow-hidden ${rounded} ${className}`}>
      <div ref={divRef} className="h-full w-full" />
      <BoundaryCanvas map={map} shapes={shapes} badges={badges} dark={dark} animKey={active} avoid={[{ lat: latitude, lng: longitude }]} />
      {layers.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2.5">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-auto flex gap-1 rounded-full border p-1 shadow-lg backdrop-blur-sm ${dark ? 'border-white/10 bg-[#141416]/85' : 'border-black/[0.06] bg-white/90'}`}>
            {layers.map(l => (
              <button key={l.id} type="button" onClick={() => setLayer(l.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-colors ${active === l.id ? 'text-[#111827]' : dark ? 'text-gray-300' : 'text-gray-500'}`}>
                {active === l.id && <motion.span layoutId={`home-area-pill-${latitude}-${longitude}`} className="absolute inset-0 rounded-full" style={{ backgroundColor: accent }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <l.icon className="relative h-3.5 w-3.5" /><span className="relative whitespace-nowrap">{l.label}</span>
              </button>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  )
}
