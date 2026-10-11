import { SellerNetSheet, SnsCompensation, SnsLineItem, SnsScenario } from '@/types'

export function sumLineItems(items: SnsLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0)
}

export function compensationForSalePrice(salePrice: number, compensation: SnsCompensation): number {
  const side = (s: { percent?: number | null, flat_amount?: number | null }) =>
    (salePrice * ((s.percent || 0) / 100)) + (s.flat_amount || 0)
  return side(compensation.listing_side) + side(compensation.buyer_side)
}

export interface SnsScenarioResult {
  scenario: SnsScenario
  compensationTotal: number
  netProceeds: number
}

// Sale Price - Mortgage/Liens - Agent Compensation - Closing Costs - Tax Proration - Repairs = Net Proceeds
export function computeScenarioResult(
  scenario: SnsScenario,
  sheet: Pick<SellerNetSheet, 'mortgage_payoffs' | 'compensation' | 'closing_costs' | 'tax_proration' | 'repairs'>,
): SnsScenarioResult {
  const salePrice = scenario.sale_price || 0
  const compensationTotal = compensationForSalePrice(salePrice, sheet.compensation)
  const netProceeds = salePrice
    - sumLineItems(sheet.mortgage_payoffs)
    - compensationTotal
    - sumLineItems(sheet.closing_costs)
    - (sheet.tax_proration?.amount || 0)
    - sumLineItems(sheet.repairs)
  return { scenario, compensationTotal, netProceeds }
}

export function computeAllScenarios(sheet: Pick<SellerNetSheet, 'scenarios' | 'mortgage_payoffs' | 'compensation' | 'closing_costs' | 'tax_proration' | 'repairs'>): SnsScenarioResult[] {
  return sheet.scenarios.map(s => computeScenarioResult(s, sheet))
}

export const SUGGESTED_MORTGAGE_LABELS = ['First Mortgage', 'Second Mortgage / HELOC', 'Other Lien']

export const SUGGESTED_CLOSING_COST_LABELS = [
  'Transfer Taxes', 'Recordation Fees', 'Settlement / Title Fees', 'Attorney Fees',
  'HOA / Condo Resale Package', 'HOA / Condo Transfer Fees', 'Home Warranty',
  'Seller-Paid Closing Cost Credit', 'Repair Credit', 'Inspection Credit', 'Other Concessions',
  'Outstanding Utility / Municipal Charges',
]

export const SUGGESTED_REPAIR_LABELS = [
  'Repairs', 'Painting', 'Landscaping', 'Staging', 'Cleaning', 'Moving Expenses', 'Seller Improvements',
]
