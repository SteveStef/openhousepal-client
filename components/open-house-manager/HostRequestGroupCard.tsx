'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, Check, Loader2, Quote, X } from 'lucide-react'
import { HostRequest } from '@/types'
import { normalizeImageUrl } from '@/lib/utils'

// One "I'd host any of these" ask (owner, 11/12) as ONE card for the listing agent: who's asking,
// their note, and each home + day + time with its own Yes. Yes to one closes the host's other
// homes that same day (they can only host one open a day); "None of these" answers the whole ask.

const titleCase = (v?: string | null) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : v || '')
function day(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function clock(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function HostRequestGroupCard({ requests, onApprove, onDeclineAll }: {
  requests: HostRequest[]
  onApprove: (id: string) => Promise<void>
  onDeclineAll: (groupId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmNone, setConfirmNone] = useState(false)
  const r0 = requests[0]
  const homes = new Set(requests.map(r => r.listing_key)).size
  const who = r0.requesting_agent_name
  const first = who.split(' ')[0] || who
  const yes = async (id: string) => { setBusy(id); await onApprove(id); setBusy(null) }
  const none = async () => { setBusy('none'); await onDeclineAll(r0.group_id as string); setBusy(null); setConfirmNone(false) }
  const sorted = [...requests].sort((a, b) => `${a.requested_date}${a.requested_start_time}`.localeCompare(`${b.requested_date}${b.requested_start_time}`))
  // One day for all of them = they pick ONE home. Different days = yes to any, even more than one.
  const days = Array.from(new Set(requests.map(r => r.requested_date))).sort()
  const oneDay = days.length === 1
  // The same days offered for every home ("Sat or Sun, any of these") - one home per day.
  const keys = Array.from(new Set(requests.map(r => r.listing_key)))
  const sameSet = !oneDay && homes > 1 && keys.every(k => days.every(d => requests.some(r => r.listing_key === k && r.requested_date === d)))
  const title = homes > 1
    ? (oneDay ? `${who} would host one of these ${homes} homes` : `${who} would host any of these ${homes} homes`)
    : `${who} offered ${requests.length} times`
  const how = homes <= 1
    ? 'Pick the time that works for you.'
    : oneDay
    ? `Same day for all - pick the one home you want hosted on ${day(days[0])}.`
    : sameSet
    ? `Any of these homes on ${days.map(day).join(' or ')} - pick one home for each day you want.`
    : 'A day and time for each home - say yes to as many as you like.'
  const badge = oneDay || homes <= 1 ? 'Pick one' : sameSet ? 'One per day' : 'Pick any'
  return (
    <div className="overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-white shadow-[0_18px_40px_-30px_rgba(139,115,85,.9)] dark:bg-[#151517]" data-testid="host-request-group">
      <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-white/[0.06]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#111827] to-[#2a2218] text-sm font-black text-[#e8c97a]">{(first[0] || '?').toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-balance break-words text-[15px] font-black leading-snug text-[#111827] dark:text-white">{title}</p>
          <p className="break-words text-[12px] font-semibold text-gray-500 dark:text-gray-400">
            {[r0.requesting_agent_brokerage, homes > 1 ? `${homes} of your homes` : titleCase(r0.property_address)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#e8c97a]" data-testid="host-request-group-badge">{badge}</span>
      </div>
      <p className="flex items-center gap-2 bg-[#C9A24D]/[0.07] px-4 py-2 text-[12.5px] font-bold text-[#5c4a1f] dark:text-[#e8cf8a]" data-testid="host-request-group-how">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> {how}
      </p>
      {r0.message && (
        <p className="flex gap-2 px-4 pt-3 text-[13px] font-medium italic leading-snug text-gray-600 dark:text-gray-300">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> {r0.message}
        </p>
      )}
      <ul className="space-y-2 p-3">
        <AnimatePresence initial={false}>
          {sorted.map(r => (
            <motion.li key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, height: 0 }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#FAFAF7] p-2 dark:border-white/[0.06] dark:bg-white/[0.03]" data-testid="host-request-option">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10">
                {r.property_image && <img src={normalizeImageUrl(r.property_image)} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-black text-[#111827] dark:text-white">{titleCase(r.property_address) || 'Your listing'}</span>
                <span className="block truncate text-[12px] font-bold text-gray-500 dark:text-gray-400">{day(r.requested_date)} · {clock(r.requested_start_time)} - {clock(r.requested_end_time)}</span>
              </span>
              <motion.button type="button" whileTap={{ scale: 0.94 }} disabled={!!busy} onClick={() => yes(r.id)} data-testid="host-request-option-yes"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-[12px] font-black text-white transition disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Yes
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-white/[0.06]">
        <p className="text-[11.5px] font-semibold text-gray-400">{oneDay ? `${first} can only host one open that day - your yes closes the rest.` : `${first} can host one open a day - a yes closes only their others on that same day.`}</p>
        <AnimatePresence mode="wait" initial={false}>
          {confirmNone ? (
            <motion.div key="c" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setConfirmNone(false)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-black text-gray-500">Keep</button>
              <button type="button" disabled={!!busy} onClick={none} data-testid="host-request-none-confirm"
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50">
                {busy === 'none' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Say no to all
              </button>
            </motion.div>
          ) : (
            <motion.button key="n" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmNone(true)} data-testid="host-request-none"
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-gray-300">
              None of these
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
