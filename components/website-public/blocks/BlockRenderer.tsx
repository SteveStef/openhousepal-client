import { SiteBlock, SiteTheme } from '../types'
import HeroBlock from './HeroBlock'
import HeadingTextBlock from './HeadingTextBlock'
import RichTextBlock from './RichTextBlock'
import ImageBlock from './ImageBlock'
import AboutAgentBlock from './AboutAgentBlock'
import ContactCtaBlock from './ContactCtaBlock'
import DividerBlock from './DividerBlock'
import FeaturedListingsBlock from './FeaturedListingsBlock'
import RecentSalesBlock from './RecentSalesBlock'
import OpenHousesBlock from './OpenHousesBlock'
import BlogPostsBlock from './BlogPostsBlock'
import FormBlock from './FormBlock'
import ShowcaseBlock from './ShowcaseBlock'
import CommunitiesBlock from './CommunitiesBlock'
import NewlyListedBlock from './NewlyListedBlock'
import TestimonialsBlock from './TestimonialsBlock'
import SpotlightsBlock from './SpotlightsBlock'

// One dispatcher for both the public renderer and the editor's in-editor preview, so what an
// agent previews is exactly what visitors see. Adding a new block type means one new case here
// plus a new component - no other file needs to change. `siteId` is only needed by blocks that
// make their own client-side call after the initial server render (Form, and listing links) -
// it's undefined in the editor's local preview, which every such block handles gracefully.
export default function BlockRenderer({ block, theme, siteId, basePrefix = '' }: { block: SiteBlock; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  if (block.hidden) return null

  switch (block.type) {
    case 'hero':
      return <HeroBlock data={block.data} theme={theme} siteId={siteId} basePrefix={basePrefix} />
    case 'heading_text':
      return <HeadingTextBlock data={block.data} theme={theme} />
    case 'rich_text':
      return <RichTextBlock data={block.data} theme={theme} />
    case 'image':
      return <ImageBlock data={block.data} />
    case 'about_agent':
      return <AboutAgentBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'contact_cta':
      return <ContactCtaBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'divider':
      return <DividerBlock />
    case 'featured_listings':
      return <FeaturedListingsBlock data={block.data} theme={theme} siteId={siteId} basePrefix={basePrefix} />
    case 'recent_sales':
      return <RecentSalesBlock data={block.data} theme={theme} siteId={siteId} basePrefix={basePrefix} />
    case 'open_houses':
      return <OpenHousesBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'blog_posts':
      return <BlogPostsBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'form':
      return <FormBlock data={block.data} theme={theme} siteId={siteId} basePrefix={basePrefix} />
    case 'showcase':
      return <ShowcaseBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'communities':
      return <CommunitiesBlock data={block.data} theme={theme} basePrefix={basePrefix} />
    case 'newly_listed':
      return <NewlyListedBlock data={block.data} theme={theme} siteId={siteId} basePrefix={basePrefix} />
    case 'testimonials':
      return <TestimonialsBlock data={block.data} theme={theme} />
    case 'spotlights':
      return <SpotlightsBlock data={block.data} theme={theme} />
    default:
      return null
  }
}
