import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

// Passthrough layout — renders nothing itself, only contributes the share-preview text for the
// public Agent Hub (and, as a fallback, its /sales and /listings sub-pages). Deeper routes that
// export their own generateMetadata (blogs, forms) override this. The preview IMAGE comes from
// opengraph-image.tsx in this folder.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`)
  const profile = data?.config?.profile || {}
  const name = profile.name

  if (!name) return {}

  const title = `${name}${profile.brokerage ? ` · ${profile.brokerage}` : ''}`
  const description =
    (profile.about && String(profile.about).slice(0, 180)) ||
    `${name}${profile.market ? `, serving ${profile.market}` : ''}. Listings, recent sales, and how to get in touch.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function AgentPublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
