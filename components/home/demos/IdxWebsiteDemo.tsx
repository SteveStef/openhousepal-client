'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, Bath, Bed, BookOpen, Building2, Calendar, Check, ChevronRight, Eye, EyeOff, Globe, GraduationCap, Home as HomeIcon, Landmark, Layers, Layout, Lock, Map as MapIcon, MapPin, Maximize, Menu, Palette, PlaySquare, Scale, Search, SlidersHorizontal, Sparkles, Star, Train, Trees, TrendingUp, UserPlus, Utensils, Wand2 } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TypingAnimation from '@/components/TypingAnimation'
import TitleSlide from './TitleSlide'
import DemoPointer from './DemoPointer'
import { DemoCaption, DemoNote, DEMO_NOTE_CSS, STAGE_BG } from './DemoNote'
import { AGENT, REAL_BLOG, REAL_IDX_SITE, REAL_RECENT_SALES, REAL_SHOWCASE, REAL_SPOTLIGHT } from './realData'

// The IDX Website, told like the Agent Hub demo: a note beside the stage explains one part at a
// time while that part of Peter's real site (peter-stefanatos.openhousepal.com) is outlined in
// gold. Walks the whole product: auto-build -> home page (hero search, featured marquee, newly
// listed stack) -> MLS map search -> a property page with Explore Nearby -> Neighborhoods (real
// live stats from this site's /areas API, 2026-10-02) -> a town page -> Neighborhood Compare ->
// sales + blog -> visitor-built Showcases -> lead capture -> the editor (sections, colors) -> own
// domain (the real 3-step DNS setup from DomainsPanel) -> Google. The custom domain shown is an
// illustration; everything else is Peter's real data.
const C = { navy: REAL_IDX_SITE.primaryColor, gold: REAL_IDX_SITE.secondaryColor }
const SUB = REAL_IDX_SITE.subdomain
const OWN_DOMAIN = 'peterstefanatos.com'
const L = REAL_IDX_SITE.listings
const M = REAL_SHOWCASE.matches
const SP = REAL_SPOTLIGHT

// Real Neighborhoods data (GET /public/sites/{id}/areas for Peter's site).
const AREAS = [
  { name: 'Villanova', slug: 'villanova-pa', forSale: 20, median: '$1.61M', schools: 'Radnor / Lower Merion', photo: L[0].photo },
  { name: 'Gladwyne', slug: 'gladwyne-pa', forSale: 8, median: '$2.27M', schools: 'Lower Merion', photo: REAL_RECENT_SALES[4].photo },
  { name: 'Bryn Mawr', slug: 'bryn-mawr-pa', forSale: 24, median: '$978K', schools: 'Lower Merion / Radnor', photo: M[1].photo },
]

type Scene = 'build' | 'hero' | 'featured' | 'newly' | 'search' | 'property' | 'areas' | 'area' | 'compare' | 'record' | 'showcase' | 'lead' | 'editor' | 'domain' | 'google'
const STOPS: { id: Scene; hold: number; icon: LucideIcon; title: string; body: string; path: string }[] = [
  { id: 'build', hold: 6600, icon: Wand2, title: 'Built for you', body: 'From your listings, sales and brand.', path: '' },
  { id: 'hero', hold: 6200, icon: HomeIcon, title: 'Your brand, front and center', body: 'With a search bar for the whole MLS.', path: '' },
  { id: 'featured', hold: 5600, icon: Star, title: 'Your listings lead', body: 'You pick which ones.', path: '' },
  { id: 'newly', hold: 5600, icon: Sparkles, title: 'Always fresh', body: 'New listings show up on their own.', path: '' },
  { id: 'search', hold: 6600, icon: MapIcon, title: 'Search every home', body: 'On a map, with filters.', path: '/search' },
  { id: 'property', hold: 6800, icon: Building2, title: 'A page for every home', body: 'Buyers tap to request a tour.', path: '/properties/239-windham-dr' },
  { id: 'areas', hold: 6400, icon: MapPin, title: 'Town pages, real data', body: 'Live market stats.', path: '/neighborhoods' },
  { id: 'area', hold: 6800, icon: Trees, title: 'Everything about each town', body: 'Schools, parks, trains, food.', path: '/neighborhoods/villanova-pa' },
  { id: 'compare', hold: 6400, icon: Scale, title: 'Compare towns', body: 'Side by side.', path: '/neighborhoods/compare' },
  { id: 'record', hold: 5800, icon: TrendingUp, title: 'Your track record', body: 'Your sales and blogs.', path: '' },
  { id: 'showcase', hold: 6800, icon: Layout, title: 'Visitors build a Showcase', body: 'You get a new lead.', path: '/create-showcase' },
  { id: 'lead', hold: 6200, icon: UserPlus, title: 'Every inquiry is yours', body: 'Straight into your Leads.', path: '/contact' },
  { id: 'editor', hold: 7600, icon: Palette, title: 'Make it yours', body: 'Colors, fonts, sections.', path: '' },
  { id: 'domain', hold: 7800, icon: Globe, title: 'Your own domain', body: 'Use yours - or our free one.', path: '' },
  { id: 'google', hold: 6000, icon: Search, title: 'Found on Google', body: 'Sitemap built for you.', path: '' },
]

type Beat = { k: 'title' } | { k: 'stop'; n: number }
const BEATS: Beat[] = [{ k: 'title' }, ...STOPS.map((_, n) => ({ k: 'stop' as const, n }))]
const TITLE_MS = 5200
const beatDuration = (b: Beat) => (b.k === 'title' ? TITLE_MS : STOPS[b.n].hold)
const TOTAL_PAGES = BEATS.length

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}K`)

const CSS = `
@keyframes idxMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes idxZoom{from{transform:scale(1.04)}to{transform:scale(1.14)}}
@keyframes idxShimmer{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
.idx-marquee{animation:idxMarquee 16s linear infinite}
.idx-zoom{animation:idxZoom 9s ease-out both}
.idx-shim{animation:idxShimmer 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.idx-marquee,.idx-zoom,.idx-shim{animation:none}}
`

function Nav({ accent = C.gold, active }: { accent?: string; active?: string }) {
  return (
    <div className="relative z-20 flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-white" style={{ backgroundColor: C.navy }}>
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: accent }}><HomeIcon className="h-2.5 w-2.5 text-[#111827]" strokeWidth={2.5} /></span>
        <span className="font-serif text-[9px] font-black">{AGENT.name}</span>
      </div>
      <div className="hidden items-center gap-2.5 sm:flex">
        {['Search', 'Featured', 'Neighborhoods', 'Media', 'Blog'].map(n => <span key={n} className={`text-[6.5px] font-bold uppercase tracking-widest ${active === n ? '' : 'text-white/60'}`} style={active === n ? { color: accent } : undefined}>{n}</span>)}
      </div>
      <div className="flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-0.5 pr-2">
        <span className="relative h-3.5 w-3.5 overflow-hidden rounded-full"><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></span>
        <span className="text-[6px] font-black uppercase">Contact</span>
      </div>
      <Menu className="h-3 w-3 sm:hidden" />
    </div>
  )
}

function Kicker({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`flex items-center gap-1.5 text-[7px] font-black uppercase tracking-[0.22em] ${light ? 'text-[#e8c97a]' : 'text-[#8b7355]'}`}><span className="h-px w-3" style={{ backgroundColor: C.gold }} />{children}</p>
}

function Toast({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <div className="dn-toast absolute inset-x-5 top-2 z-40 flex items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-xl ring-1 ring-black/5 dark:bg-[#1c1c1f]/95">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a]"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0"><p className="text-[9.5px] font-black text-[#111827] dark:text-white">{title}</p><p className="truncate text-[8px] font-semibold text-gray-500">{sub}</p></div>
    </div>
  )
}

export default function IdxWebsiteDemo() {
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
        icon={Globe}
        kicker="Auto-Built"
        title="IDX"
        body="Complete IDX site - tailored and branded to you."
        nowrapBody
        ai
        durationMs={TITLE_MS}
        totalPages={TOTAL_PAGES}
        pageIndex={0}
        url={SUB}
      />
    )
  }

  const stop = STOPS[beat.n]
  const scene = stop.id
  const on = (cond: boolean) => (cond ? 'dn-hl dn-on' : 'dn-hl')
  const domainLive = scene === 'domain' && tick >= 22
  const host = scene === 'google' || domainLive ? OWN_DOMAIN : SUB
  const isApp = scene === 'editor' || (scene === 'domain' && !domainLive)
  const url = isApp ? 'app.openhousepal.com/studio/site' : `${host}${stop.path}`

  return (
    <BrowserFrame url={url} progress={{ pages: TOTAL_PAGES, current: 1 + beat.n, durationMs: stop.hold }}>
      <style>{DEMO_NOTE_CSS + CSS}</style>
      <div className={`relative flex h-[420px] items-center justify-center gap-5 overflow-hidden px-4 max-sm:px-0 ${STAGE_BG}`}>
        <DemoNote id={stop.id} icon={stop.icon} title={stop.title} body={stop.body} index={beat.n} count={STOPS.length}>
          {scene === 'domain' && domainLive && <p className="dn-rise mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[9.5px] font-black text-emerald-700 dark:text-emerald-300"><Lock className="h-3 w-3" /> Secure HTTPS, set up for you</p>}
        </DemoNote>

        {/* the stage: a browser window showing the live site (or the editor) */}
        <div className="relative h-[384px] w-[436px] flex-shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)] dark:border-white/10 dark:bg-[#151517]">
          <div className="flex h-7 items-center gap-2 border-b border-gray-200 bg-[#f3f4f6] px-2.5 dark:border-gray-800 dark:bg-[#111114]">
            <span className="flex gap-1">{['#FF5F57', '#FEBC2E', '#28C840'].map(c => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />)}</span>
            <span key={host + isApp} className={`dn-hl flex min-w-0 flex-1 items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[8px] font-semibold text-gray-500 dark:bg-[#1c1c1f] ${scene === 'domain' && domainLive ? 'dn-on dn-pop' : ''}`}>
              <Lock className="h-2 w-2 flex-shrink-0 text-emerald-500" /><span className="truncate">{url}</span>
            </span>
          </div>
          <div className="relative h-[356px] overflow-hidden">
            {scene === 'build' && <BuildScene tick={tick} />}
            {scene === 'hero' && <HeroScene tick={tick} on={on} />}
            {scene === 'featured' && <FeaturedScene on={on} />}
            {scene === 'newly' && <NewlyScene tick={tick} />}
            {scene === 'search' && <SearchScene tick={tick} on={on} />}
            {scene === 'property' && <PropertyScene tick={tick} on={on} />}
            {scene === 'areas' && <AreasScene tick={tick} on={on} />}
            {scene === 'area' && <AreaScene tick={tick} on={on} />}
            {scene === 'compare' && <CompareScene tick={tick} />}
            {scene === 'record' && <RecordScene tick={tick} on={on} />}
            {scene === 'showcase' && <ShowcaseScene tick={tick} />}
            {scene === 'lead' && <LeadScene tick={tick} />}
            {scene === 'editor' && <EditorScene tick={tick} />}
            {scene === 'domain' && <DomainScene tick={tick} />}
            {scene === 'google' && <GoogleScene tick={tick} />}
          </div>
        </div>
        <DemoCaption title={stop.title} body={stop.body} />
      </div>
    </BrowserFrame>
  )
}

type On = (cond: boolean) => string

function BuildScene({ tick }: { tick: number }) {
  const items = [
    { icon: HomeIcon, label: 'Your listings & sales', sub: 'From Bright MLS' },
    { icon: Palette, label: 'Your colors, photo & bio', sub: 'From your Brand Kit' },
    { icon: MapPin, label: 'Neighborhood pages', sub: 'Real local data' },
    { icon: BookOpen, label: 'Blogs & videos', sub: 'From Blog Builder & YouTube' },
  ]
  const done = (k: number) => tick >= 3 + k * 4
  const live = tick >= 20
  return (
    <div className="relative h-full" style={{ backgroundColor: C.navy }}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="h-5 w-5 rounded-md bg-white/10" />
        <div className="flex gap-2">{[0, 1, 2, 3].map(k => <div key={k} className="h-1.5 w-8 rounded-full bg-white/10" />)}</div>
        <div className="h-4 w-14 rounded-full bg-white/10" />
      </div>
      <div className="flex flex-col items-center gap-2 px-8 pt-8">
        <div className="h-2 w-24 rounded-full bg-white/10" /><div className="h-5 w-48 rounded-full bg-white/10" /><div className="mt-1 h-7 w-56 rounded-full bg-white/10" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#C9A24D]/20 to-transparent idx-shim" />
      <div className="absolute inset-x-6 bottom-5 rounded-2xl border border-white/10 bg-white/95 p-3 shadow-2xl dark:bg-[#151517]/95">
        <p className="mb-2 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355]"><Sparkles className="h-3 w-3" /> Building {AGENT.name.split(' ')[0]}&apos;s site</p>
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((it, k) => (
            <div key={it.label} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-all duration-500 ${done(k) ? 'border-[#C9A24D]/50 bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-800'}`}>
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-colors duration-500 ${done(k) ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>{done(k) ? <Check className="h-3 w-3" strokeWidth={3} /> : <it.icon className="h-3 w-3" />}</span>
              <div className="min-w-0"><p className="truncate text-[8.5px] font-black text-[#0B0B0B] dark:text-white">{it.label}</p><p className="truncate text-[6.5px] font-semibold text-gray-400">{it.sub}</p></div>
            </div>
          ))}
        </div>
        <div className={`mt-2 rounded-lg py-1.5 text-center text-[9px] font-black transition-all duration-500 ${live ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>{live ? `✓ Your site is live at ${SUB}` : 'Building…'}</div>
      </div>
    </div>
  )
}

function HeroScene({ tick, on }: { tick: number; on: On }) {
  const focusSearch = tick >= 8
  return (
    <div className="relative h-full" style={{ backgroundColor: C.navy }}>
      <Nav />
      <div className="relative flex h-[calc(100%-29px)] flex-col items-center justify-center px-6 text-center">
        <Image src={L[0].photo} alt="" fill className="idx-zoom object-cover opacity-50" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/55 to-[#111827]/75" />
        <div className={`relative flex items-center gap-1.5 rounded-full px-2 py-0.5 ${on(!focusSearch)}`}>
          <Sparkles className="h-2.5 w-2.5" style={{ color: C.gold }} />
          <span className="text-[8px] font-black uppercase tracking-[0.25em]" style={{ color: C.gold }}>{REAL_IDX_SITE.market}</span>
          <Sparkles className="h-2.5 w-2.5" style={{ color: C.gold }} />
        </div>
        <h4 className={`relative mt-2 rounded-xl px-2 font-serif text-[26px] font-black leading-tight text-white ${on(!focusSearch)}`}>Find Your <span style={{ color: C.gold }}>Dream Home</span></h4>
        <div className={`relative mt-3 flex w-full max-w-[300px] items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-lg ${on(focusSearch)}`}>
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <span className="truncate text-[9.5px] font-medium text-[#111827]">{tick >= 9 ? <TypingAnimation text={REAL_IDX_SITE.heroSuggestion} speed={55} /> : <span className="text-gray-400">City, neighborhood, address or MLS #</span>}</span>
          <span className="ml-auto flex-shrink-0 rounded-full px-2.5 py-1 text-[7.5px] font-black uppercase text-[#111827]" style={{ backgroundColor: C.gold }}>Search</span>
        </div>
        <div className="relative mt-2 flex w-full max-w-[300px] gap-1.5 rounded-2xl bg-white/10 p-1 ">
          {["I'm Buying", "I'm Selling", 'Home Value'].map(l => <span key={l} className="flex-1 truncate rounded-xl bg-white/10 py-1.5 text-center text-[7px] font-black uppercase tracking-wide text-white">{l}</span>)}
        </div>
        <div className="relative mt-3 flex gap-6 border-t border-white/15 pt-2.5 text-center">
          {[[String(AGENT.stats.totalSold), 'Homes Sold'], [AGENT.stats.totalVolume, 'Volume'], [AGENT.stats.avgPrice, 'Avg Price']].map(([v, l]) => (
            <div key={l}><p className="text-[13px] font-black text-white">{v}</p><p className="text-[6px] font-bold uppercase tracking-wide text-white/50">{l}</p></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ListingTile({ photo, price, address, city, beds, baths, w = 'w-[118px]' }: { photo: string; price: number; address: string; city: string; beds?: number; baths?: number; w?: string }) {
  return (
    <div className={`relative aspect-[3/4] flex-shrink-0 overflow-hidden rounded-2xl bg-[#07090d] ${w}`}>
      <Image src={photo} alt={address} fill className="object-cover" unoptimized />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
      <span className="absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[5.5px] font-black uppercase text-[#111827]" style={{ backgroundColor: C.gold }}>For Sale</span>
      <div className="absolute inset-x-2 bottom-2">
        <p className="font-serif text-[12px] font-black leading-none text-white">{money(price)}</p>
        <p className="mt-1 truncate text-[6.5px] font-bold uppercase tracking-wide text-white/75">{address} · {city}</p>
        {beds != null && <p className="mt-1 flex items-center gap-1.5 text-[6px] font-bold text-white/80"><span className="flex items-center gap-0.5"><Bed className="h-2 w-2" />{beds}</span><span className="flex items-center gap-0.5"><Bath className="h-2 w-2" />{baths}</span></p>}
      </div>
    </div>
  )
}

function FeaturedScene({ on }: { on: On }) {
  const row = [...M, ...M]
  return (
    <div className="flex h-full flex-col bg-[#f8f7f3] dark:bg-[#0B0B0B]">
      <Nav active="Featured" />
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-3 flex items-end justify-between px-4">
          <div><Kicker>Featured</Kicker><h5 className="mt-0.5 font-serif text-[18px] font-black text-[#0B0B0B] dark:text-white">Featured Listings</h5></div>
          <span className="rounded-full border border-gray-300 px-2 py-1 text-[7px] font-black uppercase tracking-wide text-gray-500 dark:border-gray-700">View all</span>
        </div>
        <div className={`mx-3 overflow-hidden rounded-2xl p-1.5 ${on(true)}`}>
          <div className="idx-marquee flex w-max gap-2">
            {row.map((p, k) => <ListingTile key={k} photo={p.photo} price={p.price} address={p.address} city={p.city} beds={p.beds} baths={p.baths} />)}
          </div>
        </div>
        <p className="mt-3 text-center text-[7.5px] font-bold uppercase tracking-[0.2em] text-gray-400">Your order · drag to rearrange in the editor</p>
      </div>
    </div>
  )
}

function NewlyScene({ tick }: { tick: number }) {
  const active = Math.floor(tick / 6) % M.length
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: C.navy }}>
      <Nav />
      <div className="flex flex-1 flex-col items-center justify-center">
        <Kicker light>Just hit the market</Kicker>
        <h5 className="mt-1 font-serif text-[18px] font-black text-white">Newly Listed</h5>
        <div className="relative mt-3 h-[200px] w-full [perspective:900px]">
          {M.map((p, k) => {
            let d = k - active
            if (d > M.length / 2) d -= M.length
            if (d < -M.length / 2) d += M.length
            const vis = Math.abs(d) <= 2
            return (
              <div key={p.address} className="absolute left-1/2 top-0 transition-all duration-700 ease-out" style={{ transform: `translateX(calc(-50% + ${d * 92}px)) rotateY(${d * -22}deg) scale(${1 - Math.abs(d) * 0.14})`, zIndex: 10 - Math.abs(d), opacity: vis ? 1 - Math.abs(d) * 0.3 : 0 }}>
                <div className={`rounded-2xl ${d === 0 ? 'dn-on' : ''}`}>
                  <ListingTile photo={p.photo} price={p.price} address={p.address} city={p.city} beds={p.beds} baths={p.baths} w="w-[140px]" />
                </div>
                {d === 0 && <span className="dn-pop absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[7px] font-black uppercase text-[#111827] shadow" style={{ backgroundColor: C.gold }}>New</span>}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-1">{M.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all ${k === active ? 'w-4' : 'w-1 bg-white/30'}`} style={k === active ? { backgroundColor: C.gold } : undefined} />)}</div>
      </div>
    </div>
  )
}

function SearchScene({ tick, on }: { tick: number; on: On }) {
  const filtered = tick >= 10
  const pins = [
    { x: 22, y: 30, p: L[0].price }, { x: 48, y: 22, p: L[1].price }, { x: 66, y: 48, p: M[1].price },
    { x: 34, y: 62, p: M[2].price }, { x: 78, y: 26, p: L[2].price }, { x: 56, y: 74, p: M[0].price },
  ]
  const list = [M[0], M[1], L[0]]
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0B0B0B]">
      <Nav active="Search" />
      <div className={`m-2 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1.5 dark:border-gray-800 dark:bg-[#151517] ${on(tick < 14)}`}>
        <span className="flex items-center gap-1 rounded-lg bg-gray-50 px-1.5 py-1 text-[7.5px] font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300"><Search className="h-2.5 w-2.5" />Villanova, PA</span>
        {[['Price', filtered ? '$3M–$4M' : 'Any'], ['Beds', filtered ? '5+' : 'Any'], ['Baths', 'Any'], ['Type', 'House'], ['Schools', filtered ? 'Radnor' : 'Any']].map(([l, v]) => (
          <span key={l} className={`rounded-lg border px-1.5 py-1 text-[7px] font-bold transition-colors duration-500 ${v !== 'Any' ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#0B0B0B] dark:text-white' : 'border-gray-200 text-gray-500 dark:border-gray-700'}`}>{l}: {v}</span>
        ))}
        <span className="ml-auto flex rounded-lg bg-gray-100 p-0.5 text-[6.5px] font-black dark:bg-white/5">{['Map', 'List', 'Grid'].map((v, k) => <span key={v} className={`rounded-md px-1.5 py-0.5 ${k === 0 ? 'bg-[#111827] text-white' : 'text-gray-500'}`}>{v}</span>)}</span>
      </div>
      <div className="mx-2 mb-2 flex min-h-0 flex-1 gap-2">
        <div className={`relative flex-[1.3] overflow-hidden rounded-xl bg-[#e8eee6] dark:bg-[#1a221d] ${on(tick >= 14)}`}>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 40 C25 35 40 55 100 45" stroke="#fff" strokeWidth="2.2" fill="none" opacity=".9" />
            <path d="M30 0 C35 30 25 60 40 100" stroke="#fff" strokeWidth="1.6" fill="none" opacity=".9" />
            <path d="M70 0 C65 40 80 70 72 100" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".8" />
            <path d="M0 80 C30 75 60 85 100 78" stroke="#f6d98a" strokeWidth="1.4" fill="none" opacity=".9" />
            <ellipse cx="85" cy="85" rx="14" ry="9" fill="#bfd8c0" opacity=".7" />
            <ellipse cx="12" cy="12" rx="10" ry="7" fill="#bfd8c0" opacity=".7" />
          </svg>
          {pins.slice(0, filtered ? 4 : 6).map((p, k) => (
            <span key={k} className={`dn-pop absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[6.5px] font-black shadow ${tick >= 18 && k === 0 ? 'scale-125 bg-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white'}`} style={{ left: `${p.x}%`, top: `${p.y}%`, transition: 'transform .4s ease', animationDelay: `${k * 90}ms` }}>{money(p.p)}</span>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
          <p className="text-[7.5px] font-black text-gray-500">{filtered ? '9' : '20'} homes in Villanova</p>
          {list.map((p, k) => (
            <div key={p.address} className={`flex gap-1.5 rounded-lg border bg-white p-1 dark:bg-[#151517] ${tick >= 18 && k === 0 ? 'border-[#C9A24D]' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="relative h-11 w-14 flex-shrink-0 overflow-hidden rounded-md"><Image src={p.photo} alt="" fill className="object-cover" unoptimized /></div>
              <div className="min-w-0"><p className="text-[9px] font-black text-[#0B0B0B] dark:text-white">{money(p.price)}</p><p className="truncate text-[6.5px] font-bold text-gray-400">{p.address}</p><p className="text-[6.5px] font-bold text-gray-500">{'beds' in p ? `${(p as typeof M[number]).beds} bd · ${(p as typeof M[number]).baths} ba` : '5 bd'}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PropertyScene({ tick, on }: { tick: number; on: On }) {
  const photos = [SP.hero, SP.rooms[0].photo, SP.rooms[1].photo, SP.rooms[3].photo]
  const phase = tick < 9 ? 'photos' : tick < 18 ? 'nearby' : 'tour'
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0B0B0B]">
      <Nav active="Search" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className={`grid h-[118px] flex-shrink-0 grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-xl ${on(phase === 'photos')}`}>
          <div className="relative col-span-2 row-span-2"><Image src={photos[0]} alt="" fill className="object-cover" unoptimized /><span className="absolute left-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[6px] font-black uppercase text-[#111827]">{SP.status}</span></div>
          {photos.slice(1).map((ph, k) => <div key={k} className={`relative ${k === 2 ? 'col-span-2' : ''}`}><Image src={ph} alt="" fill className="object-cover" unoptimized /></div>)}
          <span className="pointer-events-none absolute" />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-[16px] font-black leading-none text-[#0B0B0B] dark:text-white">${SP.price.toLocaleString()}</p>
            <p className="mt-0.5 truncate text-[8px] font-bold text-gray-500">{SP.address}, {SP.city}, {SP.state} {SP.zip}</p>
            <div className="mt-1 flex gap-2 text-[7px] font-bold text-gray-600 dark:text-gray-300"><span className="flex items-center gap-0.5"><Bed className="h-2.5 w-2.5" />{SP.beds} bd</span><span className="flex items-center gap-0.5"><Bath className="h-2.5 w-2.5" />{SP.baths} ba</span><span className="flex items-center gap-0.5"><Maximize className="h-2.5 w-2.5" />{SP.sqft.toLocaleString()} sqft</span><span className="flex items-center gap-0.5"><GraduationCap className="h-2.5 w-2.5" />{SP.schoolDistrict}</span></div>
          </div>
          <span className={`relative flex-shrink-0 rounded-full px-2.5 py-1.5 text-[7.5px] font-black uppercase tracking-wide transition-all duration-300 ${phase === 'tour' ? 'dn-on' : ''} ${tick >= 24 ? 'bg-emerald-500 text-white' : 'text-[#111827]'}`} style={tick >= 24 ? undefined : { backgroundColor: C.gold }}>{tick >= 24 ? '✓ Requested' : 'Request a Tour'}</span>
        </div>
        <div className={`flex-1 rounded-xl border border-gray-100 p-2 dark:border-gray-800 ${on(phase === 'nearby')}`}>
          <p className="mb-1.5 flex items-center gap-1 text-[7.5px] font-black uppercase tracking-[0.18em] text-[#8b7355]"><MapPin className="h-2.5 w-2.5" />Explore Nearby</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[{ icon: Train, cat: 'Transit', name: SP.town.gettingAround[0].label, d: SP.town.gettingAround[0].detail }, { icon: Trees, cat: 'Parks', name: SP.town.outdoors[0], d: SP.town.outdoors[1] }, { icon: Building2, cat: 'Commute', name: SP.town.gettingAround[1].label, d: SP.town.gettingAround[1].detail }].map(n => (
              <div key={n.cat} className="rounded-lg bg-gray-50 p-1.5 dark:bg-white/5"><p className="flex items-center gap-1 text-[6px] font-black uppercase text-gray-400"><n.icon className="h-2.5 w-2.5" style={{ color: C.gold }} />{n.cat}</p><p className="mt-0.5 truncate text-[7.5px] font-black text-[#0B0B0B] dark:text-white">{n.name}</p><p className="truncate text-[6.5px] font-semibold text-gray-400">{n.d}</p></div>
            ))}
          </div>
        </div>
      </div>
      <DemoPointer x={88} y={50} click={tick >= 22 && tick < 25} show={phase === 'tour'} />
      {tick >= 25 && <Toast icon={Calendar} title="Tour request sent to Peter" sub={`${SP.address} · lands in your Leads instantly`} />}
    </div>
  )
}

function AreasScene({ tick, on }: { tick: number; on: On }) {
  const focus = Math.min(AREAS.length - 1, Math.floor(tick / 8))
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: C.navy }}>
      <Nav active="Neighborhoods" />
      <div className="flex flex-1 flex-col justify-center px-3">
        <Kicker light>Where I work</Kicker>
        <h5 className="mb-2.5 mt-0.5 font-serif text-[18px] font-black text-white">Explore Neighborhoods</h5>
        <div className="grid grid-cols-3 gap-2">
          {AREAS.map((a, k) => (
            <div key={a.name} className={`relative aspect-[7/10] overflow-hidden rounded-xl ${on(k === focus)}`}>
              <Image src={a.photo} alt={a.name} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
              <span className="absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[5.5px] font-black uppercase text-[#111827]" style={{ backgroundColor: C.gold }}>PA</span>
              <div className="absolute inset-x-1.5 bottom-1.5">
                <p className="font-serif text-[12px] font-black text-white">{a.name}</p>
                <div className="mt-1 space-y-0.5 text-[6.5px] font-bold text-white/85">
                  <p className="flex items-center gap-1"><HomeIcon className="h-2 w-2" style={{ color: C.gold }} />{a.forSale} for sale</p>
                  <p className="flex items-center gap-1"><Landmark className="h-2 w-2" style={{ color: C.gold }} />{a.median} median</p>
                  <p className="flex items-center gap-1 truncate"><GraduationCap className="h-2 w-2 flex-shrink-0" style={{ color: C.gold }} /><span className="truncate">{a.schools}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[7px] font-bold uppercase tracking-[0.2em] text-white/45">+ Ardmore, Bala Cynwyd, Haverford, Radnor, Wayne</p>
      </div>
    </div>
  )
}

function AreaScene({ tick, on }: { tick: number; on: On }) {
  const blocks = [
    { icon: Train, title: 'Getting around', items: ['Villanova Station · Paoli/Thorndale Line', 'Norristown High Speed Line'] },
    { icon: Trees, title: 'Parks & outdoors', items: ['The Willows Park', 'Radnor Trail', 'Stoneleigh: A Natural Garden'] },
    { icon: GraduationCap, title: 'Public schools', items: ['Radnor Elementary', 'Radnor Middle', 'Radnor High'] },
    { icon: Utensils, title: 'Dining & shopping', items: ['The Refectory · Estia', 'Suburban Square', 'Shops of Villanova'] },
  ]
  const focus = Math.min(blocks.length - 1, Math.floor(tick / 6))
  return (
    <div className="flex h-full flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      <Nav active="Neighborhoods" />
      <div className="relative h-[92px] flex-shrink-0">
        <Image src={AREAS[0].photo} alt="" fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/50 to-transparent" />
        <div className="absolute inset-x-3 bottom-2 flex items-end justify-between">
          <div><Kicker light>Neighborhood guide</Kicker><p className="font-serif text-[20px] font-black leading-none text-white">Villanova, PA</p></div>
          <div className="flex gap-1.5">{[['20', 'For sale'], ['$1.61M', 'Median']].map(([v, l]) => <div key={l} className="rounded-lg bg-white/15 px-1.5 py-1 text-center "><p className="text-[10px] font-black text-white">{v}</p><p className="text-[5.5px] font-bold uppercase text-white/70">{l}</p></div>)}</div>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1.5 p-2">
        {blocks.map((b, k) => (
          <div key={b.title} className={`rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517] ${on(k === focus)} ${k !== focus ? 'opacity-60' : ''}`}>
            <p className="flex items-center gap-1 text-[7px] font-black uppercase tracking-[0.15em] text-[#8b7355]"><b.icon className="h-2.5 w-2.5" />{b.title}</p>
            <div className="mt-1 space-y-0.5">{b.items.map(it => <p key={it} className="truncate text-[8px] font-bold text-[#0B0B0B] dark:text-gray-200">{it}</p>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompareScene({ tick }: { tick: number }) {
  const a = AREAS[0], b = AREAS[2]
  const rows = [
    { label: 'Median price', a: a.median, b: b.median, win: 'b', note: 'Lower' },
    { label: 'Homes for sale', a: String(a.forSale), b: String(b.forSale), win: 'b', note: 'More choice' },
    { label: 'Schools', a: 'Radnor · Lower Merion', b: 'Lower Merion · Radnor', win: '' },
    { label: 'Feel', a: 'Suburban, leafy', b: 'Walkable town center', win: '' },
  ]
  return (
    <div className="flex h-full flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      <Nav active="Neighborhoods" />
      <div className="flex flex-1 flex-col justify-center px-3">
        <Kicker>Neighborhood compare</Kicker>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {[a, b].map((x, k) => (
            <div key={x.name} className={`relative h-14 overflow-hidden rounded-xl ${k === 1 ? 'order-3' : ''}`}>
              <Image src={x.photo} alt="" fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-black/45" />
              <p className="absolute inset-x-0 bottom-1.5 text-center font-serif text-[13px] font-black text-white">{x.name}</p>
            </div>
          ))}
          <span className="order-2 flex h-7 w-7 items-center justify-center rounded-full text-[8px] font-black text-[#111827] shadow" style={{ backgroundColor: C.gold }}>VS</span>
        </div>
        <div className="mt-2 space-y-1">
          {rows.map((r, k) => (
            <div key={r.label} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-white px-2 py-1.5 transition-all duration-500 dark:bg-[#151517] ${tick >= 3 + k * 4 ? 'opacity-100' : 'opacity-0'}`}>
              <p className={`text-center text-[8.5px] font-black ${r.win === 'a' ? 'text-emerald-600' : 'text-[#0B0B0B] dark:text-white'}`}>{r.a}</p>
              <p className="w-[78px] text-center text-[6.5px] font-black uppercase tracking-wide text-gray-400">{r.label}</p>
              <p className={`text-center text-[8.5px] font-black ${r.win === 'b' ? 'text-emerald-600' : 'text-[#0B0B0B] dark:text-white'}`}>{r.b}{r.win === 'b' && <span className="ml-1 rounded bg-emerald-50 px-1 text-[6px] text-emerald-600 dark:bg-emerald-500/10">{r.note}</span>}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecordScene({ tick, on }: { tick: number; on: On }) {
  const blog = tick >= 12
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0B0B0B]">
      <Nav />
      <div className="flex flex-1 flex-col justify-center gap-2.5 px-3">
        <div className={`rounded-2xl p-1.5 ${on(!blog)}`}>
          <div className="mb-1.5 flex items-end justify-between">
            <div><Kicker>Proven results</Kicker><h5 className="font-serif text-[15px] font-black text-[#0B0B0B] dark:text-white">Recent Sales</h5></div>
            <div className="flex gap-2.5 text-right">{[[String(AGENT.stats.totalSold), 'Sold'], [AGENT.stats.totalVolume, 'Volume']].map(([v, l]) => <div key={l}><p className="text-[11px] font-black text-[#0B0B0B] dark:text-white">{v}</p><p className="text-[5.5px] font-bold uppercase text-gray-400">{l}</p></div>)}</div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {REAL_RECENT_SALES.slice(0, 4).map(s => (
              <div key={s.address} className="relative aspect-square overflow-hidden rounded-lg">
                <Image src={s.photo} alt="" fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                <span className="absolute left-1 top-1 rounded bg-[#b23a3a] px-1 text-[5px] font-black uppercase text-white">Sold</span>
                <p className="absolute inset-x-1 bottom-1 text-[7.5px] font-black text-white">{money(s.price)}<span className="block truncate text-[5.5px] font-bold text-white/75">{s.city}</span></p>
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-2xl p-1.5 ${on(blog)}`}>
          <Kicker>Latest articles</Kicker>
          <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-gray-100 p-1.5 dark:border-gray-800">
            <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg"><Image src={REAL_BLOG.coverImage} alt="" fill className="object-cover" unoptimized /></div>
            <div className="min-w-0"><span className="text-[6.5px] font-black uppercase tracking-wide text-[#8b7355]">{REAL_BLOG.category}</span><p className="line-clamp-2 font-serif text-[10px] font-black leading-tight text-[#0B0B0B] dark:text-white">{REAL_BLOG.title}</p><p className="mt-0.5 flex items-center gap-1 text-[6.5px] font-black uppercase tracking-widest text-gray-400">Read article <ChevronRight className="h-2 w-2" /></p></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShowcaseScene({ tick }: { tick: number }) {
  const fields = [
    { label: 'Your name', value: 'Jordan M.', at: 2 },
    { label: 'Where', value: 'Villanova, Bryn Mawr', at: 6 },
    { label: 'Budget', value: '$1.5M – $2.5M', at: 10 },
    { label: 'Bedrooms', value: '4+', at: 13 },
  ]
  const created = tick >= 19
  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: C.navy }}>
      <Nav />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="dn-on w-full max-w-[300px] rounded-2xl bg-white p-3.5 dark:bg-[#151517]">
          <Kicker>Free home alerts</Kicker>
          <p className="mt-0.5 font-serif text-[14px] font-black text-[#0B0B0B] dark:text-white">Build Your Own Showcase</p>
          <p className="mb-2 text-[8px] font-semibold text-gray-500">Get new homes that match - the moment they list.</p>
          <div className="space-y-1.5">
            {fields.map(f => (
              <div key={f.label} className="rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
                <p className="text-[6px] font-black uppercase tracking-wide text-gray-400">{f.label}</p>
                <p className="h-3 text-[9px] font-bold text-[#0B0B0B] dark:text-white">{tick >= f.at ? <TypingAnimation text={f.value} speed={45} /> : ''}</p>
              </div>
            ))}
          </div>
          <div className={`mt-2 rounded-lg py-1.5 text-center text-[9px] font-black transition-all duration-300 ${created ? 'bg-emerald-500 text-white' : 'text-[#111827]'}`} style={created ? undefined : { backgroundColor: C.gold }}>{created ? '✓ Showcase created - 12 homes match' : 'Create My Showcase'}</div>
        </div>
      </div>
      {tick >= 21 && <Toast icon={UserPlus} title="New lead: Jordan M." sub="Built a Showcase on your site · added to your Leads" />}
    </div>
  )
}

function LeadScene({ tick }: { tick: number }) {
  const sent = tick >= 17
  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: C.navy }}>
      <Nav />
      <div className="relative flex flex-1 items-center gap-3 overflow-hidden px-4">
        <Image src={M[2].photo} alt="" fill className="object-cover opacity-25" unoptimized />
        <div className="relative w-[150px] flex-shrink-0">
          <p className="font-serif text-[18px] font-black leading-tight text-white">{REAL_IDX_SITE.sections[5].headline}</p>
          <p className="mt-1.5 text-[8.5px] font-semibold text-gray-300">Book a consultation with {AGENT.name.split(' ')[0]} today.</p>
          <div className="mt-2 flex items-center gap-1.5"><span className="relative h-7 w-7 overflow-hidden rounded-full ring-2" style={{ ['--tw-ring-color' as string]: C.gold }}><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></span><span className="text-[8px] font-black text-white">{AGENT.phone}</span></div>
        </div>
        <div className="dn-on relative flex-1 rounded-2xl bg-white p-3 dark:bg-[#151517]">
          {[['Name', 'Sam Patel', 2], ['Email', 'sam@email.com', 5], ['Message', 'Thinking of selling in the spring - what is my home worth?', 9]].map(([l, v, at]) => (
            <div key={l as string} className="mb-1.5 rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
              <p className="text-[6px] font-black uppercase tracking-wide text-gray-400">{l as string}</p>
              <p className="min-h-[12px] text-[8.5px] font-bold leading-snug text-[#0B0B0B] dark:text-white">{tick >= (at as number) ? <TypingAnimation text={v as string} speed={30} /> : ''}</p>
            </div>
          ))}
          <div className={`rounded-lg py-1.5 text-center text-[9px] font-black transition-all duration-300 ${sent ? 'bg-emerald-500 text-white' : 'text-[#111827]'}`} style={sent ? undefined : { backgroundColor: C.gold }}>{sent ? '✓ Sent' : 'Send Message'}</div>
        </div>
      </div>
      {tick >= 18 && <Toast icon={UserPlus} title="New lead: Sam Patel" sub="Seller · from your website · in your Leads now" />}
    </div>
  )
}

function EditorScene({ tick }: { tick: number }) {
  const design = tick >= 15
  const accents = ['#C9A24D', '#0f766e', '#7c3aed', '#C9A24D']
  const accent = design ? accents[Math.min(accents.length - 1, Math.floor((tick - 15) / 4))] : C.gold
  const moved = tick >= 6
  const hidden = tick >= 10
  const sections = ['Hero', 'Featured Listings', moved ? 'Neighborhoods' : 'Newly Listed', moved ? 'Newly Listed' : 'Neighborhoods', 'Recent Sales', 'Testimonials', 'Blog Posts', 'Contact']
  const tabs: [LucideIcon, string][] = [[Layers, 'Content'], [Palette, 'Design'], [Star, 'Featured'], [PlaySquare, 'Media'], [MapPin, 'Areas'], [Search, 'Google'], [Globe, 'Domain']]
  return (
    <div className="flex h-full bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      <div className="flex w-[54px] flex-shrink-0 flex-col gap-0.5 border-r border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-[#151517]">
        {tabs.map(([I, l], k) => {
          const act = design ? k === 1 : k === 0
          return <span key={l} className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[5.5px] font-black uppercase transition-colors duration-300 ${act ? 'bg-[#111827] text-[#e8c97a]' : 'text-gray-400'}`}><I className="h-3 w-3" />{l}</span>
        })}
      </div>
      <div className="w-[150px] flex-shrink-0 overflow-hidden border-r border-gray-200 p-2 dark:border-gray-800">
        {!design ? (
          <>
            <p className="text-[9px] font-black text-[#0B0B0B] dark:text-white">Your Home Page</p>
            <p className="mb-1.5 text-[6.5px] font-semibold text-gray-400">Reorder with the arrows, hide with the eye.</p>
            <div className="space-y-1">
              {sections.map((s, k) => {
                const isMoved = moved && s === 'Neighborhoods' && tick < 12
                const isHidden = hidden && s === 'Testimonials'
                return (
                  <div key={s} className={`dn-hl flex items-center gap-1 rounded-md border bg-white px-1.5 py-1 dark:bg-[#151517] ${isMoved || (isHidden && tick < 14) ? 'dn-on border-[#C9A24D]' : 'border-gray-200 dark:border-gray-800'} ${isHidden ? 'opacity-50' : ''}`} style={{ transition: 'all .5s ease' }}>
                    <span className="w-2 text-[6px] font-black text-gray-400">{k + 1}</span>
                    <span className={`flex-1 truncate text-[7.5px] font-bold ${isHidden ? 'text-gray-400 line-through' : 'text-[#0B0B0B] dark:text-white'}`}>{s}</span>
                    <ArrowUp className={`h-2 w-2 ${isMoved ? 'text-[#C9A24D]' : 'text-gray-300'}`} /><ArrowDown className="h-2 w-2 text-gray-300" />
                    {isHidden ? <EyeOff className="h-2.5 w-2.5 text-[#C9A24D]" /> : <Eye className="h-2.5 w-2.5 text-gray-300" />}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="dn-rise">
            <p className="text-[9px] font-black text-[#0B0B0B] dark:text-white">Look &amp; Feel</p>
            <p className="mb-2 text-[6.5px] font-semibold text-gray-400">Started from your Brand Kit.</p>
            <p className="text-[6px] font-black uppercase tracking-wide text-gray-400">Accent color</p>
            <div className="mt-1 flex gap-1.5">{['#C9A24D', '#0f766e', '#7c3aed', '#b91c1c'].map(c => <span key={c} className={`h-5 w-5 rounded-full transition-all duration-300 ${accent === c ? 'scale-110 ring-2 ring-offset-1 ring-[#111827] dark:ring-white dark:ring-offset-[#0B0B0B]' : ''}`} style={{ backgroundColor: c }} />)}</div>
            <p className="mt-2.5 text-[6px] font-black uppercase tracking-wide text-gray-400">Fonts</p>
            <div className="mt-1 space-y-1">{[['Playfair + Inter', true], ['Cormorant + Manrope', false]].map(([f, a]) => <span key={f as string} className={`block rounded-md border px-1.5 py-1 text-[7.5px] font-bold ${a ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#0B0B0B] dark:text-white' : 'border-gray-200 text-gray-500 dark:border-gray-800'}`}>{f as string}</span>)}</div>
            <p className="mt-2.5 text-[6px] font-black uppercase tracking-wide text-gray-400">Logo</p>
            <span className="mt-1 flex h-6 items-center justify-center rounded-md border border-dashed border-gray-300 text-[7px] font-bold text-gray-400 dark:border-gray-700">Upload logo</span>
          </div>
        )}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden p-1.5">
        <p className="mb-1 flex items-center gap-1 text-[6px] font-black uppercase tracking-widest text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live preview</p>
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800" style={{ transition: 'all .4s ease' }}>
          <div className="relative h-[110px]" style={{ backgroundColor: C.navy }}>
            <Image src={L[0].photo} alt="" fill className="object-cover opacity-40" unoptimized />
            <div className="relative flex h-full flex-col items-center justify-center px-2 text-center">
              <p className="text-[5px] font-black uppercase tracking-[0.2em] transition-colors duration-500" style={{ color: accent }}>{REAL_IDX_SITE.market}</p>
              <p className="mt-0.5 font-serif text-[11px] font-black leading-tight text-white">Find Your <span className="transition-colors duration-500" style={{ color: accent }}>Dream Home</span></p>
              <span className="mt-1.5 rounded-full px-2 py-0.5 text-[5.5px] font-black uppercase text-white transition-colors duration-500" style={{ backgroundColor: accent }}>Search</span>
            </div>
          </div>
          {sections.filter(s => !(hidden && s === 'Testimonials')).slice(1, 6).map((s, k) => (
            <div key={s} className={`flex items-center gap-1.5 border-t border-gray-100 bg-white px-1.5 py-1.5 dark:border-gray-800 dark:bg-[#151517] ${moved && s === 'Neighborhoods' && tick < 12 ? 'bg-[#C9A24D]/10' : ''}`} style={{ transition: 'background-color .5s ease' }}>
              <span className="h-3 w-1 rounded-full transition-colors duration-500" style={{ backgroundColor: accent }} />
              <span className="text-[7px] font-black text-[#0B0B0B] dark:text-white">{s}</span>
              <span className="ml-auto flex gap-0.5">{[0, 1, 2].map(j => <span key={j} className="h-3 w-4 rounded-sm bg-gray-100 dark:bg-gray-800" style={k === 0 && j === 0 ? { backgroundColor: accent, opacity: 0.6 } : undefined} />)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DomainScene({ tick }: { tick: number }) {
  const typed = tick >= 3
  const steps = ['Add DNS record', 'We verify it', 'HTTPS live']
  const stepDone = (k: number) => tick >= 10 + k * 4
  const live = tick >= 22
  if (live) {
    return (
      <div className="dn-pop relative h-full" style={{ backgroundColor: C.navy }}>
        <Nav />
        <div className="relative flex h-[calc(100%-29px)] flex-col items-center justify-center px-6 text-center">
          <Image src={L[1].photo} alt="" fill className="object-cover opacity-45" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/50 to-[#111827]/70" />
          <p className="relative flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300"><Lock className="h-2.5 w-2.5" />{OWN_DOMAIN}</p>
          <h4 className="relative mt-2 font-serif text-[22px] font-black leading-tight text-white">Find Your <span style={{ color: C.gold }}>Dream Home</span></h4>
          <div className="relative mt-3 grid w-full max-w-[320px] grid-cols-3 gap-1.5">
            {['/hub', '/showcase', '/blog'].map(p => <span key={p} className="truncate rounded-lg bg-white/10 px-1.5 py-1.5 text-[7px] font-black text-white ">{OWN_DOMAIN}{p}</span>)}
          </div>
          <p className="relative mt-2 text-[7.5px] font-semibold text-white/60">Agent Hub, Showcases, Forms, kits and blogs - all on your domain</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full bg-[#FAFAF7] dark:bg-[#0B0B0B]">
      <div className="flex-1 p-3">
        <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#8b7355]">Domain</p>
        <p className="text-[13px] font-black text-[#0B0B0B] dark:text-white">Your Domain</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 dark:border-gray-800 dark:bg-[#151517]">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          <div className="min-w-0 flex-1"><p className="text-[6px] font-black uppercase tracking-wide text-gray-400">Free OpenHousePal address</p><p className="truncate text-[9px] font-bold text-[#0B0B0B] dark:text-white">{SUB}</p></div>
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[6.5px] font-black uppercase text-emerald-600 dark:bg-emerald-500/10">Live</span>
        </div>
        <div className="dn-on mt-2 rounded-xl bg-white p-2.5 dark:bg-[#151517]">
          <p className="text-[6px] font-black uppercase tracking-wide text-gray-400">Connect a domain you own</p>
          <div className="mt-1 flex gap-1.5">
            <div className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[9.5px] font-bold text-[#0B0B0B] dark:border-gray-700 dark:text-white">{typed ? <TypingAnimation text={OWN_DOMAIN} speed={60} /> : <span className="text-gray-300">yourname.com</span>}</div>
            <span className={`rounded-lg px-2.5 py-1.5 text-[8px] font-black text-white transition-colors duration-300 ${tick >= 8 ? 'bg-[#111827]' : 'bg-gray-300 dark:bg-gray-700'}`}>Connect</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            {steps.map((s, k) => (
              <div key={s} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black transition-all duration-500 ${stepDone(k) ? 'bg-emerald-500 text-white' : tick >= 9 + k * 4 ? 'animate-pulse bg-amber-400 text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>{stepDone(k) ? <Check className="h-3 w-3" strokeWidth={3} /> : k + 1}</span>
                  <span className="whitespace-nowrap text-[6.5px] font-black text-gray-500">{s}</span>
                </div>
                {k < steps.length - 1 && <span className={`mx-1 mb-3 h-0.5 flex-1 rounded-full transition-colors duration-500 ${stepDone(k) ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-800'}`} />}
              </div>
            ))}
          </div>
          {tick >= 9 && tick < 18 && (
            <div className="dn-rise mt-2 rounded-lg bg-gray-50 p-1.5 font-mono text-[7px] text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <p><span className="font-black text-[#8b7355]">CNAME</span>&nbsp; www → sites.openhousepal.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleScene({ tick }: { tick: number }) {
  return (
    <div className="h-full bg-white p-4 dark:bg-[#202124]">
      <div className="flex items-center gap-2">
        <span className="text-[16px] font-black tracking-tight"><span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span><span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span></span>
        <div className="flex flex-1 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 shadow-sm dark:border-gray-700"><span className="flex-1 text-[9px] text-[#202124] dark:text-gray-200"><TypingAnimation text="villanova real estate agent" speed={50} startDelay={200} /></span><Search className="h-3 w-3 text-[#4285F4]" /></div>
      </div>
      {tick >= 9 && (
        <div className="dn-pop dn-on mt-4 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: C.navy }}><HomeIcon className="h-2.5 w-2.5" style={{ color: C.gold }} /></span>
            <div className="leading-tight"><p className="text-[8.5px] text-[#202124] dark:text-gray-200">{AGENT.name}</p><p className="text-[7.5px] text-gray-500">https://{OWN_DOMAIN}</p></div>
          </div>
          <p className="mt-1 text-[13px] font-medium text-[#1a0dab] dark:text-[#8ab4f8]">{AGENT.name} | Philly Main Line Real Estate</p>
          <p className="text-[8.5px] leading-snug text-[#4d5156] dark:text-gray-400">Search every home for sale on the Main Line, explore Villanova, Gladwyne and Bryn Mawr, and see {AGENT.name.split(' ')[0]}&apos;s recent sales.</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
            {['Search Homes', 'Neighborhoods', 'Featured Listings', 'Blog'].map(l => <span key={l} className="flex items-center gap-1 text-[9px] text-[#1a0dab] dark:text-[#8ab4f8]"><ChevronRight className="h-2.5 w-2.5 text-gray-400" />{l}</span>)}
          </div>
        </div>
      )}
      {tick >= 15 && (
        <div className="dn-rise mt-3 flex flex-wrap gap-1.5">
          {[[Sparkles, 'Sitemap built for you'], [SlidersHorizontal, 'Your title & description'], [MapPin, 'A page per neighborhood']].map(([I, l]) => {
            const Ic = I as LucideIcon
            return <span key={l as string} className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/12 px-2 py-1 text-[8px] font-black text-[#8b6a2b] dark:text-[#e8c97a]"><Ic className="h-2.5 w-2.5" />{l as string}</span>
          })}
        </div>
      )}
    </div>
  )
}
