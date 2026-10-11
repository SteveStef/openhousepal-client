'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ImagePlus, Info, Loader2, MapPin, MessageCircle, Monitor, Send, X } from 'lucide-react'
import api from '@/lib/api-service'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useEscapeToClose } from '@/components/ui/windowMotion'
import { lastInAppPage } from '@/lib/navHistory'
import {
  APP_AREAS, SUPPORT_CATEGORIES, URGENCY_OPTIONS, areaForPath, captureDeviceDetails, supportCategory,
  type SupportCategoryMeta,
} from '@/lib/supportCategories'
import type { SupportTicketCategory, SupportTicketDetail, SupportTicketDetails } from '@/types'

// "Submit a Ticket": step 1 picks what kind of ticket this is (Contact support / Report a bug /
// Suggest a feature), step 2 is a short form shaped for that kind, step 3 is the sent screen.
// Bug reports quietly carry the page the agent came from + browser/device facts so they never
// have to describe their setup. Everything lands in the same ticket thread on /settings/help.

export type TicketPrefill = {
  category?: SupportTicketCategory
  subject?: string
  /** Pre-fills the main box (support question / what happened / what you'd like). */
  body?: string
  area?: string
}

const MAX_SHOTS = 3
const EASE = [0.16, 1, 0.3, 1] as const

const label = 'mb-1.5 ml-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]/80'
const field = 'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#111827] outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white dark:placeholder:text-white/30'
const optional = <span className="font-bold normal-case tracking-normal text-gray-400 dark:text-white/35">(optional)</span>

const COPY: Record<SupportTicketCategory, {
  kicker: string; heading: React.ReactNode; sub: string
  subjectLabel: string; subjectPh: string
  mainLabel: string; mainPh: string
  extraLabel?: string; extraPh?: string
  sentTitle: React.ReactNode; sentSub: string
}> = {
  support: {
    kicker: 'Contact support', heading: <>Ask us <em>anything.</em></>, sub: 'A real person on our team reads every ticket.',
    subjectLabel: 'What do you need help with?', subjectPh: 'e.g. Changing my brokerage name',
    mainLabel: 'Tell us more', mainPh: 'Share as much detail as you like - what you’re trying to do and where you’re stuck.',
    sentTitle: <>We&apos;re <em>on it.</em></>, sentSub: 'Your question is with our team. We’ll reply right here, and you’ll get a notification when we do.',
  },
  bug: {
    kicker: 'Report a bug', heading: <>Something <em>broke?</em></>, sub: 'Tell us what happened - we’ll include the technical details for you.',
    subjectLabel: 'Sum it up in a few words', subjectPh: 'e.g. Flyer won’t download',
    mainLabel: 'What happened?', mainPh: 'What did you click, and what went wrong?',
    extraLabel: 'What did you expect to happen?', extraPh: 'e.g. The PDF should have downloaded.',
    sentTitle: <>Thanks for <em>the catch.</em></>, sentSub: 'Your bug report is in. We’ll dig in and reply right here as soon as we know more.',
  },
  feature: {
    kicker: 'Suggest a feature', heading: <>Got an <em>idea?</em></>, sub: 'The best parts of OpenHousePal started as an agent’s idea.',
    subjectLabel: 'Your idea in a few words', subjectPh: 'e.g. Text guests after an open house',
    mainLabel: 'What would you like?', mainPh: 'Describe what you’d love OpenHousePal to do.',
    extraLabel: 'How would it help you?', extraPh: 'e.g. I’d save an hour after every open house.',
    sentTitle: <>Love <em>this idea.</em></>, sentSub: 'Your idea is with the product team. We read every one and will reply right here.',
  },
}

function composeBody(category: SupportTicketCategory, main: string, extra: string, area: string) {
  const m = main.trim(), e = extra.trim()
  if (category === 'bug') {
    return [`What happened:\n${m}`, e && `What I expected:\n${e}`, area && `Where: ${area}`].filter(Boolean).join('\n\n')
  }
  if (category === 'feature') {
    return [`What I'd like:\n${m}`, e && `Why it would help:\n${e}`].filter(Boolean).join('\n\n')
  }
  return m
}

function CategoryBadgeTile({ meta, size = 'md' }: { meta: SupportCategoryMeta; size?: 'md' | 'lg' }) {
  const Icon = meta.icon
  const box = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-2xl'
  return (
    <span
      className={`relative grid shrink-0 place-items-center bg-gradient-to-br ${meta.tile} ${box}`}
      style={{ boxShadow: `0 12px 26px -12px ${meta.glow}` }}
    >
      <span className="lx-shine absolute inset-0 overflow-hidden rounded-[inherit]" />
      <Icon className={`relative ${size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'}`} strokeWidth={2} />
    </span>
  )
}

export default function NewTicketWindow({ open, onClose, onCreated, onViewTicket, prefill }: {
  open: boolean
  onClose: () => void
  /** Fires as soon as the ticket exists (refresh the list). */
  onCreated: (ticket: SupportTicketDetail) => void
  /** "View my ticket" on the sent screen. */
  onViewTicket: (ticket: SupportTicketDetail) => void
  prefill?: TicketPrefill | null
}) {
  const [category, setCategory] = useState<SupportTicketCategory | null>(null)
  const [subject, setSubject] = useState('')
  const [main, setMain] = useState('')
  const [extra, setExtra] = useState('')
  const [urgency, setUrgency] = useState<NonNullable<SupportTicketDetails['urgency']>>('normal')
  const [area, setArea] = useState('Something else')
  const [shots, setShots] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<SupportTicketDetail | null>(null)
  const [fromPage, setFromPage] = useState<string | null>(null)
  const [device, setDevice] = useState<SupportTicketDetails>({})
  const fileRef = useRef<HTMLInputElement>(null)

  useBodyScrollLock(open)
  useEscapeToClose(onClose, open && !sending)

  // Fresh form every time the window opens (keeping a prefill from a deep link if there is one).
  useEffect(() => {
    if (!open) return
    const page = lastInAppPage('/settings/help')
    setFromPage(page)
    setDevice(captureDeviceDetails())
    setCategory(prefill?.category ?? null)
    setSubject(prefill?.subject ?? '')
    setMain(prefill?.body ?? '')
    setExtra('')
    setUrgency('normal')
    setArea(prefill?.area ?? areaForPath(page))
    setShots([])
    setError('')
    setSent(null)
  }, [open, prefill])

  const meta = category ? supportCategory(category) : null
  const copy = category ? COPY[category] : null
  const step: 'pick' | 'write' | 'sent' = sent ? 'sent' : category ? 'write' : 'pick'
  const canSend = !!subject.trim() && !!main.trim() && !sending && !uploading

  const deviceLine = useMemo(() => {
    const bits = [device.browser && device.os ? `${device.browser} on ${device.os}` : device.browser, device.device, device.viewport && `${device.viewport} window`]
    return bits.filter(Boolean).join(' · ')
  }, [device])

  const addShots = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    const room = MAX_SHOTS - shots.length
    const picked = Array.from(files).slice(0, room)
    setUploading(true)
    for (const file of picked) {
      if (file.size > 10 * 1024 * 1024) { setError(`${file.name} is over 10MB.`); continue }
      const { success, data, error: err } = await api.support.uploadScreenshot(file)
      if (success && data) setShots(prev => [...prev, { url: data.url, name: file.name }])
      else setError(err || 'Couldn’t attach that image.')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async () => {
    if (!category || !canSend) return
    setSending(true)
    setError('')
    const details: SupportTicketDetails = category === 'support'
      ? { urgency }
      : category === 'bug'
        ? { ...device, area, page_url: fromPage ? window.location.origin + fromPage : undefined }
        : { area: fromPage ? areaForPath(fromPage) : undefined }
    const { success, data, error: err } = await api.support.create(
      subject.trim(),
      composeBody(category, main, extra, category === 'bug' ? area : ''),
      { category, details, attachments: shots.map(s => s.url) },
    )
    setSending(false)
    if (success && data) {
      setSent(data)
      onCreated(data)
    } else {
      setError(err || 'Something went wrong sending your ticket. Please try again.')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ticket-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.04 } }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0b0f0e]/65 sm:items-center sm:p-6"
          onClick={() => { if (!sending) onClose() }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Submit a ticket"
            data-testid="new-ticket-window"
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 34 } }}
            exit={{ opacity: 0, y: 30, scale: 0.98, transition: { duration: 0.18 } }}
            onClick={e => e.stopPropagation()}
            className="relative flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_50px_120px_-40px_rgba(17,24,39,.75)] ring-1 ring-black/5 sm:rounded-[28px] dark:bg-[#121214] dark:ring-white/10"
          >
            {/* Header band - same alive surface as every page's LuxeHero */}
            <LuxeSurface icon={meta?.icon} className="shrink-0 border-b border-[#C9A24D]/25 px-5 pb-5 pt-4 text-[#111827] sm:px-7 sm:pt-6 dark:border-white/[0.08] dark:text-white">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#111827]/15 sm:hidden dark:bg-white/20" />
              <div className="relative flex items-start gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  {step === 'write' && (
                    <motion.button
                      key="back"
                      type="button"
                      onClick={() => { setCategory(null); setError('') }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      aria-label="Change type"
                      data-testid="ticket-back"
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/80 text-[#8b7355] transition hover:-translate-x-0.5 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]"
                    >
                      <ArrowLeft size={16} />
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">
                    {step === 'pick' ? 'Submit a ticket' : step === 'sent' ? 'Ticket sent' : copy!.kicker}
                  </p>
                  <h2 key={`${step}-${category}`} className="lx-title font-serif text-[1.65rem] font-black leading-[1.08] tracking-tight sm:text-[2.1rem]">
                    {step === 'pick' ? <>How can we <em>help?</em></> : step === 'sent' ? copy!.sentTitle : copy!.heading}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#6b5a45] sm:text-sm dark:text-white/55">
                    {step === 'pick' ? 'Pick what this is about first - we’ll shape the ticket around it.' : step === 'sent' ? 'Reference #' + sent!.id.slice(0, 8).toUpperCase() : copy!.sub}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/80 text-[#8b7355] transition hover:rotate-90 hover:border-[#C9A24D] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Three-dot progress: pick, write, sent */}
              <div className="relative mt-4 flex items-center gap-1.5">
                {(['pick', 'write', 'sent'] as const).map((s, i) => {
                  const reached = ['pick', 'write', 'sent'].indexOf(step) >= i
                  return (
                    <motion.span
                      key={s}
                      layout
                      className={`h-1.5 rounded-full ${reached ? 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]' : 'bg-[#111827]/10 dark:bg-white/10'}`}
                      animate={{ width: step === s ? 36 : 14 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )
                })}
              </div>
            </LuxeSurface>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait" initial={false}>
                {step === 'pick' && (
                  <motion.div
                    key="pick"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } }}
                    exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                    className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-7"
                  >
                    {SUPPORT_CATEGORIES.map((c, i) => {
                      const Icon = c.icon
                      return (
                        <motion.button
                          key={c.id}
                          type="button"
                          data-testid={`ticket-category-${c.id}`}
                          onClick={() => setCategory(c.id)}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: 0.06 + i * 0.07, duration: 0.45, ease: EASE } }}
                          whileHover={{ y: -4 }}
                          whileTap={{ scale: 0.97 }}
                          className={`group relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-gray-100 bg-gradient-to-b from-white to-[#fdfbf6] p-4 text-left shadow-[0_18px_40px_-34px_rgba(17,24,39,.6)] transition-colors duration-300 sm:flex-col sm:items-start sm:gap-5 sm:p-5 dark:border-white/[0.07] dark:from-[#18181b] dark:to-[#121214] ${c.ring}`}
                        >
                          {/* Color wash that blooms from the icon on hover */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                            style={{ background: c.glow.replace(/[\d.]+\)$/, '.22)') }}
                          />
                          <span className="relative transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                            <CategoryBadgeTile meta={c} size="lg" />
                          </span>
                          <span className="relative min-w-0 flex-1">
                            <span className="block font-serif text-lg font-black leading-tight text-[#111827] sm:text-xl dark:text-white">{c.title}</span>
                            <span className="mt-1 block text-xs font-semibold leading-relaxed text-gray-500 sm:text-[13px] dark:text-white/55">{c.blurb}</span>
                          </span>
                          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#111827]/[0.04] text-gray-400 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-[#111827] group-hover:text-[#e8c97a] sm:mt-auto sm:self-end dark:bg-white/[0.06] dark:text-white/40 dark:group-hover:bg-[#e8c97a] dark:group-hover:text-[#111827]">
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </motion.button>
                      )
                    })}
                  </motion.div>
                )}

                {step === 'write' && meta && copy && (
                  <motion.div
                    key={`write-${category}`}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.38, ease: EASE } }}
                    exit={{ opacity: 0, x: 28, transition: { duration: 0.16 } }}
                    className="space-y-4 p-4 sm:p-7"
                  >
                    {/* What you picked + quick switch */}
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[#fdfbf6] p-2.5 pr-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
                      <CategoryBadgeTile meta={meta} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{meta.title}</p>
                        <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-white/45">{meta.blurb}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCategory(null); setError('') }}
                        className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className={label} htmlFor="ticket-subject">{copy.subjectLabel}</label>
                      <input
                        id="ticket-subject"
                        data-testid="ticket-subject"
                        autoFocus
                        maxLength={200}
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder={copy.subjectPh}
                        className={field}
                      />
                    </div>

                    <div>
                      <label className={label} htmlFor="ticket-main">{copy.mainLabel}</label>
                      <textarea
                        id="ticket-main"
                        data-testid="ticket-main"
                        value={main}
                        onChange={e => setMain(e.target.value)}
                        placeholder={copy.mainPh}
                        rows={4}
                        className={`${field} resize-none font-medium leading-relaxed`}
                      />
                    </div>

                    {copy.extraLabel && (
                      <div>
                        <label className={label} htmlFor="ticket-extra">{copy.extraLabel} {optional}</label>
                        <textarea
                          id="ticket-extra"
                          data-testid="ticket-extra"
                          value={extra}
                          onChange={e => setExtra(e.target.value)}
                          placeholder={copy.extraPh}
                          rows={2}
                          className={`${field} resize-none font-medium leading-relaxed`}
                        />
                      </div>
                    )}

                    {category === 'support' && (
                      <div>
                        <p className={label}>How urgent is it?</p>
                        <div className="grid grid-cols-3 gap-2">
                          {URGENCY_OPTIONS.map(u => {
                            const on = urgency === u.id
                            return (
                              <button
                                key={u.id}
                                type="button"
                                data-testid={`ticket-urgency-${u.id}`}
                                onClick={() => setUrgency(u.id)}
                                className={`relative overflow-hidden rounded-2xl border-2 px-2 py-2.5 text-center transition ${
                                  on
                                    ? u.id === 'urgent'
                                      ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/10'
                                      : 'border-[#C9A24D] bg-[#fbf3df] dark:bg-[#C9A24D]/10'
                                    : 'border-gray-100 bg-white hover:border-gray-200 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/20'
                                }`}
                              >
                                {on && (
                                  <motion.span layoutId="urgency-on" className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#111827] text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]">
                                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                                  </motion.span>
                                )}
                                <span className={`block text-sm font-black ${on && u.id === 'urgent' ? 'text-rose-700 dark:text-rose-300' : 'text-[#111827] dark:text-white'}`}>{u.label}</span>
                                <span className="block text-[10px] font-semibold text-gray-500 dark:text-white/45">{u.hint}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {category === 'bug' && (
                      <div>
                        <p className={label}><MapPin className="h-3 w-3" /> Where did it happen?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {APP_AREAS.map(a => {
                            const on = area === a.label
                            return (
                              <button
                                key={a.label}
                                type="button"
                                onClick={() => setArea(a.label)}
                                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                                  on
                                    ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-400/60 dark:bg-rose-500/15 dark:text-rose-200'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60 dark:hover:border-white/25'
                                }`}
                              >
                                {a.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Screenshots - handy for every kind, front and center for bugs */}
                    <div>
                      <p className={label}><ImagePlus className="h-3 w-3" /> Screenshots {optional}</p>
                      <div className="flex flex-wrap gap-2">
                        <AnimatePresence initial={false}>
                          {shots.map(s => (
                            <motion.div
                              key={s.url}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              className="group relative h-20 w-24 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={s.url} alt={s.name} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                aria-label={`Remove ${s.name}`}
                                onClick={() => setShots(prev => prev.filter(x => x.url !== s.url))}
                                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#111827]/80 text-white opacity-90 transition hover:bg-rose-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {shots.length < MAX_SHOTS && (
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="flex h-20 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#C9A24D]/40 bg-[#fdfbf6] px-4 text-[11px] font-bold text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#fbf3df] disabled:opacity-60 dark:border-[#C9A24D]/30 dark:bg-white/[0.02] dark:text-[#e8c97a] dark:hover:bg-[#C9A24D]/10"
                          >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                            {uploading ? 'Adding...' : shots.length ? 'Add another' : 'Add image'}
                          </button>
                        )}
                        <input
                          ref={fileRef}
                          data-testid="ticket-file"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          className="hidden"
                          onChange={e => addShots(e.target.files)}
                        />
                      </div>
                    </div>

                    {category === 'bug' && deviceLine && (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-3.5 py-2.5 text-[11px] font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/50">
                        <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="min-w-0">
                          We&apos;ll include your setup so you don&apos;t have to: <span className="font-bold text-gray-600 dark:text-white/70">{deviceLine}</span>
                          {fromPage && <> &middot; came from <span className="break-all font-bold text-gray-600 dark:text-white/70">{fromPage.split('?')[0]}</span></>}
                        </span>
                      </div>
                    )}

                    {error && (
                      <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        <Info className="h-3.5 w-3.5 shrink-0" /> {error}
                      </p>
                    )}
                  </motion.div>
                )}

                {step === 'sent' && meta && copy && sent && (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE } }}
                    exit={{ opacity: 0 }}
                    className="relative flex flex-col items-center overflow-hidden px-5 pb-7 pt-8 text-center sm:px-10 sm:pb-9 sm:pt-10"
                  >
                    <div className="pointer-events-none absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl" style={{ background: meta.glow.replace(/[\d.]+\)$/, '.18)') }} />
                    {/* Burst of gold sparks around the check */}
                    <div className="relative grid h-24 w-24 place-items-center">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const angle = (i / 10) * Math.PI * 2
                        return (
                          <motion.span
                            key={i}
                            className={`absolute h-1.5 w-1.5 rounded-full ${i % 2 ? 'bg-[#e8c97a]' : meta.dot}`}
                            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                            animate={{ x: Math.cos(angle) * 58, y: Math.sin(angle) * 58, opacity: [0, 1, 0], scale: [0.4, 1.2, 0.6] }}
                            transition={{ delay: 0.25, duration: 0.9, ease: 'easeOut' }}
                          />
                        )
                      })}
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-[#C9A24D]/50"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: [0.6, 1.25], opacity: [0.9, 0] }}
                        transition={{ delay: 0.2, duration: 1.1, ease: 'easeOut' }}
                      />
                      <motion.span
                        initial={{ scale: 0, rotate: -40 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                        className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-[0_20px_44px_-16px_rgba(201,162,77,.9)]"
                      >
                        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.45, ease: 'easeOut' }} />
                        </svg>
                      </motion.span>
                    </div>

                    <p className="relative mt-5 max-w-md text-sm font-semibold leading-relaxed text-gray-600 dark:text-white/60">{copy.sentSub}</p>

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.4, ease: EASE } }}
                      className="relative mt-5 flex w-full max-w-md items-center gap-3 rounded-2xl border border-gray-100 bg-[#fdfbf6] p-3 text-left dark:border-white/[0.07] dark:bg-white/[0.03]"
                    >
                      <CategoryBadgeTile meta={meta} />
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${meta.badge}`}>{meta.label}</span>
                        <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white">{sent.subject}</p>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.4, ease: EASE } }}
                      className="relative mt-6 flex w-full max-w-md flex-col-reverse gap-2 sm:flex-row"
                    >
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-black text-gray-600 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-white"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        data-testid="ticket-view"
                        onClick={() => onViewTicket(sent)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111827] py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]"
                      >
                        <MessageCircle className="h-4 w-4 text-[#e8c97a] dark:text-[#111827]" /> View my ticket
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {step === 'write' && (
              <div className="shrink-0 border-t border-gray-100 bg-white/95 px-4 py-3 sm:px-7 sm:py-4 dark:border-white/[0.07] dark:bg-[#121214]/95">
                <button
                  type="button"
                  data-testid="ticket-send"
                  onClick={submit}
                  disabled={!canSend}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="text-[#e8c97a] dark:text-[#111827]" />}
                  {sending ? 'Sending...' : category === 'bug' ? 'Send bug report' : category === 'feature' ? 'Send my idea' : 'Send to support'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
