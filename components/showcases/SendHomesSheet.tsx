'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCircle2, Copy, Link2, Mail, MessageSquareText, RotateCcw, Send } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import api from '@/lib/api-service'
import { copyText } from '@/lib/copyText'
import { isPhoneDevice } from '@/lib/smsLink'
import { normalizeImageUrl } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { Collection, Property } from '@/types'
import {
  DEFAULT_SEND_MESSAGE, SEND_APP_LABEL, withShowcaseCount, fillSendMessage, fitSendEmail, homeStreet, openSendEmail, openSendText,
  sendEmailSubject, sendHomeKey, sendHomeLink, sendLine, sendsByHome, sendTextBody, toSendTemplate, type HomeSend, type SendMailApp, type SendMethod,
} from '@/lib/sendHome'

// Send one home (or the homes picked in select mode) to the client (user, 10/30): Text or Email,
// an optional short intro (the agent's own, saved for every Showcase), then Messages / their email
// app opens with it all written. On a phone it's the pull-down sheet, on a computer a centred window.

const APPS: SendMailApp[] = ['gmail', 'outlook', 'default']
const spring = { type: 'spring', stiffness: 420, damping: 34 } as const
const unfold = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { height: spring, opacity: { duration: 0.2, delay: 0.05 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.2 }, opacity: { duration: 0.12 } } },
} as const

/** "(610) 555-0190" for a US number; anything else as saved. */
const prettyPhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v
}

type SendState = { message: string | null; mail_app: SendMailApp | null; intro_texted_at: string | null; sends?: HomeSend[] }

export default function SendHomesSheet({ open, onClose, homes, collection, showcaseUrl, agentFirst, homeCount = 0, onTurnOnLink, onSent, onSendsChange }: {
  open: boolean
  onClose: () => void
  homes: Property[]
  collection: Collection
  /** The client's Showcase link (their own domain when the agent has one); null = link is off. */
  showcaseUrl: string | null
  agentFirst: string
  /** How many homes the client sees in their Showcase now - a line after the message says so. */
  homeCount?: number
  onTurnOnLink?: () => void
  onSent?: (method: SendMethod) => void
  /** The updated send log after this send is recorded - the Showcase marks those homes "Sent". */
  onSendsChange?: (sends: HomeSend[]) => void
}) {
  const { showToast } = useToast()
  const client = (collection.customer.firstName || '').trim()
  const clientName = client ? client.charAt(0).toUpperCase() + client.slice(1) : ''
  const phone = collection.customer.phone || ''
  const email = collection.customer.email || ''

  const [state, setState] = useState<SendState | null>(null)
  const [method, setMethod] = useState<SendMethod | null>(null)
  const [withMsg, setWithMsg] = useState(true)
  const [text, setText] = useState('')
  const [app, setApp] = useState<SendMailApp | null>(null)
  const [pickingApp, setPickingApp] = useState(false)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)
  const [phoneDevice, setPhoneDevice] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Fresh each time it opens: the saved message / app may have changed on another device.
  useEffect(() => {
    if (!open) return
    setMethod(null); setPickingApp(false); setSaving('idle'); setCopied(false); setState(null)
    setPhoneDevice(isPhoneDevice())
    let live = true
    api.collections.sendHomeState(collection.id).then(({ success, data }) => {
      if (!live) return
      const s: SendState = success && data ? data : { message: null, mail_app: null, intro_texted_at: null }
      setState(s)
      setApp(s.mail_app)
      setText(fillSendMessage(s.message, clientName, agentFirst))
    })
    return () => { live = false }
  }, [open, collection.id, clientName, agentFirst])

  const savedText = useMemo(() => fillSendMessage(state?.message, clientName, agentFirst), [state?.message, clientName, agentFirst])
  const customSaved = !!state?.message && state.message !== DEFAULT_SEND_MESSAGE
  const edited = text.trim() !== savedText.trim() && !!text.trim()
  const introSaid = !!state?.intro_texted_at

  // Picking a method sets the message box to that method's start: an email always has the
  // message; a text has it only until this client got the intro once.
  const pickMethod = (m: SendMethod) => {
    setMethod(m)
    setWithMsg(m === 'email' ? true : !introSaid)
    setPickingApp(m === 'email' && !app)
  }

  // Grow the message box with what's typed.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [text, withMsg, method])

  const links = useMemo(() => (showcaseUrl ? homes.map(p => sendHomeLink(showcaseUrl, p)) : []), [homes, showcaseUrl])
  // the agent's words + the live "You have 12 homes in your Showcase." (never saved with them)
  const message = withMsg && text.trim() ? withShowcaseCount(text, homeCount) : null
  const textBody = sendTextBody(message, links)
  const mail = method === 'email' && app ? fitSendEmail(app, email, message, homes, links) : null

  const saveDefault = async () => {
    setSaving('saving')
    const template = toSendTemplate(text, clientName, agentFirst)
    const { success, data, error } = await api.collections.saveSendHomePrefs({ message: template === DEFAULT_SEND_MESSAGE ? '' : template })
    if (!success || !data) { setSaving('idle'); showToast(error || "Couldn't save your message - try again", 'error'); return }
    setState(s => (s ? { ...s, message: data.message } : s))
    setSaving('saved')
    window.setTimeout(() => setSaving('idle'), 1800)
  }
  const resetDefault = async () => {
    const { success, data } = await api.collections.saveSendHomePrefs({ message: '' })
    if (!success || !data) return
    setState(s => (s ? { ...s, message: null } : s))
    setText(fillSendMessage(null, clientName, agentFirst))
  }
  const chooseApp = (a: SendMailApp) => {
    setApp(a); setPickingApp(false)
    setState(s => (s ? { ...s, mail_app: a } : s))
    api.collections.saveSendHomePrefs({ mail_app: a })
  }

  const ids = homes.map(p => String(p.id))
  // Log it (the homes show "Sent" on the Showcase) - the server's answer is the whole log.
  const logSent = (m: SendMethod, sentIds: string[], copiedIt = false) =>
    api.collections.markHomeSent(collection.id, m, !!message, sentIds, copiedIt).then(({ data }) => {
      if (!data) return
      setState(s => (s ? { ...s, intro_texted_at: data.intro_texted_at ?? s.intro_texted_at, sends: data.sends ?? s.sends } : s))
      if (data.sends) onSendsChange?.(data.sends)
    })
  const send = () => {
    if (!method || !links.length) return
    if (method === 'text') {
      openSendText(phone, textBody)
      logSent('text', ids)
    } else {
      if (!app || !mail) return
      const sendHomes = homes.slice(0, mail.count)
      openSendEmail(app, email, sendEmailSubject(sendHomes), mail.body)
      logSent('email', ids.slice(0, mail.count))
    }
    onSent?.(method)
    showToast(method === 'text' ? 'Messages opened - tap send there' : `${SEND_APP_LABEL[app!]} opened - tap send there`, 'success')
    onClose()
  }
  const copy = async () => {
    const ok = await copyText(method === 'email' && mail ? `${sendEmailSubject(homes)}\n\n${mail.body}` : textBody)
    if (ok) {
      setCopied(true)
      logSent(method || 'text', method === 'email' && mail ? ids.slice(0, mail.count) : ids, true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  // Sent before (owner 10/31): the agent may not remember - say how and when, right at the top.
  const byHome = useMemo(() => sendsByHome(state?.sends), [state?.sends])
  const past = homes.map(h => ({ h, sends: byHome[String(h.id)] || [] })).filter(x => x.sends.length)
  const one = homes.length === 1 ? homes[0] : null
  const allSent = past.length > 0 && past.length === homes.length
  const title = `${allSent ? 'Send again' : 'Send'} to ${clientName || 'your client'}`
  const subtitle = one ? homeStreet(one) : `${homes.length} homes`
  const photo = one?.ListPictureURL ? normalizeImageUrl(one.ListPictureURL) : undefined
  const ready = !!method && !!links.length && (method === 'text' || (!!app && !pickingApp))
  const cta = !method ? 'Pick Text or Email' : method === 'text' ? 'Open Messages' : app && !pickingApp ? `Open ${SEND_APP_LABEL[app]}` : 'Pick your email app'

  return (
    <OhSheet open={open} onClose={onClose} width="max-w-lg" title={title} subtitle={subtitle}
      {...(photo ? { image: photo } : { icon: <Send className="h-5 w-5" /> })}
      zClass="z-[70]"
      footer={showcaseUrl ? (
        <div className="flex items-center gap-2">
          {/* A computer may have no Messages app - the text can be copied instead. */}
          {method && !phoneDevice && (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={copy} data-send-copy
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </motion.button>
          )}
          <motion.button type="button" whileTap={ready ? { scale: 0.97 } : undefined} onClick={send} disabled={!ready} data-send-go
            className={`relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-black transition ${ready
              ? 'bg-gradient-to-br from-[#e8c97a] via-[#C9A24D] to-[#a8823a] text-[#16130e] shadow-[0_14px_30px_-14px_rgba(201,162,77,.9)]'
              : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500'}`}>
            {method === 'email' ? <Mail className="h-4 w-4" /> : method === 'text' ? <MessageSquareText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={cta} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}>{cta}</motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      ) : undefined}>
      {!showcaseUrl ? (
        // The client's link is off: nothing to send yet.
        <div className="rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/10 p-5 text-center">
          <Link2 className="mx-auto h-6 w-6 text-[#C9A24D]" />
          <p className="mt-2 text-sm font-black text-[#111827] dark:text-white">{clientName || 'Your client'}&rsquo;s Showcase link is off</p>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Turn it on first - the home is sent as a link into their Showcase.</p>
          {onTurnOnLink && (
            <button type="button" onClick={() => { onClose(); window.setTimeout(onTurnOnLink, 200) }}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">
              Turn on the link
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5" data-send-sheet>
          {/* Sent before - how and when (newest first); sending again is just the steps below */}
          {past.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07]" data-send-history>
              <p className="flex items-center gap-2 text-[13px] font-black text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {one ? `Already sent to ${clientName || 'them'}` : `${past.length} of these ${homes.length} homes were sent before`}
              </p>
              <ul className="mt-2 space-y-1 pl-6">
                {one
                  ? past[0].sends.slice(0, 3).map((s, i) => (
                      <li key={s.at + i} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-900/80 dark:text-emerald-200/80">
                        {s.method === 'email' ? <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" /> : <MessageSquareText className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                        <span className="first-letter:uppercase">{sendLine(s)}</span>
                      </li>
                    ))
                  : past.slice(0, 4).map(({ h, sends }) => (
                      <li key={h.id} className="truncate text-[12px] font-semibold text-emerald-900/80 dark:text-emerald-200/80">
                        <span className="font-black">{homeStreet(h)}</span> - {sendLine(sends[0])}
                      </li>
                    ))}
                {one && past[0].sends.length > 3 && <li className="text-[11px] font-bold text-emerald-900/60 dark:text-emerald-200/60">+ {past[0].sends.length - 3} more before that</li>}
                {!one && past.length > 4 && <li className="text-[11px] font-bold text-emerald-900/60 dark:text-emerald-200/60">+ {past.length - 4} more</li>}
              </ul>
              <p className="mt-2 pl-6 text-[11px] font-semibold text-emerald-900/60 dark:text-emerald-200/60">Want to send {one ? 'it' : 'them'} again? Pick Text or Email below.</p>
            </div>
          )}

          {/* The homes going out (several: a strip you can swipe) */}
          {homes.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
              {homes.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, ...spring } }}
                  className="flex w-40 shrink-0 items-center gap-2 rounded-2xl border border-gray-100 bg-white p-1.5 dark:border-white/[0.07] dark:bg-[#141416]">
                  <span className="h-10 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                    {p.ListPictureURL && <img src={normalizeImageUrl(p.ListPictureURL)} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-black text-[#111827] dark:text-white">{p.ListPrice ? `$${Math.round(p.ListPrice).toLocaleString('en-US')}` : '-'}</span>
                    <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{homeStreet(p)}</span>
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {/* a. How */}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Send by</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['text', 'Text', MessageSquareText, phone ? prettyPhone(phone) : 'No phone saved'],
                ['email', 'Email', Mail, email || 'No email saved'],
              ] as const).map(([m, label, Icon, sub]) => {
                const on = method === m
                return (
                  <motion.button key={m} type="button" whileTap={{ scale: 0.97 }} onClick={() => pickMethod(m)} disabled={!state} data-send-method={m} aria-pressed={on}
                    className={`relative flex min-w-0 items-center gap-2.5 rounded-2xl border bg-white p-3 text-left min-[400px]:gap-3 min-[400px]:p-3.5 transition-colors dark:bg-[#141416] ${on ? 'border-transparent' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'}`}>
                    {on && <motion.span layoutId="send-method-ring" transition={spring} className="pointer-events-none absolute -inset-px rounded-2xl border-2 border-[#C9A24D] shadow-[0_10px_28px_-16px_rgba(201,162,77,.95)]" />}
                    <span className={`grid h-9 w-9 shrink-0 min-[400px]:h-10 min-[400px]:w-10 place-items-center rounded-xl transition-colors ${on ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#16130e]' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-black text-[#111827] dark:text-white">{label}</span>
                      <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* f. Which email app - asked once, then shown with a way to change it */}
          <AnimatePresence initial={false}>
            {method === 'email' && (
              <motion.div key="app" {...unfold} className="overflow-hidden">
                {app && !pickingApp ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 dark:border-white/[0.07] dark:bg-[#141416]" data-send-app={app}>
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-gray-600 dark:text-gray-300">
                      <Mail className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                      Opens in <span className="font-black text-[#111827] dark:text-white">{SEND_APP_LABEL[app]}</span>
                    </span>
                    <button type="button" onClick={() => setPickingApp(true)} data-send-change-app
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#8b7355] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.07] p-3">
                    <p className="mb-2 px-0.5 text-[13px] font-black text-[#111827] dark:text-white">Which email app do you use?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {APPS.map(a => (
                        <motion.button key={a} type="button" whileTap={{ scale: 0.95 }} onClick={() => chooseApp(a)} data-send-pick-app={a}
                          className={`rounded-xl border px-2 py-2.5 text-[13px] font-black transition ${a === app ? 'border-[#C9A24D] bg-white text-[#111827] dark:bg-white/10 dark:text-white' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white'}`}>
                          {SEND_APP_LABEL[a]}
                        </motion.button>
                      ))}
                    </div>
                    <p className="mt-2 px-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">We&rsquo;ll remember it for next time.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* b-e. The short message */}
          <AnimatePresence initial={false}>
            {method && (
              <motion.div key="msg" {...unfold} className="overflow-hidden">
                <div className={`rounded-2xl border bg-white transition-colors dark:bg-[#141416] ${withMsg ? 'border-[#C9A24D]/45' : 'border-gray-100 dark:border-white/[0.07]'}`}>
                  <button type="button" onClick={() => setWithMsg(v => !v)} role="checkbox" aria-checked={withMsg} data-send-intro
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors ${withMsg ? 'border-[#C9A24D] bg-[#C9A24D] text-[#16130e]' : 'border-gray-300 bg-white dark:border-white/20 dark:bg-transparent'}`}>
                      <AnimatePresence>{withMsg && <motion.span initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 20 }}><Check className="h-4 w-4" strokeWidth={3} /></motion.span>}</AnimatePresence>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-black text-[#111827] dark:text-white">Attach a short message?</span>
                      {method === 'text' && introSaid && (
                        <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">You already said hi to {clientName || 'them'} by text - this can be just the link.</span>
                      )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {withMsg && (
                      <motion.div key="box" {...unfold} className="overflow-hidden">
                        <div className="px-3.5 pb-3">
                          <textarea ref={textRef} value={text} onChange={e => { setText(e.target.value); setSaving('idle') }} rows={2} maxLength={600} data-send-text
                            className="w-full resize-none rounded-xl border border-gray-200 bg-[#FAFAF7] px-3 py-2.5 text-[15px] font-medium leading-snug text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-white/10 dark:bg-white/5 dark:text-white sm:text-sm" />
                          <div className="mt-1.5 flex min-h-[28px] items-center justify-between gap-2">
                            <AnimatePresence mode="wait" initial={false}>
                              {saving === 'saved' ? (
                                <motion.span key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400" data-send-saved>
                                  <Check className="h-3.5 w-3.5" /> Saved for every Showcase
                                </motion.span>
                              ) : edited ? (
                                <motion.button key="save" type="button" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={saveDefault} disabled={saving === 'saving'} data-send-save
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#2a2218] disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                                  <Check className="h-3.5 w-3.5" /> {saving === 'saving' ? 'Saving…' : 'Save as my message'}
                                </motion.button>
                              ) : (
                                <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] font-semibold text-gray-400">
                                  {customSaved ? 'Your saved message' : 'Edit it, then save it for every Showcase'}
                                </motion.span>
                              )}
                            </AnimatePresence>
                            {customSaved && !edited && saving !== 'saved' && (
                              <button type="button" onClick={resetDefault} className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 transition hover:text-[#8b7355]">
                                <RotateCcw className="h-3 w-3" /> Original
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What the client gets */}
          <AnimatePresence initial={false}>
            {method && (
              <motion.div key="preview" {...unfold} className="overflow-hidden">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">What {clientName || 'they'} get{clientName ? 's' : ''}</p>
                {method === 'text' ? (
                  <div className="flex flex-col items-end gap-1.5" data-send-preview="text">
                    <AnimatePresence initial={false}>
                      {message && (
                        <motion.div key="m" data-send-bubble initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring}
                          className="max-w-[85%] origin-bottom-right rounded-[20px] rounded-br-md bg-[#0a84ff] px-3.5 py-2 text-[14px] font-medium leading-snug text-white">
                          {message}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <LinkCards homes={homes} showcaseUrl={showcaseUrl} token={collection.shareToken || ''} />
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-white/[0.07] dark:bg-[#141416]" data-send-preview="email">
                    <div className="border-b border-gray-100 px-3.5 py-2.5 dark:border-white/[0.07]">
                      <p className="truncate text-[11px] font-semibold text-gray-400">To: {email || 'add their email in your app'}</p>
                      <p className="truncate text-[14px] font-black text-[#111827] dark:text-white">{sendEmailSubject(homes)}</p>
                    </div>
                    <p className="max-h-36 overflow-y-auto whitespace-pre-line px-3.5 py-3 text-[13px] leading-snug text-gray-600 dark:text-gray-300">{mail?.body || sendTextBody(message, links)}</p>
                    {mail && mail.count < homes.length && (
                      <p className="border-t border-amber-200 bg-amber-50 px-3.5 py-2 text-[11px] font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        Only {mail.count} of {homes.length} homes fit in one {SEND_APP_LABEL[app!]} email - send the rest in another.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </OhSheet>
  )
}

/** The link preview(s) the client sees in Messages - the real one-home card, first two shown. */
function LinkCards({ homes, showcaseUrl, token }: { homes: Property[]; showcaseUrl: string; token: string }) {
  const shown = homes.slice(0, 2)
  return (
    <>
      {shown.map(p => (
        <motion.div key={p.id} initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring}
          className="w-[85%] max-w-[300px] origin-bottom-right overflow-hidden rounded-[18px] rounded-br-md bg-[#e9e9eb] dark:bg-[#26252a]">
          <div className="relative aspect-[1200/630] w-full bg-gradient-to-br from-[#f6efe0] to-[#e9dcc0] dark:from-[#1d1a14] dark:to-[#2a2218]">
            {token && <img src={`/api/og/showcasehome?token=${encodeURIComponent(token)}&home=${encodeURIComponent(sendHomeKey(p))}`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
          </div>
          <div className="px-3 py-2">
            <p className="truncate text-[12px] font-bold text-[#111827] dark:text-white">{homeStreet(p)}{p.City ? `, ${String(p.City).toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}` : ''}</p>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{sendHomeLink(showcaseUrl, p).replace(/^https?:\/\//, '').split('/')[0]}</p>
          </div>
        </motion.div>
      ))}
      {homes.length > 2 && <p className="text-[11px] font-bold text-gray-400">+ {homes.length - 2} more link{homes.length - 2 === 1 ? '' : 's'}, each with its own card</p>}
    </>
  )
}
