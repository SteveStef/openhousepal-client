import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; blogSlug: string }> }): Promise<Metadata> {
  const { slug, blogSlug } = await params
  const [data, hub] = await Promise.all([
    ogFetch<any>(`/studio/blogs/public/${encodeURIComponent(slug)}/${encodeURIComponent(blogSlug)}?track=false`, 60),
    ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60),
  ])
  if (!data?.title) return {}

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

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function BlogPostShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
