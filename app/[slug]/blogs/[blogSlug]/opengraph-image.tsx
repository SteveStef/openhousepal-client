import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderBlogCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A real estate blog post'

export default async function Image({ params }: { params: Promise<{ slug: string; blogSlug: string }> }) {
  const { slug, blogSlug } = await params
  return renderBlogCard(slug, blogSlug, ogFontsSafe())
}
