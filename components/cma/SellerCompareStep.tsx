'use client'

// Seller CMA "Compare" step (owner 11/18): "I should be able to flip through a comp then say if it's better or worse
// then go to the next ... its own flow first, then the more normal analysis page". Between Comps and Analysis on a
// seller report. One comp at a time: this home's photos beside that comp's, one tap - nicer / about the same / not as
// nice / not sure - and on to the next. Then kitchen, baths and big items replaced (SellerQuestions).
// Why: with no asking price the sales can't see condition. Free check on 368 past sales: comp-by-comp answers took
// the typical miss from 10.1% to 2.8% (4.2% with one answer in four a step off). Saved on
// report.subject.seller_answers.comp_marks (key = the comp's listing key, else its id); the engine reads them
// (cma_ai_service._seller_placement_check). A home for sale now skips the comparing: its asking price already says it.
//
// "Stupid simple" (owner 11/19 - grandparents use this): ONE question, "Are these photos how the home looks today?"
//  - Yes: nothing else to do here. The report's own photo pass answers every comp (and the kitchen and baths) while
//    it is made - no separate read, no stop (backend cma_seller_prefill.fill_blanks). On the finished report the
//    answers show here, marked AI; the agent can change any and tap Update the value - the same photo read is used,
//    the photos are never read again (POST /api/cma/{id}/seller-update).
//  - No (or no photos): the agent answers, as before.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowRight, Camera, Check, Loader2, Minus, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import api from '@/lib/api-service'
import FlowDock from '@/components/ui/FlowDock'
import PhotoFlip, { usePhotoList } from '@/components/cma/report/PhotoFlip'
import SellerQuestions from '@/components/cma/SellerQuestions'
import type { CmaComparable, CmaReport, CmaSellerAnswers } from '@/types'
import { normalizeImageUrl } from '@/lib/utils'

type Mark = 'better' | 'same' | 'worse' | 'not_sure'
const MARKS: { id: Mark, label: string, short: string, Icon: typeof ThumbsUp, on: string }[] = [
  { id: 'better', label: 'Nicer than this one', short: 'Nicer', Icon: ThumbsUp, on: 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
  { id: 'same', label: 'About the same', short: 'Same', Icon: Minus, on: 'border-[#C9A24D] bg-[#C9A24D]/12 text-[#111827] dark:text-white' },
  { id: 'worse', label: 'Not as nice', short: 'Not as nice', Icon: ThumbsDown, on: 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-300' },
]
const BADGE: Record<Mark, string> = {
  better: 'bg-emerald-600 text-white', same: 'bg-[#C9A24D] text-[#111827]', worse: 'bg-rose-600 text-white', not_sure: 'bg-gray-500 text-white',
}
const BADGE_TEXT: Record<Mark, string> = { better: 'Nicer', same: 'Same', worse: 'Not as nice', not_sure: 'Not sure' }

export const compMarkKey = (c: CmaComparable) => String(c.listing_key || c.id)
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '—')
const num = (n?: number | null) => (n || n === 0 ? Math.round(n).toLocaleString() : '—')
const soldWhen = (d?: string | null) => {
  if (!d) return null
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function Facts({ label, price, priceLabel, sqft, beds, baths, year, extra }: {
  label: string, price?: number | null, priceLabel: string, sqft?: number | null, beds?: number | null, baths?: number | null, year?: number | null, extra?: string | null
}) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">
      <span className="text-[13px] font-black text-[#111827] dark:text-white">{label}</span>
      {price ? <span><span className="font-black text-[#111827] dark:text-white">{money(price)}</span> {priceLabel}</span> : null}
      <span>{num(sqft)} sq ft</span>
      <span>{beds ?? '—'} bd · {baths ?? '—'} ba</span>
      {year ? <span>built {year}</span> : null}
      {extra ? <span>{extra}</span> : null}
    </div>
  )
}

export default function SellerCompareStep({ report, onSave, onNext, onBack, stepNumber, totalSteps, locked, onAddPhotos, onUpdated }: {
  report: CmaReport
  /** Go to the Home step to add the agent's own photos of the home. */
  onAddPhotos?: () => void
  onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>
  onNext: () => void
  onBack: () => void
  /** Update the value started: the report the server sent back (being made again). */
  onUpdated?: (r: CmaReport) => void
  stepNumber: number
  totalSteps: number
  locked: boolean
}) {
  const subject = report.subject
  const comps = useMemo(() => (report.comparables || []).filter(c => c.is_included !== false), [report.comparables])
  const listedNow = !!subject?.list_price && /active|coming soon/i.test(String(subject?.mls_status || ''))
  const [answers, setAnswers] = useState<CmaSellerAnswers>(subject?.seller_answers || {})
  // a new copy of the report from the server (the run filled answers in, Update the value) - show what it says
  const savedSa = subject?.seller_answers
  useEffect(() => { if (locked) setAnswers(savedSa || {}) }, [savedSa, locked])
  const savedMarks = (answers.comp_marks || {}) as Record<string, Mark>
  // the finished report: the agent may change an answer here and Update the value
  const made = locked && report.generation_status !== 'generating' && !!report.ai_analysis
  const canUpdate = made && !listedNow
  const [draft, setDraft] = useState<Record<string, Mark>>({})
  useEffect(() => { setDraft({}) }, [savedSa])
  const marks: Record<string, Mark> = { ...savedMarks, ...draft }
  const aiSet = useMemo(() => new Set(answers.ai_filled || []), [answers.ai_filled])
  const unread = useMemo(() => new Set(answers.ai_unread || []), [answers.ai_unread])
  const changedKeys = Object.keys(draft).filter(k => draft[k] !== savedMarks[k])
  const firstOpen = Math.max(0, comps.findIndex(c => !marks[compMarkKey(c)]))
  const [pos, setPos] = useState(firstOpen)
  const comp = comps[Math.min(pos, Math.max(0, comps.length - 1))]
  const subjectPhotos = usePhotoList([...(subject?.condition_photos || []), ...(subject?.photos || [])], subject?.photo_url)
  const compPhotos = usePhotoList(comp?.photos, comp?.photo_url)
  const doneCount = comps.filter(c => marks[compMarkKey(c)]).length
  const factsRef = useRef<HTMLDivElement>(null)
  const hasPhotos = subjectPhotos.length > 0
  const ownPhotos = (subject?.condition_photos || []).filter(Boolean).length
  const photosToday = answers.inside_photos === 'yes' && hasPhotos

  // Save a moment after each tap, and for sure on leaving the step.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<CmaSellerAnswers | null>(null)
  // A save that fails (no connection, server restarting) keeps the answers waiting and tries again every few
  // seconds; the step says so in words until it lands.
  const [unsaved, setUnsaved] = useState(false)
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const next = pending.current
    if (!next) return true
    const saved = await onSave({ subject: { ...report.subject, seller_answers: next } }, { silent: true })
    if (saved) {
      if (pending.current === next) pending.current = null
      setUnsaved(!!pending.current)
      return true
    }
    setUnsaved(true)
    if (!timer.current) timer.current = setTimeout(() => { void flushRef.current() }, 4000)
    return false
  }, [onSave, report.subject])
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => { void flushRef.current() }, [])
  const change = (next: CmaSellerAnswers) => {
    if (locked) return
    setAnswers(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 700)
  }

  const mark = (m: Mark) => {
    if (!comp) return
    const key = compMarkKey(comp)
    if (canUpdate) {
      // the finished report: held here until Update the value
      if (m === 'not_sure') return
      setDraft(d => {
        const n = { ...d }
        if (savedMarks[key] === m) delete n[key]
        else n[key] = m
        return n
      })
      return
    }
    if (locked) return
    const now = { ...savedMarks }
    if (now[key] === m) delete now[key]
    else now[key] = m
    change({ ...answers, comp_marks: now })
    if (now[key]) {
      // on to the next comp still to answer (or the facts below once all are done)
      const nextOpen = comps.findIndex((c, i) => i > pos && !now[compMarkKey(c)])
      const anyOpen = nextOpen >= 0 ? nextOpen : comps.findIndex(c => !now[compMarkKey(c)])
      window.setTimeout(() => {
        if (anyOpen >= 0) setPos(anyOpen)
        else factsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 380)
    }
  }

  // ---- Update the value (the finished report) ----
  const [updating, setUpdating] = useState(false)
  // what the change would do to the value, before they press it (11/20: one answer can move it 10-15%)
  const [preview, setPreview] = useState<{ now: number, about: number, change_pct: number } | null>(null)
  const draftSig = JSON.stringify(draft)
  useEffect(() => {
    setPreview(null)
    if (!canUpdate || !Object.keys(draft).length) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await api.cma.sellerUpdatePreview(report.id, draft)
        if (alive && r.data?.ok && r.data.now && r.data.about != null) setPreview({ now: r.data.now, about: r.data.about, change_pct: r.data.change_pct ?? 0 })
      } catch { /* the box works without it */ }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [draftSig, canUpdate, report.id])   // eslint-disable-line react-hooks/exhaustive-deps
  const [updateErr, setUpdateErr] = useState<string | null>(null)
  const runUpdate = async () => {
    setUpdating(true); setUpdateErr(null)
    try {
      const r = await api.cma.sellerUpdate(report.id, {
        comp_marks: Object.fromEntries(changedKeys.map(k => [k, draft[k]])),
        // the same line the report was made in (Save usage is the default everywhere)
        save_usage: report.generation_mode === 'save_usage' || !!report.ai_analysis?.save_usage,
      })
      if (!r.data) { setUpdateErr(r.error || r.message || 'The value could not be updated. Try again.'); return }
      setDraft({})
      onUpdated?.(r.data)
    } catch (e) {
      setUpdateErr(e instanceof Error ? e.message : 'The value could not be updated. Try again.')
    } finally { setUpdating(false) }
  }

  // the one question must be answered before going on (a home with photos, not for sale)
  const [askFirst, setAskFirst] = useState(false)
  const needsAnswer = !locked && !listedNow && hasPhotos && !answers.inside_photos && comps.length > 0
  const goNext = async () => {
    if (needsAnswer) { setAskFirst(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    if (await flush()) onNext()
  }
  const goBack = async () => { if (await flush()) onBack() }
  // ... nor close the page on them
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (pending.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const current = comp ? marks[compMarkKey(comp)] : undefined
  const currentIsAi = !!comp && aiSet.has(compMarkKey(comp)) && !draft[compMarkKey(comp)]
  // Nicer than every comp (or not as nice as any): the value has to be set past the edge of the sales - where the
  // free check missed most (typical 8-11% vs 2.2% when one comp matched). One close match fixes that, so say so.
  const rated = comps.map(c => marks[compMarkKey(c)]).filter(m => m === 'better' || m === 'same' || m === 'worse')
  const edge = !locked && doneCount === comps.length && rated.length >= 3
    ? (rated.every(m => m === 'better') ? 'better' : rated.every(m => m === 'worse') ? 'worse' : null) : null
  const aiCount = comps.filter(c => aiSet.has(compMarkKey(c))).length
  // what shows below the one question
  const showCompare = !listedNow && comps.length > 0 && !!comp && (locked ? doneCount > 0 : (!hasPhotos || answers.inside_photos === 'no'))
  const showRooms = listedNow || (locked ? true : (!hasPhotos || answers.inside_photos === 'no'))
  const roomAi = { kitchen: aiSet.has('kitchen') ? answers.kitchen : undefined, baths: aiSet.has('baths') ? answers.baths : undefined }

  return (
    <div className="space-y-5">
      <FlowDock step={stepNumber} total={totalSteps} onBack={goBack} onContinue={goNext} continueLabel="Analysis"
        note={listedNow || photosToday || locked ? undefined : `${doneCount} of ${comps.length} compared`} />

      {/* the one question (before the report) */}
      {!locked && !listedNow && comps.length > 0 && (
        <section data-cma-inside-photos className="cma-card rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><Camera className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              {photosToday ? (
                <div data-cma-photos-state="yes">
                  <h2 className="flex items-center gap-2 font-serif text-xl font-black text-[#111827] dark:text-white"><Sparkles className="h-5 w-5 text-[#C9A24D]" /> The AI will compare them for you</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    Nothing to answer here. When you make the report, the AI compares your home with each comp from the photos.
                    You&apos;ll see its answers on the finished report and can change any of them.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" data-cma-photos-continue onClick={() => void goNext()}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 text-[15px] font-black text-white shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98]">
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                    <button type="button" data-cma-photos-no onClick={() => change({ ...answers, inside_photos: 'no' })}
                      className="min-h-[48px] rounded-2xl px-3 text-[13px] font-black text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">
                      I&apos;d rather answer myself
                    </button>
                  </div>
                </div>
              ) : answers.inside_photos === 'no' && hasPhotos ? (
                <div data-cma-photos-state="no">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">You&apos;re answering yourself</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Your answers below are what the value is made from.</p>
                  <button type="button" data-cma-photos-yes onClick={() => change({ ...answers, inside_photos: 'yes' })}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#C9A24D]/60 px-3 text-[13px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                    <Sparkles className="h-4 w-4" /> The photos are current - let the AI answer
                  </button>
                </div>
              ) : !hasPhotos ? (
                <div data-cma-photos-state="none">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">No photos of this home on file</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Answer the questions below - or add your photos and the AI answers them.</p>
                  {onAddPhotos && (
                    <button type="button" onClick={onAddPhotos}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#C9A24D]/60 px-3 text-[13px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                      <Camera className="h-4 w-4" /> Add my photos
                    </button>
                  )}
                </div>
              ) : (
                <div data-cma-photos-state="ask">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Are these photos how the home looks today?</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    {ownPhotos ? 'Your photos of this home.' : `From its listing${subject?.last_sale_date ? ` (sold ${soldWhen(subject.last_sale_date) || 'before'})` : ''}.`}
                    {' '}If nothing big has changed since - a new kitchen, a remodel - tap Yes and the AI does the comparing.
                  </p>
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-hidden>
                    {subjectPhotos.slice(0, 8).map((src, i) => (
                      <img key={i} src={normalizeImageUrl(src)} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                  {askFirst && (
                    <p role="alert" data-cma-ask-first className="mt-2 flex items-center gap-1.5 text-[13px] font-black text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" /> Tap Yes or No first.
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                    <button type="button" data-cma-photos-yes onClick={() => { setAskFirst(false); change({ ...answers, inside_photos: 'yes' }) }}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#111827] px-6 text-[15px] font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                      <Check className="h-4 w-4" /> Yes
                    </button>
                    <button type="button" data-cma-photos-no onClick={() => { setAskFirst(false); change({ ...answers, inside_photos: 'no' }) }}
                      className="min-h-[52px] rounded-2xl border border-gray-300 px-6 text-[15px] font-black text-gray-700 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-200">
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* being made, the AI answering from the photos */}
      {locked && !made && !listedNow && answers.inside_photos === 'yes' && doneCount === 0 && (
        <p data-cma-photos-state="making" className="flex items-center gap-2 rounded-2xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.06] px-4 py-3 text-[13px] font-bold text-[#111827] dark:text-white">
          <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> The AI is comparing your home with each comp while it makes the report.
        </p>
      )}

      {unsaved && (
        <p role="alert" className="sticky top-2 z-20 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-[13px] font-black text-rose-800 shadow-sm dark:border-rose-500/40 dark:bg-rose-950/80 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Your answers aren&apos;t saved yet - we can&apos;t reach the server. Keep this page open; we&apos;re trying again every few seconds.
        </p>
      )}

      {showCompare && (
        <section data-cma-compare className="cma-card rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white sm:text-2xl">Your home vs each comp</h2>
              <p className="mt-0.5 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                {canUpdate
                  ? (aiCount
                    ? `The AI answered ${aiCount === comps.length ? 'these' : `${aiCount} of these`} from the photos. If one is wrong, tap the right answer and then Update the value.`
                    : 'These answers set the value. If one is wrong, tap the right answer and then Update the value.')
                  : <>You have been inside. Flip through both homes and say which is nicer - condition and finishes only, size and age are already adjusted for. The sales can&apos;t see this, so it makes the value far more accurate.</>}
              </p>
            </div>
            <span className="rounded-full bg-[#C9A24D]/12 px-3 py-1 text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">Comp {pos + 1} of {comps.length}</span>
          </div>

          {/* which comp - tap to jump, the answer shows on each */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {comps.map((c, i) => {
              const k = compMarkKey(c)
              const m = marks[k]
              const src = c.photo_url || c.photos?.[0]
              return (
                <button key={c.id} type="button" onClick={() => setPos(i)} aria-label={`Comp ${i + 1}${m ? `, ${BADGE_TEXT[m]}` : ''}`} aria-current={i === pos ? 'true' : undefined}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-2 transition dark:bg-white/5 ${i === pos ? 'ring-[#C9A24D]' : 'ring-transparent opacity-80 hover:opacity-100'}`}>
                  {src && <img src={normalizeImageUrl(src)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[9px] font-black text-white">#{i + 1}</span>
                  {m && <span className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-black ${BADGE[m]}`}>{BADGE_TEXT[m]}{aiSet.has(k) && !draft[k] ? ' · AI' : ''}</span>}
                  {draft[k] && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[10px] font-black text-white" aria-hidden>!</span>}
                </button>
              )
            })}
          </div>

          {/* the two homes - side by side on wide screens, stacked on a phone */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <PhotoFlip photos={subjectPhotos} resetKey="subject" fit="contain" counter quietArrows alt="Your home"
                className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/90">
                <span className="absolute left-2 top-2 rounded-lg bg-[#111827]/85 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-white">Your home</span>
              </PhotoFlip>
              <Facts label={subject?.street_address || 'Your home'} price={listedNow ? subject?.list_price : null} priceLabel="asking"
                sqft={subject?.above_grade_finished_area || subject?.sqft} beds={subject?.beds} baths={subject?.baths} year={subject?.year_built} />
            </div>
            <div>
              <PhotoFlip photos={compPhotos} resetKey={comp!.id} fit="contain" counter quietArrows alt={`Comp ${pos + 1}`}
                className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/90">
                <span className="absolute left-2 top-2 rounded-lg bg-[#C9A24D] px-2 py-1 text-[11px] font-black uppercase tracking-wide text-[#111827]">Comp #{pos + 1}</span>
                {compPhotos.length === 0 && (
                  <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-bold text-white/80">
                    No photos in this listing - tap Not sure unless you know the home
                  </span>
                )}
              </PhotoFlip>
              <Facts label={comp!.street_address || `Comp #${pos + 1}`} price={comp!.sale_price} priceLabel={soldWhen(comp!.close_date) ? `sold ${soldWhen(comp!.close_date)}` : 'sold'}
                sqft={comp!.above_grade_finished_area || comp!.sqft} beds={comp!.beds} baths={comp!.baths} year={comp!.year_built}
                extra={comp!.distance_miles != null ? `${comp!.distance_miles.toFixed(1)} mi away` : null} />
            </div>
          </div>

          {/* the question */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#111827] dark:text-white">On condition and finishes, your home is…</p>
            {currentIsAi && current && (
              <span data-cma-comp-ai className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
                <Sparkles className="h-3 w-3" /> The AI&apos;s answer, from the photos
              </span>
            )}
            {!current && comp && unread.has(compMarkKey(comp)) && (
              <span data-cma-comp-ask className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Camera className="h-3 w-3" /> The photos couldn&apos;t tell - answer if you know
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Your home compared with comp ${pos + 1}`}>
            {MARKS.map(o => {
              const on = current === o.id
              const off = locked && !canUpdate
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} disabled={off && !on} onClick={() => mark(o.id)}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-[13px] font-black transition-[border-color,background-color,transform] duration-150 ${off ? 'cursor-default' : 'active:scale-[0.97]'} ${on ? o.on : 'border-gray-200 bg-white/70 text-gray-700 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:bg-black/20 dark:text-gray-200'}`}>
                  <o.Icon className="h-4 w-4" />
                  <span className="leading-tight"><span className="sm:hidden">{o.short}</span><span className="hidden sm:inline">{o.label}</span></span>
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {!locked ? (
              <button type="button" onClick={() => mark('not_sure')} aria-pressed={current === 'not_sure'}
                className={`min-h-[44px] rounded-xl border px-3 text-[13px] font-black transition ${current === 'not_sure' ? 'border-gray-500 bg-gray-500/10 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:text-gray-400'}`}>
                Not sure - skip this one
              </button>
            ) : <span />}
            {pos < comps.length - 1 ? (
              <button type="button" onClick={() => setPos(pos + 1)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-black text-[#8b7355] hover:text-[#111827] dark:text-[#d7b974] dark:hover:text-white">
                Next comp <ArrowRight className="h-4 w-4" />
              </button>
            ) : !locked ? (
              <button type="button" onClick={() => factsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-[13px] font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                {doneCount === comps.length && <Check className="h-4 w-4" />} Next: kitchen &amp; baths <ArrowDown className="h-4 w-4" />
              </button>
            ) : <span />}
          </div>
          {edge && (
            <div data-cma-edge-note className="mt-4 rounded-2xl border border-[#C9A24D]/45 bg-[#C9A24D]/8 p-3 sm:p-4">
              <p className="text-[13px] font-bold leading-snug text-[#111827] dark:text-white">
                <span className="font-black">Your home is {edge === 'better' ? 'nicer than every comp' : 'not as nice as any of these comps'}.</span>{' '}
                The value has to be set {edge === 'better' ? 'above the dearest sale' : 'below the least expensive sale'}, which is the least certain spot.
                If a {edge === 'better' ? 'nicer' : 'plainer'} home sold nearby, add it - one close match makes the price far more reliable.
              </p>
              <button type="button" onClick={goBack}
                className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#C9A24D]/60 px-3 text-[13px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                Back to Comps to add one
              </button>
            </div>
          )}
        </section>
      )}

      {/* an answer changed on the finished report */}
      {canUpdate && changedKeys.length > 0 && (
        <div data-cma-update className="sticky bottom-3 z-20 rounded-2xl border border-[#C9A24D] bg-white p-4 shadow-xl dark:bg-[#151517]">
          <p className="text-[14px] font-black text-[#111827] dark:text-white">
            You changed {changedKeys.length === 1 ? 'one answer' : `${changedKeys.length} answers`}.
          </p>
          {preview && (
            <p data-cma-update-preview className="mt-1 text-[14px] font-bold text-[#111827] dark:text-white">
              This moves the value from {money(preview.now)} to about {money(preview.about)}
              {' '}<span className={preview.change_pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>({preview.change_pct >= 0 ? '+' : ''}{preview.change_pct}%)</span>.
              {Math.abs(preview.change_pct) >= 8 && <span className="block text-[12px] font-semibold text-amber-800 dark:text-amber-300">That&apos;s a big move - make sure this answer is right.</span>}
            </p>
          )}
          <p className="mt-0.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
            Update the value to use {changedKeys.length === 1 ? 'it' : 'them'}. Takes a few minutes - the photos aren&apos;t read again. Anything you typed on the report stays.
          </p>
          {updateErr && <p role="alert" className="mt-2 text-[13px] font-black text-rose-700 dark:text-rose-300">{updateErr}</p>}
          {/* room on the right on a phone: the floating helper button sits over the corner */}
          <div className="mt-3 flex flex-wrap gap-2 pr-16 sm:pr-0">
            <button type="button" data-cma-update-go disabled={updating} onClick={() => void runUpdate()}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 text-[15px] font-black text-white shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98] disabled:opacity-60">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Update the value
            </button>
            <button type="button" data-cma-update-undo onClick={() => setDraft({})}
              className="min-h-[48px] rounded-2xl px-3 text-[13px] font-black text-gray-500 hover:underline dark:text-gray-400">
              Undo
            </button>
          </div>
        </div>
      )}

      {showRooms && (
        <div ref={factsRef} className="scroll-mt-24">
          <SellerQuestions answers={answers} comps={comps} askPlacement={false} locked={locked} onChange={change}
            suggested={roomAi}
            intro={listedNow
              ? "You have been inside. Your answers go into the write-up as facts you confirmed - the asking price already tells the analysis how this home compares with its sales."
              : 'A few facts from your visit. They go into the write-up as things you confirmed.'} />
        </div>
      )}
      {(showRooms || showCompare) && !photosToday && (
        <div className="flex justify-end">
          <button type="button" onClick={() => void goNext()}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-6 text-[15px] font-black text-white shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98] sm:w-auto">
            Continue to Analysis <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
