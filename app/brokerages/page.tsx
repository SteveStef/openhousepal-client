import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, MessageCircle, Plus, Sparkles } from 'lucide-react'
import Footer from '@/components/Footer'
import AskQuestionBlock from '@/components/marketing/AskQuestionBlock'
import MarketingMotion from '@/components/marketing/MarketingMotion'
import { MarketingNav, marketingMeta } from '@/components/marketing/MarketingPage'
import { BasicPricingCard, IdxPricingCard, PremiumPricingCard } from '@/components/pricing/PricingCards'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS, type PlanTierId } from '@/lib/pricing'
import BrokerDemos from '@/components/brokerages/BrokerDemos'
import HeroBoard from '@/components/brokerages/HeroBoard'
import OfficeCalculator from '@/components/brokerages/OfficeCalculator'
import { BROKER_CSS } from '@/components/brokerages/brokerCss'
import { BROKER_FAQS, FEATURE_COUNT, OFFICE_STEPS, PILLARS, REASONS, USUAL_STACK } from '@/components/brokerages/brokerageData'

export const metadata = marketingMeta('/brokerages', 'Software for Real Estate Brokerages',
  'OpenHousePal for real estate brokerages: open house sign-in, leads and follow-up, marketing, CMAs and IDX websites for every agent, with one bill for your office.')

// Prices come only from lib/pricing.ts (the numbers the plan cards in PricingCards.tsx show).
const LOWEST = Object.values(PRICING_PLANS).reduce((a, b) => (b.price < a.price ? b : a))
const LADDER: { group: string; tiers: PlanTierId[] }[] = [
  { group: 'Bright MLS agents', tiers: ['BASIC', 'PREMIUM', 'IDX'] },
  { group: 'Agents outside Bright MLS', tiers: ['NO_MLS', 'PRO_NO_MLS'] },
]
const SPARKS: [string, string, string][] = [['6%', '20%', '0s'], ['46%', '12%', '1.2s'], ['30%', '78%', '2.1s'], ['88%', '14%', '.7s'], ['64%', '88%', '3s'], ['96%', '60%', '1.8s']]
const MARQUEE = PILLARS.flatMap(p => p.features.map(f => ({ title: f.title, icon: f.icon })))

// Card widths so no row ends with a lone card: 3 across on computers (the last 2 or 4 go 2 across),
// 2 across on tablets (an odd last card goes full width).
function cellSpan(i: number, n: number) {
  const rem = n % 3
  const wide = (rem === 2 && i >= n - 2) || (rem === 1 && i >= n - 4)
  return `${wide ? 'lg:col-span-3' : 'lg:col-span-2'} ${n % 2 === 1 && i === n - 1 ? 'sm:col-span-2' : ''}`
}

function SectionHead({ kicker, title, accent, lead, center = false }: { kicker: string; title: string; accent?: string; lead?: ReactNode; center?: boolean }) {
  const at = accent ? title.lastIndexOf(accent) : -1
  return (
    <div data-reveal="" className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">{kicker}</p>
      <h2 className="mt-2 font-serif text-[2rem] font-black leading-[1.05] tracking-tight text-[#0B0B0B] dark:text-white sm:text-5xl">
        {at >= 0 ? <>{title.slice(0, at)}<em className="br-ink-gold font-serif italic">{accent}</em>{title.slice(at + (accent?.length || 0))}</> : title}
      </h2>
      <span aria-hidden className={`mt-4 block h-1 w-14 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f3dfa8] ${center ? 'mx-auto' : ''}`} />
      {lead && <p className={`mt-4 text-base font-medium leading-relaxed text-[#6B7280] dark:text-gray-400 sm:text-lg ${center ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>{lead}</p>}
    </div>
  )
}

export default function BrokeragesPage() {
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
          <MarketingNav path="/brokerages" onDark />
          <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-[1.08fr_.92fr]">
            <div className="min-w-0">
              <p className="mk-rise text-xs font-black uppercase tracking-[0.3em] text-[#e8c97a]">For Brokerages</p>
              <h1 className="mk-rise mt-3 font-serif text-[2.6rem] font-black leading-[1.03] tracking-tight text-white max-[359px]:text-[2.2rem] sm:text-6xl lg:text-[4.4rem]" style={{ ['--d' as string]: '90ms' }}>
                Give every agent the <em className="mk-gold font-serif italic">whole toolkit</em>
              </h1>
              <p className="mk-rise mt-5 max-w-xl text-lg font-medium leading-relaxed text-gray-300 sm:text-xl" style={{ ['--d' as string]: '180ms' }}>
                Open houses, leads, follow-up, marketing, CMAs and websites in one login your agents will actually use. Plans start at <b className="text-white">{LOWEST.priceString}</b> per agent a month, with one bill for your office.
              </p>
              <div className="mk-rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ ['--d' as string]: '260ms' }}>
                <Link href="#talk" className="mk-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-7 py-4 text-base font-black text-[#111827]">
                  Talk to us about your office <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#pricing" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-7 py-4 text-base font-black text-white transition-colors hover:border-[#C9A24D] hover:text-[#f3dfa8]">
                  See the prices
                </Link>
              </div>
              <ul className="mk-rise mt-7 grid grid-cols-2 gap-x-5 gap-y-2 text-sm font-semibold text-gray-300 sm:flex sm:flex-wrap" style={{ ['--d' as string]: '340ms' }}>
                {[`${FEATURE_COUNT} tools, one login`, 'One bill for your office', `${TRIAL_PERIOD_DAYS}-day free trial`, 'No app for visitors'].map(t => (
                  <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="mk-rise min-w-0" style={{ ['--d' as string]: '220ms' }}><HeroBoard /></div>
          </div>
        </div>
      </section>

      {/* Every tool, scrolling by */}
      <div className="br-marquee-wrap relative overflow-hidden border-y border-[#C9A24D]/20 bg-[#111827] py-3.5" aria-label="Tools included">
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
        {/* The stack it replaces */}
        <section className="mt-16 sm:mt-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <SectionHead kicker="The value" title="One login instead of a stack of apps" accent="stack of apps"
                lead="Agents often pay for tools like these one at a time, each with its own login and its own bill. OpenHousePal puts them in one place, all working from the same listings and leads." />
              <ul data-reveal="" className="mt-7 flex flex-wrap gap-2">
                {USUAL_STACK.map((s, i) => (
                  <li key={s.label} className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-bold text-gray-500 dark:border-white/10 dark:bg-[#151517] dark:text-gray-400">
                    <s.icon className="h-3.5 w-3.5 shrink-0" /> {s.label}
                    <span aria-hidden className="br-strike absolute inset-x-2 top-1/2 -mt-px h-[2px] rounded-full bg-[#C9A24D]" style={{ ['--sd' as string]: `${300 + i * 70}ms` }} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs font-semibold text-gray-400">Which tools an agent gets depends on their plan.</p>
            </div>
            <div data-reveal="" className="min-w-0">
              <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(130%_120%_at_0%_0%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] p-6 text-white ring-1 ring-[#C9A24D]/30 sm:p-8">
                <span aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.35),transparent_70%)]" />
                <p className="relative inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.24em] text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> OpenHousePal</p>
                <p className="relative mt-2 font-serif text-3xl font-black sm:text-4xl">All of it, in <span className="mk-gold italic">one place</span></p>
                <div className="relative mt-6 space-y-5">
                  {LADDER.map(g => (
                    <div key={g.group}>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{g.group}</p>
                      <ul className="mt-2 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
                        {g.tiers.map(t => (
                          <li key={t} className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="text-[15px] font-black">{PRICING_PLANS[t].name}</span>
                            <span className="shrink-0 text-right"><b className="font-serif text-xl text-[#f3dfa8]">{PRICING_PLANS[t].priceString}</b><span className="text-xs font-bold text-gray-400"> /agent/mo</span></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <Link href="#pricing" className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-black text-[#f3dfa8] hover:underline">What each plan includes <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </div>
        </section>

        {/* Everything agents get */}
        <section className="mt-20 sm:mt-28" id="features">
          <SectionHead center kicker="For your agents" title="Everything your agents get" accent="your agents get"
            lead={`${FEATURE_COUNT} tools that run open houses, follow up with every lead and market every listing, all branded to each agent.`} />
          <div className="mt-12 space-y-14">
            {PILLARS.map(p => (
              <div key={p.key}>
                <div data-reveal="" className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><p.icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h3 className="font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl">{p.name}</h3>
                    <p className="text-sm font-semibold text-[#6B7280] dark:text-gray-400 sm:text-base">{p.line}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  {p.features.map((f, i) => (
                    <article key={f.title} data-reveal="" className={`mk-card relative flex flex-col ${cellSpan(i, p.features.length)} rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]`}>
                      {f.ai && <span className="absolute right-3 top-3 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f1d58b] px-1.5 py-[3px] text-[9px] font-black uppercase leading-none tracking-wider text-[#111827]"><Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />AI</span>}
                      <span className="mk-icon grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><f.icon className="h-5 w-5" /></span>
                      <h4 className="mt-3 text-lg font-black text-[#111827] dark:text-white">{f.title}</h4>
                      <p className="mt-1.5 flex-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{f.text}</p>
                      <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#e8c97a]">{f.plans}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div data-reveal="" className="mt-10 text-center">
            <Link href="/tools" className="mk-cta inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517] dark:text-white">
              Watch every tool in action <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Demos */}
        <section className="mt-20 sm:mt-28" id="demo">
          <SectionHead center kicker="See it working" title="From the front door to the follow-up" accent="the follow-up"
            lead="The parts of OpenHousePal that fill your office's open houses and turn every visitor into a lead." />
          <div className="mt-10"><BrokerDemos /></div>
        </section>

        {/* Why brokerages */}
        <section className="mt-20 sm:mt-28">
          <SectionHead kicker="For your brokerage" title="Good for agents, better for your office" accent="better for your office"
            lead="The same tools that make your agents faster help you recruit, keep your listings covered and keep your brand consistent." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(r => (
              <article key={r.title} data-reveal="" className="mk-card rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#151517]">
                <span className="mk-icon grid h-12 w-12 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a] dark:bg-white/10"><r.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-xl font-black text-[#111827] dark:text-white">{r.title}</h3>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{r.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Office billing */}
        <section className="mt-20 sm:mt-28" id="office">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <SectionHead kicker="Brokerage plans" title="One bill for your whole office" accent="whole office"
                lead="Pay for your agents in one place. They get every tool on their plan, and none of them has to set up billing." />
              <ol className="mt-8">
                {OFFICE_STEPS.map((s, i) => (
                  <li key={s.title} data-reveal="" className="relative flex gap-4 pb-7 last:pb-0">
                    {i < OFFICE_STEPS.length - 1 && <span aria-hidden className="absolute bottom-0 left-[19px] top-11 w-0.5 bg-gradient-to-b from-[#C9A24D]/60 to-[#C9A24D]/10" />}
                    <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] font-serif text-lg font-black text-[#111827]">{i + 1}</span>
                    <span className="min-w-0 pt-1">
                      <span className="block text-lg font-black text-[#111827] dark:text-white">{s.title}</span>
                      <span className="mt-1 block text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div data-reveal="" className="mt-8 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] p-5">
                <p className="text-sm font-black text-[#111827] dark:text-white">Good to know</p>
                <ul className="mt-2 space-y-1.5 text-[14px] font-medium text-[#4b5563] dark:text-gray-300">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> Monthly AI limits keep costs predictable, for each agent or the whole office.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> Bright MLS agents approve OpenHousePal in Bright once, in about two minutes.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> Agents outside Bright MLS use the No-MLS plans.</li>
                </ul>
              </div>
            </div>
            <div data-reveal="" className="min-w-0 lg:sticky lg:top-24"><OfficeCalculator /></div>
          </div>
        </section>

        {/* Plans (the one canonical card per plan) */}
        <section className="mt-20 scroll-mt-20 sm:mt-28" id="pricing">
          <SectionHead center kicker="Plans" title="Low prices, every tool spelled out" accent="every tool spelled out"
            lead={`The standard per-agent plans. Basic, Premium and No-MLS plans start with a ${TRIAL_PERIOD_DAYS}-day free trial.`} />
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-3">
            <BasicPricingCard />
            <PremiumPricingCard />
            <IdxPricingCard />
          </div>
          <p data-reveal="" className="mt-8 text-center text-[15px] font-semibold text-[#4b5563] dark:text-gray-300">
            Agents outside Bright MLS? No-MLS plans start at {PRICING_PLANS.NO_MLS.priceString}.{' '}
            <Link href="/pricing" className="font-black text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">See all plans</Link>
          </p>
        </section>

        {/* FAQ */}
        <section className="mt-20 sm:mt-28">
          <SectionHead center kicker="Questions" title="What brokers ask us" accent="ask us" />
          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {BROKER_FAQS.map(f => (
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

        {/* Talk to us */}
        <section id="talk" className="relative isolate mt-20 scroll-mt-20 overflow-hidden rounded-[32px] bg-[radial-gradient(120%_160%_at_50%_-30%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] px-5 py-12 ring-1 ring-[#C9A24D]/30 sm:mt-28 sm:px-10 sm:py-16">
          <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden"><span className="mk-sweep block h-full w-full bg-gradient-to-r from-transparent via-[#f3dfa8] to-transparent" /></span>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div data-reveal="" className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.28em] text-[#e8c97a]"><MessageCircle className="h-3.5 w-3.5" /> Talk to us</p>
              <h2 className="mt-3 font-serif text-[2.2rem] font-black leading-[1.05] text-white sm:text-5xl">Let&apos;s set up <em className="mk-gold italic">your office</em></h2>
              <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-gray-300 sm:text-lg">Tell us your brokerage, how many agents you have and the plan you&apos;re thinking about. We&apos;ll reply by email with a price for your office and a walkthrough.</p>
              <ul className="mt-6 space-y-2 text-[15px] font-semibold text-gray-200">
                {['One price and one bill for your office', 'We invite your agents for you', 'Every agent keeps their own brand'].map(t => (
                  <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {t}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="mk-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-6 py-3.5 text-[15px] font-black text-[#111827]">Start a free trial <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/pricing" className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3.5 text-[15px] font-black text-white transition-colors hover:border-[#C9A24D] hover:text-[#f3dfa8]">See all pricing</Link>
              </div>
            </div>
            <div data-reveal="" className="min-w-0 rounded-2xl bg-white dark:bg-[#151517] [&>div]:mt-0">
              <AskQuestionBlock />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
