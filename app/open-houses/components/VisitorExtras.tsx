'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CalendarCheck2, Clock, FileText, Home, Map as MapIcon, MessageCircle, RotateCcw, Sparkles, Star, Ticket, LayoutGrid, Eye } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { useLastValue } from '@/components/ui/windowMotion'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import api from '@/lib/api-service'

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
  pass_last_at?: string | null
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
    ? pending ? `Invite at ${time}` : 'Showcase on'
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
          {pending && on && <span className="block whitespace-nowrap text-[10px] font-semibold text-gray-400">invite {time}</span>}
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

/** After starring a lead who has a Showcase: "Also star their Showcase so it stays highlighted?"
 *  (never asked when this open house's Showcases are off). */
export function StarShowcaseAsk({ visitor, onClose, onYes }: { visitor: VisitorRow | null; onClose: () => void; onYes: (v: VisitorRow) => void }) {
  const v = useLastValue(visitor)
  const first = (v?.full_name || '').split(' ')[0]
  return (
    <OhSheet
      open={!!visitor}
      onClose={onClose}
      width="max-w-md"
      title={`${first || 'Lead'} is starred`}
      subtitle="Their Showcase is a separate star"
      icon={<Star className="h-5 w-5" fill="currentColor" />}
      footer={
        <div className="flex gap-2.5">
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white">
            Just the lead
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => { if (v) onYes(v); onClose() }}
            className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-lg shadow-black/20 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
            <Sparkles className="h-4 w-4" /> Star Showcase too
          </motion.button>
        </div>
      }
    >
      <p className="text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
        Also favorite {first ? `${first}'s` : 'their'} Showcase so it stays highlighted on your Showcases page (and never goes to sleep)?
      </p>
    </OhSheet>
  )
}

type PassActivity = Awaited<ReturnType<typeof api.openHouses.getVisitorPassActivity>>['data']

const EVENT_LOOK: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  similar: { icon: Home, tone: 'text-[#8b7355] bg-[#C9A24D]/12 dark:text-[#e8c97a]' },
  similar_list: { icon: LayoutGrid, tone: 'text-[#8b7355] bg-[#C9A24D]/12 dark:text-[#e8c97a]' },
  cheat: { icon: FileText, tone: 'text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15' },
  showcase: { icon: Sparkles, tone: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15' },
  map: { icon: MapIcon, tone: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15' },
  request: { icon: CalendarCheck2, tone: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15' },
  question: { icon: MessageCircle, tone: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15' },
}

function eventText(e: { kind: string; key: string | null; label: string | null }): string {
  switch (e.kind) {
    case 'similar': return `Viewed details: ${e.label || 'a similar home'}`
    case 'similar_list': return 'Looked through the Similar Homes'
    case 'cheat': return 'Opened the Cheat Sheet'
    case 'showcase': return 'Opened their Showcase'
    case 'map': return 'Used the map'
    case 'request': return e.key === 'disclosure' ? 'Asked for the seller disclosure' : `Asked for a second tour${e.label ? ` - ${e.label}` : ''}`
    case 'question': return `Asked you: "${e.label || ''}"`
    default: return e.kind
  }
}

const dur = (s: number) => s < 60 ? `${Math.max(s, 5)}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const localDay = (iso: string) => new Date(iso).toDateString()

/** Everything one guest did on their Guest Pass (user, 10/24): each visit with its day, time and
 *  length, and what they opened in it - homes, Cheat Sheet, map, Showcase, requests, questions. */
export function PassActivitySheet({ visitor, onClose }: { visitor: VisitorRow | null; onClose: () => void }) {
  const v = useLastValue(visitor)
  const [data, setData] = useState<PassActivity | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!visitor) return
    let live = true
    setLoading(true); setData(null)
    api.openHouses.getVisitorPassActivity(visitor.id).then(r => {
      if (!live) return
      setData(r.success ? r.data ?? null : null)
      setLoading(false)
    })
    return () => { live = false }
  }, [visitor])

  const signedDay = v ? localDay(v.created_at) : ''
  const otherDays = data ? Array.from(new Set(data.visits.map(x => localDay(x.started_at)))).filter(d => d !== signedDay) : []
  const homes = data ? new Set([...data.visits.flatMap(x => x.events), ...data.other].filter(e => e.kind === 'similar').map(e => e.key)).size : 0

  return (
    <OhSheet
      open={!!visitor}
      onClose={onClose}
      width="max-w-xl"
      title="Guest Pass activity"
      subtitle={v?.full_name}
      icon={<Activity className="h-5 w-5" />}
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
                    <p className="mt-1.5 text-xs font-medium text-gray-400">Looked over this home&apos;s page.</p>
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

function EventLine({ e, withDay = false }: { e: { kind: string; key: string | null; label: string | null; at: string }; withDay?: boolean }) {
  const look = EVENT_LOOK[e.kind] || EVENT_LOOK.similar
  const Icon = look.icon
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${look.tone}`}><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-gray-700 dark:text-gray-200">{eventText(e)}</span>
      <span className="shrink-0 pt-0.5 text-[11px] font-bold tabular-nums text-gray-400">{withDay ? `${day(e.at)} ` : ''}{time(e.at)}</span>
    </li>
  )
}
