// Plain-language helpers for the IDX town (neighborhood) page: the auto-written FAQ - shown on
// the page and sent to Google as FAQPage structured data - and the short "good to know" lines.
// Every answer is built only from the town's real data (live MLS numbers, census, the researched
// facts); a question with nothing real behind it is left out rather than padded.

export interface TownFaq { q: string; a: string; source?: { name: string; url?: string } }

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const compact = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`)

/** The first `n` sentences of a block of text. */
export function firstSentences(text: string | undefined | null, n = 2): string {
  const t = String(text || '').trim()
  if (!t) return ''
  const raw = t.match(/[^.!?]+[.!?]+['"’”]?(\s|$)/g) // a quote may close after the period ('go into town.')
  if (!raw) return t
  // Re-join pieces split on an abbreviation ("St. Davids", "U.S. Route 30", "Mt. Pleasant").
  const ABBR = /(?:^|\s)(St|Ste|Ave|Rd|Dr|Mt|Ft|Jr|Sr|Dr|No|Rt|Hwy|Blvd|Ln|Pkwy|U\.S|Inc|Co|vs|approx|e\.g|i\.e|[A-Z])\.\s*$/
  const parts: string[] = []
  for (const p of raw) {
    if (parts.length && ABBR.test(parts[parts.length - 1])) parts[parts.length - 1] += p
    else parts.push(p)
  }
  return parts.slice(0, n).join('').trim()
}

function entities(facts: Record<string, any>, key: string): any[] {
  return Array.isArray(facts?.[key]?.entities) ? facts[key].entities : []
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The town's days-on-market box: how long homes that sold in the last 12 months took (trends,
 *  else the stats' own count). Without sales it says what the other number really is - how long
 *  today's listings have sat so far (Malvern: 63 listed vs 12 to sell). */
export function daysOnMarketStat(ms: any, tr?: any): [string, string] | null {
  const sold = tr?.median_sold_dom ?? ms?.median_sold_dom
  if (sold != null) return ['Median days on market', String(sold)]
  if (ms?.median_dom != null) return ['Median days listed (for sale now)', String(ms.median_dom)]
  return null
}

export function buildTownFaq(area: any, inventoryTotal: number): TownFaq[] {
  const name: string = area.name
  const facts = area.facts || {}
  const ms = facts.market_stats || {}
  const tr = area.market_trends || {}
  const out: TownFaq[] = []

  // Prices
  const priceBits: string[] = []
  if (ms.median_price != null && inventoryTotal > 0) {
    // Charlottesville: our MLS feed carries only part of the area's homes (market_coverage) - say so.
    const feed = area.market_coverage?.thin ? ' in our MLS feed' : ''
    priceBits.push(`Right now the median list price in ${name} is ${money(ms.median_price)}, across ${inventoryTotal} ${inventoryTotal === 1 ? 'home' : 'homes'} for sale${feed}.`)
  }
  if (tr.median_sold_price) {
    let s = `Over the last 12 months, homes sold for a median of ${money(tr.median_sold_price)}`
    if (typeof tr.yoy_median_change_pct === 'number' && Math.abs(tr.yoy_median_change_pct) >= 0.5) s += ` - ${tr.yoy_median_change_pct > 0 ? 'up' : 'down'} ${Math.abs(tr.yoy_median_change_pct).toFixed(1)}% from the year before`
    priceBits.push(`${s}.`)
  }
  // The stored range is what most homes SOLD for over two years (the middle 90%), not what's listed
  // today - Malvern's answer put it on the homes for sale.
  if (ms.price_range_basis === 'sold_2y' && ms.min_price != null && ms.max_price != null && ms.max_price > ms.min_price) {
    priceBits.push(`Over the last two years, most homes sold for between ${compact(ms.min_price)} and ${compact(ms.max_price)}.`)
  }
  if (ms.avg_price_per_sqft) priceBits.push(`The average asking price works out to about ${money(ms.avg_price_per_sqft)} per square foot.`)
  if (priceBits.length) out.push({ q: `How much do homes cost in ${name}?`, a: priceBits.join(' ') })

  // Pace
  const pace: string[] = []
  const soldDom = tr.median_sold_dom ?? ms.median_sold_dom
  if (soldDom != null) pace.push(`Homes that sold in ${name} over the last 12 months spent a median of ${soldDom} ${soldDom === 1 ? 'day' : 'days'} on the market.`)
  else if (ms.median_dom != null) pace.push(`Homes for sale in ${name} right now have been listed for a median of ${ms.median_dom} ${ms.median_dom === 1 ? 'day' : 'days'}.`)
  if (typeof tr.median_sale_to_list_pct === 'number') {
    const p = tr.median_sale_to_list_pct
    // Price vs asking alone says nothing about how many offers a home got (grader 10/27).
    pace.push(`The typical home sells for ${p.toFixed(1)}% of its asking price.`)
  }
  if (tr.new_last_30_days) pace.push(`${tr.new_last_30_days} new ${tr.new_last_30_days === 1 ? 'listing has' : 'listings have'} come on in the last 30 days.`)
  if (pace.length) out.push({ q: `How fast do homes sell in ${name}?`, a: pace.join(' ') })

  // Schools
  const ps = facts.public_schools
  const districts: string[] = (ps?.districts || []).map((d: any) => d.name).filter(Boolean)
  if (districts.length) {
    const high: string[] = (ps.high_schools || []).map((s: any) => s.name).filter(Boolean).slice(0, 3)
    let a = districts.length > 1
      ? `${name} is served by more than one public school district: ${list(districts)}. Which one depends on the exact address.`
      : `${name} is served by ${districts[0]}.`
    if (high.length) a += ` High schools include ${list(high)}.`
    a += ' Always confirm the assigned schools for a specific home with the district.'
    out.push({ q: `What school district is ${name} in?`, a })
  }

  // Getting around
  const transit = facts.transportation
  const stations = entities(facts, 'transportation').map((e: any) => e.name).filter(Boolean).slice(0, 3)
  const trips: any[] = facts.commute?.destinations || []
  if (trips.length) {
    const parts = trips.map((t: any) => `${t.name} is about ${t.drive_minutes} minutes by car${t.transit_minutes ? ` (${t.transit_minutes} by train or bus)` : ''}`)
    out.push({ q: `How is the commute from ${name}?`, a: `From the center of ${name} at a weekday morning rush, ${list(parts)}.${stations.length ? ` Nearby transit includes ${list(stations)}.` : ''}`, source: { name: 'Google Maps' } })
  } else if (transit?.notes || stations.length) {
    out.push({ q: `How is the commute from ${name}?`, a: firstSentences(transit?.notes, 2) || `Nearby transit includes ${list(stations)}.` })
  }

  const walk = facts.walk
  if (walk?.rows?.length) {
    const pct = (k: string) => walk.rows.find((r: any) => r.key === k)?.pct
    // 95%+ reads "nearly all" - a 0.6-mile straight line is an estimate, not a promise for every home.
    const share = (p: number, first: boolean) => (p >= 95 ? (first ? 'Nearly all homes' : 'nearly all') : first ? `${p}% of homes` : `${p}%`)
    const trolley = !!walk.has_trolley || /trolley/i.test(walk.rows.find((r: any) => r.key === 'transit')?.label || '')
    const bits = [
      pct('grocery') != null ? `${share(pct('grocery'), true)} are within about a 15-minute walk of a grocery store` : '',
      pct('food') != null ? `${share(pct('food'), pct('grocery') == null)} ${pct('grocery') == null ? 'are within about a 15-minute walk' : 'are within that walk'} of three or more restaurants or cafes` : '',
      pct('transit') ? `${share(pct('transit'), false)} can walk to ${trolley ? 'a train or trolley stop' : 'a train station'}` : '',
    ].filter(Boolean)
    out.push({
      q: `Is ${name} walkable?`,
      a: `${walk.level}. ${bits.length ? `${bits.join(', ')}.` : ''}${walk.stations?.length ? ` ${trolley ? 'Stops' : 'Stations'} within walking distance include ${list(walk.stations.slice(0, 3))}.` : ''}`,
      source: { name: 'OpenStreetMap' },
    })
  }

  // Which township - a mailing-address town often spans more than one (real Census borders)
  const munis: { name: string; share: number }[] = area.municipalities || facts.boundaries?.municipalities || []
  if (munis.length > 1) {
    // "Township" only where every piece is one - Delaware has none, and "Unincorporated Sussex
    // County" isn't a municipality (same rule as the page's Townships / Local government switch).
    const townships = munis.every(m => /township$/i.test(m.name))
    // The shares are the homes we mapped; a mailing area can touch small slivers of others (19348, 19350).
    const spans = munis.reduce((t, m) => t + (m.share || 0), 0) >= 99 ? 'spans' : 'mostly covers'
    out.push({
      q: townships ? `What township is ${name} in?` : `Which local government covers ${name}?`,
      a: townships
        ? `${name} is a mailing address that ${spans} ${munis.length} townships: ${list(munis.map(m => `${m.name} (about ${m.share}% of homes)`))}. The township sets a home's property tax rate, services and zoning, so check which one a specific home is in.`
        : `${name} is a mailing address that ${spans} ${munis.length} local jurisdictions: ${list(munis.map(m => `${m.name} (about ${m.share}% of homes)`))}. The jurisdiction sets a home's local tax rate, services and zoning, so check which one a specific home is in.`,
      source: { name: 'U.S. Census Bureau boundaries' },
    })
  }

  // Things to do
  const dining = entities(facts, 'restaurants').map((e: any) => e.name).filter(Boolean).slice(0, 3)
  const parks = entities(facts, 'parks').map((e: any) => e.name).filter(Boolean).slice(0, 3)
  if (dining.length || parks.length) {
    const bits = [
      facts.downtown_centers?.notes ? firstSentences(facts.downtown_centers.notes, 1) : '',
      dining.length ? `Local favorites for eating out include ${list(dining)}.` : '',
      parks.length ? `For the outdoors there's ${list(parks)}.` : '',
    ].filter(Boolean)
    out.push({ q: `What is there to do in ${name}?`, a: bits.join(' ') })
  }

  // (No "who lives here" question - describing residents (age, income, households) is what Fair
  // Housing rules say a home-sale site must not do. Owner's call, 10/07.)

  // Taxes - only real, sourced facts the town research found
  const taxes = (Array.isArray(facts.evidence_bank) ? facts.evidence_bank : []).filter((e: any) => e?.topic === 'taxes' && e.claim)
  const tx = area.insights?.taxes
  if (tx?.per_sqft) {
    out.push({
      q: `What are property taxes like in ${name}?`,
      a: `Homes in ${name} pay about $${Number(tx.per_sqft).toFixed(2)} per square foot a year in property taxes${tx.typical_sqft && tx.typical_annual ? ` - about $${Number(tx.typical_annual).toLocaleString()} a year for a typical ${Number(tx.typical_sqft).toLocaleString()} sq ft home` : ''}.${(tx.districts || []).length > 1 ? ` It differs by school district: ${list(tx.districts.map((d: any) => `${d.name} about $${Number(d.per_sqft).toFixed(2)}`))}.` : ''} Every home's bill depends on its own assessment - ask for the current tax figure on any home you're considering.`,
      source: { name: `Recorded tax bills of ${tx.homes} homes (MLS)` },
    })
  } else if (taxes.length) {
    const rate = taxes.find((t: any) => /mill|rate/i.test(t.claim)) || taxes[0]
    out.push({
      q: `What are property taxes like in ${name}?`,
      a: `${firstSentences(rate.claim, 2)} Your exact bill depends on the home's assessed value and municipality - ask for the current tax figure on any home you're considering.`,
      source: rate.source_name ? { name: rate.source_name, url: rate.source_url } : undefined,
    })
  }

  // Living here, in a sentence
  if (area.narrative?.summary) out.push({ q: `What is it like to live in ${name}?`, a: firstSentences(area.narrative.summary, 3) })

  out.push({
    q: `Can I hear about new homes in ${name} before everyone else?`,
    a: `Yes - tell me what you're looking for and you'll get matching homes in ${name} as soon as they're listed, in your own private Showcase.`,
  })
  return out
}
