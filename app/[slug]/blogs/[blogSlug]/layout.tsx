import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; blogSlug: string }> }): Promise<Metadata> {
  const { slug, blogSlug } = await params
  const [data, hub] = await Promise.all([
    ogFetch<any>(`/studio/blogs/public/${encodeURIComponent(slug)}/${encodeURIComponent(blogSlug)}?track=false`, 60),
    ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60),
  ])
  // proxy.ts leaves an article's address to this page - a missing one is never listed.
  if (!data?.title) return { robots: { index: false, follow: true } }

  const title = data.socialTitle || data.seoTitle || data.title
  const description =
    data.socialDescription ||
    data.metaDescription ||
    (data.subtitle ? String(data.subtitle).slice(0, 200) : `A post by ${data.agentName || 'your agent'}.`)

  // The card's address changes whenever what it shows changes (cover / AI cover, title, summary,
  // look, or the agent's hub - photo, name, colors), so iMessage / Facebook / Slack fetch the new
  // card instead of reusing an old one.
  const sig = [data.coverImageUrl, data.socialImageUrl, title, description, data.category, data.theme, data.luxeMetal, data.accentColor, data.agentPhotoUrl, data.agentName, data.agentBrokerage, hub?.config?.savedAt].join('|')
  let h = 0
  for (let i = 0; i < sig.length; i++) h = (Math.imul(31, h) + sig.charCodeAt(i)) | 0
  const image = { url: `/api/og/blog?agent=${encodeURIComponent(slug)}&post=${encodeURIComponent(blogSlug)}&v=${(h >>> 0).toString(36)}`, width: 1200, height: 630, alt: title }

  // Google (owner, 10/30): a post on the agent's live IDX website is listed THERE - this copy points
  // at it and stays out. Otherwise it's listed here under the hub's current link (an old link points
  // at the current one), unless the agent switched "Let Google find this article" off.
  const listedHere = data.isIndexed !== false && !data.siteUrl
  const canonical = data.siteUrl || `https://${OHP_BASE_DOMAIN}/${encodeURIComponent(hub?.slug || slug)}/blogs/${encodeURIComponent(data.slug || blogSlug)}`

  return {
    title,
    description,
    ...(listedHere ? {} : { robots: { index: false, follow: true } }),
    alternates: { canonical },
    openGraph: { title, description, type: 'article', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function BlogPostShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
