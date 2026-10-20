export type AgentSale = {
  id: string
  address: string
  city: string
  state: string
  zipcode?: string
  price?: number
  status?: string
  image?: string
  sold_date?: string
  visible?: boolean
  source?: 'bright' | 'manual' | 'listing'
  beds?: number
  baths?: number
  sqft?: number
  acres?: number
  // A handful of the listing's own photos (active listings only, from the MLS media sync) - lets
  // the Agent Hub mobile carousel cycle through one listing's real photos instead of sitting on
  // a single static image when the agent only has the one active listing.
  photos?: string[]
  // Public API responses (GET /agent-hub/public/{slug}) inject this per-listing: the agent's own
  // Listing Spotlight for this exact property when published, else the generic one-page property
  // view - see resolve_listing_link in property_website_service.py. Absent/null = no smart link
  // resolved, callers fall back to the general Listings page.
  listingLinkUrl?: string | null
}

export const formatSaleStatus = (status?: string) => {
  const clean = String(status || 'Sold').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('under contract')) return 'Under Contract'
  if (lower.includes('active')) return 'Active'
  if (lower.includes('pending')) return 'Pending'
  if (lower.includes('closed') || lower.includes('sold')) return 'Sold'
  if (lower.includes('off market') || lower.includes('off-market')) return 'Off Market'
  if (lower.includes('coming soon')) return 'Coming Soon'
  return clean || 'Sold'
}

export const getSaleStatusClass = (status?: string) => {
  const clean = formatSaleStatus(status).toLowerCase()
  if (clean === 'active') return 'bg-emerald-100 text-emerald-700'
  if (clean === 'coming soon') return 'bg-[#111827] text-white'
  if (clean === 'pending' || clean === 'under contract') return 'bg-yellow-400 text-[#111827]'
  if (clean === 'off market') return 'bg-gray-500 text-white'
  if (clean === 'sold') return 'hub-lx-sold' // the red Sold tablet (app/globals.css), on every look
  return 'bg-[#8b7355] text-white'
}

export const getStreetOnly = (address?: string) => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable'
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine
}

export const getSaleLocation = (sale: AgentSale) => [sale.city, sale.state].filter(Boolean).join(', ') || getStreetOnly(sale.address)

export const isEligibleSaleStatus = (status?: string) => formatSaleStatus(status).toLowerCase() === 'sold'

export const isEligibleSale = (sale: AgentSale) => isEligibleSaleStatus(sale.status) && (sale.price || 0) >= 100000

export const shouldAutoShowSale = (sale: AgentSale) => isEligibleSale(sale)

export const normalizeAgentSale = (sale: AgentSale): AgentSale => ({
  ...sale,
  visible: sale.visible ?? shouldAutoShowSale(sale),
})

export const getEligibleSales = (sales: AgentSale[]) => sales.filter(isEligibleSale).map(normalizeAgentSale)

// Shared with the backend's pick_featured_items()/_sales_rotation_pool() in
// email_signature_service.py - the email signature's rotating "recent sale" pulls from only the
// most recent N sales that are shown AND meet the agent's optional minimum-price filter, not the
// full sold history, so an agent with a long tail of old/low sales doesn't have those crowd out
// what should actually be rotating through. Keep this in sync with the Python version.
export const SALES_ROTATION_POOL_SIZE = 9

export const getSalesRotationPool = (sales: AgentSale[], minPrice = 0, size = SALES_ROTATION_POOL_SIZE) =>
  getEligibleSales(sales)
    .filter(sale => sale.visible && (sale.price || 0) >= minPrice)
    .sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
    .slice(0, size)

// Days since the Unix epoch (UTC) - a formula easy to reproduce identically in Python
// ((date.today() - date(1970, 1, 1)).days), unlike a language-specific ordinal, so the Studio
// live preview and the actual backend-rendered signature image always agree on which sale(s) are
// showing "today" for the same pool.
export const epochDayIndex = () => Math.floor(Date.now() / 86400000)

export const pickRotatingSales = (sales: AgentSale[], minPrice = 0, count = 2) => {
  const pool = getSalesRotationPool(sales, minPrice)
  if (pool.length <= count) return pool
  const start = epochDayIndex() % pool.length
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length])
}

export const getSaleSummary = (sales: AgentSale[]) => {
  const eligibleSales = getEligibleSales(sales)
  const totalSold = eligibleSales.length
  const totalVolume = eligibleSales.reduce((sum, sale) => sum + (sale.price || 0), 0)
  const avgPrice = totalSold ? Math.round(totalVolume / totalSold) : 0

  return { totalSold, totalVolume, avgPrice }
}

// "My Listings" is the mirror image of Recent Sales - everything currently for sale rather than
// everything already sold. Coming Soon/Active/Pending/Under Contract all count as "on the market".
export const isEligibleListingStatus = (status?: string) => ['active', 'pending', 'under contract', 'coming soon'].includes(formatSaleStatus(status).toLowerCase())

export const isEligibleListing = (listing: AgentSale) => isEligibleListingStatus(listing.status)

export const shouldAutoShowListing = (listing: AgentSale) => isEligibleListing(listing)

export const normalizeAgentListing = (listing: AgentSale): AgentSale => ({
  ...listing,
  visible: listing.visible ?? shouldAutoShowListing(listing),
})

export const getEligibleListings = (listings: AgentSale[]) => listings.filter(isEligibleListing).map(normalizeAgentListing)

export const getListingSummary = (listings: AgentSale[]) => {
  const eligibleListings = getEligibleListings(listings)
  const totalListed = eligibleListings.length
  const totalVolume = eligibleListings.reduce((sum, listing) => sum + (listing.price || 0), 0)
  const avgPrice = totalListed ? Math.round(totalVolume / totalListed) : 0

  return { totalListed, totalVolume, avgPrice }
}

const tidyTown = (s?: string) => {
  const t = String(s || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : t
}
const compactMoney = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`)

/** What the Sales page counts (Sold, $100K+ - isEligibleSale), for its link preview and share
 *  text: "24 Homes Sold", "$38.2M in sales  ·  Gladwyne, Villanova & Bryn Mawr", the latest shown
 *  sales' photos. Used by lib/og/cards (the card) and app/[slug]/sales/layout.tsx (the text). */
export function salesSummary(cfg: any): { count: number; volume: number; headline: string; sub: string | null; photos: string[]; towns: string[] } {
  const all: AgentSale[] = Array.isArray(cfg?.recentSales) ? cfg.recentSales : []
  const eligible = all.filter(x => x && isEligibleSale(x))
  const shown = eligible.filter(x => x.visible !== false).sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
  const volume = eligible.reduce((t, x) => t + (Number(x.price) || 0), 0)
  const tally = new Map<string, number>()
  for (const x of eligible) { const c = tidyTown(x.city); if (c) tally.set(c, (tally.get(c) || 0) + 1) }
  const towns = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3)
  const count = eligible.length
  const headline = count >= 2 ? `${count} Homes Sold` : count === 1 ? '1 Home Sold' : 'Recently Sold'
  const where = towns.length > 1 ? `${towns.slice(0, -1).join(', ')} & ${towns[towns.length - 1]}` : towns[0] || ''
  const sub = [volume ? `${compactMoney(volume)} in sales` : null, where || null].filter(Boolean).join('  ·  ') || null
  const photos = shown.map(x => x.image || (Array.isArray(x.photos) ? x.photos[0] : null)).filter((u): u is string => typeof u === 'string' && !!u)
  return { count, volume, headline, sub, photos, towns }
}
