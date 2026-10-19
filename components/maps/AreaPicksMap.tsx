'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import api from '@/lib/api-service'
import BoundaryCanvas, { CanvasBadge, CanvasShape } from './BoundaryCanvas'

// The towns / school districts a client just picked for their search, drawn with their real lines
// (user, 10/18: "when they fill in a city it shows its exact border on the map" - client-facing, so
// it should explain itself). Same Census lines and animated BoundaryCanvas as the agent's Showcase
// editor; appears only once something is picked.

type Shape = { kind: 'town' | 'school_district' | 'county'; label: string; query: string; rings: number[][][] }
const TOWN = ['#C9A24D', '#d97706', '#b45309']
const DISTRICT = ['#2563eb', '#7c3aed', '#059669']
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
  { featureType: 'water', stylers: [{ color: '#0f1720' }] },
]
const nice = (v: string) => v.split(',')[0].toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())
  .replace(/\s+(School District|Sch Dist|SD)$/i, '')

export default function AreaPicksMap({ cities, schoolDistricts, className = 'h-56 sm:h-64', accent }: {
  cities: string[]
  schoolDistricts: string[]
  className?: string
  /** The page's own colour for the first town (an agent's IDX site); our gold otherwise. */
  accent?: string
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [dark, setDark] = useState(false)
  const key = JSON.stringify([cities, schoolDistricts])
  const any = cities.length + schoolDistricts.length > 0

  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    if (!any) { setShapes([]); return }
    let cancelled = false
    const t = setTimeout(() => {
      api.properties.areaShapesPublic({ cities, school_districts: schoolDistricts })
        .then(r => { if (!cancelled) setShapes((r.data?.shapes || []) as Shape[]) })
        .catch(() => {})
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { if (!shapes.length) setMap(null) }, [shapes])   // the map box leaves with the last pick

  useEffect(() => {
    if (!shapes.length || map || !divRef.current) return
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !divRef.current) return
      const first = shapes[0].rings[0][0]
      setMap(new google.maps.Map(divRef.current, {
        center: { lat: first[1], lng: first[0] }, zoom: 11, disableDefaultUI: true, zoomControl: true,
        clickableIcons: false, gestureHandling: 'cooperative', styles: dark ? DARK : LIGHT,
      }))
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes])

  useEffect(() => { map?.setOptions({ styles: dark ? DARK : LIGHT }) }, [map, dark])

  useEffect(() => {
    if (!map || !shapes.length) return
    const b = new google.maps.LatLngBounds()
    shapes.forEach(s => s.rings.forEach(r => r.forEach(([lng, lat]) => b.extend({ lat, lng }))))
    map.fitBounds(b, 20)
  }, [map, shapes])

  const canvasShapes: CanvasShape[] = useMemo(() => shapes.map((s, i) => {
    const n = shapes.slice(0, i).filter(x => x.kind === s.kind).length
    const towns = accent ? [accent, ...TOWN.slice(1)] : TOWN
    const color = s.kind === 'school_district' ? DISTRICT[n % DISTRICT.length] : towns[n % towns.length]
    return { id: `${s.kind}:${s.query}`, rings: s.rings, color, fill: 0.13, width: 3 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shapes, accent])
  const badges: CanvasBadge[] = useMemo(() => shapes.map((s, i) => ({
    id: `b:${s.kind}:${s.query}`, shapeId: `${s.kind}:${s.query}`, title: nice(s.query),
    sub: s.kind === 'school_district' ? 'School district' : s.kind === 'county' ? 'County' : 'Town',
    color: canvasShapes[i].color, icon: s.kind === 'school_district' ? 'school' as const : 'town' as const,
  })), [shapes, canvasShapes])

  return (
    <AnimatePresence initial={false}>
      {any && shapes.length > 0 && (
        <motion.div key="area-map" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="overflow-hidden">
          <div className={`relative overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.07] ${className}`}>
            <div ref={divRef} className="h-full w-full" />
            <BoundaryCanvas map={map} shapes={canvasShapes} badges={badges} dark={dark} animKey={key} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-gray-400">The exact lines of what you picked - homes inside them are the ones you’ll see.</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
