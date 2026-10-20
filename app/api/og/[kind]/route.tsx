import type { NextRequest } from 'next/server'
import { ogFontsSafe } from '@/lib/og/shared'
import {
  renderShowcaseCard, renderCmaCard, renderOpenHouseCard,
  renderBlogCard, renderFormCard, renderHubCard, renderSpotlightCard, renderPropertyCard, renderSiteCard, renderIdxListingCard, renderSalesCard,
} from '@/lib/og/cards'

export const runtime = 'nodejs'

/**
 * One share-card image per shareable resource, addressable by URL. The custom-domain site
 * renderer (app/(sitepublic)/ohp-site-render) points its og:image here, so an IDX agent's links
 * on their OWN web address get the same agent-branded card as the openhousepal.com versions.
 *
 *   /api/og/showcase?token=...
 *   /api/og/cma?slug=...
 *   /api/og/openhouse?event=...
 *   /api/og/hub?agent=...
 *   /api/og/blog?agent=...&post=...
 *   /api/og/form?agent=...&form=...
 *   /api/og/spotlight?host=...&path=...
 *   /api/og/site?site=...&host=...    /api/og/idxlisting?site=...&listing=...&look=...
 *   /api/og/sales?agent=...
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params
  const q = req.nextUrl.searchParams
  const fonts = ogFontsSafe()

  switch (kind) {
    case 'showcase':
      return renderShowcaseCard(q.get('token') || '', fonts, q.get('accent'))
    case 'cma':
      return renderCmaCard(q.get('slug') || '', fonts, process.env.NODE_ENV !== 'production' ? { mode: q.get('mode'), client: q.get('client') } : null)
    case 'openhouse':
      return renderOpenHouseCard(q.get('event') || '', fonts)
    case 'hub':
      return renderHubCard(q.get('agent') || '', fonts)
    case 'blog':
      return renderBlogCard(q.get('agent') || '', q.get('post') || '', fonts)
    case 'form':
      return renderFormCard(q.get('agent') || '', q.get('form') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('look') : null)
    case 'spotlight':
      // ?addr= only for local design review (a very long address on a real Spotlight)
      return renderSpotlightCard(q.get('host') || '', q.get('path') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('addr') : null)
    case 'property':
      return renderPropertyCard(q.get('agent') || '', q.get('listing') || '', fonts)
    case 'site':
      // the site's look is read off the site itself; ?look= only for local design review
      return renderSiteCard(q.get('site') || '', q.get('host') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('look') : null)
    case 'idxlisting':
      // ?look= is the site's look ('luxe-gold-light', 'classic-1e3a5f-dark'), set by the page
      return renderIdxListingCard(q.get('site') || '', q.get('listing') || '', q.get('own') === '1', fonts, q.get('look'))
    case 'sales':
      return renderSalesCard(q.get('agent') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('look') : null)
    default:
      return new Response('unknown card kind', { status: 404 })
  }
}
