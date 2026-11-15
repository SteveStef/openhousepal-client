import { CmaAiEstimate, CmaComparable, CmaPricing, CmaReport, CmaStatus, CmaSubjectProperty } from '@/types'

// Short support code an agent can hand to OpenHousePal support so admin can pull up the exact
// report - the first 12 hex characters of the report's own id (dashes stripped), grouped for
// readability. No separate DB column/migration: a report's id already has enough entropy for a
// safe prefix lookup (see admin_routes.py's admin_lookup_cma_report). Deterministic from `id`, so
// this never needs to be generated/stored - just displayed.
export function cmaSupportCode(reportId: string): string {
  const hex = reportId.replace(/-/g, '').slice(0, 12).toUpperCase()
  return hex.match(/.{1,4}/g)?.join('-') || hex
}

export function formatMoney(value?: number | null, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (opts.compact) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function formatMoneyRange(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return `${formatMoney(min)} – ${formatMoney(max)}`
  return formatMoney(min ?? max)
}

export function formatCompactMoneyRange(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '\u2014'
  if (min != null && max != null) return `${formatMoney(min, { compact: true })} \u2013 ${formatMoney(max, { compact: true })}`
  return formatMoney(min ?? max, { compact: true })
}

export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US')
}

export function formatCompactNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }).toLowerCase()
}

export function formatAcresFromSqft(value?: number | null, opts: { long?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) return '—'   // escaped: a literal dash here was once saved mis-encoded and printed "â€”" in the PDF
  const acres = value / 43560
  // An MLS data-entry error, not a lot (523 Sherbrook Dr printed "431 ac", 10/23). The backend drops these
  // on new searches (cma_fact_check.implausible_lot); this covers comps saved before that.
  if (acres > 250) return '—'
  // Two decimals up to 10 acres - the same figure the write-ups quote (backend lot_acres). One decimal
  // printed 1.15 acres as "1.2" on the cover while the text said 1.1 (grader 11/01, 719 Beechwood Rd).
  const formatted = acres.toLocaleString('en-US', {
    minimumFractionDigits: acres < 0.1 ? 2 : 0,
    maximumFractionDigits: acres < 10 ? 2 : 1,
  })
  return `${formatted} ${opts.long ? 'acres' : 'ac'}`
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export type CmaGuidanceSection = { title: string; body: string }

// Collapses runs of horizontal whitespace (spaces/tabs) but keeps real line breaks intact - this
// used to flatten everything (including intentional blank lines between subsections) onto one
// line before cmaGuidanceSections ever got a look at it, which is also why the raw text in the
// review page's textarea read as one dense wall of text regardless of how well it parsed into
// titled sections afterward. Paragraph spacing needs to survive here so it's visible both in the
// raw textarea and (via whitespace-pre-line/PdfParagraphs) in the site and PDF.
function cleanGuidanceText(value?: string | null): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function displayGuidanceTitle(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalized.includes('septic') && normalized.includes('well')) return 'Septic / Utilities'
  return normalized.split(' ').map(word => {
    if (['dom', 'hvac', 'hoa'].includes(word)) return word.toUpperCase()
    if (word === '&') return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

// Strips markdown-bold markers the AI sometimes leaves around emphasis mid-sentence (not caught
// as a section heading by cmaGuidanceSections below) - there's no rich-text renderer for this
// content on the site or in the PDF, so a literal "**word**" would otherwise just show its
// asterisks instead of any actual emphasis.
export function stripStrayBold(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, '$1')
}

export function cmaGuidanceSections(text?: string | null): CmaGuidanceSection[] {
  const cleaned = cleanGuidanceText(text)
  if (!cleaned) return []
  // Heading shapes the AI has used for these subsections: "**Title Case Header:**" (bold with a
  // colon, either side of the closing **), "**Title Case Header** – " (bold with an en/em
  // dash instead of a colon, either side of the closing **), and the older bare
  // "ALL CAPS HEADER:" - matched together so a marker always becomes a real section instead of
  // showing up literally in one run-on paragraph. A terminator (colon or a spaced dash) is
  // mandatory and must sit directly against the closing ** - without that, a plain inline
  // "**$3,100,000**, or roughly $500/sqft..." mid-sentence emphasis got misread as a heading,
  // turning the number into a stray title and leaving the rest of the sentence starting with a
  // dangling comma. A genuine subsection header always terminates right at the bold boundary;
  // inline emphasis or an em-dash aside elsewhere in the sentence never touches that boundary.
  const headingPattern = /\*\*\s*([^*]{2,60}?)\s*\*\*:\s*|\*\*\s*([^*]{2,60}?):\s*\*\*\s*|\*\*\s*([^*]{2,60}?)\s*\*\*\s*[-–—]\s+|\*\*\s*([^*]{2,60}?)\s*[-–—]\s*\*\*\s*|\b([A-Z][A-Z0-9/&\-\s]{2,44}):\s*/g
  const matches = Array.from(cleaned.matchAll(headingPattern))
  if (matches.length === 0) return [{ title: '', body: stripStrayBold(cleaned) }]
  const sections: CmaGuidanceSection[] = []
  const first = matches[0]
  if (first.index && first.index > 0) {
    const pre = stripStrayBold(cleaned.slice(0, first.index).trim())
    if (pre) sections.push({ title: 'Overview', body: pre })
  }
  matches.forEach((match, index) => {
    const heading = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? '').replace(/[:\s\-–—]+$/, '').trim()
    const start = (match.index || 0) + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index || cleaned.length : cleaned.length
    const body = stripStrayBold(cleaned.slice(start, end).trim())
    if (body) sections.push({ title: displayGuidanceTitle(heading), body })
  })
  return sections.filter(section => section.body)
}

function isInspectionSection(section: CmaGuidanceSection): boolean {
  // Judged by the section's heading, whole words only - matching the body moved offer paragraphs
  // ("as well", "inspection contingency", "condition") onto the inspection page (rule audit 10/24).
  if (!section.title || section.title === 'Overview') return false
  const text = section.title.toLowerCase()
  return /\b(inspections?|septic|well|utilities|water|sewer|roof|exterior|stucco|structural|foundation|mechanical|systems|plumbing|electrical|hvac|infiltration|egress)\b/.test(text)
}

function sectionsToText(sections: CmaGuidanceSection[]): string {
  return sections.map(section => section.title ? `${section.title}: ${section.body}` : section.body).join('\n\n')
}

export function splitCmaBuyerGuidance(pricing: CmaPricing): {
  inspectionText: string;
  offerText: string;
  inspectionSections: CmaGuidanceSection[];
  offerSections: CmaGuidanceSection[];
} {
  const explicitInspection = cleanGuidanceText(pricing.inspection_concerns)
  const rawOffer = cleanGuidanceText(pricing.offer_suggestion_notes)
  if (explicitInspection) {
    const inspectionSections = cmaGuidanceSections(explicitInspection)
    const offerSections = cmaGuidanceSections(rawOffer)
    return { inspectionText: explicitInspection, offerText: rawOffer, inspectionSections, offerSections }
  }
  const offerSectionsAll = cmaGuidanceSections(rawOffer)
  if (offerSectionsAll.length <= 1) {
    return { inspectionText: '', offerText: rawOffer, inspectionSections: [], offerSections: offerSectionsAll }
  }
  const inspectionSections = offerSectionsAll.filter(isInspectionSection)
  const offerSections = offerSectionsAll.filter(section => !isInspectionSection(section))
  return {
    inspectionText: sectionsToText(inspectionSections),
    offerText: sectionsToText(offerSections),
    inspectionSections,
    offerSections,
  }
}

// Mirrors backend _categorize_status() so raw MLS strings like "ACTIVE-BRIGHT" or
// "ACTIVE UNDER CONTRACT-BRIGHT" render as plain client-facing labels.
export function formatMlsStatusLabel(raw?: string | null): string {
  if (!raw) return '—'
  const s = raw.toUpperCase().replace('-BRIGHT', '').trim()
  if (s.startsWith('CLOSED') || s.startsWith('SOLD')) return 'Sold'
  if (s.startsWith('ACTIVE') && s.includes('CONTRACT')) return 'Active Under Contract'
  if (s.startsWith('PENDING') || s.includes('CONTRACT')) return 'Pending'
  if (s.startsWith('COMING SOON')) return 'Coming Soon'
  if (s.startsWith('ACTIVE')) return 'Active'
  return raw.replace(/-BRIGHT/i, '').split(/[\s_-]+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

export function timeAgo(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export const CMA_STATUS_STYLES: Record<CmaStatus, string> = {
  DRAFT: 'bg-gray-700 text-white dark:bg-gray-600 dark:text-white',
  READY: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
  SHARED: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
}

export function pricePerSqft(price?: number | null, sqft?: number | null): number | null {
  if (!price || !sqft) return null
  return Math.round(price / sqft)
}

export function includedComparables(comparables: CmaComparable[]): CmaComparable[] {
  return comparables.filter(c => c.is_included)
}

export function effectiveCompPrice(c: CmaComparable): number | null {
  // A comp marked "sold" with no VERIFIED closing price contributes no usable number to
  // valuation math - never substitute its list/pending price (that's the "list price shown as
  // sold price" bug). Non-sold comps (active / pending / under contract) legitimately use their
  // current asking price as the reference point.
  if (c.status === 'sold') {
    if ((c as { price_verified?: boolean }).price_verified === false) return null
    return c.sale_price ?? c.close_price ?? null
  }
  return c.list_price ?? null
}

// Whether a sold comp's closing price has been verified (defaults true for legacy / manual
// rows, which is what we want - only a search comp we couldn't confirm gets flagged false).
export function isPriceVerified(c: CmaComparable): boolean {
  return (c as { price_verified?: boolean }).price_verified !== false
}

// The single source of truth for what price to DISPLAY for a comp and how to label it. A sold
// comp with no verified closing price shows its last list price under a plain "List price"
// label (never a bare number under "Sold") and still carries unverified:true so it stays out
// of the weighted valuation aggregates - but no loud badge, the label itself is the tell.
export function compDisplayPrice(c: CmaComparable): { value: number | null; label: string; unverified: boolean } {
  if (c.status === 'sold' && !isPriceVerified(c)) {
    return { value: c.list_price ?? (c as { original_list_price?: number | null }).original_list_price ?? null, label: 'List price', unverified: true }
  }
  if (c.status === 'sold') {
    return { value: c.sale_price ?? (c as { close_price?: number | null }).close_price ?? null, label: 'Closed price', unverified: false }
  }
  if (c.status === 'pending' || c.status === 'active_under_contract') {
    return { value: c.list_price ?? null, label: 'Pending price', unverified: false }
  }
  return { value: c.list_price ?? null, label: 'List price', unverified: false }
}

// ---- Report display helpers (10/20 graded report: 417 Dogwood Ln) ------------------------------
// One basis for every $/sqft on the page: price / ABOVE-GRADE finished area. The subject's figure
// used to divide by total area incl. a finished basement ($160) while comps used above-grade -
// on the same basis the subject was the most expensive per foot, not a bargain.
export function psfBasisSqft(p: { above_grade_finished_area?: number | null; sqft?: number | null }): number | null {
  return p.above_grade_finished_area || p.sqft || null
}
export function subjectPricePerSqft(s: CmaSubjectProperty): number | null {
  return s.list_price ? pricePerSqft(s.list_price, psfBasisSqft(s)) : null
}
export function compPricePerSqft(c: CmaComparable): number | null {
  return pricePerSqft(effectiveCompPrice(c), psfBasisSqft(c))
}
// Sold price / last asking price, e.g. 1.138 for a sale 13.8% over asking. Verified sales only.
export function compSoldToAsking(c: CmaComparable): number | null {
  if (c.status !== 'sold' || !isPriceVerified(c)) return null
  // A builder lists the base price; the close includes the buyer's options - not an asking-price result (11/13)
  if (isBuilderBasePriceSale(c)) return null
  const sold = c.sale_price ?? c.close_price ?? null
  const asking = c.list_price ?? null
  return sold && asking ? sold / asking : null
}
// A home on public sewer isn't on septic, whatever a listing agent ticked ("Public Sewer, Public Septic"
// on a 52nd-floor condo - grader audit 11/13): the septic entry is dropped from utility lists.
export function cleanUtilityList(value?: string[] | string | null): string[] | string | null | undefined {
  if (!Array.isArray(value)) return value
  const vals = value.filter(Boolean)
  const sewer = vals.some(v => /sewer/i.test(v) && !/no/i.test(v))
  return sewer && vals.some(v => /septic/i.test(v)) ? vals.filter(v => !/septic/i.test(v)) : vals
}
export function isBuilderBasePriceSale(c: CmaComparable): boolean {
  return (c as { builder_base_price?: boolean | null }).builder_base_price === true
}
export const BUILDER_BASE_PRICE_LABEL = 'New build: base price plus upgrades'
export function formatSoldToAsking(c: CmaComparable): string | null {
  if (c.status === 'sold' && isPriceVerified(c) && isBuilderBasePriceSale(c)) return BUILDER_BASE_PRICE_LABEL
  const r = compSoldToAsking(c)
  if (r == null) return null
  const fmt = (x: number) => { const p = Math.round((x - 1) * 1000) / 10; return p === 0 ? 'at' : `${Math.abs(p)}% ${p > 0 ? 'over' : 'under'}` }
  const main = fmt(r) === 'at' ? 'At asking' : `${fmt(r)} asking`
  // Against the ORIGINAL asking price too when the price was cut (10/20: 2702 E Kings Hwy read
  // "6.5% over asking" on a reduced price; it was 2.5% over the original $399,900).
  const sold = c.sale_price ?? c.close_price ?? null
  const orig = (c as { original_list_price?: number | null }).original_list_price ?? null
  if (sold && orig && c.list_price && Math.abs(orig - c.list_price) / c.list_price > 0.005) {
    return `${main} (${fmt(sold / orig)} original)`
  }
  return main
}
export function compSoldDate(c: CmaComparable): string | null {
  if (c.status !== 'sold' || !isPriceVerified(c)) return null
  const d = c.close_date || c.sale_date
  return d ? formatDate(d) : null
}
// Status badge: a sale with no closing price on record is never a bare "SOLD" over its asking price.
export function compStatusBadgeText(c: CmaComparable): string {
  if (c.status === 'sold' && !isPriceVerified(c)) return 'Sold - price not reported'
  return COMP_STATUS_LABEL[c.status] || c.status
}
// Deal-breakers on record, in plain words: "cesspool (sewer); listing says sold as-is".
export function materialIssuesText(c: CmaComparable): string {
  return (c.material_issues || []).map(i => i.replace(/^listing says: /, 'listing says ')).join('; ')
}
// Small caption under the comp's price.
export function compPriceCaption(c: CmaComparable): string | null {
  if (c.status === 'sold' && !isPriceVerified(c)) return 'Last asking price - sold price not reported'
  if (c.status === 'sold') return [compSoldDate(c) ? `Sold ${compSoldDate(c)}` : 'Sold', formatSoldToAsking(c)].filter(Boolean).join(' - ')
  return compDisplayPrice(c).label
}
// What the listing TEXT says about the lower level when Bright's Basement field doesn't (2407 E Kings
// Hwy: field "Full", remarks "partially finished basement" - the table and the write-up disagreed).
// Same patterns as the backend's _remarks_finished_basement.
export function remarksBasementFinish(p: { public_remarks?: string | null }): 'partial' | 'finished' | null {
  const t = (p.public_remarks || '').toLowerCase()
  if (/partially[\s-]+finished\s+(?:lower[\s-]+level|basement)|basement\s+(?:is\s+)?partially\s+finished/.test(t)) return 'partial'
  if (/finished\s+(?:lower[\s-]+level|basement|walk[\s-]?out)|basement\s+(?:is\s+)?(?:fully\s+)?finished/.test(t.replace(/unfinished/g, ''))) return 'finished'
  return null
}
// Basement for display: Bright's field, plus what the listing says when the field is silent on finish.
export function basementDisplay(p: { basement?: string | null; public_remarks?: string | null }): string {
  const b = p.basement || ''
  if (/finished/i.test(b.replace(/unfinished/i, ''))) return b || '—'
  const hint = remarksBasementFinish(p)
  if (!hint) return b || '—'
  const said = hint === 'partial' ? 'partially finished' : 'finished'
  return b ? `${b} (listing: ${said})` : `Listing: ${said}`
}
// Finished below-grade area for display: the MLS can say "Fully Finished" with 0 sqft on record -
// that's "Not reported", never a hard 0.
export function belowGradeDisplay(p: { below_grade_finished_area?: number | null; basement?: string | null; public_remarks?: string | null }): string {
  if (p.below_grade_finished_area && p.below_grade_finished_area > 0) return formatNumber(p.below_grade_finished_area)
  const raw = (p.basement || '').toLowerCase()
  // Finished, size not on record - "Not reported" beside "Fully Finished" read as a contradiction
  // (417 Dogwood Ln #2, 239 Windham Dr #2; the valuation estimates the size, marked est.).
  if (raw.replace('unfinished', '').includes('finished') || remarksBasementFinish(p)) return 'Finished, size not reported'
  // Only a basement recorded as unfinished (or none) is a real 0. A basement described with no
  // finish at all ("Full, Outside Entrance, Poured Concrete") is valued as unfinished, so say that
  // rather than a dash next to the other comps' "Not reported" (417 Dogwood Ln v5, 10/20).
  if (raw.includes('unfinished') || raw === 'none' || raw === 'no') return '0'
  return raw.trim() ? 'None on record' : '—'
}

// ---- Adjustment grid (10/20) ---------------------------------------------------------------
// What a client (or an appraiser) expects to see between "the comps sold for X" and "this home is
// worth Y": each verified sale, the dollar adjustments that move it toward this home, the adjusted
// price, how much it counts, and - when the final value isn't simply the adjusted comps - why.
export interface CmaAdjustmentGridComp {
  label: string; address: string; sale: number; size: number; lowerLevel: number; baths: number
  garage: number; sewer: number; lot: number; time: number; age: number; road: number; condition: number
  // city comps: the gap between the comp's few blocks and the subject's, from nearby sale prices (10/23)
  location: number
  adjusted: number; weightPct: number; notes: string[]
  weightExact?: number        // the share before rounding to a whole percent
  grossPct?: number | null    // gross adjustment as % of the sale price (what cuts a sale's share)
  // The lower-level area the grid used and whether it was estimated (finished per the MLS, no area
  // recorded) - a bad guess there moves the value, so the agent sees it (10/20 review).
  lowerLevelSqft: number | null; lowerLevelEstimated: boolean
}
export interface CmaAdjustmentGridStep { label: string; amount?: number; value?: number; note?: string; bold?: boolean }
export interface CmaAdjustmentGrid {
  comps: CmaAdjustmentGridComp[]
  hasSewer: boolean
  marketPsf: number | null
  rates: { size: number | null; lowerLevel: number | null }
  // Every step from the adjusted sales to the final value, each one adding up (10/20: the old
  // panel skipped the asking-price ceiling, so $521K + $6K appeared to equal $500K).
  steps: CmaAdjustmentGridStep[]
  finalValue: number | null
  uncertainties: string[]
}
export function buildAdjustmentGrid(estimate?: CmaAiEstimate | null): CmaAdjustmentGrid | null {
  const trace = estimate?.valuation_trace
  const anchor = trace?.anchor
  const rows = (anchor?.comps || []).filter(c => c.price_basis !== 'list_context' && c.raw_sale_price)
  // Reports made before the grid existed have no per-comp feature trace - show nothing rather than zeros.
  if (!anchor?.anchor_value || rows.length === 0 || !rows.some(c => c.feature_adjustments)) return null
  const comps = rows.map(c => {
    const fa = c.feature_adjustments
    const m = /\((.+)\)\s*$/.exec(c.label || '')
    return {
      label: (c.label || '').replace(/\s*\(.+\)\s*$/, ''), address: m ? m[1] : '',
      sale: c.raw_sale_price, size: c.size_adjustment ?? 0, lowerLevel: fa?.below_grade ?? 0, baths: fa?.baths ?? 0,
      garage: fa?.garage ?? 0, sewer: fa?.sewer ?? 0, lot: fa?.lot ?? 0,
      time: fa?.time ?? 0, age: fa?.age ?? 0, road: fa?.road ?? 0, condition: (fa as { condition?: number } | undefined)?.condition ?? 0,
      location: (fa as { location?: number } | undefined)?.location ?? 0, adjusted: c.size_adjusted_price,
      lowerLevelSqft: fa?.comp_below_grade_sqft ?? null, lowerLevelEstimated: !!fa?.comp_below_grade_estimated,
      weightPct: Math.round((c.normalized_weight || 0) * 100), notes: fa?.notes || [],
      weightExact: (c.normalized_weight || 0) * 100,
      grossPct: (c as { gross_adjustment_pct?: number | null }).gross_adjustment_pct ?? null,
    }
  }).sort((a, b) => b.weightPct - a.weightPct)
  const anchorValue = Math.round(anchor.anchor_value)
  const otherAdjustments = Math.round(trace?.adjustment_total ?? 0)
  const preExposure = Math.round(trace?.fmv_pre_exposure ?? (anchorValue + otherAdjustments))
  const formulaValue = Math.round(trace?.v10_formula_fmv ?? preExposure)
  // The report's own value comes last: a nudge from homes now under contract runs after final_fmv
  // (4913 Chancellor St, 10/23: panel said $400,000, report $392,000).
  const finalValue = estimate?.value ?? trace?.final_fmv ?? null
  const nudgedFrom = trace?.pending_competition?.nudged_from ?? null
  const passValue = nudgedFrom ?? finalValue
  const steps: CmaAdjustmentGridStep[] = [
    { label: 'Weighted average of the adjusted sales', value: anchorValue },
  ]
  if (otherAdjustments) steps.push({ label: 'Location / condition adjustments', amount: otherAdjustments })
  if (otherAdjustments) steps.push({ label: 'What the comparable sales support', value: preExposure })
  if (Math.abs(formulaValue - preExposure) > 500) {
    steps.push({
      label: 'Asking-price ceiling', amount: formulaValue - preExposure,
      note: 'Listed a normal length of time with no accepted offer, so the formula holds the value at the asking price until a sale above it is evidenced.',
    })
    steps.push({ label: 'Formula value', value: formulaValue })
  }
  if (passValue && Math.abs(passValue - formulaValue) > 500) {
    const apc = trace?.asking_price_check
    steps.push({
      // Named for what it is when the home has sat longer than its comps (10/20 review: "show the
      // market-time discount as an explicit, labeled step").
      label: apc?.passed_over ? 'Market-time trim (listed longer than its comps took to sell)' : 'Final valuation pass',
      amount: passValue - formulaValue,
      note: apc?.asking_price && apc?.ratio_used && !apc?.buyer_report
        ? `Weighs condition, location and how homes here sell against asking (about ${Math.round(apc.ratio_used * 100)}% of asking), kept within ${formatMoney(apc.allowed_low_price ?? null)}–${formatMoney(apc.allowed_high_price ?? null)} of what this home's ${formatMoney(apc.asking_price)} asking price implies.`
        : 'Weighs condition, location and market tempo beyond what the adjusted sales capture.',
    })
  }
  if (nudgedFrom && finalValue && Math.abs(finalValue - nudgedFrom) > 500) {
    const pendings = (trace?.pending_competition?.pendings_used || []).map(p => p.street_address).filter(Boolean)
    steps.push({
      label: 'Similar homes now under contract', amount: finalValue - nudgedFrom,
      note: `Close matches that just went under contract${pendings.length ? ` (${pendings.join(', ')})` : ''} nudge the value a little, capped at 2.5%.`,
    })
  }
  steps.push({ label: 'Estimated fair market value', value: finalValue ?? formulaValue, bold: true })
  // The backend's value bridge (10/24) is the one source for these steps when present - the client PDF
  // prints the same lines, so the agent panel and the report can't disagree.
  const bridge = estimate?.value_bridge
  if (bridge?.steps) {
    steps.splice(0, steps.length,
      { label: 'Weighted average of the adjusted sales', value: bridge.adjusted_sales_value },
      ...bridge.steps.map(s => ({ label: s.label, amount: s.amount, note: s.basis })),
      { label: 'Estimated fair market value', value: bridge.final_value, bold: true })
  }
  const fa0 =rows.find(c => c.feature_adjustments)?.feature_adjustments as { size_rate_psf?: number, below_grade_rate_psf?: number, market_psf?: number } | undefined
  return {
    comps, hasSewer: comps.some(c => c.sewer), marketPsf: fa0?.market_psf ?? null,
    rates: { size: fa0?.size_rate_psf ?? null, lowerLevel: fa0?.below_grade_rate_psf ?? null },
    steps, finalValue, uncertainties: anchor.main_uncertainties || [],
  }
}
// Baths the way the record has them (grader audit 11/14: "3 baths" for a home with 2 full and 2 half read as
// three bathrooms). The total counts each half bath as half; when the record has both counts, show both.
type BathHome = { baths?: number | null; full_baths?: number | null; half_baths?: number | null }
export function bathsText(h: BathHome): string {
  if (h.full_baths != null && h.half_baths) return `${h.full_baths} full, ${h.half_baths} half`
  return h.baths != null ? String(h.baths) : '—'
}
export function bathsTile(h: BathHome): { label: string; value: string } | null {
  if (h.baths == null && h.full_baths == null) return null
  if (h.full_baths != null && h.half_baths) return { label: 'Full + Half Baths', value: `${h.full_baths} + ${h.half_baths}` }
  return { label: 'Baths', value: String(h.baths ?? h.full_baths) }
}

// One line per sale for the client report (grader audit 11/14: "the PDFs do not expose the per-comparable
// adjustments and weightings behind the adjusted-sales figure"): what it sold for, the net adjustment with its
// biggest reasons, the adjusted price and its share. Share x adjusted price adds up to the adjusted-sales figure.
// The full line-by-line worksheet stays in the agent's "How we got there".
// (Outside audit 11/14, after the table first shipped: it listed only each sale's three biggest adjustments, so
// in all ten rows reviewed the listed factors did not add up to the "adjusted by" figure - off by up to $22,000 -
// and a garage line showed on one sale and not on four others that had one. The engine's own lines add up to the
// dollar. Now EVERY line is listed, each to the nearest $100, "adjusted by" is their sum and "adjusted price" is
// the sale price plus that sum - so the row adds up as printed. The share is shown to a tenth of a percent, with
// how much adjusting the sale needed, which is what sets it.)
export interface CmaSaleSummaryRow {
  address: string; sale: number; net: number; reasons: string; adjusted: number; weightPct: number
  share: number          // % of the adjusted-sales figure, one decimal
  shareExact?: number    // ...unrounded, for the "without this sale" figure
  grossPct: number | null // all adjustments added up regardless of sign, as % of the sale price
}
// How much the adjusted-sales figure rests on any ONE sale (outside audit 11/14, v2: 1624 Brown St - adjusted
// to $798,000 while the other four sat between $536,000 and $654,000 - carried 16.5%, and without it the figure
// was about $578,000, not $614,000). Tested on past sales, cutting such a sale's share did not make values more
// accurate, so the share stays; the report says plainly what the figure would be without that sale.
export interface CmaSaleSensitivity { address: string; without: number; others: number; pct: number }
export function saleSensitivity(rows: CmaSaleSummaryRow[], minPct = 3): CmaSaleSensitivity | null {
  if (rows.length < 3) return null
  const w = rows.map(r => r.shareExact ?? r.share)
  const total = w.reduce((t, x) => t + x, 0)
  if (!total) return null
  const sum = rows.reduce((t, r, i) => t + w[i] * r.adjusted, 0)
  const all = sum / total
  let best: CmaSaleSensitivity | null = null
  rows.forEach((r, i) => {
    if (total - w[i] <= 0) return
    const without = (sum - w[i] * r.adjusted) / (total - w[i])
    const pct = (without - all) / all * 100
    if (Math.abs(pct) >= minPct && (!best || Math.abs(pct) > Math.abs(best.pct))) {
      best = { address: r.address, without: Math.round(without / 1000) * 1000, others: rows.length - 1, pct: Math.round(pct * 10) / 10 }
    }
  })
  return best
}

export function buildSaleSummary(estimate?: CmaAiEstimate | null): { rows: CmaSaleSummaryRow[]; adjustedSales: number | null; sensitivity: CmaSaleSensitivity | null } | null {
  const grid = buildAdjustmentGrid(estimate)
  if (!grid || !grid.comps.length) return null
  const to100 = (v: number) => Math.round((v || 0) / 100) * 100
  const rows = grid.comps.filter(c => c.weightPct > 0 && c.sale && c.adjusted).map(c => {
    const parts: [string, number][] = ([
      ['size', c.size], ['lower level', c.lowerLevel], ['baths', c.baths], ['garage', c.garage], ['land', c.lot],
      ['time since sale', c.time], ['age', c.age], ['condition', c.condition], ['location', c.location],
      ['sewer', c.sewer], ['road', c.road],
    ] as [string, number][]).map(([k, v]) => [k, to100(v)] as [string, number]).filter(([, v]) => v !== 0)
    // anything the engine adjusted for that has no line of its own above
    const other = to100((c.adjusted - c.sale) - parts.reduce((t, [, v]) => t + v, 0))
    if (Math.abs(other) >= 500) parts.push(['other', other])
    const net = parts.reduce((t, [, v]) => t + v, 0)
    const reasons = parts.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([k, v]) => `${k} ${formatSignedMoney(v)}`).join(' · ')
    const titled = (c.address || c.label).toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase())
    return { address: titled, sale: c.sale, net, reasons, adjusted: c.sale + net, weightPct: c.weightPct,
             share: Math.round((c.weightExact ?? c.weightPct) * 10) / 10, shareExact: c.weightExact ?? c.weightPct,
             grossPct: c.grossPct ?? null }
  })
  if (!rows.length) return null
  return { rows, adjustedSales: estimate?.value_bridge?.adjusted_sales_value ?? estimate?.valuation_trace?.anchor?.anchor_value ?? null,
           sensitivity: saleSensitivity(rows) }
}

export function formatSignedMoney(v: number): string {
  if (!v) return '—'
  return `${v > 0 ? '+' : '−'}${formatMoney(Math.abs(v))}`
}

// ---- 3-tier valuation classification -----------------------------------------------------
// Only three labels are ever shown: Strong / Supporting / Weaker.
//   strong     - close, reliable local sale the value leans on (weight 1.0)
//   supporting - a real comp with real differences, moderate weight (0.5)
//   weak       - a genuine sale but a poor match - SHOWN on the page, but ZERO weight in the number
// 'primary' / 'context' / 'excluded' are legacy values from an earlier 5-tier scheme still in
// old saved reports - normalizeStrength() folds them in (primary->strong, context/excluded->weak).
export type CompCategory = 'strong' | 'supporting' | 'weak'
export function normalizeStrength(s?: string | null): CompCategory | null {
  if (!s) return null
  if (s === 'primary') return 'strong'
  if (s === 'context' || s === 'excluded') return 'weak'
  if (s === 'strong' || s === 'supporting' || s === 'weak') return s
  return 'supporting'
}
export function clientCompStrength(c: CmaComparable): CompCategory | null {
  if (c.valuation_role === 'context_only' || c.valuation_weight === 0) return 'weak'
  return normalizeStrength(c.strength)
}
export const COMP_WEIGHT: Record<string, number> = {
  strong: 1.0, supporting: 0.5, weak: 0,
  primary: 1.0, context: 0, excluded: 0, // legacy
}
export function compWeight(c: CmaComparable): number {
  if (!isPriceVerified(c) || effectiveCompPrice(c) == null) return 0
  if (c.valuation_weight != null) return Math.max(0, c.valuation_weight)
  return COMP_WEIGHT[normalizeStrength(c.strength) ?? 'supporting'] ?? 0.5
}

// Comps that actually drive the value: included, Strong/Supporting, with a usable (verified,
// for sold) price. Weaker + unverified are filtered out of every aggregate.
export function valuationComps(comparables: CmaComparable[]): CmaComparable[] {
  return includedComparables(comparables).filter(c => compWeight(c) > 0)
}

// At least this many usable Strong/Supporting comps to publish aggregate statistics or claim
// more than Low confidence (keeps misleading stats suppressed when comp quality is thin).
// Mirrors the backend consistency pass in cma_ai_service.py.
export function hasEnoughValuationComps(comparables: CmaComparable[]): boolean {
  return valuationComps(comparables).length >= 2
}

// The comps that drive the suggested value range - Strong/Supporting with a usable price, else
// (nothing classified yet) every included comp with a usable price.
export function strongComps(comparables: CmaComparable[]): CmaComparable[] {
  const pool = valuationComps(comparables)
  if (pool.length > 0) return pool
  return includedComparables(comparables).filter(c => effectiveCompPrice(c) != null)
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

export interface CmaMarketMetrics {
  count: number            // valuation comps only (not context / excluded / unverified)
  totalShown: number       // every included comp, for "N of M used" copy
  enoughForStats: boolean
  saleMin: number | null
  saleMax: number | null
  saleAvg: number | null   // weighted by classification (primary > strong > supporting)
  saleMedian: number | null
  psfMin: number | null
  psfMax: number | null
  psfAvg: number | null    // weighted
  psfMedian: number | null
  // Label for the average, derived from the statistical method (never hard-coded "Avg").
  avgLabel: string         // "Weighted Avg" | "Avg"
  method: string | null
}

function weightedMean(pairs: [number, number][]): number | null {
  const w = pairs.reduce((s, [, wt]) => s + wt, 0)
  if (w <= 0) return null
  return pairs.reduce((s, [v, wt]) => s + v * wt, 0) / w
}

// Aggregate stats are computed ONLY from valuation comps (primary/strong/supporting with a
// verified price) and are weighted by classification - context / excluded / unverified comps
// never enter these numbers. `enoughForStats` is false when there aren't >=2 primary/strong
// verified local comps, in which case the report shows an explicit "insufficient comps" note
// instead of a misleading average.
export function computeMarketMetrics(comparables: CmaComparable[]): CmaMarketMetrics {
  const totalShown = includedComparables(comparables).length
  const pool = valuationComps(comparables)
  const enough = hasEnoughValuationComps(comparables)

  const priceRows: [number, number][] = pool
    .map(c => [effectiveCompPrice(c), compWeight(c)] as [number | null, number])
    .filter((r): r is [number, number] => r[0] != null && r[1] > 0)
  const psfRows: [number, number][] = pool
    // Same above-grade basis as every other $/sqft (psfBasisSqft) - total area here made a comp
    // with a finished basement read cheaper per foot than the subject on the same report (11/13).
    .map(c => [compPricePerSqft(c), compWeight(c)] as [number | null, number])
    .filter((r): r is [number, number] => r[0] != null && r[1] > 0)

  const prices = priceRows.map(r => r[0])
  const psf = psfRows.map(r => r[0])
  return {
    count: pool.length,
    totalShown,
    enoughForStats: enough,
    saleMin: prices.length ? Math.min(...prices) : null,
    saleMax: prices.length ? Math.max(...prices) : null,
    saleAvg: enough ? weightedMean(priceRows) : null,
    saleMedian: enough ? median(prices) : null,
    psfMin: psf.length ? Math.min(...psf) : null,
    psfMax: psf.length ? Math.max(...psf) : null,
    psfAvg: enough ? weightedMean(psfRows) : null,
    psfMedian: enough ? median(psf) : null,
    // computeMarketMetrics is always a classification-weighted mean.
    avgLabel: 'Weighted Avg',
    method: 'weighted mean (by classification)',
  }
}

function _avgLabelFromMethod(method?: string | null): string {
  return method && /weight/i.test(method) ? 'Weighted Avg' : 'Avg'
}

// The single entry point every surface (Studio Final Review, PDF Market Analysis, public report)
// must use for descriptive comp statistics. Prefers the backend's authoritative
// ai_estimate.comp_stats (computed once, server-side); computeMarketMetrics() is only the
// fallback for reports generated before comp_stats existed, or drafts with no AI run yet.
export function resolveCmaMarketMetrics(
  comparables: CmaComparable[],
  aiEstimate?: { comp_stats?: {
    count: number; total_shown: number; enough_for_stats: boolean;
    sale_min: number | null; sale_max: number | null; sale_weighted_avg: number | null; sale_median: number | null;
    psf_min: number | null; psf_max: number | null; psf_weighted_avg: number | null; psf_median: number | null;
    method?: string | null;
  } | null } | null,
): CmaMarketMetrics {
  const cs = aiEstimate?.comp_stats
  if (cs) {
    return {
      count: cs.count,
      totalShown: cs.total_shown,
      enoughForStats: cs.enough_for_stats,
      saleMin: cs.sale_min,
      saleMax: cs.sale_max,
      saleAvg: cs.sale_weighted_avg,
      saleMedian: cs.sale_median,
      psfMin: cs.psf_min,
      psfMax: cs.psf_max,
      psfAvg: cs.psf_weighted_avg,
      psfMedian: cs.psf_median,
      method: cs.method ?? null,
      avgLabel: _avgLabelFromMethod(cs.method),
    }
  }
  return computeMarketMetrics(comparables)
}

// Only three labels are shown. Legacy keys map onto them (primary -> Strong, context/excluded
// -> Weaker) so an old saved report still renders. Read via normalizeStrength() at call sites.
export const STRENGTH_LABEL: Record<string, string> = {
  strong: 'Strong Comp',
  supporting: 'Supporting Comp',
  weak: 'Weaker Comp',
  primary: 'Strong Comp',
  context: 'Weaker Comp',
  excluded: 'Weaker Comp',
}

// Solid fill applied only to a comp's ASSIGNED classification (no badge until one is picked).
// strong = green, supporting = gold, weak = red.
export const STRENGTH_STYLES: Record<string, string> = {
  strong: 'bg-emerald-600 text-white',
  supporting: 'bg-[#C9A24D] text-white',
  weak: 'bg-red-500 text-white dark:bg-red-600',
  primary: 'bg-emerald-600 text-white',
  context: 'bg-red-500 text-white dark:bg-red-600',
  excluded: 'bg-red-500 text-white dark:bg-red-600',
}

// Pastel counterpart to STRENGTH_STYLES for the report's chip. strong = green (best), supporting
// = gold, weak = red.
export const STRENGTH_SCALE_STYLES: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  supporting: 'bg-[#C9A24D]/20 text-[#8b7355] dark:bg-[#C9A24D]/20 dark:text-[#d7b974]',
  weak: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  primary: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  context: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  excluded: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// Explicit comp-vs-subject direction - "Below"/"Above" alone left the reader guessing which
// property was which. These read as a full clause with the row label: "Finish Quality — Comp
// Superior" (the comp is better than the subject on that dimension).
export const QUALITY_LABELS: Record<string, string> = {
  below: 'Comp Inferior',
  similar: 'Similar',
  above: 'Comp Superior',
  different_from_subject: 'Different Area',
  similar_to_subject: 'Similar Area',
  same_as_subject: 'Same Market',
  n_a: 'N/A',   // a condo's Lot - it has no lot of its own (grader, 10/21)
}

// Area's own tier ORDER (different_from_subject / same_as_subject / similar_to_subject) -
// deliberately not alphabetical or "least to most similar": same_as_subject sits in the middle
// exactly like "similar" does for the other quality dimensions below (an exact/near-exact match
// is the green center), with different_from_subject and similar_to_subject flanking it as the two
// "not an exact match" ends (both red) - a partial match isn't treated as meaningfully better than
// no match at all for area specifically, same as how below/above are both red regardless of
// direction.
export const AREA_TIERS = ['different_from_subject', 'same_as_subject', 'similar_to_subject'] as const

// Public-facing 3-tier color scheme for every quality dimension (finish/interior/exterior/lot/
// amenities/layout) PLUS area's own tiers above, sharing the identical red/green/red visual
// language: the point of a comp is that it resembles the subject, so the center tier (an
// exact/near-exact match) is green, and either flanking tier is red, since both represent a real
// difference that makes the comp a weaker match.
// Comp Superior / Comp Inferior are amber, not red (10/20): a client read a red "COMP SUPERIOR"
// as a negative about their home. Either direction is a difference the value adjusts for, not a flaw.
export const QUALITY_TIER_STYLES: Record<string, string> = {
  below: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  similar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  above: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  different_from_subject: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  same_as_subject: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  // Similar Area is a near match (same schools, nearby town), not a negative - amber, not red (10/20).
  similar_to_subject: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

// Agent-side (studio) version of the same 3-tier scale - deliberately more saturated than the
// public QUALITY_TIER_STYLES pastels so the agent can scan a busy editor at a glance.
export const AGENT_QUALITY_TIER_STYLES: Record<string, string> = {
  below: 'bg-red-500 text-white dark:bg-red-600',
  similar: 'bg-emerald-500 text-white dark:bg-emerald-600',
  above: 'bg-red-500 text-white dark:bg-red-600',
  different_from_subject: 'bg-red-500 text-white dark:bg-red-600',
  same_as_subject: 'bg-emerald-500 text-white dark:bg-emerald-600',
  similar_to_subject: 'bg-amber-500 text-white dark:bg-amber-600',
}

// Same 3-tier semantics as QUALITY_TIER_STYLES above, as hex - @react-pdf/renderer can't read
// Tailwind classes (same reason COMP_STATUS_HEX exists alongside COMP_STATUS_BADGE_STYLE).
export const QUALITY_TIER_HEX: Record<string, { bg: string; text: string }> = {
  below: { bg: '#FEF3C7', text: '#92400E' },
  similar: { bg: '#D1FAE5', text: '#047857' },
  above: { bg: '#FEF3C7', text: '#92400E' },
  different_from_subject: { bg: '#FEE2E2', text: '#B91C1C' },
  same_as_subject: { bg: '#D1FAE5', text: '#047857' },
  similar_to_subject: { bg: '#FEF3C7', text: '#92400E' },
}

// Hex twin of STRENGTH_SCALE_STYLES, for the PDF's Comp Weight row (its own independent
// weak/supporting/strong scale, separate from QUALITY_TIER_HEX - see STRENGTH_SCALE_STYLES).
export const STRENGTH_TIER_HEX: Record<string, { bg: string; text: string }> = {
  strong: { bg: '#D1FAE5', text: '#047857' },
  supporting: { bg: '#F3E7C9', text: '#8B7355' },
  weak: { bg: '#FEE2E2', text: '#B91C1C' },
  primary: { bg: '#D1FAE5', text: '#047857' },
  context: { bg: '#FEE2E2', text: '#B91C1C' },
  excluded: { bg: '#FEE2E2', text: '#B91C1C' },
}

export const COMP_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  active_under_contract: 'Active Under Contract',
  pending: 'Pending',
  sold: 'Sold',
}
export const COMP_STATUS_BADGE_STYLE: Record<string, string> = {
  active: 'bg-emerald-600',
  active_under_contract: 'bg-amber-500',
  pending: 'bg-amber-500',
  sold: 'bg-red-600',
}
// Same palette as COMP_STATUS_BADGE_STYLE but as hex, since @react-pdf/renderer doesn't read Tailwind classes.
export const COMP_STATUS_HEX: Record<string, string> = {
  active: '#059669',
  active_under_contract: '#F59E0B',
  pending: '#F59E0B',
  sold: '#DC2626',
}

export function sortComparables(comparables: CmaComparable[]): CmaComparable[] {
  return [...comparables].sort((a, b) => a.order_index - b.order_index)
}

// A static map image (not an interactive JS map) works identically in the browser and in the
// PDF (@react-pdf/renderer can only render <Image>, not a live map widget) - same
// staticmap.googleapis.com approach already used for the Open House Cheat Sheet PDF.
export function buildCmaStaticMapUrl(
  subject: { latitude?: number | null; longitude?: number | null },
  comparables: CmaComparable[],
  size: string = '640x360',
  // Report id or share slug: the server draws the map with its own Google key (/api/cma/map, 11/01) - the
  // browser key failing (no billing on its project, live 11/01) left a gray box on the PDF's map page.
  mapRef?: string | null,
): string | null {
  if (subject.latitude == null || subject.longitude == null) return null
  if (mapRef) {
    const pins = [`S:${subject.latitude},${subject.longitude}`]
    sortComparables(comparables).forEach((c, i) => {
      if (c.latitude == null || c.longitude == null) return
      pins.push(`${String(i + 1).slice(0, 1)}:${c.latitude},${c.longitude}`)
    })
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cma/map/${encodeURIComponent(mapRef)}.png?size=${size}&m=${encodeURIComponent(pins.join('|'))}`
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  if (!apiKey) return null
  const markers = [`color:0x111827|label:S|${subject.latitude},${subject.longitude}`]
  sortComparables(comparables).forEach((c, i) => {
    if (c.latitude == null || c.longitude == null) return
    const label = String(i + 1).slice(0, 1) // static maps labels are single-character
    markers.push(`color:0xC9A24D|label:${label}|${c.latitude},${c.longitude}`)
  })
  const markerParams = markers.map(m => `markers=${encodeURIComponent(m)}`).join('&')
  return `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap&${markerParams}&key=${apiKey}`
}

// A single-property map, zoomed in tight enough to actually read the street layout (cul-de-sac,
// corner lot, highway frontage) instead of the wide subject-vs-comp overview above. Explicit
// center+zoom rather than an auto-fit marker bounds, since a lone marker's auto-fit zoom is too
// far out to tell any of that apart.
export function buildCompLocationMapUrl(
  comp: { latitude?: number | null; longitude?: number | null },
  size: string = '700x320',
  zoom: number = 17,
  // Report id or share slug: the server draws it once and keeps it (11/09) - straight from Google in
  // the browser, every view of every comp was a billed map picture.
  mapRef?: string | null,
): string | null {
  if (mapRef && comp.latitude != null && comp.longitude != null) {
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/cma/map/${encodeURIComponent(mapRef)}.png?size=${size}&z=${zoom}&m=${encodeURIComponent(`C:${comp.latitude},${comp.longitude}`)}`
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  if (!apiKey || comp.latitude == null || comp.longitude == null) return null
  const center = `${comp.latitude},${comp.longitude}`
  const marker = `color:0xC9A24D|${center}`
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=${encodeURIComponent(marker)}&key=${apiKey}`
}

// The three buyer offer figures shown to a client (PDF + public page). The backend's deterministic
// offer contract wins (its numbers are what the QA'd offer prose quotes); the legacy pricing
// fields only cover old reports. A subject that has already SOLD gets no offer figures at all -
// the prose already says no live offer strategy applies, and $ "Suggested Offer" tiles next to
// that sentence contradicted it (seen 10/19 on a mirror-active listing that had closed).
// The three offer tiles' labels - an auction gets bidding words, since its list price is the opening bid
// and "Suggested Offer Min" next to an auction read as an offer under list (grader 11/01).
export function buyerOfferLabels(pricing: CmaPricing): { min: string; max: string; strong: string } {
  return pricing.ai_estimate?.auction_listing
    ? { min: 'Opening Bid', max: 'Comfortable Bid', strong: 'Top Bid (Your Limit)' }
    : { min: 'Suggested Offer Min', max: 'Suggested Offer Max', strong: 'Strong Offer' }
}

export function buyerOfferFigures(pricing: CmaPricing): { min: number | null; max: number | null; strong: number | null } {
  const est = pricing.ai_estimate
  if (est?.status?.is_closed) return { min: null, max: null, strong: null }
  const f = est?.offer_strategy_fields
  return {
    min: f?.opening_offer_low ?? pricing.suggested_offer_min ?? null,
    max: f?.opening_offer_high ?? pricing.suggested_offer_max ?? null,
    strong: f?.strong_offer ?? pricing.strong_offer ?? null,
  }
}

// ---- Current competition (grader, 10/21) -----------------------------------------------------------
// Similar homes for sale / under contract now. Same data for both report types; buyer and seller get
// different titles, order and callouts. List prices, not closed sales - never in the sold comp grid or
// the sold charts.
export interface CmaCompetitionHome {
  listing_key: string
  status: 'active' | 'pending'
  street_address?: string | null
  city?: string | null
  photo_url?: string | null
  list_price?: number | null
  price_per_sqft?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  days_on_market?: number | null
  distance_miles?: number | null
  match_score?: number | null
  price_cuts?: { count: number; total: number; first_price?: number | null; last_cut_at?: string | null } | null
  // details sheet (10/23) - reports made before then have photo_url only
  photos?: string[] | null
  state?: string | null
  zipcode?: string | null
  year_built?: number | null
  lot_size?: number | null
  latitude?: number | null
  longitude?: number | null
  below_grade_finished_area?: number | null
  garage?: string | null
  basement?: string | null
  water_source?: string | null
  sewer?: string | null
  school_district?: string | null
  annual_taxes?: number | null
  public_remarks?: string | null
  monthly_fee?: number | null   // condo / HOA fee per month, when the MLS record has one
}

// Total finished area - above and below grade together. The competition page compares $/sq ft on THIS size for
// every home (outside audit 11/14, 196 Hudson Dr: the subject's record splits 1,530 above grade from a 370 sq ft
// walkout level, while the same builder's homes two doors down report all 2,170 as above grade - "$324/sq ft
// against $245" compared a part of one home with the whole of another, under a banner saying it was "priced above
// most similar options per square foot").
export function totalFinishedSqft(h: { sqft?: number | null; above_grade_finished_area?: number | null; below_grade_finished_area?: number | null }): number | null {
  const above = h.above_grade_finished_area || 0
  const below = h.below_grade_finished_area || 0
  if (above) return Math.max(above + below, h.sqft || 0)
  return (h.sqft || 0) + (below && h.sqft ? 0 : below) || null
}

/** A Similar Homes card in the shape the comp details sheets read - list price, no sale. */
export function competitionHomeAsComparable(h: CmaCompetitionHome): CmaComparable {
  return {
    ...h, id: `competition-${h.listing_key}`, sale_price: null, sale_date: null,
    photos: h.photos && h.photos.length ? h.photos : (h.photo_url ? [h.photo_url] : []),
  } as unknown as CmaComparable
}

export interface CmaCompetitionCard extends CmaCompetitionHome {
  statusLabel: string
  highlight: string | null
  cutText: string | null
}

export interface CmaCompetitionGroup { key: 'active' | 'pending'; title: string; subtitle: string; cards: CmaCompetitionCard[] }

export interface CmaCompetitionView {
  /** this home's size and $/sq ft on the page's one basis (total finished area) */
  subject: { sqft: number | null; psf: number | null; priceLabel: string }
  sizeNote: string
  title: string
  subtitle: string
  note: string
  cards: CmaCompetitionCard[]
  /** For sale now, then under contract (user, 10/21: one list mixing both read as all buyable) */
  groups: CmaCompetitionGroup[]
  callouts: string[]
  empty: string
}

const k$ = (n: number) => `$${Math.round(Math.abs(n) / 1000).toLocaleString('en-US')}K`

export function cmaCompetitionView(report: CmaReport): CmaCompetitionView | null {
  const comp = (report.pricing?.ai_estimate as { current_competition?: { homes?: CmaCompetitionHome[] } } | null | undefined)?.current_competition
  if (!comp) return null
  const homes = (comp.homes || []).filter(h => h.list_price)
  const buyer = report.mode === 'buyer'
  const subject = report.subject || ({} as CmaReport['subject'])
  const subjAg = totalFinishedSqft(subject)
  const ourPrice = buyer
    ? (subject.list_price ?? null)
    : (report.pricing?.ai_estimate?.final_valuation?.value ?? report.pricing?.most_likely_value ?? report.pricing?.ai_estimate?.value ?? null)
  const ourPsf = ourPrice && subjAg ? ourPrice / subjAg : null
  const sellerAuction = !buyer && !!report.pricing?.ai_estimate?.auction_listing
  const cutText = (h: CmaCompetitionHome) => h.price_cuts && h.price_cuts.count > 0
    ? `Price cut ${k$(h.price_cuts.total)}${h.price_cuts.count > 1 ? ` (${h.price_cuts.count} cuts)` : ''}`
    : null
  const cards: CmaCompetitionCard[] = homes.map(h0 => {
    // a listing row's `sqft` is its above-grade area; its finished lower level is carried beside it
    const total = (h0.sqft || 0) + (h0.below_grade_finished_area || 0) || null
    const h = { ...h0, sqft: total, price_per_sqft: h0.list_price && total ? Math.round(h0.list_price / total) : h0.price_per_sqft }
    const diff = ourPrice && h.list_price ? h.list_price - ourPrice : null
    let highlight: string | null = null
    if (diff != null && Math.abs(diff) >= 1000) {
      highlight = buyer
        ? `${k$(diff)} ${diff < 0 ? 'less' : 'more'} than this home`
        : `${k$(diff)} ${diff < 0 ? 'below' : 'above'} our suggested price`
    }
    if (!buyer && ourPsf && h.price_per_sqft) {
      highlight = `${highlight ? highlight + ' · ' : ''}$${h.price_per_sqft}/sq ft vs our $${Math.round(ourPsf)}`
    }
    return {
      ...h,
      statusLabel: h.status === 'pending' ? (buyer ? 'Recently went under contract' : 'Under contract') : 'For sale',
      highlight,
      cutText: cutText(h),
    }
  })
  // Buyer: best value first (lowest $/sq ft among the strong matches). Seller: closest competitors first.
  if (buyer) {
    cards.sort((a, b) => {
      const sa = (a.match_score || 0) >= 60 ? 0 : 1, sb = (b.match_score || 0) >= 60 ? 0 : 1
      return sa - sb || (a.price_per_sqft || 1e9) - (b.price_per_sqft || 1e9)
    })
  } else {
    cards.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
  }
  const actives = cards.filter(c => c.status === 'active')
  const pendings = cards.filter(c => c.status === 'pending')
  const callouts: string[] = []
  // Under contract already: the market just accepted its price - "priced above most options, offer below
  // asking" contradicts that (102 Steeplewood Dr, under contract in 8 days - grader 10/23).
  const underContract = /under contract|pending|contingent/i.test(String(report.subject?.mls_status || ''))
  if (buyer && underContract) {
    const d = report.subject?.days_on_market
    // "quickly" only when it was (grader audit 11/14: said of a home that took 42 days and price cuts to go under
    // contract). What a buyer agreed to pay isn't public until it closes - say that instead of guessing.
    callouts.push(d != null && d <= 14
      ? `This home went under contract after ${d} days on the market - a buyer agreed to its price quickly, so a backup offer needs to be close to it.`
      : `This home is already under contract${d != null ? ` after ${d} days on the market` : ''}. The price the buyer agreed to isn't public until it closes, so a backup offer only matters if that contract falls through.`)
  } else if (buyer && report.pricing?.ai_estimate?.auction_listing) {
    // An auction has no asking price to negotiate from - its list price is the opening bid (11/01)
    callouts.push('This home is being sold at auction - its list price is the opening bid, so compare these homes with your top bid, not with that number.')
  } else if (buyer) {
    const pricier = ourPsf ? actives.filter(a => a.price_per_sqft && ourPsf > a.price_per_sqft).length : 0
    if (actives.length >= 2 && pricier > actives.length / 2) {
      // Offer advice only when the report's own value agrees - 8084 Goshen Rd was "underpriced" on the
      // offer page while this line said to offer below asking (rule audit 10/24).
      const fmv = report.pricing?.ai_estimate?.value ?? null
      const ask = report.subject?.list_price ?? null
      callouts.push(fmv && ask && fmv < ask * 0.99
        ? 'This home is priced above most similar options per square foot - supports offering below asking.'
        : 'This home is priced above most similar options per square foot.')
    }
    const fast = pendings.map(p => p.days_on_market).filter((d): d is number => d != null).sort((a, b) => a - b)
    const ourDom = report.subject?.days_on_market ?? null
    const fastMid = fast.length ? fast[Math.floor(fast.length / 2)] : null
    // This home sat while the others went fast: say both, never "be ready to move" beside an offer
    // page that says it isn't drawing the same competition (417 Dogwood Ln V19, 10/23).
    const passedOver = !!report.pricing?.ai_estimate?.valuation_trace?.asking_price_check?.passed_over
    if (pendings.length >= 2 && fastMid != null && fastMid <= 14 && (passedOver || (ourDom != null && ourDom > Math.max(21, fastMid * 2)))) {
      callouts.push('Similar homes are going under contract quickly, but this one has been listed longer - there may be room to negotiate.')
    } else if (pendings.length >= 2 && fastMid != null && fastMid <= 14) {
      callouts.push('Similar homes are selling quickly - be ready to move.')
    }
  } else {
    // The seller's page compares OUR SUGGESTED PRICE with the competition - and has to say so: beside a card that
    // shows the home's own list price it read as a claim about that price (outside audit 11/14, 101 Sues Way: a
    // $500,000 auction opening bid, a $515,000 competitor, and "Priced above all current competition").
    if (sellerAuction) {
      callouts.push('This home is being sold at auction - the price shown for it is the opening bid, not an asking price. These are the homes its bidders could buy instead.')
    }
    if (ourPrice && actives.length >= 1 && actives.every(a => (a.list_price || 0) < ourPrice)) {
      callouts.push(`Our suggested price of ${formatMoney(ourPrice)} is above every similar home for sale now - at that price expect a longer market time.`)
    }
    if (actives.some(a => (a.days_on_market || 0) >= 60 || (a.price_cuts?.count || 0) > 0)) {
      callouts.push('Some similar homes have sat 60+ days or cut their price - pricing right matters.')
    }
    // Contract prices aren't known until closing (grader 10/25) - these show demand, not a price.
    if (pendings.length) callouts.push('The homes under contract show current buyer interest at their asking prices - what they sell for isn\'t known until they close.')
  }
  const groups: CmaCompetitionGroup[] = [
    { key: 'active' as const, title: 'For sale now', subtitle: buyer ? 'Other homes like this one you could buy.' : 'The homes buyers will compare yours against.', cards: actives },
    { key: 'pending' as const, title: 'Under contract', subtitle: buyer ? 'Similar homes that just found a buyer. Their sale prices are not public until they close, so they are not comparable sales yet and do not change the value.' : 'Similar homes that just found a buyer (asking prices shown). Their sale prices are not public until they close, so they are not comparable sales yet and do not change the value.', cards: pendings },
  ].filter(g => g.cards.length > 0)
  const listPsf = subject.list_price && subjAg ? subject.list_price / subjAg : null
  return {
    subject: { sqft: subjAg, psf: listPsf, priceLabel: report.pricing?.ai_estimate?.auction_listing ? 'Opening bid (auction)' : 'List price' },
    sizeNote: 'Sizes and $/sq ft on this page use each home\'s total finished area (above and below grade together), so homes that record a lower level differently compare like for like.',
    title: buyer ? 'Similar Homes on the Market' : 'Your Competition',
    subtitle: buyer
      ? 'Homes like this one for sale now or recently under contract, with how closely each matches.'
      : 'Homes like yours for sale now or recently under contract, with how closely each matches.',
    note: 'List prices, not closed sales.',
    cards,
    groups,
    callouts,
    empty: 'No similar homes currently for sale or under contract.',
  }
}

// ---- Engine review sheet (TESTING ONLY - owner, 11/14) ------------------------------------------------------
// A last PDF section for the people grading reports while the engine is tested: what the engine did on THIS report,
// the checks it ran on its own output, and how it has scored against past sales. Never shown to a client of a
// real account unless the agent turns it on; to be removed at launch.
export interface CmaReviewCheck { label: string; ok: boolean | null; detail: string }
export interface CmaReviewSheet {
  checks: CmaReviewCheck[]
  rules: string[]
  agentNotes: string[]
  underContract: string[]
  /** the in-site grader's last read: null = it did not run on this report */
  finalRead: { fixed: string[]; forAgent: string[]; unverified: string[] } | null
  notes: string | null
}

/** How the adjusted-sales figure has scored against real sale prices the engine was not shown (free checks, no AI). */
export const CMA_ENGINE_TESTS: { group: string; sales: number; askingKnown: string; askingUnknown: string }[] = [
  { group: 'Houses - Main Line and Delaware County', sales: 60, askingKnown: '8.2%', askingUnknown: '12.6%' },
  { group: 'Townhouses and rowhomes', sales: 60, askingKnown: '7.8%', askingUnknown: '9.5%' },
  { group: 'Condos (mostly Philadelphia)', sales: 60, askingKnown: '6.5%', askingUnknown: '13.0%' },
  { group: 'Center-city Philadelphia homes with a garage', sales: 38, askingKnown: '8.7%', askingUnknown: '12.9%' },
  { group: 'Homes on 2 or more acres', sales: 60, askingKnown: '9.4%', askingUnknown: '13.8%' },
]
/** The step AFTER the adjusted sales, scored the same free way (11/14 night, after the outside audit asked whether
 *  the final step had ever been checked against past sales): the same 278 past sales, valued as of the day before
 *  each went under contract, with and without the asking-price rule a buyer report uses. No AI in it. */
export const CMA_LAST_STEP_TEST: { group: string; sales: number; before: string; after: string; closer: string }[] = [
  { group: 'All past sales', sales: 278, before: '8.2%', after: '5.7%', closer: '76 of the 85 it changed' },
  { group: 'The rule took 5% or more off the adjusted sales', sales: 56, before: '13.2%', after: '3.5%', closer: '52 of 56' },
  { group: 'On the market 30 days or more', sales: 96, before: '6.8%', after: '4.7%', closer: '35 of the 39 it changed' },
  { group: 'Sold for $1 million or more', sales: 50, before: '11.5%', after: '9.6%', closer: '9 of the 12 it changed' },
]
/** Not just the middle case (outside audit of round 6: "median error may conceal consequential outliers"). The same
 *  278 past sales, adjusted sales + the asking-price rule, buyer report. And the three measurable signs that pick out
 *  the reports most likely to be far off - counted free on those sales, 11/15. All three are about the SALES (owner,
 *  11/15: "it should be based on the comps' similarity score"); a lot of 2+ acres and a $1 million price were tried
 *  as signs first and taken out. They drive the agent-only evidence label (backend _evidence_strength). */
export const CMA_MISS_SPREAD = 'Half of the 278 homes landed within 5.7% of the real sale price, three in four within 10.7%, nine in ten within 17.7% and nineteen in twenty within 23.2%. The worst miss was 31.4%. Forty-two homes (15%) were missed by more than 15%.'
export const CMA_WARNING_SIGNS: { group: string; sales: number; typical: string; over15: string }[] = [
  { group: 'None of the three signs (label: Strong)', sales: 97, typical: '3.5%', over15: '3%' },
  { group: 'One sign (label: Fair)', sales: 95, typical: '6.1%', over15: '18%' },
  { group: 'Two or more signs (label: Limited)', sales: 86, typical: '7.7%', over15: '26%' },
]
export const CMA_WARNING_SIGNS_NOTE = 'The three signs: the adjusted sales and the asking price are 10% or more apart; the sales needed large adjustments (15% or more of each sale price, weighted by share); the sales are not close matches (Match score under 80, weighted by share). The strongest single sign is the first. Sales that merely disagree with each other did NOT predict a miss, and neither the size of the lot nor the price of the home is used. With no asking price to check against, the sales and the adjustment table alone (no photos, no AI) landed within about 11% in the middle case - the full seller engine has not been measured yet. Every home here found a buyer the next day; homes that sat unsold are not in the test.'
/** Sold price against FINAL asking price by days on market - 217,037 MLS sales, Nov 2025 to Nov 2026. */
export const CMA_ASKING_STATS: { days: string; condoMedian: string; condoAbove: string; houseMedian: string; houseAbove: string }[] = [
  { days: '14 to 29', condoMedian: '98.7%', condoAbove: '13%', houseMedian: '100%', houseAbove: '22%' },
  { days: '30 to 44', condoMedian: '98.0%', condoAbove: '9%', houseMedian: '99.0%', houseAbove: '16%' },
  { days: '45 to 89', condoMedian: '98.0%', condoAbove: '8%', houseMedian: '98.6%', houseAbove: '14%' },
  { days: '90 or more', condoMedian: '97.3%', condoAbove: '7%', houseMedian: '98.1%', houseAbove: '12%' },
]
export const CMA_TESTED_NOT_ADOPTED: string[] = [
  'A larger garage credit in center-city Philadelphia (4% and 6% of price instead of 1.5%): less accurate on 28 past sales, so not adopted.',
  'Cutting the share of heavily adjusted sales further: no change in accuracy on 88 past sales, so not adopted. The report states how much the figure leans on one sale instead.',
  'Letting homes under contract move the value: removed. Their prices are asking prices and the effect could not be checked against past sales.',
  'A wider comp search for homes on acreage: less accurate, so not adopted.',
  'A sturdier average for the adjusted sales (a weighted median, a half-and-half blend, clamping or down-weighting sales far from the rest): none was closer to the real sale prices than the weighted average, so not adopted. The agent is told when one or two sales carry the figure.',
  'Trusting an MLS basement field that says Unfinished over listing text that says finished basement: it changed five of 120 past values, each slightly further from the real price, so not adopted. The comp write-up states the conflict instead.',
  'Taking the photo-based condition ratings out of the adjustment table (condition from the MLS field and listing words only, or no condition line): further from the real price on 15 and 16 of 25 past test homes, so not adopted. Counting a rating only when two of finish, interior and exterior agree: no real change (8 closer, 6 further), so not adopted.',
]
export const CMA_KNOWN_LIMITS: string[] = [
  'The MLS feed does not send original asking prices or cumulative days on market, so price cuts before a sale cannot be shown; "asking price" always means the final one.',
  'A contract price is not public until the sale closes. Homes under contract are shown with their asking prices and never change the value.',
  'Condition is read from listing photos and remarks. For a home that is not listed now, they are from its last listing, and the report says so.',
  'The condition adjustment uses fixed rates per rating step. Where renovated and unrenovated homes of the same plan sell very far apart (a condo tower), the adjusted-sales figure can run high or low; the asking-price step and the range carry that.',
  'A tax abatement or a very different monthly fee on a sale is stated in words. It has no dollar adjustment: nothing in the past sales measures one.',
]

export function buildReviewSheet(report: CmaReport): CmaReviewSheet | null {
  const est = report.pricing?.ai_estimate
  if (!est) return null
  const money = (n: number | null | undefined) => (n == null ? '-' : `$${Math.round(n).toLocaleString('en-US')}`)
  const checks: CmaReviewCheck[] = []
  const grid = buildAdjustmentGrid(est)
  const sales = buildSaleSummary(est)
  if (grid && sales) {
    let worst = 0
    grid.comps.filter(c => c.weightPct > 0 && c.sale && c.adjusted).forEach(c => {
      const sum = [c.size, c.lowerLevel, c.baths, c.garage, c.lot, c.time, c.age, c.condition, c.location, c.sewer, c.road].reduce((t, v) => t + (v || 0), 0)
      worst = Math.max(worst, Math.abs((c.adjusted - c.sale) - sum))
    })
    checks.push({ label: 'Every sale: its adjustment lines add up to its net adjustment', ok: worst <= 150, detail: `largest difference ${money(worst)}` })
    const shareTotal = sales.rows.reduce((t, r) => t + (r.shareExact ?? r.share), 0)
    checks.push({ label: 'The shares add up to 100%', ok: Math.abs(shareTotal - 100) <= 0.3, detail: `${shareTotal.toFixed(1)}%` })
    const weighted = shareTotal ? sales.rows.reduce((t, r) => t + (r.shareExact ?? r.share) * r.adjusted, 0) / shareTotal : 0
    if (sales.adjustedSales) {
      const gap = Math.abs(weighted - sales.adjustedSales) / sales.adjustedSales * 100
      checks.push({ label: 'Share times adjusted price, added up, is the adjusted-sales figure', ok: gap <= 0.5, detail: `${money(weighted)} against ${money(sales.adjustedSales)}` })
    }
    if (sales.sensitivity) {
      checks.push({ label: 'How much one sale matters', ok: null, detail: `without ${sales.sensitivity.address}: ${money(sales.sensitivity.without)} (${sales.sensitivity.pct > 0 ? '+' : ''}${sales.sensitivity.pct}%)` })
    }
  }
  const bridge = est.value_bridge
  if (bridge) {
    const total = bridge.adjusted_sales_value + bridge.steps.reduce((t, st) => t + st.amount, 0)
    checks.push({ label: 'Adjusted sales plus every step is the final value', ok: Math.abs(total - bridge.final_value) <= 1000, detail: `${money(bridge.adjusted_sales_value)} ${bridge.steps.map(st => `${st.amount >= 0 ? '+' : '-'} ${money(Math.abs(st.amount))}`).join(' ')} = ${money(total)}; value ${money(bridge.final_value)}` })
  }
  const value = est.value ?? null
  const lo = est.range_min ?? null, hi = est.range_max ?? null
  if (value != null && lo != null && hi != null) {
    checks.push({ label: 'The value sits inside its range', ok: value >= lo && value <= hi, detail: `${money(lo)} - ${money(value)} - ${money(hi)}` })
  }
  const comp = (est as { current_competition?: { nudge_pct?: number | null; nudged_from?: number | null; pendings_used?: { street_address?: string; list_price?: number; implied_value?: number; match_score?: number | null }[]; review?: string | null; fee_mismatch?: { street_address?: string; monthly_fee?: number; subject_monthly_fee?: number }[] } }).current_competition
  checks.push({ label: 'Homes under contract changed the value', ok: !(comp?.nudged_from), detail: comp?.nudged_from ? `yes, by ${comp.nudge_pct}% (a report made before 11/14)` : 'no - they never do' })
  const flags = (est.qa_flags || []).filter((f): f is string => typeof f === 'string')
  const fixed = flags.filter(f => /^Fact check:|auto-corrected|rewrote its client narrative|rebuilt from verified facts/i.test(f))
  checks.push({ label: 'Sentences the engine removed or rewrote after checking them against the records', ok: null, detail: String(fixed.length) })
  const fresh = (est as { data_freshness?: { message?: string | null } | null }).data_freshness
  checks.push({ label: 'MLS data was current when the report was made', ok: !fresh?.message, detail: fresh?.message ? fresh.message.replace(/^Review before sending:\s*/, '') : 'yes' })
  const rules = flags
    .filter(f => /^(Final value|Range widened|The value is|Market exposure|Subject listing status|Final valuation authority|Fact check: removed|Comps re-ordered|Estimate reused|Final valuation reused)/.test(f)
      || /already priced in the comp adjustment grid|tax abatement|monthly fee|lower level/i.test(f))
    .slice(0, 14)
    .map(f => (f.length > 300 ? `${f.slice(0, 297)}...` : f))
  const agentNotes = [
    // the agent-only evidence label (11/15) leads: it is the first thing the agent is told
    (est as { evidence_strength?: { message?: string | null } | null }).evidence_strength?.message,
    est.agent_review?.message,
    comp?.review,
    (est as { missed_sales?: { message?: string | null } | null }).missed_sales?.message,
    (est as { subject_status_review?: { message?: string | null } | null }).subject_status_review?.message,
    (est as { audience_review?: { message?: string | null } | null }).audience_review?.message,
    (est as { spread_review?: { message?: string | null } | null }).spread_review?.message,
  ].filter((x): x is string => !!x).map(x => x.replace(/^Review before sending:\s*/, ''))
  const underContract = [
    ...(comp?.pendings_used || []).map(p => `${p.street_address}${p.match_score != null ? ` (${Math.round(p.match_score)}% match)` : ''}: asking ${money(p.list_price)}, about ${money(p.implied_value)} adjusted to this home - shown, not used`),
    ...(comp?.fee_mismatch || []).map(f => `${f.street_address}: monthly fee ${money(f.monthly_fee)} against ${money(f.subject_monthly_fee)} here - not a like-for-like comparison`),
  ]
  const fa = (est as { final_audit?: { applied?: { where?: string; why?: string; action?: string }[]; for_agent?: { where?: string; why?: string }[]; unverified?: { where?: string; why?: string; sentence?: string }[] } | null }).final_audit
  const finalRead = fa ? {
    fixed: (fa.applied || []).map(a => `${a.action === 'replace' ? 'Reworded' : 'Removed'} a sentence in ${a.where}: ${a.why}`),
    forAgent: (fa.for_agent || []).map(a => `${a.where}: ${a.why}`),
    // details it could not find in its copy of the record - never applied, never shown to the agent
    unverified: (fa.unverified || []).map(a => `${a.where}: "${(a.sentence || '').slice(0, 110)}" - ${a.why}`),
  } : null
  return { checks, rules, agentNotes, underContract, finalRead, notes: report.presentation?.review_notes || null }
}

/** On for test accounts unless switched off; off for everyone else unless switched on. */
export function reviewSheetOn(report: CmaReport, agentEmail?: string | null): boolean {
  const set = report.presentation?.review_sheet
  if (set === true || set === false) return set
  return /@example\.com$/i.test(String(agentEmail || '').trim())
}

