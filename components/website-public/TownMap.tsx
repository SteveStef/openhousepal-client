'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GraduationCap, Landmark, MapPinned } from 'lucide-react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import BoundaryCanvas, { CanvasBadge, CanvasMarker, CanvasShape } from '@/components/maps/BoundaryCanvas'
import SiteLoader from './SiteLoader'

// Town page, Overview: the real lines behind the town name (backend town_map_service, from the
// U.S. Census + NCES) - the town's own area, the local governments it overlaps, and its school
// districts with every public school (and the private schools around it). Drawn by the shared
// animated BoundaryCanvas: lines draw in, each area's badge finds room inside its own lines and
// never sits on a school, and the camera glides to whatever the visitor picks.
type Shape = { name: string; share: number; rings: number[][][]; kind?: string; geoid?: string }
type SchoolPt = { id: string; name: string; lat: number; lng: number; leaid?: string; level?: string | null; grades?: string | null; charter?: boolean; in_town?: boolean }
export interface TownBoundaries {
  outline?: { label: string; kind: 'zip' | 'township' | 'neighborhood'; rings: number[][][] } | null
  municipalities?: Shape[]
  school_districts?: Shape[]
  schools?: { public?: SchoolPt[]; private?: SchoolPt[] }
}
type Layer = 'area' | 'munis' | 'schools'

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2']
const PRIVATE = '#e11d48'
const LIGHT = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#c9dcea' }] },
  { featureType: 'landscape', stylers: [{ color: '#f3f2ee' }] },
]
const DARK = [
  ...LIGHT.slice(0, 3),
  { elementType: 'geometry', stylers: [{ color: '#1d2027' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0aa' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2027' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c313b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a404c' }] },
  { featureType: 'water', stylers: [{ color: '#0f1b29' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a404c' }] },
]

// "Unincorporated X County" has no shape of its own (it's everything outside the town lines) - grey.
const colorOf = (s: Shape, i: number): string => (s.rings?.length ? COLORS[i % COLORS.length] : '#9ca3af')
export const shortDistrict = (n: string) => n.replace(/\s*(School District|Public Schools|Schools|Unified District|District)\s*$/i, '').replace(/^(The )?School District of (the )?/i, '').trim() || n
const glyphOf = (s: SchoolPt) => {
  const l = (s.level || '').toLowerCase()
  if (l.startsWith('elem') || l.startsWith('prim')) return 'E'
  if (l.startsWith('mid')) return 'M'
  if (l.startsWith('high') || l.startsWith('second')) return 'H'
  return (s.grades || '').includes('12') ? 'H' : 'S'
}
const LEVEL = { E: 'Elementary', M: 'Middle school', H: 'High school', S: 'School', P: 'Private' } as Record<string, string>
// Even-odd point-in-polygon over Census [lng, lat] rings (holes cancel out).
const inRings = (rings: number[][][], lng: number, lat: number) => {
  let inside = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[i], [bx, by] = r[j]
      if ((ay > lat) !== (by > lat) && lng < ((bx - ax) * (lat - ay)) / ((by - ay) || 1e-9) + ax) inside = !inside
    }
  }
  return inside
}
// Schools by district (owner, 10/27: no town-wide "all schools" switch - each district gets its own
// Public / Private switch). Public schools by their NCES district (leaid); private schools have no
// district, so each goes under the district whose real lines it sits inside. Anything past every
// line is "just outside".
type SchoolGroup = { key: string; district: Shape | null; color: string; pub: SchoolPt[]; pri: SchoolPt[] }

export default function TownMap({ data, town, luxe }: { data?: TownBoundaries | null; town: string; luxe: boolean }) {
  const munis = useMemo(() => data?.municipalities || [], [data])
  const districts = useMemo(() => data?.school_districts || [], [data])
  const outline = data?.outline || null
  const publicSchools = useMemo(() => data?.schools?.public || [], [data])
  const privateSchools = useMemo(() => data?.schools?.private || [], [data])
  const govLabel = munis.every(m => /township$/i.test(m.name)) ? (munis.length > 1 ? 'Townships' : 'Township') : 'Local government'
  const layers = ([
    outline ? { id: 'area', label: outline.kind === 'zip' ? `${town} area` : town, icon: MapPinned } : null,
    munis.length ? { id: 'munis', label: govLabel, icon: Landmark } : null,
    districts.length ? { id: 'schools', label: 'Schools', icon: GraduationCap } : null,
  ].filter(Boolean)) as { id: Layer; label: string; icon: any }[]
  // A town split across school districts or townships opens on that split - it's the thing people don't know.
  const [layer, setLayer] = useState<Layer>(districts.length > 1 ? 'schools' : munis.length > 1 ? 'munis' : layers[0]?.id || 'area')
  // Which district's Public / Private switch is on ("<group key>|pub"). Nothing until the visitor picks.
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [hover, setHover] = useState<string | null>(null)
  const [activeSchool, setActiveSchool] = useState<string | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [dark, setDark] = useState(false)
  const [accent, setAccent] = useState('#c9a24d')
  const [failed, setFailed] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)

  const all = useMemo(() => outline?.rings || munis.flatMap(m => m.rings), [outline, munis])

  // The map, once.
  useEffect(() => {
    if (!divRef.current || !all.length) return
    let cancelled = false
    let observer: MutationObserver | null = null
    googleMapsLoader.load().then(() => {
      if (cancelled || !divRef.current) return
      const shell = document.getElementById('ohp-site-shell')
      const isDark = () => shell?.getAttribute('data-mode') === 'dark'
      setAccent(getComputedStyle(divRef.current).getPropertyValue('--site-accent').trim() || '#c9a24d')
      const m = new google.maps.Map(divRef.current, {
        center: { lat: all[0][0][1], lng: all[0][0][0] }, zoom: 12,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
        zoomControl: true, gestureHandling: 'cooperative', styles: isDark() ? DARK : LIGHT,
      })
      m.addListener('click', () => setActiveSchool(null))
      setDark(isDark())
      if (shell) {
        observer = new MutationObserver(() => { m.setOptions({ styles: isDark() ? DARK : LIGHT }); setDark(isDark()) })
        observer.observe(shell, { attributes: true, attributeFilter: ['data-mode'] })
      }
      setMap(m)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; observer?.disconnect() }
  }, [all])

  const listShapes: Shape[] = layer === 'munis' ? munis : layer === 'schools' ? districts : []

  const groups: SchoolGroup[] = useMemo(() => {
    const placed = new Set<string>()
    const out: SchoolGroup[] = districts.map((d, i) => {
      // An elementary + a high school district can overlap - a private school goes under the first.
      const pri = d.rings?.length ? privateSchools.filter(s => !placed.has(s.id) && inRings(d.rings, s.lng, s.lat)) : []
      pri.forEach(s => placed.add(s.id))
      return { key: d.geoid || d.name, district: d, color: colorOf(d, i), pub: publicSchools.filter(s => !!d.geoid && s.leaid === d.geoid), pri }
    })
    const pubLeft = publicSchools.filter(s => !districts.some(d => d.geoid && d.geoid === s.leaid))
    const priLeft = privateSchools.filter(s => !placed.has(s.id))
    if (pubLeft.length || priLeft.length) out.push({ key: 'outside', district: null, color: '#475569', pub: pubLeft, pri: priLeft })
    return out
  }, [districts, publicSchools, privateSchools])

  const markers: CanvasMarker[] = useMemo(() => {
    if (layer !== 'schools') return []
    return groups.flatMap(gr => [
      ...(shown[`${gr.key}|pub`] ? gr.pub.map(s => {
        const g = glyphOf(s)
        return {
          id: `pub:${s.id}`, lat: s.lat, lng: s.lng, kind: 'public' as const, color: gr.color, glyph: g, title: s.name,
          lines: [[LEVEL[g], s.grades ? `Grades ${s.grades}` : ''].filter(Boolean).join(' · '), gr.district ? `${shortDistrict(gr.district.name)} district${s.charter ? ' · Charter' : ''}` : (s.charter ? 'Charter' : '')],
        }
      }) : []),
      ...(shown[`${gr.key}|pri`] ? gr.pri.map(s => ({
        id: `pri:${s.id}`, lat: s.lat, lng: s.lng, kind: 'private' as const, color: PRIVATE, glyph: 'P', title: s.name,
        lines: [s.grades ? `Grades ${s.grades}` : 'Private / independent', gr.district ? `Inside the ${shortDistrict(gr.district.name)} district lines` : ''].filter(Boolean),
      })) : []),
    ])
  }, [layer, shown, groups])
  const shownKey = markers.map(m => m.id).join(',')

  const shapes: CanvasShape[] = useMemo(() => {
    const out: CanvasShape[] = listShapes.filter(s => s.rings?.length).map((s, i) => ({ id: `${layer}:${s.name}`, rings: s.rings, color: colorOf(s, i), fill: 0.12 }))
    if (outline) {
      out.push(layer === 'area'
        ? { id: 'area:outline', rings: outline.rings, color: accent, fill: 0.16, width: 3.5 }
        : { id: 'outline', rings: outline.rings, color: accent, dashed: true, width: 3 })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, outline, munis, districts, accent])

  const badges: CanvasBadge[] = useMemo(() => {
    if (layer === 'area') return outline ? [{ id: 'b:area', shapeId: 'area:outline', title: town, sub: outline.kind === 'zip' ? outline.label : 'Town area', color: accent, icon: 'town' as const }] : []
    return listShapes.filter(s => s.rings?.length).map((s, i) => ({
      id: `b:${layer}:${s.name}`, shapeId: `${layer}:${s.name}`,
      title: layer === 'schools' ? shortDistrict(s.name) : s.name.replace(/\s+(Township|Borough|Town|City|Village)$/i, ''),
      sub: layer === 'schools'
        ? `${s.kind === 'elementary' ? 'Elementary district' : s.kind === 'secondary' ? 'High school district' : 'School district'} · ${s.share}%`
        : `${s.name.match(/(Township|Borough|Town|City|Village)$/i)?.[1] || 'Local government'} · ${s.share}%`,
      color: colorOf(s, i), icon: layer === 'schools' ? 'school' as const : 'gov' as const,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, outline, munis, districts, town, accent])

  // Camera: glide to what the layer is about - the town, plus the schools switched on (so turning on
  // a district's schools brings them into view).
  useEffect(() => {
    if (!map) return
    const b = new google.maps.LatLngBounds()
    const add = (rings: number[][][]) => rings.forEach(r => r.forEach(([lng, lat]) => b.extend({ lat, lng })))
    if (outline) add(outline.rings)
    else munis.forEach(m => add(m.rings))
    markers.forEach(s => b.extend({ lat: s.lat, lng: s.lng }))
    if (!b.isEmpty()) map.fitBounds(b, { top: 76, bottom: 36, left: 36, right: 72 })
    setActiveSchool(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, layer, shownKey])
  useEffect(() => setHover(null), [layer])
  const flip = (k: string) => setShown(s => ({ ...s, [k]: !s[k] }))
  // One district's Public or Private switch - the same pill switch the panel always had, sized to sit
  // two-up under the district's name.
  const schoolSwitch = (gr: SchoolGroup, type: 'pub' | 'pri') => {
    const k = `${gr.key}|${type}`
    const n = (type === 'pub' ? gr.pub : gr.pri).length
    const c = type === 'pub' ? gr.color : PRIVATE
    const on = !!shown[k] && n > 0
    const label = type === 'pub' ? 'Public' : 'Private'
    return (
      <motion.button key={k} type="button" disabled={!n} onClick={() => flip(k)} whileTap={{ scale: 0.96 }} aria-pressed={on}
        aria-label={`${on ? 'Hide' : 'Show'} ${gr.district ? shortDistrict(gr.district.name) + ' ' : ''}${label.toLowerCase()} schools on the map`}
        className={`flex min-h-[42px] min-w-0 items-center gap-2 border px-2.5 py-1.5 text-left transition-colors disabled:opacity-40 ${luxe ? 'rounded-xl' : 'rounded-lg'}`}
        style={{ borderColor: on ? c : 'var(--site-line)', backgroundColor: on ? `${c}12` : 'var(--site-surface)' }}>
        <span className="relative flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300" style={{ backgroundColor: on ? c : 'var(--site-line-strong)' }}>
          <motion.span className="h-3 w-3 rounded-full bg-white shadow" animate={{ x: on ? 12 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5 text-[12px] font-black" style={{ color: 'var(--site-heading)' }}>
            <span className={`inline-block h-2 w-2 shrink-0 ${type === 'pri' ? 'rounded-[2px]' : 'rounded-full border-2 bg-white'}`} style={type === 'pri' ? { backgroundColor: c } : { borderColor: c }} />{label}
          </span>
          <span className="block text-[10.5px] font-semibold" style={{ color: 'var(--site-muted)' }}>{n} {n === 1 ? 'school' : 'schools'}</span>
        </span>
      </motion.button>
    )
  }
  const outside = groups.find(g => !g.district)

  if (!layers.length || failed) return null
  const round = luxe ? 'rounded-[24px]' : 'rounded-2xl'
  const note = layer === 'area'
    ? outline?.kind === 'zip'
      ? `"${town}" is a mailing address - this is the ${outline.label} area its homes use. Taxes, schools and local rules follow the lines on the other tabs, not the town name.`
      : `The outline of ${town}.`
    : layer === 'munis'
      ? 'Which local government each home falls under - it sets the property tax rate, trash pickup, zoning and permits.'
      : 'Public school assignment follows district lines (and, inside a district, the street) - not the mailing address. Private schools are listed under the district they sit in, but take students from anywhere. Always confirm the schools for a specific home with the district.'
  const sortedMarkers = [...markers].sort((a, b) => (a.kind === b.kind ? 'EMHSP'.indexOf(a.glyph) - 'EMHSP'.indexOf(b.glyph) || a.title.localeCompare(b.title) : a.kind === 'public' ? -1 : 1))

  return (
    <div className={`mt-12 overflow-hidden border ${round}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }}>
      <div className="grid lg:grid-cols-[1fr_360px]">
        <div className="relative h-[400px] sm:h-[500px] lg:h-[580px]">
          <div ref={divRef} className="h-full w-full" />
          <BoundaryCanvas map={map} shapes={shapes} markers={markers} badges={badges} dark={dark} animKey={layer} highlight={hover} activeMarker={activeSchool} onActiveMarker={setActiveSchool} />
          {/* The layer switch floats over the map */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3 sm:justify-start">
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto relative flex max-w-full gap-1 overflow-x-auto border p-1 shadow-lg ${luxe ? 'rounded-full' : 'rounded-xl'}`}
              style={{ backgroundColor: 'color-mix(in srgb, var(--site-surface) 88%, transparent)', borderColor: 'var(--site-line)' }}>
              {layers.map(l => (
                <motion.button key={l.id} type="button" onClick={() => setLayer(l.id)} whileTap={{ scale: 0.94 }}
                  className={`relative inline-flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-[11px] font-black transition-colors sm:px-3.5 sm:text-xs ${luxe ? 'rounded-full' : 'rounded-lg'}`}
                  style={{ color: layer === l.id ? 'var(--site-on-accent)' : 'var(--site-ink-soft)' }}>
                  {layer === l.id && <motion.span layoutId="ohp-townmap-pill" className={`absolute inset-0 ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'var(--site-accent)', boxShadow: '0 8px 20px -8px rgba(var(--site-accent-rgb),.8)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <l.icon className="relative hidden h-3.5 w-3.5 sm:block" /><span className="relative whitespace-nowrap">{l.id === 'area' ? <><span className="sm:hidden">Area</span><span className="hidden sm:inline">{l.label}</span></> : l.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
          <AnimatePresence>
            {!map && (
              <motion.div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--site-bg-alt)' }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <SiteLoader size="sm" label="Drawing the map" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="ohp-thin-scroll flex flex-col border-t p-5 sm:p-6 lg:max-h-[580px] lg:overflow-y-auto lg:border-l lg:border-t-0" style={{ borderColor: 'var(--site-line)' }}>
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>Map of {town}</p>
          <AnimatePresence mode="wait">
            <motion.div key={layer} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="mt-2 flex flex-1 flex-col">
              <h3 className="ohp-site-heading text-xl font-black leading-tight" style={{ color: 'var(--site-heading)' }}>
                {layer === 'area' ? `Where ${town} is` : layer === 'munis' ? `Who governs ${town}` : `Schools in and around ${town}`}
              </h3>

              {layer === 'schools' && (
                <p className="mt-1.5 text-[12px] font-semibold leading-snug" style={{ color: 'var(--site-muted)' }}>
                  Pick a district&apos;s Public or Private schools to put them on the map.
                </p>
              )}

              {listShapes.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {listShapes.map((s, i) => {
                    const id = `${layer}:${s.name}`
                    const c = colorOf(s, i)
                    const on = hover === id
                    return (
                      <motion.li key={id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i, duration: 0.35 }}
                        onMouseEnter={() => s.rings?.length && setHover(id)} onMouseLeave={() => setHover(null)}
                        className={`cursor-default border px-3.5 py-3 transition-colors ${luxe ? 'rounded-2xl' : 'rounded-xl'}`}
                        style={{ borderColor: on ? c : 'var(--site-line)', backgroundColor: on ? `${c}14` : 'transparent' }}>
                        <div className="flex items-center gap-2.5">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c }} />
                          <p className="min-w-0 flex-1 text-[13px] font-black leading-snug" style={{ color: 'var(--site-heading)' }}>{s.name}</p>
                          <span className="shrink-0 text-xs font-black tabular-nums" style={{ color: 'var(--site-heading)' }}>{s.share}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                          <motion.div className="h-full origin-left rounded-full" style={{ backgroundColor: c, width: `${s.share}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 0.1 + 0.06 * i, ease: [0.16, 1, 0.3, 1] }} />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--site-muted)' }}>
                          {s.kind === 'elementary' ? 'Elementary district · ' : s.kind === 'secondary' ? 'High school district · ' : ''}of {town} homes
                        </p>
                        {layer === 'schools' && groups[i] && (
                          <div className="mt-2.5 grid grid-cols-2 gap-2">
                            {schoolSwitch(groups[i], 'pub')}
                            {schoolSwitch(groups[i], 'pri')}
                          </div>
                        )}
                      </motion.li>
                    )
                  })}
                  {layer === 'schools' && outside && (
                    <motion.li initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * listShapes.length, duration: 0.35 }}
                      className={`border border-dashed px-3.5 py-3 ${luxe ? 'rounded-2xl' : 'rounded-xl'}`} style={{ borderColor: 'var(--site-line-strong)' }}>
                      <p className="text-[13px] font-black leading-snug" style={{ color: 'var(--site-heading)' }}>
                        Just outside {listShapes.length === 1 ? 'the district' : 'these districts'}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--site-muted)' }}>Near {town}, past the district lines above</p>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        {outside.pub.length > 0 && schoolSwitch(outside, 'pub')}
                        {schoolSwitch(outside, 'pri')}
                      </div>
                    </motion.li>
                  )}
                </ul>
              ) : outline ? (
                <div className="mt-4 flex items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: 'var(--site-accent)' }} />
                  <p className="text-[13px] font-black" style={{ color: 'var(--site-heading)' }}>{outline.label}</p>
                </div>
              ) : null}

              {layer === 'schools' && sortedMarkers.length > 0 && (
                <div className="mt-4 max-h-72 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-muted)' }}>On the map · {sortedMarkers.length}</p>
                  <ul className="mt-2 space-y-0.5">
                    {sortedMarkers.map((m, i) => (
                      <motion.li key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * Math.min(i, 24) }}>
                        <button type="button" onMouseEnter={() => setActiveSchool(m.id)} onMouseLeave={() => setActiveSchool(null)} onClick={() => setActiveSchool(activeSchool === m.id ? null : m.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
                          style={{ backgroundColor: activeSchool === m.id ? `${m.color}16` : 'transparent' }}>
                          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[8.5px] font-black ${m.kind === 'private' ? 'rounded-[5px] text-white' : 'rounded-full bg-white'}`}
                            style={m.kind === 'private' ? { backgroundColor: m.color } : { color: m.color, boxShadow: `0 0 0 2px ${m.color}` }}>{m.glyph}</span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold" style={{ color: 'var(--site-heading)' }}>{m.title}</span>
                          <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: 'var(--site-faint)' }}>{m.lines[0]?.split(' · ')[1]?.replace('Grades ', '') || ''}</span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{note}</p>
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-[10px] font-semibold" style={{ color: 'var(--site-muted)' }}>
            Boundaries: U.S. Census Bureau.{layer === 'schools' ? ' Schools: U.S. Dept. of Education (NCES).' : ''} Shares count the homes in the MLS for {town}.
          </p>
        </div>
      </div>
    </div>
  )
}
