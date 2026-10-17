'use client'

// The article's cover picture, made with AI right in the writer (user, 10/17): the AI's cover idea
// (editable) -> one picture, with what it costs shown first -> "Use as cover", or up to 2 changes
// described in the agent's own words. Backend: services/blog_cover_service.py (AI Media's model,
// limits and money guardrails; a failed try costs nothing).

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ClipboardCopy, ImagePlus, PenLine, Sparkles } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import { copyText } from '@/lib/copyText'

export default function AiCoverMaker({ blogId, idea: initialIdea, coverUrl, onUse }: {
  blogId: string
  idea?: string | null
  /** The article's cover right now (to show "This is your cover"). */
  coverUrl?: string | null
  onUse: (url: string) => Promise<void> | void
}) {
  const [est, setEst] = useState<{ percent: number | null; allowed: boolean; max_revisions: number } | null>(null)
  const [idea, setIdea] = useState(initialIdea || '')
  const [busy, setBusy] = useState<'make' | 'change' | 'use' | null>(null)
  const [img, setImg] = useState<string | null>(null)
  const [left, setLeft] = useState(2)
  const [changing, setChanging] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.blogs.aiCoverEstimate().then(r => { if (r.success && r.data) { setEst(r.data); setLeft(r.data.max_revisions) } })
  }, [])

  const pct = est?.percent != null ? (est.percent < 1 ? est.percent.toFixed(1) : String(Math.round(est.percent))) : null
  const used = !!img && !!coverUrl && coverUrl === img

  const run = async (kind: 'make' | 'change') => {
    setError(''); setBusy(kind)
    const r = await api.blogs.aiCover(blogId, kind === 'make' ? { idea } : { comment })
    setBusy(null)
    if (!r.success || !r.data) { setError(r.error || "Couldn't make that picture - nothing was charged."); return }
    setImg(r.data.url); setLeft(r.data.revisions_left); setChanging(false); setComment('')
  }
  const use = async () => {
    if (!img) return
    setBusy('use')
    await onUse(img)
    setBusy(null)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#1A1A1C]">
      <p className="flex items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white"><ImagePlus className="h-4 w-4 text-[#C9A24D]" /> Cover photo</p>
      <p className="mb-2.5 mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {est?.allowed === false ? 'The AI suggests this picture - make it in AI Media, or upload your own in the editor.' : 'Describe the picture (the AI suggested one) - then make it here.'}
      </p>

      {!img && (
        <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={3} disabled={!!busy}
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
      )}

      <AnimatePresence mode="wait" initial={false}>
        {busy === 'make' || busy === 'change' ? (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-3 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#C9A24D]/40 bg-[#fffaf0] dark:bg-[#C9A24D]/[0.05]">
            <OhpSpinner size={40} />
            <p className="text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">{busy === 'change' ? 'Making your change…' : 'Making your cover…'}</p>
            <p className="text-[10px] font-semibold text-gray-400">Usually 20-40 seconds</p>
          </motion.div>
        ) : img ? (
          <motion.div key={img} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="mt-1">
            <div className="relative overflow-hidden rounded-xl ring-1 ring-black/10">
              <img src={resolveMediaUrl(img)} alt="AI cover" className="aspect-video w-full object-cover" />
              {used && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow"><Check className="h-3 w-3" /> Your cover</span>}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      {!busy && est?.allowed !== false && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!img ? (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => run('make')} disabled={idea.trim().length < 8 || !est}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-[#111827] shadow-md transition hover:brightness-105 disabled:opacity-40">
              <Sparkles className="h-3.5 w-3.5" /> Make it with AI
            </motion.button>
          ) : (
            <>
              {!used && (
                <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={use}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-md transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
                  <Check className="h-3.5 w-3.5" /> Use as cover
                </motion.button>
              )}
              {left > 0 && !changing && (
                <button type="button" onClick={() => setChanging(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">
                  <PenLine className="h-3.5 w-3.5" /> Change it ({left} left)
                </button>
              )}
            </>
          )}
          {pct && <span className="text-[10px] font-bold text-gray-400">Each picture uses about {pct}% of your monthly AI</span>}
        </div>
      )}
      {busy === 'use' && <p className="mt-2 text-[11px] font-bold text-gray-400">Saving…</p>}

      <AnimatePresence initial={false}>
        {changing && !busy && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input autoFocus value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && comment.trim().length >= 3) run('change') }}
                placeholder="What should change? e.g. make it dusk, lose the snow" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              <button type="button" onClick={() => run('change')} disabled={comment.trim().length < 3} className="shrink-0 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-[#111827] disabled:opacity-40">Make the change</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {est?.allowed === false && (
        <button type="button" onClick={async () => { if (await copyText(idea)) { setCopied(true); setTimeout(() => setCopied(false), 1600) } }}
          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] dark:border-gray-700">
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <ClipboardCopy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy the idea'}
        </button>
      )}
    </div>
  )
}
