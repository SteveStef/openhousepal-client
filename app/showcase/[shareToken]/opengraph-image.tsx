import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderShowcaseCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
// Re-drawn every 2 minutes at most, so a freshly copied link shows the newest homes.
export const revalidate = 120
export const alt = 'A personal home showcase'

export default async function Image({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params
  return renderShowcaseCard(shareToken, ogFontsSafe())
}
