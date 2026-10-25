'use client'

// "Use a photo of a home you listed or sold" - for designs that aren't about one listing (Home
// Valuation, Make Me Sell, Find Your Dream Home...). A row of the agent's own homes: tap one and its
// photo becomes the main photo (a listing's other photos join the picks below, too). Nothing about
// that home goes on the design - only the picture. Loads only when the Photos card is open.
import { useEffect, useState } from 'react'
import { Check, Home, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import { useOptionalAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'
import { labelCls } from './ui'

interface YourHome { key: string; label: string; tag: 'Listed' | 'Sold'; image: string; photos: string[] }

const nice = (s?: string | null) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s || '')

export default function YourHomesPhotos({ current, onPick }: { current: string | null; onPick: (main: string, more: string[]) => void }) {
  const [homes, setHomes] = useState<YourHome[] | null>(null)
  const planTier = useOptionalAuth()?.user?.plan_tier
  const mls = !planTier || hasMlsAccess(planTier)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Listings (MLS plans only - a No-MLS plan just gets a 403 and shows its sales) + the sales
      // the agent curated in their Agent Hub, falling back to the same lookup the Hub uses.
      const [mine, hub] = await Promise.all([
        mls ? api.openHouseManager.getMyListings().catch(() => null) : Promise.resolve(null),
        api.agentHub.getMine().catch(() => null),
      ])
      // No-MLS: their listings are the ones they added by hand on their Agent Hub / Settings.
      const manualListings: YourHome[] = mls ? [] : (Array.isArray(hub?.data?.config?.myListings) ? hub!.data!.config!.myListings : [])
        .filter((l: any) => l?.source === 'manual' && l?.visible !== false && l?.image)
        .map((l: any) => ({ key: `m-${l.id || l.address}`, label: nice(l.address), tag: 'Listed' as const, image: l.image, photos: (l.photos?.length ? l.photos : [l.image]).filter(Boolean) }))
      let sales: any[] = (Array.isArray(hub?.data?.config?.recentSales) ? hub!.data!.config!.recentSales : []).filter((s: any) => s?.visible !== false)
      if (!sales.length && mls) {
        const res = await api.agentHub.getRecentSales().catch(() => null)
        sales = res?.success ? res.data || [] : []
      }
      const list: YourHome[] = [...manualListings]
      for (const l of mine?.success ? mine.data?.listings || [] : []) {
        const photos = (l.photos?.length ? l.photos : l.image ? [l.image] : []).filter(Boolean) as string[]
        if (photos.length) list.push({ key: `l-${l.listing_key}`, label: nice(l.address), tag: 'Listed', image: photos[0], photos })
      }
      for (const s of sales) {
        if (s?.image) list.push({ key: `s-${s.id || s.address}`, label: nice(s.address), tag: 'Sold', image: s.image, photos: [s.image] })
      }
      if (!cancelled) setHomes(list)
    })()
    return () => { cancelled = true }
  }, [])

  if (homes !== null && homes.length === 0) return null
  return (
    <div>
      <p className={labelCls}>From your homes</p>
      <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Use a photo of a home you listed or sold - only the picture, nothing else about it.</p>
      {homes === null ? (
        <div className="mt-2.5 flex items-center gap-2 text-[11px] font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding your homes...</div>
      ) : (
        <div className="-mx-1 mt-2.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1.5">
          {homes.map(h => {
            const on = !!current && h.photos.includes(current)
            return (
              <button key={h.key} type="button" onClick={() => onPick(h.image, h.photos)} title={`Use the photo of ${h.label}`}
                className="group w-[118px] shrink-0 snap-start text-left">
                <span className={`relative block aspect-[4/3] overflow-hidden rounded-xl bg-gray-100 transition dark:bg-white/5 ${on ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-90 group-hover:opacity-100'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {h.image ? <img src={h.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Home className="m-auto h-5 w-5 text-gray-300" />}
                  <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-px text-[8.5px] font-black uppercase tracking-wide shadow ${h.tag === 'Sold' ? 'bg-[#111827] text-[#e8c97a]' : 'bg-white text-[#111827]'}`}>{h.tag}</span>
                  {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                  {h.photos.length > 1 && <span className="absolute bottom-1 right-1.5 text-[9px] font-black text-white drop-shadow">{h.photos.length} photos</span>}
                </span>
                <span className="mt-1 block truncate text-[10.5px] font-bold text-gray-600 dark:text-gray-300">{h.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
