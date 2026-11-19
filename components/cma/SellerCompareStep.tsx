'use client'

// Seller CMA "Compare" step (owner 11/18): "I should be able to flip through a comp then say if it's better or worse
// then go to the next ... its own flow first, then the more normal analysis page". Between Comps and Analysis on a
// seller report. One comp at a time: this home's photos beside that comp's, one tap - nicer / about the same / not as
// nice / not sure - and on to the next. Then kitchen, baths and big items replaced (SellerQuestions).
// Why: with no asking price the sales can't see condition. Free check on 368 past sales: comp-by-comp answers took
// the typical miss from 10.1% to 2.8% (4.2% with one answer in four a step off). Saved on
// report.subject.seller_answers.comp_marks (key = the comp's listing key, else its id); the engine reads them
// (cma_ai_service._seller_placement_check). A home for sale now skips the comparing: its asking price already says it.
// Locked with the comps once the AI has written the report.
// Two paths (owner 11/19): "Do you have inside photos?" Yes -> the AI reads them and fills the answers in (the
// report reuses that read - no second look at the photos); the agent checks them, and an answer changed from what
// the photos suggested is asked about once ("keep yours?"). No -> the agent answers. Rooms the photos don't show and
// comps the AI couldn't judge are left for the agent. See backend cma_seller_prefill.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowRight, Camera, Check, Leaf, Loader2, Lock, Minus, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, Zap } from 'lucide-react'
import api from '@/lib/api-service'
import FlowDock from '@/components/ui/FlowDock'
import PhotoFlip, { usePhotoList } from '@/components/cma/report/PhotoFlip'
import SellerQuestions from '@/components/cma/SellerQuestions'
import type { CmaComparable, CmaReport, CmaSellerAnswers, CmaSellerPrefill } from '@/types'
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
const SAY: Record<Mark, string> = { better: 'nicer than', same: 'about the same as', worse: 'not as nice as', not_sure: 'not sure about' }

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

export default function SellerCompareStep({ report, onSave, onNext, onBack, stepNumber, totalSteps, locked, onAddPhotos }: {
  report: CmaReport
  /** Go to the Home step to add the agent's own photos of the home. */
  onAddPhotos?: () => void
  onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>
  onNext: () => void
  onBack: () => void
  stepNumber: number
  totalSteps: number
  locked: boolean
}) {
  const subject = report.subject
  const comps = useMemo(() => (report.comparables || []).filter(c => c.is_included !== false), [report.comparables])
  const listedNow = !!subject?.list_price && /active|coming soon/i.test(String(subject?.mls_status || ''))
  const [answers, setAnswers] = useState<CmaSellerAnswers>(subject?.seller_answers || {})
  const marks = (answers.comp_marks || {}) as Record<string, Mark>
  const firstOpen = Math.max(0, comps.findIndex(c => !marks[compMarkKey(c)]))
  const [pos, setPos] = useState(firstOpen)
  const comp = comps[Math.min(pos, Math.max(0, comps.length - 1))]
  const subjectPhotos = usePhotoList([...(subject?.condition_photos || []), ...(subject?.photos || [])], subject?.photo_url)
  const compPhotos = usePhotoList(comp?.photos, comp?.photo_url)
  const doneCount = comps.filter(c => marks[compMarkKey(c)]).length
  const factsRef = useRef<HTMLDivElement>(null)
  const kept = useMemo(() => answers.kept || [], [answers.kept])

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
    if (!comp || locked) return
    const key = compMarkKey(comp)
    const now = { ...marks }
    if (now[key] === m) delete now[key]
    else now[key] = m
    change({ ...answers, comp_marks: now })
    const ai = sugMarks[key]
    if (now[key] && ai && now[key] !== 'not_sure' && now[key] !== ai && !kept.includes(key)) return   // ask first (below)
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

  // ---- the AI's read of the photos (two paths, 11/19) ----
  const [prefill, setPrefill] = useState<CmaSellerPrefill | null>(null)
  const [speed, setSpeed] = useState<'save_usage' | 'now'>('save_usage')
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const usePhotosPath = !listedNow && !locked && comps.length > 0
  const readingSince = prefill?.status === 'reading' ? prefill.started_at : null
  useEffect(() => {
    if (!usePhotosPath) return
    let alive = true
    let t: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      try {
        const st = (await api.cma.getSellerPrefill(report.id)).data
        if (!alive) return
        if (!st) { t = setTimeout(load, 10000); return }
        setPrefill(st)
        if (st.status === 'reading') t = setTimeout(load, 6000)
      } catch { if (alive) t = setTimeout(load, 10000) }
    }
    void load()
    return () => { alive = false; if (t) clearTimeout(t) }
  }, [report.id, usePhotosPath, readingSince])
  const fresh = prefill?.status === 'ready' && !prefill.stale ? prefill.suggest : undefined
  const sugMarks = (fresh?.comp_marks || {}) as Record<string, Mark>
  // once per read: fill every question the agent hasn't answered yet (never over an answer the agent gave)
  useEffect(() => {
    if (!fresh || !prefill?.finished_at || answers.ai_applied === prefill.finished_at || locked) return
    const now = { ...marks }
    for (const c of comps) {
      const k = compMarkKey(c)
      if (!now[k] && sugMarks[k]) now[k] = sugMarks[k]
    }
    change({
      ...answers, comp_marks: now, inside_photos: 'yes', ai_applied: prefill.finished_at,
      ...(!answers.kitchen && fresh.kitchen ? { kitchen: fresh.kitchen } : {}),
      ...(!answers.baths && fresh.baths ? { baths: fresh.baths } : {}),
    })
    const open = comps.findIndex(c => !now[compMarkKey(c)])
    if (open >= 0) setPos(open)
  }, [fresh, prefill?.finished_at])   // eslint-disable-line react-hooks/exhaustive-deps
  const startRead = async () => {
    setStarting(true); setStartErr(null)
    if (!(await flush())) { setStarting(false); return }
    try {
      const r = await api.cma.startSellerPrefill(report.id, { save_usage: speed === 'save_usage' })
      if (!r.data) { setStartErr(r.error || r.message || 'Could not start reading the photos. Try again.'); return }
      setPrefill(r.data)
      if (answers.inside_photos !== 'yes') change({ ...answers, inside_photos: 'yes' })
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : 'Could not start reading the photos. Try again.')
    } finally { setStarting(false) }
  }
  // an answer the agent changed from what the photos suggested, not yet confirmed
  const differsComp = (c?: CmaComparable) => {
    if (!c || !fresh) return false
    const k = compMarkKey(c), mine = marks[k], ai = sugMarks[k]
    return !!mine && mine !== 'not_sure' && !!ai && mine !== ai && !kept.includes(k)
  }
  const differsRoom = (key: 'kitchen' | 'baths') => !!fresh?.[key] && !!answers[key] && answers[key] !== fresh[key] && !kept.includes(key)
  const unconfirmed = [...comps.filter(c => differsComp(c)).map(c => compMarkKey(c)),
    ...(['kitchen', 'baths'] as const).filter(k => differsRoom(k))]
  const keep = (key: string) => change({ ...answers, kept: Array.from(new Set([...kept, key])) })
  const applyAi = (c: CmaComparable) => {
    const k = compMarkKey(c)
    if (sugMarks[k]) change({ ...answers, comp_marks: { ...marks, [k]: sugMarks[k] } })
  }
  const aiFilled = fresh ? comps.filter(c => sugMarks[compMarkKey(c)] && marks[compMarkKey(c)] === sugMarks[compMarkKey(c)]).length
    + (['kitchen', 'baths'] as const).filter(k => fresh[k] && answers[k] === fresh[k]).length : 0
  const stillOpen = fresh ? [
    ...comps.map((c, i) => ({ c, i })).filter(({ c }) => !marks[compMarkKey(c)]).map(({ i }) => `Comp #${i + 1}`),
    ...(['kitchen', 'baths'] as const).filter(k => !answers[k]).map(k => (k === 'kitchen' ? 'Kitchen' : 'Bathrooms')),
  ] : []
  const hasPhotos = subjectPhotos.length > 0
  const ownPhotos = (subject?.condition_photos || []).filter(Boolean).length

  // Never leave the step with answers that did not save - nor with an answer changed from the photos unconfirmed.
  const goNext = async () => {
    if (unconfirmed.length) {
      setBlocked(true)
      const i = comps.findIndex(c => compMarkKey(c) === unconfirmed[0])
      if (i >= 0) setPos(i)
      else factsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setBlocked(false)
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
  // Nicer than every comp (or not as nice as any): the value has to be set past the edge of the sales - where the
  // free check missed most (typical 8-11% vs 2.2% when one comp matched). One close match fixes that, so say so.
  const rated = comps.map(c => marks[compMarkKey(c)]).filter(m => m === 'better' || m === 'same' || m === 'worse')
  const edge = !locked && doneCount === comps.length && rated.length >= 3
    ? (rated.every(m => m === 'better') ? 'better' : rated.every(m => m === 'worse') ? 'worse' : null) : null

  return (
    <div className="space-y-5">
      <FlowDock step={stepNumber} total={totalSteps} onBack={goBack} onContinue={goNext} continueLabel="Analysis"
        note={listedNow ? undefined : `${doneCount} of ${comps.length} compared`} />

      {usePhotosPath && (
        <section data-cma-inside-photos className="cma-card rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><Camera className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              {prefill?.status === 'reading' ? (
                <div data-cma-prefill="reading">
                  <h2 className="flex items-center gap-2 font-serif text-xl font-black text-[#111827] dark:text-white"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /> Reading the photos</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    {prefill.save_usage
                      ? 'In the slower line that uses about half the AI - usually a few minutes. You can leave this page; the bell tells you when the answers are ready to check.'
                      : 'About a minute. The answers fill in below when it is done.'}
                    {' '}You can start answering meanwhile - the AI never changes an answer you gave.
                  </p>
                </div>
              ) : prefill?.status === 'ready' && !prefill.stale ? (
                <div data-cma-prefill="ready">
                  <h2 className="flex items-center gap-2 font-serif text-xl font-black text-[#111827] dark:text-white"><Sparkles className="h-5 w-5 text-[#C9A24D]" /> The AI filled in {aiFilled} of {comps.length + 2} answers</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    From the photos. Check each one and change any that look wrong - the value is made from these answers. Answers marked AI came from the photos.
                  </p>
                  {stillOpen.length > 0 && (
                    <p data-cma-prefill-open className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      The photos couldn&apos;t answer these - please do: {stillOpen.join(', ')}.
                    </p>
                  )}
                </div>
              ) : answers.inside_photos === 'no' ? (
                <div data-cma-prefill="answering">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">You&apos;re answering yourself</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">No inside photos - your answers below are what the value is made from.</p>
                  {hasPhotos && (
                    <button type="button" onClick={() => change({ ...answers, inside_photos: 'yes' })}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#C9A24D]/60 px-3 text-[13px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                      <Sparkles className="h-4 w-4" /> Let the AI fill them in from the photos instead
                    </button>
                  )}
                </div>
              ) : answers.inside_photos === 'yes' && hasPhotos ? (
                <div data-cma-prefill="choose-speed">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Let the AI fill in the answers</h2>
                  {prefill?.status === 'failed' && <p role="alert" className="mt-1 text-[13px] font-black text-rose-700 dark:text-rose-300">{prefill.error}</p>}
                  {prefill?.status === 'ready' && prefill.stale && (
                    <p data-cma-prefill-stale className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      Your comps or photos changed after the AI read them, so its answers may not fit any more. Read them again, or check the answers below yourself.
                    </p>
                  )}
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    It reads {ownPhotos ? 'your photos' : 'the listing photos'} of this home and of each comp, then answers each question for you to check. The report uses this same read - the photos aren&apos;t read twice.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How fast">
                    {([['save_usage', Leaf, 'Save usage', 'A few minutes, about half the AI - we ping you'], ['now', Zap, 'Now', 'About a minute']] as const).map(([id, Icon, title, line]) => (
                      <button key={id} type="button" role="radio" aria-checked={speed === id} onClick={() => setSpeed(id)}
                        className={`flex min-h-[56px] items-start gap-2 rounded-2xl border px-3 py-2 text-left transition ${speed === id ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-gray-800'}`}>
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
                        <span><span className="block text-[13px] font-black text-[#111827] dark:text-white">{title}</span><span className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400">{line}</span></span>
                      </button>
                    ))}
                  </div>
                  {startErr && <p role="alert" className="mt-2 text-[13px] font-black text-rose-700 dark:text-rose-300">{startErr}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" data-cma-prefill-start disabled={starting} onClick={() => void startRead()}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 text-[14px] font-black text-white shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98] disabled:opacity-60">
                      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : prefill?.status === 'failed' || prefill?.stale ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      {prefill?.status === 'failed' || prefill?.stale ? 'Read the photos again' : 'Read the photos'}
                    </button>
                    <button type="button" onClick={() => change({ ...answers, inside_photos: 'no' })}
                      className="min-h-[48px] rounded-2xl border border-gray-200 px-4 text-[13px] font-black text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:text-gray-300">
                      I&apos;ll answer myself
                    </button>
                  </div>
                </div>
              ) : (
                <div data-cma-prefill="ask">
                  <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Do you have photos of the inside of this home, as it is today?</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                    {hasPhotos
                      ? `${subjectPhotos.length} photo${subjectPhotos.length === 1 ? '' : 's'} on file${ownPhotos ? ' (yours)' : ' (from its listing)'}. If they show the inside as it is now, the AI fills in the answers below and you just check them.`
                      : 'No photos of this home are on file. Add yours and the AI fills in the answers - or answer them yourself.'}
                  </p>
                  {hasPhotos && (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-hidden>
                      {subjectPhotos.slice(0, 6).map((src, i) => (
                        <img key={i} src={normalizeImageUrl(src)} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hasPhotos ? (
                      <button type="button" data-cma-photos-yes onClick={() => change({ ...answers, inside_photos: 'yes' })}
                        className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#111827] px-5 text-[14px] font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                        <Check className="h-4 w-4" /> Yes - the AI fills in the answers
                      </button>
                    ) : onAddPhotos && (
                      <button type="button" onClick={onAddPhotos}
                        className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#111827] px-5 text-[14px] font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                        <Camera className="h-4 w-4" /> Add my photos
                      </button>
                    )}
                    <button type="button" data-cma-photos-no onClick={() => change({ ...answers, inside_photos: 'no' })}
                      className="min-h-[48px] rounded-2xl border border-gray-200 px-4 text-[13px] font-black text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:text-gray-300">
                      No - I&apos;ll answer myself
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {blocked && unconfirmed.length > 0 && (
        <p role="alert" data-cma-unconfirmed className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-black text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {unconfirmed.length === 1 ? 'One answer differs' : `${unconfirmed.length} answers differ`} from what the photos showed. Keep yours or use the AI&apos;s before you go on.
        </p>
      )}

      {unsaved && (
        <p role="alert" className="sticky top-2 z-20 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-[13px] font-black text-rose-800 shadow-sm dark:border-rose-500/40 dark:bg-rose-950/80 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Your answers aren&apos;t saved yet - we can&apos;t reach the server. Keep this page open; we&apos;re trying again every few seconds.
        </p>
      )}
      {!listedNow && comps.length > 0 && comp && (
        <section data-cma-compare className="cma-card rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_40px_-32px_rgba(17,24,39,0.5)] dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white sm:text-2xl">Your home vs each comp</h2>
              <p className="mt-0.5 text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
                {fresh
                  ? 'The AI compared your home with each comp from the photos. Flip through and change any you would answer differently - condition and finishes only, size and age are already adjusted for.'
                  : <>You have been inside. Flip through both homes and say which is nicer - condition and finishes only, size and age are already adjusted for. The sales can&apos;t see this, so it makes the value far more accurate.</>}
              </p>
            </div>
            <span className="rounded-full bg-[#C9A24D]/12 px-3 py-1 text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">Comp {pos + 1} of {comps.length}</span>
          </div>
          {locked && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#C9A24D]/35 bg-[#C9A24D]/5 px-3 py-2 text-xs font-bold text-[#111827] dark:text-white">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> Locked with the comps - the AI worked out the value from these answers.
            </p>
          )}

          {/* which comp - tap to jump, the answer shows on each */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {comps.map((c, i) => {
              const m = marks[compMarkKey(c)]
              const src = c.photo_url || c.photos?.[0]
              return (
                <button key={c.id} type="button" onClick={() => setPos(i)} aria-label={`Comp ${i + 1}${m ? `, ${BADGE_TEXT[m]}` : ''}`} aria-current={i === pos ? 'true' : undefined}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-2 transition dark:bg-white/5 ${i === pos ? 'ring-[#C9A24D]' : 'ring-transparent opacity-80 hover:opacity-100'}`}>
                  {src && <img src={normalizeImageUrl(src)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[9px] font-black text-white">#{i + 1}</span>
                  {m && <span className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-black ${BADGE[m]}`}>{BADGE_TEXT[m]}{fresh && sugMarks[compMarkKey(c)] === m ? ' · AI' : ''}</span>}
                  {differsComp(c) && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[10px] font-black text-white" aria-hidden>!</span>}
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
              <PhotoFlip photos={compPhotos} resetKey={comp.id} fit="contain" counter quietArrows alt={`Comp ${pos + 1}`}
                className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/90">
                <span className="absolute left-2 top-2 rounded-lg bg-[#C9A24D] px-2 py-1 text-[11px] font-black uppercase tracking-wide text-[#111827]">Comp #{pos + 1}</span>
                {compPhotos.length === 0 && (
                  <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-bold text-white/80">
                    No photos in this listing - tap Not sure unless you know the home
                  </span>
                )}
              </PhotoFlip>
              <Facts label={comp.street_address || `Comp #${pos + 1}`} price={comp.sale_price} priceLabel={soldWhen(comp.close_date) ? `sold ${soldWhen(comp.close_date)}` : 'sold'}
                sqft={comp.above_grade_finished_area || comp.sqft} beds={comp.beds} baths={comp.baths} year={comp.year_built}
                extra={comp.distance_miles != null ? `${comp.distance_miles.toFixed(1)} mi away` : null} />
            </div>
          </div>

          {/* the question */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#111827] dark:text-white">On condition and finishes, your home is…</p>
            {fresh && sugMarks[compMarkKey(comp)] && current === sugMarks[compMarkKey(comp)] && (
              <span data-cma-comp-ai className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
                <Sparkles className="h-3 w-3" /> Filled in by the AI from the photos
              </span>
            )}
            {fresh && !current && fresh.unread.includes(compMarkKey(comp)) && (
              <span data-cma-comp-ask className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <Camera className="h-3 w-3" /> The AI couldn&apos;t tell from the photos - please answer
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Your home compared with comp ${pos + 1}`}>
            {MARKS.map(o => {
              const on = current === o.id
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} disabled={locked && !on} onClick={() => mark(o.id)}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-center text-[13px] font-black transition-[border-color,background-color,transform] duration-150 ${locked ? 'cursor-default' : 'active:scale-[0.97]'} ${on ? o.on : 'border-gray-200 bg-white/70 text-gray-700 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:bg-black/20 dark:text-gray-200'}`}>
                  <o.Icon className="h-4 w-4" />
                  <span className="leading-tight"><span className="sm:hidden">{o.short}</span><span className="hidden sm:inline">{o.label}</span></span>
                </button>
              )
            })}
          </div>
          {differsComp(comp) && current && (
            <div data-cma-comp-differs role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              From the photos, your home looked <span className="font-black">{SAY[sugMarks[compMarkKey(comp)]]}</span> this comp, but you picked <span className="font-black">{BADGE_TEXT[current]}</span>. Keep your answer?
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" data-cma-keep onClick={() => {
                  keep(compMarkKey(comp))
                  const nextOpen = comps.findIndex((c, i) => i > pos && !marks[compMarkKey(c)])
                  if (nextOpen >= 0) window.setTimeout(() => setPos(nextOpen), 300)
                }} className="min-h-[40px] rounded-lg bg-[#111827] px-3 text-[12px] font-black text-white dark:bg-white dark:text-[#111827]">Yes, keep mine</button>
                <button type="button" data-cma-use-ai onClick={() => applyAi(comp)} className="min-h-[40px] rounded-lg border border-amber-400 px-3 text-[12px] font-black text-amber-900 dark:text-amber-200">Use the AI&apos;s answer</button>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={locked && current !== 'not_sure'} onClick={() => mark('not_sure')} aria-pressed={current === 'not_sure'}
              className={`min-h-[44px] rounded-xl border px-3 text-[13px] font-black transition ${current === 'not_sure' ? 'border-gray-500 bg-gray-500/10 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-gray-800 dark:text-gray-400'}`}>
              Not sure - skip this one
            </button>
            {pos < comps.length - 1 ? (
              <button type="button" onClick={() => setPos(pos + 1)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-black text-[#8b7355] hover:text-[#111827] dark:text-[#d7b974] dark:hover:text-white">
                Next comp <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={() => factsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-[13px] font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                {doneCount === comps.length && <Check className="h-4 w-4" />} Next: kitchen &amp; baths <ArrowDown className="h-4 w-4" />
              </button>
            )}
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

      <div ref={factsRef} className="scroll-mt-24">
        <SellerQuestions answers={answers} comps={comps} askPlacement={false} locked={locked} onChange={change}
          suggested={fresh ? { kitchen: fresh.kitchen, baths: fresh.baths } : undefined}
          askRooms={fresh ? fresh.rooms_missing : undefined} kept={kept} onKeep={k => keep(k)}
          intro={listedNow
            ? "You have been inside. Your answers go into the write-up as facts you confirmed - the asking price already tells the analysis how this home compares with its sales."
            : 'A few facts from your visit. They go into the write-up as things you confirmed.'} />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={goNext}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-6 text-[15px] font-black text-white shadow-lg shadow-[#C9A24D]/30 transition active:scale-[0.98] sm:w-auto">
            {fresh && !unconfirmed.length ? 'Looks right - continue' : 'Continue to Analysis'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
