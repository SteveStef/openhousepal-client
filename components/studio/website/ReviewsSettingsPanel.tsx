'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, MessageSquareQuote, Star } from 'lucide-react'
import api from '@/lib/api-service'
import OhpSwitch from '@/components/ui/OhpSwitch'

// The website's Reviews page (<site>/testimonials, with a "Reviews" menu link) - on or off, and
// 4-5 stars only. These are the same switches as Studio -> Reviews (AgentHub.config.reviews:
// showOnIdx / minRating), so flipping one here flips it there too. Saves straight away - it isn't
// part of the site draft, so no Publish is needed.
export default function ReviewsSettingsPanel({ onShowingChange, onMinRatingChange, onSwitch, siteUrl }: {
  onShowingChange?: (showing: boolean) => void
  /** "Only show 4 and 5 stars" was just switched (true = on) - the editor preview points at it. */
  onMinRatingChange?: (onlyTop: boolean) => void
  /** "Show reviews on my website" was just switched - and whether there's any review to show. */
  onSwitch?: (on: boolean, hasReviews: boolean) => void
  siteUrl?: string
}) {
  const [loading, setLoading] = useState(true)
  const [showOnIdx, setShowOnIdx] = useState(false)
  const [minRating, setMinRating] = useState(1)
  const [ratings, setRatings] = useState<number[]>([])
  const [saving, setSaving] = useState<'' | 'idx' | 'min'>('')

  useEffect(() => {
    api.agentHub.listReviews().then(r => {
      if (r.success && r.data) {
        setShowOnIdx(!!r.data.settings.show_on_idx)
        setMinRating(r.data.settings.min_rating ?? 1)
        setRatings(r.data.reviews.filter(x => x.status === 'published').map(x => x.rating))
      }
      setLoading(false)
    })
  }, [])

  const shown = ratings.filter(n => n >= minRating)
  const avg = shown.length ? shown.reduce((a, b) => a + b, 0) / shown.length : null
  useEffect(() => { if (!loading) onShowingChange?.(showOnIdx && shown.length > 0) }, [loading, showOnIdx, shown.length, onShowingChange])

  const save = async (which: 'idx' | 'min') => {
    setSaving(which)
    if (which === 'idx') {
      const next = !showOnIdx
      setShowOnIdx(next)
      const r = await api.agentHub.updateReviewSettings({ show_on_idx: next })
      if (!r.success) setShowOnIdx(!next)
      else onSwitch?.(next, shown.length > 0)
    } else {
      const next = minRating >= 4 ? 1 : 4
      const prev = minRating
      setMinRating(next)
      const r = await api.agentHub.updateReviewSettings({ min_rating: next })
      if (!r.success) setMinRating(prev)
      else onMinRatingChange?.(next >= 4)
    }
    setSaving('')
  }

  const row = ({ on, which, title, sub }: { on: boolean; which: 'idx' | 'min'; title: string; sub: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => save(which)} disabled={loading || saving !== ''} data-testid={`site-reviews-${which}`}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-[#C9A24D]/60 disabled:opacity-60 dark:border-gray-800">
      <span>
        <span className="block text-xs font-black text-[#111827] dark:text-white">{title}</span>
        <span className="mt-0.5 block text-[10px] font-semibold text-gray-400">{sub}</span>
      </span>
      <OhpSwitch as="span" on={on} busy={saving === which} />
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]">
          <MessageSquareQuote className="h-3.5 w-3.5" /> Reviews Page
        </p>
        <p className="mt-1 text-[10px] font-semibold text-gray-400">
          {loading ? 'Loading your reviews...' : shown.length
            ? <>{shown.length} review{shown.length === 1 ? '' : 's'} would show{avg != null && <> · <Star className="inline h-3 w-3 fill-[#C9A24D] text-[#C9A24D]" /> {avg.toFixed(1)}</>}. Saves right away - no Publish needed.</>
            : 'No reviews to show yet - add or import some first.'}
        </p>
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          {row({ on: showOnIdx, which: 'idx', title: 'Show reviews on my website', sub: 'A Reviews page with your rating, a featured review and every review - plus a Reviews link in your menu and footer' })}
          {row({ on: minRating >= 4, which: 'min', title: 'Only show 4 and 5 stars', sub: 'Also applies to your Agent Hub. Your rating counts only the reviews shown' })}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {siteUrl && showOnIdx && shown.length > 0 && (
            <a href={`${siteUrl}/testimonials`} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-800">
              See the page <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <a href="/studio/reviews" target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-800">
            Add, import or hide reviews <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
