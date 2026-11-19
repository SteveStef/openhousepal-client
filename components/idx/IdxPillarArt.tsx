import type { ReactNode } from 'react'
import { Bath, Bed, CalendarCheck, Check, Eye, GripVertical, Home, Inbox, Lock, MapPin, Moon, Newspaper, Search, SlidersHorizontal, Star, Sun, UserRound, ArrowRight, Bus, GraduationCap, Trees, TrendingUp } from 'lucide-react'

// Pictures for the IDX page's "What's on your website" sections (owner 11/18: fewer words, more
// visuals, like the hero). Sketches of the real screens, not real homes: no prices, addresses or names.

export function ArtStage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`relative isolate overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_15%_0%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] ring-1 ring-[#C9A24D]/30 ${className}`}>
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(201,162,77,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(201,162,77,.07)_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(80%_75%_at_50%_45%,#000,transparent)]" />
      <span className="br-orb absolute -right-14 -top-14 -z-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.32),transparent_70%)]" />
      {children}
    </div>
  )
}

const Bar = ({ w, c = 'bg-gray-800/75', h = 'h-2' }: { w: string; c?: string; h?: string }) => <span className={`block ${h} rounded ${c}`} style={{ width: w }} />
const Stars = ({ n = 5, c = 'h-3 w-3' }: { n?: number; c?: string }) => <span className="flex gap-0.5 text-[#C9A24D]">{Array.from({ length: n }).map((_, i) => <Star key={i} className={`${c} fill-current`} />)}</span>
const Toast = ({ icon: I, top, sub, className = '', delay = '0s' }: { icon: typeof Inbox; top: string; sub: string; className?: string; delay?: string }) => (
  <div className={`br-float absolute z-20 rounded-2xl bg-[#111827] px-3 py-2.5 text-white shadow-2xl ring-1 ring-[#C9A24D]/45 ${className}`} style={{ animationDelay: delay }}>
    <p className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-[#e8c97a]"><I className="h-3 w-3" /> {top}</p>
    <p className="mt-0.5 text-[11.5px] font-bold leading-snug">{sub}</p>
  </div>
)

// 1. Homes: map search with pins and a home card.
function HomesArt() {
  const pins: [string, string][] = [['14%', '30%'], ['34%', '62%'], ['52%', '24%'], ['70%', '58%'], ['84%', '30%'], ['24%', '84%']]
  return (
    <div className="relative mx-auto w-full max-w-[460px] pb-6">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/40">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5">
          <span className="flex flex-1 items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10.5px] font-bold text-gray-400"><Search className="h-3 w-3 text-[#C9A24D]" /> City, ZIP or address</span>
          {['Beds', 'Type'].map(t => <span key={t} className="hidden rounded-lg border border-gray-200 px-2 py-1.5 text-[10px] font-black text-gray-600 min-[380px]:inline">{t}</span>)}
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#111827] text-[#e8c97a]"><SlidersHorizontal className="h-3.5 w-3.5" /></span>
        </div>
        <div className="relative h-[190px] bg-[#e8eef3] sm:h-[220px]">
          <span className="absolute inset-0 bg-[linear-gradient(rgba(17,24,39,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,.06)_1px,transparent_1px)] bg-[size:18px_18px]" />
          <span className="absolute -left-6 top-[46%] h-3 w-[120%] -rotate-6 bg-white/90" />
          <span className="absolute left-[58%] top-0 h-full w-3 rotate-12 bg-white/90" />
          <span className="absolute bottom-3 right-4 h-16 w-24 rounded-[40%] bg-[#cfe3c4]" />
          {pins.map(([l, t], i) => (
            <span key={l + t} className={`absolute grid h-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1.5 text-[9px] font-black shadow ${i === 2 ? 'z-10 bg-[#C9A24D] text-[#111827] ring-2 ring-white' : 'bg-[#111827] text-[#e8c97a]'}`} style={{ left: l, top: t }}>
              <Home className="h-3 w-3" />
            </span>
          ))}
          <span className="absolute left-[52%] top-[24%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A24D]/40 br-pulse" />
        </div>
      </div>
      <div className="br-float absolute -bottom-1 right-2 z-10 w-[170px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#C9A24D]/50 sm:-right-4 sm:w-[190px]" style={{ animationDelay: '.6s' }}>
        <div className="relative h-20 bg-gradient-to-br from-[#c9b79a] via-[#8f7a5c] to-[#4b3e2c]">
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black text-[#111827]">Just Listed</span>
          <span className="absolute inset-x-6 bottom-0 h-9 rounded-t-lg bg-white/25" />
        </div>
        <div className="p-2.5">
          <Bar w="80%" />
          <span className="mt-1.5 flex gap-2.5 text-[10px] font-bold text-gray-500"><span className="inline-flex items-center gap-0.5"><Bed className="h-3 w-3" />4</span><span className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" />3</span></span>
          <span className="mt-2 block rounded-lg bg-[#111827] py-1.5 text-center text-[10px] font-black text-[#e8c97a]">Request a showing</span>
        </div>
      </div>
      <div className="br-float absolute -left-1 bottom-8 z-10 rounded-xl bg-white px-2.5 py-2 shadow-xl ring-1 ring-[#C9A24D]/40 sm:-left-4" style={{ animationDelay: '1.4s' }}>
        <p className="text-[9px] font-black uppercase tracking-wider text-[#8b6a2b]">Recently sold</p>
        <p className="mt-1 flex items-end gap-1">{[40, 62, 50, 78, 92].map((h, i) => <span key={i} className="w-2.5 rounded-sm bg-gradient-to-t from-[#8b6a2b] to-[#e8c97a]" style={{ height: h / 3 }} />)}</p>
      </div>
    </div>
  )
}

// 2. Towns: two town guides side by side.
function TownsArt() {
  const rows: [typeof GraduationCap, string, number, number][] = [[GraduationCap, 'Schools', 86, 70], [Trees, 'Parks', 60, 88], [Bus, 'Getting around', 74, 52], [TrendingUp, 'Market', 68, 80]]
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="grid grid-cols-2 gap-3">
        {['Town one', 'Town two'].map((t, c) => (
          <div key={t} className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/40">
            <div className={`relative h-16 bg-gradient-to-br ${c ? 'from-[#9fb3c8] via-[#5f7590] to-[#2c3a4d]' : 'from-[#b9c6a6] via-[#7b8c63] to-[#3d4a2e]'}`}>
              <span className="absolute bottom-2 left-2.5 flex items-center gap-1 text-[11px] font-black text-white"><MapPin className="h-3 w-3" />{t}</span>
            </div>
            <div className="space-y-2.5 p-3">
              {rows.map(([I, label, a, b]) => (
                <div key={label}>
                  <p className="flex items-center gap-1 text-[9.5px] font-black text-gray-500"><I className="h-3 w-3 text-[#C9A24D]" />{label}</p>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-gradient-to-r from-[#8b6a2b] to-[#e8c97a]" style={{ width: `${c ? b : a}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="absolute left-1/2 top-[46%] z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] font-serif text-sm font-black italic text-[#111827] shadow-xl ring-4 ring-[#111827]">vs</span>
    </div>
  )
}

// 3. You: profile, reviews and a blog post.
function YouArt() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] pb-4">
      <div className="rounded-2xl bg-white p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/40">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] ring-4 ring-[#fbf6ec]"><UserRound className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-black uppercase tracking-wider text-[#8b6a2b]">About you</p>
            <span className="mt-1 block"><Bar w="70%" h="h-2.5" /></span>
            <span className="mt-1.5 block"><Bar w="50%" c="bg-gray-300" /></span>
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {[0, 1].map(i => (
            <div key={i} className="rounded-xl bg-[#fbf6ec] p-2.5 ring-1 ring-[#C9A24D]/25">
              <Stars c="h-2.5 w-2.5" />
              <span className="mt-1.5 block"><Bar w="92%" c="bg-gray-400/70" h="h-1.5" /></span>
              <span className="mt-1 block"><Bar w="70%" c="bg-gray-400/70" h="h-1.5" /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="br-float absolute -bottom-2 -right-1 z-10 w-[150px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#C9A24D]/50 sm:-right-5 sm:w-[170px]" style={{ animationDelay: '.9s' }}>
        <div className="relative h-14 bg-gradient-to-br from-[#d8c4a0] via-[#a88c5c] to-[#5c4a2e]"><span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black text-[#111827]"><Newspaper className="h-2.5 w-2.5" /> Your blog</span></div>
        <div className="p-2.5"><Bar w="90%" /><span className="mt-1 block"><Bar w="60%" c="bg-gray-300" h="h-1.5" /></span></div>
      </div>
      <div className="br-float absolute -top-3 right-6 z-10 rounded-full bg-[#111827] px-3 py-1.5 shadow-xl ring-1 ring-[#C9A24D]/50" style={{ animationDelay: '1.8s' }}><Stars c="h-3 w-3" /></div>
    </div>
  )
}

// 4. Leads: book a showing on a phone, landing in Leads.
function LeadsArt() {
  return (
    <div className="relative mx-auto flex w-full max-w-[460px] justify-center pb-2">
      <div className="w-[210px] rounded-[30px] bg-[#0b0b0b] p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,.95)] ring-1 ring-[#C9A24D]/50">
        <div className="overflow-hidden rounded-[24px] bg-white">
          <div className="relative h-16 bg-gradient-to-br from-[#9fb3c8] via-[#5f7590] to-[#2c3a4d]"><span className="absolute left-1/2 top-1.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-black/40" /></div>
          <div className="p-3">
            <p className="flex items-center gap-1 text-[11px] font-black text-[#111827]"><CalendarCheck className="h-3.5 w-3.5 text-[#C9A24D]" /> Book a showing</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {['Sat', 'Sun', 'Mon'].map((d, i) => (
                <span key={d} className={`rounded-lg py-1.5 text-center text-[10px] font-black ${i === 0 ? 'bg-[#111827] text-[#e8c97a]' : 'bg-gray-100 text-gray-500'}`}>{d}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {['10:00', '1:00', '3:30'].map((t, i) => (
                <span key={t} className={`rounded-lg py-1.5 text-center text-[10px] font-black ${i === 1 ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-500'}`}>{t}</span>
              ))}
            </div>
            <span className="mt-2.5 flex items-center justify-center gap-1 rounded-xl bg-[#111827] py-2 text-[10.5px] font-black text-white">Request <ArrowRight className="h-3 w-3" /></span>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {['Home value', 'Contact'].map(t => <span key={t} className="rounded-lg border border-gray-200 py-1.5 text-center text-[9.5px] font-black text-gray-600">{t}</span>)}
            </div>
          </div>
        </div>
      </div>
      {/* Phones: one note, over the photo only. Wider screens have room beside the phone for both. */}
      <Toast icon={Inbox} top="New lead" sub="Showing request · Sat 1:00" className="-right-1 top-0 w-[150px] sm:-right-2 sm:top-6 sm:w-[160px]" delay=".5s" />
      <Toast icon={Eye} top="Saved search" sub="New matches sent" className="bottom-6 left-0 hidden w-[118px] sm:block lg:-left-3" delay="1.5s" />
    </div>
  )
}

// 5. Your look: Classic Ivory vs Luxe Midnight, and sections you drag into order.
function LookArt() {
  const sections = ['Welcome', 'Your listings', 'Your towns', 'Reviews']
  return (
    <div className="relative mx-auto w-full max-w-[460px] pb-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-2xl bg-[#fbf8f2] shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/40">
          <div className="flex items-center justify-between px-2.5 py-2"><span className="text-[9px] font-black uppercase tracking-wider text-[#8b6a2b]">Classic</span><Sun className="h-3 w-3 text-[#C9A24D]" /></div>
          <div className="mx-2.5 rounded-lg bg-white p-2 ring-1 ring-gray-200"><Bar w="70%" /><span className="mt-1 block"><Bar w="45%" c="bg-gray-300" h="h-1.5" /></span></div>
          <div className="grid grid-cols-2 gap-1.5 p-2.5">{[0, 1].map(i => <span key={i} className="h-10 rounded-md bg-gradient-to-br from-[#c9b79a] to-[#8f7a5c]" />)}</div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-[#0f0f12] shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/60">
          <div className="flex items-center justify-between px-2.5 py-2"><span className="mk-gold text-[9px] font-black uppercase tracking-wider">Luxe</span><Moon className="h-3 w-3 text-[#e8c97a]" /></div>
          <div className="mx-2.5 rounded-lg bg-white/[0.06] p-2 ring-1 ring-[#C9A24D]/30"><Bar w="70%" c="bg-[#e8c97a]/80" /><span className="mt-1 block"><Bar w="45%" c="bg-white/25" h="h-1.5" /></span></div>
          <div className="grid grid-cols-2 gap-1.5 p-2.5">{[0, 1].map(i => <span key={i} className="h-10 rounded-md bg-gradient-to-br from-[#5f7590] to-[#1c2533] ring-1 ring-[#C9A24D]/30" />)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {['#111827', '#C9A24D', '#7b8c63', '#5f7590', '#b45f4b'].map((c, i) => <span key={c} className={`h-6 w-6 rounded-full ring-2 ${i === 1 ? 'ring-white' : 'ring-white/20'}`} style={{ background: c }} />)}
        <span className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-[#e8c97a] ring-1 ring-white/15">Your colors</span>
      </div>
      <div className="relative mx-auto mt-3 w-[88%] space-y-1.5">
        {sections.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[10.5px] font-black ${i === 1 ? 'relative z-10 bg-white text-[#111827] shadow-[0_12px_30px_-10px_rgba(201,162,77,.7)] ring-2 ring-[#C9A24D]' : 'bg-white/[0.07] text-gray-300 ring-1 ring-white/10'}`}>
            <GripVertical className="h-3.5 w-3.5 opacity-60" /> {s}
            <span className={`ml-auto h-3.5 w-6 rounded-full p-0.5 ${i === 3 ? 'bg-white/20' : 'bg-[#C9A24D]'}`}><span className={`block h-2.5 w-2.5 rounded-full bg-white ${i === 3 ? '' : 'ml-auto'}`} /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 6. Getting found: your Google result and your own address.
function FoundArt() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="rounded-2xl bg-white p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-[#C9A24D]/40">
        <span className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-[11px] font-bold text-gray-500"><Search className="h-3.5 w-3.5 text-[#C9A24D]" /> real estate agent near me</span>
        <div className="mt-3.5 rounded-xl bg-[#fbf6ec] p-3 ring-2 ring-[#C9A24D]/60">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111827] font-serif text-[11px] font-black text-[#e8c97a]">Y</span>
            <span className="min-w-0"><span className="block text-[10.5px] font-black text-[#111827]">Your Name</span><span className="block truncate text-[9.5px] font-semibold text-gray-500">yourname.com</span></span>
          </div>
          <p className="mt-1.5 text-[13px] font-black leading-snug text-[#1a4fbf]">Your Name · Homes for sale in your towns</p>
          <span className="mt-1.5 block"><Bar w="95%" c="bg-gray-300" h="h-1.5" /></span>
          <span className="mt-1 block"><Bar w="70%" c="bg-gray-300" h="h-1.5" /></span>
        </div>
        {[0, 1].map(i => <div key={i} className="mt-3 px-1 opacity-50"><Bar w="40%" c="bg-gray-300" h="h-1.5" /><span className="mt-1.5 block"><Bar w="75%" c="bg-[#1a4fbf]/40" /></span></div>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10.5px] font-bold text-gray-300 ring-1 ring-white/15">yourname.openhousepal.com</span>
        <ArrowRight className="h-4 w-4 text-[#e8c97a]" />
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-black text-[#111827] ring-2 ring-[#C9A24D]"><Lock className="h-3 w-3 text-emerald-600" /> yourname.com</span>
      </div>
    </div>
  )
}

const ARTS: Record<string, () => ReactNode> = { homes: HomesArt, towns: TownsArt, you: YouArt, leads: LeadsArt, look: LookArt, found: FoundArt }

export default function IdxPillarArt({ pillar }: { pillar: string }) {
  const Art = ARTS[pillar]
  return (
    <ArtStage className="flex h-full min-h-[280px] items-center px-4 py-8 sm:min-h-[340px] sm:px-8 sm:py-10">
      {Art ? <Art /> : null}
    </ArtStage>
  )
}

// Small pictures for the "You're in charge" cards.
export function ControlArt({ kind }: { kind: 'draft' | 'off' | 'keep' }) {
  if (kind === 'draft') return (
    <div className="flex items-center justify-center gap-2">
      <span className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-gray-300 ring-1 ring-white/15">Draft</span>
      <ArrowRight className="h-4 w-4 text-[#e8c97a]" />
      <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] px-3 py-2 text-[11px] font-black text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Published</span>
    </div>
  )
  if (kind === 'off') return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-[11px] font-black text-gray-300">Website</span>
      <span className="h-7 w-12 rounded-full bg-white/15 p-1 ring-1 ring-white/20"><span className="block h-5 w-5 rounded-full bg-white shadow" /></span>
      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/30">Nothing deleted</span>
    </div>
  )
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-gray-300 ring-1 ring-white/15">Your site</span>
      <span className="font-serif text-lg font-black text-[#e8c97a]">+</span>
      <span className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#111827] ring-1 ring-[#C9A24D]">Every tool</span>
    </div>
  )
}
