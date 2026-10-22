'use client'

// "Other Homes You Could Buy" (buyer) / "Your Competition" (seller) - similar homes for sale or under
// contract right now (grader, 10/21). Same data for both; titles, order and callouts differ (lib/cma
// cmaCompetitionView). List prices, not closed sales. `agentView` adds which pendings moved the value
// and any review flag - never shown on the client link.
import { AlertTriangle, Home, MapPin, TrendingDown } from 'lucide-react'
import { CmaReport } from '@/types'
import { cmaCompetitionView, formatMoney } from '@/lib/cma'
import { normalizeImageUrl } from '@/lib/utils'

export default function CurrentCompetition({ report, agentView = false }: { report: CmaReport, agentView?: boolean }) {
  const view = cmaCompetitionView(report)
  if (!view) return null
  const comp = (report.pricing?.ai_estimate as { current_competition?: { pendings_used?: { street_address?: string; list_price?: number; implied_value?: number }[]; nudge_pct?: number; nudged_from?: number | null; review?: string | null } } | null)?.current_competition
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">{view.title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-gray-400">{view.subtitle}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">{view.note}</span>
      </div>

      {view.cards.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm font-bold text-gray-400 dark:border-gray-800">{view.empty}</p>
      ) : (
        <>
          {view.callouts.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {view.callouts.map(c => (
                <li key={c} className="flex items-start gap-2 rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-bold text-[#8b7355] dark:text-[#d7b974]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" /> {c}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.cards.map(h => (
              <article key={h.listing_key} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0B0B0B]">
                <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-800">
                  {h.photo_url
                    ? <img src={normalizeImageUrl(h.photo_url)} alt="" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow ${h.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                    {h.statusLabel}
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{formatMoney(h.list_price)}</p>
                    {h.price_per_sqft ? <p className="text-[11px] font-bold text-gray-400">${h.price_per_sqft}/sq ft</p> : null}
                  </div>
                  <p className="truncate text-xs font-black text-[#111827] dark:text-white">{h.street_address}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {[h.beds != null ? `${h.beds} bd` : null, h.baths != null ? `${h.baths} ba` : null, h.sqft ? `${Math.round(h.sqft).toLocaleString()} sq ft` : null].filter(Boolean).join(' · ')}
                  </p>
                  {h.highlight && <p className="mt-1.5 text-[11px] font-black text-[#8b7355] dark:text-[#d7b974]">{h.highlight}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-bold text-gray-500 dark:text-gray-400">
                    {h.days_on_market != null && <span>{h.days_on_market} days on market</span>}
                    {h.cutText && <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><TrendingDown className="h-3 w-3" /> {h.cutText}</span>}
                    {h.distance_miles != null && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {h.distance_miles} mi</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {agentView && comp && ((comp.pendings_used?.length || 0) > 0 || comp.review) && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Agent only - how this section touched the value</p>
          {comp.nudged_from ? (
            <p className="mt-1 font-semibold text-gray-600 dark:text-gray-300">
              Pending homes moved the value {comp.nudge_pct && comp.nudge_pct > 0 ? 'up' : 'down'} {Math.abs(comp.nudge_pct || 0)}% (from {formatMoney(comp.nudged_from)}), using their list prices as a stand-in.
            </p>
          ) : (
            <p className="mt-1 font-semibold text-gray-600 dark:text-gray-300">No change to the value - it takes at least two closely matching pending homes that agree.</p>
          )}
          {(comp.pendings_used || []).map(p => (
            <p key={p.street_address} className="mt-0.5 font-semibold text-gray-500 dark:text-gray-400">
              {p.street_address}: list {formatMoney(p.list_price)} → about {formatMoney(p.implied_value)} adjusted to this home
            </p>
          ))}
          {comp.review && (
            <p className="mt-2 flex items-start gap-1.5 font-bold text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {comp.review}</p>
          )}
        </div>
      )}
    </section>
  )
}
