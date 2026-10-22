'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bell, Calendar, Check, Heart, Lock, MapPin, MousePointer2, Sparkles, Target, TrendingDown, Zap } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import LuxuryAbstractBackground from './LuxuryAbstractBackground'
import Reveal from './Reveal'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg, sizedImage } from '@/lib/siteImage'

// "Create your own Showcase" - for the home BUYER on the agent's IDX site. A hands-free film on a
// laptop shows exactly what a Showcase is, start to finish, with the agent's real listing photos
// and towns - nobody has to click anything to get it:
//   1. Tell us what you want   - towns get picked, the budget slides, "Create my Showcase"
//   2. Your own private page   - the page fills with only the homes that fit; one gets a heart
//   3. First to know           - a brand-new listing drops in with an alert, then a price drop
//   4. See it in one tap       - a home opens, a day is picked, the tour is requested
// The steps beside the laptop light up in time with it. It only plays while on screen. Marked
// "Example" - the buyer, scores and the price drop are illustrative.

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
  { key: 'setup', len: 62, icon: Target, title: 'Tell me what you want', body: 'Your towns, your budget, your must-haves - about thirty seconds.' },
  { key: 'page', len: 52, icon: Sparkles, title: 'Get your own private page', body: 'Every home for sale that fits you, and nothing that doesn’t. Heart the ones you love.' },
  { key: 'alerts', len: 64, icon: Bell, title: 'Be the first to know', body: 'New listings and price drops land on your page - and in your inbox - the moment they happen.' },
  { key: 'tour', len: 56, icon: Calendar, title: 'See it in one tap', body: 'Pick a day right from the home. I confirm it - done.' },
] as const
const STARTS = SCENES.reduce<number[]>((a, s, i) => { a.push(i ? a[i - 1] + SCENES[i - 1].len : 0); return a }, [])
const TOTAL = STARTS[3] + SCENES[3].len
const MATCH = [98, 96, 93, 91, 89, 87]

const WHY = [
  { icon: Zap, title: 'First to see new homes' },
  { icon: Target, title: 'Only homes that fit' },
  { icon: TrendingDown, title: 'Price drops, flagged' },
  { icon: Lock, title: 'Free & private' },
]

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
  const towns = useMemo(() => {
    const out: string[] = []
    for (const l of homes) { const c = l.city?.trim(); if (c && !out.includes(c)) out.push(c); if (out.length >= 3) break }
    return out.length ? out : ['Your town']
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
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        {/* Words */}
        <Reveal>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] ${luxe ? 'border-white/15 bg-white/5' : ''}`}
            style={luxe ? { color: 'var(--site-accent-light)' } : { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-accent-text)' }}>
            <Sparkles className="h-3 w-3" /> Free · private · made for you
          </span>
          <h2 className={`mt-5 text-4xl leading-[1.06] sm:text-5xl ${luxe ? `font-black text-white ${serif}` : 'font-extrabold tracking-tight'}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>
            Your own private home search - <span className={luxe ? 'ohp-text-shimmer' : ''} style={luxe ? undefined : { color: 'var(--site-accent)' }}>it finds the homes for you.</span>
          </h2>
          <p className={`mt-4 max-w-xl text-base leading-relaxed ${luxe ? 'text-white/70' : ''}`} style={luxe ? undefined : { color: 'var(--site-muted)' }}>
            A <b className={luxe ? 'text-white' : ''} style={luxe ? undefined : { color: 'var(--site-heading)' }}>Showcase</b> is a page made just for you with every home for sale that fits - and it keeps itself up to date. New listings and price drops show up the moment they happen, and {agentFirst} is one tap away.
          </p>
          <ol className="mt-8 space-y-2.5">
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
            <span className={`text-xs font-bold ${luxe ? 'text-white/65' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>Ready in 30 seconds</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
            {WHY.map(w => (
              <span key={w.title} className={`inline-flex items-center gap-1.5 text-xs font-bold ${luxe ? 'text-white/70' : ''}`} style={luxe ? undefined : { color: 'var(--site-ink-soft)' }}>
                <w.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{w.title}
              </span>
            ))}
          </div>
        </Reveal>

        {/* The laptop */}
        <Reveal delay={150}>
          <div ref={boxRef} className="relative w-full" style={{ height: (SCREEN_H + 70) * scale }}>
            <div className="absolute left-1/2 top-0 origin-top" style={{ width: SCREEN_W + 80, transform: `translateX(-50%) scale(${scale})` }}>
              <Laptop luxe={luxe}>
                <FilmClock running={onScreen} onScene={setScene} homes={homes} towns={towns} budget={budget} agentFirst={agentFirst} agentPhoto={agent?.photo_url ? resolveMediaUrl(agent.photo_url) : null} />
              </Laptop>
            </div>
            <p className={`absolute -bottom-1 left-0 right-0 text-center text-[10px] font-black uppercase tracking-[0.3em] ${luxe ? 'text-white/60' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>Example</p>
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
  running: boolean; onScene: (scene: number) => void; homes: Home[]; towns: string[]; budget: number | null; agentFirst: string; agentPhoto: string | null
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

/** What's on the laptop screen at tick `local` of `scene`. Pure function of time - no clicks. */
function Film({ scene, local, homes, towns, budget, agentFirst, agentPhoto }: {
  scene: number; local: number; homes: Home[]; towns: string[]; budget: number | null; agentFirst: string; agentPhoto: string | null
}) {
  const url = scene === 0 ? 'showcase.yoursite.com/start' : 'showcase.yoursite.com/s/sarah'
  return (
    <div className="flex h-full flex-col bg-[#f6f5f1] text-[#121827]" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* browser chrome */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-black/5 bg-[#ffffff] px-3">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="mx-auto flex h-5 w-72 items-center justify-center gap-1 rounded-md bg-black/[.04] text-[10px] font-semibold text-black/45"><Lock className="h-2.5 w-2.5" />{url}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {scene === 0 && <SetupScene key="setup" local={local} towns={towns} budget={budget} />}
          {scene >= 1 && <PageScene key="page" scene={scene} local={local} homes={homes} agentFirst={agentFirst} agentPhoto={agentPhoto} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Cursor({ x, y, down = false }: { x: number; y: number; down?: boolean }) {
  return (
    <motion.div className="pointer-events-none absolute left-0 top-0 z-30" animate={{ x, y, scale: down ? 0.82 : 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
      <MousePointer2 className="h-6 w-6 fill-[#111827] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.4)]" />
      {down && <span className="absolute -left-2 -top-2 h-8 w-8 animate-ping rounded-full bg-[color:var(--site-accent)] opacity-40" />}
    </motion.div>
  )
}

function SetupScene({ local, towns, budget }: { local: number; towns: string[]; budget: number | null }) {
  const picked = towns.filter((_, i) => local > 8 + i * 7)
  const slide = Math.min(1, Math.max(0, (local - 30) / 12))
  const beds = local > 46
  const press = local > 53 && local < 57
  const done = local >= 57
  // cursor path
  const cursor = local < 8 ? { x: 600, y: 360 }
    : local < 30 ? { x: 140 + Math.min(towns.length - 1, Math.floor((local - 8) / 7)) * 120, y: 128 }
      : local < 44 ? { x: 120 + slide * 470, y: 222 }
        : local < 50 ? { x: 300, y: 300 }
          : { x: 372, y: 388 }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="absolute inset-0 flex justify-center px-10 pt-7">
      <div className="w-full max-w-[520px]">
        <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent-deep)' }}>Takes 30 seconds</p>
        <p className="mt-1 text-[26px] font-black leading-tight">What are you looking for?</p>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Towns</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...towns, 'Anywhere nearby'].map(tw => {
            const on = picked.includes(tw)
            return (
              <span key={tw} className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-all duration-300 ${on ? 'scale-105 border-transparent text-white' : 'border-black/10 bg-[#ffffff] text-black/60'}`} style={on ? { backgroundColor: '#111827' } : undefined}>
                {on ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{tw}
              </span>
            )
          })}
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Budget</p>
        <div className="mt-2 rounded-2xl border border-black/10 bg-[#ffffff] p-3.5">
          <div className="flex items-baseline justify-between"><span className="text-xs font-bold text-black/50">Up to</span><span className="text-xl font-black">{compact(budget ? Math.round((budget * (0.35 + slide * 0.65)) / 50000) * 50000 : null)}</span></div>
          <div className="relative mt-2 h-1.5 rounded-full bg-black/10"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${20 + slide * 75}%`, backgroundColor: 'var(--site-accent)' }} /><span className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `calc(${20 + slide * 75}% - 8px)`, backgroundColor: 'var(--site-accent)' }} /></div>
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Bedrooms</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {['2+', '3+', '4+', '5+'].map(b => <span key={b} className={`rounded-xl border py-1.5 text-center text-xs font-black transition ${beds && b === '4+' ? 'border-transparent text-white' : 'border-black/10 bg-[#ffffff] text-black/55'}`} style={beds && b === '4+' ? { backgroundColor: '#111827' } : undefined}>{b}</span>)}
        </div>
        <div className={`mt-6 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all ${press ? 'scale-95' : ''}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
          {done ? <><Check className="h-4 w-4" /> Building your Showcase…</> : <>Create my Showcase <ArrowRight className="h-4 w-4" /></>}
        </div>
      </div>
      <Cursor x={cursor.x} y={cursor.y} down={press || (local > 8 && local < 30 && (local - 8) % 7 === 5)} />
    </motion.div>
  )
}

function PageScene({ scene, local, homes, agentFirst, agentPhoto }: { scene: number; local: number; homes: Home[]; agentFirst: string; agentPhoto: string | null }) {
  // Scene 1: the grid fills. Scene 2: a new listing drops in + a price drop. Scene 3: open one, book a tour.
  // The "just listed" home is never one already on the page.
  const fresh = homes[Math.min(6, homes.length - 1)]
  const base = homes.filter(h => h !== fresh).slice(0, 6)
  const showNew = scene >= 2 && (scene > 2 || local > 10)
  const grid = showNew ? [fresh, ...base.slice(0, 5)] : base
  const shown = scene === 1 ? Math.min(grid.length, Math.floor(local / 4)) : grid.length
  const loved = (scene === 1 && local > 38) || scene > 1
  const priceDrop = (scene === 2 && local > 38) || scene > 2
  const toast = scene === 2 ? (local > 6 && local < 34 ? 'new' : local > 38 && local < 62 ? 'drop' : null) : null
  const detail = scene === 3 && local > 8
  const day = scene === 3 && local > 22
  const requested = scene === 3 && local > 36
  const cursor = scene === 1
    ? (local < 30 ? { x: 560, y: 380 } : { x: 205, y: 104 })
    : scene === 2 ? { x: 690, y: 420 }
      : local < 8 ? { x: 120, y: 160 } : local < 22 ? { x: 470, y: 268 } : local < 36 ? { x: 600, y: 352 } : { x: 640, y: 380 }
  const press = (scene === 1 && local > 34 && local < 39) || (scene === 3 && ((local > 5 && local < 9) || (local > 19 && local < 23) || (local > 33 && local < 37)))
  const cardIndexWithDrop = 2
  const target = grid[0]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-hidden px-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-deep)' }}>Sarah’s private Showcase</p>
          <p className="text-xl font-black">{showNew ? '25' : '24'} homes fit you <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 align-middle text-[10px] font-black text-emerald-600">Updated just now</span></p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-black/10 bg-[#ffffff] py-1 pl-1 pr-3 text-[11px] font-bold text-black/60">
          {agentPhoto ? <img src={sizedImage(agentPhoto, 128)} loading="lazy" decoding="async" alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} />}
          Ask {agentFirst}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <AnimatePresence initial={false}>
          {grid.slice(0, 6).map((h, i) => (
            <motion.div key={h.listing_key || h.photo || i} layout initial={{ opacity: 0, scale: 0.9, y: 14 }} animate={{ opacity: i < shown ? 1 : 0, scale: i < shown ? 1 : 0.94, y: i < shown ? 0 : 14 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className={`relative overflow-hidden rounded-xl bg-[#ffffff] shadow-sm ring-1 ${showNew && i === 0 ? 'ring-2' : 'ring-black/5'}`} style={showNew && i === 0 ? { ['--tw-ring-color' as any]: 'var(--site-accent)' } : undefined}>
              <div className="relative h-[92px] bg-cover bg-center" style={{ backgroundImage: sizedBg(h.photo, 384) }}>
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#ffffff]/95 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">{MATCH[i] || 85}% match</span>
                {showNew && i === 0 && <span className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white" style={{ backgroundColor: 'var(--site-accent)' }}>NEW</span>}
                {priceDrop && i === cardIndexWithDrop && <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white"><TrendingDown className="h-2.5 w-2.5" />$100K</span>}
                <span className={`absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#ffffff]/95 transition ${loved && i === (showNew ? 1 : 0) ? 'scale-110' : ''}`}>
                  <Heart className={`h-3.5 w-3.5 ${loved && i === (showNew ? 1 : 0) ? 'fill-rose-500 text-rose-500' : 'text-black/50'}`} />
                </span>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[12px] font-black">{money(priceDrop && i === cardIndexWithDrop && h.price ? h.price - 100000 : h.price)}</p>
                <p className="truncate text-[9.5px] font-semibold text-black/50">{[h.bedrooms && `${h.bedrooms} bd`, h.city].filter(Boolean).join(' · ')}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast} initial={{ x: 260, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 260, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className="absolute right-4 top-3 z-20 flex w-[270px] items-center gap-2.5 rounded-2xl bg-[#111827] p-2.5 text-white shadow-2xl">
            <SitePhoto src={toast === 'new' ? fresh.photo : grid[cardIndexWithDrop]?.photo} widths={IMG.card} className="h-10 w-12 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-accent-light)' }}>{toast === 'new' ? <><Bell className="h-2.5 w-2.5" /> New match - just listed</> : <><TrendingDown className="h-2.5 w-2.5" /> Price drop</>}</span>
              <span className="block truncate text-[12px] font-black">{toast === 'new' ? money(fresh.price) : `${money(grid[cardIndexWithDrop]?.price)} → ${money((grid[cardIndexWithDrop]?.price || 0) - 100000)}`}</span>
              <span className="block truncate text-[10px] text-white/60">{toast === 'new' ? fresh.address : grid[cardIndexWithDrop]?.address}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && target && (
          <motion.div initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            className="absolute bottom-0 right-0 top-0 z-10 w-[330px] border-l border-black/5 bg-[#ffffff] shadow-[-20px_0_40px_-20px_rgba(0,0,0,.3)]">
            <SitePhoto src={target.photo} widths={IMG.card} className="h-36 w-full object-cover" />
            <div className="p-4">
              <p className="text-xl font-black">{money(target.price)}</p>
              <p className="truncate text-[11px] font-semibold text-black/50">{target.address}{target.city ? `, ${target.city}` : ''}</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Pick a day to tour</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[['Thu', 8], ['Fri', 9], ['Sat', 10], ['Sun', 11]].map(([d, n]) => {
                  const on = day && n === 10
                  return <span key={n} className={`rounded-lg border py-1.5 text-center transition ${on ? 'border-transparent text-white' : 'border-black/10'}`} style={on ? { backgroundColor: '#111827' } : undefined}><span className="block text-[8px] font-black uppercase opacity-60">{d}</span><span className="block text-sm font-black">{n}</span></span>
                })}
              </div>
              <div className={`mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition ${requested ? 'bg-emerald-600 text-white' : ''}`} style={requested ? undefined : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                {requested ? <><Check className="h-4 w-4" /> Tour requested - {agentFirst} will confirm</> : <><Calendar className="h-3.5 w-3.5" /> Request a tour</>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor x={cursor.x} y={cursor.y} down={press} />
    </motion.div>
  )
}

const CSS = `
.ohp-sc-bar { transform-origin: left; animation-name: ohp-sc-bar-kf; animation-timing-function: linear; animation-fill-mode: both; }
@keyframes ohp-sc-bar-kf { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .ohp-sc-bar { animation: none; } }
`
