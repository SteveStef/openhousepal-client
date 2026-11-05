import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import MarketingPage, { MarketingSection, TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { ToolDemo } from '@/components/marketing/ToolsExplorer'
import { TOOL_PAGES } from '@/components/marketing/toolPagesData'

export const dynamicParams = false
export function generateStaticParams() { return TOOL_PAGES.map(t => ({ tool: t.slug })) }

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOL_PAGES.find(x => x.slug === tool)
  return t ? marketingMeta(`/tools/${t.slug}`, t.seoTitle, t.description) : {}
}

export default async function ToolDetailPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOL_PAGES.find(x => x.slug === tool)
  if (!t) notFound()
  const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
  return (
    <MarketingPage path={`/tools/${t.slug}`} crumb={t.label} kicker={t.label} title={t.title} accent={t.accent} lead={t.lead} motif={t.motif}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <p className="mt-6 text-sm font-black text-[#8b7355] dark:text-[#e8c97a]">{t.plans} <Link href="/pricing" className="underline underline-offset-2">See plans</Link></p>
      <div className="mt-8 max-w-2xl"><ToolDemo tool={t.demo} /></div>
      <MarketingSection title="Why agents use it">
        <div className="grid gap-4 sm:grid-cols-2">
          {t.why.map(w => (
            <article key={w.title} data-reveal="" className="mk-card rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
              <h3 className="flex items-start gap-2 text-lg font-black text-[#111827] dark:text-white"><Check className="mt-1 h-4 w-4 shrink-0 text-[#C9A24D]" strokeWidth={3} /> {w.title}</h3>
              <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{w.text}</p>
            </article>
          ))}
        </div>
      </MarketingSection>
      <MarketingSection title="How it works">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((s, i) => (
            <li key={s} data-reveal="" className="mk-card rounded-2xl bg-[#111827] p-4 text-white dark:bg-[#151517] dark:ring-1 dark:ring-white/10">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#C9A24D] text-sm font-black text-[#111827]">{i + 1}</span>
              <p className="mt-2 text-[15px] font-bold leading-snug">{s}</p>
            </li>
          ))}
        </ol>
      </MarketingSection>
      <MarketingSection title="Common questions">
        <div className="space-y-3">
          {t.faqs.map(f => (
            <div key={f.q} data-reveal="" className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
              <h3 className="font-serif text-lg font-black text-[#0B0B0B] dark:text-white">{f.q}</h3>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-black text-[#8b7355] dark:text-[#e8c97a]">
          {t.article && <Link href={t.article.href} className="underline underline-offset-4">Read: {t.article.label}</Link>}
          <Link href="/tools" className="underline underline-offset-4">See all tools</Link>
        </div>
      </MarketingSection>
      <TrialBand />
    </MarketingPage>
  )
}
