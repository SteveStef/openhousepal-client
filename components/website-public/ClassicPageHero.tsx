import type { ReactNode } from 'react'
import { sizedImage } from '@/lib/siteImage'

// Classic's page opener - the bright counterpart to Luxe's cinematic dark heroes. A soft stone
// band, the headline in the site's sans with its last word in the agent's accent, one plain line
// under it, an optional ruled stat strip, and the page's own real photos as an offset collage on
// the right (a short strip of three on phones). No overlays, no shimmer: the photos do the work.
export default function ClassicPageHero({ eyebrow, title, titleTag, accent, subtitle, photos = [], stats, children, align = 'split', breadcrumb }: {
  eyebrow: string
  title: string
  /** Small text on the headline's own line, right after it (a town's county / state). */
  titleTag?: ReactNode
  /** The accented tail of the headline; defaults to the title's last word. */
  accent?: string
  breadcrumb?: ReactNode
  subtitle?: ReactNode
  photos?: string[]
  stats?: { label: string; value: string }[]
  children?: ReactNode
  align?: 'split' | 'center'
}) {
  const words = accent ? [title.trim()] : title.trim().split(/\s+/)
  const last = accent ?? words.pop()
  const pics = photos.filter(Boolean).slice(0, 3)
  const split = align === 'split' && pics.length > 0
  return (
    <section className="ohp-classic-hero relative overflow-hidden border-b px-6 pb-14 pt-12 sm:pb-16 sm:pt-16" style={{ backgroundColor: 'var(--site-bg-alt)', borderColor: 'var(--site-line)' }}>
      <div className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(var(--site-accent-rgb),0.10) 0%, rgba(var(--site-accent-rgb),0.10) 40%, transparent 100%)' }} />
      <div className={`relative mx-auto grid max-w-6xl items-center gap-10 ${split ? 'lg:grid-cols-[1.05fr_1fr] lg:gap-14' : ''}`}>
        <div className={split ? '' : 'mx-auto max-w-3xl text-center'}>
          {breadcrumb && <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--site-faint)' }}>{breadcrumb}</div>}
          <span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-ink-soft)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} />{eyebrow}
          </span>
          <h1 className="ohp-site-heading mt-5 text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl" style={{ color: 'var(--site-heading)' }}>
            {words.join(' ')}{words.length ? ' ' : ''}<span style={{ color: 'var(--site-accent)' }}>{last}</span>
            {titleTag && <span className="ml-3 inline-block align-middle text-sm font-bold uppercase tracking-[0.14em] sm:text-base" style={{ color: 'var(--site-muted)' }}>{titleTag}</span>}
          </h1>
          {subtitle && <p className={`mt-4 text-base leading-relaxed sm:text-lg ${split ? 'max-w-xl' : 'mx-auto max-w-xl'}`} style={{ color: 'var(--site-muted)' }}>{subtitle}</p>}
          {stats && stats.length > 0 && (
            <dl className={`mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:flex ${split ? '' : 'mx-auto max-w-3xl'}`} style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-line)' }}>
              {stats.map(s => (
                <div key={s.label} className="flex-1 px-4 py-4" style={{ backgroundColor: 'var(--site-surface)' }}>
                  <dd className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--site-heading)' }}>{s.value}</dd>
                  <dt className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>

        {split && (
          <>
            <div className="relative hidden h-[420px] lg:block">
              <span className="absolute -left-4 top-12 h-[270px] w-28 rounded-[22px]" style={{ backgroundColor: 'var(--site-accent)' }} />
              {pics[0] && <span className="ohp-classic-pic absolute left-0 top-0 h-[300px] w-[62%] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(17,24,39,.45)]"><img src={sizedImage(pics[0], 828)} loading="lazy" decoding="async" alt="" className="ohp-mls-crop h-full w-full object-cover" /></span>}
              {pics[1] && <span className="ohp-classic-pic absolute right-0 top-10 h-[220px] w-[42%] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(17,24,39,.45)]" style={{ animationDelay: '.12s' }}><img src={sizedImage(pics[1], 640)} loading="lazy" decoding="async" alt="" className="ohp-mls-crop h-full w-full object-cover" /></span>}
              {pics[2] && <span className="ohp-classic-pic absolute bottom-0 right-[8%] h-[170px] w-[52%] overflow-hidden rounded-[22px] ring-8 shadow-[0_30px_60px_-30px_rgba(17,24,39,.45)]" style={{ animationDelay: '.24s', ['--tw-ring-color' as string]: 'var(--site-bg-alt)' }}><img src={sizedImage(pics[2], 640)} loading="lazy" decoding="async" alt="" className="ohp-mls-crop h-full w-full object-cover" /></span>}
            </div>
            <div className="-mx-6 flex gap-3 overflow-x-auto px-6 lg:hidden [scrollbar-width:none]">
              {pics.map((src, i) => <span key={src + i} className="h-32 w-[46%] shrink-0 overflow-hidden rounded-2xl"><img src={sizedImage(src, 384)} loading="lazy" decoding="async" alt="" className="ohp-mls-crop h-full w-full object-cover" /></span>)}
            </div>
          </>
        )}
      </div>
      <style>{`.ohp-classic-pic{animation:ohpClassicPic .9s cubic-bezier(.16,1,.3,1) both}@keyframes ohpClassicPic{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.ohp-classic-pic{animation:none}}`}</style>
    </section>
  )
}
