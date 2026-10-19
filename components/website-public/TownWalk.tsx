'use client'

import { motion } from 'framer-motion'
import { Footprints, ShoppingBasket, TrainFront, Trees, UtensilsCrossed } from 'lucide-react'

// Town page, Getting around: what's within about a 15-minute walk of the town's homes - the share
// of homes with a grocery store / several restaurants / a park / a train station that close, from
// OpenStreetMap against every home's real coordinates (backend town_map_service.refresh_walkability).
// Our own measure - deliberately not called "Walk Score" (a licensed product).
export interface WalkData {
  level?: string
  rows: { key: string; label: string; pct: number }[]
  stations?: string[]
  walk_minutes?: number
}

const ICON: Record<string, any> = { grocery: ShoppingBasket, food: UtensilsCrossed, park: Trees, transit: TrainFront }

export default function TownWalk({ data, town, luxe }: { data?: WalkData | null; town: string; luxe: boolean }) {
  const rows = data?.rows || []
  if (!rows.length) return null
  const mins = data?.walk_minutes || 15
  return (
    <div className={`mt-8 border p-5 sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}><Footprints className="h-3.5 w-3.5" /> On foot from home</p>
          {data?.level && <p className="ohp-site-heading mt-2 text-2xl font-black sm:text-3xl" style={{ color: 'var(--site-heading)' }}>{data.level}</p>}
        </div>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--site-muted)' }}>Share of {town} homes within about a {mins}-minute walk of…</p>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {rows.map((r, i) => {
          const Icon = ICON[r.key] || Footprints
          return (
            <div key={r.key}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)', color: 'var(--site-accent)' }}><Icon className="h-4 w-4" /></span>
                <p className="min-w-0 flex-1 text-[14px] font-bold" style={{ color: 'var(--site-heading)' }}>{r.label}</p>
                <span className="shrink-0 text-lg font-black tabular-nums" style={{ color: 'var(--site-heading)' }}>{r.pct}%</span>
              </div>
              <div className="ml-[42px] mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--site-accent)' }}
                  initial={{ width: 0 }} whileInView={{ width: `${r.pct}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.08 + i * 0.1 }} />
              </div>
            </div>
          )
        })}
      </div>
      {!!data?.stations?.length && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--site-muted)' }}>Stations in walking distance</span>
          {data.stations.map(s => (
            <span key={s} className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
              <TrainFront className="h-3 w-3" style={{ color: 'var(--site-accent)' }} />{s}
            </span>
          ))}
        </div>
      )}
      <p className="mt-5 text-[11px]" style={{ color: 'var(--site-muted)' }}>Measured from every home's location to nearby places on OpenStreetMap. A specific home can be closer or farther - ask me about any address.</p>
    </div>
  )
}
