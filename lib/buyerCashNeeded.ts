import { BcnDownPaymentScenario, BcnLineItem, BuyerCashNeeded } from '@/types'

export function sumEnabledLineItems(items: BcnLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.enabled ? (item.amount || 0) : 0), 0)
}

export interface BcnScenarioResult {
  scenario: BcnDownPaymentScenario
  cashDown: number
  loanAmount: number
  closingCostsTotal: number
  prepaidsTotal: number
  inspectionsTotal: number
  totalCashInvestment: number
  remainingCashNeeded: number
}

// Total Cash Investment = Down Payment + Closing Costs + Prepaids + Inspections - Seller Credit - Lender Credit
// Remaining Cash Needed at Closing = Total Cash Investment - Earnest Money Already Paid
export function computeScenarioResult(
  scenario: BcnDownPaymentScenario,
  sheet: Pick<BuyerCashNeeded, 'purchase_price' | 'closing_costs' | 'prepaid_expenses' | 'inspections' | 'earnest_money' | 'credits'>,
): BcnScenarioResult {
  const purchasePrice = sheet.purchase_price?.amount || 0
  const percent = scenario.percent || 0
  const cashDown = purchasePrice * (percent / 100)
  const loanAmount = Math.max(0, purchasePrice - cashDown)
  const closingCostsTotal = sumEnabledLineItems(sheet.closing_costs)
  const prepaidsTotal = sumEnabledLineItems(sheet.prepaid_expenses)
  const inspectionsTotal = sumEnabledLineItems(sheet.inspections)
  const credits = (sheet.credits?.seller_credit || 0) + (sheet.credits?.lender_credit || 0)
  const totalCashInvestment = cashDown + closingCostsTotal + prepaidsTotal + inspectionsTotal - credits
  const remainingCashNeeded = totalCashInvestment - (sheet.earnest_money?.amount || 0)
  return { scenario, cashDown, loanAmount, closingCostsTotal, prepaidsTotal, inspectionsTotal, totalCashInvestment, remainingCashNeeded }
}

export function computeAllScenarios(sheet: Pick<BuyerCashNeeded, 'down_payment_scenarios' | 'purchase_price' | 'closing_costs' | 'prepaid_expenses' | 'inspections' | 'earnest_money' | 'credits'>): BcnScenarioResult[] {
  return sheet.down_payment_scenarios.map(s => computeScenarioResult(s, sheet))
}

// Standard fixed-rate monthly P&I amortization payment.
export function computeMonthlyPrincipalAndInterest(loanAmount: number, annualRatePercent: number, termYears: number): number {
  if (!loanAmount || !annualRatePercent || !termYears) return 0
  const monthlyRate = annualRatePercent / 100 / 12
  const numPayments = termYears * 12
  if (monthlyRate === 0) return loanAmount / numPayments
  const factor = Math.pow(1 + monthlyRate, numPayments)
  return loanAmount * (monthlyRate * factor) / (factor - 1)
}

export const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  jumbo: 'Jumbo',
  fha: 'FHA',
  va: 'VA',
  cash: 'Cash',
  other: 'Other',
}

export const QUICK_DOWN_PAYMENT_PERCENTS = [5, 10, 15, 20, 25, 30]

export const SUGGESTED_CLOSING_COST_LABELS = [
  'Lender Fees', 'Loan Origination', 'Appraisal', 'Credit Report', 'Title Insurance',
  'Settlement / Escrow', 'Attorney Fees', 'Recording Fees', 'Transfer / Recordation Taxes', 'Survey', 'HOA / Condo Fees',
]

export const SUGGESTED_PREPAID_LABELS = [
  'Property Tax Escrow', 'Homeowners Insurance', 'Prepaid Interest', 'HOA / Condo Prorations',
]

export const SUGGESTED_INSPECTION_LABELS = [
  'General Home Inspection', 'Radon', 'Termite', 'Well', 'Septic', 'Stucco', 'Pool', 'Structural Engineer',
]
