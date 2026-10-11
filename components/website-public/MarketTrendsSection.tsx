import { ArrowDownRight, ArrowUpRight, CalendarClock, Gauge, Home, Layers, Percent, TrendingUp } from 'lucide-react'
import type { SiteTheme } from './types'
import { formatCompactPrice } from './listingFormat'
import { fontClass } from './blocks/fontClass'

interface TrendMonth { month: string; label: string; closed: number; median_price: number | null }
export interface MarketTrends {
  months?: number
  series?: TrendMonth[]
  closed_count?: number
  median_sold_price?: number | null
  prior_median_sold_price?: number | null
  yoy_median_change_pct?: number | null
  median_sale_to_list_pct?: number | null
  median_sold_dom?: number | null
  median_sold_price_per_sqft?: number | null
  active_count?: number
  new_last_30_days?: number
  price_bands?: { label: string; count: number }[]
  type_mix?: { label: string; count: number }[]
  window_start?: string
  window_end?: string
}

function monthRange(series: TrendMonth[]) {
  if (!series.length) return ''
  const fmt = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${fmt(series[0].month)} – ${fmt(series[series.length - 1].month)}`
}

// Neighborhood page "Market Trends": a year of closed sales from the MLS mirror, drawn as a
// median-price bar chart (bar height = median close price, label = sales that month), a
// year-over-year read, sale-to-list and days-on-market, then what's for sale right now by price
// band and home type. Server-rendered SVG - no chart library, nothing to hydrate.
export default function MarketTrendsSection({ trends, theme, areaName, bare = false }: { trends?: MarketTrends | null; theme: SiteTheme; areaName: string; /** Inside the town page's own Market section - no wrapper or heading of its own. */ bare?: boolean }) {
  if (!trends || !trends.series || !trends.series.length) return null
  if (!trends.closed_count && !trends.active_count) return null
  const series = trends.series
  const max = Math.max(...series.map(m => m.median_price || 0), 1)
  const chartW = 720, chartH = 220, pad = 8
  const barW = (chartW - pad * 2) / series.length
  const yoy = trends.yoy_median_change_pct
  const yoyUp = (yoy || 0) >= 0
  const tiles = [
    trends.median_sold_price ? { icon: Home, label: 'Median sold price', value: formatCompactPrice(trends.median_sold_price), sub: 'last 12 months' } : null,
    yoy != null ? { icon: yoyUp ? ArrowUpRight : ArrowDownRight, label: 'Year over year', value: `${yoyUp ? '+' : ''}${yoy}%`, sub: trends.prior_median_sold_price ? `was ${formatCompactPrice(trends.prior_median_sold_price)}` : 'median sold price', tone: yoyUp ? '#16a34a' : '#dc2626' } : null,
    trends.closed_count ? { icon: TrendingUp, label: 'Homes sold', value: String(trends.closed_count), sub: 'last 12 months' } : null,
    trends.median_sale_to_list_pct ? { icon: Percent, label: 'Sale to list', value: `${trends.median_sale_to_list_pct}%`, sub: trends.median_sale_to_list_pct >= 100 ? 'homes sell over asking' : 'of asking price' } : null,
    trends.median_sold_dom != null ? { icon: CalendarClock, label: 'Days to sell', value: String(trends.median_sold_dom), sub: 'median, sold homes' } : null,
    trends.median_sold_price_per_sqft ? { icon: Gauge, label: 'Sold $ / sq ft', value: `$${trends.median_sold_price_per_sqft.toLocaleString()}`, sub: 'median' } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string; sub: string; tone?: string }[]
  const bands = (trends.price_bands || []).filter(b => b.count > 0)
  const bandMax = Math.max(...bands.map(b => b.count), 1)
  const mix = trends.type_mix || []
  const mixTotal = mix.reduce((s, t) => s + t.count, 0)

  return (
    <section id={bare ? undefined : 'trends'} className={bare ? '' : 'mx-auto max-w-6xl px-6 py-14'}>
      {bare ? (
        <p className="text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>Closed sales from the MLS, {monthRange(series)} - updates on its own as homes sell.</p>
      ) : (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent)' }}>Market Trends</p>
          <h2 className={`ohp-site-heading mt-2 text-2xl font-black sm:text-3xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>What homes in {areaName} sell for</h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-gray-500">Closed sales from the MLS, {monthRange(series)}. Updated as new sales close - no republishing.</p>
      </div>
      )}

      {tiles.length > 0 && (
        <div className={`${bare ? 'mt-4' : 'mt-7'} grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6`}>
          {tiles.map(t => (
            <div key={t.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: t.tone || 'var(--site-accent)' }}><t.icon className="h-4 w-4" /></span>
              <p className="ohp-site-heading mt-3 text-xl font-black leading-none" style={{ color: t.tone || 'var(--site-heading)' }}>{t.value}</p>
              <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400">{t.label}</p>
              <p className="text-[10px] font-semibold text-gray-400">{t.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Median close price by month */}
        <div className="rounded-[1.25rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Median sold price by month</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">bars = median price · numbers = sales</p>
          </div>
          <svg viewBox={`0 0 ${chartW} ${chartH + 44}`} className="mt-4 w-full" role="img" aria-label={`Median sold price by month in ${areaName}`}>
            <defs>
              <linearGradient id="ohp-trend-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--site-accent-light)" />
                <stop offset="100%" stopColor="var(--site-accent)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map(f => (
              <line key={f} x1={pad} x2={chartW - pad} y1={chartH - chartH * f + 10} y2={chartH - chartH * f + 10} stroke="currentColor" strokeOpacity="0.08" />
            ))}
            {series.map((m, i) => {
              const h = m.median_price ? Math.max(6, (m.median_price / max) * (chartH - 20)) : 0
              const x = pad + i * barW + barW * 0.18
              const w = barW * 0.64
              const y = chartH + 10 - h
              return (
                <g key={m.month}>
                  {m.median_price ? (
                    <>
                      <rect x={x} y={y} width={w} height={h} rx={6} fill="url(#ohp-trend-bar)" />
                      <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor" opacity="0.75">{formatCompactPrice(m.median_price)}</text>
                    </>
                  ) : (
                    <rect x={x} y={chartH + 6} width={w} height={4} rx={2} fill="currentColor" opacity="0.08" />
                  )}
                  <text x={x + w / 2} y={chartH + 28} textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor" opacity="0.5">{m.label}</text>
                  <text x={x + w / 2} y={chartH + 42} textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" opacity="0.4">{m.closed ? `${m.closed} sold` : '—'}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* What's for sale now */}
        <div className="rounded-[1.25rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">For sale right now</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{trends.active_count || 0} homes{trends.new_last_30_days ? ` · ${trends.new_last_30_days} new this month` : ''}</p>
          </div>
          {bands.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {bands.map(b => (
                <li key={b.label}>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600"><span>{b.label}</span><span className="text-gray-400">{b.count}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${Math.max(6, (b.count / bandMax) * 100)}%`, background: 'linear-gradient(90deg, var(--site-accent), var(--site-accent-light))' }} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Nothing on the market right now - check the sold prices above for what to expect.</p>
          )}
          {mix.length > 0 && mixTotal > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400"><Layers className="h-3 w-3" /> Home types</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mix.map(t => <span key={t.label} className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600">{t.label} <span className="text-gray-400">{Math.round((t.count / mixTotal) * 100)}%</span></span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
