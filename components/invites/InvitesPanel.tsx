'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, BellRing, Check, ChevronDown, CopyPlus, Eye, HelpCircle, Loader2, Lock, Mail, Pencil, Phone, Plus, Share2, Trash2, Unlock, Users, X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { CardAlive, GoldLastWord, TOOL_CARD_CSS, trackGlow } from '@/components/ui/LuxeSurface'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import {
  RSVP_WORD, TYPE_META, initialsOf, invitesApi, parseDay,
  type Invite, type InviteDetail, type InvitePresets, type InviteRsvp, type InviteType, type RsvpResponse,
} from '@/lib/invites'
import InviteCard, { type InviteCardData } from './InviteCard'
import InviteFlow, { ShareStep, TYPE_ART } from './InviteFlow'
import { announceInvitesChanged } from './FormsInvitesChrome'
import { cardTitle } from '@/lib/inviteTitle'

// Forms & Invites -> Invites: start a new invite (four kinds, each a living card like the Tools
// page's), your invites with their RSVP counts, and each invite's guest list / answers / share /
// edit / remind, in a window that's a sheet on a phone.

export default function InvitesPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const [presets, setPresets] = useState<InvitePresets | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [flow, setFlow] = useState<{ type?: InviteType | null; editing?: Invite | null } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await invitesApi.list()
    if (r.success) setInvites(r.data)
    else { setErr(r.error); setInvites([]) }
    announceInvitesChanged()  // the header's "New" chips / numbers / the Invites badge
  }, [])
  useEffect(() => {
    invitesApi.presets().then(r => { if (r.success) setPresets(r.data) })
    load()
  }, [load])
  // ?invite=<id> (the bell, a lead's "View RSVP", the header's "New" chips) opens that invite;
  // ?newInvite=1 opens a new one - once (it's taken out of the address so a tab switch doesn't reopen it).
  useEffect(() => {
    const id = params.get('invite')
    if (id) setOpenId(id)
    if (params.get('newInvite') === '1') {
      setFlow({ type: null })
      const q = new URLSearchParams(params.toString()); q.delete('newInvite')
      window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`)
    }
  }, [params])

  // The invite footer's agent - the Agent Hub profile (like the signature) once presets load (round 5).
  const ph = presets?.host
  const host = { name: ph?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' '), brokerage: ph?.brokerage || user?.brokerage || null,
    photo: ph?.photo_url || user?.photo_url || null, area: ph ? ph.market || null : user?.market || null }
  const closeDetail = () => {
    setOpenId(null)
    if (params.get('invite')) {
      const q = new URLSearchParams(params.toString()); q.delete('invite')
      router.replace(`/studio/forms?${q.toString()}`, { scroll: false })
    }
  }

  return (
    <div className="space-y-8" data-testid="invites-panel">
      <style>{TOOL_CARD_CSS + PANEL_CSS}</style>
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><Mail className="h-3 w-3" /> Make an invite</p>
            <h3 className="mt-1 font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Who are you inviting?</h3>
          </div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">A designed invitation, one link to share, and every RSVP lands here.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(presets?.presets || PLACEHOLDER).map((p, i) => (
            <TypeCard key={p.id} id={p.id as InviteType} label={p.label} blurb={p.blurb} index={i} disabled={!presets} onClick={() => setFlow({ type: p.id as InviteType })} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><Users className="h-3 w-3" /> Yours</p>
            <h3 className="mt-1 font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Your invites</h3>
          </div>
          {invites && invites.length > 0 && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tap one to see who&apos;s coming, share it again or make changes.</p>}
        </div>
        {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{err}</p>}
        {invites === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
        ) : invites.length === 0 ? (
          <div className="rounded-[26px] border-2 border-dashed border-[#C9A24D]/35 bg-gradient-to-b from-[#fffdf8] to-[#fbf6ec] px-6 py-10 text-center dark:border-white/15 dark:from-[#151517] dark:to-[#121214]">
            <div className="ip-float mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-lg"><Mail className="h-7 w-7" /></div>
            <p className="mt-4 font-serif text-xl font-black text-[#111827] dark:text-white">No invites yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">Pick a kind above - an open house, a broker&apos;s open or a dinner - and you&apos;ll have a beautiful invitation to send in a minute.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {invites.map((inv, i) => (
              <InviteRow key={inv.id} inv={inv} host={host} index={i} onOpen={() => setOpenId(inv.id)} />
            ))}
          </div>
        )}
      </section>

      {presets && (
        <InviteFlow open={!!flow} onClose={() => setFlow(null)} presets={presets} startType={flow?.type} editing={flow?.editing}
          onSaved={inv => { setInvites(list => [inv, ...(list || []).filter(x => x.id !== inv.id)]) }} />
      )}
      <InviteDetailSheet id={openId} host={host} onClose={closeDetail}
        onEdit={inv => { setOpenId(null); setFlow({ editing: inv }) }}
        onChanged={load} onOpenOther={id => setOpenId(id)} />
    </div>
  )
}

const PLACEHOLDER = [
  { id: 'open_house', label: 'Open House', blurb: 'Invite buyers, neighbors and clients to tour the home.' },
  { id: 'brokers_open', label: "Broker's Open", blurb: 'Invite agents to preview the listing before the public.' },
  { id: 'client_event', label: 'Client Event / Dinner', blurb: 'A dinner, a party or an appreciation night for your clients.' },
  { id: 'custom', label: 'Custom', blurb: 'Anything else - a market talk, a happy hour, a home-buying class.' },
]

// ------------------------------------------------------------------ the four "make one" cards

/** Round 4 (owner, 10/24): all four cards the same size - one-line labels, short "who" lines and
 *  descriptions of about the same length, with Create pinned to the bottom of every card. */
const CARD_WORDS: Record<InviteType, { who: string; label: string; blurb: string }> = {
  open_house: { who: 'Buyers & neighbors', label: 'Open House', blurb: 'Buyers and neighbors tour the home.' },
  brokers_open: { who: 'Other agents', label: "Broker's Open", blurb: 'Agents preview it before the public.' },
  client_event: { who: 'Your clients', label: 'Client Dinner', blurb: 'A dinner or thank-you night for clients.' },
  custom: { who: 'Anyone you like', label: 'Custom', blurb: 'A market talk, happy hour or class.' },
}

function TypeCard({ id, label, blurb, index, disabled, onClick }: { id: InviteType; label: string; blurb: string; index: number; disabled: boolean; onClick: () => void }) {
  const art = TYPE_ART[id]
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} onMouseMove={trackGlow} data-testid={`invite-new-${id}`}
      initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 * index }} whileTap={{ scale: 0.97 }}
      className="lx-hero group/lx group relative flex items-start gap-3 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] p-4 text-left shadow-[0_20px_44px_-32px_rgba(139,115,85,.6)] transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.75)] disabled:opacity-60 dark:border-white/[0.08] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)] sm:p-5">
      <div aria-hidden className="ohp-tool-grid pointer-events-none absolute inset-0" />
      <CardAlive seed={label.length * (index + 2)} />
      <art.icon aria-hidden className="lx-mark pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 text-[#C9A24D]/[0.10] dark:text-[#e8c97a]/[0.07]" />
      {/* Studio-card layout (user, 10/24): the words up top on the left, the envelope on the right -
          the description wraps in its own column instead of being pushed under / past the art. */}
      <div className="relative flex min-w-0 flex-1 flex-col self-stretch">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{CARD_WORDS[id]?.who || TYPE_META[id].who}</p>
        <h4 className="mt-0.5 truncate font-serif text-lg font-black leading-tight text-[#111827] dark:text-white"><GoldLastWord text={CARD_WORDS[id]?.label || label} /></h4>
        <p className="mb-3 mt-1 line-clamp-2 text-xs sm:min-h-[2.5rem] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{CARD_WORDS[id]?.blurb || blurb}</p>
        <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-[11px] font-black text-white transition group-hover:bg-black dark:bg-white dark:text-[#111827]">
          <Plus className="h-3.5 w-3.5" /> Create <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="relative h-[58px] w-[78px] shrink-0"><EnvelopeArt tint={art.tint} icon={<art.icon className="h-4 w-4" />} delay={index * 0.6} /></div>
    </motion.button>
  )
}

/** A little envelope whose card peeks out and back - the type's icon on the card. */
function EnvelopeArt({ tint, icon, delay }: { tint: string; icon: React.ReactNode; delay: number }) {
  return (
    <div aria-hidden className="absolute inset-0">
      <div className="absolute inset-x-0 bottom-0 h-[44px] rounded-md" style={{ background: `linear-gradient(160deg, ${tint}, #111827)` }} />
      <div className="ip-peek absolute left-1/2 top-0 grid h-[46px] w-[60px] -translate-x-1/2 place-items-center rounded-[5px] bg-[#fdfbf6] text-[#8b6d2c] shadow-sm ring-1 ring-black/5" style={{ animationDelay: `${delay}s` }}>
        {icon}
        <span className="absolute bottom-1.5 left-2 right-2 h-[2px] rounded bg-[#C9A24D]/50" />
      </div>
      <svg viewBox="0 0 78 44" className="absolute inset-x-0 bottom-0 h-[44px] w-full" preserveAspectRatio="none">
        <path d="M0 6 L39 30 L78 6 L78 40 Q78 44 74 44 L4 44 Q0 44 0 40 Z" fill={tint} />
        <path d="M0 44 L39 24 L78 44" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      </svg>
      <span className="ip-seal absolute bottom-[8px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#e8c97a] shadow" style={{ animationDelay: `${delay}s` }} />
    </div>
  )
}

// ------------------------------------------------------------------ an invite in the list

function InviteRow({ inv, host, index, onOpen }: { inv: Invite; host: { name: string; brokerage: string | null; photo: string | null; area?: string | null }; index: number; onOpen: () => void }) {
  const data: InviteCardData = { ...inv, hostName: host.name, hostBrokerage: host.brokerage, hostPhoto: host.photo, hostArea: host.area || null }
  const c = inv.counts
  const status = inv.is_past ? { label: 'Past', cls: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400' }
    : inv.status === 'closed' ? { label: 'RSVPs closed', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' }
    : { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
  return (
    <motion.button type="button" onClick={onOpen} onMouseMove={trackGlow} data-testid="invite-row"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * index, type: 'spring', stiffness: 260, damping: 24 }} whileTap={{ scale: 0.98 }}
      className="lx-hero group/lx group relative flex items-stretch gap-4 overflow-hidden rounded-3xl border border-[#C9A24D]/20 bg-gradient-to-br from-white to-[#fbf7ee] p-3.5 text-left shadow-[0_18px_40px_-32px_rgba(139,115,85,.9)] transition duration-300 hover:-translate-y-0.5 hover:border-[#C9A24D]/55 dark:border-white/[0.08] dark:from-[#17171a] dark:to-[#121214]">
      <div className="relative shrink-0 transition duration-300 group-hover:-rotate-2 group-hover:scale-[1.03]" style={{ width: 84 }}>
        <InviteCard data={data} width={84} shine={false} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${status.cls}`}>{status.label}</span>
          <span className="truncate text-[10px] font-black uppercase tracking-wider text-[#a8843a] dark:text-[#e8c97a]">{TYPE_META[inv.invite_type].short}</span>
        </div>
        <p className="mt-1 line-clamp-2 font-serif text-[16px] font-black leading-tight text-[#111827] dark:text-white">{cardTitle(inv.title, inv.invite_type).text}</p>
        {inv.subtitle ? <p className="truncate text-[12px] font-bold text-[#8b7355] dark:text-[#d7b974]">{inv.subtitle}</p> : null}
        <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">{inv.when_label || 'No date yet'}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <Chip tone="yes" n={c.guests_yes} label="coming" />
          {c.maybe > 0 && <Chip tone="maybe" n={c.maybe} label="maybe" />}
          {c.no > 0 && <Chip tone="no" n={c.no} label="can't" />}
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-gray-400"><Eye className="h-3 w-3" /> {inv.view_count}</span>
        </div>
      </div>
      {c.unseen > 0 && <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm">{c.unseen > 9 ? '9+' : c.unseen}</span>}
    </motion.button>
  )
}

function Chip({ tone, n, label }: { tone: RsvpResponse; n: number; label: string }) {
  const cls = tone === 'yes' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : tone === 'maybe' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black ${cls}`}>{n} {label}</span>
}

// ------------------------------------------------------------------ one invite: guests, answers, share

function InviteDetailSheet({ id, host, onClose, onEdit, onChanged, onOpenOther }: {
  id: string | null; host: { name: string; brokerage: string | null; photo: string | null; area?: string | null }
  onClose: () => void; onEdit: (inv: Invite) => void; onChanged: () => void; onOpenOther: (id: string) => void
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  useEffect(() => { setMount(document.body) }, [])
  const release = usePagePin(!!id)
  if (!mount) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {id && <DetailWindow key={id} id={id} host={host} onClose={onClose} onEdit={onEdit} onChanged={onChanged} onOpenOther={onOpenOther} />}
    </AnimatePresence>,
    mount,
  )
}

function DetailWindow({ id, host, onClose, onEdit, onChanged, onOpenOther }: Omit<Parameters<typeof InviteDetailSheet>[0], 'id'> & { id: string }) {
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  useEscapeToClose(onClose)
  const [inv, setInv] = useState<InviteDetail | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'guests' | 'answers' | 'share'>('guests')
  const [filter, setFilter] = useState<'all' | RsvpResponse>('all')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const reload = useCallback(async () => {
    const r = await invitesApi.get(id)
    if (r.success) setInv(r.data)
    else setErr(r.error)
  }, [id])
  useEffect(() => {
    reload().then(() => invitesApi.markSeen(id).then(onChanged))
  }, [reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (key: string, fn: () => Promise<{ success: boolean; error?: string; data?: any }>, after?: (d: any) => void) => {
    setBusy(key); setNote('')
    const r = await fn()
    setBusy('')
    if (!r.success) { setNote((r as any).error || 'Something went wrong.'); return }
    after?.((r as any).data)
    await reload()
    onChanged()
  }

  const data: InviteCardData | null = inv ? { ...inv, hostName: host.name, hostBrokerage: host.brokerage, hostPhoto: host.photo, hostArea: host.area || null } : null
  const rsvps = (inv?.rsvps || []).filter(r => filter === 'all' || r.response === filter)

  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={`fixed inset-0 z-[90] flex bg-[#0b0b0c]/60 ${phone ? 'items-end' : 'items-center justify-center p-6'}`} data-testid="invite-detail">
      <motion.div ref={sheetRef} {...sheetMotion} style={phone ? { y } : undefined}
        className={`relative flex w-full overflow-hidden bg-[#FAFAF7] shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#0d0d0f] ${phone ? 'h-[92dvh] flex-col rounded-t-[28px]' : 'h-[min(780px,calc(100dvh-3rem))] max-w-5xl flex-row rounded-[28px]'}`}>
        {phone && <span aria-hidden className="absolute left-1/2 top-2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-gray-300 dark:bg-white/20" />}
        {!inv ? (
          <div className="grid h-64 place-items-center">{err ? <p className="text-sm font-bold text-red-500">{err}</p> : <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" />}</div>
        ) : (
          <>
            {!phone && <DetailRail inv={inv} data={data!} />}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* header */}
            <div className={`relative flex gap-4 border-b border-black/[0.06] bg-white px-5 dark:border-white/[0.07] dark:bg-[#141416] ${phone ? 'pb-4 pt-7' : 'py-5'}`}>
              {phone && <div className="shrink-0" style={{ width: 74 }}><InviteCard data={data!} width={74} shine={false} /></div>}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a8843a] dark:text-[#e8c97a]">{TYPE_META[inv.invite_type].label}{inv.status === 'closed' ? ' · RSVPs closed' : inv.is_past ? ' · Past' : ''}</p>
                <h2 className="line-clamp-2 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{cardTitle(inv.title, inv.invite_type).text}</h2>
                {inv.subtitle ? <p className="truncate text-[13px] font-bold text-[#8b7355] dark:text-[#d7b974]">{inv.subtitle}</p> : null}
                <p className="truncate text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">{inv.when_label}</p>
                <a href={inv.share_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block max-w-full truncate text-[12px] font-bold text-[#8b6d2c] underline-offset-2 hover:underline dark:text-[#e8c97a]">{inv.share_url.replace(/^https?:\/\//, '')}</a>
              </div>
              <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300"><X className="h-4 w-4" /></motion.button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {/* the numbers */}
              <div className="grid grid-cols-4 gap-2">
                <Stat n={inv.counts.guests_yes} label="Coming" sub={`${inv.counts.yes} RSVP${inv.counts.yes === 1 ? '' : 's'}`} tone="yes" />
                <Stat n={inv.counts.guests_maybe} label="Maybe" sub={`${inv.counts.maybe} RSVP${inv.counts.maybe === 1 ? '' : 's'}`} tone="maybe" />
                <Stat n={inv.counts.no} label="Can't" sub="said no" tone="no" />
                <Stat n={inv.view_count} label="Opened" sub="times" tone="views" />
              </div>

              {/* actions - one even row on a phone: Share / Edit / Delete are icons only (user, 10/24),
                  every button the same colour; Remind (when it applies) gets its own line under it */}
              <div className={`mt-4 ${phone ? 'grid grid-cols-[44px_44px_auto_minmax(0,1fr)_44px] gap-1.5' : 'flex flex-wrap gap-2'}`} data-testid="invite-actions">
                <ActBtn icon={<Share2 className="h-4 w-4" />} label="Share" onClick={() => setTab('share')} iconOnly={phone} testId="invite-share-btn" />
                <ActBtn icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => onEdit(inv)} testId="invite-edit" iconOnly={phone} />
                <ActBtn icon={busy === 'dup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />} label="Duplicate" compact={phone}
                  onClick={() => act('dup', () => invitesApi.duplicate(inv.id), d => d?.id && onOpenOther(d.id))} />
                <ActBtn icon={busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : inv.status === 'live' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />} compact={phone}
                  label={inv.status === 'live' ? (phone ? 'Close' : 'Close RSVPs') : (phone ? 'Reopen' : 'Reopen RSVPs')} onClick={() => act('status', () => invitesApi.setStatus(inv.id, inv.status === 'live' ? 'closed' : 'live'))} testId="invite-close" />
                {!phone && inv.recipients.total > 0 && (
                  <ActBtn icon={busy === 'remind' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} label={`Remind ${inv.recipients.waiting}`} disabled={!inv.recipients.waiting || inv.status !== 'live'}
                    onClick={() => act('remind', () => invitesApi.resend(inv.id), d => setNote(d?.sent ? `Reminder sent to ${d.sent} ${d.sent === 1 ? 'person' : 'people'}.` : 'Everyone was emailed in the last 12 hours - try again later.'))} />
                )}
                <ActBtn icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={() => setConfirmDelete(true)} iconOnly={phone} />
              </div>
              {phone && inv.recipients.total > 0 && (
                <div className="mt-1.5 grid">
                  <ActBtn icon={busy === 'remind' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} label={`Remind the ${inv.recipients.waiting} who haven't answered`} disabled={!inv.recipients.waiting || inv.status !== 'live'} compact
                    onClick={() => act('remind', () => invitesApi.resend(inv.id), d => setNote(d?.sent ? `Reminder sent to ${d.sent} ${d.sent === 1 ? 'person' : 'people'}.` : 'Everyone was emailed in the last 12 hours - try again later.'))} />
                </div>
              )}
              {note && <p className="mt-2 rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-[12.5px] font-bold text-[#5c4a22] dark:text-[#e8c97a]">{note}</p>}
              <AnimatePresence>
                {confirmDelete && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                      <p className="text-[13px] font-bold text-red-700 dark:text-red-300">Delete this invite? The link stops working and its guest list goes. People who became Leads stay in Leads.</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 flex-1 rounded-xl bg-white text-[12px] font-black text-gray-600 dark:bg-white/10 dark:text-gray-200">Keep it</button>
                        <button type="button" onClick={() => act('del', () => invitesApi.remove(inv.id), () => onClose())} className="h-10 flex-1 rounded-xl bg-red-600 text-[12px] font-black text-white">
                          {busy === 'del' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* tabs */}
              <div className="mt-5 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                {([['guests', `Guests (${inv.rsvps.length})`], ['answers', 'Answers'], ['share', 'Share']] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setTab(k)}
                    className={`relative flex-1 rounded-xl py-2.5 text-[12px] font-black ${tab === k ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {tab === k && <motion.span layoutId="inv-detail-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} className="mt-4" style={{ minHeight: phone ? "52dvh" : 420 }}>
                  {tab === 'guests' && (
                    <div>
                      {/* one row of four - "Can't make it" used to wrap onto a line of its own */}
                      <div className="mb-3 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                        {(['all', 'yes', 'maybe', 'no'] as const).map(f => (
                          <button key={f} type="button" onClick={() => setFilter(f)} data-testid={`invite-filter-${f}`}
                            className={`h-9 min-w-0 whitespace-nowrap rounded-full px-2 text-[12px] font-black transition sm:px-3.5 ${filter === f ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300'}`}>
                            {f === 'all' ? 'Everyone' : f === 'no' ? <><span className="sm:hidden">Can&apos;t</span><span className="hidden sm:inline">{RSVP_WORD.no}</span></> : RSVP_WORD[f]}
                          </button>
                        ))}
                      </div>
                      {rsvps.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center dark:border-white/15">
                          <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{inv.rsvps.length ? 'No one here' : 'No RSVPs yet'}</p>
                          <p className="mt-1 text-sm text-gray-500">{inv.rsvps.length ? 'Try another filter.' : 'Share the link - answers show up here the moment they come in.'}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">{rsvps.map(r => <GuestRow key={r.id} r={r} audience={inv.audience} days={inv.dates} />)}</div>
                      )}
                    </div>
                  )}
                  {tab === 'answers' && <AnswersSummary inv={inv} />}
                  {tab === 'share' && <ShareStep inv={inv} />}
                </motion.div>
              </AnimatePresence>
            </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Computer: the invitation itself, lit, down the left of the window. */
function DetailRail({ inv, data }: { inv: InviteDetail; data: InviteCardData }) {
  return (
    <aside className="relative isolate flex w-[300px] shrink-0 flex-col overflow-hidden bg-[#0b0b0c] p-7 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.38),transparent_55%),linear-gradient(180deg,#141210,#0b0b0c)]" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">{TYPE_META[inv.invite_type].label}</p>
      <motion.div initial={{ rotate: -6, y: 16, opacity: 0 }} animate={{ rotate: -2, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }} className="mx-auto mt-5 w-[220px]">
        <InviteCard data={data} width={220} />
      </motion.div>
      <div className="mt-auto pt-6">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${inv.is_past ? 'bg-white/10 text-white/60' : inv.status === 'closed' ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
          {inv.is_past ? 'Past' : inv.status === 'closed' ? 'RSVPs closed' : 'Live'}
        </span>
        <a href={inv.share_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-white/20">
          <Eye className="h-4 w-4 text-[#e8c97a]" /> See it as a guest
        </a>
      </div>
    </aside>
  )
}

function Stat({ n, label, sub, tone }: { n: number; label: string; sub: string; tone: 'yes' | 'maybe' | 'no' | 'views' }) {
  const ring = tone === 'yes' ? 'from-emerald-500/15' : tone === 'maybe' ? 'from-amber-500/15' : tone === 'no' ? 'from-gray-400/15' : 'from-[#C9A24D]/15'
  const ink = tone === 'yes' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'maybe' ? 'text-amber-700 dark:text-amber-300' : tone === 'no' ? 'text-gray-500' : 'text-[#8b6d2c] dark:text-[#e8c97a]'
  return (
    <div className={`rounded-2xl bg-gradient-to-b ${ring} to-transparent p-2.5 text-center ring-1 ring-black/[0.04] dark:ring-white/[0.06]`}>
      <motion.p key={n} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`text-2xl font-black tabular-nums ${ink}`}>{n}</motion.p>
      <p className="text-[11px] font-black text-[#111827] dark:text-white">{label}</p>
      <p className="text-[10px] font-semibold text-gray-400">{sub}</p>
    </div>
  )
}

function ActBtn({ icon, label, onClick, danger, disabled, testId, iconOnly, compact }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean; testId?: string
  /** Phone: just the icon (the label is still read out). */
  iconOnly?: boolean
  /** Phone: a tighter button that fits its grid cell. */
  compact?: boolean
}) {
  // Every action wears the same quiet style (Share used to be solid - white in dark mode).
  const tone = danger ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/10'
    : 'border border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white'
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onClick} disabled={disabled} data-testid={testId} aria-label={label} title={iconOnly ? label : undefined}
      className={`inline-flex h-11 min-w-0 items-center justify-center rounded-xl font-black transition disabled:opacity-40 ${iconOnly ? 'w-11 px-0' : compact ? 'gap-1 px-2 text-[11px]' : 'shrink-0 gap-1.5 px-3.5 text-[12px]'} ${tone}`}>
      <span className="shrink-0">{icon}</span>{!iconOnly && <span className="truncate">{label}</span>}
    </motion.button>
  )
}

function GuestRow({ r, audience, days }: { r: InviteRsvp; audience: string; days?: { date: string }[] }) {
  const [open, setOpen] = useState(false)
  const tone = r.response === 'yes' ? 'bg-emerald-500 text-white' : r.response === 'maybe' ? 'bg-amber-400 text-[#111827]' : 'bg-gray-300 text-[#111827] dark:bg-white/20 dark:text-white'
  const Icon = r.response === 'yes' ? Check : r.response === 'maybe' ? HelpCircle : X
  const when = r.updated_at || r.created_at
  // Who they are to the agent (invites_service.lead_kind_of) + what they asked for.
  const gray = 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
  const gold = 'bg-[#C9A24D]/15 text-[#7a5f22] dark:text-[#e8c97a]'
  const req = (r.requests || {}) as Record<string, unknown>
  const tags = [
    r.lead_kind === 'lead' ? { label: 'New lead', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' } : null,
    r.lead_kind === 'agent' ? { label: 'Agent', cls: gray } : null,
    r.lead_kind === 'represented' ? { label: 'Has an agent', cls: gray } : null,
    r.response === 'no' && r.still_interested ? { label: 'Still interested', cls: gold } : null,
    r.keep_updated ? { label: 'Wants updates', cls: gold } : null,
    req.disclosure ? { label: 'Asked for disclosure', cls: gold } : null,
    req.second_tour ? { label: 'Asked for 2nd tour', cls: gold } : null,
    ...(days && days.length > 1 && r.days?.length ? r.days.map(d => ({ label: parseDay(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), cls: gray })) : []),
  ].filter(Boolean) as { label: string; cls: string }[]
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-[#141416] ${open ? 'border-[#C9A24D]/50' : 'border-gray-100 dark:border-white/[0.07]'}`} data-testid="invite-guest">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#111827] to-[#2a2218] text-[13px] font-black text-[#e8c97a]">
          {initialsOf(r.name)}
          <span className={`absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full ring-2 ring-white dark:ring-[#141416] ${tone}`}><Icon className="h-3 w-3" strokeWidth={3} /></span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-black text-[#111827] dark:text-white">{r.name || 'Guest'}</span>
            {!r.is_seen && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
          </span>
          <span className="block truncate text-[12px] font-semibold text-gray-500">
            {RSVP_WORD[r.response]}{r.response !== 'no' && r.guest_count > 1 ? ` · party of ${r.guest_count}` : ''}{when ? ` · ${new Date(when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
          </span>
          {tags.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {tags.map(t => <span key={t.label} className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${t.cls}`}>{t.label}</span>)}
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10"><ChevronDown className="h-4 w-4" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <div className="space-y-2 border-t border-gray-100 bg-[#FAFAF7] p-3 dark:border-white/[0.06] dark:bg-[#0f0f11]">
              {r.answers.length === 0 ? <p className="text-[12.5px] text-gray-400">No answers to your questions.</p> : r.answers.map(a => (
                <div key={a.questionId}>
                  <p className="text-[10.5px] font-black uppercase tracking-wider text-gray-400">{a.label}</p>
                  <p className="text-[13.5px] font-semibold text-[#111827] dark:text-white">{Array.isArray(a.value) ? a.value.join(', ') : a.value}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-black text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white"><Phone className="h-3.5 w-3.5 text-[#C9A24D]" /> {r.phone}</a>}
                {r.email && <a href={`mailto:${r.email}`} className="inline-flex h-10 max-w-full items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[12px] font-black text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white"><Mail className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> <span className="truncate">{r.email}</span></a>}
                {r.lead_id && <Link href={`/leads/${r.lead_id}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#111827] px-3 text-[12px] font-black text-white dark:bg-white dark:text-[#111827]">Open in Leads <ArrowRight className="h-3.5 w-3.5" /></Link>}
                {!r.lead_id && (audience === 'agents' || r.lead_kind === 'agent' || r.lead_kind === 'represented') && <span className="inline-flex h-10 items-center rounded-xl px-1 text-[11.5px] font-semibold text-gray-400">{r.lead_kind === 'represented' ? 'Has an agent' : 'Agent'} - not added to Leads, no follow-up</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AnswersSummary({ inv }: { inv: InviteDetail }) {
  const going = inv.rsvps.filter(r => r.response !== 'no')
  const blocks = useMemo(() => inv.questions.map(q => {
    const vals = going.flatMap(r => {
      const a = r.answers.find(x => x.questionId === q.id)
      return a ? (Array.isArray(a.value) ? a.value : [a.value]).map(v => ({ v: String(v), who: r.name || 'Guest' })) : []
    })
    return { q, vals }
  }), [inv, going])
  if (!going.length) return <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15">Answers from people who are coming (or might) show up here.</p>
  return (
    <div className="space-y-3">
      {blocks.map(({ q, vals }) => {
        const choice = q.type === 'select' || q.type === 'multi_select'
        const counts = choice ? (q.options || []).map(o => ({ o, n: vals.filter(v => v.v === o).length })) : []
        const max = Math.max(1, ...counts.map(c => c.n))
        return (
          <div key={q.id} className="rounded-2xl border border-gray-100 bg-white p-3.5 dark:border-white/[0.07] dark:bg-[#141416]">
            <p className="text-[13.5px] font-black text-[#111827] dark:text-white">{q.label}</p>
            {choice ? (
              <div className="mt-2 space-y-1.5">
                {counts.map(c => (
                  <div key={c.o} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-[12px] font-bold text-gray-600 dark:text-gray-300">{c.o}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <motion.span className="block h-full rounded-full bg-gradient-to-r from-[#e2c47a] to-[#C9A24D]" initial={{ width: 0 }} animate={{ width: `${(c.n / max) * 100}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22 }} />
                    </span>
                    <span className="w-6 text-right text-[12px] font-black tabular-nums text-[#111827] dark:text-white">{c.n}</span>
                  </div>
                ))}
              </div>
            ) : vals.length ? (
              <ul className="mt-2 space-y-1.5">{vals.map((v, i) => <li key={i} className="text-[13px] text-gray-600 dark:text-gray-300"><b className="text-[#111827] dark:text-white">{v.who}:</b> {v.v}</li>)}</ul>
            ) : <p className="mt-1 text-[12.5px] text-gray-400">No answers yet.</p>}
          </div>
        )
      })}
    </div>
  )
}

const PANEL_CSS = `
.ip-peek{animation:ipPeek 4.2s ease-in-out infinite}
@keyframes ipPeek{0%,100%{transform:translate(-50%,10px)}45%,60%{transform:translate(-50%,-4px) rotate(-3deg)}}
.ip-seal{animation:ipSeal 4.2s ease-in-out infinite}
@keyframes ipSeal{0%,100%{transform:translateX(-50%) scale(1)}45%,60%{transform:translateX(-50%) scale(.7);opacity:.6}}
.ip-float{animation:ipFloat 3.6s ease-in-out infinite}
@keyframes ipFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(2deg)}}
@media (prefers-reduced-motion:reduce){.ip-peek,.ip-seal,.ip-float{animation:none}}
`
