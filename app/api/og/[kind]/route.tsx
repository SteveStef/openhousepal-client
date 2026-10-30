import type { NextRequest } from 'next/server'
import { ogFontsSafe } from '@/lib/og/shared'
import {
  renderShowcaseCard, renderShowcaseHomeCard, renderCmaCard, renderOpenHouseCard,
  renderBlogCard, renderFormCard, renderHubCard, renderSpotlightCard, renderPropertyCard, renderSiteCard, renderIdxListingCard, renderSalesCard,
} from '@/lib/og/cards'

export const runtime = 'nodejs'

/**
 * One share-card image per shareable resource, addressable by URL. The custom-domain site
 * renderer (app/(sitepublic)/ohp-site-render) points its og:image here, so an IDX agent's links
 * on their OWN web address get the same agent-branded card as the openhousepal.com versions.
 *
 *   /api/og/showcase?token=...
 *   /api/og/showcasehome?token=...&home=...
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
    case 'showcasehome':
      // one home inside a Showcase - the link the agent's Send makes (home = its slug or id)
      return renderShowcaseHomeCard(q.get('token') || '', q.get('home') || '', fonts, q.get('accent'),
        // ?style= frame | bleed | split and ?client= (another client name) - local review only
        process.env.NODE_ENV !== 'production' ? q.get('style') : null, process.env.NODE_ENV !== 'production' ? q.get('client') : null)
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
      // ?addr= / ?status= / ?accent= only for local design review (a very long address, another
      // status or brand color on a real Spotlight)
      return renderSpotlightCard(q.get('host') || '', q.get('path') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('addr') : null,
        process.env.NODE_ENV !== 'production' ? { status: q.get('status'), accent: q.get('accent') } : null)
    case 'property':
      return renderPropertyCard(q.get('agent') || '', q.get('listing') || '', fonts)
    case 'site':
      // the site's look is read off the site itself; ?look= only for local design review
      return renderSiteCard(q.get('site') || '', q.get('host') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('look') : null)
    case 'idxlisting':
      // ?look= is the site's look ('luxe-gold-light', 'classic-1e3a5f-dark'), set by the page
      // ?status= only for local design review (Coming Soon / Sold / For Rent on a real listing)
      return renderIdxListingCard(q.get('site') || '', q.get('listing') || '', q.get('own') === '1', fonts, q.get('look'), process.env.NODE_ENV !== 'production' ? q.get('status') : null)
    case 'sales':
      // ?look= / ?sales= (keep only the latest N sales) / ?area= (another service area) only for local design review
      return renderSalesCard(q.get('agent') || '', fonts, process.env.NODE_ENV !== 'production' ? q.get('look') : null, process.env.NODE_ENV !== 'production' ? q.get('sales') : null,
        process.env.NODE_ENV !== 'production' ? q.get('area') : null)
    default:
      return new Response('unknown card kind', { status: 404 })
  }
}
