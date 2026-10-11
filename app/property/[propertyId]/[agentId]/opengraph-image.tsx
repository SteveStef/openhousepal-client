import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderPropertyCard } from '@/lib/og/cards'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A home for sale'

export default async function Image({ params }: { params: Promise<{ propertyId: string; agentId: string }> }) {
  const { propertyId, agentId } = await params
  return renderPropertyCard(agentId, propertyId, ogFontsSafe())
}
