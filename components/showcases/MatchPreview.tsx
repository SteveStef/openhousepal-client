'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { MatchHome, niceStreet, shortPrice } from '@/components/showcases/MatchBits'

// A home opened up inside the New Matches mailbox (owner, 11/06): flip through its photos on the left,
// every stat on the right, so the agent can tell if it's a possible match without leaving the list.

const cache = new Map<string, any>()
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '')
const nice = (s?: string | null) => (s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const list = (v?: string[] | null) => (v || []).filter(Boolean).join(', ')

/** The stats worth seeing at a glance; anything the listing doesn't have is left out. */
function statsOf(it: MatchHome, p: any): [string, string][] {
  const fee = p?.AssociationFee ? `${money(p.AssociationFee)}${p.AssociationFeeFrequency ? ` ${nice(p.AssociationFeeFrequency).toLowerCase()}` : ''}` : ''
  const rows: [string, unknown][] = [
    ['Beds', p?.BedroomsTotal ?? it.beds],
    ['Baths', p?.BathroomsTotal ?? it.baths],
    ['Sq ft', (p?.LivingArea ?? it.sqft) ? Math.round(p?.LivingArea ?? it.sqft).toLocaleString() : ''],
    ['Lot', p?.LotSizeAcres ? `${p.LotSizeAcres} acres` : ''],
    ['Built', p?.YearBuilt],
    ['Type', nice(p?.PropertyType)],
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
  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800" data-testid="match-photos"
      onTouchStart={e => { touch.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touch.current === null) return
        const moved = e.changedTouches[0].clientX - touch.current
        touch.current = null
        if (Math.abs(moved) > 36) go(moved < 0 ? 1 : -1)
      }}>
      {count > 0 && <img key={photos[at]} src={resolveMediaUrl(photos[at])} alt={alt} draggable={false} onError={() => setBroken(b => [...b, photos[at]])} className="h-full w-full object-cover" />}
      {count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" data-testid="match-photo-prev" className="absolute left-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" data-testid="match-photo-next" className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black tabular-nums text-white" data-testid="match-photo-count">{at + 1} / {count}</span>
        </>
      )}
    </div>
  )
}

export default function MatchPreview({ it, agentId }: { it: MatchHome; agentId?: string }) {
  const key = it.listing_key || ''
  const [home, setHome] = useState<any>(() => cache.get(key) || null)
  const [loading, setLoading] = useState(!!key && !!agentId && !cache.has(key))

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
  const photos: string[] = home?.photos?.length ? home.photos : it.photo ? [it.photo] : []
  const stats = statsOf(it, home)
  const remarks: string = home?.PublicRemarks || ''
  return (
    <div className="grid gap-3 border-t border-gray-100 p-2.5 dark:border-gray-800 sm:grid-cols-2" data-testid="match-preview">
      <PhotoFlip photos={photos} alt={street} />
      <div className="min-w-0">
        <p className="text-xl font-black tracking-tight text-[#111827] dark:text-white">{money(home?.ListPrice ?? it.price) || shortPrice(it.price)}</p>
        <p className="truncate text-xs font-bold text-gray-500 dark:text-gray-400">{[street, nice(it.city), it.state].filter(Boolean).join(', ')}</p>
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Getting the details...</p>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5" data-testid="match-stats">
            {stats.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">{k}</dt>
                <dd className="truncate text-[13px] font-bold text-[#111827] dark:text-white" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {remarks && <p className="line-clamp-3 text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-300 sm:col-span-2">{remarks}</p>}
    </div>
  )
}
