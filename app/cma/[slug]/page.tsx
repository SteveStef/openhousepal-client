'use client'

import SignatureSiteCard from '@/components/studio/blogs/SignatureSiteCard'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Bath, BedDouble, Building2, Calendar, Car, ChevronLeft, ChevronRight, DollarSign, Download, Droplets, Gauge, Home, LandPlot, Layers, Loader2, Maximize2, MapPin, Moon, Ruler, ShieldCheck, Sun, Waves, X } from 'lucide-react'
import api from '@/lib/api-service'
import { CmaAiEstimate, CmaComparable, CmaPublicResponse } from '@/types'
import {
  buildCmaStaticMapUrl, buildCompLocationMapUrl, clientCompStrength, compDisplayPrice, resolveCmaMarketMetrics, effectiveCompPrice, formatAcresFromSqft, formatCompactMoneyRange, formatDate, formatMlsStatusLabel, formatMoney, formatMoneyRange,
  CmaGuidanceSection, cmaGuidanceSections, formatNumber, pricePerSqft, sortComparables, splitCmaBuyerGuidance, COMP_STATUS_BADGE_STYLE,
  AREA_TIERS, COMP_STATUS_HEX, COMP_STATUS_LABEL, QUALITY_LABELS, QUALITY_TIER_STYLES, STRENGTH_LABEL, STRENGTH_SCALE_STYLES, STRENGTH_STYLES,
  buyerOfferFigures, buildAdjustmentGrid, formatSignedMoney, basementDisplay, materialIssuesText, CmaAdjustmentGridComp, belowGradeDisplay, compPriceCaption, compPricePerSqft, compSoldDate, compSoldToAsking, compStatusBadgeText, formatSoldToAsking, subjectPricePerSqft,
} from '@/lib/cma'
import { CmaPresentationDocument } from '@/lib/pdfs'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { HomeAreaOverlay } from '@/components/maps/HomeAreaMap'
import { normalizeImageUrl } from '@/lib/utils'

export default function PublicCmaPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<CmaPublicResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const fetchReport = (showLoading = false) => {
      if (showLoading) setLoading(true)
      api.public.getCmaReport(slug).then(res => {
        if (cancelled) return
        if (res.success && res.data) {
          hasLoadedRef.current = true
          setData(res.data)
          setError(null)
        } else if (!hasLoadedRef.current) {
          setError(res.error || "This CMA link isn't active.")
        }
        setLoading(false)
      })
    }
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') fetchReport(false)
    }
    fetchReport(true)
    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)
    const interval = window.setInterval(refreshIfVisible, 30000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.clearInterval(interval)
    }
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#faf9f7] px-6 text-center dark:bg-[#0B0B0B]">
        <Home className="h-10 w-10 text-gray-300" />
        <p className="text-lg font-black text-[#111827] dark:text-white">This link isn't active</p>
        <p className="max-w-sm text-sm font-semibold text-gray-400">{error || 'Ask your agent for an updated link.'}</p>
      </div>
    )
  }

  return <CmaPresentation data={data} />
}

function CmaPresentation({ data }: { data: CmaPublicResponse }) {
  const { subject, pricing, market_context: marketContext, agent, presentation } = data
  const [openComp, setOpenComp] = useState<CmaComparable | null>(null)
  const [activeMapCompId, setActiveMapCompId] = useState<string | null>(null)
  const [embedded, setEmbedded] = useState(false)
  const [dark, setDark] = useState(true)

  // applyDark is the one place that ever touches the <dark> class on <html> - both the initial
  // embedded-vs-direct default below and the toggle button call this directly instead of each
  // separately reacting to `dark` in their own effect, so there's no ordering race between "what
  // the class should start as" and "what a passive effect eventually syncs it to" on first paint.
  const applyDark = (value: boolean) => {
    document.documentElement.classList.toggle('dark', value)
    setDark(value)
  }
  const hiddenSections = new Set(presentation?.hidden_sections || [])

  // Ignores the app-wide next-themes class on <html> (shared per-origin - same footgun/fix
  // already used on the Showcase public page) and decides the real default from scratch: the
  // agent's own presentation.default_theme choice (Complete & Send section of the Review step) on
  // OpenHousePal's own share link - dark unless they explicitly picked light - but always light
  // with no toggle at all inside the IDX site's iframe (window.self !== window.top) regardless of
  // that setting, since a client viewing the CMA embedded in their agent's own site should never
  // see a dark page there.
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    const isEmbedded = window.self !== window.top
    setEmbedded(isEmbedded)
    applyDark(!isEmbedded && presentation?.default_theme !== 'light')
    return () => { root.classList.toggle('dark', hadDark) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const hiddenCompIds = new Set(presentation?.hidden_comp_ids || [])
  const comparables = useMemo(
    () => sortComparables(data.comparables).filter(c => c.is_included && !hiddenCompIds.has(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.comparables, presentation?.hidden_comp_ids]
  )
  const isBuyer = data.mode === 'buyer'
  // The backend's locked final valuation is authoritative; legacy fields only support old reports.
  const finalValuation = pricing.ai_estimate?.final_valuation
  const offerFigures = buyerOfferFigures(pricing)
  const authoritativeValue = finalValuation?.value ?? pricing.ai_estimate?.value ?? null
  const authoritativeDom = pricing.ai_estimate?.status?.active_market_days ?? subject.days_on_market
  const suggested = {
    min: finalValuation?.range_min ?? pricing.ai_estimate?.range_min ?? null,
    max: finalValuation?.range_max ?? pricing.ai_estimate?.range_max ?? null,
  }
  // Authoritative backend comp stats (ai_estimate.comp_stats) when present; the local fallback
  // only runs for a pre-comp_stats report. metricsWeighted === metricsAll (same valuation pool).
  const metricsAll = resolveCmaMarketMetrics(comparables, pricing.ai_estimate)
  const metricsWeighted = metricsAll
  const mapUrl = buildCmaStaticMapUrl(subject, comparables, '1200x420')

  const headlineValue = isBuyer
    ? (authoritativeValue != null ? formatMoney(authoritativeValue) : formatMoney(pricing.estimated_fair_value))
    : (suggested.min != null && suggested.max != null
        ? formatMoneyRange(suggested.min, suggested.max)
        : formatMoneyRange(pricing.recommended_min, pricing.recommended_max))
  const authoritativeCommentary = pricing.ai_estimate?.methodology_summary
    ?? (isBuyer ? pricing.offer_strategy_commentary : pricing.pricing_commentary)
  const commentarySections = cmaGuidanceSections(authoritativeCommentary)
  const buyerGuidance = splitCmaBuyerGuidance({
    ...pricing,
    offer_strategy_commentary: pricing.ai_estimate?.methodology_summary ?? pricing.offer_strategy_commentary,
    offer_suggestion_notes: pricing.ai_estimate?.offer_strategy_considerations ?? pricing.offer_suggestion_notes,
  })

  const fileName = `CMA-${(subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`
  const seeMoreUrl = agent.idx_site_url || (agent.agent_hub_slug ? `/${agent.agent_hub_slug}` : null)

  return (
    <div className="min-h-screen bg-[#faf9f7] font-sans text-[#111827] dark:bg-[#0B0B0B] dark:text-white print:bg-white print:text-black">
      {/* Floating actions - hidden when printing */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 print:hidden">
        {!embedded && (
          <button
            type="button"
            onClick={() => applyDark(!dark)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white shadow-2xl transition hover:bg-black dark:bg-white dark:text-[#111827]"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
        <PDFDownloadLink document={<CmaPresentationDocument report={data as any} agent={agent} />} fileName={fileName}>
          {({ loading: pdfLoading }) => (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-2xl transition hover:bg-black dark:bg-white dark:text-[#111827]">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save PDF
            </span>
          )}
        </PDFDownloadLink>
      </div>

      <header className="relative overflow-hidden bg-[#111827] px-6 py-7 text-center text-white sm:px-10 sm:py-8 print:bg-white print:text-black print:py-5">
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
          <p className="mt-1.5 text-sm font-black uppercase tracking-[0.18em] text-gray-300 print:text-gray-600">
            {[subject.city, subject.state, subject.zipcode].filter(Boolean).join(', ')}
          </p>
          {data.client_name && (
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-400 print:text-gray-500">
              Prepared for <span className="text-white print:text-black">{data.client_name}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 px-6 pt-3">
            {(agent as any).photo_url || (agent as any).headshot_url ? (
              <img src={normalizeImageUrl((agent as any).photo_url || (agent as any).headshot_url)} alt={agent.name || ''}
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-[#111827] print:hidden" />
            ) : null}
            <p className="text-sm font-black">{agent.name}</p>
            {agent.brokerage && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 print:text-gray-500">{agent.brokerage}</p>}
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 print:text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-14 px-6 py-7 sm:px-10 sm:py-8 print:space-y-8 print:py-8">
        {/* Subject Property */}
        {!hiddenSections.has('subject') && (
          <Section eyebrow="The Property" title="Subject Property">
            <SubjectShowcaseCard subject={subject} />
          </Section>
        )}

        {/* Location Context */}
        {!hiddenSections.has('location') && comparables.length > 0 && (mapUrl || comparables.some(c => c.distance_miles != null)) && (
          <Section eyebrow="Geography" title="Location Context">
            {mapUrl && (
              <div className="relative mb-6 h-80 overflow-hidden rounded-3xl shadow-lg print:h-64 print:shadow-none">
                <div className="absolute inset-0 print:hidden">
                  <CmaInteractiveMap
                    subject={subject}
                    comparables={comparables}
                    fallbackUrl={mapUrl}
                    activeComparableId={activeMapCompId}
                    onSelectComparable={setActiveMapCompId}
                    onOpenComparable={setOpenComp}
                  />
                </div>
                <img src={normalizeImageUrl(mapUrl)} alt="Map of subject and comparable locations" className="hidden h-full w-full object-cover print:block" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-5 py-3 print:hidden">
                  <span className="text-xs font-black uppercase tracking-wide text-white">{comparables.length} comparable{comparables.length === 1 ? '' : 's'} mapped</span>
                  {comparables.some(c => c.distance_miles != null) && (
                    <span className="text-xs font-bold text-white/80">
                      Avg {(comparables.reduce((sum, c) => sum + (c.distance_miles ?? 0), 0) / comparables.filter(c => c.distance_miles != null).length).toFixed(1)} mi away
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* divide-y gives every row a real border, not just a same-as-the-page-background
                zebra tint that was invisible in light mode (bg-[#faf9f7] on bg-[#faf9f7]) - the
                zebra below is now a relative black/white overlay so it stays visible in both
                themes regardless of what's actually behind it. */}
            <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              <div className="flex items-center gap-3 bg-[#C9A24D]/10 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">S</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{subject.street_address} <span className="font-semibold text-gray-400">(Subject)</span></span>
                  <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ')}</span>
                </span>
              </div>
              {comparables.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveMapCompId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#C9A24D]/10 ${activeMapCompId === c.id ? 'bg-[#C9A24D]/15' : i % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[11px] font-black text-white">#{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-600 dark:text-gray-300">{c.street_address}</span>
                    <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-gray-400">{[c.city, c.state].filter(Boolean).join(', ')}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-gray-400">{c.distance_miles != null ? `${c.distance_miles} mi` : '—'}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Individual Comparable Analysis */}
        {!hiddenSections.has('comparables') && comparables.length > 0 && (
          <div>
            <SectionHeading eyebrow="The Evidence" title="Individual Comparable Analysis" />
            <div className="mt-6 space-y-10">
              {comparables.map((c, i) => <ComparableSection key={c.id} comp={c} index={i} onOpen={() => setOpenComp(c)} />)}
            </div>
          </div>
        )}

        {/* Comparable Overview */}
        {!hiddenSections.has('comparison_table') && comparables.length > 0 && (
          <Section eyebrow={`${comparables.length} Comparable Sales`} title="Comparable Overview">
            {/* No overflow-x/min-width here on purpose - this used to force a 640px-wide table
                into a scrolling wrapper even on narrow screens. table-fixed + shrinking every
                column's own max-width lets the browser squeeze all of Subject + up to 5 comps
                into whatever width is actually available instead, so the whole table is visible
                on the page without needing to scroll to see the rest of it. */}
            {/* Phones (user, 10/17): the table keeps readable columns and slides sideways (the row
                names stay pinned on the left) instead of squeezing six columns into the screen. */}
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:hidden">Swipe to see every comparable →</p>
            <div className="-mx-6 w-auto overflow-x-auto px-6 pb-1 [scrollbar-width:thin] sm:mx-0 sm:w-full sm:overflow-hidden sm:px-0">
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
                  {comparables.some(c => compSoldToAsking(c) != null) && <OverviewRow index={0} label="Sold vs. Asking" subjectValue="—" comparables={comparables} get={c => formatSoldToAsking(c) || '—'} />}
                  <OverviewRow index={1} label="$/Sqft (Above Grade)" subjectValue={subjectPricePerSqft(subject) ? `$${subjectPricePerSqft(subject)}` : '—'} comparables={comparables} get={c => { const p = compPricePerSqft(c); return p ? `$${p}` : '—' }} />
                  <OverviewRow index={2} label="Reported Finished Area" subjectValue={formatNumber(subject.sqft)} comparables={comparables} get={c => formatNumber(c.sqft)} />
                  {[subject, ...comparables].some(p => p.above_grade_finished_area != null) && <OverviewRow index={2} label="Above-Grade Finished Area" subjectValue={formatNumber(subject.above_grade_finished_area)} comparables={comparables} get={c => formatNumber(c.above_grade_finished_area)} />}
                  {[subject, ...comparables].some(p => p.below_grade_finished_area != null) && <OverviewRow index={2} label="Below-Grade Finished Area" subjectValue={belowGradeDisplay(subject)} comparables={comparables} get={c => belowGradeDisplay(c)} />}
                  <OverviewRow index={3} label="Lot Size" subjectValue={formatAcresFromSqft(subject.lot_size)} comparables={comparables} get={c => formatAcresFromSqft(c.lot_size)} />
                  <OverviewRow index={4} label="Beds" subjectValue={String(subject.beds ?? '—')} comparables={comparables} get={c => String(c.beds ?? '—')} />
                  <OverviewRow index={5} label="Baths" subjectValue={String(subject.baths ?? '—')} comparables={comparables} get={c => String(c.baths ?? '—')} />
                  <OverviewRow index={6} label="Year Built" subjectValue={String(subject.year_built ?? '—')} comparables={comparables} get={c => String(c.year_built ?? '—')} />
                  <OverviewRow index={7} label="Annual Taxes" subjectValue={subject.annual_taxes ? formatMoney(subject.annual_taxes) : '—'} comparables={comparables} get={c => c.annual_taxes ? formatMoney(c.annual_taxes) : '—'} />
                  <OverviewRow index={8} label="Distance" subjectValue="—" comparables={comparables} get={c => c.distance_miles != null ? `${c.distance_miles} miles` : '—'} />
                  <OverviewRow index={10} label="Days on Market" subjectValue={String(authoritativeDom ?? '—')} comparables={comparables} get={c => String(c.days_on_market ?? '—')} />
                  <OverviewRow index={11} label="School District" subjectValue={subject.school_district || '\u2014'} comparables={comparables} get={c => c.school_district || '\u2014'} />
                  <OverviewRow index={12} label="Water Source" subjectValue={formatUtilityValue(subject.water_source)} comparables={comparables} get={c => formatUtilityValue(c.water_source)} />
                  <OverviewRow index={13} label="Sewer / Septic" subjectValue={formatUtilityValue(subject.sewer)} comparables={comparables} get={c => formatUtilityValue(c.sewer)} />
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Market Analysis — aggregate stats + charts. Only shown when there are enough verified
            local Strong/Supporting sales to produce real ranges/averages; otherwise the whole
            section is dropped rather than shown as a grid of em-dashes and empty bar charts
            (a visitor should never see a blank section). The gold "market signal" bullets can
            still carry the section on their own when they exist. */}
        {(() => {
          const highlights = (!marketContext.hidden ? marketContext.highlight_statements.filter(Boolean) : [])
          if (hiddenSections.has('charts') || comparables.length === 0) return null
          if (!metricsAll.enoughForStats && highlights.length === 0) return null
          return (
          <Section eyebrow="Bringing It Together" title="Market Analysis">
            {highlights.length > 0 && (
              <div className="mb-6 space-y-2">
                {highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl bg-[#C9A24D]/10 px-4 py-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{h}</p>
                  </div>
                ))}
              </div>
            )}
            {metricsAll.enoughForStats && (
              <>
                {/* Client-facing (user, 10/17): one plain sentence and ONE price number (+ the matching
                    $/sq ft) - the median of the sales the value is built on. The six-number grid and
                    "normalized valuation-anchor weights" read like internal working. */}
                <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Based on the {metricsAll.count} most comparable {metricsAll.count === 1 ? 'sale' : 'sales'} near {subject.street_address || 'this home'}.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Fact label="Typical comparable sale" value={formatMoney(metricsAll.saleMedian ?? metricsAll.saleAvg, { compact: true })} />
                  <Fact label="Typical price per sq ft" value={(metricsAll.psfMedian ?? metricsAll.psfAvg) != null ? `$${Math.round((metricsAll.psfMedian ?? metricsAll.psfAvg) as number)}` : '—'} />
                </div>
                <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                  {/* Only real prices (a verified sale or a current asking price): a sale whose closing
                      price isn't on record is left off rather than charted at its asking price (10/20). */}
                  <BarChart title="Price Per Square Foot" subjectValue={subjectPricePerSqft(subject)} bars={comparables.map((c, i) => ({ label: `#${i + 1}`, value: compPricePerSqft(c) })).filter((b): b is { label: string; value: number } => b.value != null)} formatValue={v => `$${v}`} />
                  <BarChart title="Comparable Sale Prices" subjectValue={subject.list_price} bars={comparables.map((c, i) => ({ label: `#${i + 1}`, value: effectiveCompPrice(c) })).filter((b): b is { label: string; value: number } => b.value != null)} formatValue={v => formatMoney(v, { compact: true })} />
                </div>
              </>
            )}
          </Section>
          )
        })()}

        {/* Adjustment grid (10/20): each verified sale moved toward this home in dollars, then what
            the sales support, then any final step said out loud - no jump from "typical sale" to value. */}
        {!hiddenSections.has('pricing') && <AdjustmentGridSection estimate={pricing.ai_estimate} />}

        {/* Agent Final Analysis */}
        {!hiddenSections.has('pricing') && (
          <section className="rounded-3xl bg-[#111827] p-8 text-white print:break-inside-avoid print:border print:border-gray-300 print:bg-white print:text-black sm:p-12">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C9A24D]">Agent Final Analysis</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-400 print:text-gray-500">
              {isBuyer ? 'Estimated Fair Market Value' : 'Recommended Value'}
            </p>
            <p className="mt-1 font-serif text-4xl font-black sm:text-5xl">{headlineValue}</p>

            {/* qa_flags are an internal reconciliation log - never shown on the client-facing
                report. Contradictions are resolved before this renders (see cma_ai_service.py).
                Valuation Confidence and the "Why This Number" comp-by-comp $/sqft breakdown are
                deliberately omitted from the client/visitor report - they read as hedging and
                internal working, not something a buyer or seller wants to see. */}

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 print:border-gray-200 sm:grid-cols-4">
              {isBuyer ? (
                <>
                  <FinalFact label="Suggested Offer Min" value={offerFigures.min ? formatMoney(offerFigures.min) : null} />
                  <FinalFact label="Suggested Offer Max" value={offerFigures.max ? formatMoney(offerFigures.max) : null} />
                  <FinalFact label="Strong Offer" value={offerFigures.strong ? formatMoney(offerFigures.strong) : null} />
                </>
              ) : (
                <>
                  <FinalFact label="Most Likely Value" value={pricing.most_likely_value ? formatMoney(pricing.most_likely_value) : null} />
                  <FinalFact label="Recommended List Price" value={pricing.recommended_list_price ? formatMoney(pricing.recommended_list_price) : null} />
                </>
              )}
            </div>

            {commentarySections.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6 print:border-gray-200">
                <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#C9A24D]">{isBuyer ? 'Buyer Valuation Notes' : 'Agent Pricing Analysis'}</p>
                <GuidanceSections sections={commentarySections} />
              </div>
            )}

            {isBuyer && buyerGuidance.inspectionText && (
              <div className="mt-8 border-t border-white/10 pt-6 print:border-gray-200">
                <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#C9A24D]">Inspection Concerns</p>
                <GuidanceSections sections={buyerGuidance.inspectionSections} />
              </div>
            )}

            {isBuyer && buyerGuidance.offerText && (
              <div className="mt-8 border-t border-white/10 pt-6 print:border-gray-200">
                <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#C9A24D]">Offer Suggestion</p>
                <GuidanceSections sections={buyerGuidance.offerSections} />
              </div>
            )}

            {/* Seller mirror of the buyer's Offer Suggestion / Inspection Concerns above. */}
            {!isBuyer && ([
              ['Pricing Strategy', pricing.listing_strategy_notes],
              ['Listing Prep', pricing.listing_prep_notes],
            ] as const).map(([label, text]) => {
              const sections = cmaGuidanceSections(text)
              return sections.length > 0 ? (
                <div key={label} className="mt-8 border-t border-white/10 pt-6 print:border-gray-200">
                  <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#C9A24D]">{label}</p>
                  <GuidanceSections sections={sections} />
                </div>
              ) : null
            })}

          </section>
        )}
      </main>

      {/* Footer / Agent Contact */}
      <footer className="border-t border-gray-200 bg-[#111827] px-6 py-12 text-white print:break-before-page print:bg-white print:text-black sm:py-16">
        <div className={`mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-8 ${seeMoreUrl ? 'sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:items-center' : ''}`}>
          {/* The agent's Email Signature card (site version) takes the agent block's place when the
              report's switch is on and the plan has one - the printed/PDF version keeps the plain
              block, so nothing changes there. */}
          {data.signature_hub_slug && (
            <div className="dark min-w-0 print:hidden"><SignatureSiteCard hubSlug={data.signature_hub_slug} towns={subject.city ? [subject.city] : []} /></div>
          )}
          <div className={`flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left ${data.signature_hub_slug ? 'hidden print:flex' : ''}`}>
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

          {seeMoreUrl && (
            <div className="border-t border-white/10 pt-7 text-center print:hidden sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-left">
              <p className="font-serif text-2xl font-black sm:text-3xl">Want the wider view?</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-400">
                Listings, recent sales, and local insight from me.
              </p>
              <a
                href={seeMoreUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#C9A24D] px-6 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-105"
              >
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

      <ComparablePopupModal comp={openComp} subject={subject} onClose={() => setOpenComp(null)} />
    </div>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string, title: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white print:text-black sm:text-3xl">{title}</h2>
    </div>
  )
}

function Section({ eyebrow, title, children, wide = false }: { eyebrow: string, title: string, children: React.ReactNode, wide?: boolean }) {
  return (
    <section className={`print:break-inside-avoid ${wide ? 'relative left-1/2 w-[calc(100vw-2rem)] max-w-[1640px] -translate-x-1/2 sm:w-[calc(100vw-4rem)]' : ''}`}>
      <div className={wide ? 'mx-auto max-w-6xl' : ''}>
        <SectionHeading eyebrow={eyebrow} title={title} />
      </div>
      <div className={wide ? 'mt-3' : 'mt-6'}>{children}</div>
    </section>
  )
}

// grid-cols-3 (not 4/2) is deliberate: with exactly 6 facts, three columns lines the two rows up
// as "the sale-price stats" then "the $/sqft stats" - a grouping that falls out of the existing
// label order for free instead of needing a second row of markup to say so.
function FactsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
}

// Same bordered-card language as MiniFact/PopupFact elsewhere on this page, instead of bare
// stacked text with nothing to visually group one stat from the next.
function AdjustmentGridSection({ estimate }: { estimate?: CmaAiEstimate | null }) {
  const grid = buildAdjustmentGrid(estimate)
  if (!grid) return null
  const rows: { label: string, get: (c: CmaAdjustmentGridComp) => string, bold?: boolean }[] = [
    { label: 'Sold price', get: c => formatMoney(c.sale) },
    { label: 'Size (above grade)', get: c => formatSignedMoney(c.size) },
    { label: 'Finished lower level', get: c => formatSignedMoney(c.lowerLevel) },
    { label: 'Bathrooms', get: c => formatSignedMoney(c.baths) },
    { label: 'Garage', get: c => formatSignedMoney(c.garage) },
    ...(grid.hasSewer ? [{ label: 'Cesspool', get: (c: CmaAdjustmentGridComp) => formatSignedMoney(c.sewer) }] : []),
    { label: 'Adjusted price', get: c => formatMoney(c.adjusted), bold: true },
    { label: 'Weight in value', get: c => `${c.weightPct}%` },
  ]
  return (
    <Section eyebrow="Adjustment Grid" title="How the Comps Were Adjusted">
      <p className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Each sale moved toward this home, in dollars.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th />
              {grid.comps.map(c => (
                <th key={c.label} className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide text-gray-500">
                  {c.label}<span className="block font-semibold normal-case tracking-normal text-gray-400">{c.address}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-3 text-xs font-black uppercase tracking-wide text-gray-500">{r.label}</td>
                {grid.comps.map(c => (
                  <td key={c.label} className={`px-3 py-2 text-right ${r.bold ? 'font-black text-[#8b7355] dark:text-[#d7b974]' : 'font-semibold text-[#111827] dark:text-white'}`}>{r.get(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
        <GridSummaryLine label="Value from adjusted sales" value={formatMoney(grid.adjustedSalesValue)} note="Weighted adjusted prices, cross-checked against price per square foot." />
        {grid.otherAdjustments !== 0 && <GridSummaryLine label="Location / condition adjustments" value={formatSignedMoney(grid.otherAdjustments)} />}
        <GridSummaryLine label="What the comparable sales support" value={formatMoney(grid.compBasedValue)} bold={!grid.marketCheck} />
        {grid.marketCheck && <GridSummaryLine label="Market check" value={formatSignedMoney(grid.marketCheck.amount)} note={grid.marketCheck.text} />}
        {grid.marketCheck && <GridSummaryLine label="Estimated fair market value" value={formatMoney(grid.finalValue)} bold />}
      </div>
      {grid.uncertainties.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">What the sales can&apos;t pin down</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
            {grid.uncertainties.map(u => <li key={u}>{u}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">Size is adjusted on above-grade living area. A finished lower level is valued at a fraction of above-grade space; baths and garage spaces at a share of each sale&apos;s price. Only sales with a recorded closing price are used.</p>
    </Section>
  )
}

function GridSummaryLine({ label, value, note, bold = false }: { label: string, value: string, note?: string, bold?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className={`text-sm ${bold ? 'font-black' : 'font-bold'} text-[#111827] dark:text-white`}>{label}</p>
        <p className={`font-black ${bold ? 'text-lg text-[#8b7355] dark:text-[#d7b974]' : 'text-sm text-[#111827] dark:text-white'}`}>{value}</p>
      </div>
      {note && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  )
}

function Fact({ label, value }: { label: string, value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white px-3 py-4 text-center shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] print:border-gray-200 print:bg-white print:shadow-none">
      <p className="text-lg font-black text-[#111827] dark:text-white print:text-black">{value ?? '—'}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

function FinalFact({ label, value }: { label: string, value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-lg font-black">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

function GuidanceSections({ sections }: { sections: CmaGuidanceSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`}>
          {section.title && (
            <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#C9A24D] print:text-black">
              {section.title}
            </p>
          )}
          <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-gray-200 print:text-gray-800">{section.body}</p>
        </div>
      ))}
    </div>
  )
}

function SubjectShowcaseCard({ subject }: { subject: CmaPublicResponse['subject'] }) {
  const photos = useMemo(() => {
    const all = [...(subject.photos || []), subject.photo_url].filter(Boolean) as string[]
    return Array.from(new Set(all.map(normalizeImageUrl)))
  }, [subject.photos, subject.photo_url])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const currentPhoto = photos[photoIndex] || photos[0]
  // The photo that was showing before - kept underneath while the next one fades in.
  const [prevPhoto, setPrevPhoto] = useState<string | null>(null)
  const lastPhoto = useRef<string | null>(null)
  useEffect(() => { setPrevPhoto(lastPhoto.current); lastPhoto.current = currentPhoto || null }, [currentPhoto])
  const subjectPsf = subjectPricePerSqft(subject)
  const stats = [
    subject.beds != null ? { icon: BedDouble, label: 'Beds', value: String(subject.beds) } : null,
    subject.baths != null ? { icon: Bath, label: 'Baths', value: String(subject.baths) } : null,
    subject.sqft != null ? { icon: Ruler, label: 'Sq Ft', value: formatNumber(subject.sqft) } : null,
    subjectPsf != null ? { icon: DollarSign, label: '/ Sq Ft', value: `$${subjectPsf}` } : null,
    subject.year_built != null ? { icon: Calendar, label: 'Built', value: String(subject.year_built) } : null,
    subject.days_on_market != null ? { icon: Calendar, label: 'DOM', value: String(subject.days_on_market) } : null,
    subject.lot_size != null ? { icon: LandPlot, label: 'Acres', value: formatAcresFromSqft(subject.lot_size).replace(' ac', '') } : null,
    subject.annual_taxes != null ? { icon: DollarSign, label: 'Annual Taxes', value: formatMoney(subject.annual_taxes) } : null,
  ].filter(Boolean) as { icon: any, label: string, value: string }[]

  useEffect(() => {
    setPhotoIndex(0)
  }, [photos])

  useEffect(() => {
    photos.forEach(photo => {
      const img = new Image()
      img.src = photo
    })
  }, [photos])

  // 3s rotation, always the slow zoom-in animation (never zoom-out) - each photo starts fresh at
  // scale(1) and gently zooms in for as long as it's shown, remounted via the `key` below so the
  // animation restarts cleanly on every swap.
  useEffect(() => {
    if (photos.length < 2) return
    const timer = window.setInterval(() => {
      setPhotoIndex(current => {
        const options = photos.map((_, index) => index).filter(index => index !== current)
        return options[Math.floor(Math.random() * options.length)] ?? 0
      })
    }, 3000)
    return () => window.clearInterval(timer)
  }, [photos])
  const statusLabel = formatMlsStatusLabel(subject.mls_status)
  const hasStatus = statusLabel && statusLabel !== 'â€”' && statusLabel !== '—'

  return (
    <>
    <div className="mx-auto max-w-5xl">
      <div className="flex overflow-hidden rounded-3xl bg-[#111827] shadow-[0_8px_28px_rgba(17,24,39,0.14)] ring-1 ring-black/[0.06]">
        <div className="flex w-full flex-col">
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            title="View subject property details"
            className="relative block h-[clamp(260px,34vw,430px)] w-full overflow-hidden text-left"
          >
              {currentPhoto ? (
                <>
                  {prevPhoto && prevPhoto !== currentPhoto && (
                    <img key={`prev-${prevPhoto}`} src={prevPhoto} alt="" aria-hidden className="cma-hero-still absolute inset-0 h-full w-full object-cover" />
                  )}
                  <img
                    key={currentPhoto}
                    src={currentPhoto}
                    alt={subject.street_address || 'Subject property'}
                    className="cma-hero-crossfade absolute inset-0 h-full w-full object-cover"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <Home className="h-12 w-12 text-gray-300" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[#0b1220]/10" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.76] via-black/[0.22] to-white/[0.08]" />

              <div className="absolute left-4 top-4 flex max-w-[70%] flex-wrap gap-2">
                {hasStatus && (
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow ${subjectStatusBadgeClass(statusLabel)}`}>
                    {statusLabel}
                  </span>
                )}
                {subject.days_on_market != null && (
                  <span className="rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow ">
                    {subject.days_on_market} DOM
                  </span>
                )}
              </div>

              {/* Small "this opens" tab - the whole photo is clickable, but nothing about a plain
                  photo otherwise signals that, so a top-right badge makes it discoverable. */}
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg ">
                <Maximize2 className="h-3 w-3" /> View Details
              </span>

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <div className="max-w-3xl">
                  {subject.list_price != null && (
                    <span className="inline-block rounded-xl bg-white px-4 py-2 font-serif text-2xl font-black leading-none text-[#111827] shadow-lg sm:text-3xl">
                      {formatMoney(subject.list_price)}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {stats.length > 0 && (
              <div className="grid shrink-0 grid-cols-6 border-t border-white/15 bg-black/35 lg:grid-cols-8">
                {stats.map((stat, index) => (
                  <SubjectStat
                    key={stat.label}
                    {...stat}
                    className={stat.label === 'Annual Taxes' || stat.label === 'DOM' ? 'hidden lg:flex' : ''}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    {showDetails && <SubjectPopupModal subject={subject} onClose={() => setShowDetails(false)} />}
    </>
  )
}


function SubjectPopupModal({ subject, onClose }: { subject: CmaPublicResponse['subject'], onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pics = subject.photos && subject.photos.length > 0 ? subject.photos : (subject.photo_url ? [subject.photo_url] : [])
  const psf = subjectPricePerSqft(subject)
  const cityState = [subject.city, subject.state].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
        <div className="relative aspect-[4/3] max-h-[420px] w-full shrink-0 bg-gray-100 dark:bg-gray-800">
          {pics.length > 0 ? <img src={normalizeImageUrl(pics[photoIndex])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-10 w-10 text-gray-300" /></div>}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#111827] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">Subject Property</span>
            {subject.days_on_market != null && (
              <span className="rounded-full bg-black/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ">
                {subject.days_on_market} DOM
              </span>
            )}
          </div>
          {pics.length > 1 && (
            <>
              <button onClick={() => setPhotoIndex(i => (i - 1 + pics.length) % pics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => setPhotoIndex(i => (i + 1) % pics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">{photoIndex + 1} / {pics.length}</span>
            </>
          )}
        </div>
        {pics.length > 1 && (
          <div className="scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-100 bg-[#faf9f7] px-4 py-2.5 dark:border-gray-800 dark:bg-[#0B0B0B]">
            {pics.map((p, i) => (
              <button key={i} onClick={() => setPhotoIndex(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === photoIndex ? 'ring-[#C9A24D]' : 'ring-transparent opacity-60 hover:opacity-100'}`}>
                <img src={normalizeImageUrl(p)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#111827] dark:text-white">{subject.street_address}</p>
              {cityState && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{cityState}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{subject.list_price != null ? formatMoney(subject.list_price) : '-'}</p>
              {psf && <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PopupFact icon={BedDouble} label="Beds" value={subject.beds ?? '-'} />
            <PopupFact icon={Bath} label="Baths" value={subject.baths ?? '-'} />
            <PopupFact icon={Ruler} label="Sqft" value={subject.sqft ? formatNumber(subject.sqft) : '-'} />
            <PopupFact icon={LandPlot} label="Acres" value={formatAcresFromSqft(subject.lot_size)} />
            <PopupFact icon={Building2} label="Built" value={subject.year_built ?? '-'} />
            <PopupFact icon={Calendar} label="DOM" value={subject.days_on_market ?? '-'} />
            <PopupFact icon={DollarSign} label="Taxes" value={subject.annual_taxes ? formatMoney(subject.annual_taxes) : '-'} />
            <PopupFact icon={Car} label="Garage" value={subject.garage || '-'} />
            <PopupFact icon={Droplets} label="Water" value={formatUtilityValue(subject.water_source)} />
            <PopupFact icon={Building2} label="School" value={subject.school_district || '-'} className="sm:col-span-2" />
            <PopupFact icon={Waves} label="Sewer" value={formatUtilityValue(subject.sewer)} />
            <PopupFact icon={Layers} label="Basement" value={basementDisplay(subject)} />
          </div>
          {subject.public_remarks && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Original Listing Description</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{subject.public_remarks}</p>
            </div>
          )}
          {subject.agent_notes && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Agent Notes</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{subject.agent_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function subjectStatusBadgeClass(statusLabel: string) {
  const normalized = statusLabel.toLowerCase()
  if (normalized.includes('sold') || normalized.includes('closed')) return 'bg-red-600'
  if (normalized.includes('active') || normalized.includes('coming soon')) return 'bg-emerald-600'
  if (normalized.includes('pending') || normalized.includes('contract')) return 'bg-amber-500 text-[#111827]'
  return 'bg-gray-700'
}

function SubjectStat({ icon: Icon, label, value, className = '' }: { icon: any, label: string, value: string, className?: string }) {
  return (
    <div className={`flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1 border-white/15 px-1.5 py-2.5 text-center text-white sm:border-l sm:first:border-l-0 ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#C9A24D] sm:h-4 sm:w-4" />
      <p className="max-w-full break-words text-xs font-black leading-tight sm:text-base">{value}</p>
      <p className="text-[7px] font-black uppercase tracking-wide text-white/55 sm:text-[8px]">{label}</p>
    </div>
  )
}

function MiniSubjectFact({ label, value }: { label: string, value: string | number | null | undefined }) {
  if (!value || value === 'â€”' || value === '—') return null
  return (
    <div>
      <p className="text-sm font-black text-[#111827] dark:text-white">{value}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

// Zebra striping (odd rows get a faint tint) plus a gold hover tint so tracking one stat across
// 5+ comp columns doesn't depend on squinting at a barely-there border between rows. Every cell
// is capped and truncated with a title tooltip - short values (numbers, prices) never notice,
// but a long value like a school district name stays on one line instead of wrapping the row
// tall and throwing off the eye-line to every other row.
function OverviewRow({ index, label, subjectValue, comparables, get }: { index: number, label: string, subjectValue: string, comparables: CmaComparable[], get: (c: CmaComparable) => string }) {
  return (
    <tr className={`border-b border-gray-100 transition-colors hover:bg-[#C9A24D]/10 dark:border-gray-800 dark:hover:bg-[#C9A24D]/10 print:border-gray-200 ${index % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}`}>
      <td className="sticky left-0 z-[1] w-[112px] whitespace-normal leading-tight bg-[#faf9f7] py-2.5 pr-2 text-[12px] font-bold text-gray-500 dark:bg-[#0B0B0B] sm:static sm:w-auto sm:truncate sm:bg-transparent sm:py-2 sm:text-xs sm:dark:bg-transparent">{label}</td>
      <td className="truncate py-2.5 pr-3 text-[12.5px] font-black text-[#111827] dark:text-white print:text-black sm:py-2 sm:pr-2 sm:text-xs" title={subjectValue}>{subjectValue}</td>
      {comparables.map(c => {
        const value = get(c)
        return <td key={c.id} className="truncate py-2.5 pr-3 text-[12.5px] font-semibold text-gray-700 dark:text-gray-300 sm:py-2 sm:pr-2 sm:text-xs" title={value}>{value}</td>
      })}
    </tr>
  )
}

function formatUtilityValue(value?: string[] | string | null) {
  if (!value) return '-'
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-'
  return value
}

function ComparableSection({ comp, index, onOpen }: { comp: CmaComparable, index: number, onOpen: () => void }) {
  const photos = useMemo(() => {
    const all = [...(comp.photos || []), comp.photo_url].filter((p): p is string => Boolean(p))
    return Array.from(new Set(all.map(normalizeImageUrl)))
  }, [comp.photos, comp.photo_url])
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => { setPhotoIndex(0) }, [comp.id, photos.length])
  const currentPhoto = photos[photoIndex] || photos[0]
  const visiblePhotos = useMemo(() => {
    const maxVisible = 5
    if (photos.length <= maxVisible) return photos.map((photo, photoIndex) => ({ photo, photoIndex }))
    const start = Math.min(Math.max(photoIndex - 2, 0), photos.length - maxVisible)
    return photos.slice(start, start + maxVisible).map((photo, offset) => ({ photo, photoIndex: start + offset }))
  }, [photoIndex, photos])
  const psf = compPricePerSqft(comp)
  const note = comp.commentary || comp.ai_commentary
  const displayedStrength = clientCompStrength(comp)
  const cityOnly = comp.city || ''
  const locationMapUrl = buildCompLocationMapUrl(comp, '700x320')
  const statusLabel = COMP_STATUS_LABEL[comp.status] || comp.status
  const statusBadgeText = compSoldDate(comp) ? `${statusLabel} • ${compSoldDate(comp)}` : compStatusBadgeText(comp)
  const shiftPhoto = (direction: -1 | 1) => {
    if (photos.length < 2) return
    setPhotoIndex(i => (i + direction + photos.length) % photos.length)
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] print:break-inside-avoid print:border-gray-300 print:shadow-none">
      <div className="mb-4 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-lg bg-gradient-to-br from-[#C9A24D] to-[#a9832f] px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-md">Comp #{index + 1}</span>
          {displayedStrength && <span className={`rounded-lg px-3.5 py-2 text-[11px] font-black uppercase tracking-wide shadow-md ${STRENGTH_STYLES[displayedStrength]}`}>{STRENGTH_LABEL[displayedStrength]}</span>}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-[#111827] dark:text-white print:text-black">{comp.street_address}</p>
            {cityOnly && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{cityOnly}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-black leading-none text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(comp).value)}</p>
            {psf && <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft above grade</p>}
            {compPriceCaption(comp) && <p className={`mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400 ${compDisplayPrice(comp).unverified ? "text-amber-700 dark:text-amber-300" : ""}`}>{compPriceCaption(comp)}</p>}
            {(comp.material_issues || []).length > 0 && <p className="mt-1 text-[10px] font-black text-red-700 dark:text-red-300">Note: {materialIssuesText(comp)}</p>}
          </div>
        </div>
      </div>
      <div className="grid items-stretch gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 text-left dark:bg-gray-800 print:pointer-events-none">
            <button type="button" onClick={onOpen} className="block h-full w-full">
              {currentPhoto ? <img key={currentPhoto} src={currentPhoto} alt="" className="cma-comp-photo h-full w-full object-cover" draggable={false} /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-gray-300" /></div>}
            </button>
            {/* Status now carries the sold date inline (Sold - Jun 2, 2025) instead of a
                separate "Sold" stat below, and DOM sits opposite it top-right - both read at a
                glance without competing with the numeric stat grid for space. */}
            <span className={`absolute left-3 top-3 max-w-[65%] truncate rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[comp.status] || 'bg-gray-800'}`}>
              {statusBadgeText}
            </span>
            {comp.days_on_market != null && (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ">
                {comp.days_on_market} DOM
              </span>
            )}
            {comp.distance_miles != null && (
              <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ">
                <MapPin className="h-3 w-3 shrink-0" /> {comp.distance_miles} mi from subject
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#fbfaf7] p-2 dark:bg-[#0B0B0B] print:hidden">
              <button type="button" onClick={() => shiftPhoto(-1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[#111827] transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-800 dark:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
                {visiblePhotos.map(({ photo, photoIndex: thumbIndex }) => (
                  <button key={`${photo}-${thumbIndex}`} type="button" onClick={() => setPhotoIndex(thumbIndex)} className={`h-10 flex-1 overflow-hidden rounded-lg ring-2 transition duration-300 ${thumbIndex === photoIndex ? 'scale-[1.02] ring-[#C9A24D] opacity-100' : 'ring-transparent opacity-65 hover:opacity-100'}`}>
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => shiftPhoto(1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[#111827] transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-800 dark:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {/* mt-3 (not mt-auto) - sits right under the photo/thumbnails instead of being pushed
              down to the bottom of the flex column. Sqft (redundant with $/Sqft), Distance, and
              Sold are gone from here now that they live on the photo itself or the status badge,
              which is what leaves room for School District + Basement to move down into this
              column below the grid. */}
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-3 sm:gap-2">
            <MiniFact icon={BedDouble} label="Beds" value={comp.beds ?? '-'} />
            <MiniFact icon={Bath} label="Baths" value={comp.baths ?? '-'} />
            <MiniFact icon={LandPlot} label="Acres" value={formatAcresFromSqft(comp.lot_size)} />
            <MiniFact icon={Building2} label="Built" value={comp.year_built ?? '-'} />
            <MiniFact icon={Gauge} label="$/Sqft" value={psf ? `$${psf}` : '-'} />
            <MiniFact icon={Car} label="Garage" value={comp.garage || '-'} />
            <MiniFact icon={Droplets} label="Water / Sewer" value={`${formatUtilityValue(comp.water_source)} / ${formatUtilityValue(comp.sewer)}`} className="col-span-4 order-1 sm:hidden" />
            <MiniFact icon={Droplets} label="Water" value={formatUtilityValue(comp.water_source)} className="hidden sm:flex" />
            <MiniFact icon={DollarSign} label="Taxes" value={comp.annual_taxes ? formatMoney(comp.annual_taxes) : '-'} className="max-sm:col-span-2" />
            <MiniFact icon={Waves} label="Sewer" value={formatUtilityValue(comp.sewer)} className="hidden sm:flex" />
          </div>
          {/* flex-1 + each row flex-1 (not a plain grid) - grows to fill whatever's left of the
              column's height so these two rows' bottom edge lands even with the bottom of the
              "Compared With the Subject" section on the right, the same trick the old
              Distance-from-Subject bar used to handle before it moved onto the photo. */}
          <div className="mt-2 flex flex-1 flex-col gap-2">
            <WideCompFact icon={Building2} label="School District" value={comp.school_district || '-'} compact className="flex-1 max-sm:justify-center max-sm:text-center" />
            <WideCompFact icon={Layers} label="Basement" value={basementDisplay(comp)} compact className="flex-1 max-sm:justify-center max-sm:text-center" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="hidden lg:block">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-gradient-to-br from-[#C9A24D] to-[#a9832f] px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-md">Comp #{index + 1}</span>
              {displayedStrength && <span className={`rounded-lg px-3.5 py-2 text-[11px] font-black uppercase tracking-wide shadow-md ${STRENGTH_STYLES[displayedStrength]}`}>{STRENGTH_LABEL[displayedStrength]}</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-black text-[#111827] dark:text-white print:text-black">{comp.street_address}</p>
                {cityOnly && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{cityOnly}</p>}
              </div>
              <div className="shrink-0 text-left lg:text-right">
                <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(comp).value)}</p>
                {psf && <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft above grade</p>}
                {compPriceCaption(comp) && <p className={`text-[10px] font-black uppercase tracking-wide text-gray-400 ${compDisplayPrice(comp).unverified ? "text-amber-700 dark:text-amber-300" : ""}`}>{compPriceCaption(comp)}</p>}
                {(comp.material_issues || []).length > 0 && <p className="mt-1 text-[10px] font-black text-red-700 dark:text-red-300">Note: {materialIssuesText(comp)}</p>}
              </div>
            </div>
          </div>

          {/* Zoomed-in single-property map (not the wide subject-vs-comp overview) - close enough
              to actually read the street layout: cul-de-sac, corner lot, highway frontage. Fits
              here now that School District + Basement moved down into the left column. */}
          {locationMapUrl && (
            <div className="relative mt-4 overflow-hidden rounded-xl">
              <img src={locationMapUrl} alt="Map of this comparable's location" className="h-36 w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-[#111827]/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg ">Map</span>
            </div>
          )}

          <ComparableQualitySection comp={comp} />
        </div>
      </div>

      {/* Full-width footer instead of confined to the right column - the analysis text reads
          better across the card's full width than squeezed next to the photo, and this keeps the
          card more compact overall than stacking it inside the narrower column. */}
      {note && (
        <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-3 dark:bg-[#0B0B0B] print:bg-gray-50">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Comparable Analysis</p>
          <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 print:text-gray-800">{note}</p>
        </div>
      )}
    </div>
  )
}

// The 3-position scale every quality dimension is rated on, left-to-right - same tiers and
// left-to-right ordering as the agent's own editor (SideBySidePanel's OptionGrid in the studio),
// so a client sees exactly where the agent's score landed on the same scale, not just the end
// result. Parameterized on `tiers`/`styles` since Comp Weight uses its own independent
// weak/supporting/strong scale (STRENGTH_SCALE_STYLES) rather than the quality dimensions'
// below/similar/above (QUALITY_TIER_STYLES) - the two mean different things (below/above are both
// red for a quality dimension, since either extreme is a weaker match; for Comp Weight, strong is
// unambiguously the best outcome).
const QUALITY_TIERS = ['below', 'similar', 'above'] as const
// Weaker | Strong | Supporting - same left/middle/right order as the studio editor's
// STRENGTH_OPTIONS (Strong sits in the middle). Only the selected position is colour-filled
// (see QualityScaleRow); the other two render as neutral placeholders.
const STRENGTH_TIERS = ['weak', 'strong', 'supporting'] as const

function QualityScaleRow({ label, tiers, tier, displayLabel, styles }: {
  label: string, tiers: readonly string[], tier?: string | null, displayLabel?: string, styles: Record<string, string>
}) {
  if (!tier) return null
  return (
    <div className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">
      <span className="w-24 shrink-0 text-[9px] font-black uppercase leading-tight tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <div className="grid flex-1 grid-cols-3 gap-1">
        {tiers.map(t => (
          <div
            key={t}
            className={`rounded-md py-1.5 text-center text-[9px] font-black uppercase tracking-wide transition ${
              t === tier ? styles[t] : 'bg-gray-50 text-gray-300 dark:bg-gray-800/40 dark:text-gray-600'
            }`}
          >
            {t === tier ? (displayLabel || QUALITY_LABELS[t]) : '—'}
          </div>
        ))}
      </div>
    </div>
  )
}

// Client-facing transparency into how the agent (or the AI) actually scored this comp against the
// subject - not just the free-text note. `area` is deliberately excluded from the color scale
// (it's a factual school-district/city comparison, not a strength judgment) and shown as a plain
// neutral chip instead.
function ComparableQualitySection({ comp }: { comp: CmaComparable }) {
  const q = comp.quality || {}
  const displayedStrength = clientCompStrength(comp)
  const hasAny = !!(displayedStrength || q.finish_quality || q.interior || q.exterior || q.lot || q.amenities || q.layout || q.area || q.street_context)
  if (!hasAny) return null
  return (
    <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#151517] print:border-gray-300">
      <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Compared With the Subject</p>
      <p className="mb-3 text-[10px] font-semibold text-gray-400">Each row describes this comp relative to the subject — &ldquo;Comp Superior&rdquo; means the comp is the better one; &ldquo;Comp Inferior&rdquo; means the subject is.</p>
      {/* Comp Weight is a different kind of question from the quality-dimension rows below it -
          it's asking how much analytical weight this comp carries overall, not how one attribute
          compares to the subject - so it gets its own bracketed callout instead of sitting in the
          same divided list. -mx-3 cancels the box's own px-3 content padding so "Comp Weight"
          still lines up with "Finish Quality" below it, instead of sitting 12px further right. */}
      {displayedStrength && (
        <div className="mb-3 -mx-3 flex items-center justify-between gap-3 rounded-xl border-2 border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/10 via-white to-white px-3 py-2 shadow-[0_6px_18px_-10px_rgba(201,162,77,0.6)] dark:border-[#C9A24D]/60 dark:from-[#C9A24D]/10 dark:via-[#0B0B0B] dark:to-[#0B0B0B]">
          <span className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Valuation Classification</span>
          <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wide ${STRENGTH_SCALE_STYLES[displayedStrength] || 'bg-slate-100 text-slate-600'}`}>
            {STRENGTH_LABEL[displayedStrength] || displayedStrength}
          </span>
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <QualityScaleRow label="Finish Quality" tiers={QUALITY_TIERS} tier={q.finish_quality} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Interior" tiers={QUALITY_TIERS} tier={q.interior} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Exterior" tiers={QUALITY_TIERS} tier={q.exterior} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Lot" tiers={QUALITY_TIERS} tier={q.lot} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Amenities" tiers={QUALITY_TIERS} tier={q.amenities} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Layout" tiers={QUALITY_TIERS} tier={q.layout} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Area" tiers={AREA_TIERS} tier={q.area} styles={QUALITY_TIER_STYLES} />
        <QualityScaleRow label="Street" tiers={QUALITY_TIERS} tier={q.street_context} styles={QUALITY_TIER_STYLES} />
      </div>
    </div>
  )
}

function MiniFact({ icon: Icon, label, value, className = '' }: { icon: any, label: string, value: string | number, className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-[#faf9f7] px-1 py-2 text-center dark:border-gray-800 dark:bg-[#0B0B0B] sm:px-2 sm:py-2.5 ${className}`}>
      <Icon className="h-3.5 w-3.5 text-[#C9A24D]" />
      <span className="max-w-full break-words text-center text-[11px] font-black leading-tight text-[#111827] dark:text-white">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
}

function WideCompFact({ icon: Icon, label, value, compact = false, large = false, className = '' }: { icon: any, label: string, value: string | number, compact?: boolean, large?: boolean, className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-[#faf9f7] px-4 dark:border-gray-800 dark:bg-[#0B0B0B] ${compact ? 'py-2.5' : large ? 'py-4' : 'py-3'} ${className}`}>
      <span className={`${compact ? 'h-8 w-8' : large ? 'h-10 w-10' : 'h-9 w-9'} flex shrink-0 items-center justify-center rounded-full bg-white text-[#C9A24D] shadow-sm dark:bg-[#151517]`}>
        <Icon className={large ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-wide text-gray-400">{label}</span>
        <span className={`block break-words font-black leading-snug text-[#111827] dark:text-white ${large ? 'text-base' : 'text-sm'}`}>{value}</span>
      </span>
    </div>
  )
}

function ComparablePopupModal({ comp, subject, onClose }: { comp: CmaComparable | null, subject: CmaPublicResponse['subject'], onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => { setPhotoIndex(0) }, [comp])
  useEffect(() => {
    if (!comp) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [comp, onClose])

  const pics = comp ? (comp.photos && comp.photos.length > 0 ? comp.photos : (comp.photo_url ? [comp.photo_url] : [])) : []
  // Zoomed in on just this property (not the wide subject-vs-comp overview) - close enough to
  // actually read the street layout: cul-de-sac, corner lot, highway frontage.
  const locationMapUrl = comp ? buildCompLocationMapUrl(comp, '700x320') : null

  if (!comp) return null
  const psf = compPricePerSqft(comp)
  const cityState = [comp.city, comp.state].filter(Boolean).join(', ')
  const note = comp.commentary || comp.ai_commentary

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
        <div className="relative aspect-[4/3] max-h-[420px] w-full shrink-0 bg-gray-100 dark:bg-gray-800">
          {pics.length > 0 ? <img src={normalizeImageUrl(pics[photoIndex])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-10 w-10 text-gray-300" /></div>}
          <span className="absolute left-3 top-3 rounded-full bg-[#111827] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">Comparable</span>
          <span className={`absolute right-12 top-3 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[comp.status] || 'bg-gray-800'}`}>
            {compStatusBadgeText(comp)}
          </span>
          {pics.length > 1 && (
            <>
              <button onClick={() => setPhotoIndex(i => (i - 1 + pics.length) % pics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => setPhotoIndex(i => (i + 1) % pics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">{photoIndex + 1} / {pics.length}</span>
            </>
          )}
        </div>
        {pics.length > 1 && (
          <div className="scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-100 bg-[#faf9f7] px-4 py-2.5 dark:border-gray-800 dark:bg-[#0B0B0B]">
            {pics.map((p, i) => (
              <button key={i} onClick={() => setPhotoIndex(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === photoIndex ? 'ring-[#C9A24D]' : 'ring-transparent opacity-60 hover:opacity-100'}`}>
                <img src={normalizeImageUrl(p)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#111827] dark:text-white">{comp.street_address}</p>
              {cityState && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{cityState}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(comp).value)}</p>
              {psf && <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft above grade</p>}
              {compPriceCaption(comp) && <p className={`text-[9px] font-black uppercase tracking-wide text-gray-400 ${compDisplayPrice(comp).unverified ? "text-amber-700 dark:text-amber-300" : ""}`}>{compPriceCaption(comp)}</p>}
              {(comp.material_issues || []).length > 0 && <p className="mt-1 text-[10px] font-black text-red-700 dark:text-red-300">Note: {materialIssuesText(comp)}</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PopupFact icon={BedDouble} label="Beds" value={comp.beds ?? '-'} />
            <PopupFact icon={Bath} label="Baths" value={comp.baths ?? '-'} />
            <PopupFact icon={Ruler} label="Sqft" value={comp.sqft ? formatNumber(comp.sqft) : '-'} />
            <PopupFact icon={LandPlot} label="Acres" value={formatAcresFromSqft(comp.lot_size)} />
            <PopupFact icon={Building2} label="Built" value={comp.year_built ?? '-'} />
            <PopupFact icon={Calendar} label="DOM" value={comp.days_on_market ?? '-'} />
            <PopupFact icon={DollarSign} label="Taxes" value={comp.annual_taxes ? formatMoney(comp.annual_taxes) : '-'} />
            <PopupFact icon={MapPin} label="Distance" value={comp.distance_miles != null ? `${comp.distance_miles} Miles` : '-'} />
            <PopupFact icon={Droplets} label="Water" value={formatUtilityValue(comp.water_source)} />
            <PopupFact icon={Building2} label="School" value={comp.school_district || '-'} className="sm:col-span-2" />
            <PopupFact icon={Waves} label="Sewer" value={formatUtilityValue(comp.sewer)} />
          </div>
          {comp.public_remarks && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Original Listing Description</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{comp.public_remarks}</p>
            </div>
          )}
          {locationMapUrl && (
            <div className="mt-4">
              <div className="relative overflow-hidden rounded-xl">
                <img src={locationMapUrl} alt="Map of this comparable's location" className="h-40 w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-[#111827]/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg ">Map</span>
              </div>
              {comp.distance_miles != null && <p className="mt-1.5 text-xs font-bold text-gray-400">{comp.distance_miles} miles from {subject.street_address || 'the subject property'}</p>}
            </div>
          )}
          {note && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Comparable Analysis</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PopupFact({ icon: Icon, label, value, className = '' }: { icon: any, label: string, value: string | number, className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-[#faf9f7] px-2 py-3 text-center dark:border-gray-800 dark:bg-[#0B0B0B] ${className}`}>
      <Icon className="h-4 w-4 text-[#C9A24D]" />
      <span className="max-w-full break-words text-sm font-black leading-tight text-[#111827] dark:text-white">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
}

function escapeMapHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function publicMapCompCardHtml(comp: CmaComparable, index: number, onOpen?: () => void) {
  const price = compDisplayPrice(comp).value
  const acres = comp.lot_size ? (comp.lot_size / 43560) : null
  const statusColor = COMP_STATUS_HEX[comp.status] || '#374151'
  const statusText = comp.status === 'sold' && comp.sale_date ? `Closed ${formatDate(comp.sale_date)}` : (COMP_STATUS_LABEL[comp.status] || comp.status)
  let soldPctLine = ''
  if (comp.status === 'sold' && comp.sale_price && comp.list_price) {
    const pct = ((comp.sale_price - comp.list_price) / comp.list_price) * 100
    const rounded = Math.round(pct * 10) / 10
    const label = Math.abs(rounded) < 0.1 ? 'Sold at asking' : `Sold ${Math.abs(rounded)}% ${rounded > 0 ? 'above' : 'below'} asking`
    soldPctLine = `<p style="margin:2px 0 0;font-size:10px;font-weight:700;color:#6B7280;">${escapeMapHtml(label)}</p>`
  }
  const stat = (value: string | number | null | undefined, label: string) => value != null && value !== ''
    ? `<div style="min-width:0;text-align:center;"><p style="margin:0;font-size:10px;font-weight:800;color:#111827;">${escapeMapHtml(value)}</p><p style="margin:0;font-size:7px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.03em;">${escapeMapHtml(label)}</p></div>`
    : ''
  const stats = [
    stat(comp.beds, 'Beds'),
    stat(comp.baths, 'Baths'),
    stat(comp.sqft ? formatNumber(comp.sqft) : null, 'SF'),
    stat(acres ? acres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null, 'AC'),
    stat(comp.distance_miles != null ? `${comp.distance_miles} Miles` : null, 'Away'),
  ].filter(Boolean).join('')

  const container = document.createElement('div')
  container.className = 'comps-map-infowindow'
  container.innerHTML = `
    <div style="width:160px;font-family:inherit;color:#111827;margin:0;">
      <div style="position:relative;">
        ${comp.photo_url ? `<img src="${escapeMapHtml(normalizeImageUrl(comp.photo_url) || '')}" alt="" style="display:block;width:100%;height:120px;aspect-ratio:4/3;object-fit:cover;border-radius:9px;background:#F3F4F6;" />` : `<div style="width:100%;height:120px;aspect-ratio:4/3;border-radius:9px;background:#F3F4F6;"></div>`}
        <span style="position:absolute;top:5px;left:5px;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;color:#fff;background:#111827;">#${index + 1}</span>
        <span style="position:absolute;top:5px;right:5px;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:800;color:#fff;background:${statusColor};">${escapeMapHtml(statusText)}</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:5px;margin-top:6px;">
        <p style="margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;color:#111827;">${escapeMapHtml(comp.street_address || 'Comparable Property')}</p>
        <p style="margin:0;flex-shrink:0;font-size:11px;font-weight:800;color:#111827;">${price ? escapeMapHtml(formatMoney(price, { compact: true })) : '&mdash;'}</p>
      </div>
      <p style="margin:0;font-size:8px;font-weight:700;color:#9CA3AF;">${escapeMapHtml([comp.city, comp.state, comp.zipcode].filter(Boolean).join(', '))}</p>
          ${soldPctLine}
      <div style="display:flex;justify-content:space-between;gap:2px;padding:6px 0;margin-top:5px;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">${stats}</div>
      <div style="display:flex;gap:5px;margin-top:7px;">
        <button data-action="details" style="flex:1;border:1px solid #E5E7EB;border-radius:8px;padding:4px 5px;font-size:8px;font-weight:800;cursor:pointer;color:#111827;background:#fff;">Details</button>
        <button type="button" disabled style="flex:1;border:none;border-radius:8px;padding:4px 5px;font-size:8px;font-weight:800;color:#fff;background:#059669;">Added ✓</button>
      </div>
    </div>
  `
  container.querySelector('[data-action="details"]')?.addEventListener('click', () => onOpen?.())
  return container
}

function CmaInteractiveMap({ subject, comparables, fallbackUrl, activeComparableId, onSelectComparable, onOpenComparable }: {
  subject: CmaPublicResponse['subject'],
  comparables: CmaComparable[],
  fallbackUrl: string,
  activeComparableId?: string | null,
  onSelectComparable?: (id: string | null) => void,
  onOpenComparable?: (comp: CmaComparable) => void,
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<google.maps.Map | null>(null)
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const lastOpenedCompIdRef = useRef<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [mapReadyKey, setMapReadyKey] = useState(0)
  const [mapObj, setMapObj] = useState<google.maps.Map | null>(null)
  const mapDataKey = useMemo(() => [
    subject.latitude,
    subject.longitude,
    subject.street_address,
    ...comparables.map(c => [
      c.id,
      c.latitude,
      c.longitude,
      c.street_address,
      c.city,
      c.state,
      c.zipcode,
      c.photo_url,
      c.status,
      c.sale_date,
      c.sale_price,
      c.list_price,
      c.sqft,
      c.price_per_sqft,
      c.distance_miles,
    ].join(':')),
  ].join('|'), [subject.latitude, subject.longitude, subject.street_address, comparables])

  useEffect(() => {
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !mapRef.current) return

      const points = [
        subject.latitude != null && subject.longitude != null
          ? { label: 'S', title: subject.street_address || 'Subject property', position: { lat: subject.latitude, lng: subject.longitude }, subject: true }
          : null,
        ...comparables
          .filter(c => c.latitude != null && c.longitude != null)
          .map((c, i) => ({
            label: `#${i + 1}`,
            title: c.street_address || `Comparable #${i + 1}`,
            position: { lat: c.latitude as number, lng: c.longitude as number },
            subject: false,
            comp: c,
            index: i,
          })),
      ].filter(Boolean) as { label: string, title: string, position: google.maps.LatLngLiteral, subject: boolean, comp?: CmaComparable, index?: number }[]

      if (points.length === 0) {
        setLoadError(true)
        return
      }

      const map = new google.maps.Map(mapRef.current, {
        center: points[0].position,
        zoom: points.length > 1 ? 13 : 15,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        clickableIcons: false,
        zoomControl: true,
        gestureHandling: 'greedy',
      })
      mapObjRef.current = map
      setMapObj(map)
      const infoWindow = new google.maps.InfoWindow({ maxWidth: 180 })
      infoWindowRef.current = infoWindow
      infoWindow.addListener('closeclick', () => {
        lastOpenedCompIdRef.current = null
        onSelectComparable?.(null)
      })
      map.addListener('click', () => {
        infoWindow.close()
        lastOpenedCompIdRef.current = null
        onSelectComparable?.(null)
      })

      const bounds = new google.maps.LatLngBounds()
      markerRefs.current.forEach(marker => marker.setMap(null))
      markerRefs.current = new Map()
      points.forEach(point => {
        bounds.extend(point.position)
        const marker = new google.maps.Marker({
          map,
          position: point.position,
          title: point.title,
          label: { text: point.label, color: '#ffffff', fontWeight: '800', fontSize: point.subject ? '12px' : '11px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: point.subject ? 13 : 11,
            fillColor: point.subject ? '#111827' : '#C9A24D',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        })
        if (point.comp && point.index != null) {
          markerRefs.current.set(point.comp.id, marker)
          marker.addListener('click', () => {
            lastOpenedCompIdRef.current = point.comp!.id
            onSelectComparable?.(point.comp!.id)
            infoWindow.setContent(publicMapCompCardHtml(point.comp!, point.index!, () => onOpenComparable?.(point.comp!)))
            infoWindow.open({ map, anchor: marker })
          })
        }
      })
      if (points.length > 1) map.fitBounds(bounds, 64)
      setMapReadyKey(key => key + 1)
    }).catch(() => { if (!cancelled) setLoadError(true) })

    return () => {
      cancelled = true
      markerRefs.current.forEach(marker => marker.setMap(null))
      markerRefs.current = new Map()
      infoWindowRef.current?.close()
      mapObjRef.current = null
      infoWindowRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapDataKey, onSelectComparable, onOpenComparable])

  useEffect(() => {
    if (!activeComparableId) return
    if (lastOpenedCompIdRef.current === activeComparableId) return
    const map = mapObjRef.current
    const marker = markerRefs.current.get(activeComparableId)
    const infoWindow = infoWindowRef.current
    const compIndex = comparables.findIndex(c => c.id === activeComparableId)
    const comp = compIndex >= 0 ? comparables[compIndex] : null
    const position = marker?.getPosition()
    if (!map || !marker || !infoWindow || !comp || !position) return
    map.panTo(position)
    if ((map.getZoom() || 0) < 14) map.setZoom(14)
    infoWindow.setContent(publicMapCompCardHtml(comp, compIndex, () => onOpenComparable?.(comp)))
    infoWindow.open({ map, anchor: marker })
    lastOpenedCompIdRef.current = activeComparableId
  }, [activeComparableId, comparables, mapReadyKey, onOpenComparable])

  if (loadError) {
    return <img src={normalizeImageUrl(fallbackUrl)} alt="Map of subject and comparable locations" className="h-full w-full object-cover" />
  }

  // The subject's township, the ones around it and its school district (user, 10/18) - over the
  // comparables, without changing how the map frames them.
  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      {subject.latitude != null && subject.longitude != null && (
        <HomeAreaOverlay map={mapObj} latitude={subject.latitude} longitude={subject.longitude} fit={false} />
      )}
    </div>
  )
}

// Same bordered-card treatment as Fact above, plus a border on the bar track itself - a flat
// fill color alone read as floating with nothing to define its edges, especially in light mode.
function BarChart({ title, subjectValue, bars, formatValue }: { title: string, subjectValue?: number | null, bars: { label: string, value: number }[], formatValue: (v: number) => string }) {
  const max = Math.max(...bars.map(b => b.value), subjectValue || 0, 1)
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] print:border-gray-200 print:bg-white print:shadow-none sm:p-5">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-2">
        {subjectValue != null && (
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-black uppercase text-[#6f5c3c] dark:text-[#d7b974]">Subj.</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full border border-gray-200 bg-[#ebe7df] dark:border-white/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#111827] dark:bg-[#d7b974]" style={{ width: `${(subjectValue / max) * 100}%` }} /></div>
            <span className="w-20 shrink-0 text-right text-[11px] font-black">{formatValue(subjectValue)}</span>
          </div>
        )}
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full border border-gray-200 bg-[#ebe7df] dark:border-white/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#8b7355] dark:bg-[#a98d5d]" style={{ width: `${(b.value / max) * 100}%` }} /></div>
            <span className="w-20 shrink-0 text-right text-[11px] font-bold text-gray-600 dark:text-gray-300">{b.value ? formatValue(b.value) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
