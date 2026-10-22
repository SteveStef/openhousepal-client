'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Loader2, Search, Send, Star, User, Users } from 'lucide-react'
import api from '@/lib/api-service'
import type { AgentSearchResult } from '@/types'
import type { HostingWindow } from './WeekendCalendarCards'
import { DayStep, FlowFooter, HostFlowWindow, SentMoment, Summary, TimeStep, clockRange, dayLong, isAnytime, type TimePick } from './HostFlowParts'

// Find a Host (Manage Hosts) as a step-by-step window, the same look as Schedule a Showing and
// Request to Host (user, 10/22): (1) the day, (2) the time - or "any time", (3) who to ask - the
// whole team, one teammate, someone who hosted for you before, or any agent, (4) a note and Send.

type Host = { agent_id: string; name: string; photo_url?: string | null; times_hosted: number }

export default function FindHostFlow({ open, listingKey, street, place, photo, initialDate, hostingWindow, taken, requested, teamHosts, pastHosts, onClose, onSent }: {
  open: boolean
  listingKey: string
  street: string
  place?: string
  photo?: string | null
  initialDate?: string | null
  hostingWindow?: HostingWindow
  /** Days that already have a host -> who. */
  taken: Map<string, string>
  /** Days an agent already asked to host (a request waiting for you). */
  requested: string[]
  teamHosts: Host[]
  /** Hosted for you before (not on your team). */
  pastHosts: Host[]
  onClose: () => void
  onSent: () => void
}) {
  const [step, setStep] = useState<'day' | 'time' | 'who' | 'send' | 'done'>('day')
  const [dir, setDir] = useState(1)
  const [days, setDays] = useState<string[]>(initialDate ? [initialDate] : [])
  const [time, setTime] = useState<TimePick | null>(null)
  const [who, setWho] = useState<{ team: true } | { id: string; name: string } | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AgentSearchResult[]>([])
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const sendingRef = useRef(false)

  // Fresh each time it opens (a calendar-cell click opens it on that day).
  useEffect(() => {
    if (!open) return
    setStep('day'); setDir(1); setDays(initialDate ? [initialDate] : []); setTime(null); setWho(null)
    setQuery(''); setResults([]); setNote(''); setError('')
  }, [open, initialDate])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = window.setTimeout(async () => {
      const { success, data } = await api.openHouseManager.searchAgents(query.trim())
      if (success && data) setResults(data)
    }, 300)
    return () => window.clearTimeout(t)
  }, [query])

  const go = (s: typeof step) => {
    const order = ['day', 'time', 'who', 'send', 'done']
    setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1)
    setStep(s)
    setError('')
  }

  const send = async () => {
    if (sendingRef.current || !days[0] || !time || !who) return
    sendingRef.current = true
    setSending(true)
    const { success, error } = await api.openHouseManager.createBroadcast({
      listing_key: listingKey,
      requested_date: days[0],
      requested_start_time: isAnytime(time) ? undefined : time.start,
      requested_end_time: isAnytime(time) ? undefined : time.end,
      is_anytime: isAnytime(time),
      message: note.trim() || undefined,
      target_agent_id: 'team' in who ? undefined : who.id,
    })
    sendingRef.current = false
    setSending(false)
    if (success) go('done')
    else setError(error || 'That didn’t go through - please try again.')
  }

  const whoLabel = !who ? '' : 'team' in who ? (teamHosts.length === 1 ? 'Your teammate' : `Your whole team (${teamHosts.length})`) : who.name
  const stepNo = { day: 1, time: 2, who: 3, send: 4, done: 4 }[step]
  const titles = { day: 'Which day needs a host?', time: 'What time?', who: 'Who should we ask?', send: 'Add a note and send', done: '' }
  const pickPerson = (h: { id: string; name: string }) => { setWho(h); window.setTimeout(() => go('send'), 260) }

  const person = (h: Host, tone: 'team' | 'past') => {
    const on = !!who && !('team' in who) && who.id === h.agent_id
    return (
      <motion.button key={h.agent_id} type="button" whileTap={{ scale: 0.96 }} onClick={() => pickPerson({ id: h.agent_id, name: h.name })}
        className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 hover:border-[#C9A24D] dark:border-white/10'}`}>
        {h.photo_url
          ? <img src={h.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10"><User className="h-5 w-5" /></span>}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-black ${on ? '' : 'text-[#111827] dark:text-white'}`}>{h.name}</span>
          <span className={`flex items-center gap-1 text-[11px] font-bold ${on ? 'opacity-70' : 'text-gray-400'}`}>
            {tone === 'team' && <Star className="h-3 w-3 fill-current text-[#C9A24D]" />}
            {tone === 'team' ? 'Teammate' : 'Hosted for you'}{h.times_hosted > 0 ? ` · ${h.times_hosted}x` : ''}
          </span>
        </span>
        {on && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
      </motion.button>
    )
  }

  return (
    <HostFlowWindow
      open={open}
      onClose={step === 'done' ? onSent : onClose}
      busy={sending}
      photo={photo}
      street={street}
      place={place}
      kicker="Find a host"
      steps={['Pick the day', 'Pick the time', 'Choose who', 'Send']}
      stepNo={stepNo}
      done={step === 'done'}
      title={titles[step]}
      stepKey={step}
      dir={dir}
      footer={step === 'day'
        ? <FlowFooter onNext={() => go('time')} disabled={!days.length} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'time'
        ? <FlowFooter onBack={() => go('day')} onNext={() => go('who')} disabled={!time} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'who'
        ? <FlowFooter onBack={() => go('time')} onNext={() => go('send')} disabled={!who} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : <FlowFooter onBack={() => go('who')} onNext={send} busy={sending}
            nextLabel={sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> {who && 'team' in who ? 'Ask my team' : `Ask ${whoLabel.split(' ')[0]}`}</>} />}
    >
      {step === 'day' && (
        <DayStep picked={days} onToggle={d => setDays(cur => (cur[0] === d ? [] : [d]))} hostingWindow={hostingWindow}
          info={d => ({ taken: taken.get(d) || null, requested: requested.includes(d) })} />
      )}
      {step === 'time' && <TimeStep value={time} onChange={setTime} allowAnytime days={days} />}
      {step === 'who' && (
        <div className="space-y-5">
          {teamHosts.length > 0 && (
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => { setWho({ team: true }); window.setTimeout(() => go('send'), 260) }}
              className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl p-4 text-left transition ${who && 'team' in who ? 'bg-[#111827] text-white ring-2 ring-[#C9A24D] dark:bg-white dark:text-[#111827]' : 'bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#3a2e18] text-white hover:-translate-y-0.5'}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Users className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black">Ask my whole team</span>
                <span className="block text-[12px] font-semibold opacity-70">{teamHosts.length} {teamHosts.length === 1 ? 'person gets' : 'people get'} it - the first yes hosts</span>
              </span>
              <span className="flex -space-x-2">
                {teamHosts.slice(0, 4).map(h => h.photo_url
                  ? <img key={h.agent_id} src={h.photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-[#111827]" />
                  : <span key={h.agent_id} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 ring-2 ring-[#111827]"><User className="h-3.5 w-3.5" /></span>)}
              </span>
            </motion.button>
          )}
          {teamHosts.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Or one teammate</p>
              <div className="grid gap-2 sm:grid-cols-2">{teamHosts.map(h => person(h, 'team'))}</div>
            </div>
          )}
          {pastHosts.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Hosted for you before</p>
              <div className="grid gap-2 sm:grid-cols-2">{pastHosts.map(h => person(h, 'past'))}</div>
            </div>
          )}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{teamHosts.length || pastHosts.length ? 'Or any agent' : 'Find an agent'}</p>
            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 transition focus-within:border-[#C9A24D] focus-within:ring-4 focus-within:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c]">
              <Search className="h-5 w-5 shrink-0 text-[#C9A24D]" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, email or MLS ID"
                className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white" />
            </label>
            <AnimatePresence initial={false}>
              {results.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-2 space-y-1.5">
                    {results.map(a => (
                      <button key={a.id} type="button" onClick={() => { setQuery(''); setResults([]); pickPerson({ id: a.id, name: a.name }) }}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-left transition hover:border-[#C9A24D] dark:border-white/10">
                        <span className="truncate text-[14px] font-black text-[#111827] dark:text-white">{a.name}</span>
                        <span className="truncate text-[11px] font-semibold text-gray-400">{a.brokerage || a.email}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
      {step === 'send' && time && who && (
        <div className="space-y-4">
          <Summary rows={[
            { label: 'Day', value: dayLong(days[0]) },
            { label: 'Time', value: isAnytime(time) ? 'Any time - the host picks' : clockRange(time.start, time.end) },
            { label: 'Asking', value: whoLabel },
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
        <SentMoment title="Ask sent"
          text={<>{who && 'team' in who ? 'Your team gets it right away - the first one to say yes hosts.' : `${whoLabel.split(' ')[0]} gets it right away.`} You&apos;ll see it under &ldquo;Waiting for an answer&rdquo;.</>}
          onClose={onSent} />
      )}
    </HostFlowWindow>
  )
}
