import type { Metadata, Viewport } from 'next'
import { ogFetch, showcaseShareText } from '@/lib/og/shared'

// The page may draw to the very bottom edge of an iPhone, so the details window's Love / Pass bar
// can sit flush on the bottom and pad itself clear of the home indicator (env(safe-area-inset-*)
// only reports real values with viewport-fit=cover). The page pads its own sides for landscape.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

// Server passthrough: renders nothing of its own, only contributes the share-preview text.
// (page.tsx is a client component and can't export metadata itself.) The preview IMAGE is
// /api/og/showcase, versioned below.
export async function generateMetadata({ params }: { params: Promise<{ shareToken: string }> }): Promise<Metadata> {
  const { shareToken } = await params
  const data = await ogFetch<any>(`/collections/shared/${encodeURIComponent(shareToken)}`, 120)
  // Reads well as an iMessage / text bubble: "Dana's personal Showcase" over "30 homes picked for you by ...".
  const { title, description, v } = showcaseShareText(data)
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
