'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarCheck2, Clock, Compass, FileText, Globe, Home, Images, Map as MapIcon, MessageCircle, Navigation, RotateCcw, Sparkles, Star, Ticket, LayoutGrid, Eye, UserRound } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { useLastValue } from '@/components/ui/windowMotion'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import api from '@/lib/api-service'
import { Check, Copy as CopyIcon, Mail as MailIcon, Phone as PhoneIcon } from 'lucide-react'
import type { ContactLogEntry } from '@/types'
import { MAIL_CHOICE_LABEL, composeHref, mailChoices, openWithFallback, phoneAppLinks, saveMailChoice, savedMailChoice, type MailChoice } from '@/lib/mailCompose'
import { isPhoneDevice, smsHref } from '@/lib/smsLink'
import { copyText } from '@/lib/copyText'

export type VisitorRow = {
  id: string
  full_name: string
  lead_id?: string | null
  created_at: string
  has_agent?: string
  is_favorite?: boolean
  showcase_id?: string | null
  showcase_starred?: boolean
  pass_events?: number
  pass_actions?: number
  pass_new?: number
  pass_last_at?: string | null
  note_count?: number
}

/** Their Showcase in a new tab, right beside the switch, to change something quickly (owner, 11/07). */
export function OpenShowcaseLink({ id, compact = false }: { id: string; compact?: boolean }) {
  return (
    <a href={`/showcases?showcase=${id}`} target="_blank" rel="noopener" data-testid="visitor-open-showcase" aria-label="Open their Showcase in a new tab" title="Open their Showcase in a new tab"
      onClick={e => e.stopPropagation()}
      className={compact
        ? 'inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-white px-2.5 py-1 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] active:scale-95 dark:bg-white/5 dark:text-[#e8c97a]'
        : 'inline-flex shrink-0 items-center justify-center gap-1 self-stretch rounded-2xl border border-[#C9A24D]/40 bg-white px-3 text-[12px] font-black text-[#8b7355] transition hover:border-[#C9A24D] active:scale-[0.97] dark:bg-white/5 dark:text-[#e8c97a]'}>
      <span className={compact ? '' : 'max-[359px]:hidden'}>Open</span> <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  )
}

/** "Guest Activity" (owner, 11/07). Looks like the Notes button when they only landed on their pass,
 *  which every guest does. Dark with a number when they did something on it, and the number pulses a
 *  few times while the agent hasn't looked yet. */
export function GuestActivityButton({ visitor, onOpen, compact = false }: { visitor: VisitorRow; onOpen: () => void; compact?: boolean }) {
  const did = visitor.pass_actions || 0
  const fresh = (visitor.pass_new || 0) > 0
  const size = compact ? 'rounded-lg px-3 py-1.5 text-xs font-bold' : 'min-h-11 min-w-0 rounded-xl px-2 text-[11px] font-black uppercase tracking-wide'
  const plain = compact
    ? 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white'
    : 'border border-gray-200 bg-white text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white'
  const loud = 'bg-[#111827] text-white shadow-md shadow-black/15 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]'
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onOpen} data-testid="visitor-guest-activity" data-engaged={did > 0 ? 'yes' : 'no'}
      title={did > 0 ? 'See what they did on their Guest Pass' : 'They opened their Guest Pass and nothing more so far'}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition ${size} ${did > 0 ? loud : plain}`}>
      <Ticket className={`shrink-0 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${did > 0 ? 'text-[#e8c97a] dark:text-[#111827]' : 'text-[#C9A24D]'}`} />
      Guest Activity
      {did > 0 && (
        <span className="relative grid h-[18px] min-w-[18px] shrink-0 place-items-center">
          {fresh && <span aria-hidden className="absolute inset-0 rounded-full bg-[#e8c97a] motion-safe:animate-ping dark:bg-[#111827]" style={{ animationIterationCount: 4 }} />}
          <span data-testid="visitor-guest-activity-count" className="relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e8c97a] px-1 text-[10px] font-black tabular-nums tracking-normal text-[#111827] dark:bg-[#111827] dark:text-[#e8c97a]">{did}</span>
        </span>
      )}
    </motion.button>
  )
}

/** This visitor's own Showcase switch (user, 10/25) - starts as the kit's Showcases setting and
 *  beats it for just this guest. On: their Showcase + invite email go out about an hour later,
 *  like a normal sign-in. Off: a waiting invite is cancelled and their Showcase is turned off. */
export function VisitorShowcaseSwitch({ visitor, busy, onToggle, layout = 'row' }: {
  visitor: VisitorRow & { showcase_on?: boolean; showcase_invite_at?: string | null; showcase_invite_delay?: number | null }
  busy?: boolean
  onToggle: () => void
  layout?: 'row' | 'cell'
}) {
  const on = !!visitor.showcase_on
  const at = visitor.showcase_invite_at ? new Date(visitor.showcase_invite_at) : null
  const pending = at && at.getTime() > Date.now()
  // The wait is the agent's own Studio -> Email invite delay (10/25), never a fixed "an hour".
  const delay = visitor.showcase_invite_delay
  const wait = delay == null ? null : delay <= 0 ? 'right away' : delay < 60 ? `~${delay} min` : `~${Math.round(delay / 60 * 10) / 10} hr`
  const time = at ? at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  // One short line, always (it truncates as the last resort).
  const hint = on
    ? pending ? `Invite email goes out ${time}` : 'Showcase on'
    : wait == null ? 'Off - tap to turn on' : wait === 'right away' ? 'Off - tap to send now' : `Off - tap to send (${wait})`
  const title = on
    ? 'Showcase for this visitor is ON - switch off to cancel a waiting invite and turn their Showcase off.'
    : wait == null
      ? 'Showcase for this visitor - switch on to give them a Showcase. (Your Showcase invite email is switched off in Studio > Email, so no invite is sent.)'
      : `Showcase for this visitor - switch on and their Showcase invite goes out ${wait === 'right away' ? 'right away' : `in ${wait}`} (your Studio > Email setting), like a normal sign-in.`
  if (layout === 'cell') {
    return (
      <button type="button" role="switch" aria-checked={on} aria-label="Showcase for this visitor" title={title}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="mt-1.5 flex items-center gap-2 rounded-full text-left disabled:opacity-60">
        <OhpSwitch on={on} as="span" size="sm" busy={busy} />
        <span className="leading-tight">
          <span className={`block text-[11px] font-black ${on ? 'text-[#8b7355] dark:text-[#e8c97a]' : 'text-gray-400'}`}>Showcase</span>
          {pending && on && <span className="block whitespace-nowrap text-[10px] font-semibold text-gray-400">invite email {time}</span>}
        </span>
      </button>
    )
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Showcase for this visitor" title={title}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${on
        ? 'border-[#C9A24D]/45 bg-[#C9A24D]/[0.07] dark:bg-[#C9A24D]/10'
        : 'border-gray-100 bg-white dark:border-white/[0.07] dark:bg-white/[0.02]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${on ? 'bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}>
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black text-[#111827] dark:text-white">Showcase</span>
        <span className="block truncate whitespace-nowrap text-[11px] font-semibold text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
      <OhpSwitch on={on} as="span" size="md" busy={busy} />
    </button>
  )
}

/** The lead star next to a visitor (user, 10/24) - same gold star as a starred Showcase. */
export function VisitorStar({ on, onToggle, size = 'md' }: { on: boolean; onToggle: () => void; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-pressed={on}
      aria-label={on ? 'Unstar this lead' : 'Star this lead'}
      title={on ? 'Starred lead - tap to unstar' : 'Star this lead'}
      className={`grid ${box} shrink-0 place-items-center rounded-full transition-colors ${on
        ? 'bg-[#C9A24D]/15 text-[#C9A24D] ring-1 ring-[#C9A24D]/40'
        : 'text-gray-300 hover:bg-gray-100 hover:text-[#C9A24D] dark:text-gray-600 dark:hover:bg-white/10'}`}
    >
      <motion.span key={on ? 'on' : 'off'} initial={{ scale: on ? 0.4 : 1, rotate: on ? -40 : 0 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
        <Star className="h-4 w-4" fill={on ? 'currentColor' : 'none'} strokeWidth={2.2} />
      </motion.span>
    </motion.button>
  )
}

type PassActivity = Awaited<ReturnType<typeof api.openHouses.getVisitorPassActivity>>['data']

const EVENT_LOOK: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  similar: { icon: Home, tone: 'text-[#8b7355] bg-[#C9A24D]/15 dark:text-[#e8c97a]' },
  home_tour: { icon: CalendarCheck2, tone: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15' },
  home_question: { icon: MessageCircle, tone: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
  similar_list: { icon: LayoutGrid, tone: 'text-[#8b7355] bg-[#C9A24D]/15 dark:text-[#e8c97a]' },
  nearby: { icon: Compass, tone: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15' },
  directions: { icon: Navigation, tone: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15' },
  spotlight: { icon: Sparkles, tone: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15' },
  photos: { icon: Images, tone: 'text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15' },
  contact: { icon: Globe, tone: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
  cheat: { icon: FileText, tone: 'text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15' },
  showcase: { icon: Sparkles, tone: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15' },
  map: { icon: MapIcon, tone: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15' },
  request: { icon: CalendarCheck2, tone: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15' },
  question: { icon: MessageCircle, tone: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
}

const dur = (s: number) => s < 5 ? 'Under 5s' : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const localDay = (iso: string) => new Date(iso).toDateString()

/** Everything one guest did on their Guest Pass (user, 10/24): each visit with its day, time and
 *  length, and what they did in it, in the words the mailbox and their lead use too. Opening it marks
 *  it as seen. */
export function PassActivitySheet({ visitor, onClose, onSeen }: { visitor: VisitorRow | null; onClose: () => void; onSeen?: (id: string) => void }) {
  const v = useLastValue(visitor)
  const [data, setData] = useState<PassActivity | null>(null)
  const [loading, setLoading] = useState(false)
  const visitorId = visitor?.id
  useEffect(() => {
    if (!visitorId) return
    let live = true
    setLoading(true); setData(null)
    api.openHouses.getVisitorPassActivity(visitorId).then(r => {
      if (!live) return
      setData(r.success ? r.data ?? null : null)
      setLoading(false)
      if (r.success) api.openHouses.markVisitorPassSeen(visitorId).then(() => onSeen?.(visitorId))
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId])

  const signedDay = v ? localDay(v.created_at) : ''
  const otherDays = data ? Array.from(new Set(data.visits.map(x => localDay(x.started_at)))).filter(d => d !== signedDay) : []
  const homes = data ? new Set([...data.visits.flatMap(x => x.events), ...data.other].filter(e => e.kind === 'similar').map(e => e.key)).size : 0

  return (
    <OhSheet
      open={!!visitor}
      onClose={onClose}
      width="max-w-xl"
      title="Guest Activity"
      subtitle={v?.full_name}
      icon={<Ticket className="h-5 w-5" />}
    >
      {loading || !data ? (
        <div className="flex min-h-[200px] items-center justify-center">
          {loading ? <OhpSpinner size={28} label="Loading activity" /> : <p className="text-sm font-semibold text-gray-500">Couldn&apos;t load this right now.</p>}
        </div>
      ) : (
        <div>
          {/* The headline numbers */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: data.visit_count === 1 ? 'Visit' : 'Visits', value: String(data.visit_count), icon: Eye },
              { label: 'Time on it', value: data.visit_count ? dur(data.total_seconds) : '-', icon: Clock },
              { label: homes === 1 ? 'Home opened' : 'Homes opened', value: String(homes), icon: Home },
            ].map(t => (
              <div key={t.label} className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center dark:border-white/[0.07] dark:bg-[#141416]">
                <t.icon className="mx-auto h-4 w-4 text-[#C9A24D]" />
                <p className="mt-1 text-lg font-black tabular-nums text-[#111827] dark:text-white">{t.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t.label}</p>
              </div>
            ))}
          </div>
          {otherDays.length > 0 && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              Came back on {otherDays.length === 1 ? 'another day' : `${otherDays.length} other days`} after the open house
            </p>
          )}

          {data.visits.length === 0 && data.other.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/10"><Ticket className="h-5 w-5" /></span>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400">They haven&apos;t opened their Guest Pass yet.</p>
            </div>
          ) : (
            <ol className="mt-5 space-y-4">
              {data.visits.map((visit, i) => (
                <motion.li key={`${visit.session}-${visit.started_at}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="rounded-2xl border border-gray-100 bg-white p-3.5 dark:border-white/[0.07] dark:bg-[#141416]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#111827] dark:text-white">
                      {day(visit.started_at)} <span className="font-semibold text-gray-400">· {time(visit.started_at)}</span>
                    </p>
                    <span className="shrink-0 rounded-full bg-[#111827] px-2.5 py-1 text-[10px] font-black tabular-nums text-[#e8c97a] dark:bg-white/10">
                      <Clock className="-mt-px mr-1 inline h-3 w-3" />{dur(visit.seconds)}
                    </span>
                  </div>
                  {localDay(visit.started_at) !== signedDay && (
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Came back</p>
                  )}
                  {visit.events.length > 0 ? (
                    <ul className="mt-2.5 space-y-1.5 border-t border-gray-100 pt-2.5 dark:border-white/[0.06]">
                      {visit.events.map((e, j) => <EventLine key={j} e={e} />)}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-xs font-medium text-gray-400">Only opened their Guest Pass.</p>
                  )}
                </motion.li>
              ))}
              {data.other.length > 0 && (
                <li className="rounded-2xl border border-dashed border-gray-200 p-3.5 dark:border-white/10">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Also</p>
                  <ul className="space-y-1.5">{data.other.map((e, j) => <EventLine key={j} e={e} withDay />)}</ul>
                </li>
              )}
            </ol>
          )}
        </div>
      )}
    </OhSheet>
  )
}

const CONTACT_ICON: Record<string, React.ComponentType<{ className?: string }>> = { call: PhoneIcon, text: MessageCircle, email: MailIcon, hub: UserRound, website: Globe }

function EventLine({ e, withDay = false }: { e: { kind: string; key?: string | null; text: string; seconds?: number | null; at: string }; withDay?: boolean }) {
  const look = EVENT_LOOK[e.kind] || EVENT_LOOK.similar
  const Icon = (e.kind === 'contact' && CONTACT_ICON[e.key || '']) || look.icon
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${look.tone}`}><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-gray-700 dark:text-gray-200" data-testid="guest-activity-line">
        {e.text}{e.seconds ? <span className="whitespace-nowrap font-bold text-[#8b7355] dark:text-[#e8c97a]"> · {dur(e.seconds)}</span> : null}
      </span>
      <span className="shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-gray-400">{withDay ? `${day(e.at)} ` : ''}{time(e.at)}</span>
    </li>
  )
}

// ------------------------------------------------------------------ Texted / Emailed (owner, 11/02)
/** "Texted" when this guest's lead was ever reached by text, "Emailed" by email - else null. */
export function reachedBy(visitor: { contact_log?: ContactLogEntry[] | null }, via: 'text' | 'email'): string | null {
  return (visitor.contact_log || []).some(e => e.via === via) ? (via === 'text' ? 'Texted' : 'Emailed') : null
}

export function ContactedChip({ label }: { label: string }) {
  return (
    <span data-testid="visitor-contacted" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
      <Check className="h-2.5 w-2.5" /> {label}
    </span>
  )
}

// ------------------------------------------------------------------ Text / Call / Email (owner, 11/01)
/** "Hi Jane, it's Peter from the open house at 534 Holly Knoll. Thanks for stopping by!" then one
 *  blank line for the agent's own words, then the usual sign-off ("Thanks," + name | brokerage)
 *  (owner, 11/02: one line of space, not three, and "the open house" only once). */
export function visitorHello(guestName: string, agent: { first_name?: string; last_name?: string; brokerage?: string } | null | undefined, street: string) {
  const first = (guestName || '').trim().split(/\s+/)[0] || 'there'
  const me = (agent?.first_name || '').trim()
  const at = street ? ` from the open house at ${street}` : ' from the open house'
  const hello = me ? `Hi ${first}, it's ${me}${at}. Thanks for stopping by!` : `Hi ${first}, thanks for stopping by the open house${street ? ` at ${street}` : ''}!`
  const name = [agent?.first_name, agent?.last_name].filter(Boolean).join(' ').trim()
  const line = [name, (agent?.brokerage || '').trim()].filter(Boolean).join(' | ')
  return `${hello}\n\n${line ? `Thanks,\n${line}` : ''}`.trimEnd()
}

/** Text (Messages, already addressed and started), Call, and Email - which asks which mail app
 *  every time, last pick first, instead of assuming one (owner: "no one uses the Apple mail app").
 *  onContacted: Text tapped / a mail app picked - the guest shows Texted / Emailed (11/02). */
export function VisitorReach({ visitor, agent, street, compact = false, onContacted }: {
  visitor: { full_name: string; phone?: string | null; email?: string | null }
  agent: { first_name?: string; last_name?: string; brokerage?: string } | null | undefined
  street: string
  compact?: boolean
  onContacted?: (via: 'text' | 'email') => void
}) {
  const [mailOpen, setMailOpen] = useState(false)
  const [mailUsed, setMailUsed] = useState(false)
  const body = visitorHello(visitor.full_name, agent, street)
  const subject = street ? `Thanks for stopping by ${street}` : 'Thanks for stopping by the open house'
  const btn = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white font-black text-[#111827] transition hover:border-[#C9A24D] active:scale-[0.97] dark:border-white/10 dark:bg-white/[0.04] dark:text-white ${compact ? 'px-2.5 py-1.5 text-[11px]' : 'py-2.5 text-[13px]'}`
  const off = 'pointer-events-none opacity-40'
  return (
    <>
      <div className={compact ? 'mt-2 flex gap-1.5' : 'grid grid-cols-3 gap-2'} data-testid="visitor-reach">
        <a href={visitor.phone ? smsHref(visitor.phone, body) : undefined} aria-disabled={!visitor.phone} onClick={e => { e.stopPropagation(); if (visitor.phone) onContacted?.('text') }}
          className={`${btn} ${visitor.phone ? '' : off}`} data-testid="visitor-text"><MessageCircle className="h-3.5 w-3.5" /> Text</a>
        <a href={visitor.phone ? `tel:${visitor.phone}` : undefined} aria-disabled={!visitor.phone} onClick={e => e.stopPropagation()}
          className={`${btn} ${visitor.phone ? '' : off}`} data-testid="visitor-call"><PhoneIcon className="h-3.5 w-3.5" /> Call</a>
        <button type="button" disabled={!visitor.email} onClick={e => { e.stopPropagation(); setMailUsed(true); setMailOpen(true) }}
          className={`${btn} ${visitor.email ? '' : off}`} data-testid="visitor-email"><MailIcon className="h-3.5 w-3.5" /> Email</button>
      </div>
      {/* Not until it's first wanted: a long guest list would carry one of these per row. */}
      {mailUsed && <MailPicker open={mailOpen} onClose={() => setMailOpen(false)} to={visitor.email || ''} subject={subject} body={body} onPicked={() => onContacted?.('email')} />}
    </>
  )
}

function MailPicker({ open, onClose, to, subject, body, onPicked }: { open: boolean; onClose: () => void; to: string; subject: string; body: string; onPicked?: () => void }) {
  const [last, setLast] = useState<MailChoice | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (open) { setLast(savedMailChoice()); setCopied(false) } }, [open])
  const phone = isPhoneDevice()
  const pick = (c: MailChoice) => {
    saveMailChoice(c)
    if (c === 'copy') { copyText(`${subject}\n\n${body}`).catch(() => {}); setCopied(true); window.setTimeout(onClose, 900); return }
    onPicked?.()  // opened in a mail app - counts as emailed (copying alone doesn't)
    onClose()
    if (phone) { const { href, fallback } = phoneAppLinks(c, to, subject, body); openWithFallback(href, fallback); return }
    const href = composeHref(c, to, subject, body)
    if (c === 'default') window.location.href = href
    else window.open(href, '_blank', 'noopener,noreferrer')
  }
  const label = (c: MailChoice) => c === 'default' ? (phone ? "Your phone's mail app" : "Your computer's mail app") : MAIL_CHOICE_LABEL[c]
  // Gmail and Outlook first, then the device's own mail app, then copy - last pick marked.
  return (
    <OhSheet open={open} onClose={onClose} width="max-w-sm" title="Email with…" subtitle={to} icon={<MailIcon className="h-4 w-4" />}>
      <div className="space-y-2" data-testid="visitor-mail-picker">
        {mailChoices(null).map(c => (
          <button key={c} type="button" onClick={() => pick(c)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14px] font-black transition active:scale-[0.98] ${c === last
              ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white'
              : 'border-gray-200 text-[#111827] hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-white'}`}>
            <span className={`grid h-8 w-8 place-items-center rounded-xl ${c === last ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>
              {c === 'copy' ? <CopyIcon className="h-4 w-4" /> : <MailIcon className="h-4 w-4" />}
            </span>
            <span className="flex-1">{c === 'copy' && copied ? 'Copied' : label(c)}</span>
            {c === last && <span className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">Last used</span>}
          </button>
        ))}
      </div>
    </OhSheet>
  )
}
