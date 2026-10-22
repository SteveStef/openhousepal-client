'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Home, Loader2, Send, Users } from 'lucide-react'
import api from '@/lib/api-service'
import type { MyListingItem } from '@/types'
import { DayStep, FlowFooter, HostFlowWindow, SentMoment, Summary, TimeStep, clockRange, dayLong, isAnytime, type TimePick } from './HostFlowParts'
import { compactPrice } from '@/components/dash/openHouseBits'

// "Ask my team to host" (My Team), the same step-by-step window as Find a Host but with the team
// already chosen (user, 10/22): (1) which home - skipped when you only have one, (2) the day,
// (3) the time or "any time", (4) a note and Send.

export default function TeamAskFlow({ open, listings, teamSize, onClose, onSent }: {
  open: boolean
  listings: MyListingItem[]
  /** Accepted teammates - who gets it. */
  teamSize: number
  onClose: () => void
  onSent: () => void
}) {
  const hostable = listings.filter(l => l.hosting_blocked !== 'pending' && l.hosting_blocked !== 'off_market')
  const single = hostable.length === 1
  const [step, setStep] = useState<'home' | 'day' | 'time' | 'send' | 'done'>(single ? 'day' : 'home')
  const [dir, setDir] = useState(1)
  const [key, setKey] = useState(single ? hostable[0].listing_key : '')
  const [days, setDays] = useState<string[]>([])
  const [time, setTime] = useState<TimePick | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const sendingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const one = hostable.length === 1
    setStep(one ? 'day' : 'home'); setDir(1); setKey(one ? hostable[0].listing_key : '')
    setDays([]); setTime(null); setNote(''); setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const listing = hostable.find(l => l.listing_key === key) || null
  const order = single ? ['day', 'time', 'send', 'done'] : ['home', 'day', 'time', 'send', 'done']
  const go = (s: typeof step) => { setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1); setStep(s); setError('') }

  const taken = new Map<string, string>()
  for (const o of listing ? [...listing.scheduled_opens, ...listing.confirmed_pending_kit] : []) if (o.scheduled_date) taken.set(o.scheduled_date, o.hosting_agent_name || 'yes')

  const send = async () => {
    if (sendingRef.current || !listing || !days[0] || !time) return
    sendingRef.current = true
    setSending(true)
    const { success, error } = await api.openHouseManager.createBroadcast({
      listing_key: listing.listing_key,
      requested_date: days[0],
      requested_start_time: isAnytime(time) ? undefined : time.start,
      requested_end_time: isAnytime(time) ? undefined : time.end,
      is_anytime: isAnytime(time),
      message: note.trim() || undefined,
    })
    sendingRef.current = false
    setSending(false)
    if (success) go('done')
    else setError(error || 'That didn’t go through - please try again.')
  }

  const steps = single ? ['Pick the day', 'Pick the time', 'Send to your team'] : ['Pick the home', 'Pick the day', 'Pick the time', 'Send to your team']
  const stepNo = order.indexOf(step === 'done' ? 'send' : step) + 1
  const titles = { home: 'Which home needs a host?', day: 'Which day?', time: 'What time?', send: 'Add a note and send', done: '' }
  const street = listing?.address?.split(',')[0] || 'Your listings'
  const place = listing ? [listing.city, [listing.state, listing.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : `${hostable.length} homes`

  return (
    <HostFlowWindow
      open={open}
      onClose={step === 'done' ? onSent : onClose}
      busy={sending}
      photo={listing?.image || hostable[0]?.image}
      street={street}
      place={place}
      kicker="Ask my team"
      steps={steps}
      stepNo={stepNo}
      done={step === 'done'}
      title={titles[step]}
      stepKey={step}
      dir={dir}
      footer={step === 'home'
        ? <FlowFooter onNext={() => go('day')} disabled={!listing} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'day'
        ? <FlowFooter onBack={single ? undefined : () => go('home')} onNext={() => go('time')} disabled={!days.length} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'time'
        ? <FlowFooter onBack={() => go('day')} onNext={() => go('send')} disabled={!time} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : <FlowFooter onBack={() => go('time')} onNext={send} busy={sending}
            nextLabel={sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Ask my team</>} />}
    >
      {step === 'home' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {hostable.map((l, i) => {
            const on = l.listing_key === key
            return (
              <motion.button key={l.listing_key} type="button" whileTap={{ scale: 0.97 }} onClick={() => { setKey(l.listing_key); setDays([]); window.setTimeout(() => go('day'), 240) }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 hover:border-[#C9A24D] dark:border-white/10'}`}>
                <span className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218]">
                  {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <Home className="m-auto mt-4 h-5 w-5 text-[#e8c97a]/60" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] font-black ${on ? '' : 'text-[#111827] dark:text-white'}`}>{l.address.split(',')[0]}</span>
                  <span className={`block truncate text-[11px] font-bold ${on ? 'opacity-70' : 'text-gray-400'}`}>{[compactPrice(l.price), l.city].filter(Boolean).join(' · ')}</span>
                  {l.needs_host_this_weekend && <span className={`mt-0.5 block text-[10px] font-black uppercase tracking-wide ${on ? 'text-[#e8c97a]' : 'text-amber-600'}`}>Needs a host this weekend</span>}
                </span>
                {on && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
              </motion.button>
            )
          })}
        </div>
      )}
      {step === 'day' && listing && (
        <DayStep picked={days} onToggle={d => setDays(cur => (cur[0] === d ? [] : [d]))}
          hostingWindow={{ hosting_blocked: listing.hosting_blocked, hosts_from: listing.hosts_from }}
          info={d => ({ taken: taken.get(d) || null })} />
      )}
      {step === 'time' && <TimeStep value={time} onChange={setTime} allowAnytime days={days} />}
      {step === 'send' && time && listing && (
        <div className="space-y-4">
          <Summary rows={[
            { label: 'Home', value: listing.address.split(',')[0] },
            { label: 'Day', value: dayLong(days[0]) },
            { label: 'Time', value: isAnytime(time) ? 'Any time - the host picks' : clockRange(time.start, time.end) },
            { label: 'Asking', value: <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-[#C9A24D]" /> Your team ({teamSize})</span> },
          ]} />
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">A note (optional)</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Anything they should know - parking, the seller, what to bring..."
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold text-rose-600">{error}</motion.p>}
        </div>
      )}
      {step === 'done' && (
        <SentMoment title="Sent to your team" text="Everyone on your team gets it right away. The first one to say yes hosts - you'll see their answer here." onClose={onSent} />
      )}
    </HostFlowWindow>
  )
}
