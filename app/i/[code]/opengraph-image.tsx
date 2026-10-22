import { OG_SIZE, OG_CONTENT_TYPE, ogFontsSafe } from '@/lib/og/shared'
import { renderInviteCard } from '@/lib/og/inviteCard'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'An invitation'

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return renderInviteCard(code, ogFontsSafe())
}
