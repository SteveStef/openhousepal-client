'use client'

// The body of the IDX website's Reviews page (under the hero in ReviewsPage.tsx):
//   1. a floating trust bar (rating, count, % who'd recommend, where reviews come from);
//   2. two rows of short quotes drifting past (pauses on hover/touch);
//   3. the spotlight review beside a rating ring + star breakdown;
//   4. the review wall - filter by stars / site, cards rise in as they scroll into view, 12 at a time (6 on phones);
//   5. a closing card with the agent's photo and ways to reach them.
// Colors come from the site's theme vars, so Classic/Luxe and light/dark all just work.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BadgeCheck, MessageSquareHeart, PenLine, Phone, Quote, Star, ThumbsUp } from 'lucide-react'
import { fontClass } from './blocks/fontClass'
import type { SiteReview, SiteReviewsData } from './ReviewsPage'
import { sizedImage } from '@/lib/siteImage'

const SOURCE_LABEL: Record<string, string> = { google: 'Google', zillow: 'Zillow', realtor: 'Realtor.com', homes: 'Homes.com', facebook: 'Facebook', direct: 'Verified client' }
const PAGE = 12
const PAGE_PHONE = 6

const initials = (name: string) => ((name || '').split(/\s+/).filter(w => /^[a-z]/i.test(w)).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase()
const monthYear = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
const sourceOf = (rv: SiteReview) => SOURCE_LABEL[rv.source || 'direct'] || 'Verified client'

function Stars({ rating, size = 'h-4 w-4', onDark = false }: { rating: number; size?: string; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={size} style={n <= Math.round(rating) ? { color: 'var(--site-accent)', fill: 'var(--site-accent)' } : { color: onDark ? 'rgba(255,255,255,.25)' : 'var(--site-line-strong)' }} />
      ))}
    </span>
  )
}

/** Rises in the first time it scrolls into view. */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`ohp-rv-reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/** 4.8 out of 5 as a gold ring. */
function RatingRing({ avg, serif }: { avg: number; serif: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 250); return () => clearTimeout(t) }, [])
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" style={{ stroke: 'var(--site-line)' }} />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - avg / 5) : c} style={{ stroke: 'var(--site-accent)', transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,.61,.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black leading-none ${serif}`} style={{ color: 'var(--site-heading)' }}>{avg.toFixed(1)}</span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-faint)' }}>out of 5</span>
      </div>
    </div>
  )
}

function WallCard({ rv, theme, highlight }: { rv: SiteReview; theme: any; highlight: boolean }) {
  const serif = fontClass(theme.heading_font, 'font-serif')
  const date = monthYear(rv.date)
  if (highlight) {
    return (
      <figure className="ohp-rv-card relative overflow-hidden rounded-[26px] p-7 text-white" style={{ background: `radial-gradient(120% 90% at 100% 0%, rgba(var(--site-accent-rgb),.35), transparent 60%), ${theme.primary_color}` }}>
        <Quote className="absolute -right-2 -top-2 h-24 w-24 opacity-10" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />
        <Stars rating={rv.rating} onDark />
        <blockquote className={`relative mt-4 text-[17px] leading-relaxed text-white/90 ${serif}`}>{`“${rv.body.trim()}”`}</blockquote>
        <figcaption className="relative mt-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{initials(rv.author)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black">{rv.author}</span>
            <span className="block text-xs font-semibold text-white/50">{[date, sourceOf(rv)].filter(Boolean).join(' · ')}</span>
          </span>
        </figcaption>
      </figure>
    )
  }
  return (
    <figure className="ohp-rv-card group relative overflow-hidden rounded-[26px] border p-6" style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }}>
      <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ backgroundColor: 'var(--site-accent)' }} />
      <div className="flex items-center justify-between gap-3">
        <Stars rating={rv.rating} />
        <Quote className="h-6 w-6 opacity-20" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />
      </div>
      <blockquote className={`mt-4 text-[15px] leading-relaxed ${fontClass(theme.body_font)}`} style={{ color: 'var(--site-ink-soft)' }}>{`“${rv.body.trim()}”`}</blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--site-line)' }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ background: 'linear-gradient(135deg, var(--site-accent-light), var(--site-accent-deep))', color: '#fff' }}>{initials(rv.author)}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-black ${serif}`} style={{ color: 'var(--site-heading)' }}>{rv.author}</span>
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--site-faint)' }}>
            <BadgeCheck className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{[sourceOf(rv), date].filter(Boolean).join(' · ')}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}

export interface ReviewsAgent { name?: string; photo_url?: string; title?: string; brokerage?: string; phone?: string }

export default function ReviewsShowcase({ data, theme, basePrefix, agent }: { data: SiteReviewsData; theme: any; basePrefix: string; agent?: ReviewsAgent | null }) {
  const reviews = data.reviews
  const avg = data.summary.average ?? 0
  const count = data.summary.count
  const serif = fontClass(theme.heading_font, 'font-serif')
  const reviewHref = `${basePrefix}/review`
  const firstName = (agent?.name || '').split(/\s+/)[0] || 'me'

  const recommend = reviews.length ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100) : 0
  const sources = Array.from(new Set(reviews.map(sourceOf)))
  const byStars = [5, 4, 3, 2, 1].map(n => ({ n, c: reviews.filter(r => r.rating === n).length }))
  const featured = useMemo(() => [...reviews].sort((a, b) => b.rating - a.rating || Math.min(b.body.length, 520) - Math.min(a.body.length, 520))[0], [reviews])
  // Short, punchy ones for the drifting rows.
  const shorts = useMemo(() => reviews.filter(r => r.body.trim().length <= 120 && r.id !== featured?.id), [reviews, featured])
  const rowA = shorts.filter((_, i) => i % 2 === 0)
  const rowB = shorts.filter((_, i) => i % 2 === 1)

  const [filter, setFilter] = useState<string>('all')
  const [limit, setLimit] = useState(PAGE)
  const [page, setPage] = useState(PAGE)
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) { setPage(PAGE_PHONE); setLimit(PAGE_PHONE) }
  }, [])
  const filters = [
    { id: 'all', label: `All (${reviews.length})` },
    ...[5, 4].filter(n => reviews.some(r => r.rating === n)).map(n => ({ id: `s${n}`, label: `${n} ★ (${reviews.filter(r => r.rating === n).length})` })),
    ...(sources.length > 1 ? sources.map(s => ({ id: `src:${s}`, label: s })) : []),
  ]
  const wall = reviews.filter(r => r.id !== featured?.id).filter(r =>
    filter === 'all' ? true : filter.startsWith('s') && !filter.startsWith('src:') ? r.rating === Number(filter.slice(1)) : sourceOf(r) === filter.slice(4))
  const shownWall = wall.slice(0, limit)

  const Pill = ({ rv }: { rv: SiteReview }) => (
    <span className="mx-2 inline-flex max-w-[420px] shrink-0 items-center gap-3 rounded-full border px-5 py-3 text-sm" style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }}>
      <Stars rating={rv.rating} size="h-3.5 w-3.5" />
      <span className="truncate font-semibold" style={{ color: 'var(--site-ink-soft)' }}>{`“${rv.body.trim()}”`}</span>
      <span className="shrink-0 text-xs font-black" style={{ color: 'var(--site-faint)' }}>{rv.author}</span>
    </span>
  )

  return (
    <div className="relative">
      <style>{`
        .ohp-rv-reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .8s cubic-bezier(.22,.61,.36,1); }
        .ohp-rv-reveal.is-in { opacity: 1; transform: none; }
        .ohp-rv-card { transition: transform .4s cubic-bezier(.22,.61,.36,1), box-shadow .4s; }
        .ohp-rv-card:hover { transform: translateY(-4px); box-shadow: var(--site-shadow-lift) !important; }
        .ohp-rv-track { display: flex; width: max-content; animation: ohp-rv-marquee var(--ohp-rv-dur, 60s) linear infinite; }
        .ohp-rv-track.rev { animation-direction: reverse; }
        .ohp-rv-marquee:hover .ohp-rv-track, .ohp-rv-marquee:active .ohp-rv-track { animation-play-state: paused; }
        .ohp-rv-marquee { -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        @keyframes ohp-rv-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .ohp-rv-track { animation: none; } .ohp-rv-reveal { opacity: 1; transform: none; } }
      `}</style>

      {/* 1. Trust bar, floating over the bottom of the hero */}
      <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-6">
        <Reveal>
          <div className="grid grid-cols-2 overflow-hidden rounded-[26px] border sm:grid-cols-4" style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow-lift)' }}>
            {[
              { icon: Star, value: avg.toFixed(1), label: 'Average rating' },
              { icon: MessageSquareHeart, value: String(count), label: count === 1 ? 'Client review' : 'Client reviews' },
              { icon: ThumbsUp, value: `${recommend}%`, label: 'Would recommend' },
              sources.some(x => x !== 'Verified client')
                ? { icon: BadgeCheck, value: sources.length > 2 ? `${sources.length} sites` : sources.join(' + '), label: 'Reviewed on' }
                : { icon: BadgeCheck, value: 'Verified', label: 'Real clients only' },
            ].map((t, i) => (
              <div key={t.label} className={`flex flex-col items-center px-4 py-5 text-center sm:py-6 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`} style={{ borderColor: 'var(--site-line)' }}>
                <t.icon className="h-5 w-5" style={{ color: 'var(--site-accent)', ...(i === 0 ? { fill: 'var(--site-accent)' } : {}) }} />
                <span className={`mt-2 truncate text-2xl font-black leading-none sm:text-3xl ${serif}`} style={{ color: 'var(--site-heading)', maxWidth: '100%' }}>{t.value}</span>
                <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* 2. Drifting quotes */}
      {rowA.length >= 3 && (
        <section className="ohp-rv-marquee mt-14 space-y-4 overflow-hidden py-2" aria-label="Short client quotes">
          {[rowA, rowB].filter(r => r.length >= 3).map((row, i) => (
            <div key={i} className={`ohp-rv-track ${i ? 'rev' : ''}`} style={{ ['--ohp-rv-dur' as any]: `${Math.max(40, row.length * 9)}s` }}>
              {[...row, ...row].map((rv, j) => <Pill key={`${rv.id}-${j}`} rv={rv} />)}
            </div>
          ))}
        </section>
      )}

      {/* 3. Spotlight review + rating breakdown */}
      {featured && (
        <section className="mx-auto mt-14 grid max-w-6xl gap-6 px-6 lg:grid-cols-[1.55fr_1fr]">
          <Reveal>
            <figure className="relative flex h-full flex-col justify-center overflow-hidden rounded-[32px] p-8 text-white sm:p-12" style={{ background: `radial-gradient(90% 120% at 0% 0%, rgba(var(--site-accent-rgb),.28), transparent 55%), radial-gradient(80% 100% at 100% 100%, rgba(var(--site-accent-rgb),.16), transparent 60%), ${theme.primary_color}` }}>
              <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <span className="relative text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-text)' }}>Client spotlight</span>
              <Quote className="relative mt-5 h-12 w-12" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />
              <blockquote className={`relative mt-5 text-xl leading-[1.55] text-white sm:text-[26px] ${serif}`}>{`“${featured.body.trim()}”`}</blockquote>
              <figcaption className="relative mt-8 flex flex-wrap items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full text-base font-black ring-4 ring-white/10" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{initials(featured.author)}</span>
                <span>
                  <span className="block text-base font-black">{featured.author}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-white/55"><Stars rating={featured.rating} size="h-3.5 w-3.5" onDark />{[monthYear(featured.date), sourceOf(featured)].filter(Boolean).join(' · ')}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-[32px] border p-7 sm:p-8" style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }}>
              <div className="flex items-center gap-5">
                <RatingRing avg={avg} serif={serif} />
                <div>
                  <Stars rating={avg} size="h-5 w-5" />
                  <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--site-muted)' }}>From {count} {count === 1 ? 'client' : 'clients'}</p>
                </div>
              </div>
              <div className="mt-7 space-y-3">
                {byStars.map(b => (
                  <div key={b.n} className="flex items-center gap-3 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>
                    <span className="flex w-8 shrink-0 items-center gap-0.5">{b.n}<Star className="h-3 w-3" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} /></span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                      <span className="block h-full rounded-full" style={{ width: `${count ? (b.c / count) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--site-accent-deep), var(--site-accent), var(--site-accent-light))' }} />
                    </span>
                    <span className="w-6 shrink-0 text-right">{b.c}</span>
                  </div>
                ))}
              </div>
              <a href={reviewHref} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                <PenLine className="h-4 w-4" /> Worked with {firstName}? Leave a review
              </a>
            </div>
          </Reveal>
        </section>
      )}

      {/* 4. The wall */}
      {wall.length + (filter === 'all' ? 0 : 1) > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-6 pt-20">
          <Reveal>
            <div className="text-center">
              <span className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-text)' }}>In their words</span>
              <h2 className={`ohp-site-heading mt-3 text-3xl font-black sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>Every Review, Unedited</h2>
            </div>
            {filters.length > 1 && (
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {filters.map(f => (
                  <button key={f.id} type="button" onClick={() => { setFilter(f.id); setLimit(page) }}
                    className="rounded-full border px-4 py-2 text-xs font-black transition"
                    style={filter === f.id
                      ? { backgroundColor: 'var(--site-accent)', borderColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }
                      : { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line-strong)', color: 'var(--site-ink-soft)' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </Reveal>
          <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3">
            {shownWall.map((rv, i) => (
              <Reveal key={`${filter}-${rv.id}`} delay={(i % 3) * 90} className="mb-6 break-inside-avoid">
                <WallCard rv={rv} theme={theme} highlight={i % 7 === 3 && rv.body.length > 90} />
              </Reveal>
            ))}
          </div>
          {wall.length > limit && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setLimit(l => l + page)} className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)', backgroundColor: 'var(--site-surface)' }}>
                Show more reviews <span style={{ color: 'var(--site-faint)' }}>({wall.length - limit} more)</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* 5. Closing card with the agent */}
      <section className="px-6 pb-20 pt-14">
        <Reveal>
          <div className="relative mx-auto grid max-w-5xl items-center gap-8 overflow-hidden rounded-[32px] p-8 text-white sm:p-10 md:grid-cols-[auto_1fr]" style={{ background: `radial-gradient(70% 120% at 100% 0%, rgba(var(--site-accent-rgb),.3), transparent 60%), ${theme.primary_color}` }}>
            {agent?.photo_url && (
              <div className="mx-auto h-32 w-32 overflow-hidden rounded-full p-1 md:mx-0 md:h-40 md:w-40" style={{ background: 'conic-gradient(from 0deg, var(--site-accent-deep), var(--site-accent-light), var(--site-accent), var(--site-accent-deep))' }}>
                <img src={sizedImage(agent.photo_url, 256)} loading="lazy" decoding="async" alt={agent.name || ''} className="h-full w-full rounded-full object-cover" />
              </div>
            )}
            <div className={agent?.photo_url ? 'text-center md:text-left' : 'text-center'}>
              <span className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-text)' }}>Your turn</span>
              <h2 className={`mt-3 text-3xl font-black leading-tight sm:text-4xl ${serif}`}>Ready to be my next success story?</h2>
              {agent?.name && <p className="mt-2 text-sm font-semibold text-white/60">{[agent.name, agent.title, agent.brokerage].filter(Boolean).join(' · ')}</p>}
              <div className={`mt-6 flex flex-wrap gap-3 ${agent?.photo_url ? 'justify-center md:justify-start' : 'justify-center'}`}>
                <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title="Get in touch" className="ohp-gold-sheen inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                  Get in touch <ArrowRight className="h-4 w-4" />
                </a>
                {agent?.phone && (
                  <a href={`tel:${agent.phone}`} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">
                    <Phone className="h-4 w-4" /> Call {firstName}
                  </a>
                )}
                <a href={reviewHref} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10">
                  <PenLine className="h-4 w-4" /> Leave a review
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
