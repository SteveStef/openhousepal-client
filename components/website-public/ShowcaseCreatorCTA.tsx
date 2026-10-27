'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bell, Calendar, Check, Home as HomeIcon, Lock, MousePointer2, Sparkles, Target, ThumbsDown, ThumbsUp, TrendingDown, Zap } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import LuxuryAbstractBackground from './LuxuryAbstractBackground'
import Reveal from './Reveal'
import { sizedBg, sizedImage } from '@/lib/siteImage'

// "Create your own Showcase" - for the home BUYER on the agent's IDX site. A hands-free film on a
// laptop follows the real builder (/create-showcase) and the real Showcase page, with the agent's
// own listing photos and towns - nobody has to click anything to get it:
//   1. Pick a few things     - two towns get tapped, the price slides, 3+ beds, "Build my Showcase"
//   2. Your Showcase is made - it builds, and fills with only the homes that fit
//   3. Like or pass          - thumbs up one, pass on another
//   4. First to know         - a brand-new listing drops in with an alert, then a price drop
//   5. Tour in one tap       - a home opens, a day is picked, the tour is requested
// The steps beside the laptop light up in time with it. It only plays while on screen. Marked
// "Example" - the scores and the price drop are illustrative. (The real builder also asks how to
// send the homes - left out on purpose: the film makes it look as easy as it feels.)

interface FeaturedShowcaseListing {
  listing_key?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  photo?: string | null
}

const titleCase = (t: string) => t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase())
const money = (n?: number | null) => (n != null ? `$${Math.round(n).toLocaleString()}` : '')
const compact = (n?: number | null) => {
  if (!n) return 'Any'
  if (n >= 1_000_000) { const v = n / 1_000_000; return `$${Number.isInteger(v) ? v : v.toFixed(1)}M` }
  return `$${Math.round(n / 1000)}K`
}

// The film, in 100ms ticks.
const TICK = 100
const SCENES = [
  { key: 'pick', len: 82, icon: Target, title: 'Pick a few things', body: 'Your towns, your price, your bedrooms - a few taps. That’s it.' },
  { key: 'made', len: 34, icon: Sparkles, title: 'Your Showcase is made', body: 'Right away: a private page with every home for sale that fits you.' },
  { key: 'react', len: 44, icon: ThumbsUp, title: 'Like or pass', body: 'Thumbs up the ones you love - your favorites stay saved in one place.' },
  { key: 'alerts', len: 60, icon: Bell, title: 'Be the first to know', body: 'New listings and price drops land on your page - and in your inbox - the moment they happen.' },
  { key: 'tour', len: 58, icon: Calendar, title: 'Tour in one tap', body: 'Pick a day right from the home. I confirm it - done.' },
] as const
const STARTS = SCENES.reduce<number[]>((a, s, i) => { a.push(i ? a[i - 1] + SCENES[i - 1].len : 0); return a }, [])
const TOTAL = STARTS[SCENES.length - 1] + SCENES[SCENES.length - 1].len
const MATCH = [98, 96, 93, 91, 89, 87]

const WHY = [
  { icon: Zap, title: 'First to see new homes' },
  { icon: Target, title: 'Only homes that fit' },
  { icon: TrendingDown, title: 'Price drops, flagged' },
  { icon: Lock, title: 'Free & private' },
]
type Town = { name: string; photo?: string | null }

// The laptop is drawn at one size and scaled to its column, so it looks identical everywhere.
const SCREEN_W = 760
const SCREEN_H = 470

function useScale(ref: React.RefObject<HTMLDivElement | null>, design: number) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / design)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, design])
  return scale
}

export default function ShowcaseCreatorCTA({ theme, basePrefix, listings, agent }: {
  theme: SiteTheme
  basePrefix: string
  listings: FeaturedShowcaseListing[]
  agent?: { name?: string | null; photo_url?: string | null } | null
}) {
  const ink = theme.primary_color
  const serif = fontClass(theme.heading_font, 'font-serif')
  const luxe = theme.template !== 'default'
  const homes = useMemo(() => listings.filter(l => l.photo).slice(0, 7).map(l => ({ ...l, city: l.city ? titleCase(l.city) : l.city })), [listings])
  // The film's town tiles: the towns of the agent's own listings, each with one of its photos.
  const towns = useMemo(() => {
    const out: Town[] = []
    for (const l of homes) {
      const c = l.city?.trim() || ''
      if (c && !out.some(t => t.name === c)) out.push({ name: c, photo: l.photo })
      if (out.length >= 6) break
    }
    return out.length ? out : [{ name: 'Your town', photo: homes[0]?.photo }]
  }, [homes])
  const budget = useMemo(() => {
    const prices = homes.map(h => h.price).filter((p): p is number => !!p)
    return prices.length ? Math.max(...prices) : null
  }, [homes])
  const agentFirst = (agent?.name || '').trim().split(' ')[0] || 'Your agent'

  // Playback: runs only while the section is on screen.
  const root = useRef<HTMLElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  // The 10-a-second clock lives in FilmClock (just the laptop screen re-renders on each tick); this
  // section only hears about a scene change - it used to re-render all of itself 10 times a second.
  const [scene, setScene] = useState(0)
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') { setOnScreen(true); return }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0, rootMargin: '0px 0px -15% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const boxRef = useRef<HTMLDivElement>(null)
  const scale = useScale(boxRef, SCREEN_W + 80)

  if (homes.length < 3) return null

  return (
    <section ref={root} className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28" style={luxe ? { backgroundColor: ink } : { backgroundColor: 'var(--site-bg-alt)' }} data-testid="showcase-cta">
      {luxe && <LuxuryAbstractBackground accentColor={theme.secondary_color} />}
      <style>{CSS}</style>
      {/* Three pieces: the pitch, the laptop, the steps + button. Phones stack them in that order, so
          the film plays right under the headline (it sat below the steps and the button, out of
          sight while the steps lit up); from lg the laptop sits beside the pitch and the steps. */}
      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-x-16 lg:gap-y-0">
        {/* Words */}
        <Reveal className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] ${luxe ? 'border-white/15 bg-white/5' : ''}`}
            style={luxe ? { color: 'var(--site-accent-light)' } : { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-accent-text)' }}>
            <Sparkles className="h-3 w-3" /> Free · private · ready in a minute
          </span>
          <h2 className={`mt-5 text-4xl leading-[1.06] sm:text-5xl ${luxe ? `font-black text-white ${serif}` : 'font-extrabold tracking-tight'}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>
            Pick a few things. <span className={luxe ? 'ohp-text-shimmer' : ''} style={luxe ? undefined : { color: 'var(--site-accent)' }}>Get your own home search.</span>
          </h2>
          <p className={`mt-4 max-w-xl text-base leading-relaxed ${luxe ? 'text-white/70' : ''}`} style={luxe ? undefined : { color: 'var(--site-muted)' }}>
            Choose your towns, your price and your bedrooms - and your <b className={luxe ? 'text-white' : ''} style={luxe ? undefined : { color: 'var(--site-heading)' }}>Showcase</b> is made on the spot: a private page with every home for sale that fits you, kept up to date for you. Like or pass on homes, hear about new ones first, and ask {agentFirst} for a tour in one tap.
          </p>
        </Reveal>

        {/* The laptop */}
        <Reveal delay={150} className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div ref={boxRef} className="relative w-full" style={{ height: (SCREEN_H + 70) * scale }}>
            <div className="absolute left-1/2 top-0 origin-top" style={{ width: SCREEN_W + 80, transform: `translateX(-50%) scale(${scale})` }}>
              <Laptop luxe={luxe}>
                <FilmClock running={onScreen} onScene={setScene} homes={homes} towns={towns} budget={budget} agentFirst={agentFirst} agentPhoto={agent?.photo_url ? resolveMediaUrl(agent.photo_url) : null} />
              </Laptop>
            </div>
            <p className={`absolute -bottom-1 left-0 right-0 text-center text-[10px] font-black uppercase tracking-[0.3em] ${luxe ? 'text-white/60' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>Example</p>
          </div>
        </Reveal>

        <Reveal className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <ol className="space-y-2.5 lg:mt-8">
            {SCENES.map((s, i) => {
              const on = i === scene
              const Icon = s.icon
              return (
                <li key={s.key} className={`relative overflow-hidden rounded-2xl border px-4 py-3 transition-all duration-500 ${on ? 'shadow-lg' : 'opacity-60'}`}
                  style={luxe
                    ? { borderColor: on ? 'rgba(var(--site-accent-rgb),.5)' : 'rgba(255,255,255,.08)', backgroundColor: on ? 'rgba(255,255,255,.06)' : 'transparent' }
                    : { borderColor: on ? 'rgba(var(--site-accent-rgb),.45)' : 'var(--site-line)', backgroundColor: on ? 'var(--site-surface)' : 'transparent' }}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition"
                      style={on ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : luxe ? { backgroundColor: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)' } : { backgroundColor: 'var(--site-bg)', color: 'var(--site-muted)' }}>
                      {on ? <Icon className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[15px] font-black ${luxe ? 'text-white' : ''}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>{s.title}</span>
                      <span className={`grid transition-all duration-500 ${on ? 'mt-0.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <span className={`overflow-hidden text-sm leading-snug ${luxe ? 'text-white/65' : ''}`} style={luxe ? undefined : { color: 'var(--site-muted)' }}>{s.body}</span>
                      </span>
                    </span>
                  </div>
                  {on && <span key={`bar-${scene}-${onScreen}`} className="ohp-sc-bar absolute inset-x-0 bottom-0 h-0.5" style={{ backgroundColor: 'var(--site-accent)', animationDuration: `${s.len * TICK}ms`, animationPlayState: onScreen ? 'running' : 'paused' }} />}
                </li>
              )
            })}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={`${basePrefix}/create-showcase?site_chrome=1`} className={`inline-flex items-center gap-2 px-7 py-4 text-sm font-black transition hover:-translate-y-0.5 ${luxe ? 'ohp-gold-sheen rounded-full uppercase tracking-[0.14em]' : 'rounded-xl shadow-md'}`}
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
              Create my free Showcase <ArrowRight className="h-4 w-4" />
            </a>
            <span className={`text-xs font-bold ${luxe ? 'text-white/65' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>About a minute</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
            {WHY.map(w => (
              <span key={w.title} className={`inline-flex items-center gap-1.5 text-xs font-bold ${luxe ? 'text-white/70' : ''}`} style={luxe ? undefined : { color: 'var(--site-ink-soft)' }}>
                <w.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{w.title}
              </span>
            ))}
          </div>
        </Reveal>

      </div>
    </section>
  )
}

function Laptop({ luxe, children }: { luxe: boolean; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: SCREEN_W + 80 }}>
      <div className="relative mx-auto rounded-[22px] p-3 shadow-[0_60px_120px_-40px_rgba(0,0,0,.7)]" style={{ width: SCREEN_W + 24, background: 'linear-gradient(160deg,#2b2f36,#0e1014 60%)' }}>
        <div className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black/80 ring-1 ring-white/10" />
        <div className="relative overflow-hidden rounded-[10px] bg-[#ffffff]" style={{ width: SCREEN_W, height: SCREEN_H }}>
          {children}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,.10),transparent_40%)]" />
        </div>
      </div>
      <div className="relative mx-auto h-4 rounded-b-[18px]" style={{ width: SCREEN_W + 80, background: 'linear-gradient(180deg,#c8ccd2,#8d9198)' }}>
        <div className="absolute left-1/2 top-0 h-1.5 w-28 -translate-x-1/2 rounded-b-lg bg-black/25" />
      </div>
      <div className={`mx-auto h-3 rounded-[50%] blur-md ${luxe ? 'bg-black/60' : 'bg-black/25'}`} style={{ width: SCREEN_W }} />
    </div>
  )
}

type Home = FeaturedShowcaseListing

/** The film's clock: ticks while the section is on screen and tells the section when the scene changes. */
function FilmClock({ running, onScene, ...film }: {
  running: boolean; onScene: (scene: number) => void; homes: Home[]; towns: Town[]; budget: number | null; agentFirst: string; agentPhoto: string | null
}) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setT(v => (v + 1) % TOTAL), TICK)
    return () => clearInterval(id)
  }, [running])
  const scene = STARTS.reduce((acc, s, i) => (t >= s ? i : acc), 0)
  useEffect(() => { onScene(scene) }, [scene, onScene])
  return <Film scene={scene} local={t - STARTS[scene]} {...film} />
}

/** Where the pointer is at a tick: the key of the thing it's on, and whether it's pressing. */
type Aim = { at: string; down?: boolean }

/** What's on the laptop screen at tick `local` of `scene`. Pure function of time - no clicks. The
 *  pointer goes to the real element it "taps" (measured by its `data-c`), so it lands on the button
 *  at any size - it used to fly to fixed coordinates and miss, worst on phones (user, 10/27). */
function Film({ scene, local, homes, towns, budget, agentFirst, agentPhoto }: {
  scene: number; local: number; homes: Home[]; towns: Town[]; budget: number | null; agentFirst: string; agentPhoto: string | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [pt, setPt] = useState({ x: SCREEN_W - 140, y: SCREEN_H - 90 })
  const picks = towns.slice(0, Math.min(2, towns.length))
  const key = SCENES[scene].key
  const pick = key === 'pick'

  // ---- the script ----
  let aim: Aim = { at: 'rest' }
  let screen: 'towns' | 'needs' | 'building' | 'page' = 'page'
  if (pick) {
    screen = local < 40 ? 'towns' : 'needs'
    if (local < 40) {
      const k = Math.floor((local - 6) / 10)
      aim = local < 6 ? { at: 'rest' } : k < picks.length ? { at: `town-${k}`, down: (local - 6) % 10 >= 6 && (local - 6) % 10 < 9 } : { at: 'next', down: local >= 35 && local < 39 }
    } else {
      aim = local < 49 ? { at: 'thumb' } : local < 60 ? { at: 'thumb', down: true } : local < 70 ? { at: 'beds-3', down: local >= 65 && local < 68 } : { at: 'show', down: local >= 75 && local < 79 }
    }
  }
  if (key === 'made') screen = local < 14 ? 'building' : 'page'
  if (key === 'react') aim = local < 6 ? { at: 'rest' } : local < 22 ? { at: 'like-0', down: local >= 12 && local < 15 } : { at: 'pass-1', down: local >= 30 && local < 33 }
  if (key === 'tour') aim = local < 12 ? { at: 'card-0', down: local >= 6 && local < 9 } : local < 30 ? { at: 'day-2', down: local >= 23 && local < 26 } : { at: 'request', down: local >= 38 && local < 41 }

  // ---- what's on screen ----
  const picked = picks.filter((_, i) => !pick || local >= 40 || local >= 6 + i * 10 + 7)
  const slide = !pick ? 1 : Math.min(1, Math.max(0, (local - 49) / 11))
  const beds3 = !pick || local >= 66
  const shown = key === 'made' ? Math.max(0, Math.floor((local - 14) / 3)) : 6
  const liked = (key === 'react' && local >= 13) || key === 'alerts' || key === 'tour'
  const passed = (key === 'react' && local >= 31) || key === 'alerts' || key === 'tour'
  const fresh = homes[Math.min(6, homes.length - 1)]
  const base = homes.filter(h => h !== fresh).slice(0, 6)
  const showNew = (key === 'alerts' && local > 8) || key === 'tour'
  const grid = showNew ? [fresh, ...base.slice(0, 5)] : base
  const priceDrop = (key === 'alerts' && local > 32) || key === 'tour'
  const toast = key === 'alerts' ? (local > 8 && local < 28 ? 'new' : local > 32 && local < 54 ? 'drop' : null) : null
  const detail = key === 'tour' && local >= 8
  const day = key === 'tour' && local >= 24
  const requested = key === 'tour' && local >= 39
  const dropAt = 3
  const top = budget ? Math.round((budget * (0.4 + slide * 0.6)) / 50000) * 50000 : null

  // The pointer follows its target - measured every tick, so it tracks things that move (the
  // dragged slider thumb, cards settling into place).
  useLayoutEffect(() => {
    const root = box.current
    if (!root) return
    const b = root.getBoundingClientRect()
    const s = b.width / SCREEN_W || 1
    const track = aim.at === 'thumb' ? root.querySelector<HTMLElement>('[data-c="track"]') : null
    const el = aim.at === 'rest' ? null : root.querySelector<HTMLElement>(`[data-c="${aim.at}"]`)
    // The slider: aimed at where the thumb is going on the track (the thumb glides there over the
    // same 100ms as the pointer, so the two move as one), not where it's drawn mid-glide.
    const next = track
      ? (() => { const r = track.getBoundingClientRect(); return { x: (r.left + r.width * (0.3 + slide * 0.6) - b.left) / s, y: (r.top + r.height / 2 - b.top) / s } })()
      : el
      ? (() => { const r = el.getBoundingClientRect(); return { x: (r.left + r.width / 2 - b.left) / s, y: (r.top + r.height / 2 - b.top) / s } })()
      : { x: SCREEN_W - 140, y: SCREEN_H - 90 }
    setPt(p => (Math.abs(p.x - next.x) < 0.5 && Math.abs(p.y - next.y) < 0.5 ? p : next))
  })

  const url = screen === 'towns' || screen === 'needs' ? 'yoursite.com/create-showcase' : 'yoursite.com/my-showcase'
  const pressing = (k: string) => aim.at === k && aim.down
  return (
    <div ref={box} className="relative flex h-full flex-col bg-[#f6f5f1] text-[#121827]" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* browser chrome */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-black/5 bg-[#ffffff] px-3">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="mx-auto flex h-5 w-72 items-center justify-center gap-1 rounded-md bg-black/[.04] text-[10px] font-semibold text-black/45"><Lock className="h-2.5 w-2.5" />{url}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {screen === 'towns' && (
            <Step key="towns" n={1} title="Which towns?" sub="Tap every town you’d be happy living in.">
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {towns.slice(0, 6).map((tw, i) => {
                  const on = picked.includes(tw)
                  return (
                    <span key={tw.name} data-c={`town-${i}`} className={`relative h-[86px] overflow-hidden rounded-2xl border-2 transition-all duration-300 ${on ? 'scale-[1.03]' : ''} ${pressing(`town-${i}`) ? 'scale-95' : ''}`} style={{ borderColor: on ? 'var(--site-accent)' : 'transparent' }}>
                      {tw.photo ? <span className="ohp-mls-crop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(tw.photo, 384) }} /> : <span className="absolute inset-0" style={{ backgroundColor: 'var(--site-accent)' }} />}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <span className="absolute bottom-2 left-2.5 text-[13px] font-black text-white">{tw.name}</span>
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border-2 transition" style={{ backgroundColor: on ? 'var(--site-accent)' : 'rgba(0,0,0,.25)', borderColor: on ? 'var(--site-accent)' : 'rgba(255,255,255,.85)' }}>
                        {on && <Check className="h-3 w-3" strokeWidth={3} style={{ color: 'var(--site-on-accent)' }} />}
                      </span>
                    </span>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <span data-c="next" className={`inline-flex h-10 items-center gap-1.5 rounded-full px-6 text-[13px] font-black transition ${pressing('next') ? 'scale-95' : ''}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)', opacity: picked.length ? 1 : 0.4 }}>Next <ArrowRight className="h-3.5 w-3.5" /></span>
              </div>
            </Step>
          )}
          {screen === 'needs' && (
            <Step key="needs" n={2} title="What do you need?" sub="Leave anything you don’t mind about on “Any”.">
              <div className="mt-5 rounded-2xl border border-black/10 bg-[#ffffff] p-4">
                <div className="flex items-baseline justify-between"><span className="text-[12px] font-black">Price</span><span className="text-xl font-black tabular-nums" style={{ color: 'var(--site-accent-deep)' }}>Up to {compact(top)}</span></div>
                <div data-c="track" className="relative mt-3 h-1.5 rounded-full bg-black/10">
                  <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${30 + slide * 60}%`, backgroundColor: 'var(--site-accent)' }} />
                  <span data-c="thumb" className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md transition-[left] duration-100 ease-linear" style={{ left: `calc(${30 + slide * 60}% - 10px)`, backgroundColor: 'var(--site-accent)' }} />
                </div>
              </div>
              <p className="mt-4 text-[12px] font-black">Bedrooms</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {['Any', '2+', '3+', '4+', '5+'].map((b, i) => {
                  const on = beds3 ? b === '3+' : b === 'Any'
                  return <span key={b} data-c={`beds-${i + 1}`} className={`rounded-xl border-2 py-2 text-center text-[13px] font-black transition ${on ? 'text-white' : 'border-black/10 bg-[#ffffff] text-black/55'} ${pressing(`beds-${i + 1}`) ? 'scale-95' : ''}`} style={on ? { backgroundColor: '#111827', borderColor: '#111827' } : undefined}>{b}</span>
                })}
              </div>
              <div className="mt-5 flex justify-end">
                <span data-c="show" className={`inline-flex h-10 items-center gap-1.5 rounded-full px-6 text-[13px] font-black transition ${pressing('show') ? 'scale-95' : ''}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Sparkles className="h-3.5 w-3.5" /> Build my Showcase</span>
              </div>
            </Step>
          )}
          {screen === 'building' && (
            <motion.div key="building" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-full" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.14)' }}>
                  <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent" style={{ borderTopColor: 'var(--site-accent)' }} />
                  <HomeIcon className="h-8 w-8" style={{ color: 'var(--site-accent)' }} />
                </span>
                <p className="mt-4 text-[20px] font-black">Building your Showcase…</p>
                <p className="mt-1 text-[12px] font-semibold text-black/45">Looking in {picks.map(p => p.name).join(' & ') || 'your towns'}</p>
              </div>
            </motion.div>
          )}
          {screen === 'page' && (
            <motion.div key="page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-hidden px-6 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-deep)' }}>Your private Showcase</p>
                  <p className="text-xl font-black">{showNew ? '25' : '24'} homes fit you <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 align-middle text-[10px] font-black text-emerald-600">Updated just now</span></p>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-black/10 bg-[#ffffff] py-1 pl-1 pr-3 text-[11px] font-bold text-black/60">
                  {agentPhoto ? <img src={sizedImage(agentPhoto, 128)} loading="lazy" decoding="async" alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} />}
                  Ask {agentFirst}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5 text-[10px] font-black">
                {([['Matches', showNew ? 25 : 24], ['Liked', liked ? 1 : 0], ['Passed', passed ? 1 : 0]] as const).map(([l, n], i) => (
                  <span key={l} className={`rounded-full px-2.5 py-1 transition ${i === 0 ? 'bg-[#111827] text-white' : 'bg-black/[.05] text-black/55'}`}>{l} <span className="opacity-60">{n}</span></span>
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-3">
                <AnimatePresence initial={false}>
                  {grid.slice(0, 6).map((h, i) => {
                    const isLiked = liked && h === base[0]
                    const isPassed = passed && h === base[1]
                    return (
                      <motion.div key={h.listing_key || h.photo || i} data-c={`card-${i}`} layout initial={{ opacity: 0, scale: 0.9, y: 14 }} animate={{ opacity: i < shown ? (isPassed ? 0.45 : 1) : 0, scale: i < shown ? 1 : 0.94, y: i < shown ? 0 : 14 }} exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                        className={`relative overflow-hidden rounded-xl bg-[#ffffff] shadow-sm ring-1 ${showNew && i === 0 ? 'ring-2' : 'ring-black/5'}`} style={showNew && i === 0 ? { ['--tw-ring-color' as any]: 'var(--site-accent)' } : undefined}>
                        <div className="relative h-[78px] overflow-hidden">
                          <span className="ohp-mls-crop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(h.photo, 384) }} />
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#ffffff]/95 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{MATCH[i] || 85}% match</span>
                          {showNew && i === 0 && <span className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white" style={{ backgroundColor: 'var(--site-accent)' }}>NEW</span>}
                          {priceDrop && i === dropAt && <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white"><TrendingDown className="h-2.5 w-2.5" />$100K</span>}
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-black">{money(priceDrop && i === dropAt && h.price ? h.price - 100000 : h.price)}</span>
                            <span className="block truncate text-[9.5px] font-semibold text-black/50">{[h.bedrooms && `${h.bedrooms} bd`, h.city].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span data-c={`like-${i}`} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${isLiked ? 'scale-110 bg-emerald-600 text-white' : 'bg-black/[.05] text-black/45'}`}><ThumbsUp className="h-3 w-3" /></span>
                          <span data-c={`pass-${i}`} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${isPassed ? 'bg-rose-600 text-white' : 'bg-black/[.05] text-black/45'}`}><ThumbsDown className="h-3 w-3" /></span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {toast && (
                  <motion.div key={toast} initial={{ x: 260, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 260, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                    className="absolute right-4 top-3 z-20 flex w-[270px] items-center gap-2.5 rounded-2xl bg-[#111827] p-2.5 text-white shadow-2xl">
                    <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg"><span className="ohp-mls-crop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(toast === 'new' ? fresh.photo : grid[dropAt]?.photo, 256) }} /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-accent-light)' }}>{toast === 'new' ? <><Bell className="h-2.5 w-2.5" /> New match - just listed</> : <><TrendingDown className="h-2.5 w-2.5" /> Price drop</>}</span>
                      <span className="block truncate text-[12px] font-black">{toast === 'new' ? money(fresh.price) : `${money(grid[dropAt]?.price)} → ${money((grid[dropAt]?.price || 0) - 100000)}`}</span>
                      <span className="block truncate text-[10px] text-white/60">Also sent to your email</span>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {detail && grid[0] && (
                  <motion.div initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                    className="absolute bottom-0 right-0 top-0 z-10 w-[330px] border-l border-black/5 bg-[#ffffff] shadow-[-20px_0_40px_-20px_rgba(0,0,0,.3)]">
                    <div className="relative h-36 overflow-hidden"><span className="ohp-mls-crop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(grid[0].photo, 640) }} /></div>
                    <div className="p-4">
                      <p className="text-xl font-black">{money(grid[0].price)}</p>
                      <p className="truncate text-[11px] font-semibold text-black/50">{grid[0].address}{grid[0].city ? `, ${grid[0].city}` : ''}</p>
                      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Pick a day to tour</p>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {([['Thu', 8], ['Fri', 9], ['Sat', 10], ['Sun', 11]] as const).map(([d, n], i) => {
                          const on = day && i === 2
                          return <span key={n} data-c={`day-${i}`} className={`rounded-lg border py-1.5 text-center transition ${on ? 'border-transparent text-white' : 'border-black/10'} ${pressing(`day-${i}`) ? 'scale-95' : ''}`} style={on ? { backgroundColor: '#111827' } : undefined}><span className="block text-[8px] font-black uppercase opacity-60">{d}</span><span className="block text-sm font-black">{n}</span></span>
                        })}
                      </div>
                      <div data-c="request" className={`mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition ${requested ? 'bg-emerald-600 text-white' : ''} ${pressing('request') ? 'scale-95' : ''}`} style={requested ? undefined : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                        {requested ? <><Check className="h-4 w-4" /> Tour requested - {agentFirst} will confirm</> : <><Calendar className="h-3.5 w-3.5" /> Request a tour</>}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Cursor x={pt.x} y={pt.y} down={!!aim.down} drag={aim.at === 'thumb' && !!aim.down} />
    </div>
  )
}

/** One step of the real builder, the way a visitor sees it (progress bar + the question). */
function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }} className="absolute inset-0 flex justify-center px-10 pt-6">
      <div className="w-full max-w-[540px]">
        <div className="flex items-center gap-2">
          {[1, 2].map(i => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= n ? 'var(--site-accent)' : 'rgba(0,0,0,.1)' }} />)}
          <span className="text-[10px] font-black text-black/35">{n} / 2</span>
        </div>
        <p className="mt-4 text-[24px] font-black leading-tight">{title}</p>
        <p className="mt-0.5 text-[12.5px] font-semibold text-black/45">{sub}</p>
        {children}
      </div>
    </motion.div>
  )
}

/** The pointer - its tip (not the icon's corner) sits on the point. */
function Cursor({ x, y, down = false, drag = false }: { x: number; y: number; down?: boolean; drag?: boolean }) {
  // Dragging (the price slider): held on the thumb tick by tick, not trailing it on a spring.
  return (
    <motion.div className="pointer-events-none absolute left-0 top-0 z-30" initial={false} animate={{ x: x - 5, y: y - 3, scale: down ? 0.85 : 1 }} transition={drag ? { type: 'tween', ease: 'linear', duration: 0.1 } : { type: 'spring', stiffness: 140, damping: 20 }}>
      <MousePointer2 className="h-6 w-6 fill-[#111827] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.4)]" />
      {down && <span className="absolute -left-2.5 -top-2.5 h-9 w-9 animate-ping rounded-full opacity-40" style={{ backgroundColor: 'var(--site-accent)' }} />}
    </motion.div>
  )
}

const CSS = `
.ohp-sc-bar { transform-origin: left; animation-name: ohp-sc-bar-kf; animation-timing-function: linear; animation-fill-mode: both; }
@keyframes ohp-sc-bar-kf { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .ohp-sc-bar { animation: none; } }
`
