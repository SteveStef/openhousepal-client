import type { ReactNode } from 'react'
import { SitePage, SiteTheme } from './types'
import BlockRenderer from './blocks/BlockRenderer'
import HomeScrollEffects from './HomeScrollEffects'
import type { SiteBlock } from './types'

// Editor preview only: a section that has nothing to show yet renders nothing on the site (on
// purpose - visitors never see an empty box). In the editor that read as "I added it and nothing
// happened" (10/27 audit), so it gets a dashed note saying what it's waiting for. Data sections
// say so only once their data has loaded (resolved is an array), never while it's on its way.
function emptyNote(block: SiteBlock): string | null {
  const d: Record<string, any> = block.data || {}
  const none = (v: unknown) => Array.isArray(v) && v.length === 0
  switch (block.type) {
    case 'rich_text': return String(d.text || '').trim() ? null : 'Text section - type your words in the editor and they appear here.'
    case 'image': return d.url ? null : 'Photo section - upload a photo in the editor and it appears here.'
    case 'testimonials': return none(d.resolved) ? 'Client Reviews - shows up once you have published reviews (Reviews tab).' : null
    case 'recent_sales': return none(d.resolved) ? 'Recently Sold - shows up once your sold homes are matched to you.' : null
    case 'open_houses': return none(d.resolved) ? 'Open Houses - shows up whenever you have an open house coming up.' : null
    case 'spotlights': return none(d.resolved) ? 'Listing Spotlights - shows up once you publish a Spotlight.' : null
    case 'blog_posts': return none(d.resolved) ? 'Articles - shows up once you publish an article.' : null
    case 'newly_listed': return none(d.resolved) ? 'Just Listed - shows up when new homes come on the market in your towns.' : null
    case 'featured_listings': return none(d.resolved) ? 'Featured Homes - shows up once homes match your Featured tab.' : null
    case 'showcase': return d.collection_id ? null : 'Showcase - pick which Showcase to show in the editor.'
    case 'form': return d.form_id ? null : 'Lead Form - pick which form to show in the editor.'
    default: return null
  }
}

// `editor` (IDX editor preview only): wraps each section in a marker so the editor can scroll to
// it, outline the one being edited, and animate sections in and out. Public pages never pass it.
export default function SitePageRenderer({ page, theme, siteId, basePrefix = '', homeExperience = false, afterCommunitiesContent = null, editor }: { page: SitePage; theme: SiteTheme; siteId?: string; basePrefix?: string; homeExperience?: boolean; afterCommunitiesContent?: ReactNode; editor?: { focusId?: string | null; focusTag?: string } }) {
  // The home page never shows a Contact Band - the footer's "Let's talk about your next move"
  // band closes it instead (owner's call, 10/07); the route turns that footer band on for it.
  const visibleBlocks = page.blocks.filter(block => !block.hidden && !(page.is_home && block.type === 'contact_cta'))
  const hasCommunitiesBlock = visibleBlocks.some(block => block.type === 'communities')

  return (
    <HomeScrollEffects enabled={homeExperience}>
      <main className="min-h-screen" style={{ backgroundColor: 'var(--site-bg)' }}>
        {visibleBlocks.map(block => {
          const renderedBlock = homeExperience ? (
            <div key={block.id} className="ohp-home-scroll-section">
              <BlockRenderer block={block} theme={theme} siteId={siteId} basePrefix={basePrefix} />
            </div>
          ) : editor ? (
            <div key={block.id} data-ohp-block={block.id} data-ohp-focus={editor.focusId === block.id ? '' : undefined} data-ohp-tag={editor.focusTag}>
              {emptyNote(block) ? (
                <div className="mx-auto max-w-3xl px-6 py-8">
                  <p className="rounded-2xl border-2 border-dashed px-5 py-6 text-center text-sm font-bold" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-muted)' }}>
                    {emptyNote(block)}
                    <span className="mt-1 block text-[11px] font-semibold" style={{ color: 'var(--site-faint)' }}>Only you see this note - visitors don&apos;t see an empty section.</span>
                  </p>
                </div>
              ) : <BlockRenderer block={block} theme={theme} siteId={siteId} basePrefix={basePrefix} />}
            </div>
          ) : (
            <BlockRenderer key={block.id} block={block} theme={theme} siteId={siteId} basePrefix={basePrefix} />
          )
          if (block.type !== 'communities' || !afterCommunitiesContent) return renderedBlock
          return (
            <div key={`${block.id}-with-after`}>
              {renderedBlock}
              <div className={homeExperience ? 'ohp-home-scroll-section' : undefined}>{afterCommunitiesContent}</div>
            </div>
          )
        })}
        {!hasCommunitiesBlock && afterCommunitiesContent && (
          <div className={homeExperience ? 'ohp-home-scroll-section' : undefined}>{afterCommunitiesContent}</div>
        )}
      </main>
    </HomeScrollEffects>
  )
}
