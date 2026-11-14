'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PRICING_PLANS, type PlanTierId } from '@/lib/pricing'

// Plain arithmetic on the real list prices (lib/pricing.ts, the same numbers the plan cards show):
// agents x plan price. No discounts promised here; office pricing is a conversation.
const ORDER: PlanTierId[] = ['BASIC', 'PREMIUM', 'IDX', 'NO_MLS', 'PRO_NO_MLS']
const money = (n: number, cents = true) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })

export default function OfficeCalculator() {
  const [agents, setAgents] = useState(10)
  const [tier, setTier] = useState<PlanTierId>('PREMIUM')
  const plan = PRICING_PLANS[tier]
  const monthly = Math.round(agents * plan.price * 100) / 100
  const perDay = plan.price / 30
  const pct = ((agents - 1) / 99) * 100

  return (
    <div className="rounded-3xl border border-[#C9A24D]/30 bg-white p-5 shadow-[0_30px_60px_-40px_rgba(139,106,43,.6)] dark:bg-[#151517] sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Price out your office</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="br-agents" className="text-sm font-black text-[#111827] dark:text-white">Agents</label>
          <span className="font-serif text-3xl font-black text-[#111827] dark:text-white" aria-live="polite">{agents}</span>
        </div>
        <input id="br-agents" type="range" min={1} max={100} value={agents} onChange={e => setAgents(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full accent-[#C9A24D]"
          style={{ background: `linear-gradient(90deg, #C9A24D ${pct}%, rgba(156,163,175,.3) ${pct}%)` }} />
        <div className="mt-1 flex justify-between text-[11px] font-bold text-gray-400"><span>1</span><span>100</span></div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-black text-[#111827] dark:text-white">Plan</p>
        <div role="radiogroup" aria-label="Plan" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ORDER.map(t => {
            const p = PRICING_PLANS[t]
            const on = t === tier
            return (
              <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setTier(t)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 ring-1 ring-[#C9A24D]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'}`}>
                <span className="block text-[13px] font-black text-[#111827] dark:text-white">{p.name}</span>
                <span className="block text-[12px] font-bold text-gray-500 dark:text-gray-400">{p.priceString}/mo</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#111827] to-[#1c1a16] p-5 text-white">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">{agents} {agents === 1 ? 'agent' : 'agents'} on {plan.name}</p>
        <p className="mt-1 font-serif text-4xl font-black sm:text-5xl"><span className="mk-gold">{money(monthly, monthly % 1 !== 0)}</span><span className="text-lg font-bold text-gray-400"> /month</span></p>
        <p className="mt-2 text-sm font-medium text-gray-300">That&apos;s about <b className="text-white">{money(perDay)}</b> per agent per day, at standard list prices.</p>
        {tier === 'IDX' && <p className="mt-1 text-xs font-medium text-gray-400">The IDX plan also has a one-time website setup fee.</p>}
      </div>

      <Link href="#talk" className="mk-cta mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-6 py-3.5 text-[15px] font-black text-[#111827]">
        Ask about pricing for your office <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
