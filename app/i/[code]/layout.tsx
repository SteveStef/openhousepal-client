import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'
import { teaserText } from '@/lib/inviteTitle'

// The invitation's link preview text (the image is opengraph-image.tsx next to this file).
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const data = await ogFetch<any>(`/invites/public/${encodeURIComponent(code)}`, 120)
  if (!data) return { title: 'Invitation', robots: { index: false, follow: false } }
  // Round 6 (owner, 10/24): the link text never gives the home away - no address, no town. Just
  // who invited you to what, and when ("Quinn Reviewer invited you to an Open House" /
  // "Sun, Oct 25 · 1 - 3 PM - tap to RSVP.").
  const { title, description } = teaserText(data)
  return {
    title,
    description,
    // A personal invitation - never in search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children
}
