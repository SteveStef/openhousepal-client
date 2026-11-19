import Link from 'next/link'
import type { ComponentType } from 'react'
import { ArrowRight, ArrowUpRight, Building2, Check, DoorOpen, Globe, Layers, Megaphone, MapPinned, Sparkles, Users, UserRound } from 'lucide-react'
import Footer from '@/components/Footer'
import MarketingMotion from '@/components/marketing/MarketingMotion'
import { MarketingNav, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import SectionHead from '@/components/marketing/SectionHead'
import StoryVideo from '@/components/marketing/StoryVideo'
import { BROKER_CSS } from '@/components/brokerages/brokerCss'
import { BeliefArt, PartArt } from '@/components/marketing/AboutArt'

export const metadata = marketingMeta('/about', 'About OpenHousePal',
  'OpenHousePal is software for real estate agents: QR open house sign-in and kits, lead follow-up, client Showcases, CMAs, an Agent Hub, marketing designs, blogs and IDX websites, all branded to you.')

// Facelift 11/18 (owner: as rich as the Brokerages page, no long paragraphs - a line or two per part
// with short "what you get" points). What each part does still matches the Tools pages, which were
// fact-checked against the app; plan notes match components/pricing/PricingCards.tsx.
type Icon = ComponentType<{ className?: string }>
const PARTS: { icon: Icon; art: 'oh' | 'leads' | 'clients' | 'marketing' | 'site'; title: string; line: string; points: string[]; links: [string, string][] }[] = [
  {
    icon: DoorOpen, art: 'oh', title: 'Open houses', line: 'A printed kit from one address, and visitors sign in on their own phone.',
    points: ['QR sign-in with no app, and every visitor becomes a lead', 'Sign-In Sheet and Brag Sheet, plus a Cheat Sheet and Similar Homes on Bright MLS plans', 'Find homes to host and plan every weekend'],
    links: [['/tools/open-house-sign-in', 'Open House Sign-In'], ['/tools/open-house-kits', 'Open House Kits'], ['/tools/discovery', 'Discovery'], ['/tools/open-house-manager', 'Manager']],
  },
  {
    icon: Users, art: 'leads', title: 'Leads and follow-up', line: 'Every sign-in, form and website inquiry lands in your Leads.',
    points: ['Follow-up reminders added for you, on your calendar', 'A daily briefing of what is waiting on you', 'New leads sent straight to your CRM'],
    links: [['/tools/forms', 'Forms'], ['/tools/calendar-crm-sync', 'Calendar and CRM sync']],
  },
  {
    icon: UserRound, art: 'clients', title: 'Your buyers and sellers', line: 'Buyers get their own home search, and sellers see the reasoning behind your price.',
    points: ['Showcases that add new matches on their own', 'CMAs as a PDF or a link', 'One tap for clients to post on Google and Zillow'],
    links: [['/tools/showcases', 'Showcases'], ['/tools/cma', 'CMA'], ['/tools/review-hub', 'Review Hub']],
  },
  {
    icon: Megaphone, art: 'marketing', title: 'Marketing', line: 'Your brand on everything, made in minutes.',
    points: ['An Agent Hub: one link for everything about you', 'Flyers, mailers and social posts with the details filled in', 'Twilight photos, staged rooms, videos and researched blog articles'],
    links: [['/tools/agent-hub', 'Agent Hub'], ['/tools/studio', 'Studio'], ['/tools/media-lab', 'Media Lab'], ['/tools/blogs', 'Blogs'], ['/tools/email-signature', 'Signature']],
  },
  {
    icon: Globe, art: 'site', title: 'Your website', line: 'A full IDX website on the IDX plan, and a website for each listing.',
    points: ['Map search, a page for every home and town guides', 'A free address or your own domain', 'A Listing Spotlight site for each of your listings'],
    links: [['/idx-websites', 'IDX websites'], ['/tools/listing-spotlight', 'Listing Spotlight']],
  },
]

const STATS: { big: string; label: string }[] = [
  { big: '$15M+', label: 'sold in his first year' },
  { big: 'Open houses', label: 'where the clients came from' },
  { big: '1 system', label: 'the OpenHousePal System' },
]

const WHO: { icon: Icon; title: string; text: React.ReactNode }[] = [
  { icon: MapPinned, title: 'Bright MLS agents', text: 'Basic, Premium and IDX connect to Bright MLS, so your listings, sales and comps come in on their own.' },
  { icon: Layers, title: 'Agents anywhere', text: 'The No-MLS plans don’t need Bright MLS. You add the homes and sales, and every tool uses them.' },
  { icon: Building2, title: 'Teams and brokerages', text: <>Agents host each other&apos;s open houses, and brokerages can bring the whole office. <Link href="/brokerages" className="font-black text-[#8b6a2b] underline underline-offset-2 dark:text-[#e8c97a]">See brokerages</Link></> },
]

const BELIEFS: { art: 'one' | 'less' | 'brand'; title: string; text: string }[] = [
  { art: 'one', title: 'One place', text: 'Listings, leads and marketing, working together.' },
  { art: 'less', title: 'Less busywork', text: 'Sign-ins, reminders and flyers mostly do themselves.' },
  { art: 'brand', title: 'Your brand', text: 'Clients see you. We stay in the background.' },
]

const SPARKS: [string, string, string][] = [['8%', '22%', '0s'], ['91%', '30%', '1.2s'], ['22%', '74%', '2.1s'], ['72%', '16%', '.7s'], ['58%', '82%', '3s'], ['38%', '12%', '1.8s']]

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style dangerouslySetInnerHTML={{ __html: BROKER_CSS }} />
      <MarketingMotion />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_130%_at_50%_-20%,#2c2418_0%,#111827_52%,#0b0b0b_100%)] pb-16 pt-6 sm:pb-24 sm:pt-10">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden"><span className="mk-sweep block h-full w-full bg-gradient-to-r from-transparent via-[#f3dfa8] to-transparent" /></span>
        {SPARKS.map(([l, t, d]) => <span key={l + t} aria-hidden className="mk-spark absolute -z-10 h-1 w-1 rounded-full bg-[#f3dfa8]" style={{ left: l, top: t, animationDelay: d }} />)}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(201,162,77,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(201,162,77,.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(70%_60%_at_70%_40%,#000,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <MarketingNav path="/about" onDark />
          <div className="mt-10 max-w-3xl lg:mt-14">
            <p className="mk-rise text-xs font-black uppercase tracking-[0.3em] text-[#e8c97a]">About OpenHousePal</p>
            <h1 className="mk-rise mt-3 font-serif text-[2.6rem] font-black leading-[1.03] tracking-tight text-white max-[359px]:text-[2.2rem] sm:text-6xl lg:text-7xl" style={{ ['--d' as string]: '90ms' }}>
              Built for agents who <em className="mk-gold font-serif italic">do the work</em>
            </h1>
            <p className="mk-rise mt-5 max-w-2xl text-lg font-medium leading-relaxed text-gray-300 sm:text-xl" style={{ ['--d' as string]: '180ms' }}>
              Software for real estate agents, built around the open house. Every visitor becomes a lead, and everything that turns them into a client is in one place, branded to you.
            </p>
            <ul className="mk-rise mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-gray-300" style={{ ['--d' as string]: '260ms' }}>
              {['Open houses', 'Leads and follow-up', 'Buyers and sellers', 'Marketing', 'Websites'].map(t => (
                <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        {/* The story */}
        <section className="mt-16 sm:mt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[.95fr_1.05fr] lg:gap-14">
            <div className="min-w-0">
              <SectionHead kicker="How it helped" title="Built from real open houses" accent="real open houses"
                lead="Peter Stefanatos ran his open houses with the OpenHousePal System. In his first year in real estate, it helped him sell $15M+, one of the highest volumes in PA." />
              {/* One card: stacked rows on phones, three columns from tablet up (owner 11/18: three tiny cards looked cramped on phones) */}
              <div data-reveal="" className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/25 sm:grid-cols-3">
                {STATS.map(s => (
                  <div key={s.label} className="flex items-center gap-4 bg-white px-5 py-4 dark:bg-[#151517] sm:block sm:px-3 sm:py-5 sm:text-center">
                    <p className="br-ink-gold w-[8.5rem] shrink-0 font-serif text-[1.7rem] font-black leading-none sm:w-auto sm:text-[1.55rem] xl:text-[1.8rem]">{s.big}</p>
                    <p className="text-[14.5px] font-bold leading-snug text-[#6B7280] dark:text-gray-400 sm:mt-2 sm:text-[13px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal="" className="min-w-0"><StoryVideo /></div>
          </div>
        </section>

        {/* What it does */}
        <section className="mt-20 sm:mt-28" id="what">
          <SectionHead center kicker="What OpenHousePal does" title="Five parts that work as one" accent="work as one"
            lead="They share your leads, your listings and your brand. What's included depends on your plan." />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {PARTS.map((p, i) => (
              <article key={p.title} data-reveal="" className={`mk-card flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#151517] ${i === PARTS.length - 1 && PARTS.length % 2 ? 'lg:col-span-2' : ''}`}>
                <div className="relative overflow-hidden bg-[radial-gradient(130%_140%_at_0%_0%,#2c2418_0%,#111827_60%,#0b0b0b_100%)] px-5 py-5 sm:px-6">
                  <span aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.32),transparent_70%)]" />
                  <div className="relative flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.24em] text-[#e8c97a]"><p.icon className="h-3.5 w-3.5" /> {String(i + 1).padStart(2, '0')}</p>
                      <h3 className="mt-1 font-serif text-2xl font-black leading-tight text-white sm:text-[1.7rem]">{p.title}</h3>
                      <p className="mt-1.5 text-[14.5px] font-medium leading-snug text-gray-300">{p.line}</p>
                    </div>
                    <PartArt kind={p.art} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col">
                <div className="flex-1 p-5 sm:p-6">
                  <ul className={`space-y-2.5 ${i === PARTS.length - 1 && PARTS.length % 2 ? 'lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0' : ''}`}>
                    {p.points.map(t => (
                      <li key={t} className="flex gap-2.5 text-[15px] font-semibold leading-snug text-[#374151] dark:text-gray-200">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Tool links: an edge-to-edge strip, two per row (owner 11/18: no bubbles) */}
                <div className={`grid grid-cols-2 gap-px border-t border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10`}>
                  {p.links.map(([href, label], j) => (
                    <Link key={href} href={href} className={`group flex items-center justify-between gap-2 bg-white px-4 py-3.5 text-[13.5px] font-black text-[#8b6a2b] transition hover:bg-[#fbf6ec] dark:bg-[#151517] dark:text-[#e8c97a] dark:hover:bg-[#1d1a14] sm:px-5 ${p.links.length % 2 && j === p.links.length - 1 ? 'col-span-2' : ''}`}>
                      <span className="min-w-0">{label}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
                </div>
              </article>
            ))}
          </div>
          <div data-reveal="" className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/tools" className="mk-cta inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517] dark:text-white">
              Watch every tool working <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="text-sm font-black text-[#8b7355] underline underline-offset-4 dark:text-[#e8c97a]">Compare plans</Link>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mt-20 sm:mt-28">
          <SectionHead kicker="Who it's for" title="Agents who want open houses to turn into clients" accent="turn into clients" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHO.map((w, i) => (
              <article key={w.title} data-reveal="" className={`mk-card rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#151517] ${i === WHO.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                <span className="mk-icon grid h-12 w-12 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><w.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-xl font-black text-[#111827] dark:text-white">{w.title}</h3>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{w.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* What we believe */}
        <section data-reveal="" className="relative isolate mt-20 overflow-hidden rounded-[32px] bg-[radial-gradient(120%_160%_at_50%_-30%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] px-5 py-12 ring-1 ring-[#C9A24D]/30 sm:mt-28 sm:px-10 sm:py-14">
          <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden"><span className="mk-sweep block h-full w-full bg-gradient-to-r from-transparent via-[#f3dfa8] to-transparent" /></span>
          <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.28em] text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> What we believe</p>
          <h2 className="mt-3 font-serif text-[2rem] font-black leading-[1.05] text-white sm:text-5xl">Your time belongs <em className="mk-gold italic">with clients</em></h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {BELIEFS.map(b => (
              <div key={b.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center sm:p-6">
                <div className="grid h-28 place-items-center sm:h-32"><BeliefArt kind={b.art} /></div>
                <div className="min-w-0">
                  <h3 className="mt-3 text-lg font-black text-white sm:mt-4 sm:text-xl">{b.title}</h3>
                  <p className="mt-1 text-[14.5px] font-medium leading-snug text-gray-300">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <TrialBand />
      </main>
      <Footer />
    </div>
  )
}
