import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

// Passthrough layout — renders nothing itself, only contributes the share-preview text for the
// public Agent Hub (and, as a fallback, its /sales and /listings sub-pages). Deeper routes that
// export their own generateMetadata (blogs, forms) override this. The preview IMAGE comes from
// /api/og/hub (versioned below).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60)
  const profile = data?.config?.profile || {}
  const name = profile.name

  if (!name) return {}

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
    openGraph: { title, description, type: 'profile', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function AgentPublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
