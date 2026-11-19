'use client'

// The real Guest Pass (components/guest-pass/GuestPass.tsx) on a phone, scrolled top to bottom like
// the Agent Hub demo (owner 11/18: "look like a real guest pass and scroll through it"). Used by the
// Guest Pass demo (Brokerages page) and as the ending of the Sign-in demo (after they sign in, their
// pass opens). Same layout as the live page: the solid top bar (Guest Pass / the home / the host),
// "Thanks for signing in - Welcome, John.", the home card (photo, price, beds/baths/sqft), the live
// Similar Homes bar, the three tiles (Cheat Sheet / Seller Disclosure / Second Tour), the
// neighborhood, their Showcase, Ask a question and the host card. Real listing, homes and agent
// (realData) - nothing invented. A note beside the phone says what each part is for, and that part
// is outlined in gold. No blur anywhere (it lags phones).
import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import Image from '@/components/ui/CachedImage'
import {
  Bath, Bed, CalendarCheck, Check, ChevronRight, Coffee, FileText, GraduationCap, Heart, Home, Mail, MapPin, MessageSquare,
  Phone, Ruler, ScanSearch, Send, ShoppingCart, Sparkles, Stethoscope, Ticket, Trees, Utensils, Layout,
} from 'lucide-react'
import DemoCursor, { useCursorCues, type CursorCue } from './DemoCursor'
import { DemoCaption, DEMO_NOTE_CSS } from './DemoNote'
import { AGENT, REAL_OPEN_HOUSE as OH, REAL_SIMILAR_HOMES as SIMILAR } from './realData'

const PHONE_W = 300
const PHONE_H = 560
const SCALE = 0.68
const STATUS_BAR = 26
const TOP_BAR = 44

const money = (n: number) => `$${n.toLocaleString('en-US')}`
const AGENT_FIRST = AGENT.name.split(' ')[0]
// The newest homes to hit the market flip on the Similar Homes bar, like the live page.
const NEWEST = [...SIMILAR].sort((a, b) => a.dom - b.dom).slice(0, 3)

// The parts of the page a stop can scroll to.
const AT = { top: 0, similar: 1, tiles: 2, map: 3, showcase: 4, ask: 5 } as const
type Part = keyof typeof AT

export type GuestPassStop = { id: string; part: Part; hl: string; hold: number; icon: LucideIcon; title: string; body: string }

export const GUEST_PASS_STOPS: Record<string, GuestPassStop> = {
  welcome: { id: 'welcome', part: 'top', hl: 'greet', hold: 4600, icon: Ticket, title: 'Their own Guest Pass', body: 'Opens the moment they sign in.' },
  home: { id: 'home', part: 'top', hl: 'home', hold: 4600, icon: Home, title: 'The home they’re in', body: 'Photos, price and every fact.' },
  similar: { id: 'similar', part: 'similar', hl: 'similar', hold: 4800, icon: ScanSearch, title: 'Similar homes, live', body: 'Homes like this one, from Bright MLS.' },
  tiles: { id: 'tiles', part: 'tiles', hl: 'tiles', hold: 5600, icon: CalendarCheck, title: 'One-tap requests', body: 'Disclosures or a second tour - no forms.' },
  map: { id: 'map', part: 'map', hl: 'map', hold: 4600, icon: MapPin, title: 'The neighborhood', body: 'Schools, coffee, groceries - and how far.' },
  showcase: { id: 'showcase', part: 'showcase', hl: 'showcase', hold: 4800, icon: Layout, title: 'Their own Showcase', body: 'More homes like this, saved for them.' },
  ask: { id: 'ask', part: 'ask', hl: 'ask', hold: 5000, icon: MessageSquare, title: 'Questions come to you', body: 'Straight to you, with their details.' },
}

// The pointer taps Seller Disclosure on the tiles stop; it turns into "Requested" and a note drops in.
function cues(stop: GuestPassStop): CursorCue[] {
  if (stop.id !== 'tiles') return []
  return [{ at: 500, target: '[data-cursor="gp-disclosure"]' }, { at: 1500, click: true }, { at: 1950, click: false }, { at: 3300, target: null }]
}

const CSS = `
@keyframes gpdRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes gpdZoom{from{transform:scale(1)}to{transform:scale(1.08)}}
@keyframes gpdToast{0%{opacity:0;transform:translateY(-10px) scale(.95)}100%{opacity:1;transform:none}}
@keyframes gpdPing{75%,100%{transform:scale(2.2);opacity:0}}
.gpd-rise{animation:gpdRise .6s cubic-bezier(.22,.61,.36,1) both}
.gpd-zoom{animation:gpdZoom 9s ease-out both}
.gpd-toast{animation:gpdToast .5s cubic-bezier(.34,1.56,.64,1) both}
.gpd-ping{animation:gpdPing 1.6s cubic-bezier(0,0,.2,1) infinite}
.gpd-hl{transition:opacity .5s ease,box-shadow .5s ease}
.gpd-on{box-shadow:0 0 0 2px #C9A24D,0 0 0 6px rgba(201,162,77,.22),0 12px 30px -12px rgba(201,162,77,.7)}
.gpd-off{opacity:.4}
@media (prefers-reduced-motion:reduce){.gpd-rise,.gpd-zoom,.gpd-toast,.gpd-ping{animation:none}}
`

/** The whole stage: the note on the left (a caption on phones), the phone scrolled to `stop`. `tick`
 *  counts 250 ms steps since this stop began (the parent owns the timing). */
export default function GuestPassStage({ stops, stop, tick, guestFirst = 'John' }: { stops: GuestPassStop[]; stop: number; tick: number; guestFirst?: string }) {
  const note = stops[stop]
  const stage = useRef<HTMLDivElement>(null)
  const cursor = useCursorCues(`${note.id}-${stop}`, cues(note))

  // Scroll stops measured from the real layout, capped so the last one ends on the page's content.
  const content = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [ys, setYs] = useState<number[]>([])
  useLayoutEffect(() => {
    const el = content.current
    if (!el) return
    const max = Math.max(0, el.scrollHeight - (PHONE_H - STATUS_BAR - TOP_BAR))
    setYs(stops.map(s => Math.min(max, Math.max(0, (refs.current[AT[s.part]]?.offsetTop ?? 0) - (s.id === 'tiles' ? 66 : AT[s.part] ? 8 : 0)))))
  }, [stops])
  const y = ys[stop] ?? 0

  // The Similar Homes photo flips on its own, like the live bar.
  const [flip, setFlip] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFlip(n => (n + 1) % NEWEST.length), 2600)
    return () => clearInterval(t)
  }, [])
  const newest = NEWEST[flip]

  const requested = note.id === 'tiles' && tick >= 7
  const pressing = note.id === 'tiles' && tick >= 6 && tick < 8
  const hl = (id: string) => (note.hl === id ? 'gpd-on' : 'gpd-off')
  const setRef = (part: Part) => (el: HTMLDivElement | null) => { refs.current[AT[part]] = el }

  return (
    <div ref={stage} className="relative flex h-[420px] items-center justify-center gap-5 overflow-hidden bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.18),transparent_60%),linear-gradient(140deg,#fffdf8,#f6efe0)] px-4 dark:bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.14),transparent_60%),linear-gradient(140deg,#0b0f0e,#141210)]" data-testid="guest-pass-demo">
      <style>{CSS + DEMO_NOTE_CSS}</style>
      {/* what this part does */}
      <div key={note.id} className="gpd-rise hidden w-[170px] shrink-0 sm:block">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/40"><note.icon className="h-4 w-4" /></span>
        <p className="mt-2.5 font-serif text-[19px] font-black leading-tight text-[#111827] dark:text-white">{note.title}</p>
        <p className="mt-1.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{note.body}</p>
        {requested && <p className="gpd-rise mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300" data-testid="guest-pass-demo-sent"><Check className="h-3 w-3" /> Sent to {AGENT_FIRST}</p>}
        <div className="mt-3 flex gap-1">{stops.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === stop ? 'w-5 bg-[#C9A24D]' : 'w-1.5 bg-[#C9A24D]/25'}`} />)}</div>
      </div>
      <DemoCaption key={`cap-${note.id}`} title={note.title} body={note.body} />

      {/* the phone */}
      <div className="flex-shrink-0" style={{ width: PHONE_W * SCALE, height: (PHONE_H + 20) * SCALE }}>
        <div className="origin-top-left" style={{ transform: `scale(${SCALE})`, width: PHONE_W }}>
          <div className="relative rounded-[2.6rem] bg-[#111827] p-2.5 shadow-[0_40px_70px_-30px_rgba(0,0,0,.7)]">
            <div className="absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#111827]" />
            <div className="relative overflow-hidden rounded-[2.1rem] bg-[#FAFAF7] text-[#0B0B0B]" style={{ height: PHONE_H }}>
              <div className="relative z-20 flex items-center justify-between bg-[#FAFAF7] px-6 pt-2.5 text-[10px]" style={{ height: STATUS_BAR }}>
                <span className="font-bold">9:41</span>
                <svg className="h-2.5 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
              </div>
              {/* the pass's solid top bar: Guest Pass / the home / the host */}
              <div className="relative z-20 flex items-center justify-between gap-1.5 border-b border-black/[0.07] bg-[#FAFAF7] px-3 shadow-[0_6px_18px_-14px_rgba(0,0,0,0.35)]" style={{ height: TOP_BAR }}>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C9A24D] text-white shadow-sm"><Ticket className="h-3 w-3" /></span>
                  <span className="text-[8.5px] font-black uppercase leading-[1.05] tracking-[0.2em]">Guest<br />Pass</span>
                </span>
                <span className="flex min-w-0 items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-1 text-[9.5px] font-black"><Home className="h-3 w-3 shrink-0 text-[#C9A24D]" /><span className="truncate">{OH.address}</span></span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-right text-[9px] font-black leading-[1.1]">Peter<br />Stefanatos</span>
                  <span className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white"><Image src={AGENT.photo} alt="" fill sizes="28px" className="object-cover object-[50%_18%]" unoptimized /></span>
                </span>
              </div>

              <div className="relative overflow-hidden" style={{ height: PHONE_H - STATUS_BAR - TOP_BAR }}>
                <div ref={content} className="absolute inset-x-0 top-0 px-3.5 pb-5 will-change-transform" style={{ transform: `translate3d(0,-${y}px,0)`, transition: 'transform 1250ms cubic-bezier(.4,0,.2,1)' }}>
                  <div ref={setRef('top')} className="pt-3">
                    <div className={`gpd-hl rounded-2xl px-1 py-0.5 ${hl('greet')}`}>
                      <p className="flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-[0.26em] text-[#C9A24D]">
                        <span className="relative flex h-1.5 w-1.5"><span className="gpd-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                        Thanks for signing in
                      </p>
                      <p className="mt-1 text-[23px] font-black leading-[1.05] tracking-[-0.03em]">Welcome, <span className="text-[#C9A24D]">{guestFirst}</span>.</p>
                    </div>

                    {/* the home */}
                    <div className={`gpd-hl mt-3 overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.35)] ${hl('home')}`}>
                      <div className="relative h-[178px] overflow-hidden bg-[#111827]">
                        <div className="gpd-zoom absolute inset-0"><Image src={OH.photo} alt={`${OH.address}, ${OH.city}`} fill sizes="300px" className="object-cover" unoptimized /></div>
                        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <span className="absolute inset-x-3 bottom-2.5 text-white">
                          <span className="block text-[24px] font-black leading-none tracking-tight">{money(OH.price)}</span>
                          <span className="mt-1 block truncate text-[10px] font-bold text-white/85">{OH.address}, {OH.city}, {OH.state}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-black/[0.06]">
                        {[{ I: Bed, v: OH.beds, l: 'Beds' }, { I: Bath, v: OH.baths, l: 'Baths' }, { I: Ruler, v: OH.sqft.toLocaleString('en-US'), l: 'Sq Ft' }].map(f => (
                          <div key={f.l} className="flex flex-col items-center gap-0.5 py-2">
                            <span className="flex items-center gap-1 text-[13px] font-black"><f.I className="h-3 w-3 text-[#C9A24D]" />{f.v}</span>
                            <span className="text-[6.5px] font-black uppercase tracking-[0.2em] text-gray-400">{f.l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Similar Homes - live; the newest homes flip on the right */}
                  <div ref={setRef('similar')} className={`gpd-hl relative mt-3 flex h-[118px] overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_18px_50px_-28px_rgba(0,0,0,0.45)] ${hl('similar')}`}>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-2 pl-3.5 pr-2">
                      <span className="flex items-center gap-1 text-[7.5px] font-black uppercase tracking-[0.22em] text-[#C9A24D]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Similar Homes · Live</span>
                      <span className="text-[14px] font-black leading-[1.12] tracking-[-0.02em]">{SIMILAR.length} homes like<br />{OH.address}</span>
                      <span className="inline-flex w-fit items-center gap-0.5 rounded-full bg-[#0B0B0B] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white">See all <ChevronRight className="h-2.5 w-2.5" /></span>
                    </div>
                    <div className="relative my-1.5 mr-1.5 w-[48%] shrink-0 overflow-hidden rounded-[18px] bg-gray-100">
                      <div key={newest.address} className="gpd-rise absolute inset-0">
                        <Image src={newest.photo} alt="" fill sizes="140px" className="object-cover" unoptimized />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.1em]">{newest.dom} DOM</span>
                        <span className="absolute inset-x-2 bottom-1.5 text-white"><span className="block truncate text-[8px] font-bold text-white/85">{newest.address}</span><span className="block text-[13px] font-black leading-tight">{money(newest.price)}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Cheat Sheet + the two one-tap requests */}
                  <div ref={setRef('tiles')} className={`gpd-hl mt-3 grid grid-cols-3 gap-2 rounded-[20px] ${hl('tiles')}`}>
                    {[
                      { id: 'cheat', I: FileText, eyebrow: 'Guide', title: 'Cheat Sheet', body: 'Schools, taxes & nearby' },
                      { id: 'disclosure', I: ScanSearch, eyebrow: 'One tap', title: 'Seller Disclosure', body: requested ? 'Requested' : `Get it from ${AGENT_FIRST}`, done: requested },
                      { id: 'tour', I: CalendarCheck, eyebrow: 'One tap', title: 'Second Tour', body: 'See it again, just you' },
                    ].map(t => (
                      <div key={t.id} data-cursor={t.id === 'disclosure' ? 'gp-disclosure' : undefined}
                        className={`flex min-h-[112px] flex-col items-start rounded-[18px] border bg-white p-2.5 shadow-[0_14px_40px_-26px_rgba(0,0,0,0.45)] transition-transform duration-200 ${t.done ? 'border-emerald-500/40' : 'border-black/[0.06]'} ${t.id === 'disclosure' && pressing ? 'scale-[0.95]' : ''}`}>
                        <span className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl ${t.done ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[#C9A24D]/15 text-[#C9A24D]'}`}>{t.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <t.I className="h-4 w-4" />}</span>
                        <span className="text-[6.5px] font-black uppercase tracking-[0.2em] text-[#C9A24D]">{t.eyebrow}</span>
                        <span className="mt-0.5 text-[11px] font-black leading-tight tracking-tight">{t.title}</span>
                        <span className={`mt-0.5 text-[8.5px] font-semibold leading-snug ${t.done ? 'font-black text-emerald-600' : 'text-gray-500'}`}>{t.body}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[8px] font-medium text-gray-400">Requests go straight to {AGENT.name} with the info you signed in with.</p>

                  {/* the neighborhood */}
                  <div ref={setRef('map')} className={`gpd-hl mt-5 rounded-[20px] p-1 ${hl('map')}`}>
                    <p className="text-[7.5px] font-black uppercase tracking-[0.22em] text-[#a8843a]">Where it is</p>
                    <p className="mt-0.5 font-serif text-[17px] font-black text-[#111827]">The neighborhood</p>
                    <div className="relative mt-2 h-[130px] overflow-hidden rounded-[18px] border border-black/[0.06] bg-[#eef0e6]">
                      <svg viewBox="0 0 280 130" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
                        <path d="M0 92 C60 80 110 100 170 84 S250 70 280 76" stroke="#fff" strokeWidth="7" fill="none" />
                        <path d="M118 0 C126 40 112 80 132 130" stroke="#fff" strokeWidth="6" fill="none" />
                        <path d="M0 30 L280 46" stroke="#fff" strokeWidth="4" fill="none" />
                        <path d="M200 0 L214 130" stroke="#fff" strokeWidth="3" fill="none" />
                        <rect x="20" y="52" width="62" height="26" rx="6" fill="#d7e5c8" />
                        <rect x="170" y="98" width="70" height="22" rx="6" fill="#d7e5c8" />
                        <path d="M14 8 L262 14 L270 120 L22 116 Z" stroke="#C9A24D" strokeWidth="2" strokeDasharray="6 5" fill="rgba(201,162,77,.06)" />
                      </svg>
                      <span className="absolute left-[47%] top-[38%] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#111827] text-[#e8c97a] shadow-lg ring-2 ring-white"><Home className="h-3.5 w-3.5" /></span>
                      <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[7.5px] font-black text-[#111827] shadow-sm">{OH.city}, {OH.state}</span>
                      <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-0.5 text-[7.5px] font-black text-[#111827] shadow-sm">Township + school lines</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {[{ I: Coffee, l: 'Coffee' }, { I: ShoppingCart, l: 'Grocery' }, { I: GraduationCap, l: 'Schools' }, { I: Stethoscope, l: 'Medical' }, { I: Utensils, l: 'Food' }, { I: Trees, l: 'Parks' }].map(c => (
                        <span key={c.l} className="flex items-center justify-center gap-1 rounded-xl border border-black/[0.06] bg-white py-2 text-[8.5px] font-black"><c.I className="h-3 w-3 text-[#C9A24D]" />{c.l}</span>
                      ))}
                    </div>
                  </div>

                  {/* their Showcase */}
                  <div ref={setRef('showcase')} className={`gpd-hl relative mt-5 overflow-hidden rounded-[22px] bg-[linear-gradient(150deg,#0B0B0B,#1d1a14)] p-3.5 text-white ${hl('showcase')}`}>
                    <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.35),transparent)]" />
                    <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] py-0.5 pl-0.5 pr-2 text-[7.5px] font-black uppercase tracking-[0.22em] text-white/85"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D]"><Sparkles className="h-2.5 w-2.5" /></span>Made for you</span>
                    <p className="relative mt-2 text-[19px] font-black leading-[1.05] tracking-[-0.03em]"><span className="text-[#e8c97a]">{guestFirst}&apos;s</span> Showcase</p>
                    <p className="relative mt-1 flex items-start gap-1 text-[9.5px] font-bold leading-snug text-white/85"><MapPin className="mt-px h-3 w-3 shrink-0 text-[#C9A24D]" />Picked for you after your visit to {OH.address}.</p>
                    <div className="relative mt-2.5 grid grid-cols-3 gap-1.5">
                      {SIMILAR.slice(0, 3).map(h => (
                        <div key={h.address} className="relative h-14 overflow-hidden rounded-lg">
                          <Image src={h.photo} alt="" fill sizes="90px" className="object-cover" unoptimized />
                          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-white/90"><Heart className="h-2.5 w-2.5 text-rose-500" /></span>
                        </div>
                      ))}
                    </div>
                    <span className="relative mt-2.5 flex items-center justify-center gap-1 rounded-xl bg-[#C9A24D] py-2 text-[10px] font-black text-[#111827]">Open my Showcase <ChevronRight className="h-3 w-3" /></span>
                  </div>

                  {/* ask a question + the host */}
                  <div ref={setRef('ask')} className={`gpd-hl mt-5 rounded-[22px] ${hl('ask')}`}>
                    <div className="rounded-[22px] border border-black/[0.06] bg-white p-3.5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.4)]">
                      <div className="flex items-center gap-2.5">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white"><Image src={AGENT.photo} alt="" fill sizes="36px" className="object-cover object-[50%_18%]" unoptimized /></span>
                        <span className="min-w-0"><span className="block text-[12.5px] font-black leading-tight">Ask {AGENT_FIRST} a quick question</span><span className="block text-[9px] font-semibold text-gray-500">&ldquo;I&rsquo;ll get back to you right away.&rdquo;</span></span>
                      </div>
                      <div className="mt-2.5 rounded-xl border border-black/[0.08] bg-[#FAFAF7] px-2.5 py-2 text-[9.5px] font-semibold text-gray-700">Is the garage heated?</div>
                      <span className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-[#0B0B0B] py-2 text-[10px] font-black text-white"><Send className="h-3 w-3" /> Send</span>
                    </div>
                    <div className="mt-2.5 rounded-[22px] border border-black/[0.06] bg-white p-3.5">
                      <p className="text-[7.5px] font-black uppercase tracking-[0.25em] text-gray-400">Your host</p>
                      <div className="mt-2 flex items-center gap-2.5">
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full"><Image src={AGENT.photo} alt="" fill sizes="44px" className="object-cover object-[50%_18%]" unoptimized /></span>
                        <span className="min-w-0"><span className="block truncate text-[14px] font-black">{AGENT.name}</span><span className="block truncate text-[9px] font-semibold text-gray-500">{AGENT.title} · {AGENT.brokerage}</span></span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                        {[{ I: Phone, l: 'Call' }, { I: MessageSquare, l: 'Text' }, { I: Mail, l: 'Email' }].map(a => (
                          <span key={a.l} className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl border border-black/[0.08] text-[7.5px] font-black uppercase tracking-[0.12em]"><a.I className="h-3.5 w-3.5 text-[#C9A24D]" />{a.l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {requested && (
                  <div className="gpd-toast absolute inset-x-3 top-2 z-20 flex items-start gap-2 rounded-xl bg-emerald-600 p-2.5 text-[10px] font-bold text-white shadow-lg">
                    <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={3} /> Sent to {AGENT_FIRST} - no forms, we already have your details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DemoCursor container={stage} target={cursor.target} click={cursor.click} painted />
    </div>
  )
}
