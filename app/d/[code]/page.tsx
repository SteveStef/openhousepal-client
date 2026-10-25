'use client'

// One-tap "Mark as done" page, linked as the first line of every follow-up's calendar event.
// Opening it checks the follow-up off (the POST runs from the browser, so link-preview bots that
// don't run JS can't trigger it) and takes the event off the agent's calendar. Below it, the
// agent's OTHER follow-ups due today / overdue - "Did you also do these?" - each with a big check
// box to clear it and an Open button that shows that follow-up in full (situation, ready message,
// who to reach, and a jump to its spot on their calendar).
// No login needed - each item's own code is its key, and all a code can do is show / check off /
// undo that one follow-up.
//
// Kept light on purpose (user, 10/19: "takes super long ... a black screen"): a tiny fetch instead
// of the app's API module, CSS animations instead of a motion library, and the OpenHousePal loader
// in the page's first HTML so something good shows the moment it opens.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
// Plain <a> links into the app on purpose: this page is served as a visitor page (no sign-in
// wrapper), and a client-side <Link> would carry that layout into /leads/tasks and crash it.
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, Clock, Copy, Mail, MessageSquare, Phone, RotateCcw, UserPlus, X, XCircle } from 'lucide-react'
import type { PublicFollowup, PublicFollowupOther } from '@/types'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'
import { copyText } from '@/lib/copyText'
import { isIosDevice, mailHref, smsHref } from '@/lib/smsLink'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
type Res<T> = { ok: true; data: T } | { ok: false; error: string }
async function call<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<Res<T>> {
  // Never wait forever (user, 10/24 - the link "tried, failed and nothing ever happened"): a request
  // on a phone just waking up on a weak signal can hang for a minute+ - give up after 9s so the
  // retry below gets its turn.
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 9000)
  try {
    const r = await fetch(`${API}/public/followups/${path}`, { method, headers: { accept: 'application/json' }, cache: 'no-store', signal: ctl.signal })
      .finally(() => clearTimeout(t))
    const body = await r.json().catch(() => null)
    return r.ok ? { ok: true, data: body as T } : { ok: false, error: (body && (body.detail || body.message)) || "That didn't go through - check your connection and tap again." }
  } catch {
    return { ok: false, error: "That didn't go through - check your connection and tap again." }
  }
}

type FullCard = PublicFollowup & {
  code: string; due_at?: string | null; all_day?: boolean; overdue?: boolean
  details: string[]; message: string; fill_ins: string[]; google_event_url?: string | null
}

function dueLabel(o: { overdue?: boolean; due_at?: string | null; all_day?: boolean }): string {
  if (o.overdue) return 'Overdue'
  if (!o.due_at || o.all_day) return 'Today'
  return `Today · ${new Date(o.due_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

const CSS = `
@keyframes dnIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
@keyframes dnPop{0%{transform:scale(.3);opacity:0}55%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes dnRing{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.1);opacity:0}}
@keyframes dnUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dnSheet{from{transform:translateY(100%)}to{transform:none}}
@keyframes dnFade{from{opacity:0}to{opacity:1}}
@keyframes dnTick{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
.dn-in{animation:dnIn .55s cubic-bezier(.22,1,.36,1) both}
.dn-pop{animation:dnPop .6s cubic-bezier(.34,1.56,.64,1) .15s both}
.dn-ring{animation:dnRing 1.1s ease-out .3s both}
.dn-up{animation:dnUp .45s cubic-bezier(.22,1,.36,1) both}
.dn-sheet{animation:dnSheet .38s cubic-bezier(.22,1,.36,1) both}
.dn-fade{animation:dnFade .25s ease-out both}
.dn-tick{stroke-dasharray:24;animation:dnTick .45s ease-out .45s both}
@media (prefers-reduced-motion:reduce){.dn-in,.dn-pop,.dn-ring,.dn-up,.dn-sheet,.dn-fade,.dn-tick{animation:none}}
`

/** Who this follow-up is about - stays on the page done or not, so their info (and the one-tap
 * "save to contacts", notes included) never goes away with the follow-up. */
function ContactCard({ code, contact, message }: { code: string; contact: NonNullable<PublicFollowup['contact']>; message?: string }) {
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    if (!contact.email) return
    copyText(contact.email).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const btn = 'flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-1 py-2 text-[10px] font-black uppercase text-gray-600 transition active:scale-95 hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700 dark:bg-white/5 dark:text-gray-300'
  return (
    <div className="border-t border-gray-100 px-5 py-4 text-left dark:border-gray-800">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b7355] text-sm font-black text-white shadow-sm">
          {(contact.name || contact.email || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{contact.name || 'Contact'}</p>
          <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {[contact.phone && prettyPhone(contact.phone), contact.email].filter(Boolean).join(' · ') || 'No phone or email given'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {contact.phone && <a href={`tel:${contact.phone}`} className={btn}><Phone className="h-4 w-4" /> Call</a>}
        {contact.phone && <a href={smsHref(contact.phone, message || null)} className={btn}><MessageSquare className="h-4 w-4" /> Text</a>}
        {contact.email && (
          <button type="button" onClick={copyEmail} className={btn}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy email'}
          </button>
        )}
        {contact.email && <a href={mailHref(contact.email, message ? 'Following up' : null, message || null)} className={btn}><Mail className="h-4 w-4" /> Email</a>}
      </div>
      {/* Plain <a>: a Next route that hands the phone a vCard (Create New Contact, notes included). */}
      <a href={`/d/${encodeURIComponent(code)}/contact`}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-[0.98] hover:brightness-110 dark:bg-white dark:text-[#111827]">
        <UserPlus className="h-4 w-4 text-[#C9A24D]" /> Save {contact.name?.split(' ')[0] || 'them'} to your contacts
      </a>
      <p className="mt-1.5 text-center text-[10px] font-semibold text-gray-400">Name, phone and email filled in - plus what they asked for and your notes.</p>
    </div>
  )
}

/** One of the other follow-ups, in full - slides up over the page. */
function FollowupSheet({ code, isDone, onToggle, onClose }: { code: string; isDone: boolean; onToggle: () => Promise<void>; onClose: () => void }) {
  const [card, setCard] = useState<FullCard | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    call<FullCard>(`${encodeURIComponent(code)}/card`).then(r => { if (!live) return; if (r.ok) setCard(r.data); else setErr(r.error) })
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { live = false; window.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [code, onClose])
  const first = (card?.contact?.name || '').split(' ')[0] || 'them'
  // The iPhone Calendar opens at this follow-up's time (its event is right there); Google opens the
  // exact event. calshow: counts seconds from Jan 1 2001.
  const calshow = card?.due_at ? `calshow:${Math.round(Date.parse(card.due_at) / 1000 - 978307200)}` : null
  const ios = typeof navigator !== 'undefined' && isIosDevice()
  const copy = () => { if (!card?.message) return; copyText(card.message).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={card?.title || 'Follow-up'}>
      <button type="button" aria-label="Close" onClick={onClose} className="dn-fade absolute inset-0 bg-black/60" />
      <div className="dn-sheet relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px] dark:bg-[#151517]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 pb-3 pt-4 dark:border-gray-800">
          <div className="min-w-0">
            <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-white/15" />
            <p className="text-[15px] font-black leading-snug text-[#111827] dark:text-white">{card?.title || 'Loading…'}</p>
            {card?.context && <p className="mt-0.5 text-[12px] font-medium text-gray-500 dark:text-gray-400">{card.context}</p>}
            {card && !isDone && (
              <span className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${card.overdue ? 'text-red-600 dark:text-red-400' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>
                {card.overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {dueLabel(card)}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full bg-gray-100 p-1.5 text-gray-500 dark:bg-white/10 dark:text-gray-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!card && !err && <OhpLoader fullScreen={false} guest label="Opening it…" className="py-10" />}
          {err && <p className="px-5 py-8 text-center text-sm font-semibold text-gray-500">{err}</p>}
          {card && (
            <div className="dn-up">
              {card.details.length > 0 && (
                <div className="px-5 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">What happened</p>
                  <ul className="mt-1.5 space-y-1 text-[13px] font-medium leading-snug text-gray-700 dark:text-gray-300">
                    {card.details.map((d, i) => <li key={i}>{d.replace(/^- /, '')}</li>)}
                  </ul>
                </div>
              )}
              {card.message && (
                <div className="px-5 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Ready-to-send text</p>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-2xl bg-[#FAFAF7] p-3.5 text-[13px] leading-relaxed text-[#111827] ring-1 ring-black/5 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10">{card.message}</p>
                  {card.fill_ins.length > 0 && <p className="mt-1.5 text-[11px] font-semibold text-gray-500">Before sending, replace <b className="text-gray-700 dark:text-gray-200">{card.fill_ins[0]}</b>.</p>}
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={copy} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-[12px] font-black text-[#111827] transition active:scale-[0.97] dark:border-white/10 dark:text-white">
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy message'}
                    </button>
                    {card.contact?.phone && (
                      // Tapping Text is what checks it off (the same as the tap-to-text page) - opening this never does.
                      <a href={smsHref(card.contact.phone, card.message)} onClick={() => { if (!isDone) onToggle().catch(() => {}) }}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[12px] font-black text-[#111827] shadow-sm transition active:scale-[0.97]">
                        <MessageSquare className="h-4 w-4" /> Text {first}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {card.contact && <div className="mt-3"><ContactCard code={code} contact={card.contact} message={card.message} /></div>}
              {(ios ? calshow : card.google_event_url) && (
                <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                  <a href={(ios ? calshow : card.google_event_url) || '#'} target={ios ? undefined : '_blank'} rel="noreferrer"
                    className="flex items-center justify-center gap-2 text-[12px] font-black text-[#8b7355] dark:text-[#d7b974]">
                    <CalendarDays className="h-4 w-4" /> {ios ? 'Show it in my Calendar' : 'Open it in Google Calendar'} <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {card && (
          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onToggle(); setBusy(false) }}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black transition active:scale-[0.98] disabled:opacity-60 ${isDone ? 'border border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300' : 'bg-emerald-500 text-white shadow-[0_12px_26px_-12px_rgba(16,185,129,.8)]'}`}>
              {isDone ? <><RotateCcw className="h-4 w-4" /> Undo - not done yet</> : <><CheckCircle2 className="h-5 w-5" /> Mark as done</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MarkDonePage() {
  const { code } = useParams<{ code: string }>()
  const [task, setTask] = useState<PublicFollowup | null>(null)
  const [others, setOthers] = useState<PublicFollowupOther[]>([])
  const [doneOthers, setDoneOthers] = useState<Set<string>>(new Set())
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  // Opening the link checks it off - once. After an Undo, opening or refreshing it again shows it
  // as not done instead of quietly checking it off (and crossing it out on the calendar) again
  // (user, 10/17: "it's ignoring my click").
  const undoneKey = `ohp-undone:${code}`
  const wasUndone = () => { try { return localStorage.getItem(undoneKey) === '1' } catch { return false } }
  const rememberUndone = (v: boolean) => { try { if (v) localStorage.setItem(undoneKey, '1'); else localStorage.removeItem(undoneKey) } catch { /* private mode */ } }
  const [failed, setFailed] = useState('')

  useEffect(() => {
    if (!code) return
    ;(async () => {
      const c = encodeURIComponent(code)
      let r = wasUndone() ? await call<PublicFollowup>(c) : await call<PublicFollowup>(`${c}/done`, 'POST')
      // one quiet retry - a phone waking up on a weak signal often drops the first request
      if (!r.ok) r = wasUndone() ? await call<PublicFollowup>(c) : await call<PublicFollowup>(`${c}/done`, 'POST')
      if (r.ok) {
        setTask(r.data)
        setOthers(r.data.others || [])
        setState('ready')
      } else setState('error')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const toggleMain = async () => {
    if (!task) return
    setBusy(code)
    setFailed('')
    const undoing = task.done
    const r = await call<PublicFollowup>(`${encodeURIComponent(code)}/${undoing ? 'undo' : 'done'}`, 'POST')
    if (r.ok) { setTask(r.data); rememberUndone(undoing) }
    else setFailed(r.error)
    setBusy(null)
  }

  // The list stays as first loaded - checking one off just marks it (and allows undo) instead of
  // making it jump out from under the agent's thumb.
  const toggleOther = async (o: { code: string }) => {
    const isDone = doneOthers.has(o.code)
    setBusy(o.code)
    const r = await call<PublicFollowup>(`${encodeURIComponent(o.code)}/${isDone ? 'undo' : 'done'}`, 'POST')
    if (r.ok) {
      setDoneOthers(prev => {
        const next = new Set(prev)
        if (r.data.done) next.add(o.code); else next.delete(o.code)
        return next
      })
    }
    setBusy(null)
  }

  const remaining = others.filter(o => !doneOthers.has(o.code)).length

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] px-4 py-8 sm:items-center">
      <style>{CSS}</style>
      <div className={`${state === 'loading' ? '' : 'dn-in '}w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] dark:bg-[#151517]`} key={state === 'loading' ? 'l' : 'r'}>
        {state === 'loading' && <OhpLoader fullScreen={false} label="Checking it off…" className="py-14" />}

        {state === 'error' && (
          <div className="px-6 py-12">
            <XCircle className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">This link isn&apos;t active</p>
            <p className="mt-1 text-sm font-medium text-gray-500">The follow-up may have been deleted, or your connection dropped - try once more. You can manage all of them in OpenHousePal.</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button type="button" onClick={() => window.location.reload()} className="inline-block rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-black text-[#111827] dark:border-white/15 dark:text-white">Try again</button>
              <a href="/leads/tasks" className="inline-block rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827]">Open Follow-ups</a>
            </div>
          </div>
        )}

        {state === 'ready' && task && (
          <>
            <div className={`px-6 pb-5 pt-8 transition-colors ${task.done ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-white/5'}`}>
              <div className="relative mx-auto h-16 w-16">
                {task.done && <span aria-hidden className="dn-ring absolute inset-0 rounded-full border-2 border-emerald-400" />}
                <div className={`dn-pop relative flex h-16 w-16 items-center justify-center rounded-full ${task.done ? 'bg-emerald-500 shadow-[0_12px_30px_-8px_rgba(16,185,129,0.7)]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  {task.done
                    ? <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path className="dn-tick" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    : <CheckCircle2 className="h-9 w-9 text-gray-400" strokeWidth={2.5} />}
                </div>
              </div>
              <OhpWordmark className="dn-up mt-3 text-lg text-[#111827] dark:text-white" />
              <p className="dn-up mt-0.5 text-2xl font-black text-[#111827] dark:text-white" style={{ animationDelay: '.08s' }}>{task.done ? 'Done - nice work!' : 'Marked not done'}</p>
              <p className="dn-up mt-2 text-base font-black text-[#111827] dark:text-white" style={{ animationDelay: '.14s' }}>{task.title}</p>
              {task.context && <p className="dn-up mt-0.5 text-sm font-medium text-gray-500 dark:text-gray-400" style={{ animationDelay: '.18s' }}>{task.context}</p>}
              <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {task.done ? 'Checked off in OpenHousePal and marked done on your calendar.' : 'Back on your follow-up list and your calendar.'}
              </p>
              <button
                onClick={toggleMain}
                disabled={busy === code}
                className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black transition disabled:opacity-60 ${
                  task.done
                    ? 'text-gray-500 hover:bg-white hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                    : 'bg-emerald-500 text-white hover:brightness-105'
                }`}
              >
                {busy === code ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : task.done ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {task.done ? 'Undo' : 'Mark as done'}
              </button>
              {failed && <p className="mt-2 text-xs font-bold text-red-600">{failed}</p>}
            </div>

            {task.contact && <ContactCard code={code} contact={task.contact} />}

            {others.length > 0 ? (
              <div className="border-t border-gray-100 px-4 py-4 text-left dark:border-gray-800">
                <p className="px-1 text-sm font-black text-[#111827] dark:text-white">Did you also do these?</p>
                <p className="px-1 text-[11px] font-semibold text-gray-400">
                  {remaining > 0 ? `${remaining} more due today - tap one to check it off, or Open to see its message.` : "That's everything due today. 🎉"}
                </p>
                <div className="mt-2.5 space-y-2">
                  {others.map((o, i) => {
                    const isDone = doneOthers.has(o.code)
                    return (
                      // Tapping anywhere on the row checks it off, tapping again unchecks it; only
                      // "Open" (its own button) shows it in full instead.
                      <div key={o.code} role="button" tabIndex={0} aria-pressed={isDone} aria-label={isDone ? `Undo ${o.title}` : `Check off ${o.title}`}
                        onClick={() => { if (busy !== o.code) toggleOther(o) }}
                        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); if (busy !== o.code) toggleOther(o) } }}
                        className={`dn-up flex cursor-pointer select-none items-center gap-2.5 rounded-2xl border p-2.5 transition active:scale-[0.985] ${isDone ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20' : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'}`}
                        style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
                        <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-transparent'}`}>
                          {busy === o.code ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" /> : isDone && <Check className="h-4 w-4" strokeWidth={3.5} />}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[13px] font-black leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-[#111827] dark:text-white'}`}>{o.title}</span>
                            {o.context && <span className="block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{o.context}</span>}
                            <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${isDone ? 'text-emerald-600' : o.overdue ? 'text-red-600 dark:text-red-400' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>
                              {isDone ? <><Check className="h-3 w-3" /> Done</> : <>{o.overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {dueLabel(o)}</>}
                            </span>
                          </span>
                          <button type="button" onClick={e => { e.stopPropagation(); setOpen(o.code) }} aria-label={`Open ${o.title}`}
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95 dark:bg-white dark:text-[#111827]">Open <ChevronRight className="h-3.5 w-3.5" /></button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="border-t border-gray-100 px-6 py-4 text-xs font-semibold text-gray-400 dark:border-gray-800">Nothing else due today. 🎉</p>
            )}

            <div className="border-t border-gray-100 px-6 py-3 dark:border-gray-800">
              <a href="/leads/tasks" className="text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Open all follow-ups in OpenHousePal →</a>
            </div>
          </>
        )}
      </div>
      {open && <FollowupSheet code={open} isDone={doneOthers.has(open)} onToggle={() => toggleOther({ code: open })} onClose={() => setOpen(null)} />}
    </div>
  )
}
