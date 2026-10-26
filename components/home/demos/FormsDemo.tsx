'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Contact, Calendar, GripVertical, Plus, Check, Link2, MousePointer2, MapPin, ClipboardList, ChevronRight, ListChecks, Type, Hash, AlignLeft, Pencil, Download, Share2, Smartphone, UserPlus, Wrench, type LucideIcon } from 'lucide-react'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import BrowserFrame from '@/components/home/BrowserFrame'
import TypingAnimation from '@/components/TypingAnimation'
import TitleSlide from './TitleSlide'
import { AGENT, REAL_FORM } from './realData'

// The user's own real "Buyer Onboarding" form (openhousepal.com/peter-stefanatos/buyer-onboarding
// - a genuine 30-question form; a 4-question slice here). Rebuilt to match the REAL editor flow:
// click "Add question" -> pick a question TYPE from the picker -> it lands in the rail -> repeat,
// edit one, add a couple more -> Save -> Share -> open and fill the live form. Labels are NEVER
// typed character-by-character (they come from the template); live-form answers are actually
// filled in. Replay-safe: one monotonic beat index, agent branding via next/image so it survives
// every loop.
const QUESTION_TYPES = [
  { id: 'select', label: 'Multiple Choice', icon: ListChecks },
  { id: 'contact', label: 'Contact Info', icon: Contact },
  { id: 'short', label: 'Short Text', icon: Type },
  { id: 'date', label: 'Date', icon: Calendar },
  { id: 'number', label: 'Number', icon: Hash },
  { id: 'long', label: 'Long Text', icon: AlignLeft },
] as const

// Short, plain-language questions built for the demo (not the real 30-question template) so each
// label is readable at a glance while the animation plays: contact info, a typed short-text
// question, a multiple-choice timeline whose options type in, and a price-range short text.
type DemoField = { label: string; typeId: string; typeLabel: string; icon: LucideIcon; section: string | null; options: string[] | null; fields: string[] | null }
const FIELDS: DemoField[] = [
  { label: 'Contact info', typeId: 'contact', typeLabel: 'Contact Info', icon: Contact, section: 'About You', options: null, fields: ['First Name', 'Last Name', 'Phone', 'Email'] },
  { label: 'When are you looking to buy?', typeId: 'short', typeLabel: 'Short Text', icon: Type, section: 'Your Search', options: null, fields: null },
  { label: 'Which timeline fits best?', typeId: 'select', typeLabel: 'Multiple Choice', icon: ListChecks, section: 'Your Search', options: ['1 month', '3 months', '6 months', '1 year'], fields: null },
  { label: 'What is your price range?', typeId: 'short', typeLabel: 'Short Text', icon: Type, section: 'Your Search', options: null, fields: null },
]

type Beat =
  | { k: 'title' }
  | { k: 'click-add'; n: number } | { k: 'pick-type'; n: number } | { k: 'added'; n: number }
  | { k: 'edit'; idx: number }
  | { k: 'save' } | { k: 'share' } | { k: 'open' }
  | { k: 'welcome' } | { k: 'q'; idx: number; filled: boolean } | { k: 'thanks' }

const BEATS: Beat[] = [
  { k: 'title' },
  { k: 'click-add', n: 0 }, { k: 'pick-type', n: 0 }, { k: 'added', n: 0 },
  { k: 'click-add', n: 1 }, { k: 'pick-type', n: 1 }, { k: 'added', n: 1 },
  { k: 'edit', idx: 1 },
  { k: 'click-add', n: 2 }, { k: 'pick-type', n: 2 }, { k: 'added', n: 2 },
  { k: 'click-add', n: 3 }, { k: 'pick-type', n: 3 }, { k: 'added', n: 3 },
  { k: 'save' }, { k: 'share' }, { k: 'open' },
  { k: 'welcome' },
  { k: 'q', idx: 0, filled: false }, { k: 'q', idx: 0, filled: true },
  { k: 'q', idx: 1, filled: false }, { k: 'q', idx: 1, filled: true },
  { k: 'q', idx: 2, filled: false }, { k: 'q', idx: 2, filled: true },
  { k: 'q', idx: 3, filled: false }, { k: 'q', idx: 3, filled: true },
  { k: 'thanks' },
]

function beatDuration(beat: Beat): number {
  switch (beat.k) {
    case 'title': return 6000 // 20% longer
    case 'click-add': return 900 // click the "+ Add question" button before the type picker opens
    case 'pick-type': return 2600 // was 3800 - reads fine but sat there too long, slower than a normal human pick-and-move-on pace
    case 'added': return 3200 // room for the label + any options to type in
    case 'edit': return 3200
    case 'save': return 1400
    case 'share': return 4200 // was 2200, then 2800 - still went by too fast to actually read the QR/download row
    case 'open': return 900
    case 'welcome': return 2400
    case 'q':
      if (!beat.filled) return 1700
      // filled: long enough for the answer to actually type in, not snap into place
      return beat.idx === 0 ? 3600 : beat.idx === 2 ? 1800 : 2600
    case 'thanks': return 5200
  }
}

const TOTAL_PAGES = 9
function pageFor(beat: Beat): number {
  switch (beat.k) {
    case 'title': return 0
    case 'click-add': case 'pick-type': case 'added': case 'edit': return 1
    case 'save': case 'share': case 'open': return 2
    case 'welcome': return 3
    case 'q': return 4 + beat.idx
    case 'thanks': return 8
  }
}

const ANSWERS: Record<number, { chosen?: number; contact?: string[]; text?: string }> = {
  0: { contact: ['John', 'Carter', '(610) 555-0148', 'john.carter@email.com'] },
  1: { text: 'Hoping to buy in the next few months' },
  2: { chosen: 1 }, // "3 months"
  3: { text: '$700,000 – $1,100,000' },
}

// A decorative QR pattern (not a real scannable code) - same fixed-cell-grid technique
// OpenHouseKitDemo's MiniQr already uses elsewhere, kept local here since this is the only spot in
// this file that needs one: illustrating that the share link also comes as a QR code (explicit ask
// - the real form share panel offers both, and this demo's own blurb now says so too, so the demo
// should actually show it).
const QR_CELLS = [1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1]
function MiniQr({ size }: { size: number }) {
  return (
    <div className="grid grid-cols-4 grid-rows-4 gap-[1px] rounded bg-white p-[3px] shadow-sm" style={{ width: size, height: size }}>
      {QR_CELLS.map((on, idx) => <div key={idx} className={on ? 'bg-[#111827]' : 'bg-white'} />)}
    </div>
  )
}

function AgentBrandPill() {
  return (
    <div className="mx-auto mb-4 flex h-[52px] w-fit max-w-full items-center max-sm:mb-2 max-sm:h-[44px] gap-2.5 rounded-full border border-gray-100 bg-white py-1.5 pl-1.5 pr-4 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <div className="relative aspect-square h-full shrink-0 overflow-hidden rounded-full bg-gray-100">
        <Image src={AGENT.photo} alt={AGENT.name} fill className="object-cover object-[50%_18%]" unoptimized />
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate font-serif text-[11px] font-black leading-tight text-[#0B0B0B] dark:text-white">{AGENT.name}</p>
        <p className="truncate text-[8px] font-black uppercase tracking-wide" style={{ color: REAL_FORM.accentColor }}>{AGENT.brokerage} · {AGENT.title}</p>
        <p className="flex items-center gap-0.5 truncate text-[8px] font-semibold text-gray-500 dark:text-gray-400">
          <MapPin className="h-2 w-2 shrink-0" style={{ color: REAL_FORM.accentColor }} /> {AGENT.market}
        </p>
      </div>
    </div>
  )
}

function NextButton({ pressed, isLast }: { pressed: boolean; isLast: boolean }) {
  return (
    <div className={`flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-transform duration-200 ${pressed ? 'scale-95 brightness-95' : 'scale-100'}`} style={{ backgroundColor: REAL_FORM.accentColor }}>
      {isLast ? 'Submit' : <>Next <ChevronRight className="h-3 w-3" /></>}
    </div>
  )
}

export default function FormsDemo() {
  const [i, setI] = useState(0)
  const beat = BEATS[i]
  const advance = () => setI(n => (n + 1) % BEATS.length)

  useEffect(() => {
    const t = setTimeout(advance, beatDuration(beat))
    return () => clearTimeout(t)
  }, [i, beat])

  if (beat.k === 'title') {
    return <TitleSlide icon={ClipboardList} iconClassName="ohp-icon-assemble-forms" kicker="Capture Leads" title="Forms" body={"Branded forms for buyers, sellers & home values -\nevery answer lands in your Leads."} durationMs={beatDuration(beat)} totalPages={TOTAL_PAGES} pageIndex={0} url="app.openhousepal.com/studio/forms" />
  }

  const isEditor = beat.k === 'click-add' || beat.k === 'pick-type' || beat.k === 'added' || beat.k === 'edit' || beat.k === 'save'
  const isShare = beat.k === 'share' || beat.k === 'open'
  // 'edit' always happens right after exactly 2 questions have been added (see BEATS) and only
  // ever edits one of those 2 already-added questions - fieldsAdded here needs to reflect that
  // fixed count, not beat.idx + 2 (which broke once the edited question stopped always being
  // question 1: editing idx 1 produced fieldsAdded=3, a phantom 3rd rail entry that vanished again
  // the moment the next click-add beat corrected it back down - explicit repro: "it tries a 3rd
  // question then removes it but its there for a second").
  const fieldsAdded = beat.k === 'click-add' ? beat.n : beat.k === 'pick-type' ? beat.n : beat.k === 'added' ? beat.n + 1 : beat.k === 'edit' ? 2 : beat.k === 'save' ? FIELDS.length : FIELDS.length
  const pickingType = beat.k === 'pick-type' ? QUESTION_TYPES.findIndex(t => t.id === FIELDS[beat.n]?.typeId) : -1
  const editIdx = beat.k === 'edit' ? beat.idx : beat.k === 'added' ? beat.n : Math.max(0, fieldsAdded - 1)
  const url = isEditor ? 'app.openhousepal.com/studio/forms' : `openhousepal.com/peter-stefanatos/${REAL_FORM.slug}`
  // The strip along the top: which of the 4 stages this beat belongs to.
  const stage = isEditor ? 0 : isShare ? 1 : beat.k === 'thanks' ? 3 : 2
  const STAGES = [
    { icon: Wrench, title: 'Build it in minutes', body: 'Add questions. Pick a type.' },
    { icon: Share2, title: 'Share it anywhere', body: 'A link and a QR code.' },
    { icon: Smartphone, title: 'They fill it in on their phone', body: 'No app. No account.' },
    { icon: UserPlus, title: 'Answers land in your Leads', body: 'Follow-up included.' },
  ]

  return (
    <BrowserFrame url={url} progress={{ pages: TOTAL_PAGES, current: pageFor(beat), durationMs: beatDuration(beat) }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className="relative h-[420px] overflow-hidden">
        <DemoStep id={String(stage)} step={stage + 1} count={STAGES.length} title={STAGES[stage].title} body={STAGES[stage].body} icon={STAGES[stage].icon} />
        {isEditor && (
          <div className="flex h-full pt-12">
            {/* left rail */}
            <div className="flex w-[186px] flex-shrink-0 flex-col border-r border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-[#151517] max-sm:w-[136px] max-sm:px-2.5 max-sm:pb-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{REAL_FORM.title}</p>
              <p className="mb-3 text-[9px] text-gray-400">{fieldsAdded} question{fieldsAdded === 1 ? '' : 's'} · drag to reorder</p>
              <div className="flex-1 space-y-1.5 overflow-hidden">
                {FIELDS.slice(0, fieldsAdded).map((f, idx) => {
                  const Icon = f.icon
                  const active = (beat.k === 'added' && idx === beat.n) || (beat.k === 'edit' && idx === beat.idx)
                  return (
                    <div key={f.label} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all duration-300 ${active ? 'border-[#C9A24D] bg-[#C9A24D]/10 ring-1 ring-[#C9A24D]/40' : 'border-gray-100 dark:border-gray-800'}`}>
                      <GripVertical className="h-3 w-3 flex-shrink-0 text-gray-300" />
                      <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-[#C9A24D]/15"><Icon className="h-2.5 w-2.5 text-[#8b7355] dark:text-[#C9A24D]" /></div>
                      <span className="line-clamp-2 text-[9px] font-bold leading-tight text-[#0B0B0B] dark:text-gray-200">{f.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className={`relative flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[9px] font-black uppercase tracking-wide transition-colors duration-200 ${beat.k === 'click-add' || beat.k === 'pick-type' ? 'border-[#C9A24D] bg-[#C9A24D]/5 text-[#8b7355] dark:text-[#C9A24D]' : 'border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600'}`}>
                <Plus className="h-3 w-3" /> Add question
                {beat.k === 'click-add' && (
                  <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10">
                    <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
                    <MousePointer2 className="relative h-3.5 w-3.5 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
                  </span>
                )}
              </div>
              <div className={`mt-2.5 flex items-center justify-center gap-1.5 rounded-full py-2 text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${beat.k === 'save' ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
                {beat.k === 'save' ? <><Check className="h-3 w-3" /> Saved</> : 'Save'}
              </div>
            </div>

            {/* right panel */}
            <div className="flex flex-1 items-center justify-center p-5 max-sm:min-w-0 max-sm:p-3">
              {beat.k === 'click-add' && (
                <div key="click-add" className="w-full max-w-[240px] animate-fadeIn text-center">
                  <p className="text-[9px] font-bold text-gray-300 dark:text-gray-600">Click &quot;Add question&quot; to continue</p>
                </div>
              )}

              {beat.k === 'pick-type' && (
                <div key="pick" className="w-full max-w-[240px] animate-fadeIn">
                  <p className="mb-2.5 text-[9px] font-black uppercase tracking-widest text-gray-400">Pick your questions</p>
                  <div className="grid grid-cols-2 gap-1.5 max-sm:grid-cols-1">
                    {QUESTION_TYPES.map((t, idx) => {
                      const Icon = t.icon
                      const on = idx === pickingType
                      return (
                        <div key={t.id} className={`relative flex items-center gap-1.5 rounded-lg border-2 px-2 py-2 text-[9px] font-black transition-all duration-200 ${on ? 'scale-[1.03] border-[#C9A24D] bg-[#C9A24D]/10 text-[#0B0B0B] shadow-sm dark:text-white' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}>
                          <Icon className={`h-3 w-3 flex-shrink-0 ${on ? 'text-[#8b7355] dark:text-[#C9A24D]' : ''}`} /> {t.label}
                          {on && <Check className="ml-auto h-2.5 w-2.5 text-[#C9A24D]" strokeWidth={3} />}
                          {/* Cursor + a quick "tap ring" pulse over whichever option is being picked -
                              without it, an option just silently lights up with no sense that
                              something was actually clicked to select it. */}
                          {on && (
                            <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10">
                              <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
                              <MousePointer2 className="relative h-3.5 w-3.5 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {(beat.k === 'added' || beat.k === 'edit' || beat.k === 'save') && (() => {
                const f = FIELDS[Math.min(editIdx, FIELDS.length - 1)]
                const Icon = f.icon
                const typingIn = beat.k === 'added'
                return (
                  <div key={`edit-${editIdx}-${typingIn ? 'add' : 'rest'}`} className="w-full max-w-[250px] animate-fadeIn">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                      {beat.k === 'edit' ? <><Pencil className="h-2.5 w-2.5" /> Editing question {editIdx + 1}</> : `Question ${editIdx + 1} added`}
                    </p>
                    <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">Label</label>
                    <div className={`mb-2.5 min-h-[30px] rounded-lg border-2 px-2.5 py-2 text-[9.5px] font-bold leading-snug text-[#111827] dark:text-white ${beat.k === 'edit' ? 'border-[#C9A24D]' : 'border-gray-200 dark:border-gray-700'}`}>
                      {typingIn ? <TypingAnimation text={f.label} speed={42} /> : f.label}
                    </div>
                    <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">Type</label>
                    <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-[10px] font-bold text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <Icon className="h-3 w-3 text-[#8b7355] dark:text-[#C9A24D]" /> {f.typeLabel}
                    </div>
                    {f.options && (
                      <>
                        <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">Options</label>
                        <div className="space-y-1">
                          {f.options.map((o, oi) => <div key={o} className="rounded border border-gray-200 px-2 py-1 text-[8.5px] text-gray-500 dark:border-gray-700 dark:text-gray-400">{typingIn ? <TypingAnimation text={o} speed={38} startDelay={650 + oi * 480} /> : o}</div>)}
                        </div>
                      </>
                    )}
                    {f.fields && (
                      <>
                        <label className="mb-1 block text-[8px] font-bold uppercase tracking-wide text-gray-400">Fields</label>
                        <div className="flex flex-wrap gap-1">
                          {f.fields.map(fl => <span key={fl} className="rounded bg-gray-100 px-1.5 py-0.5 text-[8px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{fl}</span>)}
                        </div>
                      </>
                    )}
                    {beat.k === 'edit' && (
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#FAFAF7] px-2 py-1.5 dark:bg-[#111114]">
                        <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400">Required</span>
                        <div className="flex h-3.5 w-6 items-center justify-end rounded-full bg-[#C9A24D] px-0.5"><div className="h-2.5 w-2.5 rounded-full bg-white" /></div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {isShare && (
          <div className="flex h-full items-center justify-center p-6 pt-14">
            <div className="w-full max-w-[280px] animate-fadeIn">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Share this form</p>
              <div className="relative flex items-center gap-2 rounded-xl border-2 border-[#C9A24D] bg-white px-3 py-2.5 shadow-sm dark:bg-[#151517]">
                <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-[#8b7355] dark:text-[#C9A24D]" />
                <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-[#111827] dark:text-gray-200">openhousepal.com/peter-stefanatos/{REAL_FORM.slug}</span>
                <span className={`flex-shrink-0 rounded-md bg-[#C9A24D] px-2 py-1 text-[9px] font-black uppercase text-[#111827] transition-transform duration-200 ${beat.k === 'open' ? 'scale-90' : 'scale-100'}`}>View</span>
                {beat.k === 'open' && <MousePointer2 className="absolute -bottom-1 right-6 h-4 w-4 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />}
              </div>

              {/* Same link, as a QR code - plus a Download chip, so it reads as "this is also a
                  real file you can grab", not just a picture sitting there. */}
              <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <div className="flex-shrink-0 rounded-lg bg-[#111827] p-1.5 dark:bg-black/40">
                  <MiniQr size={40} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wide text-[#111827] dark:text-gray-200">Or scan the QR code</p>
                  <p className="mt-0.5 text-[8px] font-semibold text-gray-400">Print it on a flyer or sign - scanning it opens the form instantly.</p>
                </div>
                <span className="flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[8px] font-black uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <Download className="h-2.5 w-2.5" /> PNG
                </span>
              </div>

              <p className="mt-2 text-[8px] font-semibold text-gray-400">Post it anywhere - every submission is captured and organized in Leads.</p>
            </div>
          </div>
        )}

        {!isEditor && !isShare && (
          <div className="relative h-[420px] overflow-hidden">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${REAL_FORM.accentColor}30` }} />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${REAL_FORM.accentColor}20` }} />
            <div className="relative flex h-full flex-col items-center justify-center p-4 pt-14">
              {beat.k === 'welcome' && (
                <div className="w-full max-w-[300px] animate-fadeIn text-center">
                  <AgentBrandPill />
                  <h4 className="mb-1.5 text-lg font-black text-[#0B0B0B] dark:text-white">{REAL_FORM.headline}</h4>
                  <p className="mb-5 text-xs text-gray-400">{REAL_FORM.subtitle}</p>
                  <div className="w-full animate-pulse rounded-2xl py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg" style={{ backgroundColor: REAL_FORM.accentColor }}>Start &rarr;</div>
                </div>
              )}

              {beat.k === 'q' && (() => {
                const q = FIELDS[beat.idx]
                const a = ANSWERS[beat.idx]
                const isLast = beat.idx === FIELDS.length - 1
                return (
                  <div key={`q${beat.idx}`} className="w-full max-w-[280px] animate-fadeIn">
                    <AgentBrandPill />
                    <div className="rounded-2xl bg-white p-5 shadow-xl dark:bg-[#151517] max-sm:p-4">
                      {q.section && <span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest" style={{ color: REAL_FORM.accentColor }}>{q.section}</span>}
                      <div className="mb-3 h-1 w-full rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-1 rounded-full" style={{ width: `${(beat.idx + 1) * 25}%`, backgroundColor: REAL_FORM.accentColor }} /></div>
                      <h4 className="mb-2.5 text-sm font-black leading-snug text-[#0B0B0B] dark:text-white">{q.label}</h4>

                      {q.options && (
                        <div className="mb-3 space-y-1.5 max-sm:space-y-1">
                          {q.options.map((opt, idx) => {
                            const chosen = beat.filled && idx === a.chosen
                            return (
                              <div key={opt} className={`flex items-center justify-between rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all duration-200 ${chosen ? 'scale-[1.02] border-[#C9A24D] bg-[#C9A24D]/10 text-[#0B0B0B] dark:text-white' : 'border-gray-200 text-gray-400 dark:border-gray-800'}`}>
                                {opt}
                                {chosen && <Check className="h-3.5 w-3.5" style={{ color: REAL_FORM.accentColor }} />}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {a.contact && (
                        <div className="mb-4 grid grid-cols-2 gap-2">
                          {a.contact.map((val, idx) => (
                            <div key={idx}>
                              {q.fields?.[idx] && <p className="mb-0.5 text-[7px] font-bold uppercase text-gray-400">{q.fields[idx]}</p>}
                              <div className={`min-h-[26px] truncate rounded-lg border-2 px-2 py-1.5 text-[10px] font-medium transition-colors duration-300 ${beat.filled ? 'border-[#C9A24D] text-[#111827] dark:text-white' : 'border-gray-200 text-gray-300 dark:border-gray-700'}`}>
                                {beat.filled ? <TypingAnimation text={val} speed={44} startDelay={idx * 520} /> : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {a.text && (
                        <div className="mb-4">
                          <div className={`min-h-[30px] rounded-lg border-2 px-2.5 py-2 text-[11px] font-medium leading-snug transition-colors duration-300 ${beat.filled ? 'border-[#C9A24D] text-[#111827] dark:text-white' : 'border-gray-200 text-gray-300 dark:border-gray-700'}`}>
                            {beat.filled ? <TypingAnimation text={a.text} speed={40} /> : '—'}
                          </div>
                        </div>
                      )}

                      <NextButton pressed={beat.filled} isLast={isLast} />
                    </div>
                  </div>
                )
              })()}

              {beat.k === 'thanks' && (
                <div className="w-full max-w-[260px] animate-fadeIn text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"><Check className="h-7 w-7 text-white" strokeWidth={3} /></div>
                  <h4 className="mb-1.5 text-base font-black text-[#0B0B0B] dark:text-white">{REAL_FORM.successHeading}</h4>
                  <p className="text-xs text-gray-400">{REAL_FORM.successMessage}</p>
                  {/* ...and on your side: the lead, with the answers, already in Leads. */}
                  <div className="dn-pop mx-auto mt-5 flex w-full max-w-[250px] items-center gap-2.5 rounded-2xl bg-white p-2.5 text-left shadow-xl ring-1 ring-black/5 dark:bg-[#1c1c1f]" style={{ animationDelay: '900ms' }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#e8c97a]"><UserPlus className="h-4 w-4" /></span>
                    <div className="min-w-0"><p className="text-[10px] font-black text-[#111827] dark:text-white">New lead: John Carter</p><p className="truncate text-[8.5px] font-semibold text-gray-500">Buyer · 3 months · $700K–$1.1M · follow-up set</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
