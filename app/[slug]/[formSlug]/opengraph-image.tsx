import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderFormCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Get in touch'

export default async function Image({ params }: { params: Promise<{ slug: string; formSlug: string }> }) {
  const { slug, formSlug } = await params
  return renderFormCard(slug, formSlug, ogFontsSafe())
}
