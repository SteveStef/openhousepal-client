import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

// The invitation's link preview text (the image is opengraph-image.tsx next to this file).
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const data = await ogFetch<any>(`/invites/public/${encodeURIComponent(code)}`, 120)
  if (!data) return { title: 'Invitation', robots: { index: false, follow: false } }
  const host = data.agent?.name || ''
  const place = [data.place_name, data.address].filter(Boolean).join(', ')
  const title = data.title || "You're invited"
  const description = [data.when_label, place, host ? `Hosted by ${host}` : ''].filter(Boolean).join(' · ') + ' - tap to RSVP.'
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
