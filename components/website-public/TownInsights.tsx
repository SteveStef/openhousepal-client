'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bath, BedDouble, CalendarClock, Gauge, Landmark, LandPlot, Ruler } from 'lucide-react'

// Town page, Market section: three live reads from our own MLS data (backend
// market_insights_service) - buyer's or seller's market, what each price range buys here, and
// property taxes per square foot (by school district when the town spans several). Each card
// says how many homes it's based on; a card with too little data simply isn't sent.
export interface TownInsightsData {
  homes_counted?: number
  money_buys?: { label: string; homes: number; beds?: number | null; baths?: number | null; sqft?: number | null; acres?: number | null; year_built?: number | null }[]
  gauge?: { label?: string | null; months_of_supply?: number | null; active_count?: number; sales_per_month?: number | null; over_asking_pct?: number | null; median_sale_to_list_pct?: number | null; median_days_on_market?: number | null; sales_counted?: number }
  taxes?: { per_sqft: number; typical_sqft?: number | null; typical_annual?: number | null; homes: number; districts?: { name: string; per_sqft: number; homes: number }[] }
}

const ease = [0.16, 1, 0.3, 1] as const

export default function TownInsights({ data, town, luxe }: { data?: TownInsightsData | null; town: string; luxe: boolean }) {
  const bands = data?.money_buys || []
  const [band, setBand] = useState(Math.min(2, Math.max(0, bands.length - 1)))
  if (!data || (!bands.length && !data.gauge && !data.taxes)) return null
  const card = `border p-5 sm:p-6 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`
  const cardStyle = { borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }
  const eyebrow = (icon: React.ReactNode, text: string) => (
    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>{icon}{text}</p>
  )
  const g = data.gauge
  // Meter: 0-9+ months of supply; seller's < 3, balanced 3-6, buyer's > 6.
  const pos = g?.months_of_supply != null ? Math.min(100, (g.months_of_supply / 9) * 100) : null
  const b = bands[band]

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      {g && (
        <motion.div className={card} style={cardStyle} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
          {eyebrow(<Gauge className="h-3.5 w-3.5" />, 'Market pace')}
          <p className="ohp-site-heading mt-2 text-2xl font-black sm:text-3xl" style={{ color: 'var(--site-heading)' }}>{g.label || 'Market pace'}</p>
          {pos != null && (
            <div className="mt-5">
              <div className="relative h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--site-accent) 0%, var(--site-accent) 33%, rgba(var(--site-accent-rgb),.45) 33%, rgba(var(--site-accent-rgb),.45) 66%, var(--site-line-strong) 66%)' }}>
                {/* Slides in with transform (a full-width track moving under the marker), not `left`,
                    which re-laid-out the page every frame. */}
                <motion.span aria-hidden className="pointer-events-none absolute inset-0" initial={{ x: `-${pos}%` }} whileInView={{ x: '0%' }} viewport={{ once: true }} transition={{ duration: 1.2, ease, delay: 0.2 }}>
                  <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] shadow-md"
                    style={{ left: `${pos}%`, borderColor: 'var(--site-surface)', backgroundColor: 'var(--site-heading)' }} />
                </motion.span>
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>
                <span>Seller&apos;s</span><span>Balanced</span><span>Buyer&apos;s</span>
              </div>
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--site-line)' }}>
            {([
              g.months_of_supply != null ? ['Months of supply', String(g.months_of_supply)] : null,
              g.over_asking_pct != null ? ['Sold over asking', `${g.over_asking_pct}%`] : null,
              g.median_sale_to_list_pct != null ? ['Sale-to-list', `${g.median_sale_to_list_pct}%`] : null,
              g.median_days_on_market != null ? ['Days on market', String(g.median_days_on_market)] : null,
            ].filter(Boolean) as [string, string][]).map(([k, v]) => (
              <div key={k} className="px-4 py-3" style={{ backgroundColor: 'var(--site-surface)' }}>
                <dd className="text-xl font-black" style={{ color: 'var(--site-heading)' }}>{v}</dd>
                <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{k}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px]" style={{ color: 'var(--site-muted)' }}>{g.active_count} homes for sale vs about {g.sales_per_month} sales a month · based on {g.sales_counted} sales in the last 12 months.</p>
        </motion.div>
      )}

      {data.taxes && (
        <motion.div className={card} style={cardStyle} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.08 }}>
          {eyebrow(<Landmark className="h-3.5 w-3.5" />, 'Property taxes')}
          <p className="ohp-site-heading mt-2 text-2xl font-black sm:text-3xl" style={{ color: 'var(--site-heading)' }}>${data.taxes.per_sqft.toFixed(2)} <span className="text-base font-bold" style={{ color: 'var(--site-muted)' }}>per sq ft a year</span></p>
          {data.taxes.typical_annual && data.taxes.typical_sqft ? (
            <p className="mt-2 text-sm" style={{ color: 'var(--site-ink-soft)' }}>A typical {data.taxes.typical_sqft.toLocaleString()} sq ft home in {town}: about <b style={{ color: 'var(--site-heading)' }}>${data.taxes.typical_annual.toLocaleString()}</b> a year.</p>
          ) : null}
          {(data.taxes.districts || []).length > 1 && (
            <div className="mt-5 space-y-3">
              {(() => {
                const max = Math.max(...data.taxes!.districts!.map(d => d.per_sqft))
                return data.taxes!.districts!.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate font-bold" style={{ color: 'var(--site-ink-soft)' }}>{d.name}</span>
                      <span className="shrink-0 font-black" style={{ color: 'var(--site-heading)' }}>${d.per_sqft.toFixed(2)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                      <motion.div className="h-full origin-left rounded-full" style={{ backgroundColor: 'var(--site-accent)', width: `${(d.per_sqft / max) * 100}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease, delay: 0.2 + i * 0.1 }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
          <p className="mt-4 text-[11px]" style={{ color: 'var(--site-muted)' }}>Based on {data.taxes.homes} homes&apos; recorded tax bills. Every home&apos;s bill depends on its own assessment - check the listing or the county for an exact figure.</p>
        </motion.div>
      )}

      {bands.length >= 2 && b && (
        <motion.div className={`${card} lg:col-span-2`} style={cardStyle} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: 0.12 }}>
          {eyebrow(<Ruler className="h-3.5 w-3.5" />, 'What your money buys')}
          <p className="ohp-site-heading mt-2 text-2xl font-black sm:text-3xl" style={{ color: 'var(--site-heading)' }}>What you get in {town}, by budget</p>
          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {bands.map((x, i) => (
              <button key={x.label} type="button" onClick={() => setBand(i)}
                className={`relative shrink-0 px-4 py-2.5 text-sm font-black transition-colors duration-300 ${luxe ? 'rounded-full' : 'rounded-lg'}`}
                style={{ color: i === band ? 'var(--site-on-accent)' : 'var(--site-ink-soft)' }}>
                {i === band && <motion.span layoutId="ohp-money-band" className={`absolute inset-0 ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'var(--site-accent)' }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative">{x.label}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={b.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease }}
              className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                b.beds ? [BedDouble, `${b.beds}`, 'bedrooms'] : null,
                b.baths ? [Bath, `${b.baths}`, 'bathrooms'] : null,
                b.sqft ? [Ruler, b.sqft.toLocaleString(), 'sq ft'] : null,
                b.acres ? [LandPlot, `${b.acres}`, 'acre lot'] : null,
                b.year_built ? [CalendarClock, `${b.year_built}`, 'typically built'] : null,
              ].filter(Boolean) as [typeof Ruler, string, string][]).map(([Icon, v, l]) => (
                <div key={l} className={`border px-4 py-4 ${luxe ? 'rounded-[18px]' : 'rounded-xl'}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-bg-alt)' }}>
                  <Icon className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
                  <p className="mt-2 text-2xl font-black" style={{ color: 'var(--site-heading)' }}>{v}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{l}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-[11px]" style={{ color: 'var(--site-muted)' }}>The middle home of {b.homes} sold in the last two years or for sale now at {b.label}.</p>
        </motion.div>
      )}
    </div>
  )
}
