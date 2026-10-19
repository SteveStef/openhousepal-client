'use client'

import { useEffect, useState } from 'react'
import { accentTextFor } from '@/lib/siteTheme'
import api from '@/lib/api-service'
import BlogArticleBody, { type BlogArticleAgentInfo, type BlogRelatedArticle, type NeighborhoodLink } from '@/components/studio/blogs/BlogArticleBody'
import type { BlogBlock } from '@/types'

// A blog article on the agent's IDX site - same body as the Agent Hub article, with the reader's
// Contact Form / Call to Action sending a real lead, Lead Form blocks opening the site's own form
// pages, and Related Articles linking within the site.
export default function SiteBlogArticle({ hubSlug, blogSlug, blocks, agent, accentColor, basePrefix, related, signatureCard = false, signatureTowns = [], neighborhoodLinks = [], mode = 'light', luxe = false }: {
  hubSlug: string | null
  blogSlug: string
  blocks: BlogBlock[]
  agent: BlogArticleAgentInfo
  accentColor: string
  basePrefix: string
  related: BlogRelatedArticle[]
  signatureCard?: boolean
  signatureTowns?: string[]
  /** Linked neighborhood pages on this same site - still open in a new tab so the article stays. */
  neighborhoodLinks?: NeighborhoodLink[]
  /** The site's starting light/dark mode (the visitor can flip it - followed below). */
  mode?: 'light' | 'dark'
  luxe?: boolean
}) {
  // The article body builds its colors from one hex (numbers, labels, buttons). The raw accent was
  // unreadable in some looks (gold on cream, navy on a dark page) - use its readable shade for the
  // mode the page is in right now, following the visitor's light/dark switch.
  const [liveMode, setLiveMode] = useState(mode)
  useEffect(() => {
    const root = document.querySelector('.ohp-site[data-mode]')
    if (!root) return
    const read = () => setLiveMode(root.getAttribute('data-mode') === 'dark' ? 'dark' : 'light')
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['data-mode'] })
    return () => mo.disconnect()
  }, [])
  const readableAccent = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentTextFor(accentColor, liveMode, luxe) : accentColor
  // Counts the read once per page view - the article itself is server-rendered from the site
  // route, which doesn't record reads.
  useEffect(() => {
    if (hubSlug) api.public.trackBlogEvent(hubSlug, blogSlug, 'view')
  }, [hubSlug, blogSlug])

  return (
    <BlogArticleBody
      // Every article ends with related articles ("Keep reading") unless it already places them.
      blocks={blocks.some(b => b.type === 'related_articles') || !related.length ? blocks : [...blocks, { id: 'auto-related', type: 'related_articles', data: {} } as BlogBlock]}
      agent={agent}
      accentColor={readableAccent}
      onLead={hubSlug ? async payload => {
        const res = await api.public.submitBlogLead(hubSlug, blogSlug, payload)
        return { ok: !!res.success, error: res.error }
      } : undefined}
      related={related}
      relatedHref={slug => `${basePrefix}/blog/${slug}`}
      formHref={formSlug => `${basePrefix}/forms/${formSlug}?site_chrome=1`}
      signatureHubSlug={signatureCard ? hubSlug : null}
      signatureTowns={signatureTowns}
      neighborhoodLinks={neighborhoodLinks}
      // The site itself closes every page with the agent (footer signature card + contact band),
      // so the article's own closing section would only repeat it.
      hideCta
    />
  )
}
