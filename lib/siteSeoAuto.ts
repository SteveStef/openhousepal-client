// Automatic Google titles + descriptions for every page of an agent's IDX website - ONE source,
// used by the public site (app/(sitepublic)/ohp-site-render/.../page.tsx generateMetadata) and
// by the IDX editor's Google tab preview, so what the agent previews is exactly what Google gets.
// Built only from real facts (the agent, their towns' live numbers, reviews). The agent can still
// override any page's title/description in the Google tab (SiteSeo.pages[key]) - an override
// always wins over these.
import { tidyAllCaps } from '@/lib/cheatSheetContent'

export interface SeoAgent { name?: string | null; brokerage?: string | null; market?: string | null; phone?: string | null; title?: string | null; bio?: string | null }
export interface SeoArea { slug: string; name: string; state?: string | null; median_price?: number | null; active_count?: number | null; school_districts?: string[] | null; summary?: string | null }
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

function market(ctx: SeoCtx): string {
  return (ctx.agent.market || '').trim() || listOf(ctx.towns.slice(0, 3)) || 'the area'
}

function agentLine(ctx: SeoCtx): string {
  const name = (ctx.agent.name || '').trim()
  const brokerage = (ctx.agent.brokerage || '').trim()
  return [name, brokerage].filter(Boolean).join(', ') || 'your local agent'
}

/** The built-in sections (+ the home page's fallback description). */
export function autoSectionMeta(key: string, ctx: SeoCtx): SeoMeta | null {
  const name = (ctx.agent.name || '').trim()
  const where = market(ctx)
  const towns = ctx.towns.slice(0, 4)
  switch (key) {
    case 'home':
      return {
        title: name ? `${name} | ${where} Real Estate` : `${where} Real Estate`,
        description: seoClip(`Homes for sale in ${where}, what homes really sell for, neighborhood guides and a free home value${name ? ` - from ${name}` : ''}.`),
      }
    case 'search':
      return { title: ctx.agent.market && `Search Homes for Sale in ${where}`.length <= 48 ? `Search Homes for Sale in ${where}` : 'Search Homes for Sale', description: seoClip(`Search every home for sale in ${where} - live MLS listings with photos, prices and open houses. Save a search to see new homes first.`) }
    case 'properties':
      return { title: 'Featured Homes for Sale', description: seoClip(`Featured homes for sale from ${agentLine(ctx)} - photos, prices, full details and private showings across ${where}.`) }
    case 'neighborhoods':
      return {
        title: towns.length ? 'Neighborhood Guides' : 'Neighborhoods',
        description: seoClip(towns.length
          ? `Neighborhood guides to ${listOf(towns)}${ctx.towns.length > towns.length ? ' and more' : ''}: homes for sale, schools, commute, market trends and local favorites.`
          : `Guides to the neighborhoods of ${where}: homes for sale, schools, commute and market trends.`),
      }
    case 'blog':
      return { title: 'Articles & Market Updates', description: seoClip(`Market updates, neighborhood guides and advice for buyers and sellers in ${where}${name ? `, from ${name}` : ''}.`) }
    case 'testimonials': {
      const r = ctx.reviews
      return {
        title: name ? `${name} Reviews` : 'Client Reviews',
        description: seoClip(r && r.count
          ? `${r.count} client ${r.count === 1 ? 'review' : 'reviews'}${r.average ? `, rated ${r.average.toFixed(1)} out of 5` : ''} - what buyers and sellers in ${where} say about working with ${name || 'me'}.`
          : `What buyers and sellers in ${where} say about working with ${name || 'me'}.`),
      }
    }
    case 'about': {
      return {
        title: name ? `About ${name}` : 'About',
        description: seoClip(`${[name, ctx.agent.title, ctx.agent.brokerage ? `with ${ctx.agent.brokerage}` : ''].filter(Boolean).join(', ')} - helping buyers and sellers across ${where}. My story, my track record and how I work.`),
      }
    }
    case 'home-value':
      return { title: `What's My Home Worth? Free Home Value`, description: seoClip(`Find out what your home is really worth - a free, no-obligation value from ${name || 'a local agent'}, built from real recent sales in ${where}.`) }
    case 'contact':
      return { title: name ? `Contact ${name}` : 'Contact', description: seoClip(`Talk to ${name || 'me'} about buying or selling in ${where}${ctx.agent.phone ? ` - call ${ctx.agent.phone}` : ''}, send a message or book a free consultation.`) }
    default:
      return null
  }
}

/** A neighborhood (town) page. */
export function autoTownMeta(area: SeoArea, ctx: SeoCtx): SeoMeta {
  const place = [area.name, area.state].filter(Boolean).join(', ')
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
