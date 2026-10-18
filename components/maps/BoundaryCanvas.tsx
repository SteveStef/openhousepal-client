'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

// Animated boundary lines, school dots and name badges drawn on top of a Google map - shared by the
// IDX town page map (website-public/TownMap) and the Showcase editor's search-area highlight.
//
// Everything is real DOM in two Google overlay panes (SVG lines below, HTML dots/badges above), so
// it can animate: lines draw themselves in, fills fade up, the town outline "marches", dots pop in
// with a ripple, and each area's badge sits INSIDE its own lines - placed fresh on every move/zoom
// by searching the visible part of the shape for the roomiest spot that covers no school dot and
// no other badge (and gliding there).

export interface CanvasShape {
  id: string
  rings: number[][][] // [lng, lat] rings, as stored from the Census
  color: string
  fill?: number // fill opacity
  width?: number
  dashed?: boolean // marching outline (the town itself, drawn over other layers)
}
export interface CanvasMarker {
  id: string
  lat: number
  lng: number
  kind: 'public' | 'private'
  color: string // ring colour (public: its district's colour)
  glyph: string // one or two letters inside the dot (E / M / H / K-8 ...)
  title: string
  lines: string[] // tooltip detail lines
}
export interface CanvasBadge {
  id: string
  shapeId: string
  title: string
  sub?: string
  color: string
  icon: 'school' | 'town' | 'gov' | 'county'
  /** A quiet name tag (no icon) - for the areas around the one that matters (a home's neighbouring
   *  townships). Left off entirely when it doesn't fit inside its own lines. */
  small?: boolean
  /** A shorter name ("Lower Merion" for "Lower Merion Township") used when the full one won't fit. */
  short?: string
}


// Lives with the component (it renders inside Google's panes, on the IDX site and in the app alike).
const CANVAS_CSS = `
.ohp-ants{animation:ohpAnts 1.6s linear infinite}
@keyframes ohpAnts{to{stroke-dashoffset:-34}}
.ohp-badge-ring::before{content:"";position:absolute;inset:0;border-radius:9999px;
  background:conic-gradient(from 0deg,var(--badge),transparent 30%,var(--badge) 55%,transparent 80%,var(--badge));
  animation:ohpSpin 5s linear infinite;opacity:.9}
.ohp-badge-ring::after{content:"";position:absolute;inset:-6px;border-radius:9999px;border:2px solid var(--badge);
  opacity:0;animation:ohpBurst 1.4s cubic-bezier(.16,1,.3,1) 1.1s 1 both}
@keyframes ohpSpin{to{transform:rotate(360deg)}}
@keyframes ohpBurst{0%{opacity:.7;transform:scale(.7)}100%{opacity:0;transform:scale(1.9)}}
.ohp-dot{position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;
  background:#fff;box-shadow:0 0 0 2.5px var(--dot),0 6px 14px -4px rgba(0,0,0,.35);transition:box-shadow .2s}
.ohp-dot-private{border-radius:7px;width:22px;height:22px;background:var(--dot);box-shadow:0 0 0 2.5px #fff,0 6px 14px -4px rgba(0,0,0,.35)}
.ohp-dot-core{font:900 9.5px/1 ui-sans-serif,system-ui,sans-serif;color:var(--dot);letter-spacing:-.02em}
.ohp-dot-private .ohp-dot-core{color:#fff;font-size:10.5px}
.ohp-dot-ripple{position:absolute;inset:-3px;border-radius:inherit;border:2px solid var(--dot);opacity:0;animation:ohpRipple 1.3s ease-out 1 both}
@keyframes ohpRipple{0%{opacity:.75;transform:scale(.6)}100%{opacity:0;transform:scale(2.3)}}
button:hover>span>span>.ohp-dot{box-shadow:0 0 0 3px var(--dot),0 0 0 8px color-mix(in srgb,var(--dot) 22%,transparent),0 8px 18px -4px rgba(0,0,0,.4)}
@media (prefers-reduced-motion:reduce){.ohp-ants,.ohp-badge-ring::before{animation:none}}
`
const ease = [0.16, 1, 0.3, 1] as const
// An area's name tag (user, 10/18): a small pill in the area's own line colour, so it never blends
// into the map's printed place names - and it must fit inside its own lines.
const labelW = (b: CanvasBadge, short = false) => 18 + (short && b.short ? b.short : b.title).length * 6.6
const PILL_H = 20
function inkOn(color: string): string {
  const m = color.startsWith('#')
    ? (color.length === 4 ? color.slice(1).split('').map(c => parseInt(c + c, 16)) : [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)))
    : (color.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number)
  const [r, g, b] = m.length === 3 ? m : [0, 0, 0]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#111827' : '#ffffff'
}

type Pt = { x: number; y: number }

// Census (Esri) rings: outer boundaries run clockwise, holes counter-clockwise ([lng, lat]).
function ringIsHole(r: number[][]): boolean {
  let a = 0
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1] }
  return a > 0
}

function pip(x: number, y: number, rings: Pt[][]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j]
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside
    }
  }
  return inside
}

function edgeDist(x: number, y: number, rings: Pt[][], cap: number): number {
  let best = cap
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i]
      const dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / ((dx * dx + dy * dy) || 1)))
      const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy))
      if (d < best) best = d
    }
  }
  return best
}

export default function BoundaryCanvas({ map, shapes, markers = [], badges = [], avoid = [], dark = false, animKey = '', activeMarker, onActiveMarker, highlight, topInset = 14, home = null }: {
  map: google.maps.Map | null
  shapes: CanvasShape[]
  markers?: CanvasMarker[]
  badges?: CanvasBadge[]
  avoid?: { lat: number; lng: number }[] // other pins on the map (homes) badges must not cover
  dark?: boolean
  animKey?: string // change it to replay the draw-in (a layer switch)
  activeMarker?: string | null
  onActiveMarker?: (id: string | null) => void
  highlight?: string | null // a shape id to lift (legend hover)
  topInset?: number // px kept clear at the top for buttons floating over the map
  home?: { lat: number; lng: number; color: string; label?: string } | null // a house marker + its name bubble
}) {
  const [panes, setPanes] = useState<{ lines: HTMLDivElement; top: HTMLDivElement } | null>(null)
  const projRef = useRef<google.maps.MapCanvasProjection | null>(null)
  const [tick, setTick] = useState(0)
  const [hoverMarker, setHoverMarker] = useState<string | null>(null)

  useEffect(() => {
    if (!map) return
    class Layer extends google.maps.OverlayView {
      lines = document.createElement('div')
      top = document.createElement('div')
      onAdd() {
        const p = this.getPanes()!
        this.lines.style.position = this.top.style.position = 'absolute'
        p.overlayLayer.appendChild(this.lines)
        p.overlayMouseTarget.appendChild(this.top)
        setPanes({ lines: this.lines, top: this.top })
      }
      draw() { projRef.current = this.getProjection(); setTick(t => t + 1) }
      onRemove() { this.lines.remove(); this.top.remove() }
    }
    const layer = new Layer()
    layer.setMap(map)
    const idle = map.addListener('idle', () => setTick(t => t + 1))
    return () => { idle.remove(); layer.setMap(null); setPanes(null) }
  }, [map])

  const proj = projRef.current
  const P = (lng: number, lat: number): Pt => {
    const q = proj!.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng))!
    return { x: q.x, y: q.y }
  }

  // Shapes in div pixels (recomputed each projection change).
  const px = useMemo(() => {
    if (!proj) return new Map<string, Pt[][]>()
    const m = new Map<string, Pt[][]>()
    shapes.forEach(s => m.set(s.id, s.rings.map(r => r.map(([lng, lat]) => P(lng, lat)))))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, tick, shapes])

  // Dots, nudged apart where two schools share a block so both stay tappable.
  const dots = useMemo(() => {
    if (!proj) return []
    const ds = markers.map(mk => ({ mk, p: P(mk.lng, mk.lat) }))
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < ds.length; i++) {
        for (let j = i + 1; j < ds.length; j++) {
          const a = ds[i].p, b = ds[j].p
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
          if (d < 22) {
            const push = (22 - d) / 2, ux = d ? dx / d : 1, uy = d ? dy / d : 0
            a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push
          }
        }
      }
    }
    return ds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, tick, markers])

  // Badge placement: the visible part of each shape, the roomiest spot that covers no dot.
  const placed = useMemo(() => {
    if (!proj || !map || !badges.length) return [] as { b: CanvasBadge; x: number; y: number; mode: 'full' | 'title' | 'icon' }[]
    const bounds = map.getBounds()
    if (!bounds) return []
    const ne = P(bounds.getNorthEast().lng(), bounds.getNorthEast().lat())
    const sw = P(bounds.getSouthWest().lng(), bounds.getSouthWest().lat())
    const view = { x0: sw.x + 14, x1: ne.x - 62, y0: ne.y + topInset, y1: sw.y - 34 } // keep clear of zoom buttons / Google logo / top buttons
    const out: { b: CanvasBadge; x: number; y: number; mode: 'full' | 'title' | 'icon'; w: number; h: number }[] = []
    const step = Math.max(14, Math.min(28, (view.x1 - view.x0) / 40))
    const obstacles = [...dots, ...avoid.map(a => ({ p: P(a.lng, a.lat) }))]
    // Zoomed in so one area fills the view (user, 10/17): its badge moves to the top-left corner,
    // under the layer tabs, instead of sitting in the middle of what they're looking at - and it
    // switches to whichever area they pan into.
    const cx0 = (view.x0 + view.x1) / 2, cy0 = (view.y0 + view.y1) / 2
    const corners = [[view.x0, view.y0], [view.x1, view.y0], [view.x0, view.y1], [view.x1, view.y1]]
    const filling = badges.find(b => {
      const rings = px.get(b.shapeId)
      return !!rings?.length && pip(cx0, cy0, rings) && corners.filter(([x, y]) => pip(x, y, rings)).length >= 3
    })
    if (filling) {
      const w = labelW(filling)
      out.push({ b: filling, x: view.x0 + w / 2, y: view.y0 + (topInset > 14 ? 0 : 46) + PILL_H / 2, mode: 'full', w, h: PILL_H })
    }
    for (const b of badges) {
      if (b === filling) continue
      const rings = px.get(b.shapeId)
      if (!rings?.length) continue
      // needIn: how many of the 8 edge probes must be inside the shape; minClear: px from any dot.
      const tryFit = (w: number, h: number, needIn: number, minClear: number) => {
        let best: { x: number; y: number; score: number } | null = null
        // centre of the visible part, to prefer central spots
        let sx = 0, sy = 0, n = 0
        const cands: Pt[] = []
        for (let x = view.x0 + w / 2; x <= view.x1 - w / 2; x += step) {
          for (let y = view.y0 + h / 2; y <= view.y1 - h / 2; y += step) {
            if (pip(x, y, rings)) { cands.push({ x, y }); sx += x; sy += y; n++ }
          }
        }
        if (!n) return null
        const cx = sx / n, cy = sy / n
        for (const c of cands) {
          const l = c.x - w / 2, r = c.x + w / 2, t = c.y - h / 2, bt = c.y + h / 2
          const probes = [[l, t], [r, t], [l, bt], [r, bt], [c.x, t], [c.x, bt], [l, c.y], [r, c.y]]
          if (probes.filter(([x, y]) => pip(x, y, rings)).length < needIn) continue
          if (out.some(o => Math.abs(o.x - c.x) < (o.w + w) / 2 + 10 && Math.abs(o.y - c.y) < (o.h + h) / 2 + 10)) continue
          let clear = 140
          for (const d of obstacles) {
            const dx = Math.max(l - d.p.x, 0, d.p.x - r), dy = Math.max(t - d.p.y, 0, d.p.y - bt)
            clear = Math.min(clear, Math.hypot(dx, dy))
          }
          if (clear < minClear) continue
          const edge = edgeDist(c.x, c.y, rings, 90)
          const score = clear * 1.0 + edge * 0.6 - Math.hypot(c.x - cx, c.y - cy) * 0.12
          if (!best || score > best.score) best = { ...c, score }
        }
        return best
      }
      const tiers: { mode: 'full' | 'title' | 'icon'; w: number; h: number; needIn: number; minClear: number }[] = []
      if (b.small) {
        const sw = 10 + b.title.length * 7.4
        for (const tier of [{ needIn: 8, minClear: 8 }, { needIn: 6, minClear: 4 }]) {
          const spot = tryFit(sw, 16, tier.needIn, tier.minClear)
          if (spot) { out.push({ b, x: spot.x, y: spot.y, mode: 'title', w: sw, h: 16 }); break }
        }
        continue
      }
      // The name tag sits wholly inside its own lines - clear of the home and school dots if it can.
      // Wholly inside first - the full name, then the short one; only then a little over the line.
      const fullW = labelW(b), shortW = labelW(b, true)
      tiers.push({ mode: 'full', w: fullW, h: PILL_H, needIn: 8, minClear: 10 }, { mode: 'full', w: fullW, h: PILL_H, needIn: 8, minClear: 3 },
        { mode: 'title', w: shortW, h: PILL_H, needIn: 8, minClear: 6 }, { mode: 'title', w: shortW, h: PILL_H, needIn: 8, minClear: 0 },
        { mode: 'title', w: shortW, h: PILL_H, needIn: 7, minClear: 0 }, { mode: 'title', w: shortW, h: PILL_H, needIn: 5, minClear: 0 })
      for (const tier of tiers) {
        const spot = tryFit(tier.w, tier.h, tier.needIn, tier.minClear)
        if (spot) { out.push({ b, x: spot.x, y: spot.y, mode: tier.mode, w: tier.w, h: tier.h }); break }
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, tick, px, dots, badges, map, avoid, topInset])

  if (!panes || !proj) return null
  const path = (rings: Pt[][]) => rings.map(r => 'M' + r.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + 'Z').join('')
  const card = dark
    ? { bg: 'rgba(17,20,26,.92)', ink: '#f3f4f6', muted: '#9ca3af', line: 'rgba(255,255,255,.12)', halo: '0 0 2px #11141a, 0 0 4px #11141a, 0 0 8px rgba(17,20,26,.9)' }
    : { bg: 'rgba(255,255,255,.94)', ink: '#111827', muted: '#4b5563', line: 'rgba(17,24,39,.10)', halo: '0 0 2px #fff, 0 0 4px #fff, 0 0 8px rgba(255,255,255,.95)' }
  const shown = activeMarker || hoverMarker

  return (
    <>
      {createPortal(<style>{CANVAS_CSS}</style>, panes.top)}
      {createPortal(
        <svg style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}>
          <AnimatePresence>
            {shapes.map((s, i) => {
              const rings = px.get(s.id)
              if (!rings?.length) return null
              const d = path(rings)
              // A carved-out piece (a borough surrounded by the township - Narberth inside Lower
              // Merion) is a hole in the area: a thin dashed line, not a second bold outline.
              const holeAt = s.rings.map(r => ringIsHole(r))
              const outer = holeAt.some(Boolean) ? path(rings.filter((_, k) => !holeAt[k])) : d
              const holes = holeAt.some(Boolean) ? path(rings.filter((_, k) => holeAt[k])) : ''
              const lifted = highlight === s.id
              const dimmed = !!highlight && !lifted && !s.dashed
              return (
                <motion.g key={`${animKey}:${s.id}`} initial={{ opacity: 0 }} animate={{ opacity: dimmed ? 0.35 : 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }} transition={{ duration: 0.4 }}>
                  {/* soft glow under the line */}
                  <motion.path d={outer} fill="none" stroke={s.color} strokeLinejoin="round" fillRule="evenodd"
                    initial={{ strokeOpacity: 0 }} animate={{ strokeOpacity: lifted ? 0.32 : 0.14, strokeWidth: lifted ? 14 : 9 }} transition={{ duration: 0.6, delay: s.dashed ? 0 : 0.5 + i * 0.12 }} />
                  {s.dashed ? (
                    <path d={d} fill="none" stroke={s.color} strokeWidth={s.width || 3} strokeDasharray="10 7" strokeLinecap="round" className="ohp-ants" />
                  ) : (
                    <>
                    <motion.path d={d} stroke="none" fill={s.color} fillRule="evenodd"
                      initial={{ fillOpacity: 0 }}
                      animate={{ fillOpacity: lifted ? Math.min(0.42, (s.fill ?? 0.14) * 2.4) : (s.fill ?? 0.14) }}
                      transition={{ fillOpacity: { duration: 0.8, delay: 0.7 + i * 0.12 } }} />
                    <motion.path d={outer} stroke={s.color} fill="none" strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1, strokeWidth: lifted ? (s.width || 2.5) + 1.5 : (s.width || 2.5) }}
                      transition={{ pathLength: { duration: 1.3, ease, delay: i * 0.12 }, strokeWidth: { duration: 0.25 } }} />
                    {holes && <motion.path d={holes} stroke={s.color} fill="none" strokeWidth={1.3} strokeDasharray="4 4" strokeLinecap="round"
                      initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} transition={{ duration: 0.6, delay: 1.2 + i * 0.12 }} />}
                    </>
                  )}
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>,
        panes.lines,
      )}
      {createPortal(
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          {/* Badges - each inside its own lines, gliding to a fresh spot on every move */}
          <AnimatePresence>
            {placed.map(({ b, x, y, mode }, i) => {
              return (
                <motion.div key={`${animKey}:${b.id}`} className="pointer-events-none absolute left-0 top-0"
                  initial={{ opacity: 0, scale: 0.6, x, y }} animate={{ opacity: highlight && highlight !== b.shapeId ? 0.45 : 1, scale: 1, x, y }} exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ opacity: { duration: 0.5, delay: 0.9 + i * 0.15 }, scale: { type: 'spring', stiffness: 260, damping: 18, delay: 0.9 + i * 0.15 }, x: { type: 'spring', stiffness: 170, damping: 24 }, y: { type: 'spring', stiffness: 170, damping: 24 } }}
                  style={{ zIndex: 5 }}>
                  <div className="ohp-badge -translate-x-1/2 -translate-y-1/2" style={{ ['--badge' as any]: b.color }}>
                    {b.small ? (
                      <div className="whitespace-nowrap text-[10.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: card.muted, textShadow: card.halo }}>{b.title}</div>
                    ) : (
                      <div className="whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-black leading-[14px] tracking-[0.01em] shadow-[0_3px_10px_-3px_rgba(0,0,0,.35)]"
                        style={{ background: b.color, color: inkOn(b.color) }}>{mode === 'title' && b.short ? b.short : b.title}</div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* The home: a little house, and "This home" in a bubble under it, both in the page colour */}
          {home && (() => {
            const hp = P(home.lng, home.lat)
            return (
              <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${hp.x}px, ${hp.y}px)`, zIndex: 25 }}>
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.3 }}
                  className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                  <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white shadow-[0_6px_14px_-4px_rgba(0,0,0,.45)]" style={{ background: home.color }}>
                    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke={inkOn(home.color)} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9v11h13V9" /><path d="M10 20v-5h4v5" />
                    </svg>
                  </span>
                  <span className="mt-1 whitespace-nowrap rounded-full border bg-white px-2 py-[2px] text-[10px] font-black leading-[13px] shadow-[0_3px_10px_-3px_rgba(0,0,0,.3)]"
                    style={{ color: home.color, borderColor: home.color, ...(dark ? { background: '#14161b' } : {}) }}>{home.label || 'This home'}</span>
                </motion.div>
              </div>
            )
          })()}

          {/* School dots */}
          <AnimatePresence>
            {dots.map(({ mk, p }, i) => {
              const on = shown === mk.id
              return (
                <motion.button key={mk.id} type="button" className="absolute left-0 top-0 cursor-pointer"
                  style={{ x: p.x, y: p.y, zIndex: on ? 30 : 10 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.3, delay: 0.5 + Math.min(i, 30) * 0.035 }}
                  onMouseEnter={() => setHoverMarker(mk.id)} onMouseLeave={() => setHoverMarker(h => (h === mk.id ? null : h))}
                  onClick={e => { e.stopPropagation(); onActiveMarker?.(activeMarker === mk.id ? null : mk.id) }}
                  aria-label={mk.title}>
                  <span className="block -translate-x-1/2 -translate-y-1/2">
                    <motion.span className="block" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.5 + Math.min(i, 30) * 0.035 }}>
                      <motion.span className={`ohp-dot ohp-dot-${mk.kind}`} style={{ ['--dot' as any]: mk.color }} animate={{ scale: on ? 1.3 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        <span className="ohp-dot-ripple" style={{ animationDelay: `${0.55 + Math.min(i, 30) * 0.035}s` }} />
                        <span className="ohp-dot-core">{mk.glyph}</span>
                      </motion.span>
                    </motion.span>
                  </span>
                </motion.button>
              )
            })}
          </AnimatePresence>

          {/* Tooltip for the hovered / tapped school */}
          <AnimatePresence>
            {dots.filter(d => d.mk.id === shown).map(({ mk, p }) => (
              <motion.div key={`tip:${mk.id}`} className="pointer-events-none absolute left-0 top-0" style={{ x: p.x, y: p.y, zIndex: 40 }}
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
                <div className="-translate-x-1/2 translate-y-[-100%] pb-5">
                  <div className="w-max max-w-[240px] rounded-2xl border px-3.5 py-2.5 shadow-2xl " style={{ background: card.bg, borderColor: card.line }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: mk.color }}>{mk.kind === 'public' ? 'Public school' : 'Private school'}</p>
                    <p className="mt-0.5 text-[13px] font-black leading-snug" style={{ color: card.ink }}>{mk.title}</p>
                    {mk.lines.filter(Boolean).map(l => <p key={l} className="text-[11.5px] font-semibold leading-snug" style={{ color: card.muted }}>{l}</p>)}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        panes.top,
      )}
    </>
  )
}
