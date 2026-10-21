import type { Metadata } from 'next'
import { ogFetch } from '@/lib/og/shared'
import { toTitleCase } from '@/lib/cheatSheetContent'

export async function generateMetadata({ params }: { params: Promise<{ propertyId: string; agentId: string }> }): Promise<Metadata> {
  const { propertyId, agentId } = await params
  const data = await ogFetch<any>(`/api/properties/agent/${encodeURIComponent(agentId)}/listing/${encodeURIComponent(propertyId)}`)
  const p = data?.property || {}
  // MLS data is all caps - title-case it for the tab title and link previews.
  const address = [p.street_address || p.FullStreetAddress, p.city || p.City].filter(Boolean).map((v: string) => toTitleCase(String(v))).join(', ')
  if (!address) return {}

  // Empty for a sold home this agent didn't list or sell (backend services/sold_branding).
  const agentName = data?.brandingAllowed === false ? null : (data?.agentName || data?.agent_name)
  // A sold home never says "for sale" or "Listed with" (a buyer's agent didn't list it either).
  const sold = /closed|sold/i.test(String(p.MlsStatus || p.home_status || p.StandardStatus || ''))
  const title = `${address} — ${sold ? 'sold' : 'for sale'}`
  const description = sold
    ? `${address}. Photos and details.`
    : agentName
    ? `${address}. Listed with ${agentName}. Photos, details, and how to schedule a tour.`
    : `${address}. Photos, details, and how to schedule a tour.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function PropertyShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
