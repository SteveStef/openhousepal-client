'use client'

// The home's map with Explore Nearby built in (user, 10/18): tap Coffee and the coffee shops drop
// onto the same map as numbered pins, with a swipeable row of cards under it - tap a card and its
// pin opens; tap a pin and its card slides into view. Used by Spotlight's Location section (both
// looks), the IDX property page and the IDX town page. Data: ./useNearby (budget-gated, tap-only).
import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, MapPin, Star } from 'lucide-react'
import HomeAreaMap from './HomeAreaMap'
import type { CanvasMarker } from './BoundaryCanvas'
import useNearby, { NEARBY_CATEGORIES, milesText, type Nearby, type NearbyKind } from './useNearby'

type Tone = 'light' | 'dark' | 'auto'

// Light, dark, or following the page's own <html class="dark"> (IDX sites).
const T = {
  light: { ink: 'text-[#111827]', muted: 'text-gray-500', faint: 'text-gray-400', chip: 'border-black/10 bg-white text-gray-600 hover:border-black/25', card: 'border-black/[0.07] bg-white', soft: 'bg-black/[0.035]' },
  dark: { ink: 'text-white', muted: 'text-white/60', faint: 'text-white/40', chip: 'border-white/15 bg-white/[0.04] text-white/75 hover:border-white/35', card: 'border-white/10 bg-white/[0.04]', soft: 'bg-white/[0.05]' },
  auto: { ink: 'text-[#111827] dark:text-white', muted: 'text-gray-500 dark:text-white/60', faint: 'text-gray-400 dark:text-white/40', chip: 'border-black/10 bg-white text-gray-600 hover:border-black/25 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/75', card: 'border-black/[0.07] bg-white dark:border-white/10 dark:bg-white/[0.04]', soft: 'bg-black/[0.035] dark:bg-white/[0.05]' },
}

function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62 ? '#111827' : '#ffffff'
}

export function placeMarkers(nb: Nearby, color: string): CanvasMarker[] {
  return (nb.places || []).map((p, i) => {
    const d = nb.details[p.place_id]
    const rating = d?.rating != null ? `★ ${d.rating.toFixed(1)}${d.review_count != null ? ` (${d.review_count.toLocaleString()})` : ''}` : nb.loadingDetails === p.place_id ? 'Loading rating…' : ''
    return {
      id: p.place_id, lat: p.latitude, lng: p.longitude, kind: 'place' as const, color, glyph: String(i + 1),
      title: p.name, kicker: [p.category, milesText(p.distance_miles)].filter(Boolean).join(' · '),
      lines: [rating, p.address || ''].filter(Boolean),
    }
  })
}

/** Category chips + the cards for the picked one. */
export function NearbyPicker({ nb, accent, tone = 'auto', originLabel }: { nb: Nearby; accent: string; tone?: Tone; originLabel: string }) {
  const t = T[tone]
  const rail = useRef<HTMLDivElement>(null)
  const accentHex = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#C9A24D'

  // A pin tapped on the map: bring its card into view.
  useEffect(() => {
    if (!nb.selected || !rail.current) return
    const el = rail.current.querySelector<HTMLElement>(`[data-place="${CSS.escape(nb.selected)}"]`)
    if (!el) return
    const r = rail.current
    r.scrollTo({ left: el.offsetLeft - r.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [nb.selected])

  if (nb.available === false) return null
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${t.muted}`}>Explore nearby</p>
        {nb.active && (
          <button type="button" onClick={() => nb.select(null)} className={`text-[11px] font-black uppercase tracking-[0.14em] ${t.faint} transition hover:opacity-80`}>Clear</button>
        )}
      </div>
      {/* chips - one swipeable row on a phone */}
      <div className="-mx-1 mt-2.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NEARBY_CATEGORIES.map(({ key, label, icon: Icon }) => {
          const on = nb.active === key
          return (
            <motion.button key={key} type="button" whileTap={{ scale: 0.95 }} onClick={() => nb.select(on ? null : key)}
              className={`relative inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-black transition-colors ${on ? 'border-transparent' : t.chip}`}
              style={on ? { color: inkOn(accentHex) } : undefined}>
              {on && <motion.span layoutId={`nearby-chip-${originLabel}`} className="absolute inset-0 rounded-full" style={{ background: accent }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              {nb.loading === key ? <Loader2 className="relative h-3.5 w-3.5 animate-spin" /> : <Icon className="relative h-3.5 w-3.5" />}
              <span className="relative">{label}</span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!nb.active ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`mt-2 text-[12.5px] font-semibold ${t.faint}`}>Tap one - the places show up on the map with how far they are from {originLabel}.</motion.p>
        ) : nb.error ? (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{nb.error}</motion.p>
        ) : nb.loading === nb.active || !nb.places ? (
          <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex gap-3 overflow-hidden">
            {[0, 1, 2].map(i => <div key={i} className={`h-[92px] w-[240px] shrink-0 animate-pulse rounded-2xl ${t.soft}`} />)}
          </motion.div>
        ) : nb.places.length === 0 ? (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`mt-3 text-sm font-semibold ${t.muted}`}>Nothing in this category close by.</motion.p>
        ) : (
          <motion.div key={`list:${nb.active}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div ref={rail} className="relative -mx-1 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {nb.places.map((p, i) => {
                const on = nb.selected === p.place_id
                const d = nb.details[p.place_id]
                return (
                  <motion.button key={p.place_id} data-place={p.place_id} type="button" onClick={() => nb.selectPlace(on ? null : p.place_id)}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04, type: 'spring', stiffness: 320, damping: 28 }}
                    className={`flex w-[78%] max-w-[280px] shrink-0 snap-start items-start gap-3 rounded-2xl border p-3.5 text-left transition-shadow sm:w-[260px] ${t.card}`}
                    style={on ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}, 0 14px 30px -18px ${accent}` } : undefined}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black" style={{ background: accent, color: inkOn(accentHex) }}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] font-black leading-snug ${t.ink}`}>{p.name}</span>
                      <span className={`mt-0.5 block truncate text-[11px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>{[p.category, milesText(p.distance_miles)].filter(Boolean).join(' · ')}</span>
                      {p.address && <span className={`mt-1.5 flex items-start gap-1 text-[12px] leading-snug ${t.muted}`}><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{p.address}</span></span>}
                      {on && (
                        <span className={`mt-1.5 flex items-center gap-1 text-[12px] font-black ${t.ink}`}>
                          {nb.loadingDetails === p.place_id ? <><Loader2 className="h-3 w-3 animate-spin" /> Rating…</>
                            : d?.rating != null ? <><Star className="h-3.5 w-3.5 fill-current" style={{ color: accent }} /> {d.rating.toFixed(1)}{d.review_count != null && <span className={`font-bold ${t.faint}`}>({d.review_count.toLocaleString()})</span>}</>
                            : <span className={t.faint}>On the map</span>}
                        </span>
                      )}
                    </span>
                  </motion.button>
                )
              })}
            </div>
            <p className={`mt-1 text-[10.5px] font-semibold ${t.faint}`}>Places from <span translate="no">Google Maps</span> · straight-line distance</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The map box + the picker under it. `boxClassName` sizes / frames the map box. */
export default function NearbyMap({ latitude, longitude, address, accent, dark, tone = 'auto', siteId, kind, listingKey, slug, nearbyOn = true, originLabel, boxClassName, showHome = true, homeLabel }: {
  latitude: number
  longitude: number
  address?: string | null
  /** A colour (#hex) or var(--x) of the page. */
  accent: string
  dark?: boolean
  tone?: Tone
  siteId?: string | null
  kind: NearbyKind
  listingKey?: string
  slug?: string
  /** The page lets visitors explore nearby places (Spotlight's switch, a usable site id...). */
  nearbyOn?: boolean
  originLabel: string
  boxClassName: string
  showHome?: boolean
  homeLabel?: string
}) {
  const enabled = nearbyOn && !!siteId
  const nb = useNearby({ siteId: siteId || '', kind, listingKey, slug, enabled })
  const boxRef = useRef<HTMLDivElement>(null)
  // The pins' colour: the page accent, read once the box exists (var(--sp-accent) on Spotlight).
  const pinColor = useMemo(() => {
    const v = /^var\((--[\w-]+)\)$/.exec(accent)
    if (!v) return accent
    if (typeof window === 'undefined' || !boxRef.current) return '#C9A24D'
    return getComputedStyle(boxRef.current).getPropertyValue(v[1]).trim() || '#C9A24D'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, nb.places])
  const markers = useMemo(() => placeMarkers(nb, pinColor), [nb, pinColor])

  return (
    // min-w-0: the swipeable card row must never widen the page column it sits in (a grid cell).
    <div ref={boxRef} className="min-w-0">
      <div className={boxClassName}>
        <HomeAreaMap latitude={latitude} longitude={longitude} address={address} accent={accent} dark={dark} className="absolute inset-0 h-full w-full" rounded=""
          places={markers} activePlace={nb.selected} onActivePlace={id => nb.selectPlace(id)} showHome={showHome} homeLabel={homeLabel} />
      </div>
      {enabled && <NearbyPicker nb={nb} accent={pinColor} tone={tone} originLabel={originLabel} />}
    </div>
  )
}
