'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, Download, ExternalLink, FileBarChart, Globe, Loader2, Search, StickyNote } from 'lucide-react'
import api from '@/lib/api-service'
import type { AdminGradingItem } from '@/types'
import { build, deliverOnIOS, isIOS, openPlaceholderTab, saveBlob } from '@/lib/pdfFile'

// Admin -> Tools -> Grading (owner, 11/01): every blog and CMA any agent makes, newest first, with
// who made it and when. Open or save each one as a PDF to send to an outside grader, then tick
// "Graded" and write down the grade it got - saved for good, so it can be looked up later.
// Grades are admin-only (admin_grades); agents never see them.

type KindFilter = 'all' | 'blog' | 'cma'
type GradedFilter = 'all' | 'todo' | 'done'

const when = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Report'
const fileName = (it: AdminGradingItem) => `${it.kind === 'blog' ? 'Blog' : 'CMA'}-${fileSafe(it.title)}.pdf`

async function makeDoc(it: AdminGradingItem) {
  if (it.kind === 'blog') {
    const r = await api.admin.gradingBlog(it.id)
    if (!r.success || !r.data) throw new Error(r.error || "Couldn't load that article.")
    const { BlogArticleDocument } = await import('@/lib/pdfsBlog')
    return <BlogArticleDocument blog={r.data} />
  }
  const r = await api.admin.gradingCma(it.id)
  if (!r.success || !r.data) throw new Error(r.error || "Couldn't load that CMA.")
  const { CmaPresentationDocument } = await import('@/lib/pdfs')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CmaPresentationDocument report={r.data as any} agent={r.data.agent} />
}

export default function GradingPanel() {
  const [items, setItems] = useState<AdminGradingItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')
  const [graded, setGraded] = useState<GradedFilter>('todo')
  const [q, setQ] = useState('')
  // Cards changed here stay where they are until the view changes - ticking "Graded" on the
  // "Not graded" view must not whisk the card away before the grade is typed in.
  const [stay, setStay] = useState<Set<string>>(new Set())
  useEffect(() => { setStay(new Set()) }, [kind, graded])

  const load = useCallback(async () => {
    const r = await api.admin.gradingItems({ limit: 300 })
    if (r.success && r.data) { setItems(r.data.items); setError(null) }
    else setError(r.error || "Couldn't load the list.")
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items || []).filter(it =>
      (kind === 'all' || it.kind === kind)
      && (graded === 'all' || stay.has(`${it.kind}:${it.id}`) || (graded === 'done' ? it.graded : !it.graded))
      && (!needle || [it.title, it.subtitle, it.agent.name, it.agent.email].some(v => v?.toLowerCase().includes(needle))))
  }, [items, kind, graded, q, stay])

  const counts = useMemo(() => {
    const all = items || []
    const inKind = all.filter(it => kind === 'all' || it.kind === kind)
    return { blog: all.filter(i => i.kind === 'blog').length, cma: all.filter(i => i.kind === 'cma').length, todo: inKind.filter(i => !i.graded).length, done: inKind.filter(i => i.graded).length, all: all.length }
  }, [items, kind])

  const patch = (it: AdminGradingItem, next: Partial<AdminGradingItem>) => {
    setStay(prev => (prev.has(`${it.kind}:${it.id}`) ? prev : new Set(prev).add(`${it.kind}:${it.id}`)))
    setItems(prev => (prev || []).map(x => (x.kind === it.kind && x.id === it.id ? { ...x, ...next } : x)))
  }

  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-black transition ${active ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10'}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#151517] lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          <button className={pill(kind === 'all')} onClick={() => setKind('all')}>All ({counts.all})</button>
          <button className={pill(kind === 'blog')} onClick={() => setKind('blog')}>Blogs ({counts.blog})</button>
          <button className={pill(kind === 'cma')} onClick={() => setKind('cma')}>CMAs ({counts.cma})</button>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:border-l lg:border-gray-200 lg:pl-3 dark:lg:border-white/10">
          <button className={pill(graded === 'todo')} onClick={() => setGraded('todo')}>Not graded ({counts.todo})</button>
          <button className={pill(graded === 'done')} onClick={() => setGraded('done')}>Graded ({counts.done})</button>
          <button className={pill(graded === 'all')} onClick={() => setGraded('all')}>Both</button>
        </div>
        <label className="relative lg:ml-auto lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or agent" className="w-full rounded-xl border border-gray-200 bg-[#faf9f7] py-2 pl-9 pr-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-black/30 dark:text-white" />
        </label>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!items && !error && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>}
      {items && !shown.length && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm font-bold text-gray-400 dark:border-white/10">
          {graded === 'todo' ? 'Nothing waiting to be graded.' : 'Nothing here yet.'}
        </p>
      )}

      <div className="space-y-3">
        {shown.map(it => <GradingRow key={`${it.kind}:${it.id}`} it={it} onSaved={next => patch(it, next)} />)}
      </div>
    </div>
  )
}

function GradingRow({ it, onSaved }: { it: AdminGradingItem; onSaved: (next: Partial<AdminGradingItem>) => void }) {
  const [busy, setBusy] = useState<'' | 'tab' | 'share'>('')
  const [pdfError, setPdfError] = useState<string | null>(null)
  // iPhone: the PDF is built on the first tap, then handed over on the next one (lib/pdfFile).
  const ready = useRef<Blob | null>(null)
  const [tapAgain, setTapAgain] = useState(false)
  const [grade, setGrade] = useState(it.grade || '')
  const [notes, setNotes] = useState(it.notes || '')
  const [notesOpen, setNotesOpen] = useState(!!it.notes)
  const [saving, setSaving] = useState<'' | 'saving' | 'saved' | 'error'>('')

  const runPdf = async (prefer: 'tab' | 'share') => {
    if (busy) return
    setPdfError(null)
    if (isIOS()) {
      if (ready.current) { deliverOnIOS(ready.current, fileName(it), prefer); setTapAgain(false); return }
      setBusy(prefer)
      try { ready.current = await build(await makeDoc(it)); setTapAgain(true) }
      catch (e) { setPdfError(e instanceof Error && e.message !== 'pdf' ? e.message : "Couldn't make the PDF.") }
      finally { setBusy('') }
      return
    }
    // The new tab has to open during the click; the PDF fills it once built.
    const tab = prefer === 'tab' ? openPlaceholderTab() : null
    setBusy(prefer)
    try {
      const blob = await build(await makeDoc(it))
      if (tab) {
        const url = URL.createObjectURL(blob)
        tab.location.href = url
        setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
      } else saveBlob(blob, fileName(it))
    } catch (e) {
      tab?.close()
      setPdfError(e instanceof Error ? e.message : "Couldn't make the PDF.")
    } finally { setBusy('') }
  }

  const save = async (next: { graded?: boolean; grade?: string; notes?: string }) => {
    const body = { graded: next.graded ?? it.graded, grade: next.grade ?? grade, notes: next.notes ?? notes }
    if (body.graded === it.graded && (body.grade || '') === (it.grade || '') && (body.notes || '') === (it.notes || '')) return
    const before = { graded: it.graded, grade: it.grade, notes: it.notes, graded_at: it.graded_at }
    // the tick shows at once; the server's answer then fills in the date (or puts it back on failure)
    onSaved({ graded: body.graded, grade: body.grade || null, notes: body.notes || null })
    setSaving('saving')
    const r = await api.admin.saveGrade(it.kind, it.id, body)
    if (r.success && r.data) { onSaved(r.data); setSaving('saved'); setTimeout(() => setSaving(s => (s === 'saved' ? '' : s)), 1800) }
    else { onSaved(before); setSaving('error') }
  }

  const Icon = it.kind === 'blog' ? BookOpen : FileBarChart
  const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-60'

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition dark:bg-[#151517] ${it.graded ? 'border-emerald-200 dark:border-emerald-500/25' : 'border-gray-200 dark:border-white/10'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${it.kind === 'blog' ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>
              <Icon className="h-3 w-3" /> {it.kind === 'blog' ? 'Blog' : 'CMA'}
            </span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-white/5 dark:text-gray-400">{it.status.toLowerCase()}</span>
            {it.ai_made && <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">AI{it.cost_usd != null ? ` · $${Number(it.cost_usd).toFixed(2)}` : ''}</span>}
            {it.graded && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3 w-3" /> Graded{it.grade ? ` · ${it.grade}` : ''}</span>}
          </div>
          <p className="mt-1.5 text-[15px] font-black leading-snug text-[#111827] dark:text-white">{it.title}</p>
          {it.subtitle && <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{it.subtitle}</p>}
          <p className="mt-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
            {it.agent.name}{it.agent.brokerage ? ` · ${it.agent.brokerage}` : ''}
            <span className="font-semibold text-gray-400"> · Made {when(it.created_at)}</span>
          </p>
          {it.agent.email && <p className="text-[11px] font-semibold text-gray-400">{it.agent.email}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => runPdf('tab')} disabled={!!busy} className={`${btn} bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]`}>
              {busy === 'tab' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} {tapAgain ? 'Tap to open' : 'Open PDF'}
            </button>
            <button onClick={() => runPdf('share')} disabled={!!busy} className={`${btn} bg-white text-[#111827] ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-white/5 dark:text-white dark:ring-white/10`}>
              {busy === 'share' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {tapAgain ? 'Tap to save' : 'Save PDF'}
            </button>
            {it.live_path && (
              <a href={it.live_path} target="_blank" rel="noopener" className={`${btn} bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10`}>
                <Globe className="h-3.5 w-3.5" /> Live page
              </a>
            )}
          </div>
          {pdfError && <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">{pdfError}</p>}
        </div>

        <div className="w-full shrink-0 rounded-xl bg-[#faf9f7] p-3 dark:bg-black/25 lg:w-80">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={it.graded} onChange={e => save({ graded: e.target.checked })} className="h-5 w-5 rounded accent-emerald-600" />
            <span className="text-sm font-black text-[#111827] dark:text-white">Graded</span>
            {it.graded && it.graded_at && <span className="text-[11px] font-semibold text-gray-400">{when(it.graded_at)}</span>}
            <span className="ml-auto text-[11px] font-bold">
              {saving === 'saving' && <span className="text-gray-400">Saving…</span>}
              {saving === 'saved' && <span className="text-emerald-600 dark:text-emerald-400">Saved</span>}
              {saving === 'error' && <span className="text-red-600">Didn&apos;t save</span>}
            </span>
          </label>
          <label className="mt-2.5 block">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Grade it got</span>
            <input
              value={grade} maxLength={40} onChange={e => setGrade(e.target.value)} onBlur={() => save({ grade })}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="e.g. 11/11, A-, 92"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-black/30 dark:text-white"
            />
          </label>
          {notesOpen ? (
            <label className="mt-2.5 block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Notes</span>
              <textarea
                value={notes} maxLength={4000} rows={3} onChange={e => setNotes(e.target.value)} onBlur={() => save({ notes })}
                placeholder="What the grader said"
                className="mt-1 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-black/30 dark:text-white"
              />
            </label>
          ) : (
            <button onClick={() => setNotesOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
              <StickyNote className="h-3.5 w-3.5" /> Add notes
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
