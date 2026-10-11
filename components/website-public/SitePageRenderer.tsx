import type { ReactNode } from 'react'
import { SitePage, SiteTheme } from './types'
import BlockRenderer from './blocks/BlockRenderer'
import HomeScrollEffects from './HomeScrollEffects'

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
              <BlockRenderer block={block} theme={theme} siteId={siteId} basePrefix={basePrefix} />
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
