'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Loader2, MessageSquare, Video, Home } from 'lucide-react'
import { visitSource } from '@/lib/visitSource'
import { LEAD_EVENT, fmtDay, fmtPhone, fmtTimeRange, type PropertySiteAgent, type PropertySiteOpenHouse } from './model'
import { TONE, type Tone } from './tone'
import { atTime, busyAt, type BusyBlock } from '@/lib/agentBusy'

// The one lead-capture form for both Spotlight templates. "Request info" and "Schedule a tour"
// post to the same-origin proxies (app/api/website-property-sites/[siteId]/...) which create a
// real Lead + LeadEvent, notify the agent (bell + email), push to their CRM and schedule the
// auto follow-up - see backend property_website_service.submit_inquiry / submit_tour_request.

const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function nextDays(count: number) {
  const out: { iso: string; dow: string; day: number; month: string }[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    out.push({
      iso,
      dow: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : day.toLocaleDateString('en-US', { weekday: 'short' }),
      day: day.getDate(),
      month: day.toLocaleDateString('en-US', { month: 'short' }),
    })
  }
  return out
}

export default function LeadForm({
  siteId, address, tone, agent, openHouses = [], allowTour = true, compact = false,
}: {
  siteId: string
  address: string
  tone: Tone
  agent?: PropertySiteAgent
  openHouses?: PropertySiteOpenHouse[]
  allowTour?: boolean
  compact?: boolean
}) {
  const t = TONE[tone]
  const [tab, setTab] = useState<'info' | 'tour'>('info')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [attempted, setAttempted] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', message: '',
    tour_type: 'in_person' as 'in_person' | 'virtual', requested_date: '', preferred_time: '', notes: '',
    company: '', // honeypot - real visitors never see or fill this
  })
  // Client-only (dates depend on the visitor's own "today") - rendered after hydration.
  const [days, setDays] = useState<ReturnType<typeof nextDays>>([])
  useEffect(() => { setDays(nextDays(14)) }, [])
  // The agent's busy times (their connected calendar): those hours are crossed out (user, 10/18).
  const [busy, setBusy] = useState<BusyBlock[]>([])
  useEffect(() => {
    if (!allowTour || siteId === 'preview') return
    fetch(`/api/website-property-sites/${siteId}/agent-busy`).then(r => r.json()).then(d => setBusy(Array.isArray(d?.busy) ? d.busy : [])).catch(() => {})
  }, [siteId, allowTour])
  const slotTaken = (slot: string) => {
    if (!form.requested_date) return false
    const at = atTime(form.requested_date, slot)
    return !!at && (at.getTime() < Date.now() || busyAt(busy, at))
  }
  // A time picked first, then a day it's not free on: let it go rather than send a taken time.
  useEffect(() => {
    if (form.preferred_time && slotTaken(form.preferred_time)) setForm(f => ({ ...f, preferred_time: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.requested_date, busy])

  // Where they came from (a QR, the Agent Hub, Google...) - captured on arrival, sent with the form.
  useEffect(() => { visitSource(`site:${siteId}`) }, [siteId])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      if (detail.tab === 'tour' && allowTour) setTab('tour')
      else if (detail.tab === 'info') setTab('info')
      if (detail.date) setForm(f => ({ ...f, requested_date: detail.date }))
      if (detail.message) setForm(f => ({ ...f, message: f.message || detail.message }))
      if (status === 'sent' || status === 'error') setStatus('idle')
    }
    window.addEventListener(LEAD_EVENT, onOpen)
    return () => window.removeEventListener(LEAD_EVENT, onOpen)
  }, [allowTour, status])

  const errors = useMemo(() => ({
    first_name: !form.first_name.trim() ? 'Required' : '',
    last_name: !form.last_name.trim() ? 'Required' : '',
    email: !EMAIL_RE.test(form.email.trim()) ? 'Enter a valid email' : '',
  }), [form.first_name, form.last_name, form.email])
  const valid = !errors.first_name && !errors.last_name && !errors.email

  const openHouseDays = new Set(openHouses.map(o => o.date))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (!valid || status === 'sending') return
    if (form.company) { setStatus('sent'); return }
    // The theme preview's sample home - never reaches a real agent's inbox.
    if (siteId === 'preview') { setStatus('sending'); window.setTimeout(() => setStatus('sent'), 600); return }
    setStatus('sending')
    const came_from = visitSource(`site:${siteId}`)
    const base = { first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, came_from }
    const path = tab === 'info' ? `/api/website-property-sites/${siteId}/inquiry` : `/api/website-property-sites/${siteId}/tour-request`
    const payload = tab === 'info'
      ? { ...base, message: form.message.trim() || null }
      : { ...base, tour_type: form.tour_type, requested_date: form.requested_date || null, preferred_time: form.preferred_time || null, notes: form.notes.trim() || null }
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const agentFirst = agent?.name?.split(' ')[0]

  if (status === 'sent') {
    return (
      <div className={`${t.text}`} role="status" aria-live="polite">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--sp-accent)] text-[color:var(--sp-on-accent)]">
          <Check className="h-5 w-5" />
        </span>
        <p className={`${t.heading} mt-5 text-3xl leading-tight`}>
          {tab === 'tour' ? 'Tour requested.' : 'Message sent.'}
        </p>
        <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${t.muted}`}>
          {tab === 'tour'
            ? `${agentFirst || 'The listing agent'} will confirm ${form.requested_date ? fmtDay(form.requested_date) : 'a time'}${form.preferred_time ? ` around ${form.preferred_time}` : ''} with you shortly.`
            : `${agentFirst || 'The listing agent'} has your note about ${address} and will be in touch soon.`}
        </p>
        <button
          type="button"
          onClick={() => { setStatus('idle'); setAttempted(false); setForm(f => ({ ...f, message: '', notes: '', requested_date: '', preferred_time: '' })) }}
          className={`mt-6 text-xs font-semibold underline underline-offset-4 ${t.muted}`}
        >
          Send another request
        </button>
      </div>
    )
  }

  const field = (key: 'first_name' | 'last_name' | 'email', label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className={t.label}>{label}</span>
      <input
        {...props}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        aria-invalid={attempted && !!errors[key]}
        className={`${t.input} mt-1.5 ${attempted && errors[key] ? '!border-rose-400' : ''}`}
      />
      {attempted && errors[key] && <span className={`mt-1 block text-[11px] font-medium ${t.error}`}>{errors[key]}</span>}
    </label>
  )

  return (
    <form onSubmit={submit} noValidate className={t.text}>
      {allowTour && (
        <div className={`mb-6 grid grid-cols-2 gap-2 ${compact ? '' : 'max-w-sm'}`} role="tablist">
          {([['info', 'Request info', MessageSquare], ['tour', 'Schedule a tour', CalendarDays]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center justify-center gap-2 px-3 py-3 text-xs font-semibold tracking-wide transition ${tab === key ? t.chipOn : t.chip}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field('first_name', 'First name', { autoComplete: 'given-name', name: 'given-name' })}
        {field('last_name', 'Last name', { autoComplete: 'family-name', name: 'family-name' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email', name: 'email' })}
        <label className="block">
          <span className={t.label}>Phone <span className="normal-case tracking-normal opacity-70">(optional)</span></span>
          <input
            type="tel" autoComplete="tel" inputMode="tel" name="tel"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className={`${t.input} mt-1.5`}
          />
        </label>
      </div>
      <input
        tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company}
        onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
        className="absolute -left-[9999px] h-0 w-0 opacity-0" name="company"
      />

      {tab === 'info' ? (
        <label className="mt-4 block">
          <span className={t.label}>Message</span>
          <textarea
            rows={compact ? 3 : 4}
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            placeholder={`I'd like to know more about ${address}.`}
            className={`${t.input} mt-1.5 resize-none`}
          />
        </label>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <span className={t.label}>Tour type</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([['in_person', 'In person', Home], ['virtual', 'Video tour', Video]] as const).map(([key, label, Icon]) => (
                <button
                  key={key} type="button" onClick={() => setForm(f => ({ ...f, tour_type: key }))}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition ${form.tour_type === key ? t.chipOn : t.chip}`}
                  aria-pressed={form.tour_type === key}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={t.label}>Preferred day</span>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {days.map(d => (
                <button
                  key={d.iso} type="button"
                  onClick={() => setForm(f => ({ ...f, requested_date: f.requested_date === d.iso ? '' : d.iso }))}
                  className={`relative flex w-[62px] shrink-0 flex-col items-center py-2.5 transition ${form.requested_date === d.iso ? t.chipOn : t.chip}`}
                  aria-pressed={form.requested_date === d.iso}
                  aria-label={`${fmtDay(d.iso)}${openHouseDays.has(d.iso) ? ' (open house)' : ''}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{d.dow}</span>
                  <span className="mt-0.5 text-lg font-semibold leading-none">{d.day}</span>
                  <span className="mt-0.5 text-[10px] opacity-60">{d.month}</span>
                  {openHouseDays.has(d.iso) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[color:var(--sp-accent)]" title="Open house" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={t.label}>Preferred time</span>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TIME_SLOTS.map(slot => {
                const taken = slotTaken(slot)
                return (
                  <button
                    key={slot} type="button" disabled={taken}
                    title={taken ? 'Not available' : undefined}
                    onClick={() => setForm(f => ({ ...f, preferred_time: f.preferred_time === slot ? '' : slot }))}
                    className={`py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through ${form.preferred_time === slot ? t.chipOn : t.chip}`}
                    aria-pressed={form.preferred_time === slot}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>
          </div>
          {openHouses.length > 0 && (
            <p className={`text-xs leading-relaxed ${t.muted}`}>
              Or simply stop by the open house: {openHouses.slice(0, 2).map(o => `${fmtDay(o.date, 'short')}${fmtTimeRange(o.start_time, o.end_time) ? `, ${fmtTimeRange(o.start_time, o.end_time)}` : ''}`).join(' · ')}.
            </p>
          )}
          <label className="block">
            <span className={t.label}>Anything we should know? <span className="normal-case tracking-normal opacity-70">(optional)</span></span>
            <textarea
              rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Pre-approved, first-time buyer, flexible on timing…"
              className={`${t.input} mt-1.5 resize-none`}
            />
          </label>
        </div>
      )}

      {status === 'error' && (
        <p className={`mt-4 text-sm font-medium ${t.error}`} role="alert">
          That didn&apos;t go through. Please try again{agent?.phone ? `, or call ${fmtPhone(agent.phone)}` : agent?.email ? `, or email ${agent.email}` : ''}.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className={`group mt-6 inline-flex w-full items-center justify-center gap-2.5 px-6 py-4 text-sm font-semibold tracking-wide transition disabled:opacity-60 ${t.primaryBtn}`}
      >
        {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {tab === 'info' ? 'Send message' : 'Request this tour'}
        {status !== 'sending' && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
      </button>
      <p className={`mt-3 text-[11px] leading-relaxed ${t.faint}`}>
        By sending, you agree to be contacted by {agent?.name || 'the listing agent'} about this home. We never sell your information.
      </p>
    </form>
  )
}
