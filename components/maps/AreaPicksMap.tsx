'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import api from '@/lib/api-service'
import BoundaryCanvas, { CanvasBadge, CanvasShape } from './BoundaryCanvas'

// The towns / school districts a client just picked for their search, drawn with their real lines
// (user, 10/18: "when they fill in a city it shows its exact border on the map" - client-facing, so
// it should explain itself). Same Census lines and animated BoundaryCanvas as the agent's Showcase
// editor; appears only once something is picked.

type Shape = { kind: 'town' | 'township' | 'school_district' | 'county'; label: string; query: string; rings: number[][][] }
const TOWNSHIP = ['#0d9488', '#0891b2', '#4f46e5']
type Dot = { id: string; lat: number; lng: number }
const MAX_DOTS = 160
// a steady sample (the same homes stay as the search changes - dots drop out, they don't reshuffle)
const rank = (id: string) => { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const DOT_CSS = `.ohp-home-dot{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:9999px;background:var(--c);box-shadow:0 0 0 2px var(--ring),0 1px 3px rgba(0,0,0,.35);animation:ohpHomeDotIn .45s cubic-bezier(.3,1.6,.5,1) both;pointer-events:none}@keyframes ohpHomeDotIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}@media (prefers-reduced-motion:reduce){.ohp-home-dot{animation:none}}`

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

/** The matching homes as small dots, in one plain overlay layer (no per-dot animation library - a CSS pop-in, so a
 *  few hundred stay smooth on a phone). Redrawn only when the map's zoom changes; panning moves the layer itself. */
function HomeDots({ map, points, color, dark }: { map: google.maps.Map | null; points: Dot[]; color: string; dark: boolean }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [proj, setProj] = useState<google.maps.MapCanvasProjection | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!map) return
    class Layer extends google.maps.OverlayView {
      div = document.createElement('div')
      onAdd() { this.div.style.position = 'absolute'; this.getPanes()?.overlayLayer.appendChild(this.div); setLayer(this.div) }
      draw() { setProj(this.getProjection()); setTick(t => t + 1) }
      onRemove() { this.div.remove(); setLayer(null) }
    }
    const ov = new Layer()
    ov.setMap(map)
    return () => ov.setMap(null)
  }, [map])
  const shown = useMemo(() => [...points].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, MAX_DOTS), [points])
  if (!layer || !proj) return null
  return createPortal(
    <>
      <style>{DOT_CSS}</style>
      {shown.map((p, i) => {
        const xy = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng))
        if (!xy) return null
        return <span key={p.id} className="ohp-home-dot" data-testid="map-home-dot"
          style={{ left: xy.x, top: xy.y, animationDelay: `${Math.min(i, 80) * 9}ms`, ['--c' as any]: color, ['--ring' as any]: dark ? '#18181b' : '#fff' }} />
      })}
    </>, layer)
}

export default function AreaPicksMap({ cities, townships = [], schoolDistricts, className = 'h-56 sm:h-64', accent, points, count, counting = false, atLimit = false }: {
  cities: string[]
  /** Townships picked (their Census lines - owner, 11/19) */
  townships?: string[]
  /** The homes the search matches right now (the live preview) - drawn as dots, with the count on the map */
  points?: Dot[]
  count?: number | null
  counting?: boolean
  atLimit?: boolean
  schoolDistricts: string[]
  className?: string
  /** The page's own colour for the first town (an agent's IDX site); our gold otherwise. */
  accent?: string
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [dark, setDark] = useState(false)
  const key = JSON.stringify([cities, townships, schoolDistricts])
  const any = cities.length + townships.length + schoolDistricts.length > 0

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
      api.properties.areaShapesPublic({ cities, townships, school_districts: schoolDistricts })
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
    const color = s.kind === 'school_district' ? DISTRICT[n % DISTRICT.length] : s.kind === 'township' ? TOWNSHIP[n % TOWNSHIP.length] : towns[n % towns.length]
    return { id: `${s.kind}:${s.query}`, rings: s.rings, color, fill: 0.13, width: 3 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shapes, accent])
  const badges: CanvasBadge[] = useMemo(() => shapes.map((s, i) => ({
    id: `b:${s.kind}:${s.query}`, shapeId: `${s.kind}:${s.query}`, title: nice(s.query),
    sub: s.kind === 'school_district' ? 'School district' : s.kind === 'county' ? 'County' : s.kind === 'township' ? 'Township' : 'Town',
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
            {points && <HomeDots map={map} points={points} color={accent || '#C9A24D'} dark={dark} />}
            {count != null && (
              <div className="pointer-events-none absolute left-2.5 top-2.5 z-[5] flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-black text-[#111827] shadow-[0_6px_16px_-8px_rgba(0,0,0,.5)] ring-1 ring-black/5 dark:bg-[#18181b]/95 dark:text-white dark:ring-white/10" data-testid="map-match-count">
                <span className={`h-2 w-2 rounded-full bg-[#C9A24D] ${counting ? 'animate-pulse' : ''}`} />
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={counting ? 'c' : count} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.18 }}>
                    {counting ? 'Counting…' : `${count}${atLimit ? '+' : ''} ${count === 1 && !atLimit ? 'home matches' : 'homes match'}`}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-gray-400">The exact lines of what you picked - homes inside them are the ones you’ll see.</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
