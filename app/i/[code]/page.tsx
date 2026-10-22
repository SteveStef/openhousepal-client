import { headers } from 'next/headers'
import InvitePublicPage from '@/components/invites/InvitePublicPage'

// The guest's invitation - openhousepal.com/i/<code>, or <agent's own domain>/i/<code> (proxy.ts
// sends /i/ on an agent's domain straight here). The host it was opened on is passed down so the
// backend can make sure an agent's domain only ever shows that agent's invites.
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const h = await headers()
  const host = (h.get('x-forwarded-host') || h.get('host') || '').toLowerCase()
  return <InvitePublicPage code={code} host={host} />
}
