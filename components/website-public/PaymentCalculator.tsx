'use client'

import { useMemo, useState } from 'react'
import { Calculator, MessageCircle } from 'lucide-react'

// "What would I pay a month?" on a home's page: principal & interest from the price, down
// payment, rate and term the visitor picks, plus the home's REAL annual taxes and HOA fee from
// the listing record (when the MLS has them) and an insurance estimate. A ring shows the split.
// "Talk financing" opens the agent's general form in a window with this home attached.
const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

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
  // Ring segments
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0

  const slider = 'h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[color:var(--site-accent)]'
  const prefill = JSON.stringify({ property_of_interest: address || '' })
  return (
    <div className="mt-6 overflow-hidden rounded-[24px] border p-5 sm:p-7" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }} data-testid="payment-calculator">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="relative mx-auto h-44 w-44 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" strokeWidth="14" style={{ stroke: 'var(--site-line)' }} />
            {parts.map(p => {
              const len = (p.v / total) * C
              const seg = <circle key={p.label} cx="70" cy="70" r={R} fill="none" strokeWidth="14" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} style={{ stroke: p.c, transition: 'stroke-dasharray .6s ease, stroke-dashoffset .6s ease' }} />
              acc += len
              return seg
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-[26px] font-black leading-none ${serif}`} style={{ color: 'var(--site-heading)' }}>{fmt(total)}</span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>per month</span>
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex items-baseline justify-between text-xs font-bold" style={{ color: 'var(--site-muted)' }}><span>Down payment</span><span style={{ color: 'var(--site-heading)' }}>{downPct}% · {fmt(price * downPct / 100)}</span></div>
            <input type="range" min={3} max={50} step={1} value={downPct} onChange={e => setDownPct(Number(e.target.value))} className={slider} style={{ backgroundColor: 'var(--site-line)' }} aria-label="Down payment percent" />
          </div>
          <div>
            <div className="flex items-baseline justify-between text-xs font-bold" style={{ color: 'var(--site-muted)' }}><span>Interest rate</span><span style={{ color: 'var(--site-heading)' }}>{rate.toFixed(2)}%</span></div>
            <input type="range" min={3} max={9} step={0.125} value={rate} onChange={e => setRate(Number(e.target.value))} className={slider} style={{ backgroundColor: 'var(--site-line)' }} aria-label="Interest rate" />
          </div>
          <div className="flex gap-2">
            {[30, 20, 15].map(y => (
              <button key={y} type="button" onClick={() => setYears(y)} className="flex-1 rounded-xl border py-2 text-xs font-black transition"
                style={years === y ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)', borderColor: 'transparent' } : { borderColor: 'var(--site-line-strong)', color: 'var(--site-ink-soft)' }}>{y}-year</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {parts.map(p => (
          <div key={p.label} className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
            <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--site-ink-soft)' }}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.c }} />{p.label}</span>
            <span className="font-black" style={{ color: 'var(--site-heading)' }}>{fmt(p.v)}</span>
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
