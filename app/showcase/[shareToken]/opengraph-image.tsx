import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderShowcaseCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A personal home showcase'

export default async function Image({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params
  return renderShowcaseCard(shareToken, ogFontsSafe())
}
