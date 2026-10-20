import type { Metadata } from 'next'
import { cardVersion, ogFetch } from '@/lib/og/shared'
import { salesSummary } from '@/lib/agentSales'

// The Sales page's share preview (link previews #11): "Recent Sales · Dana Smith", how many homes
// they've sold and where, and its own card (/api/og/sales) - instead of the Agent Hub's business
// card, which the parent layout gives every page under /<slug>. Old /AgentHub/<slug>/sales links
// redirect here, so they unfurl the same.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await ogFetch<any>(`/agent-hub/public/${encodeURIComponent(slug)}`, 60)
  const cfg = data?.config || {}
  const profile = cfg.profile || {}
  const name: string | undefined = profile.name
  if (!name) return {}

  const s = salesSummary(cfg)
  const title = `Recent Sales · ${name}`
  const description = s.count
    ? `${s.headline}${s.sub ? ` · ${s.sub.replace(/\s+·\s+/g, ' · ')}` : ''}. Homes ${name}${profile.brokerage ? ` of ${profile.brokerage}` : ''} has sold, and what's on the market now.`
    : `Homes ${name}${profile.brokerage ? ` of ${profile.brokerage}` : ''} has sold, and what's on the market now.`
  // A new address whenever what the card shows changes (sales, photo, name, look) - apps cache previews by address.
  const v = cardVersion('c1', cfg.savedAt, s.count, s.volume, s.photos.slice(0, 3).join(','), name, profile.brokerage, cfg.profilePhotoUrl, cfg.hubTheme, cfg.hubLuxeMetal, cfg.hubAccent, cfg.visitorDarkMode)
  const image = { url: `/api/og/sales?agent=${encodeURIComponent(slug)}&v=${v}`, width: 1200, height: 630, alt: `${name} - recent sales` }
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: `/${encodeURIComponent(slug)}/sales`, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default function AgentSalesLayout({ children }: { children: React.ReactNode }) {
  return children
}
