'use client'

// Guest Pass - the page a guest's phone opens right after they sign in at an open house (Bright MLS
// plans, switched per open house on the Open Houses page). The home they're standing in, its
// Similar Homes sheet and Cheat Sheet as live web pages, one-tap seller disclosure / second tour
// requests (we already have their info), a quick question to the host, their Showcase, and the
// agent's Spotlight when there is one. Themed like the open house's sign-in screen (its dark/light
// setting + accent color).
import { atTime, busyAt, type BusyBlock } from '@/lib/agentBusy'
import SignatureSiteCard from '@/components/studio/blogs/SignatureSiteCard'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, Bath, Bed, BellRing, CalendarCheck, Check, Heart, Scale, ChevronLeft, ChevronRight, FileText, Globe, Home, Loader2, Mail,
  MessageSquare, Phone, Ruler, ScanSearch, Send, Sparkles, Ticket, UserRound,
  MapPin, Moon, Sun, Sunrise,
} from 'lucide-react'
import api from '@/lib/api-service'
import PropertyDetailView from '@/components/PropertyDetailView'
import SimilarHomesView, { listingKeyOf, useScoredSimilar } from './SimilarHomesView'
import CheatSheetView from './CheatSheetView'
import GuestPassIntro from './GuestPassIntro'
import {
  ComplianceFooter, GuestPassData, RequestKind, RequestState, cityLine, formatPhone, img, initials, money, possessive, streetOf,
} from './shared'
import OhpLoader from '@/components/brand/OhpLoader'
import HomeAreaMap from '@/components/maps/HomeAreaMap'

type View = 'home' | 'similar' | 'cheat'

export default function GuestPass({ token, openHouseEventId }: { token: string; openHouseEventId: string }) {
  // The agent's busy times - read when the second-tour picker opens, so its suggestions skip them.
  const [tourBusy, setTourBusy] = useState<BusyBlock[]>([])
  const loadTourBusy = useCallback(() => { api.public.getGuestPassBusy(token).then(setTourBusy).catch(() => {}) }, [token])
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = (searchParams.get('v') as View) || 'home'
  const openKey = searchParams.get('p')

  const [data, setData] = useState<GuestPassData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<RequestKind | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [buildingShowcase, setBuildingShowcase] = useState(false)
  const [showcaseError, setShowcaseError] = useState<string | null>(null)
  // How many views deep we've gone inside the pass - "back" pops real history only when it's ours.
  const depth = useRef(0)
  // Top bar: the home button sits dead-center on the page; its width is whatever the wider of the
  // two sides leaves (so it never covers the wordmark or the agent's name).
  const barRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLAnchorElement>(null)
  const [centerWidth, setCenterWidth] = useState<number | null>(null)
  useEffect(() => {
    const bar = barRef.current, l = leftRef.current, r = rightRef.current
    if (!bar || !l || !r || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const pad = parseFloat(getComputedStyle(bar).paddingLeft) || 12
      const side = Math.max(l.offsetWidth, r.offsetWidth) + pad + 8
      setCenterWidth(Math.max(72, bar.clientWidth - side * 2))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ;[bar, l, r].forEach(el => ro.observe(el))
    return () => ro.disconnect()
  }, [data])

  // The opening (curtain + "Welcome, {name}"): once per visit to this pass, on its front page.
  // `revealed` = the curtain has started parting, so the page underneath plays its entrance then.
  const [intro, setIntro] = useState<'pending' | 'on' | 'off'>('pending')
  const [revealed, setRevealed] = useState(false)
  const loaded = !!data
  useEffect(() => {
    if (!loaded || intro !== 'pending') return
    let seen = false
    try { seen = !!sessionStorage.getItem(`gp-intro:${token}`); sessionStorage.setItem(`gp-intro:${token}`, '1') } catch { /* private mode */ }
    setIntro(seen || view !== 'home' || openKey ? 'off' : 'on')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useEffect(() => {
    let alive = true
    api.public.getGuestPass(token).then(({ success, data: d, error: e }: any) => {
      if (!alive) return
      if (success && d) setData(d)
      else setError(e || "This Guest Pass isn't available.")
    })
    return () => { alive = false }
  }, [token])

  // Live: the similar homes come back refreshed from the MLS on every load - re-pull them every
  // minute and a half while the pass is on screen (prices, days on market, sold homes dropping off).
  useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const { success, data: d }: any = await api.public.getGuestPass(token)
      if (success && d) setData(prev => (prev ? { ...prev, similar: d.similar, live_at: d.live_at } : prev))
    }, 90000)
    return () => window.clearInterval(t)
  }, [token])

  // On an IDX agent's own domain the pass runs inside that site's frame - tell it where we are so
  // its address bar shows (and a refresh reopens) this exact view, on the agent's domain.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return
    window.parent.postMessage({ type: 'ohp:path', path: window.location.pathname + window.location.search }, '*')
  }, [view, openKey])

  const go = useCallback((v: View, key?: string | null) => {
    const q = new URLSearchParams()
    if (v !== 'home') q.set('v', v)
    if (key) q.set('p', key)
    depth.current += 1
    router.push(`?${q.toString()}`, { scroll: false })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [router])

  const back = useCallback((fallback: View) => {
    if (depth.current > 0) {
      depth.current -= 1
      router.back()
    } else {
      const q = new URLSearchParams()
      if (fallback !== 'home') q.set('v', fallback)
      router.replace(`?${q.toString()}`, { scroll: false })
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [router])

  // The nav bar's home button - straight back to the pass's front page from anywhere inside it.
  const goHome = useCallback(() => {
    if (view === 'home' && !openKey) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    depth.current = 0
    router.replace('?', { scroll: false })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [router, view, openKey])

  // Second tour: pick two preferred times first (a small sheet), then it sends.
  const [tourPicker, setTourPicker] = useState(false)
  const request = useCallback(async (kind: RequestKind, preferredTime?: string) => {
    if (!data || data.requested[kind] || sending) return
    if (kind === 'second_visit' && preferredTime === undefined) { loadTourBusy(); setTourPicker(true); return }
    setSending(kind)
    setRequestError(null)
    const { success } = await api.public.guestPassRequest(token, kind, preferredTime)
    setSending(null)
    if (success) setData(d => d ? { ...d, requested: { ...d.requested, [kind]: true } } : d)
    else setRequestError("That didn't go through - try again in a moment.")
  }, [data, sending, token])

  const openShowcase = useCallback(async () => {
    if (!data?.showcase || buildingShowcase) return
    setShowcaseError(null)
    if (data.showcase.url) {
      window.open(data.showcase.url, '_blank', 'noopener')
      return
    }
    // Open the tab now (still inside the tap, so it isn't blocked), point it at the Showcase once built.
    const tab = window.open('', '_blank')
    setBuildingShowcase(true)
    const { success, data: r } = await api.public.guestPassShowcase(token)
    setBuildingShowcase(false)
    if (success && r?.url) {
      setData(d => d ? { ...d, showcase: { url: r.url } } : d)
      if (tab) tab.location.href = r.url
      else window.location.assign(r.url)
    } else {
      tab?.close()
      setShowcaseError("We couldn't build it just now - try again in a moment.")
    }
  }, [data, buildingShowcase, token])

  const dark = data ? !!data.theme?.darkMode : false
  const accent = data?.theme?.accentColor || '#C9A24D'

  if (error) {
    return (
      <Shell dark={false} accent={accent}>
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <Ticket className="mx-auto h-10 w-10 text-[var(--gp)]" />
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[#0B0B0B] dark:text-white">{error}</h1>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">Reach out to the agent who hosted the open house and they'll send you everything.</p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell dark={false} accent={accent}>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3">
          <OhpLoader guest fullScreen={false} className="!py-0" label="Opening your Guest Pass" />
        </div>
      </Shell>
    )
  }

  const { agent, guest } = data
  const street = streetOf(data.home.address)
  const [nameFirst, ...nameTail] = (agent.name || '').trim().split(/\s+/)
  const nameRest = nameTail.join(' ')
  const onHome = view === 'home' && !openKey

  return (
    <Shell dark={dark} accent={accent}>
      {/* Top bar: the pass's name, a home button (the open house itself), the host. */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#FAFAF7]/85 dark:border-white/[0.06] dark:bg-[#0B0B0B]/80">
        <div ref={barRef} className="relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <div ref={leftRef} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gp)] text-white shadow-sm"><Ticket className="h-3.5 w-3.5" /></span>
            <span className="text-[10px] font-black uppercase leading-[1.05] tracking-[0.2em] text-[#0B0B0B] dark:text-white sm:text-[11px] sm:tracking-[0.22em]">
              Guest<br className="sm:hidden" /><span className="hidden sm:inline"> </span>Pass
            </span>
          </div>
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 justify-center" style={{ width: centerWidth ?? undefined, maxWidth: centerWidth == null ? '40%' : undefined }}>
            <button
              type="button"
              onClick={goHome}
              aria-label={`Back to ${street}`}
              className={`flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-black transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
                onHome
                  ? 'border-transparent text-[#0B0B0B] dark:text-white'
                  : 'border-black/[0.08] bg-white text-[#0B0B0B] shadow-sm hover:border-[var(--gp)] dark:border-white/[0.1] dark:bg-[#141416] dark:text-white'
              }`}
              style={onHome ? { backgroundColor: 'color-mix(in srgb, var(--gp) 14%, transparent)' } : undefined}
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-[var(--gp)]" />
              <span className="truncate">{street}</span>
            </button>
          </div>
          {/* The agent's photo + name open their Agent Hub (user, 10/17); without a hub it jumps to
              the agent card at the bottom like before. */}
          <a ref={rightRef} href={agent.hub_url || '#agent'} target={agent.hub_url ? '_blank' : undefined} rel={agent.hub_url ? 'noopener' : undefined}
            onClick={(e) => { if (agent.hub_url) return; if (!onHome) { e.preventDefault(); goHome() } }}
            title={agent.hub_url ? `${agent.name} - open my page` : undefined}
            className="flex shrink-0 items-center justify-end gap-1.5 transition-opacity hover:opacity-80 sm:gap-2">
            {/* The whole name, always: first name over last name on phones (never cut off). */}
            <span className="text-right leading-[1.1]">
              <span className="block whitespace-nowrap text-[11px] font-black text-[#0B0B0B] dark:text-white">
                {nameFirst}<br className="sm:hidden" /><span className="hidden sm:inline"> </span>{nameRest}
              </span>
              {agent.brokerage && <span className="mt-0.5 block max-w-[92px] truncate text-[8.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:max-w-[200px] sm:text-[9px]">{agent.brokerage}</span>}
            </span>
            <Avatar agent={agent} size={32} />
          </a>
        </div>
      </header>

      {intro === 'on' && (
        <GuestPassIntro
          firstName={guest.first_name}
          street={street}
          photo={img(data.home.photos?.[0])}
          coverPosition={data.home.cover_position}
          onReveal={() => setRevealed(true)}
          onDone={() => setIntro('off')}
        />
      )}
      {intro !== 'pending' && (intro === 'off' || revealed) && (
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={`${view}:${openKey || ''}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {openKey ? (
            <PropertyDetailView
              propertyId={openKey}
              agentId={agent.id}
              prefill={{ name: guest.full_name, contact: guest.email || guest.phone }}
              cameFrom={{ src: 'pass', oh: openHouseEventId }}
              onBack={() => back('similar')}
              backLabel="Back to Similar Homes"
              hideFooter
            />
          ) : view === 'similar' ? (
            <SimilarHomesView
              data={data}
              onOpen={(key) => go('similar', key)}
              onBack={() => back('home')}
              onShowcase={openShowcase}
              buildingShowcase={buildingShowcase}
              showcaseError={showcaseError}
            />
          ) : view === 'cheat' && data.cheat_sheet ? (
            <CheatSheetView data={data} onRequest={request} sending={sending} onBack={() => back('home')} />
          ) : (
            <HomeView
              data={data}
              token={token}
              street={street}
              onSimilar={() => go('similar')}
              onOpenSimilar={(key) => go('similar', key)}
              onCheat={() => go('cheat')}
              onRequest={request}
              sending={sending}
              requestError={requestError}
              onShowcase={openShowcase}
              buildingShowcase={buildingShowcase}
              showcaseError={showcaseError}
            />
          )}
        </motion.main>
      </AnimatePresence>
      )}
      <ComplianceFooter />
      <SecondTourPicker
        open={tourPicker}
        busy={tourBusy}
        agentFirst={agent.first_name}
        onClose={() => setTourPicker(false)}
        onSend={(times) => { setTourPicker(false); request('second_visit', times) }}
      />
    </Shell>
  )
}

// The parts of the day, each with a few suggested times so a guest can answer in three taps and the
// agent never has to ask "what time?". "Any time" keeps it loose for guests who don't mind.
const TOUR_PARTS = [
  { id: 'Morning', icon: Sunrise, times: ['9:00 AM', '10:00 AM', '11:00 AM'] },
  { id: 'Afternoon', icon: Sun, times: ['1:00 PM', '2:00 PM', '3:00 PM'] },
  { id: 'Evening', icon: Moon, times: ['5:00 PM', '6:00 PM', '7:00 PM'] },
] as const
const ANY_TIME = 'any'
type TourPick = { day: number | null; part: string | null; time: string | null }
const EMPTY_PICK: TourPick = { day: null, part: null, time: null }

// "When would you like to see it again?" - a day, a part of the day, then a suggested time. Option 1
// ticks itself off and the sheet glides on to an optional backup (Option 2). Sent with the second-tour
// request so the agent sees the times on the alert and in Leads.
function SecondTourPicker({ open, agentFirst, onClose, onSend, busy = [] }: {
  open: boolean; agentFirst: string; onClose: () => void; onSend: (times: string) => void
  /** The agent's busy blocks - those suggested times are crossed out (user, 10/18). */
  busy?: BusyBlock[]
}) {
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1); return d
  }), [])
  const [picks, setPicks] = useState<TourPick[]>([EMPTY_PICK, EMPTY_PICK])
  const [slot, setSlot] = useState(0)
  const [dir, setDir] = useState(1)
  useEffect(() => { if (open) { setPicks([EMPTY_PICK, EMPTY_PICK]); setSlot(0); setDir(1) } }, [open])
  const done = (p: TourPick) => p.day != null && !!p.part && !!p.time
  // `short` = the option box (no room for "any time"); the full words go to the agent.
  const label = (p: TourPick, short = false) => {
    if (p.day == null) return ''
    const day = days[p.day].toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    if (!p.part) return day
    if (!p.time) return `${day} · ${p.part}`
    return p.time === ANY_TIME ? `${day} · ${p.part}${short ? '' : ', any time'}` : `${day} · ${p.time}`
  }
  const goSlot = (i: number) => { if (i === slot) return; setDir(i > slot ? 1 : -1); setSlot(i) }
  const set = (patch: Partial<TourPick>) => setPicks(prev => {
    const next = prev.map((p, i) => (i === slot ? { ...p, ...patch } : p))
    // Option 1 finished (and the backup isn't): a beat to see its tick, then on to Option 2.
    if (slot === 0 && done(next[0]) && !done(prev[0]) && !done(next[1])) setTimeout(() => { setDir(1); setSlot(1) }, 650)
    return next
  })
  const cur = picks[slot]
  const part = TOUR_PARTS.find(p => p.id === cur.part)
  // One good time is enough to ask; a second choice is offered, not required.
  const ready = done(picks[0]) || done(picks[1])
  const slide = {
    initial: (d: number) => ({ opacity: 0, x: d * 40 }),
    animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
    exit: (d: number) => ({ opacity: 0, x: d * -32, transition: { duration: 0.15 } }),
  } as const
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label="Pick a time for a second tour"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="w-full max-w-md overflow-hidden rounded-t-[28px] bg-white p-5 shadow-2xl dark:bg-[#141416] sm:rounded-[28px] sm:p-6"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15 sm:hidden" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--gp)]">Second Tour</p>
            <h3 className="mt-1 text-xl font-black tracking-tight">When works for you?</h3>
            <p className="mt-1 text-[13px] font-semibold text-gray-500 dark:text-gray-400">Pick a day and a time - add a backup if you can. {agentFirst} will confirm.</p>

            {/* the two options: the one being filled in is lit; a finished one gets its tick */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {picks.map((p, i) => {
                const ok = done(p)
                return (
                  <button key={i} type="button" onClick={() => goSlot(i)}
                    className={`relative isolate rounded-2xl border px-3 py-2.5 text-left transition-colors ${slot === i ? 'border-[var(--gp)]' : ok ? 'border-emerald-500/40' : 'border-black/[0.08] dark:border-white/[0.1]'}`}>
                    {slot === i && <motion.span layoutId="gp-tour-slot" className="absolute inset-0 -z-10 rounded-2xl bg-[color-mix(in_srgb,var(--gp)_9%,transparent)]" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                    <span className="flex items-center gap-1.5">
                      <AnimatePresence initial={false}>
                        {ok && (
                          <motion.span key="tick" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                            className="relative grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 shadow-[0_4px_10px_-3px_rgba(16,185,129,.8)]">
                            <motion.span className="absolute inset-0 rounded-full bg-emerald-400/50" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                            <svg viewBox="0 0 24 24" className="relative h-2.5 w-2.5" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.12 }} />
                            </svg>
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span className={`block truncate whitespace-nowrap text-[9px] font-black uppercase tracking-[0.2em] ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{i === 0 ? 'Option 1' : ok ? 'Option 2' : 'Option 2 · optional'}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[13px] font-black ${label(p) ? '' : 'text-gray-300 dark:text-gray-600'}`}>{label(p, true) || (i === 0 ? 'Pick a day & time' : 'A backup time')}</span>
                  </button>
                )
              })}
            </div>

            {/* the picker for whichever option is lit - slides across when it moves to the other one */}
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={slot} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit">
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  {slot === 0 ? 'Day' : <><span className="text-[var(--gp)]">Backup</span> · day</>}
                </p>
                <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {days.map((d, i) => {
                    const on = cur.day === i
                    const other = picks[1 - slot].day === i && done(picks[1 - slot])
                    return (
                      <motion.button key={i} type="button" whileTap={{ scale: 0.93 }} onClick={() => set({ day: i })}
                        className={`relative isolate flex w-[54px] shrink-0 flex-col items-center rounded-2xl border py-2 transition-colors ${on ? 'border-transparent text-white' : 'border-black/[0.08] hover:border-[var(--gp)] dark:border-white/[0.1]'}`}>
                        {on && <motion.span layoutId={`gp-tour-day-${slot}`} className="absolute inset-0 -z-10 rounded-2xl bg-[var(--gp)] shadow-[0_10px_20px_-8px_var(--gp)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                        <span className={`text-[9px] font-black uppercase tracking-wider ${on ? 'text-white/80' : 'text-gray-400'}`}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span className="text-lg font-black leading-tight">{d.getDate()}</span>
                        <span className={`text-[9px] font-bold ${on ? 'text-white/80' : 'text-gray-400'}`}>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                        {other && !on && <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-[8px] font-black text-white">{2 - slot}</span>}
                      </motion.button>
                    )
                  })}
                </div>

                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Time of day</p>
                <div className="mt-2 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                  {TOUR_PARTS.map(p => {
                    const on = cur.part === p.id
                    return (
                      <button key={p.id} type="button" onClick={() => set(on ? {} : { part: p.id, time: null })}
                        className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors ${on ? 'text-[#0B0B0B] dark:text-white' : 'text-gray-500 hover:text-[#0B0B0B] dark:text-gray-400 dark:hover:text-white'}`}>
                        {on && <motion.span layoutId={`gp-tour-part-${slot}`} className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                        <p.icon className="relative h-3.5 w-3.5" /><span className="relative">{p.id}</span>
                      </button>
                    )
                  })}
                </div>

                {/* suggested times for that part of the day - one tap and this option is done */}
                <div className="min-h-[52px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {part ? (
                      <motion.div key={part.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
                        className="mt-3 grid grid-cols-4 gap-1.5">
                        {[...part.times, ANY_TIME].map((t, i) => {
                          const on = cur.time === t
                          const taken = t !== ANY_TIME && cur.day != null && busyAt(busy, atTime(days[cur.day], t))
                          return (
                            <motion.button key={t} type="button" onClick={() => set({ time: t })} disabled={taken} title={taken ? `${agentFirst} is busy then` : undefined}
                              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 520, damping: 30 }}
                              whileTap={{ scale: 0.92 }}
                              className={`relative rounded-xl border py-2.5 text-[12px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through ${on ? 'border-[#0B0B0B] bg-[#0B0B0B] text-white dark:border-white dark:bg-white dark:text-[#0B0B0B]' : 'border-black/[0.08] hover:border-[var(--gp)] dark:border-white/[0.1]'}`}>
                              {t === ANY_TIME ? 'Any time' : t}
                              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                                className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--gp)] text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></motion.span>}
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    ) : (
                      <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-center text-xs font-semibold text-gray-400">
                        {cur.day == null ? 'Pick a day, then a time of day.' : 'Now pick morning, afternoon or evening.'}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>

            <button
              type="button"
              disabled={!ready}
              onClick={() => onSend(picks.filter(done).map(p => label(p)).join('  or  '))}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gp)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg transition-transform active:scale-[0.99] disabled:opacity-40"
            >
              <CalendarCheck className="h-4 w-4" /> {done(picks[0]) && done(picks[1]) ? 'Request Second Tour · 2 times' : 'Request Second Tour'}
            </button>
            <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-[11px] font-black uppercase tracking-widest text-gray-400">Not now</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Shell({ dark, accent, children }: { dark: boolean; accent: string; children: React.ReactNode }) {
  return (
    <div className={dark ? 'dark' : undefined} style={{ ['--gp' as any]: accent }}>
      <style>{'@keyframes gpShine{0%{background-position:150% 0}100%{background-position:-100% 0}}'}</style>
      <div className="min-h-screen bg-[#FAFAF7] text-[#0B0B0B] transition-colors duration-300 dark:bg-[#0B0B0B] dark:text-white">
        {children}
      </div>
    </div>
  )
}

export function Avatar({ agent, size = 40 }: { agent: GuestPassData['agent']; size?: number }) {
  return agent.photo_url ? (
    <img
      src={img(agent.photo_url)}
      alt={agent.name}
      style={{ width: size, height: size, objectPosition: agent.photo_position ? `${agent.photo_position.x}% ${agent.photo_position.y}%` : undefined }}
      className="shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-[#151517]"
    />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[var(--gp)] text-xs font-black text-white">
      {initials(agent.name)}
    </span>
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The open house's photos: flips on its own every few seconds until the guest takes over (an arrow
// tap or a swipe), then stays wherever they leave it.
function PhotoCarousel({ photos, alt, coverPosition, children }: {
  photos: string[]; alt: string; coverPosition?: { x: number; y: number } | null; children?: React.ReactNode
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const idxRef = useRef(0)
  const [idx, setIdx] = useState(0)
  const [auto, setAuto] = useState(true)
  const count = photos.length

  const scrollTo = (i: number) => {
    const el = stripRef.current
    if (!el || count < 2) return
    const n = (i + count) % count
    idxRef.current = n
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!auto || count < 2 || prefersReducedMotion()) return
    const t = window.setInterval(() => scrollTo(idxRef.current + 1), 4200)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, count])

  const onScroll = () => {
    const el = stripRef.current
    if (!el) return
    const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    idxRef.current = n
    setIdx(n)
  }
  const step = (d: number) => { setAuto(false); scrollTo(idxRef.current + d) }

  return (
    <div className="relative">
      <div
        ref={stripRef}
        onScroll={onScroll}
        onTouchStart={() => setAuto(false)}
        onWheel={() => setAuto(false)}
        className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:aspect-[16/8] [&::-webkit-scrollbar]:hidden"
      >
        {(count ? photos : ['']).map((p, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center bg-gray-100 dark:bg-[#1c1c1f]">
            {p && <img src={img(p)} alt={i === 0 ? alt : ''} loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full object-cover"
              style={i === 0 && coverPosition ? { objectPosition: `${coverPosition.x}% ${coverPosition.y}%` } : undefined} />}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      {count > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Previous photo"
            className="absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next photo"
            className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 active:scale-95">
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0 text-white">{children}</div>
        {count > 1 && (
          <span className="shrink-0 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black tracking-widest text-white ">{idx + 1} / {count}</span>
        )}
      </div>
    </div>
  )
}

function HomeView({ data, token, street, onSimilar, onOpenSimilar, onCheat, onRequest, sending, requestError, onShowcase, buildingShowcase, showcaseError }: {
  data: GuestPassData; token: string; street: string; onSimilar: () => void; onOpenSimilar: (key: string) => void; onCheat: () => void
  onRequest: (k: RequestKind) => void; sending: RequestKind | null; requestError: string | null
  onShowcase: () => void; buildingShowcase: boolean; showcaseError: string | null
}) {
  const { home, agent, guest } = data
  const facts = [
    home.beds ? { icon: Bed, v: home.beds, l: 'Beds' } : null,
    home.baths ? { icon: Bath, v: home.baths, l: 'Baths' } : null,
    home.sqft ? { icon: Ruler, v: Number(home.sqft).toLocaleString(), l: 'Sq Ft' } : null,
  ].filter(Boolean) as { icon: any; v: any; l: string }[]
  const small = [data.cheat_sheet ? 'cheat' : null, 'disclosure', 'second_visit'].filter(Boolean)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-4 pt-4 sm:pt-10">
      {/* Greeting - one tight line on phones so the home itself shows without scrolling. */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative">
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-44 w-72 rounded-full opacity-[0.16] blur-3xl dark:opacity-25" style={{ background: 'var(--gp)' }} />
        <p className="relative flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-[var(--gp)]">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Thanks for signing in
        </p>
        <h1 className="relative mt-1 text-[26px] font-black leading-[1.05] tracking-[-0.03em] sm:mt-2 sm:text-5xl">
          Welcome, <span className="text-[var(--gp)]">{guest.first_name || 'friend'}</span>.
        </h1>
        <p className="relative mt-2 hidden max-w-xl text-[15px] font-medium leading-relaxed text-gray-500 dark:text-gray-400 sm:block">
          Everything about {street} - in your pocket. Come back to it anytime.
        </p>
      </motion.div>

      {/* The home */}
      <motion.section
        initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.24, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)] dark:border-white/[0.07] dark:bg-[#141416] sm:mt-6"
      >
        {data.spotlight_url && (
          <a
            href={data.spotlight_url}
            target="_blank"
            rel="noopener"
            className="group relative flex items-center gap-3 overflow-hidden bg-[#0B0B0B] px-4 py-3 text-white sm:px-5 sm:py-3.5"
          >
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,color-mix(in_srgb,var(--gp)_45%,transparent)_50%,transparent_80%)] bg-[length:250%_100%] opacity-70 [animation:gpShine_4.5s_ease-in-out_infinite]" />
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--gp)] shadow-lg"><Sparkles className="h-4 w-4" /></span>
            <span className="relative min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-[var(--gp)]">Take the full tour</span>
              <span className="block text-sm font-bold leading-snug">Every photo, every room, the whole story</span>
            </span>
            <span className="relative flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors group-hover:bg-white group-hover:text-[#0B0B0B]">
              Open <ArrowUpRight className="h-3 w-3" />
            </span>
          </a>
        )}
        <PhotoCarousel photos={home.photos} alt={street} coverPosition={home.cover_position}>
          {money(home.price) && <p className="text-3xl font-black tracking-tight sm:text-4xl">{money(home.price)}</p>}
          <p className="mt-0.5 truncate text-sm font-bold text-white/85">{street}{cityLine(home.city, home.state) ? `, ${cityLine(home.city, home.state)}` : ''}</p>
        </PhotoCarousel>
        {facts.length > 0 && (
          <div className="grid grid-cols-3 divide-x divide-black/[0.06] dark:divide-white/[0.07]">
            {facts.map(f => (
              <div key={f.l} className="flex flex-col items-center gap-0.5 py-3">
                <span className="flex items-center gap-1.5 text-lg font-black tracking-tight"><f.icon className="h-4 w-4 text-[var(--gp)]" />{f.v}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{f.l}</span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Similar Homes - one long bar; the newest homes to hit the market shuffle on its right end. */}
      {data.similar.length > 0 && <SimilarFeature data={data} street={street} onSeeAll={onSimilar} onOpen={onOpenSimilar} />}

      {/* Then the Cheat Sheet and the two one-tap requests, three across. */}
      <div className={`mt-3 grid gap-2.5 sm:mt-4 sm:gap-4 ${small.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {data.cheat_sheet && (
          <Tile delay={0.22} onClick={onCheat} eyebrow="Guide" title="Cheat Sheet" body="Schools, taxes & nearby">
            <IconBadge><FileText className="h-5 w-5" /></IconBadge>
          </Tile>
        )}
        <Tile
          delay={0.26}
          onClick={() => onRequest('disclosure')}
          done={data.requested.disclosure}
          eyebrow="One tap"
          title="Seller Disclosure"
          body={<RequestState sending={sending === 'disclosure'} sent={data.requested.disclosure} sentText="Requested" idle={`Get it from ${agent.first_name}`} />}
        >
          <IconBadge done={data.requested.disclosure}><ScanSearch className="h-5 w-5" /></IconBadge>
        </Tile>
        <Tile
          delay={0.3}
          onClick={() => onRequest('second_visit')}
          done={data.requested.second_visit}
          eyebrow="One tap"
          title="Second Tour"
          body={<RequestState sending={sending === 'second_visit'} sent={data.requested.second_visit} sentText="Requested" idle="See it again, just you" />}
        >
          <IconBadge done={data.requested.second_visit}><CalendarCheck className="h-5 w-5" /></IconBadge>
        </Tile>
      </div>
      {requestError && <p className="mt-3 text-center text-xs font-bold text-red-500">{requestError}</p>}
      <p className="mt-3 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">
        Requests go straight to {agent.name} with the info you signed in with.
      </p>

      {/* Where it is: the home's township, the ones around it and its school district (user, 10/18). */}
      {data.home.latitude != null && data.home.longitude != null && (
        <section className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a8843a] dark:text-[#e8c97a]">Where it is</p>
          <h3 className="mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white">Town lines &amp; schools</h3>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">The township {street} is in, and its school district.</p>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-black/[0.06] shadow-[0_18px_50px_-30px_rgba(0,0,0,0.4)] dark:border-white/[0.07]">
            <HomeAreaMap latitude={Number(data.home.latitude)} longitude={Number(data.home.longitude)} address={data.home.address} className="h-[300px] w-full sm:h-[380px]" rounded="" />
          </div>
        </section>
      )}

      {data.similar.length === 0 && data.showcase && (
        <div className="mt-6"><ShowcaseCta data={data} onShowcase={onShowcase} building={buildingShowcase} error={showcaseError} /></div>
      )}

      <AskQuestion agent={agent} token={token} />

      {data.signature_hub_slug ? (
        <div className="mt-8"><SignatureSiteCard hubSlug={data.signature_hub_slug} towns={data.home.city ? [data.home.city] : []} fallback={<AgentCard agent={agent} street={street} />} /></div>
      ) : (
        <AgentCard agent={agent} street={street} />
      )}
    </div>
  )
}

const domOf = (p: any): number | null => {
  const d = Number(p.DaysOnMarket ?? p.daysOnMarket ?? p.dom)
  return Number.isFinite(d) && d >= 0 ? d : null
}

// The Similar Homes card: left - how many homes are like this one, live; right - the three newest to
// the market flipping through (photo, days on market top right, address over price at the bottom).
// Tapping the photo opens that home, anything else opens the whole list.
function SimilarFeature({ data, street, onSeeAll, onOpen }: {
  data: GuestPassData; street: string; onSeeAll: () => void; onOpen: (key: string) => void
}) {
  const homes = useScoredSimilar(data)
  const newest = useMemo(() => {
    const pool = homes.filter(p => p.ListPictureURL || p.image)
    return [...(pool.length ? pool : homes)]
      .sort((a, b) => (domOf(a) ?? 9999) - (domOf(b) ?? 9999))
      .slice(0, 3)
  }, [homes])
  const [i, setI] = useState(0)
  useEffect(() => {
    if (newest.length < 2 || prefersReducedMotion()) return
    const t = window.setInterval(() => setI(n => (n + 1) % newest.length), 3600)
    return () => window.clearInterval(t)
  }, [newest.length])
  const p = newest[i % Math.max(1, newest.length)]
  if (!p) return null
  const photo = p.ListPictureURL || p.image
  const price = Number(p.ListPrice || p.price) || 0
  const dom = domOf(p)

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}
      className="relative mt-3 flex h-[156px] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_18px_50px_-28px_rgba(0,0,0,0.45)] dark:border-white/[0.07] dark:bg-[#141416] sm:mt-4 sm:h-[184px]"
    >
      <div aria-hidden className="pointer-events-none absolute -left-12 -top-14 h-40 w-40 rounded-full opacity-[0.12] blur-3xl dark:opacity-20" style={{ background: 'var(--gp)' }} />
      <button type="button" onClick={onSeeAll} className="group relative flex min-w-0 flex-1 flex-col justify-center gap-2 py-3 pl-5 pr-3 text-left sm:gap-2.5 sm:pl-8 sm:pr-6">
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-[var(--gp)] sm:text-[10px]">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
          Similar Homes · Live
        </span>
        <span className="text-[17px] font-black leading-[1.12] tracking-[-0.02em] sm:text-[26px]">
          {homes.length} {homes.length === 1 ? 'home' : 'homes'} like<br className="sm:hidden" /> {street}
        </span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#0B0B0B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-transform group-active:scale-95 dark:bg-white dark:text-[#0B0B0B] sm:px-4 sm:text-[11px]">
          See all <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>

      <div className="relative my-2 mr-2 w-[48%] shrink-0 sm:w-[42%]" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.button
            key={listingKeyOf(p)}
            type="button"
            onClick={() => onOpen(listingKeyOf(p))}
            aria-label={`Open ${streetOf(p.FullStreetAddress || p.address)}`}
            initial={{ rotateY: 80, opacity: 0.4 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -80, opacity: 0.4 }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="group absolute inset-0 overflow-hidden rounded-[22px] bg-gray-100 text-left shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)] dark:bg-[#1c1c1f]"
          >
            {photo && <img src={img(photo)} alt="" className="h-full w-full object-cover transition-transform duration-[2500ms] group-hover:scale-105" />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
            <span className="absolute right-2 top-2 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#0B0B0B] shadow">
              {dom != null ? `${dom} DOM` : 'New'}
            </span>
            {p.LiveStatus && (
              <span className="absolute left-2 top-2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white shadow">{p.LiveStatus}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex flex-col px-3 pb-2.5 text-white sm:px-4 sm:pb-3.5">
              <span className="truncate text-[10px] font-bold text-white/85 sm:text-xs">{streetOf(p.FullStreetAddress || p.address)}</span>
              <span className="text-[17px] font-black leading-tight tracking-tight sm:text-2xl">{money(price) || 'Price N/A'}</span>
            </span>
          </motion.button>
        </AnimatePresence>
        {newest.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 right-3 z-10 flex gap-1 sm:bottom-4 sm:right-4">
            {newest.map((_, n) => (
              <span key={n} className={`h-1 rounded-full transition-all duration-500 ${n === i % newest.length ? 'w-4 bg-white' : 'w-1 bg-white/50'}`} />
            ))}
          </span>
        )}
      </div>
    </motion.section>
  )
}

function IconBadge({ children, done }: { children: React.ReactNode; done?: boolean }) {
  return (
    <span className={`mb-2 flex h-10 w-10 items-center justify-center rounded-2xl sm:mb-3 sm:h-11 sm:w-11 ${done ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-[var(--gp)]'}`}
      style={done ? undefined : { backgroundColor: 'color-mix(in srgb, var(--gp) 13%, transparent)' }}>
      {children}
    </span>
  )
}

function Tile({ children, eyebrow, title, body, onClick, delay, done }: {
  children: React.ReactNode; eyebrow: string; title: string; body: React.ReactNode; onClick: () => void; delay: number; done?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay + 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex min-h-[136px] flex-col items-start overflow-hidden rounded-[22px] border bg-white p-3 text-left shadow-[0_14px_40px_-26px_rgba(0,0,0,0.45)] transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-24px_rgba(0,0,0,0.5)] sm:min-h-[160px] sm:p-5 dark:bg-[#141416] ${
        done ? 'border-emerald-500/30' : 'border-black/[0.06] hover:border-[var(--gp)] dark:border-white/[0.07]'
      }`}
    >
      {children}
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--gp)] sm:text-[9px]">{eyebrow}</span>
      <span className="mt-0.5 text-[14px] font-black leading-tight tracking-tight sm:text-lg">{title}</span>
      <span className="mt-1 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400 sm:text-[12px]">{body}</span>
    </motion.button>
  )
}

// A guest without an agent already got their own Showcase when they signed in (unless this open
// house has automatic Showcases off) - then this is simply the way back into it, not an offer to
// make another. "Create my Showcase" only shows when they don't have one yet.
export function ShowcaseCta({ data, onShowcase, building, error }: { data: GuestPassData; onShowcase: () => void; building: boolean; error: string | null }) {
  const street = streetOf(data.home.address)
  const has = !!data.showcase?.url
  const first = (data.guest.first_name || '').trim()
  const whose = possessive(first)
  // A fan of the homes waiting inside (similar homes first, else this home's own photos).
  const photos = [...data.similar.map(p => p.ListPictureURL || p.image), ...(data.home.photos || [])].filter(Boolean).slice(0, 3) as string[]
  const count = data.similar.length
  const fan = [
    { rot: -11, x: '-58%', y: 12, z: 1 },
    { rot: 10, x: '58%', y: 12, z: 2 },
    { rot: 0, x: '0%', y: 0, z: 3 },
  ]
  const agent = data.agent
  const agentPos = agent.photo_position ? `${agent.photo_position.x}% ${agent.photo_position.y}%` : 'center'
  // cursor-follow glow, same feel as the Tools page cards
  const glow = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--gx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--gy', `${e.clientY - r.top}px`)
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-[880px] overflow-hidden rounded-[30px] p-[1.5px] shadow-[0_40px_90px_-44px_rgba(0,0,0,0.85)]"
      style={{ background: 'linear-gradient(135deg, var(--gp), rgba(255,255,255,0.22) 42%, color-mix(in srgb, var(--gp) 70%, transparent))' }}
    >
      <style>{SHOWCASE_CSS}</style>
      <div onMouseMove={glow} className="group/sc relative isolate overflow-hidden rounded-[28.5px] px-5 py-5 text-white sm:px-8 sm:py-7"
        style={{ background: 'radial-gradient(110% 120% at 100% 0%, color-mix(in srgb, var(--gp) 38%, transparent), transparent 58%), radial-gradient(80% 90% at 0% 100%, color-mix(in srgb, var(--gp) 16%, transparent), transparent 60%), linear-gradient(140deg, #0a0a0b 0%, #121216 55%, #17140f 100%)' }}>
        {/* alive background, like the Tools page cards: drifting aurora, a faint grid, a big faint
            house that floats in place, cursor glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <span className="gp-sc-aurora-a absolute -bottom-28 -left-16 h-72 w-72 rounded-full blur-3xl" style={{ background: 'color-mix(in srgb, var(--gp) 30%, transparent)' }} />
          <span className="gp-sc-aurora-b absolute -top-28 left-1/4 h-56 w-96 rounded-full blur-3xl" style={{ background: 'color-mix(in srgb, var(--gp) 18%, transparent)' }} />
          <span className="gp-sc-grid absolute inset-0" />
          <Home className="gp-sc-mark absolute -bottom-12 -left-8 h-56 w-56" strokeWidth={0.8} />
          <span className="gp-sc-glow absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/sc:opacity-100" />
        </div>
        <span aria-hidden className="gp-sc-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
        {[['10%', '18%', 0], ['82%', '12%', 1.4], ['90%', '70%', 2.8], ['46%', '88%', 2], ['28%', '62%', 3.6]].map(([l, t, d], k) => (
          <span key={k} aria-hidden className="gp-sc-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
        ))}

        {/* Left: what it is. Right: the homes inside, what you can do there, and the way in. */}
        <div className="relative flex flex-col gap-5 md:flex-row md:items-stretch md:gap-9">
          <div className="flex min-w-0 flex-1 flex-col">
            <motion.p initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-1 pl-1.5 pr-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/85 ">
              <span className="gp-sc-badge relative grid h-5 w-5 place-items-center rounded-full bg-[var(--gp)] text-white"><Sparkles className="h-3 w-3" /></span>
              {has ? 'Made for you' : 'Just for you'}
            </motion.p>
            <h3 className="mt-3 text-[1.65rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-[2.2rem]">
              {has
                ? <><span className="gp-sc-name">{whose}</span> Showcase</>
                : <>Want more homes like <span className="gp-sc-name">{street}</span>?</>}
            </h3>
            <p className="mt-2 flex items-start gap-1.5 text-[13.5px] font-bold leading-snug text-white/90 sm:text-[15px]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gp)]" />
              <span>{has ? <>Picked for you after your visit to <span className="whitespace-nowrap">{street}</span>.</> : `${first ? `${first}, get` : 'Get'} your own private Showcase, built from today's visit.`}</span>
            </p>
            <p className="mb-4 mt-1.5 max-w-md text-[12.5px] font-medium leading-relaxed text-white/60 sm:text-[14px]">Love, pass or comment on homes, book tours - and see new matches the moment they list.</p>

            {/* who made it + it stays live */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] px-2.5 py-2 md:mt-auto">
              {agent.photo_url
                ? <img src={agent.photo_url} alt={agent.name} className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[var(--gp)] ring-offset-2 ring-offset-[#121216]" style={{ objectPosition: agentPos }} />
                : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gp)] text-[11px] font-black text-white">{(agent.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</span>}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[12px] font-semibold text-white/55">{has ? 'Curated by' : 'Built for you by'} <span className="font-black text-white">{agent.name}</span></p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-semibold text-white/50">
                  <span className="relative flex h-1.5 w-1.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
                  {has ? 'Live - prices and status stay current' : 'Free - ready in a few seconds'}
                </p>
              </div>
            </motion.div>
          </div>

          <div className="w-full shrink-0 md:mr-2 md:w-[360px] md:self-center lg:mr-6 lg:w-[380px]">
            {photos.length > 0 && (
              <div className="relative mx-auto h-[96px] w-[200px] sm:h-[132px] sm:w-[285px]">
                {/* a little life, like the forms' welcome screen: two glass chips bobbing by the photos */}
                <motion.span aria-hidden className="gp-sc-chip absolute -left-14 top-3 z-20 hidden items-center gap-1.5 sm:flex"
                  initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: [0, -6, 0], rotate: [-4, -2, -4] }} viewport={{ once: true }}
                  transition={{ opacity: { delay: 0.8, duration: 0.5 }, y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' } }}>
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-[var(--gp)] text-white"><Sparkles className="h-3 w-3" /></span>
                  <span className="leading-none"><span className="block text-[8px] font-black uppercase tracking-[0.18em] text-white/55">New match</span><span className="block text-[11px] font-black text-white">Just listed</span></span>
                </motion.span>
                <motion.span aria-hidden className="gp-sc-chip absolute -right-14 bottom-5 z-20 hidden items-center gap-1.5 sm:flex"
                  initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: [0, 6, 0], rotate: [4, 2, 4] }} viewport={{ once: true }}
                  transition={{ opacity: { delay: 1.1, duration: 0.5 }, y: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' } }}>
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-500 text-white"><CalendarCheck className="h-3 w-3" /></span>
                  <span className="leading-none"><span className="block text-[8px] font-black uppercase tracking-[0.18em] text-white/55">Tour</span><span className="block text-[11px] font-black text-white">Booked</span></span>
                </motion.span>
                {photos.map((src, k) => {
                  const f = fan[3 - photos.length + k]
                  return (
                    <motion.div key={k}
                      initial={{ opacity: 0, rotate: 0, x: '0%', y: 20 }} whileInView={{ opacity: 1, rotate: f.rot, x: f.x, y: f.y }} viewport={{ once: true }}
                      transition={{ delay: 0.25 + k * 0.12, type: 'spring', stiffness: 140, damping: 16 }}
                      className="absolute inset-x-[26%] inset-y-0 overflow-hidden rounded-2xl ring-2 ring-white/80 shadow-[0_24px_40px_-18px_rgba(0,0,0,0.9)]"
                      style={{ zIndex: f.z }}>
                      <img src={img(src)} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </motion.div>
                  )
                })}
                {count > 0 && (
                  <span className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0B0B0B] shadow-lg">
                    {count} {count === 1 ? 'home' : 'homes'} inside
                  </span>
                )}
              </div>
            )}
            {/* What's waiting inside - four small, lit features. */}
            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {[
                { icon: Heart, label: 'Love or pass' },
                { icon: Scale, label: 'Compare' },
                { icon: CalendarCheck, label: 'Book tours' },
                { icon: BellRing, label: 'New matches' },
              ].map((f, k) => (
                <motion.div key={f.label}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.3 + k * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-1 py-1.5 text-center">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[var(--gp)]" style={{ backgroundColor: 'color-mix(in srgb, var(--gp) 18%, transparent)' }}><f.icon className="h-3 w-3" /></span>
                  <span className="whitespace-nowrap text-[10px] font-bold leading-tight text-white/85">{f.label}</span>
                </motion.div>
              ))}
            </div>
            <button
              type="button"
              onClick={onShowcase}
              disabled={building}
              className="gp-sc-shine relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#0B0B0B] shadow-[0_18px_36px_-16px_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-70"
            >
              {building ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your Showcase</> : <>{has ? 'Open Your Showcase' : 'Create My Showcase'} <ArrowUpRight className="h-4 w-4" /></>}
            </button>
            {error && <p className="mt-3 text-xs font-bold text-red-300">{error}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const SHOWCASE_CSS = `
.gp-sc-edge{background:linear-gradient(90deg,transparent 10%,var(--gp) 50%,transparent 90%);background-size:200% 100%;animation:gpScEdge 6s ease-in-out infinite}
@keyframes gpScEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.gp-sc-spark{width:4px;height:4px;border-radius:999px;background:var(--gp);box-shadow:0 0 10px 2px var(--gp);opacity:0;animation:gpScSpark 7s ease-in-out infinite}
@keyframes gpScSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.gp-sc-name{background-image:linear-gradient(100deg,color-mix(in srgb,var(--gp) 70%,#fff) 0%,#fff 45%,color-mix(in srgb,var(--gp) 70%,#fff) 90%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gpScGlint 5s 1s ease-in-out infinite;padding-right:.04em}
@keyframes gpScGlint{0%,100%{background-position:100% 0}50%{background-position:0% 0}}
.gp-sc-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.75) 50%,transparent 65%);transform:translateX(-100%);animation:gpScShine 3.6s ease-in-out infinite}
@keyframes gpScShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.gp-sc-aurora-a{animation:gpScDriftA 16s ease-in-out infinite}
.gp-sc-aurora-b{animation:gpScDriftB 19s ease-in-out infinite}
@keyframes gpScDriftA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(70px,-40px) scale(1.15)}}
@keyframes gpScDriftB{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-80px,30px) scale(1.1)}}
.gp-sc-grid{background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:30px 30px;-webkit-mask-image:radial-gradient(70% 80% at 100% 0%,#000,transparent 70%);mask-image:radial-gradient(70% 80% at 100% 0%,#000,transparent 70%)}
.gp-sc-mark{color:var(--gp);opacity:.09;transform:rotate(-8deg);animation:gpScMark 14s ease-in-out infinite alternate}
@keyframes gpScMark{from{transform:rotate(-8deg) translateY(0)}to{transform:rotate(-3deg) translateY(-12px)}}
.gp-sc-chip{border:1px solid rgba(255,255,255,.14);background:rgba(20,20,24,.72);border-radius:12px;padding:6px 10px 6px 6px;box-shadow:0 18px 40px -18px rgba(0,0,0,.9)}
.gp-sc-glow{background:radial-gradient(260px circle at var(--gx,70%) var(--gy,30%),color-mix(in srgb,var(--gp) 22%,transparent),transparent 70%)}
.gp-sc-badge:after{content:"";position:absolute;inset:-3px;border-radius:999px;border:1px solid var(--gp);animation:gpScBadge 2.4s ease-out infinite}
@keyframes gpScBadge{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.7);opacity:0}}
@media (prefers-reduced-motion:reduce){.gp-sc-edge,.gp-sc-spark,.gp-sc-name,.gp-sc-shine:after,.gp-sc-aurora-a,.gp-sc-aurora-b,.gp-sc-badge:after,.gp-sc-mark{animation:none}}
`

const QUICK_QUESTIONS = ['Are the sellers flexible on price?', 'Any offers yet?', 'How old is the roof?', 'What are the utilities like?']

// "Ask {agent} a quick question" - sent as the guest (their sign-in info) through the listing
// page's own message route: same lead activity, bell alert and follow-up as any home-page question.
function AskQuestion({ agent, token }: { agent: GuestPassData['agent']; token: string }) {
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const send = async () => {
    if (!text.trim() || state === 'sending') return
    setState('sending')
    const { success } = await api.public.guestPassQuestion(token, text.trim())
    setState(success ? 'sent' : 'error')
  }
  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.4)] dark:border-white/[0.07] dark:bg-[#141416] sm:p-7">
      <div className="flex items-center gap-3">
        <Avatar agent={agent} size={44} />
        <div className="min-w-0">
          <h3 className="text-lg font-black leading-tight tracking-tight sm:text-xl">Ask {agent.first_name} a quick question</h3>
          <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">&ldquo;I&rsquo;ll get back to you right away.&rdquo;</p>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {state === 'sent' ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
            <div className="min-w-0">
              <p className="text-sm font-black">Sent to {agent.first_name}</p>
              <p className="mt-0.5 text-[13px] font-semibold opacity-80">They&rsquo;ll reply using the contact info you signed in with.</p>
              <button type="button" onClick={() => { setText(''); setState('idle') }} className="mt-2 text-xs font-black uppercase tracking-widest underline-offset-4 hover:underline">Ask another</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button key={q} type="button" onClick={() => setText(q)}
                  className="rounded-full border border-black/[0.08] px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1] dark:text-gray-300">
                  {q}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={`Type your question for ${agent.first_name}...`}
              className="mt-3 w-full resize-none rounded-2xl border border-black/[0.08] bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium outline-none transition-colors placeholder:text-gray-400 focus:border-[var(--gp)] dark:border-white/[0.1] dark:bg-[#0B0B0B]"
            />
            {state === 'error' && <p className="mt-2 text-xs font-bold text-red-500">That didn&rsquo;t go through - try again in a moment.</p>}
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || state === 'sending'}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gp)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {state === 'sending' ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Send to {agent.first_name}</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function AgentCard({ agent, street }: { agent: GuestPassData['agent']; street: string }) {
  const phone = String(agent.phone || '').replace(/[^\d+]/g, '')
  const textPhone = String(agent.text_phone || agent.phone || '').replace(/[^\d+]/g, '')   // the number they text from
  const actions = [
    phone ? { icon: Phone, label: 'Call', href: `tel:${phone}` } : null,
    textPhone ? { icon: MessageSquare, label: 'Text', href: `sms:${textPhone}?&body=${encodeURIComponent(`Hi ${agent.first_name}, it's me from your open house at ${street}.`)}` } : null,
    agent.email ? { icon: Mail, label: 'Email', href: `mailto:${agent.email}?subject=${encodeURIComponent(street)}` } : null,
    agent.hub_url ? { icon: UserRound, label: 'My Hub', href: agent.hub_url, external: true } : null,
    agent.website_url ? { icon: Globe, label: 'Website', href: agent.website_url, external: true } : null,
  ].filter(Boolean) as { icon: any; label: string; href: string; external?: boolean }[]
  return (
    <section id="agent" className="mt-6 scroll-mt-20 rounded-[28px] border border-black/[0.06] bg-white p-5 dark:border-white/[0.07] dark:bg-[#141416] sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Your host</p>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar agent={agent} size={60} />
          <div className="min-w-0">
            <p className="truncate text-xl font-black tracking-tight">{agent.name}</p>
            {(agent.title || agent.brokerage) && <p className="truncate text-sm font-semibold text-gray-500 dark:text-gray-400">{[agent.title, agent.brokerage].filter(Boolean).join(' · ')}</p>}
            {agent.phone && <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{formatPhone(agent.phone)}</p>}
          </div>
        </div>
        {actions.length > 0 && (
          <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
            {actions.map(a => (
              <a key={a.label} href={a.href} {...(a.external ? { target: '_blank', rel: 'noopener' } : {})}
                className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/[0.08] text-[9px] font-black uppercase tracking-[0.12em] transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1] md:h-[68px] md:w-[68px]">
                <a.icon className="h-5 w-5 text-[var(--gp)]" />
                <span className="truncate">{a.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
