import type { Metadata } from 'next'
import { ogFetch, firstName } from '@/lib/og/shared'

// Server passthrough: renders nothing of its own, only contributes the share-preview text.
// (page.tsx is a client component and can't export metadata itself.) The preview IMAGE is
// /api/og/showcase, versioned below.
export async function generateMetadata({ params }: { params: Promise<{ shareToken: string }> }): Promise<Metadata> {
  const { shareToken } = await params
  const data = await ogFetch<any>(`/collections/shared/${encodeURIComponent(shareToken)}`, 120)
  const agent = data?.agentFullName || data?.agentName
  const raw = firstName(data?.customer?.firstName)
  const forName = raw && raw === raw.toUpperCase() ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw
  const count = Array.isArray(data?.matchedProperties) ? data.matchedProperties.length : 0

  // Reads well as an iMessage / text bubble: "Dana's Showcase" over "30 homes picked for you by ...".
  const title = forName ? `${forName}’s Showcase` : 'Your personal home Showcase'
  const description = agent
    ? `${count ? `${count} homes` : 'Homes'} hand-picked for you by ${agent} - updated the moment new ones list. Tap a home to save it, comment or book a tour.`
    : 'Homes hand-picked for you - updated the moment new ones list. Tap a home to save it, comment or book a tour.'

  // The card's address changes when new homes land (newest home + count), so iMessage never
  // reuses an old card for a client the agent has texted before - a follow-up text always shows
  // the homes that are in their Showcase now.
  const homes: any[] = Array.isArray(data?.matchedProperties) ? data.matchedProperties : []
  const newest = homes.reduce((m, h) => Math.max(m, Date.parse(h?.AddedAt || '') || 0), 0)
  const v = `${count}-${Math.floor(newest / 60000) || 0}`
  const image = { url: `/api/og/showcase?token=${encodeURIComponent(shareToken)}&v=${v}`, width: 1200, height: 630, alt: title }

  return {
    title,
    description,
    // A private client link (one person's report / showcase / visit) - never in search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function ShowcaseShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
