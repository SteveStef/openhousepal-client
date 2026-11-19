import Link from 'next/link'
import { ArrowRight, BarChart3, Building2, CalendarCheck, Check, Columns2, Eye, Globe, Home, Inbox, Layers, LayoutTemplate, MapPin, Moon, Newspaper, Palette, Plus, Power, Search, Sparkles, Star, UserRound, type LucideIcon } from 'lucide-react'
import Footer from '@/components/Footer'
import MarketingMotion from '@/components/marketing/MarketingMotion'
import { MarketingNav, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import SectionHead from '@/components/marketing/SectionHead'
import { IdxPlanWide } from '@/components/pricing/PricingCards'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { BROKER_CSS } from '@/components/brokerages/brokerCss'
import IdxHeroBoard from '@/components/idx/IdxHeroBoard'
import IdxDemos from '@/components/idx/IdxDemos'
import IdxPillarArt, { ArtStage, ControlArt } from '@/components/idx/IdxPillarArt'

export const metadata = marketingMeta('/idx-websites', 'IDX Websites for Real Estate Agents', 'A complete IDX website for real estate agents, built for you and branded to you, with full MLS search, a page for every home, neighborhood guides and every inquiry in your Leads.')

// Rebuilt 11/18 to the Brokerages page's level (owner). Every claim matches the app (helper_guide
// "Your IDX website", the fact-checked Tools pages); the price comes only from lib/pricing.ts.
const IDX = PRICING_PLANS.IDX
const SPARKS: [string, string, string][] = [['6%', '20%', '0s'], ['46%', '12%', '1.2s'], ['30%', '78%', '2.1s'], ['88%', '14%', '.7s'], ['64%', '88%', '3s'], ['96%', '60%', '1.8s']]

type Feature = { icon: LucideIcon; title: string; text: string }
const PILLARS: { key: string; icon: LucideIcon; name: string; line: string; features: Feature[] }[] = [
  {
    key: 'homes', icon: Search, name: 'Homes', line: 'Search that keeps buyers on your site.', features: [
      { icon: Search, title: 'Full MLS map search', text: 'Buyers search every Bright MLS home on a map, right on your site.' },
      { icon: Home, title: 'A page for every home', text: 'Photos, details, nearby schools and a showing button.' },
      { icon: Star, title: 'Featured, Just Listed, Open Houses', text: 'Your listings first, then the homes you pick.' },
      { icon: BarChart3, title: 'Recently sold', text: 'Your sales show your track record as you close.' },
    ],
  },
  {
    key: 'towns', icon: MapPin, name: 'Your towns', line: 'Local pages that show you know the area.', features: [
      { icon: MapPin, title: 'A guide for every town', text: 'Schools, parks, getting around and market data for up to 15 places you serve.' },
      { icon: Columns2, title: 'Compare towns', text: 'Two towns side by side, before buyers pick.' },
    ],
  },
  {
    key: 'you', icon: UserRound, name: 'You', line: 'Why a visitor should call you.', features: [
      { icon: UserRound, title: 'About you and your reviews', text: 'Your story, your photo and your best reviews.' },
      { icon: Newspaper, title: 'Your blog', text: 'Posts from Blog Builder show up on their own.' },
    ],
  },
  {
    key: 'leads', icon: Inbox, name: 'Leads', line: 'Every visitor has an easy way to reach you.', features: [
      { icon: Inbox, title: 'Forms that open on the page', text: 'Home value, home search and contact, without leaving your site.' },
      { icon: CalendarCheck, title: 'Book a showing', text: 'A buyer picks a day and time. It lands in your Leads.' },
      { icon: LayoutTemplate, title: 'Saved searches', text: 'A saved search becomes a Showcase that keeps sending matches.' },
    ],
  },
  {
    key: 'look', icon: Palette, name: 'Your look', line: 'Branded to you, arranged your way.', features: [
      { icon: Sparkles, title: 'Classic or Luxe', text: 'Clean and bright, or cinematic with metallic accents.' },
      { icon: Moon, title: 'Ivory or Midnight', text: 'Light or dark, in your colors, logo and fonts.' },
      { icon: Layers, title: 'Your sections, your order', text: 'Drag them, switch them on or off, then publish.' },
    ],
  },
  {
    key: 'found', icon: Globe, name: 'Getting found', line: 'Your name, on your own address.', features: [
      { icon: Eye, title: 'How you look on Google', text: 'Set your name, headline and icon, with a live preview.' },
      { icon: Globe, title: 'Your own domain', text: 'Start free, then connect yours or get a new one.' },
    ],
  },
]
const MARQUEE = PILLARS.flatMap(p => p.features.map(f => ({ title: f.title, icon: f.icon })))

const BUILDS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Home, title: 'Your listings and sales', text: 'From Bright MLS, kept up to date' },
  { icon: MapPin, title: 'Your towns', text: 'Each one gets its own guide' },
  { icon: Newspaper, title: 'Your blog', text: 'Published posts appear on your site' },
  { icon: Star, title: 'Your reviews', text: 'On your Reviews page' },
  { icon: Palette, title: 'Your brand', text: 'Colors, logo and photo from your Branding' },
]

const ADDRESS_STEPS = [
  { title: 'A free address, right away', text: 'Every IDX website gets yourname.openhousepal.com, set up for you.' },
  { title: 'Connect a domain you own', text: 'Pick your domain company and follow its exact clicks, with copy buttons. Usually live within an hour.' },
  { title: 'Or get a new one here', text: 'Registered in your name with your home address kept private. You see the yearly price before you pay.' },
]

const CONTROL: { icon: LucideIcon; title: string; text: string; art: 'draft' | 'off' | 'keep' }[] = [
  { icon: Eye, art: 'draft', title: 'Draft first, then publish', text: 'Changes stay private until you publish.' },
  { icon: Power, art: 'off', title: 'Turn it off any time', text: 'Your links move to openhousepal.com, and it comes back exactly as published.' },
  { icon: Building2, art: 'keep', title: 'Already have a website?', text: 'Keep it. Leave this off and every other tool still works.' },
]

const FAQS = [
  { q: 'Do I need my own domain?', a: 'No. Every IDX website starts on a free address, yourname.openhousepal.com. You can connect a domain you own, or get a new one, whenever you like. The domain itself isn’t included in the plan price.' },
  { q: 'Which homes does it show?', a: 'Homes for sale in Bright MLS, with your own listings first wherever you choose. The IDX plan is for agents in Bright MLS.' },
  { q: 'Does it follow Bright MLS’s IDX rules?', a: 'Yes. Every home shows the brokerage that listed it, the Bright MLS notice is on your pages, and homes that are no longer for sale come off your site.' },
  { q: 'Where do inquiries go?', a: 'Straight into your Leads, with a bell alert, an email and a follow-up for you. Showing requests arrive with the day and time the visitor picked.' },
  { q: 'I already have a website. Can I keep it?', a: 'Yes. Tell us you already have one and your IDX website stays off. Your Agent Hub, open houses and leads keep working, and you can switch the IDX website on later in Settings.' },
  { q: 'What happens if I turn it off?', a: 'Nothing is deleted. New QR codes, Guest Passes, Showcases and links use openhousepal.com, and links you already handed out keep working. Switch it back on and it returns exactly as published.' },
  { q: 'Is there a free trial?', a: `The IDX plan starts right away, with a one-time setup fee. The Basic and Premium plans start with a ${TRIAL_PERIOD_DAYS}-day free trial, and you can move up to IDX any time.` },
]

export default function IdxWebsitesPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style dangerouslySetInnerHTML={{ __html: BROKER_CSS }} />
      <MarketingMotion />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_130%_at_50%_-20%,#2c2418_0%,#111827_52%,#0b0b0b_100%)] pb-20 pt-6 sm:pb-28 sm:pt-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden"><span className="mk-sweep block h-full w-full bg-gradient-to-r from-transparent via-[#f3dfa8] to-transparent" /></span>
        {SPARKS.map(([l, t, d]) => <span key={l + t} aria-hidden className="mk-spark absolute -z-10 h-1 w-1 rounded-full bg-[#f3dfa8]" style={{ left: l, top: t, animationDelay: d }} />)}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(201,162,77,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(201,162,77,.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(70%_60%_at_70%_40%,#000,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <MarketingNav path="/idx-websites" onDark />
          <div className="mt-10 grid items-center gap-14 lg:mt-14 lg:grid-cols-[1.02fr_.98fr]">
            <div className="min-w-0">
              <p className="mk-rise text-xs font-black uppercase tracking-[0.3em] text-[#e8c97a]">IDX Websites</p>
              <h1 className="mk-rise mt-3 font-serif text-[2.6rem] font-black leading-[1.03] tracking-tight text-white max-[359px]:text-[2.2rem] sm:text-6xl lg:text-[4.2rem]" style={{ ['--d' as string]: '90ms' }}>
                A complete real estate website, <em className="mk-gold font-serif italic">built for you</em>
              </h1>
              <p className="mk-rise mt-5 max-w-xl text-lg font-medium leading-relaxed text-gray-300 sm:text-xl" style={{ ['--d' as string]: '180ms' }}>
                Full MLS search, a page for every home, guides for your towns and every inquiry in your Leads. It builds itself from what you already set up, and it&apos;s branded to you.
              </p>
              <div className="mk-rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ ['--d' as string]: '260ms' }}>
                <Link href="#pricing" className="mk-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-7 py-4 text-base font-black text-[#111827]">
                  See the IDX plan <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#demo" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-7 py-4 text-base font-black text-white transition-colors hover:border-[#C9A24D] hover:text-[#f3dfa8]">
                  Watch it in action
                </Link>
              </div>
              <ul className="mk-rise mt-7 grid grid-cols-2 gap-x-5 gap-y-2 text-sm font-semibold text-gray-300 sm:flex sm:flex-wrap" style={{ ['--d' as string]: '340ms' }}>
                {['Full Bright MLS search', 'Free address or your own domain', 'Every inquiry in your Leads', `${IDX.priceString} a month`].map(t => (
                  <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="mk-rise min-w-0 pb-6 sm:pb-0" style={{ ['--d' as string]: '220ms' }}><IdxHeroBoard /></div>
          </div>
        </div>
      </section>

      {/* Everything on it, scrolling by */}
      <div className="br-marquee-wrap relative overflow-hidden border-y border-[#C9A24D]/20 bg-[#111827] py-3.5" aria-label="What your website includes">
        <div className="br-marquee flex w-max gap-3">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} aria-hidden={i >= MARQUEE.length || undefined} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[13px] font-black text-gray-200">
              <m.icon className="h-3.5 w-3.5 text-[#C9A24D]" /> {m.title}
            </span>
          ))}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#111827] to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#111827] to-transparent" />
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        {/* It builds itself */}
        <section className="mt-16 sm:mt-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <SectionHead kicker="No web designer needed" title="It builds itself from what you already have" accent="what you already have"
              lead="Your website runs on the same listings, sales, towns, blogs and branding as the rest of OpenHousePal. Change something once, and your site keeps up." />
            <div data-reveal="" className="min-w-0">
              <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(130%_120%_at_0%_0%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] p-6 text-white ring-1 ring-[#C9A24D]/30 sm:p-8">
                <span aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.35),transparent_70%)]" />
                <p className="relative inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.24em] text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> Already on your site</p>
                <ul className="relative mt-5 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
                  {BUILDS.map(b => (
                    <li key={b.title} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[#e8c97a]"><b.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-black">{b.title}</span>
                        <span className="block text-[13px] font-semibold text-gray-400">{b.text}</span>
                      </span>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Everything on your website */}
        <section className="mt-20 sm:mt-28" id="features">
          <SectionHead center kicker="What's on your website" title="Everything a buyer or seller looks for" accent="a buyer or seller looks for"
            lead="Homes, towns, you, and an easy way to reach you on every page." />
          <div className="mt-12 space-y-6 sm:space-y-8">
            {PILLARS.map((p, n) => (
              // Owner 11/18: every section boxed, words on the left and the picture always on the right.
              <div key={p.key} className="grid items-center gap-6 rounded-[28px] border border-gray-200 bg-white p-4 shadow-[0_24px_60px_-40px_rgba(17,24,39,.45)] dark:border-white/10 dark:bg-[#111114] sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-8">
                <div data-reveal="" className="order-last min-w-0"><IdxPillarArt pillar={p.key} /></div>
                <div className="min-w-0 px-1 sm:px-0">
                  <div data-reveal="" className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><p.icon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">{String(n + 1).padStart(2, '0')} / {String(PILLARS.length).padStart(2, '0')}</p>
                      <h3 className="font-serif text-3xl font-black leading-tight text-[#0B0B0B] dark:text-white sm:text-4xl">{p.name}</h3>
                    </div>
                  </div>
                  <p data-reveal="" className="mt-3 text-lg font-semibold text-[#4b5563] dark:text-gray-300">{p.line}</p>
                  <ul className="mt-5 space-y-2.5">
                    {p.features.map(f => (
                      <li key={f.title} data-reveal="" className="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-[#faf9f7] px-4 py-3.5 dark:border-white/10 dark:bg-[#18181b]">
                        <span className="mk-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><f.icon className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="block text-[16px] font-black leading-snug text-[#111827] dark:text-white">{f.title}</span>
                          <span className="mt-0.5 block text-[14px] font-medium leading-snug text-[#6B7280] dark:text-gray-400">{f.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Demos */}
        <section className="mt-20 scroll-mt-20 sm:mt-28" id="demo">
          <SectionHead center kicker="See it working" title="A real agent's website, start to finish" accent="start to finish"
            lead="Watch the website build itself, a Listing Spotlight come together, and a buyer's Showcase fill with homes." />
          <div className="mt-10"><IdxDemos /></div>
        </section>

        {/* Your address */}
        <section className="mt-20 sm:mt-28">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <SectionHead kicker="Your address" title="On a free address or your own domain" accent="your own domain"
                lead="Start today on a free address. Move to your own domain whenever you're ready, and your links follow." />
              <ol className="mt-8">
                {ADDRESS_STEPS.map((s, i) => (
                  <li key={s.title} data-reveal="" className="relative flex gap-4 pb-7 last:pb-0">
                    {i < ADDRESS_STEPS.length - 1 && <span aria-hidden className="absolute bottom-0 left-[19px] top-11 w-0.5 bg-gradient-to-b from-[#C9A24D]/60 to-[#C9A24D]/10" />}
                    <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] font-serif text-lg font-black text-[#111827]">{i + 1}</span>
                    <span className="min-w-0 pt-1">
                      <span className="block text-lg font-black text-[#111827] dark:text-white">{s.title}</span>
                      <span className="mt-1 block text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div data-reveal="" className="min-w-0 rounded-3xl border border-[#C9A24D]/30 bg-white p-6 dark:bg-[#151517] sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Good to know</p>
              <ul className="mt-4 space-y-3 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">
                {[
                  'Once your domain is live, new QR codes, Guest Passes, Showcases and links use it.',
                  'Links you already handed out keep working.',
                  'Every page works with or without www, and on https.',
                  'The domain itself isn’t included in the plan price.',
                ].map(t => <li key={t} className="flex gap-2.5"><Check className="mt-1 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {t}</li>)}
              </ul>
              <div className="mt-6 rounded-2xl bg-[#faf6ee] p-4 dark:bg-white/[0.04]">
                <p className="text-[13px] font-black text-[#111827] dark:text-white">Step-by-step for your domain company</p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {['GoDaddy', 'Squarespace', 'Namecheap', 'Wix', 'IONOS', 'Cloudflare', 'Porkbun', 'Hostinger'].map(c => (
                    <span key={c} className="rounded-full border border-[#C9A24D]/30 bg-white px-2.5 py-1 text-[12px] font-bold text-[#8b6a2b] dark:bg-transparent dark:text-[#e8c97a]">{c}</span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* You're in control */}
        <section className="mt-20 sm:mt-28">
          <SectionHead kicker="You're in charge" title="Your website, on your terms" accent="on your terms" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROL.map((c, i) => (
              <article key={c.title} data-reveal="" className={`mk-card overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#151517] ${i === CONTROL.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                <ArtStage className="flex h-28 items-center justify-center rounded-none px-4 ring-0"><ControlArt kind={c.art} /></ArtStage>
                <div className="p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><c.icon className="h-5 w-5 shrink-0 text-[#C9A24D]" /> {c.title}</h3>
                  <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{c.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Price: one wide "IDX plan" box, cards side by side (owner 11/18 - the tall card made the page too long) */}
        <section className="mt-20 scroll-mt-20 sm:mt-28" id="pricing">
          <SectionHead center kicker="The IDX plan" title="Your website and every other tool" accent="every other tool"
            lead={<>
              <p>{IDX.priceString} a month, plus a one-time setup fee. It includes everything in Basic and Premium, so your website, open houses, leads, Showcases, CMAs and marketing all work together.</p>
              <p className="mt-3 text-sm font-semibold text-gray-400">Your domain isn&apos;t included. <Link href="/pricing" className="font-black text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">Compare every plan</Link></p>
            </>} />
          <div data-reveal="" className="mt-10"><IdxPlanWide /></div>
        </section>

        {/* FAQ */}
        <section className="mt-20 sm:mt-28">
          <SectionHead center kicker="Questions" title="What agents ask about IDX" accent="ask about IDX" />
          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {FAQS.map(f => (
              <details key={f.q} data-reveal="" className="br-faq group rounded-2xl border border-gray-200 bg-white px-5 py-4 open:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#151517]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[16px] font-black text-[#111827] dark:text-white">
                  {f.q}
                  <span className="br-faq-plus grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]"><Plus className="h-4 w-4" strokeWidth={3} /></span>
                </summary>
                <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <TrialBand idx />
      </main>
      <Footer />
    </div>
  )
}
