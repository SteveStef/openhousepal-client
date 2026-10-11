import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; blogSlug: string }> }): Promise<Metadata> {
  const { slug, blogSlug } = await params
  const data = await ogFetch<any>(`/studio/blogs/public/${encodeURIComponent(slug)}/${encodeURIComponent(blogSlug)}?track=false`)
  if (!data?.title) return {}

  const title = data.socialTitle || data.seoTitle || data.title
  const description =
    data.socialDescription ||
    data.metaDescription ||
    (data.subtitle ? String(data.subtitle).slice(0, 200) : `A post by ${data.agentName || 'your agent'}.`)

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function BlogPostShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
