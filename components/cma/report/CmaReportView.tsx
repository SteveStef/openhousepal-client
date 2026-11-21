'use client'

// THE CMA report: what a client reads at /cma/<link>, and - with the Review editor's hooks - the very same
// elements made editable for the agent. There is no second "preview" markup: a change to this file changes
// both, and what is shown (sections, order, comps, wording, numbers, lead photos) always comes from
// lib/cmaReport, which the PDF reads too.
import { useMemo, useState } from 'react'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import SignatureSiteCard from '@/components/studio/blogs/SignatureSiteCard'
import { CmaComparable, CmaPublicResponse, CmaReport } from '@/types'
import {
  CmaCompetitionCard, belowGradeDisplay, bathsText, buildCmaStaticMapUrl, buyerOfferLabels, compDisplayPrice, compPricePerSqft,
  compSoldDate, compSoldToAsking, competitionHomeAsComparable, effectiveCompPrice, formatAcresFromSqft, formatMoney, formatNumber,
  formatSoldToAsking, realTaxes, subjectPricePerSqft, subjectTaxesText,
} from '@/lib/cma'
import {
  CMA_FEE_LABEL, CMA_SECTIONS, CmaFigureKey, CmaPricingPart, CmaTextKey, cmaCompNote, cmaEditorComparables, cmaFeeRow, cmaFigure, cmaHeadline, cmaIsHidden, cmaLabel,
  cmaNoteHasContent, cmaNotes, cmaSectionOrder, cmaShownComparables, cmaShownMetrics, cmaShownSubject, cmaSubjectFeeText, cmaTextSections, isNoteKey,
} from '@/lib/cmaReport'
import { normalizeImageUrl } from '@/lib/utils'
import { cmaStateDisclosure } from '@/lib/cmaDisclosure'
import { EditableMoney, EditableText } from './Editable'
import CompetitionSection, { hasCompetition } from './Competition'
import {
  BarChart, CmaInteractiveMap, ComparableSection, EditableSections, Fact, GuidanceSections, HomeDetailsPopup, OverviewRow, SectionHeading,
  SubjectShowcaseCard, formatUtilityValue,
} from './ReportParts'
import type { CmaEditHooks, CmaSectionState } from './editTypes'

const SECTION_HEAD: Record<string, { eyebrow: string, title: string }> = {
  subject: { eyebrow: 'The Property', title: 'Subject Property' },
  location: { eyebrow: 'Geography', title: 'Location Context' },
  comparables: { eyebrow: 'The Evidence', title: 'Individual Comparable Analysis' },
  comparison_table: { eyebrow: 'Comparable Sales', title: 'Comparable Overview' },
  charts: { eyebrow: 'Bringing It Together', title: 'Market Analysis' },
  competition: { eyebrow: 'The Market Right Now', title: 'Similar Homes on the Market' },
  pricing: { eyebrow: 'Agent Final Analysis', title: 'Agent Final Analysis' },
}
const SECTION_LABEL: Record<string, string> = Object.fromEntries(CMA_SECTIONS.map(s => [s.key, s.label]))
const PDF_TITLED = new Set(['location', 'comparison_table', 'charts', 'competition'])

type Popup = { kind: 'comp', id: string } | { kind: 'market', key: string, list: CmaCompetitionCard[] } | null

export default function CmaReportView({ data, edit }: {
  data: CmaPublicResponse
  /** The Review editor's hooks. Leave out for the client page. */
  edit?: CmaEditHooks
}) {
  const { pricing, market_context: marketContext, agent } = data
  const [popup, setPopup] = useState<Popup>(null)
  const [activeMapCompId, setActiveMapCompId] = useState<string | null>(null)

  const subject = useMemo(() => cmaShownSubject(data), [data])
  const comparables = useMemo(() => cmaShownComparables(data), [data])
  const compsLocked = !!edit?.compsLocked
  const editorComps = useMemo(() => (edit ? cmaEditorComparables(data).filter(c => !(compsLocked && c._removed)) : null), [data, edit, compsLocked])
  const order = cmaSectionOrder(data)
  const isBuyer = data.mode === 'buyer'
  // The home's state may require its own CMA statement (lib/cmaDisclosure): on the first screen, or right after the value.
  const stateNote = cmaStateDisclosure(subject.state)
  const authoritativeDom = pricing.ai_estimate?.status?.active_market_days ?? subject.days_on_market
  const metrics = cmaShownMetrics(data, comparables)
  const mapUrl = buildCmaStaticMapUrl(subject, comparables, '1200x420', data.map_ref)
  const offerLabels = buyerOfferLabels(pricing)
  const seeMoreUrl = agent.idx_site_url || (agent.agent_hub_slug ? `/${agent.agent_hub_slug}` : null)
  const asReport = data as unknown as CmaReport

  const heading = (key: string, opts: { eyebrow?: string, title?: string } = {}) => {
    const base = SECTION_HEAD[key] || { eyebrow: '', title: '' }
    const fallback = opts.title ?? base.title
    // A title can be re-worded only where the PDF prints that title too (the subject is the PDF's cover and each
    // comp is its own page there) - an edit must never be on the page and missing from the PDF.
    const canRename = PDF_TITLED.has(key)
    return (
      <SectionHeading eyebrow={opts.eyebrow ?? base.eyebrow} title={canRename ? cmaLabel(data, `title:${key}`, fallback) : fallback}
        onTitle={edit && canRename ? v => edit.setLabel(`title:${key}`, v) : undefined} />
    )
  }
  const figure = (key: CmaFigureKey, label: string, cls: string) => {
    const v = cmaFigure(data, key)
    if (edit) return <EditableMoney value={v} onChange={n => edit.setFigure(key, n)} label={label} className={cls} />
    return v != null ? <span className={cls}>{formatMoney(v)}</span> : null
  }
  const text = (key: CmaTextKey, tone: 'dark' | 'light', label: string, placeholder: string) => {
    const sections = cmaTextSections(data, key)
    if (edit) {
      return (
        <>
          <EditableSections sections={sections} version={edit.textVersion(key)} onChange={next => edit.setText(key, next)} tone={tone} label={label} placeholder={placeholder} />
          {edit.textReset(key)}
        </>
      )
    }
    return sections.length ? <GuidanceSections sections={sections} tone={tone} /> : null
  }

  // ---- Each section's content (null = nothing to show) ----------------------------------------------------------

  const subjectNode = () => (
    <section className="print:break-inside-avoid">
      {heading('subject')}
      <div className="mt-6"><SubjectShowcaseCard subject={subject} days={authoritativeDom} fee={cmaSubjectFeeText(data)} onPickPhoto={edit ? url => edit.pickPhoto('subject', url) : undefined} /></div>
    </section>
  )

  const locationNode = () => {
    if (comparables.length === 0 || !(mapUrl || comparables.some(c => c.distance_miles != null))) return null
    const withDistance = comparables.filter(c => c.distance_miles != null)
    return (
      <section className="print:break-inside-avoid">
        {heading('location')}
        <div className="mt-6">
          {mapUrl && (
            <div className="relative mb-6 h-80 overflow-hidden rounded-3xl shadow-lg print:h-64 print:shadow-none">
              <div className="absolute inset-0 print:hidden">
                <CmaInteractiveMap subject={subject} comparables={comparables} fallbackUrl={mapUrl} activeComparableId={activeMapCompId}
                  onSelectComparable={setActiveMapCompId} onOpenComparable={c => setPopup({ kind: 'comp', id: c.id })} />
              </div>
              <img src={normalizeImageUrl(mapUrl)} alt="Map of subject and comparable locations" className="hidden h-full w-full object-cover print:block" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-5 py-3 print:hidden">
                <span className="text-xs font-black uppercase tracking-wide text-white">{comparables.length} comparable{comparables.length === 1 ? '' : 's'} mapped</span>
                {withDistance.length > 0 && (
                  <span className="text-xs font-bold text-white/80">Avg {(withDistance.reduce((sum, c) => sum + (c.distance_miles ?? 0), 0) / withDistance.length).toFixed(1)} mi away</span>
                )}
              </div>
            </div>
          )}
          <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            <div className="flex items-center gap-3 bg-[#C9A24D]/10 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">S</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{subject.street_address} <span className="font-semibold text-gray-400">(Subject)</span></span>
                <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ')}</span>
              </span>
            </div>
            {comparables.map((c, i) => (
              <button key={c.id} type="button" onClick={() => setActiveMapCompId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#C9A24D]/10 ${activeMapCompId === c.id ? 'bg-[#C9A24D]/15' : i % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[11px] font-black text-white">#{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-600 dark:text-gray-300">{c.street_address}</span>
                  <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{[c.city, c.state].filter(Boolean).join(', ')}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-gray-400">{c.distance_miles != null ? `${c.distance_miles} mi` : '—'}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const comparablesNode = () => {
    // The client gets the comps on the report; the editor also keeps the ones the agent hid or took out
    // (greyed, with a way back), so nothing is ever lost by a tap.
    const list = editorComps || comparables
    if (list.length === 0 && !edit) return null
    const shownIds = comparables.map(c => c.id)
    return (
      <div>
        {heading('comparables')}
        <div className="mt-6 space-y-10">
          {list.map(c => {
            const shownIndex = shownIds.indexOf(c.id)
            const ec = c as (typeof list)[number] & { _hidden?: boolean, _removed?: boolean }
            const off = shownIndex < 0
            const node = (
              <ComparableSection key={c.id} comp={c} index={off ? null : shownIndex} note={cmaCompNote(data, c)} mapRef={data.map_ref} muted={off}
                onOpen={() => setPopup({ kind: 'comp', id: c.id })} edit={off ? undefined : edit}
                bar={edit && editorComps ? edit.compBar(ec as never, off ? null : shownIndex, { first: shownIndex === 0, last: shownIndex === shownIds.length - 1 }) : undefined} />
            )
            return edit && editorComps ? <div key={c.id}>{edit.wrapComp(ec as never, node)}</div> : node
          })}
          {edit?.addCompTile()}
        </div>
      </div>
    )
  }

  const tableNode = () => {
    if (comparables.length === 0) return null
    const all = [subject, ...comparables]
    // Association fees: one more fact about each home (lib/cmaReport cmaFeeRow decides when there is a row to show).
    const feeRow = cmaFeeRow(data, comparables)
    return (
      <section className="print:break-inside-avoid">
        {heading('comparison_table', { eyebrow: `${comparables.length} Comparable Sale${comparables.length === 1 ? '' : 's'}` })}
        <div className="mt-6">
          {/* Phones: the table keeps readable columns and slides sideways (the row names stay pinned on the left). */}
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:hidden">Swipe to see every comparable →</p>
          <div tabIndex={0} role="region" aria-label="Comparable sales table - use the arrow keys to slide sideways" className="focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#C9A24D] -mx-6 w-auto overflow-x-auto px-6 pb-1 [scrollbar-width:thin] sm:mx-0 sm:w-full sm:overflow-hidden sm:px-0">
            <table className="w-full min-w-[620px] border-collapse text-[13px] sm:min-w-0 sm:table-fixed sm:text-sm">
              <thead>
                <tr className="border-b-2 border-[#111827] dark:border-white print:border-black">
                  <th className="sticky left-0 z-[1] w-[110px] bg-[#faf9f7] py-2 text-left text-[10px] font-black uppercase tracking-wide text-gray-400 dark:bg-[#0B0B0B] sm:static sm:w-[15%] sm:bg-transparent sm:dark:bg-transparent"></th>
                  <th className="py-2 pr-2 text-left align-bottom text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                    <span className="block truncate">Subject</span>
                    <span className="mt-0.5 block truncate text-[9px] normal-case tracking-normal text-gray-400" title={subject.street_address || undefined}>({subject.street_address || 'Address unavailable'})</span>
                  </th>
                  {comparables.map((c, i) => (
                    <th key={c.id} className="py-2 pr-2 text-left align-bottom text-[11px] font-black uppercase tracking-wide text-gray-500">
                      <span className="block truncate">#{i + 1}</span>
                      <span className="mt-0.5 block truncate text-[9px] normal-case tracking-normal text-gray-400" title={c.street_address || undefined}>({c.street_address || 'Address unavailable'})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <OverviewRow index={0} label="Sold / List Price" subjectValue={formatMoney(subject.list_price)} comparables={comparables} get={c => compDisplayPrice(c).unverified ? `${formatMoney(compDisplayPrice(c).value)} asking (sold price n/a)` : formatMoney(compDisplayPrice(c).value)} />
                {comparables.some(c => compSoldDate(c)) && <OverviewRow index={1} label="Sold Date" subjectValue="—" comparables={comparables} get={c => compSoldDate(c) || '—'} />}
                {comparables.some(c => compSoldToAsking(c) != null) && <OverviewRow index={0} label="Sold vs. Final List" subjectValue="—" comparables={comparables} get={c => formatSoldToAsking(c) || '—'} />}
                <OverviewRow index={1} label="$/Sqft (Above Grade)" subjectValue={subjectPricePerSqft(subject) ? `$${subjectPricePerSqft(subject)}` : '—'} comparables={comparables} get={c => { const p = compPricePerSqft(c); return p ? `$${p}` : '—' }} />
                <OverviewRow index={2} label="Reported Finished Area" subjectValue={formatNumber(subject.sqft)} comparables={comparables} get={c => formatNumber(c.sqft)} />
                {all.some(p => p.above_grade_finished_area != null) && <OverviewRow index={2} label="Above-Grade Finished Area" subjectValue={formatNumber(subject.above_grade_finished_area)} comparables={comparables} get={c => formatNumber(c.above_grade_finished_area)} />}
                {all.some(p => p.below_grade_finished_area != null) && <OverviewRow index={2} label="Below-Grade Finished Area" subjectValue={belowGradeDisplay(subject)} comparables={comparables} get={c => belowGradeDisplay(c)} />}
                <OverviewRow index={3} label="Lot Size" subjectValue={formatAcresFromSqft(subject.lot_size)} comparables={comparables} get={c => formatAcresFromSqft(c.lot_size)} />
                <OverviewRow index={4} label="Beds" subjectValue={String(subject.beds ?? '—')} comparables={comparables} get={c => String(c.beds ?? '—')} />
                <OverviewRow index={5} label="Baths" subjectValue={bathsText(subject)} comparables={comparables} get={c => bathsText(c)} />
                <OverviewRow index={6} label="Year Built" subjectValue={String(subject.year_built ?? '—')} comparables={comparables} get={c => String(c.year_built ?? '—')} />
                <OverviewRow index={7} label="Annual Taxes" subjectValue={subjectTaxesText(subject.annual_taxes, subject.tax_year) || '—'} comparables={comparables} get={c => realTaxes(c.annual_taxes) ? formatMoney(c.annual_taxes) : '—'} />
                {feeRow && <OverviewRow index={8} label={CMA_FEE_LABEL} subjectValue={feeRow.subject} comparables={comparables} get={feeRow.comp} />}
                <OverviewRow index={feeRow ? 9 : 8} label="Distance" subjectValue="—" comparables={comparables} get={c => c.distance_miles != null ? `${c.distance_miles} miles` : '—'} />
                <OverviewRow index={10} label="Days on Market" subjectValue={String(authoritativeDom ?? '—')} comparables={comparables} get={c => String(c.days_on_market ?? '—')} />
                <OverviewRow index={11} label="School District" subjectValue={subject.school_district || '—'} comparables={comparables} get={c => c.school_district || '—'} />
                <OverviewRow index={12} label="Water Source" subjectValue={formatUtilityValue(subject.water_source)} comparables={comparables} get={c => formatUtilityValue(c.water_source)} />
                <OverviewRow index={13} label="Sewer / Septic" subjectValue={formatUtilityValue(subject.sewer)} comparables={comparables} get={c => formatUtilityValue(c.sewer)} />
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  // Aggregate stats + charts: only when there are enough verified sales for real numbers - otherwise the whole
  // section is left out rather than shown as a grid of dashes. The gold market-signal lines can carry it alone.
  const chartsNode = () => {
    const highlightsOff = marketContext.hidden || cmaIsHidden(data, 'market_context')
    const highlights = (marketContext.highlight_statements || []).filter(Boolean)
    if (comparables.length === 0) return null
    if (!metrics.enoughForStats && (highlights.length === 0 || (highlightsOff && !edit))) return null
    return (
      <section className="print:break-inside-avoid">
        {heading('charts')}
        <div className="mt-6">
          {highlights.length > 0 && (!highlightsOff || edit) && (
            <div className={`mb-6 space-y-2 ${highlightsOff ? 'opacity-50' : ''}`}>
              {edit?.partBar('market_context', 'Market highlights', highlightsOff)}
              {highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-[#C9A24D]/10 px-4 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{h}</p>
                </div>
              ))}
            </div>
          )}
          {metrics.enoughForStats && (
            <>
              {/* One plain sentence and ONE price number (+ the matching $/sq ft): the median of the sales the value is built on. */}
              <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Based on the {metrics.count} most comparable {metrics.count === 1 ? 'sale' : 'sales'} near {subject.street_address || 'this home'}.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fact label="Typical comparable sale" value={formatMoney(metrics.saleMedian ?? metrics.saleAvg, { compact: true })} />
                <Fact label="Typical price per sq ft" value={(metrics.psfMedian ?? metrics.psfAvg) != null ? `$${Math.round((metrics.psfMedian ?? metrics.psfAvg) as number)}` : '—'} />
              </div>
              <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                {/* Only real prices: a sale whose closing price isn't on record is left off rather than charted at its asking price. */}
                <BarChart title="Price Per Square Foot" subjectValue={subjectPricePerSqft(subject)} bars={comparables.map((c, i) => ({ label: `#${i + 1}`, value: compPricePerSqft(c) })).filter((b): b is { label: string; value: number } => b.value != null)} formatValue={v => `$${v}`} />
                <BarChart title="Comparable Sale Prices" subjectValue={subject.list_price} bars={comparables.map((c, i) => ({ label: `#${i + 1}`, value: effectiveCompPrice(c) })).filter((b): b is { label: string; value: number } => b.value != null)} formatValue={v => formatMoney(v, { compact: true })} />
              </div>
            </>
          )}
        </div>
      </section>
    )
  }

  const competitionNode = () => {
    if (!hasCompetition(asReport)) return null
    return (
      <CompetitionSection
        report={{ ...asReport, subject } as CmaReport}
        heading={title => heading('competition', { title })}
        commentary={cmaTextSections(data, 'competition_commentary')}
        onOpenHome={(h, list) => setPopup({ kind: 'market', key: h.listing_key, list })}
        edit={edit ? { version: edit.textVersion('competition_commentary'), onChange: next => edit.setText('competition_commentary', next), reset: edit.textReset('competition_commentary') } : undefined}
      />
    )
  }

  const pricingNode = () => {
    const parts: { key: CmaPricingPart, label: string, placeholder: string }[] = isBuyer
      ? [
          { key: 'valuation_notes', label: 'Buyer Valuation Notes', placeholder: 'Why this is a fair value for the home: the sales it rests on, its condition, the market.' },
          { key: 'inspection', label: 'Inspection Concerns', placeholder: 'What to look at before committing: roof, systems, utilities, water, anything the listing leaves open.' },
          { key: 'offer', label: 'Offer Suggestion', placeholder: 'How to structure the offer: opening price, ceiling, contingencies, timing.' },
        ]
      : [
          { key: 'valuation_notes', label: 'Agent Pricing Analysis', placeholder: 'Where the home sits among the sales, which ones carry the most weight and why.' },
          { key: 'pricing_strategy', label: 'Pricing Strategy', placeholder: 'Where the list price should sit and why, the competition, the risk of overpricing.' },
          { key: 'listing_prep', label: 'Listing Prep', placeholder: 'What to fix, document or be ready to disclose before listing.' },
        ]
    const figureTile = (key: CmaFigureKey, label: string) => {
      const node = figure(key, label, 'text-lg font-black')
      if (!node) return null
      return (
        <div key={key}>
          <p>{node}</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
          {edit?.figureReset(key)}
        </div>
      )
    }
    const bigCls = 'font-serif text-4xl font-black sm:text-5xl'
    return (
      <section className="rounded-3xl bg-[#111827] p-8 text-white print:break-inside-avoid print:border print:border-gray-300 print:bg-white print:text-black sm:p-12">
        {edit
          ? <EditableText multiline={false} value={cmaLabel(data, 'title:pricing', 'Agent Final Analysis')} onChange={v => edit.setLabel('title:pricing', v)} label="Section title" placeholder="Agent Final Analysis" className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C9A24D]" />
          : <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C9A24D]">{cmaLabel(data, 'title:pricing', 'Agent Final Analysis')}</p>}
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-400 print:text-gray-500">{isBuyer ? 'Estimated Fair Market Value' : 'Recommended Value'}</p>
        {/* qa_flags, the confidence level and the comp-by-comp working are the agent's (Pricing step) - never here. */}
        <div className={`mt-1 ${bigCls}`}>
          {isBuyer
            ? (edit ? figure('value', 'Estimated fair market value', '') : <p>{cmaHeadline(data)}</p>)
            : (edit
                ? <p className="flex flex-wrap items-baseline gap-x-3">{figure('range_min', 'Recommended value, low end', '')}<span className="text-gray-500">–</span>{figure('range_max', 'Recommended value, high end', '')}</p>
                : <p>{cmaHeadline(data)}</p>)}
        </div>
        {edit && (isBuyer ? edit.figureReset('value') : <>{edit.figureReset('range_min')}{edit.figureReset('range_max')}</>)}

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 print:border-gray-200 sm:grid-cols-4">
          {isBuyer
            ? <>{figureTile('offer_min', offerLabels.min)}{figureTile('offer_max', offerLabels.max)}{figureTile('strong_offer', offerLabels.strong)}</>
            : <>{figureTile('most_likely_value', 'Most Likely Value')}{figureTile('recommended_list_price', 'Recommended List Price')}</>}
        </div>
        {stateNote?.where === 'after_value' && (
          // 24 Del. C. § 2931: at least 12-point bold, immediately following the estimated market price
          <p className="mt-6 text-base font-bold leading-relaxed text-white print:text-black">{stateNote.text}</p>
        )}

        {parts.map(part => {
          const off = cmaIsHidden(data, part.key)
          if (off && !edit) return null
          const body = text(part.key, 'dark', part.label, part.placeholder)
          if (!body) return null
          return (
            <div key={part.key} className={`mt-8 border-t border-white/10 pt-6 print:border-gray-200 ${off ? 'opacity-45' : ''}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black uppercase tracking-wide text-[#C9A24D]">{part.label}</p>
                {edit?.partBar(part.key, part.label, off)}
              </div>
              <div className={off ? 'pointer-events-none' : ''}>{body}</div>
            </div>
          )
        })}
      </section>
    )
  }

  const noteNode = (key: string) => {
    const note = cmaNotes(data).find(n => `note:${n.id}` === key)
    if (!note) return null
    if (!edit && !cmaNoteHasContent(note)) return null
    const titleCls = 'mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white print:text-black sm:text-3xl'
    const bodyCls = 'text-[15px] font-medium leading-relaxed text-gray-700 dark:text-gray-300 print:text-gray-800'
    return (
      <section className="print:break-inside-avoid">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">From {agent.name || 'your agent'}</p>
        {edit
          ? <EditableText as="h2" multiline={false} value={note.title || ''} onChange={v => edit.setNote(note.id, { title: v })} placeholder="Give this section a title" label="Section title" className={titleCls} />
          : (note.title ? <h2 className={titleCls}>{note.title}</h2> : null)}
        <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-7 print:shadow-none">
          {edit
            ? <EditableText value={note.body || ''} onChange={v => edit.setNote(note.id, { body: v })} placeholder="Write anything you want your client to read here: the neighborhood, your plan, next steps." label="Your note" className={bodyCls} />
            : <p className={`whitespace-pre-line ${bodyCls}`}>{note.body}</p>}
        </div>
      </section>
    )
  }

  const build = (key: string): React.ReactNode => {
    switch (key) {
      case 'subject': return subjectNode()
      case 'location': return locationNode()
      case 'comparables': return comparablesNode()
      case 'comparison_table': return tableNode()
      case 'charts': return chartsNode()
      case 'competition': return competitionNode()
      case 'pricing': return pricingNode()
      default: return isNoteKey(key) ? noteNode(key) : null
    }
  }

  const movable = order.filter(k => k !== 'subject')
  const sections = order.map(key => {
    const hidden = cmaIsHidden(data, key)
    if (hidden && !edit) return null
    const content = build(key)
    if (!edit) return content ? <div key={key}>{content}</div> : null
    const state: CmaSectionState = { hidden, empty: !content, first: movable[0] === key, last: movable[movable.length - 1] === key, fixed: key === 'subject' }
    const label = isNoteKey(key) ? (cmaNotes(data).find(n => `note:${n.id}` === key)?.title || 'Your note') : (SECTION_LABEL[key] || key)
    return <div key={key}>{edit.section(key, label, state, content)}</div>
  })

  const plainAgent = (
    <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
      {agent.headshot_url && <img src={normalizeImageUrl(agent.headshot_url)} alt="" className="mb-4 h-20 w-20 rounded-full border-2 border-white/20 object-cover shadow-xl print:border-gray-200 print:shadow-none sm:mb-0 sm:mr-5" />}
      <div>
        <p className="font-serif text-2xl font-black sm:text-3xl">{agent.name}</p>
        {agent.brokerage && <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-[#C9A24D]">{agent.brokerage}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-gray-300 print:text-gray-700 sm:justify-start">
          {agent.phone && <span>{agent.phone}</span>}
          {agent.email && <span>{agent.email}</span>}
        </div>
      </div>
    </div>
  )

  const openComp = popup?.kind === 'comp' ? comparables.findIndex(c => c.id === popup.id) : -1
  const popupComp: CmaComparable | null = popup?.kind === 'comp' ? (comparables[openComp] || (editorComps || []).find(c => c.id === popup.id) || null) : null
  const marketIndex = popup?.kind === 'market' ? popup.list.findIndex(h => h.listing_key === popup.key) : -1
  const marketHome = popup?.kind === 'market' && marketIndex >= 0 ? popup.list[marketIndex] : null

  return (
    <div className="bg-[#faf9f7] font-sans text-[#111827] dark:bg-[#0B0B0B] dark:text-white print:bg-white print:text-black">
      <header className="relative overflow-hidden bg-[#111827] px-6 py-7 text-center text-white sm:px-10 sm:py-8 print:bg-white print:py-5 print:text-black">
        {subject.photo_url && (
          <>
            <img src={normalizeImageUrl(subject.photo_url)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 print:hidden" />
            <div className="absolute inset-0 bg-[#111827]/80 print:hidden" />
          </>
        )}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] via-[#e4c876] to-[#C9A24D] print:hidden" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#C9A24D]">Comparative Market Analysis</p>
          <h1 className="mt-2 font-serif text-3xl font-black leading-tight sm:text-5xl print:text-black">{subject.street_address || 'Subject Property'}</h1>
          <p className="mt-1.5 text-sm font-black uppercase tracking-[0.18em] text-gray-300 print:text-gray-600">{[subject.city, subject.state, subject.zipcode].filter(Boolean).join(', ')}</p>
          {(data.client_name || edit) && (
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-400 print:text-gray-500">
              Prepared for{' '}
              {edit
                ? <EditableText as="span" multiline={false} value={data.client_name || ''} onChange={edit.setClientName} placeholder="your client's name" label="Client name" className="text-white" />
                : <span className="text-white print:text-black">{data.client_name}</span>}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 px-6 pt-3">
            {agent.headshot_url ? (
              <img src={normalizeImageUrl(agent.headshot_url)} alt={agent.name || ''} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-[#111827] print:hidden" />
            ) : null}
            <p className="text-sm font-black">{agent.name}</p>
            {agent.brokerage && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 print:text-gray-500">{agent.brokerage}</p>}
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          {stateNote?.where === 'first_page' && (
            <div className="mt-5 max-w-3xl rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left print:border-gray-300 print:bg-white">
              {stateNote.heading && <p className="text-[11px] font-black uppercase tracking-wide text-white print:text-black">{stateNote.heading}</p>}
              <p className="text-sm font-semibold leading-relaxed text-gray-100 sm:text-base print:text-black">{stateNote.text}</p>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto max-w-4xl px-6 py-7 sm:px-10 sm:py-8 print:space-y-8 print:py-8 ${edit ? 'space-y-6' : 'space-y-14'}`}>
        {sections}
      </main>

      <footer className="border-t border-gray-200 bg-[#111827] px-6 py-12 text-white print:break-before-page print:bg-white print:text-black sm:py-16">
        <div className={`mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8 ${seeMoreUrl ? 'sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:items-center' : ''}`}>
          {/* The agent's Email Signature card takes the agent block's place when the report's switch is on and
              the plan has one - the printed / PDF version keeps the plain block. */}
          {data.signature_hub_slug ? (
            <>
              {/* (no saved signature card after all: the plain block shows instead of an empty footer) */}
              <div className="dark min-w-0 print:hidden"><SignatureSiteCard hubSlug={data.signature_hub_slug} towns={subject.city ? [subject.city] : []} fallback={plainAgent} /></div>
              <div className="hidden print:block">{plainAgent}</div>
            </>
          ) : plainAgent}
          {seeMoreUrl && (
            <div className="border-t border-white/10 pt-7 text-center print:hidden sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-left">
              <p className="font-serif text-2xl font-black sm:text-3xl">Want the wider view?</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-400">Listings, recent sales, and local insight from me.</p>
              <a href={seeMoreUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#C9A24D] px-6 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-105">
                See more from me <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
        <p className="mx-auto mt-10 max-w-4xl border-t border-white/10 pt-6 text-center text-[11px] leading-relaxed text-gray-400 print:border-gray-200 print:text-gray-600">
          This is a comparative market analysis (CMA), not a formal appraisal. It is an opinion of value based on
          comparable market data, prepared by a licensed real estate agent for informational purposes only, and should
          not be relied upon as a certified appraisal or a guarantee of the price at which the property will sell.
        </p>
      </footer>

      {popupComp && (
        <HomeDetailsPopup kind="comp" home={popupComp} subject={subject} mapRef={data.map_ref} note={cmaCompNote(data, popupComp)} onClose={() => setPopup(null)}
          position={openComp >= 0 ? `Comp ${openComp + 1} of ${comparables.length}` : undefined}
          onPrev={openComp > 0 ? () => setPopup({ kind: 'comp', id: comparables[openComp - 1].id }) : undefined}
          onNext={openComp >= 0 && openComp < comparables.length - 1 ? () => setPopup({ kind: 'comp', id: comparables[openComp + 1].id }) : undefined} />
      )}
      {marketHome && popup?.kind === 'market' && (
        <HomeDetailsPopup kind="market" home={competitionHomeAsComparable(marketHome)} subject={subject} onClose={() => setPopup(null)}
          position={`${marketIndex + 1} of ${popup.list.length}`}
          onPrev={marketIndex > 0 ? () => setPopup({ kind: 'market', key: popup.list[marketIndex - 1].listing_key, list: popup.list }) : undefined}
          onNext={marketIndex < popup.list.length - 1 ? () => setPopup({ kind: 'market', key: popup.list[marketIndex + 1].listing_key, list: popup.list }) : undefined} />
      )}
    </div>
  )
}
