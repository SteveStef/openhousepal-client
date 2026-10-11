import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'
import { toTitleCase } from '@/lib/cheatSheetContent'

export async function generateMetadata({ params }: { params: Promise<{ openHouseEventId: string }> }): Promise<Metadata> {
  const { openHouseEventId } = await params
  const data = await ogFetch<any>(`/open-house/property/${encodeURIComponent(openHouseEventId)}`)
  const p = data?.property || {}
  const address = [p.address, p.city].filter(Boolean).map((v: string) => toTitleCase(String(v))).join(', ')  // MLS caps -> Title Case

  const title = address ? `Open house — ${address}` : 'Open house'
  const description = p.agentName
    ? `${address ? `${address}. ` : ''}Hosted by ${p.agentName}. Sign in when you arrive.`
    : `${address ? `${address}. ` : ''}Sign in when you arrive.`

  return {
    title,
    description,
    // A private client link (one person's report / showcase / visit) - never in search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function OpenHouseShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
