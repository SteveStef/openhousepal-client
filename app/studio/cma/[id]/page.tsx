'use client'

import OhpLoader, { OhpSpinner } from '@/components/brand/OhpLoader'

import { hasEmailSignatureAccess } from '@/lib/navAccess'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { smartBackClick } from '@/lib/navHistory'
import {
  AlertTriangle, ArrowLeft, ArrowUpDown, Bath, Bed, Building2, Calculator, Calendar, Car, Check, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, Copy, DollarSign, Download, Droplets, GraduationCap, GripVertical, Home, LandPlot, Layers,
  Image as ImageIcon, Loader2, MapPin, Moon, Plus, RefreshCw, Ruler, Scale, Search, Share2, ShieldAlert, Sparkles, Sun, Trash2, Waves, X,
} from 'lucide-react'
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  CmaAiEstimate, CmaComparable, CmaCompCandidate, CmaCompStatus, CmaCompStrength, CmaMode,
  CmaLocatedAddress, CmaPricing, CmaQualityAssessment, CmaReport, CmaRoadContext, CmaSubjectArea, CmaSubjectProperty, CmaValuationTrace, MyListingItem, Site, SiteDomain,
} from '@/types'
import {
  AGENT_QUALITY_TIER_STYLES, CMA_STATUS_STYLES, COMP_STATUS_BADGE_STYLE, COMP_STATUS_LABEL, QUALITY_LABELS, STRENGTH_LABEL,
  average, cmaSupportCode, compDisplayPrice, resolveCmaMarketMetrics, effectiveCompPrice, formatCompactNumber, formatDate, formatMlsStatusLabel, formatMoney, formatMoneyRange, formatNumber,
  median, normalizeStrength, pricePerSqft, strongComps, sortComparables, splitCmaBuyerGuidance,
} from '@/lib/cma'
import { CmaPresentationDocument } from '@/lib/pdfs'
import { acresToSqft, MatchScoreDetails, sqftToAcres } from '@/lib/matchScore'
import { normalizeImageUrl } from '@/lib/utils'
import { useHoverPhotoCycle } from '@/lib/useHoverPhotoCycle'
import CompsMapView from '@/components/CompsMapView'
import Pager from '@/components/Pager'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import WarningConfirmModal from '@/components/WarningConfirmModal'
import CmaShareLinksModal from '@/components/CmaShareLinksModal'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import { ManualAddressPicker, SubjectFactsEditor, applyAreaSuggestions, subjectFromAddress } from '@/components/cma/SubjectFacts'

type StepId = 'subject' | 'comps' | 'analysis' | 'pricing' | 'summary'

function cmaQaBlocking(report: CmaReport): string[] {
  const estimate = report.pricing?.ai_estimate
  const qa = estimate?.qa_result
  const blocking = [
    ...(estimate?.qa_blocking || []),
    ...(qa?.blocking_errors || []),
  ].filter(Boolean)
  if (qa?.export_allowed === false && blocking.length === 0) {
    blocking.push('Deterministic final QA has not approved this report for export.')
  }
  return Array.from(new Set(blocking))
}

// Matches only the handful of blocking messages that mean "the saved report no longer matches
// what was last checked" (comps/pricing/scoring edited, or the artifact hash is simply stale) -
// recompute-valuation reruns the same deterministic pass against the CURRENT data and genuinely
// clears these. Anything else (e.g. "Comp #3 describes a system as original without supporting
// property data") is a real factual/reasoning problem the generation pass itself flagged in the
// comp notes or methodology text - recompute does not rewrite that prose (see handleRecompute's
// own comment: "no comp notes rewritten"), so it would just spend an AI call re-checking the exact
// same unchanged text and fail again. Auto-fixing must be limited to the former; the latter needs
// a real regenerate or a manual edit, so it's surfaced to the agent immediately instead of stalling
// on a recompute that can never resolve it.
const STALE_ARTIFACT_PATTERNS = [
  /changed after (deterministic )?final[- ]artifact qa/i,
  /changed after final qa/i,
  /has not passed deterministic final-artifact qa/i,
  /did not approve this report for export/i,
  /deterministic final qa has not approved this report for export/i,
  // The live hash-mismatch message from the backend's own _report_qa_blocking ("The saved
  // client artifact changed after deterministic final QA.") - "deterministic" sits between
  // "after" and "final" here, which none of the patterns above match, and this is the single
  // most common staleness signal (fires on any post-generation save that hasn't re-stamped).
  /client artifact changed after/i,
]
function isStaleArtifactOnly(blockers: string[]): boolean {
  return blockers.length > 0 && blockers.every(b => STALE_ARTIFACT_PATTERNS.some(re => re.test(b)))
}

function plainCmaQaIssue(raw: string): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  if (/offer/.test(lower) && /(stale|older|mismatch|does not match|inconsistent)/.test(lower)) {
    return 'The offer section is using a value that does not match the final report.'
  }
  if (/(system|mechanical|renovation)/.test(lower) && /(missing|unknown|unverified|unsupported|age)/.test(lower)) {
    return 'A condition statement relies on missing information instead of a confirmed fact.'
  }
  if (/(range)/.test(lower) && /(stale|mismatch|does not match|authoritative|final)/.test(lower)) {
    return 'A displayed valuation range does not match the final approved range.'
  }
  if (/(list price|asking price)/.test(lower) && /(stale|mismatch|does not match|incorrect)/.test(lower)) {
    return 'A report section is using the wrong current list price.'
  }
  if (/(fmv|fair market value|final value)/.test(lower) && /(stale|mismatch|does not match|authoritative|incorrect)/.test(lower)) {
    return 'A report section is using a value that does not match the final valuation.'
  }
  if (/(artifact|report)/.test(lower) && /(changed after|fingerprint|final qa|revalidat)/.test(lower)) {
    return 'The report changed after its final check and needs to be checked again.'
  }
  if (/(qa|consistency check)/.test(lower) && /(not approved|has not approved|not run|incomplete)/.test(lower)) {
    return 'The final consistency check has not approved this report yet.'
  }
  if (/(comp|subject|property)/.test(lower) && /(unsupported|unmatching|not found|wrong entity|does not match)/.test(lower)) {
    return 'A property or comp contains a number that is not supported by its saved record.'
  }
  if (/(raw.*id|unresolved|property id|mls id)/.test(lower)) {
    return 'A comp reference needs to be replaced with its property name.'
  }
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text
  const cleaned = firstSentence
    .replace(/^[A-Z0-9_ -]{3,40}:\s*/i, '')
    .replace(/\b(comp_inferred|model_judgment|signals?|beta|fallback heuristic|audit fmv)\b/gi, 'internal check')
  return cleaned.length > 170 ? `${cleaned.slice(0, 167).trimEnd()}...` : cleaned
}

function cmaQaReview(report: CmaReport) {
  const estimate = report.pricing?.ai_estimate
  const qa = estimate?.qa_result
  const blockers = cmaQaBlocking(report)
  const warnings = [
    ...(qa?.warnings || []).filter(Boolean),
    ...(!qa ? ['The final consistency check has not run yet.'] : []),
  ]
  const activeRaw = [...blockers, ...warnings]
  const issues = Array.from(new Set(activeRaw.map(plainCmaQaIssue).filter(Boolean)))
  return {
    status: blockers.length > 0 ? 'Blocked' as const : warnings.length > 0 ? 'Warning' as const : 'Passed' as const,
    issues,
    blockers,
    warnings,
    corrections: (qa?.corrections || []).filter(Boolean),
    flags: (estimate?.qa_flags || []).filter(Boolean),
    checks: qa?.checks_run || [],
    checkedAt: qa?.checked_at,
  }
}

function shortReadableSentence(value: string): string {
  const cleaned = value.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim()
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned
  // The whole first sentence - it used to be cut at 155 characters mid-word ("no photo obser...").
  // Only a runaway sentence is trimmed, and then at a word boundary.
  const shortened = sentence.length > 320 ? `${sentence.slice(0, 320).replace(/\s+\S*$/, '')}...` : sentence
  return /[.!?]$/.test(shortened) || shortened.endsWith('...') ? shortened : `${shortened}.`
}

// The AI's narrative sections are written as "**Header:** text" blocks - shown as a real bold
// heading per block (the raw ** used to show on the Review step).
function NarrativeText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return (
    <div className="mt-1 space-y-2">
      {blocks.map((block, i) => {
        const m = block.match(/^\*\*([^*]+?):?\*\*:?\s*([\s\S]*)$/)
        return (
          <p key={i} className="whitespace-pre-line text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
            {m ? <><span className="font-black text-[#111827] dark:text-white">{m[1].replace(/:$/, '')}:</span> {m[2].replace(/\*\*/g, '')}</> : block.replace(/\*\*/g, '')}
          </p>
        )
      })}
    </div>
  )
}

// The agent-facing explanation of the analysis's own fair-value conclusion. With the QA/Review
// panel and "how this value was calculated" trace both hidden from Studio (see the Summary step
// below), this is now the ONE place an agent sees why the number came back the way it did - so it
// leads with the value/confidence/range itself, then lists every value driver (not just the top
// 3), instead of the shorter client-facing teaser this used to be.
function cmaWhyBullets(report: CmaReport): string[] {
  const estimate = report.pricing?.ai_estimate
  const finalValuation = estimate?.final_valuation
  const finalValue = finalValuation?.value ?? estimate?.value
  const rangeMin = finalValuation?.range_min ?? estimate?.range_min
  const rangeMax = finalValuation?.range_max ?? estimate?.range_max
  const confidenceRaw = (finalValuation?.confidence ?? estimate?.confidence ?? '').toLowerCase()
  const confidence = confidenceRaw === 'medium' ? 'moderate' : confidenceRaw
  const technical = /\b(v10|astra|model|deterministic|anchor|weight(?:ed)?|signal|beta|fallback|comp_inferred|model_judgment|audit|algorithm)\b/i
  const bullets: string[] = []
  if (finalValue != null) {
    const confPhrase = confidence ? ` with ${confidence} confidence` : ''
    const rangePhrase = (rangeMin != null && rangeMax != null) ? `, supported by a range of ${formatMoney(rangeMin)}-${formatMoney(rangeMax)}` : ''
    bullets.push(`The analysis lands on ${formatMoney(finalValue)}${confPhrase}${rangePhrase}.`)
  }
  const drivers = (estimate?.value_drivers || []).slice(0, 5).map(driver => {
    const label = /^\d{7,}$/.test((driver.comp_label || '').trim()) ? 'A key comparable' : (driver.comp_label || 'A key comparable')
    const note = String(driver.note || '').trim()
    if (note && !technical.test(note)) return shortReadableSentence(note)
    if (driver.direction === 'up') return `${label} supports the higher side of the value range.`
    if (driver.direction === 'down') return `${label} supports a more conservative value.`
    return `${label} helped define the supported value range.`
  })
  bullets.push(...drivers)
  return Array.from(new Set(bullets)).slice(0, 7)
}

function abbreviateHeaderName(name?: string | null) {
  const trimmed = (name || '').trim()
  if (trimmed.length <= 22) return trimmed
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words.slice(0, 2).join(' ')}...`
  return `${trimmed.slice(0, 19)}...`
}

const STEPS: { id: StepId, label: string, shortLabel?: string }[] = [
  { id: 'subject', label: 'Subject' },
  { id: 'comps', label: 'COMPS' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'summary', label: 'Review' },
]

// Freely navigable step progress - this is a workspace, not a locked wizard. `stretch` lets the
// connecting segments grow to fill the row (desktop, or the mobile row which gets its own full
// line); `showLabels` forces the word labels on even at narrow widths, for that mobile line.
function CmaStepper({ step, setStep, completed = false, className = '', stretch = false, showLabels = false }: {
  step: StepId, setStep: (s: StepId) => void, completed?: boolean, className?: string, stretch?: boolean, showLabels?: boolean
}) {
  const currentIndex = STEPS.findIndex(x => x.id === step)

  // The fill bar's width used to be a flat `calc(percent - 0.75rem)` guess at where the current
  // step's button ends - that correction is only exact for one particular step/container width,
  // so at every other step or screen size (mobile's full-width row vs desktop's inline one) the
  // bar's edge landed slightly short of or past the actual button boundary. Measuring the real
  // button edge in pixels keeps it snapped to the button exactly, on every step and every format.
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState(0)
  // Tracked in a ref (not just the [currentIndex] dep below) so the ResizeObserver effect can
  // read the live step without re-subscribing every time it changes - re-registering the
  // observer on every single step transition added an extra resize-callback cycle right at the
  // moment the bar was already mid-animation, which is exactly when the "glitch" was visible.
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  useLayoutEffect(() => {
    const btn = stepButtonRefs.current[currentIndex]
    if (btn) setBarWidth(btn.offsetLeft + btn.offsetWidth)
  }, [currentIndex])
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const btn = stepButtonRefs.current[currentIndexRef.current]
      if (btn) setBarWidth(btn.offsetLeft + btn.offsetWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`min-w-0 items-center ${stretch ? 'flex-1' : ''} ${className}`}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white/85 p-1.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]/85">
        <div
          className="absolute bottom-1.5 left-1.5 top-1.5 rounded-xl bg-gradient-to-r from-[#111827] via-[#8b7355] to-[#C9A24D] shadow-[0_10px_30px_-18px_rgba(201,162,77,0.9)] transition-[width] duration-500 dark:from-white dark:via-[#d7b974] dark:to-[#C9A24D]"
          style={{ width: barWidth ? `${barWidth}px` : 0 }}
        />
        <div ref={gridRef} className="relative grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => {
            const isDone = completed || i < currentIndex
            const isCurrent = s.id === step
            const isActiveZone = i <= currentIndex
            return (
              <button
                key={s.id}
                ref={el => { stepButtonRefs.current[i] = el }}
                type="button"
                onClick={() => setStep(s.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group flex min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all duration-500 sm:gap-2 sm:px-2.5 sm:text-[10px] lg:text-[11px] ${showLabels ? 'flex-col !gap-0.5' : ''} ${
                  isCurrent
                    ? 'scale-[1.02] bg-white text-[#111827] shadow-md ring-1 ring-[#C9A24D]/40 dark:bg-[#0B0B0B] dark:text-white'
                    : isActiveZone
                      ? 'text-white hover:bg-white/10 dark:text-[#111827] dark:hover:bg-black/5'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-[#8b7355] dark:hover:bg-gray-800 dark:hover:text-[#d7b974]'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition sm:h-6 sm:w-6 ${
                  isCurrent
                    ? 'bg-[#C9A24D] text-white shadow-[0_0_0_4px_rgba(201,162,77,0.16)]'
                    : isDone
                      ? 'bg-white/20 text-white ring-1 ring-white/30 dark:bg-black/10 dark:text-[#111827] dark:ring-black/10'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={`min-w-0 truncate ${showLabels ? 'block' : 'hidden xl:block'}`}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Bright's raw status codes ("ACTIVE-BRIGHT", "COMING SOON-BRIGHT") -> what an agent reads ("Active").
function readableMlsStatus(raw?: string | null): string | null {
  const s = String(raw || '').replace(/-BRIGHT$/i, '').replace(/_/g, ' ').trim()
  return s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null
}

export default function CmaWorkspacePage() {
  return (
    <AuthGuard>
      <SubscriptionGuard requireMlsAccess>
        <CmaWorkspacePageInner />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function CmaWorkspacePageInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const [report, setReport] = useState<CmaReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [step, setStep] = useState<StepId>('subject')
  const initialStepSet = useRef(false)
  // Once the agent has visited the Analysis step, keep it mounted for the rest of the session so
  // an in-flight "Create AI Analysis" run - its progress bar, staged scan, generating state -
  // survives switching to another step and coming back (it's just hidden, never unmounted).
  const [analysisMounted, setAnalysisMounted] = useState(false)
  useEffect(() => { if (step === 'analysis') setAnalysisMounted(true) }, [step])

  const load = useCallback(() => {
    setLoading(true)
    api.cma.get(id).then(response => {
      if (response.success && response.data) {
        setReport(response.data)
        if (!initialStepSet.current) {
          initialStepSet.current = true
          if (!response.data.subject?.street_address) setStep('subject')
          else if (response.data.comparables.length === 0) setStep('comps')
          else if (response.data.status === 'READY' || response.data.status === 'SHARED') setStep('summary')
          else setStep('analysis')
        }
      } else {
        showToast(response.error || 'Could not load this CMA.', 'error')
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { load() }, [load])

  // Per-field saves through the CMA never toast - a bottom-right "Saved" popup on every click
  // covered the Continue button and read as noise. Success shows only as the quiet "Saving…" ->
  // "Saved ✓" indicator up in the header next to the status badge; only a real failure toasts.
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current) }, [])
  // Keep `save` a STABLE reference (read the current report from a ref, don't close over it) so a
  // save's setReport doesn't hand every step a new onSave prop and re-render the whole workspace
  // each round-trip - that churn is part of what made per-field autosave feel glitchy.
  const reportRef = useRef(report)
  reportRef.current = report
  const saveRequestSequence = useRef(0)
  const latestAppliedSaveSequence = useRef(0)
  const savesInFlight = useRef(0)
  const save = useCallback(async (patch: Partial<CmaReport>, _opts: { silent?: boolean } = {}): Promise<CmaReport | null> => {
    const r = reportRef.current
    if (!r) return null
    const requestSequence = ++saveRequestSequence.current
    savesInFlight.current += 1
    setSaving(true)
    const response = await api.cma.update(r.id, patch as any)
    savesInFlight.current = Math.max(0, savesInFlight.current - 1)
    if (savesInFlight.current === 0) setSaving(false)
    if (response.success && response.data) {
      // Autosaves can overlap. Never let a slower, older response replace a report snapshot that
      // already includes a newer edit or a newer final-QA result.
      if (requestSequence > latestAppliedSaveSequence.current) {
        latestAppliedSaveSequence.current = requestSequence
        setReport(response.data)
      }
      setSavedFlash(true)
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2200)
      return response.data
    }
    showToast(response.error || 'Could not save changes.', 'error')
    return null
  }, [showToast])

  // For results the server already fully computed and persisted itself (AI generation) - just
  // syncs local state, no redundant PATCH back to the same data.
  const applyReport = useCallback((updated: CmaReport) => setReport(updated), [])

  if (loading || !report) {
    return (
      <OhpLoader />
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      {/* Nice arrival instead of the whole workspace just popping in - same entrance keyframe the
          step content below already reuses on every step change (see key={step} further down). */}
      <div className="mx-auto max-w-6xl animate-step-in px-4 py-4 sm:px-5 sm:py-8">
        {/* Row 1: back arrow + subject/client, and on mobile the status pill sits top-right here.
            On desktop the step progress stretches inline in this same row, ahead of the status pill. */}
        {/* Phones (user, 10/17): one line - back, address, and the status tag at the far right. */}
        <div className="flex flex-nowrap items-center gap-2.5 sm:gap-4 lg:flex-wrap">
          <Link href="/studio/cma" onClick={smartBackClick(router)} title="Back" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-gray-700 dark:text-gray-500 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:max-w-[260px] lg:flex-none xl:max-w-[320px]">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/10 text-[#C9A24D] sm:flex"><Calculator className="h-4.5 w-4.5" /></div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-black leading-tight text-[#111827] dark:text-white sm:text-xl">
                {report.subject?.street_address || 'New CMA'}
              </h1>
              <p className="flex min-w-0 items-center gap-1 text-xs font-semibold text-gray-400">
                {report.client_name && (
                  <>
                    <span className="min-w-0 truncate" title={report.client_name}>For {abbreviateHeaderName(report.client_name)}</span>
                    <span className="shrink-0">·</span>
                  </>
                )}
                <span className="shrink-0">{report.mode === 'buyer' ? 'Buyer Valuation' : 'Listing / Seller'}</span>
              </p>
            </div>
          </div>

          {/* Step progress - desktop only here, stretches to fill the rest of the row */}
          <CmaStepper step={step} setStep={setStep} completed={report.status === 'READY' || report.status === 'SHARED'} className="hidden lg:flex" stretch />

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {/* Always rendered (visibility toggled, not mount/unmount) - this sits in the same row
                as the desktop step bar next door, and Continue triggers a save+step-change at the
                same moment. A mounting/unmounting indicator here resized that row out from under
                the bar's own resize-driven width measurement, causing a visible wobble right as it
                was supposed to smoothly advance. Reserving the space at all times keeps the row's
                width - and the bar's measurement - stable through a save. */}
            <span className={`items-center gap-1.5 text-xs font-bold ${saving || savedFlash ? 'flex' : 'hidden lg:flex'} ${saving ? 'text-gray-400' : savedFlash ? 'text-emerald-600 dark:text-emerald-400' : 'invisible'}`}>
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Check className="h-3 w-3" /> Saved</>}
            </span>
            <span className={`inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[10px] font-black uppercase leading-none tracking-wide sm:h-9 sm:rounded-xl sm:px-3.5 ${CMA_STATUS_STYLES[report.status]}`}>{report.status.toLowerCase()}</span>
          </div>
        </div>

        {/* Row 2: step progress on mobile - full width, with labels, own line */}
        <CmaStepper step={step} setStep={setStep} completed={report.status === 'READY' || report.status === 'SHARED'} className="mt-3 flex sm:mt-5 lg:hidden" stretch showLabels />

        {/* key={step} forces a fresh mount on every step switch so animate-step-in always
            replays, instead of relying on the conditional children below to happen to unmount/
            remount on their own. Analysis is the exception - it renders in its own always-mounted
            container below so a running AI generation isn't torn down when the agent tabs away. */}
        <div key={step} className={`mt-4 animate-step-in sm:mt-6 ${step === 'analysis' ? 'hidden' : ''}`}>
          {step === 'subject' && <SubjectStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('comps')} />}
          {step === 'comps' && <CompsStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('analysis')} />}
          {step === 'pricing' && <PricingStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('summary')} />}
          {step === 'summary' && <SummaryStep report={report} onSave={save} onReportUpdated={applyReport} onJump={setStep} onDeleted={() => router.push('/studio/cma')} />}
        </div>
        {(analysisMounted || step === 'analysis') && (
          <div className={step === 'analysis' ? 'mt-4 animate-step-in sm:mt-6' : 'hidden'}>
            <AnalysisStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('pricing')} />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Shared small UI pieces
// ============================================================================

// Same color grouping as the OHP kit's address-search dropdown badge (getStatusBadgeClass in
// CreateOpenHouseWizard.tsx), reused here for the subject-property address search.
function mlsStatusBadgeClass(status?: string | null): string {
  const label = formatMlsStatusLabel(status)
  if (label === 'Sold') return 'bg-red-600'
  if (label === 'Active' || label === 'Coming Soon') return 'bg-emerald-600'
  if (label === 'Pending' || label === 'Active Under Contract') return 'bg-amber-500'
  return 'bg-gray-500'
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-400">{children}</label>
}

function hasCompletedAiAnalysis(report: CmaReport) {
  const pricing = report.pricing || {}
  const aiValue = pricing.ai_estimate?.value
  const hasAiEstimate = typeof aiValue === 'number' ? aiValue > 0 : Boolean(aiValue)
  const pricingKeys: (keyof CmaPricing)[] = report.mode === 'buyer'
    ? ['estimated_fair_value', 'suggested_offer_min', 'suggested_offer_max', 'strong_offer']
    : ['recommended_min', 'recommended_max', 'most_likely_value']
  const hasFilledPricing = pricingKeys.some(key => {
    const value = pricing[key]
    return value !== null && value !== undefined && String(value).trim() !== ''
  })
  return Boolean(report.ai_analysis && (hasAiEstimate || hasFilledPricing))
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string, value: string | number | null | undefined, onChange: (v: string) => void, type?: string, placeholder?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string, value: string | number | null | undefined, onChange: (v: string) => void, placeholder?: string, rows?: number
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
      />
    </div>
  )
}

// A plain type="number" input can't show thousands separators (browsers strip them) - this is a
// type="text" input that displays the formatted value but still stores/emits a plain number.
function NumberTextField({ label, value, onChange, prefix, icon: Icon }: {
  label: string, value: number | null | undefined, onChange: (v: number | null) => void, prefix?: string, icon?: React.ComponentType<{ className?: string }>,
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />}
        {prefix && !Icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{prefix}</span>}
        <input
          type="text"
          inputMode="numeric"
          value={value != null ? Number(value).toLocaleString() : ''}
          onChange={e => { const digits = e.target.value.replace(/\D/g, ''); onChange(digits ? Number(digits) : null) }}
          className={`w-full rounded-xl border border-gray-200 bg-white py-2 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white ${Icon || prefix ? 'pl-8' : 'pl-3'}`}
        />
      </div>
    </div>
  )
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T, label: string }[], value: T | null | undefined, onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
            value === opt.value ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SectionCard({ title, subtitle, children, right }: { title: string, subtitle?: string, children: React.ReactNode, right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-gray-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function CmaQaReviewPanel({ report }: { report: CmaReport }) {
  const review = cmaQaReview(report)
  const statusClass = review.status === 'Blocked'
    ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
    : review.status === 'Warning'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  const StatusIcon = review.status === 'Blocked' ? ShieldAlert : review.status === 'Warning' ? AlertTriangle : Check
  const hasAdvanced = review.blockers.length > 0 || review.warnings.length > 0 || review.corrections.length > 0 || review.flags.length > 0 || review.checks.length > 0

  return (
    <SectionCard
      title="QA / Review Items"
      subtitle="Agent-only review. Audit data and export safeguards remain active."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${statusClass}`}>
          <StatusIcon className="h-3.5 w-3.5" /> {review.status}
        </span>
        <span className="text-sm font-black text-[#111827] dark:text-white">
          {review.issues.length === 0 ? 'No issues need attention' : `${review.issues.length} ${review.issues.length === 1 ? 'issue to fix' : 'issues to fix'}`}
        </span>
      </div>

      {review.issues.length > 0 && (
        <ol className="mt-3 space-y-2 text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">
          {review.issues.map((issue, index) => <li key={issue}>{index + 1}. {issue}</li>)}
        </ol>
      )}

      {hasAdvanced && (
        <details className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <summary className="cursor-pointer select-none text-xs font-black text-gray-500 marker:text-gray-400 dark:text-gray-400">
            Advanced Audit
          </summary>
          <div className="mt-3 space-y-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {review.blockers.length > 0 && <AuditList title="Raw blocking diagnostics" items={review.blockers} tone="red" />}
            {review.warnings.length > 0 && <AuditList title="Raw warnings" items={review.warnings} tone="amber" />}
            {review.corrections.length > 0 && <AuditList title="Automatic corrections" items={review.corrections} />}
            {review.flags.length > 0 && <AuditList title="Generation diagnostics" items={review.flags} />}
            {review.checks.length > 0 && (
              <div>
                <p className="font-black text-[#111827] dark:text-white">Checks run</p>
                <p className="mt-1 break-words">{review.checks.join(', ')}</p>
              </div>
            )}
            {review.checkedAt && <p>Last checked: {review.checkedAt}</p>}
          </div>
        </details>
      )}
    </SectionCard>
  )
}

function AuditList({ title, items, tone = 'gray' }: { title: string; items: string[]; tone?: 'gray' | 'amber' | 'red' }) {
  const toneClass = tone === 'red' ? 'text-red-700 dark:text-red-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
  return (
    <div>
      <p className="font-black text-[#111827] dark:text-white">{title}</p>
      <ul className={`mt-1 list-disc space-y-1 pl-5 ${toneClass}`}>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  )
}

function NextButton({ onClick, label = 'Continue' }: { onClick: () => void, label?: string }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]"
      >
        {label} <ArrowLeft className="h-4 w-4 rotate-180" />
      </button>
    </div>
  )
}

// ============================================================================
// Step 1: Subject Property
// ============================================================================

function SubjectStep({ report, onSave, onReportUpdated, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onNext: () => void }) {
  const [subject, setSubject] = useState<CmaSubjectProperty>(report.subject)
  const [mode, setMode] = useState<'search' | 'mine' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [myListings, setMyListings] = useState<MyListingItem[]>([])
  const hasSubject = Boolean(subject.street_address)
  const subjectLoaded = useRef(false)

  useEffect(() => { setSubject(report.subject); subjectLoaded.current = false }, [report.id])

  // Autosave, debounced the same way this file already debounces the address search below (a
  // plain setTimeout/clearTimeout in a useEffect) - skips the first run after a report loads/
  // switches so it doesn't immediately re-save data that was just fetched.
  useEffect(() => {
    if (!subjectLoaded.current) { subjectLoaded.current = true; return }
    const t = setTimeout(() => { onSave({ subject }, { silent: true }) }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  useEffect(() => {
    if (mode !== 'mine' || myListings.length > 0) return
    api.openHouseManager.getMyListings().then(r => {
      if (r.success && r.data) setMyListings(r.data.listings)
    })
  }, [mode, myListings.length])

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 4) { setSuggestions([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      // Same internal address search the OHP kit uses, minus activeOnly - a CMA subject is
      // routinely a sold/pending/off-market property too, just never a rental.
      api.properties.address(query.trim(), { excludeRentals: true }).then(r => {
        if (cancelled) return
        if (r.success && r.data) setSuggestions(r.data.results || [])
        setSearching(false)
      })
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, mode])

  const selectAddress = async (address: string) => {
    setSearching(true)
    const response = await api.properties.lookup(address)
    setSearching(false)
    if (response.success && response.data) {
      const p = response.data
      setSubject(mapPropertyToSubject(p))
      setSuggestions([])
      setQuery('')
    }
  }

  const selectMyListing = (listing: MyListingItem) => {
    setSubject({
      listing_key: listing.listing_key,
      source: 'mls',
      photo_url: listing.image || null,
      photos: listing.image ? [listing.image] : [],
      street_address: listing.address,
      city: listing.city,
      state: listing.state,
      zipcode: listing.zipcode,
      list_price: listing.price ?? null,
      beds: listing.bedrooms ?? null,
      baths: listing.bathrooms ?? null,
      sqft: listing.living_area ?? null,
      lot_size: null,
      year_built: null,
      property_type: null,
      garage: null,
      basement: null,
      days_on_market: listing.days_on_market ?? null,
      mls_status: readableMlsStatus(listing.status),
      last_sale_date: null,
      last_sale_price: null,
    })
  }

  const startManual = () => {
    setMode('manual')
    setSubject(s => s.street_address ? s : { source: 'manual', beds: null, baths: null, sqft: null, lot_size: null, year_built: null } as CmaSubjectProperty)
  }

  // Nearby MLS homes' school district / township / water / sewer - dropdown suggestions for every
  // subject, and the pre-fill for a manual one (see pickManualAddress).
  const [area, setArea] = useState<CmaSubjectArea | null>(null)
  const areaKey = subject.latitude != null && subject.longitude != null ? `${subject.latitude.toFixed(5)},${subject.longitude.toFixed(5)}` : ''
  useEffect(() => {
    if (!areaKey) { setArea(null); return }
    let cancelled = false
    const [lat, lng] = areaKey.split(',').map(Number)
    api.cma.subjectArea(lat, lng).then(r => { if (!cancelled && r.success && r.data) setArea(r.data) })
    return () => { cancelled = true }
  }, [areaKey])

  // "Enter Manually": the Google-picked address becomes a manual subject, then the nearby MLS
  // facts fill what's blank and a Street View photo is fetched when there's none yet.
  const pickManualAddress = async (picked: CmaLocatedAddress) => {
    const base = subjectFromAddress(picked)
    setSubject(base)
    const areaRes = await api.cma.subjectArea(picked.latitude, picked.longitude)
    if (areaRes.success && areaRes.data) {
      const found = areaRes.data
      setArea(found)
      setSubject(s => applyAreaSuggestions(s, found))
    }
    const photo = await api.cma.googleSubjectPhoto(report.id, { kind: 'street_view', latitude: picked.latitude, longitude: picked.longitude })
    if (photo.success && photo.data) {
      const url = photo.data.photo_url
      setSubject(s => s.photo_url ? s : { ...s, photo_url: url, photos: [url], photo_source: 'street_view' })
    }
  }

  const handleContinue = async () => {
    // Must actually wait for the save - the next step reads fresh subject data (e.g. list_price
    // for its default price range) the instant it mounts, and onNext() switching steps
    // synchronously used to race ahead of this PATCH landing in the parent's report state.
    const saved = await onSave({ subject })
    // Only matters on a repeat visit after a generation already ran (e.g. correcting the address
    // afterward) - see AnalysisStep's handleContinue for why this re-verifies immediately instead
    // of leaving a stale "changed after final QA" notice for the agent to stumble into later.
    if (saved && isStaleArtifactOnly(cmaQaBlocking(saved))) {
      // Free re-stamp, not a paid recompute - nothing about the content needs re-checking here,
      // just the artifact hash catching up to this save.
      const response = await api.cma.resyncQa(saved.id)
      if (response.success && response.data) onReportUpdated(response.data)
    }
    onNext()
  }

  return (
    <div className="space-y-5">
      {!hasSubject && (
        <SectionCard title="Select the Subject Property" subtitle="Search by address, pick one of your listings, or enter it manually.">
          <div className="flex flex-wrap gap-1.5">
            <SegmentedControl
              options={[{ value: 'search', label: 'Search Address' }, { value: 'mine', label: 'My Listings' }, { value: 'manual', label: 'Enter Manually' }]}
              value={mode}
              onChange={v => v === 'manual' ? startManual() : setMode(v)}
            />
          </div>

          {mode === 'search' && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Start typing an address..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectAddress(s.address)}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-[#C9A24D]/10 dark:border-gray-800"
                    >
                      <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {s.image ? <img src={normalizeImageUrl(s.image || undefined)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-4 w-4 text-gray-300" /></div>}
                        {s.status && (
                          <div className="absolute inset-x-0 bottom-1 flex justify-center px-1">
                            <span className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase leading-none text-white shadow-sm ${mlsStatusBadgeClass(s.status)}`}>
                              {formatMlsStatusLabel(s.status)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{s.address}</p>
                        {s.price && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/15 dark:text-[#d7b974]">
                            {formatMoney(s.price)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && <ManualAddressPicker onPick={pickManualAddress} />}

          {mode === 'mine' && (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {myListings.length === 0 && <p className="py-6 text-center text-sm font-semibold text-gray-400">No active listings found.</p>}
              {myListings.map(listing => (
                <button
                  key={listing.listing_key}
                  onClick={() => selectMyListing(listing)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-2.5 text-left transition hover:border-[#C9A24D]/40 dark:border-gray-800"
                >
                  {listing.image ? <img src={normalizeImageUrl(listing.image || undefined)} alt="" className="h-12 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{listing.address}</p>
                    <p className="text-xs font-semibold text-gray-400">{listing.price ? formatMoney(listing.price) : ''} {listing.bedrooms ? `· ${listing.bedrooms} bd` : ''} {listing.bathrooms ? `· ${listing.bathrooms} ba` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {hasSubject && (
        <SectionCard
          title="Subject Property"
          subtitle={subject.source === 'manual' && !subject.listing_key ? "Fill in the home's facts - the more complete they are, the better the value." : "Edit any fact that isn't quite right."}
          right={
            <button
              onClick={() => setSubject({ source: 'manual' } as CmaSubjectProperty)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400 dark:hover:border-[#C9A24D] dark:hover:text-[#d7b974]"
            >
              <RefreshCw className="h-3 w-3" /> Change Property
            </button>
          }
        >
          <SubjectFactsEditor reportId={report.id} subject={subject} setSubject={setSubject} area={area} />
        </SectionCard>
      )}

      {hasSubject && (
        <div className="flex justify-end gap-2">
          <button onClick={handleContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
            Find Comparables <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}
    </div>
  )
}

function mapPropertyToSubject(p: any): CmaSubjectProperty {
  return {
    listing_key: p.ListingKey || null,
    source: 'mls',
    photo_url: p.ListPictureURL || (Array.isArray(p.photos) ? p.photos[0] : null) || null,
    photos: Array.isArray(p.photos) && p.photos.length > 0 ? p.photos : (p.ListPictureURL ? [p.ListPictureURL] : []),
    street_address: p.FullStreetAddress || null,
    city: p.City || null,
    state: p.StateOrProvince || null,
    zipcode: p.PostalCode || null,
    latitude: p.Latitude ?? null,
    longitude: p.Longitude ?? null,
    list_price: p.ListPrice ?? null,
    beds: p.BedroomsTotal ?? null,
    baths: p.BathroomsTotal ?? null,
    sqft: p.LivingArea ?? null,
    above_grade_finished_area: p.AboveGradeFinishedArea ?? p.above_grade_finished_area ?? null,
    below_grade_finished_area: p.BelowGradeFinishedArea ?? p.below_grade_finished_area ?? null,
    lot_size: p.LotSizeSquareFeet ?? null,
    year_built: p.YearBuilt ?? null,
    property_type: p.PropertyType || null,
    architectural_style: p.ArchitecturalStyle ?? p.architectural_style ?? null,
    levels: p.Levels ?? p.levels ?? null,
    township: p.Township ?? p.township ?? null,
    subdivision_name: p.SubdivisionName ?? p.subdivision_name ?? null,
    garage: p.GarageYN ? (p.GarageSpaces ? `${p.GarageSpaces} Car` : 'Yes') : (p.GarageYN === false ? 'None' : null),
    // Falls through Basement list -> BasementYN -> below-grade finished sqft (Bright sometimes
    // only reports a basement's existence through square footage, not the Basement/BasementYN
    // fields) -> an explicit "None" default, so this is never left blank/omitted the way a plain
    // null would be - matches the same fallback order as cma_service.py's comp search mapping.
    // The lookup API serializes RESO names (Basement / BasementYN) - reading only the snake_case
    // names made every subject without finished below-grade area save as "None" (a full
    // unfinished basement became "no basement" in a seller's CMA, 2026-10-05).
    basement: Array.isArray(p.Basement ?? p.basement) && (p.Basement ?? p.basement).length
      ? (p.Basement ?? p.basement).join(', ')
      : (p.BasementYN ?? p.has_basement) === true ? 'Yes'
      : (p.BasementYN ?? p.has_basement) === false ? 'None'
      : (p.below_grade_finished_area || p.BelowGradeFinishedArea) ? 'Finished'
      : 'None',
    days_on_market: p.DaysOnMarket ?? null,
    mls_status: readableMlsStatus(p.MlsStatus),
    last_sale_date: null,
    last_sale_price: null,
    school_district: p.SchoolDistrictName || null,
    annual_taxes: p.TaxAnnualAmount ?? null,
    water_source: p.WaterSource ?? p.water_source ?? null,
    sewer: p.Sewer ?? p.sewer ?? null,
    public_remarks: p.PublicRemarks || null,
  }
}

// A search result the auto-pick may choose: same housing product as the subject (the backend's
// structural type gate) and able to carry valuation weight (verified closing price + square
// footage). Everything else stays visible in the grid/map for the agent to add by hand.
function isAutoPickable(c: CmaCompCandidate): boolean {
  const d = c.similarity_details
  if (d?.property_type_incompatible) return false
  if (d?.valuation_eligible === false) return false
  return true
}

function candidateToComparable(c: CmaCompCandidate): CmaComparable {
  return {
    id: newId(),
    listing_key: c.listing_key,
    source: 'mls',
    is_included: true,
    order_index: 0,
    status: c.status,
    photo_url: c.photo_url,
    photos: c.photos || [],
    street_address: c.street_address,
    city: c.city,
    state: c.state,
    zipcode: c.zipcode,
    latitude: c.latitude,
    longitude: c.longitude,
    distance_miles: c.distance_miles,
    sale_price: c.sale_price,
    list_price: c.list_price,
    original_list_price: c.original_list_price ?? null,
    close_price: c.close_price ?? null,
    close_date: c.close_date ?? null,
    sale_date: c.sale_date,
    price_verified: c.price_verified ?? true,
    days_on_market: c.days_on_market,
    cdom: c.cdom ?? null,
    sqft: c.sqft,
    above_grade_finished_area: c.above_grade_finished_area,
    below_grade_finished_area: c.below_grade_finished_area,
    lot_size: c.lot_size,
    beds: c.beds,
    baths: c.baths,
    year_built: c.year_built,
    architectural_style: c.architectural_style,
    levels: c.levels,
    township: c.township,
    subdivision_name: c.subdivision_name,
    garage: c.garage,
    basement: c.basement,
    price_per_sqft: c.price_per_sqft,
    annual_taxes: c.annual_taxes,
    school_district: c.school_district,
    water_source: c.water_source,
    sewer: c.sewer,
    public_remarks: c.public_remarks,
    property_type: c.property_type,
    home_type: c.property_type,
    match_score: c.match_score,
    similarity_details: c.similarity_details,
    quality: {},
    strength: null,
    commentary: null,
  }
}

function backendCardMatchDetails(details: CmaCompCandidate['similarity_details']): MatchScoreDetails | undefined {
  if (!details) return undefined
  return {
    score: details.display_match_score ?? details.final_similarity_score ?? 0,
    rawRelevanceScore: details.raw_relevance_score ?? 0,
    displayCalibrationVersion: details.display_calibration_version || '',
    baseRelevanceScore: details.base_relevance_score ?? 0,
    productModifier: details.product_modifier ?? 1,
    candidateDistanceMiles: details.candidate_distance_miles ?? null,
    localMarketHalfLifeMiles: details.density_context?.distance_half_life_miles ?? 0,
    densityReferenceCount: details.density_context?.reference_count ?? 0,
    densityDistancesUsedMiles: details.density_context?.density_distances_used_miles ?? [],
    densityFallbackUsed: details.density_context?.fallback_used ?? false,
    componentScores: details.component_scores ?? {},
    componentPoints: details.component_points ?? {},
    availableComponentWeight: details.available_component_weight ?? 0,
  }
}

// ============================================================================
// Step 2: Comparable Search
// ============================================================================

const COMP_STATUS_OPTIONS: { value: CmaCompStatus, label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'active_under_contract', label: 'Active Under Contract' },
  { value: 'pending', label: 'Pending' },
  { value: 'sold', label: 'Sold' },
]

const SOLD_DAYS_STEPS = [100, 200, 300, 400, 500, 600, 700, 750]

// Starts tight and widens itself - same reasoning as SOLD_DAYS_STEPS above (a fixed 5mi default
// either dumped in far more candidates than needed in a dense market, or missed closer comps
// entirely in a quiet one). Widens only until there are enough genuinely strong (>=70% match)
// candidates to work with, not just "enough candidates."
const RADIUS_STEPS = [1, 2, 3, 5, 8, 12, 18, 25]
// Floor for the "widen" loop in CompsStep's runSearch - keeps widening the radius until at least
// this many genuinely strong (>=70% match) comps exist, rather than settling for 2-3. No matching
// ceiling constant: once the floor is met the loop just stops, whatever the count landed on -
// stepping back down to chase an upper bound would reproduce the too-few count that caused the
// widen in the first place and oscillate forever (see runSearch's comment for the full reasoning).
const MIN_STRONG_MATCHES = 5
// Hard cap, not just the auto-select target - keeps cost/generation time bounded and matches
// the AI analysis's own reservation sizing (see cma_ai_service.py), regardless of how many the
// agent tries to manually add on top of the auto-picked set.
const MAX_COMPS = 5
// Score a 4th/5th auto-picked comp must reach (the top 3 are always picked).
const AUTO_PICK_EXTRA_MIN_SCORE = 60

// How many grid columns a stat should claim based on how long its value actually renders - short
// values like "3" or "-" stay a single tile, longer ones like "Full, Finished, Walkout" or a
// school district name get one extra column instead of truncating into an ellipsis. Capped at 2
// (never 3) so two dynamic tiles (e.g. Basement + School) always fit on the same row rather than
// one of them alone claiming half of it - very long values shrink their own font instead (see
// chipValueTextClass) rather than claiming more grid space.
function chipSpan(value: string | number): number {
  const len = String(value).length
  return len > 6 ? 2 : 1
}

// Companion to chipSpan's 2-column cap above - a value long enough that it wouldn't have fit in
// 2 columns at normal size (e.g. "Full, Unfinished, Walkout Stairs") drops down a size (or two)
// instead, so it still reads as one line without truncating.
function chipValueTextClass(value: string | number, compact?: boolean): string {
  const len = String(value).length
  if (len > 24) return compact ? 'text-[8px]' : 'text-[10px]'
  if (len > 14) return compact ? 'text-[10px]' : 'text-xs'
  return compact ? 'text-xs' : 'text-sm'
}

// Same "pop" as the Showcases fact chips (components/PropertyDetailsModal.tsx's FactChip) -
// icon on top, bold value, small caps label - just sized down to fit inside a card footer.
// dynamicSpan opts a grid of these into the length-aware column-span above (paired with
// grid-flow-row-dense on the parent grid so shorter tiles backfill the gaps that leaves) -
// off by default so the fixed-size grids elsewhere (e.g. the compact subject-vs-comp table)
// keep their original one-tile-each layout.
// `secondary` is the one exception to "one value per chip": the CMA similarity engine scores on
// above-grade sqft while the headline card number is total finished sqft (see sqftBreakdown
// below) - when they meaningfully differ, this renders both stacked in one tile (forced to a
// 2-column span, independent of dynamicSpan/chipSpan) instead of silently picking one. Every
// other chip on this page never sets `secondary`, so this is a strict opt-in with no effect on
// any other stat type.
function CmaFactChip({ icon: Icon, value, label, compact, dynamicSpan, secondary, className = '' }: {
  icon: any, value: string | number, label: string, compact?: boolean, dynamicSpan?: boolean,
  secondary?: { value: string | number, label: string }, className?: string,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-center dark:border-gray-800 dark:bg-[#0B0B0B] ${compact ? 'gap-0.5 px-0.5 py-1.5' : 'gap-1 py-2'} ${className}`}
      style={secondary ? { gridColumn: 'span 2 / span 2' } : dynamicSpan ? { gridColumn: `span ${chipSpan(value)} / span ${chipSpan(value)}` } : undefined}
    >
      <Icon className={compact ? 'h-3 w-3 text-[#C9A24D]' : 'h-3.5 w-3.5 text-[#C9A24D]'} />
      <span className={`max-w-full truncate px-0.5 font-black leading-tight text-[#111827] dark:text-white ${chipValueTextClass(value, compact)}`}>{value}</span>
      <span className={`font-black uppercase tracking-widest text-gray-400 ${compact ? 'text-[6px]' : 'text-[7px]'}`}>{label}</span>
      {secondary && (
        <>
          <span className={`-mt-0.5 max-w-full truncate px-0.5 font-black leading-tight text-[#111827] dark:text-white ${chipValueTextClass(secondary.value, compact)}`}>{secondary.value}</span>
          <span className={`font-black uppercase tracking-widest text-gray-400 ${compact ? 'text-[6px]' : 'text-[7px]'}`}>{secondary.label}</span>
        </>
      )}
    </div>
  )
}

// The CMA similarity engine scores size using above-grade finished area (_v10_sqft on the
// backend - see cma_ai_service.py), while `sqft` is the headline total finished living area
// (living_area) shown everywhere else in the app. Returns the pair to display ONLY when they
// meaningfully diverge (a real finished-basement contribution) - when there's no below-grade
// area, or above-grade is unavailable, or the two are effectively the same value, this returns
// null so the CMA UI falls back to the single plain "Sqft" chip exactly as before. The 100 sqft
// tolerance absorbs rounding/measurement noise between MLS-reported fields, not a real basement.
function sqftBreakdown(totalSqft?: number | null, aboveGradeSqft?: number | null): { above: number, total: number } | null {
  if (!totalSqft || !aboveGradeSqft) return null
  if (Math.abs(totalSqft - aboveGradeSqft) < 100) return null
  return { above: aboveGradeSqft, total: totalSqft }
}

// Single-line variant of sqftBreakdown for contexts that can't host a two-row chip (table cells,
// popup fact strings) - same divergence rule, just formatted as one compact string.
function formatSqftCompact(totalSqft?: number | null, aboveGradeSqft?: number | null): string {
  const breakdown = sqftBreakdown(totalSqft, aboveGradeSqft)
  if (!breakdown) return totalSqft ? formatNumber(totalSqft) : '-'
  return `${formatNumber(breakdown.above)} above grade / ${formatNumber(breakdown.total)} total`
}

// Sqft chip, everywhere it's shown (card grids and View Details alike): always the plain total
// figure, one normal tile. Above Grade is no longer a standalone tile anywhere - when it
// meaningfully diverges from the total (a real finished-basement contribution), it's folded into
// the Basement fact instead (see basementFactValue below), right alongside the below-grade
// figure. One fewer tile per property keeps every card grid filling out to whole rows.
function sqftChipProps(totalSqft?: number | null) {
  return {
    label: 'Sqft',
    value: totalSqft ? formatNumber(totalSqft) : '-',
  }
}

// A Basement chip's raw text ("Fully Finished", "Full, Finished, Walkout") never surfaced the
// actual finished-area numbers, even though they're already tracked right alongside it. Now that
// Above Grade is no longer its own tile (see sqftChipProps above), this is also where that figure
// lives: below-grade finished first, then above-grade (only when the two meaningfully diverge -
// see sqftBreakdown), then the descriptive text - e.g. "1.5k below grade finished, 2.8k above
// grade - Fully finished". Generic for every subject/comp that has a below_grade_finished_area on
// record, not specific to any one address.
function basementFactValue(
  basementText?: string | null, belowGradeSqft?: number | null, totalSqft?: number | null, aboveGradeSqft?: number | null,
): string | null {
  const breakdown = sqftBreakdown(totalSqft, aboveGradeSqft)
  const parts: string[] = []
  if (belowGradeSqft) parts.push(`${formatCompactNumber(belowGradeSqft)} below grade finished`)
  if (breakdown) parts.push(`${formatCompactNumber(breakdown.above)} above grade`)
  const sqftLabel = parts.join(', ')
  if (sqftLabel && basementText) return `${sqftLabel} - ${basementText}`
  return sqftLabel || basementText || null
}

function CompsStep({ report, onSave, onReportUpdated, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onNext: () => void }) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(report.comparables)
  const [statuses, setStatuses] = useState<CmaCompStatus[]>(['sold'])
  // Starts at the tightest step and auto-widens (see runSearch) rather than defaulting straight
  // to a fixed radius - stops the moment the agent drags the circle/slider themselves.
  const [radius, setRadius] = useState(RADIUS_STEPS[0])
  const autoRadiusRef = useRef(true)
  const radiusExtraStepRef = useRef(false)
  // Same autofill rule as the Similar Properties sheet (CreateOpenHouseWizard) - seed the price
  // and beds range from the subject itself so the very first search already returns real comps,
  // not an unbounded dump of every property in the radius. Price band is a wide ±35% (the tighter
  // ±20% was cutting off legitimate comps at the top/bottom of a street); the agent narrows it in
  // Refine if they want to.
  const [minPrice, setMinPrice] = useState(() => {
    const price = report.subject.list_price || 0
    return price ? String(Math.max(0, Math.floor(price * 0.65 / 10000) * 10000)) : ''
  })
  const [maxPrice, setMaxPrice] = useState(() => {
    const price = report.subject.list_price || 0
    return price ? String(Math.ceil(price * 1.35 / 10000) * 10000) : ''
  })
  const [minBeds, setMinBeds] = useState(() => {
    const beds = report.subject.beds || 0
    if (!beds) return 0
    return Math.max(0, beds - (beds >= 8 ? 2 : 1))
  })
  const [minAcres, setMinAcres] = useState(0)
  const [maxAcres, setMaxAcres] = useState('')
  const [minSqft, setMinSqft] = useState('')
  const [maxSqft, setMaxSqft] = useState('')
  const [minBaths, setMinBaths] = useState(0)
  const [minYearBuilt, setMinYearBuilt] = useState('')
  const [maxYearBuilt, setMaxYearBuilt] = useState('')
  // Single-value narrowing on top of the radius search (not an alternate search mode the way
  // Showcase's city/township/school-district pickers work) - MultiSelectDatabaseInput is reused
  // for the same familiar autocomplete feel, just capped at one selection each.
  const [schoolDistrictSel, setSchoolDistrictSel] = useState<string[]>([])
  const [citySel, setCitySel] = useState<string[]>([])
  const [refineOpen, setRefineOpen] = useState(false)
  // Floor of 200 days sold, then widens itself (200 -> 300 -> ... -> 750) whenever a sold search
  // comes back with fewer than 5 matches, so a quiet market still surfaces comps instead of an
  // empty result. Stops auto-widening the moment the agent edits it by hand.
  const [soldWithinDays, setSoldWithinDays] = useState('200')
  const autoSoldDaysRef = useRef(true)
  const [results, setResults] = useState<CmaCompCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  // True for the whole chain of auto-widen searches that run back to back on first load (radius
  // and/or sold-days both stepping up until there are enough strong matches) - without this, each
  // intermediate search's results would flash into the grid only to be replaced moments later by
  // the next step's results, which read as the page glitching/reloading repeatedly. Stays true
  // until a search completes with no further auto-widen queued up, so only the final, settled
  // result set is ever shown.
  const [optimizing, setOptimizing] = useState(true)
  const [popup, setPopup] = useState<{ type: 'subject' } | { type: 'candidate', candidate: CmaCompCandidate } | null>(null)
  // Guards against out-of-order responses - the sold-days auto-widen can fire several searches
  // back to back, and without this a slower earlier response can land after a faster later one
  // and clobber it with stale/smaller results.
  const searchSeqRef = useRef(0)

  // Stays true (and keeps re-picking the top matches as search results change - see the effect
  // below) for as long as the agent hasn't manually touched anything themselves. If this report
  // already had comps saved (a return visit), starts false so auto-select never runs at all - it
  // can never clobber an agent's own picks. The moment toggleAdd/removeComp fires even once, this
  // flips to false permanently for the rest of this visit - at that point the agent is in manual
  // control and auto-select must never touch their selection again, even if they remove everything.
  const autoManagedRef = useRef(report.comparables.length === 0)
  const [subjectPhotoIndex, setSubjectPhotoIndex] = useState(0)
  const comparablesLoaded = useRef(false)
  useEffect(() => {
    autoManagedRef.current = report.comparables.length === 0
    autoRadiusRef.current = true
    radiusExtraStepRef.current = false
    setOptimizing(true)
    setComparables(report.comparables)
    setSubjectPhotoIndex(0)
    comparablesLoaded.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])

  // Autosave the agent's comp picks, debounced like SubjectStep's subject field above - skips the
  // first run after a report loads/switches so it doesn't immediately re-save what was just
  // fetched.
  useEffect(() => {
    if (!comparablesLoaded.current) { comparablesLoaded.current = true; return }
    const t = setTimeout(() => { onSave({ comparables }, { silent: true }) }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparables])

  const addedKeys = useMemo(() => new Set(comparables.map(c => c.listing_key).filter(Boolean)), [comparables])

  // Refresh previously selected draft comps from the same backend-scored search rows used by
  // their visible cards. Generated reports stay frozen; generation already persists its own
  // authoritative score trace.
  useEffect(() => {
    if (report.pricing?.ai_estimate?.final_valuation || results.length === 0) return
    const scoredByKey = new Map(results.map(candidate => [candidate.listing_key, candidate]))
    setComparables(current => {
      let changed = false
      const reconciled = current.map(comp => {
        const scored = comp.listing_key ? scoredByKey.get(comp.listing_key) : undefined
        if (!scored || typeof scored.match_score !== 'number' || !scored.similarity_details) return comp
        const oldFingerprint = comp.similarity_details?.subject_snapshot_sha256
        const newFingerprint = scored.similarity_details.subject_snapshot_sha256
        if (comp.match_score === scored.match_score && oldFingerprint === newFingerprint) return comp
        changed = true
        return { ...comp, match_score: scored.match_score, similarity_details: scored.similarity_details }
      })
      return changed ? reconciled : current
    })
  }, [results, report.pricing?.ai_estimate?.final_valuation])

  const subject = report.subject
  const subjectAcres = sqftToAcres(subject.lot_size)
  const subjectPhotos = subject.photos && subject.photos.length > 0 ? subject.photos : (subject.photo_url ? [subject.photo_url] : [])

  // Same matching system as the Similar Properties feature (frontend/lib/matchScore.ts) - not
  // reinvented for CMA, just applied against whichever comps the status/filter search returns.
  // Depends on the individual subject FIELDS, not `report.subject` - every silent autosave
  // returns a fresh report (new subject object, identical contents). Keying this on the object
  // made scoreFor -> sortedResults -> the auto-select effect -> setComparables -> autosave ->
  // save -> new report churn in a ~700ms loop ("Saving…/Saved" flicker, map re-plotting).
  const scoreSubject = useMemo(() => ({
    listing_key: subject.listing_key,
    source: subject.source,
    sqft: subject.sqft,
    above_grade_finished_area: subject.above_grade_finished_area,
    lot_size: subject.lot_size,
    city: subject.city,
    school_district: subject.school_district,
    township: subject.township,
    subdivision_name: subject.subdivision_name,
    latitude: subject.latitude,
    longitude: subject.longitude,
    year_built: subject.year_built,
    property_type: subject.property_type,
    architectural_style: subject.architectural_style,
    levels: subject.levels,
    stories: subject.stories,
    public_remarks: subject.public_remarks,
  }), [
    subject.listing_key, subject.source,
    subject.sqft, subject.above_grade_finished_area, subject.lot_size, subject.city, subject.school_district,
    subject.township, subject.subdivision_name,
    subject.latitude, subject.longitude, subject.year_built, subject.property_type,
    subject.architectural_style, subject.levels, subject.stories, subject.public_remarks,
  ])
  // Backend continuous relevance is the only CMA card score authority. Sorting, badges, map
  // popups, auto-selection, and saved comps all consume this exact returned integer.
  const scoreFor = useCallback((candidate: CmaCompCandidate) => candidate.match_score, [])

  const runSearch = useCallback(() => {
    if (statuses.length === 0) {
      setResults([])
      setOptimizing(false)
      return
    }
    if (!report.subject.latitude || !report.subject.longitude) {
      showToast('This subject property is missing location coordinates - try re-selecting it from the address search on the previous step.', 'error')
      setOptimizing(false)
      return
    }
    setSearching(true)
    setSearched(true)
    const seq = ++searchSeqRef.current
    const saleDateFrom = soldWithinDays
      ? new Date(Date.now() - Number(soldWithinDays) * 86400000).toISOString().slice(0, 10)
      : undefined
    api.cma.searchComparables({
      listing_key: report.subject.listing_key || undefined,
      subject: scoreSubject,
      latitude: report.subject.latitude,
      longitude: report.subject.longitude,
      subject_sqft: report.subject.above_grade_finished_area || report.subject.sqft,
      property_type: report.subject.property_type,
      radius_miles: radius,
      statuses,
      sale_date_from: saleDateFrom,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      min_sqft: minSqft ? Number(minSqft) : undefined,
      max_sqft: maxSqft ? Number(maxSqft) : undefined,
      min_lot_size: minAcres ? acresToSqft(minAcres) : undefined,
      max_lot_size: maxAcres ? acresToSqft(Number(maxAcres)) : undefined,
      min_year_built: minYearBuilt ? Number(minYearBuilt) : undefined,
      max_year_built: maxYearBuilt ? Number(maxYearBuilt) : undefined,
      min_beds: minBeds ? minBeds : undefined,
      min_baths: minBaths ? minBaths : undefined,
      school_district: schoolDistrictSel[0]?.split(',')[0]?.trim() || undefined,
      city: citySel[0]?.split(',')[0]?.trim() || undefined,
    }).then(r => {
      if (seq !== searchSeqRef.current) return
      setSearching(false)
      if (r.success && r.data) {
        // Never let a legacy/cached response revive browser-only or untraceable scores. A current
        // backend row always has both the final integer and its authoritative component trace.
        const authoritativeResults = r.data.filter(candidate => (
          typeof candidate.match_score === 'number'
          && candidate.similarity_details?.scoring_authority === 'backend_continuous_relevance'
        ))
        if (authoritativeResults.length !== r.data.length) {
          showToast('Comparable scores were refreshed. Please try the search again.', 'error')
        }
        setResults(authoritativeResults)
        let willWidenAgain = false
        if (statuses.includes('sold') && autoSoldDaysRef.current && authoritativeResults.length < 5) {
          const currentIndex = SOLD_DAYS_STEPS.indexOf(Number(soldWithinDays))
          const next = currentIndex >= 0 ? SOLD_DAYS_STEPS[currentIndex + 1] : undefined
          if (next) { setSoldWithinDays(String(next)); willWidenAgain = true }
        }
        // Widens the radius while there are too few genuinely strong (>=70%) matches to work
        // with, same auto-widen shape as soldWithinDays above - targeting the 5-10 sweet spot
        // instead of starving on 2-3 matches. Deliberately never steps back DOWN on its own: a
        // narrower radius already produced the too-few count that caused this widen in the first
        // place, so stepping back would just reproduce it and oscillate between the two steps
        // forever. Once a widen lands above MAX_STRONG_MATCHES (or the widest step is reached),
        // it stops there and leaves the extra choices for the agent to manually prune - still
        // strictly better than too few.
        if (autoRadiusRef.current) {
          // Only matches the auto-pick could actually use count toward "enough": a strong-scoring
          // detached house can't stand in for a twin, and a sale with no verified closing price or
          // no square footage carries no valuation weight. Counting those stopped the widen at 1 mi
          // with two usable twins (backtest, 10/19).
          const strongCount = authoritativeResults.filter(c => isAutoPickable(c) && scoreFor(c) >= 70).length
          const currentIndex = RADIUS_STEPS.indexOf(radius)
          // One step past "enough": every in-circle sale is scored (proximity is part of the score),
          // so a wider circle only ADDS candidates - a better match just past the line now competes
          // instead of being cut (417 Dogwood Ln stopped at 1 mi; its best sale, 85%, sat at 1.5 mi).
          const enough = strongCount >= MIN_STRONG_MATCHES
          if (currentIndex < RADIUS_STEPS.length - 1 && (!enough || !radiusExtraStepRef.current)) {
            if (enough) radiusExtraStepRef.current = true
            setRadius(RADIUS_STEPS[currentIndex + 1])
            willWidenAgain = true
          } else {
            autoRadiusRef.current = false
          }
        }
        // Only reveals the grid once the whole auto-widen chain has actually settled - see the
        // `optimizing` state declaration above for why.
        setOptimizing(willWidenAgain)
      } else {
        showToast(r.error || 'Search failed.', 'error')
        setOptimizing(false)
      }
    })
  }, [report.subject, scoreSubject, radius, statuses, soldWithinDays, minPrice, maxPrice, minSqft, maxSqft, minAcres, maxAcres, minYearBuilt, maxYearBuilt, minBeds, minBaths, schoolDistrictSel, citySel, showToast, scoreFor])

  // Auto-pulls from the database as filters change - no manual search trigger, debounced the
  // same way the Similar Properties sheet debounces its preference changes.
  useEffect(() => {
    const timeout = setTimeout(() => { runSearch() }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    statuses.join(','), radius, minPrice, maxPrice, minBeds, minBaths, minAcres, maxAcres, minSqft,
    maxSqft, minYearBuilt, maxYearBuilt, soldWithinDays, citySel.join(','), schoolDistrictSel.join(','),
    report.subject.latitude, report.subject.longitude,
  ])

  const toggleStatus = (value: CmaCompStatus) => {
    setStatuses(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])
  }

  // Same "Same School" badge as the Similar Properties sheet - case-insensitive district match.
  const subjectSchool = (subject.school_district || '').trim().toLowerCase()
  const isSameSchool = (candidate: CmaCompCandidate) => {
    const school = (candidate.school_district || '').trim().toLowerCase()
    return Boolean(school && subjectSchool && school === subjectSchool)
  }

  const toggleAdd = (candidate: CmaCompCandidate) => {
    if (addedKeys.has(candidate.listing_key)) {
      autoManagedRef.current = false
      setComparables(cs => cs.filter(c => c.listing_key !== candidate.listing_key))
      return
    }
    if (comparables.length >= MAX_COMPS) {
      showToast(`A CMA can have at most ${MAX_COMPS} comparables - remove one before adding another.`, 'error')
      return
    }
    autoManagedRef.current = false
    setComparables(cs => [...cs, { ...candidateToComparable(candidate), order_index: cs.length }])
  }

  // Usable sales first, then Match % - so the first cards ARE the ones the auto-pick chooses. A
  // high-scoring sale with no sold price (or another housing product) sorts after them, labelled.
  const sortedResults = useMemo(() => [...results].sort((a, b) => (
    Number(isAutoPickable(b)) - Number(isAutoPickable(a)) || scoreFor(b) - scoreFor(a)
  )), [results, scoreFor])

  // Paginate the candidate GRID (the map still plots every result). Default 24 per page with a
  // per-page picker + windowed page numbers, same pattern as the rest of the app.
  const COMPS_PER_PAGE_OPTIONS = [12, 24, 48, 96]
  const [compsPerPage, setCompsPerPage] = useState(24)
  const [compsPage, setCompsPage] = useState(1)
  const totalCompPages = Math.max(1, Math.ceil(sortedResults.length / compsPerPage))
  useEffect(() => { setCompsPage(1) }, [compsPerPage, sortedResults.length])
  useEffect(() => { if (compsPage > totalCompPages) setCompsPage(totalCompPages) }, [compsPage, totalCompPages])
  const pagedResults = useMemo(
    () => sortedResults.slice((compsPage - 1) * compsPerPage, compsPage * compsPerPage),
    [sortedResults, compsPage, compsPerPage],
  )

  // Keeps the top matches auto-selected as search results change (radius widening, filter edits,
  // ...) for as long as the agent hasn't manually touched anything - always the top 3, extended to
  // 4-5 while score stays >=60%, so a 5th slot never gets filled by a weak match just to hit a round
  // number. (Was >=70%: in a pocket where the size-matched sales sit 1-1.5 mi away they score 60-69%
  // and the set stopped at 3 - two of them tiny dated twins - and a Wynnewood twin backtest came in 13%
  // low. Below 60 the match is genuinely poor.) A live default the agent can freely override at any point (toggleAdd/
  // removeComp flip autoManagedRef off the instant they do), not a one-time suggestion or a lock.
  useEffect(() => {
    if (!autoManagedRef.current || sortedResults.length === 0) return
    // A structurally incompatible property type (condo vs single-family, townhouse vs detached
    // single-family, etc.) never gets auto-picked as a primary comp, no matter how high its Match
    // % is or where it ranks - see _continuous_relevance's structurally_incompatible_property_type
    // gate. It stays visible in the grid/map for the agent to add manually if they choose to.
    const autoPickEligible = sortedResults.filter(isAutoPickable)
    const picks = autoPickEligible.filter((c, i) => i < 3 || (i < MAX_COMPS && scoreFor(c) >= AUTO_PICK_EXTRA_MIN_SCORE))
    const pickKeys = picks.map(c => c.listing_key).join(',')
    // Only replace `comparables` when the auto-pick set actually changed - returning the same
    // reference otherwise keeps the [comparables] autosave effect from firing on every render
    // where sortedResults merely got a new identity (belt-and-suspenders with the scoreFor fix).
    setComparables(cur => {
      if (cur.map(c => c.listing_key).join(',') === pickKeys) return cur
      return picks.map((c, i) => ({ ...candidateToComparable(c), order_index: i }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedResults])

  const handleContinue = async () => {
    // See SubjectStep's handleContinue - the next step reads fresh report data on mount, so this
    // must wait for the save instead of racing ahead of it.
    const saved = await onSave({ comparables })
    // Only matters on a repeat visit after a generation already ran (e.g. adding/removing a comp
    // afterward) - see AnalysisStep's handleContinue for why this re-verifies immediately.
    if (saved && isStaleArtifactOnly(cmaQaBlocking(saved))) {
      // Free re-stamp, not a paid recompute - nothing about the content needs re-checking here,
      // just the artifact hash catching up to this save.
      const response = await api.cma.resyncQa(saved.id)
      if (response.success && response.data) onReportUpdated(response.data)
    }
    onNext()
  }

  const popupProps: PropertyPopupData | null = useMemo(() => {
    if (!popup) return null
    if (popup.type === 'subject') {
      const subjectPsf = subject.list_price && subject.sqft ? pricePerSqft(subject.list_price, subject.sqft) : null
      const subjectBasement = basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area)
      return {
        photos: subjectPhotos,
        address: subject.street_address || 'Subject Property',
        cityState: [subject.city, subject.state].filter(Boolean).join(', '),
        price: subject.list_price,
        priceLabel: 'List Price',
        pricePerSqft: subjectPsf,
        status: null,
        matchScore: null,
        distanceMiles: null,
        sameSchool: false,
        facts: [
          { icon: Bed, label: 'Beds', value: subject.beds ?? '-', fixedSpan: false },
          { icon: Bath, label: 'Baths', value: subject.baths ?? '-', fixedSpan: false },
          { icon: Ruler, ...sqftChipProps(subject.sqft), fixedSpan: false },
          { icon: LandPlot, label: 'Acres', value: subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-', fixedSpan: false },
          { icon: Building2, label: 'Built', value: subject.year_built ?? '-', fixedSpan: false },
          { icon: Calendar, label: 'DOM', value: subject.days_on_market ?? '-', fixedSpan: false },
          { icon: DollarSign, label: 'Taxes', value: subject.annual_taxes ? formatMoney(subject.annual_taxes) : '-', fixedSpan: true },
          { icon: Droplets, label: 'Water', value: formatUtilityValue(subject.water_source), fixedSpan: false },
          { icon: Waves, label: 'Sewer', value: formatUtilityValue(subject.sewer), fixedSpan: true },
          ...(subject.garage ? [{ icon: Car, label: 'Garage', value: subject.garage, fixedSpan: false }] : []),
          ...(subjectBasement ? [{ icon: Layers, label: 'Basement', value: subjectBasement, fixedSpan: false }] : []),
        ],
        schoolDistrict: subject.school_district,
        description: subject.public_remarks || null,
        lat: subject.latitude ?? null,
        lng: subject.longitude ?? null,
        roadContext: report.pricing?.ai_estimate?.subject_road_context ?? null,
      }
    }
    const c = popup.candidate
    const dp = compDisplayPrice(c as unknown as CmaComparable)
    const psf = pricePerSqft(effectiveCompPrice(c as unknown as CmaComparable), c.sqft)
    const compBasement = basementFactValue(c.basement, c.below_grade_finished_area, c.sqft, c.above_grade_finished_area)
    return {
      photos: c.photos && c.photos.length > 0 ? c.photos : (c.photo_url ? [c.photo_url] : []),
      address: c.street_address || 'Comparable Property',
      cityState: [c.city, c.state].filter(Boolean).join(', '),
      price: dp.value,
      priceLabel: dp.label,
      pricePerSqft: psf,
      status: c.status,
      matchScore: scoreFor(c),
      distanceMiles: c.distance_miles,
      sameSchool: isSameSchool(c),
      facts: [
        { icon: Bed, label: 'Beds', value: c.beds ?? '-', fixedSpan: false },
        { icon: Bath, label: 'Baths', value: c.baths ?? '-', fixedSpan: false },
        { icon: Ruler, ...sqftChipProps(c.sqft), fixedSpan: false },
        { icon: LandPlot, label: 'Acres', value: c.lot_size ? sqftToAcres(c.lot_size).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-', fixedSpan: false },
        { icon: Building2, label: 'Built', value: c.year_built ?? '-', fixedSpan: false },
        { icon: Calendar, label: 'DOM', value: c.days_on_market ?? '-', fixedSpan: false },
        { icon: DollarSign, label: 'Taxes', value: c.annual_taxes ? formatMoney(c.annual_taxes) : '-', fixedSpan: true },
        { icon: MapPin, label: 'Distance', value: c.distance_miles != null ? `${c.distance_miles} mi` : '-', fixedSpan: true },
        { icon: Droplets, label: 'Water', value: formatUtilityValue(c.water_source), fixedSpan: false },
        { icon: Waves, label: 'Sewer', value: formatUtilityValue(c.sewer), fixedSpan: true },
        ...(c.sale_date ? [{ icon: Calendar, label: 'Sold', value: formatDate(c.sale_date), fixedSpan: true }] : []),
        ...(c.garage ? [{ icon: Car, label: 'Garage', value: c.garage, fixedSpan: false }] : []),
        ...(compBasement ? [{ icon: Layers, label: 'Basement', value: compBasement, fixedSpan: false }] : []),
      ],
      schoolDistrict: c.school_district,
      description: c.public_remarks || null,
      lat: c.latitude ?? null,
      lng: c.longitude ?? null,
      roadContext: (c as unknown as CmaComparable).road_context ?? null,
    }
  }, [popup, subject, subjectAcres, subjectPhotos, scoreFor, report.pricing?.ai_estimate?.subject_road_context])

  return (
    <div className="space-y-5">
      {/* Phones (user, 10/17): the home on one line, then results / added / Refine as one even row. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-[#151517] sm:gap-4 sm:p-4">
        <button type="button" onClick={() => setPopup({ type: 'subject' })} className="flex w-full min-w-0 items-center gap-3 text-left sm:w-auto">
          <div className="h-12 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 sm:h-14 sm:w-16">
            {subjectPhotos.length > 0 ? <img src={normalizeImageUrl(subjectPhotos[0])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-gray-300" /></div>}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address || 'Subject Property'}</p>
            <p className="text-xs font-semibold text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ') || '—'} · {radius} mi radius</p>
          </div>
        </button>
        <div className="grid w-full grid-cols-3 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <div className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-[#0B0B0B] sm:px-4 sm:py-2">
            <span className="mr-1.5 text-[9px] font-black uppercase tracking-wide text-gray-400 sm:mr-2 sm:text-[10px]">Results</span>
            <span className="text-base font-black text-[#111827] dark:text-white sm:text-lg">{results.length}</span>
          </div>
          <div className="inline-flex items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-1.5 dark:border-emerald-900/30 dark:bg-emerald-900/10 sm:px-4 sm:py-2">
            <span className="mr-1.5 text-[9px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400 sm:mr-2 sm:text-[10px]">Added</span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-300 sm:text-lg">{comparables.length}</span>
          </div>
          <button type="button" onClick={() => setRefineOpen(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] sm:gap-2 sm:px-4">
            <Search className="h-3.5 w-3.5" /> <span className="sm:hidden">Refine</span><span className="hidden sm:inline">Refine Your Search</span>
          </button>
        </div>
      </div>

      {/* Full-bleed at lg+ only: breaks out of the page's mx-auto max-w-6xl container so this
          section can use the whole screen width on tablet-landscape/desktop, where there's
          actually room for it. Deliberately NOT applied below lg - 100vw is unreliable on mobile
          viewports (scrollbar/address-bar quirks routinely cause horizontal overflow with this
          trick), so mobile just stays in the normal contained column instead. */}
      <div className="lg:relative lg:left-1/2 lg:right-1/2 lg:-mx-[50vw] lg:w-screen lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-[#f1f3f5] p-4 shadow-inner dark:border-gray-800 dark:bg-transparent sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Property Selection</h3>
              <p className="text-xs font-semibold text-gray-400">Top matches auto-selected. Add or remove as you see fit.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">{comparables.length} added</span>
              <button
                onClick={handleContinue}
                disabled={comparables.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]"
              >
                Continue <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          </div>

          {optimizing ? (
            // Covers the whole first-load auto-widen chain (radius and/or sold-days stepping up
            // search after search), not just one request - staying up through every intermediate
            // step is what actually stops the grid from flashing a different result set on every
            // step before it finally settles.
            <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-16 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <OhpSpinner size={36} />
              <p className="text-sm font-black text-gray-600 dark:text-gray-300">Finding the best comparables...</p>
              <p className="text-xs font-semibold text-gray-400">Widening the search until there are enough strong matches to work with.</p>
            </div>
          ) : searching ? (
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-12 text-sm font-bold text-gray-400 dark:border-gray-800">
              <OhpSpinner size={24} label="Searching" />
            </div>
          ) : statuses.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
              <p className="text-sm font-black text-gray-500 dark:text-gray-400">Select at least one status</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Open Refine Your Search and choose Active, Active Under Contract, Pending, and/or Sold.</p>
            </div>
          ) : searched && results.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
              <Search className="mx-auto mb-3 h-6 w-6 text-gray-300" />
              <p className="text-sm font-black text-gray-500 dark:text-gray-400">No matching properties yet</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Try widening the radius or price range in Refine Your Search.</p>
            </div>
          ) : (
            // Grid and map side by side (not a toggle) so both are visible at once - the grid
            // scrolls independently, the map stays put alongside it. At middle desktop widths the
            // map takes the extra horizontal space until the card column is wide enough for a real
            // three-card row; that avoids the awkward empty strip after two cards.
            // Height stays a sane fixed cap below lg (mobile/tablet-portrait) and only goes
            // viewport-relative at lg+, where there's room to spare.
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(500px,0.8fr)_minmax(420px,1.2fr)] lg:items-start 2xl:grid-cols-[minmax(940px,1.85fr)_minmax(420px,1fr)]">
              <div className="min-w-0">
              <div
                // Fluid card sizing instead of fixed breakpoints, via flexbox rather than CSS
                // Grid's auto-fit - grid's auto-fit sizes track counts for the WHOLE grid at once,
                // so a trailing partial row (e.g. 1 leftover card) shows empty unfilled tracks
                // instead of that card growing to fill the row. Flexbox lays out each row
                // independently, so flex-grow correctly fills leftover space in ANY row, including
                // a partial last one - no dead gap. Each card stays between 240-300px wide, and
                // however many fit at that width is however many end up per row.
                className="flex max-h-[520px] flex-wrap content-start gap-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-380px)]"
                style={{ overscrollBehavior: 'auto' }}
              >
                {pagedResults.map(candidate => (
                  // The wider cap only applies with exactly one result total - a card that just
                  // happens to land alone in its row because of an odd count (e.g. 4 results = 3
                  // then 1 trailing) stays at the normal 300px instead of stretching, which looked
                  // exaggerated. One true result gets a little breathing room instead of sitting
                  // capped at the same width as if it had neighbors.
                  <div
                    key={candidate.listing_key}
                    className={`min-w-[240px] max-w-full flex-1 ${pagedResults.length === 1 ? 'sm:max-w-[420px]' : 'sm:max-w-[300px]'}`}
                  >
                    <CompCandidateCard
                      candidate={candidate}
                      matchScore={scoreFor(candidate)}
                      matchDetails={backendCardMatchDetails(candidate.similarity_details)}
                      added={addedKeys.has(candidate.listing_key)}
                      sameSchool={isSameSchool(candidate)}
                      onToggle={() => toggleAdd(candidate)}
                      onOpenDetails={() => setPopup({ type: 'candidate', candidate })}
                    />
                  </div>
                ))}
              </div>
              {sortedResults.length > COMPS_PER_PAGE_OPTIONS[0] && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    <span>
                      {sortedResults.length === 0 ? '0' : `${(compsPage - 1) * compsPerPage + 1}–${Math.min(compsPage * compsPerPage, sortedResults.length)}`} of {sortedResults.length}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <label className="flex items-center gap-1.5">
                      Show
                      <select
                        value={compsPerPage}
                        onChange={e => setCompsPerPage(Number(e.target.value))}
                        className="rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-[11px] font-bold text-gray-600 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300"
                      >
                        {COMPS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
                      </select>
                    </label>
                  </div>
                  <Pager page={compsPage} totalPages={totalCompPages} onChange={setCompsPage} />
                </div>
              )}
              </div>
              <div className="lg:sticky lg:top-6">
                <CompsMapView
                  subject={subject}
                  candidates={sortedResults}
                  addedKeys={addedKeys}
                  radiusMiles={radius}
                  onRadiusChange={miles => { autoRadiusRef.current = false; setRadius(miles) }}
                  onToggleAdd={toggleAdd}
                  onOpenDetails={candidate => setPopup({ type: 'candidate', candidate })}
                  matchScoreFor={scoreFor}
                  heightClassName="h-[380px] lg:h-[calc(100vh-380px)]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {(() => {
        // Property-level prev/next for the detail popup, in the map/list order (sortedResults).
        if (popup?.type !== 'candidate') return <PropertyPopupModal open={!!popup} onClose={() => setPopup(null)} data={popupProps} />
        const i = sortedResults.findIndex(c => c.listing_key === popup.candidate.listing_key)
        return (
          <PropertyPopupModal
            open={!!popup}
            onClose={() => setPopup(null)}
            data={popupProps}
            compAdded={addedKeys.has(popup.candidate.listing_key)}
            onToggleComp={() => toggleAdd(popup.candidate)}
            onPrev={i > 0 ? () => setPopup({ type: 'candidate', candidate: sortedResults[i - 1] }) : undefined}
            onNext={i >= 0 && i < sortedResults.length - 1 ? () => setPopup({ type: 'candidate', candidate: sortedResults[i + 1] }) : undefined}
          />
        )
      })()}

      {refineOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-6" onClick={() => setRefineOpen(false)}>
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-[#151517]">
              <div>
                <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">Refine Your Search</h2>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Comps near <span className="font-black text-gray-900 dark:text-white">{subject.street_address || 'the subject property'}</span> - results update live as you edit.
                </p>
              </div>
              <button onClick={() => setRefineOpen(false)} className="shrink-0 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B]">
                <div className="relative h-48 w-full bg-gray-100 dark:bg-gray-800 sm:h-56">
                  {subjectPhotos.length > 0 ? (
                    <img src={normalizeImageUrl(subjectPhotos[subjectPhotoIndex])} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-gray-300" /></div>
                  )}
                  {subjectPhotos.length > 1 && (
                    <>
                      <button type="button" onClick={() => setSubjectPhotoIndex(i => (i - 1 + subjectPhotos.length) % subjectPhotos.length)} className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70" aria-label="Previous photo">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setSubjectPhotoIndex(i => (i + 1) % subjectPhotos.length)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70" aria-label="Next photo">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white">{subjectPhotoIndex + 1} / {subjectPhotos.length}</span>
                    </>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address || 'Subject Property'}</p>
                    {!!subject.list_price && <p className="shrink-0 text-lg font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(subject.list_price)}</p>}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wide text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ') || '—'}</p>
                  {/* Full stat set. The short fixed-format stats (beds ... sewer) are all uniform
                      single tiles on their own rows - keeps the small icons grouped. Only the two
                      genuinely long text values, Basement and School District, get the wide row
                      below (previously $-formatted Taxes / "Public Sewer" tripped the length-based
                      span and ballooned to double width). */}
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                    <CmaFactChip icon={Bed} value={subject.beds || '-'} label="Beds" />
                    <CmaFactChip icon={Bath} value={subject.baths || '-'} label="Baths" />
                    <CmaFactChip icon={Ruler} {...sqftChipProps(subject.sqft)} />
                    <CmaFactChip icon={LandPlot} value={subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} label="Acres" />
                    <CmaFactChip icon={Building2} value={subject.year_built ?? '-'} label="Built" />
                    <CmaFactChip icon={Calendar} value={subject.days_on_market ?? '-'} label="DOM" />
                    <CmaFactChip icon={DollarSign} value={subject.annual_taxes ? formatMoney(subject.annual_taxes) : '-'} label="Taxes" />
                    <CmaFactChip icon={Droplets} value={formatUtilityValue(subject.water_source)} label="Water" />
                    <CmaFactChip icon={Waves} value={formatUtilityValue(subject.sewer)} label="Sewer" />
                    {subject.garage && <CmaFactChip icon={Car} value={subject.garage} label="Garage" />}
                  </div>
                  {(subject.basement || subject.school_district) && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area) && (
                        <CmaFactChip icon={Layers} value={basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area)!} label="Basement" />
                      )}
                      {subject.school_district && <CmaFactChip icon={GraduationCap} value={subject.school_district} label="School District" />}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {COMP_STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleStatus(opt.value)}
                        className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                          statuses.includes(opt.value) ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Min Price" type="text" value={minPrice ? Number(minPrice).toLocaleString() : ''} onChange={v => setMinPrice(v.replace(/\D/g, ''))} placeholder="0" />
                  <TextField label="Max Price" type="text" value={maxPrice ? Number(maxPrice).toLocaleString() : ''} onChange={v => setMaxPrice(v.replace(/\D/g, ''))} placeholder="No Max" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Min Beds</FieldLabel>
                    <select value={minBeds} onChange={e => setMinBeds(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                      {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Min Baths</FieldLabel>
                    <select value={minBaths} onChange={e => setMinBaths(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                      {[0, 1, 1.5, 2, 2.5, 3, 4].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Min Sq Ft" type="number" value={minSqft} onChange={setMinSqft} placeholder="Any" />
                  <TextField label="Max Sq Ft" type="number" value={maxSqft} onChange={setMaxSqft} placeholder="Any" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Min Acres</FieldLabel>
                    <select value={minAcres} onChange={e => setMinAcres(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                      {[0, 0.1, 0.25, 0.5, 0.75, 1].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                    </select>
                  </div>
                  <TextField label="Max Acres" type="number" value={maxAcres} onChange={setMaxAcres} placeholder="Any" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Min Year Built" type="number" value={minYearBuilt} onChange={setMinYearBuilt} placeholder="Any" />
                  <TextField label="Max Year Built" type="number" value={maxYearBuilt} onChange={setMaxYearBuilt} placeholder="Any" />
                </div>

                <div>
                  <FieldLabel>Radius</FieldLabel>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
                    <input type="range" min="1" max="25" step="1" value={radius} onChange={e => { autoRadiusRef.current = false; setRadius(Number(e.target.value)) }} className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#C9A24D] dark:bg-gray-700" />
                    <div className="min-w-[70px] text-right"><span className="text-base font-black text-gray-900 dark:text-white">{radius}</span><span className="ml-1 text-[9px] font-bold uppercase text-gray-500">Miles</span></div>
                  </div>
                </div>

                {statuses.includes('sold') && (
                  <div>
                    <FieldLabel>Sold In The Last</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input type="number" value={soldWithinDays} onChange={e => { autoSoldDaysRef.current = false; setSoldWithinDays(e.target.value) }} placeholder="Any time" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                      <span className="shrink-0 text-[10px] font-bold uppercase text-gray-500">Days</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>School District</FieldLabel>
                    <MultiSelectDatabaseInput values={schoolDistrictSel} onChange={setSchoolDistrictSel} apiMethod={api.properties.searchSchoolDistricts} placeholder="Any" maxItems={1} />
                  </div>
                  <div>
                    <FieldLabel>City</FieldLabel>
                    <MultiSelectDatabaseInput values={citySel} onChange={setCitySel} apiMethod={api.properties.cities} placeholder="Any" maxItems={1} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button onClick={() => setRefineOpen(false)} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Hover breakdown of the backend Match % - one line per scored component (backend snake_case keys;
// the old text read camelCase keys that never existed, so most parts showed "-").
const MATCH_COMPONENT_LABELS: Record<string, string> = {
  proximity: "distance", market_area: "same area", size: "size", property_type: "home type", lot: "lot",
  age: "age", style: "style / levels", recency: "how recent", data_reliability: "data quality",
}
function matchBreakdownTitle(d: MatchScoreDetails): string {
  const parts = Object.entries(d.componentPoints).map(([k, pts]) => {
    const score = d.componentScores[k]
    const max = score ? pts / score : null
    return `${MATCH_COMPONENT_LABELS[k] || k} ${pts.toFixed(1)}${max ? "/" + Math.round(max) : ""}`
  })
  const dist = d.candidateDistanceMiles != null ? ` at ${d.candidateDistanceMiles.toFixed(2)} mi` : ""
  return `Underlying relevance ${(d.rawRelevanceScore * 100).toFixed(1)}%${dist}: ${parts.join("; ")}.`
}

function CompCandidateCard({ candidate, matchScore, matchDetails, added, sameSchool, onToggle, onOpenDetails }: { candidate: CmaCompCandidate, matchScore?: number, matchDetails?: MatchScoreDetails, added: boolean, sameSchool: boolean, onToggle: () => void, onOpenDetails: () => void }) {
  const dp = compDisplayPrice(candidate as unknown as CmaComparable)
  // $/sqft on this selector always derives from whatever price we're showing (close price once
  // sold data is backfilled, list price otherwise) - it's just an orientation number for
  // browsing candidates, not a valuation input.
  // A sale with no closing price on record shows its last asking price - never a $/sqft from it.
  const psf = dp.unverified ? null : pricePerSqft(dp.value, candidate.sqft)
  const candidateAcres = sqftToAcres(candidate.lot_size)
  const cityState = [candidate.city, candidate.state].filter(Boolean).join(', ')
  const photos = candidate.photos && candidate.photos.length > 0 ? candidate.photos : (candidate.photo_url ? [candidate.photo_url] : [])
  const { index: photoIndex, hovering: photoHovering, slotMs: photoSlotMs, onEnter: startRotate, onLeave: stopRotate } = useHoverPhotoCycle(photos.length)

  return (
    <div className={`w-full overflow-hidden rounded-2xl border-2 transition ${added ? 'border-emerald-500 ring-4 ring-emerald-500/15' : 'border-gray-100 dark:border-gray-800'}`}>
      {/* Inline style backs up the Tailwind height classes - reported collapsing to a thin bar
          with no visible photo specifically on mobile, and this guarantees a real height
          regardless of whatever's causing the class alone not to hold. */}
      <button type="button" onClick={onOpenDetails} onMouseEnter={startRotate} onMouseLeave={stopRotate} className="relative block h-48 w-full shrink-0 bg-gray-100 text-left dark:bg-gray-800 sm:h-56" style={{ height: 192, minHeight: 192 }}>
        {photos.length > 0 ? <img src={normalizeImageUrl(photos[photoIndex])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
        {photoHovering && photos.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-black/25">
            <div key={`${photoIndex}-${photoSlotMs}`} className="ohp-photo-cycle-bar h-full bg-[#C9A24D]" style={{ animationDuration: `${photoSlotMs}ms` }} />
          </div>
        )}
        {typeof matchScore === 'number' && (
          <div title={matchDetails ? matchBreakdownTitle(matchDetails) : undefined} className={`absolute left-2 top-2 rounded-full px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg ${matchScore >= 70 ? 'bg-emerald-600' : 'bg-gray-500'}`}>
            {matchScore}% Match
          </div>
        )}
        {candidate.status && (
          <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[candidate.status] || 'bg-gray-800'}`}>
            {COMP_STATUS_LABEL[candidate.status] || candidate.status}
          </span>
        )}
        {candidate.school_district && (
          <span title={candidate.school_district} className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-lg ring-1 ring-black/5">
            <span className="min-w-0 truncate">{candidate.school_district}</span>
            {sameSchool && (
              <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                <Check className="h-2 w-2 text-white" />
              </span>
            )}
          </span>
        )}
        {candidate.distance_miles != null && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white">{candidate.distance_miles} mi</span>
        )}
        {added && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/20">
            <div className="rounded-full bg-emerald-600 p-2 text-white shadow-lg"><Check className="h-5 w-5" /></div>
          </div>
        )}
      </button>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-black text-[#111827] dark:text-white">{candidate.street_address}</p>
          <span className={`shrink-0 text-right text-sm font-black ${dp.unverified ? "text-gray-400" : "text-[#8b7355] dark:text-[#d7b974]"}`} title={dp.unverified ? "Last asking price - the sold price isn't on record yet" : undefined}>
            {formatMoney(dp.value)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">{cityState || '—'}</p>
          {psf && <span className="shrink-0 text-[10px] font-bold text-gray-400">${psf}/sqft</span>}
        </div>
        {dp.unverified && (
          // Why a high-Match sale isn't auto-picked: no sold price on record, so it can't carry any
          // weight in the value (417 Dogwood Ln looked like the picker skipped its best cards, 10/20).
          <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Sold price not on record yet - shown at last asking. Can't be used in the value.
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          <CmaFactChip icon={Bed} value={candidate.beds ?? '-'} label="Beds" />
          <CmaFactChip icon={Bath} value={candidate.baths ?? '-'} label="Baths" />
          <CmaFactChip icon={Ruler} {...sqftChipProps(candidate.sqft)} />
          <CmaFactChip icon={LandPlot} value={candidateAcres > 0 ? candidateAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} label="Acres" />
        </div>
        <button
          onClick={onToggle}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
            added ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300'
          }`}
        >
          {added ? <><Check className="h-3.5 w-3.5" /> Added to CMA</> : <><Plus className="h-3.5 w-3.5" /> Add to CMA</>}
        </button>
      </div>
    </div>
  )
}

interface PropertyPopupData {
  photos: string[]
  address?: string | null
  cityState?: string | null
  price?: number | null
  priceLabel?: string
  pricePerSqft?: number | null
  status?: string | null
  matchScore?: number | null
  distanceMiles?: number | null
  sameSchool: boolean
  facts: { icon: any, label: string, value: string | number, fixedSpan?: boolean, secondary?: { value: string | number, label: string } }[]
  schoolDistrict?: string | null
  description?: string | null
  lat?: number | null
  lng?: number | null
  roadContext?: CmaRoadContext | null
}

const ROAD_VERDICT_STYLE: Record<string, { label: string, cls: string }> = {
  quiet: { label: 'Quiet street', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400' },
  neutral: { label: 'Normal street', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  through: { label: 'Near a major road', cls: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-400' },
  unknown: { label: 'Street not classified', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

// A roadmap-view location map for the comp/subject detail popup, so it's obvious at a glance
// whether a property sits on a quiet street or backs to a highway. Google Static Maps (a plain
// <img>, no JS/SDK), with a link out to the full interactive map; if the static image can't load
// (API not enabled on the key), it hides itself and just leaves the link. `road` is the free
// OpenStreetMap classification of the roads within ~170m (backend road_context_service).
function PropertyLocationMap({ lat, lng, label, road }: { lat: number, lng: number, label?: string | null, road?: CmaRoadContext | null }) {
  const [failed, setFailed] = useState(false)
  const key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  const q = `${lat},${lng}`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
  const staticUrl = key
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=17&size=640x480&scale=2&maptype=roadmap&markers=${encodeURIComponent(`color:0xC9A24D|${q}`)}&key=${key}`
    : null
  const rv = road?.verdict ? ROAD_VERDICT_STYLE[road.verdict] : null
  return (
    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Location</p>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-[#8b7355]">Open in Google Maps ↗</a>
      </div>
      {staticUrl && !failed ? (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          {/* same box as the property photos above (aspect-[4/3], capped height) so the map reads
              as an equal-weight tile, not a thin strip. */}
          <img src={staticUrl} alt={label ? `Map of ${label}` : 'Property location map'} onError={() => setFailed(true)} className="aspect-[4/3] max-h-[420px] w-full object-cover" loading="lazy" />
        </a>
      ) : (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-xs font-bold text-gray-400 dark:border-gray-700">
          <MapPin className="h-4 w-4 text-[#C9A24D]" /> View this location on Google Maps
        </a>
      )}
      {road?.summary && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {rv && <span className={`rounded-full px-2 py-0.5 font-black uppercase tracking-wide ${rv.cls}`}>{rv.label}</span>}
          <span className="font-semibold text-gray-600 dark:text-gray-300">{road.summary}</span>
          {road.max_speed_mph ? <span className="font-bold text-gray-400">~{road.max_speed_mph} mph nearby</span> : null}
        </div>
      )}
      {road?.summary && (
        <p className="mt-1 text-[10px] font-medium text-gray-400">Street read from OpenStreetMap road data — a strong hint, not a noise measurement.</p>
      )}
    </div>
  )
}

// Same pop-open, click-to-zoom pattern as the Showcases property detail view
// (components/PropertyDetailsModal.tsx) - photo + filmstrip picture-selector below it, then the
// full fact set - a lighter version scoped to what a CMA comp actually has.
function PropertyPopupModal({ open, onClose, data, onPrev, onNext, compAdded, onToggleComp }: {
  open: boolean, onClose: () => void, data: PropertyPopupData | null, onPrev?: () => void, onNext?: () => void
  /** Comps step: whether this home is one of the report's comps, and the add / remove toggle. */
  compAdded?: boolean, onToggleComp?: () => void
}) {
  const [index, setIndex] = useState(0)
  // Toggled by the mini map button next to the photo counter - swaps the photo area for an
  // interactive Google map of THIS property's location, stays open until toggled back.
  const [showMap, setShowMap] = useState(false)
  useEffect(() => { if (open) { setIndex(0); setShowMap(false) } }, [open, data])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (data && data.photos.length > 1) {
        if (e.key === 'ArrowRight') setIndex(i => (i + 1) % data.photos.length)
        if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + data.photos.length) % data.photos.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, data])

  if (!open || !data) return null
  const pics = data.photos.length > 0 ? data.photos : []
  const hasGeo = typeof data.lat === 'number' && typeof data.lng === 'number'

  // Portaled straight to document.body - this modal is opened from deep inside the page (the
  // Comps tab AND the Analysis tab), both nested under ancestors that get an active CSS
  // `transform` at various points (animate-step-in on step switch, hover/scale utilities
  // elsewhere). Any ancestor with a transform becomes the containing block for a `position:
  // fixed` descendant, which silently repositions this overlay relative to that ancestor's box
  // instead of the viewport - it opened, just far down the page instead of centered. Portaling
  // escapes the whole ancestor chain so `fixed inset-0` is always relative to the real viewport.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      {/* Step between properties (map/list order) - shown only when the opener wired handlers. */}
      {onPrev && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onPrev() }}
          aria-label="Previous home"
          title="Previous home"
          className="absolute left-1 top-1/2 z-[101] flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl bg-[#C9A24D] px-1.5 py-2.5 text-[#111827] shadow-xl shadow-black/40 ring-2 ring-white/70 transition hover:-translate-x-0.5 hover:bg-[#e0b85f] sm:left-4 sm:px-2.5 sm:py-3 lg:left-[calc(50%-24rem-5rem)]"
        >
          <ChevronsLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden text-[9px] font-black uppercase tracking-wide sm:block">Prev home</span>
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onNext() }}
          aria-label="Next home"
          title="Next home"
          className="absolute right-1 top-1/2 z-[101] flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl bg-[#C9A24D] px-1.5 py-2.5 text-[#111827] shadow-xl shadow-black/40 ring-2 ring-white/70 transition hover:translate-x-0.5 hover:bg-[#e0b85f] sm:right-4 sm:px-2.5 sm:py-3 lg:right-[calc(50%-24rem-5rem)]"
        >
          <ChevronsRight className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden text-[9px] font-black uppercase tracking-wide sm:block">Next home</span>
        </button>
      )}
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
        {/* ONE scroll region for the whole modal - photo, filmstrip and details scroll together.
            Previously the photo/filmstrip sat in their own non-scrolling box, so the scrollbar
            started below them and left a dead gutter ("black bar") beside the photo. */}
        <div className="flex-1 overflow-y-auto">
          {/* aspect-[4/3] matches real MLS photo proportions - a fixed short/wide box was forcing
              heavy object-cover crops that read as "zoomed in" and too wide. */}
          {/* overflow-hidden + rounded-t-3xl here (not just on the modal) so the photo's OWN top
              corners are clipped flush on BOTH sides - the .cma-comp-photo scale animation could
              otherwise bleed a square top-right corner past the modal's rounding. */}
          <div className="relative aspect-[4/3] max-h-[420px] w-full overflow-hidden rounded-t-3xl bg-gray-100 dark:bg-gray-800">
            {hasGeo && showMap ? (
              <iframe
                title={data.address ? `Map of ${data.address}` : 'Property location'}
                src={`https://www.google.com/maps?q=${data.lat},${data.lng}&z=18&t=h&output=embed`}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : pics.length > 0 ? (
              // key={index} replays the same instant-switch/slight-zoom animation (.cma-comp-photo,
              // globals.css) used on the public report, on open and on every arrow/thumbnail
              // switch - was a plain abrupt src swap before.
              <img key={index} src={normalizeImageUrl(pics[index])} alt="" className="cma-comp-photo h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Home className="h-10 w-10 text-gray-300" /></div>
            )}
            {!showMap && data.status && (
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[data.status] || 'bg-gray-800'}`}>
                {COMP_STATUS_LABEL[data.status] || data.status}
              </span>
            )}
            {!showMap && typeof data.matchScore === 'number' && (
              <span className="absolute bottom-3 left-3 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg">{data.matchScore}% Match</span>
            )}
            {!showMap && pics.length > 1 && (
              <>
                <button onClick={() => setIndex(i => (i - 1 + pics.length) % pics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => setIndex(i => (i + 1) % pics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
            {/* Comps step: is it one of the report's comps - and add / remove it right here. */}
            {onToggleComp && (
              <button
                type="button"
                onClick={onToggleComp}
                className={`absolute bottom-3 left-1/2 z-[2] inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide shadow-lg transition active:scale-95 ${compAdded ? 'bg-emerald-600 text-white ring-2 ring-white/80' : 'bg-white text-[#111827] ring-2 ring-[#C9A24D] hover:bg-[#fffaf0]'}`}
              >
                {compAdded ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> In your comps</> : <><Plus className="h-3.5 w-3.5" strokeWidth={3} /> Add as comp</>}
              </button>
            )}
            {/* bottom-right cluster: the open-map BUTTON (white, so it reads as tappable), then the
                photo counter (dark, just information) */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              {hasGeo && (
                <button
                  type="button"
                  onClick={() => setShowMap(v => !v)}
                  aria-label={showMap ? 'Back to photos' : 'Open location map'}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] shadow-md ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:bg-[#fffaf0] active:scale-95"
                >
                  {showMap ? <><ImageIcon className="h-3.5 w-3.5 text-[#C9A24D]" /> Photos</> : <><MapPin className="h-3.5 w-3.5 text-[#C9A24D]" /> Map</>}
                </button>
              )}
              {!showMap && pics.length > 1 && (
                <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">{index + 1} / {pics.length}</span>
              )}
            </div>
          </div>

          {/* Picture selector filmstrip, same treatment as Showcases - borderless now that it's
              part of the same scroll flow as the details below it. */}
          {!showMap && pics.length > 1 && (
            <div className="flex items-center gap-2 bg-white p-2.5 dark:bg-[#151517]">
              <button onClick={() => setIndex(i => (i - 1 + pics.length) % pics.length)} className="hidden shrink-0 rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] sm:block"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <div className="scrollbar-hide flex flex-1 gap-1.5 overflow-x-auto">
                {pics.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index ? 'border-[#C9A24D]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={normalizeImageUrl(p)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button onClick={() => setIndex(i => (i + 1) % pics.length)} className="hidden shrink-0 rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] sm:block"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#111827] dark:text-white">{data.address}</p>
              {data.cityState && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{data.cityState}</p>}
            </div>
            {data.price != null && (
              <div className="shrink-0 text-right">
                <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(data.price)}</p>
                {/* The status badge on the photo + the "Sold" date chip already say it's a closed
                    sale, so a "Closed price" label here was redundant and just added a line. Keep
                    only the $/sqft, folded onto one line. */}
                {!!data.pricePerSqft && <p className="text-[9px] font-bold text-gray-400">${data.pricePerSqft}/sqft</p>}
              </div>
            )}
          </div>
          {/* Same fact-chip treatment as the Analysis step's side-by-side comparison, so a comp
              looks like the same property whether you're eyeing it here or lining it up against
              the subject later. Distance already lives in data.facts as a normal chip, so the old
              standalone "X miles..." line above was pure duplication - removed. School district
              flows in as a normal grid cell instead of breaking out onto its own full-width
              strip. Every tile's span is driven by how long its own value actually is (chipSpan)
              - a short "3" stays one tile, "Full, Finished, Walkout" or a long district name
              claims 2-3 - and grid-flow-row-dense backfills the gaps that leaves with whatever
              shorter tile comes next, so nothing wastes a line the way a fixed-width layout does.
              The side-by-side comparison's own compact grid uses the same dynamicSpan treatment
              for its Basement/School tiles, just at a smaller `compact` size. */}
          <div className="mt-4 grid grid-flow-row-dense grid-cols-3 gap-2 sm:grid-cols-4">
            {data.facts.map((f, i) => (
              <CmaFactChip key={i} icon={f.icon} value={f.value} label={f.label} dynamicSpan={!f.fixedSpan} secondary={f.secondary}
                className={f.label === 'Basement' ? 'max-sm:!col-span-full' : ''} />
            ))}
            {data.schoolDistrict && (
              <div
                className="relative flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-center dark:border-gray-800 dark:bg-[#0B0B0B] max-sm:!col-span-full"
                style={{ gridColumn: `span ${chipSpan(data.schoolDistrict)} / span ${chipSpan(data.schoolDistrict)}` }}
              >
                {data.sameSchool && (
                  <span title="Same school district as the subject property" className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <GraduationCap className="h-3.5 w-3.5 text-[#C9A24D]" />
                <span className={`max-w-full truncate px-2 font-black leading-tight text-[#111827] dark:text-white ${chipValueTextClass(data.schoolDistrict || '')}`} title={data.schoolDistrict}>{data.schoolDistrict}</span>
                <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">School</span>
              </div>
            )}
          </div>
          {data.description && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Description</p>
              <p className="text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-400">{data.description}</p>
            </div>
          )}
          {/* The full location map lives behind the map button on the photo now - keep only the
              street/road read here (it's data the photo toggle doesn't show). */}
          {data.roadContext?.summary && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-[11px] dark:border-gray-800">
              {ROAD_VERDICT_STYLE[data.roadContext.verdict] && (
                <span className={`rounded-full px-2 py-0.5 font-black uppercase tracking-wide ${ROAD_VERDICT_STYLE[data.roadContext.verdict].cls}`}>{ROAD_VERDICT_STYLE[data.roadContext.verdict].label}</span>
              )}
              <span className="font-semibold text-gray-600 dark:text-gray-300">{data.roadContext.summary}</span>
              {data.roadContext.max_speed_mph ? <span className="font-bold text-gray-400">~{data.roadContext.max_speed_mph} mph nearby</span> : null}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ============================================================================
// Step 3: Analysis - reorder, side-by-side table, quality/strength/commentary, metrics, charts
// ============================================================================

// Every option's LABEL states the direction explicitly (not just "Below"/"Above") - the value
// stored is always "how does the COMP compare to the SUBJECT" (e.g. 'above' = comp is nicer than
// subject), but that direction is genuinely ambiguous from a bare "Below/Above" button with
// nothing to anchor it to. Confirmed real user confusion over this - fixed here instead of
// relying on a caption someone has to go read first.
// finish_quality now shares the same 3-tier scale as every other dimension (interior/exterior/
// lot/amenities/layout) - a 5-tier "well below/well above" scale was more choice than the AI (or
// an agent) could reliably and consistently judge.
const QUALITY_3: { value: string, label: string }[] = [
  { value: 'below', label: 'Comp Inferior' },
  { value: 'similar', label: 'Similar' },
  { value: 'above', label: 'Comp Superior' },
]
// A factual school-district/city comparison, not a value judgment - deliberately no "better/
// worse" language (that used to live here as 'location': inferior/similar/superior).
// Same_as_subject sits in the middle (green) like "similar" does for every other quality
// dimension - an exact match is the best outcome, with different_from_subject/similar_to_subject
// flanking it as the two "not an exact match" ends (both red). See AREA_TIERS in lib/cma.ts.
const AREA_3: { value: string, label: string }[] = [
  { value: 'different_from_subject', label: 'Different from Subject' },
  { value: 'same_as_subject', label: 'Same as Subject' },
  { value: 'similar_to_subject', label: 'Similar to Subject' },
]
// Three classifications only: Weaker | Strong | Supporting, with Strong in the MIDDLE (it's the
// green "best" position, matching the quality-row scales below it). Weaker on the left, Supporting
// on the right. Only the selected button shows its colour (weak=red, strong=green, supporting=gold);
// the other two stay neutral grey. A Weaker comp still appears in the report but carries ZERO
// weight in the number.
const STRENGTH_OPTIONS: { value: CmaCompStrength, label: string }[] = [
  { value: 'weak', label: 'Weaker' },
  { value: 'strong', label: 'Strong' },
  { value: 'supporting', label: 'Supporting' },
]

// Every comp must have a Comp Weight AND all eight comparison dimensions rated before the agent
// can leave the Analysis step - a client valuation shouldn't go out with a blank cell, and the
// deterministic backend now sometimes deliberately CLEARS a rating it can't verify (e.g. an
// amenities "similar" it couldn't confirm), which is precisely a decision the agent must make.
const REQUIRED_QUALITY_KEYS: { key: keyof CmaQualityAssessment, label: string }[] = [
  { key: 'finish_quality', label: 'Finish' },
  { key: 'interior', label: 'Interior' },
  { key: 'exterior', label: 'Exterior' },
  { key: 'lot', label: 'Lot' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'layout', label: 'Layout' },
  { key: 'area', label: 'Area' },
  { key: 'street_context', label: 'Street' },
]
function compAnalysisMissing(comp: CmaComparable): string[] {
  const missing: string[] = []
  if (!comp.strength) missing.push('Comp Weight')
  const q = comp.quality || {}
  for (const { key, label } of REQUIRED_QUALITY_KEYS) {
    if (!q[key]) missing.push(label)
  }
  return missing
}

function normalizeAnalysisComparables(comparables: CmaComparable[]) {
  return sortComparables(comparables).map(comp => ({
    ...comp,
    commentary: comp.commentary || comp.ai_commentary || null,
  }))
}

// Builds the same PropertyPopupData shape CompsStep's popup uses, from an already-added subject/
// comp instead of a raw search candidate - lets the Analysis tab open the identical property-
// detail popup (photo + fact grid) when a photo is clicked, without duplicating CompsStep's own
// candidate-search-specific version of this.
function buildAnalysisPopupData(kind: 'subject' | 'comp', subject: CmaSubjectProperty, comp: CmaComparable | null, subjectRoadContext?: CmaRoadContext | null): PropertyPopupData {
  if (kind === 'subject' || !comp) {
    const subjectAcres = subject.lot_size ? sqftToAcres(subject.lot_size) : null
    const subjectBasement = basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area)
    return {
      photos: subject.photos && subject.photos.length > 0 ? subject.photos : (subject.photo_url ? [subject.photo_url] : []),
      address: subject.street_address || 'Subject Property',
      cityState: [subject.city, subject.state].filter(Boolean).join(', '),
      price: subject.list_price,
      priceLabel: 'List Price',
      pricePerSqft: pricePerSqft(subject.list_price, subject.sqft),
      status: null,
      matchScore: null,
      distanceMiles: null,
      sameSchool: false,
      facts: [
        { icon: Bed, label: 'Beds', value: subject.beds ?? '-', fixedSpan: false },
        { icon: Bath, label: 'Baths', value: subject.baths ?? '-', fixedSpan: false },
        { icon: Ruler, ...sqftChipProps(subject.sqft), fixedSpan: false },
        { icon: LandPlot, label: 'Acres', value: subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-', fixedSpan: false },
        { icon: Building2, label: 'Built', value: subject.year_built ?? '-', fixedSpan: false },
        { icon: Calendar, label: 'DOM', value: subject.days_on_market ?? '-', fixedSpan: false },
        { icon: DollarSign, label: 'Taxes', value: subject.annual_taxes ? formatMoney(subject.annual_taxes) : '-', fixedSpan: true },
        { icon: Droplets, label: 'Water', value: formatUtilityValue(subject.water_source), fixedSpan: false },
        { icon: Waves, label: 'Sewer', value: formatUtilityValue(subject.sewer), fixedSpan: true },
        ...(subject.garage ? [{ icon: Car, label: 'Garage', value: subject.garage, fixedSpan: false }] : []),
        ...(subjectBasement ? [{ icon: Layers, label: 'Basement', value: subjectBasement, fixedSpan: false }] : []),
      ],
      schoolDistrict: subject.school_district,
      description: subject.public_remarks || null,
      lat: subject.latitude ?? null,
      lng: subject.longitude ?? null,
      roadContext: subjectRoadContext ?? null,
    }
  }
  const psf = comp.price_per_sqft ?? pricePerSqft(comp.sale_price ?? comp.list_price, comp.sqft)
  const compBasement = basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area)
  return {
    photos: comp.photos && comp.photos.length > 0 ? comp.photos : (comp.photo_url ? [comp.photo_url] : []),
    address: comp.street_address || 'Comparable Property',
    cityState: [comp.city, comp.state].filter(Boolean).join(', '),
    price: comp.sale_price ?? comp.list_price,
    priceLabel: comp.sale_price ? 'Sale Price' : 'List Price',
    pricePerSqft: psf,
    status: comp.status,
    matchScore: typeof comp.match_score === 'number' ? comp.match_score : null,
    distanceMiles: comp.distance_miles,
    sameSchool: !!(comp.school_district && subject.school_district && comp.school_district === subject.school_district),
    facts: [
      { icon: Bed, label: 'Beds', value: comp.beds ?? '-', fixedSpan: false },
      { icon: Bath, label: 'Baths', value: comp.baths ?? '-', fixedSpan: false },
      { icon: Ruler, ...sqftChipProps(comp.sqft), fixedSpan: false },
      { icon: LandPlot, label: 'Acres', value: comp.lot_size ? sqftToAcres(comp.lot_size).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-', fixedSpan: false },
      { icon: Building2, label: 'Built', value: comp.year_built ?? '-', fixedSpan: false },
      { icon: Calendar, label: 'DOM', value: comp.days_on_market ?? '-', fixedSpan: false },
      { icon: DollarSign, label: 'Taxes', value: comp.annual_taxes ? formatMoney(comp.annual_taxes) : '-', fixedSpan: true },
      { icon: MapPin, label: 'Distance', value: comp.distance_miles != null ? `${comp.distance_miles} mi` : '-', fixedSpan: true },
      { icon: Droplets, label: 'Water', value: formatUtilityValue(comp.water_source), fixedSpan: false },
      { icon: Waves, label: 'Sewer', value: formatUtilityValue(comp.sewer), fixedSpan: true },
      ...(comp.sale_date ? [{ icon: Calendar, label: 'Sold', value: formatDate(comp.sale_date), fixedSpan: true }] : []),
      ...(comp.garage ? [{ icon: Car, label: 'Garage', value: comp.garage, fixedSpan: false }] : []),
      ...(compBasement ? [{ icon: Layers, label: 'Basement', value: compBasement, fixedSpan: false }] : []),
    ],
    schoolDistrict: comp.school_district,
    description: comp.public_remarks || null,
    lat: comp.latitude ?? null,
    lng: comp.longitude ?? null,
    roadContext: comp.road_context ?? null,
  }
}

function AnalysisStep({ report, onSave, onReportUpdated, onNext }: {
  report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>,
  onReportUpdated: (r: CmaReport) => void, onNext: () => void,
}) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(() => normalizeAnalysisComparables(report.comparables))
  const [activeId, setActiveId] = useState<string | null>(() => normalizeAnalysisComparables(report.comparables)[0]?.id || null)
  const [popup, setPopup] = useState<{ kind: 'subject' | 'comp' } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [progressElapsedSec, setProgressElapsedSec] = useState(0)
  // Which comp (1-based position in the rail) the AI is "scanning" right now during generation.
  // -1 = not generating. Drives the per-comp scan line + done checkmarks in CompOrderRail.
  const [scanStage, setScanStage] = useState(-1)
  // Belt-and-suspenders alongside hasCompleteAi (derived from the `report` prop below) - this
  // flips the instant a generation actually completes, so the button swaps to "used" right in
  // this same render pass instead of depending on the parent's setReport -> re-render round trip
  // landing before the user looks back at the button.
  const [justGenerated, setJustGenerated] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  // Holds the staged-progress interval id so it's always cleared if this step unmounts mid-run
  // (e.g. the agent leaves the whole CMA while a generation is going), not just on the happy path.
  const genIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => {
    if (genIntervalRef.current) clearInterval(genIntervalRef.current)
    if (resumePollRef.current) clearInterval(resumePollRef.current)
  }, [])

  // Re-seed local comps from the server ONLY when a genuinely different report is shown (switching
  // CMAs). It must NOT depend on report.comparables: every silent per-field save echoes back a
  // fresh comparables array, and re-seeding on that mid-edit is what made the page "glitch" - it
  // clobbered the non-destructive merges in handleGenerate/handleRecompute and could revert a
  // keystroke whose save was still in flight, which then re-saved (the autosave-loop the user saw).
  // The useState initializer already seeds the first mount; handlers own local state after that.
  const seededReportId = useRef(report.id)
  useEffect(() => {
    if (seededReportId.current === report.id) return
    seededReportId.current = report.id
    setComparables(normalizeAnalysisComparables(report.comparables))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])
  useEffect(() => {
    if (!comparables.some(c => c.id === activeId)) setActiveId(comparables[0]?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparables])

  // Merges the AI's per-comp results into the local comparables copy (rather than replacing it
  // wholesale from the server response) so any commentary the agent already typed this session,
  // but hasn't hit Save on yet, is never lost by a generation running mid-edit. Strength/quality
  // are safe to copy straight over - the server only ever fills those in where the agent hadn't
  // already picked something, so this can't clobber a manual choice.
  // Real progress isn't available (one blocking API call, not a stream) - this simulates staged
  // movement through what the backend is actually doing. The final reasoning call gets the
  // longest part of the timeline so the bar does not race ahead and then look frozen while
  // OpenHousePal AI is still reconciling the valuation. Caps below 100% until the real response
  // lands. `startedAtMs` is a parameter (not always Date.now()) so a generation resumed after
  // navigating away and back can seed this from the server's real start time instead of
  // restarting the animation from 0%.
  const startProgressSimulation = (startedAtMs: number) => {
    const includedNow = comparables.filter(c => c.is_included)
    const stagedCompCount = Math.min(includedNow.length, MAX_COMPS)
    const subjectMs = 4_000
    const perCompMs = 4_000
    const compReviewEnd = subjectMs + stagedCompCount * perCompMs
    const marketReviewEnd = compReviewEnd + 9_000
    const benchmarkEnd = marketReviewEnd + 8_000
    const reasoningEnd = benchmarkEnd + 150_000
    let lastActiveCompIndex = -1

    const updateProgress = () => {
      const elapsedMs = Date.now() - startedAtMs
      setProgressElapsedSec(Math.floor(elapsedMs / 1000))

      let pct = 3
      let label = 'Reading subject property photos and data...'
      let nextScanStage = 0

      if (elapsedMs < subjectMs) {
        pct = 3 + (elapsedMs / subjectMs) * 7
      } else if (stagedCompCount > 0 && elapsedMs < compReviewEnd) {
        const compElapsed = elapsedMs - subjectMs
        const compIndex = Math.min(stagedCompCount - 1, Math.floor(compElapsed / perCompMs))
        const compFraction = (compElapsed - compIndex * perCompMs) / perCompMs
        pct = 10 + ((compIndex + compFraction) / stagedCompCount) * 38
        label = `Reviewing comparable ${compIndex + 1} of ${stagedCompCount}...`
        nextScanStage = compIndex + 1
        if (compIndex !== lastActiveCompIndex) {
          lastActiveCompIndex = compIndex
          const comp = includedNow[compIndex]
          if (comp) setActiveId(comp.id)
        }
      } else if (elapsedMs < marketReviewEnd) {
        pct = 48 + ((elapsedMs - compReviewEnd) / 9_000) * 13
        label = 'Comparing condition, size, and market evidence...'
        nextScanStage = stagedCompCount + 1
      } else if (elapsedMs < benchmarkEnd) {
        pct = 61 + ((elapsedMs - marketReviewEnd) / 8_000) * 9
        label = 'Reconciling comp roles and valuation benchmarks...'
        nextScanStage = stagedCompCount + 1
      } else if (elapsedMs < reasoningEnd) {
        const reasoningElapsedMs = elapsedMs - benchmarkEnd
        pct = 70 + (reasoningElapsedMs / 150_000) * 19
        label = 'OpenHousePal AI is finalizing the valuation...'
        nextScanStage = stagedCompCount + 1
      } else {
        const finalCheckMs = elapsedMs - reasoningEnd
        pct = 89 + 7 * (1 - Math.exp(-finalCheckMs / 25_000))
        label = 'Checking valuation language and report consistency...'
        nextScanStage = stagedCompCount + 1
      }

      setProgressLabel(label)
      setProgressPct(Math.min(96, Math.round(pct)))
      setScanStage(nextScanStage)
    }

    updateProgress()
    const interval = setInterval(updateProgress, 500)
    genIntervalRef.current = interval
  }

  const stopProgressSimulation = () => {
    if (genIntervalRef.current) { clearInterval(genIntervalRef.current); genIntervalRef.current = null }
    setProgressPct(100)
    setProgressLabel('Done')
    setScanStage(-1)
    setGenerating(false)
  }

  // Merges a freshly generated/completed report into local state - shared by the normal
  // click-and-wait path (handleGenerate) and the resumed-after-navigating-away path below, which
  // detects completion by polling rather than by awaiting the original request.
  const applyGeneratedReport = (updated: CmaReport, opts?: { silent?: boolean }) => {
    const byId = new Map(updated.comparables.map(c => [c.id, c]))
    // Take the freshly generated comp wholesale (u) rather than whitelisting individual computed
    // fields - the backend computes/updates more than just strength/quality/match score (e.g.
    // valuation_weight, valuation_role, ai_strength, strong_location_override), and any one of
    // those left stale here gets written straight back to the server by the autosave effect a
    // moment later, which makes the freshly generated report look "changed since final QA" and
    // forces a slow, unnecessary recompute the instant the agent tries to finish. Only the
    // handful of fields the agent controls directly in this step's UI - not something the AI
    // pipeline touches - are preserved from local state; commentary additionally falls back to
    // the AI's note only when the agent hasn't written their own yet (the textarea's "AI
    // Generated" marker tracks that same verbatim match and disappears the moment it's edited).
    setComparables(cs => cs.map(c => {
      const u = byId.get(c.id)
      if (!u) return c
      return { ...u, is_included: c.is_included, override_reason: c.override_reason, order_index: c.order_index, commentary: c.commentary || u.ai_commentary }
    }))
    onReportUpdated(updated)
    const completed = hasCompletedAiAnalysis(updated)
    if (completed) setJustGenerated(true)
    if (!opts?.silent) {
      showToast(
        completed
          ? 'AI analysis generated'
          : 'AI saved the comp notes but did not finish pricing. Click Create AI Analysis again to finish pricing.',
        completed ? 'success' : 'error'
      )
    }
    return completed
  }

  // The run happens on the server in the background (user, 10/17): this asks it to start, then
  // checks every few seconds until it's done - so a dropped connection, a locked phone or leaving
  // the page can never turn a finished report into "Network error". If even the start request is
  // lost, the report itself says whether it's running.
  const [genError, setGenError] = useState<string | null>(null)
  const [aiEstimate, setAiEstimate] = useState<{ percent: number | null; max_percent: number | null } | null>(null)
  useEffect(() => { api.cma.aiEstimate().then(r => { if (r.success && r.data) setAiEstimate(r.data) }) }, [])
  const pollUntilDone = () => {
    if (resumePollRef.current) clearInterval(resumePollRef.current)
    let misses = 0
    resumePollRef.current = setInterval(async () => {
      const polled = await api.cma.get(report.id)
      if (!polled.success || !polled.data) { if (++misses > 45) finish(null, 'We lost touch with the server - refresh to see if it finished.'); return }
      misses = 0
      if (polled.data.generation_status === 'generating') return
      finish(polled.data, polled.data.generation_status === 'complete' ? null : (polled.data.generation_error || "The AI analysis didn't finish - please try again."))
    }, 4000)
    const finish = (data: CmaReport | null, error: string | null) => {
      if (resumePollRef.current) { clearInterval(resumePollRef.current); resumePollRef.current = null }
      stopProgressSimulation()
      if (data && !error) { applyGeneratedReport(data); setGenError(null) }
      else {
        if (data) onReportUpdated(data)
        setGenError(error)
        showToast(error || "The AI analysis didn't finish - please try again.", 'error')
      }
    }
  }
  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    setJustGenerated(false)
    startProgressSimulation(Date.now())
    const response = await api.cma.generateAiAnalysis(report.id, { force_regenerate: false, include_map_images: true, background: true })
    if (!response.success && (response.status === 429 || response.status === 403 || response.status === 404)) {
      stopProgressSimulation()
      setGenError(response.error || 'Could not start the AI analysis.')
      showToast(response.error || 'Could not start the AI analysis.', 'error')
      return
    }
    // Started (or the answer got lost on the way back) - either way, follow the report itself.
    pollUntilDone()
  }

  // The generation request keeps running server-side regardless of whether this page is open -
  // it's one long backend call, not tied to this component's lifetime. If the report loads
  // already marked 'generating' (the agent started it, navigated away, and came back - or never
  // left, but this component remounted for some other reason), resume the same progress
  // animation, seeded from the real server start time, and poll for the server-side result
  // instead of leaving the page looking idle until a manual refresh.
  useEffect(() => {
    if (report.generation_status !== 'generating' || generating) return
    setGenerating(true)
    const startedAtMs = report.generation_started_at ? new Date(report.generation_started_at).getTime() : Date.now()
    startProgressSimulation(startedAtMs)
    pollUntilDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, report.generation_status])
  // Came back to a run that failed while away: say why on the button's card.
  useEffect(() => {
    if (report.generation_status === 'failed' && report.generation_error && !generating) setGenError(report.generation_error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])

  // Re-runs the deterministic evidence/confidence/value-drivers pipeline plus one lightweight
  // (no-photo) AI call, so the value/methodology stay consistent with any strength reclassification
  // or Mark Irrelevant override made since the last generation - see recompute-valuation endpoint.
  // No photo re-analysis, no comp notes rewritten - same non-destructive merge as handleGenerate.
  const handleRecompute = async () => {
    setRecomputing(true)
    const response = await api.cma.recomputeValuation(report.id)
    setRecomputing(false)
    if (response.success && response.data) {
      const updated = response.data
      const byId = new Map(updated.comparables.map(c => [c.id, c]))
      // See handleGenerate above - take the recomputed comp wholesale so no backend-owned field is
      // ever left stale here to get autosaved right back over the fresh result.
      setComparables(cs => cs.map(c => {
        const u = byId.get(c.id)
        if (!u) return c
        return { ...u, is_included: c.is_included, override_reason: c.override_reason, order_index: c.order_index, commentary: c.commentary }
      }))
      onReportUpdated(updated)
      showToast('Valuation recomputed from your current comp set.', 'success')
    } else {
      showToast(response.error || 'Could not recompute the valuation.', 'error')
    }
  }

  const active = comparables.find(c => c.id === activeId) || comparables[0] || null
  const activeIndex = active ? comparables.findIndex(c => c.id === active.id) : -1

  const included = useMemo(() => comparables.filter(c => c.is_included), [comparables])
  const hasCompleteAi = hasCompletedAiAnalysis(report) || justGenerated

  const reorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setComparables(cs => {
      const next = [...cs]
      const fromIndex = next.findIndex(c => c.id === draggedId)
      const toIndex = next.findIndex(c => c.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return cs
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next.map((c, i) => ({ ...c, order_index: i }))
    })
  }

  // Debounced from the handler itself (not a separate watch-all-of-`comparables` effect) so this
  // doesn't also re-fire on every discrete click below, which already saves immediately on its
  // own - this is specifically for the commentary textarea, where saving per-keystroke would spam
  // the server. Computes `next` outside setState for the same reason updateStrength does below.
  const commentarySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (commentarySaveTimer.current) clearTimeout(commentarySaveTimer.current) }, [])
  const updateComp = (id: string, patch: Partial<CmaComparable>) => {
    const next = comparables.map(c => c.id === id ? { ...c, ...patch } : c)
    setComparables(next)
    if (commentarySaveTimer.current) clearTimeout(commentarySaveTimer.current)
    commentarySaveTimer.current = setTimeout(() => { onSave({ comparables: next }, { silent: true }) }, 700)
  }

  // Discrete single-click choices (Comp Weight, each quality dimension, including street_context/
  // area) auto-save immediately instead of waiting for the agent to hit Save/Continue - unlike
  // updateComp above (only used for the commentary textarea now, where saving on every keystroke
  // would spam the server). These run from click handlers, so the `comparables` closure is
  // current for this render - compute `next` from it, then setState + save OUTSIDE the updater.
  // (Calling onSave inside a setState updater fires a parent setState during React's render
  // phase -> "Cannot update a component while rendering a different component".)
  const updateStrength = (id: string, value: string) => {
    const next = comparables.map(c => c.id === id ? { ...c, strength: value as CmaCompStrength } : c)
    setComparables(next)
    onSave({ comparables: next }, { silent: true })
  }

  const updateQuality = (id: string, key: keyof CmaQualityAssessment, value: string) => {
    const next = comparables.map(c => c.id === id ? { ...c, quality: { ...c.quality, [key]: value } } : c)
    setComparables(next)
    onSave({ comparables: next }, { silent: true })
  }

  // Every comp must be fully rated (Comp Weight + all 8 dimensions) before Pricing. The warning
  // banner only appears AFTER a blocked Continue click (it was eating a lot of vertical space
  // sitting there permanently), and clears itself once everything's filled.
  const incompleteComps = useMemo(
    () => comparables
      .map((c, i) => ({ i, id: c.id, missing: compAnalysisMissing(c) }))
      .filter(x => x.missing.length > 0),
    [comparables],
  )
  const [continueBlocked, setContinueBlocked] = useState(false)
  useEffect(() => { if (incompleteComps.length === 0) setContinueBlocked(false) }, [incompleteComps.length])
  // Bumped only when a validation message jumps the agent to a specific comp - tells
  // SideBySidePanel to scroll that comp's "Compared With the Subject" block into view and flash
  // it. Plain Prev/Next and generate-time cycling never touch this.
  const [compareFocusSignal, setCompareFocusSignal] = useState(0)

  const handleContinue = async () => {
    if (incompleteComps.length > 0) {
      const first = incompleteComps[0]
      setActiveId(first.id)
      setCompareFocusSignal(n => n + 1)
      setContinueBlocked(true)
      showToast(
        `Comp #${first.i + 1} still needs: ${first.missing.join(', ')}. Fill in every comparison field before pricing.`,
        'error',
      )
      return
    }
    // See SubjectStep's handleContinue - the next step reads fresh report data on mount, so this
    // must wait for the save instead of racing ahead of it.
    const saved = await onSave({ comparables })
    // Filling in these mandatory ratings is real, expected input the generation pass didn't see
    // (the AI deliberately leaves a dimension blank rather than guess at it) - saving it after
    // generation legitimately marks the stamped QA artifact stale. Re-verify right here, before the
    // agent ever reaches Pricing/Summary, so "final QA" reflects the actually-complete comp data
    // instead of flashing a "changed after final QA" notice for what is normal, required workflow.
    if (saved && isStaleArtifactOnly(cmaQaBlocking(saved))) {
      // Free re-stamp, not a paid recompute - nothing about the content needs re-checking here,
      // just the artifact hash catching up to this save.
      const response = await api.cma.resyncQa(saved.id)
      if (response.success && response.data) onReportUpdated(response.data)
    }
    onNext()
  }

  if (comparables.length === 0) {
    return (
      <SectionCard title="No comparables yet" subtitle="Head back to Find Comparables to add a few before analyzing.">
        <p className="text-sm font-semibold text-gray-400">Nothing to compare yet.</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-5">
      {hasCompleteAi ? (
        // Explicit "used" state rather than just removing the banner - a banner that silently
        // vanishes reads the same as "nothing happened" if the agent glances back a moment later,
        // especially since generation takes a while and they may not be looking right when it lands.
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
              <Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">AI Analysis Generated</p>
              <p className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/70">Comp ratings and a value estimate are filled in below - edit anything by hand as needed.</p>
            </div>
          </div>
          {/* Done is done - no re-run from here, just a finished AI-analysis bar. */}
          <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-56">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
              <div className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer-mini" />
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> Complete
            </span>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 bg-gradient-to-br from-[#C9A24D]/15 via-[#C9A24D]/5 to-transparent p-5 shadow-[0_0_40px_-12px_rgba(201,162,77,0.5)] dark:border-[#C9A24D]/40">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#C9A24D]/20 blur-3xl" />
          {/* The screenshot layout, locked in for BOTH states (idle "Generate AI Analysis" and the
              wider "Analyzing…"): heading left, AI-usage meter, button right, spread by
              justify-between. sm:flex-nowrap + the heading block's min-w-0 / clamped description
              keep it on ONE row - if space gets tight the description ellipsizes instead of the
              meter + button wrapping to a second line. */}
          {/* Phones (user, 10/17): title + what it does, then the usage meter, then one full-width
              button with what this run will use under it. Wide screens: one row, like before. */}
          <div className="relative grid grid-cols-1 gap-3 sm:flex sm:flex-nowrap sm:items-center sm:justify-between sm:gap-x-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C9A24D] shadow-lg shadow-[#C9A24D]/40">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">OpenHousePal AI</p>
                <p className="text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">Reads every comp's photos and data, rates strength/quality, and proposes a value estimate.</p>
              </div>
            </div>
            <MonthlyAiUsageMeter variant="inline" compact className="w-full shrink-0 sm:w-auto" refreshKey={generating ? 'gen' : 'idle'} />
            <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#C9A24D]/40 transition hover:shadow-xl hover:shadow-[#C9A24D]/50 disabled:opacity-70 sm:w-auto"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Analyzing…' : genError ? 'Try again' : 'Create AI Analysis'}
              </button>
              {!generating && aiEstimate?.percent != null && (
                <span className="text-center text-[10.5px] font-bold text-[#8b7355] dark:text-[#d7b974] sm:text-right">
                  Uses about {aiEstimate.percent < 1 ? '<1' : Math.round(aiEstimate.percent)}% of your monthly AI{aiEstimate.max_percent != null && aiEstimate.max_percent > (aiEstimate.percent || 0) + 0.5 ? ` (never over ${Math.round(aiEstimate.max_percent)}%)` : ''}
                </span>
              )}
            </div>
          </div>
          {genError && !generating && (
            <p className="relative mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {genError}
            </p>
          )}
          {generating && (
            <div className="relative mt-4">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-white/60 dark:bg-black/30"
                role="progressbar"
                aria-label={progressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-1.5 flex min-w-0 items-baseline justify-between gap-4 text-xs font-bold text-[#8b7355] dark:text-[#d7b974]">
                  <span className="min-w-0 truncate">{progressLabel}{progressPct >= 70 ? ' Final valuation and consistency checks are the longest part.' : ''}</span>
                  <span className="shrink-0 tabular-nums">
                    {progressPct}% | {Math.floor(progressElapsedSec / 60)}:{String(progressElapsedSec % 60).padStart(2, '0')}
                  </span>
              </div>
            </div>
          )}
        </div>
      )}

      {continueBlocked && incompleteComps.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
          <span className="inline-flex items-center gap-1.5 font-black text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" /> Finish rating each comp:
          </span>
          {incompleteComps.map(x => (
            <button
              key={x.id}
              onClick={() => { setActiveId(x.id); setCompareFocusSignal(n => n + 1) }}
              className="rounded-lg border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-black text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-300"
            >
              #{x.i + 1}: {x.missing.join(', ')}
            </button>
          ))}
        </div>
      )}

      <CompOrderRail
        comparables={comparables}
        activeId={active?.id || null}
        onSelect={setActiveId}
        onReorder={reorder}
        scanStage={generating ? scanStage : -1}
      />

      {active && (
        <SideBySidePanel
          subject={report.subject}
          comp={active}
          index={activeIndex}
          total={comparables.length}
          onUpdate={patch => updateComp(active.id, patch)}
          onUpdateStrength={value => updateStrength(active.id, value)}
          onUpdateQuality={(key, value) => updateQuality(active.id, key, value)}
          onPrev={() => setActiveId(comparables[Math.max(0, activeIndex - 1)]?.id || active.id)}
          onNext={() => setActiveId(comparables[Math.min(comparables.length - 1, activeIndex + 1)]?.id || active.id)}
          onContinueClick={handleContinue}
          onOpenSubjectDetails={() => setPopup({ kind: 'subject' })}
          onOpenCompDetails={() => setPopup({ kind: 'comp' })}
          focusSignal={compareFocusSignal}
        />
      )}

      <PropertyPopupModal
        open={!!popup}
        onClose={() => setPopup(null)}
        data={popup ? buildAnalysisPopupData(popup.kind, report.subject, active, report.pricing?.ai_estimate?.subject_road_context ?? null) : null}
      />

      <SectionCard title="Side-by-Side Comparison" subtitle="Major differences at a glance.">
        <ComparisonTable subject={report.subject} comparables={included} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Price Per Square Foot" subtitle="Low, middle, and high end of the comparable market.">
          <PsfChart subject={report.subject} comparables={included} />
        </SectionCard>
        <SectionCard title="Comparable Sale Prices" subtitle="Where the subject sits relative to the comp set.">
          <SalePriceChart subject={report.subject} comparables={included} />
        </SectionCard>
      </div>
    </div>
  )
}

function CompOrderRail({ comparables, activeId, onSelect, onReorder, scanStage = -1 }: {
  comparables: CmaComparable[], activeId: string | null, onSelect: (id: string) => void,
  onReorder: (draggedId: string, targetId: string) => void,
  // -1 = idle. Otherwise the 1-based rail position the AI analysis is scanning right now;
  // lower-positioned comps show a "done" check, this one shows the scan line.
  scanStage?: number,
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  return (
    <SectionCard title="Comparable Order" subtitle="Drag to reorder, or click one to compare it side-by-side with the subject.">
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1.5">
        {comparables.map((c, i) => {
          const isActive = c.id === activeId
          const scanning = scanStage >= 0 && scanStage === i + 1
          const scanned = scanStage >= 0 && scanStage > i + 1
          return (
            <button
              key={c.id}
              type="button"
              draggable
              onDragStart={() => setDraggedId(c.id)}
              onDragOver={event => {
                event.preventDefault()
                if (draggedId && draggedId !== c.id) onReorder(draggedId, c.id)
              }}
              onDragEnd={() => setDraggedId(null)}
              onClick={() => onSelect(c.id)}
              className={`group flex w-48 shrink-0 cursor-grab flex-col overflow-hidden rounded-2xl border-2 text-left shadow-sm transition active:cursor-grabbing ${
                isActive
                  ? 'border-[#C9A24D] shadow-md shadow-[#C9A24D]/20'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:hover:border-gray-600'
              } ${!c.is_included ? 'opacity-50' : ''}`}
            >
              <div className="relative overflow-hidden">
                {c.photo_url ? <img src={normalizeImageUrl(c.photo_url || undefined)} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 dark:bg-gray-800"><Home className="h-5 w-5 text-gray-300" /></div>}
                {scanning && <span className="ohp-comp-scan-line" />}
                {scanning && <span className="pointer-events-none absolute inset-0 bg-[#C9A24D]/10" />}
                {scanned && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"><Check className="h-4 w-4" strokeWidth={3} /></span>
                  </span>
                )}
                <span className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow ${isActive ? 'bg-[#C9A24D] text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{i + 1}</span>
                <GripVertical className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />
                {!c.is_included && (
                  <span title={c.override_reason || undefined} className="absolute left-1.5 top-7 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow">Irrelevant</span>
                )}
                {/* Same bottom-center city overlay pattern as OpenHouseCard.tsx - gradient,
                    MapPin icon, bold white uppercase text. */}
                {c.city && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1.5 pt-6">
                    <MapPin className="h-2.5 w-2.5 shrink-0 text-white" />
                    <span className="max-w-[80%] truncate text-[9px] font-black uppercase tracking-wide text-white">{c.city}</span>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{c.street_address}</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(c).value)}</p>
              </div>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

// Same hero-photo + arrows + thumbnail-filmstrip pattern as PropertyDetailsModal's "View Details"
// viewer, reused here so subject vs. comp photos behave consistently across the app - but with
// object-contain instead of that pattern's object-cover, since here the point is judging real
// condition/quality from the photo, so nothing should be cropped out of frame.
function PropertyPhotoCarousel({ resetKey, photos, fallbackUrl, onIndexChange, onPhotoClick }: { resetKey: string, photos?: string[] | null, fallbackUrl?: string | null, onIndexChange?: (index: number, total: number) => void, onPhotoClick?: () => void }) {
  const list = photos && photos.length ? photos : fallbackUrl ? [fallbackUrl] : []
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex(0) }, [resetKey])
  const safeIndex = Math.min(index, Math.max(list.length - 1, 0))
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    thumbRefs.current[safeIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [safeIndex, resetKey])
  // Lets the parent header line show the live "current / total" position instead of a static
  // photo count - PropertyPhotoCarousel still owns the index itself, this just reports it out.
  useEffect(() => { onIndexChange?.(safeIndex, list.length) }, [safeIndex, list.length, onIndexChange])

  if (list.length === 0) {
    return <div className="flex h-72 w-full items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800"><Home className="h-6 w-6 text-gray-300" /></div>
  }

  return (
    <div>
      {/* Fixed HEIGHT (not a fixed aspect ratio) so the subject and comp columns always line up
          row-for-row no matter what dimensions Bright happens to give a particular photo -
          object-contain still means nothing is ever cropped, it just can't grow past this height.
          The total photo count lives on the header line above (SideBySidePanel), not here, so
          there's no duplicate count competing with it. */}
      <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-[#0B0B0B]">
        {/* key={safeIndex} forces a remount on every photo change (arrow click or thumbnail
            select), which replays the same instant-switch/slight-zoom animation used on the
            public-facing report (.cma-comp-photo, globals.css) instead of an abrupt snap. */}
        <img
          key={safeIndex}
          src={normalizeImageUrl(list[safeIndex])}
          alt=""
          onClick={onPhotoClick}
          className={`cma-comp-photo h-full w-auto max-w-full object-contain ${onPhotoClick ? 'cursor-pointer' : ''}`}
        />
        {list.length > 1 && (
          <>
            {/* Arrows live on the photo itself now (not a separate row below it) - solid black so
                there's never a stray native mobile tap-highlight flash showing through, same as
                the "View Details" popup's overlay arrows. */}
            <button
              type="button"
              onClick={() => setIndex(i => (i - 1 + list.length) % list.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white outline-none [-webkit-tap-highlight-color:transparent] hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-[#C9A24D]"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex(i => (i + 1) % list.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white outline-none [-webkit-tap-highlight-color:transparent] hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-[#C9A24D]"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="scrollbar-hide mt-1.5 flex gap-1 overflow-x-auto scroll-smooth">
          {list.map((url, i) => (
            <button
              type="button"
              key={i}
              ref={el => { thumbRefs.current[i] = el }}
              onClick={() => setIndex(i)}
              className={`h-9 w-12 shrink-0 overflow-hidden rounded-lg border-2 outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-[#C9A24D] ${i === safeIndex ? 'border-[#C9A24D]' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={normalizeImageUrl(url)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Keyless Google Maps embed sized to match PropertyPhotoCarousel's fixed height, so a pane can
// swap cleanly between its photos and its location without the row jumping. Hybrid (satellite +
// road labels) at a tight zoom so the agent can read the actual lot shape and whether the home
// fronts a busy through-street vs. a quiet interior street.
function PaneMap({ lat, lng, label }: { lat: number, lng: number, label: string }) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-[#0B0B0B]">
      <iframe
        title={`Map of ${label}`}
        src={`https://www.google.com/maps?q=${lat},${lng}&z=18&t=h&output=embed`}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

function SideBySidePanel({ subject, comp, index, total, onUpdate, onUpdateStrength, onUpdateQuality, onPrev, onNext, onContinueClick, onOpenSubjectDetails, onOpenCompDetails, focusSignal = 0 }: {
  subject: CmaSubjectProperty, comp: CmaComparable, index: number, total: number, onUpdate: (p: Partial<CmaComparable>) => void,
  onUpdateStrength: (value: string) => void,
  onUpdateQuality: (key: keyof CmaQualityAssessment, value: string) => void,
  onPrev: () => void, onNext: () => void,
  onContinueClick: () => void,
  onOpenSubjectDetails: () => void, onOpenCompDetails: () => void,
  // Bumped by the parent ONLY when a validation message sends the agent to a specific comp
  // ("Finish rating each comp: #3…"). Plain Prev/Next navigation and the generate-time comp
  // cycling do NOT bump it, so those never yank the scroll position around.
  focusSignal?: number,
}) {
  const psf = comp.price_per_sqft ?? pricePerSqft(comp.sale_price ?? comp.list_price, comp.sqft)
  const subjectPsf = subject.list_price && subject.sqft ? pricePerSqft(subject.list_price, subject.sqft) : null
  // Live "current / total" position, reported up from each carousel as the agent flips through
  // photos (see PropertyPhotoCarousel's onIndexChange) - not just a static photo count.
  const [subjectPhotoPos, setSubjectPhotoPos] = useState({ index: 0, total: 0 })
  const [compPhotoPos, setCompPhotoPos] = useState({ index: 0, total: 0 })
  const onSubjectIndexChange = useCallback((i: number, t: number) => setSubjectPhotoPos({ index: i, total: t }), [])
  const onCompIndexChange = useCallback((i: number, t: number) => setCompPhotoPos({ index: i, total: t }), [])
  // Map toggle for BOTH panes (subject + comp). Deliberately NOT reset on comp change - the agent
  // flips through comps with the maps open to compare each comp's location against the subject and
  // the last comp; clicking the button again is the only thing that puts photos back.
  const [showMaps, setShowMaps] = useState(false)
  const compHasGeo = typeof comp.latitude === 'number' && typeof comp.longitude === 'number'
  const subjectHasGeo = typeof subject.latitude === 'number' && typeof subject.longitude === 'number'
  const [showIrrelevantForm, setShowIrrelevantForm] = useState(false)
  const [irrelevantReason, setIrrelevantReason] = useState('')
  useEffect(() => { setShowIrrelevantForm(false); setIrrelevantReason('') }, [comp.id])

  // ONLY when a validation message points the agent at a specific comp (focusSignal bump): bring
  // the "Comp #N — Compared With the Subject" block into view and pulse it, so it's obvious which
  // comp the message is about. Plain Prev/Next and the generate-time comp cycling leave the scroll
  // position alone. Still skips the scroll if the block is already comfortably on screen.
  const compareHeaderRef = useRef<HTMLDivElement>(null)
  const [compareFlash, setCompareFlash] = useState(false)
  useEffect(() => {
    if (!focusSignal) return
    const el = compareHeaderRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 64 || r.bottom > window.innerHeight - 24) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    setCompareFlash(true)
    const t = setTimeout(() => setCompareFlash(false), 1400)
    return () => clearTimeout(t)
  }, [focusSignal])

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]">
      {/* Grid instead of a two-way flex split, so the Prev/1-of-N/Next comp nav lands truly
          centered in the row (equal 1fr side columns) instead of stuck to the left next to the
          title with nothing balancing it on the right. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <p className="col-span-2 truncate text-base font-black text-[#111827] dark:text-white sm:col-span-1 sm:text-lg">Comparing Subject vs. Comp #{index + 1}</p>
        <div className="flex items-center justify-start gap-1 sm:justify-center">
          <button onClick={onPrev} disabled={index <= 0} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-1 text-[10px] font-black text-gray-400">{index + 1} / {total}</span>
          <button onClick={onNext} disabled={index >= total - 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-nowrap items-center justify-end gap-1.5 sm:flex-wrap sm:gap-2">
          {(compHasGeo || subjectHasGeo) && (
            <button
              type="button"
              onClick={() => setShowMaps(v => !v)}
              title={showMaps ? 'Back to photos on both panes' : 'Swap both panes to a map — stays on as you flip through comps so you can compare locations'}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-black uppercase tracking-wide transition sm:px-3.5 ${
                showMaps
                  ? 'border-[#C9A24D] bg-[#C9A24D] text-white shadow-sm shadow-[#C9A24D]/30'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:text-[#d7b974]'
              }`}
            >
              {showMaps ? <><ImageIcon className="h-3.5 w-3.5" /> Photos</> : <><MapPin className="h-3.5 w-3.5" /> Maps</>}
            </button>
          )}
          <button onClick={onContinueClick} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#111827] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] sm:px-4">
            <span className="sm:hidden">Pricing</span><span className="hidden sm:inline">Continue to Pricing</span> <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* Phones (user, 10/17): one head-to-head instead of two tall stacked panes - the two photos
          side by side, then every fact in one table with the subject and this comp next to each
          other, so the differences read at a glance without scrolling between them. */}
      <div className="sm:hidden">
        <div className="grid grid-cols-2 gap-2 p-3">
          {[{ who: 'Subject', addr: subject.street_address, geo: subjectHasGeo, lat: subject.latitude, lng: subject.longitude, photos: subject.photos, fallback: subject.photo_url, key: 'subject', open: onOpenSubjectDetails, onIdx: onSubjectIndexChange, pos: subjectPhotoPos },
            { who: `Comp #${index + 1}`, addr: comp.street_address, geo: compHasGeo, lat: comp.latitude, lng: comp.longitude, photos: comp.photos, fallback: comp.photo_url, key: comp.id, open: onOpenCompDetails, onIdx: onCompIndexChange, pos: compPhotoPos }].map(p => (
            <div key={p.who} className="min-w-0">
              <p className="mb-1 flex items-baseline justify-between gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                <span className="truncate">{p.who}</span>
                {!showMaps && p.pos.total > 1 && <span className="shrink-0 font-semibold text-gray-400">{p.pos.index + 1}/{p.pos.total}</span>}
              </p>
              <div className="overflow-hidden rounded-xl [&_img]:!object-cover">
                {showMaps && p.geo ? (
                  <PaneMap lat={p.lat as number} lng={p.lng as number} label={p.addr || p.who} />
                ) : (
                  <PropertyPhotoCarousel resetKey={`m-${p.key}`} photos={p.photos} fallbackUrl={p.fallback} onIndexChange={p.onIdx} onPhotoClick={p.open} />
                )}
              </div>
              <p className="mt-1 truncate text-[11px] font-black text-[#111827] dark:text-white">{p.addr}</p>
            </div>
          ))}
        </div>
        <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-[#fbfaf7] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-gray-400 dark:bg-white/[0.03]">
            <span></span><span className="text-right">Subject</span><span className="text-right">Comp #{index + 1}</span>
          </div>
          {([
            ['Price', formatMoney(subject.list_price, { compact: true }), formatMoney(comp.sale_price ?? comp.list_price, { compact: true })],
            ['$ / Sq ft', subjectPsf ? `$${Math.round(subjectPsf)}` : '—', psf ? `$${Math.round(psf)}` : '—'],
            ['Sq ft', subject.sqft ? subject.sqft.toLocaleString() : '—', comp.sqft ? comp.sqft.toLocaleString() : '—'],
            ['Beds', subject.beds ?? '—', comp.beds ?? '—'],
            ['Baths', subject.baths ?? '—', comp.baths ?? '—'],
            ['Acres', subject.lot_size ? sqftToAcres(subject.lot_size) : '—', comp.lot_size ? sqftToAcres(comp.lot_size) : '—'],
            ['Built', subject.year_built ?? '—', comp.year_built ?? '—'],
            ['Basement', basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area) || '—', basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area) || '—'],
            ['School', subject.school_district || '—', comp.school_district || '—'],
            ['Days on market', subject.days_on_market ?? '—', comp.days_on_market ?? '—'],
          ] as [string, React.ReactNode, React.ReactNode][]).map(([label, a, b], i) => (
            <div key={label} className={`grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 py-2 text-[12.5px] ${i % 2 ? 'bg-[#fbfaf7]/60 dark:bg-white/[0.015]' : ''}`}>
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</span>
              <span className="min-w-0 truncate text-right font-black text-[#111827] dark:text-white" title={String(a)}>{a}</span>
              <span className={`min-w-0 truncate text-right font-black ${String(a) !== String(b) ? 'text-[#8b6a2b] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`} title={String(b)}>{b}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden grid-cols-1 divide-y divide-gray-100 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-gray-800">
        <div className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
              Subject · {subject.street_address}{subject.city ? `, ${subject.city}` : ''}
            </p>
            {!showMaps && subjectPhotoPos.total > 1 && <span className="shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{subjectPhotoPos.index + 1} / {subjectPhotoPos.total}</span>}
          </div>
          {showMaps && subjectHasGeo ? (
            <PaneMap lat={subject.latitude as number} lng={subject.longitude as number} label={subject.street_address || 'subject'} />
          ) : (
            <PropertyPhotoCarousel resetKey="subject" photos={subject.photos} fallbackUrl={subject.photo_url} onIndexChange={onSubjectIndexChange} onPhotoClick={onOpenSubjectDetails} />
          )}
          <div className="mt-3 grid grid-flow-row-dense grid-cols-6 gap-1">
            <CmaFactChip compact icon={DollarSign} value={formatMoney(subject.list_price, { compact: true })} label="Price" />
            <CmaFactChip compact icon={Calculator} value={subjectPsf ? `$${Math.round(subjectPsf)}` : '—'} label="$/Sqft" />
            <CmaFactChip compact dynamicSpan icon={Ruler} {...sqftChipProps(subject.sqft)} />
            <CmaFactChip compact icon={Bed} value={subject.beds ?? '—'} label="Beds" />
            <CmaFactChip compact icon={Bath} value={subject.baths ?? '—'} label="Baths" />
            <CmaFactChip compact icon={LandPlot} value={subject.lot_size ? sqftToAcres(subject.lot_size) : '—'} label="Acres" />
            <CmaFactChip compact icon={Building2} value={subject.year_built ?? '—'} label="Built" />
            {basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area) && (
              <CmaFactChip compact dynamicSpan icon={Layers} value={basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area)!} label="Basement" />
            )}
            {subject.school_district && <CmaFactChip compact dynamicSpan icon={GraduationCap} value={subject.school_district} label="School" />}
            <CmaFactChip compact icon={Calendar} value={subject.days_on_market ?? '—'} label="DOM" />
          </div>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
              Comp #{index + 1} · {comp.street_address}{comp.city ? `, ${comp.city}` : ''}
            </p>
            {!showMaps && compPhotoPos.total > 1 && <span className="shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{compPhotoPos.index + 1} / {compPhotoPos.total}</span>}
          </div>
          {showMaps && compHasGeo ? (
            <PaneMap lat={comp.latitude as number} lng={comp.longitude as number} label={comp.street_address || 'comp'} />
          ) : (
            <PropertyPhotoCarousel resetKey={comp.id} photos={comp.photos} fallbackUrl={comp.photo_url} onIndexChange={onCompIndexChange} onPhotoClick={onOpenCompDetails} />
          )}
          <div className="mt-3 grid grid-flow-row-dense grid-cols-6 gap-1">
            <CmaFactChip compact icon={DollarSign} value={formatMoney(comp.sale_price ?? comp.list_price, { compact: true })} label="Price" />
            <CmaFactChip compact icon={Calculator} value={psf ? `$${Math.round(psf)}` : '—'} label="$/Sqft" />
            <CmaFactChip compact dynamicSpan icon={Ruler} {...sqftChipProps(comp.sqft)} />
            <CmaFactChip compact icon={Bed} value={comp.beds ?? '—'} label="Beds" />
            <CmaFactChip compact icon={Bath} value={comp.baths ?? '—'} label="Baths" />
            <CmaFactChip compact icon={LandPlot} value={comp.lot_size ? sqftToAcres(comp.lot_size) : '—'} label="Acres" />
            <CmaFactChip compact icon={Building2} value={comp.year_built ?? '—'} label="Built" />
            {basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area) && (
              <CmaFactChip compact dynamicSpan icon={Layers} value={basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area)!} label="Basement" />
            )}
            {comp.school_district && <CmaFactChip compact dynamicSpan icon={GraduationCap} value={comp.school_district} label="School" />}
            <CmaFactChip compact icon={Calendar} value={comp.days_on_market ?? '—'} label="DOM" />
          </div>
        </div>
      </div>

      <div
        ref={compareHeaderRef}
        className={`scroll-mt-4 rounded-b-2xl border-t bg-[#fbfaf7] p-3 transition-all duration-500 dark:bg-[#0B0B0B] ${compareFlash ? 'border-[#C9A24D] ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'border-gray-200 dark:border-gray-800'}`}
      >
        {/* Same layout as the panel header up top: title on the left, the Prev / N-of-M / Next
            comp switcher in a dead-centre column (equal 1fr sides), so when the agent has scrolled
            down into the Comp Weight rows they can still flip comps without scrolling back up.
            The hint line sits left-aligned under it. */}
        <div className="grid grid-cols-1 items-center gap-x-2 gap-y-1 sm:grid-cols-[1fr_auto_1fr]">
          <p className="text-sm font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Comp #{index + 1} — Compared With the Subject</p>
          <div className="flex items-center justify-center gap-1">
            <button onClick={onPrev} disabled={index <= 0} aria-label="Previous comp" className="rounded-lg border border-gray-200 p-1 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 text-[10px] font-black text-gray-400">{index + 1} / {total}</span>
            <button onClick={onNext} disabled={index >= total - 1} aria-label="Next comp" className="rounded-lg border border-gray-200 p-1 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <span aria-hidden className="hidden sm:block" />
        </div>
        <p className="mb-3 mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Each row describes this comp relative to the subject — "Comp Superior" means Comp #{index + 1} is the better one in that category; "Comp Inferior" means the subject is.</p>
        {/* Comp Weight is a different kind of question from everything below it - it's asking how
            much analytical weight to give this comp overall, not how one attribute compares to
            the subject - so it gets its own bracketed "bubble" (bolder gold border + gradient +
            glow, its own header row) instead of sitting quietly in the same divided list as the
            quality-dimension rows. */}
        <div className="relative mb-3 overflow-hidden rounded-xl border-2 border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/15 via-white to-white p-2.5 shadow-[0_8px_24px_-12px_rgba(201,162,77,0.6)] dark:border-[#C9A24D]/70 dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517]">
          <div className="flex items-center gap-3">
            <span className="flex w-24 shrink-0 items-center gap-1.5 text-[10px] font-black uppercase leading-tight tracking-wide text-[#8b7355] dark:text-[#d7b974]">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              Comp Weight
            </span>
            <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${STRENGTH_OPTIONS.length}, minmax(0, 1fr))` }}>
              {STRENGTH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateStrength(opt.value)}
                  className={`rounded-lg px-1.5 py-2 text-center text-[10px] font-black uppercase leading-tight tracking-wide transition ${normalizeStrength(comp.strength) === opt.value ? `${STRENGTH_TIER_STYLES[opt.value]} shadow-md scale-[1.03]` : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent override: exclude a comp without deleting it (distinct from removing it back in
            the search step) - stays visible, dimmed, with its reason, everywhere is_included is
            already rendered (e.g. CompOrderRail). Reversible via Restore. */}
        {!comp.is_included ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-500/30 dark:bg-red-500/10">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400">Marked Irrelevant</p>
              {comp.override_reason && <p className="mt-0.5 truncate text-xs font-semibold text-red-700 dark:text-red-300">{comp.override_reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ is_included: true, override_reason: null })}
              className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Restore
            </button>
          </div>
        ) : showIrrelevantForm ? (
          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-white/5">
            <input
              autoFocus
              value={irrelevantReason}
              onChange={e => setIrrelevantReason(e.target.value)}
              placeholder="Why is this comp irrelevant? (required)"
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <button type="button" onClick={() => { setShowIrrelevantForm(false); setIrrelevantReason('') }} className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">Cancel</button>
              <button
                type="button"
                disabled={!irrelevantReason.trim()}
                onClick={() => { onUpdate({ is_included: false, override_reason: irrelevantReason.trim() }); setShowIrrelevantForm(false); setIrrelevantReason('') }}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowIrrelevantForm(true)} className="mb-3 text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-red-600 dark:hover:text-red-400">
            Mark Irrelevant
          </button>
        )}

        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          <QualityRow label="Finish Quality" options={QUALITY_3} value={comp.quality.finish_quality} onChange={v => onUpdateQuality('finish_quality', v)} colorCoded />
          <QualityRow label="Interior Quality" options={QUALITY_3} value={comp.quality.interior} onChange={v => onUpdateQuality('interior', v)} colorCoded />
          <QualityRow label="Exterior Quality" options={QUALITY_3} value={comp.quality.exterior} onChange={v => onUpdateQuality('exterior', v)} colorCoded />
          <QualityRow label="Lot" options={QUALITY_3} value={comp.quality.lot} onChange={v => onUpdateQuality('lot', v)} colorCoded />
          <QualityRow label="Amenities" options={QUALITY_3} value={comp.quality.amenities} onChange={v => onUpdateQuality('amenities', v)} colorCoded />
          <QualityRow label="Layout" options={QUALITY_3} value={comp.quality.layout} onChange={v => onUpdateQuality('layout', v)} colorCoded />
          <QualityRow label="Area" options={AREA_3} value={comp.quality.area} onChange={v => onUpdateQuality('area', v)} colorCoded />
          <QualityRow label="Street" options={QUALITY_3} value={comp.quality.street_context} onChange={v => onUpdateQuality('street_context', v)} colorCoded />
        </div>

        {/* Auto-filled from the AI note the moment it's generated (see handleGenerate) - no manual
            "Use this" step. The gold wrapper + label only show while the text still matches the AI
            note verbatim; editing it even slightly reverts to the plain look, since it's now the
            agent's own words. Row count grows with the text so the whole note is visible without
            scrolling instead of being clipped at a fixed 2 lines. */}
        {(() => {
          const isAiText = !!comp.ai_commentary && comp.commentary === comp.ai_commentary
          const rows = Math.min(8, Math.max(2, Math.ceil((comp.commentary?.length || 0) / 50)))
          return (
            <div className={`mt-2.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
              {isAiText && (
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                  <Sparkles className="h-3 w-3" /> AI Generated
                </p>
              )}
              <textarea
                value={comp.commentary || ''}
                onChange={e => onUpdate({ commentary: e.target.value })}
                placeholder="Why is this a strong or weak comp? Renovations, finish quality, land, functional vs. wasted space, what the sale demonstrates about the market..."
                rows={rows}
                className={`w-full rounded-xl px-3.5 py-2 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                  isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]'
                }`}
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// One label + one row of equal-width option pills that always fits the panel's width (a CSS
// grid with as many equal columns as there are options, not flex-wrap) - a long label set (e.g.
// "Well Below Subject" x5) used to wrap unevenly across 2 ragged rows of differently-sized
// buttons; this keeps every row a single clean line, with long labels wrapping WITHIN their own
// cell instead of breaking the row layout.
function QualityRowLayout({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <p className="w-24 shrink-0 text-[10px] font-black uppercase leading-tight tracking-wide text-gray-700 dark:text-gray-400">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Comp Weight is a genuine strength ranking (weak -> supporting -> strong), not a "how close to
// the subject" match check like the quality-dimension rows below it - so unlike those (where
// either extreme is red and only "similar" is green), strong is unambiguously the best outcome
// here and stays green; weak stays red. Kept as its own independent map rather than aliasing
// AGENT_QUALITY_TIER_STYLES.below/similar/above, since those two now mean something different.
// Colour only shows once a button is actually selected: weak = red, strong = green, supporting
// = gold. Unselected buttons stay neutral grey (handled inline where the grid is rendered).
const STRENGTH_TIER_STYLES: Record<string, string> = {
  strong: 'bg-emerald-500 text-white dark:bg-emerald-600',
  supporting: 'bg-[#C9A24D] text-[#111827]',
  weak: 'bg-red-500 text-white dark:bg-red-600',
}

function OptionGrid({ options, value, onChange, colorCoded }: { options: { value: string, label: string }[], value?: string | null, onChange: (v: string) => void, colorCoded?: boolean }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-1.5 py-2 text-center text-[10px] font-black uppercase leading-tight tracking-wide transition ${
            value === opt.value
              ? (colorCoded ? AGENT_QUALITY_TIER_STYLES[opt.value] || 'bg-[#C9A24D] text-white' : 'bg-[#C9A24D] text-white')
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function QualityRow({ label, options, value, onChange, colorCoded }: { label: string, options: { value: string, label: string }[], value?: string | null, onChange: (v: string) => void, colorCoded?: boolean }) {
  return (
    <QualityRowLayout label={label}>
      <OptionGrid options={options} value={value} onChange={onChange} colorCoded={colorCoded} />
    </QualityRowLayout>
  )
}

function formatUtilityValue(value?: string[] | string | null) {
  if (!value) return '—'
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—'
  return value
}

const COMPARISON_ROWS: { key: keyof CmaComparable | 'psf', label: string, format: (c: any) => string }[] = [
  { key: 'sale_price', label: 'Sale Price', format: v => formatMoney(v.sale_price ?? v.list_price) },
  { key: 'psf', label: 'Price / Sq Ft', format: v => { const p = v.price_per_sqft ?? pricePerSqft(v.sale_price ?? v.list_price, v.sqft); return p ? `$${p}` : '—' } },
  { key: 'sqft', label: 'Square Footage', format: v => formatSqftCompact(v.sqft, v.above_grade_finished_area) },
  { key: 'lot_size', label: 'Lot Size', format: v => v.lot_size ? `${sqftToAcres(v.lot_size)} ac` : '—' },
  { key: 'beds', label: 'Beds', format: v => v.beds ?? '—' },
  { key: 'baths', label: 'Baths', format: v => v.baths ?? '—' },
  { key: 'year_built', label: 'Year Built', format: v => v.year_built ?? '—' },
  { key: 'school_district', label: 'School District', format: v => v.school_district || '—' },
  { key: 'water_source', label: 'Water Source', format: v => formatUtilityValue(v.water_source) },
  { key: 'sewer', label: 'Sewer / Septic', format: v => formatUtilityValue(v.sewer) },
  { key: 'garage', label: 'Garage', format: v => v.garage || '—' },
  { key: 'basement', label: 'Basement', format: v => basementFactValue(v.basement, v.below_grade_finished_area) || '—' },
  { key: 'days_on_market', label: 'Days on Market', format: v => v.days_on_market ?? '—' },
  { key: 'distance_miles', label: 'Distance', format: v => v.distance_miles != null ? `${v.distance_miles} miles` : '—' },
  { key: 'sale_date', label: 'Sale Date', format: v => formatDate(v.sale_date) },
]

function ComparisonTable({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/5">
            <th className="sticky left-0 bg-gray-50 p-3 text-left text-[10px] font-black uppercase tracking-wide text-gray-500 dark:bg-[#1a1a1c] dark:text-gray-400"></th>
            <th className="bg-[#C9A24D]/10 p-3 text-left text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:bg-[#C9A24D]/10 dark:text-[#d7b974]">Subject</th>
            {comparables.map((c, i) => (
              <th key={c.id} className="p-3 text-left text-[11px] font-black uppercase tracking-wide text-gray-600 dark:text-gray-400">#{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr key={row.label} className={`border-t border-gray-200 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5 ${i % 2 === 1 ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}>
              <td className="sticky left-0 bg-inherit p-3 text-xs font-bold text-gray-600 dark:text-gray-400">{row.label}</td>
              <td className="bg-[#C9A24D]/5 p-3 text-xs font-black text-[#111827] dark:text-white">{row.format(subject)}</td>
              {comparables.map(c => (
                <td key={c.id} className="p-3 text-xs font-semibold text-gray-600 dark:text-gray-300">{row.format(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PsfChart({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const bars = comparables.map((c, i) => ({
    label: `#${i + 1}`,
    value: pricePerSqft(effectiveCompPrice(c), c.sqft) ?? 0,
  }))
  const subjectPsf = subject.list_price && subject.sqft ? pricePerSqft(subject.list_price, subject.sqft) : null
  const max = Math.max(...bars.map(b => b.value), subjectPsf || 0, 1)
  return (
    <div className="space-y-1 rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
      {subjectPsf && (
        <div className="flex items-center gap-2 rounded-xl bg-[#C9A24D]/5 px-2 py-1.5">
          <span className="w-14 shrink-0 text-[10px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">Subject</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${(subjectPsf / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">${subjectPsf}</span>
        </div>
      )}
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5">
          <span className="w-14 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-bold text-gray-600 dark:text-gray-300">{b.value ? `$${b.value}` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function SalePriceChart({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const bars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: effectiveCompPrice(c) ?? 0 }))
  const max = Math.max(...bars.map(b => b.value), subject.list_price || 0, 1)
  return (
    <div className="space-y-1 rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
      {subject.list_price != null && (
        <div className="flex items-center gap-2 rounded-xl bg-[#C9A24D]/5 px-2 py-1.5">
          <span className="w-14 shrink-0 text-[10px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">Subject</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${(subject.list_price / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">{formatMoney(subject.list_price, { compact: true })}</span>
        </div>
      )}
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5">
          <span className="w-14 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-bold text-gray-600 dark:text-gray-300">{b.value ? formatMoney(b.value, { compact: true }) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Step 4: Pricing Conclusion (+ Market Context)
// ============================================================================

function MoneyField({ label, value, onChange }: { label: string, value?: number | null, onChange: (v: number | null) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString() : ''}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '')
            onChange(digits ? Number(digits) : null)
          }}
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-6 pr-3 text-sm font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
        />
      </div>
    </div>
  )
}

function PricingStep({ report, onSave, onReportUpdated, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onNext: () => void }) {
  // Mode is fixed at CMA creation (see the picker in studio/cma/page.tsx's CreateCmaModal) - no
  // in-wizard way to change it, so it's a plain derived read, not stateful. Letting it change here
  // used to leave stale/blank pricing fields behind (generated under one mode, then switched to
  // the other's empty fields) since a mode flip never retroactively re-filled anything.
  const mode = report.mode
  const [pricing, setPricing] = useState<CmaPricing>(report.pricing)

  // Re-seed from the server ONLY on a genuine report switch - NOT on report.pricing,
  // which get a fresh reference on every silent save echo and would revert a field mid-edit (and
  // with saves overlapping keystrokes, re-save it - the autosave "glitch"). The useState
  // initializers seed the first mount; the setters below own local state after that.
  const seededPricingReportId = useRef(report.id)
  useEffect(() => {
    if (seededPricingReportId.current === report.id) return
    seededPricingReportId.current = report.id
    setPricing(report.pricing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])

  // Debounced from each setter directly (not a watch-effect on `pricing`) - a
  // round-trip reset never calls one of these setters again on its own.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])
  const scheduleSave = (nextPricing: CmaPricing) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { onSave({ pricing: nextPricing }, { silent: true }) }, 700)
  }

  const patch = (p: Partial<CmaPricing>) => {
    const next = { ...pricing, ...p }
    setPricing(next)
    scheduleSave(next)
  }
  const buyerGuidance = useMemo(() => splitCmaBuyerGuidance(pricing), [pricing])
  const inspectionConcernsValue = pricing.inspection_concerns ?? buyerGuidance.inspectionText
  const offerSuggestionValue = pricing.inspection_concerns ? (pricing.offer_suggestion_notes || '') : (buyerGuidance.offerText || pricing.offer_suggestion_notes || '')

  const handleContinue = async () => {
    const pricingToSave = mode === 'buyer' && !pricing.inspection_concerns && buyerGuidance.inspectionText
      ? { ...pricing, inspection_concerns: buyerGuidance.inspectionText, offer_suggestion_notes: buyerGuidance.offerText || pricing.offer_suggestion_notes }
      : pricing
    const saved = await onSave({ mode, pricing: pricingToSave })
    // See AnalysisStep's handleContinue - an agent price edit after generation legitimately marks
    // the stamped QA artifact stale; re-verify here so Summary never has to show that notice for a
    // save that just happened as part of normal, expected step-by-step workflow.
    if (saved && isStaleArtifactOnly(cmaQaBlocking(saved))) {
      // Free re-stamp, not a paid recompute - nothing about the content needs re-checking here,
      // just the artifact hash catching up to this save.
      const response = await api.cma.resyncQa(saved.id)
      if (response.success && response.data) onReportUpdated(response.data)
    }
    onNext()
  }

  return (
    <div className="space-y-5">
      {mode === 'listing' ? (
        <SectionCard title="Pricing Conclusion" subtitle="Auto-filled by AI once generated - your numbers always override it.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MoneyField label="Recommended Min" value={pricing.recommended_min} onChange={v => patch({ recommended_min: v })} />
            <MoneyField label="Recommended Max" value={pricing.recommended_max} onChange={v => patch({ recommended_max: v })} />
            <MoneyField label="Most Likely Market Value" value={pricing.most_likely_value} onChange={v => patch({ most_likely_value: v })} />
            <MoneyField label="Recommended List Price" value={pricing.recommended_list_price} onChange={v => patch({ recommended_list_price: v })} />
          </div>
          {/* Auto-filled once by the AI (non-destructively) at generation time - see
              cma_ai_service.py. Shows the gold "AI Generated" marker for as long as it still
              matches the AI's own methodology summary verbatim; editing it reverts to the plain
              look, since it's now the agent's own words. */}
          {(() => {
            const aiText = pricing.ai_estimate?.methodology_summary
            const isAiText = !!aiText && pricing.pricing_commentary === aiText
            return (
              <div className="mt-4">
                <FieldLabel>Agent Pricing Analysis</FieldLabel>
                <div className={`mt-1.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
                  {isAiText && (
                    <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </p>
                  )}
                  <textarea
                    value={pricing.pricing_commentary || ''}
                    onChange={e => patch({ pricing_commentary: e.target.value })}
                    placeholder="Where the property sits within the comp set, finish quality, renovations, scarcity, market conditions, which comps deserve more or less weight, risk of pricing too aggressively..."
                    rows={5}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                      isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]'
                    }`}
                  />
                </div>
              </div>
            )
          })()}
          {/* Seller mirror of the buyer's Offer Suggestion / Inspection Concerns - AI-filled once
              (non-destructively), same "AI Generated" marker while it still matches verbatim. */}
          {([
            { key: 'listing_strategy_notes', aiKey: 'listing_strategy_considerations', label: 'Pricing Strategy', placeholder: 'Where the list price should sit and why, the competition a buyer will compare it to, the risk of overpricing, what to lead with at launch...' },
            { key: 'listing_prep_notes', aiKey: 'listing_prep_concerns', label: 'Listing Prep', placeholder: "What to fix, document, or be ready to disclose before listing - systems, roof, septic/well, records and permits - so a buyer's inspection doesn't become a negotiation..." },
          ] as const).map(({ key, aiKey, label, placeholder }) => {
            const value = pricing[key] || ''
            const aiText = pricing.ai_estimate?.[aiKey]
            const isAiText = !!aiText && value === aiText
            return (
              <div key={key} className="mt-4">
                <FieldLabel>{label}</FieldLabel>
                <div className={`mt-1.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
                  {isAiText && (
                    <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </p>
                  )}
                  <textarea
                    value={value}
                    onChange={e => patch({ [key]: e.target.value })}
                    placeholder={placeholder}
                    rows={4}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                      isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]'
                    }`}
                  />
                </div>
              </div>
            )
          })}
        </SectionCard>
      ) : (
        <SectionCard title="Buyer Valuation / Offer Analysis" subtitle="Auto-filled by AI once generated - your numbers always override it.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MoneyField label="Estimated Fair Market Value" value={pricing.estimated_fair_value} onChange={v => patch({ estimated_fair_value: v })} />
            <MoneyField label="Suggested Offer Min" value={pricing.suggested_offer_min} onChange={v => patch({ suggested_offer_min: v })} />
            <MoneyField label="Suggested Offer Max" value={pricing.suggested_offer_max} onChange={v => patch({ suggested_offer_max: v })} />
            <MoneyField label="Strong Offer" value={pricing.strong_offer} onChange={v => patch({ strong_offer: v })} />
          </div>
          {/* Auto-filled once by the AI (non-destructively) at generation time - see
              cma_ai_service.py. Shows the same gold "AI Generated" marker as comp notes for as
              long as it still matches the AI's own methodology summary verbatim; editing it
              reverts to the plain look, since it's now the agent's own words. */}
          {(() => {
            const aiText = pricing.ai_estimate?.methodology_summary
            const isAiText = !!aiText && pricing.offer_strategy_commentary === aiText
            return (
              <div className="mt-4">
                <FieldLabel>Buyer Valuation - Agent Notes</FieldLabel>
                <div className={`mt-1.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
                  {isAiText && (
                    <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </p>
                  )}
                  <textarea
                    value={pricing.offer_strategy_commentary || ''}
                    onChange={e => patch({ offer_strategy_commentary: e.target.value })}
                    placeholder="Why is this a fair value for the property - condition, comps, market conditions..."
                    rows={5}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                      isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]'
                    }`}
                  />
                </div>
              </div>
            )
          })()}
          {(() => {
            const aiText = pricing.ai_estimate?.inspection_concerns
            const isAiText = !!aiText && inspectionConcernsValue === aiText
            return (
              <div className="mt-4">
                <FieldLabel>Inspection Concerns</FieldLabel>
                <div className={`mt-1.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
                  {isAiText && (
                    <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </p>
                  )}
                  <textarea
                    value={inspectionConcernsValue}
                    onChange={e => patch({ inspection_concerns: e.target.value })}
                    placeholder="Inspection and due-diligence concerns: utilities, septic, roof, exterior, foundation, mechanicals, water intrusion, condition risks..."
                    rows={4}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                      isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]'
                    }`}
                  />
                </div>
              </div>
            )
          })()}
          {/* AI-auto-fillable tactical negotiation guidance - kept separate from inspection
              concerns so the client-facing PDF/site don't read like one giant paragraph. */}
          {(() => {
            const aiText = pricing.ai_estimate?.offer_strategy_considerations
            const isAiText = !!aiText && offerSuggestionValue === aiText
            return (
              <div className="mt-4">
                <FieldLabel>Offer Suggestion</FieldLabel>
                <div className={`mt-1.5 rounded-xl border transition ${isAiText ? 'border-[#C9A24D]/30 bg-[#C9A24D]/5 p-1.5' : 'border-transparent'}`}>
                  {isAiText && (
                    <p className="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </p>
                  )}
                  <textarea
                    value={offerSuggestionValue}
                    onChange={e => patch({ offer_suggestion_notes: e.target.value })}
                    placeholder="How would you structure the offer: opening price, ceiling, negotiation leverage, seller psychology, contingencies, timing..."
                    rows={4}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white ${
                      isAiText ? 'border border-transparent bg-transparent' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]'
                    }`}
                  />
                </div>
              </div>
            )
          })()}
        </SectionCard>
      )}

      {/* QA/Review is intentionally not shown to the agent - see CmaLookupPanel in the admin
          dashboard, which an admin uses to view this via the report's own support code. */}

      <div className="flex justify-end gap-2">
        <button onClick={handleContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
          Continue to Summary <ArrowLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Step 5: Summary & Share
// ============================================================================

function SummaryStep({ report, onSave, onReportUpdated, onJump, onDeleted }: {
  report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onJump: (s: StepId) => void, onDeleted: () => void,
}) {
  const { showToast } = useToast()
  const router = useRouter()
  const { user } = useAuth()
  const [agent, setAgent] = useState<any>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [sharePath, setSharePath] = useState<string | null>(report.share_slug ? `/cma/${report.share_slug}` : null)
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  const [shareLinks, setShareLinks] = useState<{ openHousePalUrl: string, websiteUrl: string | null } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [readyState, setReadyState] = useState<'idle' | 'saving' | 'done'>(() => (report.status === 'READY' || report.status === 'SHARED' ? 'done' : 'idle'))

  useEffect(() => {
    Promise.allSettled([api.studio.getBrandKit(), api.agentHub.getMine()]).then(([brandResult, hubResult]) => {
      const brandRes = brandResult.status === 'fulfilled' ? brandResult.value : null
      const hubRes = hubResult.status === 'fulfilled' ? hubResult.value : null
      const brand = brandRes?.success ? brandRes.data : null
      const hubConfig = hubRes?.success ? hubRes.data?.config : null
      const profilePhotoUrl = hubConfig?.profilePhotoUrl || hubConfig?.profile_photo_url || user?.photo_url || null
      setAgent({
        name: user ? `${user.first_name} ${user.last_name}` : '',
        headshot_url: profilePhotoUrl,
        photo_url: profilePhotoUrl,
        brokerage: user?.brokerage || null,
        email: user?.email || null,
        phone: hubConfig?.contact?.call || hubConfig?.contact?.phone || hubConfig?.contact?.mobile || (user as any)?.phone || null,
        service_area: hubConfig?.profile?.market || user?.market || null,
        logo_url: brand?.personal_logo_url || brand?.brokerage_logo_url || null,
        primary_color: brand?.primary_color || '#111827',
        secondary_color: brand?.secondary_color || '#C9A24D',
      })
    })
  }, [user])

  useEffect(() => {
    Promise.all([api.sites.getMine(), api.sites.getDomains()])
      .then(([siteResponse, domainsResponse]) => {
        if (siteResponse.success && siteResponse.data) setIdxSite(siteResponse.data)
        if (domainsResponse.success && domainsResponse.data) setIdxDomains(domainsResponse.data)
      })
      .catch(() => {})
  }, [])

  const included = report.comparables.filter(c => c.is_included)
  const weighted = strongComps(report.comparables)
  // Authoritative backend comp stats when the report has an AI estimate; computeMarketMetrics
  // (inside resolveCmaMarketMetrics) is only the fallback for a report with no AI run yet.
  const metrics = resolveCmaMarketMetrics(included, report.pricing.ai_estimate)
  // Backend is the single authoritative valuation source (see ai_estimate.range_min/range_max) -
  // this is a display fallback only, for when the agent hasn't filled in their own pricing yet
  // and an AI analysis has run; no independent client-side estimate is computed anymore.
  const aiEstimate = report.pricing.ai_estimate
  const finalValuation = aiEstimate?.final_valuation
  const authoritativeValue = finalValuation?.value ?? aiEstimate?.value ?? null
  const suggested = {
    min: finalValuation?.range_min ?? aiEstimate?.range_min ?? null,
    max: finalValuation?.range_max ?? aiEstimate?.range_max ?? null,
  }
  const buyerGuidance = splitCmaBuyerGuidance({
    ...report.pricing,
    offer_strategy_commentary: aiEstimate?.methodology_summary ?? report.pricing.offer_strategy_commentary,
    offer_suggestion_notes: aiEstimate?.offer_strategy_considerations ?? report.pricing.offer_suggestion_notes,
  })
  const [presentation, setPresentation] = useState(report.presentation)
  const presentationRef = useRef(report.presentation)
  useEffect(() => {
    presentationRef.current = report.presentation
    setPresentation(report.presentation)
  }, [report.id, report.presentation])

  const savePresentation = (next: CmaReport['presentation']) => {
    presentationRef.current = next
    setPresentation(next)
    void onSave({ presentation: next }, { silent: true })
  }

  const toggleSection = (key: string) => {
    const current = presentationRef.current
    const hidden = new Set(current.hidden_sections)
    hidden.has(key) ? hidden.delete(key) : hidden.add(key)
    savePresentation({ ...current, hidden_sections: Array.from(hidden) })
  }

  // Which theme the public link opens in for a visitor by default - undefined/null means dark
  // (the site's own default). Purely a default; the visitor can still flip it with their own
  // toggle on the public page, and the IDX-embedded view ignores this entirely (always light).
  const setDefaultTheme = (theme: 'light' | 'dark') => {
    savePresentation({ ...presentationRef.current, default_theme: theme })
  }
  useEffect(() => {
    if (report.share_slug) setSharePath(`/cma/${report.share_slug}`)
  }, [report.share_slug])

  // The report is always final and export-ready the moment generation completes - every fix runs
  // automatically inside the generation pipeline itself, before this report is ever saved, so
  // there is no separate "resolve QA" gate here: Mark Ready, Share, and Download all just work.
  const markReady = async () => {
    if (readyState !== 'idle') return
    setReadyState('saving')
    await onSave({ status: 'READY' }, { silent: true })
    setReadyState('done')
    showToast('CMA marked ready', 'success')
    window.setTimeout(() => router.push('/studio/cma'), 900)
  }

  const ensureSharePath = async (): Promise<string | null> => {
    setSharing(true)
    const response = await api.cma.share(report.id)
    setSharing(false)
    if (response.success && response.data) {
      await onSave({}, { silent: true })
      setSharePath(response.data.public_path)
      return response.data.public_path
    }
    showToast(response.error || 'Could not create a share link.', 'error')
    return null
  }

  const handleShare = async () => {
    const path = await ensureSharePath()
    if (path) {
      setShareLinks({
        openHousePalUrl: openHousePalPublicUrl(path),
        websiteUrl: websitePublicUrl(idxSite, idxDomains, path),
      })
      setShowShare(true)
    }
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    const response = await api.cma.remove(report.id)
    setIsDeleting(false)
    if (response.success) onDeleted()
    else { setShowDeleteConfirm(false); showToast(response.error || 'Could not delete this CMA.', 'error') }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Final Review" subtitle="Check the numbers, comps, and narrative before you mark the report ready.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button onClick={() => onJump('subject')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Subject</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{report.subject.street_address}</p>
            <p className="text-xs font-semibold text-gray-400">{report.subject.list_price ? formatMoney(report.subject.list_price) : 'No list price set'}</p>
          </button>
          <button onClick={() => onJump('comps')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comparable Set</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{included.length} comps ({weighted.length} carry weight)</p>
            <p className="text-xs font-semibold text-gray-400">{formatMoneyRange(metrics.saleMin, metrics.saleMax)}</p>
          </button>
          <button onClick={() => onJump('analysis')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comparable $/Sqft Range</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{metrics.psfMin && metrics.psfMax ? `$${metrics.psfMin} – $${metrics.psfMax}` : '—'}</p>
          </button>
          <button onClick={() => onJump('pricing')} className="rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/5 p-3 text-left">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
              {report.mode === 'buyer' ? 'Estimated Fair Value' : 'Recommended Value Range'}
            </p>
            <p className="mt-1 font-serif text-lg font-black text-[#111827] dark:text-white">
              {report.mode === 'buyer'
                ? (authoritativeValue != null ? formatMoney(authoritativeValue) : formatMoney(report.pricing.estimated_fair_value))
                : (suggested.min != null && suggested.max != null
                    ? formatMoneyRange(suggested.min, suggested.max)
                    : formatMoneyRange(report.pricing.recommended_min, report.pricing.recommended_max))}
            </p>
          </button>
        </div>

        {(aiEstimate?.methodology_summary || report.pricing.pricing_commentary || report.pricing.offer_strategy_commentary) && (
          <div className="mt-4 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              {report.mode === 'buyer' ? 'Buyer Valuation' : 'Agent Conclusion'}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
              {aiEstimate?.methodology_summary || report.pricing.pricing_commentary || report.pricing.offer_strategy_commentary}
            </p>
          </div>
        )}
        {cmaWhyBullets(report).length > 0 && (
          <div className="mt-3 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Why this value</p>
            <ul className="mt-1.5 space-y-1.5">
              {cmaWhyBullets(report).map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A24D]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* "How this value was calculated" (ValuationTracePanel) is intentionally not shown to the
            agent - admin can view it via CmaLookupPanel using the report's own support code. */}
        {report.mode === 'buyer' && buyerGuidance.inspectionText && (
          <div className="mt-3 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Inspection Concerns</p>
            <NarrativeText text={buyerGuidance.inspectionText} />
          </div>
        )}
        {report.mode === 'buyer' && buyerGuidance.offerText && (
          <div className="mt-3 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Offer Suggestion</p>
            <NarrativeText text={buyerGuidance.offerText} />
          </div>
        )}
        {report.mode !== 'buyer' && ([
          ['Pricing Strategy', report.pricing.listing_strategy_notes],
          ['Listing Prep', report.pricing.listing_prep_notes],
        ] as const).map(([label, text]) => text?.trim() ? (
          <div key={label} className="mt-3 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
            <NarrativeText text={text} />
          </div>
        ) : null)}
      </SectionCard>

      {/* QA/Review is intentionally not shown to the agent - admin can view it via CmaLookupPanel
          using the report's own support code (see the Report Code block further down this page). */}

      <SectionCard title="Presentation" subtitle="Hide anything that shouldn't appear in the client-facing CMA. Saved changes update the live link immediately.">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'subject', label: 'Subject Property' },
            { key: 'comparison_table', label: 'Comparable Overview' },
            { key: 'location', label: 'Location Context' },
            { key: 'comparables', label: 'Individual Comparables' },
            { key: 'market_context', label: 'Market Context' },
            { key: 'charts', label: 'Market Analysis' },
            { key: 'pricing', label: 'Agent Final Analysis' },
          ].map(s => {
            const isHidden = presentation.hidden_sections.includes(s.key)
            return (
              <button
                key={s.key}
                onClick={() => toggleSection(s.key)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${isHidden ? 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800' : 'bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#d7b974]'}`}
              >
                {s.label}
              </button>
            )
          })}
        </div>

      </SectionCard>

      <SectionCard title="Complete & Send" subtitle="Preview the PDF, copy the client link, or open the live CMA in a new tab.">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mark Ready is THE action here (user, 10/17 - it blended in with PDF): its own big gold
              button, full width on phones; PDF / Download / Share sit together under it. */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={markReady}
              disabled={readyState !== 'idle'}
              className={`group relative inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl px-6 text-sm font-black uppercase tracking-wide shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0 sm:h-11 sm:w-auto ${
                readyState === 'done'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : readyState === 'saving'
                    ? 'bg-[#C9A24D]/70 text-white shadow-[#C9A24D]/20'
                    : 'bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e0b85f] text-white shadow-[#C9A24D]/40 hover:shadow-xl hover:shadow-[#C9A24D]/50'
              }`}
            >
              <span className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ${readyState === 'done' ? 'translate-x-full' : 'group-hover:translate-x-full'}`} />
              {readyState === 'idle' && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#C9A24D]/50 animate-pulse" />}
              {readyState === 'saving' ? (
                <Loader2 className="relative h-4 w-4 animate-spin" />
              ) : readyState === 'done' ? (
                <Check className="relative h-4 w-4" strokeWidth={3} />
              ) : (
                <Sparkles className="relative h-4 w-4 transition group-hover:rotate-12 group-hover:scale-110" />
              )}
              <span className="relative">{readyState === 'saving' ? 'Marking Ready...' : readyState === 'done' ? 'Ready to send' : 'Mark Ready'}</span>
            </button>
            <div className="grid w-full grid-cols-3 items-center gap-1 rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.06] p-1 sm:flex sm:w-auto">
              <button
                onClick={() => setShowPdf(true)}
                disabled={!agent}
                title="Generate PDF"
                className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[10px] font-black uppercase tracking-wide text-[#8b7355] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C9A24D]/15 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 dark:text-[#d7b974]"
              >
                <Layers className="h-3.5 w-3.5" /> PDF
              </button>
              {agent ? (
                <PDFDownloadLink document={<CmaPresentationDocument report={report} agent={agent} />} fileName={`CMA-${(report.subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`} className="flex">
                  {({ loading }) => (
                    <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[10px] font-black uppercase tracking-wide text-[#8b7355] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C9A24D]/15 hover:shadow-md dark:text-[#d7b974]">
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Download
                    </span>
                  )}
                </PDFDownloadLink>
              ) : <span />}
              <button onClick={handleShare} disabled={sharing} title="Share Link" className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#111827] px-3 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:bg-white dark:text-[#111827]">
                {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share
              </button>
            </div>
          </div>

          {/* Web version only: end the shared page with the agent's Email Signature card instead of
              the plain contact block (the PDF never changes). Plans with Email Signature only. */}
          {hasEmailSignatureAccess(user?.plan_tier) && (
            <button
              type="button"
              onClick={async () => { const next = report.use_signature_card === false; const saved = await onSave({ use_signature_card: next } as Partial<CmaReport>, { silent: true }); if (saved) onReportUpdated(saved) }}
              title="On the web version of the shared link, your email signature card closes the report. The PDF keeps its own footer."
              aria-pressed={report.use_signature_card !== false}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/60 px-2.5 py-1 dark:border-gray-700 dark:bg-white/[0.03]"
            >
              <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">My Signature</span>
              <span className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${report.use_signature_card !== false ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${report.use_signature_card !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
          )}

          {/* Visitor default theme - purely a default for the public link (dark unless set to
              light here); a visitor can still flip it themselves with their own toggle on the
              page, and the IDX-embedded view always ignores this and stays light regardless. A
              real sliding switch (track + thumb) instead of two small adjacent icon buttons -
              which state is active reads at a glance instead of needing to compare two similarly-
              weighted buttons against each other. */}
          <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/60 px-2.5 py-1 dark:border-gray-700 dark:bg-white/[0.03]">
            <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">Visitor Theme</span>
            <button
              type="button"
              onClick={() => setDefaultTheme(presentation.default_theme === 'light' ? 'dark' : 'light')}
              title={`Visitor default theme: ${presentation.default_theme === 'light' ? 'Light' : 'Dark'} - click to switch`}
              aria-pressed={presentation.default_theme !== 'light'}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-1 transition-all duration-300 hover:shadow-md ${
                presentation.default_theme === 'light' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-[#111827]'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${
                  presentation.default_theme === 'light' ? 'translate-x-0' : 'translate-x-4'
                }`}
              >
                {presentation.default_theme === 'light' ? <Sun className="h-2.5 w-2.5 text-[#C9A24D]" /> : <Moon className="h-2.5 w-2.5 text-[#111827]" />}
              </span>
            </button>
          </div>

          {/* Agent-only support cluster - never shown on the public/guest report. Lets an agent
              who hits a real problem (bad valuation, garbled prose, wrong comp data) hand support
              something exact to pull up, since the QA review and "how this value was calculated"
              trace are intentionally hidden from this page - see CmaLookupPanel in the admin
              dashboard, which resolves this same code back to the full report. */}
          <div
            title="Give this code to OpenHousePal support if something looks wrong with this report - it lets us pull up this exact CMA to see what happened."
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 px-2.5 py-1 dark:border-gray-700 dark:bg-white/[0.03]"
          >
            <span className="text-[9px] font-black uppercase tracking-wide text-gray-400">
              Code: <span className="text-gray-600 dark:text-gray-300">{cmaSupportCode(report.id)}</span>
            </span>
            <Link
              href={`/settings/help?compose=1&cma_code=${encodeURIComponent(cmaSupportCode(report.id))}`}
              className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-white px-2 text-[9px] font-black uppercase tracking-wide text-gray-600 shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:-translate-y-0.5 hover:text-[#8b7355] hover:shadow-md hover:ring-[#C9A24D] dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
            >
              Submit Ticket
            </Link>
          </div>

          <button onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent px-3 text-[10px] font-black uppercase tracking-wide text-red-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:shadow-md disabled:hover:translate-y-0 dark:hover:bg-red-500/10">
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete CMA
          </button>
        </div>
        <p className="mt-3 text-[10px] font-semibold leading-relaxed text-gray-400">
          Something look wrong with this report's numbers or wording? Submit a ticket with the Report Code above so OpenHousePal support can pull up this exact CMA.
        </p>
      </SectionCard>

      <WarningConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete this CMA?"
        message="This will permanently remove the report, including any comps, pricing, and analysis you've added. This can't be undone."
        confirmText="Delete CMA"
        isLoading={isDeleting}
      />

      {showPdf && agent && (
        <CmaPdfModal
          report={report}
          agent={agent}
          onClose={() => setShowPdf(false)}
          onReportUpdated={onReportUpdated}
          onJump={onJump}
        />
      )}
      {showShare && shareLinks && (
        <CmaShareLinksModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          openHousePalUrl={shareLinks.openHousePalUrl}
          websiteUrl={shareLinks.websiteUrl}
        />
      )}
    </div>
  )
}

// v10 - the full deterministic audit trail behind the AI value. Agent-only, collapsed by
// default, and deliberately NOT part of any client-facing surface (never rendered in the PDF or
// the public report). "How this value was calculated."
function ValuationTracePanel({ trace }: { trace: CmaValuationTrace }) {
  const m = (v?: number | null) => (v == null ? '—' : formatMoney(v))
  const a = trace.anchor
  const exp = trace.exposure
  const gate = trace.above_ask_gate
  const qa = trace.qa
  const relevance = trace.relevance_weighting
  const btLabel: Record<string, string> = {
    paired_market_evidence: 'Paired market evidence',
    comp_inferred: 'Comp-inferred',
    model_judgment: 'Model judgment',
  }
  const btStyle: Record<string, string> = {
    paired_market_evidence: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    comp_inferred: 'bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974]',
    model_judgment: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  }
  const startingPoint = trace.deterministic_anchor ?? a?.anchor_value ?? null
  const finalValue = trace.reasoning_model_fmv ?? trace.final_fmv ?? null
  const marketAdjustment = trace.authority !== 'reasoning_model' && gate?.applied && gate.from != null && gate.to != null
    ? gate.to - gate.from
    : 0
  // "Property differences" must always equal the itemized list in section 3 below, never a
  // re-derived number - it used to be computed as a pure residual (final - start - market), which
  // silently absorbed whatever the reasoning model additionally judged beyond the deterministic
  // comp math (see _apply_reasoning_authority - that model's FMV is deliberately never clamped to
  // the deterministic benchmark), so the two numbers could disagree even though both were "correct"
  // for what they measured. Any leftover gap gets its own honest line below instead.
  const propertyAdjustment = trace.adjustment_total ?? (
    startingPoint != null && finalValue != null ? finalValue - startingPoint - marketAdjustment : null
  )
  const reasoningJudgment = (startingPoint != null && finalValue != null && propertyAdjustment != null)
    ? finalValue - startingPoint - propertyAdjustment - marketAdjustment
    : null
  const signedMoney = (value: number | null) => {
    if (value == null) return 'Not available'
    if (Math.abs(value) < 500) return 'No separate adjustment'
    const absolute = Math.abs(value)
    const compact = absolute >= 1_000_000
      ? `$${(absolute / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`
      : `$${Math.round(absolute / 1_000)}K`
    return `${value > 0 ? '+' : '-'}${compact}`
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-[#0B0B0B]">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">How this value was calculated</p>
      <div className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-800">
        <p className="flex items-center justify-between gap-4 py-2 first:pt-0"><span className="font-medium text-gray-500 dark:text-gray-400">Comparable sales</span><span className="text-right font-black text-[#111827] dark:text-white">{startingPoint != null ? `${m(startingPoint)} starting point` : 'Not available'}</span></p>
        <p className="flex items-center justify-between gap-4 py-2"><span className="font-medium text-gray-500 dark:text-gray-400">Property differences</span><span className="text-right font-black text-[#111827] dark:text-white">{signedMoney(propertyAdjustment)}</span></p>
        <p className="flex items-center justify-between gap-4 py-2"><span className="font-medium text-gray-500 dark:text-gray-400">Market exposure</span><span className="text-right font-black text-[#111827] dark:text-white">{signedMoney(marketAdjustment)}</span></p>
        {reasoningJudgment != null && Math.abs(reasoningJudgment) >= 500 && (
          <p className="flex items-center justify-between gap-4 py-2">
            <span className="font-medium text-gray-500 dark:text-gray-400" title="The reasoning model's own additional read on top of the deterministic comp math above - it is deliberately not clamped to match the itemized adjustments, see the detailed calculation below.">
              Reasoning judgment
            </span>
            <span className="text-right font-black text-[#111827] dark:text-white">{signedMoney(reasoningJudgment)}</span>
          </p>
        )}
        <p className="flex items-center justify-between gap-4 py-2 last:pb-0"><span className="font-medium text-gray-500 dark:text-gray-400">Final value</span><span className="text-right font-black text-[#111827] dark:text-white">{m(finalValue)}</span></p>
      </div>
      <details className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <summary className="cursor-pointer select-none text-xs font-black text-gray-500 marker:text-gray-400 dark:text-gray-400">Show detailed calculation</summary>
        <div className="mt-3 space-y-4 text-xs text-gray-600 dark:text-gray-300">

        {relevance?.density_context && (
          <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <p className="font-black text-[#111827] dark:text-white">Similarity and comp relevance</p>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Local proximity half-life {relevance.density_context.distance_half_life_miles.toFixed(2)} mi · {relevance.density_context.reference_count ?? 0} suitable local references · density distances {(relevance.density_context.density_distances_used_miles || []).map(v => `${v.toFixed(2)} mi`).join(', ') || '2.5-mi fallback'}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead><tr className="text-[10px] uppercase tracking-wide text-gray-400"><th className="py-1 pr-3">Comp</th><th className="py-1 pr-3">Match</th><th className="py-1 pr-3">Distance</th><th className="py-1 pr-3">Proximity</th><th className="py-1 pr-3">Modifier</th><th className="py-1 pr-3">Role / Weight</th></tr></thead>
                <tbody>{(relevance.comps || []).map((row, index) => (
                  <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-3 font-semibold text-[#111827] dark:text-white">{row.label}</td>
                    <td className="py-1 pr-3">{row.adjusted_relevance_score != null ? `${Math.round(row.adjusted_relevance_score * 100)}%` : '—'}</td>
                    <td className="py-1 pr-3">{row.candidate_distance_miles != null ? `${row.candidate_distance_miles} mi` : '—'}</td>
                    <td className="py-1 pr-3">{row.proximity_score_points != null ? `${row.proximity_score_points.toFixed(1)}/${row.proximity_max_points ?? 22}` : '—'}</td>
                    <td className="py-1 pr-3" title={(row.product_mismatch_reasons || []).join('; ')}>{row.product_modifier != null ? `×${row.product_modifier.toFixed(2)}` : '—'}</td>
                    <td className="py-1 pr-3">{row.proposed_role || '—'}{row.normalized_weight != null ? ` · ${(row.normalized_weight * 100).toFixed(1)}%` : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {trace.mode === 'insufficient_evidence' && (
          <section className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
            <p className="font-black text-red-700 dark:text-red-400">Insufficient comparable evidence</p>
            <p className="mt-1 text-red-800/90 dark:text-red-300/90">
              Only {trace.closed_comp_count ?? 0} verified closed sale(s) — not enough for a deterministic anchor. The value shown is a
              provisional {trace.provisional_range ? `${m(trace.provisional_range[0])}–${m(trace.provisional_range[1])}` : 'wide'} range
              {trace.provisional_centre_source ? ` around ${trace.provisional_centre_source}` : ''}, forced to Low confidence and held for your review before it can be exported.
            </p>
          </section>
        )}

        {a && a.anchor_value != null && (
          <section>
            <p className="mb-1 font-black text-[#111827] dark:text-white">
              1 · Deterministic comp anchor — {m(a.anchor_value)}
              <span className="ml-1.5 font-normal text-gray-400">
                {a.mode === 'closed_only' ? '(verified closed sales only)' : a.mode === 'mixed' ? '(mixed comps — no closed majority)' : ''}
              </span>
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Sale-price indication {m(a.sale_price_indication)} · $/sqft indication {m(a.psf_indication)} (${a.psf_indication_per_sqft}/sqft × {formatNumber(a.subject_sqft_used)} sqft) ·
              blend 60/40 · anchor range {m(a.anchor_low)}–{m(a.anchor_high)} (±{a.spread_pct}%) · size model: {a.size_model}
              {a.regression_slope_psf_per_sqft != null ? ` (slope ${a.regression_slope_psf_per_sqft}/sqft)` : a.size_elasticity_beta != null ? ` (β ${a.size_elasticity_beta})` : ''}
              {a.sale_psf_divergence_pct > 0 ? ` · sale-vs-$/sqft divergence ${a.sale_psf_divergence_pct}%` : ''}
              {a.comp_list_to_sale_median != null ? ` · comp list-to-sale median ${a.comp_list_to_sale_median}` : ''}
              {a.closed_comp_count != null ? ` · ${a.closed_comp_count} verified closed / ${a.weighted_comp_count ?? a.comps?.length ?? 0} weighted` : ''}
              {a.anchor_value_is_rough ? ' · rough fallback value (no weighted comp set)' : ''}
            </p>
            {a.psf_leg_normalized_comp_count != null && a.psf_leg_normalized_comp_count > 0 && (
              <p className="mt-0.5 text-gray-400">
                $/sqft leg: {a.psf_leg_normalized_comp_count} of {a.psf_leg_comp_count ?? a.comps?.length ?? 0} comps had a finished basement / unclear sqft split — their per-foot figures were normalized to an above-grade basis (raw $/sqft indication would have been {a.psf_indication_unnormalized != null ? `${m(a.psf_indication_unnormalized)}` : 'higher'}).
                {a.psf_leg_heuristic_comp_count != null && a.psf_leg_heuristic_comp_count > 0
                  ? ` ${a.psf_leg_heuristic_comp_count} used the fallback below-grade heuristic (no paired/local market evidence for the below-grade rate) — $/sqft-leg confidence reduced.`
                  : (a.paired_below_grade_psf != null ? ` Below-grade rate $${a.paired_below_grade_psf}/sqft derived from paired comps.` : '')}
              </p>
            )}
            {a.comps && a.comps.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="py-1 pr-3 font-bold">Comp</th><th className="py-1 pr-3 font-bold">Class</th>
                    <th className="py-1 pr-3 font-bold">Norm. wt</th><th className="py-1 pr-3 font-bold">Sold</th>
                    <th className="py-1 pr-3 font-bold">$/sqft</th><th className="py-1 pr-3 font-bold">Size-adj → subj</th>
                    <th className="py-1 pr-3 font-bold">$ to anchor</th>
                  </tr>
                </thead>
                <tbody>
                  {(a.comps ?? []).map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-1 pr-3 font-semibold text-[#111827] dark:text-white">
                        {c.label}{c.outlier ? ' ⚠' : ''}
                        {c.redundancy_penalty != null && c.redundancy_penalty < 1 ? ` ·×${c.redundancy_penalty}` : ''}
                        {c.below_grade_frac != null && c.below_grade_frac > 0.15 ? ' ·bg' : ''}
                        {c.psf_leg_eligibility && c.psf_leg_eligibility !== 'full' && (
                          <span className="ml-1 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400" title={c.below_grade_basis || c.psf_leg_exclusion_reason || 'sqft-composition normalized in the $/sqft leg'}>
                            {c.psf_leg_eligibility === 'excluded_from_psf_leg' ? 'psf-leg: excl' : c.psf_leg_eligibility === 'blended_downweighted' ? 'psf-leg: blended' : 'psf-leg: adj'}
                          </span>
                        )}
                        {c.location_weight_penalty != null && c.location_weight_penalty < 0.98 && (
                          <span className="ml-1 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400" title={(c.location_negatives || []).join(' · ')}>
                            loc ×{c.location_weight_penalty}
                          </span>
                        )}
                        {c.condition_class_promoted && (
                          <span className="ml-1 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400" title={`Kept in the anchor: a pure condition/renovation gap (${c.condition_gap_direction || 'finish difference'}) had demoted it; that belongs in the adjustment layer. ${c.condition_class_change || ''}`}>
                            cond-kept
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-3 capitalize">
                        {c.ai_class && c.validated_class && c.ai_class !== c.validated_class
                          ? <span className="text-amber-600 dark:text-amber-400">{c.ai_class}→{c.validated_class}</span>
                          : (c.strength || '—')}
                        {c.location_override ? <span className="ml-1 text-[9px] text-emerald-600 dark:text-emerald-400" title={'validated market-equivalence override'}>ovr</span> : ''}
                      </td>
                      <td className="py-1 pr-3">{c.normalized_weight}</td>
                      <td className="py-1 pr-3">{m(c.raw_sale_price)}</td>
                      <td className="py-1 pr-3">
                        ${c.raw_psf}{c.psf_used_in_leg != null && c.psf_used_in_leg !== c.raw_psf ? <span className="text-gray-400"> → ${c.psf_used_in_leg}</span> : null}
                      </td>
                      <td className="py-1 pr-3">{m(c.size_adjusted_price)}</td>
                      <td className="py-1 pr-3">{m(c.dollar_contribution_to_anchor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {a.context_comps && a.context_comps.length > 0 && (
              <p className="mt-1 text-gray-400">Context only (not in the anchor): {a.context_comps.map(cc => `${cc.label} ${m(cc.price)}`).join(' · ')}</p>
            )}
            {(trace.anchor_validity === 'weak' || trace.anchor_validity === 'invalid') && (
              <p className="mt-1 rounded-lg border border-red-300 bg-red-50 p-2 text-red-800/90 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300/90">
                <span className="font-black">Anchor validity: {trace.anchor_validity}.</span> {trace.anchor_validity_reason}. The comp set is
                inadequate to bound a precise value — confidence is forced Low, the range widened, and export is gated for your review.
                Rebuild from broader defensible closed sales if possible.
              </p>
            )}
            {trace.anchor_shift_from_provisional_pct != null && Math.abs(trace.anchor_shift_from_provisional_pct) > 0.1 && (
              <p className="mt-1 text-amber-600 dark:text-amber-400">Anchor moved {trace.anchor_shift_from_provisional_pct}% after the AI reclassified comps (shown {m(trace.provisional_anchor_value)}, final {m(a.anchor_value)}).</p>
            )}
          </section>
        )}

        {exp && (
          <section>
            <p className="mb-1 font-black text-[#111827] dark:text-white">2 · Market exposure — {exp.state.replace(/_/g, ' ')}</p>
            <p className="text-gray-500 dark:text-gray-400">
              Active-market days {exp.active_market_days ?? '—'}{exp.comp_median_dom != null ? ` (comp-set median ${exp.comp_median_dom})` : ''} ·
              {exp.dom_basis ? ` ${exp.dom_basis} ·` : ''}
              {exp.current_list_price != null ? ` current list ${m(exp.current_list_price)}` : ''}
              {exp.original_list_price != null && exp.original_list_price !== exp.current_list_price ? ` (from ${m(exp.original_list_price)}, −${exp.price_cut_pct}%)` : ''}
              {exp.exposure_ceiling != null ? ` · above-ask ceiling ${m(exp.exposure_ceiling)}` : ''}
              {exp.hard_upper != null ? ` · hard cap ${m(exp.hard_upper)}` : ''}
              {exp.verified_contract_price != null ? ` · verified contract price ${m(exp.verified_contract_price)}` : ''}
            </p>
            {exp.history_events && exp.history_events.length > 0 ? (
              <p className="mt-1 text-gray-400">
                Listing history: {exp.history_events.map(h => {
                  const when = h.date ? ` ${h.date}` : ''
                  const px = h.from_price != null && h.to_price != null ? ` ${m(h.from_price)}→${m(h.to_price)}` : h.price != null ? ` ${m(h.price)}` : ''
                  return `${h.event.replace(/_/g, ' ')}${when}${px}${h.source === 'inferred' ? ' [inferred]' : ''}`
                }).join(' · ')}
              </p>
            ) : exp.price_history && exp.price_history.length > 1 && (
              <p className="mt-1 text-gray-400">Price history: {exp.price_history.map(h => `${h.event.replace(/_/g, ' ')} ${m(h.price)}`).join(' → ')}</p>
            )}
            {(exp.prior_failed_contract || exp.back_on_market) && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {exp.prior_failed_contract ? 'A prior contract fell through. ' : ''}{exp.back_on_market ? 'The listing has been back on market at least once. ' : ''}
                Treated as context to weigh, not an automatic negative.
              </p>
            )}
            {exp.meaning && <p className="mt-1 italic text-gray-500 dark:text-gray-400">{exp.meaning}</p>}
            {exp.relisted_note && !exp.history_events && <p className="mt-1 text-gray-500 dark:text-gray-400">{exp.relisted_note}</p>}
          </section>
        )}

        {trace.adjustments && trace.adjustments.length > 0 && (
          <section>
            <p className="mb-1 font-black text-[#111827] dark:text-white">
              3 · Qualitative adjustments — net {trace.adjustment_total != null && trace.adjustment_total >= 0 ? '+' : ''}{m(trace.adjustment_total)} (bound ±{trace.adjustment_bound_pct}%)
            </p>
            {trace.anchor_dispute && (
              <p className="mb-1 text-amber-600 dark:text-amber-400">Anchor disputed by AI: “{trace.anchor_dispute_reason}” — bound widened to ±18%, confidence capped at medium.</p>
            )}
            <ul className="space-y-1.5">
              {trace.adjustments.map((p, i) => (
                <li key={i} className="rounded-lg bg-[#fbfaf7] p-2 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${p.direction === 'up' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>Applied {p.direction === 'up' ? '↑' : '↓'} {m(Math.abs(p.applied))}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${btStyle[p.basis_type]}`}>{btLabel[p.basis_type] || p.basis_type}</span>
                    {p.original_basis_type && p.original_basis_type !== p.basis_type && (
                      <span className="text-amber-600 dark:text-amber-400">· downgraded from {btLabel[p.original_basis_type] || p.original_basis_type}</span>
                    )}
                    <span className="font-semibold text-[#111827] dark:text-white">{p.factor}</span>
                    <span className="text-gray-400">raw evidence range {m(p.amount_low)}–{m(p.amount_high)} · conf {p.confidence}</span>
                    {p.capped && <span className="text-amber-600 dark:text-amber-400">· per-item capped</span>}
                    {p.subcap_scaled && <span className="text-amber-600 dark:text-amber-400">· sub-cap scaled</span>}
                    {p.family_deduped && <span className="text-amber-600 dark:text-amber-400">· family-deduped</span>}
                    {p.qual_recon_scaled && <span className="text-amber-600 dark:text-amber-400">· qual-recon scaled</span>}
                  </div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">{p.basis}</p>
                  {p.validation_note && <p className="mt-0.5 text-amber-600 dark:text-amber-400">Validator: {p.validation_note}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(() => {
          const qr = trace.qualitative_reconciliation
          const sigs: [string, typeof trace.weighted_condition_signal][] = [
            ['Condition', trace.weighted_condition_signal],
            ['Location', trace.weighted_location_signal],
            ['Amenities', trace.weighted_amenity_signal],
            ['Layout / auxiliary-space proxy', trace.weighted_accessory_space_signal],
          ]
          const anySig = sigs.some(([, s]) => s && s.weight_covered > 0)
          if (!qr && !anySig) return null
          const lines = [
            ...(qr?.conflicts || []).map(x => ['conflict', x] as const),
            ...(qr?.omissions || []).map(x => ['omission', x] as const),
            ...(qr?.offsets_accepted || []).map(x => ['offset accepted', x] as const),
            ...(qr?.adjustments_scaled || []).map(x => ['scaled', x] as const),
            ...(qr?.diagnostic_notes || []).map(x => ['diagnostic note', x] as const),
          ]
          return (
            <section>
              <p className="mb-1 font-black text-[#111827] dark:text-white">3b · Weighted qualitative read vs. the adjustments</p>
              {anySig && (
                <p className="text-gray-500 dark:text-gray-400">
                  {sigs.filter(([, s]) => s && s.weight_covered > 0).map(([label, s]) => (
                    `${label}: ${s!.direction === 'subject_inferior' ? 'subject inferior' : s!.direction === 'subject_superior' ? 'subject superior' : 'similar/mixed'} (signal ${s!.signal > 0 ? '+' : ''}${s!.signal}, ${Math.round(s!.weight_covered * 100)}% of weight)`
                  )).join(' · ')}
                </p>
              )}
              {lines.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {lines.map(([kind, txt], i) => (
                    <li key={i} className={kind === 'offset accepted' ? 'text-gray-500 dark:text-gray-400' : 'text-amber-600 dark:text-amber-400'}>
                      <span className="font-bold uppercase text-[9px] tracking-wide">{kind}</span> — {txt}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })()}

        <section>
          <p className="mb-1 font-black text-[#111827] dark:text-white">4 · Above-ask gate & final</p>
          <p className="text-gray-500 dark:text-gray-400">
            Anchor + adjustments (pre-exposure) {m(trace.fmv_pre_exposure)}
            {gate?.applied
              ? gate.action === 'pulled_down'
                ? ` → pulled from ${m(gate.from)} to ${m(gate.to)} (ceiling ${m(gate.ceiling)}, paired-evidence premium ${m(gate.paired_evidence_premium)})`
                : gate.action === 'allowed_above_ceiling'
                  ? ` → allowed above the ${m(gate.ceiling)} ceiling (covered by: ${(gate.justified_by || []).join(', ') || 'none'})`
                  : gate.action === 'capped_by_exposure'
                    ? ` → capped by exposure from ${m(gate.from)} to ${m(gate.to)}`
                    : gate.action === 'clamped_to_contract_price'
                      ? ` → clamped to within 3% of the verified contract price ${m(gate.contract_price)} (from ${m(gate.from)} to ${m(gate.to)})`
                    : gate.action === 'extended_pull'
                      ? ` → extended-exposure pull to ${m(gate.extended_pull_to)}`
                      : ''
              : ' → gate not triggered'}
          </p>
          <p className="mt-1">
            <span className="font-black text-[#111827] dark:text-white">Final FMV {m(trace.final_fmv)}</span>
            <span className="text-gray-400"> · range ±{trace.range_pct}%{trace.range_floor_pct != null ? ` (floor ${trace.range_floor_pct}%)` : ''} · confidence {trace.confidence_seed}
              {trace.subject_asking != null ? ` · list ${m(trace.subject_asking)}` : ''}
              {trace.ai_value_cross_check != null ? ` · AI cross-check ${m(trace.ai_value_cross_check)}` : ''}
            </span>
          </p>
        </section>

        {qa && (
          <section>
            <p className="mb-1 font-black text-[#111827] dark:text-white">
              5 · Pre-export QA
              <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${qa.export_allowed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                {qa.export_allowed ? 'export allowed' : 'export blocked'}
              </span>
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              {qa.checks_run.length} deterministic checks run · {qa.blocking_errors.length} blocking · {qa.warnings.length} warning(s) · {qa.corrections.length} auto-correction(s)
            </p>
            {qa.blocking_errors.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-red-700 dark:text-red-400">
                {qa.blocking_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {qa.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-amber-600 dark:text-amber-400">
                {qa.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {qa.corrections.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-gray-500 dark:text-gray-400">
                {qa.corrections.map((cx, i) => <li key={i}>{cx}</li>)}
              </ul>
            )}
          </section>
        )}
        </div>
      </details>
    </div>
  )
}

function CmaPdfModal({ report, agent, onClose }: { report: CmaReport, agent: any, onClose: () => void, onReportUpdated: (r: CmaReport) => void, onJump: (s: StepId) => void, skipAutoRefresh?: boolean }) {
  // The generated report is always final and export-ready the moment generation completes - every
  // fix that can be made runs automatically inside the generation pipeline itself, before this
  // report is ever saved. So this preview never gates on QA state, never shows a "needs your
  // attention" popup, and never asks the agent to regenerate/recompute from here - the download is
  // simply always available. Any remaining QA diagnostics are agent-only info on the Review step's
  // "QA / Review Items" panel, not a blocker here.
  const liveReport = report
  const fileName = `CMA-${(liveReport.subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70">
      <div className="flex items-center justify-between bg-[#111827] px-5 py-3">
        <p className="text-sm font-black text-white">CMA Presentation Preview</p>
        <div className="flex items-center gap-2">
          <PDFDownloadLink document={<CmaPresentationDocument report={liveReport} agent={agent} />} fileName={fileName}>
            {({ loading }) => (
              <span className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Download PDF
              </span>
            )}
          </PDFDownloadLink>
          <button onClick={onClose} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="flex-1">
        <PDFViewer width="100%" height="100%" showToolbar={false}>
          <CmaPresentationDocument report={liveReport} agent={agent} />
        </PDFViewer>
      </div>
    </div>
  )
}
