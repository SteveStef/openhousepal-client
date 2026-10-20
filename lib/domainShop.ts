// Buying a domain inside OpenHousePal + one-click connect - shapes from backend site_routes
// (/studio/sites/me/domain-shop/*, /me/domains/{id}/one-click). See domain_purchase_service.py.

export type DomainContact = {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  email: string
  phone: string
}

export type PurchasedDomain = {
  id: string
  domain: string
  /** CHECKOUT (at PayPal) -> REGISTERING -> ACTIVE; FAILED (refunded), EXPIRED, TRANSFERRED */
  status: 'CHECKOUT' | 'REGISTERING' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'TRANSFERRED' | 'ABANDONED'
  price: number
  renewal_price: number
  auto_renew: boolean
  registered_at: string | null
  expires_at: string | null
  last_error: string | null
  email: string | null
  /** only on the single-purchase read */
  email_confirmed?: boolean | null
  site_status?: string | null
}

export type DomainShop = {
  buy: boolean
  test_mode: boolean
  endings: string[]
  purchases: PurchasedDomain[]
  contact: Partial<DomainContact>
}

export type DomainOption = { domain: string; price: number; renewal_price: number; exact: boolean }

export type DomainSearch = {
  query: string
  exact: { domain: string; state: 'available' | 'taken' | 'ending_not_sold' } | null
  results: DomainOption[]
}

export type OneClick = { supported: boolean; company: string | null; url: string | null }

export const money = (n: number) => `$${n.toFixed(2)}`

export const prettyDate = (iso?: string | null) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

/** Where to go after PayPal / the domain company sends the agent back. */
export const backHref = (back?: string | null) =>
  back === 'setup' ? '/setup?step=domain' : back === 'settings' ? '/settings#idx-domain' : '/studio/website?tab=domains'

export const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' ')
