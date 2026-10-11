'use client'

// Client reviews on the Agent Hub - one card design in three sizes, shared by the public page
// (app/[slug]) and the editor's live preview (app/studio/site):
//   - phones: a movable section (Agent Hub -> Layout), as ONE big auto-advancing card (same height
//     as the Recent Sales carousel) or a row of medium cards (Recent Sales' medium size);
//   - computers: one short card right under Schedule a Showing (ReviewsDeskCard) - the rating, a
//     Leave a review button and one 4-line review at a time, gently cycling;
//   - the profile card (phones): a small star-rating chip + "Review" button (Agent Hub -> Profile).
// Every card carries the stars next to the reviewer's name, and a small "via Zillow" when the
// review was brought over from another site.
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { PenLine, Quote, Star } from 'lucide-react'
import api from '@/lib/api-service'
import HubCinema from '@/components/agent-hub/HubCinema'

export type HubReview = { id: string; reviewer_name: string; rating: number; body: string; created_at: string; source?: string }
export type HubReviewsData = { show_on_hub: boolean; min_rating?: number; summary: { count: number; average: number | null }; reviews: HubReview[] }

const SOURCE_LABEL: Record<string, string> = { google: 'Google', zillow: 'Zillow', realtor: 'Realtor.com', homes: 'Homes.com', facebook: 'Facebook' }

/** The public reviews (+ whether the agent shows them on the hub). */
export function useHubReviews(slug?: string | null) {
  const [data, setData] = useState<HubReviewsData | null>(null)
  useEffect(() => {
    if (!slug) return
    let live = true
    api.reviews.get(slug).then(r => {
      if (live && r.success && r.data) setData({ show_on_hub: r.data.show_on_hub, min_rating: r.data.min_rating, summary: r.data.summary, reviews: (r.data.reviews || []) as HubReview[] })
    })
    return () => { live = false }
  }, [slug])
  return data
}

/** Best first: 5-star reviews with something to say, newest first within each rating. */
export function orderReviews(list: HubReview[]): HubReview[] {
  return [...list].sort((a, b) => b.rating - a.rating || Number(b.body.length > 60) - Number(a.body.length > 60) || +new Date(b.created_at) - +new Date(a.created_at))
}

export function Stars({ rating, className = 'h-3.5 w-3.5', luxe = false }: { rating: number; className?: string; luxe?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[1px]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${className} ${rating >= n ? (luxe ? 'fill-[var(--m-light,#e8c97a)] text-[var(--m-light,#e8c97a)]' : 'fill-[#C9A24D] text-[#C9A24D]') : (luxe ? 'text-white/25' : 'text-gray-300 dark:text-gray-600')}`} />
      ))}
    </span>
  )
}

const monthYear = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** One review, filling whatever box it's put in. size sets the type scale + how much text shows. */
export function ReviewCard({ rv, luxe, size }: { rv: HubReview; luxe: boolean; size: 'big' | 'medium' | 'side' }) {
  const src = rv.source ? SOURCE_LABEL[rv.source] : undefined
  const clamp = size === 'medium' ? 'line-clamp-6' : 'line-clamp-5'
  const text = size === 'medium' ? 'text-[12px] leading-[1.45]' : 'text-[14px] leading-[1.5]'
  const initials = ((rv.reviewer_name || '').split(/\s+/).filter(w => /^[a-z]/i.test(w)).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase()   // "Ryan & Kate J." -> RK
  return (
    <div data-testid="hub-review-card" className={`relative flex h-full w-full flex-col overflow-hidden text-left ${size === 'medium' ? 'p-3.5' : 'p-5'} ${luxe
      ? 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(var(--m-rgb,201,162,77),.28),transparent_55%),linear-gradient(160deg,#17140f,#0b0f0e)] text-white'
      : 'border border-gray-200 bg-white text-[#111827] dark:border-white/10 dark:bg-[#151517] dark:text-white'}`}>
      <Quote aria-hidden className={`absolute right-3 top-3 ${size === 'medium' ? 'h-7 w-7' : 'h-10 w-10'} ${luxe ? 'text-[var(--m-light,#e8c97a)] opacity-25' : 'text-[#C9A24D] opacity-20'}`} />
      {/* the box grows, the text inside is clamped - a clamped line box must not be stretched itself */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <p className={`${clamp} ${text} ${size === 'medium' ? 'pr-5' : ''} font-medium ${luxe ? 'text-white/90' : 'text-[#374151] dark:text-gray-200'}`}>{`“${rv.body}”`}</p>
      </div>
      <div className={`relative mt-2.5 flex items-center gap-2.5 border-t pt-2.5 ${luxe ? 'border-white/10' : 'border-gray-100 dark:border-white/[0.07]'}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-full font-black ${size === 'medium' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[11px]'} ${luxe
          ? 'bg-gradient-to-br from-[var(--m-light,#e8c97a)] to-[var(--m-deep,#8b6a2b)] text-[#111827]'
          : 'bg-gradient-to-br from-[#e8c97a] to-[#8b6a2b] text-white'}`}>{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={`truncate font-black ${size === 'medium' ? 'text-[12px]' : 'text-[13.5px]'}`}>{rv.reviewer_name}</p>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <Stars rating={rv.rating} luxe={luxe} className={size === 'medium' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            <span className={`truncate text-[10.5px] font-semibold ${luxe ? 'text-white/50' : 'text-gray-400'}`}>
              {[monthYear(rv.created_at), src && `via ${src}`].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** "★★★★★ 4.8 · 33 reviews" */
export function ReviewsSummary({ data, luxe = false, className = '' }: { data: HubReviewsData; luxe?: boolean; className?: string }) {
  if (data.summary.average == null) return null
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Stars rating={Math.round(data.summary.average)} className="h-4 w-4" />
      <span className="text-sm font-black text-[#111827] dark:text-white">{data.summary.average.toFixed(1)}</span>
      <span className="text-xs font-semibold text-gray-400">· {data.summary.count} review{data.summary.count === 1 ? '' : 's'}</span>
    </div>
  )
}

/** Phones, "one big card": the same height as the Recent Sales carousel. */
export function ReviewsBigCarousel({ reviews, luxe, autoScroll, height = 240 }: { reviews: HubReview[]; luxe: boolean; autoScroll: boolean; height?: number }) {
  return (
    <HubCinema
      height={height}
      luxe={luxe}
      intervalMs={6000}
      autoScroll={autoScroll}
      progressTone={luxe ? 'light' : 'dark'}
      slides={reviews.map(rv => ({ id: rv.id, custom: <ReviewCard rv={rv} luxe={luxe} size="big" /> }))}
    />
  )
}

/** Phones, "two medium cards": sized like a Recent Sales card in its row. */
export const REVIEW_MEDIUM_CARD = 'block h-[178px] w-[204px] shrink-0 snap-start overflow-hidden rounded-[18px] lg:h-[198px] lg:w-[222px]'

/** A clear "Leave a review" button (the old small gold text link was too easy to miss). */
export function LeaveReviewButton({ href, size = 'md', label = 'Leave a review', className = '', newTab = false }: { href: string; size?: 'md' | 'sm'; label?: string; className?: string; newTab?: boolean }) {
  return (
    <Link href={href} target={newTab ? '_blank' : undefined} data-testid="hub-leave-review"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#111827] font-black text-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-px hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-white/90 ${size === 'sm' ? 'h-[26px] px-2.5 text-[11px]' : 'h-8 px-3.5 text-[12px]'} ${className}`}>
      <PenLine className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> {label}
    </Link>
  )
}

/** The agent's star rating as a small chip for the profile card ("★ 4.9 (31)"). Tapping it jumps
 *  to the Reviews section. With `reviewHref` a pencil sits right after the count, inside the same
 *  pill, and opens the review form (the side-by-side header's one-chip version). */
export function ProfileRatingChip({ data, href = '#reviews', className = '', reviewHref, newTab = false }: { data: HubReviewsData; href?: string; className?: string; reviewHref?: string; newTab?: boolean }) {
  if (data.summary.average == null || !data.summary.count) return null
  return (
    <span data-testid="hub-profile-rating" className={`inline-flex h-6 shrink-0 items-center overflow-hidden rounded-full border border-[#d8c08a]/70 bg-white text-[11px] font-black text-[#111827] shadow-sm dark:border-[#d8c08a]/30 dark:bg-[#1A1A1C] dark:text-white ${className}`}>
      <a href={href} aria-label={`${data.summary.average.toFixed(1)} stars from ${data.summary.count} reviews`} className={`inline-flex h-full items-center gap-1 ${reviewHref ? 'pl-2 pr-1.5' : 'px-2'}`}>
        <Star className="h-3 w-3 fill-[#C9A24D] text-[#C9A24D]" />
        {data.summary.average.toFixed(1)}
        <span className="font-bold text-gray-400">({data.summary.count})</span>
      </a>
      {reviewHref && (
        <Link href={reviewHref} target={newTab ? '_blank' : undefined} aria-label="Leave a review" data-testid="hub-profile-review"
          className="inline-flex h-full items-center border-l border-[#d8c08a]/60 bg-[#111827] pl-1.5 pr-2 text-white dark:border-white/10 dark:bg-white dark:text-[#111827]">
          <PenLine className="h-3 w-3" />
        </Link>
      )}
    </span>
  )
}

/** Small "Review" pill for the profile card - goes straight to the review form. */
export function ProfileReviewButton({ href, className = '', newTab = false }: { href: string; className?: string; newTab?: boolean }) {
  return (
    <Link href={href} target={newTab ? '_blank' : undefined} data-testid="hub-profile-review"
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#111827] px-2.5 text-[10.5px] font-black text-white shadow-sm dark:bg-white dark:text-[#111827] ${className}`}>
      <PenLine className="h-3 w-3" /> Review
    </Link>
  )
}

// The computer card shows at most 4 lines of a review - so it cycles through the reviews that
// fit in 4 lines (whole, never cut off), preferring ones long enough to fill them.
const DESK_MAX_CHARS = 185
export function deskReviewPool(reviews: HubReview[]): HubReview[] {
  const fit = reviews.filter(r => r.body.trim().length <= DESK_MAX_CHARS)
  const full = fit.filter(r => r.body.trim().length >= 80)
  if (full.length >= 3) return full
  if (fit.length >= 2) return fit
  return reviews
}

/** Computers: one short card right under Schedule a Showing - the star rating, a Leave a review
 *  button and one review at a time (4 lines max), gently cycling. Pauses while hovered. */
export function ReviewsDeskCard({ data, reviews, luxe, reviewHref, className = '', newTab = false }: { data: HubReviewsData; reviews: HubReview[]; luxe: boolean; reviewHref?: string; className?: string; newTab?: boolean }) {
  const pool = useMemo(() => deskReviewPool(reviews), [reviews])
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (pool.length < 2 || paused) return
    const t = setInterval(() => setI(n => (n + 1) % pool.length), 6500)
    return () => clearInterval(t)
  }, [pool.length, paused])
  if (!pool.length) return null
  const rv = pool[i % pool.length]
  const src = rv.source ? SOURCE_LABEL[rv.source] : undefined
  const dots = Math.min(pool.length, 6)
  return (
    <section data-testid="hub-reviews-desk" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className={`relative overflow-hidden rounded-[18px] border p-4 text-left shadow-sm ${luxe
        ? 'border-[rgba(var(--m-rgb,201,162,77),.35)] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(var(--m-rgb,201,162,77),.22),transparent_55%),linear-gradient(160deg,#17140f,#0b0f0e)] text-white'
        : 'border-[#d8c08a]/50 bg-white/80 dark:border-[#d8c08a]/25 dark:bg-[#151517]'} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {data.summary.average != null && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Stars rating={Math.round(data.summary.average)} luxe={luxe} className="h-4 w-4" />
            <span className={`text-[15px] font-black ${luxe ? 'text-white' : 'text-[#111827] dark:text-white'}`}>{data.summary.average.toFixed(1)}</span>
            <span className={`truncate text-[11.5px] font-semibold ${luxe ? 'text-white/55' : 'text-gray-400'}`}>· {data.summary.count} review{data.summary.count === 1 ? '' : 's'}</span>
          </div>
        )}
        {reviewHref && <LeaveReviewButton href={reviewHref} newTab={newTab} size="sm" className={luxe ? '!bg-[var(--m-light,#e8c97a)] !text-[#111827]' : ''} />}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={rv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
          {/* Always 4 lines tall, so the card (and everything under it) never jumps as it cycles. */}
          <p className={`mt-2.5 h-[78px] overflow-hidden text-[13px] font-medium leading-[19.5px] line-clamp-4 ${luxe ? 'text-white/90' : 'text-[#374151] dark:text-gray-200'}`}>{`“${rv.body.trim()}”`}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`truncate text-[12px] font-black ${luxe ? 'text-white' : 'text-[#111827] dark:text-white'}`}>{rv.reviewer_name}</span>
            <Stars rating={rv.rating} luxe={luxe} className="h-3 w-3" />
            {src && <span className={`truncate text-[10.5px] font-semibold ${luxe ? 'text-white/50' : 'text-gray-400'}`}>via {src}</span>}
            {dots > 1 && (
              <span className="ml-auto flex shrink-0 items-center gap-1" aria-hidden>
                {Array.from({ length: dots }).map((_, d) => (
                  <span key={d} className={`h-1.5 rounded-full transition-all ${d === i % dots ? `w-3.5 ${luxe ? 'bg-[var(--m-light,#e8c97a)]' : 'bg-[#C9A24D]'}` : `w-1.5 ${luxe ? 'bg-white/25' : 'bg-gray-300 dark:bg-white/20'}`}`} />
                ))}
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

// Phones, "two cards": exactly two WHOLE cards fill the row (never one and a half cut off by the
// screen edge). It moves a page (two cards) at a time - swipe, the dots, or on its own when
// `autoScroll` / `scrollPulse` (the hub's take-turns scheduler) says so. Prefers reviews short
// enough to read in full at this size.
const TWO_UP_MAX_CHARS = 125
export function twoUpPool(reviews: HubReview[]): HubReview[] {
  const fit = reviews.filter(r => r.body.trim().length <= TWO_UP_MAX_CHARS)
  return fit.length >= 4 ? fit : reviews
}

export function ReviewsTwoUp({ reviews, luxe, autoScroll = false, scrollPulse = 0, height = 212 }: { reviews: HubReview[]; luxe: boolean; autoScroll?: boolean; scrollPulse?: number; height?: number }) {
  const pool = useMemo(() => twoUpPool(reviews), [reviews])
  const row = useRef<HTMLDivElement>(null)
  const pages = Math.max(1, Math.ceil(pool.length / 2))
  const [page, setPage] = useState(0)
  const go = (p: number) => {
    const el = row.current
    if (!el) return
    const next = ((p % pages) + pages) % pages
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = row.current
    if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }
  // The hub's scheduler hands this row its turn by bumping scrollPulse.
  useEffect(() => { if (scrollPulse) go(page + 1) }, [scrollPulse]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pool.length) return null
  return (
    <div data-testid="hub-reviews-two-up">
      <div ref={row} onScroll={onScroll} className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {pool.map(rv => (
          <div key={rv.id} className="shrink-0 snap-start overflow-hidden rounded-[18px]" style={{ width: 'calc(50% - 6px)', height }}>
            <ReviewCard rv={rv} luxe={luxe} size="medium" />
          </div>
        ))}
        {/* An odd count still pages cleanly - a blank half keeps the last card on the left. */}
        {pool.length % 2 === 1 && <div aria-hidden className="shrink-0" style={{ width: 'calc(50% - 6px)' }} />}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: Math.min(pages, 8) }).map((_, i) => (
            <button key={i} type="button" aria-label={`Reviews page ${i + 1}`} onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${i === Math.min(page, 7) ? `w-5 ${luxe ? 'bg-[var(--m-base,#C9A24D)]' : 'bg-[#C9A24D]'}` : 'w-1.5 bg-gray-300 dark:bg-white/20'}`} />
          ))}
        </div>
      )}
      {autoScroll && <TwoUpTimer onTick={() => go(page + 1)} />}
    </div>
  )
}

function TwoUpTimer({ onTick }: { onTick: () => void }) {
  const ref = useRef(onTick)
  ref.current = onTick
  useEffect(() => { const t = setInterval(() => ref.current(), 6000); return () => clearInterval(t) }, [])
  return null
}
