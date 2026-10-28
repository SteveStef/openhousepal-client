// Automatic Google titles + descriptions for every page of an agent's IDX website - ONE source,
// used by the public site (app/(sitepublic)/ohp-site-render/.../page.tsx generateMetadata) and
// by the IDX editor's Google tab preview, so what the agent previews is exactly what Google gets.
// Built only from real facts (the agent, their towns' live numbers, reviews). The agent can still
// override any page's title/description in the Google tab (SiteSeo.pages[key]) - an override
// always wins over these.
import { tidyAllCaps } from '@/lib/cheatSheetContent'

export interface SeoAgent { name?: string | null; brokerage?: string | null; market?: string | null; phone?: string | null; title?: string | null; bio?: string | null
  /** false once the agent's sales volume passes $50M - "sold", not "recently sold" (lib/salesWording). */
  sales_recent?: boolean | null }
export interface SeoArea { slug: string; name: string; state?: string | null; area_type?: string | null; parent_area_name?: string | null; median_price?: number | null; active_count?: number | null; school_districts?: string[] | null; summary?: string | null }
export interface SeoPost { slug: string; title: string; subtitle?: string | null; seo_title?: string | null; meta_description?: string | null; seoTitle?: string | null; metaDescription?: string | null }
export interface SeoCtx { agent: SeoAgent; towns: string[]; reviews?: { count: number; average: number | null } | null }
export interface SeoMeta { title: string; description: string }

export const SEO_TITLE_MAX = 60
export const SEO_DESC_MIN = 70
export const SEO_DESC_MAX = 160

/** Cut at a word boundary so Google never shows half a word. */
export function seoClip(text: string, max = SEO_DESC_MAX): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 25)).replace(/[\s,;:\-–—]+$/, '')}…`
}

const compactUsd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`)
const listOf = (names: string[]) => (names.length <= 1 ? names[0] || '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/** Where the agent works, in words: their own market line, else up to three of their towns. ''
 *  when neither is known yet - then the place is left out, never "the area" (user, 10/20). */
function market(ctx: SeoCtx): string {
  return (ctx.agent.market || '').trim() || listOf(ctx.towns.slice(0, 3))
}

function agentLine(ctx: SeoCtx): string {
  const name = (ctx.agent.name || '').trim()
  const brokerage = (ctx.agent.brokerage || '').trim()
  return [name, brokerage].filter(Boolean).join(', ')
}

/** The richest wording that still fits whole, so Google never shows a cut-off "…" when a shorter
 *  wording would fit. Candidates go richest first; blanks (a missing fact) are skipped. */
function fit(max: number, ...candidates: (string | false | null | undefined | 0)[]): string {
  const ok = candidates.filter((c): c is string => typeof c === 'string' && !!c.trim()).map(c => c.replace(/\s+/g, ' ').trim())
  return ok.find(c => c.length <= max) || seoClip(ok[ok.length - 1] || '', max)
}

/** The built-in sections (+ the home page's fallback description). */
export function autoSectionMeta(key: string, ctx: SeoCtx): SeoMeta | null {
  const name = (ctx.agent.name || '').trim()
  const brokerage = (ctx.agent.brokerage || '').trim()
  const who = agentLine(ctx)
  const where = market(ctx)
  const inWhere = where ? ` in ${where}` : ''
  const acrossWhere = where ? ` across ${where}` : ''
  // 'the Main Line' reads as 'Main Line Real Estate' at the front of a title
  const titleWhere = where.replace(/^the\s+/i, '')
  const towns = ctx.towns.slice(0, 4)
  const T = SEO_TITLE_MAX
  const D = SEO_DESC_MAX
  switch (key) {
    case 'home':
      // The agent's name and brokerage lead, so the site comes up when someone searches either
      // (user, 10/20) - in the title whenever it fits Google's ~60 characters, always first in
      // the description.
      return {
        title: fit(T,
          name && brokerage && where && `${name}, ${brokerage} | ${titleWhere} Real Estate`,
          name && where && `${name} | ${titleWhere} Real Estate`,
          name && brokerage && `${name} | ${brokerage}`,
          name && `${name} | Real Estate`,
          where && `${titleWhere} Real Estate`,
          'Homes for Sale & Real Estate'),
        description: fit(D,
          who && `${who}: search every home for sale${inWhere}, see what homes really sell for, explore neighborhood guides and get a free home value.`,
          who && `${who}: every home for sale${inWhere}, what homes really sell for, neighborhood guides and a free home value.`,
          who && `${who}: homes for sale${inWhere}, recent sales, neighborhood guides and a free home value.`,
          `Search every home for sale${inWhere}, see what homes really sell for, explore neighborhood guides and get a free home value.`),
      }
    case 'search':
      return {
        title: fit(48, where && `Search Homes for Sale in ${where}`, 'Search Homes for Sale'),
        description: fit(D,
          `Search every home for sale${inWhere} - live MLS listings with photos, prices and open houses, updated all day. Save a search and see new homes first.`,
          `Search every home for sale${inWhere} - live MLS listings with photos, prices and open houses. Save a search to see new homes first.`,
          `Every home for sale${inWhere}, live from the MLS - photos, prices and open houses.`),
      }
    case 'properties':
      return {
        title: 'Featured Homes for Sale',
        description: fit(D,
          who && `Featured homes for sale from ${who} - photos, prices, full details and private showings${acrossWhere}.`,
          who && `Featured homes for sale from ${who} - photos, prices, full details and private showings.`,
          `Featured homes for sale${inWhere} - photos, prices, full details and private showings, hand-picked for you.`),
      }
    case 'neighborhoods':
      return {
        title: towns.length ? 'Neighborhood Guides' : 'Neighborhoods',
        description: fit(D,
          towns.length && `Neighborhood guides to ${ctx.towns.length > towns.length ? `${towns.join(', ')} and more` : listOf(towns)}: homes for sale, schools, commute, market trends and local favorites.`,
          towns.length && `Neighborhood guides to ${towns.slice(0, 2).join(', ')} and more: homes for sale, schools, commute and market trends.`,
          where && `Neighborhood guides to ${where}: homes for sale, schools, commute, market trends and local favorites.`,
          `Neighborhood guides${name ? ` from ${name}` : ''}: homes for sale, schools, commute, market trends and local favorites, town by town.`),
      }
    case 'blog':
      return {
        title: 'Articles & Market Updates',
        description: fit(D,
          `Market updates, neighborhood guides and honest advice for buyers and sellers${inWhere}${name ? ` - from ${name}` : ''}.`,
          `Market updates, neighborhood guides and advice for buyers and sellers${inWhere}.`),
      }
    case 'testimonials': {
      const r = ctx.reviews
      const rated = r && r.count ? `${r.count} client ${r.count === 1 ? 'review' : 'reviews'}${r.average ? `, rated ${r.average.toFixed(1)} out of 5` : ''}` : ''
      return {
        title: name ? `${name} Reviews` : 'Client Reviews',
        description: fit(D,
          rated && `${rated} - what buyers and sellers${inWhere} say about working with ${name || 'me'}.`,
          rated && `${rated} - what clients say about working with ${name || 'me'}.`,
          `Real stories from real clients - what buyers and sellers${inWhere} say about working with ${name || 'me'}.`),
      }
    }
    case 'about': {
      const intro = [name, ctx.agent.title, brokerage ? `with ${brokerage}` : ''].filter(Boolean).join(', ')
      return {
        title: name ? `About ${name}` : 'About',
        description: fit(D,
          intro && where && `${intro} - helping buyers and sellers${acrossWhere}. My story, my track record and how I work.`,
          intro && `${intro} - my story, my track record and how I help buyers and sellers.`,
          `Helping buyers and sellers${acrossWhere} - my story, my track record and how I work.`),
      }
    }
    case 'home-value':
      return {
        title: `What's My Home Worth? Free Home Value`,
        description: fit(D,
          `Find out what your home is really worth - a free, no-obligation value from ${name || 'a local agent'}, built from real recent sales${where ? ` in ${where}` : ' nearby'}.`,
          `Find out what your home is really worth - a free, no-obligation value built from real recent sales${where ? ` in ${where}` : ' nearby'}.`),
      }
    case 'sold': {
      // The agent's own sales page (the starter "Sold" page). Same "recent" rule as everywhere
      // else: "recently sold" until their volume passes $50M (user, 10/27: was left blank).
      const recent = ctx.agent.sales_recent !== false
      const sold = recent ? 'recently sold' : 'sold'
      return {
        title: recent ? 'Recently Sold Homes' : 'Homes Sold',
        description: fit(D,
          name && `Homes ${name} has ${sold}${inWhere} - the prices they sold for, photos and details. Thinking of selling? Get a free home value.`,
          name && `Homes ${name} has ${sold}${inWhere} - sale prices, photos and details, plus a free home value for yours.`,
          `Homes ${sold}${inWhere} - the prices they sold for, photos and details. Thinking of selling? Get a free home value.`),
      }
    }
    case 'contact':
      return {
        title: name ? `Contact ${name}` : 'Contact',
        description: fit(D,
          `Talk to ${name || 'me'} about buying or selling${inWhere}${ctx.agent.phone ? ` - call ${ctx.agent.phone}` : ''}, send a message or book a free consultation.`,
          `Talk to ${name || 'me'} about buying or selling${inWhere} - send a message or book a free consultation.`,
          `Talk to ${name || 'me'} about buying or selling a home - call, send a message or book a free consultation.`),
      }
    default:
      return null
  }
}

/** A page the agent made themselves (not one of the built-in sections): its own title, and a
 *  description from the page's own words - the first real sentence or two of its text - else a
 *  plain line about the agent. Never left blank for the agent to work out (user, 10/27). */
export function autoPageMeta(page: { title?: string | null; blocks?: { type?: string; hidden?: boolean; data?: Record<string, any> }[] | null }, ctx: SeoCtx): SeoMeta {
  const title = (page.title || '').trim() || 'Page'
  const words = (v: unknown) => (typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '')
  let text = ''
  for (const b of page.blocks || []) {
    if (b.hidden) continue
    const d = b.data || {}
    for (const k of ['subtitle', 'subheadline', 'body', 'text', 'description', 'content', 'html']) {
      const w = words(d[k])
      if (w.length >= 60) { text = w; break }
    }
    if (text) break
  }
  const who = agentLine(ctx)
  const where = market(ctx)
  return {
    title,
    description: text ? seoClip(text) : fit(SEO_DESC_MAX,
      who && where && `${title} - from ${who}, helping buyers and sellers across ${where}.`,
      who && `${title} - from ${who}, helping buyers and sellers find and sell their homes.`,
      `${title} - helping buyers and sellers${where ? ` across ${where}` : ''} find and sell their homes.`),
  }
}

/** A neighborhood (town) page. */
export function autoTownMeta(area: SeoArea, ctx: SeoCtx): SeoMeta {
  // A city neighborhood names its city ("Bella Vista, Philadelphia, PA") when the title still fits.
  const inCity = area.area_type === 'neighborhood' && area.parent_area_name ? [area.name, area.parent_area_name, area.state].filter(Boolean).join(', ') : ''
  const place = inCity && `${inCity} Homes for Sale & Area Guide`.length <= SEO_TITLE_MAX ? inCity : [area.name, area.state].filter(Boolean).join(', ')
  const bits: string[] = []
  if (area.active_count) bits.push(`${area.active_count} ${area.active_count === 1 ? 'home' : 'homes'} for sale${area.median_price ? ` (median ${compactUsd(area.median_price)})` : ''}`)
  const district = String((area.school_districts || [])[0] || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase())
  bits.push(district ? (/school/i.test(district) ? district : `${district} schools`) : 'schools')
  bits.push('commute, market trends and things to do')
  return {
    title: `${place} Homes for Sale & Area Guide`,
    description: seoClip(`Living in ${place}: ${bits.join(', ')}.`),
  }
}

/** An article - its own SEO fields first, then its subtitle, then its opening words. */
export function autoPostMeta(post: SeoPost, openingText = ''): SeoMeta {
  const title = (post.seo_title || post.seoTitle || '').trim() || post.title
  const own = (post.meta_description || post.metaDescription || '').trim()
  return { title, description: seoClip(own || (post.subtitle || '').trim() || openingText) }
}

/** The Google-readiness checks shown beside each page in the editor. */
export function seoChecks(meta: SeoMeta, fullTitle: string): { ok: boolean; label: string }[] {
  const d = meta.description.length
  return [
    { ok: fullTitle.length <= SEO_TITLE_MAX + 5 && meta.title.length >= 10, label: fullTitle.length > SEO_TITLE_MAX + 5 ? 'Title gets cut off' : 'Title length' },
    { ok: d >= SEO_DESC_MIN && d <= SEO_DESC_MAX + 2, label: d < SEO_DESC_MIN ? 'Description too short' : d > SEO_DESC_MAX + 2 ? 'Description gets cut off' : 'Description length' },
  ]
}

/** "Title | Site name" - how every page except the home result is titled; the name is left off
 *  when it would push the title past what Google shows. */
export function withSiteName(title: string, siteName: string): string {
  if (!siteName || title.includes(siteName)) return title
  const full = `${title} | ${siteName}`
  return full.length <= SEO_TITLE_MAX + 2 ? full : title
}

/** A home's page: "239 Windham Dr, Exton, PA 19341 - $1,300,000" + a facts sentence. A home whose
 *  seller withheld the address is named by its town only. */
export function autoListingMeta(p: any): SeoMeta {
  const place = [tidyAllCaps(p.city), [p.state, p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const name = p.address_withheld ? `Home for sale in ${place}` : [tidyAllCaps(p.address), place].filter(Boolean).join(', ')
  const price = typeof p.price === 'number' && p.price > 0 ? `$${Math.round(p.price).toLocaleString('en-US')}` : ''
  const facts = [
    p.bedrooms ? `${p.bedrooms} bed` : '',
    p.bathrooms ? `${p.bathrooms} bath` : '',
    p.living_area ? `${Math.round(p.living_area).toLocaleString('en-US')} sq ft` : '',
  ].filter(Boolean).join(', ')
  const status = String(p.status || '').replace(/-BRIGHT$/i, '').toLowerCase()
  const lead = status.startsWith('closed') ? 'Sold' : status.startsWith('coming soon') ? 'Coming soon' : status.includes('under contract') || status.startsWith('pending') ? 'Under contract' : 'For sale'
  return {
    title: [name, price].filter(Boolean).join(' - '),
    description: seoClip([`${lead}${place ? ` in ${place}` : ''}${price && lead !== 'Sold' ? ` for ${price}` : ''}.`, facts ? `${facts}.` : '', p.list_office_name ? `Listing courtesy of ${p.list_office_name}.` : ''].filter(Boolean).join(' ')),
  }
}
