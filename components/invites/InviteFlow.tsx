'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase, Check, ChevronLeft, Copy, Download, ExternalLink, Home, ImagePlus, Loader2, Lock, Mail, MapPin, MessageSquare, Move, PartyPopper,
  Pencil, Printer, QrCode, Send, Share2, Sparkles, Upload, Users, Wine, X,
} from 'lucide-react'
import FlowDock from '@/components/ui/FlowDock'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'
import { copyText } from '@/lib/copyText'
import { smsHref } from '@/lib/smsLink'
import {
  DESIGNS, MOTIONS, TYPE_META, allDays, daysPatch, invitesApi,
  type Invite, type InviteDay, type InviteDraft, type InviteMetal, type InvitePreset, type InvitePresets, type InviteProperty, type InviteType, type ScheduledSlot,
} from '@/lib/invites'
import { BRAND_COLOR_GROUPS, luxeAllowedFor, useBrandKit } from '@/lib/brandKit'
import { tidyAllCaps } from '@/lib/cheatSheetContent'
import { LUXE_METALS, LUXE_METAL_ORDER } from '@/lib/luxeMetals'
import { backdropMotion, useEscapeToClose, useIsPhone, useSheetMotion } from '@/components/ui/windowMotion'
import FormQrCode from '@/components/forms/FormQrCode'
import InviteCard, { autoLineTwo, coverFrame, coverOf, type InviteCardData } from './InviteCard'
import { cardTitle } from '@/lib/inviteTitle'
import { DayStep, TimeStep } from './InviteFlowParts'
import InviteMotionPreview from './InviteMotionPreview'
import InviteQuestionsEditor from './InviteQuestionsEditor'

// Making an invite - one question per step in the house style (the open-house host flow / setup
// flow look): the kind of invite, the event (with one of your listings, or not), the day, the
// time, the place, the look (photo, design, colour), the RSVP questions, then share it. On a phone
// it's a sheet that fills the screen; on a computer the invitation builds itself live on the left.

const STEPS = ['Kind of invite', 'The event', 'The days', 'The time', 'The place', 'The look', 'Questions', 'Share'] as const
const STEP_TITLES = ['What are you inviting people to?', 'Tell them about it', 'Which day - or days?', 'What time?', 'Where is it?', 'Make it yours', 'What should guests answer?', 'Your invite is ready']

export const TYPE_ART: Record<InviteType, { icon: typeof Home; tint: string }> = {
  open_house: { icon: Home, tint: '#C9A24D' },
  brokers_open: { icon: Briefcase, tint: '#1F3A5F' },
  client_event: { icon: Wine, tint: '#9C4F6B' },
  custom: { icon: PartyPopper, tint: '#4F6F52' },
}

type Listing = InviteProperty & { label: string }

function draftFrom(preset: InvitePreset, accent: string): InviteDraft {
  return {
    invite_type: preset.id, audience: preset.audience, title: preset.title, message: preset.message,
    event_date: null, start_time: null, end_time: null, place_name: null, address: null, linked_property: null,
    cover_image_url: null, design: preset.design, accent_color: accent, questions: preset.questions.map(q => ({ ...q })),
    extra_dates: [], motion: 'normal', luxe_metal: null, cover_position: null, open_house_event_id: null, subtitle: null,
  }
}

const street = (a?: string | null) => tidyAllCaps((a || '').split(',')[0].trim())

export default function InviteFlow({ open, onClose, presets, startType, editing, onSaved }: {
  open: boolean
  onClose: () => void
  presets: InvitePresets
  startType?: InviteType | null
  editing?: Invite | null
  onSaved: (inv: Invite) => void
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {open && <FlowWindow key={editing?.id || startType || 'new'} {...{ onClose, presets, startType, editing, onSaved }} />}
    </AnimatePresence>,
    host,
  )
}

function FlowWindow({ onClose, presets, startType, editing, onSaved }: Omit<Parameters<typeof InviteFlow>[0], 'open'>) {
  const { user } = useAuth()
  const isPhone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const brandAccent = presets.brand.accent_color
  const presetOf = (t: InviteType) => presets.presets.find(p => p.id === t) || presets.presets[0]
  const [draft, setDraft] = useState<InviteDraft>(() => editing ? {
    invite_type: editing.invite_type, audience: editing.audience, title: editing.title, message: editing.message, event_date: editing.event_date,
    start_time: editing.start_time, end_time: editing.end_time, place_name: editing.place_name, address: editing.address,
    linked_property: editing.linked_property, cover_image_url: editing.cover_image_url, design: editing.design,
    accent_color: editing.accent_color, questions: editing.questions,
    extra_dates: (editing.dates || []).slice(1), motion: editing.motion || 'normal', luxe_metal: editing.luxe_metal || null,
    cover_position: editing.cover_position || null, open_house_event_id: editing.open_house_event_id || null,
    subtitle: editing.subtitle ?? null,
  } : draftFrom(presetOf(startType || 'open_house'), brandAccent))
  // The picked home's open houses already on the calendar (ours or Bright's) - the day step's first picks.
  const [scheduled, setScheduled] = useState<ScheduledSlot[] | null>(null)
  const autoPicked = useRef(false)
  const lpKey = draft.linked_property ? `${draft.linked_property.listing_key || ''}|${draft.linked_property.address || ''}` : ''
  useEffect(() => {
    if (!draft.linked_property) { setScheduled([]); return }
    let live = true
    setScheduled(null)
    invitesApi.scheduled(draft.linked_property.listing_key, draft.linked_property.address).then(r => {
      if (!live || !r.success) { if (live) setScheduled([]); return }
      setScheduled(r.data.slots)
      setDraft(d => ({ ...d, open_house_event_id: r.data.open_house_event_id || null }))
    })
    return () => { live = false }
  }, [lpKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const days = allDays(draft)
  const setDays = (next: InviteDay[]) => setDraft(d => ({ ...d, ...daysPatch(next) }))
  const [step, setStep] = useState(editing || startType ? 1 : 0)
  const [dir, setDir] = useState(1)
  const [touched, setTouched] = useState({ title: !!editing, message: !!editing, address: !!editing })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Invite | null>(null)
  const busy = saving
  const close = () => { if (!busy) onClose() }
  useEscapeToClose(close, !busy)

  const set = (patch: Partial<InviteDraft>) => setDraft(d => ({ ...d, ...patch }))
  const pickType = (t: InviteType) => {
    const p = presetOf(t)
    setDraft(d => ({
      ...d, invite_type: t, audience: p.audience, design: p.design, questions: p.questions.map(q => ({ ...q })),
      title: touched.title ? d.title : titleFor(t, d.linked_property, p),
      message: touched.message ? d.message : p.message,
    }))
  }
  // The automatic title follows the home - its listing, or (round 8 full-flow test) the address the
  // agent typed when there's no listing: "Open House at 8 Elm St", never the generic preset title
  // under a gold "Open House" label.
  const titleFor = (t: InviteType, lp: InviteProperty | null | undefined, p = presetOf(t), typed?: string | null) => {
    const s = street(lp?.address) || (lp ? '' : street(typed || ''))
    if (s && t === 'open_house') return `Open House at ${s}`
    if (s && t === 'brokers_open') return `Broker's Open at ${s}`
    return p.title
  }
  const addressOf = (lp: InviteProperty | null | undefined) => lp ? [lp.address, lp.city, [lp.state, lp.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  const photosOf = (lp: InviteProperty | null | undefined) => [lp?.image, ...(lp?.photos || [])].filter(Boolean) as string[]
  // Switching homes: whatever was filled in FROM the old home (title, address, its photo as the
  // cover) follows the new one. Anything the agent wrote or uploaded themselves stays - judged by
  // whether it still matches what the old home filled in, so it also works when editing a saved invite.
  const pickProperty = (lp: InviteProperty | null) => setDraft(d => {
    const old = d.linked_property
    const titleWasAuto = !touched.title || d.title.trim() === titleFor(d.invite_type, old) || !d.title.trim()
    const addressWasAuto = !d.address?.trim() || d.address.trim() === addressOf(old)
    const coverWasAuto = !d.cover_image_url || photosOf(old).includes(d.cover_image_url)
    return {
      ...d, linked_property: lp,
      title: titleWasAuto ? titleFor(d.invite_type, lp) : d.title,
      address: addressWasAuto ? (addressOf(lp) || null) : d.address,
      cover_image_url: coverWasAuto ? null : d.cover_image_url,
    }
  })

  const ok = [
    true,
    draft.title.trim().length > 0,
    days.length > 0,
    days.length > 0 && days.every(d => !!d.start && !!d.end),
    !!(draft.address?.trim() || draft.place_name?.trim()),
    true,
    true,
    true,
  ]
  const go = (n: number) => {
    // Be smart (user, 10/24): arriving at the days with nothing picked yet and this home's open
    // houses already on the calendar - they're picked for you (that weekend's), with their times.
    if (n === 2 && !autoPicked.current && days.length === 0 && scheduled && scheduled.length) {
      autoPicked.current = true
      const first = scheduled[0].date
      const weekend = scheduled.filter(s => (new Date(s.date).getTime() - new Date(first).getTime()) / 86400000 <= 2)
      setDays(weekend.map(s => ({ date: s.date, start: s.start || null, end: s.end || null })))
    }
    setDir(n > step ? 1 : -1); setStep(n); setError('')
  }
  const save = async () => {
    setSaving(true)
    setError('')
    const body: InviteDraft = { ...draft, questions: draft.questions.filter(q => q.label.trim()) }
    const r = editing || saved ? await invitesApi.update((editing || saved)!.id, body) : await invitesApi.create(body)
    setSaving(false)
    if (!r.success) { setError(r.error); return }
    setSaved(r.data)
    onSaved(r.data)
    go(7)
  }

  // Footer agent from the Agent Hub profile (presets.host, round 5), the login's own fields as a fallback.
  const ph = presets.host
  const card: InviteCardData = { ...draft, hostName: ph?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || null,
    hostBrokerage: ph?.brokerage || user?.brokerage || null, hostPhoto: ph?.photo_url || user?.photo_url || null, hostArea: ph ? ph.market || null : user?.market || null }
  const done = step === 7

  return (
    <motion.div {...backdropMotion} className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0b0b0c]/70 sm:items-center sm:p-5"
      onClick={e => { if (e.target === e.currentTarget) close() }} data-testid="invite-flow">
      <style>{FLOW_CSS}</style>
      <motion.div {...sheetMotion}
        className="relative grid h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#111113] sm:h-[min(720px,calc(100dvh-2.5rem))] sm:max-w-[1000px] sm:grid-cols-[320px_minmax(0,1fr)] sm:grid-rows-1 sm:rounded-[30px]">

        {/* ---- left: the invitation, building itself */}
        <div className="relative isolate overflow-hidden bg-[#0b0b0c] text-white">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.42),transparent_55%),linear-gradient(180deg,#141210,#0b0b0c)]" />
          <span aria-hidden className="if-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          {[['14%', '18%', 0], ['82%', '12%', 1.4], ['72%', '70%', 2.6], ['24%', '86%', 1.9]].map(([l, t, d], k) => (
            <span key={k} aria-hidden className="if-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
          ))}
          <div className="flex h-full flex-col px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-7">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><Mail className="h-3.5 w-3.5" /> {editing ? 'Edit invite' : 'New invite'}</p>
              <button type="button" onClick={close} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"><X className="h-4 w-4" /></button>
            </div>
            {/* phone: step dots + title; computer: the live card + the step list */}
            <div className="mt-3 sm:hidden">
              <div className="flex gap-1.5">{STEPS.slice(0, 7).map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'w-7 bg-[#e8c97a]' : 'w-3.5 bg-white/25'}`} />)}</div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.26em] text-white/55">{done ? 'Done' : `Step ${step + 1} of ${STEPS.length - 1}`}</p>
              <h3 className="font-serif text-[22px] font-black leading-tight">{STEP_TITLES[step]}</h3>
            </div>
            <div className="mt-6 hidden justify-center sm:flex">
              <motion.div layout className="w-[200px]" initial={{ rotate: -2, y: 8, opacity: 0 }} animate={{ rotate: -2, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }}>
                <InviteCard data={card} width={200} />
              </motion.div>
            </div>
            <ol className="mt-6 hidden space-y-2 sm:block">
              {STEPS.slice(0, 7).map((label, i) => {
                const past = i < step || done
                return (
                  <li key={label} className={`flex items-center gap-3 text-[13px] font-bold transition-colors duration-300 ${i === step ? 'text-white' : past ? 'text-white/70' : 'text-white/35'}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black transition-all duration-300 ${past ? 'bg-[#e8c97a] text-[#111827]' : i === step ? 'bg-white text-[#111827] shadow-[0_0_0_4px_rgba(232,201,122,.25)]' : 'bg-white/10'}`}>
                      {past ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                    </span>
                    {label}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        {/* ---- right: the step */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="hidden items-center justify-between gap-3 px-8 pb-1 pt-7 sm:flex">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#a8843a] dark:text-[#e8c97a]">{done ? 'All set' : `Step ${step + 1} of ${STEPS.length - 1}`}</p>
              <h3 className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{STEP_TITLES[step]}</h3>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step} custom={dir}
                initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } }} exit={{ opacity: 0, x: dir * -28, transition: { duration: 0.16 } }}
                className="px-5 pb-6 pt-4 sm:px-8">
                {step === 0 && <TypeStep presets={presets.presets} value={draft.invite_type} audience={draft.audience || 'clients'} onPick={t => { pickType(t); if (t !== 'custom') go(1) }} onAudience={a => set({ audience: a })} />}
                {step === 1 && <EventStep draft={draft} set={set} onTitle={v => { setTouched(x => ({ ...x, title: true })); set({ title: v }) }} onMessage={v => { setTouched(x => ({ ...x, message: true })); set({ message: v }) }} pickProperty={pickProperty} />}
                {step === 2 && <DayStep type={draft.invite_type} days={days} scheduled={scheduled} onChange={setDays} />}
                {step === 3 && <TimeStep type={draft.invite_type} days={days} onChange={setDays} />}
                {step === 4 && <PlaceStep draft={draft} set={set} onAddress={v => {
                  setTouched(x => ({ ...x, address: true }))
                  setDraft(d => {
                    const before = titleFor(d.invite_type, d.linked_property, presetOf(d.invite_type), d.address)
                    const auto = !touched.title || !d.title.trim() || d.title.trim() === before || d.title.trim() === presetOf(d.invite_type).title
                    return { ...d, address: v, title: auto ? titleFor(d.invite_type, d.linked_property, presetOf(d.invite_type), v) : d.title }
                  })
                }} />}
                {step === 5 && <LookStep draft={draft} set={set} card={card} brandAccent={brandAccent} isPhone={isPhone} hostName={card.hostName || null}
                  autoTitle={titleFor(draft.invite_type, draft.linked_property, presetOf(draft.invite_type), draft.address)} onTitleTouched={t => setTouched(x => ({ ...x, title: t }))} />}
                {step === 6 && <InviteQuestionsEditor type={draft.invite_type} value={draft.questions} onChange={q => set({ questions: q })} />}
                {step === 7 && saved && <ShareStep inv={saved} card={card} />}
                {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 dark:bg-red-500/10">{error}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Phones: the flow bar (components/ui/FlowDock) in place of the footer below - the same
              go / save / close handlers; on the Share screen, Edit sits beside where Back would be. */}
          <FlowDock inline step={Math.min(step + 1, STEPS.length - 1)} total={STEPS.length - 1}
            note={done ? 'All set' : undefined}
            onBack={step > 0 && !done ? () => go(step - 1) : undefined} backDisabled={busy}
            extra={done ? { label: 'Edit', icon: <Pencil />, onClick: () => go(5) } : undefined}
            onContinue={() => (done ? onClose() : step === 6 ? save() : go(step + 1))}
            disabled={!ok[step] || busy} busy={busy}
            continueLabel={done ? 'Done' : step === 6 ? (editing || saved ? 'Save' : 'Create') : step === 0 ? 'Continue' : 'Next'}
            icon={done ? <Check /> : step === 6 ? <Sparkles /> : undefined} />
          <div className="hidden items-center gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07] sm:flex sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {step > 0 && !done && (
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => go(step - 1)} disabled={busy}
                className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" /> Back
              </motion.button>
            )}
            {done && (
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => go(5)}
                className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" /> Edit
              </motion.button>
            )}
            <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} disabled={!ok[step] || busy} data-testid="invite-flow-next"
              onClick={() => (done ? onClose() : step === 6 ? save() : go(step + 1))}
              className="if-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] px-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {done ? 'Done' : step === 6 ? (editing || saved ? 'Save changes' : 'Create my invite') : step === 0 ? 'Continue' : 'Next'}
              {step === 6 && !busy ? <Sparkles className="h-4 w-4" /> : null}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ step 1: the kind of invite

function TypeStep({ presets, value, audience, onPick, onAudience }: { presets: InvitePreset[]; value: InviteType; audience: 'clients' | 'agents'; onPick: (t: InviteType) => void; onAudience: (a: 'clients' | 'agents') => void }) {
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {presets.map((p, i) => {
          const art = TYPE_ART[p.id]
          const on = value === p.id
          return (
            <motion.button key={p.id} type="button" onClick={() => onPick(p.id)} data-testid={`invite-type-${p.id}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 320, damping: 26 }} whileTap={{ scale: 0.97 }}
              className={`group relative flex min-h-[92px] items-center gap-4 overflow-hidden rounded-[22px] border p-4 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.08] shadow-[0_18px_36px_-26px_rgba(201,162,77,1)]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03]'}`}>
              <span className="if-bob relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${art.tint}, #111827)`, animationDelay: `${i * 0.4}s` }}>
                <art.icon className="h-6 w-6" />
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#e8c97a] text-[#111827]"><Mail className="h-3 w-3" /></span>
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-[18px] font-black text-[#111827] dark:text-white">{p.label}</span>
                <span className="block text-[12.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{p.blurb}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#a8843a] dark:text-[#e8c97a]"><Users className="h-3 w-3" /> {TYPE_META[p.id].who}</span>
              </span>
              {on && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {value === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Who are you inviting?</p>
            <div className="grid grid-cols-2 gap-2">
              {([['clients', 'Clients & the public', 'Their RSVPs go to your Leads'], ['agents', 'Other agents', 'Kept out of your Leads']] as const).map(([id, label, note]) => (
                <button key={id} type="button" onClick={() => onAudience(id)}
                  className={`rounded-2xl border p-3 text-left transition ${audience === id ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] dark:border-white/10 dark:text-white'}`}>
                  <span className="block text-[14px] font-black">{label}</span>
                  <span className={`block text-[11px] font-semibold ${audience === id ? 'opacity-70' : 'text-gray-400'}`}>{note}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ------------------------------------------------------------------ step 2: the event

function EventStep({ draft, set, onTitle, onMessage, pickProperty }: {
  draft: InviteDraft; set: (p: Partial<InviteDraft>) => void; onTitle: (v: string) => void; onMessage: (v: string) => void; pickProperty: (lp: InviteProperty | null) => void
}) {
  const { user } = useAuth()
  const [homes, setHomes] = useState<Listing[] | null>(null)
  useEffect(() => {
    let live = true
    // Their MLS listings (MLS plans) and the homes they've typed in before (every plan).
    const mls: Promise<Listing[]> = hasMlsAccess(user?.plan_tier)
      ? api.openHouseManager.getMyListings().then(r => (r.success && r.data ? r.data.listings.map(l => ({
          listing_key: l.listing_key, address: l.address, city: l.city, state: l.state, zipcode: l.zipcode, price: l.price,
          beds: l.bedrooms, baths: l.bathrooms, sqft: l.living_area, image: l.image, photos: (l.photos || []).slice(0, 12), label: l.address,
        })) : []))
      : Promise.resolve([])
    const saved: Promise<Listing[]> = api.savedProperties.getAll().then(r => (r.success && r.data ? r.data.map(s => ({
      address: s.address, city: s.city, state: s.state, zipcode: s.zipcode, price: s.price, beds: s.beds, baths: s.baths, sqft: s.sqft,
      image: s.image_url, photos: s.image_url ? [s.image_url] : [], label: s.address,
    })) : []))
    Promise.all([mls, saved]).then(([a, b]) => {
      if (!live) return
      const seen = new Set(a.map(h => (h.address || '').toLowerCase()))
      setHomes([...a, ...b.filter(h => !seen.has((h.address || '').toLowerCase()))])
    })
    return () => { live = false }
  }, [user?.plan_tier])
  const picked = draft.linked_property?.address
  const field = 'w-full rounded-2xl border border-gray-200 bg-white px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white'
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Is it about one of your homes? <span className="font-bold normal-case tracking-normal">(optional)</span></p>
        <div className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8">
          <button type="button" onClick={() => pickProperty(null)}
            className={`flex h-[124px] w-[118px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border text-center text-[12px] font-black transition ${!picked ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-dashed border-gray-300 text-gray-500 dark:border-white/15'}`}>
            <Sparkles className="h-5 w-5" /> No home<span className="text-[10px] font-semibold opacity-70">something else</span>
          </button>
          {homes === null && Array.from({ length: 3 }).map((_, i) => <span key={i} className="h-[124px] w-[150px] shrink-0 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />)}
          {homes?.map(h => {
            const on = picked === h.address
            return (
              <motion.button key={(h.listing_key || '') + h.address} type="button" whileTap={{ scale: 0.96 }} onClick={() => pickProperty(h)} data-testid="invite-home"
                className={`relative h-[124px] w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl text-left transition ${on ? 'ring-[3px] ring-[#C9A24D]' : 'ring-1 ring-gray-200 dark:ring-white/10'}`}>
                {h.image ? <img src={resolveMediaUrl(h.image)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#111827] to-[#2a2218]"><Home className="h-6 w-6 text-[#e8c97a]" /></span>}
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[11.5px] font-black leading-tight text-white">{street(h.address)}</span>
                {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
              </motion.button>
            )
          })}
        </div>
        {homes && homes.length === 0 && <p className="text-[12px] font-semibold text-gray-400">No listings yet - you can type the address on the Place step.</p>}
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Event name</span>
        <input value={draft.title} onChange={e => onTitle(e.target.value)} maxLength={140} className={`${field} h-14 font-serif text-[18px] font-black`} data-testid="invite-title" />
        <span className="mt-1.5 block text-[11px] font-semibold text-gray-400">Also the big title on the invitation - you can fine-tune both lines on the Look step.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">A note from you <span className="font-bold normal-case tracking-normal">(optional)</span></span>
        <textarea value={draft.message || ''} onChange={e => onMessage(e.target.value)} maxLength={2000} rows={4} className={`${field} resize-none py-3 text-[14px] leading-relaxed`} />
      </label>
    </div>
  )
}

// ------------------------------------------------------------------ step 5: the place

function PlaceStep({ draft, set, onAddress }: { draft: InviteDraft; set: (p: Partial<InviteDraft>) => void; onAddress: (v: string) => void }) {
  const field = 'h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[15px] font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white'
  const placeHint = draft.invite_type === 'client_event' ? 'e.g. Vetri Cucina, or "Our office"' : draft.linked_property ? 'e.g. "The Smith residence" (optional)' : 'e.g. The clubhouse (optional)'
  return (
    <div className="space-y-4">
      {draft.linked_property?.address && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#C9A24D]/10 p-3">
          {draft.linked_property.image && <img src={resolveMediaUrl(draft.linked_property.image)} alt="" className="h-12 w-12 rounded-xl object-cover" />}
          <p className="min-w-0 text-[13px] font-bold text-[#5c4a22] dark:text-[#e8c97a]">Filled in from {street(draft.linked_property.address)} - change it if it&apos;s somewhere else.</p>
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Address</span>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24D]" />
          <input value={draft.address || ''} onChange={e => onAddress(e.target.value)} maxLength={300} placeholder="Street, town, state" autoComplete="street-address" className={`${field} pl-11`} data-testid="invite-address" />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Name of the place <span className="font-bold normal-case tracking-normal">(optional)</span></span>
        <input value={draft.place_name || ''} onChange={e => set({ place_name: e.target.value })} maxLength={140} placeholder={placeHint} className={field} />
      </label>
      <p className="text-[12px] font-semibold text-gray-400">Guests get a &ldquo;Get directions&rdquo; button that opens their maps app.</p>
    </div>
  )
}

// ------------------------------------------------------------------ step 6: the look

/** The colour row (user, 10/24): the same colours as the Brand Kit / Agent Hub - "Brand" first (their
 *  Brand Kit's look), then the palette, then Luxe in its three metals (Luxe is IDX only, like
 *  everywhere else). */
function ColorPicker({ draft, set, brandAccent }: { draft: InviteDraft; set: (p: Partial<InviteDraft>) => void; brandAccent: string }) {
  const { user } = useAuth()
  const { look } = useBrandKit()
  const luxeOk = luxeAllowedFor(user)
  const brand: { accent: string; metal: InviteMetal | null } = look?.theme === 'luxe' && luxeOk ? { accent: LUXE_METALS[look.metal].base, metal: look.metal } : { accent: brandAccent, metal: null }
  const isBrand = (draft.luxe_metal || null) === brand.metal && (brand.metal ? true : (draft.accent_color || '').toLowerCase() === brand.accent.toLowerCase())
  const pickColor = (c: string) => set({ accent_color: c, luxe_metal: null })
  const pickMetal = (m: InviteMetal) => set({ accent_color: LUXE_METALS[m].base, luxe_metal: m })
  const swatch = 'relative grid h-11 w-11 place-items-center rounded-full transition'
  const ring = 'ring-2 ring-offset-2 ring-[#111827] dark:ring-white dark:ring-offset-[#111113]'
  return (
    <div className="space-y-4" data-testid="invite-colors">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        {/* Brand - its label sits UNDER the swatch in its own column (it used to sit on top of the next swatch on phones) */}
        <button type="button" onClick={() => (brand.metal ? pickMetal(brand.metal) : pickColor(brand.accent))} className="flex w-14 flex-col items-center gap-1" data-testid="invite-color-brand" aria-label="Your Brand Kit color">
          <span className={`${swatch} ${isBrand ? ring : ''}`} style={{ background: brand.metal ? `conic-gradient(${LUXE_METALS[brand.metal].deep}, ${LUXE_METALS[brand.metal].light}, ${LUXE_METALS[brand.metal].pale}, ${LUXE_METALS[brand.metal].base}, ${LUXE_METALS[brand.metal].deep})` : brand.accent }}>
            {isBrand && <Check className="h-4 w-4 text-white mix-blend-difference" strokeWidth={3} />}
          </span>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-[#8b6d2c] dark:text-[#e8c97a]">Brand</span>
        </button>
        <span aria-hidden className="mt-1 h-9 w-px self-start bg-gray-200 dark:bg-white/10" />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2.5">
          {BRAND_COLOR_GROUPS.flat().map(c => {
            const on = !draft.luxe_metal && !isBrand && (draft.accent_color || '').toLowerCase() === c.color.toLowerCase()
            return (
              <button key={c.color} type="button" onClick={() => pickColor(c.color)} aria-label={c.label} title={c.label} className={`${swatch} ${on ? ring : ''}`} style={{ background: c.color }}>
                {on && <Check className="h-4 w-4 text-white mix-blend-difference" strokeWidth={3} />}
              </button>
            )
          })}
          <label className={`${swatch} cursor-pointer border-2 border-dashed border-gray-300 text-gray-400 dark:border-white/20`} aria-label="Pick any color" title="Any color">
            <span className="text-lg font-black">+</span>
            <input type="color" value={draft.accent_color || brandAccent} onChange={e => pickColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
      </div>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Luxe {!luxeOk && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] tracking-wider text-gray-500 dark:bg-white/10 dark:text-gray-300"><Lock className="h-2.5 w-2.5" /> IDX plan</span>}</p>
        <div className="grid grid-cols-3 gap-2">
          {LUXE_METAL_ORDER.map(id => {
            const mt = LUXE_METALS[id]
            const on = draft.luxe_metal === id && !isBrand
            return (
              <motion.button key={id} type="button" whileTap={luxeOk ? { scale: 0.96 } : undefined} disabled={!luxeOk} onClick={() => pickMetal(id)} data-testid={`invite-metal-${id}`}
                className={`relative h-14 overflow-hidden rounded-2xl text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'ring-2 ring-offset-2 ring-[#111827] dark:ring-white dark:ring-offset-[#111113]' : ''}`}
                style={{ background: `linear-gradient(120deg, #0d0d0f 0%, #17171a 100%)`, boxShadow: `inset 0 0 0 1px rgba(${mt.rgb},.5)` }}>
                <span aria-hidden className="absolute inset-0 opacity-90" style={{ background: `linear-gradient(115deg, transparent 15%, rgba(${mt.lightRgb},.35) 45%, transparent 75%)` }} />
                <span className="relative flex h-full items-center gap-2 px-3">
                  <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: `conic-gradient(${mt.deep}, ${mt.light}, ${mt.pale}, ${mt.base}, ${mt.deep})` }} />
                  <span className="text-[13px] font-black" style={{ backgroundImage: `linear-gradient(115deg, ${mt.light}, ${mt.pale}, ${mt.base})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{mt.label}</span>
                </span>
                {on && <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-white text-[#111827]"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The cover photo, framed by dragging it up / down (and sideways) - like the Sign-In Sheet's. */
/** Drag the cover photo up or down inside the chosen design's own frame (owner, 10/24 round 7) - the
 *  Classic arch, Garden's rounded frame, Midnight's and Modern's full-width photo - so the agent
 *  centres the house exactly as guests will see it. Vertical only; touch and mouse; the page never
 *  scrolls while dragging (touch-action: none). Saved as cover_position.y (0-100, object-position). */
function CoverFramer({ src, pos, frame, onChange }: {
  src: string; pos: { x: number; y: number }; frame: { w: number; h: number; radius: string; fade?: boolean }
  onChange: (p: { x: number; y: number } | null) => void
}) {
  const drag = useRef<{ py: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const scale = Math.min(300 / frame.w, 230 / frame.h)
  const W = Math.round(frame.w * scale), H = Math.round(frame.h * scale)
  // how far the photo hangs past the frame (object-fit: cover) - that's the room it can move
  const spare = nat ? Math.max(0, nat.h * Math.max(W / nat.w, H / nat.h) - H) : 0
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))
  const radius = frame.radius.split(' ').map(r => `${Math.round(parseFloat(r) * scale)}px`).join(' ')
  const moved = Math.abs(pos.y - 50) > 0.5
  const set = (y: number) => onChange({ x: pos.x ?? 50, y: clamp(y) })
  return (
    <div className="flex flex-col items-center">
      <div className={`relative touch-none select-none overflow-hidden ring-1 ring-black/10 outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24D] dark:ring-white/15 ${spare ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{ width: W, height: H, borderRadius: radius, touchAction: 'none' }} data-testid="invite-cover-framer"
        role="slider" tabIndex={0} aria-label="Photo position - drag up or down" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos.y)}
        onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); set(pos.y + 5) } else if (e.key === 'ArrowDown') { e.preventDefault(); set(pos.y - 5) } }}
        onPointerDown={e => { if (!spare) return; drag.current = { py: e.clientY, y: pos.y }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true) }}
        onPointerMove={e => { const d = drag.current; if (!d || !spare) return; set(d.y - ((e.clientY - d.py) / spare) * 100) }}
        onPointerUp={() => { drag.current = null; setDragging(false) }} onPointerCancel={() => { drag.current = null; setDragging(false) }}>
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" style={{ objectPosition: `${pos.x ?? 50}% ${pos.y}%` }}
          onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {frame.fade && <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,13,18,0) 45%, rgba(14,17,24,.55) 85%, rgba(14,17,24,.8) 100%)' }} />}
        {spare > 0 && (
          <span className={`pointer-events-none absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-opacity ${dragging ? 'opacity-0' : 'opacity-100'}`}>
            <Move className="h-3 w-3" /> Drag to adjust
          </span>
        )}
      </div>
      <div className="mt-2 flex min-h-[28px] items-center gap-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
        {nat && !spare
          ? <span>This photo already shows top to bottom in this design - nothing to move.</span>
          : <span>Shown in this design&apos;s frame - drag the photo up or down.</span>}
        {moved && (
          <button type="button" onClick={() => onChange(null)} data-testid="invite-cover-reset"
            className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/15 dark:text-white">Reset</button>
        )}
      </div>
    </div>
  )
}

/** The flyer's two lines (owner, 10/24 round 8): Line 1 = the big title, Line 2 = the line under it.
 *  Pre-filled with what the card shows today (the address, then the town); whatever the agent types
 *  shows exactly as typed - on the card, the guest page, the print, the list, the link preview and
 *  the emails. "Reset to the address" puts both back to automatic. An empty Line 2 hides it. */
const LINE_MAX = 60
function FlyerLines({ draft, set, autoTitle, onTitleTouched }: {
  draft: InviteDraft; set: (p: Partial<InviteDraft>) => void; autoTitle: string; onTitleTouched: (t: boolean) => void
}) {
  // The automatic title shows as just the street; anything the agent types shows as typed - NOT
  // trimmed (round 8 full-flow test: trimming ate every space as you typed - "SundaySips&Showing").
  const ct = cardTitle(draft.title, draft.invite_type)
  const line1 = ct.isAddress ? ct.text : draft.title
  const autoLine1 = cardTitle(autoTitle, draft.invite_type).text
  const auto2 = autoLineTwo(draft)
  const line2 = draft.subtitle ?? auto2
  const isAuto = draft.title.trim() === autoTitle.trim() && (draft.subtitle === null || draft.subtitle === undefined)
  const home = draft.invite_type === 'open_house' || draft.invite_type === 'brokers_open'
  const onLine1 = (v: string) => {
    // typing the automatic words back keeps it automatic (so it follows the home if it changes)
    if (v.trim() && v.trim() === autoLine1.trim()) { set({ title: autoTitle }); onTitleTouched(false); return }
    set({ title: v }); onTitleTouched(true)
  }
  // whatever the agent types is theirs - kept exactly (even if it matches the pre-filled address), so
  // the link preview copies it too; "Reset" puts it back to automatic
  const onLine2 = (v: string) => set({ subtitle: v })
  const box = 'w-full rounded-2xl border border-gray-200 bg-white px-4 text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-white/5 dark:text-white'
  return (
    <div data-testid="invite-lines">
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Words on the invitation</p>
        {!isAuto && (
          <button type="button" onClick={() => { set({ title: autoTitle, subtitle: null }); onTitleTouched(false) }} data-testid="invite-lines-reset"
            className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/15 dark:text-white">
            {home ? 'Reset to the address' : 'Reset'}
          </button>
        )}
      </div>
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400"><span>Line 1 <span className="font-semibold text-gray-400">- the big title</span></span><span className="tabular-nums text-gray-400">{line1.length}/{LINE_MAX}</span></span>
        <input value={line1} onChange={e => onLine1(e.target.value.slice(0, LINE_MAX))} maxLength={LINE_MAX} placeholder={autoLine1 || 'Your event'}
          className={`${box} h-12 font-serif text-[17px] font-black`} data-testid="invite-line1" />
      </label>
      <label className="mt-2.5 block">
        <span className="mb-1 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400"><span>Line 2 <span className="font-semibold text-gray-400">- under the title</span></span><span className="tabular-nums text-gray-400">{line2.length}/{LINE_MAX}</span></span>
        <input value={line2} onChange={e => onLine2(e.target.value.slice(0, LINE_MAX))} maxLength={LINE_MAX} placeholder="Leave empty for no second line"
          className={`${box} h-11 text-[14px] font-semibold`} data-testid="invite-line2" />
      </label>
      <p className="mt-1.5 text-[11px] font-semibold text-gray-400">
        {isAuto ? 'Showing the address - type anything to change it. The preview updates as you type.' : 'Your words show exactly as typed - on the invite, the link preview and the emails.'}
      </p>
    </div>
  )
}

function LookStep({ draft, set, card, brandAccent, isPhone, hostName, autoTitle, onTitleTouched }: { draft: InviteDraft; set: (p: Partial<InviteDraft>) => void; card: InviteCardData; brandAccent: string; isPhone: boolean; hostName: string | null; autoTitle: string; onTitleTouched: (t: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [picker, setPicker] = useState(false)
  const photos = useMemo(() => {
    const lp = draft.linked_property
    return [lp?.image, ...(lp?.photos || [])].filter((p, i, a): p is string => !!p && a.indexOf(p) === i).slice(0, 12)
  }, [draft.linked_property])
  const current = draft.cover_image_url || (draft.linked_property && !draft.linked_property.no_cover ? (photos[0] || '') : '')
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true); setErr('')
    const r = await api.studio.uploadMedia(file)
    setUploading(false)
    if (r.success && r.data) { set({ cover_image_url: r.data.url, cover_position: null, linked_property: draft.linked_property ? { ...draft.linked_property, no_cover: false } : null }); setPicker(false) }
    else setErr(r.error || 'That photo could not be uploaded - try a JPG under 10 MB.')
  }
  const pickPhoto = (p: string | null) => {
    if (p) set({ cover_image_url: p, cover_position: null, linked_property: draft.linked_property ? { ...draft.linked_property, no_cover: false } : null })
    else set({ cover_image_url: null, cover_position: null, linked_property: draft.linked_property ? { ...draft.linked_property, no_cover: true } : null })
    setPicker(false)
  }
  const tiles = [...(draft.cover_image_url && !photos.includes(draft.cover_image_url) ? [draft.cover_image_url] : []), ...photos]
  return (
    <div className="space-y-6">
      {isPhone && (
        <div className="flex justify-center">
          <motion.div key={draft.design + draft.accent_color} initial={{ scale: 0.96, rotate: -1.5, opacity: 0.6 }} animate={{ scale: 1, rotate: -1.5, opacity: 1 }} className="w-[230px]">
            <InviteCard data={card} width={230} />
          </motion.div>
        </div>
      )}
      <FlyerLines draft={draft} set={set} autoTitle={autoTitle} onTitleTouched={onTitleTouched} />
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Design</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {DESIGNS.map(d => {
            const on = draft.design === d.id
            return (
              <motion.button key={d.id} type="button" whileTap={{ scale: 0.96 }} onClick={() => set({ design: d.id })} data-testid={`invite-design-${d.id}`}
                className={`rounded-2xl p-2 text-left transition ${on ? 'bg-[#C9A24D]/12 ring-2 ring-[#C9A24D]' : 'ring-1 ring-gray-200 hover:ring-[#C9A24D]/60 dark:ring-white/10'}`}>
                <div className="pointer-events-none mx-auto w-full max-w-[120px]"><InviteCard data={{ ...card, design: d.id }} shine={false} /></div>
                <p className="mt-2 text-[13px] font-black text-[#111827] dark:text-white">{d.label}</p>
                <p className="text-[10.5px] font-semibold leading-snug text-gray-400">{d.note}</p>
              </motion.button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Color</p>
        <ColorPicker draft={draft} set={set} brandAccent={brandAccent} />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Animation</p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="grid grid-cols-2 gap-2.5">
            {MOTIONS.map(mo => {
              const on = (draft.motion || 'normal') === mo.id
              const lux = mo.id === 'luxe'
              return (
                <motion.button key={mo.id} type="button" whileTap={{ scale: 0.96 }} onClick={() => set({ motion: mo.id })} data-testid={`invite-motion-${mo.id}`}
                  className={`relative overflow-hidden rounded-2xl p-3 text-left transition ${on ? 'ring-2 ring-[#C9A24D]' : 'ring-1 ring-gray-200 hover:ring-[#C9A24D]/60 dark:ring-white/10'} ${lux ? 'bg-[#0b0b0d] text-white' : 'bg-white dark:bg-white/[0.03]'}`}>
                  {lux && <span aria-hidden className="if-luxe-sheen pointer-events-none absolute inset-0" />}
                  <span className="relative flex items-center gap-2">
                    {lux ? <Sparkles className="h-4 w-4 text-[#e8c97a]" /> : <Mail className="h-4 w-4 text-[#C9A24D]" />}
                    <span className={`text-[14px] font-black ${lux ? 'if-luxe-text' : 'text-[#111827] dark:text-white'}`}>{mo.label}</span>
                    {on && <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                  </span>
                  <span className={`relative mt-1 block text-[11px] font-semibold leading-snug ${lux ? 'text-white/60' : 'text-gray-400'}`}>{mo.note}</span>
                </motion.button>
              )
            })}
          </div>
          <div className="flex justify-center"><InviteMotionPreview data={card} hostName={hostName} width={isPhone ? 168 : 176} /></div>
        </div>
      </div>
      <div className="pt-1">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Cover photo</p>
        {current ? (
          <CoverFramer key={`${current}|${card.design}`} src={resolveMediaUrl(current)} pos={draft.cover_position || { x: 50, y: 50 }} frame={coverFrame(card)} onChange={p => set({ cover_position: p })} />
        ) : (
          <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-center text-[13px] font-semibold text-gray-500 dark:border-white/15">No photo - the card shows your initials instead.</p>
        )}
        <div className="mt-2.5 flex gap-2">
          <button type="button" onClick={() => setPicker(true)} data-testid="invite-cover-change"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-[12px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white">
            <ImagePlus className="h-4 w-4 text-[#C9A24D]" /> {current ? 'Change photo' : 'Pick a photo'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-[12px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-white/15 dark:text-gray-300">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
        </div>
        {err && <p className="mt-2 text-xs font-bold text-red-500">{err}</p>}
      </div>
      <CoverPicker open={picker} onClose={() => setPicker(false)} tiles={tiles} current={current} onPick={pickPhoto} onUpload={() => fileRef.current?.click()} uploading={uploading} />
    </div>
  )
}

/** The cover photo choices in their own window that scrolls DOWN inside itself (user, 10/24 - not a
 *  sideways strip): a sheet on a phone (drag down to close), a centred window on a computer. */
function CoverPicker({ open, onClose, tiles, current, onPick, onUpload, uploading }: {
  open: boolean; onClose: () => void; tiles: string[]; current: string; onPick: (p: string | null) => void; onUpload: () => void; uploading: boolean
}) {
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const [mount, setMount] = useState<HTMLElement | null>(null)
  useEffect(() => { setMount(document.body) }, [])
  // Escape closes just this window, not the whole invite flow under it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!mount) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="cover-picker" {...backdropMotion} className={`fixed inset-0 z-[140] flex bg-black/60 ${phone ? 'items-end' : 'items-center justify-center p-6'}`}
          onClick={e => { if (e.target === e.currentTarget) onClose() }} data-testid="invite-cover-picker">
          <motion.div {...sheetMotion} drag={phone ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 90 || i.velocity.y > 600) onClose() }}
            className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#141416] ${phone ? 'max-h-[82dvh] rounded-t-[28px]' : 'max-h-[min(720px,calc(100dvh-3rem))] max-w-xl rounded-[28px]'}`}>
            {phone && <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300 dark:bg-white/20" />}
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a8843a] dark:text-[#e8c97a]">Cover photo</p>
                <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">Pick the photo on top</h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onPointerDownCapture={e => e.stopPropagation()}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <button type="button" onClick={onUpload} disabled={uploading} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D] dark:border-white/15">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Upload
                </button>
                <button type="button" onClick={() => onPick(null)} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition ${!current ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 text-gray-500 dark:border-white/10'}`}>
                  <ImagePlus className="h-5 w-5" /> No photo
                </button>
                {tiles.map((p, i) => {
                  const on = current === p
                  return (
                    <motion.button key={p} type="button" onClick={() => onPick(p)} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                      className={`relative aspect-square overflow-hidden rounded-2xl transition ${on ? 'ring-[3px] ring-[#C9A24D]' : 'ring-1 ring-gray-200 dark:ring-white/10'}`}>
                      <img src={resolveMediaUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {on && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                    </motion.button>
                  )
                })}
              </div>
              {tiles.length === 0 && <p className="mt-4 text-center text-[12.5px] font-semibold text-gray-400">Pick one of your homes on the Event step to choose from its photos - or upload your own.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    mount,
  )
}

// ------------------------------------------------------------------ step 8: share

export function ShareStep({ inv, card }: { inv: Invite; card?: InviteCardData }) {
  const [copied, setCopied] = useState(false)
  const [panel, setPanel] = useState<'email' | 'qr' | null>(null)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && !!navigator.share) }, [])
  const url = inv.share_url
  const text = `You're invited: ${inv.title}${inv.when_label ? ` - ${inv.when_label}` : ''}. RSVP here: ${url}`
  const tile = 'flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-[11.5px] font-black transition active:scale-[0.97]'
  return (
    <div className="space-y-4" data-testid="invite-share">
      {card && (
        <div className="flex items-center gap-4 rounded-[22px] bg-gradient-to-br from-[#C9A24D]/[0.12] to-transparent p-3">
          <motion.div initial={{ scale: 0.8, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="w-[92px] shrink-0">
            <InviteCard data={{ ...card, ...inv }} width={92} shine={false} />
          </motion.div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Live</p>
            <p className="truncate font-serif text-lg font-black text-[#111827] dark:text-white">{inv.title}</p>
            <p className="truncate text-[12px] font-semibold text-gray-500">{inv.when_label}</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-1.5 pl-4 dark:border-white/10 dark:bg-white/5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#111827] dark:text-white" data-testid="invite-share-url">{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" onClick={async () => { await copyText(url); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
          className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[11px] font-black uppercase tracking-wider transition ${copied ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {canShare && (
          <button type="button" onClick={() => navigator.share({ title: inv.title, text: `You're invited: ${inv.title}`, url }).catch(() => {})} className={`${tile} border-[#C9A24D] bg-[#C9A24D]/10 text-[#5c4a22] dark:text-[#e8c97a]`}>
            <Share2 className="h-5 w-5" /> Share
          </button>
        )}
        <a href={smsHref('', text)} className={`${tile} border-gray-200 text-[#111827] dark:border-white/10 dark:text-white`}><MessageSquare className="h-5 w-5 text-[#C9A24D]" /> Text</a>
        <button type="button" onClick={() => setPanel(p => (p === 'email' ? null : 'email'))} data-testid="invite-share-email"
          className={`${tile} ${panel === 'email' ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] dark:border-white/10 dark:text-white'}`}><Mail className="h-5 w-5 text-[#C9A24D]" /> Email a list</button>
        <button type="button" onClick={() => setPanel(p => (p === 'qr' ? null : 'qr'))}
          className={`${tile} ${panel === 'qr' ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] dark:border-white/10 dark:text-white'}`}><QrCode className="h-5 w-5 text-[#C9A24D]" /> QR code</button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${tile} border-gray-200 text-[#111827] dark:border-white/10 dark:text-white`}><ExternalLink className="h-5 w-5 text-[#C9A24D]" /> Open</a>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {panel === 'email' && <EmailList key="email" inv={inv} />}
        {panel === 'qr' && <QrPanel key="qr" url={url} code={inv.code} />}
      </AnimatePresence>
      {inv.share_url !== inv.platform_url && (
        <p className="text-[11.5px] font-semibold text-gray-400">This link is on your own website&apos;s domain. It also works at {inv.platform_url.replace(/^https?:\/\//, '')}.</p>
      )}
    </div>
  )
}

const EMAIL_RE = /[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']{2,}/g

function EmailList({ inv }: { inv: Invite }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: { email: string; reason: string }[] } | null>(null)
  const [err, setErr] = useState('')
  const emails = Array.from(new Set((text.match(EMAIL_RE) || []).map(e => e.toLowerCase())))
  const send = async () => {
    setBusy(true); setErr(''); setResult(null)
    const r = await invitesApi.send(inv.id, emails.slice(0, 100).map(email => ({ email })))
    setBusy(false)
    if (!r.success) { setErr(r.error); return }
    setResult(r.data)
    setText('')
  }
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-white/5">
        <p className="mb-2 text-[12px] font-semibold text-gray-500">Paste or type email addresses - any way you like (one per line, or separated by commas). Each person gets a short note from you with the link.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder={'jane@email.com\nbob@email.com'} data-testid="invite-email-list"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-[14px] font-semibold outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 text-[12px] font-bold text-gray-500">{emails.length ? `${emails.length} ${emails.length === 1 ? 'person' : 'people'}` : 'No addresses yet'}</p>
          <button type="button" onClick={send} disabled={!emails.length || busy} data-testid="invite-email-send"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#111827] px-4 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40 dark:bg-white dark:text-[#111827]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send invitations
          </button>
        </div>
        {err && <p className="mt-2 text-xs font-bold text-red-500">{err}</p>}
        {result && (
          <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" data-testid="invite-email-result">
            Sent to {result.sent} {result.sent === 1 ? 'person' : 'people'}.{result.skipped.length ? ` Skipped ${result.skipped.length}: ${result.skipped.slice(0, 3).map(s => `${s.email} (${s.reason})`).join(', ')}` : ''}
          </p>
        )}
      </div>
    </motion.div>
  )
}

/** One QR (in a white frame that reads in dark mode too) and ONE clear download button (user,
 *  10/24: there were two, one almost invisible on a phone) - plus the printable invite. */
function QrPanel({ url, code }: { url: string; code: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'' | 'saving' | 'saved'>('')
  const download = () => {
    const canvas = wrap.current?.querySelector('canvas')
    if (!canvas) return
    setState('saving')
    canvas.toBlob(async blob => {
      if (!blob) { setState(''); return }
      const { saveFile } = await import('@/lib/mobileShare')
      const r = await saveFile(blob, `invite-qr-${code}.png`)
      setState(r === 'cancelled' ? '' : 'saved')
      if (r !== 'cancelled') window.setTimeout(() => setState(''), 1600)
    })
  }
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" data-testid="invite-qr-panel">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div ref={wrap} className="rounded-2xl bg-white p-3 shadow-[0_12px_30px_-18px_rgba(0,0,0,.5)] ring-1 ring-black/5 [&_canvas]:h-[168px] [&_canvas]:w-[168px]">
          <FormQrCode url={url} size={168} bare />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-sm">
          <button type="button" onClick={download} data-testid="invite-qr-download"
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-black uppercase tracking-wider transition ${state === 'saved' ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
            {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'saved' ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />} {state === 'saved' ? 'Saved' : 'Save QR code'}
          </button>
          <a href={`/i/${code}/print`} target="_blank" rel="noopener noreferrer" data-testid="invite-print"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[11px] font-black uppercase tracking-wider text-[#111827] transition hover:border-[#C9A24D] dark:border-white/15 dark:bg-white/5 dark:text-white">
            <Printer className="h-4 w-4 text-[#C9A24D]" /> Print invite
          </a>
        </div>
        <p className="text-center text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Print it on a flyer or a sign - scanning it opens the invitation.</p>
      </div>
    </motion.div>
  )
}



const FLOW_CSS = `
.if-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);background-size:200% 100%;animation:ifEdge 6s ease-in-out infinite}
@keyframes ifEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.if-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:ifSpark 7s ease-in-out infinite}
@keyframes ifSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.if-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:ifShine 3.4s ease-in-out infinite}
@keyframes ifShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.if-bob{animation:ifBob 3.6s ease-in-out infinite}
@keyframes ifBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-3deg)}}
.if-luxe-sheen{background:linear-gradient(110deg,transparent 30%,rgba(232,201,122,.28) 50%,transparent 70%);background-size:250% 100%;animation:ifShine 3.6s ease-in-out infinite}
.if-luxe-text{background:linear-gradient(115deg,#8b6a2b,#e8c97a 30%,#fff3cf 48%,#C9A24D 66%,#8b6a2b);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ifFoil 3.2s ease-in-out infinite}
@keyframes ifFoil{0%{background-position:100% 0}100%{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.if-edge,.if-spark,.if-shine:after,.if-bob,.if-luxe-sheen,.if-luxe-text{animation:none}}
`
