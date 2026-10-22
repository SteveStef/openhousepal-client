// Estimated progress of a CMA's AI analysis while it runs. There's no real progress signal (one
// background run on the server), so this paces a staged timeline to what a run actually takes -
// the same pacing as the editor's startProgressSimulation in app/studio/cma/[id]/page.tsx:
// subject 8s, the comps 36s together, market evidence 12s, comp weights 10s, the final value 80s,
// then it eases toward 97% and never reaches 100% on its own (the real result ends it).
// Pure - the CMA list cards use it now; the editor could later reuse it instead of its own copy.

export const CMA_AI_MAX_COMPS = 5
export const CMA_AI_TYPICAL_SEC = 170

export interface CmaAiProgress {
  pct: number      // 2-97
  label: string    // what it's doing right now
  stage: number    // 0 subject, 1 comps, 2 market, 3 weights, 4 final value, 5 report check
}

export function estimatedProgress(elapsedMs: number, compCount: number): CmaAiProgress {
  const elapsed = Math.max(0, elapsedMs)
  const comps = Math.max(0, Math.min(compCount || 0, CMA_AI_MAX_COMPS))
  const subjectMs = 8_000
  const perCompMs = comps > 0 ? Math.round(36_000 / comps) : 0
  const compReviewEnd = subjectMs + comps * perCompMs
  const marketReviewEnd = compReviewEnd + 12_000
  const benchmarkEnd = marketReviewEnd + 10_000
  const reasoningMs = 80_000
  const reasoningEnd = benchmarkEnd + reasoningMs

  if (elapsed < subjectMs) {
    return { pct: 2 + (elapsed / subjectMs) * 6, stage: 0, label: 'Reading the subject’s photos and facts' }
  }
  if (comps > 0 && elapsed < compReviewEnd) {
    const compElapsed = elapsed - subjectMs
    const i = Math.min(comps - 1, Math.floor(compElapsed / perCompMs))
    const frac = (compElapsed - i * perCompMs) / perCompMs
    return { pct: 8 + ((i + frac) / comps) * 27, stage: 1, label: `Reviewing comparable ${i + 1} of ${comps}` }
  }
  if (elapsed < marketReviewEnd) {
    return { pct: 35 + ((elapsed - compReviewEnd) / 12_000) * 10, stage: 2, label: 'Comparing size, condition and market evidence' }
  }
  if (elapsed < benchmarkEnd) {
    return { pct: 45 + ((elapsed - marketReviewEnd) / 10_000) * 7, stage: 3, label: 'Setting each comp’s weight and the value range' }
  }
  if (elapsed < reasoningEnd) {
    const r = (elapsed - benchmarkEnd) / reasoningMs
    return { pct: 52 + (1 - Math.pow(1 - r, 1.4)) * 36, stage: 4, label: 'Working out the final value' }
  }
  const finalCheckMs = elapsed - reasoningEnd
  return { pct: 88 + 9 * (1 - Math.exp(-finalCheckMs / 25_000)), stage: 5, label: 'Checking every number in the report' }
}

// "About 2 min left" - same wording as the editor's progress card.
export function estimatedTimeLeft(elapsedMs: number): string {
  const elapsedSec = Math.floor(Math.max(0, elapsedMs) / 1000)
  const left = Math.max(0, CMA_AI_TYPICAL_SEC - elapsedSec)
  if (elapsedSec > CMA_AI_TYPICAL_SEC + 20) return 'Almost there'
  if (left < 45) return 'Under a minute left'
  return `About ${Math.ceil(left / 60)} min left`
}
