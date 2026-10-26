'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Bell, Camera, Check, Copy, Images, Loader2, Mail, MessageSquare, MousePointer2, Sparkles, Train, Trees } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import { SpotlightIcon } from '@/components/icons/CustomIcons'
import TypingAnimation from '@/components/TypingAnimation'
import TitleSlide from './TitleSlide'
import DemoScroller from './DemoScroller'
import { AGENT, REAL_RECENT_SALES, REAL_SPOTLIGHT as L } from './realData'

// The real Spotlight flow, start to finish, on Peter's own Coming Soon listing (239 Windham Dr):
// pick the home ("Which home gets the spotlight?") -> the AI's first-open setup, each result
// appearing as it's made (photos + MLS details, the stand-outs, the short story, room-by-room
// sorting, About the town) -> pick a design (Luxe) -> the 9 guided steps tick done -> "Your page is
// live." with its own address + QR -> the published Luxe page scrolled section by section (hero
// with slow zoom + highlight marquee, The residence, Room by room, Life in Exton, What it could
// cost, See it for yourself) ending on a tour request landing in Leads. Copy is what the real AI
// wrote for this listing (REAL_SPOTLIGHT).

const SECTION_H = 420
const SITE_SECTIONS = 6
const OFFSETS = Array.from({ length: SITE_SECTIONS }, (_, i) => i * SECTION_H)
const SITE_HOLD = [5200, 4000, 7600, 4600, 4000, 5400]

const SETUP = [
  { label: `Pulling ${L.photoCount} photos + every MLS detail`, ms: 1700 },
  { label: 'Picking what stands out', ms: 1700 },
  { label: 'Writing the story', ms: 2300 },
  { label: 'Sorting the photos room by room', ms: 2300 },
  { label: `Writing about ${L.town.name}`, ms: 2800 },
]
const SPARK_MS = 2600
// What made each setup result - shown on it, so it's clear the AI did the work.
const SETUP_BY = ['From Bright MLS', 'Picked by AI', 'Written by AI', 'Sorted by AI', 'Written by AI']
const EDITOR_STEPS = ['Design', 'Header', 'Story', 'Stand-outs', 'The town', 'Rooms', 'Extras', 'Sections', 'Review & publish']
const STEP_SUMMARY = ['Luxe', 'Photo · slow zoom out', 'Short & polished', `${L.highlights.length} highlights`, `About ${L.town.name}`, `${L.rooms.length} rooms, sorted by AI`, 'Open houses synced', 'Payment, map, schools', 'Ready to share']

type Beat =
  | { k: 'title' } | { k: 'pick' } | { k: 'spark' } | { k: 'setup'; step: number } | { k: 'design' } | { k: 'publish' }
  | { k: 'site'; idx: number }
const BEATS: Beat[] = [
  { k: 'title' }, { k: 'pick' }, { k: 'spark' },
  ...SETUP.map((_, step) => ({ k: 'setup' as const, step })),
  { k: 'design' }, { k: 'publish' },
  ...Array.from({ length: SITE_SECTIONS }, (_, idx) => ({ k: 'site' as const, idx })),
]
function beatDuration(b: Beat): number {
  switch (b.k) {
    case 'title': return 4800
    case 'pick': return 4800
    case 'spark': return SPARK_MS
    case 'setup': return SETUP[b.step].ms
    case 'design': return 3800
    case 'publish': return 8400
    case 'site': return SITE_HOLD[b.idx]
  }
}
const TOTAL_PAGES = 5 + SITE_SECTIONS
function pageFor(b: Beat): number {
  switch (b.k) {
    case 'title': return 0
    case 'pick': return 1
    case 'spark': return 2
    case 'setup': return 2
    case 'design': return 3
    case 'publish': return 4
    case 'site': return 5 + b.idx
  }
}

const money = (n: number) => `$${n.toLocaleString()}`
const SETUP_PHOTOS = [L.hero, L.rooms[0].photo, L.rooms[1].photo, L.rooms[2].photo, L.rooms[3].photo, L.rooms[4].photo, ...L.rooms.flatMap(r => r.thumbs)].slice(0, 12)

const CSS = `
@keyframes spZoom{from{transform:scale(1.16)}to{transform:scale(1.02)}}
@keyframes spRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spRule{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes spToast{0%{opacity:0;transform:translateY(-14px) scale(.96)}100%{opacity:1;transform:none}}
@keyframes spShine{0%,60%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
.sp-zoom{animation:spZoom 9s cubic-bezier(.2,.6,.2,1) forwards}
.sp-rise{animation:spRise .7s cubic-bezier(.22,.61,.36,1) both}
.sp-rule{transform-origin:left;animation:spRule 1.1s .2s cubic-bezier(.22,.61,.36,1) both}
.sp-toast{animation:spToast .6s cubic-bezier(.34,1.56,.64,1) both}
.sp-shine{position:relative;overflow:hidden}.sp-shine:after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);animation:spShine 3.2s ease-in-out infinite}
.sp-num{-webkit-text-stroke:1px #C9A24D;color:transparent}
@keyframes spOrbit{to{transform:rotate(360deg)}}
@keyframes spPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(201,162,77,.55)}50%{transform:scale(1.06);box-shadow:0 0 0 18px rgba(201,162,77,0)}}
@keyframes spBar{0%{background-position:0% 0}100%{background-position:200% 0}}
@keyframes spGlow{0%,100%{opacity:.55}50%{opacity:1}}
.sp-orbit{animation:spOrbit 6s linear infinite}
.sp-pulse{animation:spPulse 1.8s ease-in-out infinite}
.sp-aibar{background:linear-gradient(90deg,transparent,#C9A24D,#f3dfa8,#C9A24D,transparent);background-size:200% 100%;animation:spBar 1.6s linear infinite}
.sp-glow{animation:spGlow 2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sp-zoom,.sp-rise,.sp-rule,.sp-toast,.sp-shine:after,.sp-orbit,.sp-pulse,.sp-aibar,.sp-glow{animation:none}}
`

function Cursor() {
  return (
    <span className="pointer-events-none absolute -bottom-2 -right-2 z-20">
      <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
      <MousePointer2 className="relative h-4 w-4 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
    </span>
  )
}

// The editor's numbered step bar, as on the real Spotlight editor.
function StepBar({ active, done }: { active: number; done: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {EDITOR_STEPS.map((s, i) => {
        const isDone = i < done
        const isActive = i === active && !isDone
        return (
          <span key={s} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[6.5px] font-black transition-all duration-300 ${isActive ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : isDone ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-gray-400'}`}>
            <span className={`flex h-2.5 w-2.5 items-center justify-center rounded-full text-[5px] ${isActive ? 'bg-[#C9A24D] text-[#111827]' : isDone ? 'bg-emerald-500 text-white' : 'border border-gray-300 dark:border-gray-600'}`}>{isDone ? <Check className="h-1.5 w-1.5" strokeWidth={4} /> : i + 1}</span>
            {s}
          </span>
        )
      })}
    </div>
  )
}

export default function ListingPageDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const beat = BEATS[i]

  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const t = setTimeout(() => setI(n => (n + 1) % BEATS.length), beatDuration(beat))
    return () => { clearTimeout(t); clearInterval(ticker) }
  }, [i, beat])

  if (beat.k === 'title') {
    return (
      <TitleSlide
        icon={SpotlightIcon as unknown as LucideIcon}
        kicker="Listing" ai
        title="Listing Spotlight"
        body="A cinematic website for every listing, built for you."
        durationMs={beatDuration(beat)}
        totalPages={TOTAL_PAGES}
        pageIndex={0}
        url="app.openhousepal.com/studio/property-sites"
      />
    )
  }

  const progress = { pages: TOTAL_PAGES, current: pageFor(beat), durationMs: beat.k === 'setup' || beat.k === 'spark' ? SPARK_MS + SETUP.reduce((a, s) => a + s.ms, 0) : beatDuration(beat) }
  const url = beat.k === 'site' ? L.subdomain : 'app.openhousepal.com/studio/property-sites'

  // ---- 1 · Pick the home ----
  if (beat.k === 'pick') {
    const picked = tick >= 9
    const options = [
      { address: L.address, city: L.city, price: L.price, photo: L.hero, tag: 'Your new listing', pick: true },
      { address: REAL_RECENT_SALES[1].address, city: REAL_RECENT_SALES[1].city, price: REAL_RECENT_SALES[1].price, photo: REAL_RECENT_SALES[1].photo, tag: 'Sold', pick: false },
      { address: REAL_RECENT_SALES[2].address, city: REAL_RECENT_SALES[2].city, price: REAL_RECENT_SALES[2].price, photo: REAL_RECENT_SALES[2].photo, tag: 'Sold', pick: false },
    ]
    return (
      <BrowserFrame url={url} progress={progress}>
        <style>{CSS}</style>
        <div className="relative h-[420px] overflow-hidden bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] px-6 pt-7">
          <span className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-[#C9A24D]/25 blur-3xl" />
          <p className="sp-rise flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><span className="h-px w-6 bg-[#C9A24D]" />Spotlight Pages · New</p>
          <h4 className="sp-rise mt-1.5 font-serif text-[22px] font-black leading-tight text-white" style={{ animationDelay: '80ms' }}>Which home gets <em className="font-light text-[#e8c97a]">the spotlight?</em></h4>
          <div className="mt-4 grid grid-cols-[1.35fr_1fr_1fr] gap-2.5">
            {options.map((o, k) => (
              <div key={o.address} className={`sp-rise relative overflow-hidden rounded-xl transition-all duration-500 ${o.pick && picked ? 'scale-[1.03] ring-2 ring-[#C9A24D] shadow-[0_18px_40px_-16px_rgba(201,162,77,.8)]' : 'ring-1 ring-white/10'}`} style={{ animationDelay: `${160 + k * 90}ms` }}>
                <div className="relative h-36">
                  <Image src={o.photo} alt={o.address} fill className="object-cover" unoptimized />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-wider ${o.pick ? 'bg-[#C9A24D] text-[#111827]' : 'bg-white/85 text-[#111827]'}`}>{o.tag}</span>
                  <span className="absolute inset-x-2 bottom-1.5">
                    <span className="block truncate font-serif text-[11px] font-black text-white">{o.address}</span>
                    <span className="block text-[7px] font-bold text-white/70">{o.city} · {money(o.price)}</span>
                  </span>
                  {o.pick && picked && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
                </div>
                {o.pick && tick >= 5 && !picked && <Cursor />}
              </div>
            ))}
          </div>
          <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${picked ? 'border-[#C9A24D]/60 bg-[#C9A24D]/10' : 'border-white/10 bg-white/[0.03]'}`}>
            <p className="text-[8px] font-semibold text-white/60">{picked ? <><span className="font-black text-[#f3dfa8]">{L.address}</span> - our AI sets up the whole page for you.</> : "Pick a home - we'll set up the whole page, then you choose the design one step at a time."}</p>
            {picked && (
              <span className={`sp-shine relative inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#f3dfa8] via-[#C9A24D] to-[#a8853d] px-2.5 py-1.5 text-[8px] font-black text-[#111827] shadow-[0_8px_20px_-8px_rgba(201,162,77,.9)] transition-transform duration-150 ${tick >= 15 ? 'scale-95' : ''}`}>
                <Sparkles className="h-3 w-3" /> Create with AI
                {tick >= 12 && <Cursor />}
              </span>
            )}
          </div>
        </div>
      </BrowserFrame>
    )
  }

  // ---- 1b · Create -> the AI takes over ----
  if (beat.k === 'spark') {
    return (
      <BrowserFrame url={url} progress={progress}>
        <style>{CSS}</style>
        <div className="relative flex h-[420px] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] text-center text-white">
          <Image src={L.hero} alt="" fill className="sp-zoom object-cover opacity-20" unoptimized />
          <span className="pointer-events-none absolute h-72 w-72 rounded-full bg-[#C9A24D]/25 blur-3xl sp-glow" />
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span className="sp-orbit absolute inset-0 rounded-full border border-dashed border-[#C9A24D]/50" />
            {[0, 72, 144, 216, 288].map(d => <span key={d} className="sp-orbit absolute inset-0" style={{ animationDelay: `-${d / 60}s` }}><Sparkles className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 text-[#f3dfa8]" /></span>)}
            <span className="sp-pulse flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><Sparkles className="h-8 w-8" /></span>
          </div>
          <p className="sp-rise relative mt-5 text-[9px] font-black uppercase tracking-[0.35em] text-[#e8c97a]">AI</p>
          <p className="sp-rise relative mt-1 font-serif text-[24px] font-black leading-tight" style={{ animationDelay: '120ms' }}>Building <em className="font-light text-[#e8c97a]">{L.address}</em></p>
          <p className="sp-rise relative mt-1.5 text-[10px] font-semibold text-white/60" style={{ animationDelay: '240ms' }}>Photos, details, the story, the rooms and the town - done for you.</p>
          <div className="relative mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/10"><div className="sp-aibar h-full w-full" /></div>
        </div>
      </BrowserFrame>
    )
  }

  // ---- 2 · The AI sets it up, one result at a time ----
  if (beat.k === 'setup') {
    const s = beat.step
    return (
      <BrowserFrame url={url} progress={progress}>
        <style>{CSS}</style>
        <div className="grid h-[420px] grid-cols-[0.9fr_1.2fr] gap-3 bg-[#f7f5f1] p-4 dark:bg-[#0B0B0B] max-sm:grid-cols-1 max-sm:grid-rows-[auto_minmax(0,1fr)] max-sm:gap-2 max-sm:p-3">
          <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] p-3.5 text-white">
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-[#C9A24D]/60"><Image src={L.hero} alt="" fill className="object-cover" unoptimized /></div>
              <div className="min-w-0">
                <p className="truncate font-serif text-[11px] font-black">{L.address}</p>
                <p className="text-[6.5px] font-bold text-white/55">{L.city}, {L.state} · {L.status}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[7px] font-black uppercase tracking-[0.25em] text-[#e8c97a]"><span className="sp-pulse inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#f3dfa8] to-[#C9A24D] px-1.5 py-0.5 text-[6.5px] tracking-wider text-[#111827]"><Sparkles className="h-2 w-2" />AI</span> is setting up your page</p>
            <div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-white/10"><div className="sp-aibar h-full w-full" /></div>
            <div className="mt-2 space-y-1.5">
              {SETUP.map((st, k) => {
                const done = k < s
                const active = k === s
                return (
                  <div key={st.label} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-500 ${active ? 'bg-white/10 ring-1 ring-[#C9A24D]/50' : 'max-sm:hidden'}`}>
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-[#C9A24D]' : 'border border-white/25'}`}>
                      {done ? <Check className="h-2 w-2 text-white" strokeWidth={4} /> : active ? <Loader2 className="h-2 w-2 animate-spin text-[#111827]" /> : null}
                    </span>
                    <span className={`text-[7.5px] font-bold leading-tight ${done ? 'text-white/70' : active ? 'text-white' : 'text-white/35'}`}>{st.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-auto text-[6.5px] font-semibold leading-snug text-white/40 max-sm:hidden">Done for you the first time you open it. Every word and photo stays yours to change.</p>
          </div>

          <div key={s} className="sp-rise relative flex flex-col overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-white p-3 pt-6 shadow-[0_16px_34px_-24px_rgba(201,162,77,.9)] dark:bg-[#151517]">
            <div className="sp-aibar absolute inset-x-0 top-0 h-[2px]" />
            <span className={`absolute right-2.5 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-black ${s === 0 ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300' : 'sp-glow bg-gradient-to-r from-[#f3dfa8] to-[#C9A24D] text-[#111827]'}`}>{s === 0 ? null : <Sparkles className="h-2.5 w-2.5" />}{SETUP_BY[s]}</span>
            {s === 0 && (
              <>
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">{L.photoCount} photos · {L.beds} bd · {L.baths} ba · {L.sqft.toLocaleString()} sq ft · {L.acres} ac · built {L.yearBuilt}</p>
                <div className="mt-2 grid flex-1 grid-cols-4 gap-1">
                  {SETUP_PHOTOS.map((p, k) => (
                    <div key={k} className="relative overflow-hidden rounded-md transition-opacity duration-300" style={{ opacity: tick > k * 0.45 ? 1 : 0 }}>
                      <Image src={p} alt="" fill className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              </>
            )}
            {s === 1 && (
              <>
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Highlights · the phrases that scroll across your page</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {L.highlights.map((h, k) => (
                    <span key={h} className="rounded-full border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-2 py-1 text-[7.5px] font-black text-[#6b5530] transition-all duration-300 dark:text-[#e8c97a]" style={{ opacity: tick > k ? 1 : 0, transform: tick > k ? 'none' : 'translateY(4px)' }}>{h}</span>
                  ))}
                </div>
                <div className="relative mt-auto h-20 overflow-hidden rounded-lg"><Image src={L.rooms[0].photo} alt="" fill className="object-cover" unoptimized /></div>
              </>
            )}
            {s === 2 && (
              <>
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">The story · short &amp; polished</p>
                <p className="mt-2 font-serif text-[9px] leading-relaxed text-[#111827] dark:text-gray-200"><TypingAnimation text={L.story} speed={9} /></p>
                <div className="relative mt-auto h-24 overflow-hidden rounded-lg"><Image src={L.storyPhoto} alt="" fill className="object-cover" unoptimized /><span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[6px] font-black text-[#111827]"><Sparkles className="mr-0.5 inline h-2 w-2 text-[#C9A24D]" />Photo picked by AI</span></div>
              </>
            )}
            {s === 3 && (
              <>
                <p className="text-[7px] font-black uppercase tracking-widest text-gray-400">Room by room · {L.rooms.length} spaces that sell it</p>
                <div className="mt-2 flex flex-1 flex-col gap-1.5">
                  {L.rooms.map((r, k) => (
                    <div key={r.label} className="flex flex-1 items-center gap-2 rounded-lg border border-gray-100 p-1 transition-all duration-300 dark:border-gray-800" style={{ opacity: tick > k ? 1 : 0, transform: tick > k ? 'none' : 'translateX(8px)' }}>
                      <span className="sp-num w-5 shrink-0 text-center font-serif text-[15px] font-black">{String(k + 1).padStart(2, '0')}</span>
                      <div className="relative h-full min-h-[34px] w-16 shrink-0 overflow-hidden rounded"><Image src={r.photo} alt="" fill className="object-cover" unoptimized /></div>
                      <span className="min-w-0 flex-1 truncate text-[8px] font-black text-[#111827] dark:text-white">{r.label}</span>
                      <span className="text-[6.5px] font-bold text-gray-400">{r.thumbs.length + 2} photos</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {s === 4 && (
              <>
                <div className="relative h-28 overflow-hidden rounded-lg">
                  <Image src={L.town.photo} alt="" fill className="object-cover" unoptimized />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 right-2">
                    <span className="block text-[6px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">On your page</span>
                    <span className="block font-serif text-[15px] font-black text-white">Life in <em className="font-light text-[#e8c97a]">{L.town.name}.</em></span>
                  </span>
                </div>
                <p className="mt-2 font-serif text-[8.5px] italic text-gray-600 dark:text-gray-300">{L.town.tagline}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">{L.town.knownFor.map((k, n) => <span key={k} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[7px] font-bold text-gray-600 transition-opacity duration-300 dark:bg-white/10 dark:text-gray-300" style={{ opacity: tick > n + 1 ? 1 : 0 }}>{k}</span>)}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg border border-gray-100 p-1.5 dark:border-gray-800">
                    <p className="text-[6px] font-black uppercase tracking-widest text-gray-400">Getting around</p>
                    {L.town.gettingAround.map((g, n) => <p key={g.label} className="mt-0.5 flex items-start gap-1 text-[7px] font-bold leading-tight text-[#111827] transition-opacity duration-300 dark:text-white" style={{ opacity: tick > n + 3 ? 1 : 0 }}><Train className="mt-[1px] h-2 w-2 shrink-0 text-[#C9A24D]" /><span>{g.label}<span className="block font-semibold text-gray-400">{g.detail}</span></span></p>)}
                  </div>
                  <div className="rounded-lg border border-gray-100 p-1.5 dark:border-gray-800">
                    <p className="text-[6px] font-black uppercase tracking-widest text-gray-400">The outdoors</p>
                    {L.town.outdoors.map((o, n) => <p key={o} className="mt-0.5 flex items-center gap-1 text-[7px] font-bold text-[#111827] transition-opacity duration-300 dark:text-white" style={{ opacity: tick > n + 4 ? 1 : 0 }}><Trees className="h-2 w-2 text-[#C9A24D]" />{o}</p>)}
                  </div>
                </div>
                <p className="mt-auto text-[6px] text-gray-400">{L.town.photoCredit}</p>
              </>
            )}
          </div>
        </div>
      </BrowserFrame>
    )
  }

  // ---- 3 · Pick a design ----
  if (beat.k === 'design') {
    const chosen = tick >= 9
    return (
      <BrowserFrame url={url} progress={progress}>
        <style>{CSS}</style>
        <div className="flex h-[420px] flex-col bg-[#f7f5f1] p-4 dark:bg-[#0B0B0B]">
          <StepBar active={0} done={chosen ? 1 : 0} />
          <p className="mt-3 font-serif text-[15px] font-black text-[#111827] dark:text-white">Pick a design</p>
          <p className="text-[8px] font-semibold text-gray-500">This is your home in each design - live. Same content either way, switch any time.</p>
          <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
            {[{ id: 'editorial', name: 'Editorial Estate', blurb: 'Paper-light, like a magazine feature.' }, { id: 'luxe', name: 'Luxe', blurb: 'Midnight and gold - full-bleed and film-like.' }].map(d => {
              const on = d.id === 'luxe' && chosen
              const dark = d.id === 'luxe'
              return (
                <div key={d.id} className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-white p-2 transition-all duration-500 dark:bg-[#151517] ${on ? 'border-[#C9A24D] shadow-[0_16px_34px_-18px_rgba(201,162,77,.9)]' : 'border-gray-200 dark:border-gray-800'}`}>
                  <div className={`relative flex-1 overflow-hidden rounded-lg ${dark ? 'bg-[#0b0b0b]' : 'bg-[#f3efe6]'}`}>
                    {dark ? (
                      <>
                        <Image src={L.hero} alt="" fill className="object-cover" unoptimized />
                        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/40" />
                        <span className="absolute bottom-2 left-2.5"><span className="block text-[5.5px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">Coming soon</span><span className="block font-serif text-[16px] font-light text-white max-sm:text-[13px] max-sm:leading-tight">{L.address}</span><span className="block font-serif text-[9px] text-white/80">{money(L.price)}</span></span>
                      </>
                    ) : (
                      <div className="flex h-full gap-1.5 p-2">
                        <div className="flex w-[42%] flex-col justify-end"><span className="text-[5.5px] font-black uppercase tracking-[0.3em] text-[#8b7355]">{L.city}</span><span className="font-serif text-[14px] leading-none text-[#10201e] max-sm:text-[11px]">{L.address}</span><span className="mt-1 h-px w-8 bg-[#10201e]" /><span className="mt-1 font-serif text-[8px] text-[#10201e]">{money(L.price)}</span></div>
                        <div className="relative flex-1 overflow-hidden rounded"><Image src={L.hero} alt="" fill className="object-cover" unoptimized /></div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div><p className={`font-serif text-[11px] font-black ${dark ? 'italic text-[#a8853d] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{d.name}</p><p className="text-[6.5px] font-semibold text-gray-400">{d.blurb}</p></div>
                    <span className={`relative rounded-md px-2 py-1 text-[7px] font-black ${on ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{on ? '✓ Selected' : 'Select'}{dark && tick >= 4 && !chosen && <Cursor />}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </BrowserFrame>
    )
  }

  // ---- 4 · The guided steps finish, and it's live ----
  if (beat.k === 'publish') {
    const done = Math.min(EDITOR_STEPS.length, 1 + Math.floor(tick / 2.6))
    const live = done >= EDITOR_STEPS.length && tick >= 23
    return (
      <BrowserFrame url={url} progress={progress}>
        <style>{CSS}</style>
        <div className="flex h-[420px] flex-col bg-[#f7f5f1] p-4 dark:bg-[#0B0B0B]">
          <StepBar active={Math.min(done, EDITOR_STEPS.length - 1)} done={done} />
          <div className="relative mt-3 flex flex-1 gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] p-4 text-white">
            <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#C9A24D]/30 blur-3xl" />
            <div className="relative w-[46%] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
              <Image src={L.hero} alt="" fill className="sp-zoom object-cover" unoptimized />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              <span className="absolute bottom-2 left-2.5"><span className="block text-[5.5px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">Coming soon</span><span className="block font-serif text-[15px] font-light">{L.address}</span></span>
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col">
              <p className="text-[6.5px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">Step 9 · Review &amp; publish</p>
              <p className="mt-1 font-serif text-[20px] font-black leading-tight">{live ? <>Your page is <em className="font-light text-[#e8c97a]">live.</em></> : 'Almost there…'}</p>
              <p className="mt-0.5 text-[7.5px] font-semibold text-white/60">{done} of {EDITOR_STEPS.length} steps done{live ? ' - change anything later and it updates by itself.' : ''}</p>
              <div className="mt-2 flex gap-0.5">{EDITOR_STEPS.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${k < done ? 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]' : 'bg-white/15'}`} />)}</div>
              <div className="mt-2.5 grid grid-cols-3 gap-1">
                {EDITOR_STEPS.map((st, k) => (
                  <div key={st} className={`rounded-lg p-1.5 transition-all duration-500 ${k < done ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-white/[0.02] opacity-40'}`}>
                    <p className="flex items-center justify-between text-[5.5px] font-black uppercase tracking-wider text-white/45">{st}{k < done && <Check className="h-2 w-2 text-emerald-400" strokeWidth={3} />}</p>
                    <p className="mt-0.5 truncate text-[7px] font-bold text-white/85">{STEP_SUMMARY[k]}</p>
                  </div>
                ))}
              </div>
              {live ? (
                <div className="sp-rise mt-auto flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] p-2">
                  <div className="grid h-12 w-12 shrink-0 grid-cols-5 gap-[1.5px] rounded bg-white p-1">
                    {[1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1].map((c, k) => <div key={k} className={c ? 'bg-[#111827]' : ''} />)}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[6px] font-black uppercase tracking-widest text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live · share it</p>
                    <p className="truncate text-[8px] font-black">{L.subdomain}</p>
                    <div className="mt-1 flex gap-1">{[{ i: Copy, l: 'Copy' }, { i: MessageSquare, l: 'Text' }, { i: Mail, l: 'Email' }].map(b => <span key={b.l} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[6.5px] font-black ${b.l === 'Copy' ? 'bg-[#C9A24D] text-[#111827]' : 'bg-white/10 text-white'}`}><b.i className="h-2 w-2" />{b.l}</span>)}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-auto" />
              )}
            </div>
          </div>
        </div>
      </BrowserFrame>
    )
  }

  // ---- 5 · The published Luxe page ----
  const idx = beat.idx
  const roomIdx = idx < 2 ? 0 : idx > 2 ? 3 : Math.min(3, Math.floor(tick / 7.5))
  const room = L.rooms[roomIdx]
  const ringC = 2 * Math.PI * 26
  const parts = [{ v: L.payment.principal, c: '#C9A24D' }, { v: L.payment.taxes, c: '#e8c97a' }, { v: L.payment.hoa, c: '#8b6a2b' }]
  let acc = 0

  return (
    <BrowserFrame url={url} progress={progress}>
      <style>{CSS}</style>
      <div className="relative h-[420px] overflow-hidden bg-[#0b0b0b]">
        {/* the page's own nav, fixed over every section */}
        <div className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-black/30 px-3 ">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-[#C9A24D]/60"><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></div>
            <div className="min-w-0 leading-none"><p className="truncate text-[6.5px] font-black text-white">{AGENT.name}</p><p className="text-[5px] font-bold uppercase tracking-wider text-white/50">{AGENT.brokerage}</p></div>
          </div>
          <div className="flex items-center gap-2.5">
            {['Photos', 'Details', 'The Town', 'Location', 'Contact'].map((l, k) => <span key={l} className={`text-[6px] font-bold transition-colors duration-500 ${(idx === 2 && k === 0) || (idx === 3 && k === 2) || (idx === 5 && k === 4) ? 'text-[#e8c97a]' : 'text-white/60'}`}>{l}</span>)}
            <span className="rounded-full bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-2 py-0.5 text-[6px] font-black text-[#111827]">Book a tour</span>
          </div>
        </div>

        <DemoScroller offsets={OFFSETS} stop={idx} transitionMs={1300}>
          {/* 0 · Hero: slow zoom, the facts, the highlight marquee */}
          <section style={{ height: SECTION_H }} className="relative overflow-hidden">
            <Image src={L.hero} alt="" fill className="sp-zoom object-cover" unoptimized />
            <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(201,162,77,.25),transparent_55%),linear-gradient(180deg,rgba(0,0,0,.35)_0%,rgba(0,0,0,.05)_35%,rgba(0,0,0,.9)_100%)]" />
            <div className="absolute inset-x-5 bottom-12">
              <span className="sp-rise inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[6.5px] font-black uppercase tracking-[0.25em] text-white "><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{L.status}</span>
              <p className="sp-rise mt-1.5 text-[6.5px] font-black uppercase tracking-[0.35em] text-white/70" style={{ animationDelay: '120ms' }}>{L.city} · {L.state} · {L.zip}</p>
              <h4 className="sp-rise font-serif text-[40px] font-light leading-[1] tracking-[-0.01em] text-white max-sm:text-[32px]" style={{ animationDelay: '220ms' }}>{L.address}</h4>
              <span className="sp-rule mt-2 block h-px w-full bg-gradient-to-r from-[#C9A24D] via-[#e8c97a]/60 to-transparent" />
              <div className="sp-rise mt-2 flex items-end justify-between gap-3" style={{ animationDelay: '380ms' }}>
                <div className="flex items-end gap-4 max-sm:gap-3">
                  <div><p className="text-[5.5px] font-black uppercase tracking-[0.3em] text-white/50">Offered at</p><p className="font-serif text-[19px] text-white">{money(L.price)}</p></div>
                  {[[L.beds, 'Beds'], [L.baths, 'Baths'], [L.sqft.toLocaleString(), 'Sq ft'], [L.acres, 'Acres']].map(([v, l]) => (
                    <div key={l as string}><p className="font-serif text-[15px] text-white">{v}</p><p className="text-[5.5px] font-black uppercase tracking-[0.25em] text-white/50">{l}</p></div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 max-sm:hidden">
                  <span className="sp-shine inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f3dfa8] via-[#C9A24D] to-[#a8853d] px-2.5 py-1 text-[7px] font-black text-[#111827]">Book a private tour <ArrowRight className="h-2 w-2" /></span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-2 py-1 text-[6.5px] font-bold text-white"><Images className="h-2 w-2" />{L.photoCount} photos</span>
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-[#C9A24D]/40 bg-black/60 py-1.5 ">
              <div className="animate-marquee-x-slow flex w-max gap-5 whitespace-nowrap">
                {[...L.highlights, ...L.highlights].map((h, k) => <span key={k} className="flex items-center gap-5 font-serif text-[8px] italic text-[#f3dfa8]">{h}<span className="h-1 w-1 rotate-45 bg-[#C9A24D]" /></span>)}
              </div>
            </div>
          </section>

          {/* 1 · The residence */}
          <section style={{ height: SECTION_H }} className="relative flex items-center gap-4 bg-[#0b0b0b] px-6">
            <div className="w-[44%]">
              <p className="flex items-center gap-2 text-[6.5px] font-black uppercase tracking-[0.35em] text-[#C9A24D]"><span className="h-px w-5 bg-[#C9A24D]" />The residence</p>
              <h5 className="mt-1.5 font-serif leading-tight text-white"><span className="block text-[15px] text-white/60">Inside</span><em className="block text-[22px] text-[#e8c97a]">{L.address}.</em></h5>
              <p className="mt-2 text-[7.5px] leading-relaxed text-white/65">{L.story}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[7px] font-black text-white"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#C9A24D]/60"><ArrowRight className="h-2 w-2 text-[#e8c97a]" /></span>Read the full story <span className="font-semibold text-white/40">· 1 min</span></span>
            </div>
            <div className="relative h-[250px] flex-1 overflow-hidden rounded-sm shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/30">
              <Image src={L.storyPhoto} alt="" fill className="object-cover" unoptimized />
            </div>
          </section>

          {/* 2 · Room by room */}
          <section style={{ height: SECTION_H }} className="relative overflow-hidden bg-[#0b0b0b]">
            {L.rooms.map((r, k) => (
              <Image key={r.label} src={r.photo} alt="" fill className={`object-cover transition-opacity duration-1000 ${k === roomIdx ? 'opacity-100' : 'opacity-0'}`} unoptimized />
            ))}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 top-11 flex items-center gap-2 overflow-hidden px-5">
              <span className="shrink-0 text-[6px] font-black uppercase tracking-[0.3em] text-[#C9A24D]">Room by room</span>
              {L.rooms.map((r, k) => <span key={r.label} className={`shrink-0 text-[6px] font-bold transition-colors duration-500 ${k === roomIdx ? 'text-white' : 'text-white/40'}`}>{String(k + 1).padStart(2, '0')} {r.label}</span>)}
            </div>
            <div key={roomIdx} className="absolute bottom-8 left-5 w-[52%]">
              <p className="sp-rise sp-num font-serif text-[46px] font-black leading-none">{String(roomIdx + 1).padStart(2, '0')}</p>
              <h5 className="sp-rise font-serif text-[22px] leading-tight text-white" style={{ animationDelay: '100ms' }}>{room.label}</h5>
              <p className="sp-rise mt-1 text-[7.5px] leading-relaxed text-white/75" style={{ animationDelay: '200ms' }}>{room.copy}</p>
              <div className="sp-rise mt-2 flex gap-1" style={{ animationDelay: '300ms' }}>
                {room.thumbs.map(t => <div key={t} className="relative h-7 w-10 overflow-hidden rounded-sm ring-1 ring-white/30"><Image src={t} alt="" fill className="object-cover" unoptimized /></div>)}
                <span className="flex items-center gap-1 rounded-sm border border-white/25 px-1.5 text-[6px] font-black text-white"><Camera className="h-2 w-2" />{room.thumbs.length + 2} photos</span>
              </div>
            </div>
          </section>

          {/* 3 · Life in the town */}
          <section style={{ height: SECTION_H }} className="relative flex flex-col justify-center bg-gradient-to-b from-[#0b0b0b] to-[#14110c] px-6">
            <p className="flex items-center gap-2 text-[6.5px] font-black uppercase tracking-[0.35em] text-[#C9A24D]"><span className="h-px w-5 bg-[#C9A24D]" />The town</p>
            <h5 className="mt-1 font-serif text-[24px] leading-tight text-white">Life in <em className="text-[#e8c97a]">{L.town.name}.</em></h5>
            <p className="font-serif text-[8.5px] italic text-white/60">{L.town.tagline}</p>
            <div className="mt-3 grid grid-cols-[1.1fr_1fr] gap-3">
              <div>
                <div className="relative h-[150px] overflow-hidden rounded-sm ring-1 ring-[#C9A24D]/30"><Image src={L.town.photo} alt="" fill className="object-cover" unoptimized /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[5.5px] font-bold uppercase tracking-wider text-white/80">Chester County Library, Exton</span></div>
                <p className="mt-0.5 text-[5px] text-white/35">{L.town.photoCredit}</p>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">{L.town.knownFor.map(k => <span key={k} className="rounded-full border border-[#C9A24D]/40 px-1.5 py-0.5 text-[6.5px] font-bold text-[#f3dfa8]">{k}</span>)}</div>
                <div className="rounded-sm border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[5.5px] font-black uppercase tracking-[0.25em] text-white/40">Getting around</p>
                  {L.town.gettingAround.map(g => <p key={g.label} className="mt-1 flex items-start gap-1 text-[7px] font-bold leading-tight text-white"><Train className="mt-[1px] h-2 w-2 shrink-0 text-[#C9A24D]" /><span>{g.label} <span className="block font-semibold text-white/45">{g.detail}</span></span></p>)}
                </div>
                <div className="rounded-sm border border-white/10 bg-white/[0.03] p-2">
                  <p className="text-[5.5px] font-black uppercase tracking-[0.25em] text-white/40">The outdoors</p>
                  {L.town.outdoors.map(o => <p key={o} className="mt-0.5 flex items-center gap-1 text-[7px] font-bold text-white"><Trees className="h-2 w-2 text-[#C9A24D]" />{o}</p>)}
                </div>
              </div>
            </div>
          </section>

          {/* 4 · What it could cost */}
          <section style={{ height: SECTION_H }} className="relative flex flex-col justify-center overflow-hidden bg-[#14110c] px-6">
            <div className="absolute inset-y-0 right-0 w-[46%] opacity-40"><Image src={L.rooms[3].photo} alt="" fill className="object-cover" unoptimized /><span className="absolute inset-0 bg-gradient-to-r from-[#14110c] via-[#14110c]/60 to-transparent" /></div>
            <p className="relative flex items-center gap-2 text-[6.5px] font-black uppercase tracking-[0.35em] text-[#C9A24D]"><span className="h-px w-5 bg-[#C9A24D]" />Affordability</p>
            <h5 className="relative mt-1 font-serif text-[28px] leading-tight text-white">What it could <em className="text-[#e8c97a]">cost monthly.</em></h5>
            <p className="relative text-[7.5px] font-semibold text-white/50">Taxes and HOA straight from the MLS record - drag anything to try your own.</p>
            <div className="relative mt-4 grid grid-cols-[1.05fr_1fr] gap-4 rounded-sm border border-[#C9A24D]/25 bg-black/60 p-5 ">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 64 64" className="h-24 w-24 -rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                  {parts.map(p => { const len = (p.v / L.payment.total) * ringC; const el = <circle key={p.c} cx="32" cy="32" r="26" fill="none" stroke={p.c} strokeWidth="7" strokeDasharray={`${idx >= 4 ? len : 0} ${ringC}`} strokeDashoffset={-acc} style={{ transition: 'stroke-dasharray 1.4s ease .3s' }} />; acc += len; return el })}
                </svg>
                <div>
                  <p className="text-[5.5px] font-black uppercase tracking-[0.25em] text-white/45">Estimated monthly</p>
                  <p className="font-serif text-[22px] text-white">{money(L.payment.total)}<span className="text-[9px] text-white/50">/mo</span></p>
                  {[['Principal & interest', L.payment.principal, '#C9A24D'], ['Property taxes', L.payment.taxes, '#e8c97a'], ['HOA dues', L.payment.hoa, '#8b6a2b']].map(([l, v, c]) => (
                    <p key={l as string} className="flex items-center gap-1 text-[6.5px] font-bold text-white/70"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c as string }} />{l} <span className="ml-auto pl-2 text-white">{money(v as number)}</span></p>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {[['Home price', money(L.price), 100], ['Down payment · 20%', money(L.price * 0.2), 20]].map(([l, v, w]) => (
                  <div key={l as string}>
                    <p className="flex justify-between text-[6px] font-black uppercase tracking-wider text-white/45"><span>{l}</span><span className="text-white/80">{v}</span></p>
                    <div className="mt-1 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#8b6a2b] to-[#e8c97a]" style={{ width: `${w}%` }} /></div>
                  </div>
                ))}
                <div className="flex gap-1 rounded-full bg-white/5 p-0.5">{['30 years', '20 years', '15 years'].map((t, k) => <span key={t} className={`flex-1 rounded-full py-0.5 text-center text-[6px] font-black ${k === 0 ? 'bg-[#C9A24D] text-[#111827]' : 'text-white/50'}`}>{t}</span>)}</div>
                <p className="text-[5.5px] leading-snug text-white/35">Estimate only, using this week&apos;s Freddie Mac average rate. Talk to a lender for a real quote.</p>
              </div>
            </div>
          </section>

          {/* 5 · See it for yourself - and the request lands in Leads */}
          <section style={{ height: SECTION_H }} className="relative flex flex-col justify-center bg-gradient-to-b from-[#14110c] to-[#0b0b0b] px-6">
            <p className="flex items-center gap-2 text-[6.5px] font-black uppercase tracking-[0.35em] text-[#C9A24D]"><span className="h-px w-5 bg-[#C9A24D]" />Private showings</p>
            <h5 className="mt-1 font-serif text-[24px] leading-tight text-white">See it for yourself, <em className="text-[#e8c97a]">{L.address}.</em></h5>
            <div className="mt-3 grid grid-cols-[1.25fr_1fr] gap-3">
              <div className="rounded-sm border border-white/10 bg-white/[0.03] p-3">
                <div className="flex gap-1">{['Request info', 'Schedule a tour'].map((t, k) => <span key={t} className={`rounded-full px-2 py-0.5 text-[6.5px] font-black ${k === 1 ? 'bg-[#C9A24D] text-[#111827]' : 'border border-white/20 text-white/70'}`}>{t}</span>)}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">{['First name', 'Last name', 'Email', 'Phone'].map(f => <span key={f} className="rounded-sm border border-white/10 px-1.5 py-1 text-[6.5px] text-white/35">{f}</span>)}</div>
                <span className="sp-shine mt-2 flex items-center justify-center gap-1 rounded-sm bg-gradient-to-r from-[#f3dfa8] via-[#C9A24D] to-[#a8853d] py-1.5 text-[7.5px] font-black text-[#111827]">Request a private tour <ArrowRight className="h-2 w-2" /></span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-sm border border-[#C9A24D]/30 bg-black/40 p-2">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[#C9A24D]"><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></div>
                  <div className="min-w-0"><p className="font-serif text-[10px] text-white">{AGENT.name}</p><p className="text-[6px] font-bold text-white/50">{AGENT.title} · {AGENT.brokerage}</p><p className="text-[6.5px] font-black text-[#e8c97a]">{AGENT.phone}</p></div>
                </div>
                <div className="rounded-sm border border-white/10 bg-white/[0.03] p-2"><p className="flex items-center gap-1 text-[7.5px] font-black text-white"><Bell className="h-2.5 w-2.5 text-[#C9A24D]" />Follow this home</p><p className="mt-0.5 text-[6px] leading-snug text-white/45">Get an email if the price changes, an open house is scheduled, or it goes under contract.</p></div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[L.rooms[1].photo, L.rooms[0].photo, L.rooms[3].photo].map(ph => <div key={ph} className="relative h-16 overflow-hidden rounded-sm"><Image src={ph} alt="" fill className="object-cover" unoptimized /></div>)}
            </div>
            <p className="mt-2 text-center text-[5.5px] font-bold uppercase tracking-[0.3em] text-white/30">Presented by {AGENT.name} · {AGENT.brokerage} · Powered by OpenHousePal</p>
            {idx === 5 && tick >= 10 && (
              <div className="sp-toast absolute right-4 top-12 z-30 max-sm:bottom-4 max-sm:top-auto flex w-[210px] items-start gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,.6)] dark:border-gray-700 dark:bg-[#151517]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Bell className="h-3 w-3" /></span>
                <div className="min-w-0">
                  <p className="text-[8px] font-black text-[#111827] dark:text-white">New tour request</p>
                  <p className="text-[7px] font-semibold text-gray-500 dark:text-gray-400">{L.address} · from your Spotlight</p>
                  <p className="mt-0.5 text-[6.5px] font-bold text-emerald-600">In your Leads · bell + email alert</p>
                </div>
              </div>
            )}
          </section>
        </DemoScroller>
      </div>
    </BrowserFrame>
  )
}
