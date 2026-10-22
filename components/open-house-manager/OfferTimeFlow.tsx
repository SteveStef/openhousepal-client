'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarClock, Loader2, Send } from 'lucide-react'
import { DayStep, FlowFooter, HostFlowWindow, SentMoment, Summary, TimeStep, clockRange, dayLong, dayShort, isAnytime, type TimePick } from './HostFlowParts'
import type { HostingWindow } from './WeekendCalendarCards'

// "Offer a different time" (user picked it on the review page, 10/22) - for a listing agent
// answering a host request, a host answering a counter, or a teammate answering a team ask. The
// same window as Request to Host: their ask stays in view, (1) the day - their day is marked,
// days with a host are crossed out, (2) the time, (3) a note and Send.

export default function OfferTimeFlow({ open, street, place, photo, theirDate, theirStart, theirEnd, theirLabel = 'They asked for', toName, taken, hostingWindow, onSend, onClose }: {
  open: boolean
  street: string
  place?: string
  photo?: string | null
  theirDate?: string | null
  theirStart?: string | null
  theirEnd?: string | null
  theirLabel?: string
  /** Who gets it ("Tom"). */
  toName?: string
  /** Days that already have a host -> who. */
  taken?: Map<string, string>
  hostingWindow?: HostingWindow
  /** Throws (or rejects) when it didn't go - the window shows the problem and stays open. */
  onSend: (date: string, start: string, end: string, note: string) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState<'day' | 'time' | 'send' | 'done'>('day')
  const [dir, setDir] = useState(1)
  const [days, setDays] = useState<string[]>([])
  const [time, setTime] = useState<TimePick | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStep('day'); setDir(1); setDays([]); setTime(null); setNote(''); setError('')
  }, [open])

  const order = ['day', 'time', 'send', 'done']
  const go = (s: typeof step) => { setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1); setStep(s); setError('') }
  const ask = theirDate ? `${dayShort(theirDate)}${theirStart && theirEnd ? ` · ${clockRange(theirStart.slice(0, 5), theirEnd.slice(0, 5))}` : ''}` : ''

  const send = async () => {
    if (!days[0] || !time || isAnytime(time) || sending) return
    setSending(true)
    setError('')
    try {
      await onSend(days[0], time.start, time.end, note.trim())
      go('done')
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : 'That didn’t go through - please try again.')
    } finally {
      setSending(false)
    }
  }

  const askCard = ask && (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.05] px-4 py-3">
      <CalendarClock className="h-5 w-5 shrink-0 text-[#C9A24D]" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a8843a] dark:text-[#e8c97a]">{theirLabel}</p>
        <p className="truncate text-[14px] font-bold text-[#111827] dark:text-white">{ask}</p>
      </div>
    </div>
  )

  return (
    <HostFlowWindow
      open={open}
      onClose={onClose}
      busy={sending}
      photo={photo}
      street={street}
      place={place}
      kicker="Offer another time"
      steps={['Pick the day', 'Pick the time', 'Send it']}
      stepNo={step === 'day' ? 1 : step === 'time' ? 2 : 3}
      done={step === 'done'}
      title={step === 'day' ? 'Which day instead?' : step === 'time' ? 'What time?' : 'Add a note and send'}
      stepKey={step}
      dir={dir}
      footer={step === 'day'
        ? <FlowFooter onNext={() => go('time')} disabled={!days.length} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'time'
        ? <FlowFooter onBack={() => go('day')} onNext={() => go('send')} disabled={!time} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : <FlowFooter onBack={() => go('time')} onNext={send} busy={sending}
            nextLabel={sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Send this time</>} />}
    >
      {step === 'day' && (
        <DayStep picked={days} onToggle={d => setDays(cur => (cur[0] === d ? [] : [d]))} hostingWindow={hostingWindow} hint={askCard}
          info={d => ({ taken: taken?.get(d) || null, asked: d === theirDate })} />
      )}
      {step === 'time' && <>{askCard}<TimeStep value={time} onChange={setTime} days={days} /></>}
      {step === 'send' && time && !isAnytime(time) && (
        <div className="space-y-4">
          <Summary rows={[
            ...(ask ? [{ label: 'Asked', value: <span className="text-gray-400 line-through decoration-1">{ask}</span> }] : []),
            { label: 'Instead', value: `${dayLong(days[0])}, ${clockRange(time.start, time.end)}` },
            ...(toName ? [{ label: 'To', value: toName }] : []),
          ]} />
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">A note (optional)</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="e.g. Saturday is taken - would Sunday work?"
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold text-rose-600">{error}</motion.p>}
        </div>
      )}
      {step === 'done' && (
        <SentMoment title="New time sent" text={`${toName ? `${toName} gets` : 'They get'} it right away and can say yes with one tap.`} onClose={onClose} />
      )}
    </HostFlowWindow>
  )
}
