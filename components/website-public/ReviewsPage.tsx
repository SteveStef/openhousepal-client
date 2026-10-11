// The IDX website's Reviews page (<site>/testimonials) - every review the agent chose to show
// (Studio -> Reviews: "Show on my IDX website", optionally 4-5 stars only), as a proper page:
// the rating hero here, then everything else in ReviewsShowcase (trust bar, drifting quotes,
// spotlight + rating ring, the filterable review wall, a closing card with the agent).
// Server-rendered; data from GET /public/sites/{id}/reviews (content_adapters.get_site_reviews).
import { PenLine, Star } from 'lucide-react'
import ClassicPageHero from './ClassicPageHero'
import CinematicHeroBackground from './CinematicHeroBackground'
import { fontClass } from './blocks/fontClass'
import ReviewsShowcase, { type ReviewsAgent } from './ReviewsShowcase'

export interface SiteReview {
  id: string
  author: string
  rating: number
  body: string
  source?: string | null
  date?: string | null
}

export interface SiteReviewsData {
  show: boolean
  summary: { count: number; average: number | null }
  reviews: SiteReview[]
  hub_slug?: string | null
}

export default function ReviewsPage({ data, theme, basePrefix, agent }: { data: SiteReviewsData; theme: any; basePrefix: string; agent?: ReviewsAgent | null }) {
  const avg = data.summary.average ?? 0
  const count = data.summary.count
  const reviewHref = `${basePrefix}/review`
  const classic = theme.template === 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')

  const leaveButton = (
    <a href={reviewHref} className="ohp-gold-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
      <PenLine className="h-4 w-4" /> Leave a review
    </a>
  )

  return (
    <main data-testid="site-reviews-page">
      {classic ? (
        <ClassicPageHero
          eyebrow="Client Reviews"
          title="What Clients Say"
          accent="Say"
          align="center"
          subtitle={`${avg.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'} - in my clients' own words.`}
        >
          <div className="mt-8 flex justify-center">{leaveButton}</div>
        </ClassicPageHero>
      ) : (
        <div className="relative overflow-hidden px-6 pb-24 pt-28 text-center sm:pb-28 sm:pt-32" style={{ backgroundColor: theme.primary_color }}>
          <CinematicHeroBackground photos={[]} />
          <div className="relative mx-auto max-w-3xl">
            <div className="mb-5 flex items-center justify-center gap-3">
              <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
              <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>Client Reviews</span>
              <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            </div>
            <h1 className={`ohp-site-heading text-4xl font-black leading-[1.1] text-white sm:text-6xl ${serif}`}>
              <span className="ohp-text-shimmer block">What Clients Say</span>
            </h1>
            <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 ">
              <span className="inline-flex gap-0.5">
                {[1, 2, 3, 4, 5].map(n => <Star key={n} className="h-5 w-5" style={n <= Math.round(avg) ? { color: theme.secondary_color, fill: theme.secondary_color } : { color: 'rgba(255,255,255,.25)' }} />)}
              </span>
              <span className={`text-2xl font-black text-white ${serif}`}>{avg.toFixed(1)}</span>
              <span className="text-sm font-semibold text-white/65">{count} {count === 1 ? 'review' : 'reviews'}</span>
            </div>
            <div className="mt-8 flex justify-center">{leaveButton}</div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--site-cream)]" />
          <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        </div>
      )}

      <ReviewsShowcase data={data} theme={theme} basePrefix={basePrefix} agent={agent} />
    </main>
  )
}
