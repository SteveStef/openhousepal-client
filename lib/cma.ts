import { CmaComparable, CmaPricing, CmaStatus } from '@/types'

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
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) return 'â€”'
  const acres = value / 43560
  const formatted = acres.toLocaleString('en-US', {
    minimumFractionDigits: acres < 0.1 ? 2 : 0,
    maximumFractionDigits: acres < 1 ? 2 : 1,
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
  const text = `${section.title} ${section.body}`.toLowerCase()
  return [
    'inspection', 'septic', 'well', 'utilities', 'water', 'sewer', 'roof', 'exterior',
    'stucco', 'structural', 'foundation', 'mechanical', 'systems', 'plumbing',
    'electrical', 'hvac', 'condition', 'infiltration', 'egress',
  ].some(keyword => text.includes(keyword))
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
    .map(c => [pricePerSqft(effectiveCompPrice(c), c.sqft), compWeight(c)] as [number | null, number])
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
export const QUALITY_TIER_STYLES: Record<string, string> = {
  below: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  similar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  above: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  different_from_subject: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  same_as_subject: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  similar_to_subject: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// Agent-side (studio) version of the same 3-tier scale - deliberately more saturated than the
// public QUALITY_TIER_STYLES pastels so the agent can scan a busy editor at a glance.
export const AGENT_QUALITY_TIER_STYLES: Record<string, string> = {
  below: 'bg-red-500 text-white dark:bg-red-600',
  similar: 'bg-emerald-500 text-white dark:bg-emerald-600',
  above: 'bg-red-500 text-white dark:bg-red-600',
  different_from_subject: 'bg-red-500 text-white dark:bg-red-600',
  same_as_subject: 'bg-emerald-500 text-white dark:bg-emerald-600',
  similar_to_subject: 'bg-red-500 text-white dark:bg-red-600',
}

// Same 3-tier semantics as QUALITY_TIER_STYLES above, as hex - @react-pdf/renderer can't read
// Tailwind classes (same reason COMP_STATUS_HEX exists alongside COMP_STATUS_BADGE_STYLE).
export const QUALITY_TIER_HEX: Record<string, { bg: string; text: string }> = {
  below: { bg: '#FEE2E2', text: '#B91C1C' },
  similar: { bg: '#D1FAE5', text: '#047857' },
  above: { bg: '#FEE2E2', text: '#B91C1C' },
  different_from_subject: { bg: '#FEE2E2', text: '#B91C1C' },
  same_as_subject: { bg: '#D1FAE5', text: '#047857' },
  similar_to_subject: { bg: '#FEE2E2', text: '#B91C1C' },
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
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  if (!apiKey || subject.latitude == null || subject.longitude == null) return null
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
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  if (!apiKey || comp.latitude == null || comp.longitude == null) return null
  const center = `${comp.latitude},${comp.longitude}`
  const marker = `color:0xC9A24D|${center}`
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=${encodeURIComponent(marker)}&key=${apiKey}`
}
