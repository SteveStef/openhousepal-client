import Link from 'next/link'
import { ArrowRight, Clock, DoorOpen, Home, MessageSquare, Presentation, Sparkles, Star, type LucideIcon } from 'lucide-react'
import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import SectionHead from '@/components/marketing/SectionHead'
import { ARTICLES } from '@/components/marketing/resourcesData'
import { BROKER_CSS } from '@/components/brokerages/brokerCss'

export const metadata = marketingMeta('/resources', 'Guides for Real Estate Agents', 'Practical guides for real estate agents on running open houses, following up with leads, winning listings and getting more reviews.')

// 11/18 (owner: Resources was plain): a featured guide, topics, and richer cards. Newest first.
const TOPIC_ICON: Record<string, LucideIcon> = {
  'Open houses': DoorOpen, 'Follow-up': MessageSquare, 'Listing appointments': Presentation, 'Listing leads': Home, Reviews: Star,
}
const iconFor = (topic: string) => TOPIC_ICON[topic] || Sparkles
const byNewest = [...ARTICLES].sort((x, y) => y.date.localeCompare(x.date))
const TOPICS = Array.from(new Set(ARTICLES.map(a => a.topic))).map(t => ({ t, n: ARTICLES.filter(a => a.topic === t).length }))

export default function ResourcesPage() {
  const [featured, ...rest] = byNewest
  const FIcon = iconFor(featured.topic)
  return (
    <MarketingPage path="/resources" kicker="Resources" title="Guides for agents who want more business" accent="more business" motif="chat"
      lead="Practical advice on open houses, follow-up, listings and reviews, in plain words. Each one takes a few minutes.">
      <style dangerouslySetInnerHTML={{ __html: BROKER_CSS }} />

      {/* Topics */}
      <div data-reveal="" className="mt-10 flex flex-wrap gap-2">
        {TOPICS.map(({ t, n }) => {
          const I = iconFor(t)
          return (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/35 bg-white px-3 py-1.5 text-[13px] font-bold text-[#111827] dark:border-[#C9A24D]/25 dark:bg-[#151517] dark:text-white">
              <I className="h-3.5 w-3.5 text-[#8b7355] dark:text-[#e8c97a]" /> {t} <span className="text-gray-400">{n}</span>
            </span>
          )
        })}
      </div>

      {/* Featured */}
      <Link href={`/resources/${featured.slug}`} data-reveal="" className="mk-card group relative mt-6 block overflow-hidden rounded-[28px] bg-[radial-gradient(130%_140%_at_0%_0%,#2c2418_0%,#111827_58%,#0b0b0b_100%)] p-6 text-white ring-1 ring-[#C9A24D]/30 sm:p-10">
        <span aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.32),transparent_70%)]" />
        <FIcon aria-hidden className="absolute -bottom-6 right-6 hidden h-40 w-40 text-[#C9A24D] opacity-[0.12] sm:block" />
        <p className="relative inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> New guide · {featured.topic}</p>
        <h2 className="relative mt-3 max-w-2xl font-serif text-[2rem] font-black leading-[1.08] sm:text-5xl">{featured.title}</h2>
        <p className="relative mt-3 max-w-xl text-base font-medium leading-relaxed text-gray-300 sm:text-lg">{featured.description}</p>
        <ul className="relative mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
          {featured.takeaways.map(t => <li key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[13.5px] font-semibold leading-snug text-gray-200">{t}</li>)}
        </ul>
        <span className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-5 py-3 text-[15px] font-black text-[#111827]">
          Read the guide <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      {/* Every guide */}
      <section className="mt-16">
        <SectionHead kicker="All guides" title="Pick a topic and dive in" accent="dive in" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map(a => {
            const I = iconFor(a.topic)
            return (
              <Link key={a.slug} href={`/resources/${a.slug}`} data-reveal="" className="mk-card group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517] sm:p-6">
                <span className="flex items-center gap-2.5">
                  <span className="mk-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><I className="h-[18px] w-[18px]" /></span>
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">{a.topic}</span>
                </span>
                <h3 className="mt-4 font-serif text-2xl font-black leading-tight text-[#0B0B0B] dark:text-white">{a.title}</h3>
                <p className="mt-2 flex-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{a.description}</p>
                <span className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-black text-[#111827] dark:border-white/10 dark:text-white">
                  <span className="inline-flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400"><Clock className="h-3.5 w-3.5" /> {a.minutes} min read</span>
                  <span className="inline-flex items-center gap-1 text-[#8b6a2b] dark:text-[#e8c97a]">Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
      <TrialBand />
    </MarketingPage>
  )
}
