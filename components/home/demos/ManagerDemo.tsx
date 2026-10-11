'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Bell, Building2, CalendarDays, Check, MessageSquare, UserCheck } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import TypingAnimation from '@/components/TypingAnimation'
import DemoCursor from './DemoCursor'
import { DemoCaption, DemoNote, DEMO_NOTE_CSS, STAGE_BG } from './DemoNote'
import { REAL_OPEN_HOUSE as OH } from './realData'

// Open House Manager, told like the Agent Hub demo: one listing on one screen, a note beside it
// says what's happening, and that one part gets the gold outline. Your Saturday open needs a host
// -> another agent asks to host it -> you approve with one click -> you leave them notes -> after
// the open you see how it went. (The host's guests are the host's leads - see DiscoveryDemo.)
type Stop = 'weekend' | 'request' | 'approve' | 'notes' | 'results'
const STOPS: { id: Stop; hold: number; icon: LucideIcon; title: string; body: string }[] = [
  { id: 'weekend', hold: 5000, icon: CalendarDays, title: 'Your open houses', body: 'See who’s hosting each one.' },
  { id: 'request', hold: 5000, icon: Bell, title: 'An agent asks to host', body: 'You get a heads-up.' },
  { id: 'approve', hold: 5400, icon: UserCheck, title: 'Approve in one click', body: 'Your open is covered.' },
  { id: 'notes', hold: 6000, icon: MessageSquare, title: 'Leave them notes', body: 'Lockbox, parking, timing.' },
  { id: 'results', hold: 6000, icon: BarChart3, title: 'See how it went', body: 'Guests, and who needs an agent.' },
]
type Beat = { k: 'title' } | { k: 'stop'; n: number }
const BEATS: Beat[] = [{ k: 'title' }, ...STOPS.map((_, n) => ({ k: 'stop' as const, n }))]
const TITLE_MS = 5200
const beatDuration = (b: Beat) => (b.k === 'title' ? TITLE_MS : STOPS[b.n].hold)
const NOTE = 'Lockbox is on the side gate. Please park on the street.'

function Avatar({ letter, size = 28 }: { letter: string; size?: number }) {
  return <span className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b6f2e] font-black text-white" style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</span>
}

// The part of the screen each stop is about (gets the gold outline; the rest dims).
const FOCUS: Record<Stop, string> = { weekend: 'weekend', request: 'request', approve: 'request', notes: 'notes', results: 'results' }

export default function ManagerDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const beat = BEATS[i]

  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const t = setTimeout(() => setI(n => (n + 1) % BEATS.length), beatDuration(beat))
    return () => { clearTimeout(t); clearInterval(ticker) }
  }, [i, beat])

  if (beat.k === 'title') {
    return <TitleSlide icon={Building2} kicker="Open House Tools" title="Open House Manager" body="Get your open houses hosted - and see how they went." nowrapBody durationMs={TITLE_MS} totalPages={BEATS.length} pageIndex={0} url="app.openhousepal.com/open-houses/my-listings" />
  }

  const stop = STOPS[beat.n]
  const pastApprove = beat.n > STOPS.findIndex(s => s.id === 'approve')
  const showRequest = (stop.id === 'request' && tick >= 3) || (stop.id === 'approve' && tick < 10)
  const approved = (stop.id === 'approve' && tick >= 10) || pastApprove
  const done = stop.id === 'results'
  const hl = (id: string) => (id === FOCUS[stop.id] ? 'dn-on' : 'dn-off')

  const sat = done ? { tone: 'border-emerald-300 bg-emerald-50 text-emerald-700', label: 'Done · Jane hosted' }
    : approved ? { tone: 'border-emerald-300 bg-emerald-50 text-emerald-700', label: 'Jane Doe hosting' }
    : showRequest ? { tone: 'border-orange-300 bg-orange-50 text-orange-700', label: '1 request' }
    : { tone: 'border-orange-300 bg-orange-50 text-orange-700', label: 'Needs a host' }

  return (
    <BrowserFrame url="app.openhousepal.com/open-houses/my-listings" progress={{ pages: BEATS.length, current: 1 + beat.n, durationMs: stop.hold }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className={`relative flex h-[420px] items-center justify-center gap-5 overflow-hidden px-4 ${STAGE_BG}`}>
        <DemoNote id={stop.id} icon={stop.icon} title={stop.title} body={stop.body} index={beat.n} count={STOPS.length} />

        <div ref={stage} className="relative h-[380px] w-full max-w-[360px] flex-shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-[#FAFAF7] p-3.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)] dark:border-white/10 dark:bg-[#0B0B0B]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Open House Manager</p>

          {/* the listing + this weekend */}
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
            <div className="relative h-[92px]">
              <Image src={OH.photo} alt={OH.address} fill className="object-cover" unoptimized />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-1.5 left-2.5 text-white"><span className="block text-[14px] font-black">${OH.price.toLocaleString()}</span><span className="block text-[9px] font-bold opacity-85">{OH.address}, {OH.city}</span></span>
            </div>
            <div className={`dn-hl m-2 grid grid-cols-2 gap-1.5 rounded-lg ${hl('weekend')}`}>
              <div className={`rounded-lg border px-2 py-1.5 transition-colors duration-500 ${sat.tone}`}>
                <p className="text-[8px] font-black uppercase tracking-wide opacity-70">Sat, Oct 10 · 1-3 PM</p>
                <p className="flex items-center gap-1 text-[11px] font-black">{approved && <Check className="h-3 w-3" strokeWidth={3} />}{sat.label}</p>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-emerald-700">
                <p className="text-[8px] font-black uppercase tracking-wide opacity-70">Sun, Oct 11 · 12-2 PM</p>
                <p className="flex items-center gap-1 text-[11px] font-black"><Check className="h-3 w-3" strokeWidth={3} />You&apos;re hosting</p>
              </div>
            </div>
          </div>

          {/* what changes below the listing */}
          <div className="mt-2.5">
            {showRequest && (
              <div className={`dn-pop dn-hl rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517] ${hl('request')}`}>
                <p className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest text-orange-600"><Bell className="h-3 w-3" /> Host request</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar letter="J" />
                  <p className="min-w-0 flex-1 text-[11.5px] font-black leading-tight text-[#111827] dark:text-white">Jane Doe wants to host<span className="block text-[9.5px] font-semibold text-gray-500">Sat, Oct 10 · 1-3 PM</span></p>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <span className="rounded-lg border border-gray-200 py-1.5 text-center text-[10.5px] font-black text-gray-500 dark:border-gray-700">Decline</span>
                  <span data-cursor="approve" className={`rounded-lg bg-[#C9A24D] py-1.5 text-center text-[10.5px] font-black text-[#111827] transition-transform duration-150 ${stop.id === 'approve' && tick >= 8 ? 'scale-95' : ''}`}>Approve</span>
                </div>
              </div>
            )}

            {stop.id === 'approve' && approved && (
              <div className="dn-toast flex items-center gap-2.5 rounded-xl bg-[#111827] p-3 shadow-xl">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
                <p className="text-[11.5px] font-black text-white">Approved<span className="block text-[9.5px] font-semibold text-gray-400">Jane is hosting Saturday</span></p>
              </div>
            )}

            {stop.id === 'notes' && (
              <div className={`dn-pop dn-hl rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517] ${hl('notes')}`}>
                <div className="flex items-center gap-2"><Avatar letter="J" size={24} /><p className="text-[11px] font-black text-[#111827] dark:text-white">Note for Jane</p></div>
                <p className="mt-2 min-h-[44px] rounded-lg border border-[#C9A24D]/50 bg-[#FAFAF7] px-2.5 py-2 text-[11px] font-semibold leading-snug text-[#111827] dark:bg-[#0B0B0B] dark:text-gray-200">{tick >= 2 ? <TypingAnimation text={NOTE} speed={45} /> : ''}</p>
                {tick >= 17 && <p className="dn-rise mt-1.5 flex items-center gap-1 text-[9.5px] font-black text-emerald-600"><Check className="h-3 w-3" strokeWidth={3} /> Saved - Jane can see it</p>}
              </div>
            )}

            {done && (
              <div className={`dn-pop dn-hl rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517] ${hl('results')}`}>
                <p className="text-[8.5px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Saturday&apos;s open</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  {[['11', 'Guests'], ['4', 'No agent'], ['2h', 'Open']].map(([v, l], k) => (
                    <div key={l} className="dn-pop rounded-lg bg-[#FAFAF7] py-2 dark:bg-[#0B0B0B]" style={{ animationDelay: `${200 + k * 150}ms` }}><p className="text-[17px] font-black text-[#111827] dark:text-white">{v}</p><p className="text-[8px] font-black uppercase tracking-wide text-gray-400">{l}</p></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DemoCursor container={stage} target={stop.id === 'approve' && tick >= 2 && tick < 10 ? '[data-cursor="approve"]' : null} click={stop.id === 'approve' && tick >= 7 && tick < 10} />
        </div>
        <DemoCaption key={`cap-${stop.id}`} title={stop.title} body={stop.body} />
      </div>
    </BrowserFrame>
  )
}
