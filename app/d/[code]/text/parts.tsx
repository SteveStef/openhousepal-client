'use client'

// Pieces of the tap-to-text page (user, 10/25): the phone's "which mail app?" sheet, the
// computer's email chooser, and the computer layout (two columns - the guest, the message and the
// actions on the left; scan-with-your-phone, Mark done and the follow-up's details on the right).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Calendar, Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Home, Loader2, Mail, MessageSquare, RotateCcw, Smartphone, StickyNote } from 'lucide-react'
import { backdropMotion, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { MAIL_CHOICE_LABEL, composeHref, mailChoices, openWithFallback, phoneAppLinks, saveMailChoice, savedMailChoice, type MailChoice } from '@/lib/mailCompose'
import { copyText } from '@/lib/copyText'
import { isIosDevice, smsHref } from '@/lib/smsLink'
import type { PublicFollowupText } from '@/types'
import DoneLeadAlerts from '@/components/tasks/DoneLeadAlerts'

type Extras = {
  home?: { address?: string | null; short?: string | null; photo?: string | null; url?: string | null } | null
  details?: string[]
  notes?: string | null
  due_at?: string | null
  all_day?: boolean
}
export type TextPageData = PublicFollowupText & Extras

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

// ------------------------------------------------------------------ phone: which mail app?
/** Slides up from the bottom (pull down to close) every time Email is tapped, last pick highlighted.
 *  A pick slides it away and opens that app - its web compose / mailto if the app isn't there. */
export function MailSheet({ open, onClose, to, subject, body, connected, onSent }: {
  open: boolean
  onClose: () => void
  to: string
  subject: string
  body: string
  connected?: 'gmail' | 'outlook' | null
  onSent: () => void
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {open && <MailSheetBody key="mail-sheet" {...{ onClose, to, subject, body, connected, onSent }} />}
    </AnimatePresence>,
    host,
  )
}

function MailSheetBody({ onClose, to, subject, body, connected, onSent }: Omit<Parameters<typeof MailSheet>[0], 'open'>) {
  const sheet = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, true)
  const [last, setLast] = useState<MailChoice | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setLast(savedMailChoice()) }, [])
  const ios = isIosDevice()
  const label = (c: MailChoice) => c === 'default' ? (ios ? 'Apple Mail' : 'Default mail app') : MAIL_CHOICE_LABEL[c]
  const pick = (c: MailChoice) => {
    saveMailChoice(c)
    if (c === 'copy') {
      copyText(`${subject}\n\n${body}`).catch(() => {})
      setCopied(true)
      onSent()
      window.setTimeout(onClose, 900)
      return
    }
    const { href, fallback } = phoneAppLinks(c, to, subject, body)
    onSent()
    onClose()
    openWithFallback(href, fallback)
  }
  const icon = (c: MailChoice) => c === 'copy' ? <Copy className="h-5 w-5" /> : <Mail className="h-5 w-5" />
  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[80] flex items-end bg-black/55">
      <motion.div ref={sheetRef} {...sheet} style={{ y }}
        className="w-full rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:bg-[#151517]">
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" />
        <p className="text-center text-base font-black text-[#111827] dark:text-white">Email with…</p>
        <p className="mb-3 truncate text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{to}</p>
        <div className="space-y-2">
          {mailChoices(connected).map(c => (
            <button key={c} type="button" onClick={() => pick(c)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] font-black transition active:scale-[0.98] ${c === last
                ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white'
                : 'border-gray-200 text-[#111827] dark:border-white/10 dark:text-white'}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${c === last ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>{icon(c)}</span>
              <span className="flex-1">{c === 'copy' && copied ? 'Copied' : label(c)}</span>
              {c === last && <span className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">Last used</span>}
              {c === connected && c !== last && <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Yours</span>}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ computer: email chooser
export function EmailChooser({ data, onSent }: { data: TextPageData; onSent: () => void }) {
  const [choice, setChoice] = useState<MailChoice | null>(null)
  const [openList, setOpenList] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setChoice(savedMailChoice()) }, [])
  const to = data.email || ''
  const subject = data.email_subject || 'Following up'
  const body = data.email_body || data.message || ''
  if (!to) {
    return <p className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs font-black text-gray-400 dark:border-gray-700"><Mail className="h-4 w-4" /> Email - no email on file</p>
  }
  const pick = (c: MailChoice) => {
    saveMailChoice(c); setChoice(c); setOpenList(false)
    if (c === 'copy') { copyText(`${subject}\n\n${body}`).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    onSent()
  }
  const linkProps = (c: MailChoice) => c === 'copy' ? {} : {
    href: composeHref(c, to, subject, body),
    ...(c === 'default' ? {} : { target: '_blank', rel: 'noreferrer' }),
  }
  const primary = 'flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white transition hover:bg-[#2a2218] dark:bg-white dark:text-[#111827] dark:hover:bg-[#e8c97a]'
  return (
    <div>
      {choice && !openList ? (
        <div className="flex items-center gap-2">
          {choice === 'copy' ? (
            <button type="button" onClick={() => pick('copy')} className={primary}>
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Mail className="h-4 w-4" />} {copied ? 'Email copied' : 'Copy the email'}
            </button>
          ) : (
            <a {...linkProps(choice)} onClick={() => pick(choice)} className={primary}>
              <Mail className="h-4 w-4" /> Email · {MAIL_CHOICE_LABEL[choice]}
            </a>
          )}
          <button type="button" onClick={() => setOpenList(true)} className="shrink-0 px-2 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">change</button>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => setOpenList(v => !v)} aria-expanded={openList} className={`${primary} w-full`}>
            <Mail className="h-4 w-4" /> Email <ChevronDown className={`h-4 w-4 transition-transform ${openList ? 'rotate-180' : ''}`} />
          </button>
          {openList && (
            <div role="menu" className="mt-2 grid grid-cols-2 gap-1.5">
              {mailChoices(data.mail_provider).map(c => c === 'copy' ? (
                <button key={c} role="menuitem" type="button" onClick={() => pick(c)}
                  className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
                  {copied ? 'Copied' : MAIL_CHOICE_LABEL[c]}
                </button>
              ) : (
                <a key={c} role="menuitem" {...linkProps(c)} onClick={() => pick(c)}
                  className={`rounded-xl border px-3 py-2.5 text-center text-xs font-black hover:border-[#C9A24D] ${c === data.mail_provider ? 'border-[#C9A24D]/60 bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 text-[#111827] dark:border-gray-700 dark:text-white'}`}>
                  {MAIL_CHOICE_LABEL[c]}{c === data.mail_provider ? ' · yours' : ''}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ computer layout
export function DesktopTextLayout({ code, data, qr, sentNow, busy, onDone, onSent, onUndo }: {
  code: string
  data: TextPageData
  qr: string | null
  sentNow: boolean
  busy: boolean
  /** Mark as done (the button). */
  onDone: () => void
  /** They emailed from here - checks it off too ("Sent? Checked off."). */
  onSent: () => void
  onUndo: () => void
}) {
  const [copied, setCopied] = useState(false)
  const first = data.first_name || 'them'
  const name = data.contact?.name || data.lead_name || first
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const due = data.due_at ? new Date(data.due_at) : null
  const dueLabel = due ? (data.all_day ? due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : due.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : null
  const card = 'rounded-3xl border border-gray-200/80 bg-white p-6 shadow-[0_20px_50px_-40px_rgba(17,24,39,.6)] dark:border-white/[0.08] dark:bg-[#151517]'
  const label = 'text-[10px] font-black uppercase tracking-[0.2em] text-gray-400'
  const copy = () => { copyText(data.message).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  // The page rises in: header, then the left column, then the right (owner, 10/27).
  const rise = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay } })

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {/* Header, like the app's Luxe pages: kicker, serif title, the why underneath */}
        <motion.div {...rise(0)} className="mb-6 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">Follow-up</p>
            <h1 className="mt-1 font-serif text-4xl font-black tracking-tight text-[#111827] dark:text-white">
              {data.phone && data.email ? <>Text or email <em className="text-[#a8803a] dark:text-[#e8c97a]">{first}</em></> : data.phone ? <>Text <em className="text-[#a8803a] dark:text-[#e8c97a]">{first}</em></> : <>Email <em className="text-[#a8803a] dark:text-[#e8c97a]">{first}</em></>}
            </h1>
            {data.context && <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{data.context}</p>}
          </div>
          {data.done ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Checked off</span>
          ) : dueLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-xs font-black text-[#e8c97a] dark:bg-white/10"><Calendar className="h-4 w-4" /> Due {dueLabel}</span>
          ) : null}
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT: who, what happened, the message, and the ways to send it */}
          <motion.div {...rise(0.08)} className="space-y-6">
            <div className={card}>
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] font-serif text-lg font-black text-[#e8c97a]">{initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-2xl font-black text-[#111827] dark:text-white">{name}</p>
                  <p className="truncate text-sm font-semibold text-gray-500 dark:text-gray-400">{[data.phone && prettyPhone(data.phone), data.email].filter(Boolean).join('   ·   ')}</p>
                </div>
              </div>
              {data.home && (data.home.short || data.home.address) && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#faf9f7] p-3 dark:bg-white/[0.04]">
                  {data.home.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.home.photo} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-14 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]/70"><Home className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={label}>The home</p>
                    <p className="truncate text-[15px] font-black text-[#111827] dark:text-white">{data.home.address || data.home.short}</p>
                  </div>
                  {data.home.url && (
                    <a href={data.home.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Open <ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                </div>
              )}
              {(data.details?.length || 0) > 0 && (
                <div className="mt-5">
                  <p className={label}>What happened</p>
                  <ul className="mt-2 space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                    {data.details!.map((d, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" />{d}</li>)}
                  </ul>
                </div>
              )}
              {data.notes && (
                <div className="mt-5">
                  <p className={`${label} flex items-center gap-1.5`}><StickyNote className="h-3.5 w-3.5" /> Notes</p>
                  <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-200">{data.notes}</p>
                </div>
              )}
            </div>

            <div className={card}>
              <div className="flex items-center justify-between">
                <p className={label}>Ready-to-send message</p>
                <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {data.fill_ins.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Before you send: replace {data.fill_ins.join(' and ')}.
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-[#0A84FF] px-4 py-3 text-[14px] font-medium leading-relaxed text-white shadow-sm">{data.message}</div>
              </div>
              <div className="mt-5 space-y-2">
                <EmailChooser data={data} onSent={onSent} />
                <div className="grid grid-cols-2 gap-2">
                  {data.phone ? (
                    // Messages on a Mac (or any computer with an SMS app) - on a phone, scan the code.
                    <a href={smsHref(data.phone, data.message)} onClick={onSent}
                      className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
                      <MessageSquare className="h-4 w-4 text-[#C9A24D]" /> Text
                    </a>
                  ) : (
                    <span className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs font-black text-gray-400 dark:border-gray-700">No phone on file</span>
                  )}
                  <button type="button" onClick={copy} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy text'}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-gray-400">
                {data.phone ? 'Text uses Messages on this computer - or scan the code on the right to text from your phone.' : 'No phone number on file - email them instead.'}
              </p>
            </div>
          </motion.div>

          {/* RIGHT: text from the phone, done / undo, the follow-up itself */}
          <motion.div {...rise(0.16)} className="space-y-6">
            {data.phone && (
              <div className={`${card} text-center`}>
                <p className="flex items-center justify-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><Smartphone className="h-4 w-4 text-[#C9A24D]" /> Scan with your phone</p>
                <div className="mx-auto mt-4 h-44 w-44 overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-gray-100 dark:ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr ? <img src={qr} alt="Scan with your phone" className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-lg bg-gray-100" />}
                </div>
                <p className="mt-3 text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">Opens this page on your phone - one tap and Messages opens with the text written, from your own number.</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-gray-400"><MessageSquare className="h-3.5 w-3.5" /> {prettyPhone(data.phone)}</p>
              </div>
            )}

            <div className={card}>
              {data.done ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /> {sentNow ? 'Sent? Checked off.' : 'Checked off'}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Off your follow-up list and your calendar.</p>
                  <button type="button" onClick={onUndo} disabled={busy}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-black text-gray-600 transition hover:border-[#C9A24D] disabled:opacity-60 dark:border-white/10 dark:text-gray-300">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Undo - not done yet
                  </button>
                  {data.contact && data.alerts && (
                    <div className="-mx-3 mt-4 -mb-2"><DoneLeadAlerts code={code} alerts={data.alerts} firstName={data.first_name || ''} delay={0.05} /></div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-[#111827] dark:text-white">Done reaching out?</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Emailing from here checks it off too.</p>
                  <button type="button" onClick={onDone}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white shadow-[0_12px_26px_-12px_rgba(16,185,129,.8)] transition hover:bg-emerald-600">
                    <CheckCircle2 className="h-5 w-5" /> Mark as done
                  </button>
                </>
              )}
            </div>

            <div className={card}>
              <p className={label}>This follow-up</p>
              <p className="mt-2 text-[15px] font-black text-[#111827] dark:text-white">{data.title}</p>
              {dueLabel && <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"><Calendar className="h-3.5 w-3.5" /> {data.all_day ? 'Due' : 'Due'} {dueLabel}</p>}
              <a href="/leads/tasks" className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">All follow-ups →</a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
