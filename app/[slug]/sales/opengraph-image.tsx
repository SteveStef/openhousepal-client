import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderHubCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Real estate agent'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return renderHubCard(slug, ogFontsSafe())
}
