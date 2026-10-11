'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { Bell, CalendarCheck, Check, MapPin, Search, Send, UserPlus } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import TypingAnimation from '@/components/TypingAnimation'
import DemoCursor from './DemoCursor'
import { DemoCaption, DemoNote, DEMO_NOTE_CSS, STAGE_BG } from './DemoNote'
import { DEMO_PLACEHOLDER_PHOTOS as PH } from './realData'

// Open House Discovery, told like the Agent Hub demo: one screen, a note beside it, one part
// outlined in gold. Find other agents' listings near you -> a new one lists and you're alerted ->
// ask to host it (pick a time, send) -> the listing agent approves -> the guests who sign in at
// your open are your leads (an approved host runs the open as their own event).
type Stop = 'search' | 'alert' | 'ask' | 'approved' | 'leads'
const STOPS: { id: Stop; hold: number; icon: LucideIcon; title: string; body: string }[] = [
  { id: 'search', hold: 5600, icon: Search, title: 'Find opens to host', body: 'Other agents’ listings near you.' },
  { id: 'alert', hold: 4800, icon: Bell, title: 'New one? You’ll know', body: 'An alert the moment it lists.' },
  { id: 'ask', hold: 7200, icon: Send, title: 'Ask to host in one click', body: 'Pick a time. We ask the agent.' },
  { id: 'approved', hold: 4800, icon: CalendarCheck, title: 'Approved!', body: 'You’re hosting Saturday.' },
  { id: 'leads', hold: 6000, icon: UserPlus, title: 'Every guest is your lead', body: 'They sign in. You follow up.' },
]
type Beat = { k: 'title' } | { k: 'stop'; n: number }
const BEATS: Beat[] = [{ k: 'title' }, ...STOPS.map((_, n) => ({ k: 'stop' as const, n }))]
const TITLE_MS = 5200
const beatDuration = (b: Beat) => (b.k === 'title' ? TITLE_MS : STOPS[b.n].hold)

const NEW = { address: '6 Rosemont Ave', price: '$829,000', agent: 'Alicia Ruiz', photo: PH[2] }
const OTHERS = [
  { address: '118 Cedar Ct', price: '$875,000', agent: 'Mike Torres', photo: PH[0] },
  { address: '42 Willow Way', price: '$712,000', agent: 'Dana Price', photo: PH[1] },
]
const GUESTS = [
  { name: 'Sarah Kim', note: 'No agent' },
  { name: 'David & Priya Shah', note: 'No agent' },
  { name: 'Tom Becker', note: 'Has an agent' },
]

function Row({ l, isNew = false, children }: { l: typeof NEW; isNew?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border bg-white p-2 dark:bg-[#151517] ${isNew ? 'dn-pop border-[#C9A24D] shadow-[0_0_0_3px_rgba(201,162,77,.2)]' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative h-12 w-14 flex-shrink-0 overflow-hidden rounded-lg">
          <Image src={l.photo} alt={l.address} fill className="object-cover" unoptimized />
          {isNew && <span className="absolute left-1 top-1 rounded bg-emerald-500 px-1 text-[7px] font-black uppercase text-white">New</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-black text-[#111827] dark:text-white">{l.address} · {l.price}</p>
          <p className="truncate text-[9.5px] font-semibold text-gray-500">Listed by {l.agent}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function DiscoveryDemo() {
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
    return <TitleSlide icon={Search} iconClassName="ohp-icon-assemble-search" kicker="Open House Tools" title="Open House Discovery" body="Host other agents' open houses - and keep the leads." nowrapBody durationMs={TITLE_MS} totalPages={BEATS.length} pageIndex={0} url="app.openhousepal.com/discovery" />
  }

  const stop = STOPS[beat.n]
  const n = beat.n
  const idx = (id: Stop) => STOPS.findIndex(s => s.id === id)
  const showNew = n > idx('search') && !(stop.id === 'alert' && tick < 3)
  const asked = stop.id === 'ask' ? tick >= 9 : n > idx('ask')
  const picked = stop.id === 'ask' ? tick >= 14 : n > idx('ask')
  const sent = stop.id === 'ask' ? tick >= 22 : n > idx('ask')
  const approved = n >= idx('approved')
  const leads = stop.id === 'leads'

  // Where the pointer is headed during "ask": Request -> the Saturday slot -> Send.
  const cursorTarget = stop.id !== 'ask' ? null
    : tick >= 2 && tick < 9 ? '[data-cursor="request"]'
    : tick >= 10 && tick < 15 ? '[data-cursor="slot"]'
    : tick >= 16 && tick < 22 ? '[data-cursor="send"]' : null
  const clicking = stop.id === 'ask' && ((tick >= 7 && tick < 9) || (tick >= 13 && tick < 15) || (tick >= 20 && tick < 22))
  const hl = (on: boolean) => (on ? 'dn-on' : 'dn-off')

  return (
    <BrowserFrame url="app.openhousepal.com/discovery" progress={{ pages: BEATS.length, current: 1 + n, durationMs: stop.hold }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div className={`relative flex h-[420px] items-center justify-center gap-5 overflow-hidden px-4 ${STAGE_BG}`}>
        <DemoNote id={stop.id} icon={stop.icon} title={stop.title} body={stop.body} index={n} count={STOPS.length} />

        <div ref={stage} className="relative h-[380px] w-full max-w-[360px] flex-shrink-0 overflow-hidden rounded-2xl border border-black/5 bg-[#FAFAF7] p-3.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)] dark:border-white/10 dark:bg-[#0B0B0B]">
          {leads ? (
            <div key="leads" className="animate-fadeIn">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Your Leads</p>
              <p className="mt-0.5 text-[13px] font-black text-[#111827] dark:text-white">Signed in at {NEW.address}</p>
              <div className="dn-hl dn-on mt-2.5 space-y-1.5 rounded-xl">
                {GUESTS.filter((_, k) => tick >= 2 + k * 5).map(g => (
                  <div key={g.name} className="dn-pop flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#151517]">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b6f2e] text-[12px] font-black text-white">{g.name[0]}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-black text-[#111827] dark:text-white">{g.name}</p><p className="text-[9.5px] font-semibold text-gray-500">{g.note} · follow-up set</p></div>
                    <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[8.5px] font-black uppercase text-[#8b7355]">New</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key="list">
              <div className={`dn-hl flex items-center gap-2 rounded-xl border-2 border-[#C9A24D] bg-white px-3 py-2 dark:bg-[#151517] ${stop.id === 'search' ? 'dn-on' : ''}`}>
                <MapPin className="h-3.5 w-3.5 text-[#C9A24D]" />
                <span className="text-[11.5px] font-bold text-[#111827] dark:text-white">{stop.id === 'search' ? <TypingAnimation text="Villanova, PA" speed={70} /> : 'Villanova, PA'}</span>
                <span className="ml-auto text-[10px] font-black text-gray-400">5 mi</span>
              </div>
              <p className="mb-1.5 mt-3 text-[9px] font-black uppercase tracking-widest text-gray-400">Need a host this weekend</p>

              <div className="space-y-1.5">
                {showNew && (
                  <div className={`dn-hl rounded-xl ${hl(stop.id !== 'search')}`}>
                    <Row l={NEW} isNew>
                      {approved ? (
                        <span className="dn-pop flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[9.5px] font-black text-white"><Check className="h-3 w-3" strokeWidth={3} />Hosting Sat</span>
                      ) : sent ? (
                        <span className="rounded-lg bg-amber-400 px-2 py-1.5 text-[9.5px] font-black text-[#111827]">Pending</span>
                      ) : (
                        <span data-cursor="request" className={`rounded-lg bg-[#111827] px-2 py-1.5 text-[9.5px] font-black text-white transition-transform dark:bg-white dark:text-[#111827] ${stop.id === 'ask' && tick >= 7 && tick < 9 ? 'scale-95' : ''}`}>Request to Host</span>
                      )}
                    </Row>
                    {asked && !sent && (
                      <div className="dn-rise mt-1.5 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-[#151517]">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">When can you host?</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          <span data-cursor="slot" className={`rounded-lg border-2 px-2 py-1.5 text-center text-[10.5px] font-black transition-colors ${picked ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 dark:border-gray-700'}`}>Sat 10 · 1-3 PM</span>
                          <span className="rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-[10.5px] font-black text-gray-500 dark:border-gray-700">Sun 11 · 12-2 PM</span>
                        </div>
                        <span data-cursor="send" className={`mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-black transition-all ${picked ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-200 text-gray-400 dark:bg-gray-800'} ${tick >= 20 ? 'scale-95' : ''}`}><Send className="h-3 w-3" /> Send to {NEW.agent.split(' ')[0]}</span>
                      </div>
                    )}
                  </div>
                )}
                {OTHERS.filter((_, k) => stop.id !== 'search' || tick >= 6 + k * 3).map(l => (
                  <div key={l.address} className={`dn-hl dn-pop rounded-xl ${stop.id === 'search' ? 'dn-on' : 'dn-off'}`}>
                    <Row l={l}><span className="rounded-lg bg-[#111827] px-2 py-1.5 text-[9.5px] font-black text-white dark:bg-white dark:text-[#111827]">Request to Host</span></Row>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stop.id === 'alert' && tick >= 3 && (
            <div className="dn-toast absolute inset-x-3 bottom-3 z-20 flex items-center gap-2.5 rounded-xl bg-[#111827] p-2.5 shadow-xl">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#C9A24D] text-[#111827]"><Bell className="h-4 w-4" /></span>
              <p className="text-[11px] font-black text-white">New listing near you<span className="block text-[9.5px] font-semibold text-gray-400">{NEW.address} needs a host</span></p>
            </div>
          )}
          {stop.id === 'approved' && tick >= 2 && (
            <div className="dn-toast absolute inset-x-3 bottom-3 z-20 flex items-center gap-2.5 rounded-xl bg-[#111827] p-2.5 shadow-xl">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
              <p className="text-[11px] font-black text-white">{NEW.agent} approved<span className="block text-[9.5px] font-semibold text-gray-400">You&apos;re hosting Sat, Oct 10 · 1-3 PM</span></p>
            </div>
          )}

          <DemoCursor container={stage} target={cursorTarget} click={clicking} />
        </div>
        <DemoCaption key={`cap-${stop.id}`} title={stop.title} body={stop.body} />
      </div>
    </BrowserFrame>
  )
}
