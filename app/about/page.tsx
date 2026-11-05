import { Clock, Layers, Palette } from 'lucide-react'
import MarketingPage, { FeatureCard, MarketingSection, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import StoryVideo from '@/components/marketing/StoryVideo'

export const metadata = marketingMeta('/about', 'About OpenHousePal', 'OpenHousePal is the all-in-one platform for real estate agents, bringing open houses, leads, marketing and websites together in one place.')

export default function AboutPage() {
  return (
    <MarketingPage path="/about" kicker="About OpenHousePal" title="Built for agents who do the work" accent="do the work" motif="house"
      lead="OpenHousePal is the all-in-one platform for real estate agents. It brings open houses, CMAs, client Showcases, your Agent Hub, blogs and a full IDX website together, so you stop juggling a dozen tools.">
      <MarketingSection title="How it helped" lead="OpenHousePal enabled Peter Stefanatos to sell $15M+ in his first year in real estate - one of the highest volumes in PA - all through open houses run with the right system, the OpenHousePal System.">
        <StoryVideo />
      </MarketingSection>
      <MarketingSection title="What we believe">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard icon={Layers} title="One place">Your listings, leads and marketing should work together, not live in separate apps that never talk to each other.</FeatureCard>
          <FeatureCard icon={Clock} title="Less busywork">Your time belongs with clients. The sign-in sheet, the follow-up reminder and the flyer should mostly take care of themselves.</FeatureCard>
          <FeatureCard icon={Palette} title="Your brand">Everything your clients see carries your name, your photo and your look. OpenHousePal stays in the background.</FeatureCard>
        </div>
      </MarketingSection>
      <TrialBand />
    </MarketingPage>
  )
}
