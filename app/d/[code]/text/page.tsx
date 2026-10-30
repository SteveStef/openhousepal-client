'use client'

// Tap-to-text page, linked from every follow-up's calendar event ("📲 Text Sarah from your
// phone"). One tap opens the agent's own Messages app with the guest's number and the suggested
// text already written - it goes from the agent's real cell, so replies and calls come straight
// back to their phone - and the same tap checks the follow-up off (with an Undo). Just opening
// this page never checks anything off: link previews and accidental opens must not clear a
// follow-up. On a computer: the text with a Copy button, and a QR code that opens this page on
// the phone. No login - the code is the key, like the Mark-as-done page.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Mail, MessageSquare, Phone, RotateCcw, XCircle } from 'lucide-react'
import { DesktopTextLayout, MailSheet, type TextPageData } from './parts'
import api, { API_BASE_URL } from '@/lib/api-service'

import OhpLoader from '@/components/brand/OhpLoader'
import { isPhoneDevice, smsHref } from '@/lib/smsLink'
import { useQrDataUrl } from '@/lib/qr'

// Their alert switches (owner, 10/27; always shown since 10/30) - loaded on their own.
const DoneLeadAlerts = dynamic(() => import('@/components/tasks/DoneLeadAlerts'), { ssr: false })

// The card rises in, then its parts follow (same feel as the Mark-as-done page).
const CSS = `@keyframes ttIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}@keyframes ttUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.tt-in{animation:ttIn .55s cubic-bezier(.22,1,.36,1) both}.tt-up{animation:ttUp .45s cubic-bezier(.22,1,.36,1) both}@media (prefers-reduced-motion:reduce){.tt-in,.tt-up{animation:none}}`

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

export default function TapToTextPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<TextPageData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'nophone' | 'error'>('loading')
  const [phone, setPhone] = useState<boolean | null>(null)
  const [sentNow, setSentNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pageUrl, setPageUrl] = useState('')
  const qr = useQrDataUrl(phone === false ? pageUrl : null, { size: 360, margin: 1 })
  // Email on a phone (10/25): a slide-up "which mail app?" sheet, every time (last pick highlighted).
  const [mailSheet, setMailSheet] = useState(false)

  useEffect(() => {
    setPhone(isPhoneDevice())
    setPageUrl(window.location.href)
  }, [])

  // Never hangs (user, 10/24: "took forever, a black page"): each try gives up after 8s and it tries
  // three times (a phone just waking up on a weak signal often drops the first request) - then a
  // clear "Try again" instead of a spinner forever. Plain fetch: a stale session cookie must never
  // bounce this public page to the sign-in screen.
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!code) return
    let alive = true
    setState('loading')
    ;(async () => {
      for (let i = 0; i < 3 && alive; i++) {
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 8000)
        try {
          const res = await fetch(`${API_BASE_URL}/public/followups/${encodeURIComponent(code)}/text`, { cache: 'no-store', signal: ctl.signal })
          const body = await res.json().catch(() => null)
          clearTimeout(t)
          if (!alive) return
          if (res.ok && body) { setData(body as TextPageData); setState('ready'); return }
          if (res.status === 429) break   // the public limit - retrying only counts against it
          if (res.status === 404 || res.status === 410) {
            setState(/phone number/i.test(String(body?.detail || '')) ? 'nophone' : 'error')
            return
          }
        } catch { clearTimeout(t) }
        await new Promise(r => setTimeout(r, 700 * (i + 1)))
      }
      if (alive) setState('error')
    })()
    return () => { alive = false }
  }, [code, attempt])

  const first = data?.first_name || 'them'

  // The real tap: Messages opens from the link itself (the browser needs the tap for that), and the
  // follow-up is checked off in the same moment.
  const onText = () => {
    if (!data || data.done) return
    setSentNow(true)
    setData({ ...data, done: true })
    api.tasks.publicDone(code).then(r => { if (r.success && r.data) setData(d => (d ? { ...d, ...r.data!, done: r.data!.done } : d)) })
  }

  const undo = async () => {
    setBusy(true)
    const r = await api.tasks.publicUndo(code)
    if (r.success && r.data) setData(d => (d ? { ...d, ...r.data!, done: r.data!.done } : d))
    setSentNow(false)
    setBusy(false)
  }

  // The computer's "Mark as done" (no "Sent?" wording - they may have called).
  const markDone = () => {
    if (!data || data.done) return
    setData({ ...data, done: true })
    api.tasks.publicDone(code).then(r => { if (r.success && r.data) setData(d => (d ? { ...d, ...r.data!, done: r.data!.done } : d)) })
  }

  // On a computer: its own two-column layout (user, 10/25 - it was the phone card stretched).
  if (state === 'ready' && data && phone === false) {
    return <DesktopTextLayout code={code} data={data} qr={qr} sentNow={sentNow} busy={busy} onDone={markDone} onSent={onText} onUndo={undo} />
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] px-4 py-8 sm:items-center">
      <style>{CSS}</style>
      <div key={state === 'loading' ? 'l' : 'r'} className={`${state === 'loading' ? '' : 'tt-in '}w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] dark:bg-[#151517]`}>
        {state === 'loading' && <OhpLoader fullScreen={false} label="Getting the text ready" className="py-14" />}

        {(state === 'error' || state === 'nophone') && (
          <div className="px-6 py-12">
            <XCircle className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">{state === 'nophone' ? 'No phone or email on this one' : 'We couldn’t open this one'}</p>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {state === 'nophone' ? 'This guest didn’t leave a phone number or an email - their follow-up is still on your list.' : 'Your connection may have dropped, or the follow-up was deleted. Try again - or manage all of them in OpenHousePal.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              {state === 'error' && <button type="button" onClick={() => setAttempt(a => a + 1)} className="inline-block rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-black text-[#111827] dark:border-white/15 dark:text-white">Try again</button>}
              <a href="/leads/tasks" className="inline-block rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827]">Open Follow-ups</a>
            </div>
          </div>
        )}

        {state === 'ready' && data && (
          <>
            <div className="bg-gray-50 px-6 pb-5 pt-7 dark:bg-white/5">
              <p className="tt-up text-2xl font-black text-[#111827] dark:text-white">{data.phone && data.email ? `Text or email ${first}` : data.phone ? `Text ${first}` : `Email ${first}`}</p>
              {data.context && <p className="mt-0.5 text-sm font-medium text-gray-500 dark:text-gray-400">{data.context}</p>}
              {data.phone && <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{prettyPhone(data.phone)}</p>}
              {data.email && <p className={`${data.phone ? 'mt-0.5' : 'mt-1'} truncate text-xs font-semibold text-gray-500 dark:text-gray-400`}>{data.email}</p>}
            </div>

            {data.fill_ins.length > 0 && (
              <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-xs font-bold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Before you send: replace {data.fill_ins.join(' and ')} in Messages.</span>
              </div>
            )}

            {/* The message, as it will appear in Messages (a long link wraps inside the bubble) */}
            {data.message && (
              <div className="tt-up px-5 pt-4 text-left" style={{ animationDelay: '.12s' }}>
                <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-[#0A84FF] px-3.5 py-2.5 text-[13.5px] font-medium leading-snug text-white shadow-sm [overflow-wrap:anywhere]">
                  {data.message}
                </div>
              </div>
            )}

            <div className="px-5 pb-5 pt-4">
              {phone !== false ? (
                data.done ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-black text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> {sentNow ? 'Sent? Checked off.' : 'Already checked off.'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700/70 dark:text-emerald-300/70">Off your follow-up list and your calendar.</p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                      <button onClick={undo} disabled={busy} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black text-gray-500 hover:bg-white hover:text-[#111827] disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Didn&apos;t send it - undo
                      </button>
                      {data.phone && (
                        <a href={smsHref(data.phone, data.message)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black text-[#8b7355] hover:bg-white dark:text-[#d7b974] dark:hover:bg-white/10">
                          <MessageSquare className="h-3.5 w-3.5" /> Text again
                        </a>
                      )}
                      {data.email && (
                        <button type="button" onClick={() => setMailSheet(true)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black text-[#8b7355] hover:bg-white dark:text-[#d7b974] dark:hover:bg-white/10">
                          <Mail className="h-3.5 w-3.5" /> Email again
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      {data.phone ? (
                        <a href={smsHref(data.phone, data.message)} onClick={onText}
                          className="flex flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-4 text-base font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98]">
                          <MessageSquare className="h-5 w-5" /> Text
                        </a>
                      ) : (
                        <span aria-disabled className="flex flex-[1.35] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 px-3 py-3 text-sm font-black text-gray-400 dark:border-white/10">
                          <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Text</span>
                          <span className="text-[10px] font-bold">No phone on file</span>
                        </span>
                      )}
                      {data.email ? (
                        // Which mail app? A slide-up sheet - Gmail, Outlook, the default app, or copy.
                        <button type="button" onClick={() => setMailSheet(true)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#C9A24D]/50 bg-white px-4 py-4 text-base font-black text-[#111827] shadow-sm transition active:scale-[0.98] dark:bg-white/5 dark:text-white">
                          <Mail className="h-5 w-5 text-[#C9A24D]" /> Email
                        </button>
                      ) : (
                        <span aria-disabled className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 px-3 py-3 text-sm font-black text-gray-400 dark:border-white/10">
                          <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> Email</span>
                          <span className="text-[10px] font-bold">No email on file</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-gray-400">Text opens Messages from your own number; Email opens your mail app with it written as an email. Either one checks this follow-up off.</p>
                  </>
                )
              ) : null}
            </div>

            {/* Always here (owner, 10/30) - most people tap Text and leave, never seeing the "done" state */}
            {data.contact && data.alerts && (
              <DoneLeadAlerts code={code} alerts={data.alerts} firstName={first === 'them' ? '' : first} delay={0.1} />
            )}

            <div className="flex items-center justify-center gap-4 border-t border-gray-100 px-6 py-3 dark:border-gray-800">
              {data.sms_to && <a href={`tel:${data.sms_to}`} className="inline-flex items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]"><Phone className="h-3.5 w-3.5" /> Call instead</a>}
              <a href="/leads/tasks" className="text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">All follow-ups →</a>
            </div>
          </>
        )}
      </div>
      {data?.email && (
        <MailSheet open={mailSheet} onClose={() => setMailSheet(false)} to={data.email}
          subject={data.email_subject || 'Following up'} body={data.email_body || data.message || ''}
          connected={data.mail_provider} onSent={onText} />
      )}
    </div>
  )
}
