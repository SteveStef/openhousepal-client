'use client'

// "Fix grammar" (owner 11/19): one button for anything an agent types - "it can change what they write but not
// material, just grammar fixes". The blog editor's Refine made general (backend grammar_fix_service): the agent's own
// words go in, spelling / grammar / wording come back fixed, every fact, number, price and name kept (the server throws
// away any fix that changes one). Nothing changes until the agent picks: each fix shows before and after, the new
// words marked, and they use it or keep theirs. Small model, a fraction of a cent.
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, SpellCheck, X } from 'lucide-react'
import api from '@/lib/api-service'

export type GrammarItem = { id: string, text: string, label?: string }
export type GrammarChange = { id: string, before: string, after: string }

/** Which words of `after` are not in `before`, in order (longest common run of words). */
function changedWords(before: string, after: string): { word: string, changed: boolean }[] {
  const a = before.split(/\s+/).filter(Boolean)
  const b = after.split(/\s+/).filter(Boolean)
  const n = a.length, m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: { word: string, changed: boolean }[] = []
  let i = 0, j = 0
  while (j < m) {
    if (i < n && a[i] === b[j]) { out.push({ word: b[j], changed: false }); i++; j++ } else if (i < n && lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else { out.push({ word: b[j], changed: true }); j++ }
  }
  return out
}

export function GrammarCompare({ changes, labels, onUse, onKeep }: {
  changes: GrammarChange[], labels: Record<string, string | undefined>
  onUse: (picked: GrammarChange[]) => void, onKeep: () => void
}) {
  const [skip, setSkip] = useState<Set<string>>(new Set())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeep() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep])
  const marked = useMemo(() => changes.map(c => changedWords(c.before, c.after)), [changes])
  const picked = changes.filter(c => !skip.has(c.id))
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Fix grammar: yours and the fixed version"
      data-grammar-compare onMouseDown={e => { if (e.target === e.currentTarget) onKeep() }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-[#151517] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]"><SpellCheck className="h-3.5 w-3.5" /> Fix grammar</p>
            <p className="mt-0.5 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{changes.length === 1 ? 'One fix' : `${changes.length} fixes`} - which do you want?</p>
            <p className="mt-0.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">Spelling, grammar and wording only. Your facts and numbers are the same in both.</p>
          </div>
          <button type="button" onClick={onKeep} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          {changes.map((c, k) => {
            const off = skip.has(c.id)
            return (
              <div key={c.id} data-grammar-change className={off ? 'opacity-60' : ''}>
                {labels[c.id] && <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-gray-400">{labels[c.id]}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Yours</p>
                    <p data-grammar-before className="whitespace-pre-line text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{c.before}</p>
                  </div>
                  <div className="rounded-2xl border border-[#C9A24D]/50 bg-[#fffaf0] p-3.5 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/[0.06]">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">Fixed</p>
                    <p data-grammar-after className="whitespace-pre-line text-[15px] leading-relaxed text-[#111827] dark:text-white">
                      {marked[k].map((w, wi) => <span key={wi}>{w.changed ? <mark className="rounded bg-[#C9A24D]/30 px-0.5 text-inherit dark:bg-[#C9A24D]/35">{w.word}</mark> : w.word}{' '}</span>)}
                    </p>
                  </div>
                </div>
                {changes.length > 1 && (
                  <button type="button" onClick={() => setSkip(s => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}
                    className="mt-1.5 min-h-[36px] text-[12px] font-black text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">
                    {off ? 'Use the fixed one for this' : 'Keep mine for this one'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onKeep} className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-gray-200 px-5 text-sm font-black text-gray-600 transition hover:border-gray-400 dark:border-white/15 dark:text-gray-300">Keep mine</button>
          <button type="button" data-grammar-use disabled={!picked.length} onClick={() => onUse(picked)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-[#111827]">
            <Check className="h-4 w-4" strokeWidth={3} /> {picked.length === changes.length ? 'Use the fixed version' : `Use ${picked.length} fix${picked.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/** The button. `items` = only what the agent typed; `onApply` gets the fixes they picked. */
export default function GrammarFixButton({ items, where, onApply, className = '', label = 'Fix grammar' }: {
  items: GrammarItem[]
  where?: string
  onApply: (changes: GrammarChange[]) => void
  className?: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [changes, setChanges] = useState<GrammarChange[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean, text: string } | null>(null)
  const usable = items.filter(i => i.text.trim())
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t) }, [msg])
  const run = async () => {
    if (busy || !usable.length) return
    setBusy(true); setMsg(null)
    try {
      const r = await api.ai.fixGrammar({ passages: usable.map(i => ({ id: i.id, text: i.text })), where })
      if (!r.data) { setMsg({ ok: false, text: r.error || r.message || 'The grammar check did not go through. Try again.' }); return }
      if (!r.data.changes.length) setMsg({ ok: true, text: 'Looks good - nothing to fix.' })
      else setChanges(r.data.changes)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The grammar check did not go through. Try again.' })
    } finally { setBusy(false) }
  }
  if (!usable.length) return null
  return (
    <span className="relative inline-flex">
      <button type="button" data-grammar-fix onClick={() => void run()} disabled={busy} title="Fix spelling and grammar in what you typed"
        className={className || 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:border-[#C9A24D] hover:text-[#8b7355] active:scale-95 disabled:opacity-60 dark:border-gray-700 dark:bg-[#1b1b1e] dark:text-white'}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SpellCheck className="h-4 w-4" />}<span className="max-sm:hidden">{busy ? 'Checking…' : label}</span>
      </button>
      {msg && (
        <span role="status" data-grammar-msg className={`absolute right-0 top-full z-40 mt-1.5 w-max max-w-[16rem] rounded-xl px-3 py-2 text-[12px] font-black shadow-lg ${msg.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>{msg.text}</span>
      )}
      {changes && (
        <GrammarCompare changes={changes} labels={Object.fromEntries(items.map(i => [i.id, i.label]))}
          onKeep={() => setChanges(null)}
          onUse={picked => { onApply(picked); setChanges(null); setMsg({ ok: true, text: picked.length === 1 ? 'Fixed.' : `${picked.length} fixes made.` }) }} />
      )}
    </span>
  )
}
