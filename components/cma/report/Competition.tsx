'use client'

// "Similar Homes on the Market" (buyer) / "Your Competition" (seller): the homes like this one that are for sale
// or under contract right now. List prices, never mixed into the sold comps. Each group is a row the reader
// swipes (phone) or pages (computer) through; every card flips through its own photos and opens the same
// details window as a comp. The short AI paragraph about the competition sits under the homes.
// Each card carries its "% match" tag (owner, 11/16: the match tag is important and stays for clients).
import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, MapPin, TrendingDown, Check } from 'lucide-react'
import { CmaReport } from '@/types'
import { CmaCompetitionCard, CmaCompetitionGroup, CmaGuidanceSection, cmaCompetitionView, formatMoney, totalFinishedSqft, formatAcresFromSqft, bathsText } from '@/lib/cma'
import { sameDistrict } from '@/lib/matchScore'
import PhotoFlip, { usePhotoList } from './PhotoFlip'
import { EditableSections, GuidanceSections } from './ReportParts'

function HomeCard({ home, subjectDistrict, onOpen }: { home: CmaCompetitionCard, subjectDistrict?: string | null, onOpen?: () => void }) {
  const photos = usePhotoList(home.photos, home.photo_url)
  const pending = home.status === 'pending'
  return (
    <article className="flex w-[84%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_10px_30px_-18px_rgba(17,24,39,0.45)] transition-shadow duration-300 dark:border-gray-800 dark:bg-[#151517] sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] print:w-[31%] print:shadow-none [@media(hover:hover)]:hover:shadow-[0_18px_40px_-18px_rgba(201,162,77,0.55)]">
      <PhotoFlip photos={photos} onOpen={onOpen} compact dots quietArrows className="aspect-[4/3] w-full">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-black/75 to-transparent" />
        <span className={`pointer-events-none absolute left-3 top-3 z-[2] rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow ${pending ? 'bg-amber-500' : 'bg-emerald-600'}`}>{home.statusLabel}</span>
        {home.match_score != null && (
          <span className={`pointer-events-none absolute right-3 top-3 z-[2] rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow ${home.match_score >= 70 ? 'bg-emerald-600' : 'bg-gray-700'}`}>{home.match_score}% match</span>
        )}
        <div className="pointer-events-none absolute inset-x-3 bottom-5 z-[2] flex items-end justify-between gap-2">
          <p className="font-serif text-2xl font-black leading-none text-white drop-shadow">{formatMoney(home.list_price)}</p>
          {home.price_per_sqft ? <p className="pb-0.5 text-[11px] font-black text-white/85 drop-shadow">${home.price_per_sqft}/sq ft</p> : null}
        </div>
      </PhotoFlip>
      <button type="button" onClick={onOpen} disabled={!onOpen} className="flex flex-1 flex-col p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A24D]">
        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{home.street_address}</p>
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{home.city}</p>
        <p className="mt-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          {[home.beds != null ? `${home.beds} bd` : null, home.baths != null ? `${home.baths} ba` : null, home.sqft ? `${Math.round(home.sqft).toLocaleString()} sq ft` : null, home.year_built ? `built ${home.year_built}` : null].filter(Boolean).join('  ·  ')}
        </p>
        {home.highlight && <p className="mt-2 rounded-lg bg-[#C9A24D]/10 px-2.5 py-1.5 text-[11px] font-black leading-snug text-[#8b7355] dark:text-[#d7b974]">{home.highlight}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 text-[10.5px] font-bold text-gray-500 dark:text-gray-400">
          {home.days_on_market != null && <span>{home.days_on_market} days on market</span>}
          {home.cutText && <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><TrendingDown className="h-3 w-3" /> {home.cutText}</span>}
          {home.distance_miles != null && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {home.distance_miles} mi away</span>}
          {home.school_district && (
            <span className="inline-flex min-w-0 items-center gap-1" title={home.school_district}>
              <span className="truncate">{home.school_district}</span>
              {sameDistrict(home.school_district, subjectDistrict) === true && <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-emerald-600"><Check className="h-2 w-2 text-white" /></span>}
            </span>
          )}
        </div>
      </button>
    </article>
  )
}

function HomeRow({ group, subjectDistrict, onOpen }: { group: CmaCompetitionGroup, subjectDistrict?: string | null, onOpen?: (h: CmaCompetitionCard) => void }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: true })
  const measure = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }, [])
  useEffect(() => {
    measure()
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, group.cards.length])
  const page = (d: number) => { const el = rowRef.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.9, behavior: 'smooth' }) }
  const pending = group.key === 'pending'
  const title = pending ? 'Under contract now' : 'For sale now'
  const arrow = 'hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-[#111827] shadow-sm transition hover:border-[#C9A24D] hover:text-[#8b7355] active:scale-90 disabled:opacity-30 dark:border-gray-700 dark:bg-[#151517] dark:text-white sm:flex print:hidden'
  return (
    <div className="mt-7">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-serif text-xl font-black text-[#111827] dark:text-white">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {title}
            <span className={`rounded-full px-2 py-0.5 font-sans text-[11px] font-black ${pending ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}`}>{group.cards.length}</span>
          </h3>
          <p className="mt-1 text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">{group.subtitle}</p>
        </div>
        {!(edge.start && edge.end) && (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" aria-label="Earlier homes" disabled={edge.start} onClick={() => page(-1)} className={arrow}><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="More homes" disabled={edge.end} onClick={() => page(1)} className={arrow}><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div ref={rowRef} onScroll={measure} className="scrollbar-hide -mx-6 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-6 px-6 pb-4 pt-1 sm:mx-0 sm:scroll-px-0 sm:px-0 print:flex-wrap print:overflow-visible">
        {group.cards.map(h => <HomeCard key={h.listing_key} home={h} subjectDistrict={subjectDistrict} onOpen={onOpen ? () => onOpen(h) : undefined} />)}
      </div>
      {group.cards.length > 1 && !(edge.start && edge.end) && <p className="-mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:hidden print:hidden">Swipe to see all {group.cards.length} →</p>}
    </div>
  )
}

function ThisHome({ report, priceLabel }: { report: CmaReport, priceLabel: string }) {
  const s = report.subject
  const photos = usePhotoList(s.photos, s.photo_url)
  const size = totalFinishedSqft(s)
  const facts: [string, string][] = ([
    ['$/sq ft', s.list_price && size ? `$${Math.round(s.list_price / size)}` : ''],
    ['Beds', s.beds != null ? String(s.beds) : ''],
    ['Baths', s.baths != null ? bathsText(s) : ''],
    ['Sq ft', size ? Math.round(size).toLocaleString() : ''],
    ['Built', s.year_built ? String(s.year_built) : ''],
    ['Lot', s.lot_size ? formatAcresFromSqft(s.lot_size) : ''],
    ['Days on market', s.days_on_market != null ? String(s.days_on_market) : ''],
    ['Taxes', s.annual_taxes ? formatMoney(s.annual_taxes) : ''],
  ] as [string, string][]).filter(f => f[1])
  return (
    <div className="mt-5 grid overflow-hidden rounded-3xl bg-[#111827] text-white shadow-[0_14px_36px_-20px_rgba(17,24,39,0.7)] ring-1 ring-[#C9A24D]/50 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] print:shadow-none">
      <PhotoFlip photos={photos} hideBadge compact dots className="aspect-[16/10] w-full sm:aspect-auto sm:min-h-[210px]">
        <span className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full bg-[#C9A24D] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow">This home</span>
      </PhotoFlip>
      <div className="min-w-0 p-4 sm:p-5">
        <p className="truncate font-serif text-xl font-black">{s.street_address}</p>
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{[s.city, s.state].filter(Boolean).join(', ')}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-serif text-3xl font-black leading-none text-[#e4c876]">{s.list_price ? formatMoney(s.list_price) : 'Not listed'}</p>
          {s.list_price ? <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{priceLabel}</p> : null}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-3">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="truncate text-sm font-black">{v}</p>
              <p className="truncate text-[8px] font-black uppercase tracking-wide text-white/50">{k}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function hasCompetition(report: CmaReport): boolean {
  return !!cmaCompetitionView(report)
}

export default function CompetitionSection({ report, heading, commentary, onOpenHome, edit }: {
  report: CmaReport
  /** The section's heading (eyebrow + title), drawn by the report so every section's heading matches. */
  heading: (title: string) => React.ReactNode
  /** The paragraph about the competition, as shown. */
  commentary: CmaGuidanceSection[]
  onOpenHome?: (home: CmaCompetitionCard, list: CmaCompetitionCard[]) => void
  edit?: { version: number, onChange: (next: CmaGuidanceSection[]) => void, reset: React.ReactNode }
}) {
  const view = cmaCompetitionView(report)
  if (!view) return null
  const all = view.groups.flatMap(g => g.cards)
  return (
    <section className="print:break-inside-avoid">
      {heading(view.title)}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{view.subtitle}</p>
        <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">{view.note}</span>
      </div>
      {view.cards.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm font-bold text-gray-400 dark:border-gray-700">{view.empty}</p>
      ) : (
        <>
          <ThisHome report={report} priceLabel={view.subject.priceLabel} />
          {view.callouts.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {view.callouts.map(c => (
                <li key={c} className="flex items-start gap-2 rounded-xl bg-[#C9A24D]/10 px-3.5 py-2.5 text-xs font-bold leading-snug text-[#8b7355] dark:text-[#d7b974]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" /> {c}
                </li>
              ))}
            </ul>
          )}
          {view.groups.map(g => <HomeRow key={g.key} group={g} subjectDistrict={report.subject?.school_district} onOpen={onOpenHome ? h => onOpenHome(h, all) : undefined} />)}
        </>
      )}
      {(commentary.length > 0 || edit) && (
        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6 print:shadow-none">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">What the competition tells us</p>
          {edit
            ? <EditableSections sections={commentary} version={edit.version} onChange={edit.onChange} tone="light" label="About the competition" placeholder="A few sentences on the homes for sale and under contract right now, and what they mean for this one." />
            : <GuidanceSections sections={commentary} tone="light" />}
          {edit?.reset}
        </div>
      )}
      {view.cards.length > 0 && <p className="mt-3 text-[10px] leading-snug text-gray-400">{view.sizeNote}</p>}
    </section>
  )
}
