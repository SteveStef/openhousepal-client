'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Smartphone, Check, QrCode, ClipboardList, UserCheck, UserPlus, Layout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DemoNote, DEMO_NOTE_CSS } from './DemoNote'
import MobilePhoneMockup from '@/components/MobilePhoneMockup'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { REAL_OPEN_HOUSE as OH } from './realData'

// The note beside the stage for each step - what the guest does, and what you get out of it.
const NOTES: { id: string; icon: LucideIcon; title: string; body: string }[] = [
  { id: 'scan', icon: QrCode, title: 'Scan to sign in', body: 'No clipboard. No handwriting.' },
  { id: 'info', icon: ClipboardList, title: '10 seconds on their phone', body: 'Name, phone, email.' },
  { id: 'agent', icon: UserCheck, title: 'Working with an agent?', body: 'Know who needs one.' },
  { id: 'lead', icon: UserPlus, title: 'Instantly a lead', body: 'Follow-up already scheduled.' },
]

// Opens on a title slide (held long enough to actually read, with a visible countdown bar), then
// a faithful recreation of the real printed Sign-In Flyer (lib/pdfs.tsx OpenHouseFlyerDocument -
// hero photo, Welcome/Open House heading, real address/beds/baths/sqft/price on the left, and the
// real "Instant Check-In / Scan to Sign In / Quick & Easy" QR panel on the right, same copy and
// layout as the actual PDF) with a visitor's phone scanning that exact QR code, then hands off to
// the existing sign-in typing animation (MobilePhoneMockup, shared with the hero). Every phase is
// wrapped in the same BrowserFrame "computer window" every other demo uses, so all three phases
// (and every other tab) share the exact same fixed footprint - nothing here can shift the rest of
// the page down.
type Phase = 'title' | 'sign' | 'scanning' | 'scanned' | 'phone'

// The phone mockup's own 4 slides (Your Info -> Contact Info -> Your Visit -> Thank You) take
// roughly this long each - startDelay + (chars * typing speed) + the Continue-press pause for the
// first two, fixed auto-advance timers for the last two (see MobilePhoneMockup.tsx). Pages 2-4 of
// the segmented bar below use these so the fill actually matches what's on screen, and the overall
// 'phone' phase timer is sized to the real total instead of cutting the sequence off early.
const NAME_SLIDE_MS = 500 + 10 * 80 + 900 + 350 // "John Smith" + Continue press
const CONTACT_SLIDE_MS = (500 + 17 * 50) + (200 + 14 * 60) + 900 + 350 // email + phone + Continue press
const AGENT_SLIDE_MS = 3000
const THANKYOU_SLIDE_MS = 3800 * 3 // held long enough to read the note beside the phone and the showcase invitation
const PHONE_TOTAL_MS = NAME_SLIDE_MS + CONTACT_SLIDE_MS + AGENT_SLIDE_MS + THANKYOU_SLIDE_MS
const SIGNIN_TOTAL_PAGES = 5

// Pages 0 and 1 (title, flyer) always precede the phone; within the phone, slides 0-1 (Your Info /
// Contact Info) share page 2 since they're really one continuous "fill out the form" beat, then
// the agent question and Thank You screen each get their own page.
function phonePage(slide: number): { current: number; durationMs: number } {
  switch (slide) {
    case 2: return { current: 3, durationMs: AGENT_SLIDE_MS }
    case 3: return { current: 4, durationMs: THANKYOU_SLIDE_MS }
    default: return { current: 2, durationMs: NAME_SLIDE_MS + CONTACT_SLIDE_MS }
  }
}

const QR_CELLS = [
  1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,
  1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,
  1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1,
  1,0,1,1,1,0,1,0,0,0,1,0,1,1,1,0,1,
  1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1,
  1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1,
  1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,
  0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,
  1,1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,
  0,0,1,0,0,1,0,0,1,0,0,1,1,0,1,0,0,
  1,1,1,1,1,1,1,0,1,1,0,1,0,1,1,0,1,
  0,0,0,0,0,0,0,0,0,1,1,0,1,0,0,1,0,
  1,1,1,1,1,1,1,0,1,0,1,0,1,1,0,1,1,
  1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,
  1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,0,
  1,0,1,1,1,0,1,0,0,0,1,0,0,1,0,0,1,
  1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,0,1,
]

export default function SignInDemo() {
  const [phase, setPhase] = useState<Phase>('title')
  const [phoneSlide, setPhoneSlide] = useState(0)

  useEffect(() => {
    // 'phone' is the last phase - it must loop back to 'title', not stop, or the demo freezes
    // forever on that one frame once a visitor reaches it. Its own duration has to cover all 4 of
    // the phone's internal slides, not just a guess, or the phase would get yanked back to the
    // title screen mid-sequence.
    const delays: Record<Phase, number> = { title: 5200, sign: 3800, scanning: 2000, scanned: 1000, phone: PHONE_TOTAL_MS }
    const order: Phase[] = ['title', 'sign', 'scanning', 'scanned', 'phone']
    const t = setTimeout(() => setPhase(order[(order.indexOf(phase) + 1) % order.length]), delays[phase])
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'title') {
    return <TitleSlide icon={QrCode} kicker="Automated" title="Instant Sign In" body="Guests scan, sign in, and become leads - automatically." nowrapBody durationMs={5200} totalPages={SIGNIN_TOTAL_PAGES} url="app.openhousepal.com/open-houses" />
  }

  // 'sign'/'scanning'/'scanned' are all page 1 - one continuous fill across the combined duration
  // of the three, not three separate resets.
  const currentPage = 1
  const pageDurationMs = 3800 + 2000 + 1000

  if (phase === 'phone') {
    // In its own BrowserFrame "window", same as the title slide and every other tab - the phone
    // mockup's natural size is much taller than the fixed 420px content area, so it's scaled down
    // to fit inside rather than being allowed to grow the box and push the rest of the page down.
    return (
      <BrowserFrame url="app.openhousepal.com/open-houses" progress={{ pages: SIGNIN_TOTAL_PAGES, ...phonePage(phoneSlide) }}>
        {/* On the final Thank You slide, a real sibling label takes the left slot (same
            justify-between pattern as the flyer phase's own label) - the phone naturally shifts
            right to make room for it, instead of the phone being nudged over with nothing actually
            explaining why. */}
        <style>{DEMO_NOTE_CSS}</style>
        <div className="h-[420px] flex items-center justify-center gap-6 overflow-hidden animate-fadeIn px-4 sm:px-10">
          {(() => { const n = NOTES[phoneSlide <= 1 ? 1 : phoneSlide === 2 ? 2 : 3]; return (
            <DemoNote id={n.id} icon={n.icon} title={n.title} body={n.body} index={phoneSlide <= 1 ? 1 : phoneSlide === 2 ? 2 : 3} count={NOTES.length} className="w-[200px]">
              {phoneSlide === 3 && (
                <div className="dn-pop mt-3 rounded-xl border border-[#C9A24D]/40 bg-white p-2.5 shadow-lg dark:bg-[#151517]">
                  <p className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest text-[#8b6a2b] dark:text-[#e8c97a]"><UserPlus className="h-3 w-3" /> New lead</p>
                  <p className="mt-1 text-[13px] font-black text-[#111827] dark:text-white">John Smith</p>
                  <p className="text-[10px] font-semibold text-gray-500">{OH.address} · no agent</p>
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9.5px] font-black text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> Follow-up set</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9.5px] font-black text-[#8b6a2b] dark:text-[#e8c97a]"><Layout className="h-3 w-3" /> Showcase made</p>
                </div>
              )}
            </DemoNote>
          ) })()}
          <div className="scale-[0.6] flex-shrink-0">
            <MobilePhoneMockup onSlideChange={setPhoneSlide} />
          </div>
        </div>
      </BrowserFrame>
    )
  }

  return (
    <BrowserFrame url="app.openhousepal.com/open-houses" progress={{ pages: SIGNIN_TOTAL_PAGES, current: currentPage, durationMs: pageDurationMs }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className="h-[420px] flex items-center justify-center gap-6 px-4 sm:px-10">
      <DemoNote id="scan" icon={NOTES[0].icon} title={NOTES[0].title} body={NOTES[0].body} index={0} count={NOTES.length} className="w-[200px]">
        {phase === 'scanned' && <p className="dn-rise mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" /> Scanned!</p>}
      </DemoNote>
      {/* Sized to read as a printed sheet of paper (tall portrait card) rather than a wide desktop
          card. Height is auto (not a locked aspect-ratio) so the content can never get clipped at
          the bottom on narrower viewports where fixed-size text needs relatively more room. */}
      <div className="w-full max-w-[320px] flex-shrink-0 rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col animate-sheet-in">
        {/* Hero photo, same as the real flyer's full-width cover shot - same crop ratio as the
            Kits section's Sign In document, not a shorter, more stretched-out banner. */}
        <div className="relative h-44 w-full flex-shrink-0">
          <Image src={OH.photo} alt={OH.address} fill className="object-cover" unoptimized />
        </div>

        <div className="flex gap-3 p-3">
          {/* Left column - real property facts, same layout/labels as the real PDF */}
          <div className="flex-[1.7] min-w-0 flex flex-col">
            <p className="text-[8px] font-serif uppercase tracking-[0.25em] text-gray-400">Welcome</p>
            <p className="font-serif text-lg font-black uppercase text-[#111827] leading-none mt-1">Open House</p>
            <div className="h-px w-full bg-gray-200 my-2" />
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-gray-400">Property Address</p>
            <p className="text-xs font-bold text-[#111827] leading-snug mt-0.5">{OH.address}, {OH.city}</p>

            <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-gray-400 mt-2.5 mb-1">Property Details</p>
            <div className="flex items-center justify-around rounded-lg border border-gray-100 py-1.5">
              {[[String(OH.beds), 'Beds'], [String(OH.baths), 'Baths'], [OH.sqft.toLocaleString(), 'Sq Ft']].map(([v, l]) => (
                <div key={l} className="text-center px-0.5">
                  <p className="text-xs font-black text-[#111827] leading-none">{v}</p>
                  <p className="text-[5.5px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>

            <div className="h-px w-full bg-gray-200 my-2.5" />
            <p className="text-[7px] font-bold uppercase tracking-[0.15em] text-gray-400">Listing Price</p>
            <p className="text-base font-black text-[#111827] mt-0.5">${OH.price.toLocaleString()}</p>
          </div>

          {/* Right column - the real QR panel: Instant Check-In / Scan to Sign In / Quick & Easy */}
          <div className="flex-1 rounded-xl border border-[#E7E5E4] bg-[#F8F7F4] p-2.5 flex flex-col items-center text-center">
            <p className="text-[6.5px] font-bold uppercase tracking-[0.15em] text-gray-400">Instant Check-In</p>
            <p className="text-[10px] font-bold text-[#111827] mt-1">Scan to Sign In</p>
            <p className="text-[6px] text-gray-500 mt-1 leading-tight">Complete our online sign-in form.</p>

            <div className="relative mt-2">
              <div className="rounded-lg bg-white border border-gray-200 p-1.5 shadow-sm">
                <div className={`w-11 h-11 grid grid-cols-[repeat(17,1fr)] gap-[0.5px] transition-transform duration-300 ${phase === 'scanning' ? 'scale-105' : ''}`}>
                  {QR_CELLS.map((on, idx) => <div key={idx} className={on ? 'bg-[#111827]' : 'bg-white'} />)}
                </div>
              </div>

              {/* Phone scanning the real QR code */}
              <div className={`absolute -bottom-3.5 -right-4 transition-all duration-700 ${phase === 'sign' ? 'translate-y-3 translate-x-3 opacity-0' : 'translate-y-0 translate-x-0 opacity-100'}`}>
                <div className="relative w-8 h-14 rounded-lg bg-[#111827] border-2 border-gray-700 shadow-xl flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-white/20" />
                  {phase === 'scanning' && (
                    <div className="absolute inset-x-1 h-0.5 bg-[#C9A24D] shadow-[0_0_8px_2px_rgba(201,162,77,0.6)] animate-scan-line" />
                  )}
                  {phase === 'scanned' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/90 rounded-lg">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[6.5px] font-bold uppercase tracking-wide text-[#111827] mt-auto pt-3">Quick &amp; Easy</p>
            <p className="text-[5.5px] text-gray-400 mt-0.5 leading-tight">Takes about 10 seconds</p>
          </div>
        </div>
      </div>
      </div>
    </BrowserFrame>
  )
}
