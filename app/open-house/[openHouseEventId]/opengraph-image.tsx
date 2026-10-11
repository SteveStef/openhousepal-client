import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderOpenHouseCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Open house'

export default async function Image({ params }: { params: Promise<{ openHouseEventId: string }> }) {
  const { openHouseEventId } = await params
  return renderOpenHouseCard(openHouseEventId, ogFontsSafe())
}
