import Link from 'next/link'
import type { ComponentType } from 'react'
import { ArrowUpRight, Building2, Clock, DoorOpen, Globe, Layers, Megaphone, MapPinned, Palette, Users, UserRound } from 'lucide-react'
import MarketingPage, { FeatureCard, MarketingSection, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import StoryVideo from '@/components/marketing/StoryVideo'

export const metadata = marketingMeta('/about', 'About OpenHousePal',
  'OpenHousePal is software for real estate agents: QR open house sign-in and kits, lead follow-up, client Showcases, CMAs, an Agent Hub, marketing designs, blogs and IDX websites, all branded to you.')

// What OpenHousePal does, part by part (owner 11/18: Google reads this page a lot, so it says
// specifically what each part does - checked against the Tools pages, which were fact-checked
// against the app the same day). Plan notes match components/pricing/PricingCards.tsx.
const PARTS: { icon: ComponentType<{ className?: string }>; title: string; text: string; links: [string, string][] }[] = [
  {
    icon: DoorOpen, title: 'Open houses',
    text: 'Enter an address and get a printed kit: a QR Sign-In Sheet and a Brag Sheet, plus a Cheat Sheet and a Similar Homes flyer on Bright MLS plans. Visitors scan the code and sign in on their own phone, with no app, and every visitor becomes a lead. Looking for homes to host? Discovery finds listings at your brokerage, and listing agents can plan every weekend from the Open House Manager.',
    links: [['/tools/open-house-sign-in', 'Open House Sign-In'], ['/tools/open-house-kits', 'Open House Kits'], ['/tools/discovery', 'Discovery'], ['/tools/open-house-manager', 'Manager']],
  },
  {
    icon: Users, title: 'Leads and follow-up',
    text: 'Every sign-in, form answer and website inquiry lands in your Leads. Follow-up reminders are added for you and show up on your calendar, a daily briefing shows what is waiting on you, and new leads can go straight to your CRM.',
    links: [['/tools/forms', 'Forms'], ['/tools/calendar-crm-sync', 'Calendar and CRM sync']],
  },
  {
    icon: UserRound, title: 'Your buyers and sellers',
    text: 'Showcases give a buyer their own home search: new matches are added automatically, and you see every like, comment and tour request. CMAs show a seller the comps and the reasoning behind your price, as a PDF or a link. The Review Hub makes it one tap for happy clients to post on Google and Zillow.',
    links: [['/tools/showcases', 'Showcases'], ['/tools/cma', 'CMA'], ['/tools/review-hub', 'Review Hub']],
  },
  {
    icon: Megaphone, title: 'Marketing',
    text: 'Your Agent Hub is one link for everything about you. Studio makes flyers, mailers and social posts with the property details filled in. Media Lab turns your photos into twilight shots, staged rooms and short videos. Blog Builder writes researched articles about your towns, and your email signature keeps itself up to date.',
    links: [['/tools/agent-hub', 'Agent Hub'], ['/tools/studio', 'Studio'], ['/tools/media-lab', 'Media Lab'], ['/tools/blogs', 'Blogs'], ['/tools/email-signature', 'Signature']],
  },
  {
    icon: Globe, title: 'Your website',
    text: 'On the IDX plan you get a full IDX website, with map search, a page for every home and neighborhood guides, on a free address or your own domain. Each of your listings can also get its own Listing Spotlight website.',
    links: [['/idx-websites', 'IDX websites'], ['/tools/listing-spotlight', 'Listing Spotlight']],
  },
]

export default function AboutPage() {
  return (
    <MarketingPage path="/about" kicker="About OpenHousePal" title="Built for agents who do the work" accent="do the work" motif="house"
      lead="OpenHousePal is software for real estate agents, built around the open house. Visitors sign in on their own phone, every one of them lands in your Leads, and the follow-up, home search, CMAs and marketing that turn them into clients are in the same place, branded to you.">
      <MarketingSection title="How it helped" lead="OpenHousePal enabled Peter Stefanatos to sell $15M+ in his first year in real estate - one of the highest volumes in PA - all through open houses run with the right system, the OpenHousePal System.">
        <StoryVideo />
      </MarketingSection>

      <MarketingSection title="What OpenHousePal does" lead="Each part works on its own, and they all share your leads, your listings and your brand. What's included depends on your plan.">
        <div className="grid gap-4 lg:grid-cols-2">
          {PARTS.map((p, i) => (
            <article key={p.title} data-reveal="" className={`${i === PARTS.length - 1 && PARTS.length % 2 ? 'lg:col-span-2 ' : ''}mk-card flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517] sm:p-6`}>
              <div className="flex items-center gap-3">
                <span className="mk-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><p.icon className="h-5 w-5" /></span>
                <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">{p.title}</h3>
              </div>
              <p className="mt-3 flex-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{p.text}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.links.map(([href, label]) => (
                  <Link key={href} href={href} className="inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/35 bg-[#fbf6ec] px-3 py-1.5 text-[12.5px] font-black text-[#8b6a2b] transition hover:border-[#C9A24D] dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                    {label} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold text-[#8b7355] dark:text-[#e8c97a]">
          <Link href="/tools" className="underline underline-offset-4">See every tool working</Link>
          <span className="mx-2 text-gray-300 dark:text-white/20">·</span>
          <Link href="/pricing" className="underline underline-offset-4">Compare plans</Link>
        </p>
      </MarketingSection>

      <MarketingSection title="Who it's for" lead="Agents who want open houses to turn into clients, with less busywork in between.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard icon={MapPinned} title="Bright MLS agents">The Basic, Premium and IDX plans connect to Bright MLS, so your listings, sales and comps come in on their own.</FeatureCard>
          <FeatureCard icon={Layers} title="Agents anywhere">The No-MLS plans don&apos;t need Bright MLS. You add the property details and sales yourself, and your tools use what you enter.</FeatureCard>
          <FeatureCard icon={Building2} title="Teams and brokerages">Agents can host each other&apos;s open houses, and brokerages can bring their whole office on. <Link href="/brokerages" className="font-black text-[#8b6a2b] underline underline-offset-2 dark:text-[#e8c97a]">See brokerages</Link></FeatureCard>
        </div>
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
