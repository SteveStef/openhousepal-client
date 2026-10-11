'use client'

import { useEffect, useRef, useState } from 'react'
import NextImage from 'next/image'
import { BadgeCheck, Calendar, Check, Clapperboard, Clock, FileSearch, Home, Loader2, MapPin, MousePointer2, Newspaper, Play, ShieldCheck, Sparkles, Tag, Target, Users, Wand2 } from 'lucide-react'
import TypingAnimation from '@/components/TypingAnimation'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import { AGENT, REAL_AI_BLOG, REAL_BLOG, REAL_RECENT_SALES } from './realData'
import BlogTitleCard from './BlogTitleCard'

// Recreates the real Blog Builder (components/studio/blogs/BlogAiWriter.tsx + BlogFinishStep.tsx)
// in the order an agent actually goes through it: the 4-step interview (Topic, Audience,
// Substance, Style), the background job's real stages (gathering what we know about the towns,
// researching what's missing, writing, fact-checking, finishing), the Verified report, the
// Finish step (video, closing pitch), and the published article ending in the agent's own sales
// in those towns + the closing call to action. Article text is REAL_AI_BLOG; the sales are the
// agent's real ones in the article's towns.
const AI = REAL_AI_BLOG
// The video the agent places after the intro - one of Peter's own YouTube videos (16:9 thumb).
const VIDEO = { thumb: '/demos/media/bd86fbf301b4.jpg', title: 'What Does a $1M House Look Like in the Philly Suburbs?' }

// A few words on what's happening, in a strip along the top.
const CAPTIONS = [
  { icon: Sparkles, title: 'Answer 4 quick questions', body: 'Topic, readers, your take, your style.' },
  { icon: FileSearch, title: 'AI researches & writes', body: 'Real sources. Your voice.' },
  { icon: ShieldCheck, title: 'Every fact checked', body: 'Before anything is published.' },
  { icon: Clapperboard, title: 'Add your video & sales', body: 'It ends by pointing to you.' },
  { icon: Newspaper, title: 'Published', body: 'On your site and Agent Hub.' },
]
const captionFor = (k: string) => (['topic', 'audience', 'take', 'style'].includes(k) ? 0 : k === 'research' || k === 'writing' ? 1 : k === 'verified' ? 2 : k === 'finish' ? 3 : 4)

type Beat =
  | { k: 'title-slide' } | { k: 'topic' } | { k: 'audience' } | { k: 'take' } | { k: 'style' }
  | { k: 'research' } | { k: 'writing' } | { k: 'verified' } | { k: 'finish' } | { k: 'published' } | { k: 'live' }
const BEATS: Beat[] = [
  { k: 'title-slide' }, { k: 'topic' }, { k: 'audience' }, { k: 'take' }, { k: 'style' },
  { k: 'research' }, { k: 'writing' }, { k: 'verified' }, { k: 'finish' }, { k: 'published' }, { k: 'live' },
]

function beatDuration(beat: Beat): number | null {
  switch (beat.k) {
    case 'title-slide': return 4800
    case 'topic': return null // advances when the topic finishes typing
    case 'audience': return 4200
    case 'take': return null
    case 'style': return 4200
    case 'research': return 6300
    case 'writing': return 8400
    case 'verified': return 5600
    case 'finish': return 6000
    case 'published': return 13500
    case 'live': return 4200
  }
}

const TOTAL_PAGES = 10
const PAGE_OF: Record<Beat['k'], number> = { 'title-slide': 0, topic: 1, audience: 2, take: 3, style: 4, research: 5, writing: 6, verified: 7, finish: 8, published: 9, live: 9 }

// The working screens are laid out at a compact scale and zoomed up to fill the 420px window.
const ZOOM_K = 1.3
const ZOOM = { zoom: ZOOM_K, height: `${420 / ZOOM_K}px` } as React.CSSProperties

// Same stages, same words as the real writing screen.
const STAGES = [
  { label: 'Gathering what we know about your towns', detail: 'Your sales, live Bright MLS numbers and your IDX town research' },
  { label: 'Researching what is missing', detail: 'Official sources only - townships, school districts, the state' },
  { label: 'Writing in your voice', detail: 'Every fact tied to a dated source' },
  { label: 'Fact-checking every claim', detail: 'Numbers, dates, geography and Fair Housing' },
  { label: 'Fixing and finishing', detail: "Applying the fact-checker's fixes" },
]

// What the research stages turn up for this brief (illustrative of the real sources it uses).
const SOURCES = [
  { label: 'Your 3 sales in these towns', from: 'Your account' },
  { label: 'Bright MLS · last 90 days', from: 'Live market data' },
  { label: 'Town research from your IDX pages', from: 'Saved town knowledge' },
  { label: 'PA Real Estate Seller Disclosure Law', from: 'Pennsylvania General Assembly' },
  { label: 'Building permit records', from: 'Lower Merion & Radnor Townships' },
]

const CLAIMS = [
  { text: 'PA sellers must disclose known material defects in writing', src: 'PA Seller Disclosure Law' },
  { text: 'A sewer scope is not part of a standard home inspection', src: 'Inspection standards' },
  { text: 'Villanova spans Lower Merion and Radnor Townships', src: 'Fixed by the fact-checker', fixed: true },
]

const AUD = ['Buyers', 'First-time buyers', 'Sellers', 'Investors']
const AREAS = ['Bryn Mawr', 'Villanova', 'Haverford', 'Gladwyne', 'Wayne']
const AREA_SALES = REAL_RECENT_SALES.filter(s => (AI.brief.areas as readonly string[]).includes(s.city)).slice(0, 3)
const money = (n: number) => `$${(n / 1_000_000).toFixed(2).replace(/0$/, '')}M`

// The interview steps sit in the same app-window treatment every other Our Tools demo uses: a
// dimmed backdrop, the real writer's dark gradient header with its 4-step progress, then the body.
function Interview({ step, label, children }: { step: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-[370px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-fadeIn dark:border-gray-800 dark:bg-[#151517]">
        <div className="bg-gradient-to-r from-[#111827] via-[#172033] to-[#4a3820] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C9A24D] text-[#111827]"><Sparkles className="h-3.5 w-3.5" /></span>
            <div>
              <p className="text-[7.5px] font-black uppercase tracking-widest text-[#C9A24D]">Blog Builder · Step {step} of 4 · {['Topic', 'Audience', 'Substance', 'Style'][step - 1]}</p>
              <p className="font-serif text-[13px] font-black leading-tight text-white">{label}</p>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1">{[1, 2, 3, 4].map(s => <div key={s} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${s <= step ? 'bg-[#C9A24D]' : 'bg-white/15'}`} />)}</div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[8.5px] font-black transition-all duration-300 ${on ? 'scale-105 border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}>{on && <Check className="h-2.5 w-2.5" />}{children}</span>
}

function Cursor() {
  return (
    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5">
      <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
      <MousePointer2 className="relative h-3 w-3 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
    </span>
  )
}

// The real writing screen's stage list: done (green check), active (spinner), upcoming (ring).
function StageList({ doneCount, compact = false }: { doneCount: number; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-wrap gap-x-2.5 gap-y-1' : 'space-y-1.5'}>
      {STAGES.map((s, idx) => {
        const done = idx < doneCount
        const active = idx === doneCount
        return (
          <div key={s.label} className={`flex items-start gap-1.5 transition-colors duration-500 ${done ? 'text-emerald-600 dark:text-emerald-400' : active ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-300 dark:text-gray-600'}`}>
            <span className="mt-[1px] flex h-3 w-3 shrink-0 items-center justify-center">
              {done ? <Check className="h-2.5 w-2.5" /> : active ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full border border-current" />}
            </span>
            <span className="min-w-0">
              <span className={`block font-black leading-tight ${compact ? 'text-[7px]' : 'text-[8.5px]'}`}>{s.label}</span>
              {!compact && active && <span className="block text-[7px] font-semibold leading-tight text-gray-500 animate-fadeIn dark:text-gray-400">{s.detail}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// The published post, laid out like the real article page: kicker, serif headline, subtitle,
// "Written by" at the top (signature is on), the cover, then the body - drop-cap intro, At a
// glance, the video the agent placed after the intro, the sections - and how it ends: the agent's
// sales in these towns and the closing call to action. Scrolls slowly from top to bottom over
// the beat (measured, so it always lands exactly on the ending).
function PublishedArticle() {
  const view = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [y, setY] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      if (view.current && page.current) setY(Math.max(0, page.current.offsetHeight - view.current.offsetHeight))
    }, 1300)
    return () => clearTimeout(t)
  }, [])
  const H2 = ({ children }: { children: React.ReactNode }) => (
    <p className="relative mt-3 pl-2 font-serif text-[10px] font-black leading-tight text-[#111827] before:absolute before:bottom-[1px] before:left-0 before:top-[1px] before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-[#C9A24D] before:to-[#e8c97a] dark:text-white">{children}</p>
  )
  const P = ({ children }: { children: React.ReactNode }) => <p className="mt-1 text-[7.5px] leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
  return (
    <div ref={view} className="animate-fadeIn overflow-hidden bg-[#f7f5f1] dark:bg-[#0B0B0B]" style={ZOOM}>
      <div ref={page} className="px-4 pb-4 pt-3 will-change-transform" style={{ transform: `translateY(-${y}px)`, transition: 'transform 10.5s cubic-bezier(.45,.05,.35,1)' }}>
        <p className="flex items-center gap-1.5 text-[7px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]"><span className="h-px w-4 bg-[#C9A24D]" />{AI.category}</p>
        <h4 className="mt-1 font-serif text-[17px] font-black leading-[1.05] tracking-[-0.01em] text-[#111827] dark:text-white">
          A Buyer&apos;s Due Diligence Checklist for <em className="font-light text-[#a8853d] dark:text-[#e8c97a]">Main Line Homes</em>
        </h4>
        <p className="mt-1 text-[8.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{AI.subtitle}</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-1.5 py-1 dark:border-gray-800 dark:bg-[#151517]">
          <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-[#C9A24D]"><NextImage src={AGENT.photo} alt={AGENT.name} fill className="object-cover object-[50%_18%]" unoptimized /></div>
          <div className="min-w-0">
            <p className="text-[5.5px] font-black uppercase tracking-[0.25em] text-[#8b7355]">Written by</p>
            <p className="font-serif text-[8px] font-black leading-tight text-[#111827] dark:text-white">{AGENT.name}</p>
            <p className="flex items-center gap-1 text-[6px] font-bold text-gray-400">{AGENT.title} · {AGENT.brokerage} · <Calendar className="h-1.5 w-1.5" /> Oct 1, 2026 · <Clock className="h-1.5 w-1.5" /> 5 min read</p>
          </div>
        </div>
        <div className="relative mt-2 h-24 w-full overflow-hidden rounded-xl shadow-[0_14px_30px_-18px_rgba(0,0,0,.6)]">
          <NextImage src={REAL_BLOG.coverImage} alt="" fill className="object-cover" unoptimized />
        </div>

        <div className="mt-2.5 rounded-xl border border-[#C9A24D]/20 bg-white p-2.5 shadow-[0_18px_36px_-30px_rgba(139,115,85,.8)] dark:border-white/10 dark:bg-[#151517]">
          <p className="text-[7.5px] leading-relaxed text-gray-700 dark:text-gray-300">
            <span className="float-left mr-1 mt-[1px] font-serif text-[22px] font-black leading-[0.8] text-[#C9A24D]">{AI.intro.charAt(0)}</span>{AI.intro.slice(1)}
          </p>
          <div className="mt-2 rounded-lg border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-1.5">
            <p className="text-[7px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">At a glance</p>
            {AI.atAGlance.map(g => <p key={g} className="mt-0.5 flex gap-1 text-[7px] leading-snug text-gray-700 dark:text-gray-300"><Check className="mt-[1px] h-2 w-2 shrink-0 text-[#C9A24D]" />{g}</p>)}
          </div>
          <div className="relative mx-auto mt-2 aspect-video w-[78%] overflow-hidden rounded-lg bg-black shadow-[0_10px_24px_-14px_rgba(0,0,0,.7)]">
            <NextImage src={VIDEO.thumb} alt="" fill className="object-cover" unoptimized />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="flex h-6 w-9 items-center justify-center rounded-lg bg-[#FF0000] shadow-lg"><Play className="ml-[1px] h-2.5 w-2.5 fill-white text-white" /></span>
            </span>
            <span className="absolute inset-x-0 top-0 truncate bg-gradient-to-b from-black/70 to-transparent px-1.5 pb-2 pt-1 text-[6px] font-bold text-white">{VIDEO.title}</span>
          </div>

          <H2>{AI.heading}</H2>
          <P>A general inspection is a broad look at the whole house. On older homes, the biggest surprises tend to sit in the systems it does not fully evaluate.</P>
          <ul className="mt-1 space-y-0.5 pl-1">{AI.bullets.map(b => <li key={b} className="flex gap-1 text-[7px] leading-snug text-gray-700 dark:text-gray-300"><span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />{b}</li>)}</ul>

          <p className="mt-2.5 border-l-2 border-[#C9A24D] pl-2 font-serif text-[9px] italic leading-snug text-[#111827] dark:text-gray-200">&ldquo;{AI.quote}&rdquo;</p>

          {AI.sections.map(sec => (
            <div key={sec.heading}>
              <H2>{sec.heading}</H2>
              <P>{sec.body}</P>
              {'bullets' in sec && sec.bullets && <ul className="mt-1 space-y-0.5 pl-1">{sec.bullets.map(b => <li key={b} className="flex gap-1 text-[7px] leading-snug text-gray-700 dark:text-gray-300"><span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />{b}</li>)}</ul>}
            </div>
          ))}

          <p className="mt-3 text-[7px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">My recent sales in these towns</p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {AREA_SALES.map(s => (
              <div key={s.address} className="relative h-14 overflow-hidden rounded-md shadow-sm">
                <NextImage src={s.photo} alt={s.address} fill className="object-cover" unoptimized />
                <span className="absolute left-1 top-1 rounded-sm bg-[#9b2c2c] px-1 text-[5px] font-black uppercase tracking-widest text-white">Sold</span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 pb-0.5 pt-3">
                  <span className="block text-[5.5px] font-black uppercase tracking-wide text-[#f3dfa8]">{s.city}</span>
                  <span className="block font-serif text-[8.5px] font-black text-white">{money(s.price)}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="relative mt-2.5 overflow-hidden rounded-xl bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] p-2.5 text-white">
            <span className="absolute -right-4 -top-6 h-16 w-16 rounded-full bg-[#C9A24D]/30 blur-xl" />
            <div className="relative flex items-center gap-2">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-[#C9A24D]"><NextImage src={AGENT.photo} alt="" fill className="object-cover object-[50%_18%]" unoptimized /></div>
              <div>
                <p className="text-[5.5px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">Talk to Peter</p>
                <p className="font-serif text-[10px] font-black leading-tight">Have a question about your move?</p>
              </div>
            </div>
            <div className="relative mt-1.5 flex flex-wrap items-center gap-1">
              <span className="rounded-md bg-gradient-to-r from-white to-[#e8c97a] px-2 py-0.5 text-[7px] font-black text-[#111827]">{AI.cta} →</span>
              {["What's my home worth?", 'See a home in person'].map(c => <span key={c} className="rounded-full border border-white/20 px-1.5 py-0.5 text-[6px] font-bold text-white/80">{c}</span>)}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function BlogsDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const beat = BEATS[i]
  const advance = () => setI(n => (n + 1) % BEATS.length)

  useEffect(() => {
    setTick(0)
    const d = beatDuration(beat)
    const ticker = setInterval(() => setTick(t => t + 1), 700)
    if (d == null) return () => clearInterval(ticker)
    const t = setTimeout(advance, d)
    return () => { clearTimeout(t); clearInterval(ticker) }
  }, [i, beat])

  if (beat.k === 'title-slide') {
    return <TitleSlide icon={Newspaper} iconClassName="ohp-icon-assemble-blog" kicker="Local SEO" title="Blog Builder" body="Researched, fact-checked local articles - written in minutes." nowrapBody ai durationMs={beatDuration(beat) ?? 4800} totalPages={TOTAL_PAGES} url="app.openhousepal.com/studio/blogs" />
  }

  const url = beat.k === 'published' ? `openhousepal.com/peter-stefanatos/blogs/${AI.slug}`
    : beat.k === 'live' ? 'openhousepal.com/peter-stefanatos/blogs'
    : beat.k === 'verified' || beat.k === 'finish' ? 'app.openhousepal.com/studio/blogs/editor'
    : 'app.openhousepal.com/studio/blogs'
  const progress = { pages: TOTAL_PAGES, current: PAGE_OF[beat.k], durationMs: beatDuration(beat) ?? 4000 }

  return (
    <BrowserFrame url={url} progress={progress}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className={`relative h-[420px] ${captionFor(beat.k) === 0 ? '' : 'pt-[52px]'} ${beat.k === 'live' ? 'flex items-center justify-center p-5 pt-[60px]' : 'overflow-hidden'}`}>
        {(() => { const c = captionFor(beat.k); return <DemoStep id={String(c)} step={c + 1} count={CAPTIONS.length} title={CAPTIONS[c].title} body={CAPTIONS[c].body} icon={CAPTIONS[c].icon} /> })()}

        {beat.k === 'topic' && (
          <Interview step={1} label="What's this article about?">
            <div className="rounded-xl border-2 border-[#C9A24D] bg-white px-3 py-2.5 text-[11px] font-bold text-[#111827] shadow-[0_0_0_4px_rgba(201,162,77,0.12)] dark:bg-[#151517] dark:text-white">
              <TypingAnimation text={AI.brief.topic} speed={45} onComplete={() => setTimeout(advance, 1300)} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {['Market update', 'Neighborhood guide', 'First-time buyer roadmap', 'Pricing lessons'].map((c, idx) => (
                <span key={c} className="rounded-full bg-[#C9A24D]/10 px-2 py-0.5 text-[8.5px] font-bold text-[#8b7355] animate-fadeIn dark:text-[#d7b974]" style={{ animationDelay: `${150 + idx * 90}ms` }}>{c}</span>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1 text-[8.5px] font-black text-[#111827] dark:text-white"><Target className="h-3 w-3 text-[#8b7355]" /> What should a reader walk away knowing?</p>
            <div className="mt-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[8.5px] text-gray-300 dark:border-gray-700">Optional - sharpens the whole article</div>
          </Interview>
        )}

        {beat.k === 'audience' && (
          <Interview step={2} label="Who is it for - and where?">
            <p className="mb-1.5 flex items-center gap-1 text-[9px] font-black text-[#111827] dark:text-white"><Users className="h-3 w-3 text-[#8b7355]" /> Audience</p>
            <div className="mb-3 flex flex-wrap gap-1">
              {AUD.map((a, idx) => <Chip key={a} on={(AI.brief.audiences as readonly string[]).includes(a) && tick > idx}>{a}</Chip>)}
            </div>
            <p className="mb-1.5 flex items-center gap-1 text-[9px] font-black text-[#111827] dark:text-white"><MapPin className="h-3 w-3 text-[#8b7355]" /> What area are you writing about?</p>
            <div className="flex flex-wrap gap-1">
              {AREAS.map((a, idx) => <Chip key={a} on={(AI.brief.areas as readonly string[]).includes(a) && tick > idx + 1}>{a}</Chip>)}
            </div>
            <p className="mt-3 text-[8px] font-semibold text-gray-400">Naming your towns is what makes it rank locally - and what the AI researches.</p>
          </Interview>
        )}

        {beat.k === 'take' && (
          <Interview step={3} label="Your take - the part only you could write">
            <div className="min-h-[64px] rounded-xl border-2 border-[#C9A24D] bg-white px-3 py-2.5 text-[10px] font-semibold italic leading-snug text-[#111827] shadow-[0_0_0_4px_rgba(201,162,77,0.12)] dark:bg-[#151517] dark:text-white">
              <TypingAnimation text={AI.brief.take} speed={26} onComplete={() => setTimeout(advance, 1500)} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 px-2.5 py-1.5 dark:border-gray-700">
              <span className="flex items-center gap-1 text-[8.5px] font-black text-[#111827] dark:text-white"><Home className="h-3 w-3 text-[#8b7355]" /> Reference my real sales</span>
              <span className={`flex items-center gap-1.5 text-[8px] font-bold transition-colors duration-500 ${tick > 4 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {tick > 4 ? `${AREA_SALES.length} in these towns` : 'Off'}
                <span className={`relative h-3 w-5 rounded-full transition-colors duration-500 ${tick > 4 ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700'}`}><span className={`absolute top-0.5 h-2 w-2 rounded-full bg-white shadow transition-all duration-500 ${tick > 4 ? 'left-2.5' : 'left-0.5'}`} /></span>
              </span>
            </div>
          </Interview>
        )}

        {beat.k === 'style' && (
          <Interview step={4} label="How should it sound?">
            <p className="mb-1.5 flex items-center gap-1 text-[9px] font-black text-[#111827] dark:text-white"><Wand2 className="h-3 w-3 text-[#8b7355]" /> Tone</p>
            <div className="mb-2.5 flex flex-wrap gap-1">{['Warm & personal', 'Professional', 'Refined luxury', 'Straight talk'].map(t => <Chip key={t} on={t === 'Professional' && tick > 0}>{t}</Chip>)}</div>
            <p className="mb-1.5 text-[9px] font-black text-[#111827] dark:text-white">Length</p>
            <div className="mb-2.5 flex flex-wrap gap-1">{['Quick read', 'Standard', 'In-depth guide'].map(t => <Chip key={t} on={t === 'Standard' && tick > 1}>{t}</Chip>)}</div>
            <p className="mb-1.5 text-[9px] font-black text-[#111827] dark:text-white">What should readers do at the end?</p>
            <div className="flex flex-wrap gap-1">{['Book a consultation', 'Get a home value', 'Schedule a tour'].map(t => <Chip key={t} on={t === 'Book a consultation' && tick > 2}>{t}</Chip>)}</div>
            <div className="mt-3 flex justify-end">
              <span className={`relative inline-flex items-center gap-1 rounded-lg bg-[#C9A24D] px-2.5 py-1.5 text-[9px] font-black text-[#111827] shadow-md transition-transform duration-150 ${tick === 5 ? 'scale-95' : ''}`}>
                <Sparkles className="h-3 w-3" /> Write my article
                {tick >= 3 && <Cursor />}
              </span>
            </div>
          </Interview>
        )}

        {beat.k === 'research' && (
          <div className="flex animate-fadeIn flex-col gap-2 bg-[#f7f5f1] px-4 py-3 dark:bg-[#0B0B0B]" style={ZOOM}>
            <div>
              <p className="flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-2.5 w-2.5" /> Writing your article · keep working, we'll save it</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#C9A24D]/15"><div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] transition-all duration-700" style={{ width: `${8 + Math.min(tick, 9) * 3.4}%` }} /></div>
            </div>
            <div className="grid flex-1 grid-cols-[1fr_1.1fr] gap-2">
              <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#151517]">
                <StageList doneCount={tick >= 7 ? 2 : tick >= 3 ? 1 : 0} />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#151517]">
                <p className="mb-1.5 flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-gray-400"><FileSearch className="h-2.5 w-2.5" /> Sources found</p>
                <div className="space-y-1">
                  {SOURCES.map((src, idx) => tick > idx + (idx > 2 ? 1 : 0) && (
                    <div key={src.label} className="flex items-start gap-1 rounded-md bg-[#C9A24D]/[0.07] px-1.5 py-1 animate-fadeIn">
                      <BadgeCheck className="mt-[1px] h-2.5 w-2.5 shrink-0 text-emerald-600" />
                      <span className="min-w-0">
                        <span className="block text-[7.5px] font-black leading-tight text-[#111827] dark:text-white">{src.label}</span>
                        <span className="block text-[6.5px] font-semibold text-gray-500 dark:text-gray-400">{src.from}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {beat.k === 'writing' && (
          <div className="flex animate-fadeIn flex-col bg-[#f7f5f1] px-4 py-3 dark:bg-[#0B0B0B]" style={ZOOM}>
            <div className="mb-2"><StageList doneCount={tick >= 10 ? 3 : 2} compact /></div>
            <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517]">
              <p className="text-[7px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{AI.category}</p>
              <p className="mt-0.5 font-serif text-[12px] font-black leading-tight text-[#111827] dark:text-white"><TypingAnimation text={AI.title} speed={28} /></p>
              {tick >= 3 && <p className="mt-1 text-[8px] font-semibold text-gray-500 dark:text-gray-400"><TypingAnimation text={AI.subtitle} speed={12} /></p>}
              {tick >= 5 && <p className="mt-1.5 text-[8px] leading-snug text-gray-700 dark:text-gray-300"><TypingAnimation text={AI.intro} speed={7} /></p>}
              {tick >= 8 && (
                <div className="mt-1.5 animate-fadeIn rounded-md border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-1">
                  <p className="text-[7px] font-black text-[#111827] dark:text-white">At a glance</p>
                  {AI.atAGlance.map(g => <p key={g} className="text-[7px] leading-snug text-gray-700 dark:text-gray-300">&bull; {g}</p>)}
                </div>
              )}
              {tick >= 10 && <p className="mt-1.5 animate-fadeIn font-serif text-[9.5px] font-black text-[#111827] dark:text-white">{AI.heading}</p>}
              {tick >= 11 && <ul className="mt-0.5 animate-fadeIn list-disc pl-3 text-[7px] leading-snug text-gray-700 dark:text-gray-300">{AI.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
              <span className="ml-0.5 inline-block h-2.5 w-[2px] animate-pulse bg-[#C9A24D] align-middle" />
            </div>
          </div>
        )}

        {beat.k === 'verified' && (
          <div className="animate-fadeIn space-y-2 bg-[#f7f5f1] px-4 py-3 dark:bg-[#0B0B0B]" style={ZOOM}>
            <p className="flex items-center gap-1 text-[8px] font-black text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" /> Verified - your draft is ready, saved, not published</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[['21', 'Claims checked'], ['19', 'Supported'], ['2', 'Fixed'], ['9', 'Sources']].map(([n, l], idx) => (
                <div key={l} className="rounded-lg border border-gray-200 bg-white px-1.5 py-1.5 text-center animate-fadeIn dark:border-gray-800 dark:bg-[#151517]" style={{ animationDelay: `${idx * 120}ms` }}>
                  <p className="font-serif text-[13px] font-black leading-none text-[#111827] dark:text-white">{n}</p>
                  <p className="mt-0.5 text-[6px] font-black uppercase tracking-wide text-gray-400">{l}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
              {CLAIMS.map((c, idx) => tick > idx && (
                <div key={c.text} className="flex items-start gap-1.5 animate-fadeIn">
                  {c.fixed ? <Wand2 className="mt-[1px] h-2.5 w-2.5 shrink-0 text-[#C9A24D]" /> : <Check className="mt-[1px] h-2.5 w-2.5 shrink-0 text-emerald-600" />}
                  <span className="min-w-0">
                    <span className="block text-[7.5px] font-bold leading-tight text-[#111827] dark:text-white">{c.text}</span>
                    <span className={`block text-[6.5px] font-semibold ${c.fixed ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-400'}`}>{c.src}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
              <p className="text-[6.5px] font-black uppercase tracking-widest text-gray-400">Google preview</p>
              <p className="truncate text-[9px] font-bold text-[#1a0dab] dark:text-[#8ab4f8]">{AI.seoTitle}</p>
              <p className="line-clamp-2 text-[7.5px] leading-snug text-gray-600 dark:text-gray-300">{AI.metaDescription}</p>
            </div>
          </div>
        )}

        {beat.k === 'finish' && (
          <div className="animate-fadeIn space-y-2 bg-[#f7f5f1] px-4 py-3 dark:bg-[#0B0B0B]" style={ZOOM}>
            <p className="text-[9px] font-black text-[#111827] dark:text-white">Finish your article</p>
            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
              <p className="flex items-center gap-1 text-[8px] font-black text-[#111827] dark:text-white"><Clapperboard className="h-3 w-3 text-[#C9A24D]" /> Add a video</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className={`relative h-9 w-14 shrink-0 overflow-hidden rounded-md transition-all duration-300 ${tick > 0 ? 'ring-2 ring-[#C9A24D]' : ''}`}>
                  <NextImage src={VIDEO.thumb} alt="" fill className="object-cover" unoptimized />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="h-3 w-3 fill-white text-white" /></span>
                </div>
                <div className="min-w-0 text-[7px] font-semibold text-gray-500 dark:text-gray-400">
                  <p className="line-clamp-2 font-black leading-tight text-[#111827] dark:text-white">{VIDEO.title}</p>
                  {tick > 1 && <p className="animate-fadeIn">Placed after the intro</p>}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
              <p className="flex items-center gap-1 text-[8px] font-black text-[#111827] dark:text-white"><Sparkles className="h-3 w-3 text-[#C9A24D]" /> End with a pitch</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {[{ icon: Tag, label: 'Sales in these towns', n: AREA_SALES.length, on: tick > 2 }, { icon: Home, label: 'My listings', n: 1, on: false }, { icon: Play, label: 'Videos about the area', n: 2, on: false }].map(o => (
                  <div key={o.label} className={`relative rounded-md border px-1.5 py-1 transition-all duration-300 ${o.on ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <o.icon className="h-2.5 w-2.5 text-[#8b7355]" />
                    <p className="mt-0.5 text-[7px] font-black leading-tight text-[#111827] dark:text-white">{o.label}</p>
                    <p className="text-[6px] font-bold text-gray-400">{o.n} to show</p>
                    {o.on && <Check className="absolute right-1 top-1 h-2.5 w-2.5 text-[#C9A24D]" />}
                  </div>
                ))}
              </div>
              {tick > 3 && (
                <div className="mt-1.5 flex gap-1 animate-fadeIn">
                  {AREA_SALES.map(s => (
                    <div key={s.address} className="relative h-8 flex-1 overflow-hidden rounded ring-1 ring-[#C9A24D]">
                      <NextImage src={s.photo} alt={s.address} fill className="object-cover" unoptimized />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 text-[6px] font-black text-white">{s.city}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <span className={`relative inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1 text-[8px] font-black text-white transition-transform duration-150 dark:bg-white dark:text-[#111827] ${tick === 7 ? 'scale-95' : ''}`}>
                Open my article {tick >= 5 && <Cursor />}
              </span>
            </div>
          </div>
        )}

        {beat.k === 'published' && <PublishedArticle />}

        {beat.k === 'live' && (
          <div className="w-full animate-fadeIn">
            <p className="mb-1 text-sm font-black text-[#0B0B0B] dark:text-white">Your Blogs</p>
            <div className="mb-3 flex gap-1.5">
              {['All', 'Buyers', 'Market Updates'].map((c, idx) => (
                <span key={c} className={`rounded-full px-2 py-1 text-[7.5px] font-black ${idx === 1 ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 text-gray-400 dark:border-gray-700'}`}>{c}</span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { title: AI.title, audience: 'Buyers', theme: 'Luxe', dark: false, status: 'published', date: 'Oct 1, 2026', fresh: true },
                { title: REAL_BLOG.title, audience: 'Market update', theme: 'Midnight', dark: true, status: 'published', date: 'Sep 8, 2026' },
                { title: 'What Main Line Sellers Should Do Before Listing This Spring', audience: 'Sellers', theme: 'Luxe', dark: false, status: 'draft', date: 'Sep 2, 2026' },
              ].map((post, k) => (
                <div key={post.title} className="relative animate-fadeIn" style={{ animationDelay: `${k * 120}ms` }}>
                  <BlogTitleCard title={post.title} audience={post.audience} theme={post.theme} dark={post.dark} status={post.status} date={post.date} scale={0.82} />
                  {post.fresh && <span className="absolute -right-1 -top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-[#C9A24D] px-1.5 py-0.5 text-[6px] font-black uppercase text-[#111827] shadow"><Sparkles className="h-2 w-2" /> New · Verified</span>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[8px] font-semibold text-gray-400">Live on your Agent Hub and IDX site.</p>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
