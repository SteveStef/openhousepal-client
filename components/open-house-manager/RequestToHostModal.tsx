'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Loader2, MessageSquare, Send, Users } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { IncomingBroadcast } from '@/types'
import { normalizeImageUrl } from '@/lib/utils'
import { BroadcastCard } from './MyRequestsPanel'
import { refreshOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { DayStep, FlowFooter, HostFlowWindow, SentMoment, Summary, TimeStep, clockRange, dayLong, isAnytime, type TimePick } from './HostFlowParts'

// Request to Host as a short step-by-step window, the same look as Schedule a Showing (user,
// 10/22): (1) the day - the coming weekends, or any day on a calendar; up to two days, the second
// is "offer a second open", (2) the time - popular open-house hours or their own, (3) a note and
// Send, then a "sent" moment. Discovery's rows and the Dash Discovery card both open it.

export default function RequestToHostModal({
  property,
  initialDate,
  scheduledOpens = [],
  requestedDates = [],
  teamBroadcasts = [],
  onClose,
  onSent,
  onBroadcastHandled,
  onFallbackToEmail,
  onAlsoReach,
}: {
  property: any
  // Set when the agent got here by clicking an empty weekend-calendar cell on the listing row
  // instead of the plain "Request to Host" button - saves them re-picking the date they just saw.
  initialDate?: string
  // Every open already scheduled (kit built or approved-and-pending) for this listing, so the
  // requester can see what's taken before picking a date instead of finding out after submitting.
  scheduledOpens?: { scheduled_date: string | null, scheduled_start_time: string | null, scheduled_end_time: string | null, hosting_agent_name?: string | null }[]
  /** Days this agent already asked to host here (waiting on the listing agent). */
  requestedDates?: string[]
  // Open "my team needs a host" asks (team-wide or a direct request) for this exact listing that
  // the viewer is eligible to respond to - lets them accept straight from here instead of
  // having to separately find it in My Requests.
  teamBroadcasts?: IncomingBroadcast[]
  onClose: () => void
  onSent: () => void
  // Called after accepting/countering a team broadcast from this window, so the parent page can
  // refresh My Requests / the incoming-broadcasts list the same way it does after a normal send.
  onBroadcastHandled?: () => void
  onFallbackToEmail: () => void
  // After an in-app request: also text / email the listing agent from their own phone (EmailHostFlow "also").
  onAlsoReach?: () => void
}) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<'day' | 'time' | 'note' | 'done'>('day')
  const [dir, setDir] = useState(1)
  const [days, setDays] = useState<string[]>(initialDate ? [initialDate] : [])
  const [time, setTime] = useState<TimePick | null>(null)
  const [respondingBroadcastId, setRespondingBroadcastId] = useState<string | null>(null)
  const [localBroadcasts, setLocalBroadcasts] = useState(teamBroadcasts)
  const [teamOpen, setTeamOpen] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentBoth, setSentBoth] = useState(false)

  const agentName = user?.first_name || 'there'
  const address = property.Street || 'this listing'
  const premadeMessages = [
    `Hi, I'm ${agentName}. I'd love to host the open house at ${address} if you're looking for help.`,
    `Hello, this is ${agentName}. I'd be glad to host an open house at ${address} if you need an extra hand.`,
    `Hi there, I'm ${agentName}, and I'd welcome the opportunity to host your open house at ${address}.`,
    `Hi, ${agentName} here. I'd love to help by hosting an open house at ${address} if you're open to it.`,
    `Hello, I'm ${agentName}. If you're looking for someone to host ${address}, I'd be happy to help out!`,
  ]
  const [message, setMessage] = useState(() => premadeMessages[Math.floor(Math.random() * premadeMessages.length)])

  // The window slides away first, then the page drops it.
  const closing = useRef(false)
  const close = (then: () => void = onClose) => {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    window.setTimeout(then, 280)
  }
  const go = (s: typeof step) => {
    const order = ['day', 'time', 'note', 'done']
    setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1)
    setStep(s)
    setError('')
  }

  const taken = new Map(scheduledOpens.filter(o => o.scheduled_date).map(o => [o.scheduled_date as string, o.hosting_agent_name || 'yes']))
  const toggleDay = (d: string) => setDays(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].slice(-2).sort())

  const handleSubmit = async () => {
    if (!days.length || !time || isAnytime(time)) { go(days.length ? 'time' : 'day'); return }
    setIsSubmitting(true)
    setError('')
    // Shared only when offering a second open, so the backend can fold both into one
    // notification/badge count instead of two - see CreateHostRequestPayload.group_id.
    const groupId = days.length > 1 ? crypto.randomUUID() : undefined
    const send = (date: string) => api.openHouseManager.createRequest({
      listing_key: property.ListingKey,
      requested_date: date,
      requested_start_time: `${time.start}:00`,
      requested_end_time: `${time.end}:00`,
      message: message.trim() || undefined,
      group_id: groupId,
    })
    const first = await send(days[0])
    if (!first.success || !first.data) {
      setIsSubmitting(false)
      setError(first.error || 'That didn’t go through - please try again.')
      return
    }
    if (!first.data.on_platform) {
      setIsSubmitting(false)
      showToast("This listing agent doesn't use OpenHousePal yet - here's an email template instead.", 'success')
      close(onFallbackToEmail)
      return
    }
    if (days[1]) {
      const second = await send(days[1])
      if (!second.success) showToast(`${dayLong(days[0])} was sent, but ${dayLong(days[1])} didn’t go through.`, 'error')
      else setSentBoth(true)
    }
    setIsSubmitting(false)
    go('done')
  }

  const handleAcceptBroadcast = async (broadcastId: string) => {
    setRespondingBroadcastId(broadcastId)
    const { success, error } = await api.openHouseManager.respondToBroadcast(broadcastId)
    setRespondingBroadcastId(null)
    if (success) {
      setLocalBroadcasts(prev => prev.filter(b => b.id !== broadcastId))
      showToast("You're confirmed to host!", 'success')
      refreshOpenHouseActionCounts()
      onBroadcastHandled?.()
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  const handleCounterBroadcast = async (broadcastId: string, date: string, start: string, end: string, note: string) => {
    setRespondingBroadcastId(broadcastId)
    const { success, error } = await api.openHouseManager.respondToBroadcast(broadcastId, {
      proposed_date: date, proposed_start_time: start, proposed_end_time: end, note: note || undefined,
    })
    setRespondingBroadcastId(null)
    if (success) {
      setLocalBroadcasts(prev => prev.filter(b => b.id !== broadcastId))
      showToast('Proposed time sent to the listing agent.', 'success')
      refreshOpenHouseActionCounts()
      onBroadcastHandled?.()
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  const place = [property.City, [property.State, property.Zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const facts = [property.Price, property.Beds ? `${property.Beds} bd` : '', property.Baths ? `${property.Baths} ba` : '', property.SquareFeet ? `${Number(property.SquareFeet).toLocaleString()} sqft` : ''].filter(Boolean).join(' · ')
  const listingAgent = String(property.ListAgentFullName || '').trim().split(' ')[0]
  const stepNo = step === 'day' ? 1 : step === 'time' ? 2 : 3
  const titles = { day: 'Which day works?', time: 'What time?', note: 'Say hello and send', done: '' }

  const teamCard = localBroadcasts.length > 0 && (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.06]">
      <button type="button" onClick={() => setTeamOpen(v => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Users className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-[#111827] dark:text-white">Your team already asked for a host here</span>
          <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">Say yes in one tap - no request needed</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${teamOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {teamOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="grid gap-3 p-3 pt-0 sm:grid-cols-2">
              {localBroadcasts.map(b => <BroadcastCard key={b.id} broadcast={b} onAccept={handleAcceptBroadcast} onCounter={handleCounterBroadcast} busy={respondingBroadcastId} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <HostFlowWindow
      open={open}
      onClose={() => close(step === 'done' ? onSent : onClose)}
      busy={isSubmitting}
      photo={property.Image ? normalizeImageUrl(property.Image) : null}
      street={property.Street || 'This listing'}
      place={place}
      facts={facts}
      kicker="Request to host"
      steps={['Pick the day', 'Pick the time', 'Send your request']}
      stepNo={stepNo}
      done={step === 'done'}
      title={titles[step]}
      stepKey={step}
      dir={dir}
      footer={step === 'day'
        ? <FlowFooter onNext={() => go('time')} disabled={!days.length} nextLabel={days.length > 1 ? 'Continue with 2 days' : 'Continue'} nextIcon={<ArrowRight className="h-4 w-4" />} />
        : step === 'time'
        ? <FlowFooter onBack={() => go('day')} onNext={() => go('note')} disabled={!time} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
        : <FlowFooter onBack={() => go('time')} onNext={handleSubmit} busy={isSubmitting}
            nextLabel={isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> {days.length > 1 ? 'Send 2 requests' : 'Send request'}</>} />}
    >
      {step === 'day' && (
        <DayStep
          picked={days}
          onToggle={toggleDay}
          max={2}
          hostingWindow={{ hosting_blocked: property.HostingBlocked, hosts_from: property.HostsFrom }}
          info={d => ({ taken: taken.get(d) || null, requested: requestedDates.includes(d) })}
          hint={teamCard}
        />
      )}
      {step === 'time' && <TimeStep value={time} onChange={setTime} days={days} />}
      {step === 'note' && time && !isAnytime(time) && (
        <div className="space-y-4">
          <Summary rows={[
            { label: days.length > 1 ? 'Days' : 'Day', value: days.map(dayLong).join(' and ') },
            { label: 'Time', value: clockRange(time.start, time.end) },
            { label: 'To', value: property.ListAgentFullName || 'The listing agent' },
          ]} />
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your note (we wrote one - change it if you like)</span>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold text-rose-600">{error}</motion.p>}
        </div>
      )}
      {step === 'done' && (
        <SentMoment
          title={sentBoth ? 'Requests sent' : 'Request sent'}
          text={<>{listingAgent ? `${listingAgent} gets` : 'The listing agent gets'} a message right away. You&apos;ll see it under My Requests until they answer.</>}
          onClose={() => close(onSent)}
          ms={onAlsoReach && (property?.ListingAgentEmail || (property?.ListAgentPreferredPhone && property.ListAgentPreferredPhone !== 'N/A')) ? 7000 : 2600}
          extra={onAlsoReach && (property?.ListingAgentEmail || (property?.ListAgentPreferredPhone && property.ListAgentPreferredPhone !== 'N/A')) ? (
            <button type="button" onClick={() => { onSent(); onAlsoReach() }} data-testid="host-also-reach"
              className="inline-flex items-center gap-2 rounded-full border border-[#C9A24D]/50 bg-white px-4 py-2.5 text-[13px] font-black text-[#8b7355] shadow-sm transition hover:border-[#C9A24D] dark:bg-white/[0.05] dark:text-[#e8c97a]">
              <MessageSquare className="h-4 w-4" /> Also text or email {listingAgent || 'them'}
            </button>
          ) : undefined}
        />
      )}
    </HostFlowWindow>
  )
}
