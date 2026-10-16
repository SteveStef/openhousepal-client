'use client'

// Bring reviews over from Zillow, Google, Realtor.com... so an experienced agent's page doesn't
// look brand new. Those sites don't let other apps pull an agent's reviews (Google's API gives 5,
// Zillow none), so the agent copies them from their own profile page and pastes them here: we read
// out each review (name, stars, date, words - never reworded), they check the list, then save.
// Or they add one by hand.
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ClipboardPaste, Loader2, PenLine, Star, Upload } from 'lucide-react'
import api from '@/lib/api-service'
import { todayLocal } from '@/lib/relativeDays'

const SOURCES = [
  { id: 'zillow', label: 'Zillow', how: 'Open your Zillow agent profile, scroll to Reviews and tap "See all". Select the reviews (drag over them, or press Ctrl+A / Cmd+A), copy, and paste below.' },
  { id: 'google', label: 'Google', how: 'Open your Google Business Profile, click your reviews, select them all (Ctrl+A / Cmd+A), copy, and paste below.' },
  { id: 'realtor', label: 'Realtor.com', how: 'Open your Realtor.com profile, go to Ratings & Reviews, select them all, copy, and paste below.' },
  { id: 'homes', label: 'Homes.com', how: 'Open your Homes.com agent page, go to Reviews, select them all, copy, and paste below.' },
  { id: 'facebook', label: 'Facebook', how: 'Open your Facebook page, go to Reviews, select them, copy, and paste below.' },
  { id: 'other', label: 'Somewhere else', how: 'Copy the reviews from wherever they are and paste them below.' },
] as const
type SourceId = typeof SOURCES[number]['id']
type Row = { name: string; rating: number | null; date: string | null; body: string; already_here?: boolean; keep: boolean }

function StarPicker({ value, onChange, size = 'h-5 w-5' }: { value: number | null; onChange: (n: number) => void; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} className="p-0.5">
          <Star className={`${size} ${value != null && value >= n ? 'fill-[#C9A24D] text-[#C9A24D]' : 'text-gray-300 dark:text-gray-600'}`} />
        </button>
      ))}
    </span>
  )
}

export default function ReviewImporter({ inputCls, onImported }: { inputCls: string; onImported: () => void }) {
  const [source, setSource] = useState<SourceId>('zillow')
  const [mode, setMode] = useState<'paste' | 'one'>('paste')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [one, setOne] = useState<{ name: string; rating: number | null; date: string; body: string }>({ name: '', rating: 5, date: '', body: '' })
  const src = SOURCES.find(s => s.id === source)!

  const read = async () => {
    setBusy(true); setMsg(null); setRows(null)
    const r = await api.agentHub.parseReviews(text)
    setBusy(false)
    if (!r.success || !r.data) { setMsg({ ok: false, text: r.error || 'Couldn’t read those - try copying again.' }); return }
    if (!r.data.reviews.length) { setMsg({ ok: false, text: 'No reviews found in that. Make sure the copied part includes the review text and names.' }); return }
    setRows(r.data.reviews.map(x => ({ ...x, keep: !x.already_here })))
  }
  const missingStars = (rows || []).some(r => r.keep && r.rating == null)
  const chosen = (rows || []).filter(r => r.keep)
  const save = async (list: { name: string; rating: number; body: string; date?: string | null }[]) => {
    setBusy(true); setMsg(null)
    const r = await api.agentHub.importReviews(source, list, confirm)
    setBusy(false)
    if (!r.success || !r.data) { setMsg({ ok: false, text: r.error || 'Couldn’t save - try again.' }); return }
    const { imported, skipped } = r.data
    setMsg({ ok: true, text: `Added ${imported} review${imported === 1 ? '' : 's'} from ${src.label}${skipped ? ` (${skipped} were already here)` : ''}. They count toward your star rating now.` })
    setRows(null); setText(''); setOne({ name: '', rating: 5, date: '', body: '' }); setConfirm(false)
    onImported()
  }

  return (
    <div data-testid="review-importer" className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#121214] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><Upload className="h-5 w-5" /></span>
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">Bring in reviews from other sites</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Already have reviews on Zillow, Google or Realtor.com? Bring them here so your page shows your real track record. Each one keeps its date and a small “via Zillow” label.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {SOURCES.map(s => (
          <button key={s.id} type="button" onClick={() => setSource(s.id)} aria-pressed={source === s.id}
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${source === s.id ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 inline-flex rounded-xl border border-gray-200 p-0.5 dark:border-white/10">
        {([['paste', 'Paste a bunch', ClipboardPaste], ['one', 'Add one by hand', PenLine]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => { setMode(id); setMsg(null) }}
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-black transition ${mode === id ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === 'paste' && !rows && (
        <div className="mt-3 space-y-2.5">
          <p className="text-[12px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400"><b className="text-[#111827] dark:text-white">How:</b> {src.how}</p>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={`Paste your ${src.label} reviews here…`}
            className={`${inputCls} min-h-[140px] resize-y`} />
          <button type="button" onClick={read} disabled={busy || text.trim().length < 20}
            className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-white dark:text-[#111827]">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5" />} {busy ? 'Reading your reviews…' : 'Find the reviews'}
          </button>
          <p className="text-[11px] font-semibold text-gray-400">Uses a little of your monthly AI allowance. We copy each review word for word - nothing is rewritten.</p>
        </div>
      )}

      {mode === 'paste' && rows && (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs font-black text-[#111827] dark:text-white">Found {rows.length} review{rows.length === 1 ? '' : 's'} - untick any you don’t want{missingStars ? ', and pick stars where they’re missing' : ''}.</p>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={i} data-testid="import-row" className={`rounded-2xl border p-3 transition ${r.keep ? 'border-[#C9A24D]/40 bg-[#C9A24D]/[0.05]' : 'border-gray-200 opacity-60 dark:border-white/10'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="checkbox" checked={r.keep} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))} className="h-4 w-4 accent-[#C9A24D]" aria-label={`Include ${r.name}`} />
                  <span className="text-sm font-black text-[#111827] dark:text-white">{r.name}</span>
                  <StarPicker value={r.rating} onChange={n => setRows(rows.map((x, j) => j === i ? { ...x, rating: n } : x))} size="h-4 w-4" />
                  {r.rating == null && r.keep && <span className="text-[10px] font-black uppercase text-amber-600">Pick stars</span>}
                  {r.date && <span className="text-[11px] font-semibold text-gray-400">{new Date(r.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
                  {r.already_here && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-gray-500 dark:bg-white/10">Already here</span>}
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">“{r.body}”</p>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9A24D]" />
            These are real reviews my clients left for me on {src.label}.
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !confirm || !chosen.length || missingStars}
              onClick={() => save(chosen.map(r => ({ name: r.name, rating: r.rating as number, body: r.body, date: r.date })))}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] transition hover:-translate-y-0.5 disabled:opacity-40">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Add {chosen.length} review{chosen.length === 1 ? '' : 's'}
            </button>
            <button type="button" onClick={() => setRows(null)} className="rounded-xl px-3 py-2.5 text-xs font-black text-gray-500 hover:text-[#111827] dark:hover:text-white">Start over</button>
          </div>
        </div>
      )}

      {mode === 'one' && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input value={one.name} onChange={e => setOne({ ...one, name: e.target.value })} placeholder="Client’s name (e.g. Jennifer M.)" className={inputCls} />
          <input type="date" value={one.date} max={todayLocal()} onChange={e => setOne({ ...one, date: e.target.value })} className={inputCls} aria-label="When they wrote it" />
          <div className="flex items-center gap-2 sm:col-span-2"><span className="text-xs font-black text-gray-500">Stars</span><StarPicker value={one.rating} onChange={n => setOne({ ...one, rating: n })} /></div>
          <textarea value={one.body} onChange={e => setOne({ ...one, body: e.target.value })} rows={4} placeholder="Paste or type the review, word for word" className={`${inputCls} sm:col-span-2`} />
          <label className="flex items-start gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9A24D]" />
            This is a real review my client left for me on {src.label}.
          </label>
          <button type="button" disabled={busy || !confirm || !one.name.trim() || one.body.trim().length < 3 || !one.rating}
            onClick={() => save([{ name: one.name.trim(), rating: one.rating as number, body: one.body.trim(), date: one.date || null }])}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] transition hover:-translate-y-0.5 disabled:opacity-40 sm:col-span-2 sm:justify-self-start">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Add review
          </button>
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`mt-3 overflow-hidden rounded-xl border px-3 py-2 text-xs font-semibold ${msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'}`}>
            {msg.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
