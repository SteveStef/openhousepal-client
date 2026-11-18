import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8081'

// Passthrough layout — renders nothing itself, only contributes the share-preview text for the
// public Agent Hub (and, as a fallback, its /sales and /listings sub-pages). Deeper routes that
// export their own generateMetadata (blogs, forms) override this. The preview IMAGE comes from
// /api/og/hub (versioned below).
// Owner 11/18: a Hub (on openhousepal.com/<slug> or shown by an agent's own domain) never wears
// OpenHousePal's homepage title or its "this page is really openhousepal.com" canonical - those made
// Google list an agent's domain as "Real Estate Agent Software ... | OpenHousePal". A Hub that isn't
// live tells Google to drop it; a temporary hiccup reaching the API changes nothing.
const NO_CANONICAL = { canonical: null }

async function hubStatus(slug: string): Promise<'live' | 'gone' | 'unknown'> {
  try {
    const res = await fetch(`${API_BASE}/agent-hub/public/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' }, next: { revalidate: 60 } })
    if (res.ok) return 'live'
    return res.status === 404 ? 'gone' : 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60)
  const profile = data?.config?.profile || {}
  const name = profile.name

  if (!name) {
    const gone = !data && (await hubStatus(slug)) === 'gone'
    return gone
      ? { title: 'Page not available', description: null, robots: { index: false, follow: false }, alternates: NO_CANONICAL, openGraph: null, twitter: null }
      : { alternates: NO_CANONICAL }
  }

  const title = `${name}${profile.brokerage ? ` · ${profile.brokerage}` : ''}`
  const description =
    (profile.about && String(profile.about).slice(0, 180)) ||
    `${name}${profile.market ? `, serving ${profile.market}` : ''}. Listings, recent sales, and how to get in touch.`

  // The card's address changes whenever the agent saves their hub or Settings (savedAt), so apps
  // that cache previews by address (iMessage, Facebook, Slack) pick up a new photo, name or look.
  const v = encodeURIComponent(String(data?.config?.savedAt || '').replace(/\D/g, '').slice(-12) || '1')
  const image = { url: `/api/og/hub?agent=${encodeURIComponent(slug)}&v=${v}`, width: 1200, height: 630, alt: name }
  return {
    title,
    description,
    alternates: NO_CANONICAL,
    openGraph: { title, description, type: 'profile', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function AgentPublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
