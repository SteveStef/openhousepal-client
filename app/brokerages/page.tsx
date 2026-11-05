import { Building2, CreditCard, Palette, Search, Users } from 'lucide-react'
import AskQuestionBlock from '@/components/marketing/AskQuestionBlock'
import MarketingPage, { FeatureCard, MarketingSection, marketingMeta } from '@/components/marketing/MarketingPage'

export const metadata = marketingMeta('/brokerages', 'Software for Real Estate Brokerages', 'OpenHousePal for real estate brokerages: give your agents open house, lead and marketing tools, with brokerage billing in one place.')

export default function BrokeragesPage() {
  return (
    <MarketingPage path="/brokerages" kicker="For Brokerages" title="Give every agent in your office better tools" accent="better tools" motif="pin"
      lead="OpenHousePal gives your agents one place for open houses, leads and marketing, so they spend less time on busywork and more time with clients.">
      <MarketingSection title="Why brokerages use it">
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard icon={CreditCard} title="One bill for your agents">Put your agents in a brokerage group and pay for their plan in one place, so they don&apos;t each need to set up billing.</FeatureCard>
          <FeatureCard icon={Search} title="More open houses get hosted">Discovery lets agents find listings in your brokerage to host and send the listing agent a request in a couple of taps.</FeatureCard>
          <FeatureCard icon={Building2} title="Hosting on one board">Manager shows which weekends need a host, tracks requests, and shows sign-in stats after each open house.</FeatureCard>
          <FeatureCard icon={Users} title="Every visitor followed up">Sign-ins go straight into each agent&apos;s Leads, so open house visitors don&apos;t sit on paper.</FeatureCard>
          <FeatureCard icon={Palette} title="Polished marketing">Flyers, mailers, social posts and websites look professional, and every agent keeps their own brand.</FeatureCard>
        </div>
      </MarketingSection>
      <MarketingSection title="Talk to us" lead="Tell us about your office and we'll get back to you.">
        <AskQuestionBlock />
      </MarketingSection>
    </MarketingPage>
  )
}
