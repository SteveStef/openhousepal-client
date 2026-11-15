'use client'

import { AlertTriangle, BadgeCheck } from 'lucide-react'
import type { BlogAiReview } from '@/types'

// What the agent is told after the AI writes an article: that it was checked and is ready. The engine fixes what it
// finds before the article is saved, so there is no report to work through here - no claim counts, scores, pass list
// or "double-check" lists (owner 11/15: "it comes out and it's actually done"). Only the rare sentence that nothing
// could settle is shown, in plain words. The full report stays on the draft (ai_review) for the admin grading export.

const fmtDate = (d?: string | null) => {
  if (!d) return ''
  const t = Date.parse(d.length === 10 ? `${d}T12:00:00` : d)
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VerifiedPanel({ review, className = '' }: { review: BlogAiReview; className?: string }) {
  const left = review.open_issues || []
  const unchecked = review.checked === false
  const clean = left.length === 0 && !unchecked
  const outside = review.out_of_area || []

  const title = unchecked ? 'Read this one over before you publish'
    : !clean ? (left.length === 1 ? 'One sentence worth a look' : `${left.length} sentences worth a look`)
      : review.edited ? 'Fact-checked when written' : 'Fact-checked and ready'
  const sub = unchecked ? "The fact-check didn't finish on this draft"
    : review.edited ? "You've changed the wording since - your own edits weren't checked"
      : `Every fact was checked against its source before saving${review.data_as_of ? ` · market numbers through ${fmtDate(review.data_as_of)}` : ''}`

  return (
    <div data-testid="blog-checked" className={`relative overflow-hidden rounded-2xl border ${clean ? 'border-emerald-300/60 dark:border-emerald-500/30' : 'border-amber-300/70 dark:border-amber-500/30'} bg-white shadow-[0_18px_40px_-30px_rgba(17,24,39,.6)] dark:bg-[#151517] ${className}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${clean ? 'bg-gradient-to-r from-emerald-400 via-[#C9A24D] to-emerald-400' : 'bg-gradient-to-r from-amber-400 via-[#C9A24D] to-amber-400'}`} />
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${clean ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-[#111827]'}`}>
          {clean ? <BadgeCheck className="h-5 w-5" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>
        </div>
      </div>

      {left.length > 0 && (
        <ul className="space-y-1.5 border-t border-gray-100 px-4 py-3 dark:border-white/[0.06]">
          {left.map((i, k) => (
            <li key={k} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
              {i.quote && <span className="font-semibold text-amber-900 dark:text-amber-100">“{i.quote}”</span>}
              <span className="block text-amber-800/80 dark:text-amber-200/70">{i.problem}</span>
            </li>
          ))}
        </ul>
      )}

      {outside.length > 0 && (
        <p className="border-t border-gray-100 px-4 py-2.5 text-[11px] font-semibold text-gray-500 dark:border-white/[0.06] dark:text-gray-400">
          {outside.join(', ')} {outside.length === 1 ? 'is' : 'are'} outside where you work, so the article doesn&apos;t claim local experience there. Your closing button still works.
        </p>
      )}
    </div>
  )
}
