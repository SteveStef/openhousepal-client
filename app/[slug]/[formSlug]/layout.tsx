import type { Metadata } from 'next'
import { cardVersion, ogFetch } from '@/lib/og/shared'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; formSlug: string }> }): Promise<Metadata> {
  const { slug, formSlug } = await params
  const [data, hub] = await Promise.all([
    ogFetch<any>(`/agent-hub/forms/public/${encodeURIComponent(slug)}/${encodeURIComponent(formSlug)}`, 60),
    ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60),
  ])
  if (!data?.title && !data?.headline) return {}

  const title = data.headline || data.title
  const description = data.subtitle
    ? String(data.subtitle).slice(0, 200)
    : `Answer a few quick questions and ${data.agentName || 'your agent'} will follow up personally.`

  // The card (lib/og/cards renderFormCard) wears the form's look. Its address changes whenever the
  // form's words, its look or the hub's look / photo change, so apps that cache previews by
  // address (iMessage, Facebook, Slack) show the new one.
  const cfg = hub?.config || {}
  const v = cardVersion('c2', data.headline, data.title, data.subtitle, data.darkMode, JSON.stringify(data.look || null), data.agentPhotoUrl, data.agentName, cfg.savedAt, cfg.hubTheme, cfg.hubLuxeMetal, cfg.hubAccent, cfg.visitorDarkMode)
  const image = { url: `/api/og/form?agent=${encodeURIComponent(slug)}&form=${encodeURIComponent(formSlug)}&v=${v}`, width: 1200, height: 630, alt: title }
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function FormShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
