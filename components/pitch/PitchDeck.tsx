'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import localFont from 'next/font/local'
import { BellRing, Check, ChevronLeft, ChevronRight, Expand, Inbox, LayoutGrid, Maximize, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react'
import { GoogleCalendarLogo, GoogleLogo } from '@/components/brand/ProviderLogos'
import { OhpHouse, OhpWordmark } from '@/components/brand/OhpBrand'
import { PITCH_CSS } from './pitchCss'
import PitchExpand from './PitchExpand'
import { AI_FEATURE, CRMS, EXPAND, FEATURES, MORE, OFFICE_STEPS, PLANS, REASONS, STACK, type Feature, type Tile } from './pitchData'
import { Scrubber, VisualView, plays, shotsOf, type Ctrl, type Open } from './pitchMedia'

// The brokerage pitch deck. One fixed-size canvas (1600x900, or 900x1600 on an upright phone)
// scaled to fit the window, so every slide looks the same on a laptop, a projector or a phone.
// Arrow keys / space / a clicker / a tap move on; each feature slide plays: name -> three quick
// "how it's done" steps -> the real end result + why it matters.

const serif = localFont({
  src: [
    { path: '../../fonts/playfair-display-normal-400-900.woff2', weight: '400 900', style: 'normal' },
    { path: '../../fonts/playfair-display-italic-400-900.woff2', weight: '400 900', style: 'italic' },
  ],
  variable: '--pd-serif',
  display: 'swap',
})

const LAND = { w: 1600, h: 900 }
const PORT = { w: 900, h: 1600 }
const BAR = 64


/** Phase 0 on mount, then phase n once beats[n-1] ms have passed. */
function usePhase(beats: number[]) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const timers = beats.map((ms, i) => setTimeout(() => setPhase(i + 1), ms))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return phase
}

function Title({ text, size, className = '' }: { text: string; size: number; className?: string }) {
  const words = text.split(' ')
  const last = words.pop()
  return (
    <h1 className={`pd-serif font-black tracking-tight ${className}`} style={{ fontSize: size, lineHeight: 1.04 }}>
      {words.length > 0 && <>{words.join(' ')} </>}
      <em className="pd-gold italic">{last}</em>
    </h1>
  )
}

// ---------- slides ----------

type SlideProps = { portrait: boolean; expand: (key: string, tab: number) => void }

function FeatureSlide({ f, portrait, expand }: SlideProps & { f: Feature }) {
  const open: Open = tab => expand(f.key, tab)
  // 1-3 = the three steps (2.2 s each, long enough to read), 4 = the result shows, 5-7 = the three reasons.
  const phase = usePhase([1100, 3300, 5500, 7700, 8200, 8600, 9000])
  const ctrl = useRef<Ctrl | null>(null)
  const Icon = f.icon
  const chipState = (k: number) => (phase > k + 1 ? 'done' : phase === k + 1 ? 'on' : 'idle')

  const head = (
    <>
      <div className="pd-rise flex items-center" style={{ gap: 18 }}>
        <span className="pd-tile" style={{ width: portrait ? 84 : 76, height: portrait ? 84 : 76 }}><Icon className={portrait ? 'h-10 w-10' : 'h-9 w-9'} strokeWidth={2.3} /></span>
        <span className="pd-kicker" style={{ fontSize: portrait ? 15 : 13, padding: portrait ? '10px 18px' : '8px 16px' }}>{f.kicker}</span>
        {f.ai && <span className="pd-ai" style={{ fontSize: portrait ? 15 : 13, padding: portrait ? '9px 14px' : '7px 12px' }}><Sparkles style={{ width: 15, height: 15 }} strokeWidth={2.6} />AI</span>}
      </div>
      <div className="pd-rise" style={{ ['--d' as string]: '160ms', marginTop: portrait ? 26 : 28 }}><Title text={f.title} size={portrait ? 88 : 84} /></div>
      <p className="pd-rise font-medium text-white/75" style={{ ['--d' as string]: '320ms', marginTop: portrait ? 18 : 20, fontSize: portrait ? 30 : 26, lineHeight: 1.36, maxWidth: portrait ? 760 : 560 }}>{f.line}</p>
    </>
  )
  const chips = (
    <div className="pd-rise" style={{ ['--d' as string]: '520ms' }}>
      <p className="font-black uppercase text-white/45" style={{ fontSize: portrait ? 14 : 12, letterSpacing: '.26em', marginBottom: 14 }}>How it&apos;s done</p>
      <div className="flex items-center" style={{ gap: 10 }}>
        {f.steps.map((s, k) => (
          <div key={s.label} className="contents">
            {k > 0 && <span className="pd-link" data-on={phase > k ? 1 : 0}><i /></span>}
            <span className="pd-chip" data-s={chipState(k)}>
              <span className="pd-num" style={{ width: portrait ? 36 : 30, height: portrait ? 36 : 30, fontSize: portrait ? 16 : 14 }}>{phase > k + 1 ? <Check style={{ width: 15, height: 15 }} strokeWidth={3.4} /> : k + 1}</span>
              <span className="font-bold text-white/90" style={{ fontSize: portrait ? 18 : 15, whiteSpace: 'nowrap' }}>{s.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
  const whys = (
    <div className="flex flex-col" style={{ gap: portrait ? 16 : 15 }}>
      {f.why.map((w, k) => (
        <div key={w} className="pd-why" data-on={phase >= 5 + k ? 1 : 0} style={{ gap: 14 }}>
          <span className="pd-check" style={{ width: portrait ? 34 : 30, height: portrait ? 34 : 30, marginTop: 1 }}><Check style={{ width: 16, height: 16 }} strokeWidth={3.2} /></span>
          <span className="font-semibold text-white/90" style={{ fontSize: portrait ? 26 : 21.5, lineHeight: 1.32 }}>{w}</span>
        </div>
      ))}
      <div className="pd-why" data-on={phase >= 7 ? 1 : 0} style={{ marginTop: portrait ? 10 : 8 }}>
        <button type="button" data-nonav onClick={() => open(0)} className="pd-look" style={{ fontSize: portrait ? 22 : 17, padding: portrait ? '14px 26px' : '11px 22px', gap: 10 }}>
          <Expand style={{ width: portrait ? 22 : 18, height: portrait ? 22 : 18 }} strokeWidth={2.6} />Look closer
        </button>
      </div>
    </div>
  )
  const stage = (
    <>
      <div className="pd-stepcard" data-off={phase >= 4 ? 1 : 0} style={{ width: 460, height: 440 }}>
        <div className="pd-face" data-on={phase === 0 ? 1 : 0} data-past={phase > 0 ? 1 : 0}>
          <span className="pd-tile" style={{ width: 120, height: 120 }}><Icon className="h-14 w-14" strokeWidth={2.1} /></span>
          <p className="font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em', marginTop: 34 }}>How it&apos;s done</p>
          <p className="pd-serif font-black" style={{ fontSize: 40, marginTop: 8 }}>Three steps</p>
        </div>
        {f.steps.map((s, k) => (
          <div key={s.label} className="pd-face" data-on={phase === k + 1 ? 1 : 0} data-past={phase > k + 1 ? 1 : 0}>
            <span className="relative grid place-items-center" style={{ width: 120, height: 120 }}>
              <span className="pd-tap" style={{ inset: -6 }} />
              <span className="pd-pop pd-tile" style={{ width: 120, height: 120 }}><s.icon className="h-14 w-14" strokeWidth={2.1} /></span>
            </span>
            <p className="font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em', marginTop: 34 }}>Step {k + 1}</p>
            <p className="pd-serif font-black" style={{ fontSize: 40, marginTop: 8, padding: '0 28px', lineHeight: 1.12 }}>{s.label}</p>
          </div>
        ))}
        <div className="pd-bars" style={{ bottom: 30 }}>
          {f.steps.map((s, k) => <i key={s.label} data-on={phase === k + 1 ? 1 : 0} data-done={phase > k + 1 ? 1 : 0}><b /></i>)}
        </div>
      </div>
      <div className="pd-result" data-on={phase >= 4 ? 1 : 0}><VisualView v={f.visual} open={open} active={phase >= 4} ctrl={ctrl} /></div>
      {plays(f.visual) && (
        <div className="pd-scrubwrap" data-on={phase >= 4 ? 1 : 0} style={{ bottom: portrait ? -22 : -4 }}><Scrubber ctrl={ctrl} big={portrait} /></div>
      )}
    </>
  )

  if (portrait) {
    return (
      <div className="absolute inset-0">
        <div className="absolute" style={{ left: 64, right: 64, top: 70 }}>{head}</div>
        <div className="absolute" style={{ left: 50, right: 50, top: 468, height: 770 }}>
          <div className="absolute inset-0" style={{ transform: 'scale(.93)', transformOrigin: '50% 40%' }}>{stage}</div>
        </div>
        <div className="absolute" style={{ left: 64, right: 64, top: 1268 }}>{whys}</div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0">
      <div className="absolute flex flex-col justify-center" style={{ left: 96, top: 0, bottom: BAR, width: 620 }}>
        {head}
        <div style={{ marginTop: 38 }}>{chips}</div>
        <div style={{ marginTop: 34, minHeight: 250 }}>{whys}</div>
      </div>
      <div className="absolute" style={{ left: 748, right: 52, top: 26, bottom: BAR + 14 }}>{stage}</div>
    </div>
  )
}

function CoverSlide({ portrait }: SlideProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ paddingBottom: BAR }}>
      <div className="pd-rise"><span className="pd-kicker" style={{ fontSize: 14, padding: '9px 20px' }}>For Brokerages</span></div>
      <div className="pd-fade" style={{ marginTop: 44, ['--d' as string]: '200ms' }}><OhpWordmark animate onDark className={`${portrait ? 'text-[104px]' : 'text-[150px]'} text-white`} /></div>
      <div className="pd-rise" style={{ marginTop: 44, ['--d' as string]: '800ms' }}>
        <p className="pd-serif font-black" style={{ fontSize: portrait ? 50 : 58, lineHeight: 1.12 }}>Every tool an agent needs,{portrait ? <br /> : ' '}<em className="pd-gold italic">one login</em></p>
      </div>
      <p className="pd-rise font-medium text-white/60" style={{ marginTop: 22, fontSize: portrait ? 26 : 24, ['--d' as string]: '1000ms' }}>Open houses, leads, marketing, pricing and websites.</p>
    </div>
  )
}

function ProofSlide({ portrait }: SlideProps) {
  const phase = usePhase([450, 1350, 1750])
  const [n, setN] = useState(0)
  useEffect(() => {
    if (phase < 1) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setN(Math.round(15 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  const photo = portrait ? 300 : 340
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${portrait ? 'flex-col text-center' : ''}`} style={{ paddingBottom: BAR, gap: portrait ? 60 : 96 }}>
      <div className="pd-rise relative" style={{ width: photo, height: photo, flex: 'none' }}>
        <span className="absolute rounded-[32%]" style={{ inset: -7, background: 'linear-gradient(135deg,#f3dfa8,#C9A24D 50%,#8b6a2b)', boxShadow: '0 40px 90px -30px rgba(201,162,77,.6)' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demos/media/1ae1802edc98.jpg" alt="Peter Stefanatos" draggable={false} className="relative h-full w-full rounded-[31%] object-cover object-[50%_18%]" />
      </div>
      <div style={{ maxWidth: 760 }}>
        <p className="pd-rise font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em', ['--d' as string]: '200ms' }}>Built by a working agent</p>
        <p className="pd-rise pd-serif font-black" style={{ fontSize: portrait ? 54 : 58, marginTop: 10, ['--d' as string]: '350ms' }}>Peter Stefanatos</p>
        <p className="pd-rise font-semibold text-white/55" style={{ fontSize: 22, marginTop: 4, ['--d' as string]: '450ms' }}>Compass Real Estate · Pennsylvania</p>
        <p className="pd-serif pd-gold font-black" style={{ fontSize: portrait ? 150 : 170, lineHeight: 1, marginTop: 26, fontVariantNumeric: 'lining-nums', opacity: phase >= 1 ? 1 : 0, transition: 'opacity .6s ease', display: 'inline-block' }}>${n}M+</p>
        <p className="pd-why pd-serif font-bold" data-on={phase >= 2 ? 1 : 0} style={{ fontSize: portrait ? 40 : 44, marginTop: 6, display: 'block' }}>sold in his first year,</p>
        <p className="pd-why pd-serif font-bold text-white/80" data-on={phase >= 3 ? 1 : 0} style={{ fontSize: portrait ? 40 : 44, display: 'block' }}>thanks to OpenHousePal.</p>
      </div>
    </div>
  )
}

function StackSlide({ portrait }: SlideProps) {
  const phase = usePhase([...STACK.map((_, i) => 600 + i * 110), 600 + STACK.length * 110 + 250])
  const done = phase > STACK.length
  return (
    <div className={`absolute inset-0 flex ${portrait ? 'flex-col justify-center' : 'items-center'}`} style={{ padding: portrait ? '0 64px' : '0 96px', paddingBottom: BAR, gap: portrait ? 56 : 70 }}>
      <div style={{ flex: portrait ? 'none' : 1, minWidth: 0 }}>
        <p className="pd-rise font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em' }}>The value</p>
        <div className="pd-rise" style={{ marginTop: 14, ['--d' as string]: '150ms' }}><Title text="One login instead of a stack of apps" size={portrait ? 66 : 68} className={portrait ? '' : 'max-w-[640px]'} /></div>
        <div className="pd-rise flex flex-wrap" style={{ gap: 12, marginTop: 40, ['--d' as string]: '400ms' }}>
          {STACK.map((s, i) => <span key={s} className="pd-pill" data-x={phase > i ? 1 : 0} style={{ fontSize: portrait ? 21 : 19, padding: portrait ? '12px 20px' : '11px 19px' }}>{s}<s /></span>)}
        </div>
      </div>
      <div className="pd-pop2 pd-card text-center" data-on={done ? 1 : 0} style={{ width: portrait ? '100%' : 500, flex: 'none', padding: portrait ? '48px 40px' : '56px 44px' }}>
        <OhpHouse onDark className="mx-auto h-[84px] text-white" />
        <p className="pd-serif font-black" style={{ fontSize: 46, lineHeight: 1.1, marginTop: 26 }}>All of it, in <em className="pd-gold italic">one place</em></p>
        <p className="font-semibold text-white/60" style={{ fontSize: 21, marginTop: 16 }}>One login. One bill. From</p>
        <p className="pd-serif font-black text-[#f3dfa8]" style={{ fontSize: 76, lineHeight: 1.1, fontVariantNumeric: 'lining-nums' }}>$19.95</p>
        <p className="font-semibold text-white/60" style={{ fontSize: 21 }}>per agent a month</p>
      </div>
    </div>
  )
}

function GridSlide({ portrait, kicker, title, items, cols }: SlideProps & { kicker: string; title: string; items: Tile[]; cols: number }) {
  const c = portrait ? 2 : cols
  return (
    <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: portrait ? '0 54px' : '0 96px', paddingBottom: BAR }}>
      <div className="text-center">
        <p className="pd-rise font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em' }}>{kicker}</p>
        <div className="pd-rise" style={{ marginTop: 12, ['--d' as string]: '150ms' }}><Title text={title} size={portrait ? 62 : 64} /></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))`, gap: portrait ? 16 : 18, marginTop: portrait ? 44 : 46 }}>
        {items.map((m, i) => (
          <div key={m.title} className="pd-rise pd-mini flex items-center" style={{ ['--d' as string]: `${250 + i * 45}ms`, gap: 16, padding: portrait ? '20px 18px' : cols === 3 ? '26px 24px' : '22px 20px' }}>
            <span className="pd-tile flex-none" style={{ width: 54, height: 54 }}><m.icon className="h-6 w-6" strokeWidth={2.3} /></span>
            <span className="min-w-0">
              <span className="block font-black" style={{ fontSize: portrait ? 23 : cols === 3 ? 24 : 22 }}>{m.title}</span>
              <span className="block font-medium text-white/60" style={{ fontSize: portrait ? 17.5 : cols === 3 ? 18 : 16.5, lineHeight: 1.3, marginTop: 3 }}>{m.line}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntegrationsSlide({ portrait }: SlideProps) {
  const cards: { logo: React.ReactNode; title: string; line: string }[] = [
    { logo: <GoogleCalendarLogo className="h-9 w-9" />, title: 'Google Calendar', line: 'Open houses, tours and follow-ups land on the agent’s calendar and buzz their phone' },
    { logo: <GoogleLogo className="h-9 w-9" />, title: 'Their own Gmail', line: 'Client emails go out from the agent’s real address and show in their Sent folder' },
    { logo: <BellRing className="h-8 w-8 text-[#111827]" strokeWidth={2.2} />, title: 'Alerts and a daily briefing', line: 'New leads, tour requests and what needs attention, by email at the time they pick' },
    { logo: <Inbox className="h-8 w-8 text-[#111827]" strokeWidth={2.2} />, title: 'Portal leads in', line: 'Zillow and Realtor.com lead emails forward straight into Leads' },
  ]
  return (
    <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: portrait ? '0 54px' : '0 96px', paddingBottom: BAR }}>
      <div className="text-center">
        <p className="pd-rise font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em' }}>Integrations</p>
        <div className="pd-rise" style={{ marginTop: 12, ['--d' as string]: '150ms' }}><Title text="Works with what agents already use" size={portrait ? 60 : 64} /></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${portrait ? 1 : 2}, minmax(0, 1fr))`, gap: 18, marginTop: portrait ? 40 : 42 }}>
        {cards.map((c, i) => (
          <div key={c.title} className="pd-rise pd-mini flex items-center" style={{ ['--d' as string]: `${300 + i * 90}ms`, gap: 20, padding: '24px 26px' }}>
            <span className="grid flex-none place-items-center rounded-2xl bg-white" style={{ width: 66, height: 66 }}>{c.logo}</span>
            <span className="min-w-0">
              <span className="block font-black" style={{ fontSize: 26 }}>{c.title}</span>
              <span className="block font-medium text-white/65" style={{ fontSize: 19, lineHeight: 1.32, marginTop: 4 }}>{c.line}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="pd-rise pd-card flex items-center" style={{ ['--d' as string]: '700ms', marginTop: 18, gap: 22, padding: '22px 26px', flexDirection: portrait ? 'column' : 'row', alignItems: portrait ? 'flex-start' : 'center' }}>
        <span className="flex flex-none items-center" style={{ gap: 16 }}>
          <span className="pd-tile flex-none" style={{ width: 62, height: 62 }}><RefreshCw className="h-7 w-7" strokeWidth={2.3} /></span>
          <span>
            <span className="block font-black" style={{ fontSize: 26 }}>Their CRM</span>
            <span className="block font-medium text-white/65" style={{ fontSize: 18 }}>Every new lead pushed in, tagged with its source</span>
          </span>
        </span>
        <span className="flex flex-wrap" style={{ gap: 9 }}>
          {CRMS.map(c => <span key={c} className="pd-pill" style={{ fontSize: 17, padding: '8px 15px' }}>{c}</span>)}
        </span>
      </div>
    </div>
  )
}

function OfficeSlide({ portrait }: SlideProps) {
  return (
    <div className={`absolute inset-0 flex ${portrait ? 'flex-col justify-center' : 'items-center'}`} style={{ padding: portrait ? '0 64px' : '0 96px', paddingBottom: BAR, gap: portrait ? 50 : 80 }}>
      <div style={{ flex: portrait ? 'none' : 1, minWidth: 0 }}>
        <p className="pd-rise font-black uppercase text-[#e8c97a]" style={{ fontSize: 14, letterSpacing: '.28em' }}>Brokerage plans</p>
        <div className="pd-rise" style={{ marginTop: 14, ['--d' as string]: '150ms' }}><Title text="One bill for your whole office" size={portrait ? 66 : 68} /></div>
        <div style={{ marginTop: 40 }}>
          {OFFICE_STEPS.map((s, i) => (
            <div key={s} className="pd-rise flex items-center" style={{ gap: 20, marginTop: i ? 20 : 0, ['--d' as string]: `${300 + i * 120}ms` }}>
              <span className="pd-tile pd-serif flex-none font-black" style={{ width: 52, height: 52, borderRadius: 99, fontSize: 24, fontVariantNumeric: 'lining-nums' }}>{i + 1}</span>
              <span className="font-bold" style={{ fontSize: portrait ? 30 : 28 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pd-rise pd-card" style={{ width: portrait ? '100%' : 520, flex: 'none', padding: '34px 34px 30px', ['--d' as string]: '450ms' }}>
        <p className="font-black uppercase text-white/45" style={{ fontSize: 13, letterSpacing: '.24em' }}>Per agent, a month</p>
        <div style={{ marginTop: 14 }}>
          {PLANS.map((p, i) => (
            <div key={p.name} className="flex items-center justify-between" style={{ padding: '15px 0', borderTop: i ? '1px solid rgba(255,255,255,.1)' : 'none' }}>
              <span className="font-black" style={{ fontSize: 25 }}>{p.name}</span>
              <span className="pd-serif font-black text-[#f3dfa8]" style={{ fontSize: 31, fontVariantNumeric: 'lining-nums' }}>{p.price}</span>
            </div>
          ))}
        </div>
        <p className="font-medium text-white/50" style={{ fontSize: 16, marginTop: 12, lineHeight: 1.4 }}>14-day free trial on most plans. IDX adds a one-time setup fee. No-MLS plans are for agents outside Bright MLS.</p>
      </div>
    </div>
  )
}

function CloseSlide({ portrait }: SlideProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ paddingBottom: BAR }}>
      <div className="pd-fade"><OhpHouse animate onDark className="h-[120px] text-white" /></div>
      <div className="pd-rise" style={{ marginTop: 40, ['--d' as string]: '450ms' }}>
        <p className="pd-serif font-black" style={{ fontSize: portrait ? 78 : 96, lineHeight: 1.06 }}>Let&apos;s set up{portrait ? <br /> : ' '}<em className="pd-gold italic">your office</em></p>
      </div>
      <p className="pd-rise font-medium text-white/65" style={{ marginTop: 24, fontSize: portrait ? 28 : 28, ['--d' as string]: '700ms' }}>Every tool. One login. One bill.</p>
      <div className="pd-rise" style={{ marginTop: 46, ['--d' as string]: '450ms' }}><OhpWordmark onDark className="text-[44px] text-white" /></div>
      <p className="pd-rise font-bold text-[#e8c97a]" style={{ marginTop: 12, fontSize: 22, letterSpacing: '.06em', ['--d' as string]: '1000ms' }}>openhousepal.com/brokerages</p>
    </div>
  )
}

type SlideDef = { id: string; name: string; render: (p: SlideProps) => React.ReactNode; preload?: string[] }

const SLIDES: SlideDef[] = [
  { id: 'cover', name: 'Welcome', render: p => <CoverSlide {...p} /> },
  { id: 'proof', name: 'Built by an agent', render: p => <ProofSlide {...p} />, preload: ['/demos/media/1ae1802edc98.jpg'] },
  { id: 'stack', name: 'One login', render: p => <StackSlide {...p} /> },
  ...FEATURES.map(f => ({ id: f.key, name: f.title, render: (p: SlideProps) => <FeatureSlide f={f} {...p} />, preload: shotsOf(f.visual) })),
  { id: 'integrations', name: 'Integrations', render: p => <IntegrationsSlide {...p} /> },
  { id: AI_FEATURE.key, name: AI_FEATURE.title, render: (p: SlideProps) => <FeatureSlide f={AI_FEATURE} {...p} />, preload: shotsOf(AI_FEATURE.visual) },
  { id: 'more', name: 'And much more', render: p => <GridSlide {...p} kicker="And that’s not all" title="Also in every office" items={MORE} cols={3} /> },
  { id: 'office', name: 'For your brokerage', render: p => <GridSlide {...p} kicker="For your brokerage" title="Good for agents, better for your office" items={REASONS} cols={3} /> },
  { id: 'billing', name: 'One bill', render: p => <OfficeSlide {...p} /> },
  { id: 'close', name: 'Let’s talk', render: p => <CloseSlide {...p} /> },
]

// ---------- the deck ----------

export default function PitchDeck() {
  const [i, setI] = useState(0)
  const [replay, setReplay] = useState(0)
  const [index, setIndex] = useState(false)
  const [stage, setStage] = useState<{ scale: number; portrait: boolean } | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [look, setLook] = useState<{ key: string; tab: number } | null>(null)
  const expand = useCallback((key: string, tab: number) => setLook({ key, tab }), [])

  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight
      const portrait = vh > vw * 1.05
      const d = portrait ? PORT : LAND
      setStage({ scale: Math.min(vw / d.w, vh / d.h), portrait })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const go = useCallback((n: number) => { setI(Math.max(0, Math.min(SLIDES.length - 1, n))); setIndex(false) }, [])
  const next = useCallback(() => setI(n => Math.min(SLIDES.length - 1, n + 1)), [])
  const prev = useCallback(() => setI(n => Math.max(0, n - 1)), [])
  const full = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (look || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); next() }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev() }
      else if (k === 'Home') go(0)
      else if (k === 'End') go(SLIDES.length - 1)
      else if (k === 'r' || k === 'R') setReplay(n => n + 1)
      else if (k === 'f' || k === 'F') full()
      else if (k === 'g' || k === 'G') setIndex(v => !v)
      else if ((k === 'e' || k === 'E') && EXPAND[SLIDES[i].id]) setLook({ key: SLIDES[i].id, tab: 0 })
      else if (k === 'Escape') setIndex(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, full, look, i])

  // The page behind must never scroll or bounce while presenting.
  useEffect(() => {
    const el = document.documentElement
    const was = el.style.overflow
    el.style.overflow = 'hidden'
    return () => { el.style.overflow = was }
  }, [])

  // Warm up the next slide's pictures so its result never pops in half-loaded.
  useEffect(() => {
    for (const s of [SLIDES[i + 1], SLIDES[i + 2]]) for (const src of s?.preload || []) { const im = new window.Image(); im.src = src; im.decode?.().catch(() => {}) }
  }, [i])

  // Leaving a slide: it lifts and fades out first, then the next one makes its entrance.
  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (i === shown) return
    setLeaving(true)
    const t = setTimeout(() => { setShown(i); setLeaving(false) }, 130)
    return () => clearTimeout(t)
  }, [i, shown])

  const dims = stage?.portrait ? PORT : LAND
  const slide = SLIDES[shown]

  return (
    <div className={`pd-root ${serif.variable} fixed inset-0 z-[200] overflow-hidden`}
      onClick={e => { if (!(e.target as HTMLElement).closest('[data-nonav]')) next() }}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={e => {
        const t = touch.current; touch.current = null
        if (!t) return
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { e.preventDefault(); if (dx < 0) next(); else prev() }
      }}>
      <style dangerouslySetInnerHTML={{ __html: PITCH_CSS }} />
      <div className="pd-bg">
        <div className="pd-aurora" />
        <div className="pd-floor" />
        <div className="pd-vig" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      </div>

      {stage && (
        <div className="absolute left-1/2 top-1/2" style={{ width: dims.w, height: dims.h, transform: `translate(-50%,-50%) scale(${stage.scale})` }}>
          <div key={`${slide.id}-${replay}-${stage.portrait ? 'p' : 'l'}`} className="pd-slide absolute inset-0" data-leave={leaving ? 1 : 0}>
            <span className="pd-sweep" />
            {slide.render({ portrait: stage.portrait, expand })}
          </div>

          {/* controls */}
          <div data-nonav className="absolute inset-x-0 bottom-0 flex items-center" style={{ height: BAR, padding: stage.portrait ? '0 28px' : '0 40px', gap: 22 }}>
            <OhpWordmark onDark className={`${stage.portrait ? 'text-[20px]' : 'text-[19px]'} text-white/70`} />
            <div className="flex flex-1 items-center" style={{ gap: 5 }}>
              {SLIDES.map((s, k) => <span key={s.id} title={s.name} className="pd-seg" data-on={k < i ? 1 : 0} data-cur={k === i ? 1 : 0} onClick={() => go(k)}><i /></span>)}
            </div>
            <span className="font-bold tabular-nums text-white/50" style={{ fontSize: stage.portrait ? 20 : 15 }}>{String(i + 1).padStart(2, '0')} / {SLIDES.length}</span>
            <div className="flex items-center" style={{ gap: 8, zoom: stage.portrait ? 1.5 : 1 }}>
              {!stage.portrait && <button type="button" aria-label="Play this slide again" title="Play again (R)" className="pd-ctl" style={{ width: 38, height: 38 }} onClick={() => setReplay(n => n + 1)}><RotateCcw style={{ width: 16, height: 16 }} /></button>}
              <button type="button" aria-label="All slides" title="All slides (G)" className="pd-ctl" style={{ width: 38, height: 38 }} onClick={() => setIndex(true)}><LayoutGrid style={{ width: 16, height: 16 }} /></button>
              {!stage.portrait && <button type="button" aria-label="Full screen" title="Full screen (F)" className="pd-ctl" style={{ width: 38, height: 38 }} onClick={full}><Maximize style={{ width: 16, height: 16 }} /></button>}
              <button type="button" aria-label="Back" className="pd-ctl" style={{ width: 38, height: 38, opacity: i === 0 ? 0.35 : 1 }} onClick={prev}><ChevronLeft style={{ width: 18, height: 18 }} /></button>
              <button type="button" aria-label="Next" className="pd-ctl" style={{ width: 46, height: 38, color: '#111827', background: '#e8c97a', borderColor: '#e8c97a', opacity: i === SLIDES.length - 1 ? 0.35 : 1 }} onClick={next}><ChevronRight style={{ width: 20, height: 20 }} strokeWidth={3} /></button>
            </div>
          </div>

          {/* all slides */}
          {index && (
            <div data-nonav className="absolute inset-0 z-10 flex flex-col bg-[#07080c]/[0.97]" style={{ padding: stage.portrait ? '70px 54px' : '64px 96px' }}>
              <div className="flex items-center justify-between">
                <p className="pd-serif font-black" style={{ fontSize: 44 }}>All <em className="pd-gold italic">slides</em></p>
                <button type="button" aria-label="Close" className="pd-ctl" style={{ width: 48, height: 48 }} onClick={() => setIndex(false)}><X style={{ width: 20, height: 20 }} /></button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${stage.portrait ? 2 : 4}, minmax(0,1fr))`, gap: 14, marginTop: 34 }}>
                {SLIDES.map((s, k) => (
                  <button key={s.id} type="button" onClick={() => go(k)} className="pd-mini flex items-center text-left transition-colors hover:border-[#C9A24D]/70" style={{ gap: 14, padding: '18px 20px', borderColor: k === i ? '#C9A24D' : undefined }}>
                    <span className="pd-serif font-black text-[#e8c97a]" style={{ fontSize: 22, width: 34, fontVariantNumeric: 'lining-nums' }}>{String(k + 1).padStart(2, '0')}</span>
                    <span className="font-black" style={{ fontSize: 21 }}>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {look && EXPAND[look.key] && (
        <PitchExpand title={SLIDES.find(x => x.id === look.key)?.name || ''} tabs={EXPAND[look.key]} start={look.tab} onClose={() => setLook(null)} />
      )}
    </div>
  )
}
