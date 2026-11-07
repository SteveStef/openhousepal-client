import type { ComponentType, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import Footer from '@/components/Footer'
import MarketingMotion, { HeroMotif, type MotifName } from '@/components/marketing/MarketingMotion'
import HomeLink from '@/components/marketing/HomeLink'
import { TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { MARKETING_LINKS } from '@/lib/sitePages'

// openhousepal.com's own pages (owner, 11/05): the pages Google should show under OpenHousePal,
// instead of agents' pages. Rendered on the server so the words are in the page itself.
export function marketingMeta(path: string, title: string, description: string) {
  const url = `https://openhousepal.com${path}`
  return {
    title: `${title} | OpenHousePal`,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website' as const, siteName: 'OpenHousePal', url, title: `${title} | OpenHousePal`, description, images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OpenHousePal' }] },
    twitter: { card: 'summary_large_image' as const, title: `${title} | OpenHousePal`, description, images: ['/og-image.png'] },
  }
}

// Every animation here moves only opacity and transform (the graphics chip's job). No blur anywhere.
const MOTION_CSS = String.raw`
@keyframes mkRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes mkDrift { from { transform: translate3d(-14px, 8px, 0) scale(1); } to { transform: translate3d(18px, -12px, 0) scale(1.12); } }
@keyframes mkSheen { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes mkSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes mkTwinkle { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: .95; transform: scale(1.1); } }
.mk-rise { animation: mkRise .85s cubic-bezier(.16,1,.3,1) both; animation-delay: var(--d, 0ms); }
.mk-orb { animation: mkDrift 15s ease-in-out infinite alternate; will-change: transform; }
.mk-gold { background: linear-gradient(100deg, #f3dfa8, #e8c97a 30%, #fff3cf 50%, #C9A24D 70%, #f3dfa8); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mkSheen 7s ease-in-out infinite; padding-right: .06em; }
.mk-sweep { animation: mkSweep 5.5s ease-in-out infinite; will-change: transform; }
.mk-spark { animation: mkTwinkle 4.5s ease-in-out infinite; }
.mk-hide { opacity: 0; transform: translateY(26px); }
.mk-in { opacity: 1; transform: none; transition: opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1); transition-delay: var(--d, 0ms); }
.mk-card { transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease; }
.mk-card:hover { transform: translateY(-4px); border-color: rgba(201,162,77,.65); box-shadow: 0 24px 44px -30px rgba(139,106,43,.75); }
.mk-card:hover .mk-icon { transform: scale(1.1) rotate(-4deg); }
.mk-icon { transition: transform .3s cubic-bezier(.16,1,.3,1); }
.mk-cta { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease; }
.mk-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -14px rgba(201,162,77,.9); }
@media (prefers-reduced-motion: reduce) { .mk-rise, .mk-orb, .mk-gold, .mk-sweep, .mk-spark { animation: none; } .mk-card, .mk-in, .mk-icon, .mk-cta { transition: none; } }
`

const SPARKS: [string, string, string][] = [['8%', '22%', '0s'], ['91%', '30%', '1.2s'], ['22%', '74%', '2.1s'], ['72%', '16%', '.7s'], ['58%', '82%', '3s'], ['38%', '12%', '1.8s']]

export function MarketingNav({ path, crumb, onDark = false }: { path: string; crumb?: string; onDark?: boolean }) {
  const here = MARKETING_LINKS.find(l => path === l.href || path.startsWith(`${l.href}/`))
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'OpenHousePal', item: 'https://openhousepal.com' },
      { '@type': 'ListItem', position: 2, name: here?.label || '', item: `https://openhousepal.com${here?.href || path}` },
      ...(crumb ? [{ '@type': 'ListItem', position: 3, name: crumb, item: `https://openhousepal.com${path}` }] : []),
    ],
  }
  return (
    <nav aria-label="OpenHousePal" className="flex flex-wrap gap-1.5 [&>a]:shrink-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <HomeLink className={`rounded-full px-3.5 py-1.5 text-[13px] font-black transition-colors ${onDark ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-[#151517] dark:text-gray-300 dark:ring-white/10'}`}>Home</HomeLink>
      {MARKETING_LINKS.map(l => (
        <Link key={l.href} href={l.href} aria-current={l.href === here?.href ? 'page' : undefined}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-black transition-colors ${l.href === here?.href
            ? onDark ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]'
            : onDark ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-[#151517] dark:text-gray-300 dark:ring-white/10'}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

/** The midnight-and-gold top of every page: the title rises in, the last words shimmer, a gold line sketches itself. */
export function MarketingHero({ path, crumb, kicker, title, accent, lead, motif, center = false, narrow = false }: {
  path: string; crumb?: string; kicker: string; title: string; accent?: string; lead: string; motif?: MotifName; center?: boolean; narrow?: boolean
}) {
  const at = accent ? title.lastIndexOf(accent) : -1
  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_130%_at_50%_-20%,#2c2418_0%,#111827_52%,#0b0b0b_100%)] pb-16 pt-6 sm:pb-20 sm:pt-10">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />
      <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden"><span className="mk-sweep block h-full w-full bg-gradient-to-r from-transparent via-[#f3dfa8] to-transparent" /></span>
      {SPARKS.map(([l, t, d]) => <span key={l + t} aria-hidden className="mk-spark absolute -z-10 h-1 w-1 rounded-full bg-[#f3dfa8]" style={{ left: l, top: t, animationDelay: d }} />)}
      <div className={`relative mx-auto px-4 sm:px-6 ${narrow ? 'max-w-3xl' : 'max-w-6xl'}`}>
        <MarketingNav path={path} crumb={crumb} onDark />
        {motif && <HeroMotif name={motif} className="pointer-events-none absolute -bottom-8 right-6 hidden h-[250px] w-[250px] text-[#C9A24D] opacity-30 lg:block" />}
        <div className={`mt-10 ${center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}`}>
          <p className="mk-rise text-xs font-black uppercase tracking-[0.3em] text-[#e8c97a]">{kicker}</p>
          <h1 className="mk-rise mt-3 whitespace-pre-line font-serif text-[2.6rem] max-[359px]:text-[2.2rem] font-black leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl" style={{ ['--d' as string]: '90ms' }}>
            {at >= 0 ? <>{title.slice(0, at)}<em className="mk-gold font-serif italic">{accent}</em>{title.slice(at + (accent?.length || 0))}</> : title}
          </h1>
          <p className={`mk-rise mt-5 text-lg font-medium leading-relaxed text-gray-300 sm:text-xl ${center ? 'mx-auto max-w-xl' : 'max-w-2xl'}`} style={{ ['--d' as string]: '180ms' }}>{lead}</p>
        </div>
      </div>
    </section>
  )
}

export function FeatureCard({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <article data-reveal="" className="mk-card rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#151517]">
      <span className="mk-icon grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><Icon className="h-5 w-5" /></span>
      <h3 className="mt-3 text-lg font-black text-[#111827] dark:text-white">{title}</h3>
      <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-[#4b5563] dark:text-gray-300">{children}</p>
    </article>
  )
}

export function MarketingSection({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="mt-14 sm:mt-20">
      <div data-reveal="">
        <h2 className="font-serif text-3xl font-black tracking-tight text-[#0B0B0B] dark:text-white sm:text-5xl">{title}</h2>
        <span aria-hidden className="mt-3 block h-1 w-14 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f3dfa8]" />
        {lead && <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-[#6B7280] dark:text-gray-400 sm:text-lg">{lead}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function TrialBand({ idx = false }: { idx?: boolean }) {
  return (
    <section data-reveal="" className="relative isolate mt-16 overflow-hidden rounded-3xl bg-[radial-gradient(120%_160%_at_50%_-30%,#2c2418_0%,#111827_55%,#0b0b0b_100%)] px-6 py-12 text-center ring-1 ring-[#C9A24D]/30 sm:mt-20">
      <h2 className="font-serif text-3xl font-black text-white sm:text-4xl">{idx ? 'Ready for your own website' : 'Try it on your next open house'}</h2>
      {!idx && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm font-semibold text-gray-300">
          {[`${TRIAL_PERIOD_DAYS}-day free trial`, 'Cancel anytime', 'No commitment'].map(t => (
            <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#C9A24D]" strokeWidth={3} /> {t}</span>
          ))}
        </div>
      )}
      <Link href={idx ? '/pricing' : '/register'} className="mk-cta mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-8 py-3.5 text-base font-black text-[#111827]">
        {idx ? 'See the IDX plan' : 'Start Free Trial'} <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

export default function MarketingPage({ path, crumb, kicker, title, accent, lead, motif, children }: { path: string; crumb?: string; kicker: string; title: string; accent?: string; lead: string; motif?: MotifName; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <MarketingMotion />
      <MarketingHero path={path} crumb={crumb} kicker={kicker} title={title} accent={accent} lead={lead} motif={motif} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
      <Footer />
    </div>
  )
}
