import { Property } from '@/types'
import { isPropertyAvailableStatus } from '@/lib/utils'

// Showcase homes that go under contract / pending / sold / off the market (user, 10/21): they no
// longer drop into Sold/Removed by themselves. They stay in the list with a big notice saying what
// happened and a "Move to Sold/Removed" button (buyer and agent alike); only a home someone moved
// (property.soldFiled, set by the server) lives in the folder. Back on the market = a normal card.

/** In the Showcase's Sold/Removed folder. */
export const inSoldFolder = (p: Pick<Property, 'MlsStatus' | 'soldFiled'>) =>
  !isPropertyAvailableStatus(p.MlsStatus) && !!p.soldFiled

/** Off the market but still in the list - shows the notice and the move button. */
export const hasStatusNotice = (p: Pick<Property, 'MlsStatus' | 'soldFiled'>) =>
  !isPropertyAvailableStatus(p.MlsStatus) && !p.soldFiled

export type StatusTone = 'sold' | 'contract' | 'off'

export interface StatusNotice {
  /** The big words on the photo: "Sold", "Under Contract", "Pending"... */
  label: string
  /** One plain sentence under them. */
  line: string
  tone: StatusTone
}

const shortDate = (d?: string | null) => {
  if (!d) return ''
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** What happened to an off-market home, in plain words. Null while it's for sale. */
export function statusNotice(p: Pick<Property, 'MlsStatus' | 'CloseDate'>): StatusNotice | null {
  if (isPropertyAvailableStatus(p.MlsStatus)) return null
  // "OFF_MARKET-BRIGHT" -> "OFF MARKET"
  const s = String(p.MlsStatus || '').toUpperCase().replace(/[-\s]*BRIGHT$/, '').replace(/_/g, ' ').trim()
  if (s.includes('CLOSED') || s.includes('SOLD')) {
    const on = shortDate(p.CloseDate)
    return { label: 'Sold', line: on ? `This home sold on ${on}.` : 'This home has sold.', tone: 'sold' }
  }
  if (s.includes('UNDER CONTRACT') || s.includes('CONTINGENT')) {
    return { label: 'Under Contract', line: 'The seller accepted an offer. It could come back if the sale falls through.', tone: 'contract' }
  }
  if (s.includes('PENDING')) return { label: 'Pending', line: 'The sale is nearly final - this home is no longer available.', tone: 'contract' }
  if (s.includes('WITHDRAWN')) return { label: 'Withdrawn', line: 'The seller took this home off the market for now.', tone: 'off' }
  if (s.includes('EXPIRED')) return { label: 'Listing Expired', line: 'The listing ended without a sale.', tone: 'off' }
  if (s.includes('CANCEL')) return { label: 'Listing Canceled', line: 'The seller canceled the listing.', tone: 'off' }
  if (s.includes('TEMP')) return { label: 'Temporarily Off Market', line: 'This home is off the market for now.', tone: 'off' }
  if (s.includes('OFF MARKET')) return { label: 'Off the Market', line: 'This home is no longer for sale.', tone: 'off' }
  const words = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  return { label: words || 'No Longer for Sale', line: 'This home is no longer for sale.', tone: 'off' }
}
