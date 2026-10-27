'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, MessageCircle } from 'lucide-react'

// "What would I pay a month?" on a home's page: principal & interest from the price, down
// payment, rate and term the visitor picks, plus the home's REAL annual taxes and HOA fee from
// the listing record (when the MLS has them) and an insurance estimate. A ring shows the split.
// "Talk financing" opens the agent's general form in a window with this home attached.
// Motion (user, 10/27): the ring draws in when it scrolls into view, every dollar figure glides
// to its new value, each cost row has a share bar, the sliders fill with the accent up to the
// handle (.ohp-range in site-theme.css) and the term buttons share one sliding pill.
const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

// A number that glides to its new value instead of jumping.
function useGlide(target: number, ms = 450) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const next = a + (target - a) * (1 - Math.pow(1 - k, 3))
      from.current = next
      setV(next)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function Money({ v, className = '' }: { v: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{fmt(useGlide(v))}</span>
}

export default function PaymentCalculator({ price, annualTaxes, hoaMonthly, address, basePrefix = '', serif = '' }: {
  price: number
  annualTaxes?: number | null
  hoaMonthly?: number | null
  address?: string | null
  basePrefix?: string
  serif?: string
}) {
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(6.5)
  const [years, setYears] = useState(30)
  const loan = price * (1 - downPct / 100)
  const r = rate / 100 / 12
  const n = years * 12
  const pi = r > 0 ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n
  const tax = (annualTaxes && annualTaxes > 0 ? annualTaxes : price * 0.012) / 12
  const ins = (price * 0.0035) / 12
  const hoa = hoaMonthly && hoaMonthly > 0 ? hoaMonthly : 0
  const total = pi + tax + ins + hoa
  const parts = useMemo(() => [
    { label: 'Principal & interest', v: pi, c: 'var(--site-accent)' },
    { label: annualTaxes ? 'Property taxes' : 'Property taxes (est.)', v: tax, c: 'var(--site-accent-deep)' },
    { label: 'Home insurance (est.)', v: ins, c: 'var(--site-accent-light)' },
    ...(hoa ? [{ label: 'HOA', v: hoa, c: 'var(--site-heading)' }] : []),
  ], [pi, tax, ins, hoa, annualTaxes])

  // The ring stays empty until the calculator is on screen, then draws in.
  const boxRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el || seen) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  // Ring segments
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0

  const fill = (v: number, min: number, max: number) => ({ ['--fill' as any]: `${((v - min) / (max - min)) * 100}%` })
  const prefill = JSON.stringify({ property_of_interest: address || '' })
  return (
    <div ref={boxRef} className="mt-6 overflow-hidden rounded-[24px] border p-5 sm:p-7" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }} data-testid="payment-calculator">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className={`relative mx-auto h-44 w-44 shrink-0 transition duration-700 ${seen ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
          <span aria-hidden className="absolute inset-3 rounded-full" style={{ background: 'radial-gradient(circle, rgba(var(--site-accent-rgb), .16), transparent 70%)' }} />
          <svg viewBox="0 0 140 140" className="relative h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" strokeWidth="14" style={{ stroke: 'var(--site-line)' }} />
            {parts.map((p, i) => {
              const len = seen ? (p.v / total) * C : 0
              const seg = <circle key={p.label} cx="70" cy="70" r={R} fill="none" strokeWidth="14" strokeLinecap="butt" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc}
                style={{ stroke: p.c, transition: `stroke-dasharray .7s cubic-bezier(.16,1,.3,1) ${seen ? 0 : i * 0.12}s, stroke-dashoffset .7s cubic-bezier(.16,1,.3,1)` }} />
              acc += len
              return seg
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <Money v={seen ? total : 0} className={`text-[26px] font-black leading-none ${serif}`} />
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>per month</span>
          </div>
        </div>
        <div className="min-w-0 space-y-5" style={{ color: 'var(--site-heading)' }}>
          <div>
            <div className="flex items-baseline justify-between text-xs font-bold" style={{ color: 'var(--site-muted)' }}><span>Down payment</span><span className="tabular-nums" style={{ color: 'var(--site-heading)' }}>{downPct}% · <Money v={price * downPct / 100} /></span></div>
            <input type="range" min={3} max={50} step={1} value={downPct} onChange={e => setDownPct(Number(e.target.value))} className="ohp-range mt-2" style={fill(downPct, 3, 50)} aria-label="Down payment percent" />
          </div>
          <div>
            <div className="flex items-baseline justify-between text-xs font-bold" style={{ color: 'var(--site-muted)' }}><span>Interest rate</span><span className="tabular-nums" style={{ color: 'var(--site-heading)' }}>{rate.toFixed(2)}%</span></div>
            <input type="range" min={3} max={9} step={0.125} value={rate} onChange={e => setRate(Number(e.target.value))} className="ohp-range mt-2" style={fill(rate, 3, 9)} aria-label="Interest rate" />
          </div>
          <div className="flex gap-1 rounded-2xl border p-1" style={{ borderColor: 'var(--site-line-strong)' }}>
            {[30, 20, 15].map(y => (
              <button key={y} type="button" onClick={() => setYears(y)} className="relative flex-1 rounded-xl py-2 text-xs font-black transition-colors"
                style={{ color: years === y ? 'var(--site-on-accent)' : 'var(--site-ink-soft)' }}>
                {years === y && <motion.span layoutId="ohp-term-pill" className="absolute inset-0 rounded-xl" style={{ backgroundColor: 'var(--site-accent)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{y}-year</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2" style={{ color: 'var(--site-heading)' }}>
        {parts.map((p, i) => (
          <div key={p.label} className={`relative overflow-hidden rounded-xl px-3.5 py-2.5 text-sm transition duration-500 ${seen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`} style={{ backgroundColor: 'var(--site-bg-alt)', transitionDelay: `${200 + i * 80}ms` }}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--site-ink-soft)' }}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.c }} />{p.label}</span>
              <Money v={p.v} className="font-black" />
            </div>
            {/* This cost's share of the month */}
            <span aria-hidden className="absolute bottom-0 left-0 h-[3px] rounded-r-full transition-[width] duration-700 ease-out" style={{ width: seen ? `${(p.v / total) * 100}%` : '0%', backgroundColor: p.c }} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--site-line)' }}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--site-faint)' }}><Calculator className="h-3.5 w-3.5" />An estimate - your lender sets the real numbers.</p>
        <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title="Talk financing" data-ohp-prefill={prefill}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
          <MessageCircle className="h-3.5 w-3.5" /> Talk financing
        </a>
      </div>
    </div>
  )
}
