import Link from 'next/link'
import { BarChart3, Globe, Home, Inbox, Layout, Map, Newspaper, Search } from 'lucide-react'
import MarketingPage, { FeatureCard, MarketingSection, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { PRICING_PLANS } from '@/lib/pricing'

export const metadata = marketingMeta('/idx-websites', 'IDX Websites for Real Estate Agents', 'A complete IDX website for real estate agents, built for you and branded to you, with full MLS search, a page for every home, neighborhood guides and every inquiry in your Leads.')

const PARTS = [
  { icon: Search, title: 'Full MLS search', text: 'Visitors search every home for sale on a map, right on your website.' },
  { icon: Home, title: 'A page for every home', text: 'Each listing gets its own page, with your featured and newly listed homes up front.' },
  { icon: Map, title: 'Neighborhood guides', text: 'Town pages with live market data and side-by-side town comparisons.' },
  { icon: BarChart3, title: 'Your sales and reviews', text: 'Your track record, on your own site, updated as you close.' },
  { icon: Newspaper, title: 'Your blogs', text: 'Local articles you write with Blog Builder show on your website.' },
  { icon: Layout, title: 'Showcases visitors build', text: 'Visitors set up their own home search and get new matches.' },
  { icon: Inbox, title: 'Every inquiry in your Leads', text: 'Forms, tour requests and showings go straight into your Leads.' },
  { icon: Globe, title: 'Your own domain', text: 'Connect a domain you own, or get a new one, and your links move onto it.' },
]

export default function IdxWebsitesPage() {
  return (
    <MarketingPage path="/idx-websites" kicker="IDX Websites" title="A complete real estate website, built for you" accent="built for you" motif="house"
      lead={`Your own IDX website, branded to you, with the rest of OpenHousePal behind it. Included in the IDX plan at ${PRICING_PLANS.IDX.priceString} a month, plus a setup fee. Your domain is not included.`}>
      <MarketingSection title="What's on your website">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTS.map(p => <FeatureCard key={p.title} icon={p.icon} title={p.title}>{p.text}</FeatureCard>)}
        </div>
      </MarketingSection>
      <MarketingSection title="Part of everything else you use" lead="Your website isn't a separate system. It runs on the same listings, leads, forms and branding as the rest of your account.">
        <Link href="/tools" data-reveal="" className="mk-cta inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517] dark:text-white">See all tools</Link>
      </MarketingSection>
      <TrialBand idx />
    </MarketingPage>
  )
}
