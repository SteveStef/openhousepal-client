import type { Metadata } from 'next'
import { ogFetch, showcaseHomeShareText, showcaseShareText } from '@/lib/og/shared'

// One home inside a client's Showcase (/showcase/dana-k7q2/732-buck-ln) - the link the agent's
// Send makes. Its preview is that home's own card ("Inside Dana's Showcase", price, street, beds /
// baths, the agent); a home no longer in the Showcase falls back to the Showcase's card.
export async function generateMetadata({ params }: { params: Promise<{ shareToken: string; home: string }> }): Promise<Metadata> {
  const { shareToken, home } = await params
  const data = await ogFetch<any>(`/collections/shared/${encodeURIComponent(shareToken)}`, 120)
  const one = showcaseHomeShareText(data, decodeURIComponent(home))
  const { title, description, v } = one || showcaseShareText(data)
  const url = one
    ? `/api/og/showcasehome?token=${encodeURIComponent(shareToken)}&home=${encodeURIComponent(home)}&v=${v}`
    : `/api/og/showcase?token=${encodeURIComponent(shareToken)}&v=${v}`
  const image = { url, width: 1200, height: 630, alt: title }
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function ShowcaseHomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
