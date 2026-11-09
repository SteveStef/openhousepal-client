'use client'

// A town added to a Showcase that has a search circle (owner, 11/09). Towns and the circle stack (only
// homes in the town AND inside the circle), so when an agent adds a town:
//   - the town is all outside the circle  -> the circle comes off on its own (with Undo);
//   - the circle covers part of the town  -> this pop-up: remove it, grow it, move its center (or keep it);
//   - the circle covers the whole town    -> nothing to ask.
// Used by the map editor (ShowcaseMapEditor) and the quick Edit Showcase window (QuickEditShowcase).
// backend: POST /collections/circle-coverage (property_service.circle_coverage)
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Expand, MapPin, Undo2, X, XCircle } from 'lucide-react'
import api from '@/lib/api-service'

export type CircleCoverage = {
  name: string; kind: 'city' | 'township'; total: number; inside: number
  cover_miles: number | null; center: { lat: number; lng: number } | null; center_inside: number
}
export type Circle = { lat: number; long: number; diameter: number; address?: string | null }

const placeName = (s: string) => s.split(',')[0].trim().toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())
const placeState = (s: string) => (s.split(',')[1] || '').trim().toUpperCase()
const mi = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} mi`
const street = (a?: string | null) => (a || '').split(',')[0].trim()

/** Watches the towns; when one is added while there's a circle, checks how much of it the circle covers.
 *  apply(null) takes the circle off; apply(circle) sets a new one. Render `notice` (the "circle removed"
 *  line) near the towns and `prompt` anywhere. resetKey = which Showcase's search is loaded: when it
 *  changes, its towns are the starting point and never ask. */
export function useCircleTownCheck({ cities, townships, circle, enabled, resetKey, search, apply, onPickOnMap }: {
  cities: string[]; townships: string[]; circle: Circle | null; enabled: boolean; resetKey?: string | null
  /** The rest of the search (price, beds, types...) so the counts are the homes that would really show. */
  search?: Record<string, unknown> | null
  apply: (next: Circle | null) => void
  /** The map editor only: "Pick a new spot on the map". */
  onPickOnMap?: () => void
}) {
  const prev = useRef<string[] | null>(null)
  const lastReset = useRef<string | null | undefined>(undefined)
  const seq = useRef(0)
  const [ask, setAsk] = useState<{ place: CircleCoverage; label: string; circle: Circle } | null>(null)
  const [removed, setRemoved] = useState<{ names: string[]; circle: Circle } | null>(null)
  const circleRef = useRef(circle); circleRef.current = circle
  const searchRef = useRef(search); searchRef.current = search

  const key = JSON.stringify([cities, townships])
  useEffect(() => {
    const all = [...cities.map(c => `c|${c}`), ...townships.map(t => `t|${t}`)]
    if (!enabled) { prev.current = null; setAsk(null); setRemoved(null); return }
    if (prev.current === null || lastReset.current !== resetKey) {   // what it opened with never asks
      prev.current = all; lastReset.current = resetKey; setAsk(null); setRemoved(null); return
    }
    const added = all.filter(x => !prev.current!.includes(x))
    prev.current = all
    const c = circleRef.current
    if (!added.length || !c || !c.diameter) return
    const mine = ++seq.current
    api.collections.circleCoverage({
      places: added.map(x => ({ name: x.slice(2), kind: x.startsWith('t|') ? 'township' : 'city' })),
      lat: c.lat, long: c.long, diameter: c.diameter,
      preferences: searchRef.current || undefined,
    }).then(r => {
      if (mine !== seq.current || !r.success || !r.data) return
      const now = circleRef.current
      if (!now || now.lat !== c.lat || now.long !== c.long || now.diameter !== c.diameter) return  // the circle moved meanwhile
      const known = r.data.places.filter(p => p.total > 0)
      const outside = known.filter(p => p.inside === 0)
      if (outside.length) {
        // a town all outside the circle would add nothing - the circle comes off
        setAsk(null)
        setRemoved({ names: outside.map(p => placeName(p.name)), circle: c })
        apply(null)
        return
      }
      const part = known.find(p => p.inside < p.total)
      if (part) setAsk({ place: part, label: placeName(part.name), circle: c })
    }).catch(() => {})
  }, [key, enabled, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // the "circle removed" line goes away after a while
  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 12000)
    return () => window.clearTimeout(t)
  }, [removed])

  const notice = removed ? (
    <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[11.5px] font-bold leading-snug text-sky-800 dark:bg-sky-500/10 dark:text-sky-200" data-testid="circle-auto-removed">
      <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">Search circle removed - {removed.names.join(' and ')} {removed.names.length > 1 ? 'are' : 'is'} outside it, so the whole town shows.</span>
      <button type="button" onClick={() => { apply(removed.circle); setRemoved(null) }} data-testid="circle-auto-undo"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-black text-sky-800 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:text-sky-100">
        <Undo2 className="h-3 w-3" /> Undo
      </button>
    </div>
  ) : null

  const prompt = (
    <CircleTownPrompt
      ask={ask}
      onClose={() => setAsk(null)}
      onRemove={() => { setAsk(null); apply(null) }}
      onGrow={(miles) => { if (ask) apply({ ...ask.circle, diameter: miles }); setAsk(null) }}
      onMove={() => {
        if (!ask?.place.center) return
        const st = placeState(ask.place.name)
        apply({ lat: ask.place.center.lat, long: ask.place.center.lng, diameter: ask.circle.diameter, address: `${ask.label}${st ? `, ${st}` : ''}` })
        setAsk(null)
      }}
      onPickOnMap={onPickOnMap ? () => { setAsk(null); onPickOnMap() } : undefined}
    />
  )
  return { notice, prompt }
}

function CircleTownPrompt({ ask, onClose, onRemove, onGrow, onMove, onPickOnMap }: {
  ask: { place: CircleCoverage; label: string; circle: Circle } | null
  onClose: () => void; onRemove: () => void; onGrow: (miles: number) => void; onMove: () => void; onPickOnMap?: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!ask) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [ask, onClose])
  if (!mounted) return null
  const p = ask?.place
  const town = ask?.label || ''
  const cover = p?.cover_miles && p.cover_miles > (ask?.circle.diameter || 0) ? p.cover_miles : null
  const row = 'flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-left transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.05] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-[#C9A24D]/60'
  const icon = 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/12 text-[#8b7355] dark:text-[#e8c97a]'
  return createPortal(
    <AnimatePresence>
      {ask && p && (
        <motion.div key="ctp" className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="circle-town-prompt">
          <motion.div role="dialog" aria-modal="true" aria-label={`The circle covers part of ${town}`}
            className="w-full max-w-md rounded-t-3xl bg-[#FAFAF7] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-[#141416] sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><MapPin className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-black leading-tight text-[#111827] dark:text-white">The circle only covers part of {town}</h3>
                <p className="mt-1 text-[12.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                  Your {mi(ask.circle.diameter)} circle{street(ask.circle.address) ? ` around ${street(ask.circle.address)}` : ''} takes in <b className="text-[#111827] dark:text-white">{p.inside} of {town}&apos;s {p.total}</b> homes for sale. Only those {p.inside} would show.
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-2">
              <button type="button" className={row} onClick={onRemove} data-testid="ctp-remove">
                <span className={icon}><XCircle className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0"><span className="block text-[13.5px] font-black text-[#111827] dark:text-white">Remove the circle</span>
                  <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Show all {p.total} {town} homes</span></span>
              </button>
              {cover && (
                <button type="button" className={row} onClick={() => onGrow(cover)} data-testid="ctp-grow">
                  <span className={icon}><Expand className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0"><span className="block text-[13.5px] font-black text-[#111827] dark:text-white">Grow the circle to {mi(cover)}</span>
                    <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Same center - takes in all of {town}</span></span>
                </button>
              )}
              {p.center && (
                <button type="button" className={row} onClick={onMove} data-testid="ctp-move">
                  <span className={icon}><Crosshair className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0"><span className="block text-[13.5px] font-black text-[#111827] dark:text-white">Move the center to {town}</span>
                    <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Keeps {mi(ask.circle.diameter)} - takes in {p.center_inside} of {p.total} {town} homes</span></span>
                </button>
              )}
              {onPickOnMap && (
                <button type="button" className={row} onClick={onPickOnMap} data-testid="ctp-pick">
                  <span className={icon}><MapPin className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0"><span className="block text-[13.5px] font-black text-[#111827] dark:text-white">Pick a new center on the map</span>
                    <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Press and drag out from a spot to set the size</span></span>
                </button>
              )}
            </div>
            <button type="button" onClick={onClose} data-testid="ctp-keep"
              className="mt-3 w-full rounded-2xl py-2.5 text-[12.5px] font-black text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5">
              Keep it as is - only the {p.inside} inside
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
