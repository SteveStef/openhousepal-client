'use client'

import { motion } from 'framer-motion'
import { Building2, Car, Plane, TrainFront } from 'lucide-react'

// Town page, Getting around: weekday-morning drive time and train/bus time from the town to the
// places people from here actually go - picked automatically by where the town is (backend
// town_extras_service.pick_destinations): the nearest major downtown, a nearby job center, the
// nearest major airport.
export interface CommuteData {
  destinations: { name: string; kind: 'city' | 'job_center' | 'airport'; drive_minutes: number; transit_minutes?: number; miles?: number }[]
  departure?: string
}

const ICON = { city: Building2, job_center: Building2, airport: Plane }

export default function TownCommute({ data, town, luxe }: { data?: CommuteData | null; town: string; luxe: boolean }) {
  const rows = data?.destinations || []
  if (!rows.length) return null
  const max = Math.max(...rows.map(r => Math.max(r.drive_minutes, r.transit_minutes || 0)), 1)
  return (
    <div className={`mt-8 border p-5 sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>Commute from {town}</p>
        <p className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'var(--site-muted)' }}>
          <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Drive</span>
          <span className="inline-flex items-center gap-1"><TrainFront className="h-3.5 w-3.5" /> Train / bus</span>
          <span>· {data?.departure || 'weekday 8 AM'}</span>
        </p>
      </div>
      <div className="mt-5 space-y-5">
        {rows.map((r, i) => {
          const Icon = ICON[r.kind] || Building2
          return (
            <div key={r.name}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)', color: 'var(--site-accent)' }}><Icon className="h-4 w-4" /></span>
                <p className="min-w-0 truncate text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{r.name}</p>
                {r.miles ? <span className="shrink-0 text-xs font-semibold" style={{ color: 'var(--site-faint)' }}>{Math.round(r.miles)} mi</span> : null}
              </div>
              <div className="mt-2.5 space-y-1.5 pl-[42px]">
                {[{ m: r.drive_minutes, I: Car, solid: true }, ...(r.transit_minutes ? [{ m: r.transit_minutes, I: TrainFront, solid: false }] : [])].map(({ m, I, solid }) => (
                  <div key={solid ? 'd' : 't'} className="flex items-center gap-3">
                    <I className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-muted)' }} />
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                      <motion.div className="h-full origin-left rounded-full" style={{ backgroundColor: solid ? 'var(--site-accent)' : 'rgba(var(--site-accent-rgb),.45)', width: `${(m / max) * 100}%` }}
                        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.12 }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-sm font-black" style={{ color: 'var(--site-heading)' }}>{m} min</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-5 text-[11px]" style={{ color: 'var(--site-muted)' }}>Typical times from the center of {town} at a weekday morning rush, from Google Maps. Your own trip depends on the exact address and the day.</p>
    </div>
  )
}
