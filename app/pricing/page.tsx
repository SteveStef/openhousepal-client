import MarketingPage, { MarketingSection, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { BasicPricingCard, IdxPricingCard, NoMlsPricingCard, PremiumPricingCard, ProNoMlsPricingCard } from '@/components/pricing/PricingCards'
import { TRIAL_PERIOD_DAYS } from '@/lib/pricing'

export const metadata = marketingMeta('/pricing', 'Pricing and Plans for Agents', `OpenHousePal plans for real estate agents. Basic, Premium and IDX for Bright MLS agents, plus No-MLS plans for everyone else, most with a ${TRIAL_PERIOD_DAYS}-day free trial.`)

export default function PricingPage() {
  return (
    <MarketingPage path="/pricing" kicker="Pricing" title="Simple plans for every agent" accent="every agent" motif="star"
      lead={`Pick the plan that matches your MLS and how much you want OpenHousePal to do. Basic, Premium and No-MLS plans start with a ${TRIAL_PERIOD_DAYS}-day free trial, and you can cancel anytime.`}>
      <MarketingSection title="Bright MLS agents">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <BasicPricingCard />
          <PremiumPricingCard />
          <IdxPricingCard />
        </div>
      </MarketingSection>
      <MarketingSection title="Agents outside Bright MLS" lead="The same tools, with your listings and open houses entered by hand.">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <NoMlsPricingCard />
          <ProNoMlsPricingCard />
        </div>
      </MarketingSection>
      <TrialBand />
    </MarketingPage>
  )
}
