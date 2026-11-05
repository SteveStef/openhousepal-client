import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { ReadingBar } from '@/components/marketing/MarketingMotion'
import { ARTICLES } from '@/components/marketing/resourcesData'

export const dynamicParams = false
export function generateStaticParams() { return ARTICLES.map(a => ({ slug: a.slug })) }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = ARTICLES.find(x => x.slug === slug)
  return a ? marketingMeta(`/resources/${a.slug}`, a.title, a.description) : {}
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = ARTICLES.find(x => x.slug === slug)
  if (!a) notFound()
  const schema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description, datePublished: a.date, dateModified: a.date,
    author: { '@type': 'Organization', name: 'OpenHousePal', url: 'https://openhousepal.com' }, publisher: { '@id': 'https://openhousepal.com/#organization' },
    mainEntityOfPage: `https://openhousepal.com/resources/${a.slug}`,
  }
  const more = ARTICLES.filter(x => x.slug !== a.slug)
  return (
    <MarketingPage path={`/resources/${a.slug}`} crumb={a.title} kicker={a.topic} title={a.title} lead={a.description} motif="chat">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <ReadingBar />
      <article className="mt-8 max-w-[68ch]">
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{a.minutes} minute read</p>
        {a.sections.map((s, i) => (
          <section key={i} data-reveal="" className="mt-6">
            {s.h && <h2 className="font-serif text-2xl font-black text-[#0B0B0B] dark:text-white sm:text-3xl">{s.h}</h2>}
            {s.p.map(t => <p key={t} className="mt-3 text-[17px] font-medium leading-[1.7] text-[#374151] dark:text-gray-300">{t}</p>)}
          </section>
        ))}
        <p className="mt-8"><Link href={a.tool.href} className="mk-cta inline-flex rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white dark:bg-[#C9A24D] dark:text-[#111827]">{a.tool.label}</Link></p>
      </article>
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-black text-[#0B0B0B] dark:text-white">Keep reading</h2>
        <ul className="mt-3 space-y-2">
          {more.map(m => <li key={m.slug}><Link href={`/resources/${m.slug}`} className="text-base font-bold text-[#8b7355] underline underline-offset-4 dark:text-[#e8c97a]">{m.title}</Link></li>)}
        </ul>
      </section>
      <TrialBand />
    </MarketingPage>
  )
}
