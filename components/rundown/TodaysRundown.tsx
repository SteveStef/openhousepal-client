'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight, BedDouble, Bath, Building2, CalendarClock, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, Inbox, Ruler,
  Sparkles, TrendingDown, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import OhpLoader from '@/components/brand/OhpLoader'
import { getNotificationMeta } from '@/lib/notificationDisplay'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

// Today's Rundown (user, 10/24): the daily briefing email, inside the app and in more detail -
// what happened today and what's waiting on you. One window for the whole app: the bell's
// "Today's Rundown" notification, the Activity page and the Dash card all open it right where you
// are (a slide-up sheet on a phone that pulls down to close, a centred window on a computer).
// The data comes from the same code that builds the email (backend services/rundown_service.py).

export const RUNDOWN_NOTIFICATION_TYPE = 'SHOWCASE_DIGEST'   // older ones are titled "Today's Showcase update"
const OPEN_EVENT = 'ohp:rundown-open'
const REFRESH_EVENT = 'leads-notification-count:refresh'
const READ_EVENT = 'ohp:rundown-read'

/** Opens the Rundown window wherever you are (TodaysRundownHost listens). */
export function openTodaysRundown() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}
export const isRundownNotification = (n: { type: string }) => n.type === RUNDOWN_NOTIFICATION_TYPE

type Stat = { key: string; label: string; value: number; link: string }
type FollowUp = { title: string; when: string; overdue: boolean; link: string }
type Action = { badge: string; title: string; detail: string; link: string }
type Client = { name: string; link: string; starred: boolean }
type Home = {
  street_address: string; city: string; state: string; image: string; beds: string; baths: string; sqft: string; price: string
  is_price_drop: boolean; old_price?: string; new_price?: string; savings?: string; clients: Client[]; clients_more: string; clients_label: string
}
type Happening = { id: string; type: string; title: string; message: string; address?: string | null; link: string; is_read: boolean; at: string }
export type Rundown = {
  date: string; date_label: string; generated_at: string; first_name: string; headline: string
  briefing: { time_label: string; sent: boolean; sent_at: string | null; ran_today: boolean; upcoming: boolean; notification_id: string | null }
  stats: Stat[]; to_do_count: number; followups: FollowUp[]; followups_label: string; followup_overdue: number
  actions: Action[]; client_activity: Action[]
  showcase: { new: number; drops: number; clients: number; homes: Home[] } | null
  happened: { key: string; label: string; items: Happening[] }[]; happened_count: number; unread_today: number
}

// The last Rundown fetched - a reopen shows it instantly while the fresh one loads.
let cached: Rundown | null = null
// One request at a time for the whole app, and a fresh copy is reused for a few seconds: the Dash
// card, the window and every "something changed" refresh used to each ask at once (owner, 10/26 -
// four at a time on the live site, each slowing the others down).
let inflight: Promise<Rundown | null> | null = null
let fetchedAt = 0
const FRESH_MS = 15000

function fetchRundown(force = false) {
  if (inflight) return inflight
  if (!force && cached && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve(cached)
  inflight = api.notifications.rundown().then(r => {
    if (r.success && r.data) { cached = r.data as Rundown; fetchedAt = Date.now() }
    return r.success ? (r.data as Rundown) : null
  }).finally(() => { inflight = null })
  return inflight
}

/** Today's Rundown data, kept fresh (on open, every minute, and when something is read elsewhere). */
export function useRundown(enabled: boolean, pollMs = 60000) {
  const [data, setData] = useState<Rundown | null>(cached)
  const [failed, setFailed] = useState(false)
  const load = useCallback((force = false) => fetchRundown(force).then(d => { if (d) { setData(d); setFailed(false) } else setFailed(true) }), [])
  const refresh = useCallback(() => load(true), [load])
  useEffect(() => {
    if (!enabled) return
    load()
    const t = window.setInterval(() => { if (!document.hidden) load(true) }, pollMs)
    // Marked read in the window -> the Dash card shows it at once (and the other way round).
    const onRead = () => setData(d => d && markedRead(d))
    window.addEventListener(REFRESH_EVENT, refresh)
    window.addEventListener(READ_EVENT, onRead)
    return () => { window.clearInterval(t); window.removeEventListener(REFRESH_EVENT, refresh); window.removeEventListener(READ_EVENT, onRead) }
  }, [enabled, load, refresh, pollMs])
  return { data, setData, failed, reload: refresh }
}

/** "Mark all as read" - today's activity, the Rundown's own notification included. */
export async function markRundownRead(): Promise<boolean> {
  window.dispatchEvent(new Event(READ_EVENT))
  const r = await api.notifications.markRundownRead()
  if (r.success) {
    if (cached) cached = markedRead(cached)
    window.dispatchEvent(new Event(REFRESH_EVENT))
  }
  return r.success
}

const markedRead = (d: Rundown): Rundown => ({
  ...d, unread_today: 0,
  happened: d.happened.map(g => ({ ...g, items: g.items.map(i => ({ ...i, is_read: true })) })),
})

export function briefingStatus(d: Rundown): { text: string; tone: 'sent' | 'live' | 'quiet' } {
  const b = d.briefing
  if (b.sent) return { text: `Briefing sent${b.sent_at ? ` · ${clock(b.sent_at)}` : ''}`, tone: 'sent' }
  if (b.upcoming) return { text: `So far today · briefing at ${b.time_label}`, tone: 'live' }
  if (b.ran_today) return { text: 'So far today · no briefing email needed', tone: 'quiet' }
  return { text: 'So far today', tone: 'live' }
}

// "1 like", not "1 likes" (the Dash card's one-line summary).
const ONE: Record<string, string> = {
  new_leads: 'new lead', sign_ins: 'sign-in', forms: 'form response', new_homes: 'new match', price_drops: 'price drop', active_clients: 'client browsing',
  homes_viewed: 'home viewed', likes: 'like', tours: 'tour asked for', guest_pass: 'Guest Pass visit', emails: 'email opened',
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// -------------------------------------------------------------------------------------------------
// The host - mounted once (AppHeader). Opens on the event, or on ?rundown=1 (the notification's
// stored link / an email button), then tidies the address bar.

export function TodaysRundownHost() {
  const { isAuthenticated, user } = useAuth()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (!isAuthenticated) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('rundown') !== '1') return
    url.searchParams.delete('rundown')
    window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash)
    setOpen(true)
  }, [isAuthenticated])
  if (!isAuthenticated || user?.is_admin) return null
  return <TodaysRundownSheet open={open} onClose={() => setOpen(false)} />
}

export function TodaysRundownSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const release = usePagePin(open)
  if (!host) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {open && <RundownWindow key="rundown" onClose={onClose} />}
    </AnimatePresence>,
    host,
  )
}

// -------------------------------------------------------------------------------------------------

function RundownWindow({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  useEscapeToClose(onClose)
  const { data, setData, failed, reload } = useRundown(true)
  const [marking, setMarking] = useState(false)
  const [justMarked, setJustMarked] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // A phone turned sideways (844x390) is wider than a phone but very short: the window fills the
  // screen and the header / footer slim down so the content still has room.
  const [short, setShort] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 519px)')
    const on = () => setShort(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const go = (link: string) => {
    if (!link) return
    onClose()
    if (/^https?:\/\//.test(link) && !link.startsWith(window.location.origin)) { window.location.href = link; return }
    router.push(link.startsWith(window.location.origin) ? link.slice(window.location.origin.length) || '/' : link)
  }
  const markAll = async () => {
    if (!data || marking) return
    setMarking(true)
    setData(markedRead(data))
    const ok = await markRundownRead()
    setMarking(false)
    if (ok) { setJustMarked(true); window.setTimeout(() => setJustMarked(false), 2200) } else reload()
  }

  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={`fixed inset-0 z-[10050] flex bg-[#0b0b0c]/60 ${phone ? 'items-end' : short ? 'items-center justify-center p-2' : 'items-center justify-center p-6'}`}>
      <motion.div ref={sheetRef} {...sheetMotion} style={phone ? { y } : undefined} role="dialog" aria-modal="true" aria-label="Today's Rundown"
        data-testid="rundown-window"
        className={`relative flex w-full flex-col overflow-hidden bg-[#FAFAF7] shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#0d0d0f] ${
          phone ? 'h-[94dvh] rounded-t-[30px]' : short ? 'h-[calc(100dvh-1rem)] max-w-3xl rounded-[22px]' : 'h-[min(880px,calc(100dvh-3rem))] max-w-3xl rounded-[30px]'}`}>
        {phone && <span aria-hidden className="absolute left-1/2 top-2 z-30 h-1.5 w-10 -translate-x-1/2 rounded-full bg-[#8b7355]/30 dark:bg-white/25" />}
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close"
          className="absolute right-3.5 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-[#C9A24D]/25 bg-white/80 text-[#5c4a2e] shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15 sm:right-5 sm:top-5">
          <X className="h-4 w-4" />
        </motion.button>

        {/* Scrolled past the big header: a slim bar keeps the title and date in view. */}
        <AnimatePresence>
          {scrolled && data && (
            <motion.div key="bar" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}
              className={`absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 border-b border-[#C9A24D]/20 bg-[#fbf7ef] pl-5 pr-16 shadow-[0_10px_24px_-20px_rgba(17,24,39,.6)] dark:border-white/[0.07] dark:bg-[#111214] sm:pl-7 ${phone ? 'h-[72px] pt-4' : short ? 'h-[60px]' : 'h-[80px]'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]"><Sparkles className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-[9.5px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">Today&apos;s Rundown · {data.date_label.replace(/^\w+, (\w{3})\w*/, '$1')}</span>
                <span className="block truncate font-serif text-[15px] font-black text-[#111827] dark:text-white">{data.headline}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div onScroll={e => setScrolled(e.currentTarget.scrollTop > 170)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          {!data ? (
            <div className="grid h-full place-items-center px-6">
              {failed
                ? <div className="text-center"><p className="text-sm font-bold text-gray-500 dark:text-gray-400">Couldn't load today's rundown.</p>
                    <button type="button" onClick={reload} className="mt-3 rounded-full bg-[#111827] px-4 py-2 text-xs font-black text-white dark:bg-[#e8c97a] dark:text-[#111827]">Try again</button></div>
                : <OhpLoader fullScreen={false} label="Gathering your day…" />}
            </div>
          ) : (
            <RundownBody data={data} phone={phone} short={short} go={go} />
          )}
        </div>

        {data && (
          <div className={`relative z-20 flex items-center gap-2 border-t border-black/[0.06] bg-white/95 px-4 ${short ? 'py-2' : 'py-3'} dark:border-white/[0.07] dark:bg-[#141416]/95 sm:px-6`}
            style={{ paddingBottom: phone ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}>
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={markAll} disabled={marking || data.unread_today === 0} data-testid="rundown-mark-all"
              className={`relative flex ${short ? 'h-10' : 'h-12'} min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 text-sm font-black transition ${
                data.unread_today > 0
                  ? 'bg-gradient-to-r from-[#111827] to-[#2a2218] text-white shadow-lg shadow-black/15 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={data.unread_today > 0 ? 'mark' : 'done'} className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {data.unread_today > 0
                    ? <><CheckCheck className="h-4 w-4" /> Mark all as read <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] tabular-nums dark:bg-black/10">{data.unread_today}</span></>
                    : <><motion.span initial={justMarked ? { scale: 0.4, rotate: -30 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}><CheckCircle2 className="h-4 w-4" /></motion.span> All caught up</>}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <button type="button" onClick={() => go('/activity')}
              className={`flex ${short ? 'h-10' : 'h-12'} shrink-0 items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white`}>
              Activity <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// -------------------------------------------------------------------------------------------------

const rise = (i: number, reduce: boolean | null) => reduce ? {} : {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 28, delay: 0.08 + i * 0.07 } },
}

function RundownBody({ data, phone, short = false, go }: { data: Rundown; phone: boolean; short?: boolean; go: (link: string) => void }) {
  const reduce = useReducedMotion()
  const status = briefingStatus(data)
  // Busy numbers first, then quiet ones (as dimmed zeros) just to fill the last row - never a gap,
  // and on a quiet day the grid still shows.
  const cols = phone ? 3 : 4
  const stats = useMemo(() => {
    const busy = data.stats.filter(s => s.value > 0)
    const want = Math.max(cols, Math.ceil(busy.length / cols) * cols)
    return [...busy, ...data.stats.filter(s => s.value === 0)].slice(0, want)
  }, [data.stats, cols])
  const todo = data.followups.length + data.actions.length + data.client_activity.length
  return (
    <div className="pb-6">
      {/* Hero - the Luxe header look: warm ivory + gold (light), deep ink + gold (dark). */}
      <div className="relative isolate overflow-hidden border-b border-[#C9A24D]/20 dark:border-white/[0.06]">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.28),transparent_55%),radial-gradient(90%_90%_at_0%_100%,rgba(232,201,122,.22),transparent_60%),linear-gradient(140deg,#fffdf8_0%,#fbf5e8_55%,#f3e6cb_100%)] dark:hidden" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.24),transparent_55%),radial-gradient(90%_90%_at_0%_100%,rgba(139,106,43,.25),transparent_60%),linear-gradient(140deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)] dark:block" />
        <Sparkles aria-hidden className="pointer-events-none absolute -right-6 bottom-[-28px] -z-10 h-44 w-44 text-[#C9A24D]/[0.13] dark:text-[#e8c97a]/[0.07]" strokeWidth={0.7} />
        <div className={`px-5 sm:px-8 ${phone ? 'pb-5 pt-9' : 'pb-6 pt-7'}`}>
          <motion.p {...rise(0, reduce)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">
            <Sparkles className="h-3.5 w-3.5" /> Today&apos;s Rundown
          </motion.p>
          <motion.p {...rise(1, reduce)} className="mt-2 pr-12 text-[13px] font-bold text-[#5c4a2e]/80 dark:text-white/60">
            {greeting()}{data.first_name ? `, ${data.first_name}` : ''} · {data.date_label}
          </motion.p>
          <motion.h2 {...rise(2, reduce)} data-testid="rundown-headline"
            className={`mt-1 pr-6 font-serif font-black leading-[1.08] text-[#111827] [text-wrap:balance] dark:text-white ${short ? 'text-[1.6rem]' : 'text-[1.85rem] sm:text-[2.35rem]'}`}>
            {data.headline}.
          </motion.h2>
          <motion.div {...rise(3, reduce)} className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${
              status.tone === 'sent' ? 'border-emerald-300/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'
                : 'border-[#C9A24D]/35 bg-white/70 text-[#8b7355] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.tone === 'sent' ? 'bg-emerald-500' : status.tone === 'live' ? 'animate-pulse bg-[#C9A24D]' : 'bg-gray-400'}`} />
              {status.text}
            </span>
            {data.unread_today > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-black text-white dark:bg-[#e8c97a] dark:text-[#111827]">
                {data.unread_today} unread
              </span>
            )}
          </motion.div>

          {/* The day's numbers - each one counts up and opens its page. */}
          <div className={`mt-5 grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {stats.map((s, i) => (
              <motion.button key={s.key} type="button" onClick={() => go(s.link)}
                initial={reduce ? false : { opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.25 + i * 0.05 }} whileTap={{ scale: 0.95 }}
                className="group min-w-0 rounded-2xl border border-[#C9A24D]/25 bg-white/75 px-2.5 py-2.5 text-left shadow-[0_10px_24px_-20px_rgba(139,115,85,.8)] transition hover:border-[#C9A24D]/60 dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none dark:hover:border-[#e8c97a]/40">
                <span className={`block font-serif text-[1.6rem] font-black leading-none tabular-nums ${s.value ? 'text-[#111827] dark:text-white' : 'text-gray-300 dark:text-white/25'}`}>
                  <AnimatedNumber value={s.value} duration={1100} />
                </span>
                <span className="mt-1 block leading-tight text-[10px] font-black uppercase tracking-[0.08em] text-[#8b7355]/90 dark:text-white/50">{s.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 pt-5 sm:px-8">
        {/* Things to do */}
        <Section i={4} icon={<CalendarClock className="h-4 w-4" />} title="Things to do" count={todo}
          note={data.followups_label || undefined}>
          {todo === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/[0.06]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><CheckCircle2 className="h-5 w-5" /></span>
              <div><p className="text-sm font-black text-emerald-800 dark:text-emerald-200">Nothing waiting on you</p>
                <p className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/70">No follow-ups due and no requests to answer.</p></div>
            </div>
          ) : (
            <ShowMore initial={5} items={[
              ...data.followups.map((f, k) => (
                <Row key={`f${k}`} onClick={() => go(f.link)} title={f.title}
                  sub={<span className={f.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-[#8b7355] dark:text-[#e8c97a]'}>{f.when}</span>}
                  icon={<span className={`grid h-10 w-10 place-items-center rounded-full ${f.overdue ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]'}`}><CalendarClock className="h-4 w-4" /></span>} />
              )),
              ...data.actions.map((a, k) => (
                <Row key={`a${k}`} onClick={() => go(a.link)} title={a.title} sub={a.detail}
                  icon={<span className="grid h-10 w-10 place-items-center rounded-full bg-[#111827] text-[13px] font-black text-[#e8c97a] dark:bg-white/10">{a.badge === '!' ? <Inbox className="h-4 w-4" /> : a.badge}</span>} />
              )),
              ...data.client_activity.map((a, k) => (
                <Row key={`c${k}`} onClick={() => go(a.link)} title={a.title} sub={a.detail}
                  icon={<span className="grid h-10 w-10 place-items-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><Building2 className="h-4 w-4" /></span>} />
              )),
            ]} />
          )}
        </Section>

        {/* Showcase news - the briefing's home cards */}
        {data.showcase && data.showcase.homes.length > 0 && (
          <Section i={5} icon={<Building2 className="h-4 w-4" />} title="Showcase news" count={data.showcase.homes.length}
            note={[data.showcase.new ? `${data.showcase.new} new` : '', data.showcase.drops ? `${data.showcase.drops} price drop${data.showcase.drops === 1 ? '' : 's'}` : '',
              `${data.showcase.clients} client${data.showcase.clients === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}>
            <div className={phone
              ? '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'grid grid-cols-2 gap-3 lg:grid-cols-3'} data-no-sheet-drag={phone ? '' : undefined}>
              {data.showcase.homes.slice(0, phone ? 12 : 6).map((h, k) => <HomeCard key={k} home={h} index={k} phone={phone} go={go} />)}
            </div>
            {!phone && data.showcase.homes.length > 6 && (
              <button type="button" onClick={() => go('/showcases')} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
                See all {data.showcase.homes.length} homes in Showcases <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </Section>
        )}

        {/* What happened today */}
        <Section i={6} icon={<Sparkles className="h-4 w-4" />} title="What happened today" count={data.happened_count}>
          {data.happened.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm font-bold text-gray-400 dark:border-white/10">
              Quiet so far. Sign-ins, likes, comments, form answers and email opens land here the moment they happen.
            </p>
          ) : (
            <div className="space-y-4">
              {data.happened.map(g => (
                <div key={g.key}>
                  <p className="mb-1.5 flex items-center gap-2 px-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/40">
                    {g.label} <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] tracking-normal text-gray-500 dark:bg-white/10 dark:text-white/60">{g.items.length}</span>
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-white/[0.07] dark:bg-[#141416]">
                    <ShowMore initial={3} divided items={g.items.map(n => {
                      const { icon: Icon, className } = getNotificationMeta(n.type, n.message, n.title)
                      return (
                        <button key={n.id} type="button" onClick={() => go(n.link)} data-testid="rundown-happening"
                          className="flex w-full min-w-0 items-start gap-3 px-3.5 py-3 text-left transition hover:bg-[#faf9f7] active:bg-[#f4efe4] dark:hover:bg-white/[0.03] dark:active:bg-white/[0.05]">
                          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border ${className}`}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span className={`min-w-0 flex-1 text-[13.5px] leading-snug text-[#111827] dark:text-white ${n.is_read ? 'font-bold' : 'font-black'}`}>{n.title}</span>
                              <span className="shrink-0 pt-0.5 text-[10.5px] font-bold tabular-nums text-gray-400">{clock(n.at)}</span>
                            </span>
                            {(n.message || n.address) && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{n.message || n.address}</span>}
                          </span>
                          <AnimatePresence initial={false}>
                            {!n.is_read && <motion.span exit={{ scale: 0, opacity: 0 }} className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#C9A24D]" aria-label="Unread" />}
                          </AnimatePresence>
                        </button>
                      )
                    })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
        <p className="pb-2 text-center text-[10.5px] font-bold text-gray-400 dark:text-white/30">
          Updates on its own · same as your daily briefing email, with everything in it
        </p>
      </div>
    </div>
  )
}

function Section({ i, icon, title, count, note, children }: { i: number; icon: React.ReactNode; title: string; count?: number; note?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.section {...rise(i, reduce)}>
      <div className="mb-2.5 flex items-end gap-2.5 px-1">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-sm dark:from-[#3a2f1a] dark:to-[#1c1710] dark:ring-1 dark:ring-[#C9A24D]/35">{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">
            {title}
            {count !== undefined && count > 0 && <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 font-sans text-[11px] font-black tabular-nums text-[#8b7355] dark:text-[#e8c97a]">{count}</span>}
          </h3>
          {note && <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{note}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  )
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.985 }}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-gray-200/80 bg-white p-3 text-left shadow-[0_8px_20px_-18px_rgba(17,24,39,.5)] transition hover:border-[#C9A24D]/50 dark:border-white/[0.07] dark:bg-[#141416] dark:hover:border-[#e8c97a]/30">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-black leading-snug text-[#111827] dark:text-white">{title}</span>
        {sub && <span className="mt-0.5 line-clamp-2 block text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-white/25" />
    </motion.button>
  )
}

/** The first few, then "Show N more" - the rest unfold with a smooth height animation. */
function ShowMore({ items, initial, divided = false }: { items: React.ReactNode[]; initial: number; divided?: boolean }) {
  const [open, setOpen] = useState(false)
  const head = items.slice(0, initial)
  const rest = items.slice(initial)
  const wrap = divided ? 'divide-y divide-gray-100 dark:divide-white/[0.06]' : 'space-y-2'
  return (
    <div>
      <div className={wrap}>{head}</div>
      <AnimatePresence initial={false}>
        {open && rest.length > 0 && (
          <motion.div key="rest" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 300, damping: 34 }, opacity: { duration: 0.2 } }} className="overflow-hidden">
            <div className={`${wrap} ${divided ? 'border-t border-gray-100 dark:border-white/[0.06]' : 'pt-2'}`}>{rest}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {rest.length > 0 && (
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          className={`flex w-full items-center justify-center gap-1.5 text-xs font-black text-[#8b7355] transition hover:text-[#111827] dark:text-[#e8c97a] dark:hover:text-white ${divided ? 'border-t border-gray-100 py-2.5 dark:border-white/[0.06]' : 'mt-2 rounded-xl py-2'}`}>
          {open ? 'Show less' : `Show ${rest.length} more`}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}><ChevronDown className="h-3.5 w-3.5" /></motion.span>
        </button>
      )}
    </div>
  )
}

function HomeCard({ home: h, index, phone, go }: { home: Home; index: number; phone: boolean; go: (link: string) => void }) {
  const [loaded, setLoaded] = useState(false)
  const reduce = useReducedMotion()
  const first = h.clients[0]
  return (
    <motion.div initial={reduce ? false : { opacity: 0, x: phone ? 30 : 0, y: phone ? 0 : 14 }} animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.45 + index * 0.06 }}
      className={`flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-gray-200/80 bg-white shadow-[0_18px_34px_-26px_rgba(17,24,39,.6)] dark:border-white/[0.07] dark:bg-[#141416] ${phone ? 'w-[78%] shrink-0 snap-start' : ''}`}>
      <button type="button" onClick={() => first && go(first.link)} className="relative block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#efe6d4] to-[#d9c7a3] dark:from-[#1d1a14] dark:to-[#2a2218]">
        {h.image && <img src={h.image} alt="" onLoad={() => setLoaded(true)} className={`h-full w-full object-cover transition duration-700 ${loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0'}`} />}
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <span className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide shadow ${h.is_price_drop ? 'bg-rose-500 text-white' : 'bg-[#e8c97a] text-[#111827]'}`}>
          {h.is_price_drop ? <><TrendingDown className="h-3 w-3" /> Price drop{h.savings ? <span className="whitespace-nowrap normal-case"> · −{h.savings}</span> : null}</> : <><Sparkles className="h-3 w-3" /> New match</>}
        </span>
        <span className="absolute inset-x-3 bottom-2.5 text-left text-white">
          <span className="block font-serif text-xl font-black leading-none drop-shadow">
            {h.is_price_drop ? (h.new_price || h.price) : h.price}
            {h.is_price_drop && h.old_price && <span className="ml-2 align-middle font-sans text-[11px] font-bold text-white/70 line-through">{h.old_price}</span>}
          </span>
          <span className="mt-1 block truncate text-[12.5px] font-bold text-white/90">{h.street_address}{h.city ? `, ${h.city}` : ''}</span>
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        {(h.beds || h.baths || h.sqft) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            {h.beds && <span className="flex items-center gap-1 whitespace-nowrap"><BedDouble className="h-3.5 w-3.5" />{h.beds}</span>}
            {h.baths && <span className="flex items-center gap-1 whitespace-nowrap"><Bath className="h-3.5 w-3.5" />{h.baths}</span>}
            {h.sqft && <span className="flex items-center gap-1 whitespace-nowrap"><Ruler className="h-3.5 w-3.5" />{h.sqft} sqft</span>}
          </p>
        )}
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b7355] dark:text-[#e8c97a]">{h.clients_label}</p>
        <div className="flex flex-wrap gap-1.5">
          {h.clients.slice(0, 4).map((c, k) => (
            <button key={k} type="button" onClick={() => go(c.link)}
              className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-gray-200 bg-[#faf9f7] px-2.5 py-1 text-[11px] font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
              {c.starred && <span className="text-[#C9A24D]">★</span>}<span className="truncate">{c.name}</span>
            </button>
          ))}
          {(h.clients.length > 4 || h.clients_more) && (
            <span className="inline-flex items-center px-1 text-[11px] font-bold text-gray-400">{h.clients_more || `+ ${h.clients.length - 4} more`}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// -------------------------------------------------------------------------------------------------
// The Dash entry - always there, right under the header. Today's date, the briefing's headline,
// the day's top numbers, and a small "Mark all read" button next to it.

export function RundownDashCard({ className = '' }: { className?: string }) {
  const { data, setData, failed, reload } = useRundown(true)
  const reduce = useReducedMotion()
  const [marking, setMarking] = useState(false)
  const now = useRef(new Date()).current
  if (!data) {
    // Never a blank box: say what's coming, or that it didn't load with a way to try again.
    return (
      <div className={`flex h-[92px] items-center gap-3 rounded-3xl border border-[#C9A24D]/25 bg-white/70 px-4 dark:border-white/[0.08] dark:bg-white/[0.03] ${failed ? '' : 'animate-pulse'} ${className}`}>
        <span className="flex h-[60px] w-[54px] shrink-0 items-center justify-center rounded-2xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">Today&apos;s Rundown</span>
          <span className="block text-sm font-bold text-gray-500 dark:text-gray-400">{failed ? "Couldn't load your rundown." : 'Getting your day ready…'}</span>
        </span>
        {failed && <button type="button" onClick={() => reload()} className="shrink-0 rounded-xl bg-[#111827] px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]">Try again</button>}
      </div>
    )
  }
  const status = briefingStatus(data)
  const top = data.stats.filter(s => s.value > 0).slice(0, 3)
  const fresh = data.briefing.sent && data.unread_today > 0
  const markAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (marking || !data.unread_today) return
    setMarking(true)
    setData(markedRead(data))
    await markRundownRead()
    setMarking(false)
  }
  const [y, mo, d] = data.date.split('-').map(Number)
  const day = new Date(y, (mo || 1) - 1, d || now.getDate())
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
      className={`relative ${className}`} data-testid="rundown-dash-card">
      <div role="button" tabIndex={0} onClick={openTodaysRundown} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTodaysRundown() } }}
        className={`group relative isolate flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-3xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(201,162,77,.9)] dark:bg-[#121214] sm:gap-4 sm:p-4 ${
          fresh ? 'border-[#C9A24D]/70 ring-2 ring-[#C9A24D]/20' : 'border-[#C9A24D]/30 dark:border-white/[0.08]'}`}>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_140%_at_0%_0%,rgba(232,201,122,.20),transparent_60%),linear-gradient(110deg,#fffdf8,#ffffff_60%)] dark:bg-[radial-gradient(80%_140%_at_0%_0%,rgba(201,162,77,.16),transparent_60%),linear-gradient(110deg,#15130f,#121214_60%)]" />
        {/* Date tile */}
        <span className="relative flex h-[60px] w-[54px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-white shadow-md dark:from-[#3a2f1a] dark:to-[#1c1710] dark:ring-1 dark:ring-[#C9A24D]/45 sm:h-[64px] sm:w-[58px]">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#e8c97a]">{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <span className="font-serif text-[1.65rem] font-black leading-none">{day.getDate()}</span>
          <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/55">{day.toLocaleDateString(undefined, { month: 'short' })}</span>
          {data.unread_today > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#e8c97a] shadow-[0_0_0_3px_rgba(232,201,122,.25)]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">
            <Sparkles className="h-3 w-3" /> Today&apos;s Rundown
            {fresh && <span className="rounded-full bg-[#C9A24D] px-1.5 py-px text-[8.5px] tracking-[0.1em] text-white">New</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 font-serif text-[1.05rem] font-black leading-tight text-[#111827] dark:text-white sm:line-clamp-1 sm:text-lg">{data.headline}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.tone === 'sent' ? 'bg-emerald-500' : status.tone === 'live' ? 'animate-pulse bg-[#C9A24D]' : 'bg-gray-400'}`} />
            <span className="truncate">{status.text}{top.length > 0 && <span className="hidden sm:inline"> · {top.map(s => `${s.value} ${s.value === 1 ? (ONE[s.key] || s.label.toLowerCase()) : s.label.toLowerCase().replace('guest pass', 'Guest Pass')}`).join(' · ')}</span>}</span>
          </span>
        </span>
        {/* Mark all read - right next to it */}
        <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={markAll} disabled={marking || !data.unread_today} data-testid="rundown-dash-mark"
          title={data.unread_today ? `Mark today's ${data.unread_today} as read` : 'All read'} aria-label={data.unread_today ? 'Mark all as read' : 'All read'}
          className={`relative z-10 flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black transition ${
            data.unread_today
              ? 'border-[#C9A24D]/40 bg-white text-[#8b7355] hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#e8c97a]'
              : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'}`}>
          {data.unread_today ? <CheckCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{data.unread_today ? 'Mark all read' : 'All read'}</span>
          {data.unread_today > 0 && <span className="tabular-nums sm:hidden">{data.unread_today > 99 ? '99+' : data.unread_today}</span>}
        </motion.button>
        <ChevronRight className="hidden h-5 w-5 shrink-0 text-[#C9A24D] transition group-hover:translate-x-0.5 sm:block" />
      </div>
    </motion.div>
  )
}
