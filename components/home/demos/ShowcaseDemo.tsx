'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Bell, BedDouble, Calendar, Check, ChevronLeft, ChevronRight, ClipboardList, DollarSign, Heart, Home as HomeIcon, Layout, Mail, MapPin, MessageSquare, Radio, Send, SlidersHorizontal, Sparkles, ThumbsDown, ThumbsUp, TrendingDown, UserCheck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TypingAnimation from '@/components/TypingAnimation'
import TitleSlide from './TitleSlide'
import DemoPointer from './DemoPointer'
import { DemoCaption, DemoNote, DEMO_NOTE_CSS, STAGE_BG } from './DemoNote'
import { AGENT, REAL_SHOWCASE } from './realData'

// The real Showcase flow on the user's own client (Donna, seeded from 840 Harriton Rd, Bryn Mawr -
// openhousepal.com/showcase/coll-gCAHhqrJkVDw), told the same way as the Agent Hub demo: a note
// beside the stage explains one thing at a time, and that exact part of the screen is outlined in
// gold while everything else dims. Order: created automatically at an open house -> or built by
// hand -> criteria -> Donna's own page (match scores vs. the home she loved) -> like / pass ->
// comments -> tour request -> new matches + price drops + email alert -> the agent's live feed.
const PROPS = REAL_SHOWCASE.matches
const PREFS = REAL_SHOWCASE.preferences
const CLIENT = REAL_SHOWCASE.clientFirstName
const SEED = REAL_SHOWCASE.originalProperty
// Illustrative match scores in the real badge style (the live page computes them with
// computeMatchScore vs. the seed home); the price drop and tour time below are illustrative too.
const MATCH = [94, 91, 88, 86, 83, 79]
const CLIENT_URL = `openhousepal.com/showcase/${REAL_SHOWCASE.shareToken}`

const CRITERIA = [
  { icon: MapPin, label: 'Area', value: `${PREFS.radiusMiles} mi around ${SEED.city}` },
  { icon: DollarSign, label: 'Budget', value: `$${(PREFS.minPrice / 1e6).toFixed(2)}M – $${(PREFS.maxPrice / 1e6).toFixed(2)}M` },
  { icon: BedDouble, label: 'Bedrooms', value: `${PREFS.minBeds}+ beds` },
  { icon: HomeIcon, label: 'Home type', value: 'Single-family' },
]

type Scene = 'auto' | 'create' | 'criteria' | 'matches' | 'react' | 'comment' | 'tour' | 'alerts' | 'agent'
const STOPS: { id: Scene; hold: number; icon: LucideIcon; title: string; body: string; url: string }[] = [
  { id: 'auto', hold: 7200, icon: Sparkles, title: 'Made for you at open houses', body: 'No agent? They get one automatically.', url: 'app.openhousepal.com/open-houses' },
  { id: 'create', hold: 6400, icon: Layout, title: 'Or make one in seconds', body: 'A name + a home they love.', url: 'app.openhousepal.com/showcases' },
  { id: 'criteria', hold: 6400, icon: SlidersHorizontal, title: 'Exactly what they want', body: 'Area, budget, beds, type.', url: 'app.openhousepal.com/showcases' },
  { id: 'matches', hold: 6600, icon: HomeIcon, title: 'Their own home search', body: 'Every home gets a match score.', url: CLIENT_URL },
  { id: 'react', hold: 6800, icon: ThumbsUp, title: 'Like or pass', body: 'One tap. You learn their taste.', url: CLIENT_URL },
  { id: 'comment', hold: 7000, icon: MessageSquare, title: 'Questions on each home', body: 'You answer right there.', url: CLIENT_URL },
  { id: 'tour', hold: 7400, icon: Calendar, title: 'Tours in one tap', body: 'They pick a time. You confirm.', url: CLIENT_URL },
  { id: 'alerts', hold: 7000, icon: Bell, title: 'New homes, automatically', body: 'Price drops too - plus an email.', url: CLIENT_URL },
  { id: 'agent', hold: 7200, icon: Radio, title: 'See it all, live', body: 'Know exactly when to call.', url: 'app.openhousepal.com/showcases' },
]

type Beat = { k: 'title' } | { k: 'stop'; n: number }
const BEATS: Beat[] = [{ k: 'title' }, ...STOPS.map((_, n) => ({ k: 'stop' as const, n }))]
const TITLE_MS = 5200
const beatDuration = (b: Beat) => (b.k === 'title' ? TITLE_MS : STOPS[b.n].hold)
const TOTAL_PAGES = BEATS.length

function InitialAvatar({ name, size = 16 }: { name: string; size?: number }) {
  return <div className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b6f2e] font-black text-white" style={{ width: size, height: size, fontSize: size * 0.42 }}>{name[0]}</div>
}

function AgentAvatar({ size = 16 }: { size?: number }) {
  return <div className="relative flex-shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></div>
}

// Donna's real Showcase page (app/showcase/[shareToken]): header card with the gold top edge,
// Emails toggle + Refine, the "Matches / Liked / Disliked / Sold" tab bar built into its bottom
// edge, the "Comparing to" reference card, then the matched-home grid.
function ClientPage({ scene, tick, hl }: { scene: Scene; tick: number; hl: (id: string) => string }) {
  const liked = scene === 'react' ? tick >= 7 : ['comment', 'tour', 'alerts'].includes(scene)
  const passed = scene === 'react' ? tick >= 15 : ['comment', 'tour', 'alerts'].includes(scene)
  const tapLike = scene === 'react' && tick >= 5 && tick < 9
  const tapPass = scene === 'react' && tick >= 13 && tick < 17
  const newHome = scene === 'alerts' && tick >= 6
  const priceDrop = scene === 'alerts' && tick >= 11
  const emailToast = scene === 'alerts' && tick >= 15
  const tourBanner = (scene === 'tour' && tick >= 22) || scene === 'alerts'
  const homes = newHome ? [{ ...PROPS[5], fresh: true }, ...PROPS.slice(0, 5).map(p => ({ ...p, fresh: false }))] : PROPS.map(p => ({ ...p, fresh: false }))
  const counts = { all: PROPS.length + (newHome ? 1 : 0), liked: liked ? 1 : 0, disliked: passed ? 1 : 0 }

  return (
    <div className="relative flex h-full flex-col gap-2 bg-[#FAFAF7] p-2.5 dark:bg-[#0B0B0B]">
      {tourBanner && (
        <div className="dn-pop relative flex items-center gap-2 overflow-hidden rounded-xl border border-[#C9A24D]/30 bg-white px-2.5 py-1.5 dark:bg-[#151517]">
          <span className="absolute inset-y-0 left-0 w-1 bg-[#C9A24D]" />
          <Calendar className="h-3 w-3 text-[#C9A24D]" />
          <p className="flex-1 truncate text-[8.5px] font-black text-[#0B0B0B] dark:text-white">Your Upcoming Tours · {PROPS[0].address} · Sat 11:00 AM</p>
          <span className="rounded-full border border-[#C9A24D]/20 bg-[#C9A24D]/10 px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-widest text-[#C9A24D]">Confirmed</span>
        </div>
      )}
      <div className={`dn-hl relative flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517] ${hl('header')}`}>
        <div className="absolute inset-x-0 top-0 h-1 bg-[#C9A24D]" />
        <div className="px-3 pb-2 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-[13px] font-black tracking-tight text-[#0B0B0B] dark:text-white">{CLIENT}&apos;s Showcase</h4>
            <div className="flex items-center gap-1.5">
              <span className={`dn-hl flex items-center gap-1 rounded-lg border border-[#C9A24D]/25 bg-[#C9A24D]/10 px-1.5 py-1 ${hl('emails')}`}>
                <span className="text-[6.5px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8cf8a]">Emails</span>
                <span className="relative inline-flex h-3 w-[22px] rounded-full bg-[#C9A24D]"><span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-white shadow" /></span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[#C9A24D]/40 bg-[#151517] px-2 py-1 text-[6.5px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]"><SlidersHorizontal className="h-2.5 w-2.5" />Refine</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-[7.5px] font-medium text-gray-500 dark:text-gray-400">New listings and price changes show up here on their own.</p>
            <span className={`dn-hl flex flex-shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-wide text-emerald-600 dark:bg-emerald-500/10 ${hl('live')}`}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
          </div>
        </div>
        <div className={`dn-hl grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50/70 dark:divide-gray-800 dark:border-gray-800 dark:bg-white/[0.03] ${hl('tabs')}`}>
          {[['Matches', counts.all], ['Liked', counts.liked], ['Disliked', counts.disliked], ['Sold', 0]].map(([l, c], k) => (
            <span key={l as string} className={`flex items-center justify-center gap-1 py-1.5 text-[8px] font-bold ${k === 0 ? 'bg-white text-[#0B0B0B] shadow-[inset_0_2px_0_0_#C9A24D] dark:bg-[#151517] dark:text-white' : 'text-gray-500'}`}>
              {l}<span key={`${l}-${c}`} className={`rounded-full px-1 text-[7px] ${k === 0 ? 'bg-[#C9A24D]/15 text-[#8b7355]' : (c as number) > 0 ? 'dn-pop bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{c as number}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className={`dn-hl flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1 pl-1 pr-2.5 dark:border-gray-800 dark:bg-[#151517] ${hl('compare')}`}>
          <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-gray-100"><Image src={PROPS[2].photo} alt="" fill className="object-cover" unoptimized /></div>
          <div className="leading-tight">
            <p className="text-[6px] font-bold uppercase tracking-widest text-[#C9A24D]">Built around</p>
            <p className="text-[8px] font-black text-[#0B0B0B] dark:text-white">{SEED.address}</p>
            <p className="text-[6.5px] font-semibold text-gray-400">{SEED.city} · ${SEED.price.toLocaleString()}</p>
          </div>
        </div>
        <span className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[7.5px] font-bold text-gray-500 dark:border-gray-800 dark:bg-[#151517]">Sort: Best Match</span>
      </div>

      <div className={`dn-hl grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-1.5 rounded-xl ${hl('grid')}`}>
        {homes.map((p, idx) => {
          const isLikeTarget = p.address === PROPS[0].address
          const isPassTarget = p.address === PROPS[1].address
          const isDropTarget = p.address === PROPS[2].address
          const match = p.fresh ? 89 : MATCH[PROPS.findIndex(x => x.address === p.address)]
          return (
            <div key={p.address} className={`flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white dark:bg-[#151517] ${p.fresh ? 'dn-pop border-[#C9A24D] shadow-[0_0_0_3px_rgba(201,162,77,.25)]' : 'border-gray-100 dark:border-gray-800'} ${isPassTarget && passed ? 'opacity-50' : ''}`} style={{ transition: 'opacity .5s ease' }}>
              <div className="relative min-h-0 flex-[3] bg-gray-100 dark:bg-gray-800">
                <Image src={p.photo} alt={p.address} fill className="object-cover" unoptimized />
                <span className={`dn-hl absolute left-1 top-1 rounded bg-emerald-600 px-1 py-0.5 text-[5.5px] font-black text-white ${scene === 'matches' && idx < 3 ? 'dn-on' : ''}`}>{match}% MATCH</span>
                {p.fresh && <span className="absolute right-1 top-1 rounded bg-[#C9A24D] px-1 py-0.5 text-[5.5px] font-black uppercase text-[#111827]">New</span>}
                {isDropTarget && priceDrop && <span className="dn-pop absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-red-500 px-1 py-0.5 text-[5.5px] font-black uppercase text-white"><TrendingDown className="h-2 w-2" />-$100K</span>}
              </div>
              <div className="flex flex-[2] flex-col justify-center px-1.5 py-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[8.5px] font-black text-[#111827] dark:text-white">${((isDropTarget && priceDrop ? p.price - 100000 : p.price) / 1e6).toFixed(2)}M</span>
                  <div className="relative flex flex-shrink-0 items-center gap-1">
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-300 ${isLikeTarget && liked ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}><ThumbsUp className="h-2 w-2" /></span>
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-300 ${isPassTarget && passed ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}><ThumbsDown className="h-2 w-2" /></span>
                    {((isLikeTarget && tapLike) || (isPassTarget && tapPass)) && (
                      <span className={`pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 ${isLikeTarget ? '-left-[3px]' : 'left-[11px]'}`}><span className="dn-tap absolute inset-0 rounded-full bg-[#C9A24D]/60" /><span className="absolute inset-[30%] rounded-full bg-[#C9A24D]" /></span>
                    )}
                  </div>
                </div>
                <p className="truncate text-[6px] font-bold uppercase tracking-wide text-gray-400">{p.address}</p>
                <p className="truncate text-[6px] font-black text-gray-500">{p.beds} bd · {p.baths} ba · {p.city}</p>
              </div>
            </div>
          )
        })}
      </div>

      {emailToast && (
        <div className="dn-toast absolute inset-x-6 top-2 z-30 flex items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-xl ring-1 ring-black/5 dark:bg-[#1c1c1f]/95">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a]"><Mail className="h-3.5 w-3.5" /></span>
          <div className="min-w-0"><p className="text-[9.5px] font-black text-[#111827] dark:text-white">Email to {CLIENT}: 1 new home + 1 price drop</p><p className="truncate text-[8px] font-semibold text-gray-500">From {AGENT.name} · tap to see them in your Showcase</p></div>
        </div>
      )}
    </div>
  )
}

export default function ShowcaseDemo() {
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
        icon={Layout}
        kicker="Client Engagement"
        title="Showcases"
        body="A personal home search for every client - likes, comments, tours & alerts."
        nowrapBody
        ai
        durationMs={TITLE_MS}
        totalPages={TOTAL_PAGES}
        pageIndex={0}
        url="app.openhousepal.com/showcases"
      />
    )
  }

  const stop = STOPS[beat.n]
  const scene = stop.id
  const isClient = ['matches', 'react', 'comment', 'tour', 'alerts'].includes(scene)
  // What gets the gold outline in each scene (everything else in the client page dims).
  const focus: Record<Scene, string[]> = {
    auto: [], create: [], criteria: [],
    matches: ['compare', 'grid'], react: ['grid', 'tabs'], comment: [], tour: [], alerts: ['grid', 'live', 'emails'], agent: [],
  }
  const hl = (id: string) => (focus[scene].includes(id) ? 'dn-on' : focus[scene].length ? 'dn-off' : '')

  return (
    <BrowserFrame url={stop.url} progress={{ pages: TOTAL_PAGES, current: 1 + beat.n, durationMs: stop.hold }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className={`relative flex h-[420px] items-center justify-center gap-5 overflow-hidden px-4 ${STAGE_BG}`}>
        <DemoNote id={stop.id} icon={stop.icon} title={stop.title} body={stop.body} index={beat.n} count={STOPS.length}>
          {scene === 'auto' && tick >= 16 && <p className="dn-rise mt-2 inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-1 text-[9.5px] font-black text-[#8b6a2b] dark:text-[#e8c97a]"><Sparkles className="h-3 w-3" /> Zero work for you</p>}
          {scene === 'agent' && tick >= 18 && <p className="dn-rise mt-2 inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-1 text-[9.5px] font-black text-[#8b6a2b] dark:text-[#e8c97a]"><Bell className="h-3 w-3" /> Instant notifications</p>}
        </DemoNote>

        {/* the stage */}
        <div className="relative h-[380px] w-full max-w-[430px] flex-shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)] dark:border-white/10 dark:bg-[#151517]">

          {scene === 'auto' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#FAFAF7] p-5 dark:bg-[#0B0B0B]">
              <div className="dn-pop w-full max-w-[310px] rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <p className="flex items-center gap-1 text-[7.5px] font-black uppercase tracking-widest text-[#8b7355]"><ClipboardList className="h-3 w-3" /> New open house sign-in</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <InitialAvatar name={CLIENT} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-[#0B0B0B] dark:text-white">{CLIENT}</p>
                    <p className="truncate text-[8.5px] font-semibold text-gray-500">Signed in at {SEED.address}, {SEED.city}</p>
                  </div>
                </div>
                <div className={`dn-hl mt-2.5 flex items-center justify-between rounded-lg border border-gray-100 px-2.5 py-1.5 dark:border-gray-800 ${tick >= 4 ? 'dn-on' : ''}`}>
                  <span className="text-[8.5px] font-bold text-gray-500">Working with an agent?</span>
                  <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[8px] font-black text-white dark:bg-white dark:text-[#111827]">No</span>
                </div>
              </div>
              {tick >= 7 && (
                <svg className="dn-rise h-7 w-4 text-[#C9A24D]" viewBox="0 0 16 28" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M8 2v22M2 18l6 6 6-6" /></svg>
              )}
              {tick >= 9 && (
                <div className="dn-pop dn-on w-full max-w-[310px] rounded-2xl bg-gradient-to-br from-[#111827] via-[#172033] to-[#3a2f25] p-3 text-white">
                  <p className="flex items-center gap-1 text-[7.5px] font-black uppercase tracking-widest text-[#e8c97a]"><Sparkles className="h-3 w-3" /> Showcase created automatically</p>
                  <p className="mt-1 text-[12px] font-black">{CLIENT}&apos;s Showcase · {PROPS.length} similar homes</p>
                  <div className="mt-2 flex gap-1.5">
                    {PROPS.slice(0, 4).map((p, k) => (
                      <div key={p.address} className="dn-pop relative h-12 flex-1 overflow-hidden rounded-lg" style={{ animationDelay: `${150 + k * 120}ms` }}><Image src={p.photo} alt="" fill className="object-cover" unoptimized /></div>
                    ))}
                  </div>
                  <p className="mt-2 text-[8px] font-semibold text-gray-300">Link sent to {CLIENT} with your name and photo on it.</p>
                </div>
              )}
            </div>
          )}

          {scene === 'create' && (
            <div className="flex h-full items-center justify-center bg-[#FAFAF7] p-5 dark:bg-[#0B0B0B]">
              <div className="dn-pop dn-on w-full max-w-[310px] rounded-2xl bg-white p-4 dark:bg-[#151517]">
                <p className="text-[13px] font-black text-[#0B0B0B] dark:text-white">Create New Showcase</p>
                <p className="mb-3 text-[9px] text-gray-400">A personalized home search for your client.</p>
                <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">Client name</label>
                <div className="mb-2.5 rounded-lg border border-gray-200 px-2.5 py-2 text-[10px] font-medium text-[#111827] dark:border-gray-700 dark:text-gray-200"><TypingAnimation text={CLIENT} speed={110} startDelay={300} />&nbsp;</div>
                <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">A home they love</label>
                <div className="mb-3 flex gap-1.5">
                  <div className="flex-1 truncate rounded-lg border border-gray-200 px-2.5 py-2 text-[9.5px] font-medium text-[#111827] dark:border-gray-700 dark:text-gray-200">{tick >= 6 ? <TypingAnimation text={`${SEED.address}, ${SEED.city}`} speed={45} /> : ''}&nbsp;</div>
                  <div className="w-14 rounded-lg border-2 border-[#C9A24D] px-2 py-2 text-center text-[9.5px] font-bold text-[#111827] dark:text-white">{PREFS.radiusMiles} mi</div>
                </div>
                <div className={`relative w-full rounded-lg py-2 text-center text-[9.5px] font-black transition-all duration-300 ${tick >= 19 ? 'bg-green-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
                  {tick >= 19 ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" strokeWidth={3} /> Created - {PROPS.length} matches found</span> : 'Create Showcase'}
                </div>
              </div>
              <DemoPointer x={tick >= 16 ? 62 : 80} y={tick >= 16 ? 77 : 92} click={tick >= 18 && tick < 20} show={tick >= 12} />
            </div>
          )}

          {scene === 'criteria' && (
            <div className="flex h-full items-center justify-center bg-[#FAFAF7] p-5 dark:bg-[#0B0B0B]">
              <div className="w-full max-w-[310px]">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Showcase search</p>
                <h4 className="mb-3 mt-1 text-[15px] font-black text-[#0B0B0B] dark:text-white">What is {CLIENT} looking for?</h4>
                <div className="space-y-1.5">
                  {CRITERIA.map((c, idx) => {
                    const shown = tick >= 2 + idx * 4
                    const current = shown && tick < 6 + idx * 4
                    return (
                      <div key={c.label} className={`dn-hl flex items-center gap-2.5 rounded-xl border-2 bg-white px-3 py-2 dark:bg-[#151517] ${!shown ? 'border-dashed border-gray-200 opacity-40 dark:border-gray-800' : current ? 'dn-on border-[#C9A24D]' : 'border-[#C9A24D]/40'}`}>
                        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${shown ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-300 dark:bg-gray-800'}`}><c.icon className="h-3 w-3" /></div>
                        <div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-wide text-gray-400">{c.label}</p><p className="truncate text-[10.5px] font-black text-[#0B0B0B] dark:text-white">{shown ? c.value : '—'}</p></div>
                        {shown && !current && <Check className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-emerald-500" strokeWidth={3} />}
                      </div>
                    )
                  })}
                </div>
                <div className={`mt-3 w-full rounded-lg py-2 text-center text-[9.5px] font-black transition-all duration-300 ${tick >= 19 ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-gray-200 text-gray-400 dark:bg-gray-800'}`}>{tick >= 22 ? `✓ ${PROPS.length} homes match` : 'Save & Find Matches'}</div>
              </div>
            </div>
          )}

          {isClient && (
            <div className="relative h-full">
              <ClientPage scene={scene} tick={tick} hl={hl} />

              {scene === 'comment' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-5">
                  <div className="dn-pop dn-on flex w-full max-w-[290px] flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#151517]">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                      <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-md"><Image src={PROPS[0].photo} alt="" fill className="object-cover" unoptimized /></div>
                      <p className="flex-1 truncate text-[10px] font-black text-[#0B0B0B] dark:text-white">{PROPS[0].address} · Comments</p>
                      <X className="h-3 w-3 text-gray-300" />
                    </div>
                    <div className="h-[150px] space-y-3 p-3">
                      {tick >= 2 && (
                        <div className="dn-rise">
                          <div className="mb-0.5 flex items-center gap-1.5"><InitialAvatar name={CLIENT} /><span className="text-[8px] font-black uppercase text-[#0B0B0B] dark:text-white">{CLIENT}</span><span className="text-[7px] text-gray-400">Just now</span></div>
                          <p className="ml-5 inline-block rounded-2xl rounded-tl-sm bg-gray-100 px-2.5 py-1.5 text-[9.5px] text-gray-700 dark:bg-gray-800 dark:text-gray-200"><TypingAnimation text="Love the kitchen! Can I see the seller's disclosure?" speed={35} /></p>
                        </div>
                      )}
                      {tick >= 13 && (
                        <div className="dn-rise text-right">
                          <div className="mb-0.5 flex items-center justify-end gap-1.5"><span className="text-[7px] text-gray-400">Just now</span><span className="text-[8px] font-black uppercase text-[#0B0B0B] dark:text-white">{AGENT.name.split(' ')[0]} · Agent</span><AgentAvatar /></div>
                          <p className="mr-5 inline-block rounded-2xl rounded-tr-sm bg-[#C9A24D]/20 px-2.5 py-1.5 text-left text-[9.5px] text-[#3a2f12] dark:text-[#f3dfa8]"><TypingAnimation text="Just emailed it over - want to see it Saturday?" speed={35} /></p>
                        </div>
                      )}
                      {tick >= 23 && (
                        <div className="dn-rise">
                          <div className="mb-0.5 flex items-center gap-1.5"><InitialAvatar name={CLIENT} /><span className="text-[8px] font-black uppercase text-[#0B0B0B] dark:text-white">{CLIENT}</span></div>
                          <p className="ml-5 inline-block rounded-2xl rounded-tl-sm bg-gray-100 px-2.5 py-1.5 text-[9.5px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">Yes please! 🙌</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                      <div className="flex-1 rounded-full border border-gray-200 px-2.5 py-1.5 text-[8px] text-gray-300 dark:border-gray-700">Write a message…</div>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D]"><Send className="h-3 w-3 text-[#111827]" /></div>
                    </div>
                  </div>
                </div>
              )}

              {scene === 'tour' && tick < 22 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-5">
                  <div className="dn-pop dn-on w-full max-w-[290px] overflow-hidden rounded-2xl bg-white dark:bg-[#151517]">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
                      <Calendar className="h-3.5 w-3.5 text-[#C9A24D]" />
                      <p className="flex-1 truncate text-[10px] font-black text-[#0B0B0B] dark:text-white">Schedule a Tour · {PROPS[0].address}</p>
                      <X className="h-3 w-3 text-gray-300" />
                    </div>
                    <div className="p-3">
                      <div className="mb-1.5 flex items-center justify-between text-[9px] font-black text-[#0B0B0B] dark:text-white"><ChevronLeft className="h-3 w-3 text-gray-300" />October 2026<ChevronRight className="h-3 w-3 text-gray-400" /></div>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => <span key={k} className="text-[6.5px] font-black text-gray-400">{d}</span>)}
                        {/* Oct 1, 2026 is a Thursday */}
                        {[0, 1, 2].map(k => <span key={`b${k}`} />)}
                        {Array.from({ length: 14 }, (_, k) => k + 1).map(d => {
                          const past = d < 2
                          const picked = d === 3 && tick >= 5
                          return <span key={d} className={`rounded-md py-1 text-[8px] font-bold transition-all duration-300 ${past ? 'text-gray-300 dark:text-gray-700' : picked ? 'scale-110 bg-[#C9A24D] text-[#111827] shadow' : 'text-[#0B0B0B] dark:text-gray-200'}`}>{d}</span>
                        })}
                      </div>
                      <p className="mb-1 mt-2.5 text-[7px] font-black uppercase tracking-wide text-gray-400">Pick a time</p>
                      <div className="grid grid-cols-3 gap-1">
                        {['10:00 AM', '11:00 AM', '1:00 PM'].map(t => (
                          <span key={t} className={`rounded-md border py-1 text-center text-[8px] font-bold transition-all duration-300 ${t === '11:00 AM' && tick >= 10 ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#0B0B0B] dark:text-white' : 'border-gray-200 text-gray-500 dark:border-gray-700'}`}>{t}</span>
                        ))}
                      </div>
                      <div className={`mt-3 rounded-lg py-2 text-center text-[9.5px] font-black transition-all duration-300 ${tick >= 16 ? 'bg-green-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{tick >= 16 ? '✓ Tour requested - Sat, Oct 3 · 11:00 AM' : 'Request Tour'}</div>
                    </div>
                  </div>
                  <DemoPointer x={tick < 8 ? 68 : 50} y={tick < 8 ? 40 : tick < 13 ? 62 : 74} click={(tick >= 4 && tick < 6) || (tick >= 9 && tick < 11) || (tick >= 14 && tick < 16)} show={tick >= 2} />
                </div>
              )}
            </div>
          )}

          {scene === 'agent' && (
            <div className="flex h-full flex-col bg-[#FAFAF7] p-3 dark:bg-[#0B0B0B]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[7.5px] font-black uppercase tracking-widest text-[#8b7355]">Your Showcases</p>
                  <p className="text-[13px] font-black text-[#0B0B0B] dark:text-white">{CLIENT}&apos;s Showcase · Activity</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[7px] font-black uppercase text-emerald-600 dark:bg-emerald-500/10"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[['Liked', '1', Heart], ['Comments', '2', MessageSquare], ['Tours', '1', Calendar]].map(([l, v, Ic]) => {
                  const I = Ic as LucideIcon
                  return <div key={l as string} className="rounded-xl border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-800 dark:bg-[#151517]"><p className="flex items-center gap-1 text-[6.5px] font-black uppercase tracking-wide text-gray-400"><I className="h-2.5 w-2.5 text-[#C9A24D]" />{l as string}</p><p className="text-[14px] font-black text-[#0B0B0B] dark:text-white">{v as string}</p></div>
                })}
              </div>
              <div className="mt-2 flex-1 space-y-1.5 overflow-hidden">
                {[
                  { at: 2, icon: ThumbsUp, tone: 'bg-green-500', text: `${CLIENT} liked ${PROPS[0].address}`, sub: `${MATCH[0]}% match · ${PROPS[0].city}` },
                  { at: 7, icon: MessageSquare, tone: 'bg-[#C9A24D]', text: `${CLIENT} commented on ${PROPS[0].address}`, sub: '"Love the kitchen! Can I see the seller\'s disclosure?"' },
                  { at: 12, icon: Calendar, tone: 'bg-[#111827]', text: `${CLIENT} requested a tour`, sub: 'Sat, Oct 3 · 11:00 AM · tap to confirm' },
                  { at: 17, icon: ThumbsDown, tone: 'bg-red-500', text: `${CLIENT} passed on ${PROPS[1].address}`, sub: 'Now you know what to skip' },
                ].filter(e => tick >= e.at).reverse().map(e => (
                  <div key={e.text} className="dn-pop flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-white ${e.tone}`}><e.icon className="h-3 w-3" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-black text-[#0B0B0B] dark:text-white">{e.text}</p><p className="truncate text-[8px] font-semibold text-gray-500">{e.sub}</p></div>
                    <span className="text-[7px] font-bold text-gray-400">now</span>
                  </div>
                ))}
              </div>
              {tick >= 12 && tick < 19 && (
                <div className="dn-toast absolute inset-x-6 top-2 z-30 flex items-center gap-2 rounded-2xl bg-white/95 p-2.5 shadow-xl ring-1 ring-black/5 dark:bg-[#1c1c1f]/95" key="tour-toast">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a]"><UserCheck className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0"><p className="text-[9.5px] font-black text-[#111827] dark:text-white">New tour request from {CLIENT}</p><p className="truncate text-[8px] font-semibold text-gray-500">{PROPS[0].address} · Sat 11:00 AM</p></div>
                </div>
              )}
            </div>
          )}
        </div>
        <DemoCaption title={stop.title} body={stop.body} />
      </div>
    </BrowserFrame>
  )
}
