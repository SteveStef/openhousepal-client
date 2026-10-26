'use client'

import { useEffect, useState } from 'react'
import NextImage from 'next/image'
import { Bell, Check, Copy, ExternalLink, Globe, Link2, Lock, Mail, MessageSquare, QrCode, Send, Shield, Star } from 'lucide-react'
import TypingAnimation from '@/components/TypingAnimation'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import DemoPointer from './DemoPointer'
import usePhoneLayout from './usePhoneLayout'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import { AGENT } from './realData'

// The real Review Hub loop, start to finish: the agent texts their review link from Reviews ->
// the client taps 5 stars on the public review page (app/[slug]/review) -> writes it once ->
// "Post on Google" copies the review and opens Google in a new tab, where it's pasted and posted
// (marked posted + saved to OpenHousePal automatically) -> the same for Zillow -> a 1-3 star
// rating never sees the Google / Zillow buttons: it goes privately to the agent as a heads-up ->
// the review showing on the Agent Hub and the IDX site's testimonials. A pointer does the clicking.
const REVIEW_TEXT = 'Peter made selling our home effortless - every step explained, every deadline met, and we closed over asking. Cannot recommend him enough.'
const PRIVATE_TEXT = 'Communication slowed down near closing.'
const REVIEWER = 'Marcus R.'
const FIRST = AGENT.name.split(' ')[0]

type Beat =
  | { k: 'title' } | { k: 'send' } | { k: 'stars' } | { k: 'write' } | { k: 'google' } | { k: 'posted' }
  | { k: 'private' } | { k: 'live' }
// A few words on what's happening, in a strip along the top.
const CAPTIONS = [
  { icon: Send, title: 'Send your review link', body: 'By text, email or QR code.' },
  { icon: Star, title: 'Happy client? 5 stars', body: 'They write it once.' },
  { icon: Copy, title: 'Posted to Google & Zillow', body: 'Already copied - they just paste.' },
  { icon: Lock, title: 'Unhappy? It stays private', body: 'Only you see it.' },
  { icon: Globe, title: 'Shown on your pages', body: 'Agent Hub and website.' },
]
const captionFor = (k: string) => (k === 'send' ? 0 : k === 'stars' || k === 'write' ? 1 : k === 'google' || k === 'posted' ? 2 : k === 'private' ? 3 : 4)

const BEATS: Beat[] = [{ k: 'title' }, { k: 'send' }, { k: 'stars' }, { k: 'write' }, { k: 'google' }, { k: 'posted' }, { k: 'private' }, { k: 'live' }]
function beatDuration(b: Beat): number | null {
  switch (b.k) {
    case 'title': return 4600
    case 'send': return 5000
    case 'stars': return 3800
    case 'write': return null // advances once the review is typed and Google is clicked
    case 'google': return 4800
    case 'posted': return 3600
    case 'private': return 7200
    case 'live': return 5400
  }
}
const TOTAL_PAGES = BEATS.length

function Avatar({ size }: { size: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-[#C9A24D]/50" style={{ width: size, height: size }}>
      <NextImage src={AGENT.photo} alt={AGENT.name} fill className="object-cover object-[50%_18%]" unoptimized />
    </div>
  )
}

function Stars({ filled, size = 20, gap = 4 }: { filled: number; size?: number; gap?: number }) {
  return (
    <div className="flex items-center" style={{ gap }}>
      {[0, 1, 2, 3, 4].map(k => (
        <Star key={k} className={`transition-all duration-200 ${k < filled ? 'scale-110 text-[#C9A24D]' : 'text-gray-300 dark:text-gray-600'}`} fill={k < filled ? '#C9A24D' : 'none'} style={{ width: size, height: size }} strokeWidth={2} />
      ))}
    </div>
  )
}

const GoogleG = () => <span className="font-black" style={{ background: 'conic-gradient(from -40deg,#EA4335 0 25%,#FBBC05 0 45%,#34A853 0 70%,#4285F4 0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>G</span>

export default function ReviewsDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const [typed, setTyped] = useState(false)
  // Phones stack the side-by-side screens, so the pointer aims at the stacked spots there.
  const phone = usePhoneLayout()
  const beat = BEATS[i]
  const advance = () => setI(n => (n + 1) % BEATS.length)

  useEffect(() => {
    setTick(0)
    setTyped(false)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const d = beatDuration(beat)
    const t = d == null ? undefined : setTimeout(advance, d)
    return () => { clearInterval(ticker); if (t) clearTimeout(t) }
  }, [i, beat])

  // 'write': once typing finishes, the pointer goes to "Post on Google", clicks, then moves on.
  const [typedAt, setTypedAt] = useState(0)
  useEffect(() => { if (typed) setTypedAt(tick) }, [typed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (beat.k !== 'write' || !typed) return
    const t = setTimeout(advance, 2600)
    return () => clearTimeout(t)
  }, [typed, beat.k])

  if (beat.k === 'title') {
    return <TitleSlide icon={Star} kicker="Reputation" title="Review Hub" body="Happy clients go to Google & Zillow. The rest stay private." durationMs={4600} totalPages={TOTAL_PAGES} url="app.openhousepal.com/studio/reviews" />
  }

  const url = beat.k === 'send' ? 'app.openhousepal.com/studio/reviews'
    : beat.k === 'google' ? 'google.com/maps · Peter Stefanatos - COMPASS RE'
    : beat.k === 'live' ? 'openhousepal.com/peter-stefanatos'
    : 'openhousepal.com/peter-stefanatos/review'
  const progress = { pages: TOTAL_PAGES, current: i, durationMs: beatDuration(beat) ?? 7000 }

  return (
    <BrowserFrame url={url} progress={progress}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className="relative h-[420px] overflow-hidden pt-[52px] bg-[radial-gradient(90%_80%_at_80%_0%,rgba(201,162,77,.14),transparent_60%),#faf8f3] dark:bg-[radial-gradient(90%_80%_at_80%_0%,rgba(201,162,77,.12),transparent_60%),#0B0B0B]">

        {(() => { const c = captionFor(beat.k); return <DemoStep id={String(c)} step={c + 1} count={CAPTIONS.length} title={CAPTIONS[c].title} body={CAPTIONS[c].body} icon={CAPTIONS[c].icon} /> })()}
        {/* 1 · the agent sends their review link */}
        {beat.k === 'send' && (
          <div className="flex h-full items-center justify-center gap-5 px-6 animate-fadeIn max-sm:flex-col max-sm:gap-0 max-sm:px-3">
            <div className="w-[300px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-[#151517] max-sm:w-full max-sm:p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Reviews · Ask for a review</p>
              <p className="mt-1 font-serif text-[16px] font-black text-[#111827] dark:text-white">Send your review link</p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#C9A24D]/50 bg-[#C9A24D]/10 p-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111827] text-[10px] font-black text-white">MR</span>
                <div className="min-w-0 flex-1"><p className="text-[11px] font-black text-[#111827] dark:text-white">{REVIEWER}</p><p className="text-[9px] font-semibold text-gray-500">Closed last week · 1534 Mount Pleasant Rd</p></div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[{ I: MessageSquare, l: 'Text' }, { I: Mail, l: 'Email' }, { I: Copy, l: 'Copy link' }, { I: QrCode, l: 'QR code' }].map((b, k) => (
                  <span key={b.l} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[9px] font-black transition-all duration-300 ${k === 0 && tick >= 7 ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-[#111827] dark:border-gray-700 dark:text-white'}`}><b.I className="h-4 w-4" />{b.l}</span>
                ))}
              </div>
              <p className="mt-2.5 flex items-center gap-1 truncate text-[9px] font-semibold text-gray-400 max-sm:hidden"><Link2 className="h-3 w-3" /> openhousepal.com/peter-stefanatos/review</p>
            </div>
            <div className={`w-[200px] transition-all duration-700 max-sm:relative max-sm:z-10 max-sm:-mt-2 max-sm:w-[260px] ${tick >= 9 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="rounded-[26px] border-[6px] border-[#111827] bg-[#f2f2f7] p-2.5 shadow-2xl max-sm:rounded-[20px] max-sm:p-2">
                <p className="text-center text-[8px] font-bold text-gray-500">Marcus R.</p>
                <div className="ml-auto mt-2 max-w-[150px] max-sm:mt-1 max-sm:max-w-none rounded-2xl rounded-br-md bg-[#0a84ff] px-2.5 py-1.5 text-[9px] leading-snug text-white">Hi Marcus - congrats again! Would you mind leaving me a quick review? It really helps. 🙏<span className="mt-1 block underline">openhousepal.com/peter-stefanatos/review</span></div>
                <p className="mt-1 text-right text-[7px] font-semibold text-gray-400">Delivered</p>
              </div>
            </div>
            <DemoPointer x={tick < 3 ? 70 : phone ? 17 : 15} y={tick < 3 ? 80 : phone ? 50 : 60} click={tick === 6 || tick === 7} />
          </div>
        )}

        {/* 2 · the client taps the stars */}
        {beat.k === 'stars' && (
          <div className="flex h-full flex-col items-center justify-center text-center animate-fadeIn">
            <Avatar size={64} />
            <p className="mt-3 font-serif text-[20px] font-black text-[#0B0B0B] dark:text-white">How was working with {FIRST}?</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-400">Tap a star to leave a quick review.</p>
            <div className="mt-4"><Stars filled={Math.max(0, Math.min(5, tick - 3))} size={34} gap={8} /></div>
            <p className={`mt-3 text-[11px] font-black text-[#8b6a2b] transition-opacity duration-300 dark:text-[#e8c97a] ${tick >= 9 ? 'opacity-100' : 'opacity-0'}`}>Thank you! One more step…</p>
            <DemoPointer x={tick < 3 ? 70 : 36 + Math.min(5, Math.max(0, tick - 3)) * 5.6} y={tick < 3 ? 85 : 64} click={tick === 8 || tick === 9} />
          </div>
        )}

        {/* 3 · writes it once, then Post on Google copies it */}
        {beat.k === 'write' && (
          <div className="flex h-full items-center justify-center animate-fadeIn max-sm:px-3">
            <div className="w-[380px] max-sm:w-full">
              <div className="flex items-center gap-2.5 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2.5">
                <Avatar size={36} />
                <div className="min-w-0"><Stars filled={5} size={13} /><p className="mt-0.5 truncate text-[11px] font-black text-[#0B0B0B] dark:text-white">A 5-star review for {AGENT.name}</p></div>
              </div>
              <div className="mt-2.5 min-h-[74px] rounded-xl border-2 border-[#C9A24D] bg-white p-3 text-[11px] leading-snug text-[#111827] dark:bg-[#151517] dark:text-gray-200">
                <TypingAnimation text={REVIEW_TEXT} speed={22} onComplete={() => setTyped(true)} />
              </div>
              <p className="mt-2.5 text-center text-[10px] font-bold text-gray-500 dark:text-gray-400">{typed && tick - typedAt >= 5 ? 'Copied - just paste it on Google' : 'Post it where clients look:'}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <span className={`relative flex items-center justify-center gap-1.5 rounded-xl border-2 py-3 text-[12px] font-black transition-all duration-200 ${typed && tick - typedAt >= 5 ? 'scale-95 border-[#4285F4] bg-[#4285F4] text-white' : 'border-[#4285F4]/50 bg-white text-[#4285F4] dark:bg-[#151517]'}`}><GoogleG /> Post on Google <ExternalLink className="h-3 w-3" /></span>
                <span className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#006AFF]/50 bg-white py-3 text-[12px] font-black text-[#006AFF] dark:bg-[#151517]">Z Post on Zillow <ExternalLink className="h-3 w-3" /></span>
              </div>
              {typed && tick - typedAt >= 5 && <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-black text-emerald-600 animate-fadeIn"><Check className="h-3.5 w-3.5" /> Review copied · saved to {FIRST}&apos;s page</p>}
            </div>
            <DemoPointer x={typed ? (phone ? 26 : 31) : 75} y={typed ? 68 : 92} click={typed && tick - typedAt >= 4 && tick - typedAt <= 6} show={typed} />
          </div>
        )}

        {/* 4 · Google opens in a new tab: paste, post */}
        {beat.k === 'google' && (
          <div className="flex h-full items-center justify-center bg-white animate-fadeIn dark:bg-[#202124] max-sm:px-3">
            <div className="w-[380px] max-sm:w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-[#2d2e31]">
              <div className="flex items-center gap-2.5">
                <Avatar size={34} />
                <div><p className="text-[12px] font-bold text-[#202124] dark:text-white">{AGENT.name} - {AGENT.brokerage}</p><p className="text-[9px] text-gray-500">Real estate agent · Posting publicly</p></div>
              </div>
              <div className="mt-3"><Stars filled={5} size={24} gap={6} /></div>
              <div className="mt-3 min-h-[76px] rounded-lg border border-gray-300 p-2.5 text-[10.5px] leading-snug text-[#202124] dark:border-gray-600 dark:text-gray-100">
                {tick >= 5 ? <span className="animate-fadeIn">{REVIEW_TEXT}</span> : <span className="text-gray-400">Share details of your own experience…</span>}
              </div>
              {tick >= 3 && tick < 6 && <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-[#202124] px-1.5 py-0.5 text-[9px] font-bold text-white animate-fadeIn">Paste <span className="text-white/50">Ctrl+V</span></p>}
              <div className="mt-3 flex justify-end gap-2">
                <span className="px-3 py-1.5 text-[11px] font-bold text-[#1a73e8]">Cancel</span>
                <span className={`rounded-full px-4 py-1.5 text-[11px] font-bold text-white transition-all duration-200 ${tick >= 11 ? 'scale-95 bg-[#1557b0]' : 'bg-[#1a73e8]'}`}>{tick >= 12 ? 'Posted ✓' : 'Post'}</span>
              </div>
            </div>
            <DemoPointer x={tick < 8 ? 45 : 74} y={tick < 8 ? 50 : 69} click={(tick >= 3 && tick <= 4) || (tick >= 11 && tick <= 12)} />
          </div>
        )}

        {/* 5 · marked posted automatically */}
        {beat.k === 'posted' && (
          <div className="flex h-full flex-col items-center justify-center text-center animate-fadeIn">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"><Check className="h-7 w-7 text-white" strokeWidth={3} /></div>
            <p className="mt-3 font-serif text-[20px] font-black text-[#0B0B0B] dark:text-white">Thank you, Marcus!</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-400">Marked posted for {FIRST} automatically - nothing to report back.</p>
            <div className="mt-4 w-[300px] space-y-2">
              {[['Google', '#4285F4', true], ['Zillow', '#006AFF', tick >= 6], [`${FIRST}'s Agent Hub`, '#C9A24D', true]].map(([n, c, on]) => (
                <div key={n as string} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-[12px] font-black transition-all duration-500 ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-400' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{n}</span>
                  <span className="inline-flex items-center gap-1">{on ? <><Check className="h-4 w-4" /> Posted</> : 'Next…'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6 · 1-3 stars: private, never public */}
        {beat.k === 'private' && (
          <div className="flex h-full items-center justify-center gap-5 px-6 animate-fadeIn max-sm:px-3">
            <div className="w-[300px] text-center max-sm:w-full">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">A different client</p>
              <p className="mt-1 font-serif text-[17px] font-black text-[#0B0B0B] dark:text-white">How was working with {FIRST}?</p>
              <div className="mt-2 flex justify-center"><Stars filled={tick >= 4 ? 2 : Math.min(2, Math.max(0, tick - 2))} size={28} gap={7} /></div>
              {tick >= 6 && (
                <div className="mt-3 animate-fadeIn text-left">
                  <p className="text-[11px] font-black text-[#0B0B0B] dark:text-white">Sorry to hear that. What could {FIRST} have done better?</p>
                  <div className="mt-1.5 min-h-[44px] rounded-xl border-2 border-gray-300 bg-white p-2 text-[10.5px] text-[#111827] dark:border-gray-600 dark:bg-[#151517] dark:text-gray-200"><TypingAnimation text={PRIVATE_TEXT} speed={30} /></div>
                  <p className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-gray-500"><Lock className="h-3 w-3" /> Sent privately to {FIRST} - no Google or Zillow buttons here.</p>
                  <span className={`mt-2 flex items-center justify-center gap-1 rounded-xl bg-[#111827] py-2 text-[11px] font-black text-white transition-transform dark:bg-white dark:text-[#111827] ${tick >= 17 && tick <= 18 ? 'scale-95' : ''}`}><Send className="h-3.5 w-3.5" /> Send to {FIRST}</span>
                </div>
              )}
            </div>
            {/* Phones: no room beside the form, so the agent's heads-up slides in over its bottom. */}
            <div className={`w-[210px] transition-all duration-700 max-sm:absolute max-sm:inset-x-3 max-sm:bottom-3 max-sm:z-30 max-sm:w-auto ${tick >= 19 ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}`}>
              <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-[#151517]">
                <p className="flex items-center gap-1.5 text-[11px] font-black text-[#111827] dark:text-white"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Bell className="h-3 w-3" /></span>Private feedback · 2★</p>
                <p className="mt-1.5 text-[10px] italic leading-snug text-gray-600 dark:text-gray-300">&ldquo;{PRIVATE_TEXT}&rdquo;</p>
                <p className="mt-2 flex items-center gap-1 rounded-lg bg-[#C9A24D]/10 px-2 py-1 text-[9px] font-bold text-[#8b6a2b] dark:text-[#e8c97a]"><Shield className="h-3 w-3" /> Only you see this - a chance to make it right.</p>
                <p className="mt-1.5 text-[9px] font-semibold text-gray-400">Follow-up added: Reach out tomorrow</p>
              </div>
            </div>
            <DemoPointer x={tick < 2 ? 30 : tick < 13 ? 25 : 30} y={tick < 2 ? 85 : tick < 13 ? 38 : 71} click={(tick >= 3 && tick <= 4) || (tick >= 17 && tick <= 18)} />
          </div>
        )}

        {/* 7 · the reviews on the Agent Hub + IDX site */}
        {beat.k === 'live' && (
          <div className="flex h-full items-center justify-center gap-4 px-6 animate-fadeIn max-sm:flex-col max-sm:gap-2.5 max-sm:px-3">
            <div className="w-[270px] max-sm:w-full">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">On your Agent Hub</p>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#C9A24D]/30 bg-white p-3 shadow-sm dark:bg-[#151517] max-sm:mt-1.5 max-sm:p-2">
                <div className="text-center"><p className="font-serif text-[28px] font-black leading-none text-[#0B0B0B] dark:text-white">5.0</p><div className="mt-1"><Stars filled={5} size={11} gap={2} /></div></div>
                <div className="h-10 w-px bg-gray-100 dark:bg-gray-800" />
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">13 client reviews · incl. your Google reviews, imported</p>
              </div>
              <div className="mt-2 rounded-xl border border-[#C9A24D]/30 bg-white p-3 shadow-sm dark:bg-[#151517] max-sm:mt-1.5 max-sm:p-2.5">
                <div className="flex items-center justify-between"><p className="text-[11px] font-black text-[#0B0B0B] dark:text-white">{REVIEWER}</p><Stars filled={5} size={11} gap={2} /></div>
                <p className="mt-1 text-[10px] leading-snug text-gray-600 dark:text-gray-300 max-sm:line-clamp-2">{REVIEW_TEXT}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><Check className="h-2.5 w-2.5" /> Also on Google &amp; Zillow</p>
              </div>
            </div>
            <div className={`w-[230px] transition-all duration-700 max-sm:w-full ${tick >= 6 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">And your IDX website</p>
              <div className="mt-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218] p-4 text-white shadow-xl max-sm:mt-1.5 max-sm:p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">What clients say</p>
                <p className="mt-2 font-serif text-[13px] italic leading-snug max-sm:mt-1 max-sm:text-[12px]">&ldquo;Every step explained, every deadline met, and we closed over asking.&rdquo;</p>
                <div className="mt-2 flex items-center justify-between"><p className="text-[10px] font-bold text-white/70">- {REVIEWER}</p><Stars filled={5} size={10} gap={2} /></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
