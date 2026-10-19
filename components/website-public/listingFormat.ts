// Shared by every place a real MLS status needs to render as a clean, color-coded badge - the
// page-builder public renderer's ListingCard and the Search tab (PropertyMapSearch) both use
// this so a status reads the same way everywhere on the site. Bright MLS status strings look
// like "ACTIVE-BRIGHT" / "COMING SOON-BRIGHT" / "CLOSED-BRIGHT" - purely cosmetic label cleanup,
// never used for any filtering decision (see content_adapters.is_eligible_recent_sale /
// INACTIVE_STATUSES for the real matching logic).
export function formatStatus(status?: string | null): string | null {
  if (!status) return null
  const clean = status.replace(/-BRIGHT$/i, '').trim()
  if (/^closed$/i.test(clean)) return 'Sold'
  return clean.replace(/\b\w/g, c => c.toUpperCase())
}

export function statusBadgeColor(status?: string | null): { bg: string; fg: string } {
  const clean = (status || '').toUpperCase()
  if (clean.includes('CLOSED')) return { bg: '#dc2626', fg: '#fff' } // red - sold
  if (clean.includes('PENDING') || clean.includes('CONTRACT')) return { bg: '#eab308', fg: '#111827' } // yellow
  if (clean.includes('COMING SOON')) return { bg: '#111827', fg: '#fff' } // black
  return { bg: '#15803d', fg: '#fff' } // green - active/default (green-700: white text reads, AA)
}

// A plain `/1000` + "K" (the previous approach) reads fine for $450K but produces "$1535K" for
// anything past a million - correct math, but nobody writes prices that way. Switches to "M"
// once the price crosses $1M, e.g. $1,535,000 -> "$1.5M" instead of "$1535K".
export function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000
    return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`
  }
  if (price >= 1_000) {
    return `$${Math.round(price / 1000)}K`
  }
  return `$${Math.round(price).toLocaleString()}`
}

// "846-850  Mt. Pleasant BRYN MAWR PA 19010" -> "846-850 Mt. Pleasant" - some MLS rows carry the
// whole address in the street field. Drops a trailing "CITY ST 12345" / ", City, ST 12345" and
// tidies ALL-CAPS words.
export function cleanStreet(address?: string | null, city?: string | null): string {
  let a = String(address || '').replace(/\s+/g, ' ').trim()
  a = a.replace(/,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?$/, '')
  a = a.replace(/\s+[A-Z][A-Z.'-]*(\s+[A-Z][A-Z.'-]*)*\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, '')
  const c = (city || '').trim().toLowerCase()
  if (c && a.toLowerCase().endsWith(` ${c}`)) a = a.slice(0, a.length - c.length).replace(/[,\s]+$/, '')
  return a.replace(/\b([A-Z]{2,})\b/g, w => (/^(NE|NW|SE|SW|PO|US)$/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).trim()
}

/** "Listed today" / "Listed 3 days ago" / "New this week" - for fresh-listing badges. */
export function listedAgo(days?: number | null): string | null {
  if (days == null || days < 0) return null
  if (days === 0) return 'Listed today'
  if (days === 1) return 'Listed yesterday'
  if (days < 14) return `Listed ${days} days ago`
  if (days < 45) return `${Math.round(days / 7)} weeks on market`
  return null
}

export const fullPrice = (n?: number | null) => (typeof n === 'number' && n > 0 ? `$${Math.round(n).toLocaleString('en-US')}` : '')

/** "LOWER MERION" -> "Lower Merion" (MLS ALL-CAPS words; mixed-case text is left alone). */
export function tidyCaps(text?: string | null): string {
  return String(text || '').split(' ').map(w => (/^[A-Z][A-Z.'-]+$/.test(w) && !/^(NE|NW|SE|SW|PO|US|HOA|II|III|IV)$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w)).join(' ')
}
