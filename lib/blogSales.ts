// Which of the agent's own sales fit THIS article - one rule for the Blogs page's AI writer and the chat helper's
// blog card (owner 11/14: "make sure the AI chat blog flow is the same as our normal flow").
//
// Reviewer 11/14: it was town-only, newest first - a first-time-buyer article was offered the agent's $2M sale.
// Now: the sales in the article's towns, the ones in the price range the title points at ("under $600K",
// "first-time", "luxury") first, then the most recent. With no town picked, the same rule over every sale - but
// only when the title gives a price to go by.

export type BlogPriceHint = { band: 'low' | 'high' | null; min: number | null; max: number | null } | null | undefined

type SaleLike = { city?: string | null; price?: number | string | null }

export function recommendSales<T extends SaleLike>(all: T[], areas: string[], price: BlogPriceHint, soldOn: (s: T) => string, now: number = Date.now()):
  { recommended: T[]; byPrice: boolean; inTown: boolean } {
  const wanted = areas.map(a => a.toLowerCase().split(',')[0].trim()).filter(Boolean)
  const inTown = wanted.length ? all.filter(s => s.city && wanted.some(w => s.city!.toLowerCase().includes(w) || w.includes(s.city!.toLowerCase()))) : []
  const prices = all.map(s => Number(s.price) || 0).filter(p => p > 0).sort((a, b) => a - b)
  const at = (f: number) => (prices.length ? prices[Math.min(prices.length - 1, Math.floor(prices.length * f))] : 0)
  const fitsPrice = (p: number) => {
    if (!price || !p) return false
    if (price.min != null || price.max != null) return (price.min == null || p >= price.min * 0.9) && (price.max == null || p <= price.max * 1.1)
    return price.band === 'low' ? p <= at(0.5) : price.band === 'high' ? p >= at(0.67) : false
  }
  const hasPriceHint = !!price && (price.band != null || price.min != null || price.max != null)
  const year = (n: number) => new Date(now - n * 365 * 864e5).toISOString().slice(0, 10)
  const score = (s: T) => (fitsPrice(Number(s.price) || 0) ? 4 : 0) + (soldOn(s) >= year(1) ? 2 : soldOn(s) >= year(2) ? 1 : 0)
  const rank = (list: T[]) => list.map((s, i) => ({ s, i, n: score(s) })).sort((a, b) => b.n - a.n || a.i - b.i).map(x => x.s)
  const pool = inTown.length ? rank(inTown) : !wanted.length && hasPriceHint ? rank(all).filter(s => fitsPrice(Number(s.price) || 0)) : []
  return { recommended: pool.slice(0, 6), byPrice: hasPriceHint && pool.some(s => fitsPrice(Number(s.price) || 0)), inTown: inTown.length > 0 }
}
