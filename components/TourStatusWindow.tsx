'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, CalendarClock, CalendarPlus, Check, Hourglass, X } from 'lucide-react'
import { backdropMotion, useIsPhone, useLastValue, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

// A showing request as the buyer sees it: waiting on the agent ("Pending approval") or confirmed,
// the times they asked for, when they sent it - and a way to ask for another time.

export type TourLike = {
  preferred_date: string; preferred_time: string
  preferred_date_2?: string | null; preferred_time_2?: string | null
  preferred_date_3?: string | null; preferred_time_3?: string | null
  confirmed_date?: string | null; confirmed_time?: string | null
  is_completed?: boolean; created_at?: string; message?: string | null
}

/** pending = waiting on the agent; confirmed = the agent set the time; done = it happened. */
export const tourState = (t?: TourLike | null): 'none' | 'pending' | 'confirmed' | 'done' =>
  !t ? 'none' : t.is_completed ? 'done' : t.confirmed_date ? 'confirmed' : 'pending'

const pad = (n: number) => String(n).padStart(2, '0')
export const tourWhen = (date?: string | null, time?: string | null, long = false) => {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const day = dt.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })
  if (!time) return day
  const [h, mi] = time.split(':').map(Number)
  return `${day} · ${h % 12 || 12}:${pad(mi || 0)} ${h >= 12 ? 'PM' : 'AM'}`
}
const sentAgo = (iso?: string) => {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TourStatusWindow({ tour, address, agentName, onClose, onRequestAnother, home }: {
  tour: TourLike | null
  address?: string | null
  agentName?: string | null
  /** Shows the home itself (photo, street, town) at the top of the details - for a page that
   *  isn't already about one home (the Schedule a Showing form). */
  home?: { photo?: string | null; street: string; place?: string } | null
  onClose: () => void
  onRequestAnother: () => void
}) {
  const shown = useLastValue(tour)
  const sheetMotion = useSheetMotion()
  const phone = useIsPhone()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, phone && !!tour)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, onClose])
  if (!host) return null
  const state = tourState(shown)
  const first = (agentName || '').trim().split(' ')[0] || 'your agent'
  const asked = shown ? ([[shown.preferred_date, shown.preferred_time], [shown.preferred_date_2, shown.preferred_time_2], [shown.preferred_date_3, shown.preferred_time_3]] as const).filter(([d]) => d) : []
  return createPortal(
    <AnimatePresence>
      {tour && shown && (
        <motion.div {...backdropMotion} className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0b0b0c]/60 sm:items-center sm:p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div ref={sheetRef} {...sheetMotion} style={phone ? { y: sheetY } : undefined} className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#141416] sm:max-h-[90vh] sm:max-w-md sm:rounded-[28px]">
            {/* status header */}
            <div className={`relative isolate overflow-hidden px-6 pb-6 pt-6 text-white ${state === 'confirmed' || state === 'done' ? 'bg-emerald-600' : 'bg-[#0b0b0c]'}`}>
              {/* Phones: a grab handle - the sheet can be pulled down to close. */}
              <span aria-hidden className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/30 sm:hidden" />
              <div className="absolute inset-0 -z-10" style={{ background: state === 'pending' ? 'radial-gradient(120% 120% at 100% 0%, rgba(245,158,11,.45), transparent 55%), linear-gradient(135deg,#0b0b0c,#18140c)' : 'radial-gradient(120% 120% at 100% 0%, rgba(255,255,255,.25), transparent 55%)' }} />
              <div className="flex items-start justify-between gap-3">
                <motion.span initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 15 }}
                  className={`grid h-12 w-12 place-items-center rounded-2xl shadow-lg ${state === 'pending' ? 'bg-amber-400 text-[#111827]' : 'bg-white text-emerald-600'}`}>
                  {state === 'pending' ? <Hourglass className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />}
                </motion.span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"><X className="h-4 w-4" /></motion.button>
              </div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.26em] text-white/70">{state === 'pending' ? 'Pending approval' : state === 'done' ? 'Toured' : 'Confirmed'}</p>
              <h3 className="mt-1 font-serif text-2xl font-black leading-tight">
                {state === 'pending' ? `Waiting on ${first}` : state === 'done' ? 'You toured this home' : tourWhen(shown.confirmed_date, shown.confirmed_time, true)}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/75">
                {state === 'pending'
                  ? `${first.charAt(0).toUpperCase() + first.slice(1)} will confirm one of your times shortly - you'll get a message when they do.`
                  : state === 'done' ? 'Hope you loved it.' : `${address ? `${address} - ` : ''}see you there.`}
              </p>
              {state === 'pending' && (
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
                  <motion.span className="block h-full w-1/3 rounded-full bg-amber-400" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                </div>
              )}
            </div>

            <div className="space-y-4 px-6 py-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              {home && (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-100 p-2 dark:border-white/[0.07]">
                  <span className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.06]">
                    {home.photo && <img src={home.photo} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-base font-black text-[#111827] dark:text-white">{home.street}</span>
                    {home.place && <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{home.place}</span>}
                  </span>
                </div>
              )}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">You asked for</p>
                <ul className="mt-2 space-y-1.5">
                  {asked.map(([d, t], i) => {
                    const chosen = state !== 'pending' && shown.confirmed_date === d && (!shown.confirmed_time || shown.confirmed_time === t)
                    return (
                      <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${chosen ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-gray-50 dark:bg-white/[0.04]'}`}>
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${chosen ? 'bg-emerald-500 text-white' : 'bg-[#C9A24D] text-[#111827]'}`}>{chosen ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}</span>
                        <span className="text-sm font-bold text-[#111827] dark:text-white">{tourWhen(d, t, true)}</span>
                        {i === 0 && !chosen && <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-gray-400">Top pick</span>}
                      </motion.li>
                    )
                  })}
                </ul>
              </div>
              {shown.message && <p className="rounded-2xl bg-gray-50 px-3 py-2.5 text-sm italic text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">&ldquo;{shown.message}&rdquo;</p>}
              {shown.created_at && <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400"><CalendarClock className="h-3.5 w-3.5" /> Requested {sentAgo(shown.created_at)}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-gray-200 py-3 text-[11px] font-black uppercase tracking-widest text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">Close</button>
                {state !== 'pending' && (
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onRequestAnother}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111827] py-3 text-[11px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">
                    <CalendarPlus className="h-4 w-4" /> Book another
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  )
}
