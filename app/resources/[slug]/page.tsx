import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, Clock, Lightbulb, Quote, Sparkles } from 'lucide-react'
import MarketingPage, { TrialBand, marketingMeta } from '@/components/marketing/MarketingPage'
import { ReadingBar } from '@/components/marketing/MarketingMotion'
import { ARTICLES, type Block } from '@/components/marketing/resourcesData'
import { BROKER_CSS } from '@/components/brokerages/brokerCss'

export const dynamicParams = false
export function generateStaticParams() { return ARTICLES.map(a => ({ slug: a.slug })) }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = ARTICLES.find(x => x.slug === slug)
  return a ? marketingMeta(`/resources/${a.slug}`, a.title, a.description) : {}
}

const GOLD = '#C9A24D'
const anchor = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// The same pieces the real blog articles use (BlogArticleBody: paragraph, lists, callout, quote),
// in the site's gold - so a guide reads like an OpenHousePal blog (owner 11/18).
function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'p':
      return <p className="text-[17px] font-medium leading-[1.85] text-[#1f2937] dark:text-gray-200">{b.text}</p>
    case 'list':
      return (
        <ul className="space-y-2.5">
          {b.items.map(t => (
            <li key={t} className="flex gap-3 text-[17px] font-medium leading-relaxed text-[#1f2937] dark:text-gray-200">
              <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD }} />{t}
            </li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="space-y-3">
          {b.items.map((t, i) => (
            <li key={t} className="flex gap-3 text-[17px] font-semibold leading-relaxed text-[#111827] dark:text-white">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-xs font-black text-[#8b6a2b] dark:text-[#e8c97a]">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      )
    case 'tip':
      return (
        <div className="flex gap-3 rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.07] p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A24D]" />
          <p className="text-[16px] font-semibold leading-relaxed text-[#111827] dark:text-white"><span className="font-black text-[#8b6a2b] dark:text-[#e8c97a]">Tip: </span>{b.text}</p>
        </div>
      )
    case 'quote':
      return (
        <blockquote className="relative border-l-4 border-[#C9A24D] py-1 pl-6">
          <Quote className="mb-1.5 h-6 w-6 text-[#C9A24D] opacity-50" />
          <p className="font-serif text-2xl font-light italic leading-snug text-[#111827] dark:text-white">{b.text}</p>
        </blockquote>
      )
  }
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
  const headed = a.sections.filter(s => s.h)
  // Same topic first, then the newest others.
  const more = [...ARTICLES.filter(x => x.slug !== a.slug && x.topic === a.topic), ...ARTICLES.filter(x => x.slug !== a.slug && x.topic !== a.topic)].slice(0, 3)
  return (
    <MarketingPage path={`/resources/${a.slug}`} crumb={a.title} kicker={a.topic} title={a.title} lead={a.description} motif="chat">
      <style dangerouslySetInnerHTML={{ __html: BROKER_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <ReadingBar />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,68ch)_1fr] lg:gap-14">
        <article className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#8b6a2b] dark:text-[#e8c97a]">{a.topic}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.minutes} minute read</span>
            <span>{longDate(a.date)}</span>
          </p>

          {/* Key takeaways */}
          <div data-reveal="" className="mt-6 rounded-3xl border border-[#C9A24D]/40 bg-white p-6 shadow-[0_24px_48px_-36px_rgba(139,106,43,.7)] dark:bg-[#151517] sm:p-7">
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> Key takeaways</p>
            <ul className="mt-4 space-y-3">
              {a.takeaways.map(t => (
                <li key={t} className="flex gap-3 text-[16px] font-semibold leading-snug text-[#111827] dark:text-white">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></span>{t}
                </li>
              ))}
            </ul>
          </div>

          {a.sections.map((s, i) => (
            <section key={i} id={s.h ? anchor(s.h) : undefined} data-reveal="" className="mt-10 scroll-mt-24 space-y-5">
              {s.h && (
                <h2 className="font-serif text-[1.7rem] font-black leading-tight tracking-[-0.01em] text-[#0B0B0B] dark:text-white sm:text-3xl">
                  <span className="mr-2 align-[0.15em] font-sans text-[13px] font-black tracking-[0.18em] text-[#C9A24D]">{String(headed.indexOf(s) + 1).padStart(2, '0')}</span>{s.h}
                </h2>
              )}
              {s.blocks.map((b, j) => <BlockView key={j} b={b} />)}
            </section>
          ))}

          {/* The tool for this */}
          <div data-reveal="" className="relative mt-12 overflow-hidden rounded-3xl bg-[radial-gradient(130%_140%_at_0%_0%,#2c2418_0%,#111827_60%,#0b0b0b_100%)] p-6 text-white ring-1 ring-[#C9A24D]/30 sm:p-8">
            <span aria-hidden className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.32),transparent_70%)]" />
            <p className="relative text-xs font-black uppercase tracking-[0.24em] text-[#e8c97a]">Make it easier</p>
            <p className="relative mt-2 font-serif text-2xl font-black sm:text-3xl">OpenHousePal does the busywork for this</p>
            <div className="relative mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href={a.tool.href} className="mk-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-6 py-3 text-[15px] font-black text-[#111827]">{a.tool.label} <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/tools" className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-6 py-3 text-[15px] font-black text-white transition-colors hover:border-[#C9A24D] hover:text-[#f3dfa8]">See every tool</Link>
            </div>
          </div>
        </article>

        {/* In this guide (computers) */}
        {headed.length > 1 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">In this guide</p>
              <ol className="mt-3 space-y-2">
                {headed.map((s, i) => (
                  <li key={s.h}><a href={`#${anchor(s.h!)}`} className="flex gap-2.5 text-[14px] font-bold leading-snug text-[#374151] hover:text-[#8b6a2b] dark:text-gray-300 dark:hover:text-[#e8c97a]"><span className="font-black text-[#C9A24D]">{String(i + 1).padStart(2, '0')}</span>{s.h}</a></li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>

      {/* Keep reading */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl font-black text-[#0B0B0B] dark:text-white">Keep reading</h2>
        <span aria-hidden className="mt-3 block h-1 w-14 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f3dfa8]" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {more.map(m => (
            <Link key={m.slug} href={`/resources/${m.slug}`} data-reveal="" className="mk-card group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">{m.topic}</span>
              <span className="mt-2 flex-1 font-serif text-xl font-black leading-snug text-[#0B0B0B] dark:text-white">{m.title}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">{m.minutes} minute read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>
      <TrialBand />
    </MarketingPage>
  )
}
