'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bath, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Ruler } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { MatchActivity, MatchHome, matchedAgo, niceStreet, shortPrice } from '@/components/showcases/MatchBits'

// A home opened up inside the New Matches mailbox (owner, 11/06): flip through its photos on the left,
// every stat on the right, so the agent can tell if it's a possible match without leaving the list.
// 11/13 (owner: "the photo glitches a bit, the info doesn't look nice"): the first photo is the one
// already on the row (it never swaps when the listing's details arrive), photos fade in over a calm
// placeholder and stay mounted once seen, and the details are key-fact tiles + a tidy details list.

const cache = new Map<string, any>()
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '')
const nice = (s?: string | null) => (s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const list = (v?: string[] | null) => (v || []).filter(Boolean).join(', ')

/** Beds / baths / sq ft / year built - the four tiles across the top. */
function keyFacts(it: MatchHome, p: any) {
  const sqft = p?.LivingArea ?? it.sqft
  return [
    { k: 'Beds', v: p?.BedroomsTotal ?? it.beds, icon: BedDouble },
    { k: 'Baths', v: p?.BathroomsTotal ?? it.baths, icon: Bath },
    { k: 'Sq ft', v: sqft ? Math.round(sqft).toLocaleString() : null, icon: Ruler },
    { k: 'Built', v: p?.YearBuilt ?? null, icon: CalendarDays },
  ].filter(f => f.v !== null && f.v !== undefined && f.v !== '')
}

/** The rest of the stats worth seeing; anything the listing doesn't have is left out. */
function statsOf(p: any): [string, string][] {
  const fee = p?.AssociationFee ? `${money(p.AssociationFee)}${p.AssociationFeeFrequency ? ` ${nice(p.AssociationFeeFrequency).toLowerCase()}` : ''}` : ''
  const rows: [string, unknown][] = [
    ['Type', nice(p?.PropertySubType || p?.PropertyType)],
    ['Lot', p?.LotSizeAcres ? `${p.LotSizeAcres} acres` : ''],
    ['Style', list(p?.ArchitecturalStyle)],
    ['On market', p?.DaysOnMarket != null ? `${p.DaysOnMarket} day${p.DaysOnMarket === 1 ? '' : 's'}` : ''],
    ['Per sq ft', p?.PricePerSquareFoot ? money(p.PricePerSquareFoot) : ''],
    ['Garage', p?.GarageSpaces ? `${p.GarageSpaces} car` : ''],
    ['Basement', list(p?.Basement)],
    ['HOA', fee],
    ['Taxes', p?.TaxAnnualAmount ? `${money(p.TaxAnnualAmount)} a year` : ''],
    ['Schools', nice(p?.SchoolDistrictName)],
  ]
  return rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
}

function PhotoFlip({ photos: all, alt }: { photos: string[]; alt: string }) {
  const [at, setAt] = useState(0)
  const [broken, setBroken] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string[]>([])
  const touch = useRef<number | null>(null)
  // A listing can carry a dead photo: it's skipped, never shown as a broken picture.
  const photos = useMemo(() => all.filter(p => !broken.includes(p)), [all, broken])
  const count = photos.length
  useEffect(() => { setAt(i => (count ? Math.min(i, count - 1) : 0)) }, [count])
  // The next photo is already there when they tap.
  useEffect(() => {
    if (count < 2) return
    const next = new Image()
    next.src = resolveMediaUrl(photos[(at + 1) % count])
  }, [at, count, photos])
  const go = (step: number) => setAt(i => (i + step + count) % count)
  const src = count ? photos[at] : ''
  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-gradient-to-br from-[#efe6d4] to-[#d9c7a3] dark:from-[#1d1a14] dark:to-[#2a2218]" data-testid="match-photos"
      onTouchStart={e => { touch.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touch.current === null) return
        const moved = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (Math.abs(moved) > 36) go(moved < 0 ? 1 : -1)
      }}>
      {/* Every photo seen so far stays mounted underneath, so flipping back never flashes empty. */}
      {photos.map(p => (p === src || loaded.includes(p)) && (
        <img key={p} src={resolveMediaUrl(p)} alt={p === src ? alt : ''} draggable={false} decoding="async"
          onLoad={() => setLoaded(l => (l.includes(p) ? l : [...l, p]))} onError={() => setBroken(b => [...b, p])}
          className={`ohp-mls-crop absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${p === src && loaded.includes(p) ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
      {count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" data-testid="match-photo-prev" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111827] shadow-md transition hover:bg-white active:scale-95"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" data-testid="match-photo-next" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111827] shadow-md transition hover:bg-white active:scale-95"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black tabular-nums text-white" data-testid="match-photo-count">{at + 1} / {count}</span>
        </>
      )}
    </div>
  )
}

export default function MatchPreview({ it, agentId }: { it: MatchHome; agentId?: string }) {
  const key = it.listing_key || ''
  const [home, setHome] = useState<any>(() => cache.get(key) || null)
  const [loading, setLoading] = useState(!!key && !!agentId && !cache.has(key))
  const [more, setMore] = useState(false)

  useEffect(() => {
    if (!key || !agentId || cache.has(key)) return
    let live = true
    api.properties.getPropertyForAgent(key, agentId).then(({ success, data }) => {
      if (success && data) { cache.set(key, data); if (live) setHome(data) }
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [key, agentId])

  const street = niceStreet(it.address) || 'Home'
  // The row's own photo stays first - it doesn't swap for the listing's copy of it when details land.
  const listing: string[] = home?.photos?.length ? home.photos : []
  const photos: string[] = it.photo ? [it.photo, ...listing.slice(1)] : listing
  const facts = keyFacts(it, home)
  const stats = statsOf(home)
  const remarks: string = home?.PublicRemarks || ''
  const price = money(home?.ListPrice ?? it.price) || shortPrice(it.price)
  return (
    <div className="grid gap-3 border-t border-gray-100 p-3 dark:border-gray-800 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] sm:gap-4" data-testid="match-preview">
      <PhotoFlip photos={photos} alt={street} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-[1.6rem] font-black leading-none tracking-tight text-[#111827] dark:text-white">{price}</p>
            <p className="mt-1 truncate text-[12.5px] font-bold text-gray-500 dark:text-gray-400">{[street, nice(it.city), it.state].filter(Boolean).join(', ')}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a]">
            {it.matched_at ? `Matched ${matchedAgo(it.matched_at)}` : 'New match'}
          </span>
        </div>
        {facts.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-1.5" data-testid="match-facts">
            {facts.map(f => (
              <div key={f.k} className="min-w-0 rounded-xl border border-gray-100 bg-[#faf9f7] px-1.5 py-2 text-center dark:border-white/[0.06] dark:bg-white/[0.04]">
                <f.icon className="mx-auto h-3.5 w-3.5 text-[#C9A24D]" />
                <p className="mt-1 truncate text-[13.5px] font-black leading-none text-[#111827] dark:text-white">{String(f.v)}</p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-gray-400">{f.k}</p>
              </div>
            ))}
          </div>
        )}
        {loading ? (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2" aria-label="Getting the details">
            {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="ohp-skeleton h-7 rounded-lg" />)}
          </div>
        ) : stats.length > 0 && (
          <dl className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2" data-testid="match-stats">
            {stats.map(([k, v]) => (
              <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 dark:border-white/[0.06]">
                <dt className="shrink-0 text-[11px] font-bold text-gray-400">{k}</dt>
                <dd className="min-w-0 truncate text-right text-[12.5px] font-black text-[#111827] dark:text-white" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-2.5"><MatchActivity a={it.activity} /></div>
      </div>
      {remarks && (
        <div className="sm:col-span-2">
          <p className={`text-[12.5px] font-medium leading-relaxed text-gray-600 dark:text-gray-300 ${more ? '' : 'line-clamp-3'}`}>{remarks}</p>
          {remarks.length > 220 && (
            <button type="button" onClick={() => setMore(m => !m)} className="mt-1 text-[11.5px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">{more ? 'Show less' : 'Read more'}</button>
          )}
        </div>
      )}
    </div>
  )
}
