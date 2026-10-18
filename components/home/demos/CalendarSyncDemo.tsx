'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Bell, CalendarClock, Check, Inbox, KeyRound, Mail, RefreshCw, Send, UserRound } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import DemoPointer from './DemoPointer'
import { REAL_OPEN_HOUSE as OH, REAL_SPOTLIGHT } from './realData'

// The real Calendar & CRM tools (Tools -> Calendar, Tools -> Integrations), as an agent uses them:
// connect Google once (Outlook works the same) -> open houses and confirmed tours land on an
// "OpenHousePal" calendar next to your own events -> a new sign-in gets a whole-day "[Reach Out]"
// follow-up that buzzes your phone -> it's two-way: drag it in Google and OpenHousePal moves too ->
// pick your CRM (the real list), connect it, send a test lead -> every new lead is pushed there with
// its source -> portal leads forwarded from Zillow etc. land in your Leads. A pointer does the work.

type Beat =
  | { k: 'title' } | { k: 'connect' } | { k: 'week' } | { k: 'followup' } | { k: 'drag' }
  | { k: 'crm' } | { k: 'push' } | { k: 'portal' }
const BEATS: Beat[] = [{ k: 'title' }, { k: 'connect' }, { k: 'week' }, { k: 'followup' }, { k: 'drag' }, { k: 'crm' }, { k: 'push' }, { k: 'portal' }]
const DUR: Record<Beat['k'], number> = { title: 4400, connect: 5200, week: 5200, followup: 5600, drag: 5600, crm: 6800, push: 5400, portal: 5400 }
const TOTAL_PAGES = BEATS.length

const CRMS = ['Follow Up Boss', 'Lofty', 'kvCORE / BoldTrail', 'Sierra Interactive', 'BoomTown', 'Real Geeks', 'Wise Agent', 'LionDesk', 'Another CRM']

function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.9 5.1 29.7 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.9 5.1 29.7 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.3l-6.2-5.2C29.1 36.2 26.7 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 40.6 16.2 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.9 36.6 45 30.1 45 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  )
}
function MicrosoftMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022" /><rect x="12" y="1" width="10" height="10" fill="#7FBA00" /><rect x="1" y="12" width="10" height="10" fill="#00A4EF" /><rect x="12" y="12" width="10" height="10" fill="#FFB900" /></svg>
  )
}

// A Google-Calendar-style week (Thu-Sun, 10 AM - 5 PM). Events are placed by hour.
const DAYS = ['Thu 9', 'Fri 10', 'Sat 11', 'Sun 12']
const HOURS = ['10 AM', '11', '12 PM', '1', '2', '3', '4']
const ROW = 30
type Ev = { day: number; start: number; end: number; label: string; sub?: string; tone: 'gold' | 'gray' | 'navy'; enter?: boolean; ghost?: boolean }
function Week({ events, allDay, sidebar = true }: { events: Ev[]; allDay?: { day: number; label: string; enter?: boolean }[]; sidebar?: boolean }) {
  return (
    <div className="flex h-full gap-3">
      {sidebar && (
        <div className="w-[118px] shrink-0 pt-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">My calendars</p>
          {[['Peter Stefanatos', '#4285F4', false], ['OpenHousePal', '#C9A24D', true]].map(([n, c, gold]) => (
            <p key={n as string} className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-bold ${gold ? 'text-[#8b6a2b] dark:text-[#e8c97a]' : 'text-gray-600 dark:text-gray-300'}`}><span className="flex h-3 w-3 items-center justify-center rounded-[3px]" style={{ background: c as string }}><Check className="h-2 w-2 text-white" strokeWidth={4} /></span>{n}</p>
          ))}
          <p className="mt-3 rounded-lg bg-[#C9A24D]/10 p-2 text-[9px] font-semibold leading-snug text-[#6b5530] dark:text-[#e8c97a]">Open houses, tours and follow-ups fill this in by themselves.</p>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
        <div className="grid grid-cols-[34px_repeat(4,1fr)] border-b border-gray-100 dark:border-gray-800">
          <span />
          {DAYS.map(d => <p key={d} className="py-1.5 text-center text-[10px] font-black uppercase tracking-wide text-gray-500">{d}</p>)}
        </div>
        <div className="grid min-h-[24px] grid-cols-[34px_repeat(4,1fr)] border-b border-gray-100 dark:border-gray-800">
          <span className="self-center pr-1 text-right text-[7px] font-bold text-gray-400">all day</span>
          {DAYS.map((_, k) => (
            <div key={k} className="p-0.5">
              {(allDay || []).filter(a => a.day === k).map(a => <div key={a.label} className={`${a.enter ? 'animate-fadeIn' : ''} truncate rounded bg-[#111827] px-1.5 py-0.5 text-[8.5px] font-black text-white dark:bg-white dark:text-[#111827]`}>{a.label}</div>)}
            </div>
          ))}
        </div>
        <div className="relative grid flex-1 grid-cols-[34px_repeat(4,1fr)]">
          <div>{HOURS.map(h => <p key={h} className="pr-1 text-right text-[7px] font-bold text-gray-400" style={{ height: ROW }}>{h}</p>)}</div>
          {DAYS.map((_, k) => (
            <div key={k} className="relative border-l border-gray-100 dark:border-gray-800" style={{ backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${ROW - 1}px, rgba(0,0,0,.05) ${ROW - 1}px ${ROW}px)` }}>
              {events.filter(e => e.day === k).map(e => (
                <div key={e.label + e.day}
                  className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 shadow-sm transition-all duration-700 ${e.enter ? 'animate-fadeIn' : ''} ${e.ghost ? 'opacity-40 ring-2 ring-dashed ring-[#C9A24D]' : ''} ${e.tone === 'gold' ? 'bg-[#C9A24D] text-[#111827]' : e.tone === 'navy' ? 'bg-[#111827] text-white' : 'bg-[#4285F4]/15 text-[#1a56c2]'}`}
                  style={{ top: (e.start - 10) * ROW + 1, height: (e.end - e.start) * ROW - 2 }}>
                  <p className="truncate text-[9px] font-black leading-tight">{e.label}</p>
                  {e.sub && <p className="truncate text-[7.5px] font-semibold opacity-75">{e.sub}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Caption({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 animate-fadeIn">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="font-serif text-[17px] font-black leading-tight text-[#111827] dark:text-white">{title}</p><p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{body}</p></div>
    </div>
  )
}

export default function CalendarSyncDemo() {
  const [i, setI] = useState(0)
  const [tick, setTick] = useState(0)
  const beat = BEATS[i]

  useEffect(() => {
    setTick(0)
    const ticker = setInterval(() => setTick(t => t + 1), 250)
    const t = setTimeout(() => setI(n => (n + 1) % BEATS.length), DUR[beat.k])
    return () => { clearInterval(ticker); clearTimeout(t) }
  }, [i, beat])

  if (beat.k === 'title') {
    return <TitleSlide icon={CalendarClock} iconClassName="ohp-icon-assemble-calendar" kicker="Two-Way Sync" title="Calendar & CRM Sync" body="Tie OpenHousePal to your calendar & CRM" nowrapBody durationMs={DUR.title} totalPages={TOTAL_PAGES} url="app.openhousepal.com/studio/calendar" />
  }

  const url = beat.k === 'connect' ? 'app.openhousepal.com/studio/calendar'
    : beat.k === 'crm' || beat.k === 'portal' ? 'app.openhousepal.com/studio/integrations'
    : beat.k === 'push' ? 'app.followupboss.com/people'
    : 'calendar.google.com'
  const progress = { pages: TOTAL_PAGES, current: i, durationMs: DUR[beat.k] }

  const openHouse: Ev = { day: 2, start: 13, end: 15, label: `Open House · ${OH.address}`, sub: `${OH.city} · 1-3 PM`, tone: 'gold' }
  const tour: Ev = { day: 3, start: 11, end: 12, label: `Tour · ${REAL_SPOTLIGHT.address}`, sub: 'Confirmed from a Showcase', tone: 'gold' }
  const personal: Ev[] = [{ day: 1, start: 14, end: 15, label: 'Dentist', tone: 'gray' }, { day: 0, start: 10, end: 11, label: 'Team meeting', tone: 'gray' }]

  return (
    <BrowserFrame url={url} progress={progress}>
      <div className="relative h-[420px] overflow-hidden bg-[radial-gradient(90%_80%_at_85%_0%,rgba(201,162,77,.12),transparent_60%),#faf8f3] p-5 dark:bg-[radial-gradient(90%_80%_at_85%_0%,rgba(201,162,77,.1),transparent_60%),#0B0B0B]">

        {/* 1 · connect once */}
        {beat.k === 'connect' && (
          <div className="flex h-full flex-col justify-center animate-fadeIn">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">Tools · Calendar</p>
            <p className="mt-1 font-serif text-[24px] font-black leading-tight text-[#111827] dark:text-white">Your follow-ups, <em className="font-light text-[#a8853d] dark:text-[#e8c97a]">on your calendar.</em></p>
            <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Connect once. We fill it in.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[{ m: <GoogleMark size={26} />, n: 'Google Calendar', d: "Two-way - edit events right in Google, and we skip times you're already booked.", g: true }, { m: <MicrosoftMark size={24} />, n: 'Outlook Calendar', d: 'Two-way with Outlook / Microsoft 365 - events you can drag and edit.', g: false }].map(p => {
                const done = p.g && tick >= 12
                return (
                  <div key={p.n} className={`rounded-2xl border-2 bg-white p-3.5 transition-all duration-500 dark:bg-[#151517] ${done ? 'border-emerald-400 shadow-[0_14px_30px_-18px_rgba(16,185,129,.8)]' : 'border-gray-200 dark:border-gray-800'}`}>
                    <div className="flex items-center gap-2">{p.m}<p className="text-[13px] font-black text-[#111827] dark:text-white">{p.n}</p></div>
                    <p className="mt-1.5 min-h-[30px] text-[10px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{p.d}</p>
                    <span className={`mt-2.5 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black transition-all duration-200 ${done ? 'bg-emerald-500 text-white' : p.g && tick >= 9 && tick < 12 ? 'scale-95 bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{done ? <><Check className="h-4 w-4" /> Connected</> : 'Connect'}</span>
                  </div>
                )
              })}
            </div>
            <p className={`mt-3 flex items-center gap-1.5 text-[11px] font-black text-emerald-600 transition-opacity duration-500 dark:text-emerald-400 ${tick >= 13 ? 'opacity-100' : 'opacity-0'}`}><Check className="h-4 w-4" /> Connected - look for an &ldquo;OpenHousePal&rdquo; calendar in Google.</p>
            <DemoPointer x={tick < 3 ? 80 : 24} y={tick < 3 ? 90 : 64} click={tick >= 9 && tick <= 10} />
          </div>
        )}

        {/* 2 · open houses + confirmed tours land on it */}
        {beat.k === 'week' && (
          <div className="flex h-full flex-col">
            <Caption icon={CalendarClock} title="Open houses & tours, already there" body="Right beside your own events." />
            <div className="min-h-0 flex-1"><Week events={[...personal, ...(tick >= 4 ? [{ ...openHouse, enter: true }] : []), ...(tick >= 10 ? [{ ...tour, enter: true }] : [])]} /></div>
          </div>
        )}

        {/* 3 · a sign-in -> a whole-day Reach Out that buzzes your phone */}
        {beat.k === 'followup' && (
          <div className="flex h-full flex-col">
            <Caption icon={Bell} title="Every lead gets a follow-up day" body="Your phone reminds you." />
            <div className="relative min-h-0 flex-1">
              <Week events={[...personal, openHouse, tour]} allDay={tick >= 5 ? [{ day: 1, label: '[Reach Out] Sarah M.', enter: true }] : []} />
              {tick >= 9 && (
                <div className="absolute right-2 top-2 w-[230px] animate-fadeIn rounded-2xl bg-white/95 p-2.5 shadow-2xl ring-1 ring-black/5 dark:bg-[#1f1f22]/95">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow ring-1 ring-black/5"><GoogleMark size={14} /></span>
                    <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wide text-gray-400">Calendar · now</p><p className="truncate text-[11px] font-black text-[#111827] dark:text-white">[Reach Out] Sarah M. - today</p></div>
                  </div>
                  <p className="mt-1 text-[9.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Signed in at {OH.address} · suggested text ready in Leads</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4 · two-way: drag it in Google, it moves in OpenHousePal */}
        {beat.k === 'drag' && (
          <div className="flex h-full flex-col">
            <Caption icon={RefreshCw} title="Change it anywhere" body="Move it in Google - we update too." />
            <div className="relative min-h-0 flex-1">
              <Week sidebar={false} events={[...personal, tick < 6 ? openHouse : tick < 11 ? { ...openHouse, ghost: true } : { ...openHouse, day: 3, start: 13, end: 15 }, tour, ...(tick >= 6 && tick < 11 ? [{ ...openHouse, day: tick < 8 ? 2 : 3, start: 13, end: 15, label: openHouse.label }] : [])]} />
              <div className={`absolute bottom-2 right-2 w-[250px] rounded-xl border border-emerald-200 bg-white p-2.5 shadow-xl transition-all duration-500 dark:border-emerald-900/40 dark:bg-[#151517] ${tick >= 13 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
                <p className="text-[8.5px] font-black uppercase tracking-widest text-gray-400">OpenHousePal · Opens</p>
                <p className="text-[11px] font-black text-[#111827] dark:text-white">{OH.address} · Sunday 1-3 PM</p>
                <p className="mt-0.5 flex items-center gap-1 text-[9.5px] font-bold text-emerald-600"><RefreshCw className="h-3 w-3" /> Updated from Google Calendar</p>
              </div>
            </div>
            <DemoPointer x={tick < 3 ? 40 : tick < 8 ? 64 : 86} y={tick < 3 ? 85 : 55} click={tick >= 5 && tick <= 10} />
          </div>
        )}

        {/* 5 · pick your CRM, connect it, send a test */}
        {beat.k === 'crm' && (
          <div className="flex h-full flex-col animate-fadeIn">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">Tools · Integrations · Leads out</p>
            <p className="mt-1 font-serif text-[22px] font-black leading-tight text-[#111827] dark:text-white">Send leads to <em className="font-light text-[#a8853d] dark:text-[#e8c97a]">your CRM.</em></p>
            <div className="mt-3 grid flex-1 grid-cols-[1.25fr_1fr] gap-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517]">
                <p className="text-[11px] font-black text-[#111827] dark:text-white"><span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] text-[#111827]">1</span>Which CRM do you use?</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {CRMS.map(n => {
                    const on = n === 'Follow Up Boss' && tick >= 6
                    return <span key={n} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-black transition-all duration-300 ${on ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#6b5530] dark:text-[#e8c97a]' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>{on && <Check className="h-3 w-3" />}{n}</span>
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className={`rounded-2xl border bg-white p-3 transition-opacity duration-500 dark:bg-[#151517] ${tick >= 8 ? 'border-gray-200 opacity-100 dark:border-gray-800' : 'border-gray-100 opacity-40 dark:border-gray-900'}`}>
                  <p className="text-[11px] font-black text-[#111827] dark:text-white"><span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] text-[#111827]">2</span>Connect Follow Up Boss</p>
                  <p className="mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-[10px] text-[#111827] dark:border-gray-700 dark:text-white"><KeyRound className="h-3 w-3 text-[#C9A24D]" />{tick >= 9 ? 'fka_••••••••••'.slice(0, 4 + Math.min(10, tick - 9)) : <span className="font-sans text-gray-400">Paste your API key</span>}</p>
                </div>
                <div className={`rounded-2xl border bg-white p-3 transition-opacity duration-500 dark:bg-[#151517] ${tick >= 15 ? 'border-gray-200 opacity-100 dark:border-gray-800' : 'border-gray-100 opacity-40 dark:border-gray-900'}`}>
                  <p className="text-[11px] font-black text-[#111827] dark:text-white"><span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] text-[#111827]">3</span>Save &amp; send a test lead</p>
                  <span className={`mt-1.5 flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-black transition-all duration-200 ${tick >= 21 ? 'bg-emerald-500 text-white' : tick >= 19 ? 'scale-95 bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{tick >= 21 ? <><Check className="h-3.5 w-3.5" /> Test lead delivered</> : <><Send className="h-3.5 w-3.5" /> Send a test lead</>}</span>
                </div>
              </div>
            </div>
            <DemoPointer x={tick < 3 ? 50 : tick < 7 ? 16 : tick < 15 ? 75 : 77} y={tick < 3 ? 95 : tick < 7 ? 30 : tick < 15 ? 29 : 50} click={(tick >= 5 && tick <= 6) || (tick >= 8 && tick <= 9) || (tick >= 19 && tick <= 20)} />
          </div>
        )}

        {/* 6 · every new lead pushed, source tagged */}
        {beat.k === 'push' && (
          <div className="flex h-full flex-col">
            <Caption icon={Send} title="Leads go to your CRM" body="The moment they sign in." />
            <div className="flex flex-1 items-center justify-center gap-4">
              <div className="w-[190px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-[#151517]">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Open house sign-in</p>
                <p className="mt-1 text-[12px] font-black text-[#111827] dark:text-white">Sarah M.</p>
                <p className="text-[10px] font-semibold text-gray-500">{OH.address}, {OH.city}</p>
                <p className="mt-1.5 text-[9.5px] font-semibold text-gray-500">Has an agent? <b className="text-[#111827] dark:text-white">No</b></p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className={`h-6 w-6 text-[#C9A24D] transition-all duration-500 ${tick >= 3 ? 'translate-x-1 opacity-100' : 'opacity-30'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{tick >= 3 ? 'Sent' : 'Sending'}</span>
              </div>
              <div className={`w-[230px] rounded-2xl border-2 border-[#0a66c2]/40 bg-white p-3 shadow-xl transition-all duration-700 dark:bg-[#151517] ${tick >= 5 ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0'}`}>
                <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#0a66c2]"><UserRound className="h-3 w-3" /> Follow Up Boss · new contact</p>
                <p className="mt-1 text-[13px] font-black text-[#111827] dark:text-white">Sarah M.</p>
                <p className="text-[10px] font-semibold text-gray-500">sarah.m@email.com · (610) 555-0148</p>
                <div className="mt-2 space-y-1 text-[9.5px]">
                  <p className="flex justify-between"><span className="text-gray-400">Source</span><b className="text-[#111827] dark:text-white">OpenHousePal · Open House</b></p>
                  <p className="flex justify-between"><span className="text-gray-400">Property</span><b className="text-[#111827] dark:text-white">{OH.address}</b></p>
                </div>
                <p className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-600"><Check className="h-3.5 w-3.5" /> Landed the moment she signed in</p>
              </div>
            </div>
          </div>
        )}

        {/* 7 · portal leads come in */}
        {beat.k === 'portal' && (
          <div className="flex h-full flex-col">
            <Caption icon={Inbox} title="Zillow leads, pulled in" body="Forward the email. It lands in Leads." />
            <div className="flex flex-1 items-center justify-center gap-4">
              <div className="w-[220px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-[#151517]">
                <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400"><Mail className="h-3 w-3" /> Forwarded email</p>
                <p className="mt-1 text-[11px] font-black text-[#006AFF]">New Zillow lead</p>
                <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Jordan K. is interested in {REAL_SPOTLIGHT.address}, Exton</p>
                <p className="mt-1.5 truncate rounded-md bg-gray-100 px-1.5 py-1 font-mono text-[8.5px] text-gray-500 dark:bg-white/10">To: leads-7f3k@mg.openhousepal.com</p>
              </div>
              <ArrowRight className={`h-6 w-6 shrink-0 text-[#C9A24D] transition-opacity duration-500 ${tick >= 4 ? 'opacity-100' : 'opacity-30'}`} />
              <div className="w-[230px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-[#151517]">
                <p className="px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Your Leads</p>
                {[{ n: 'Jordan K.', t: 'Portal Lead · Zillow', fresh: true }, { n: 'Sarah M.', t: `Open House · ${OH.address}` }, { n: 'Dana L.', t: 'Form · Home value' }].map((l, k) => (
                  (k > 0 || tick >= 6) && (
                    <div key={l.n} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 ${l.fresh ? 'animate-fadeIn bg-[#C9A24D]/10' : ''}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-[8px] font-black text-white">{l.n.split(' ').map(x => x[0]).join('')}</span>
                      <div className="min-w-0 flex-1"><p className="text-[10.5px] font-black text-[#111827] dark:text-white">{l.n}</p><p className="truncate text-[9px] font-semibold text-gray-500">{l.t}</p></div>
                      {l.fresh && <span className="rounded-full bg-[#C9A24D] px-1.5 py-0.5 text-[7.5px] font-black uppercase text-[#111827]">New</span>}
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
