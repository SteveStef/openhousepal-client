'use client'

import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles, X } from 'lucide-react'
import { aiUsedLine, type AiShare } from '@/lib/studio/aiShare'

// The editor's Refine button, after the AI answers (owner, 11/16: "it shows a before and after and you click which one
// you want, just like ChatGPT does and Apple Intelligence does"). The agent's own words on one side, the corrected
// words on the other with what changed marked - nothing in the article changes until they pick "Use the new version".

export type RefineChange = { id: string; type: string; before: string; after: string; data: Record<string, any> }

/** Which words of `after` are not in `before`, in order (longest common run of words). */
function changedWords(before: string, after: string): { word: string; changed: boolean }[] {
  const a = before.split(/(\s+)/).filter(w => w.trim())
  const b = after.split(/(\s+)/).filter(w => w.trim())
  const n = a.length, m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: { word: string; changed: boolean }[] = []
  let i = 0, j = 0
  while (j < m) {
    if (i < n && a[i] === b[j]) { out.push({ word: b[j], changed: false }); i++; j++ }
    else if (i < n && lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else { out.push({ word: b[j], changed: true }); j++ }
  }
  return out
}

const KIND: Record<string, string> = { heading: 'Heading', subheading: 'Subheading', paragraph: 'Paragraph', quote: 'Pull quote', callout: 'Tip box', bulleted_list: 'Bullet points', numbered_list: 'Numbered steps' }

export default function RefineCompare({ changes, used, onUse, onKeep }: {
  changes: RefineChange[]
  used?: AiShare | null
  onUse: () => void
  onKeep: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeep() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep])
  const marked = useMemo(() => changes.map(c => changedWords(c.before, c.after)), [changes])
  const usedLine = aiUsedLine(used)
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Refine: yours and the new version" data-testid="blog-refine-compare" onMouseDown={e => { if (e.target === e.currentTarget) onKeep() }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-[#151517] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> Refine</p>
            <p className="mt-0.5 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">Which one do you want?</p>
            <p className="mt-0.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">Spelling, grammar and wording only. Your facts and numbers are the same in both.</p>
          </div>
          <button type="button" onClick={onKeep} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          {changes.map((c, k) => (
            <div key={c.id} className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Yours{changes.length > 1 ? ` · ${KIND[c.type] || 'Passage'}` : ''}</p>
                <p data-testid="blog-refine-before" className="whitespace-pre-line text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{c.before}</p>
              </div>
              <div className="rounded-2xl border border-[#C9A24D]/50 bg-[#fffaf0] p-3.5 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/[0.06]">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">New version</p>
                <p data-testid="blog-refine-after" className="whitespace-pre-line text-[15px] leading-relaxed text-[#111827] dark:text-white">
                  {c.after.split('\n').map((line, li) => {
                    // the marks are per word in order; walk them line by line so a list keeps its lines
                    const count = line.split(/\s+/).filter(Boolean).length
                    const start = c.after.split('\n').slice(0, li).reduce((s, l) => s + l.split(/\s+/).filter(Boolean).length, 0)
                    return (
                      <span key={li}>
                        {marked[k].slice(start, start + count).map((w, wi) => (
                          <span key={wi}>{w.changed ? <mark className="rounded bg-[#C9A24D]/30 px-0.5 text-inherit dark:bg-[#C9A24D]/35">{w.word}</mark> : w.word}{' '}</span>
                        ))}
                        {li < c.after.split('\n').length - 1 ? '\n' : ''}
                      </span>
                    )
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center">
          {usedLine && <p data-testid="blog-refine-used" className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 sm:mr-auto">{usedLine}</p>}
          <button type="button" onClick={onKeep} className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-600 transition hover:border-gray-400 dark:border-white/15 dark:text-gray-300">Keep mine</button>
          <button type="button" onClick={onUse} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]"><Check className="h-4 w-4" strokeWidth={3} /> Use the new version</button>
        </div>
      </motion.div>
    </div>
  )
}
