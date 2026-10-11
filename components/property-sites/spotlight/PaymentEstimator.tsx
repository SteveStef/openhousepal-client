'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtMoney } from './model'
import { API_BASE_URL } from '@/lib/api-service'
import { TONE, type Tone } from './tone'

// Monthly-payment estimator. Every input starts from a real figure where the listing has one
// (list price, MLS annual taxes, HOA dues). The rate starts at this week's Freddie Mac survey
// average for the chosen term (GET /public/market/mortgage-rates - 20-year is the midpoint of the
// 15 and 30) and says so; if the survey can't be read it falls back to a plain assumption.
//
// Made to feel alive while people play with it: the monthly total rolls to its new value, the
// ring redraws its slices, sliders fill with the accent colour and glow while dragged, and the
// loan-term pill glides between options.
export default function PaymentEstimator({
  price, taxesMonthly, hoaMonthly, tone,
}: {
  price: number
  taxesMonthly: number | null
  hoaMonthly: number | null
  tone: Tone
}) {
  const t = TONE[tone]
  const dark = tone === 'dark'
  const [homePrice, setHomePrice] = useState(Math.round(price))
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(6.5)
  const [years, setYears] = useState<15 | 20 | 30>(30)
  const [market, setMarket] = useState<{ rate_30: number | null; rate_15: number | null; as_of: string | null } | null>(null)
  const [rateTouched, setRateTouched] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`${API_BASE_URL}/public/market/mortgage-rates`).then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d?.rate_30) setMarket(d) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const marketRate = (term: 15 | 20 | 30) => {
    if (!market?.rate_30) return null
    if (term === 30) return market.rate_30
    if (!market.rate_15) return market.rate_30
    return term === 15 ? market.rate_15 : Math.round(((market.rate_15 + market.rate_30) / 2) * 100) / 100
  }
  // Follow the survey (per term) until the visitor sets their own rate.
  useEffect(() => {
    const m = marketRate(years)
    if (m != null && !rateTouched) setRate(m)
  }, [market, years]) // eslint-disable-line react-hooks/exhaustive-deps
  const usingMarket = !rateTouched && marketRate(years) != null
  const asOf = market?.as_of ? new Date(`${market.as_of}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  const calc = useMemo(() => {
    const loan = Math.max(0, homePrice * (1 - downPct / 100))
    const r = rate / 100 / 12
    const n = years * 12
    const pi = loan <= 0 ? 0 : r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n))
    // Taxes scale with the price the visitor is modelling, anchored on the listing's real bill.
    const taxes = taxesMonthly ? taxesMonthly * (homePrice / price) : 0
    const hoa = hoaMonthly || 0
    return { loan, pi, taxes, hoa, total: pi + taxes + hoa, down: homePrice * (downPct / 100), interest: Math.max(0, pi * n - loan) }
  }, [homePrice, downPct, rate, years, taxesMonthly, hoaMonthly, price])

  const parts = [
    { key: 'pi', label: 'Principal & interest', value: calc.pi, color: 'var(--sp-accent)' },
    ...(calc.taxes ? [{ key: 'tax', label: 'Property taxes', value: calc.taxes, color: dark ? '#9a9a9a' : '#7d9082' }] : []),
    ...(calc.hoa ? [{ key: 'hoa', label: 'HOA dues', value: calc.hoa, color: dark ? '#565656' : '#c7b899' }] : []),
  ]

  const total = useTween(calc.total)
  const bump = useBump(Math.round(calc.total))
  const terms = [30, 20, 15] as const

  return (
    <div className={`pe grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14 ${t.text}`}>
      <div>
        <p className={t.label}>Estimated monthly payment</p>
        <p key={bump} className={`${t.heading} pe-total mt-3 text-5xl leading-none tabular-nums sm:text-6xl`} aria-live="polite">
          {fmtMoney(total) || '$0'}<span className={`ml-1 text-lg ${t.muted}`}>/mo</span>
        </p>

        <div className="mt-8 flex items-center gap-7">
          <Ring parts={parts} total={calc.total} track={dark ? 'rgba(255,255,255,.08)' : 'rgba(23,37,34,.08)'} />
          <ul className="min-w-0 flex-1 space-y-3">
            {parts.map(part => (
              <li key={part.key} className="flex items-center justify-between gap-4 text-sm">
                <span className={`flex items-center gap-2.5 ${t.muted}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: part.color }} />{part.label}</span>
                <Money value={part.value} className="font-semibold tabular-nums" />
              </li>
            ))}
            <li className={`flex items-center justify-between gap-4 border-t pt-3 text-xs ${dark ? 'border-white/10' : 'border-black/10'} ${t.faint}`}>
              <span>Loan amount</span><Money value={calc.loan} className="tabular-nums" />
            </li>
            <li className={`flex items-center justify-between gap-4 text-xs ${t.faint}`}>
              <span>Interest over {years} years</span><Money value={calc.interest} className="tabular-nums" />
            </li>
          </ul>
        </div>
        <p className={`mt-6 text-[11px] leading-relaxed ${t.faint}`}>
          Estimate only - not a loan offer. Excludes homeowners insurance{downPct < 20 ? ', mortgage insurance' : ''} and closing costs.
          {taxesMonthly ? ' Taxes are based on the most recent annual tax bill on record.' : ''}
          {usingMarket ? ` Rate is Freddie Mac's U.S. average for a ${years}-year fixed${years === 20 ? ' (midpoint of its 15- and 30-year averages)' : ''}, week of ${asOf}.` : ''} Rates vary; talk to a lender for a real quote.
        </p>
      </div>

      <div className="space-y-7">
        <label className="block">
          <span className={t.label}>Home price</span>
          <div className="relative mt-1.5">
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${dark ? 'left-4' : 'left-0'} ${t.muted}`}>$</span>
            <input
              inputMode="numeric"
              value={homePrice.toLocaleString('en-US')}
              onChange={e => setHomePrice(Math.min(100_000_000, parseInt(e.target.value.replace(/[^\d]/g, '') || '0', 10)))}
              className={`${t.input} ${dark ? '!pl-8' : '!pl-4'} tabular-nums`}
              aria-label="Home price"
            />
          </div>
        </label>
        <Slider label="Down payment" t={t} min={0} max={60} step={1} value={downPct} onChange={setDownPct}
          display={`${downPct}% · ${fmtMoney(calc.down) || '$0'}`} bubble={`${downPct}%`} aria="Down payment percent" />
        <Slider label="Interest rate" t={t} min={2} max={10} step={0.125} value={rate} onChange={v => { setRateTouched(true); setRate(Math.round(v * 1000) / 1000) }}
          display={`${rate.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`} bubble={`${rate.toFixed(2)}%`} aria="Interest rate" />
        {usingMarket && <p className={`-mt-5 text-[11px] font-semibold ${t.faint}`}>This week's Freddie Mac average{asOf ? ` (${asOf})` : ''} - drag to try your own.</p>}
        <div>
          <span className={t.label}>Loan term</span>
          <div className={`pe-terms relative mt-2 grid grid-cols-3 p-1 ${dark ? 'rounded-full bg-white/[0.06]' : 'bg-black/[0.05]'}`}>
            <span className={`pe-glide absolute inset-y-1 left-1 ${dark ? 'rounded-full' : ''}`}
              style={{ width: 'calc((100% - .5rem) / 3)', transform: `translateX(${terms.indexOf(years) * 100}%)`, background: 'var(--sp-accent)' }} aria-hidden />
            {terms.map(y => (
              <button key={y} type="button" onClick={() => setYears(y)} aria-pressed={years === y}
                className={`relative z-10 py-2.5 text-xs font-semibold transition-colors duration-300 ${years === y ? 'text-[color:var(--sp-on-accent)]' : t.muted}`}>
                {y} years
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .pe-total{animation:peBump .45s cubic-bezier(.2,.8,.2,1)}
        @keyframes peBump{0%{transform:translateY(0);text-shadow:none}35%{transform:translateY(-2px);text-shadow:0 0 22px color-mix(in srgb,var(--sp-accent) 55%,transparent)}100%{transform:none;text-shadow:none}}
        .pe-glide{transition:transform .45s cubic-bezier(.65,0,.35,1);box-shadow:0 6px 18px -6px color-mix(in srgb,var(--sp-accent) 70%,transparent)}
        .pe-ring circle.seg{transition:stroke-dasharray .7s cubic-bezier(.65,0,.35,1),stroke-dashoffset .7s cubic-bezier(.65,0,.35,1)}
        .pe-ring{animation:peSpin 1.1s cubic-bezier(.2,.8,.2,1) both}
        @keyframes peSpin{from{transform:rotate(-120deg) scale(.85);opacity:0}to{transform:none;opacity:1}}
        .sp-range{-webkit-appearance:none;appearance:none;height:6px;border-radius:999px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,var(--sp-accent) 0 var(--fill),${dark ? 'rgba(255,255,255,.14)' : 'rgba(23,37,34,.16)'} var(--fill) 100%)}
        .sp-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:var(--sp-accent);border:3px solid ${dark ? '#0b0b0b' : '#f3efe6'};box-shadow:0 0 0 1px var(--sp-accent);cursor:grab;transition:transform .2s,box-shadow .2s}
        .sp-range:hover::-webkit-slider-thumb{transform:scale(1.12)}
        .sp-range:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.25);box-shadow:0 0 0 1px var(--sp-accent),0 0 0 10px color-mix(in srgb,var(--sp-accent) 22%,transparent)}
        .sp-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--sp-accent);border:3px solid ${dark ? '#0b0b0b' : '#f3efe6'};cursor:grab}
        .pe-bubble{opacity:0;transform:translate(-50%,6px) scale(.9);transition:opacity .2s,transform .25s cubic-bezier(.2,.8,.2,1)}
        .pe-slider:hover .pe-bubble,.pe-slider:focus-within .pe-bubble{opacity:1;transform:translate(-50%,0) scale(1)}
        @media (prefers-reduced-motion: reduce){.pe-total,.pe-ring{animation:none}.pe-glide,.pe-ring circle.seg{transition:none}}
      `}</style>
    </div>
  )
}

function Slider({ label, t, min, max, step, value, onChange, display, bubble, aria }: {
  label: string; t: (typeof TONE)[Tone]; min: number; max: number; step: number; value: number
  onChange: (v: number) => void; display: string; bubble: string; aria: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="pe-slider block">
      <span className={`${t.label} flex justify-between`}><span>{label}</span><span className="tabular-nums normal-case tracking-normal">{display}</span></span>
      <div className="relative mt-4">
        <span className="pe-bubble pointer-events-none absolute -top-8 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{ left: `calc(${pct}% + ${11 - pct * 0.22}px)`, background: 'var(--sp-accent)', color: 'var(--sp-on-accent)' }}>{bubble}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
          className="sp-range w-full" style={{ ['--fill' as string]: `${pct}%` }} aria-label={aria} />
      </div>
    </label>
  )
}

// The slices of the monthly payment as a ring - each slice slides to its new size.
function Ring({ parts, total, track }: { parts: { key: string; value: number; color: string }[]; total: number; track: string }) {
  const r = 46
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 120 120" className="pe-ring h-32 w-32 shrink-0 -rotate-90 sm:h-36 sm:w-36" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="12" />
      {parts.map(part => {
        const len = total ? (part.value / total) * c : 0
        const gap = parts.length > 1 && len > 3 ? 2 : 0
        const el = <circle key={part.key} className="seg" cx="60" cy="60" r={r} fill="none" stroke={part.color} strokeWidth="12" strokeLinecap="butt"
          strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} />
        offset += len
        return el
      })}
    </svg>
  )
}

function Money({ value, className = '' }: { value: number; className?: string }) {
  const v = useTween(value)
  return <span className={className}>{fmtMoney(v) || '$0'}</span>
}

// Rolls a number to its new value (ease-out) instead of jumping.
function useTween(target: number, ms = 650) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  const cur = useRef(target)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); cur.current = target; return }
    from.current = cur.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const next = from.current + (target - from.current) * (1 - Math.pow(1 - k, 3))
      cur.current = next
      setV(next)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

// A key that changes (at most every ~250ms) when the value changes - restarts the glow.
function useBump(value: number) {
  const [n, setN] = useState(0)
  const last = useRef(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const now = Date.now()
    if (now - last.current > 250) { last.current = now; setN(x => x + 1) }
  }, [value])
  return n
}
