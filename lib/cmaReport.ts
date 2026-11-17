// ONE set of rules for what a CMA report shows (11/15, edit-on-the-report).
//
// The client page (components/cma/report/CmaReportView), the Review editor (the same component with edit
// hooks) and the PDF (lib/pdfs CmaPresentationDocument) all ask THIS file what to show: which sections and in
// what order, which comps, which photo leads, the wording and the numbers. Nothing else decides those - so an
// edit the agent makes on the report can never be on the page and missing from the PDF, or the other way round.
//
// Where an edit is kept:
//   wording, numbers, order, hidden parts, lead photos, the agent's own notes  -> report.presentation (never engine input)
//   a comp's note, its ratings, whether it is in the report, the comp order     -> report.comparables (as the Analysis step)
import {
  CmaComparable, CmaPresentationNote, CmaPresentationSettings, CmaPricing, CmaSubjectProperty,
} from '@/types'
import { normalizeImageUrl } from '@/lib/utils'
import {
  CmaGuidanceSection, CmaMarketMetrics, buyerOfferFigures, cmaGuidanceSections, computeMarketMetrics, formatMoney,
  formatMoneyRange, resolveCmaMarketMetrics, sortComparables, splitCmaBuyerGuidance,
} from '@/lib/cma'

/** What the rules need of a report - both the agent's CmaReport and the client's CmaPublicResponse fit. */
export interface CmaReportLike {
  mode: 'listing' | 'buyer'
  subject: CmaSubjectProperty
  comparables: CmaComparable[]
  pricing: CmaPricing
  presentation?: CmaPresentationSettings | null
}

// ---- Sections ---------------------------------------------------------------------------------------------

export type CmaSectionKey = 'subject' | 'location' | 'comparables' | 'comparison_table' | 'charts' | 'competition' | 'pricing'

export const CMA_SECTIONS: { key: CmaSectionKey; label: string }[] = [
  { key: 'subject', label: 'Subject Property' },
  { key: 'location', label: 'Location Context' },
  { key: 'comparables', label: 'Individual Comparables' },
  { key: 'comparison_table', label: 'Comparable Overview' },
  { key: 'charts', label: 'Market Analysis' },
  { key: 'competition', label: 'Current Competition' },
  { key: 'pricing', label: 'Agent Final Analysis' },
]
const SECTION_KEYS = CMA_SECTIONS.map(s => s.key) as string[]

/** Parts of the final analysis that can be switched off one by one (keys live in hidden_sections). */
export type CmaPricingPart = 'valuation_notes' | 'inspection' | 'offer' | 'pricing_strategy' | 'listing_prep'

export const noteKey = (id: string) => `note:${id}`
export const isNoteKey = (key: string) => key.startsWith('note:')

export function cmaNotes(report: CmaReportLike): CmaPresentationNote[] {
  return (report.presentation?.notes || []).filter(n => n && n.id)
}

/** A note with nothing in it is never shown to a client (the editor still shows it, to be typed into). */
export function cmaNoteHasContent(n: CmaPresentationNote): boolean {
  return !!((n.title || '').trim() || (n.body || '').trim())
}

/** Every section key in the order it shows. Standard sections that a saved order doesn't name fall in at
 *  their usual place; an agent's note that it doesn't name goes just before the final analysis. */
export function cmaSectionOrder(report: CmaReportLike): string[] {
  const p = report.presentation
  const noteKeys = cmaNotes(report).map(n => noteKey(n.id))
  const valid = new Set([...SECTION_KEYS, ...noteKeys])
  const out: string[] = []
  for (const k of p?.section_order || []) if (valid.has(k) && !out.includes(k)) out.push(k)
  SECTION_KEYS.forEach((k, i) => {
    if (out.includes(k)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const idx = out.indexOf(SECTION_KEYS[j])
      if (idx >= 0) { at = idx + 1; break }
    }
    // (keep any notes that directly follow that earlier section in front of the one falling in)
    out.splice(at, 0, k)
  })
  noteKeys.forEach(k => {
    if (out.includes(k)) return
    const at = out.indexOf('pricing')
    out.splice(at >= 0 ? at : out.length, 0, k)
  })
  return out
}

export function cmaIsHidden(report: CmaReportLike, key: string): boolean {
  return (report.presentation?.hidden_sections || []).includes(key)
}

// ---- Comps and photos ---------------------------------------------------------------------------------------

function withPhotoPick<T extends { photos?: string[] | null; photo_url?: string | null }>(home: T, pick?: string | null): T {
  if (!pick) return home
  // Compared in the form the page shows them (https, full address) - the pick is saved from the page.
  const want = normalizeImageUrl(pick)
  const all = [...(home.photos || []), home.photo_url].filter((p): p is string => !!p)
  const lead = all.find(p => normalizeImageUrl(p) === want)
  if (!lead) return home   // the photo is gone from the record: the pick no longer applies
  const rest = (home.photos || []).filter(p => normalizeImageUrl(p) !== want)
  return { ...home, photo_url: lead, photos: [lead, ...rest] }
}

/** The subject as shown: the agent's lead photo first. */
export function cmaShownSubject<T extends CmaReportLike>(report: T): T['subject'] {
  return withPhotoPick(report.subject, report.presentation?.photo_picks?.subject)
}

/** The comps a client sees, in order, each with the agent's lead photo first. Their position here is
 *  their number on the report ("Comp #2" = index 1). */
export function cmaShownComparables(report: CmaReportLike): CmaComparable[] {
  const hidden = new Set(report.presentation?.hidden_comp_ids || [])
  const picks = report.presentation?.photo_picks || {}
  return sortComparables(report.comparables || [])
    .filter(c => c.is_included && !hidden.has(c.id))
    .map(c => withPhotoPick(c, picks[c.id]))
}

/** Every comp for the editor (hidden and removed ones too), in order, lead photos applied. */
export function cmaEditorComparables(report: CmaReportLike): (CmaComparable & { _hidden: boolean; _removed: boolean })[] {
  const hidden = new Set(report.presentation?.hidden_comp_ids || [])
  const picks = report.presentation?.photo_picks || {}
  return sortComparables(report.comparables || [])
    .map(c => ({ ...withPhotoPick(c, picks[c.id]), _hidden: hidden.has(c.id), _removed: !c.is_included }))
}

/** True once the AI has written the report (owner, 11/16): from then on the comps are locked - none added, taken
 *  off, switched off or switched back on - so the write-up always names the homes it was written from. Different
 *  comps means a new CMA. The server enforces the same rule (cma_service.comps_locked). Each comp's ratings and
 *  its Comp Weight / classification lock with them (owner, 11/17: "the entire report is built around" them);
 *  notes, the order, the wording and the numbers stay editable. */
export function cmaCompsLocked(report: { ai_analysis?: unknown } | null | undefined): boolean {
  return !!report?.ai_analysis
}

type RatedComp = { id: string; quality?: object | null; strength?: string | null }
const ratingKey = (c: RatedComp) => JSON.stringify([
  Object.entries(c.quality || {}).filter(([, v]) => !!v).sort(([a], [b]) => a.localeCompare(b)),
  c.strength || null,
])
/** On a written report the ratings are the saved ones, full stop: a save that sends a different rating is refused
 *  (409) and everything else in that save - a note just typed - would go with it. So a screen holding its own copy
 *  of the comps takes each comp's `quality` and `strength` from the saved report wherever its copy differs (blank,
 *  missing and null count as the same, as on the server). Returns the SAME array when nothing differs. */
export function cmaAdoptSavedRatings<T extends RatedComp>(local: T[], saved: RatedComp[] | null | undefined): T[] {
  const byId = new Map((saved || []).map(c => [c.id, c]))
  let changed = false
  const next = local.map(c => {
    const s = byId.get(c.id)
    if (!s || ratingKey(c) === ratingKey(s)) return c
    changed = true
    return { ...c, quality: s.quality, strength: s.strength }
  })
  return changed ? next : local
}

// ---- "Comp #N" in the wording ---------------------------------------------------------------------------------
// The engine writes "Comp #4 (135 W 6TH ST)" using the comp numbers of the run. Once the agent hides, removes or
// re-orders a comp those numbers move - so every mention is re-numbered when it is shown (a comp no longer on the
// report is named by its address). The run's own numbering is kept in presentation.comp_numbering from just
// before the first such change (see cmaNumberingSnapshot); with no change it is simply the comps in order.

function generatedAt(report: CmaReportLike): string | null {
  return (report.pricing?.ai_estimate as { generated_at?: string | null } | null | undefined)?.generated_at ?? null
}

/** The comp ids in the order the report's wording numbers them. */
export function cmaEngineNumbering(report: CmaReportLike): string[] {
  const p = report.presentation
  if (p?.comp_numbering?.length && (p.comp_numbering_at ?? null) === generatedAt(report)) return p.comp_numbering
  return sortComparables(report.comparables || []).filter(c => c.is_included).map(c => c.id)
}

/** Presentation with the run's comp numbering kept, to save together with the first change to the comps.
 *  Returns the same object when it is already kept (or there is no analysis wording to protect). */
export function cmaNumberingSnapshot(report: CmaReportLike): CmaPresentationSettings {
  const p = (report.presentation || { hidden_sections: [], hidden_comp_ids: [] }) as CmaPresentationSettings
  if (!report.pricing?.ai_estimate) return p
  const at = generatedAt(report)
  if (p.comp_numbering?.length && (p.comp_numbering_at ?? null) === at) return p
  return { ...p, comp_numbering: sortComparables(report.comparables || []).filter(c => c.is_included).map(c => c.id), comp_numbering_at: at }
}

const titleCaseStreet = (s: string) => s.toLowerCase().replace(/\b([a-z])([a-z']*)/g, (_m, a: string, b: string) => a.toUpperCase() + b)
const normAddr = (s?: string | null) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

/** Re-numbers "Comp #N" mentions in engine-written text to the numbers the report shows now. */
export function cmaFixCompRefs(report: CmaReportLike, text: string): string {
  if (!text || !/comp/i.test(text)) return text
  const engine = cmaEngineNumbering(report)
  const shown = cmaShownComparables(report)
  const shownIndex = new Map(shown.map((c, i) => [c.id, i]))
  // Nothing moved: leave the wording exactly as written.
  if (engine.length === shown.length && engine.every((id, i) => shownIndex.get(id) === i)) return text
  const byId = new Map((report.comparables || []).map(c => [c.id, c]))
  const byAddr = new Map((report.comparables || []).map(c => [normAddr(c.street_address), c]))
  return text.replace(/\b(Comp(?:arable)?)(\s*)(#?)\s*(\d{1,2})\b(\s*\(([^()]{3,60})\))?/g, (whole, word: string, gap: string, hash: string, num: string, paren: string | undefined, addr: string | undefined) => {
    const comp = (addr && byAddr.get(normAddr(addr))) || byId.get(engine[Number(num) - 1] || '')
    if (!comp) return whole
    const now = shownIndex.get(comp.id)
    if (now == null) return comp.street_address ? titleCaseStreet(comp.street_address) : whole
    return `${word}${gap}${hash}${now + 1}${paren || ''}`
  })
}

// ---- Wording ------------------------------------------------------------------------------------------------

export type CmaTextKey =
  | 'valuation_notes' | 'inspection' | 'offer' | 'pricing_strategy' | 'listing_prep' | 'competition_commentary'
  | `title:${string}`

function estimate(report: CmaReportLike) { return report.pricing?.ai_estimate || null }

function buyerGuidance(report: CmaReportLike) {
  const pricing = report.pricing
  const est = estimate(report)
  return splitCmaBuyerGuidance({
    ...pricing,
    offer_strategy_commentary: stripBridgeSentences(est?.methodology_summary ?? pricing.offer_strategy_commentary),
    offer_suggestion_notes: est?.offer_strategy_considerations ?? pricing.offer_suggestion_notes,
  })
}

/** True when the agent has put their own wording in for this text. */
export function cmaTextEdited(report: CmaReportLike, key: CmaTextKey): boolean {
  return typeof report.presentation?.text?.[key] === 'string'
}

/** The report's own (unedited) wording for a text, as titled paragraphs. */
export function cmaDefaultSections(report: CmaReportLike, key: CmaTextKey): CmaGuidanceSection[] {
  const pricing = report.pricing
  const est = estimate(report)
  const buyer = report.mode === 'buyer'
  let sections: CmaGuidanceSection[] = []
  switch (key) {
    case 'valuation_notes':
      sections = cmaGuidanceSections(stripBridgeSentences(est?.methodology_summary ?? (buyer ? pricing.offer_strategy_commentary : pricing.pricing_commentary))); break
    case 'inspection':
      sections = buyer ? buyerGuidance(report).inspectionSections : []; break
    case 'offer':
      sections = buyer ? buyerGuidance(report).offerSections : []; break
    case 'pricing_strategy':
      sections = buyer ? [] : cmaGuidanceSections(pricing.listing_strategy_notes); break
    case 'listing_prep':
      sections = buyer ? [] : cmaGuidanceSections(pricing.listing_prep_notes); break
    case 'competition_commentary':
      sections = cmaGuidanceSections((est as { competition_commentary?: string | null } | null)?.competition_commentary); break
    default:
      sections = []
  }
  return sections.map(s => ({ title: s.title, body: cmaFixCompRefs(report, s.body) }))
}

// "How the value was reached: <steps>. Together: $X." / "Together, that gives $X." - the engine's own passage
// that walks from the sales to the value (cma_ai_service._bridge_client_text, sometimes lightly reworded by the
// final polish). The owner took the whole "From the Sales to the Value" page out of the report (11/16: "everyone
// will argue it"), and this passage is the same steps written as sentences - so it is left out wherever the
// report's wording shows: the client page, the Review editor and the PDF. Text without it is left alone.
export function stripBridgeSentences(text?: string | null): string | null | undefined {
  if (!text) return text
  // (a paragraph break around the passage stays a paragraph break)
  // (the wording pass sometimes bolds the lead-in - "**How the value was reached:**" - and the two stars in
  // front of it were left behind as a line of their own, 701 Great Oak Ln 11/14)
  const out = text.replace(/\s*\**How the value was reached:[\s\S]*?Together[^.$]{0,24}\$[\d,]+\.\**\s*/,
    (m) => (m.includes('\n') ? '\n\n' : ' '))
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** A text as shown: the agent's wording when they edited it, the report's own otherwise. */
export function cmaTextSections(report: CmaReportLike, key: CmaTextKey): CmaGuidanceSection[] {
  const own = report.presentation?.text?.[key]
  // (wording saved before 11/16 can still carry the engine's value-steps passage: it was part of the text the
  // agent started from)
  if (typeof own === 'string') return cmaGuidanceSections(stripBridgeSentences(own))
  return cmaDefaultSections(report, key)
}

/** Titled paragraphs -> the saved form ("**Title:** body" blocks, which cmaGuidanceSections reads back). */
export function cmaSectionsToText(sections: CmaGuidanceSection[]): string {
  return sections
    .map(s => ({ title: (s.title || '').trim(), body: (s.body || '').trim() }))
    .filter(s => s.title || s.body)
    .map(s => (s.title ? `**${s.title.replace(/[:*]+$/g, '')}:** ${s.body || '-'}` : s.body))
    .join('\n\n')
}

/** A one-line label (a section's title). `fallback` is what the report says when the agent hasn't changed it. */
export function cmaLabel(report: CmaReportLike, key: `title:${string}`, fallback: string): string {
  const own = report.presentation?.text?.[key]
  return typeof own === 'string' && own.trim() ? own.trim() : fallback
}

/** A comp's note as shown. The agent's own words are left alone; the AI's note has its comp numbers kept right. */
export function cmaCompNote(report: CmaReportLike, comp: CmaComparable): string {
  const own = (comp.commentary || '').trim()
  const ai = (comp.ai_commentary || '').trim()
  if (own && own !== ai) return own
  return cmaFixCompRefs(report, own || ai)
}

// ---- Numbers ------------------------------------------------------------------------------------------------

export type CmaFigureKey = 'value' | 'range_min' | 'range_max' | 'offer_min' | 'offer_max' | 'strong_offer' | 'most_likely_value' | 'recommended_list_price'

/** The pricing field a figure falls back to (and is saved in when the report has no analysis). */
export const CMA_FIGURE_FIELD: Record<CmaFigureKey, keyof CmaPricing> = {
  value: 'estimated_fair_value',
  range_min: 'recommended_min',
  range_max: 'recommended_max',
  offer_min: 'suggested_offer_min',
  offer_max: 'suggested_offer_max',
  strong_offer: 'strong_offer',
  most_likely_value: 'most_likely_value',
  recommended_list_price: 'recommended_list_price',
}

export function cmaDefaultFigure(report: CmaReportLike, key: CmaFigureKey): number | null {
  const pricing = report.pricing
  const est = estimate(report)
  const fv = est?.final_valuation
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)
  switch (key) {
    case 'value': return num(fv?.value) ?? num(est?.value) ?? num(pricing.estimated_fair_value)
    case 'range_min': return num(fv?.range_min) ?? num(est?.range_min) ?? num(pricing.recommended_min)
    case 'range_max': return num(fv?.range_max) ?? num(est?.range_max) ?? num(pricing.recommended_max)
    case 'offer_min': return num(buyerOfferFigures(pricing).min)
    case 'offer_max': return num(buyerOfferFigures(pricing).max)
    case 'strong_offer': return num(buyerOfferFigures(pricing).strong)
    case 'most_likely_value': return num(pricing.most_likely_value)
    case 'recommended_list_price': return num(pricing.recommended_list_price)
  }
}

export function cmaFigureEdited(report: CmaReportLike, key: CmaFigureKey): boolean {
  const f = report.presentation?.figures
  return !!f && Object.prototype.hasOwnProperty.call(f, key)
}

/** A number as shown: the agent's when they set one (null = they cleared it), the report's own otherwise. */
export function cmaFigure(report: CmaReportLike, key: CmaFigureKey): number | null {
  if (cmaFigureEdited(report, key)) {
    const v = report.presentation!.figures![key]
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : null
  }
  return cmaDefaultFigure(report, key)
}

/** The change to save when the agent sets a number. A report with an analysis keeps the agent's number beside
 *  the engine's (presentation.figures); one without has no engine number, so it goes in the pricing field. */
export function cmaFigurePatch(report: CmaReportLike, key: CmaFigureKey, value: number | null): { pricing?: CmaPricing; presentation?: CmaPresentationSettings } {
  if (!estimate(report)) return { pricing: { ...report.pricing, [CMA_FIGURE_FIELD[key]]: value } }
  const p = (report.presentation || { hidden_sections: [], hidden_comp_ids: [] }) as CmaPresentationSettings
  const figures = { ...(p.figures || {}) }
  if (value === cmaDefaultFigure(report, key)) delete figures[key]   // back to the report's own number
  else figures[key] = value
  return { presentation: { ...p, figures } }
}

/** The big number on the final analysis: one value for a buyer, a range for a seller. */
export function cmaHeadline(report: CmaReportLike): string {
  if (report.mode === 'buyer') return formatMoney(cmaFigure(report, 'value'))
  return formatMoneyRange(cmaFigure(report, 'range_min'), cmaFigure(report, 'range_max'))
}

// ---- Market numbers -----------------------------------------------------------------------------------------

/** The sales statistics for the comps shown. The engine's own figures while the comps are the ones it analysed;
 *  worked out from the comps on the page once the agent has hidden, removed or added one. */
export function cmaShownMetrics(report: CmaReportLike, shown: CmaComparable[] = cmaShownComparables(report)): CmaMarketMetrics {
  const engine = cmaEngineNumbering(report)
  const same = engine.length === shown.length && shown.every(c => engine.includes(c.id))
  return same ? resolveCmaMarketMetrics(shown, estimate(report)) : computeMarketMetrics(shown)
}

// ---- Association fees and listing history -----------------------------------------------------------------------
// Owner, 11/16: no "This home's record" box of its own - the HOA / condo fee is one more fact about each home, so
// it is a row in the table of every home's facts and a tile on the subject. Nothing in the value reads it.

export const CMA_FEE_LABEL = 'HOA / Condo Fee'
const monthlyFeeText = (v: number) => `${formatMoney(Math.round(v))}/mo`

/** The subject's association fees per month, added up (the MLS record read during the analysis). Null when it
 *  has none - or was never looked up. */
export function cmaSubjectMonthlyFee(report: CmaReportLike): number | null {
  const fees = estimate(report)?.property_record?.fees || []
  const total = fees.reduce((t, f) => t + (Number(f?.monthly) || 0), 0)
  return total > 0 ? total : null
}

/** The subject's fee as its tile shows it ("$325/mo"), or null when it has none. */
export function cmaSubjectFeeText(report: CmaReportLike): string | null {
  const fee = cmaSubjectMonthlyFee(report)
  return fee ? monthlyFeeText(fee) : null
}

/** The fee row of the comparison table, or null when there is nothing to compare: it shows only when the comps'
 *  fees were looked up (a report made before 11/16 never did - its comps must not read as fee-less) AND at least
 *  one home has a fee (a street of houses with none gets no empty row). */
export function cmaFeeRow(report: CmaReportLike, comps: CmaComparable[] = cmaShownComparables(report)): { subject: string; comp: (c: CmaComparable) => string } | null {
  const lookedUp = comps.some(c => c.monthly_fee != null)
  const subjectFee = cmaSubjectMonthlyFee(report)
  if (!lookedUp || !(subjectFee || comps.some(c => (c.monthly_fee || 0) > 0))) return null
  return {
    subject: subjectFee ? monthlyFeeText(subjectFee) : 'None on record',
    comp: c => (c.monthly_fee == null ? '—' : c.monthly_fee > 0 ? monthlyFeeText(c.monthly_fee) : 'None on record'),
  }
}

/** The subject's listing history as plain lines from the MLS record (earlier listings, price cuts, last sale) -
 *  three at most. A "Sold <date> for <price>" line that only repeats the Last Sale Date / Last Sale Price tiles
 *  (both showing) is left out. */
export function cmaListingHistory(report: CmaReportLike, max = 3): string[] {
  const s = report.subject
  const tiles = s?.last_sale_date && s?.last_sale_price != null ? { date: String(s.last_sale_date).slice(0, 10), price: Math.round(Number(s.last_sale_price)) } : null
  return (estimate(report)?.property_record?.history_lines || [])
    .map(l => String(l || '').trim())
    .filter(Boolean)
    .filter(l => {
      const m = tiles && l.match(/^Sold (\d{4}-\d{2}-\d{2}) for \$([\d,]+)\.?$/i)
      return !(m && m[1] === tiles!.date && Number(m[2].replace(/,/g, '')) === tiles!.price)
    })
    .slice(0, max)
}
