import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; formSlug: string }> }): Promise<Metadata> {
  const { slug, formSlug } = await params
  const data = await ogFetch<any>(`/agent-hub/forms/public/${encodeURIComponent(slug)}/${encodeURIComponent(formSlug)}`)
  if (!data?.title && !data?.headline) return {}

  const title = data.headline || data.title
  const description = data.subtitle
    ? String(data.subtitle).slice(0, 200)
    : `Answer a few quick questions and ${data.agentName || 'your agent'} will follow up personally.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function FormShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
