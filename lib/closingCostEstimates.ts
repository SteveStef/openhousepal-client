// Best-effort estimate helpers for transfer tax, title insurance, homeowners insurance, and
// property tax proration. None of Bright MLS / RESO carries a transfer-tax field, so these are
// rate-table estimates (not synced data) - every value they produce lands in an ordinary
// agent-editable line item and can be changed or deleted like anything else on these sheets.

export interface TransferTaxRate {
  totalRatePct: number
  sellerRatePct: number
  buyerRatePct: number
  note: string
}

// Rates focus on Bright MLS's actual footprint (PA/NJ/DE/MD/VA/WV/DC). Sourced from published
// state/county transfer-tax conventions - still confirm with the title company on any real deal,
// rates and split conventions are negotiable and change by county/municipality.
const TRANSFER_TAX_TABLE: Record<string, TransferTaxRate> = {
  PA: { totalRatePct: 2.0, sellerRatePct: 1.0, buyerRatePct: 1.0, note: '~1% state + ~1% local, commonly split 50/50 (negotiable).' },
  NJ: { totalRatePct: 1.0, sellerRatePct: 1.0, buyerRatePct: 0, note: 'NJ Realty Transfer Fee is paid entirely by the seller by statute.' },
  MD: { totalRatePct: 1.5, sellerRatePct: 0.75, buyerRatePct: 0.75, note: '~0.5% state + ~1% county in most counties, 50/50 by convention.' },
  VA: { totalRatePct: 0.5, sellerRatePct: 0.25, buyerRatePct: 0.25, note: "Seller's grantor's tax ~0.25% + buyer's recordation tax ~0.25%." },
  DE: { totalRatePct: 4.0, sellerRatePct: 2.0, buyerRatePct: 2.0, note: 'State + local realty transfer tax, typically split 50/50.' },
  WV: { totalRatePct: 0.44, sellerRatePct: 0.44, buyerRatePct: 0, note: 'Combined state/county transfer tax, seller-paid by convention.' },
  DC: { totalRatePct: 2.9, sellerRatePct: 1.45, buyerRatePct: 1.45, note: 'Transfer tax (seller) + recordation tax (buyer), ~1.1% each under $400k.' },
}

// City-level overrides, keyed as "STATE|CITY" (uppercase). Layered on top of the state table.
const CITY_OVERRIDES: Record<string, TransferTaxRate> = {
  'PA|PHILADELPHIA': { totalRatePct: 3.278, sellerRatePct: 1.639, buyerRatePct: 1.639, note: 'Philadelphia Realty Transfer Tax ~3.278% combined, no fixed split convention (defaulted 50/50).' },
  'MD|BALTIMORE': { totalRatePct: 2.0, sellerRatePct: 1.0, buyerRatePct: 1.0, note: 'Baltimore City transfer + recordation runs higher than most MD counties.' },
}

const DEFAULT_RATE: TransferTaxRate = { totalRatePct: 1.0, sellerRatePct: 0.5, buyerRatePct: 0.5, note: 'No rate on file for this location - defaulted to a common 1% total, split 50/50.' }

function lookupTransferTaxRate(state?: string | null, city?: string | null): TransferTaxRate {
  const st = (state || '').trim().toUpperCase()
  const ct = (city || '').trim().toUpperCase()
  if (st && ct && CITY_OVERRIDES[`${st}|${ct}`]) return CITY_OVERRIDES[`${st}|${ct}`]
  if (st && TRANSFER_TAX_TABLE[st]) return TRANSFER_TAX_TABLE[st]
  return DEFAULT_RATE
}

export function estimateTransferTax(price: number | null | undefined, state?: string | null, city?: string | null): { sellerAmount: number, buyerAmount: number, rate: TransferTaxRate } {
  const rate = lookupTransferTaxRate(state, city)
  const p = price || 0
  return {
    sellerAmount: Math.round(p * (rate.sellerRatePct / 100)),
    buyerAmount: Math.round(p * (rate.buyerRatePct / 100)),
    rate,
  }
}

// Owner's title insurance rule of thumb (Fannie Mae data puts the average around 0.4% of price).
export function estimateTitleInsurance(price: number | null | undefined): number {
  return Math.round((price || 0) * 0.005)
}

// 2026 homeowners insurance averages run well above the old "0.35% of value" rule of thumb.
export function estimateHomeownersInsuranceAnnual(price: number | null | undefined): number {
  return Math.round((price || 0) * 0.006)
}

function dayOfYear(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1
}

// Simple per-diem proration: the portion of the year's taxes attributable to Jan 1 -> closing date.
// This is an estimate of the seller's share owed at closing, not an authoritative settlement figure.
export function estimateTaxProration(annualTaxes: number | null | undefined, closingDateISO?: string | null): number {
  if (!annualTaxes || !closingDateISO) return 0
  const days = dayOfYear(closingDateISO)
  return Math.round((annualTaxes / 365) * days)
}

export const DEFAULT_MORTGAGE_RATE_PCT = 6.75
