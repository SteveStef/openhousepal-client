import { notFound } from 'next/navigation'
import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import ToolsExplorer from '@/components/marketing/ToolsExplorer'
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'
import type { FeatureTabKey } from '@/components/home/featureTabsData'

export const dynamicParams = false
export function generateStaticParams() { return TOOL_PAGES.map(t => ({ tool: t.slug })) }

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOL_PAGES.find(x => x.slug === tool)
  return t ? marketingMeta(`/tools/${t.slug}`, t.seoTitle, t.description) : {}
}

// A tool's own address: the Tools page, opened on that tool (see ToolsExplorer).
export default async function ToolDetailPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOL_PAGES.find(x => x.slug === tool)
  if (!t) notFound()
  const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
  return (
    <MarketingPage path={`/tools/${t.slug}`} crumb={t.label} kicker="All Tools" title="Every tool, shown working" accent="shown working" motif="key"
      lead="OpenHousePal runs your open houses, follows up with your leads and markets you and your listings, all branded to you. What's included depends on your plan.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <ToolsExplorer initial={t.demo as FeatureTabKey} />
      <TrialBand />
    </MarketingPage>
  )
}
