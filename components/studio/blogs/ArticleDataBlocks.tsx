'use client'

import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Calculator, ExternalLink } from 'lucide-react'
import { contrastRatio } from '@/lib/siteTheme'

// Button text that stays readable on the article's accent color: white on a deep accent, near-black on a
// bright one (a bright gold with white letters was hard to read - 11/16 IDX dark mode check).
export const inkOn = (accent: string) => (/^#[0-9a-f]{6}$/i.test(accent) && contrastRatio(accent, '#ffffff') < contrastRatio(accent, '#111827') ? '#111827' : '#ffffff')

// Two blocks the AI writer's research pipeline adds to an article, both filled from real data
// (never typed by the model): a worked payment example for a realistic entry price, and the
// article's sources with what each area's numbers cover.

export type PaymentScenario = {
  down_pct: number; down: number; loan: number; principal_interest: number
  mortgage_insurance: 'none' | 'lender quote'; tax?: number | null; monthly_before_insurance: number; jumbo?: boolean
  /** monthly_before_insurance plus the town's median association fee (attached-home examples only). */
  with_fee?: number | null
}
export type PaymentExampleData = {
  price: number; price_basis?: string; rate: number; rate_as_of?: string; term_years?: number
  tax_pct?: number | null; tax_basis?: string | null; closing_low: number; closing_high: number
  /** What the closing-cost range is made of, when it isn't the plain national 2-5% (a city with a large transfer tax). */
  closing_basis?: string | null
  limit_known?: boolean; limit_area?: string | null
  scenarios: PaymentScenario[]; as_of?: string; cta_form?: string | null; closing_note?: string | null
  /** The median monthly association fee of the condos or townhomes for sale that list one (11/15: grader round 7). */
  fee?: { monthly: number; homes: number; label: string } | null
}

const usd = (n?: number | null) => (n == null ? '-' : `$${Math.round(n).toLocaleString('en-US')}`)
const day = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PaymentExample({ data, accent = '#C9A24D', onAction }: { data: PaymentExampleData; accent?: string; onAction?: () => void }) {
  if (!data?.price || !data.scenarios?.length) return null
  // Only where the example is a condo or townhome and the town's listings give a median fee.
  const fee = data.fee && data.fee.monthly ? data.fee : null
  const rows: { label: string; get: (s: PaymentScenario) => string; strong?: boolean }[] = [
    { label: 'Down payment', get: s => usd(s.down) },
    { label: 'Loan amount', get: s => usd(s.loan) + (s.jumbo ? ' *' : '') },
    { label: 'Principal & interest', get: s => `${usd(s.principal_interest)}/mo` },
    ...(data.scenarios.some(s => s.tax) ? [{ label: 'Property tax (est.)', get: (s: PaymentScenario) => `${usd(s.tax)}/mo` }] : []),
    { label: 'Mortgage insurance', get: s => (s.mortgage_insurance === 'none' ? 'None' : 'Lender quote') },
    { label: data.scenarios.some(s => s.tax) ? 'Principal, interest & tax' : 'Principal & interest only', get: s => `${usd(s.monthly_before_insurance)}/mo`, strong: !fee },
    ...(fee ? [
      { label: 'Association fee (median)', get: () => `${usd(fee.monthly)}/mo` },
      { label: 'With the association fee', get: (s: PaymentScenario) => `${usd(s.with_fee ?? s.monthly_before_insurance + fee.monthly)}/mo`, strong: true },
    ] : []),
  ]
  return (
    <motion.section initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="not-prose my-10 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_40px_80px_-55px_rgba(17,24,39,.55)] dark:border-white/10 dark:bg-[#121214]">
      <div className="relative px-6 pb-5 pt-6 sm:px-8 sm:pt-8" style={{ background: `linear-gradient(150deg, ${accent}1f, transparent 60%)` }}>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: accent }}>
          <Calculator className="h-3.5 w-3.5" /> What it could cost
        </p>
        <p className="mt-2 font-serif text-4xl font-black leading-none text-[#111827] dark:text-white sm:text-5xl">{usd(data.price)}</p>
        {data.price_basis && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-white/65">{data.price_basis}</p>}
        <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-full border px-3 py-1 text-[11px] font-bold text-gray-600 dark:text-white/70" style={{ borderColor: `${accent}55` }}>
          {data.term_years || 30}-year fixed at {data.rate.toFixed(2)}%<span className="text-gray-400">·</span>Freddie Mac average{data.rate_as_of ? `, week of ${day(data.rate_as_of)}` : ''}
        </p>
        {/* 11/01 grader: readers took the total for a full monthly payment - say what's in it, up front. */}
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#111827] dark:text-white/85">
          {data.scenarios.some(s => s.tax) ? 'Estimated principal, interest and property tax.' : 'Estimated principal and interest.'}{' '}
          <span className="font-bold text-gray-500 dark:text-white/55">{fee ? 'Not included: homeowners insurance and mortgage insurance.' : 'Not included: homeowners insurance, mortgage insurance and any condo or HOA fee.'}</span>
        </p>
      </div>

      {/* Phones: one card per down payment. Wider: a comparison table. */}
      <div className="grid gap-3 px-4 pb-2 sm:hidden">
        {data.scenarios.map(s => (
          <div key={s.down_pct} className="rounded-2xl border p-4" style={{ borderColor: `${accent}40` }}>
            <p className="font-serif text-xl font-black text-[#111827] dark:text-white">{s.down_pct}% down</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {rows.map(r => (
                <div key={r.label} className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-white/55">{r.label}</dt>
                  <dd className={r.strong ? 'font-black text-[#111827] dark:text-white' : 'font-semibold text-gray-800 dark:text-white/85'}>{r.get(s)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="hidden px-6 sm:block sm:px-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400" />
              {data.scenarios.map(s => (
                <th key={s.down_pct} className="py-3 text-right font-serif text-lg font-black text-[#111827] dark:text-white">{s.down_pct}% down</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-t border-gray-100 dark:border-white/10">
                <td className={`py-2.5 pr-3 ${r.strong ? 'font-black text-[#111827] dark:text-white' : 'text-gray-500 dark:text-white/55'}`}>{r.label}</td>
                {data.scenarios.map(s => (
                  <td key={s.down_pct} className={`py-2.5 text-right tabular-nums ${r.strong ? 'text-base font-black text-[#111827] dark:text-white' : 'font-semibold text-gray-800 dark:text-white/85'}`} style={r.strong ? { color: undefined } : undefined}>{r.get(s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mx-6 mt-4 rounded-2xl border border-dashed p-4 text-sm sm:mx-8" style={{ borderColor: `${accent}66` }}>
        <p className="font-black text-[#111827] dark:text-white">Cash to bring to settlement</p>
        <p className="mt-1 text-gray-600 dark:text-white/70">Your down payment plus closing costs of about <strong className="text-[#111827] dark:text-white">{usd(data.closing_low)} - {usd(data.closing_high)}</strong> - {data.closing_basis || "the CFPB's typical range of 2-5% of the price."}{data.closing_note ? ` ${data.closing_note}` : ''}</p>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:pb-8">
        <p className="max-w-xl text-[11px] leading-relaxed text-gray-500 dark:text-white/55">
          An example, not a quote. The rate is Freddie Mac&apos;s national average for well-qualified borrowers putting 20% down; yours depends on your credit, down payment, loan type and lender. Property tax {data.tax_basis ? `uses the ${data.tax_basis}` : 'varies by assessment'}; {fee ? `homeowners insurance is not included, and the association fee is the median of the ${fee.homes} ${fee.label} for sale that list one - a home's own fee can be higher or lower` : 'homeowners insurance and any HOA fee are not included'}. Mortgage insurance applies to conventional loans under 20% down (FHA loans carry it at any down payment; VA loans have none).
          {data.scenarios.some(s => s.jumbo) ? ` * Above ${data.limit_area ? `${data.limit_area}'s` : 'the county\'s'} 2026 conforming loan limit - a jumbo loan with its own rates and rules. The rate shown is Freddie Mac's average for conforming loans, so ask a lender for a jumbo quote.` : ''}
        </p>
        {onAction && (
          <button type="button" onClick={onAction} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: accent, color: inkOn(accent) }}>
            Get my numbers for a home <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.section>
  )
}

export type SourcesData = { items?: { name: string; url: string; as_of?: string | null; read?: string | null }[]; mls?: string | null; notes?: string[] }

// Two different dates, never one unexplained bracket: the date or period the fact is for, and the day the page was read.
const sourceDates = (s: { as_of?: string | null; read?: string | null }) => {
  const parts = [s.as_of && s.as_of !== s.read ? `for ${s.as_of}` : '', s.read ? `page read ${s.read}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : (s.as_of || '')
}

export function SourcesList({ data, accent = '#C9A24D' }: { data: SourcesData; accent?: string }) {
  const items = (data?.items || []).filter(s => s?.url && /^https?:\/\//i.test(s.url))
  const notes = data?.notes || []
  if (!items.length && !notes.length && !data?.mls) return null
  return (
    <details className="not-prose group my-8 rounded-2xl border border-gray-200 bg-gray-50/60 p-5 open:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#111827] dark:text-white">
        <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" style={{ color: accent }} /> Sources &amp; data notes</span>
        <span className="text-[11px] font-bold text-gray-400 group-open:hidden">{items.length ? `${items.length} sources` : 'Show'}</span>
      </summary>
      {items.length > 0 && (
        <ol className="mt-4 space-y-2 text-[13px]">
          {items.map((s, k) => (
            <li key={s.url + k} className="flex gap-2">
              <span className="w-5 shrink-0 text-right font-black tabular-nums text-gray-400">{k + 1}.</span>
              <a href={s.url} target="_blank" rel="noopener" className="font-semibold text-gray-700 underline decoration-gray-300 underline-offset-2 hover:decoration-current dark:text-white/80">
                {s.name}<ExternalLink className="ml-1 inline h-3 w-3 align-[-1px] opacity-60" />
              </a>
              {sourceDates(s) && <span className="text-gray-500 dark:text-white/55">({sourceDates(s)})</span>}
            </li>
          ))}
        </ol>
      )}
      {(data.mls || notes.length > 0) && (
        <div className="mt-4 space-y-1.5 border-t border-gray-200 pt-4 text-[12px] leading-relaxed text-gray-500 dark:border-white/10 dark:text-white/55">
          {data.mls && <p>{data.mls}</p>}
          {notes.map((n, k) => <p key={k}>{n}</p>)}
        </div>
      )}
    </details>
  )
}
