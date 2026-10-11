'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, ClipboardList, MapPin, Sparkles, MousePointer2, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KitsIcon } from '@/components/icons/CustomIcons'
import TypingAnimation from '@/components/TypingAnimation'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { DemoCaption, DemoNote, DEMO_NOTE_CSS, STAGE_BG } from './DemoNote'
import { AGENT, REAL_OPEN_HOUSE as OH, REAL_RECENT_SALES, REAL_SIMILAR_HOMES } from './realData'

// Recreates the real Open House Kit wizard (app/open-houses/components/CreateOpenHouseWizard.tsx)
// for the exact listing (365 Arbor Cir, Media) the user's own real Flyer/Cheat Sheet/Brag Sheet/
// Similar Homes PDFs were generated from - so each mockup below is modeled directly on those real
// PDFs (real headers, real copy, real stats, real photos), not an invented approximation.
const DOCS = ['Sign In', 'Cheat Sheet', 'Brag Sheet', 'Similar Homes'] as const

// Display label for each doc - kept separate from the DOCS union itself (which DocMockup's
// switch, etc. still key off of) so a nicer-sounding name can be shown without touching that
// internal typing/logic.
const DOC_LABEL: Record<typeof DOCS[number], string> = {
  'Sign In': 'Instant Sign In',
  'Cheat Sheet': 'Cheat Sheet',
  'Brag Sheet': 'Brag Sheet',
  'Similar Homes': 'Similar Homes',
}

// Shown beside each document once it opens. Only "Sign In" keeps the two-part "Name + Benefit"
// headline (the "Instant Sign In / + / Auto Follow-Up" stack, matching SignInDemo) - the other
// three just show the document's name and a sentence saying what it actually is.
const DOC_SIGNIN_BENEFIT = 'Auto Follow-Up'
// Each opened document is explained one part at a time: that part gets the gold outline on the
// page (the rest dims) while the sentence beside the document says what it is.
type DocStep = { hl: string; title: string; body: string }
const DOC_STEPS: Record<typeof DOCS[number], DocStep[]> = {
  'Sign In': [
    { hl: 'qr', title: 'Scan to sign in', body: 'Guests scan with their phone.' },
    { hl: 'details', title: 'Filled in for you', body: 'Home details come from the MLS.' },
    { hl: 'qr', title: 'Every guest = a lead', body: 'Follow-up is set up for you.' },
  ],
  'Cheat Sheet': [
    { hl: 'info', title: 'Every answer, ready', body: 'Taxes, schools, HOA and more.' },
    { hl: 'nearby', title: "What's nearby", body: 'Schools, stores and parks - with distances.' },
  ],
  'Brag Sheet': [
    { hl: 'stats', title: 'Your numbers', body: 'From your real sales.' },
    { hl: 'sales', title: 'Your recent sales', body: 'Your track record, with photos.' },
    { hl: 'qr', title: 'Scan to see more', body: 'Opens your Agent Hub.' },
  ],
  'Similar Homes': [
    { hl: 'match', title: 'Homes like this one', body: 'Similar homes nearby, with match scores.' },
    { hl: 'homeqr', title: 'A QR code on every home', body: 'Scan to open that home.' },
    { hl: 'bottom', title: 'Their own home search', body: 'One scan opens a Showcase - with you.' },
  ],
}
const STEP_MS = 3900

// After the kit is ready, each document gets its own "zoom -> open -> reset" mini-sequence: an
// arrow points at the thumbnail and it scales up (zoom), it gets tapped and the real preview opens
// (open), then it scales back down to the full 4-up grid before the arrow moves to the next one
// (reset) - so it reads as a guided walkthrough of all 4 documents rather than a single anonymous
// "tap to open" grid.
type Beat = { k: 'title' } | { k: 'address' } | { k: 'photo' } | { k: 'generate-click' } | { k: 'generating'; idx: number } | { k: 'ready' } | { k: 'zoom'; idx: number } | { k: 'open'; idx: number } | { k: 'reset'; idx: number }
const BEATS: Beat[] = [
  { k: 'title' }, { k: 'address' }, { k: 'photo' }, { k: 'generate-click' },
  { k: 'generating', idx: 0 }, { k: 'generating', idx: 1 }, { k: 'generating', idx: 2 }, { k: 'generating', idx: 3 },
  { k: 'ready' },
  { k: 'zoom', idx: 0 }, { k: 'open', idx: 0 }, { k: 'reset', idx: 0 },
  { k: 'zoom', idx: 1 }, { k: 'open', idx: 1 }, { k: 'reset', idx: 1 },
  { k: 'zoom', idx: 2 }, { k: 'open', idx: 2 }, { k: 'reset', idx: 2 },
  { k: 'zoom', idx: 3 }, { k: 'open', idx: 3 }, { k: 'reset', idx: 3 },
]

const ZOOM_MS = 1300
// Held long enough to actually read the full explainer sentence beside each document before it
// closes (bumped again per feedback that each kit page went by too fast).
const OPEN_MS: Record<number, number> = Object.fromEntries(DOCS.map((d, idx) => [idx, DOC_STEPS[d].length * STEP_MS + 500]))
const RESET_MS = 500

function beatDuration(beat: Beat): number | null {
  switch (beat.k) {
    case 'title': return 5200
    case 'address': return null
    case 'photo': return 2600
    case 'generate-click': return 900
    case 'generating': return 1000
    case 'ready': return 3200
    case 'zoom': return ZOOM_MS
    case 'open': return OPEN_MS[beat.idx]
    case 'reset': return RESET_MS
  }
}

// DocMockup is laid out for a real Letter-page ratio at a legible size (used 1:1 in the opened-
// document modal below). The "Kit Ready" thumbnail grid used to render that exact same content
// directly into an ~81x108px box, which just clipped everything past the fold. DocThumbnail
// renders it at full size and scales the whole thing down with a CSS transform instead, so nothing
// gets cut off.
const DOC_W = 309
const DOC_H = 400
// Slightly larger than the original 81px - the scaled-down text is inherently softer than native
// size (a browser antialiasing side effect of scaling text-heavy content this far down), and a
// bigger thumbnail reduces how far down it has to scale.
const THUMB_W = 92
function DocThumbnail({ doc }: { doc: typeof DOCS[number] }) {
  const scale = THUMB_W / DOC_W
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm" style={{ width: THUMB_W, height: DOC_H * scale }}>
      <div style={{ width: DOC_W, height: DOC_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <DocMockup doc={doc} />
      </div>
    </div>
  )
}

const QR_CELLS = [1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1]
function MiniQr({ size, dark = false }: { size: number; dark?: boolean }) {
  return (
    <div className={dark ? 'bg-white grid grid-cols-4 grid-rows-4 gap-[1px] p-[2px]' : 'bg-white grid grid-cols-4 grid-rows-4 gap-[1px] p-[2px] border border-gray-200 rounded'} style={{ width: size, height: size }}>
      {QR_CELLS.map((on, idx) => <div key={idx} className={on ? 'bg-[#111827]' : 'bg-white'} />)}
    </div>
  )
}

// Sized for a big, legible modal (roughly a Letter-page ratio) rather than a thumbnail - modeled
// directly on the real PDFs in lib/pdfs.tsx for this exact listing.
function DocMockup({ doc, hl }: { doc: typeof DOCS[number]; hl?: string }) {
  // Gold outline on the part being explained, the rest dims (only in the opened view).
  const on = (id: string) => (hl == null ? '' : hl === id ? 'dn-hl dn-on rounded-lg' : 'dn-hl dn-off')
  if (doc === 'Sign In') {
    // Real Flyer (OpenHouseFlyerDocument): full-width hero, Welcome/Open House heading, real
    // address/beds-baths-sqft/price on the left, the real Instant Check-In QR panel on the right.
    return (
      <div className="w-full h-full bg-white flex flex-col">
        <div className="relative h-[45%] flex-shrink-0">
          <Image src={OH.photo} alt={OH.address} fill className="object-cover" unoptimized />
        </div>
        <div className="flex-1 flex gap-3 p-4">
          <div className={`flex-[1.7] min-w-0 flex flex-col ${on('details')}`}>
            <p className="text-[6.5px] font-bold uppercase tracking-[0.25em] text-gray-400">Welcome</p>
            <p className="font-serif text-lg font-black uppercase text-gray-900 leading-none mt-1">Open House</p>
            <div className="h-px bg-gray-200 my-2" />
            <p className="text-[6px] font-bold uppercase tracking-[0.2em] text-gray-400">Property Address</p>
            <p className="text-[11px] font-bold text-gray-900 leading-snug mt-0.5">{OH.address}, {OH.city}</p>
            <p className="text-[6px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-2.5 mb-1">Property Details</p>
            <div className="flex items-center justify-around rounded-lg border border-gray-100 py-1.5">
              {[[String(OH.beds), 'Beds'], [String(OH.baths), 'Baths'], [OH.sqft.toLocaleString(), 'Sq Ft']].map(([v, l]) => (
                <div key={l} className="text-center px-0.5">
                  <p className="text-xs font-black text-gray-900 leading-none">{v}</p>
                  <p className="text-[5px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
            <div className="h-px bg-gray-200 my-2.5" />
            <p className="text-[6px] font-bold uppercase tracking-[0.2em] text-gray-400">Listing Price</p>
            <p className="text-base font-black text-gray-900 mt-0.5">${OH.price.toLocaleString()}</p>
          </div>
          <div className={`flex-1 rounded-xl border border-[#E7E5E4] bg-[#F8F7F4] p-2.5 flex flex-col items-center text-center ${on('qr')}`}>
            <p className="text-[5.5px] font-bold uppercase tracking-[0.15em] text-gray-400">Instant Check-In</p>
            <p className="text-[10px] font-bold text-gray-900 mt-1">Scan to Sign In</p>
            <p className="text-[5.5px] text-gray-500 mt-1 leading-tight">Complete our online sign-in form.</p>
            <div className="mt-2 rounded-lg bg-white border border-gray-200 p-1.5">
              <MiniQr size={44} />
            </div>
            <p className="text-[6px] font-bold uppercase tracking-wide text-gray-900 mt-auto pt-2">Quick &amp; Easy</p>
            <p className="text-[5px] text-gray-400 mt-0.5 leading-tight">Takes less than 30 seconds</p>
          </div>
        </div>
      </div>
    )
  }
  if (doc === 'Cheat Sheet') {
    // Real Cheat Sheet page 2 (lib/pdfs.tsx OpenHouseCheatSheetDocument, the "Open House Guide"
    // back page an agent actually references live during the open) - address/price header,
    // description, the real Property Info facts (water/sewer/taxes/cooling + the 6 fact pairs),
    // and the real What's Nearby categories + the 3 QR/map action boxes at the bottom.
    return (
      <div className="w-full h-full bg-white p-4 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-lg font-black text-gray-900 leading-tight">{OH.address}, {OH.city}</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-gray-400 mt-1">Open House Guide</p>
          </div>
          <p className="font-serif text-lg font-black text-[#8b7355] flex-shrink-0">${OH.price.toLocaleString()}</p>
        </div>

        {/* Fewer facts, much larger - the real Cheat Sheet has ~14 data points but at
            thumbnail/modal scale only a handful can actually be read, so this shows the four
            an agent gets asked about most, big. */}
        <div className={`mt-3 p-1 ${on('info')}`}>
        <div className="flex items-center gap-1.5 mt-1 mb-2">
          <div className="w-1 h-4 bg-[#C9A24D]" />
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-900">Property Info</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['Public Schools', 'Rose Tree Media'], ['Annual Taxes', '$32,350'], ['Sqft (Abv / Blw)', '8,120 / 2,790'], ['HOA Fee', '$200 / year']].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-gray-200 px-2.5 py-2">
              <p className="text-[8px] font-bold uppercase text-gray-400 leading-tight">{l}</p>
              <p className="text-[12px] font-black text-gray-900 leading-tight mt-1">{v}</p>
            </div>
          ))}
        </div>
        </div>

        <div className={`mt-2 flex-1 min-h-0 p-1 flex flex-col ${on('nearby')}`}>
        <div className="flex items-center gap-1.5 mt-1 mb-2">
          <div className="w-1 h-4 bg-[#C9A24D]" />
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-900">What&apos;s Nearby</p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 flex-1 min-h-0">
          {[
            ['Private School', 'Media-Providence Friends', '1.6 mi'],
            ['Hospital', 'Riddle Hospital', '1.5 mi'],
            ['Grocery', "Trader Joe's", '1.8 mi'],
            ['Park', 'Longview Park', '0.9 mi'],
          ].map(([cat, name, dist]) => (
            <div key={cat}>
              <p className="text-[8px] font-black uppercase tracking-wide text-[#8b7355]">{cat}</p>
              <p className="text-[11px] font-black text-gray-900 leading-tight mt-1">{name}</p>
              <p className="text-[9px] font-semibold text-gray-400 leading-tight">{dist}</p>
            </div>
          ))}
        </div>
        </div>
      </div>
    )
  }
  if (doc === 'Brag Sheet') {
    // Real Brag Sheet page 1 (AgentBragSheetDocument): agent header, a "Recent Sales Figures"
    // label over the real stat pills, a full-width divider, real bio, the real 3x3 Recent Sales
    // grid (all 9 real sales, city bottom-left with a pin icon, no outline per the earlier fix),
    // and the real "Peter's Agent Hub / Scan To See More From Me" QR banner.
    return (
      <div className="w-full h-full bg-white p-3 flex flex-col">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><Image src={AGENT.photo} alt={AGENT.name} fill className="object-cover object-[50%_18%]" unoptimized /></div>
            <div className="min-w-0">
              <p className="font-serif text-[11px] font-black text-gray-900 leading-none truncate">{AGENT.name}</p>
              <p className="text-[6px] text-gray-400 truncate mt-1">{AGENT.title} &middot; {AGENT.brokerage}</p>
              <p className="text-[6px] text-gray-400 truncate">{AGENT.market}</p>
            </div>
          </div>
          <div className={`flex-shrink-0 text-right p-0.5 ${on('stats')}`}>
            <p className="text-[4px] font-bold uppercase tracking-widest text-gray-400 mb-1">Recent Sales Figures</p>
            <div className="flex gap-1">
              {[[String(AGENT.stats.totalSold), 'Sold'], [AGENT.stats.totalVolume, 'Volume'], [AGENT.stats.avgPrice, 'Avg']].map(([v, l]) => (
                <div key={l} className="rounded-lg bg-[#F8F7F4] px-1.5 py-1 text-center">
                  <p className="text-[8px] font-black text-gray-900 leading-none">{v}</p>
                  <p className="text-[4.5px] font-bold uppercase text-gray-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-px bg-gray-200 mb-1.5" />
        <p className={`text-[6px] text-gray-500 leading-snug mb-1.5 ${on('bio')}`}>{AGENT.bio}</p>
        <div className={`p-0.5 ${on('sales')}`}>
        <p className="text-[6px] font-black uppercase tracking-wide text-gray-900 mb-1.5">Recent Sales</p>
        <div className="grid grid-cols-2 gap-1.5">
          {REAL_RECENT_SALES.slice(0, 4).map(s => (
            <div key={s.address} className="rounded-md overflow-hidden flex flex-col border border-gray-100">
              <div className="relative h-24 flex-shrink-0">
                <Image src={s.photo} alt={s.address} fill className="object-cover" unoptimized />
                <span className="absolute bottom-0.5 left-1 flex items-center gap-0.5 text-white text-[5px] font-black uppercase tracking-wide">
                  <MapPin className="w-[6px] h-[6px] flex-shrink-0" /> {s.city}
                </span>
              </div>
              <div className="px-1.5 py-1">
                <p className="text-[6.5px] font-black text-gray-900 leading-none">${s.price.toLocaleString()}</p>
                <p className="text-[5px] text-gray-400 truncate mt-0.5">{s.address}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
        <div className={`mt-1.5 flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-[#F8F7F4] p-2 ${on('qr')}`}>
          <MiniQr size={28} />
          <div className="min-w-0">
            <p className="text-[5px] font-black uppercase tracking-widest text-[#8b7355]">Peter's Agent Hub</p>
            <p className="text-[7.5px] font-black text-gray-900 leading-tight">Scan To See More From Me</p>
            <p className="text-[5px] text-gray-500 leading-tight mt-0.5">See all my listings, recent sales, and the easiest way to reach me.</p>
          </div>
        </div>
      </div>
    )
  }
  // Similar Homes - real Similar Properties PDF (SimilarPropertiesDocument): "Homes Similar to..."
  // header, the real 2x3 grid of all 6 comps with real match%/DOM badges, real price+address
  // overlaid on the photo (plain bold white, no outline), a "View Details" tag, a 6-stat row
  // (beds/baths/sqft/acres/$-per-sqft/built), and the real "Scan To Get Started" QR banner.
  return (
    <div className="w-full h-full bg-white p-4 flex flex-col">
      <p className="text-[10px] font-black text-gray-900 leading-tight mb-0.5">Homes Similar to <span className="text-[#8b7355]">{OH.address}</span></p>
      <div className="h-px bg-gray-200 mb-2" />
      <div className={`grid grid-cols-2 gap-1.5 ${hl === 'bottom' ? 'dn-hl dn-off' : 'dn-hl'}`}>
        {REAL_SIMILAR_HOMES.slice(0, 4).map(s => (
          <div key={s.address} className="rounded-lg overflow-hidden border border-gray-100 flex flex-col">
            <div className="relative h-28 flex-shrink-0">
              <Image src={s.photo} alt={s.address} fill className="object-cover" unoptimized />
              <span className={`absolute top-0.5 left-0.5 rounded bg-emerald-600 px-1 py-0.5 text-[4.5px] font-black text-white ${hl === 'match' ? 'dn-hl dn-on' : ''}`}>{s.match}% MATCH</span>
              <span className="absolute top-0.5 right-0.5 rounded bg-gray-800/85 px-1 py-0.5 text-[4px] font-black text-white">{s.dom} DOM</span>
              <div className="absolute bottom-0.5 left-1 right-8">
                <p className="text-white text-[7px] font-black leading-none">${s.price.toLocaleString()}</p>
                <p className="text-white/90 text-[4px] font-bold uppercase tracking-wide mt-0.5 truncate">{s.address}, {s.city}</p>
              </div>
              {/* Per-property QR - the real Similar Properties PDF prints one on every comp so a
                  visitor can scan straight through to that specific listing. */}
              <div className={`absolute bottom-0.5 right-0.5 rounded bg-white p-[1px] shadow-sm ${hl === 'homeqr' ? 'dn-hl dn-on' : ''}`}>
                <MiniQr size={16} />
              </div>
            </div>
            <div className="flex items-center justify-around px-0.5 py-0.5">
              {[[String(s.beds), 'Bd'], [String(s.baths), 'Ba'], [s.sqft.toLocaleString(), 'Sf'], ['-', 'Ac'], [`$${s.pricePerSqft}`, '/Sf'], [s.built ? String(s.built) : '-', 'Blt']].map(([v, l]) => (
                <div key={l} className="text-center">
                  <p className="text-[4.5px] font-black text-gray-900 leading-none">{v}</p>
                  <p className="text-[3px] font-bold uppercase text-gray-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-2 flex items-center gap-2 rounded-xl border border-[#E7E5E4] bg-[#F8F7F4] p-2 ${hl == null ? '' : hl === 'bottom' ? 'dn-hl dn-on' : 'dn-hl dn-off'}`}>
        <MiniQr size={26} />
        <div className="min-w-0">
          <p className="text-[5px] font-black uppercase tracking-widest text-[#8b7355]">Scan To Get Started</p>
          <p className="text-[7px] font-black text-gray-900 leading-tight">Want to see more homes like these?</p>
        </div>
      </div>
    </div>
  )
}

// Pages span the whole feature sequence: 0=title, 1=address, 2=photo/generate, 3=generating,
// 4=kit ready, 5-8=each of the 4 real documents (its zoom+open+reset beats all count as one page,
// so the bar fills continuously across the whole walkthrough of that document instead of resetting
// when it gets tapped or closed).
const KIT_TOTAL_PAGES = 5 + DOCS.length
// Deliberately excludes RESET_MS - the document itself visually finishes (closes) at the end of
// the 'open' beat, so the bar should already read 100% by then. Including the 500ms reset tail
// (the thumbnail shrinking back into the grid) made the bar keep filling for half a second after
// the document had already closed, visibly out of sync with what was actually on screen. 'reset'
// still maps to this same duration (not a shorter one) so the dependency the fill effect watches
// doesn't change between 'open' and 'reset' - the bar simply holds at 100% through the reset
// beat instead of resetting and re-filling for it.
function docPageDuration(idx: number): number {
  return ZOOM_MS + OPEN_MS[idx]
}
function kitPage(beat: Beat): { current: number; durationMs: number } {
  switch (beat.k) {
    case 'address': return { current: 1, durationMs: 1600 }
    case 'photo': case 'generate-click': return { current: 2, durationMs: 2600 + 900 }
    case 'generating': return { current: 3, durationMs: DOCS.length * 1000 }
    case 'ready': return { current: 4, durationMs: 3200 }
    case 'zoom': case 'open': case 'reset': return { current: 5 + beat.idx, durationMs: docPageDuration(beat.idx) }
    default: return { current: 0, durationMs: 0 }
  }
}

// The note beside the build steps (before the documents open).
const BUILD_NOTES: Record<'address' | 'generating' | 'ready', { icon: LucideIcon; title: string; body: string }> = {
  address: { icon: MapPin, title: 'Just type the address', body: 'We fill in the rest.' },
  generating: { icon: Sparkles, title: '4 documents, at once', body: 'All branded to you.' },
  ready: { icon: ClipboardList, title: 'Print or share', body: "Let's open each one." },
}

export default function OpenHouseKitDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const beat = BEATS[i]
  const advance = () => setI(n => (n + 1) % BEATS.length)

  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const d = beatDuration(beat)
    const t = d == null ? undefined : setTimeout(advance, d)
    return () => { if (t) clearTimeout(t); clearInterval(ticker) }
  }, [i, beat])

  if (beat.k === 'title') {
    return <TitleSlide icon={KitsIcon} kicker="Automated" title="Open House Kits" body={"Sign-In, Cheat Sheet, Brag Sheet & Similar Homes -\nfrom one address, in seconds."} ai durationMs={5200} totalPages={KIT_TOTAL_PAGES} url="app.openhousepal.com/open-houses/create" />
  }

  const isGenerating = beat.k === 'generating'
  const showGrid = beat.k === 'ready' || beat.k === 'zoom' || beat.k === 'open' || beat.k === 'reset'
  const docsChecked = isGenerating ? beat.idx : showGrid ? DOCS.length : 0
  const zoomIdx = beat.k === 'zoom' ? beat.idx : null
  const openIdx = beat.k === 'open' ? beat.idx : null
  const steps = openIdx !== null ? DOC_STEPS[DOCS[openIdx]] : []
  const stepIdx = Math.min(steps.length - 1, Math.floor((tick * 250) / STEP_MS))
  const step = steps[stepIdx]
  const buildKey = beat.k === 'address' || beat.k === 'photo' || beat.k === 'generate-click' ? 'address' : isGenerating ? 'generating' : showGrid && openIdx === null ? 'ready' : null
  const buildNote = buildKey ? BUILD_NOTES[buildKey] : null

  return (
    <BrowserFrame
      url="app.openhousepal.com/open-houses/create"
      progress={{ pages: KIT_TOTAL_PAGES, ...kitPage(beat) }}
    >
      <style>{DEMO_NOTE_CSS}</style>
      <div className={`relative flex h-[420px] items-center justify-center gap-5 overflow-hidden px-4 ${STAGE_BG}`}>
        {buildNote && buildKey && <DemoNote id={buildKey} icon={buildNote.icon} title={buildNote.title} body={buildNote.body} index={['address', 'generating', 'ready'].indexOf(buildKey)} count={3} />}
        {buildNote && <DemoCaption title={buildNote.title} body={buildNote.body} />}
        {(beat.k === 'address' || beat.k === 'photo' || beat.k === 'generate-click') && (
          // Mirrors the real Kit creator's ADDRESS step (app/open-houses/components/CreateOpenHouseWizard.tsx)
          // - gradient headline, subtext, and a pill-shaped address bar with an inline "Generate Kit"
          // button. The property photo it auto-pulls once a listing is selected appears right in this
          // same screen, not as a separate slide.
          <div key="address" className="relative w-[360px] flex-shrink-0 animate-fadeIn text-center overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.45)] dark:border-gray-800 dark:bg-[#151517] p-6">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C9A24D]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#111827]/5 dark:bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="relative text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 dark:from-white dark:via-[#C9A24D] dark:to-gray-200 mb-1.5">Create Your Open House Kit</h3>
            <p className="relative text-[10px] text-gray-400 dark:text-gray-500 mb-4 font-light">Enter a property address to instantly generate a QR code, flyer, and sign-in form.</p>
            <div className="relative flex items-center rounded-full bg-gray-50 dark:bg-[#0B0B0B] border-2 border-[#C9A24D] p-1 shadow-sm">
              <MapPin className="w-4 h-4 ml-2.5 text-[#C9A24D] flex-shrink-0" />
              <span className="flex-1 min-w-0 text-left pl-2 text-xs font-medium text-[#111827] dark:text-gray-200 truncate">
                {beat.k === 'address' ? <TypingAnimation text={`${OH.address}, ${OH.city}, ${OH.state}`} speed={55} onComplete={advance} /> : `${OH.address}, ${OH.city}, ${OH.state}`}
              </span>
              <div className={`relative flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-[#C9A24D] to-[#b8923f] text-white rounded-full font-black text-[9px] uppercase tracking-widest whitespace-nowrap shadow-sm shadow-[#C9A24D]/30 transition-transform duration-200 ${beat.k === 'generate-click' ? 'scale-90' : 'scale-100'}`}>
                Generate Kit
                {beat.k === 'generate-click' && (
                  <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10">
                    <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
                    <MousePointer2 className="relative h-3.5 w-3.5 text-[#111827] drop-shadow" fill="currentColor" />
                  </span>
                )}
              </div>
            </div>
            {beat.k !== 'address' && (
              <div className="relative mt-4 animate-fadeIn">
                <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-sm">
                  <Image src={OH.photo} alt={OH.address} fill className="object-cover" unoptimized />
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#C9A24D] flex items-center justify-center">
                    <Check className="w-3 h-3 text-[#111827]" strokeWidth={3} />
                  </div>
                  <span className="absolute bottom-2 left-2.5 text-white text-xs font-black drop-shadow">${OH.price.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {isGenerating && (
          <div key="generating" className="w-[320px] flex-shrink-0 animate-fadeIn rounded-2xl bg-white p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,.45)] dark:bg-[#151517]">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Generating your kit...</p>
            <div className="space-y-2.5">
              {DOCS.map((doc, idx) => (
                <div key={doc} className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 ${idx <= docsChecked ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-800' : 'border-gray-100 dark:border-gray-800'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${idx <= docsChecked ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700 animate-pulse'}`}>
                    {idx <= docsChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-sm font-bold ${idx <= docsChecked ? 'text-[#0B0B0B] dark:text-white' : 'text-gray-400'}`}>{DOC_LABEL[doc]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showGrid && (
          <div key="ready" className="w-[404px] flex-shrink-0 animate-fadeIn">
            {/* Same premium "moment" treatment used elsewhere (icon badge + kicker + serif
                heading) instead of one small gradient line, which read as flat/underwhelming for
                the actual payoff of the whole sequence. */}
            <div className="text-center mb-4">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#C9A24D] shadow-lg shadow-[#C9A24D]/30">
                <Check className="w-4 h-4 text-[#111827]" strokeWidth={3} />
              </div>
              <p className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">
                <Sparkles className="w-3 h-3" /> Kit Ready
              </p>
              <h4 className="font-serif text-xl font-black text-[#0B0B0B] dark:text-white mt-1">{OH.address}</h4>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DOCS.map((doc, idx) => (
                <div key={doc} className={`flex justify-center transition-all duration-500 ${openIdx === idx ? 'opacity-30 scale-90' : zoomIdx === idx ? 'scale-125 z-10' : 'opacity-100 scale-100'}`}>
                  {/* Thumbnail, the name pill, AND the arrow are all stacked in normal flow inside
                      this one THUMB_W-wide, items-center column - no absolute positioning/math for
                      the arrow at all, so it can't drift off-center or overlap the pill above it;
                      it's just the next child down, centered on the same flex axis as everything
                      else in this column. */}
                  <div className="flex flex-col items-center" style={{ width: THUMB_W }}>
                    <DocThumbnail doc={doc} />
                    <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[8px] font-bold transition-colors duration-300 ${zoomIdx === idx ? 'bg-[#C9A24D]/15 text-[#0B0B0B] dark:text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{DOC_LABEL[doc]}</span>
                    {zoomIdx === idx && (
                      <svg className="w-4 h-4 mt-1 text-[#C9A24D] animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V7m0 0l-5 5m5-5l5 5" />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {openIdx !== null && (
          // Solid opaque backdrop (not a translucent bg-black/55) - the previous dimmed overlay
          // let the 4-doc grid show through faintly behind the text next to the document, which
          // read as "see-through." A fully solid backdrop means there's nothing behind the text to
          // see, without needing a separate card/badge around the text itself.
          <div className="absolute inset-0 bg-[#0B0B0B] flex items-center justify-center gap-4 p-4 animate-fadeIn">
            {/* Doc and text pop in together on the same animation, same start time (no offset
                delay between them) - having the text arrive a beat after the document read as a
                stagger/jump instead of one smooth "this just opened" motion. */}
            <div className="rounded-xl overflow-hidden shadow-2xl ring-4 ring-white/20 flex-shrink-0 animate-doc-pop" style={{ width: DOC_W, height: DOC_H }}>
              <DocMockup doc={DOCS[openIdx]} hl={step?.hl} />
            </div>
            {/* To the right of the document, hidden on narrow viewports. Only "Sign In" gets the
                two-part "Instant Sign In / + / Auto Follow-Up" stack (matching SignInDemo, with the
                "+" centered on its own line); the other three just show the document name and the
                sentence explaining what it is. */}
            <div className="hidden min-w-[150px] max-w-[230px] shrink animate-doc-pop sm:block">
              {DOCS[openIdx] === 'Sign In' ? (
                <h4 className="text-2xl font-black leading-tight text-white">
                  <span className="block">Instant Sign In <span className="text-[#C9A24D] animate-plus-pulse">+</span></span>
                  <span className="block">{DOC_SIGNIN_BENEFIT}</span>
                </h4>
              ) : (
                <h4 className="text-2xl font-black leading-tight text-white">{DOC_LABEL[DOCS[openIdx]]}</h4>
              )}
              {step && (
                <div key={`${openIdx}-${stepIdx}`} className="dn-rise mt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">{step.title}</p>
                  <p className="mt-1.5 text-sm text-gray-300 leading-relaxed">{step.body}</p>
                  {DOCS[openIdx] === 'Sign In' && stepIdx === 2 && <p className="dn-pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[11px] font-black text-[#e8c97a]"><UserPlus className="h-3.5 w-3.5" /> Added to Leads · follow-up set</p>}
                </div>
              )}
              <div className="mt-4 flex gap-1">{steps.map((_, k) => <span key={k} className={`h-1 rounded-full transition-all duration-500 ${k === stepIdx ? 'w-5 bg-[#C9A24D]' : 'w-1.5 bg-[#C9A24D]/30'}`} />)}</div>
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
