'use client'

// "Other Homes You Could Buy" (buyer) / "Your Competition" (seller) - similar homes for sale or under
// contract right now (grader, 10/21). Same data for both; titles, order and callouts differ (lib/cma
// cmaCompetitionView). List prices, not closed sales. `agentView` adds which pendings moved the value
// and any review flag - never shown on the client link. 10/23: the subject sits across the top for
// a side-by-side read, each card flips through its photos and opens the same details sheet as a comp.
import { useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Home, MapPin, TrendingDown } from 'lucide-react'
import { CmaReport, CmaSubjectProperty } from '@/types'
import { CmaCompetitionHome, cmaCompetitionView, formatMoney } from '@/lib/cma'
import { sameDistrict } from '@/lib/matchScore'
import { normalizeImageUrl } from '@/lib/utils'

function CardPhotos({ photos, onOpen }: { photos: string[], onOpen?: () => void }) {
  const [i, setI] = useState(0)
  if (!photos.length) return <div className="flex h-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>
  const shift = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); setI(x => (x + d + photos.length) % photos.length) }
  return (
    <>
      <img src={normalizeImageUrl(photos[i])} alt="" className="h-full w-full cursor-pointer object-cover" onClick={onOpen} />
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={shift(-1)} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/70 print:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Next photo" onClick={shift(1)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/70 print:hidden"><ChevronRight className="h-4 w-4" /></button>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black text-white print:hidden">{i + 1}/{photos.length}</span>
        </>
      )}
    </>
  )
}

function SubjectStrip({ subject }: { subject: CmaSubjectProperty }) {
  const photo = (subject.photos && subject.photos[0]) || subject.photo_url
  const ag = subject.above_grade_finished_area || subject.sqft
  const stats: [string, string][] = [
    ['List price', formatMoney(subject.list_price ?? null)],
    ['$/sq ft', subject.list_price && ag ? `$${Math.round(subject.list_price / ag)}` : '-'],
    ['Beds', subject.beds != null ? String(subject.beds) : '-'],
    ['Baths', subject.baths != null ? String(subject.baths) : '-'],
    ['Sq ft', ag ? Math.round(ag).toLocaleString() : '-'],
    ['Built', subject.year_built ? String(subject.year_built) : '-'],
  ]
  return (
    <div className="mt-4 flex flex-col overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 bg-[#fbfaf7] dark:bg-[#0B0B0B] sm:flex-row">
      <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-800 sm:aspect-auto sm:w-64 sm:shrink-0">
        {photo ? <img src={normalizeImageUrl(photo)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[120px] items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
        <span className="absolute left-2 top-2 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow">This home</span>
      </div>
      <div className="min-w-0 flex-1 p-3 sm:p-4">
        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address}</p>
        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">{k}</p>
              <p className="truncate font-serif text-base font-black text-[#111827] dark:text-white">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CurrentCompetition({ report, agentView = false, onOpenHome }: {
  report: CmaReport, agentView?: boolean
  /** Opens a card's details sheet (the page owns the sheet, as it does for comps). */
  onOpenHome?: (home: CmaCompetitionHome) => void
}) {
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
          {report.subject && <SubjectStrip subject={report.subject} />}
          {view.callouts.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {view.callouts.map(c => (
                <li key={c} className="flex items-start gap-2 rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-bold text-[#8b7355] dark:text-[#d7b974]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" /> {c}
                </li>
              ))}
            </ul>
          )}
          {view.groups.map(g => (
          <div key={g.key} className="mt-5">
            <div className="flex items-baseline gap-2">
              <h3 className={`text-[11px] font-black uppercase tracking-[0.18em] ${g.key === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{g.title} · {g.cards.length}</h3>
              <p className="truncate text-[11px] font-semibold text-gray-400">{g.subtitle}</p>
            </div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.cards.map(h => (
              <article key={h.listing_key} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0B0B0B]">
                <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-800">
                  <CardPhotos photos={h.photos && h.photos.length ? h.photos : (h.photo_url ? [h.photo_url] : [])} onOpen={onOpenHome ? () => onOpenHome(h) : undefined} />
                  {/* school pill, bottom centre - same pill as the comp picker (user, 10/23) */}
                  {h.school_district && (
                    <span title={h.school_district} className="pointer-events-none absolute bottom-2 left-1/2 flex max-w-[70%] -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-lg ring-1 ring-black/5">
                      <span className="min-w-0 truncate">{h.school_district}</span>
                      {sameDistrict(h.school_district, report.subject?.school_district) === true && (
                        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-emerald-600"><Check className="h-2 w-2 text-white" /></span>
                      )}
                    </span>
                  )}
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow ${h.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                    {h.statusLabel}
                  </span>
                  {h.match_score != null && (
                    <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow ${h.match_score >= 70 ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                      {h.match_score}% match
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{formatMoney(h.list_price)}</p>
                    {h.price_per_sqft ? <p className="text-[11px] font-bold text-gray-400">${h.price_per_sqft}/sq ft</p> : null}
                  </div>
                  <p className="truncate text-xs font-black text-[#111827] dark:text-white">{h.street_address}{h.city && <span className="font-bold text-gray-400">, {h.city}</span>}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {[h.beds != null ? `${h.beds} bd` : null, h.baths != null ? `${h.baths} ba` : null, h.sqft ? `${Math.round(h.sqft).toLocaleString()} sq ft` : null].filter(Boolean).join(' · ')}
                  </p>
                  {onOpenHome && (
                    <button type="button" onClick={() => onOpenHome(h)} className="mt-1.5 text-[11px] font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#d7b974] print:hidden">View property details</button>
                  )}
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
          </div>
          ))}
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
