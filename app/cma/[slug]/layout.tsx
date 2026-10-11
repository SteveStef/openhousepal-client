import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await ogFetch<any>(`/api/cma/public/${encodeURIComponent(slug)}`)
  const subj = data?.subject || {}
  const agent = data?.agent || {}
  const address = [subj.street_address, subj.city].filter(Boolean).join(', ')

  const title = address ? `CMA - ${address}` : 'CMA - Home Value Analysis'
  const description = agent.name
    ? `A market analysis${address ? ` for ${address}` : ''}, prepared by ${agent.name}. See the comparable sales and the recommended price.`
    : `A market analysis${address ? ` for ${address}` : ''}. See the comparable sales and the recommended price.`

  return {
    title,
    description,
    // A private client link (one person's report / showcase / visit) - never in search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function CmaShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
