import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import ToolsExplorer from '@/components/marketing/ToolsExplorer'

export const metadata = marketingMeta('/tools', 'All Tools for Real Estate Agents', 'Every OpenHousePal tool for real estate agents, shown working: open house sign-in, kits, forms, CMAs, Showcases, Agent Hub, Studio, Media Lab, blogs and IDX websites.')

export default function ToolsPage() {
  return (
    <MarketingPage path="/tools" kicker="All Tools" title="Every tool, shown working" accent="shown working" motif="key"
      lead="OpenHousePal runs your open houses, follows up with your leads and markets you and your listings, all branded to you. What's included depends on your plan.">
      <ToolsExplorer />
      <TrialBand />
    </MarketingPage>
  )
}
