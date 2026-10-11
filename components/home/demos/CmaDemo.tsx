'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Sparkles, Check, Calculator, ScanLine, MapPin, ShieldCheck, MousePointer2, Search, DollarSign, Share2, FileText } from 'lucide-react'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import TypingAnimation from '@/components/TypingAnimation'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { AGENT, REAL_CMA } from './realData'

// A literal, unhurried recreation of the real agent-facing CMA tool (app/studio/cma/[id]/page.tsx)
// using the user's own real, AI-generated, publicly-shared report (openhousepal.com/cma/npggb91tvk -
// buyer-mode, subject 847 Lesley Rd, Villanova) instead of an invented example: "New CMA" intake ->
// the 5-step stepper -> Property Selection with the exact real CompCandidateCard markup (big
// photo, pill match-score/status badges, white school pill, fact-chip grid, Add/Added button) ->
// the real "AI Comp Analysis" progress copy, the AI visibly writing real commentary per comp with a
// live Strength & Quality scale (matching the real public report's ComparableQualitySection) ->
// Review -> the real PUBLIC REPORT SITE (app/cma/[slug]/page.tsx, not the PDF) opening and
// scrolling through its actual section order with the same real figures.
const ADDED_COMPS = REAL_CMA.comps.filter(c => c.strength !== 'weak')
const STRENGTH_LABEL: Record<string, string> = { strong: 'Strong Comp', supporting: 'Supporting Comp', weak: 'Weaker Comp' }
const STRENGTH_HEX: Record<string, string> = { strong: 'bg-emerald-600', supporting: 'bg-[#C9A24D] text-[#111827]', weak: 'bg-gray-500' }

// Prices in this data run $1.3M-$3.75M - formatting them as "/1000" ("3750K") reads as a bug, so
// anything at or above $1M renders as "$X.XXM" (trailing zeros trimmed) matching how the real app
// and public report format money, and anything below stays "$XXXK".
function formatPrice(price: number): string {
  if (price >= 1000000) {
    const millions = Math.round((price / 1000000) * 100) / 100
    return `$${millions}M`
  }
  return `$${Math.round(price / 1000)}K`
}

// Full, unabbreviated figure ($3,200,000, not $3.2M) - explicit ask for the Agent Final Analysis
// section specifically, where the real page's own headline value and offer range are never
// abbreviated either.
function formatPriceFull(price: number): string {
  return `$${Math.round(price).toLocaleString()}`
}

// Exactly mirrors TypingAnimation's own completion timing (interval fires (text.length + 1) times
// at `speed` ms, then a fixed 500ms pause before onComplete) so every page's assumed durationMs
// matches the real elapsed time to the millisecond instead of a rough guess - a mismatch here is
// what caused the top progress bar to visibly jump/skip at page transitions.
const typingMs = (text: string, speed: number) => (text.length + 1) * speed + 500

// The real public report's ComparableQualitySection scale (lib/cma.ts QUALITY_TIER_HEX /
// STRENGTH_TIER_HEX) - below/above are both red (either direction is a real difference from the
// subject), only the center tier reads as a true match.
type QTier = 'below' | 'similar' | 'above'
type ATier = 'different_from_subject' | 'same_as_subject' | 'similar_to_subject'
const QUALITY_TIER_HEX: Record<string, { bg: string; text: string }> = {
  below: { bg: '#FEE2E2', text: '#B91C1C' },
  similar: { bg: '#D1FAE5', text: '#047857' },
  above: { bg: '#FEE2E2', text: '#B91C1C' },
  different_from_subject: { bg: '#FEE2E2', text: '#B91C1C' },
  same_as_subject: { bg: '#D1FAE5', text: '#047857' },
  similar_to_subject: { bg: '#FEE2E2', text: '#B91C1C' },
}
const QUALITY_LABEL: Record<string, string> = { below: 'Comp Inferior', similar: 'Similar', above: 'Comp Superior', different_from_subject: 'Different Area', same_as_subject: 'Same Market', similar_to_subject: 'Similar Area' }

// Plausible per-comp quality ratings consistent with each comp's real note (e.g. 112 Dovecote Ln's
// note says "2021 new construction" -> finish/interior/exterior all rate "Above", a real
// difference from the 1929 subject even though it's a nicer difference).
const COMP_QUALITY: Record<string, { finish_quality: QTier; interior: QTier; exterior: QTier; lot: QTier; amenities: QTier; area: ATier }> = {
  '201 S Spring Mill Rd': { finish_quality: 'similar', interior: 'similar', exterior: 'similar', lot: 'above', amenities: 'similar', area: 'same_as_subject' },
  '112 Dovecote Ln': { finish_quality: 'above', interior: 'above', exterior: 'above', lot: 'similar', amenities: 'above', area: 'same_as_subject' },
  '228 S Radnor Chester Rd': { finish_quality: 'below', interior: 'below', exterior: 'below', lot: 'above', amenities: 'below', area: 'same_as_subject' },
}

// The cursor + tap-ring pulse used on every clickable option/button in this walkthrough, so each
// selection reads as an actual click happening rather than the option just appearing selected.
function ClickCursor() {
  return (
    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10">
      <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
      <MousePointer2 className="relative h-3.5 w-3.5 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
    </span>
  )
}

function QualityRow({ label, tier, idx }: { label: string; tier: QTier | ATier; idx: number }) {
  const hex = QUALITY_TIER_HEX[tier]
  return (
    <div className="flex items-center gap-1.5 animate-fadeIn" style={{ animationDelay: `${idx * 110}ms`, animationFillMode: 'backwards' }}>
      <span className="w-11 flex-shrink-0 text-[6px] font-black uppercase tracking-wide text-gray-400">{label}</span>
      <span className="rounded px-1 py-0.5 text-[6px] font-black uppercase" style={{ backgroundColor: hex.bg, color: hex.text }}>{QUALITY_LABEL[tier]}</span>
    </div>
  )
}

// The three sub-stages the AI visibly moves through on each comp's own photo, in order, before
// moving to the next comp - makes what "AI Comp Analysis" is actually doing legible instead of
// a single generic progress bar with no visual tie back to any specific comp.
const SCAN_STAGE_LABELS = ['Scanning photos...', 'Reading listing data...', 'Comparing to subject...']
const SCAN_STAGE_MS = 700
const SCAN_TOTAL_MS = ADDED_COMPS.length * SCAN_STAGE_LABELS.length * SCAN_STAGE_MS
const CALCULATING_MS = 1200

// The real ComparableSection card, one per added comp - a correctly-proportioned (4:3, matching
// actual Bright MLS photo dimensions) but contained photo beside the facts, not a full-width
// banner blown up so large it overlapped the stats/quality rows below it - then the same Strength
// & Quality scale shown live during the AI-writing beat, then the note.
function CompReportCard({ comp, index }: { comp: (typeof ADDED_COMPS)[number]; index: number }) {
  const q = COMP_QUALITY[comp.address]
  const psf = Math.round(comp.price / comp.sqft)
  return (
    <div className="px-4 pt-4">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] mb-0.5">The Evidence</p>
      <p className="font-serif text-sm font-black text-[#0B0B0B] dark:text-white mb-2">Individual Comparable Analysis</p>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="rounded bg-[#111827] px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-wide text-white">Comp #{index + 1}</span>
          <span className={`rounded px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-wide text-white ${STRENGTH_HEX[comp.strength]}`}>{STRENGTH_LABEL[comp.strength]}</span>
        </div>
        <div className="flex gap-2 mb-2">
          <div className="relative w-20 h-[60px] flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={comp.photo} alt={comp.address} fill className="object-cover" unoptimized />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-black text-[#0B0B0B] dark:text-white truncate">{comp.address}</p>
              <span className="flex-shrink-0 text-[9px] font-black text-[#8b7355] dark:text-[#d7b974]">{formatPrice(comp.price)}</span>
            </div>
            <p className="text-[7.5px] text-gray-400 mt-0.5 leading-snug">{comp.beds}bd &middot; {comp.baths}ba &middot; {comp.sqft.toLocaleString()}sf</p>
            <p className="text-[7.5px] text-gray-400 leading-snug">${psf}/sqft &middot; {comp.distance}</p>
          </div>
        </div>
        {q && (
          <div className="rounded-lg bg-[#fbfaf7] dark:bg-[#0B0B0B] p-2 mb-2">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <QualityRow label="Finish" tier={q.finish_quality} idx={0} />
              <QualityRow label="Interior" tier={q.interior} idx={1} />
              <QualityRow label="Exterior" tier={q.exterior} idx={2} />
              <QualityRow label="Lot" tier={q.lot} idx={3} />
              <QualityRow label="Amenities" tier={q.amenities} idx={4} />
              <QualityRow label="Area" tier={q.area} idx={5} />
            </div>
          </div>
        )}
        {/* Boxed "Comparable Analysis" note, matching the real public report's own note treatment
            exactly (app/[slug]/blogs.../ComparableSection - a labeled card, not a bare paragraph). */}
        <div className="rounded-lg bg-[#fbfaf7] dark:bg-[#0B0B0B] p-2">
          <p className="mb-1 text-[6.5px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Comparable Analysis</p>
          <p className="text-[8px] text-gray-600 dark:text-gray-300 leading-relaxed">{comp.note}</p>
        </div>
      </div>
    </div>
  )
}

// Section order/content lifted straight from the real public report page (app/cma/[slug]/page.tsx):
// dark cover header -> Subject Property hero -> Location Context -> one Individual Comparable
// Analysis card PER added comp (all 3, not just the first) -> Comparable Overview table -> Market
// Analysis -> Agent Final Analysis -> agent footer. Every section the real report can show gets a
// slice here (not every row/detail inside each one - just the section itself), so nothing that a
// real visitor would see is entirely missing from the walkthrough. Heights/durations are
// per-section (not uniform) so denser sections get proportionally more read time.
const REPORT_HEIGHTS = [165, 340, 250, 300, 300, 300, 300, 360, 300, 320]
const REPORT_DURS = [2000, 2400, 2600, 2800, 2800, 2800, 2600, 3000, 3000, 5400]
const REPORT_SECTIONS = REPORT_HEIGHTS.length
const REPORT_OFFSETS = REPORT_HEIGHTS.reduce<number[]>((acc, h, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + REPORT_HEIGHTS[i - 1]); return acc }, [])

type Beat =
  | { k: 'title' }
  | { k: 'modal-name' } | { k: 'modal-toggle' } | { k: 'modal-continue' }
  | { k: 'subject-search' } | { k: 'subject-results' } | { k: 'subject-pick' } | { k: 'subject-selected' } | { k: 'subject-continue' }
  | { k: 'comp'; idx: number; scored: boolean } | { k: 'comps-continue' }
  | { k: 'analysis-cta' } | { k: 'analysis-click' } | { k: 'scan'; compIdx: number; stage: number } | { k: 'calculating' } | { k: 'analysis-done' }
  | { k: 'writing'; idx: number; scoring: boolean }
  | { k: 'pricing-value' } | { k: 'review' } | { k: 'review-share' } | { k: 'opening-report' }
  | { k: 'report'; section: number }

const BEATS: Beat[] = [
  { k: 'title' },
  { k: 'modal-name' }, { k: 'modal-toggle' }, { k: 'modal-continue' },
  { k: 'subject-search' }, { k: 'subject-results' }, { k: 'subject-pick' }, { k: 'subject-selected' }, { k: 'subject-continue' },
  ...REAL_CMA.comps.flatMap((_, idx) => [{ k: 'comp' as const, idx, scored: false }, { k: 'comp' as const, idx, scored: true }]),
  { k: 'comps-continue' },
  { k: 'analysis-cta' }, { k: 'analysis-click' },
  ...ADDED_COMPS.flatMap((_, compIdx) => SCAN_STAGE_LABELS.map((_, stage) => ({ k: 'scan' as const, compIdx, stage }))),
  { k: 'calculating' },
  ...ADDED_COMPS.flatMap((_, idx) => [{ k: 'writing' as const, idx, scoring: true }, { k: 'writing' as const, idx, scoring: false }]),
  { k: 'analysis-done' },
  { k: 'pricing-value' }, { k: 'review' }, { k: 'review-share' }, { k: 'opening-report' },
  ...Array.from({ length: REPORT_SECTIONS }, (_, section) => ({ k: 'report' as const, section })),
]

const MODAL_NAME_MS = typingMs(REAL_CMA.clientName, 80)
const SUBJECT_ADDR_STR = `${REAL_CMA.subject.address}, ${REAL_CMA.subject.city}, ${REAL_CMA.subject.state}`
// Real address-autocomplete flow: type a PARTIAL query, get a dropdown of matches, click one.
const SUBJECT_PARTIAL = REAL_CMA.subject.address.replace(/(\d+)\s+(\w{3}).*/, '$1 $2') // "847 Les"
const SUBJECT_SUGGESTIONS = [
  { line1: REAL_CMA.subject.address, line2: `${REAL_CMA.subject.city}, ${REAL_CMA.subject.state} 19085`, match: true },
  { line1: '845 Lesley Rd', line2: 'Villanova, PA 19085', match: false },
  { line1: '12 Lesley Ln', line2: 'Bryn Mawr, PA 19010', match: false },
]
const SUBJECT_SEARCH_MS = typingMs(SUBJECT_PARTIAL, 90)
const WRITING_TOTAL_MS = ADDED_COMPS.reduce((sum, c) => sum + 750 + typingMs(c.note, 14), 0)
const REPORT_TOTAL_MS = REPORT_DURS.reduce((a, b) => a + b, 0)

function beatDuration(beat: Beat): number | null {
  switch (beat.k) {
    case 'title': return 5400
    case 'modal-name': return null
    case 'modal-toggle': return 900
    case 'modal-continue': return 650
    case 'subject-search': return null
    case 'subject-results': return 2200
    case 'subject-pick': return 700
    case 'subject-selected': return 3000
    case 'subject-continue': return 700
    case 'comp': return beat.scored ? 1100 : 750
    case 'comps-continue': return 650
    case 'analysis-cta': return 1300
    case 'analysis-click': return 650
    case 'scan': return SCAN_STAGE_MS
    case 'calculating': return CALCULATING_MS
    case 'writing': return beat.scoring ? 750 : null
    case 'analysis-done': return 2000
    case 'pricing-value': return 2400
    case 'review': return 2600
    case 'review-share': return 700
    case 'opening-report': return 1100
    case 'report': return REPORT_DURS[beat.section]
  }
}

// Pages span the whole feature sequence: 0=title, 1=New CMA modal, 2=Subject, 3=Comps (all 5),
// 4=AI Analysis, 5=AI writing the comp notes, 6=Pricing, 7=Review, 8=the shared client report.
const CMA_TOTAL_PAGES = 9
function cmaPage(beat: Beat): { current: number; durationMs: number } {
  switch (beat.k) {
    case 'modal-name': case 'modal-toggle': case 'modal-continue':
      return { current: 1, durationMs: MODAL_NAME_MS + 900 + 650 }
    case 'subject-search': case 'subject-results': case 'subject-pick': case 'subject-selected': case 'subject-continue':
      return { current: 2, durationMs: SUBJECT_SEARCH_MS + 1600 + 700 + 2400 + 700 }
    case 'comp': case 'comps-continue':
      return { current: 3, durationMs: REAL_CMA.comps.length * (750 + 1100) + 650 }
    case 'analysis-cta': case 'analysis-click': case 'scan': case 'calculating': case 'analysis-done':
      return { current: 4, durationMs: 1300 + 650 + SCAN_TOTAL_MS + CALCULATING_MS + 1400 }
    case 'writing':
      return { current: 5, durationMs: WRITING_TOTAL_MS }
    case 'pricing-value':
      return { current: 6, durationMs: 1500 }
    case 'review': case 'review-share': case 'opening-report':
      return { current: 7, durationMs: 2500 + 1100 }
    case 'report':
      return { current: 8, durationMs: REPORT_TOTAL_MS }
    default:
      return { current: 0, durationMs: 0 }
  }
}

// What's happening, in a few words - a strip along the top (it replaces the app's own stepper).
const CAPTIONS = [
  { icon: Search, title: 'Start with the home', body: 'Type the address.' },
  { icon: MapPin, title: 'Comps, found for you', body: 'The closest matches, picked automatically.' },
  { icon: Sparkles, title: 'AI studies every comp', body: 'Photos, details and price.' },
  { icon: DollarSign, title: 'Your price range', body: 'Backed by the comps.' },
  { icon: Share2, title: 'Share it', body: 'One link, branded to you.' },
  { icon: FileText, title: "Your client's report", body: 'A web page and a PDF.' },
]
function captionFor(k: Beat['k']): number {
  if (k.startsWith('modal') || k.startsWith('subject')) return 0
  if (k === 'comp' || k === 'comps-continue') return 1
  if (k === 'pricing-value') return 3
  if (k === 'review' || k === 'review-share' || k === 'opening-report') return 4
  if (k === 'report') return 5
  return 2
}

export default function CmaDemo() {
  const [i, setI] = useState(0)
  const beat = BEATS[i]
  const advance = () => setI(n => (n + 1) % BEATS.length)

  useEffect(() => {
    const duration = beatDuration(beat)
    if (duration == null) return
    const t = setTimeout(advance, duration)
    return () => clearTimeout(t)
  }, [i, beat])

  if (beat.k === 'title') {
    return <TitleSlide icon={Calculator} kicker="Pricing" title="CMA Builder" body="Comps, valuation & a branded report - created instantly." nowrapBody ai durationMs={5400} totalPages={CMA_TOTAL_PAGES} url="app.openhousepal.com/studio/cma/new" />
  }

  const isReport = beat.k === 'report'
  const isCompPhase = beat.k === 'comp' || beat.k === 'comps-continue'
  const activeCompIdx = beat.k === 'comp' ? beat.idx : REAL_CMA.comps.length - 1
  const activeComp = REAL_CMA.comps[activeCompIdx]
  const scored = beat.k === 'comp' ? beat.scored : true
  const added = activeComp.strength !== 'weak'

  return (
    <BrowserFrame
      url={isReport ? `openhousepal.com/cma/${REAL_CMA.shareSlug}` : 'app.openhousepal.com/studio/cma/new'}
      progress={{ pages: CMA_TOTAL_PAGES, ...cmaPage(beat) }}
    >
      <style>{DEMO_NOTE_CSS}</style>
      <div className="relative h-[420px] flex flex-col pt-[56px]">
        {(() => { const c = captionFor(beat.k); return <DemoStep id={String(c)} step={c + 1} count={CAPTIONS.length} title={CAPTIONS[c].title} body={CAPTIONS[c].body} icon={CAPTIONS[c].icon} /> })()}

        <div className={`flex-1 ${isReport ? '' : 'p-5 flex items-center justify-center'} overflow-hidden`}>
          {(beat.k === 'modal-name' || beat.k === 'modal-toggle' || beat.k === 'modal-continue') && (
            <div key="modal" className="w-full max-w-[280px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 shadow-lg animate-fadeIn">
              <p className="text-xs font-black text-[#0B0B0B] dark:text-white mb-0.5">New CMA</p>
              <p className="text-[9px] text-gray-400 mb-3">You'll pick the subject property next.</p>
              <label className="block text-[8.5px] font-bold text-gray-400 uppercase tracking-wide mb-1">Client Name</label>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-2 mb-3 text-[10px] font-medium text-[#111827] dark:text-gray-200">
                {beat.k === 'modal-name' ? <TypingAnimation text={REAL_CMA.clientName} speed={80} onComplete={advance} /> : REAL_CMA.clientName}
              </div>
              <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">This CMA is for a...</p>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="rounded-lg border-2 border-gray-200 dark:border-gray-700 py-1.5 text-center text-[9px] font-black text-gray-400">Seller / Listing</div>
                <div className={`relative rounded-lg border-2 py-1.5 text-center text-[9px] font-black transition-all duration-300 ${beat.k !== 'modal-name' ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#0B0B0B] dark:text-white' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                  Buyer / Offer
                  {beat.k === 'modal-toggle' && <ClickCursor />}
                </div>
              </div>
              <div className={`relative w-full text-center rounded-lg py-2 text-[9px] font-black bg-[#111827] dark:bg-white text-white dark:text-[#111827] transition-transform duration-200 ${beat.k === 'modal-continue' ? 'scale-95' : 'scale-100'}`}>
                Continue to Subject Property
                {beat.k === 'modal-continue' && <ClickCursor />}
              </div>
            </div>
          )}

          {(beat.k === 'subject-search' || beat.k === 'subject-results' || beat.k === 'subject-pick' || beat.k === 'subject-selected' || beat.k === 'subject-continue') && (() => {
            const typing = beat.k === 'subject-search'
            const showResults = beat.k === 'subject-results' || beat.k === 'subject-pick'
            const selected = beat.k === 'subject-selected' || beat.k === 'subject-continue'
            const s = REAL_CMA.subject
            return (
              <div key="subject" className="w-full max-w-[300px] animate-fadeIn">
                <div className="flex gap-1 mb-3 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                  {['Search Address', 'My Listings', 'Enter Manually'].map((opt, idx) => (
                    <div key={opt} className={`flex-1 text-center py-1.5 rounded-md text-[7.5px] font-black ${idx === 0 ? 'bg-white dark:bg-[#151517] text-[#0B0B0B] dark:text-white shadow-sm' : 'text-gray-400'}`}>{opt}</div>
                  ))}
                </div>

                {/* Search field with a real magnifying-glass + autocomplete dropdown. */}
                <div className="relative">
                  <div className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-[10px] font-medium bg-white dark:bg-[#151517] ${selected ? 'border-emerald-400' : 'border-[#C9A24D]'}`}>
                    <svg className="h-3 w-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
                    <span className="min-w-0 flex-1 truncate text-[#111827] dark:text-gray-200">
                      {typing
                        ? <TypingAnimation text={SUBJECT_PARTIAL} speed={90} onComplete={advance} />
                        : selected ? SUBJECT_ADDR_STR : SUBJECT_PARTIAL}
                    </span>
                    {selected && <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={3} />}
                  </div>

                  {showResults && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-[#151517] animate-fadeIn">
                      {SUBJECT_SUGGESTIONS.map((sug, idx) => (
                        <div
                          key={sug.line1}
                          className={`relative flex items-center gap-2 px-2.5 py-2 transition-colors ${
                            idx === 0 && beat.k === 'subject-pick'
                              ? 'bg-[#C9A24D]/20'
                              : idx === 0
                                ? 'bg-[#C9A24D]/8'
                                : ''
                          } ${idx < SUBJECT_SUGGESTIONS.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
                        >
                          <svg className="h-3 w-3 shrink-0 text-[#C9A24D]" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" /></svg>
                          <div className="min-w-0">
                            <p className="truncate text-[9px] font-bold text-[#0B0B0B] dark:text-white">{sug.line1}</p>
                            <p className="truncate text-[8px] text-gray-400">{sug.line2}</p>
                          </div>
                          {sug.match && <span className="ml-auto shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[6px] font-black uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">MLS Match</span>}
                          {idx === 0 && beat.k === 'subject-pick' && <ClickCursor />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected-property detail card - full facts, like the real "selected subject" state. */}
                {selected && (
                  <div className="mt-2.5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] animate-fadeIn">
                    <div className="relative h-24">
                      <Image src={s.photo} alt={s.address} fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute left-2 top-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[6.5px] font-black uppercase text-white">Active Listing</span>
                      <p className="absolute bottom-1.5 left-2.5 font-serif text-sm font-black text-white">{formatPrice(s.price)}</p>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[10px] font-black text-[#0B0B0B] dark:text-white">{s.address}</p>
                      <p className="text-[8px] text-gray-400">{s.city}, {s.state}</p>
                      <div className="mt-1.5 grid grid-cols-4 gap-1 border-t border-gray-100 pt-1.5 dark:border-gray-800">
                        {[[String(s.beds), 'Bd'], [String(s.baths), 'Ba'], [s.sqft.toLocaleString(), 'Sqft'], [String(s.yearBuilt), 'Built']].map(([v, l]) => (
                          <div key={l} className="text-center">
                            <p className="text-[9px] font-black text-[#0B0B0B] dark:text-white leading-none">{v}</p>
                            <p className="text-[5.5px] font-bold uppercase text-gray-400 mt-0.5">{l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className={`relative mt-2.5 w-full rounded-lg py-2 text-center text-[9px] font-black text-white dark:text-[#111827] transition-all duration-200 ${selected ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'} ${beat.k === 'subject-continue' ? 'scale-95' : 'scale-100'}`}>
                  Find Comparables
                  {beat.k === 'subject-continue' && <ClickCursor />}
                </div>
              </div>
            )
          })()}

          {isCompPhase && (
            <div key="comps" className="w-full h-full flex flex-col animate-fadeIn">
              <p className="text-[9.5px] font-bold text-gray-400 mb-2">Top matches auto-selected (70%+) as each one is found - add or remove as you see fit.</p>
              {/* Exact real CompCandidateCard markup (app/studio/cma/[id]/page.tsx) shrunk into a
                  grid that all stays on screen at once, so every comp pops in one-by-one in
                  place rather than paging through a single big card - showing the whole scoring
                  process across all 5 comps together instead of hiding it behind a carousel. */}
              <div className="flex-1 grid grid-cols-2 gap-2 content-start">
                {REAL_CMA.comps.map((c, idx) => {
                  const isRevealed = idx <= activeCompIdx
                  const isActive = idx === activeCompIdx
                  const cardScored = isActive ? scored : true
                  const cardAdded = c.strength !== 'weak'
                  return (
                    <div key={c.address} className={`rounded-xl border-2 p-2 flex items-center gap-2 transition-all duration-500 ${!isRevealed ? 'opacity-0 scale-95' : cardScored && cardAdded ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5 opacity-100 scale-100' : 'border-gray-100 dark:border-gray-800 opacity-100 scale-100'}`}>
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                        {isRevealed && <Image src={c.photo} alt={c.address} fill className="object-cover" unoptimized />}
                        {isRevealed && cardScored && (
                          <span className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[7px] font-black text-white shadow ${c.score >= 70 ? 'bg-emerald-600' : 'bg-gray-500'}`}>{c.score}%</span>
                        )}
                        {isRevealed && cardScored && cardAdded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/20">
                            <div className="rounded-full bg-emerald-600 p-1 text-white shadow"><Check className="h-2.5 w-2.5" /></div>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="min-w-0 truncate text-[9.5px] font-black text-[#111827] dark:text-white">{c.address}</p>
                          <span className="shrink-0 text-[9.5px] font-black text-[#8b7355] dark:text-[#d7b974]">{formatPrice(c.price)}</span>
                        </div>
                        <p className="text-[7.5px] text-gray-400">{c.beds}bd &middot; {c.baths}ba &middot; {c.sqft.toLocaleString()}sf</p>
                        {isRevealed && !cardScored ? (
                          <div className="mt-1 h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div className="h-1 w-2/3 rounded-full bg-[#C9A24D] animate-pulse" />
                          </div>
                        ) : isRevealed ? (
                          <span className={`mt-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[6.5px] font-black uppercase ${cardAdded ? 'bg-emerald-600 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                            {cardAdded ? <><Check className="h-2 w-2" /> Added</> : 'Not Added'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={`relative w-full text-center rounded-lg py-2.5 text-[9.5px] font-black bg-[#111827] dark:bg-white text-white dark:text-[#111827] mt-2.5 transition-transform duration-200 ${beat.k === 'comps-continue' ? 'scale-95' : 'scale-100'}`}>
                Continue
                {beat.k === 'comps-continue' && <ClickCursor />}
              </div>
            </div>
          )}

          {(beat.k === 'analysis-cta' || beat.k === 'analysis-click' || beat.k === 'scan' || beat.k === 'calculating' || beat.k === 'analysis-done') && (() => {
            const showButton = beat.k === 'analysis-cta' || beat.k === 'analysis-click'
            const showScan = beat.k === 'scan'
            const scanComp = beat.k === 'scan' ? ADDED_COMPS[beat.compIdx] : null
            const scanLabel = beat.k === 'scan' ? SCAN_STAGE_LABELS[beat.stage] : ''
            const pct = beat.k === 'analysis-done' ? 100 : 92
            return (
              <div key="analysis" className="w-full max-w-[300px] animate-fadeIn">
                <div className={`rounded-xl border-2 p-4 transition-colors duration-500 ${beat.k === 'analysis-done' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' : 'border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/10 to-transparent'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {beat.k === 'analysis-done' ? <Check className="w-4 h-4 text-emerald-600" /> : <Sparkles className="w-4 h-4 text-[#8b7355] dark:text-[#C9A24D]" />}
                    <span className="text-xs font-black text-[#0B0B0B] dark:text-white">{beat.k === 'analysis-done' ? 'AI Analysis Generated' : 'AI Comp Analysis'}</span>
                  </div>
                  {/* Every state (button / per-comp scan / calculating bar) always sits in the DOM,
                      stacked in a fixed-height box and crossfaded via opacity, so a beat change
                      never cuts straight to a completely different layout with no transition. */}
                  <div className="relative min-h-[150px]">
                    <div className={`absolute inset-0 flex flex-col justify-center transition-opacity duration-300 ${showButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-3 leading-snug">Reads every comp's photos and data, rates strength/quality, and proposes a value estimate.</p>
                      <div className={`relative w-full text-center rounded-lg py-2 text-[9px] font-black bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] transition-transform duration-200 ${beat.k === 'analysis-click' ? 'scale-95' : 'scale-100'}`}>
                        {beat.k === 'analysis-click' ? 'Analyzing...' : 'Create AI Analysis'}
                        {beat.k === 'analysis-click' && <ClickCursor />}
                      </div>
                    </div>
                    {/* Scans each comp's own photo in turn - a sweeping highlight + scan icon over
                        the actual listing photo, cycling through Scanning photos -> Reading
                        listing data -> Comparing to subject before moving to the next comp - so
                        what the AI is doing reads as real per-property work, not one generic bar. */}
                    <div className={`absolute inset-0 transition-opacity duration-300 delay-150 ${showScan ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      {scanComp && (
                        <>
                          {/* Correct Bright MLS-style 4:3 ratio (144x108), not a full-width short
                              banner that read as far too wide for a listing photo. */}
                          <div className="relative w-36 h-28 mx-auto rounded-lg overflow-hidden mb-1.5">
                            <Image src={scanComp.photo} alt={scanComp.address} fill className="object-cover" unoptimized />
                            <div className="absolute inset-0 bg-black/35" />
                            <div key={`${beat.k === 'scan' ? beat.compIdx : 0}-${beat.k === 'scan' ? beat.stage : 0}`} className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-[#C9A24D]/85 to-transparent animate-scan-line" />
                            <ScanLine className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-white drop-shadow" />
                            <p className="absolute bottom-1 left-1.5 right-1.5 truncate text-[7px] font-black text-white text-center">{scanComp.address}</p>
                          </div>
                          <p className="text-center text-[9px] font-bold text-[#8b7355] dark:text-[#C9A24D]">{scanLabel}</p>
                        </>
                      )}
                    </div>
                    <div className={`absolute inset-0 flex flex-col justify-center transition-opacity duration-300 delay-150 ${beat.k === 'calculating' || beat.k === 'analysis-done' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <div className="w-full h-1.5 rounded-full bg-white/60 dark:bg-black/30 mb-2 overflow-hidden">
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${beat.k === 'analysis-done' ? 'bg-emerald-500' : 'bg-[#C9A24D]'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={`text-[9px] font-bold text-center ${beat.k === 'analysis-done' ? 'text-emerald-600' : 'text-[#8b7355] dark:text-[#C9A24D]'}`}>{beat.k === 'analysis-done' ? 'Analysis complete!' : 'Calculating estimate...'} &middot; {pct}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {beat.k === 'writing' && (() => {
            const comp = ADDED_COMPS[beat.idx]
            const q = COMP_QUALITY[comp.address]
            return (
              <div key="writing" className="w-full max-w-[300px] animate-fadeIn">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#C9A24D] mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> {beat.scoring ? 'Scoring this property...' : 'Writing comp analysis...'}</p>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={comp.photo} alt={comp.address} fill className="object-cover" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-[#0B0B0B] dark:text-white truncate">{comp.address}</p>
                      {beat.scoring ? (
                        <div className="mt-1 h-1 w-3/4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-1 w-2/3 rounded-full bg-[#C9A24D] animate-pulse" />
                        </div>
                      ) : (
                        <p className="text-[9px] text-gray-400">{formatPrice(comp.price)} &middot; {comp.score}% Match</p>
                      )}
                    </div>
                    {!beat.scoring && (
                      <span className={`flex-shrink-0 rounded px-1.5 py-1 text-[7px] font-black uppercase text-white ${STRENGTH_HEX[comp.strength]}`}>{STRENGTH_LABEL[comp.strength]}</span>
                    )}
                  </div>
                  {!beat.scoring && (
                    <div className="p-2.5">
                      <span className="inline-block mb-1 rounded-full bg-[#C9A24D]/15 px-1.5 py-0.5 text-[6.5px] font-black uppercase text-[#8b7355] dark:text-[#C9A24D]">&#10024; AI Generated</span>
                      <p className="text-[9px] text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
                        <TypingAnimation text={comp.note} speed={14} onComplete={advance} />
                      </p>
                      {q && (
                        <div className="rounded-lg bg-[#fbfaf7] dark:bg-[#0B0B0B] p-2">
                          <p className="text-[6px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974] mb-1.5">Compared With the Subject</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                            <QualityRow label="Finish" tier={q.finish_quality} idx={0} />
                            <QualityRow label="Interior" tier={q.interior} idx={1} />
                            <QualityRow label="Exterior" tier={q.exterior} idx={2} />
                            <QualityRow label="Lot" tier={q.lot} idx={3} />
                            <QualityRow label="Amenities" tier={q.amenities} idx={4} />
                            <QualityRow label="Area" tier={q.area} idx={5} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {beat.k === 'pricing-value' && (
            <div key="pricing" className="w-full max-w-[280px] text-center animate-fadeIn">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Pricing Conclusion</p>
              <div className="rounded-xl bg-[#111827] px-5 py-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Suggested Offer Range</p>
                <p className="text-lg font-black text-[#C9A24D]">{formatPrice(REAL_CMA.suggestedOfferMin)} &ndash; {formatPrice(REAL_CMA.suggestedOfferMax)}</p>
              </div>
            </div>
          )}

          {(beat.k === 'review' || beat.k === 'review-share') && (
            <div key="review" className="w-full max-w-[300px] animate-fadeIn">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Final Review</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-3 mb-3">
                <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={REAL_CMA.subject.photo} alt={REAL_CMA.subject.address} fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-[#0B0B0B] dark:text-white truncate">{REAL_CMA.subject.address}</p>
                    <p className="text-[8px] text-gray-400">Prepared for {REAL_CMA.clientName} &middot; Buyer / Offer</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-xs font-black text-[#0B0B0B] dark:text-white">{ADDED_COMPS.length} of {REAL_CMA.comps.length}</p>
                    <p className="text-[6.5px] font-bold text-gray-400 uppercase">Comps Included</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#8b7355] dark:text-[#C9A24D]">{formatPrice(REAL_CMA.suggestedOfferMin)}&ndash;{formatPrice(REAL_CMA.suggestedOfferMax)}</p>
                    <p className="text-[6.5px] font-bold text-gray-400 uppercase">Suggested Offer</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border-2 border-gray-200 dark:border-gray-700 py-2 text-[9px] font-black text-gray-400 text-center">Mark Ready</div>
                <div className={`relative flex-1 rounded-lg py-2 text-[9px] font-black bg-[#C9A24D] text-[#111827] text-center transition-transform duration-200 ${beat.k === 'review-share' ? 'scale-95' : 'scale-100'}`}>
                  Share Link
                  {beat.k === 'review-share' && <ClickCursor />}
                </div>
              </div>
            </div>
          )}

          {beat.k === 'opening-report' && (
            <div key="opening-report" className="flex flex-col items-center justify-center gap-3 animate-fadeIn">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-[#C9A24D]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C9A24D] animate-spin" />
              </div>
              <p className="text-xs font-bold text-[#0B0B0B] dark:text-white">Opening shared report...</p>
            </div>
          )}

          {isReport && beat.k === 'report' && (() => {
            const subjPsf = Math.round(REAL_CMA.subject.price / REAL_CMA.subject.sqft)
            const compPrices = ADDED_COMPS.map(c => c.price)
            const compPsfs = ADDED_COMPS.map(c => Math.round(c.price / c.sqft))
            const saleMin = Math.min(...compPrices), saleMax = Math.max(...compPrices)
            const saleAvg = Math.round(compPrices.reduce((a, b) => a + b, 0) / compPrices.length)
            const psfMin = Math.min(...compPsfs), psfMax = Math.max(...compPsfs)
            const maxBar = Math.max(REAL_CMA.subject.price, ...compPrices)
            const maxPsf = Math.max(subjPsf, ...compPsfs)
            const avgDistance = (ADDED_COMPS.reduce((sum, c) => sum + parseFloat(c.distance), 0) / ADDED_COMPS.length).toFixed(1) + ' mi'
            const overviewRows: [string, string, string[]][] = [
              ['Sale Price', formatPrice(REAL_CMA.subject.price), ADDED_COMPS.map(c => formatPrice(c.price))],
              ['$ / Sqft', `$${subjPsf}`, ADDED_COMPS.map(c => `$${Math.round(c.price / c.sqft)}`)],
              ['Square Feet', REAL_CMA.subject.sqft.toLocaleString(), ADDED_COMPS.map(c => c.sqft.toLocaleString())],
              ['Beds', String(REAL_CMA.subject.beds), ADDED_COMPS.map(c => String(c.beds))],
              ['Baths', String(REAL_CMA.subject.baths), ADDED_COMPS.map(c => String(c.baths))],
              ['Distance', '—', ADDED_COMPS.map(c => c.distance)],
            ]
            return (
              <div className="w-full h-full overflow-hidden relative">
                <div className="absolute inset-x-0 transition-transform duration-[1400ms] ease-in-out" style={{ transform: `translateY(-${REPORT_OFFSETS[beat.section]}px)` }}>
                  {/* Section 0: real header (dark, faded subject photo, "Comparative Market
                      Analysis" kicker, big serif address, Prepared For + agent row). Content is
                      grouped and centered (not spread with justify-between) so the header's height
                      only has to fit what's actually in it, instead of stretching the text block
                      and agent row apart with a big empty gap between them. */}
                  <div style={{ height: REPORT_HEIGHTS[0] }} className="relative flex flex-col items-center justify-center gap-3 bg-[#111827] px-6 py-4 overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] via-[#e4c876] to-[#C9A24D]" />
                    <Image src={REAL_CMA.subject.photo} alt="" fill className="object-cover opacity-30" unoptimized />
                    <div className="absolute inset-0 bg-[#111827]/80" />
                    <div className="relative text-center">
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#C9A24D]">Comparative Market Analysis</p>
                      <h4 className="mt-2 font-serif text-xl font-black text-white leading-tight">{REAL_CMA.subject.address}</h4>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-gray-300">{REAL_CMA.subject.city}, {REAL_CMA.subject.state}</p>
                      <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-gray-400">Prepared for <span className="text-white">{REAL_CMA.clientName}</span></p>
                    </div>
                    <div className="relative flex w-full items-center justify-center gap-2 border-t border-white/10 pt-2.5">
                      <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20 flex-shrink-0"><Image src={AGENT.photo} alt={AGENT.name} fill className="object-cover" unoptimized /></div>
                      <p className="text-[8px] font-black text-white">{AGENT.name}</p>
                      <span className="text-[8px] text-gray-500">&middot;</span>
                      <p className="text-[7px] font-bold uppercase tracking-wide text-gray-400">{AGENT.brokerage}</p>
                    </div>
                  </div>

                  {/* Section 1: real Subject Property hero (SubjectShowcaseCard - price/address
                      overlay on the photo, stat strip below). */}
                  <div style={{ height: REPORT_HEIGHTS[1] }} className="overflow-hidden px-4 pt-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] mb-0.5">The Property</p>
                    <p className="font-serif text-sm font-black text-[#0B0B0B] dark:text-white mb-2">Subject Property</p>
                    {/* Inset (not edge-to-edge) and taller than wide - a framed photo rather than
                        a short, full-bleed banner. */}
                    <div className="rounded-2xl overflow-hidden bg-[#111827] p-2">
                      <div className="relative h-44 rounded-xl overflow-hidden">
                        <Image src={REAL_CMA.subject.photo} alt={REAL_CMA.subject.address} fill className="object-cover" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <p className="font-serif text-lg font-black text-white leading-none">{formatPrice(REAL_CMA.subject.price)}</p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-white">{REAL_CMA.subject.address}</p>
                          <p className="text-[7.5px] font-semibold uppercase tracking-wide text-white/70">{REAL_CMA.subject.city}, {REAL_CMA.subject.state}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 mt-2 pt-2 border-t border-white/15">
                        {[[String(REAL_CMA.subject.beds), 'Beds'], [String(REAL_CMA.subject.baths), 'Baths'], [REAL_CMA.subject.sqft.toLocaleString(), 'Sq Ft'], [String(REAL_CMA.subject.yearBuilt), 'Built']].map(([v, l]) => (
                          <div key={l} className="flex flex-col items-center py-1 text-center border-l border-white/15 first:border-l-0">
                            <p className="text-[10px] font-black text-white">{v}</p>
                            <p className="text-[6px] font-black uppercase tracking-wide text-white/55">{l}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Location Context - the real page embeds a live, interactive Google
                      Map here (CmaInteractiveMap) with a pin for the subject and one per comp. That
                      obviously can't run for real in a marketing mockup, so this is a stylized
                      stand-in built to actually look like a real Google Maps roadmap tile - its
                      classic tan land color, a couple of roads, a park and a water patch, even the
                      zoom controls and wordmark - with 4 positioned pin markers on top (explicit
                      ask: "make it looka liek a google map with how a google mpa would look like" -
                      the earlier version used a dark navy grid texture, which read as an abstract
                      graphic rather than an actual map). */}
                  <div style={{ height: REPORT_HEIGHTS[2] }} className="overflow-hidden px-4 pt-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] mb-0.5">Geography</p>
                    <p className="font-serif text-sm font-black text-[#0B0B0B] dark:text-white mb-2">Location Context</p>
                    <div className="relative h-24 rounded-xl overflow-hidden mb-2" style={{ backgroundColor: '#e5e3df' }}>
                      {/* Water (top-right) and a park (bottom-left) - the two land-cover colors
                          every real Google Maps tile is built from. */}
                      <div className="absolute -right-4 -top-6 h-16 w-24 rounded-[40%] opacity-90" style={{ backgroundColor: '#aadaff' }} />
                      <div className="absolute -bottom-5 -left-5 h-14 w-20 rounded-[40%] opacity-90" style={{ backgroundColor: '#c5e8b7' }} />
                      {/* Roads - a thicker "highway" (yellow-white, gray outline) plus a couple of
                          thinner cross streets, angled rather than a perfect grid. */}
                      <div className="absolute left-[-10%] top-[38%] h-[7px] w-[120%] -rotate-3 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
                      <div className="absolute left-[22%] top-[-10%] h-[130%] w-[5px] rotate-6 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" />
                      <div className="absolute left-[68%] top-[-10%] h-[130%] w-[4px] -rotate-6 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" />
                      <div className="absolute left-[-10%] top-[72%] h-[4px] w-[120%] rotate-2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" />

                      {/* Subject pin, roughly centered - comps scattered around it at plausible
                          map-like offsets, closest two nearer the center than the farthest one. */}
                      <span className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#111827] text-[6.5px] font-black text-white shadow-md ring-2 ring-white" style={{ left: '50%', top: '46%' }}>S</span>
                      {ADDED_COMPS.slice(0, 3).map((c, i) => {
                        const pos = [{ left: '27%', top: '30%' }, { left: '72%', top: '32%' }, { left: '61%', top: '74%' }][i]
                        return (
                          <span key={c.address} className="absolute flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#C9A24D] text-[6px] font-black text-white shadow-md ring-2 ring-white" style={pos}>{i + 1}</span>
                        )
                      })}

                      {/* A stacked +/- zoom control, same generic chrome every map UI has (not
                          reproducing Google's own wordmark/logo here - just the map style itself,
                          the tan land/road/water look, is what actually reads as "a map"). */}
                      <div className="absolute bottom-1.5 right-1.5 flex flex-col overflow-hidden rounded-[3px] bg-white shadow">
                        <span className="flex h-3 w-3 items-center justify-center border-b border-gray-200 text-[7px] font-bold leading-none text-gray-600">+</span>
                        <span className="flex h-3 w-3 items-center justify-center text-[8px] font-bold leading-none text-gray-600">&minus;</span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2.5 py-1.5">
                        <span className="text-[7px] font-black uppercase tracking-wide text-white">{ADDED_COMPS.length} comparables mapped</span>
                        <span className="text-[6.5px] font-bold text-white/80">Avg {avgDistance} away</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                      <div className="flex items-center gap-2 bg-[#C9A24D]/10 px-2.5 py-1.5">
                        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#111827] text-[6.5px] font-black text-white dark:bg-white dark:text-[#111827]">S</span>
                        <span className="min-w-0 flex-1 truncate text-[8.5px] font-black text-[#0B0B0B] dark:text-white">{REAL_CMA.subject.address} <span className="font-semibold text-gray-400">(Subject)</span></span>
                      </div>
                      {ADDED_COMPS.map((c, i) => (
                        <div key={c.address} className="flex items-center gap-2 px-2.5 py-1.5">
                          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[6.5px] font-black text-white">#{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[8.5px] font-semibold text-gray-600 dark:text-gray-300">{c.address}</span>
                          <span className="flex-shrink-0 text-[7.5px] font-bold text-gray-400">{c.distance}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sections 3-5: real Individual Comparable Analysis card (ComparableSection) -
                      one per added comp, all 3, not just the first. */}
                  <div style={{ height: REPORT_HEIGHTS[3] }} className="overflow-hidden"><CompReportCard comp={ADDED_COMPS[0]} index={0} /></div>
                  <div style={{ height: REPORT_HEIGHTS[4] }} className="overflow-hidden"><CompReportCard comp={ADDED_COMPS[1]} index={1} /></div>
                  <div style={{ height: REPORT_HEIGHTS[5] }} className="overflow-hidden"><CompReportCard comp={ADDED_COMPS[2]} index={2} /></div>

                  {/* Section 6: real Comparable Overview table (Subject + comp columns). */}
                  <div style={{ height: REPORT_HEIGHTS[6] }} className="overflow-hidden px-4 pt-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] mb-0.5">{ADDED_COMPS.length} Comparable Sales</p>
                    <p className="font-serif text-sm font-black text-[#0B0B0B] dark:text-white mb-2">Comparable Overview</p>
                    <table className="w-full table-fixed border-collapse">
                      <thead>
                        <tr className="border-b-2 border-[#111827] dark:border-white">
                          <th className="w-[22%]"></th>
                          <th className="py-1 text-left text-[6.5px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">Subject</th>
                          {ADDED_COMPS.map((c, i) => <th key={c.address} className="py-1 text-left text-[6.5px] font-black uppercase text-gray-400">#{i + 1}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {overviewRows.map(([label, subjVal, compVals], idx) => (
                          <tr key={label} className={`border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}`}>
                            <td className="py-1 text-[7px] font-bold text-gray-500">{label}</td>
                            <td className="py-1 text-[7px] font-black text-[#111827] dark:text-white">{subjVal}</td>
                            {compVals.map((v, ci) => <td key={ci} className="py-1 text-[7px] font-semibold text-gray-700 dark:text-gray-300">{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Section 7: real Market Analysis - the gold "market signal" highlight, the
                      facts grid, AND both real bar charts (Price Per Square Foot, then Comparable
                      Sale Prices), subject included as its own bar in each like the real page. */}
                  <div style={{ height: REPORT_HEIGHTS[7] }} className="overflow-hidden px-4 pt-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] mb-0.5">Bringing It Together</p>
                    <p className="font-serif text-sm font-black text-[#0B0B0B] dark:text-white mb-2">Market Analysis</p>
                    <div className="mb-2.5 flex items-start gap-1.5 rounded-lg bg-[#C9A24D]/10 px-2.5 py-1.5">
                      <ShieldCheck className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#C9A24D]" />
                      <p className="text-[7.5px] font-semibold text-gray-700 dark:text-gray-300 leading-snug">Strong comps sit meaningfully above list price - supports a confident offer near market value.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {([['Sale Range', `${formatPrice(saleMin)}–${formatPrice(saleMax)}`], ['Avg Sale', formatPrice(saleAvg)], ['$/Sqft Range', `$${psfMin}–$${psfMax}`]] as [string, string][]).map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-gray-200 dark:border-gray-800 py-1.5 text-center">
                          <p className="text-[9px] font-black text-[#0B0B0B] dark:text-white">{v}</p>
                          <p className="text-[5.5px] font-bold uppercase text-gray-400">{l}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[7px] font-black uppercase tracking-wide text-gray-400 mb-1">Price Per Square Foot</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-8 text-[6.5px] font-black text-[#8b7355] dark:text-[#d7b974] flex-shrink-0">Subj</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-1.5 rounded-full bg-[#C9A24D]" style={{ width: `${(subjPsf / maxPsf) * 100}%` }} /></div>
                      </div>
                      {ADDED_COMPS.map((c, i) => (
                        <div key={c.address} className="flex items-center gap-1.5">
                          <span className="w-8 text-[6.5px] font-bold text-gray-400 flex-shrink-0">#{i + 1}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-1.5 rounded-full bg-[#111827] dark:bg-gray-500" style={{ width: `${(Math.round(c.price / c.sqft) / maxPsf) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[7px] font-black uppercase tracking-wide text-gray-400 mb-1">Comparable Sale Prices</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-8 text-[6.5px] font-black text-[#8b7355] dark:text-[#d7b974] flex-shrink-0">Subj</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-1.5 rounded-full bg-[#C9A24D]" style={{ width: `${(REAL_CMA.subject.price / maxBar) * 100}%` }} /></div>
                      </div>
                      {ADDED_COMPS.map((c, i) => (
                        <div key={c.address} className="flex items-center gap-1.5">
                          <span className="w-8 text-[6.5px] font-bold text-gray-400 flex-shrink-0">#{i + 1}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-1.5 rounded-full bg-[#111827] dark:bg-gray-500" style={{ width: `${(c.price / maxBar) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 8: real Agent Final Analysis dark box, now including a short Buyer
                      Valuation Notes blurb (the real page's commentarySections/guidance area). */}
                  <div style={{ height: REPORT_HEIGHTS[8] }} className="overflow-hidden px-4 pt-4">
                    <div className="rounded-2xl bg-[#111827] p-4">
                      <p className="text-[7.5px] font-black uppercase tracking-[0.25em] text-[#C9A24D]">Agent Final Analysis</p>
                      <p className="mt-2 text-[7px] font-bold uppercase tracking-widest text-gray-400">Estimated Fair Market Value</p>
                      <p className="font-serif text-lg font-black text-white">{formatPriceFull(REAL_CMA.fairValue)}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-2.5">
                        <div><p className="text-[9px] font-black text-white">{formatPriceFull(REAL_CMA.suggestedOfferMin)}</p><p className="text-[5.5px] font-bold uppercase tracking-wide text-gray-400">Suggested Offer Min</p></div>
                        <div><p className="text-[9px] font-black text-white">{formatPriceFull(REAL_CMA.suggestedOfferMax)}</p><p className="text-[5.5px] font-bold uppercase tracking-wide text-gray-400">Suggested Offer Max</p></div>
                      </div>
                      <div className="mt-3 border-t border-white/10 pt-2.5">
                        <p className="text-[6.5px] font-black uppercase tracking-widest text-[#C9A24D] mb-1">Buyer Valuation Notes</p>
                        <p className="text-[7px] text-gray-300 leading-relaxed">The strongest comps support pricing near the top of the range - a confident opening offer with room to negotiate down from list.</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 9: real agent footer - "Want the wider view?" CTA (now with the real
                      page's own description line under it, not just the heading + button) and the
                      real page's own CMA-is-not-an-appraisal disclaimer, so the very last thing
                      shown actually matches what a visitor sees at the bottom of the real report
                      (explicit ask: "the last 2 sections dont look like the actual site"). */}
                  <div style={{ height: REPORT_HEIGHTS[9] }} className="overflow-hidden bg-[#111827] px-4 py-5 flex flex-col items-center text-center">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 mb-2"><Image src={AGENT.photo} alt={AGENT.name} fill className="object-cover" unoptimized /></div>
                    <p className="font-serif text-sm font-black text-white">{AGENT.name}</p>
                    <p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#C9A24D] mt-0.5">{AGENT.brokerage}</p>
                    <p className="text-[7px] font-semibold text-gray-300 mt-1.5">{AGENT.phone} &middot; {AGENT.email}</p>
                    <div className="mt-3 border-t border-white/10 pt-3 w-full">
                      <p className="font-serif text-sm font-black text-white">Want the wider view?</p>
                      <p className="mt-1 text-[7px] font-semibold leading-relaxed text-gray-400">Listings, recent sales, and local insight from me.</p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#C9A24D] px-3 py-1.5 text-[7px] font-black uppercase tracking-wide text-white">See more from me &rarr;</span>
                    </div>
                    <p className="mt-4 border-t border-white/10 pt-2.5 text-[6px] leading-relaxed text-gray-500">This is a comparative market analysis (CMA), not a formal appraisal - an opinion of value only, not a guarantee of sale price.</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </BrowserFrame>
  )
}
