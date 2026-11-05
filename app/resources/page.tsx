import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { ARTICLES } from '@/components/marketing/resourcesData'

export const metadata = marketingMeta('/resources', 'Guides for Real Estate Agents', 'Practical guides for real estate agents on running open houses, following up with leads and winning listing appointments.')

export default function ResourcesPage() {
  return (
    <MarketingPage path="/resources" kicker="Resources" title="Guides for agents who want more business" accent="more business" motif="chat"
      lead="Practical advice on open houses, follow-up and listing appointments, in plain words.">
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {ARTICLES.map(a => (
          <Link key={a.slug} href={`/resources/${a.slug}`} data-reveal="" className="mk-card group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517]">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">{a.topic}</span>
            <h2 className="mt-2 font-serif text-2xl font-black leading-tight text-[#0B0B0B] dark:text-white">{a.title}</h2>
            <p className="mt-2 flex-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{a.description}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">{a.minutes} minute read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>
      <TrialBand />
    </MarketingPage>
  )
}
