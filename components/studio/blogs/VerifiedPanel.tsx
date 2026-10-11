'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, BadgeCheck, ChevronDown, ExternalLink, Lightbulb, Search, ShieldCheck, Wrench } from 'lucide-react'
import type { BlogAiReview } from '@/types'

// The AI pipeline's "Verified" report (backend ai_blog_pipeline_service) - private to the agent,
// never on the public article: how many claims were checked against real sources, what the
// fact-checker fixed, anything still open, and where every fact came from.

const SCORE_LABELS: [keyof NonNullable<BlogAiReview['scores']>, string][] = [
  ['accuracy', 'Accuracy'], ['local_specificity', 'Local detail'], ['usefulness', 'Usefulness'],
  ['voice', 'Sounds like you'], ['readability', 'Readability'], ['seo', 'Search'], ['compliance', 'Compliance'],
]

const KIND_LABELS: Record<string, string> = {
  unsupported_claim: 'Unsupported claim', wrong_number: 'Wrong number', stale_data: 'Out-of-date number', wrong_geography: 'Geography',
  fair_housing: 'Fair Housing', school_language: 'School wording', invented_experience: 'Your experience', causation: 'Cause and effect',
  legal_tax: 'Legal / tax', generic_ai_phrasing: 'Generic wording', repetition: 'Repetition', other: 'Other',
}

const fmtDate = (d?: string | null) => {
  if (!d) return ''
  const t = Date.parse(d.length === 10 ? `${d}T12:00:00` : d)
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const host = (url?: string | null) => {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : '' } catch { return '' }
}

export default function VerifiedPanel({ review, className = '' }: { review: BlogAiReview; className?: string }) {
  const [open, setOpen] = useState(false)
  const openIssues = review.open_issues || []
  const clean = openIssues.length === 0 && review.checked !== false
  const scores = review.scores || {}
  const avg = (() => {
    const vals = SCORE_LABELS.map(([k]) => scores[k]).filter((v): v is number => typeof v === 'number')
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  })()

  const stats = [
    { value: review.claims_checked ?? 0, label: 'claims checked' },
    { value: review.source_count ?? 0, label: 'sources' },
    { value: review.issues_fixed ?? 0, label: 'fixed' },
    { value: openIssues.length, label: openIssues.length === 1 ? 'flag' : 'flags', warn: openIssues.length > 0 },
  ]

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${clean ? 'border-emerald-300/60 dark:border-emerald-500/30' : 'border-amber-300/70 dark:border-amber-500/30'} bg-white shadow-[0_18px_40px_-30px_rgba(17,24,39,.6)] dark:bg-[#151517] ${className}`}>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${clean ? 'bg-gradient-to-r from-emerald-400 via-[#C9A24D] to-emerald-400' : 'bg-gradient-to-r from-amber-400 via-[#C9A24D] to-amber-400'}`} />
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${clean ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-[#111827]'} shadow-[0_0_0_4px_rgba(16,185,129,.12)]`}>
          {clean ? <BadgeCheck className="h-5 w-5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#111827] dark:text-white">{clean ? 'Verified' : 'Verified - review the flags'}</p>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            Researched, written and fact-checked{review.data_as_of ? ` · market data through ${fmtDate(review.data_as_of)}` : ''}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {stats.map(s => (
            <span key={s.label} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${s.warn ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-200'}`}>
              {s.value} <span className="font-semibold opacity-70">{s.label}</span>
            </span>
          ))}
          {avg != null && <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-black text-[#e8c97a] dark:bg-white/10">{avg}/10</span>}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-white/[0.06]">
              {review.summary && <p className="text-sm font-semibold leading-relaxed text-gray-700 dark:text-gray-200">{review.summary}</p>}

              {SCORE_LABELS.some(([k]) => typeof scores[k] === 'number') && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {SCORE_LABELS.map(([k, label]) => typeof scores[k] === 'number' && (
                    <div key={k} className="rounded-xl bg-gray-50 px-2.5 py-2 dark:bg-white/[0.03]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-sm font-black text-[#111827] dark:text-white">{scores[k]}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                          <motion.span initial={{ width: 0 }} animate={{ width: `${(scores[k] as number) * 10}%` }} transition={{ duration: 0.7, delay: 0.1 }} className="block h-full rounded-full bg-gradient-to-r from-[#b8913f] to-[#e8c97a]" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {openIssues.length > 0 && (
                <Section icon={AlertTriangle} title="Still needs your eye" tone="warn">
                  {openIssues.map((i, k) => (
                    <li key={k} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
                      <span className="font-black text-amber-800 dark:text-amber-300">{KIND_LABELS[i.kind || ''] || 'Check'}:</span>{' '}
                      <span className="font-semibold text-amber-900 dark:text-amber-100">“{i.quote}”</span>
                      <span className="block text-amber-800/80 dark:text-amber-200/70">{i.problem}</span>
                    </li>
                  ))}
                </Section>
              )}

              {(review.fixed_issues || []).length > 0 && (
                <Section icon={Wrench} title={`Fixed by the fact-checker (${review.fixed_issues!.length})`}>
                  {review.fixed_issues!.map((i, k) => (
                    <li key={k} className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-black text-gray-800 dark:text-gray-100">{KIND_LABELS[i.kind || ''] || 'Fix'}:</span>{' '}
                      <span className="line-through decoration-red-400/70">{i.quote}</span>
                      {i.replace ? <> → <span className="font-semibold text-emerald-700 dark:text-emerald-400">{i.replace}</span></> : <span className="font-semibold text-gray-500"> (removed)</span>}
                    </li>
                  ))}
                </Section>
              )}

              {(review.numbers_to_verify || []).length > 0 && (
                <Section icon={Search} title="Numbers to double-check">
                  <li className="text-xs font-semibold text-gray-600 dark:text-gray-300">{review.numbers_to_verify!.join(' · ')}</li>
                </Section>
              )}

              {(review.sources || []).length > 0 && (
                <Section icon={ShieldCheck} title="Where the facts came from">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {review.sources!.map((s, k) => (
                      <div key={k} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs dark:bg-white/[0.03]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" />
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-bold text-[#111827] hover:text-[#8b6a2b] dark:text-white">{s.name || host(s.url)}</a>
                        ) : <span className="min-w-0 flex-1 truncate font-bold text-[#111827] dark:text-white">{s.name}</span>}
                        {s.as_of && <span className="shrink-0 text-[10px] font-semibold text-gray-400">{fmtDate(s.as_of)}</span>}
                        {s.url && <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {(review.improvements || []).length > 0 && (
                <Section icon={Lightbulb} title="Make it even stronger">
                  {review.improvements!.map((t, k) => <li key={k} className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t}</li>)}
                </Section>
              )}

              {review.seo?.primary_keyword && (
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span className="font-black text-gray-700 dark:text-gray-200">Search target:</span> {review.seo.primary_keyword}
                  {review.seo.search_intent ? ` - answers “${review.seo.search_intent}”` : ''}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({ icon: Icon, title, tone, children }: { icon: typeof ShieldCheck; title: string; tone?: 'warn'; children: React.ReactNode }) {
  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>
        <Icon className="h-3.5 w-3.5" style={{ color: tone === 'warn' ? undefined : '#C9A24D' }} /> {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  )
}
