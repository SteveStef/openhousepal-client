'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarCheck2, CheckCircle2, FolderOpen, Hammer, StickyNote } from 'lucide-react'
import api from '@/lib/api-service'
import type { HostRequest, OpenHouse } from '@/types'
import { todayLocal } from '@/lib/relativeDays'

// Upcoming opens a listing agent approved you to host - right above Your Opens. Kits are
// evergreen (one per home, reused for every date - no reprinting), so each date shows either
// "Kit ready" with your existing kit one tap away, or Build kit for a home you have no kit for yet.

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const fmtTime = (t?: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const nice = (s?: string | null) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s || '')

export default function ConfirmedToHostStrip({ openHouses, onBuild, onOpenKit, autoBuildId }: {
  openHouses: OpenHouse[]
  onBuild: (address: string) => void
  onOpenKit: (kit: OpenHouse) => void
  /** ?build=<request id> - from the approval alert / My Requests: open that kit, or start building it. */
  autoBuildId?: string | null
}) {
  const [requests, setRequests] = useState<HostRequest[]>([])
  const autoDone = useRef(false)

  useEffect(() => {
    api.openHouseManager.getMyRequests().then(({ success, data }) => { if (success && data) setRequests(data) })
  }, [])

  const today = todayLocal()
  const upcoming = requests
    .filter(r => r.status === 'approved' && String(r.requested_date) >= today)
    .sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date)))
  const kitFor = (r: HostRequest) => openHouses.find(oh => oh.listingKey === r.listing_key) || null

  useEffect(() => {
    if (autoDone.current || !autoBuildId) return
    const hit = upcoming.find(r => r.id === autoBuildId)
    if (!hit) return
    autoDone.current = true
    const kit = kitFor(hit)
    if (kit) onOpenKit(kit)
    else if (hit.property_address) onBuild(hit.property_address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBuildId, upcoming.length, openHouses.length])

  if (upcoming.length === 0) return null
  const toBuild = upcoming.filter(r => !kitFor(r)).length
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm"><CalendarCheck2 size={14} /></span>
        <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">You&apos;re confirmed to host</h2>
        {toBuild > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {toBuild === 1 ? '1 kit to build' : `${toBuild} kits to build`}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {upcoming.map(r => {
          const kit = kitFor(r)
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 shadow-[0_14px_34px_-28px_rgba(16,185,129,.8)] dark:border-emerald-500/25 dark:bg-[#151517]">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.property_image && <img src={r.property_image} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[15px] font-black text-[#111827] dark:text-white">{nice(r.property_address) || 'Listing'}</p>
                <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">{fmtDate(String(r.requested_date))} · {fmtTime(r.requested_start_time)} - {fmtTime(r.requested_end_time)}</p>
                {kit ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400"><CheckCircle2 size={11} className="shrink-0 text-emerald-500" /> Kit ready - use the same one</p>
                ) : r.listing_host_notes ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400" title={r.listing_host_notes}>
                    <StickyNote size={11} className="shrink-0" /> {r.listing_host_notes}
                  </p>
                ) : null}
              </div>
              {kit ? (
                <button
                  onClick={() => onOpenKit(kit)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition hover:-translate-y-0.5 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  <FolderOpen size={12} /> Open kit
                </button>
              ) : (
                <button
                  onClick={() => r.property_address && onBuild(r.property_address)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]"
                >
                  <Hammer size={12} /> Build kit
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
