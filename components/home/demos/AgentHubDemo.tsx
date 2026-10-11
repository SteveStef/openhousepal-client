'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { Calendar, Check, ChevronRight, DollarSign, Facebook, Globe, Home, IdCard, Instagram, Link2, Mail, MapPin, MessageSquare, Music2, Newspaper, Phone, Play, RefreshCw, TrendingUp, UserPlus, Youtube } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { CarouselTrack } from './DemoScroller'
import { DemoCaption, DEMO_NOTE_CSS } from './DemoNote'
import BlogTitleCard from './BlogTitleCard'
import { AGENT, REAL_AI_BLOG, REAL_BLOG, REAL_SPOTLIGHT } from './realData'

// The real MOBILE Agent Hub in its Luxe look (app/[slug]/page.tsx + HubLuxeTheme), on Peter's own
// page: the ivory profile card (name beside the gold-framed photo, Sold / Volume / Avg stats), the
// round call / text / email + social buttons, Save Contact, the Buying / Selling / Home Worth /
// Showing buttons, then the shelves in their real order (Recent Sales, My Listings, Videos, House
// Tours, Blogs) with gold-ruled serif headings and dark "View all" pills. A note beside the phone
// says what each part does; a finger taps Save Contact (the phone's add-contact sheet opens), and
// a new Bright MLS listing drops into My Listings on its own - the page keeps itself up to date.
// Scroll stops are measured from the real layout, so there are no blank gaps and it never scrolls
// past Blogs into an empty footer.

const PHONE_W = 300
const PHONE_H = 560
const SCALE = 0.68
const STATUS_BAR = 26

const SALES = [
  { address: '1534 Mount Pleasant Rd', city: 'Villanova, PA', price: '$2,525,000', photo: '/demos/media/b0ee2d8c1063.jpg' },
  { address: '1 Dovecote Ln', city: 'Malvern, PA', price: '$2,435,000', photo: '/demos/media/a38b41d19eea.jpg' },
  { address: '401 Thornbrook Ave', city: 'Bryn Mawr, PA', price: '$1,535,000', photo: '/demos/media/0f3855c99ed8.jpg' },
]
const VIDEOS = [
  { label: 'What Does a $1M House Look Like in the Philly Suburbs?', photo: '/demos/media/34bec7583299.jpg' },
  { label: 'Best Time of Year to Sell on the Main Line', photo: '/demos/media/e893481f1b44.jpg' },
  { label: 'Should You Sell Your House Now, Or Wait?', photo: '/demos/media/a04451875178.jpg' },
]
const TOURS = [
  { label: '$2.2M Designer Home Tour · Lafayette Hill', photo: '/demos/media/440e6bde15ef.jpg' },
  { label: 'Brand NEW $2.1M Greystone Mansion Tour', photo: '/demos/media/7ec2c2d8e124.jpg' },
]
const BLOGS = [
  { label: REAL_AI_BLOG.title, cat: 'Buyers', theme: 'Luxe', dark: false, date: 'Oct 1, 2026' },
  { label: REAL_BLOG.title, cat: 'Market update', theme: 'Midnight', dark: true, date: 'Sep 8, 2026' },
]

// Scroll targets on the phone (index into refs): the profile block, then each shelf.
const AT = { profile: 0, sales: 1, listings: 2, videos: 3, tours: 4, blogs: 5 } as const
// One stop per part of the page: the note beside the phone explains it, and that exact part is
// outlined in gold on the phone (everything else dims) so it's obvious what the note is about.
const STOPS: { id: string; at: number; hold: number; icon: LucideIcon; title: string; body: string }[] = [
  { id: 'card', at: AT.profile, hold: 6200, icon: Link2, title: 'One link for everything', body: 'Put it in your bio, signs and cards.' },
  { id: 'contact', at: AT.profile, hold: 5400, icon: Phone, title: 'Reach you in one tap', body: 'Call, text, email and socials.' },
  { id: 'save', at: AT.profile, hold: 7200, icon: IdCard, title: 'Save Contact', body: 'One tap - you’re in their phone.' },
  { id: 'actions', at: AT.profile, hold: 6000, icon: UserPlus, title: 'Every button = a lead', body: 'Answers land in your Leads.' },
  { id: 'sales', at: AT.sales, hold: 5600, icon: RefreshCw, title: 'Your sales, automatic', body: 'Pulled from Bright MLS.' },
  { id: 'listings', at: AT.listings, hold: 5600, icon: Home, title: 'Your listings, always live', body: 'New listings show up on their own.' },
  { id: 'videos', at: AT.videos, hold: 5200, icon: Play, title: 'Your videos', body: 'Link YouTube once. New ones appear.' },
  { id: 'tours', at: AT.tours, hold: 5000, icon: Youtube, title: 'House tours', body: 'Your walkthrough videos.' },
  { id: 'blogs', at: AT.blogs, hold: 5600, icon: Newspaper, title: 'Your blogs', body: 'Every post shows up here.' },
]

type Beat = { k: 'title' } | { k: 'scroll'; stop: number }
const BEATS: Beat[] = [{ k: 'title' }, ...STOPS.map((_, stop) => ({ k: 'scroll' as const, stop }))]
const beatDuration = (b: Beat) => (b.k === 'title' ? 5200 : STOPS[b.stop].hold)
const TOTAL_PAGES = 1 + STOPS.length

const CSS = `
@keyframes ahRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ahSheet{from{transform:translateY(105%)}to{transform:none}}
@keyframes ahToast{0%{opacity:0;transform:translateY(-10px) scale(.95)}100%{opacity:1;transform:none}}
@keyframes ahTap{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.6);opacity:0}}
@keyframes ahShine{0%,55%{transform:translateX(-120%)}100%{transform:translateX(260%)}}
@keyframes ahNew{0%{opacity:0;transform:translateY(16px) scale(.94)}100%{opacity:1;transform:none}}
.ah-rise{animation:ahRise .6s cubic-bezier(.22,.61,.36,1) both}
.ah-sheet{animation:ahSheet .55s cubic-bezier(.22,.61,.36,1) both}
.ah-toast{animation:ahToast .55s cubic-bezier(.34,1.56,.64,1) both}
.ah-tap{animation:ahTap .7s ease-out both}
.ah-new{animation:ahNew .8s cubic-bezier(.22,.61,.36,1) both}
.ah-hl{transition:opacity .5s ease,box-shadow .5s ease}
.ah-on{box-shadow:0 0 0 2px #C9A24D,0 0 0 6px rgba(201,162,77,.22),0 12px 30px -12px rgba(201,162,77,.7)}
.ah-off{opacity:.38}
.ah-shine{position:relative;overflow:hidden}.ah-shine:after{content:"";position:absolute;inset:0;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);animation:ahShine 3.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ah-rise,.ah-sheet,.ah-toast,.ah-tap,.ah-new,.ah-shine:after{animation:none}}
`

function Shelf({ title, action, children, sref, hl }: { title: string; action: string; children: React.ReactNode; sref: (el: HTMLDivElement | null) => void; hl: string }) {
  return (
    <div ref={sref} className={`ah-hl mx-2 mt-3 rounded-2xl px-2 pb-2 pt-2 ${hl}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h5 className="flex min-w-0 items-center gap-2 font-serif text-[15px] font-black text-[#111827]"><span className="h-px w-5 shrink-0 bg-gradient-to-r from-transparent to-[#C9A24D]" /><span className="truncate">{title}</span></h5>
        <span className="flex-shrink-0 rounded-full bg-[#111827] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[#f3dfa8]">{action} &rsaquo;</span>
      </div>
      {children}
    </div>
  )
}

function PhotoCard({ photo, children, h = 'h-40' }: { photo: string; children?: React.ReactNode; h?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D]/50 to-[#8b6a2b] p-[1.5px] shadow-[0_14px_28px_-16px_rgba(0,0,0,.55)]">
      <div className={`relative overflow-hidden rounded-[14.5px] bg-[#111827] ${h}`}>
        <Image src={photo} alt="" fill className="object-cover" unoptimized />
        {children}
      </div>
    </div>
  )
}

export default function AgentHubDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const beat = BEATS[i]

  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const t = setTimeout(() => setI(n => (n + 1) % BEATS.length), beatDuration(beat))
    return () => { clearTimeout(t); clearInterval(ticker) }
  }, [i, beat])

  // Shelves keep auto-advancing the whole time, like the real carousels.
  const [salesIdx, setSalesIdx] = useState(0)
  const [videosIdx, setVideosIdx] = useState(0)
  useEffect(() => {
    const a = setInterval(() => setSalesIdx(n => (n + 1) % SALES.length), 2400)
    const b = setInterval(() => setVideosIdx(n => (n + 1) % VIDEOS.length), 2700)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])

  // Measured scroll stops: each shelf's real top, capped so the last stop ends on the content.
  const content = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [stops, setStops] = useState<number[]>(STOPS.map(() => 0))
  const measure = () => {
    const el = content.current
    if (!el) return
    const max = Math.max(0, el.scrollHeight - (PHONE_H - STATUS_BAR))
    setStops(STOPS.map(s => Math.min(max, Math.max(0, (refs.current[s.at]?.offsetTop ?? 0) - (s.at ? 6 : 0)))))
  }
  useLayoutEffect(() => { if (beat.k === 'scroll') measure() }, [beat.k]) // eslint-disable-line react-hooks/exhaustive-deps

  if (beat.k === 'title') {
    return (
      <TitleSlide
        icon={Link2}
        kicker="One Page"
        title="Agent Hub"
        body="Your branded one-page hub - socials, sales, listings, videos & blogs."
        nowrapBody
        durationMs={beatDuration(beat)}
        totalPages={TOTAL_PAGES}
        pageIndex={0}
        url="openhousepal.com/peter-stefanatos"
      />
    )
  }

  const stop = beat.stop
  const note = STOPS[stop]
  const y = stops[stop] ?? 0
  const tapSave = note.id === 'save' && tick >= 6 && tick < 9
  const sheetOpen = note.id === 'save' && tick >= 8
  // Gold outline on the part the note is talking about; everything else dims.
  const hl = (id: string) => (note.id === id ? 'ah-on' : 'ah-off')

  return (
    <BrowserFrame url="openhousepal.com/peter-stefanatos" progress={{ pages: TOTAL_PAGES, current: 1 + stop, durationMs: beatDuration(beat) }}>
      <style>{CSS + DEMO_NOTE_CSS}</style>
      <div className="relative flex h-[420px] items-center justify-center gap-5 overflow-hidden bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.18),transparent_60%),linear-gradient(140deg,#fffdf8,#f6efe0)] px-4 dark:bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.14),transparent_60%),linear-gradient(140deg,#0b0f0e,#141210)]">
        {/* what this part does */}
        <div key={note.id} className="ah-rise hidden w-[170px] shrink-0 sm:block">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/40"><note.icon className="h-4 w-4" /></span>
          <p className="mt-2.5 font-serif text-[19px] font-black leading-tight text-[#111827] dark:text-white">{note.title}</p>
          <p className="mt-1.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{note.body}</p>
          {note.id === 'save' && tick >= 14 && <p className="ah-rise mt-2 inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-1 text-[10px] font-black text-[#8b6a2b] dark:text-[#e8c97a]"><Check className="h-3 w-3" /> Saved</p>}
          <div className="mt-3 flex gap-1">{STOPS.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === stop ? 'w-5 bg-[#C9A24D]' : 'w-1.5 bg-[#C9A24D]/25'}`} />)}</div>
        </div>

        <DemoCaption key={`cap-${note.id}`} title={note.title} body={note.body} />
        {/* the phone */}
        <div className="flex-shrink-0" style={{ width: PHONE_W * SCALE, height: (PHONE_H + 20) * SCALE }}>
          <div className="origin-top-left" style={{ transform: `scale(${SCALE})`, width: PHONE_W }}>
            <div className="relative rounded-[2.6rem] bg-[#111827] p-2.5 shadow-[0_40px_70px_-30px_rgba(0,0,0,.7)]">
              <div className="absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#111827]" />
              <div className="relative overflow-hidden rounded-[2.1rem] bg-[linear-gradient(180deg,#fbf6ec,#f6efe0)]" style={{ height: PHONE_H }}>
                <div className="relative z-20 flex items-center justify-between px-6 pt-2.5 text-[10px]" style={{ height: STATUS_BAR }}>
                  <span className="font-bold text-[#111827]">9:41</span>
                  <svg className="h-2.5 w-4 text-[#111827]" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                </div>

                <div className="relative overflow-hidden" style={{ height: PHONE_H - STATUS_BAR }}>
                  <div ref={content} className="absolute inset-x-0 top-0 pb-4 will-change-transform" style={{ transform: `translate3d(0,-${y}px,0)`, transition: 'transform 1250ms cubic-bezier(.4,0,.2,1)' }}>
                    {/* profile */}
                    <div ref={el => { refs.current[AT.profile] = el }} className="px-4 pt-2">
                      <div className={`ah-hl overflow-hidden rounded-[22px] ${hl('card')} border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] via-[#fbf6ec] to-[#f4ead7] shadow-[0_16px_34px_-24px_rgba(139,115,85,.8)]`}>
                        <div className="flex items-start gap-2 p-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355]">{AGENT.brokerage}</p>
                            <p className="mt-1 font-serif text-[21px] font-black leading-[1.02] text-[#111827]">Peter<br />Stefanatos</p>
                            <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-[#a8853d]">{AGENT.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-[8.5px] font-semibold text-gray-500"><MapPin className="h-2.5 w-2.5 text-[#C9A24D]" />{AGENT.market}</p>
                          </div>
                          <div className="rounded-xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] p-[2px] shadow-md">
                            <div className="relative h-[86px] w-[80px] overflow-hidden rounded-[10px]"><Image src={AGENT.photo} alt={AGENT.name} fill className="object-cover object-[50%_18%]" unoptimized /></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 border-t border-[#C9A24D]/25">
                          {[['11', 'Sold'], ['$17M', 'Volume'], ['$1.6M', 'Avg']].map(([v, l], k) => (
                            <div key={l} className={`py-2 text-center ${k ? 'border-l border-[#C9A24D]/25' : ''}`}><p className="font-serif text-[13px] font-black text-[#111827]">{v}</p><p className="text-[6.5px] font-black uppercase tracking-[0.18em] text-gray-400">{l}</p></div>
                          ))}
                        </div>
                      </div>
                      <div className={`ah-hl mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl p-1 ${hl('contact')}`}>
                        {[Phone, MessageSquare, Mail].map((Ic, k) => <span key={k} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1f2937] to-[#0b0b0b] text-white shadow-md"><Ic className="h-4 w-4" /></span>)}
                        <span className="w-1" />
                        {[{ I: Instagram, c: '#E4405F' }, { I: Facebook, c: '#1877F2' }, { I: Youtube, c: '#FF0000' }, { I: Music2, c: '#111827' }, { I: Globe, c: '#a8853d' }].map(({ I: Ic, c }, k) => <span key={k} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C9A24D]/25 bg-white shadow-sm"><Ic className="h-4 w-4" style={{ color: c }} /></span>)}
                      </div>
                      <div className={`ah-shine ah-hl relative mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2218] py-3 text-[11px] font-black text-[#f3dfa8] ${hl('save')} ${tapSave ? 'scale-[0.97]' : ''}`}>
                        <IdCard className="h-4 w-4" /> Save Contact
                        {tapSave && <span className="pointer-events-none absolute left-[62%] top-1/2 h-8 w-8 -translate-y-1/2"><span className="ah-tap absolute inset-0 rounded-full bg-white/60" /><span className="absolute inset-[30%] rounded-full bg-white/90 shadow" /></span>}
                      </div>
                      <div className={`ah-hl mt-2 rounded-2xl ${hl('actions')}`}>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#14532d] to-[#0f3d22] py-2.5 text-[10px] font-black text-white shadow-sm"><Home className="h-3.5 w-3.5" />I&apos;m Buying</span>
                        <span className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#1e2a5a] to-[#141b3c] py-2.5 text-[10px] font-black text-white shadow-sm"><TrendingUp className="h-3.5 w-3.5" />I&apos;m Selling</span>
                      </div>
                      <span className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/50 bg-gradient-to-r from-[#fffdf8] to-[#f6e9cc] py-2.5 text-[10px] font-black text-[#111827]"><DollarSign className="h-3.5 w-3.5 text-[#C9A24D]" />What&apos;s My Home Worth?<ChevronRight className="h-3 w-3 text-gray-400" /></span>
                      <span className="ah-shine mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d7b974] via-[#e8c97a] to-[#C9A24D] py-2.5 text-[10px] font-black text-[#111827] shadow-sm"><Calendar className="h-3.5 w-3.5" />Schedule a Showing</span>
                      </div>
                    </div>

                    <Shelf title="My Recent Sales" action="View all" hl={hl('sales')} sref={el => { refs.current[AT.sales] = el }}>
                      <CarouselTrack index={salesIdx}>
                        {SALES.map(s => (
                          <div key={s.address} className="w-full flex-shrink-0 px-0.5">
                            <PhotoCard photo={s.photo}>
                              <span className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e] via-[#0b0f0e]/15 to-transparent" />
                              <span className="absolute left-2.5 top-2.5 rounded-md bg-gradient-to-br from-[#b23a3a] to-[#7d2222] px-2 py-0.5 text-[7.5px] font-black uppercase tracking-[0.2em] text-white shadow">Sold</span>
                              <span className="absolute inset-x-3 bottom-2.5"><span className="block font-serif text-[18px] text-white">{s.price}</span><span className="block truncate text-[9px] font-bold text-white/80">{s.address} · {s.city}</span></span>
                            </PhotoCard>
                          </div>
                        ))}
                      </CarouselTrack>
                      <div className="mt-2 flex justify-center gap-1">{SALES.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all ${k === salesIdx ? 'w-4 bg-[#C9A24D]' : 'w-1 bg-[#C9A24D]/30'}`} />)}</div>
                    </Shelf>

                    <Shelf title="My Listings" action="View all" hl={hl('listings')} sref={el => { refs.current[AT.listings] = el }}>
                      <div>
                        <PhotoCard photo={REAL_SPOTLIGHT.hero}>
                          <span className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e] via-[#0b0f0e]/10 to-transparent" />
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-amber-400 px-2 py-0.5 text-[7.5px] font-black uppercase tracking-[0.15em] text-[#111827] shadow">Coming Soon</span>
                          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[7px] font-black text-[#111827] shadow"><RefreshCw className="h-2.5 w-2.5 text-[#C9A24D]" />From Bright MLS</span>
                          <span className="absolute inset-x-3 bottom-2.5"><span className="block font-serif text-[18px] text-white">$1,300,000</span><span className="block truncate text-[9px] font-bold text-white/80">{REAL_SPOTLIGHT.address} · Exton, PA · 4 bd · 4.5 ba</span></span>
                        </PhotoCard>
                      </div>
                    </Shelf>

                    <Shelf title="My Videos" action="YouTube" hl={hl('videos')} sref={el => { refs.current[AT.videos] = el }}>
                      <CarouselTrack index={videosIdx}>
                        {VIDEOS.map(v => (
                          <div key={v.label} className="w-full flex-shrink-0 px-0.5">
                            <PhotoCard photo={v.photo}><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 ring-2 ring-white/70 "><Play className="ml-0.5 h-4 w-4 fill-white text-white" /></span></span></PhotoCard>
                            <p className="mt-1.5 truncate px-1 text-[9.5px] font-black text-[#111827]">{v.label}</p>
                          </div>
                        ))}
                      </CarouselTrack>
                    </Shelf>

                    <Shelf title="House Tours" action="Watch" hl={hl('tours')} sref={el => { refs.current[AT.tours] = el }}>
                      <div className="grid grid-cols-2 gap-2">
                        {TOURS.map(t => (
                          <div key={t.label} className="min-w-0">
                            <PhotoCard photo={t.photo} h="h-24"><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A24D] shadow"><Play className="ml-0.5 h-3.5 w-3.5 fill-[#111827] text-[#111827]" /></span></span></PhotoCard>
                            <p className="mt-1 flex items-center gap-1 text-[6.5px] font-black uppercase tracking-[0.2em] text-[#a8853d]"><span className="h-px w-3 bg-[#C9A24D]" />Tour</p>
                            <p className="font-serif text-[10px] font-black leading-tight text-[#111827] line-clamp-2">{t.label}</p>
                          </div>
                        ))}
                      </div>
                    </Shelf>

                    <Shelf title="My Blogs" action="Read all" hl={hl('blogs')} sref={el => { refs.current[AT.blogs] = el }}>
                      <div className="grid grid-cols-2 gap-2">
                        {BLOGS.map(b => <BlogTitleCard key={b.label} title={b.label} audience={b.cat} theme={b.theme} dark={b.dark} date={b.date} scale={0.8} />)}
                      </div>
                    </Shelf>
                  </div>

                  {/* Save Contact -> the phone's own add-contact sheet */}
                  {sheetOpen && (
                    <div className="absolute inset-0 z-20 flex items-end bg-black/30">
                      <div className="ah-sheet w-full rounded-t-[22px] bg-white p-4 shadow-2xl">
                        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-gray-300" />
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 overflow-hidden rounded-full"><Image src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></div>
                          <div><p className="text-[13px] font-black text-[#111827]">{AGENT.name}</p><p className="text-[9px] font-semibold text-gray-500">{AGENT.title} · {AGENT.brokerage}</p></div>
                        </div>
                        <div className="mt-3 space-y-1.5 text-[9.5px]">
                          <p className="flex justify-between border-b border-gray-100 pb-1.5"><span className="text-gray-400">mobile</span><span className="font-bold text-[#0a66c2]">{AGENT.phone}</span></p>
                          <p className="flex justify-between border-b border-gray-100 pb-1.5"><span className="text-gray-400">email</span><span className="font-bold text-[#0a66c2]">{AGENT.email}</span></p>
                        </div>
                        <span className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] py-2.5 text-[11px] font-black text-white">{tick >= 14 ? <><Check className="h-3.5 w-3.5" /> Saved to Contacts</> : <><UserPlus className="h-3.5 w-3.5" /> Add to Contacts</>}</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
