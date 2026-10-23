'use client'

import OhpLoader, { OhpSpinner } from '@/components/brand/OhpLoader'

import { hasEmailSignatureAccess } from '@/lib/navAccess'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FlowDock from '@/components/ui/FlowDock'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { smartBackClick } from '@/lib/navHistory'
import {
  AlertTriangle, ArrowLeft, ArrowUpDown, Bath, Bed, Building2, Calculator, Calendar, Car, Check, ChevronLeft, Clock,
  ChevronRight, ChevronsLeft, ChevronsRight, DollarSign, Download, Droplets, ExternalLink, GraduationCap, GripVertical, Home, LandPlot, Layers,
  Image as ImageIcon, Loader2, MapPin, Moon, Plus, RefreshCw, Ruler, Scale, Search, Share2, ShieldAlert, Sparkles, Sun, Trash2, Waves, X,
} from 'lucide-react'
import { usePdfFile } from '@/lib/pdfFile'
import SubjectAddressSearch from '@/components/cma/SubjectAddressSearch'
import CurrentCompetition from '@/components/cma/CurrentCompetition'
import type { HomeSearchResult } from '@/lib/api-service'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEscapeToClose, useIsPhone, useLastValue, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { FADE_HOME, NavButton, SHEET_SPRING, SideArrow, SLIDE_HOME, SPRING as SHEET_DESKTOP_SPRING, streetSize, type HomeMove } from '@/components/PropertyDetailsModal'
import { PropertySurface, pp } from '@/components/property/PropertyKit'
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
import CmaHowWeGotThere from '@/components/cma/CmaHowWeGotThere'
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
          className="absolute bottom-1.5 left-1.5 top-1.5 rounded-xl bg-gradient-to-r from-[#111827] via-[#8b7355] to-[#C9A24D] shadow-[0_10px_30px_-18px_rgba(201,162,77,0.9)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] dark:from-white dark:via-[#d7b974] dark:to-[#C9A24D]"
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
                className={`group flex min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-black uppercase tracking-wide transition-all duration-500 active:scale-95 sm:gap-2 sm:px-2.5 sm:text-[10px] lg:text-[11px] ${showLabels ? 'flex-col !gap-0.5' : ''} ${
                  isCurrent
                    ? 'scale-[1.02] bg-white text-[#111827] shadow-md ring-1 ring-[#C9A24D]/40 dark:bg-[#0B0B0B] dark:text-white'
                    : isActiveZone
                      ? 'text-white hover:bg-white/10 dark:text-[#111827] dark:hover:bg-black/5'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-[#8b7355] dark:hover:bg-gray-800 dark:hover:text-[#d7b974]'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition sm:h-6 sm:w-6 ${
                  isCurrent
                    ? 'cma-step-current bg-[#C9A24D] text-white shadow-[0_0_0_4px_rgba(201,162,77,0.16)]'
                    : isDone
                      ? 'bg-white/20 text-white ring-1 ring-white/30 dark:bg-black/10 dark:text-[#111827] dark:ring-black/10'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}>
                  {isDone ? <Check key={`done-${s.id}`} className="cma-check-pop h-3 w-3" strokeWidth={3} /> : i + 1}
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
  // Steps slide in from the side they're coming from: forward from the right, back from the left.
  const reduceMotion = useReducedMotion()
  const stepIndex = STEPS.findIndex(s => s.id === step)
  const prevStepIndex = useRef(stepIndex)
  const stepDir = stepIndex >= prevStepIndex.current ? 1 : -1
  useEffect(() => { prevStepIndex.current = stepIndex }, [stepIndex])
  // Every step change (Continue, the step bar, a jump from Review) starts at the top of the new
  // step (user, 10/20) - instantly, while the old step is already gone and the new one slides in,
  // so it never reads as a scroll. Any box still focused is let go first, which also puts a
  // phone's keyboard away instead of carrying it (and a zoom) into the next step.
  useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body) active.blur()
    const html = document.documentElement
    const behavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    html.style.scrollBehavior = behavior
  }, [step])
  const initialStepSet = useRef(false)
  // Once the agent has visited the Analysis step, keep it mounted for the rest of the session so
  // an in-flight "Create AI Analysis" run - its progress bar, staged scan, generating state -
  // survives switching to another step and coming back (it's just hidden, never unmounted).
  const [analysisMounted, setAnalysisMounted] = useState(false)
  // The comp step stays mounted too once opened (user, 10/21: going to Analysis and back re-ran the
  // whole search and redrew the map) - it's hidden, not rebuilt, and resyncs its picks when shown.
  const [compsMounted, setCompsMounted] = useState(false)
  useEffect(() => { if (step === 'analysis') setAnalysisMounted(true) }, [step])
  useEffect(() => { if (step === 'comps') setCompsMounted(true) }, [step])

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
    // cma-touch (globals.css): no zoom-in on phones when a box is tapped or the page double-tapped.
    <div className="cma-touch min-h-screen overflow-x-clip bg-[#faf9f7] pb-24 dark:bg-[#0B0B0B] sm:pb-0">
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
        <motion.div
          key={step}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: stepDir * 32 }}
          animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } }}
          className={`mt-4 sm:mt-6 ${step === 'analysis' || step === 'comps' ? 'hidden' : ''}`}
        >
          {step === 'subject' && <SubjectStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('comps')} />}
          {step === 'pricing' && <PricingStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('summary')} onBack={() => setStep('analysis')} />}
          {step === 'summary' && <SummaryStep report={report} onSave={save} onReportUpdated={applyReport} onJump={setStep} onDeleted={() => router.push('/studio/cma')} />}
        </motion.div>
        {(compsMounted || step === 'comps') && (
          <div className={step === 'comps' ? 'mt-4 animate-step-in sm:mt-6' : 'hidden'}>
            <CompsStep report={report} visible={step === 'comps'} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('analysis')} onBack={() => setStep('subject')} />
          </div>
        )}
        {(analysisMounted || step === 'analysis') && (
          <div className={step === 'analysis' ? 'mt-4 animate-step-in sm:mt-6' : 'hidden'}>
            <AnalysisStep report={report} visible={step === 'analysis'} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('pricing')} onBack={() => setStep('comps')} />
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

// The gold pill slides from the old choice to the new one (subject step's Search / My Listings /
// Enter Manually). Phones: the choices share one full-width row.
function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T, label: string, short?: string }[], value: T | null | undefined, onChange: (v: T) => void }) {
  const groupId = useId()
  const reduce = useReducedMotion()
  return (
    <div className="grid w-full grid-flow-col gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/70 sm:inline-grid sm:w-auto">
      {options.map(opt => {
        const on = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={on}
            className={`relative rounded-lg px-2 py-2 text-[10.5px] font-black uppercase tracking-wide transition-colors duration-200 active:scale-[0.97] sm:px-3.5 sm:text-[11px] ${on ? 'text-white' : 'text-gray-600 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}
          >
            {on && (
              <motion.span
                layoutId={reduce ? undefined : `seg-${groupId}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#b8923f] to-[#C9A24D] shadow-[0_8px_18px_-10px_rgba(201,162,77,0.9)]"
              />
            )}
            <span className="relative whitespace-nowrap"><span className="sm:hidden">{opt.short || opt.label}</span><span className="hidden sm:inline">{opt.label}</span></span>
          </button>
        )
      })}
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
        className="cma-btn inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]"
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
  const { showToast } = useToast()
  const [subject, setSubject] = useState<CmaSubjectProperty>(report.subject)
  const [mode, setMode] = useState<'search' | 'mine' | 'manual'>('search')
  const reduceMotion = useReducedMotion()
  // The listing being loaded after a tap in My Listings (its row shows a spinner + scan).
  const [pickingKey, setPickingKey] = useState<string | null>(null)
  // Which way the picker's panel slides: toward the tab that was picked.
  const modeIndex = (['search', 'mine', 'manual'] as const).indexOf(mode)
  const prevModeIndex = useRef(modeIndex)
  const modeDir = modeIndex >= prevModeIndex.current ? 1 : -1
  useEffect(() => { prevModeIndex.current = modeIndex }, [modeIndex])
  const [myListings, setMyListings] = useState<MyListingItem[]>([])
  const hasSubject = Boolean(subject.street_address)
  const subjectLoaded = useRef(false)

  useEffect(() => { setSubject(report.subject); subjectLoaded.current = false }, [report.id])

  // A report saved with a thin MLS subject (picked from My Listings before 10/20) is filled in from
  // the Bright record when it opens - only blanks are filled, nothing the agent typed is replaced.
  useEffect(() => {
    const s = report.subject
    if (s?.source !== 'mls' || !s.listing_key) return
    if (s.latitude != null && s.school_district && s.public_remarks && s.township) return
    let cancelled = false
    api.cma.subjectFromListing(s.listing_key).then(r => {
      if (cancelled || !r.success || !r.data) return
      const full = r.data
      setSubject(cur => {
        const merged: CmaSubjectProperty = { ...cur }
        for (const [k, v] of Object.entries(full) as [keyof CmaSubjectProperty, unknown][]) {
          const now = merged[k] as unknown
          if ((now == null || now === '' || (Array.isArray(now) && now.length === 0)) && v != null && v !== '') {
            (merged as unknown as Record<string, unknown>)[k] = v
          }
        }
        if ((full.photos?.length || 0) > (cur.photos?.length || 0)) merged.photos = full.photos
        return merged
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])

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


  // Every MLS pick fills the WHOLE subject from our Bright record (10/20: picking "My listing"
  // filled only address, price, beds/baths/sqft and one photo - no map location, school district,
  // township, county, lot, basement, utilities or description - and the address lookup itself
  // leaves out water, sewer, taxes and garage).
  const fullSubjectFor = async (listingKey?: string | null): Promise<CmaSubjectProperty | null> => {
    if (!listingKey) return null
    const r = await api.cma.subjectFromListing(listingKey)
    return r.success && r.data ? r.data : null
  }

  // The address box (components/cma/SubjectAddressSearch, 10/21): a pick loads that exact listing -
  // a sold or off-market record too - so a condo unit can't come back as another unit or its rental.
  const pickSearchResult = async (home: HomeSearchResult) => {
    const full = await fullSubjectFor(home.listingKey)
    if (full) { setSubject(full); return }
    const r = await api.properties.lookup(home.address)
    if (r.success && r.data) setSubject(mapPropertyToSubject(r.data))
  }

  const selectMyListing = async (listing: MyListingItem) => {
    const full = await fullSubjectFor(listing.listing_key)
    if (full) { setSubject(full); return }
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
    // A CMA values a sale (grader, 10/21: 1420 Locust St #23H was a $1,995/month rental and got a
    // "$1,850 value" against rental comps). Same rule as the backend's is_lease_listing.
    const isRental = /lease/i.test(String(subject.property_type || '')) || (!!subject.list_price && subject.list_price < 10000)
    if (isRental) {
      showToast("This is a rental listing - a CMA is for sales. Pick the home's sale listing or enter it by hand as a sale.", 'error')
      return
    }
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
      {/* Picking a property and the picked property's card swap with a soft lift (user, 10/20). */}
      <AnimatePresence mode="wait" initial={false}>
      {!hasSubject ? (
        <motion.div key="pick" {...SUBJECT_SWAP}>
        <SectionCard title="Select the Subject Property" subtitle="Search by address, pick one of your listings, or enter it manually.">
          <div className="flex flex-wrap gap-1.5">
            <SegmentedControl
              options={[{ value: 'search', label: 'Search Address', short: 'Search' }, { value: 'mine', label: 'My Listings' }, { value: 'manual', label: 'Enter Manually', short: 'Manual' }]}
              value={mode}
              onChange={v => v === 'manual' ? startManual() : setMode(v)}
            />
          </div>

          {/* Each way of picking slides in from the side of its tab. */}
          <AnimatePresence mode="wait" initial={false} custom={modeDir}>
          <motion.div
            key={mode}
            custom={modeDir}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: modeDir * 18 }}
            animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 36 } }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -modeDir * 18, transition: { duration: 0.12 } }}
          >
          {mode === 'search' && <div className="mt-4"><SubjectAddressSearch autoFocus onPick={pickSearchResult} onEnterManually={() => startManual()} /></div>}

          {mode === 'manual' && <ManualAddressPicker onPick={pickManualAddress} />}

          {mode === 'mine' && (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto p-0.5">
              {myListings.length === 0 && <p className="py-6 text-center text-sm font-semibold text-gray-400">No active listings found.</p>}
              {myListings.map((listing, i) => (
                <motion.button
                  key={listing.listing_key}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.04, type: 'spring', stiffness: 420, damping: 34 } }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!!pickingKey}
                  onClick={async () => { setPickingKey(listing.listing_key); try { await selectMyListing(listing) } finally { setPickingKey(null) } }}
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-2.5 text-left transition-[border-color,background-color,box-shadow] duration-200 hover:border-[#C9A24D]/50 hover:bg-[#C9A24D]/[0.04] dark:border-gray-800 ${pickingKey === listing.listing_key ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] shadow-[0_0_0_3px_rgba(201,162,77,0.18)] dark:border-[#C9A24D]' : 'border-gray-100'}`}
                >
                  {listing.image ? <img src={normalizeImageUrl(listing.image || undefined)} alt="" className="h-12 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{listing.address}</p>
                    <p className="text-xs font-semibold text-gray-400">{listing.price ? formatMoney(listing.price) : ''} {listing.bedrooms ? `· ${listing.bedrooms} bd` : ''} {listing.bathrooms ? `· ${listing.bathrooms} ba` : ''}</p>
                  </div>
                  {/* picked: the row lights up gold and a check pops in right away - it reads as
                      "selected" even when the listing loads too fast for any progress effect */}
                  {pickingKey === listing.listing_key
                    ? <span className="cma-check-pop flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow"><Check className="h-3 w-3" strokeWidth={3} /></span>
                    : <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
                </motion.button>
              ))}
            </div>
          )}
          </motion.div>
          </AnimatePresence>
        </SectionCard>
        </motion.div>
      ) : (
        <motion.div key="subject" {...SUBJECT_SWAP} className="space-y-5">
        <SectionCard
          title="Subject Property"
          subtitle={subject.source === 'manual' && !subject.listing_key ? "Fill in the home's facts - the more complete they are, the better the value." : "Edit any fact that isn't quite right."}
          right={
            // Find Comparables sits up here too (user, 10/21: the facts list is long, and scrolling
            // to the bottom for the next step was a chore on a phone and on a computer). Change
            // Property shrank to a small pill beside it. Phones keep a second Find Comparables at
            // the bottom for whoever did scroll through every fact.
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <button
                onClick={() => setSubject({ source: 'manual' } as CmaSubjectProperty)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-gray-200 px-2.5 text-[10px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400 dark:hover:border-[#C9A24D] dark:hover:text-[#d7b974]"
              >
                <RefreshCw className="h-3 w-3" /> Change
              </button>
              <button onClick={handleContinue} className="cma-btn inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-[13px] font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
                Find Comparables <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
          }
        >
          <SubjectFactsEditor reportId={report.id} subject={subject} setSubject={setSubject} area={area} />
        </SectionCard>
        {/* Phones: the flow bar (components/ui/FlowDock) - Find comps on the right, always in reach. */}
        <FlowDock step={1} total={5} onContinue={handleContinue} continueLabel="Find comps" />
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

// The subject step's two states (choosing a property / the picked property's facts) swap with a
// fade + lift; reduced motion just fades (framer-motion skips the transform there).
const SUBJECT_SWAP = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 32 } },
  exit: { opacity: 0, y: -10, scale: 0.99, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
} as const

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
    property_condition: p.PropertyCondition ?? null,
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
    property_condition: c.property_condition ?? null,
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
const RADIUS_STEPS = [1, 2, 3, 5, 8, 10]   // never 25 mi (grader 10/21); the first search is server-side now
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
function CmaFactChip({ icon: Icon, value, label, compact, dynamicSpan, span, secondary, vs, className = '' }: {
  icon: any, value: string | number, label: string, compact?: boolean, dynamicSpan?: boolean,
  /** fixed column span (the desktop side-by-side gives subject and comp the same one, so rows line up) */
  span?: number,
  secondary?: { value: string | number, label: string },
  /** How this value compares with the subject's (desktop side-by-side, same colours as the phone
   *  head-to-head): gold + ▲/▼ and the difference, or a green "Same". */
  vs?: ChipVs | null, className?: string,
}) {
  const differs = vs && vs.tone !== 'same'
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border bg-white text-center dark:bg-[#0B0B0B] ${differs ? 'border-[#C9A24D]/45' : 'border-gray-200 dark:border-gray-800'} ${compact ? 'min-h-[64px] gap-0.5 px-0.5 py-1.5' : 'gap-1 py-2'} ${className}`}
      style={secondary ? { gridColumn: 'span 2 / span 2' } : span ? { gridColumn: `span ${span} / span ${span}` } : dynamicSpan ? { gridColumn: `span ${chipSpan(value)} / span ${chipSpan(value)}` } : undefined}
    >
      <Icon className={compact ? 'h-3 w-3 text-[#C9A24D]' : 'h-3.5 w-3.5 text-[#C9A24D]'} />
      <span className={`max-w-full truncate rounded px-0.5 font-black leading-tight ${differs ? 'cma-diff text-[#7a5a1e] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'} ${chipValueTextClass(value, compact)}`}>{value}</span>
      <span className={`font-black uppercase tracking-widest text-gray-400 ${compact ? 'text-[6px]' : 'text-[7px]'}`}>{label}</span>
      {secondary && (
        <>
          <span className={`-mt-0.5 max-w-full truncate px-0.5 font-black leading-tight text-[#111827] dark:text-white ${chipValueTextClass(secondary.value, compact)}`}>{secondary.value}</span>
          <span className={`font-black uppercase tracking-widest text-gray-400 ${compact ? 'text-[6px]' : 'text-[7px]'}`}>{secondary.label}</span>
        </>
      )}
      {vs && (vs.tone === 'same'
        ? <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><Check className="h-2.5 w-2.5" strokeWidth={3} /> Same</span>
        : vs.text
          ? <span className={`max-w-full truncate px-0.5 text-[8.5px] font-black ${vs.tone === 'up' ? 'text-[#8b7355] dark:text-[#d7b974]' : vs.tone === 'down' ? 'text-slate-500 dark:text-slate-400' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>{vs.tone === 'up' ? '▲ ' : vs.tone === 'down' ? '▼ ' : ''}{vs.text}</span>
          : null)}
    </div>
  )
}

type ChipVs = { tone: 'same' | 'up' | 'down' | 'diff', text?: string }

// The comp's value against the subject's, for CmaFactChip's `vs`: numbers get ▲ / ▼ and the
// difference, text gets same / different; nothing when either side is missing.
function chipVs(subjectValue: number | string | null | undefined, compValue: number | string | null | undefined,
  opts: { money?: boolean, unit?: string, decimals?: number } = {}): ChipVs | null {
  if (subjectValue == null || compValue == null || subjectValue === '' || compValue === '' || subjectValue === '—' || compValue === '—') return null
  if (typeof subjectValue === 'number' && typeof compValue === 'number') {
    const d = compValue - subjectValue
    if (Math.abs(d) < (opts.decimals ? 0.005 : 0.5)) return { tone: 'same' }
    const abs = Math.abs(d)
    const shown = opts.money ? formatMoney(abs, { compact: true }) : abs.toLocaleString(undefined, { maximumFractionDigits: opts.decimals ?? 0 })
    return { tone: d > 0 ? 'up' : 'down', text: `${shown}${opts.unit ? ` ${opts.unit}` : ''}` }
  }
  return String(subjectValue).trim().toLowerCase() === String(compValue).trim().toLowerCase() ? { tone: 'same' } : { tone: 'diff' }
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
// One span for a subject chip and its comp twin - the wider of the two - so both stat grids wrap the
// same way and their rows line up (user, 10/21).
function pairSpan(a?: string | number | null, b?: string | number | null): number {
  const v = (x?: string | number | null) => (x == null || x === '' ? 1 : chipSpan(typeof x === 'number' ? formatNumber(x) : x))
  return Math.max(v(a), v(b))
}

// Above-grade finished area, falling back to the total on record - the one size basis for every comp
// card, comparison tile, $/sqft and size gap (grader, V2 Windham 10/21: the cards showed Jennifer Ln
// at -636 sf and $201/sqft on total area, the report $260 above grade).
function agSqft(d?: { above_grade_finished_area?: number | null, sqft?: number | null } | null): number | null {
  return d?.above_grade_finished_area || d?.sqft || null
}

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

function CompsStep({ report, visible = true, onSave, onReportUpdated, onNext, onBack }: { report: CmaReport, visible?: boolean, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onNext: () => void, onBack?: () => void }) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(report.comparables)
  const [statuses, setStatuses] = useState<CmaCompStatus[]>(['sold'])
  // Starts at the tightest step and auto-widens (see runSearch) rather than defaulting straight
  // to a fixed radius - stops the moment the agent drags the circle/slider themselves.
  const [radius, setRadius] = useState(RADIUS_STEPS[0])
  const autoRadiusRef = useRef(true)
  const radiusExtraStepRef = useRef(false)
  // The first search is one server call that picks its own radius + sold window (grader 10/21: it
  // used to widen to 25 mi chasing five 70%+ matches). Setting the chosen radius/days afterwards
  // would re-run the same search once - this skips that echo.
  const skipEchoSearchRef = useRef(false)
  const [limitedNote, setLimitedNote] = useState<string | null>(null)
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
  // Phones show the results list OR the map (both at once stacked a crowded map under a long list).
  const [phoneView, setPhoneView] = useState<'list' | 'map'>('list')
  // Tablet / computer (user, 10/21): list only, map only, or both side by side (the default).
  const [deskView, setDeskView] = useState<'both' | 'list' | 'map'>('both')
  // The desktop card grid scrolls on its own - each new page of results starts at its top.
  const compGridRef = useRef<HTMLDivElement>(null)
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

  // Shown again after another step: take the saved picks (Analysis may have reordered or rated them)
  // without re-saving them; the search results and map stay as they were.
  const wasVisible = useRef(visible)
  useEffect(() => {
    if (visible && !wasVisible.current) {
      comparablesLoaded.current = false
      setComparables(report.comparables)
    }
    wasVisible.current = visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

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
    if (skipEchoSearchRef.current) { skipEchoSearchRef.current = false; return }
    setSearching(true)
    setSearched(true)
    const seq = ++searchSeqRef.current
    if (autoRadiusRef.current && autoSoldDaysRef.current && statuses.length === 1 && statuses[0] === 'sold') {
      api.cma.autoSearchComparables({
        listing_key: report.subject.listing_key || undefined,
        subject: { ...scoreSubject, state: report.subject.state, list_price: report.subject.list_price, street_address: report.subject.street_address, zipcode: report.subject.zipcode },
        latitude: report.subject.latitude,
        longitude: report.subject.longitude,
        subject_sqft: report.subject.above_grade_finished_area || report.subject.sqft,
        property_type: report.subject.property_type,
        statuses,
        min_beds: minBeds ? minBeds : undefined,
      }).then(r => {
        if (seq !== searchSeqRef.current) return
        setSearching(false)
        autoRadiusRef.current = false
        autoSoldDaysRef.current = false
        if (r.success && r.data) {
          const authoritative = r.data.results.filter(candidate => typeof candidate.match_score === 'number'
            && candidate.similarity_details?.scoring_authority === 'backend_continuous_relevance')
          setResults(authoritative)
          setLimitedNote(r.data.limited ? (r.data.limited_message || 'Limited comparable sales - agent review recommended.') : null)
          skipEchoSearchRef.current = true
          setRadius(r.data.radius_miles)
          setSoldWithinDays(String(r.data.sold_within_days))
          if (r.data.price_band?.[0] != null) setMinPrice(String(r.data.price_band[0]))
          if (r.data.price_band?.[1] != null) setMaxPrice(String(r.data.price_band[1]))
        } else {
          showToast(r.error || 'Search failed.', 'error')
        }
        setOptimizing(false)
      })
      return
    }
    setLimitedNote(null)
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
  const phoneListRef = useRef<HTMLDivElement>(null)
  const firstPageRender = useRef(true)
  useEffect(() => {
    compGridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    // Phones: the Pager sits under the list - bring the top of the new page into view.
    if (firstPageRender.current) { firstPageRender.current = false; return }
    const list = phoneListRef.current
    if (list && list.offsetParent !== null) window.scrollTo({ top: Math.max(0, list.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' })
  }, [compsPage])
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
    // Wait for the auto-widen chain to settle: picking (and autosaving the report) after every
    // intermediate search re-rendered the whole page between steps - 4-6 s gaps on the live site
    // (10/20) while "5 comps selected" already showed above a still-spinning "Finding the best
    // comparables" panel. One pick, one save, once the final result set is in.
    if (optimizing) return
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
  }, [sortedResults, optimizing])

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
      const subjectPsf = subject.list_price && agSqft(subject) ? pricePerSqft(subject.list_price, agSqft(subject)) : null
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
    const psf = pricePerSqft(effectiveCompPrice(c as unknown as CmaComparable), agSqft(c))
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
    <div className="space-y-5 pb-24 sm:pb-0">
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
          <button type="button" onClick={() => setRefineOpen(true)} className="cma-btn inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] sm:gap-2 sm:px-4">
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
            {/* Phones get the Continue bar pinned to the bottom instead (below). */}
            <div className="hidden items-center gap-2 sm:flex">
              {!optimizing && results.length > 0 && (
                <div role="group" aria-label="Show list, map or both" className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-[#151517]">
                  {([['list', 'List', Layers], ['both', 'Both', null], ['map', 'Map', MapPin]] as const).map(([v, label, Icon]) => (
                    <button key={v} type="button" aria-pressed={deskView === v} onClick={() => setDeskView(v)}
                      className={`inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${deskView === v ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                      {Icon && <Icon className="h-3.5 w-3.5" />} {label}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-xs font-bold text-gray-400">{comparables.length} added</span>
              <button
                onClick={handleContinue}
                disabled={comparables.length === 0}
                className="cma-btn inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]"
              >
                Continue <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          </div>

          {/* Phones: List or Map - the picked one's pill slides across. */}
          {!optimizing && results.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm dark:bg-[#151517] sm:hidden">
              {(['list', 'map'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPhoneView(v)}
                  aria-pressed={phoneView === v}
                  className={`relative flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${phoneView === v ? 'text-white dark:text-[#111827]' : 'text-gray-500'}`}
                >
                  {phoneView === v && <motion.span layoutId="cma-comps-view" transition={{ type: 'spring', stiffness: 520, damping: 38 }} className="absolute inset-0 rounded-lg bg-[#111827] dark:bg-white" />}
                  <span className="relative inline-flex items-center gap-1.5">
                    {v === 'list' ? <><Layers className="h-3.5 w-3.5" /> List · {sortedResults.length}</> : <><MapPin className="h-3.5 w-3.5" /> Map</>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!optimizing && limitedNote && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {limitedNote}
            </div>
          )}
          {optimizing ? (
            // Covers the whole first-load auto-widen chain (radius and/or sold-days stepping up
            // search after search), not just one request - staying up through every intermediate
            // step is what actually stops the grid from flashing a different result set on every
            // step before it finally settles.
            <CompSearchRadar radiusMiles={radius} soldWithinDays={soldWithinDays} photo={subjectPhotos[0] || null} />
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
            <div className={`mt-4 grid grid-cols-1 gap-4 ${deskView === 'both' ? 'lg:grid-cols-[minmax(500px,0.8fr)_minmax(420px,1.2fr)] lg:items-start 2xl:grid-cols-[minmax(940px,1.85fr)_minmax(420px,1fr)]' : ''}`}>
              <div className={`min-w-0 ${phoneView === 'map' ? 'max-sm:hidden' : ''} ${deskView === 'map' ? 'sm:hidden' : ''}`}>
              {/* Phones: compact rows that say how each home differs from the subject. */}
              <div ref={phoneListRef} className="space-y-2 sm:hidden">
                {pagedResults.map((candidate, i) => (
                  <motion.div
                    key={`${compsPage}-${candidate.listing_key}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03, type: 'spring', stiffness: 420, damping: 36 } }}
                  >
                    <CompCandidateRow
                      candidate={candidate}
                      subject={subject}
                      matchScore={scoreFor(candidate)}
                      added={addedKeys.has(candidate.listing_key)}
                      sameSchool={isSameSchool(candidate)}
                      onToggle={() => toggleAdd(candidate)}
                      onOpenDetails={() => setPopup({ type: 'candidate', candidate })}
                    />
                  </motion.div>
                ))}
              </div>
              <div
                // Fluid card sizing instead of fixed breakpoints, via flexbox rather than CSS
                // Grid's auto-fit - grid's auto-fit sizes track counts for the WHOLE grid at once,
                // so a trailing partial row (e.g. 1 leftover card) shows empty unfilled tracks
                // instead of that card growing to fill the row. Flexbox lays out each row
                // independently, so flex-grow correctly fills leftover space in ANY row, including
                // a partial last one - no dead gap. Each card stays between 240-300px wide, and
                // however many fit at that width is however many end up per row.
                ref={compGridRef}
                // Cards fill the column (user, 10/21: on a tablet two 300px cards left a wide empty
                // strip and sat in a short scroll box above the map): as many 240px+ columns as fit,
                // each stretched to share the width - 2 across on a tablet or the side column, 1 when
                // narrower. Only the side-by-side layout scrolls on its own.
                className={`hidden content-start gap-4 pr-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] ${deskView === 'both' ? 'lg:max-h-[calc(100vh-380px)] lg:overflow-y-auto' : ''}`}
                style={{ overscrollBehavior: 'auto' }}
              >
                {pagedResults.map((candidate, i) => (
                  // The wider cap only applies with exactly one result total - a card that just
                  // happens to land alone in its row because of an odd count (e.g. 4 results = 3
                  // then 1 trailing) stays at the normal 300px instead of stretching, which looked
                  // exaggerated. One true result gets a little breathing room instead of sitting
                  // capped at the same width as if it had neighbors.
                  <motion.div
                    key={`${compsPage}-${candidate.listing_key}`}
                    // cards fill in one after another on load and on every page change (10/20)
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(i, 12) * 0.035, type: 'spring', stiffness: 380, damping: 32 } }}
                    className={`min-w-0 ${pagedResults.length === 1 ? 'sm:max-w-[420px]' : ''}`}
                  >
                    <CompCandidateCard
                      subject={subject}
                      candidate={candidate}
                      matchScore={scoreFor(candidate)}
                      matchDetails={backendCardMatchDetails(candidate.similarity_details)}
                      added={addedKeys.has(candidate.listing_key)}
                      sameSchool={isSameSchool(candidate)}
                      onToggle={() => toggleAdd(candidate)}
                      onOpenDetails={() => setPopup({ type: 'candidate', candidate })}
                    />
                  </motion.div>
                ))}
              </div>
              {sortedResults.length > COMPS_PER_PAGE_OPTIONS[0] && (
                <div className="mt-3 flex flex-col-reverse items-center justify-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
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
              <div className={`${deskView === 'both' ? 'lg:sticky lg:top-6' : ''} ${phoneView === 'list' ? 'max-sm:hidden' : ''} ${deskView === 'list' ? 'sm:hidden' : ''}`}>
                <CompsMapView
                  subject={subject}
                  candidates={sortedResults}
                  addedKeys={addedKeys}
                  radiusMiles={radius}
                  onRadiusChange={miles => { autoRadiusRef.current = false; setRadius(miles) }}
                  onToggleAdd={toggleAdd}
                  onOpenDetails={candidate => setPopup({ type: 'candidate', candidate })}
                  matchScoreFor={scoreFor}
                  heightClassName="h-[62vh] sm:h-[380px] lg:h-[calc(100vh-380px)]"
                  pulseKeys={pagedResults.map(c => c.listing_key)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phones: the flow bar - Back, "2 / 5" with how many comps are picked, Continue. */}
      {visible && !optimizing && (
        <FlowDock step={2} total={5} onBack={onBack} onContinue={handleContinue} disabled={comparables.length === 0}
          note={`${comparables.length} of ${MAX_COMPS} comps`} />
      )}

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
            navIndex={i}
            navTotal={sortedResults.length}
            onPrev={i > 0 ? () => setPopup({ type: 'candidate', candidate: sortedResults[i - 1] }) : undefined}
            onNext={i >= 0 && i < sortedResults.length - 1 ? () => setPopup({ type: 'candidate', candidate: sortedResults[i + 1] }) : undefined}
          />
        )
      })()}

      {/* Refine Your Search (user, 10/20: nicer + phone-ready): the Showcase-style sheet, the fields
          grouped into What sold / Where / The home with one-tap chips, results updating live, and a
          pinned button saying how many homes match. Every field drives the same search as before. */}
      <CmaSheet
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        title="Refine Your Search"
        subtitle={<>Comps near <span className="font-black text-gray-900 dark:text-white">{subject.street_address || 'the subject property'}</span> - results update live.</>}
        headerRight={
          <span className="hidden items-center gap-1.5 rounded-full bg-[#C9A24D]/12 px-3 py-1.5 text-[11px] font-black text-[#8b7355] dark:text-[#d7b974] sm:inline-flex">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} {results.length} homes
          </span>
        }
        footer={
          <button onClick={() => setRefineOpen(false)} className="cma-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-black text-white shadow-sm dark:bg-white dark:text-[#111827] sm:ml-auto sm:w-auto">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Show {results.length} {results.length === 1 ? 'home' : 'homes'}
          </button>
        }
      >
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {/* The subject - a compact one-line card on a phone, the full card on a wide screen. */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] lg:self-start">
            <div className="flex items-center gap-3 p-2.5 lg:hidden">
              <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                {subjectPhotos.length > 0 ? <img src={normalizeImageUrl(subjectPhotos[0])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-gray-300" /></div>}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address || 'Subject Property'}</p>
                <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  {[subject.beds != null && `${subject.beds} bd`, subject.baths != null && `${subject.baths} ba`, subject.sqft && `${Math.round(subject.sqft).toLocaleString()} sf`, subjectAcres ? `${subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac` : null, subject.year_built && `built ${subject.year_built}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative h-52 w-full bg-gray-100 dark:bg-gray-800">
                {subjectPhotos.length > 0 ? (
                  <img key={subjectPhotoIndex} src={normalizeImageUrl(subjectPhotos[subjectPhotoIndex])} alt="" className="cma-comp-photo h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-gray-300" /></div>
                )}
                {subjectPhotos.length > 1 && (
                  <>
                    <button type="button" onClick={() => setSubjectPhotoIndex(i => (i - 1 + subjectPhotos.length) % subjectPhotos.length)} className="cma-photo-arrow left-2" aria-label="Previous photo"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setSubjectPhotoIndex(i => (i + 1) % subjectPhotos.length)} className="cma-photo-arrow right-2" aria-label="Next photo"><ChevronRight className="h-4 w-4" /></button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white">{subjectPhotoIndex + 1} / {subjectPhotos.length}</span>
                  </>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-[#111827] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">Subject</span>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address || 'Subject Property'}</p>
                  {!!subject.list_price && <p className="shrink-0 text-lg font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(subject.list_price)}</p>}
                </div>
                <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wide text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ') || '—'}</p>
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  <CmaFactChip icon={Bed} value={subject.beds || '-'} label="Beds" />
                  <CmaFactChip icon={Bath} value={subject.baths || '-'} label="Baths" />
                  <CmaFactChip icon={Ruler} {...sqftChipProps(subject.sqft)} />
                  <CmaFactChip icon={LandPlot} value={subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} label="Acres" />
                  <CmaFactChip icon={Building2} value={subject.year_built ?? '-'} label="Built" />
                  <CmaFactChip icon={Calendar} value={subject.days_on_market ?? '-'} label="DOM" />
                  <CmaFactChip icon={DollarSign} value={subject.annual_taxes ? formatMoney(subject.annual_taxes) : '-'} label="Taxes" />
                  <CmaFactChip icon={Droplets} value={formatUtilityValue(subject.water_source)} label="Water" />
                  <CmaFactChip icon={Waves} value={formatUtilityValue(subject.sewer)} label="Sewer" className="col-span-2" />
                  {subject.garage && <CmaFactChip icon={Car} value={subject.garage} label="Garage" className="col-span-2" />}
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
          </div>

          <div className="grid min-w-0 gap-3">
            <RefineGroup title="What sold" icon={Calendar}>
              <div>
                <FieldLabel>Status</FieldLabel>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  {COMP_STATUS_OPTIONS.map(opt => {
                    const on = statuses.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleStatus(opt.value)}
                        aria-pressed={on}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[10.5px] font-black uppercase tracking-wide transition-colors active:scale-[0.97] ${
                          on ? 'bg-[#C9A24D] text-white shadow-[0_8px_18px_-10px_rgba(201,162,77,0.9)]' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-[#0B0B0B] dark:text-gray-400 dark:ring-gray-700'
                        }`}
                      >
                        {on && <Check className="cma-check-pop h-3 w-3" strokeWidth={3} />}{opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {statuses.includes('sold') && (
                <div>
                  <FieldLabel>Sold in the last</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input type="number" value={soldWithinDays} onChange={e => { autoSoldDaysRef.current = false; setSoldWithinDays(e.target.value) }} placeholder="Any time" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                    <span className="shrink-0 text-[10px] font-bold uppercase text-gray-500">Days</span>
                  </div>
                  <div className="mt-2">
                    <QuickChips options={['90', '180', '365', '730']} value={soldWithinDays} onPick={v => { autoSoldDaysRef.current = false; setSoldWithinDays(v) }} suffix=" days" />
                  </div>
                </div>
              )}
            </RefineGroup>

            <RefineGroup title="Where" icon={MapPin}>
              <div>
                <FieldLabel>Radius</FieldLabel>
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-[#151517]">
                  <input type="range" min="0.25" max="10" step="0.25" value={radius} onChange={e => { autoRadiusRef.current = false; setRadius(Number(e.target.value)) }} className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#C9A24D] dark:bg-gray-700" />
                  <motion.div key={radius} initial={{ scale: 0.8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="min-w-[64px] text-right"><span className="text-base font-black text-gray-900 dark:text-white">{radius}</span><span className="ml-1 text-[9px] font-bold uppercase text-gray-500">mi</span></motion.div>
                </div>
                <div className="mt-2">
                  <QuickChips options={[0.5, 1, 2, 3, 5, 10]} value={radius} onPick={v => { autoRadiusRef.current = false; setRadius(v) }} suffix=" mi" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>School District</FieldLabel>
                  <MultiSelectDatabaseInput values={schoolDistrictSel} onChange={setSchoolDistrictSel} apiMethod={api.properties.searchSchoolDistricts} placeholder="Any" maxItems={1} />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <MultiSelectDatabaseInput values={citySel} onChange={setCitySel} apiMethod={api.properties.cities} placeholder="Any" maxItems={1} />
                </div>
              </div>
            </RefineGroup>

            <RefineGroup title="The home" icon={Home}>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Min Price" type="text" value={minPrice ? Number(minPrice).toLocaleString() : ''} onChange={v => setMinPrice(v.replace(/\D/g, ''))} placeholder="0" />
                <TextField label="Max Price" type="text" value={maxPrice ? Number(maxPrice).toLocaleString() : ''} onChange={v => setMaxPrice(v.replace(/\D/g, ''))} placeholder="No max" />
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
            </RefineGroup>
          </div>
        </div>
      </CmaSheet>

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

// "Finding the best comparables" while the first search widens itself (shown/hidden by CompsStep's
// `optimizing`, unchanged). A radar sweeps out from the subject's photo, pings pop up where homes
// are found, and the live radius / sale window tick up as the search widens - compact enough to
// sit right under the step header on a phone (user, 10/20: "basically off-screen on mobile").
function CompSearchRadar({ radiusMiles, soldWithinDays, photo }: { radiusMiles: number, soldWithinDays: string, photo: string | null }) {
  const reduce = useReducedMotion()
  const stages = ['Mapping sales around the home', 'Scoring each match against the subject', 'Widening until enough strong matches']
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStage(s => (s + 1) % stages.length), 2600)
    return () => clearInterval(t)
  }, [stages.length])
  const pings = [
    { top: '22%', left: '68%', d: 0.2 }, { top: '64%', left: '24%', d: 0.9 }, { top: '30%', left: '28%', d: 1.6 },
    { top: '72%', left: '70%', d: 2.3 }, { top: '48%', left: '84%', d: 3.0 },
  ]
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <div className="flex items-center gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="relative h-24 w-24 shrink-0 sm:h-40 sm:w-40">
          {/* rings */}
          {[0, 1, 2].map(i => (
            <span key={i} className="absolute rounded-full border border-[#C9A24D]/25" style={{ inset: `${i * 17}%` }} />
          ))}
          {/* the sweep */}
          {!reduce && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, rgba(201,162,77,0) 0deg, rgba(201,162,77,0) 280deg, rgba(201,162,77,0.45) 360deg)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2.6, ease: 'linear', repeat: Infinity }}
            />
          )}
          {/* homes found */}
          {pings.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
              style={{ top: p.top, left: p.left }}
              initial={{ scale: 0, opacity: 0 }}
              animate={reduce ? { scale: 1, opacity: 1 } : { scale: [0, 1.25, 1, 1, 0], opacity: [0, 1, 1, 1, 0] }}
              transition={reduce ? { duration: 0.2 } : { duration: 3.4, times: [0, 0.12, 0.2, 0.85, 1], repeat: Infinity, delay: p.d }}
            />
          ))}
          {/* the subject in the middle */}
          <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-gray-100 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] ring-[3px] ring-white dark:bg-gray-800 dark:ring-[#151517] sm:h-14 sm:w-14 sm:ring-4">
            {photo ? <img src={normalizeImageUrl(photo)} alt="" className="h-full w-full object-cover" /> : <Home className="m-auto mt-4 h-5 w-5 text-gray-300" />}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C9A24D]">Finding the best comparables</p>
          <div className="relative mt-1 h-6 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stage}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 truncate text-[13px] font-black text-[#111827] dark:text-white sm:text-base"
              >
                {stages[stage]}…
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="mt-1 hidden text-xs font-semibold text-gray-400 sm:block">Widening the search until there are enough strong matches to work with.</p>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
            <motion.span key={`r-${radiusMiles}`} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/12 px-2 py-0.5 text-[10.5px] sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[11px] font-black text-[#8b7355] dark:text-[#d7b974]">
              <MapPin className="h-3.5 w-3.5" /> Within {radiusMiles} mi
            </motion.span>
            {soldWithinDays && (
              <motion.span key={`d-${soldWithinDays}`} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[11px] font-black text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <Calendar className="h-3.5 w-3.5" /> Sold in {soldWithinDays} days
              </motion.span>
            )}
          </div>
        </div>
      </div>
      {/* an indeterminate sweep along the bottom edge */}
      <div className="relative h-1 overflow-hidden bg-[#C9A24D]/10">
        <span className="cma-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
      </div>
    </div>
  )
}

function CompCandidateCard({ candidate, subject, matchScore, matchDetails, added, sameSchool, onToggle, onOpenDetails }: { candidate: CmaCompCandidate, subject?: CmaSubjectProperty, matchScore?: number, matchDetails?: MatchScoreDetails, added: boolean, sameSchool: boolean, onToggle: () => void, onOpenDetails: () => void }) {
  const dp = compDisplayPrice(candidate as unknown as CmaComparable)
  // $/sqft on this selector always derives from whatever price we're showing (close price once
  // sold data is backfilled, list price otherwise) - it's just an orientation number for
  // browsing candidates, not a valuation input.
  // A sale with no closing price on record shows its last asking price - never a $/sqft from it.
  const psf = dp.unverified ? null : pricePerSqft(dp.value, agSqft(candidate))
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
        {/* How it differs from the subject - same chips as the phone rows (user loved those). */}
        {subject && (() => {
          const vs = compVsSubject(candidate, subject, sameSchool)
          return vs.length > 0 ? (
            <div className="mt-1.5 flex flex-nowrap gap-1 overflow-hidden [mask-image:linear-gradient(to_right,black_88%,transparent)]">
              {vs.map(v => (
                <span key={v.text} className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-black ${v.tone === 'same' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-[#C9A24D]/12 text-[#7a5a1e] dark:text-[#e8c97a]'}`}>{v.text}</span>
              ))}
            </div>
          ) : null
        })()}
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
          <CmaFactChip icon={Ruler} {...sqftChipProps(agSqft(candidate))} label="Sqft above grade" />
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

// How a candidate differs from the subject, as short chips - school first (the one agents look for),
// then size and age. Shared by the phone rows and the desktop cards.
function compVsSubject(candidate: CmaCompCandidate, subject: CmaSubjectProperty, sameSchool: boolean): { text: string, tone: 'same' | 'diff' }[] {
  const vs: { text: string, tone: 'same' | 'diff' }[] = []
  if (candidate.school_district) vs.push(sameSchool ? { text: 'Same school', tone: 'same' } : { text: 'Other school', tone: 'diff' })
  if (agSqft(subject) && agSqft(candidate)) {
    const d = Math.round((agSqft(candidate) as number) - (agSqft(subject) as number))
    vs.push(Math.abs(d) < 50 ? { text: 'Same size', tone: 'same' } : { text: `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString()} sf`, tone: 'diff' })
  }
  if (subject.year_built && candidate.year_built && candidate.year_built !== subject.year_built) {
    const d = candidate.year_built - subject.year_built
    vs.push({ text: `${Math.abs(d)} yrs ${d > 0 ? 'newer' : 'older'}`, tone: Math.abs(d) <= 5 ? 'same' : 'diff' })
  }
  return vs
}

// Phones (user, 10/20): one compact row per candidate instead of a full-width card each - photo,
// price, the facts, and how it differs from the subject ("−149 sq ft · same school · 0.1 mi"), so
// the agent can compare a dozen homes against the subject without scrolling a screen per home.
function CompCandidateRow({ candidate, subject, matchScore, added, sameSchool, onToggle, onOpenDetails }: {
  candidate: CmaCompCandidate, subject: CmaSubjectProperty, matchScore?: number, added: boolean, sameSchool: boolean,
  onToggle: () => void, onOpenDetails: () => void,
}) {
  const dp = compDisplayPrice(candidate as unknown as CmaComparable)
  const photo = (candidate.photos && candidate.photos[0]) || candidate.photo_url
  const acres = sqftToAcres(candidate.lot_size)
  const facts = [
    candidate.beds != null && `${candidate.beds} bd`,
    candidate.baths != null && `${candidate.baths} ba`,
    agSqft(candidate) && `${Math.round(agSqft(candidate) as number).toLocaleString()} sf`,
    acres > 0 && `${acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`,
  ].filter(Boolean).join(' · ')
  const vs = compVsSubject(candidate, subject, sameSchool)

  return (
    // Every row is the same height (user, 10/20); the add / added button sits in the top-right
    // corner so the "how it differs" chips keep their own single line (they fade out at the edge
    // rather than wrapping).
    <div className={`relative flex h-[118px] items-stretch gap-3 rounded-2xl border-2 bg-white p-2 transition-[border-color,box-shadow] duration-300 dark:bg-[#151517] ${added ? 'border-emerald-500 shadow-[0_12px_26px_-18px_rgba(16,185,129,0.9)]' : 'border-transparent shadow-sm'}`}>
      <button type="button" onClick={onOpenDetails} className="relative h-full w-[104px] shrink-0 overflow-hidden rounded-xl bg-gray-100 active:scale-[0.97] dark:bg-gray-800">
        {photo ? <img src={normalizeImageUrl(photo)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-gray-300" /></div>}
        {typeof matchScore === 'number' && (
          <span className={`absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white shadow ${matchScore >= 70 ? 'bg-emerald-600' : 'bg-gray-500'}`}>{matchScore}%</span>
        )}
        {candidate.status && (
          <span className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow ${COMP_STATUS_BADGE_STYLE[candidate.status] || 'bg-gray-800'}`}>{COMP_STATUS_LABEL[candidate.status] || candidate.status}</span>
        )}
      </button>
      <button type="button" onClick={onOpenDetails} className="flex min-w-0 flex-1 flex-col py-0.5 text-left">
        <p className="truncate pr-10 text-[13px] font-black leading-tight text-[#111827] dark:text-white">{candidate.street_address}</p>
        <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5 pr-10">
          <span className={`shrink-0 text-[13px] font-black ${dp.unverified ? 'text-gray-400' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>{formatMoney(dp.value, { compact: true })}</span>
          <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {[candidate.city, candidate.distance_miles != null ? `${candidate.distance_miles} mi` : null].filter(Boolean).join(' · ')}
          </span>
        </p>
        {facts && <p className="mt-1 truncate text-[11.5px] font-bold text-gray-600 dark:text-gray-300">{facts}</p>}
        {vs.length > 0 && (
          <div className="mt-auto flex flex-nowrap gap-1 overflow-hidden [mask-image:linear-gradient(to_right,black_88%,transparent)]">
            {vs.map(v => (
              <span key={v.text} className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-black ${v.tone === 'same' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-[#C9A24D]/12 text-[#7a5a1e] dark:text-[#e8c97a]'}`}>{v.text}</span>
            ))}
          </div>
        )}
      </button>
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.86 }}
        aria-label={added ? 'Remove from the CMA' : 'Add to the CMA'}
        aria-pressed={added}
        className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full transition-colors duration-200 ${added ? 'bg-emerald-600 text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.9)]' : 'border-2 border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300'}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={added ? 'in' : 'out'} initial={{ scale: 0.3, rotate: -45, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 28 }}>
            {added ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
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

// A CMA builder window with the Showcase sheet mechanics (components/ui/windowMotion): on a phone
// a sheet that slides up, pulls down to close (from anywhere that isn't a text box or a scrolled
// list) and keeps a pinned footer; on a wide screen a centred window that springs into place. The
// page behind is pinned while it's open. Used by Refine Your Search.
function CmaSheet({ open, onClose, title, subtitle, headerRight, footer, children, maxWidth = 'sm:max-w-4xl' }: {
  open: boolean, onClose: () => void, title: string, subtitle?: React.ReactNode, headerRight?: React.ReactNode,
  footer?: React.ReactNode, children: React.ReactNode, maxWidth?: string,
}) {
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone && open)
  const releasePagePin = usePagePin(open)
  useEscapeToClose(onClose, open)
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence onExitComplete={releasePagePin}>
      {open && (
        <motion.div key="cma-sheet" data-scroll-lock="off" className="cma-touch fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[#0B0B0B]/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
          />
          <motion.div
            ref={sheetRef}
            {...sheetMotion}
            style={{ y: phone && !reduce ? y : undefined }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={e => e.stopPropagation()}
            className={`relative flex max-h-[calc(100%-2.5rem)] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl dark:bg-[#151517] sm:max-h-[88vh] sm:rounded-[28px] ${maxWidth}`}
          >
            <div className="z-10 border-b border-gray-100 bg-white px-4 pb-3 pt-1.5 dark:border-gray-800 dark:bg-[#151517] sm:px-6 sm:py-4">
              <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">{title}</h2>
                  {subtitle && <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{subtitle}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {headerRight}
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-[#111827] dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">{children}</div>
            {footer && (
              <div className="border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-gray-800 dark:bg-[#151517] sm:px-6 sm:py-4">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// A titled group of Refine fields (What sold / Where / The home).
function RefineGroup({ title, icon: Icon, children }: { title: string, icon: React.ComponentType<{ className?: string }>, children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-[#fbfaf7] p-3.5 dark:border-gray-800 dark:bg-white/[0.02] sm:p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]"><Icon className="h-3.5 w-3.5" /> {title}</p>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

// Small one-tap value chips under a Refine field (radius / sold window).
function QuickChips<T extends string | number>({ options, value, onPick, suffix }: { options: T[], value: T | string, onPick: (v: T) => void, suffix: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = String(o) === String(value)
        return (
          <button key={String(o)} type="button" onClick={() => onPick(o)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-black transition-colors active:scale-95 ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-[#0B0B0B] dark:text-gray-300 dark:ring-gray-700'}`}>
            {o}{suffix}
          </button>
        )
      })}
    </div>
  )
}

// Swipeable photo strip (CSS scroll-snap, so a phone swipe is the native one) with arrows and
// position dots - used by the home sheet below. `goRef` lets the filmstrip under it jump to a photo.
function SwipePhotos({ photos, resetKey, onIndex, goRef }: {
  photos: string[], resetKey: string, onIndex?: (i: number) => void, goRef?: React.MutableRefObject<((i: number) => void) | null>
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex(0); stripRef.current?.scrollTo({ left: 0 }) }, [resetKey])
  useEffect(() => { onIndex?.(index) }, [index, onIndex])
  const go = (i: number) => {
    const el = stripRef.current
    if (!el || photos.length === 0) return
    const next = (i + photos.length) % photos.length
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }
  if (goRef) goRef.current = go
  const onScroll = () => {
    const el = stripRef.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(Math.max(0, Math.min(photos.length - 1, i)))
  }
  return (
    <>
      <div ref={stripRef} onScroll={onScroll} className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {photos.map((p, i) => (
          <img key={i} src={normalizeImageUrl(p)} alt="" draggable={false} loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className="cma-photo-arrow left-2.5"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className="cma-photo-arrow right-2.5"><ChevronRight className="h-5 w-5" /></button>
          <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center gap-1 sm:hidden">
            {photos.slice(0, 12).map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ${i === Math.min(index, 11) ? 'w-4 opacity-100' : 'w-1.5 opacity-60'}`} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

// Thumbnail filmstrip under the sheet's photo - the current one ringed in gold and kept in view.
function PhotoFilmstrip({ photos, index, onPick }: { photos: string[], index: number, onPick: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => { refs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }) }, [index])
  return (
    <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 pt-3 sm:px-6">
      {photos.map((p, i) => (
        <button
          key={i}
          type="button"
          ref={el => { refs.current[i] = el }}
          onClick={() => onPick(i)}
          aria-label={`Photo ${i + 1}`}
          className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg transition duration-300 ${i === index ? 'ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-55 hover:opacity-100'}`}
        >
          <img src={normalizeImageUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  )
}

// The CMA builder's home details: the same sheet as the Showcase's home details
// (components/PropertyDetailsModal.tsx) - built from its pieces (useSwipeToClose / useIsPhone /
// usePagePin from components/ui/windowMotion, NavButton / SideArrow / SLIDE_HOME): on a phone a
// sheet that slides up, pulls down to close and has the street, prev / next and X in its header;
// on a wide screen a centred window with big arrows beside it. Content is scoped to what a CMA
// subject / comp has (photos, status + match, add as comp, the fact chips, school, description,
// street read).
function PropertyPopupModal({ open, onClose, data, onPrev, onNext, compAdded, onToggleComp, navIndex, navTotal }: {
  open: boolean, onClose: () => void, data: PropertyPopupData | null, onPrev?: () => void, onNext?: () => void
  /** Comps step: whether this home is one of the report's comps, and the add / remove toggle. */
  compAdded?: boolean, onToggleComp?: () => void
  /** Where this home sits in the list it was opened from (the "3/60" between the header arrows). */
  navIndex?: number, navTotal?: number
}) {
  const shown = useLastValue(open ? data : null)
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, phone && open)
  const releasePagePin = usePagePin(open)
  const [photoIndex, setPhotoIndex] = useState(0)
  // Toggled by the map button on the photo - swaps the photos for an interactive Google map of THIS
  // property's location; stays until toggled back.
  const [showMap, setShowMap] = useState(false)
  const homeKey = shown ? `${shown.address || ''}|${shown.lat ?? ''}|${shown.lng ?? ''}` : ''
  useEffect(() => { setShowMap(false); setPhotoIndex(0) }, [homeKey])
  const scrollRef = useRef<HTMLDivElement>(null)
  const photoGoRef = useRef<((i: number) => void) | null>(null)

  // Which way the next home slides in (prev from the left, next from the right).
  const [move, setMove] = useState<HomeMove | null>(null)
  const goPrev = onPrev ? () => { setMove(m => ({ dir: -1, kind: 'nav', seq: (m?.seq || 0) + 1 })); onPrev() } : null
  const goNext = onNext ? () => { setMove(m => ({ dir: 1, kind: 'nav', seq: (m?.seq || 0) + 1 })); onNext() } : null
  const hasNav = !!(goPrev || goNext)
  const goPrevRef = useRef(goPrev); goPrevRef.current = goPrev
  const goNextRef = useRef(goNext); goNextRef.current = goNext

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && goNextRef.current) { e.preventDefault(); goNextRef.current() }
      if (e.key === 'ArrowLeft' && goPrevRef.current) { e.preventDefault(); goPrevRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  const d = shown
  const pics = d?.photos || []
  const hasGeo = !!d && typeof d.lat === 'number' && typeof d.lng === 'number'
  const off = typeof window !== 'undefined' ? window.innerHeight : 900
  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.16 } }, exit: { opacity: 0, transition: { duration: 0.14 } } }
    : phone
      ? { initial: { y: off }, animate: { y: 0, transition: SHEET_SPRING }, exit: { y: off, transition: { duration: 0.26, ease: [0.32, 0, 0.67, 0] as const } } }
      : { initial: { opacity: 0, y: 48, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1, transition: SHEET_DESKTOP_SPRING }, exit: { opacity: 0, y: 36, scale: 0.98, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } } }

  // Portaled straight to document.body - opened from deep inside the page (Comps AND Analysis),
  // under ancestors that get a CSS transform at times (the step-in animation), which would make a
  // `position: fixed` overlay position itself against that ancestor instead of the screen.
  return createPortal(
    <AnimatePresence onExitComplete={releasePagePin}>
      {open && d && (
        <motion.div
          key="cma-home-sheet"
          data-scroll-lock="off"
          className="cma-touch fixed inset-0 z-[100] flex items-end justify-center overscroll-none sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[#0B0B0B]/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: phone ? 0.26 : 0.2, delay: phone ? 0 : 0.04 } }}
          />
          {hasNav && (
            <>
              <SideArrow narrow dir={-1} onClick={goPrev} />
              <SideArrow narrow dir={1} onClick={goNext} />
            </>
          )}
          <motion.div
            ref={sheetRef}
            {...sheetMotion}
            className="relative flex h-[calc(100%-2.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[28px]"
            style={{ overscrollBehavior: 'contain', y: phone && !reduce ? sheetY : undefined }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={d.address || 'Home details'}
          >
            <PropertySurface surface="app" gold="#C9A24D" ink="#111827" className="flex min-h-0 flex-1 flex-col bg-white dark:bg-[#151517]">
              {/* header - on a phone also the handle you pull down to close */}
              <div className="z-40 border-b border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-4 pb-2.5 pt-1.5 sm:px-6 sm:py-3">
                <div aria-hidden className="mx-auto mb-1.5 h-[5px] w-10 rounded-full bg-[color:var(--pp-gold-line)] sm:hidden" />
                <div className="relative flex items-center justify-between gap-2 sm:gap-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={homeKey}
                      className="min-w-0 flex-1 leading-tight"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.14 } }}
                    >
                      <p title={d.address || undefined} className={`line-clamp-2 break-words font-serif font-black leading-[1.15] ${streetSize(d.address)} ${pp.heading}`}>{d.address}</p>
                      {d.cityState && <p className={`mt-0.5 flex min-w-0 items-center gap-1 text-[11px] font-semibold ${pp.muted}`}><MapPin className="h-3 w-3 shrink-0 text-[color:var(--pp-gold)]" /><span className="min-w-0 truncate">{d.cityState}</span></p>}
                    </motion.div>
                  </AnimatePresence>
                  {hasNav && (
                    <div className="flex shrink-0 items-center rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)]">
                      <NavButton dir={-1} onClick={goPrev} />
                      {navIndex != null && navIndex >= 0 && navTotal ? (
                        <span className={`min-w-[2.6rem] select-none text-center text-[11px] font-black tabular-nums max-[359px]:hidden ${pp.muted}`}>
                          {navIndex + 1}<span className="opacity-50">/</span>{navTotal}
                        </span>
                      ) : null}
                      <NavButton dir={1} onClick={goNext} />
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    onClick={onClose}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pp-gold-wash)] transition-colors hover:bg-[color:var(--pp-gold-line)] ${pp.heading}`}
                    title="Close"
                    aria-label="Close"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </motion.button>
                </div>
              </div>

              <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                <AnimatePresence mode="wait" initial={false} custom={move} onExitComplete={() => scrollRef.current?.scrollTo({ top: 0 })}>
                  <motion.div key={homeKey} custom={move} variants={reduce ? FADE_HOME : SLIDE_HOME} initial="enter" animate="center" exit="exit">
                    <div className="relative aspect-[4/3] max-h-[440px] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {hasGeo && showMap ? (
                        <iframe
                          title={d.address ? `Map of ${d.address}` : 'Property location'}
                          src={`https://www.google.com/maps?q=${d.lat},${d.lng}&z=18&t=h&output=embed`}
                          className="h-full w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : pics.length > 0 ? (
                        <SwipePhotos photos={pics} resetKey={homeKey} onIndex={setPhotoIndex} goRef={photoGoRef} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Home className="h-10 w-10 text-gray-300" /></div>
                      )}
                      {!showMap && d.status && (
                        <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[d.status] || 'bg-gray-800'}`}>
                          {COMP_STATUS_LABEL[d.status] || d.status}
                        </span>
                      )}
                      {!showMap && typeof d.matchScore === 'number' && (
                        <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg">{d.matchScore}% Match</span>
                      )}
                      {/* bottom: add / remove as a comp (Comps step), the map toggle and the photo counter */}
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                        {onToggleComp ? (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={onToggleComp}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-black uppercase tracking-wide shadow-lg transition-colors ${compAdded ? 'bg-emerald-600 text-white ring-2 ring-white/80' : 'bg-white text-[#111827] ring-2 ring-[#C9A24D] hover:bg-[#fffaf0]'}`}
                          >
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span key={compAdded ? 'in' : 'out'} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex items-center gap-1.5">
                                {compAdded ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> In your comps</> : <><Plus className="h-3.5 w-3.5" strokeWidth={3} /> Add as comp</>}
                              </motion.span>
                            </AnimatePresence>
                          </motion.button>
                        ) : <span />}
                        <div className="flex items-center gap-1.5">
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
                            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white">{photoIndex + 1} / {pics.length}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!showMap && pics.length > 1 && <PhotoFilmstrip photos={pics} index={photoIndex} onPick={i => photoGoRef.current?.(i)} />}
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C9A24D]">{d.priceLabel || 'Price'}</p>
                          {d.price != null ? (
                            <p className="font-serif text-2xl font-black text-[#111827] dark:text-white">{formatMoney(d.price)}</p>
                          ) : <p className="font-serif text-2xl font-black text-gray-300">—</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!!d.pricePerSqft && <span className="rounded-full bg-[#C9A24D]/10 px-2.5 py-1 text-[11px] font-black text-[#8b7355] dark:text-[#d7b974]">${d.pricePerSqft}/sqft</span>}
                          {d.distanceMiles != null && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600 dark:bg-gray-800 dark:text-gray-300">{d.distanceMiles} mi away</span>}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-flow-row-dense grid-cols-3 gap-2 sm:grid-cols-4">
                        {d.facts.map((f, i) => (
                          <CmaFactChip key={i} icon={f.icon} value={f.value} label={f.label} dynamicSpan={!f.fixedSpan} secondary={f.secondary}
                            className={`cma-chip-in ${f.label === 'Basement' ? 'max-sm:!col-span-full' : ''}`} />
                        ))}
                        {d.schoolDistrict && (
                          <div
                            className="cma-chip-in relative flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-center dark:border-gray-800 dark:bg-[#0B0B0B] max-sm:!col-span-full"
                            style={{ gridColumn: `span ${chipSpan(d.schoolDistrict)} / span ${chipSpan(d.schoolDistrict)}` }}
                          >
                            {d.sameSchool && (
                              <span title="Same school district as the subject property" className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </span>
                            )}
                            <GraduationCap className="h-3.5 w-3.5 text-[#C9A24D]" />
                            <span className={`max-w-full truncate px-2 font-black leading-tight text-[#111827] dark:text-white ${chipValueTextClass(d.schoolDistrict || '')}`} title={d.schoolDistrict}>{d.schoolDistrict}</span>
                            <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">School</span>
                          </div>
                        )}
                      </div>
                      {d.description && (
                        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Description</p>
                          <p className="text-[13px] font-medium leading-relaxed text-gray-600 dark:text-gray-400">{d.description}</p>
                        </div>
                      )}
                      {d.roadContext?.summary && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-[11px] dark:border-gray-800">
                          {ROAD_VERDICT_STYLE[d.roadContext.verdict] && (
                            <span className={`rounded-full px-2 py-0.5 font-black uppercase tracking-wide ${ROAD_VERDICT_STYLE[d.roadContext.verdict].cls}`}>{ROAD_VERDICT_STYLE[d.roadContext.verdict].label}</span>
                          )}
                          <span className="font-semibold text-gray-600 dark:text-gray-300">{d.roadContext.summary}</span>
                          {d.roadContext.max_speed_mph ? <span className="font-bold text-gray-400">~{d.roadContext.max_speed_mph} mph nearby</span> : null}
                        </div>
                      )}
                      {/* breathing room above the phone's home bar */}
                      <div className="h-[env(safe-area-inset-bottom)]" />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </PropertySurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
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
// A condo / unit has no lot of its own (HOA land) - its comps' Lot rating is N/A, never required
// (10/21: "Finish rating each comp: #1 Lot ... #5 Lot" on 1813 Spruce St #4R).
function isCondoSubject(subject?: CmaSubjectProperty | null): boolean {
  const t = `${subject?.property_type || ''} ${JSON.stringify((subject as { structure_type?: unknown } | null)?.structure_type || '')}`.toLowerCase()
  return /condo|unit|flat|apartment|penthouse/.test(t)
}

function compAnalysisMissing(comp: CmaComparable, subject?: CmaSubjectProperty | null): string[] {
  const missing: string[] = []
  if (!comp.strength) missing.push('Comp Weight')
  const q = comp.quality || {}
  const condo = isCondoSubject(subject)
  for (const { key, label } of REQUIRED_QUALITY_KEYS) {
    if (key === 'lot' && condo) continue
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
  const psf = pricePerSqft(comp.sale_price ?? comp.list_price, agSqft(comp))
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

function AnalysisStep({ report, visible = true, onSave, onReportUpdated, onNext, onBack }: {
  report: CmaReport, visible?: boolean, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>,
  onReportUpdated: (r: CmaReport) => void, onNext: () => void, onBack?: () => void,
}) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(() => normalizeAnalysisComparables(report.comparables))
  const [activeId, setActiveId] = useState<string | null>(() => normalizeAnalysisComparables(report.comparables)[0]?.id || null)
  // 0 = the subject, k = comparables[k - 1] - the details sheet steps through them with prev / next.
  const [popup, setPopup] = useState<{ pos: number } | null>(null)
  // A subject saved with only its cover photo (picked from My Listings before 10/20) gets its full
  // Bright gallery here, for DISPLAY only - so the side-by-side lets the agent swipe the subject's
  // photos against the comp's (user, 10/20). Nothing is saved: changing the saved subject would
  // mark a finished report as "changed after final QA".
  const [subjectGallery, setSubjectGallery] = useState<string[] | null>(null)
  useEffect(() => {
    const s = report.subject
    setSubjectGallery(null)
    if (s?.source !== 'mls' || !s.listing_key || (s.photos?.length || 0) > 1) return
    let cancelled = false
    api.cma.subjectFromListing(s.listing_key).then(r => {
      const more = r.success ? r.data?.photos : null
      if (!cancelled && more && more.length > (s.photos?.length || 0)) setSubjectGallery(more)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id, report.subject?.listing_key])
  const shownSubject = useMemo(
    () => (subjectGallery ? { ...report.subject, photos: subjectGallery } : report.subject),
    [report.subject, subjectGallery],
  )
  const [generating, setGenerating] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [progressStage, setProgressStage] = useState(0)
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
  // Real progress isn't available (one background run, polled), so this paces a staged timeline to
  // what a report actually takes - a new home runs about 2.5-3 minutes end to end, a re-run of the
  // same home closer to 2 because its photo review is reused (live runs 10/21; it was ~4 before the
  // speed-ups) - with the final valuation (the longest part) given most of it. It never reaches
  // 100% on its own: it eases toward 97% until the real result lands. `startedAtMs` comes from the
  // server when a run is resumed after leaving the page, so the bar picks up where it really is.
  const startProgressSimulation = (startedAtMs: number) => {
    const includedNow = comparables.filter(c => c.is_included)
    const stagedCompCount = Math.min(includedNow.length, MAX_COMPS)
    const subjectMs = 8_000
    const perCompMs = stagedCompCount > 0 ? Math.round(36_000 / stagedCompCount) : 0
    const compReviewEnd = subjectMs + stagedCompCount * perCompMs
    const marketReviewEnd = compReviewEnd + 12_000
    const benchmarkEnd = marketReviewEnd + 10_000
    const reasoningMs = 80_000
    const reasoningEnd = benchmarkEnd + reasoningMs
    let lastActiveCompIndex = -1
    // Phones (user, 10/20): no flipping the whole side-by-side view to each comp as the AI reaches
    // it - on a phone that redraws the page under the agent's thumb. Only the scan on the one comp
    // card it's working on (CompOrderRail) moves.
    const followScanAcrossPage = typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches

    const updateProgress = () => {
      const elapsedMs = Date.now() - startedAtMs
      setProgressElapsedSec(Math.floor(elapsedMs / 1000))

      let pct = 2
      let stage = 0
      let label = 'Reading the subject’s photos and facts'
      let nextScanStage = 0

      if (elapsedMs < subjectMs) {
        pct = 2 + (elapsedMs / subjectMs) * 6
      } else if (stagedCompCount > 0 && elapsedMs < compReviewEnd) {
        const compElapsed = elapsedMs - subjectMs
        const compIndex = Math.min(stagedCompCount - 1, Math.floor(compElapsed / perCompMs))
        const compFraction = (compElapsed - compIndex * perCompMs) / perCompMs
        pct = 8 + ((compIndex + compFraction) / stagedCompCount) * 27
        stage = 1
        label = `Reviewing comparable ${compIndex + 1} of ${stagedCompCount}`
        nextScanStage = compIndex + 1
        if (compIndex !== lastActiveCompIndex && followScanAcrossPage) {
          lastActiveCompIndex = compIndex
          const comp = includedNow[compIndex]
          if (comp) setActiveId(comp.id)
        }
      } else if (elapsedMs < marketReviewEnd) {
        pct = 35 + ((elapsedMs - compReviewEnd) / 12_000) * 10
        stage = 2
        label = 'Comparing size, condition and market evidence'
        nextScanStage = stagedCompCount + 1
      } else if (elapsedMs < benchmarkEnd) {
        pct = 45 + ((elapsedMs - marketReviewEnd) / 10_000) * 7
        stage = 3
        label = 'Setting each comp’s weight and the value range'
        nextScanStage = stagedCompCount + 1
      } else if (elapsedMs < reasoningEnd) {
        const r = (elapsedMs - benchmarkEnd) / reasoningMs
        // eases out a little so the bar keeps visibly moving through the longest stretch
        pct = 52 + (1 - Math.pow(1 - r, 1.4)) * 36
        stage = 4
        label = 'Working out the final value - the longest part'
        nextScanStage = stagedCompCount + 1
      } else {
        const finalCheckMs = elapsedMs - reasoningEnd
        pct = 88 + 9 * (1 - Math.exp(-finalCheckMs / 25_000))
        stage = 5
        label = 'Checking every number and sentence in the report'
        nextScanStage = stagedCompCount + 1
      }

      setProgressLabel(label)
      setProgressStage(stage)
      setProgressPct(Math.min(97, Math.round(pct)))
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
    // order_index comes from the server too: the engine renumbers comps by share of value before
    // writing "Comp #N", and keeping the old pick order here saved it back over that (10/20).
    setComparables(cs => cs.map(c => {
      const u = byId.get(c.id)
      if (!u) return c
      return { ...u, is_included: c.is_included, override_reason: c.override_reason, order_index: u.order_index ?? c.order_index, commentary: c.commentary || u.ai_commentary }
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
  const [aiEstimate, setAiEstimate] = useState<{ usd: number; percent: number | null; max_percent: number | null } | null>(null)
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
        return { ...u, is_included: c.is_included, override_reason: c.override_reason, order_index: u.order_index ?? c.order_index, commentary: c.commentary }
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
      .map((c, i) => ({ i, id: c.id, missing: compAnalysisMissing(c, report.subject) }))
      .filter(x => x.missing.length > 0),
    [comparables, report.subject],
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
      {visible && <FlowDock step={3} total={5} onBack={onBack} onContinue={handleContinue} continueLabel="Pricing" />}
      {hasCompleteAi ? (
        // Explicit "used" state rather than just removing the banner - a banner that silently
        // vanishes reads the same as "nothing happened" if the agent glances back a moment later,
        // especially since generation takes a while and they may not be looking right when it lands.
        <AiAnalysisComplete report={report} monthlyLimitUsd={aiEstimate?.percent ? aiEstimate.usd / (aiEstimate.percent / 100) : null} celebrate={justGenerated} />
      ) : (
        <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 bg-gradient-to-br from-[#C9A24D]/15 via-[#C9A24D]/5 to-transparent p-4 shadow-[0_0_40px_-12px_rgba(201,162,77,0.5)] dark:border-[#C9A24D]/40 sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#C9A24D]/20 blur-3xl" />
          {/* faint gold grid behind the desktop card */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden opacity-[0.35] [background-image:linear-gradient(rgba(201,162,77,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(201,162,77,0.12)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(90deg,transparent,black_40%,black)] sm:block" />
          {/* Phones (user, 10/20): "OpenHousePal AI" and the usage meter are two equal pills on ONE
              row, then the button - a thinner top section. Wide screens (user, 10/20: "much nicer on
              desktop too"): what the AI does on the left - a glowing mark, the title, the line, and
              three "it will…" chips - and a control column on the right: usage, the button, and
              what this run will use. Same elements, placed by the grid. */}
          <div className="relative grid grid-cols-2 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center sm:gap-x-8 sm:gap-y-2.5">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#C9A24D]/30 bg-white/70 px-3 py-1.5 dark:bg-black/20 sm:row-span-2 sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
              <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#C9A24D] shadow-md shadow-[#C9A24D]/40 sm:h-16 sm:w-16 sm:rounded-[20px] sm:bg-gradient-to-br sm:from-[#b8923f] sm:via-[#C9A24D] sm:to-[#f0cf7f] sm:shadow-[0_18px_36px_-14px_rgba(201,162,77,0.9)]">
                <span aria-hidden className="absolute inset-0 hidden rounded-[20px] ring-1 ring-white/40 sm:block" />
                <span aria-hidden className="absolute -inset-2 hidden animate-[spin_9s_linear_infinite] rounded-full border border-dashed border-[#C9A24D]/40 sm:block" />
                <Sparkles className="h-3 w-3 text-white sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-[#111827] dark:text-white sm:font-serif sm:text-2xl">OpenHousePal AI</p>
                <p className="hidden text-[13px] font-semibold leading-snug text-gray-500 dark:text-gray-400 sm:block">Reads every comp's photos and data, rates strength and quality, and proposes a value estimate.</p>
                <div className="mt-2.5 hidden flex-wrap gap-1.5 sm:flex">
                  {[{ icon: ImageIcon, t: 'Reads every photo' }, { icon: Scale, t: 'Rates each comp' }, { icon: DollarSign, t: 'Proposes a value' }].map(({ icon: Icon, t }) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/30 bg-white/80 px-2.5 py-1 text-[11px] font-black text-[#8b7355] dark:bg-black/30 dark:text-[#d7b974]">
                      <Icon className="h-3.5 w-3.5" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <MonthlyAiUsageMeter variant="inline" compact stretch className="min-w-0 sm:col-start-2 sm:w-full sm:bg-white/80 sm:py-2 sm:dark:bg-black/30" refreshKey={generating ? 'gen' : 'idle'} />
            <div className="col-span-2 flex shrink-0 flex-col items-stretch gap-1 sm:col-span-1 sm:col-start-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`cma-btn cma-btn-gold ${generating ? 'cma-btn-working' : ''} inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#C9A24D]/40 transition hover:shadow-xl hover:shadow-[#C9A24D]/50 disabled:cursor-progress sm:py-3.5 sm:text-[15px]`}
              >
                {generating ? <Sparkles className="h-4 w-4 animate-[spin_2.4s_linear_infinite]" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Analyzing…' : genError ? 'Try again' : 'Create AI Analysis'}
              </button>
              {!generating && aiEstimate?.percent != null && (
                <span className="text-center text-[10.5px] font-bold text-[#8b7355] dark:text-[#d7b974]">
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
          {generating && <AiGenerationProgress pct={progressPct} label={progressLabel} stage={progressStage} elapsedSec={progressElapsedSec} />}
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
          subject={shownSubject}
          comp={active}
          comps={comparables}
          onSelectIndex={i => setActiveId(comparables[i]?.id || active.id)}
          index={activeIndex}
          total={comparables.length}
          onUpdate={patch => updateComp(active.id, patch)}
          onUpdateStrength={value => updateStrength(active.id, value)}
          onUpdateQuality={(key, value) => updateQuality(active.id, key, value)}
          onPrev={() => setActiveId(comparables[Math.max(0, activeIndex - 1)]?.id || active.id)}
          onNext={() => setActiveId(comparables[Math.min(comparables.length - 1, activeIndex + 1)]?.id || active.id)}
          onContinueClick={handleContinue}
          onOpenSubjectDetails={() => setPopup({ pos: 0 })}
          onOpenCompDetails={() => setPopup({ pos: activeIndex + 1 })}
          focusSignal={compareFocusSignal}
        />
      )}

      <PropertyPopupModal
        open={!!popup}
        onClose={() => setPopup(null)}
        data={popup ? buildAnalysisPopupData(
          popup.pos === 0 ? 'subject' : 'comp', shownSubject,
          popup.pos === 0 ? active : comparables[popup.pos - 1] || active,
          report.pricing?.ai_estimate?.subject_road_context ?? null,
        ) : null}
        navIndex={popup?.pos}
        navTotal={comparables.length + 1}
        onPrev={popup && popup.pos > 0 ? () => setPopup({ pos: popup.pos - 1 }) : undefined}
        onNext={popup && popup.pos < comparables.length ? () => setPopup({ pos: popup.pos + 1 }) : undefined}
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

// The AI analysis while it runs (user, 10/20: "a much cooler animation and a real progress bar").
// A live percentage that counts up, a glowing bar with a light sweeping through it, what it's doing
// right now, time so far / about how long is left (paced to the ~2.5-3 minutes a new home takes),
// and the six stages - every stage on a wide screen, just the current one on a phone.
const AI_STAGES = ['Subject', 'Comparables', 'Market evidence', 'Comp weights', 'Final value', 'Report check']
const AI_TYPICAL_SEC = 170

function AiGenerationProgress({ pct, label, stage, elapsedSec }: { pct: number, label: string, stage: number, elapsedSec: number }) {
  const reduce = useReducedMotion()
  const shownPct = useCountUp(pct)
  const left = Math.max(0, AI_TYPICAL_SEC - elapsedSec)
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const leftText = elapsedSec > AI_TYPICAL_SEC + 20 ? 'Almost there' : left < 45 ? 'Under a minute left' : `About ${Math.ceil(left / 60)} min left`
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-white/70 p-3.5 dark:bg-black/25 sm:p-4">
      {/* Fixed-width percentage + one-line step label (user, 10/21: "the entire top section is shaking"):
          the count-up number changing width squeezed the phone step label onto two lines and back,
          so the whole card - and the page under it - jumped 15px every few ticks. */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">
            <span className="relative flex h-2 w-2">
              {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A24D] opacity-70" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9A24D]" />
            </span>
            <span className="truncate sm:hidden">Step {Math.min(stage + 1, AI_STAGES.length)} of {AI_STAGES.length} · {AI_STAGES[stage]}</span>
            <span className="hidden sm:inline">OpenHousePal AI is working</span>
          </p>
          <div className="relative mt-1 h-5 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={label}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 truncate text-[13px] font-black text-[#111827] dark:text-white"
              >
                {label}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <p className="w-[3em] shrink-0 text-right font-serif text-3xl font-black leading-none tabular-nums text-[#111827] dark:text-white sm:text-4xl">
          {shownPct}<span className="text-lg text-[#C9A24D] sm:text-xl">%</span>
        </p>
      </div>

      <div
        className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-[#C9A24D]/12 dark:bg-white/10"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-[#8b7355] via-[#C9A24D] to-[#f0cf7f] shadow-[0_0_14px_rgba(201,162,77,0.65)]"
          initial={false}
          animate={{ width: `${Math.max(3, pct)}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          {!reduce && (
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="cma-bar-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </span>
          )}
          <span className="absolute -right-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#f6dc9b] shadow-[0_0_12px_4px_rgba(240,207,127,0.8)]" />
        </motion.div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">
        <span>{clock(elapsedSec)} so far</span>
        <span className="text-[#8b7355] dark:text-[#d7b974]">{leftText}</span>
      </div>

      {/* every stage, wide screens only */}
      <ol className="mt-3 hidden grid-cols-6 gap-1.5 sm:grid">
        {AI_STAGES.map((name, i) => {
          const done = i < stage
          const now = i === stage
          return (
            <li key={name} className={`relative flex h-7 items-center justify-center overflow-hidden rounded-xl border px-2 text-center leading-none text-[10px] font-black uppercase tracking-wide transition-colors duration-500 ${
              done ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : now ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#d7b974]'
                  : 'border-gray-200 text-gray-400 dark:border-gray-800'
            }`}>
              {now && !reduce && <span className="ohp-comp-scan-line" />}
              <span className="relative inline-flex items-center gap-1">
                {done && <Check key={`d-${name}`} className="cma-check-pop h-3 w-3" strokeWidth={3} />}
                {name}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// The finished AI analysis (user, 10/21: "a little cooler, and show how much AI usage it took").
// The bar fills to 100% with a light sweeping through it, the check pops in, and two stat pills say
// what this run used of the monthly AI allowance and how long it took. `celebrate` = it finished
// while the agent was watching, so the fill plays out; coming back later it just shows full.
function AiAnalysisComplete({ report, monthlyLimitUsd, celebrate }: { report: CmaReport, monthlyLimitUsd: number | null, celebrate: boolean }) {
  const reduce = useReducedMotion()
  const play = celebrate && !reduce
  const cost = report.ai_analysis?.cost_usd ?? null
  const usedPct = cost != null && monthlyLimitUsd ? (cost / monthlyLimitUsd) * 100 : null
  const usedText = usedPct == null ? null : usedPct < 1 ? '<1%' : `${Math.round(usedPct)}%`
  const tookSec = report.ai_analysis?.generated_at && report.generation_started_at
    ? Math.round((new Date(report.ai_analysis.generated_at).getTime() - new Date(report.generation_started_at).getTime()) / 1000)
    : null
  const tookText = tookSec != null && tookSec > 0 && tookSec < 3600 ? `${Math.floor(tookSec / 60)}:${String(tookSec % 60).padStart(2, '0')}` : null
  return (
    <motion.div
      initial={play ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-[#C9A24D]/[0.06] p-4 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.7)] dark:border-emerald-900/40 dark:from-emerald-900/15 dark:via-[#111113] dark:to-[#C9A24D]/[0.06] sm:p-5"
    >
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
            {play && <span aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-emerald-400/40 [animation-iteration-count:2]" />}
            <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <Check className={`h-5 w-5 text-white sm:h-6 sm:w-6 ${play ? 'cma-check-pop' : ''}`} strokeWidth={3} />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 sm:text-base">AI Analysis Complete</p>
            <p className="text-xs font-semibold leading-snug text-emerald-700/70 dark:text-emerald-300/60">Comp ratings and a value estimate are filled in below - edit anything by hand as needed.</p>
          </div>
        </div>
        {/* Done is done - no re-run from here: the full bar, then what the run used. */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-[19rem]">
          <div className="flex items-center gap-2.5">
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-[#e0b85f]"
                initial={play ? { width: '70%' } : false}
                animate={{ width: '100%' }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                {!reduce && (
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <span className="cma-bar-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                  </span>
                )}
              </motion.div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> 100%
            </span>
          </div>
          {(usedText || tookText) && (
            <div className="grid grid-cols-2 gap-1.5">
              {usedText && (
                <span className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#C9A24D]/30 bg-white/80 px-2 py-1 text-[11px] font-black text-[#8b7355] dark:bg-black/30 dark:text-[#d7b974]">
                  <Sparkles className="h-3 w-3 shrink-0" /> {usedText} of monthly AI
                </span>
              )}
              {tookText && (
                <span className={`inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-white/80 px-2 py-1 text-[11px] font-black tabular-nums text-emerald-700 dark:border-emerald-900/40 dark:bg-black/30 dark:text-emerald-300 ${usedText ? '' : 'col-span-2'}`}>
                  <Clock className="h-3 w-3" /> Took {tookText}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Counts a number up smoothly to its new value (the AI progress percentage).
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = shownRef.current
    if (from === target) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600)
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)))
      shownRef.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

function CompOrderRail({ comparables, activeId, onSelect, onReorder, scanStage = -1 }: {
  comparables: CmaComparable[], activeId: string | null, onSelect: (id: string) => void,
  onReorder: (draggedId: string, targetId: string) => void,
  // -1 = idle. Otherwise the 1-based rail position the AI analysis is scanning right now;
  // lower-positioned comps show a "done" check, this one shows the scan line.
  scanStage?: number,
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Keep the card being scanned (or the one picked) in view by sliding the row SIDEWAYS only - a
  // scrollIntoView would also scroll the page, which on a phone yanked the view up and down.
  const centerItem = useCallback((i: number) => {
    const rail = railRef.current, el = itemRefs.current[i]
    if (!rail || !el) return
    const left = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2
    rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [])
  useEffect(() => { if (scanStage >= 1) centerItem(scanStage - 1) }, [scanStage, centerItem])
  const activeIndex = comparables.findIndex(c => c.id === activeId)
  useEffect(() => { if (activeIndex >= 0 && scanStage < 0) centerItem(activeIndex) }, [activeIndex, scanStage, centerItem])

  return (
    <SectionCard title="Comparable Order" subtitle="Tap one to compare it with the subject. On a computer, drag to reorder.">
      <div ref={railRef} className="scrollbar-hide -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 pt-1 sm:gap-3">
        {comparables.map((c, i) => {
          const isActive = c.id === activeId
          const scanning = scanStage >= 0 && scanStage === i + 1
          const scanned = scanStage >= 0 && scanStage > i + 1
          return (
            <button
              key={c.id}
              ref={el => { itemRefs.current[i] = el }}
              type="button"
              draggable
              onDragStart={() => setDraggedId(c.id)}
              onDragOver={event => {
                event.preventDefault()
                if (draggedId && draggedId !== c.id) onReorder(draggedId, c.id)
              }}
              onDragEnd={() => setDraggedId(null)}
              onClick={() => onSelect(c.id)}
              className={`group flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-[border-color,box-shadow,transform] duration-300 dark:bg-[#151517] sm:w-48 sm:cursor-grab sm:active:cursor-grabbing ${
                isActive
                  ? '-translate-y-0.5 border-[#C9A24D] shadow-[0_14px_28px_-16px_rgba(201,162,77,0.9)]'
                  : 'border-gray-200 dark:border-gray-800 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-gray-300 [@media(hover:hover)]:hover:shadow-md dark:[@media(hover:hover)]:hover:border-gray-600'
              } ${scanning ? 'border-[#C9A24D] shadow-[0_0_0_4px_rgba(201,162,77,0.18)]' : ''} ${!c.is_included ? 'opacity-50' : ''}`}
            >
              {/* own compositing layer (isolate + translateZ) so the zoomed photo and its dark city
                  shading stay clipped together while the card lifts - without it a hairline
                  showed at the photo's bottom edge on hover and the shading dropped out (10/21) */}
              <div className="relative isolate overflow-hidden [transform:translateZ(0)]">
                {c.photo_url
                  ? <img src={normalizeImageUrl(c.photo_url || undefined)} alt="" draggable={false} className="block aspect-[4/3] w-full object-cover transition-transform duration-500 will-change-transform [@media(hover:hover)]:group-hover:scale-[1.04]" />
                  : <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 dark:bg-gray-800"><Home className="h-5 w-5 text-gray-300" /></div>}
                {scanning && <span className="ohp-comp-scan-line" />}
                {scanning && <span className="pointer-events-none absolute inset-0 bg-[#C9A24D]/10" />}
                {scanned && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="cma-check-pop flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"><Check className="h-4 w-4" strokeWidth={3} /></span>
                  </span>
                )}
                <span className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow transition-colors ${isActive ? 'bg-[#C9A24D] text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{i + 1}</span>
                <GripVertical className="absolute right-1.5 top-1.5 hidden h-4 w-4 text-white drop-shadow sm:block" />
                {!c.is_included && (
                  <span title={c.override_reason || undefined} className="absolute left-1.5 top-7 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow">Irrelevant</span>
                )}
                {/* Same bottom-center city overlay pattern as OpenHouseCard.tsx - gradient,
                    MapPin icon, bold white uppercase text. */}
                {c.city && (
                  <div className="pointer-events-none absolute inset-x-0 -bottom-px z-[1] flex items-center justify-center gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-[7px] pt-6">
                    <MapPin className="h-2.5 w-2.5 shrink-0 text-white" />
                    <span className="max-w-[80%] truncate text-[9px] font-black uppercase tracking-wide text-white">{c.city}</span>
                  </div>
                )}
              </div>
              <div className="p-2 sm:p-2.5">
                <p className="truncate text-[11px] font-black text-[#111827] dark:text-white sm:text-xs">{c.street_address}</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(c).value)}</p>
              </div>
              {/* the picked comp's gold underline glides from card to card */}
              {/* plain span, not a shared-layout animation: framer re-measuring it inside this
                  sideways-scrolling row made the cards shake while scrolling on a phone (10/20) */}
              {isActive && <span className="cma-rail-underline h-1 w-full bg-gradient-to-r from-[#8b7355] via-[#C9A24D] to-[#e0b85f]" />}
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
  const thumbStripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Slide the filmstrip only - scrollIntoView would also scroll the page (it jumped the page down
    // to the thumbnails whenever a comp opened, fighting the scroll-to-top on every step change).
    const strip = thumbStripRef.current, thumb = thumbRefs.current[safeIndex]
    if (strip && thumb) {
      const left = thumb.offsetLeft // the strip is relative, so this is measured from its left edge
      if (left < strip.scrollLeft || left + thumb.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' })
    }
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
        <div ref={thumbStripRef} className="scrollbar-hide relative mt-1.5 flex gap-1 overflow-x-auto scroll-smooth">
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

// Phones (user, 10/20 - "mobile isn't set up for comparing property to property"): the subject and
// this comp face off photo-to-photo, then every fact head-to-head with the difference spelled out
// ("▲ 149 sq ft") instead of two truncated columns. Swipe the facts left / right for the next /
// previous comp; the new comp slides in from the side it came from.
type FaceOffRow = { label: string, a: React.ReactNode, b: React.ReactNode, an?: number | null, bn?: number | null, unit?: string, money?: boolean, decimals?: number }

function faceOffDelta(row: FaceOffRow): { text: string, up: boolean } | null {
  if (row.an == null || row.bn == null || !isFinite(row.an) || !isFinite(row.bn)) return null
  const d = row.bn - row.an
  if (Math.abs(d) < (row.decimals ? 0.005 : 0.5)) return null
  const abs = Math.abs(d)
  const shown = row.money
    ? formatMoney(abs, { compact: true })
    : abs.toLocaleString(undefined, { maximumFractionDigits: row.decimals ?? 0 })
  return { text: `${shown}${row.unit ? ` ${row.unit}` : ''}`, up: d > 0 }
}

function PhoneFaceOffTile({ who, address, price, photos, fallback, mapMode, lat, lng, onOpen, accent }: {
  who: string, address?: string | null, price?: number | null, photos?: string[] | null, fallback?: string | null,
  mapMode: boolean, lat?: number | null, lng?: number | null, onOpen: () => void, accent: 'ink' | 'gold',
}) {
  const list = photos && photos.length ? photos : fallback ? [fallback] : []
  const hasGeo = typeof lat === 'number' && typeof lng === 'number'
  return (
    <div className="relative min-w-0">
      <div onClick={onOpen} className="relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl bg-gray-100 shadow-[0_18px_34px_-22px_rgba(17,24,39,0.7)] ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
        {mapMode && hasGeo ? (
          <iframe
            title={`Map of ${address || who}`}
            src={`https://www.google.com/maps?q=${lat},${lng}&z=17&t=h&output=embed`}
            className="pointer-events-none h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : list.length > 0 ? (
          <SwipePhotos photos={list} resetKey={`${who}-${address}`} />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Home className="h-7 w-7 text-gray-300" /></div>
        )}
        <span className={`pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow ${accent === 'gold' ? 'bg-[#C9A24D] text-white' : 'bg-[#111827] text-white'}`}>{who}</span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-8">
          <p className="truncate text-[11px] font-black leading-tight text-white">{address || '—'}</p>
          <p className="text-[11px] font-bold text-[#f3d896]">{price != null ? formatMoney(price, { compact: true }) : 'Not listed'}</p>
        </div>
      </div>
    </div>
  )
}

function PhoneCompare({ subject, comp, comps, index, total, showMaps, onSelectIndex, onOpenSubjectDetails, onOpenCompDetails }: {
  subject: CmaSubjectProperty, comp: CmaComparable, comps: CmaComparable[], index: number, total: number, showMaps: boolean,
  onSelectIndex: (i: number) => void, onOpenSubjectDetails: () => void, onOpenCompDetails: () => void,
}) {
  const reduce = useReducedMotion()
  // Slide direction: the comp after this one comes in from the right, the one before from the left.
  const lastIndex = useRef(index)
  const dir = index >= lastIndex.current ? 1 : -1
  useEffect(() => { lastIndex.current = index }, [index])

  const subjectPrice = subject.list_price ?? null
  const compPrice = comp.sale_price ?? comp.list_price ?? null
  const subjectPsf = subject.list_price && agSqft(subject) ? pricePerSqft(subject.list_price, agSqft(subject)) : null
  const acres = (v?: number | null) => (v ? sqftToAcres(v) : null)
  const garageN = (g?: string | null) => { const m = (g || '').match(/(\d+)/); return m ? Number(m[1]) : (/none|^no$/i.test(g || '') ? 0 : null) }
  const rowsFor = (comp: CmaComparable): FaceOffRow[] => {
  const compPrice = comp.sale_price ?? comp.list_price ?? null
  const compPsf = pricePerSqft(comp.sale_price ?? comp.list_price, agSqft(comp))
  return [
    { label: 'Price', a: subjectPrice != null ? formatMoney(subjectPrice, { compact: true }) : '—', b: compPrice != null ? formatMoney(compPrice, { compact: true }) : '—', an: subjectPrice, bn: compPrice, money: true },
    { label: '$ / sq ft', a: subjectPsf ? `$${Math.round(subjectPsf)}` : '—', b: compPsf ? `$${Math.round(compPsf)}` : '—', an: subjectPsf, bn: compPsf, money: true },
    { label: 'Sq ft above grade', a: agSqft(subject) ? (agSqft(subject) as number).toLocaleString() : '—', b: agSqft(comp) ? (agSqft(comp) as number).toLocaleString() : '—', an: agSqft(subject), bn: agSqft(comp), unit: 'sq ft' },
    { label: 'Beds', a: subject.beds ?? '—', b: comp.beds ?? '—', an: subject.beds, bn: comp.beds, decimals: 1 },
    { label: 'Baths', a: subject.baths ?? '—', b: comp.baths ?? '—', an: subject.baths, bn: comp.baths, decimals: 1 },
    { label: 'Acres', a: acres(subject.lot_size) ?? '—', b: acres(comp.lot_size) ?? '—', an: acres(subject.lot_size), bn: acres(comp.lot_size), unit: 'ac', decimals: 2 },
    { label: 'Built', a: subject.year_built ?? '—', b: comp.year_built ?? '—', an: subject.year_built, bn: comp.year_built, unit: 'yrs' },
    { label: 'Garage', a: subject.garage || '—', b: comp.garage || '—', an: garageN(subject.garage), bn: garageN(comp.garage), unit: 'car' },
    { label: 'Basement', a: basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area) || '—', b: basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area) || '—' },
    { label: 'School', a: subject.school_district || '—', b: comp.school_district || '—' },
    ...(comp.distance_miles != null ? [{ label: 'Distance', a: '—', b: `${comp.distance_miles} mi` } as FaceOffRow] : []),
    ...(comp.sale_date ? [{ label: 'Sold', a: '—', b: formatDate(comp.sale_date) } as FaceOffRow] : []),
    { label: 'Days on market', a: subject.days_on_market ?? '—', b: comp.days_on_market ?? '—' },
  ]
  }

  // Phones (user, 10/21): the comparison cards sit side by side in a row that snaps from one comp to
  // the next as you swipe - no fade out/in. Swiping picks that comp; the arrows scroll the row.
  const scrollerRef = useRef<HTMLDivElement>(null)
  const fromSwipe = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (fromSwipe.current) { fromSwipe.current = false; return }
    const card = el.children[index] as HTMLElement | undefined
    if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 12, behavior: reduce ? 'auto' : 'smooth' })
  }, [index, reduce])
  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = scrollerRef.current
      if (!el) return
      const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth || el.clientWidth
      const i = Math.max(0, Math.min(comps.length - 1, Math.round(el.scrollLeft / (w + 12))))
      if (i !== index) { fromSwipe.current = true; onSelectIndex(i) }
    }, 90)
  }

  return (
    <div className="sm:hidden">
      <div className="relative grid grid-cols-2 gap-2.5 p-3">
        <PhoneFaceOffTile who="Subject" accent="ink" address={subject.street_address} price={subjectPrice} photos={subject.photos} fallback={subject.photo_url}
          mapMode={showMaps} lat={subject.latitude} lng={subject.longitude} onOpen={onOpenSubjectDetails} />
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={comp.id}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 34 } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -dir * 40, scale: 0.96, transition: { duration: 0.16 } }}
          >
            <PhoneFaceOffTile who={`Comp #${index + 1}`} accent="gold" address={comp.street_address} price={compPrice} photos={comp.photos} fallback={comp.photo_url}
              mapMode={showMaps} lat={comp.latitude} lng={comp.longitude} onOpen={onOpenCompDetails} />
          </motion.div>
        </AnimatePresence>
        {/* the "VS" medallion where the two photos meet */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white font-serif text-[13px] font-black italic text-[#111827] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)] ring-4 ring-[#C9A24D]/60 dark:bg-[#0B0B0B] dark:text-white">vs</span>
      </div>

      <div
        ref={scrollerRef}
        data-compare-row
        onScroll={onScroll}
        className="scrollbar-hide mb-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 px-3 pb-2"
      >
        {comps.map((c, ci) => (
          <div key={c.id} className="w-full shrink-0 snap-center snap-always">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0B0B0B]">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-gray-100 bg-[#fbfaf7] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] dark:border-gray-800 dark:bg-white/[0.03]">
                <span className="text-[#111827] dark:text-white">Subject</span>
                <span className="text-gray-300">·</span>
                <span className="text-right text-[#8b7355] dark:text-[#d7b974]">Comp #{ci + 1}</span>
              </div>
              {rowsFor(c).map((row, i) => {
                const delta = faceOffDelta(row)
                const same = String(row.a) === String(row.b) && String(row.a) !== '—'
                return (
                  <div key={row.label} className={`px-3 py-2 ${i % 2 ? 'bg-[#fbfaf7]/70 dark:bg-white/[0.015]' : ''}`}>
                    <p className="mb-0.5 text-center text-[9px] font-black uppercase tracking-[0.16em] text-gray-400">{row.label}</p>
                    <div className="grid grid-cols-2 items-start gap-3">
                      <p className="min-w-0 break-words text-[13px] font-black leading-snug text-[#111827] dark:text-white">{row.a}</p>
                      <div className="min-w-0 text-right">
                        <p className="break-words text-[13px] font-black leading-snug">
                          <span className={`rounded px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] ${!same && row.b !== '—' && row.a !== '—' ? 'cma-diff text-[#7a5a1e] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{row.b}</span>
                        </p>
                        {delta ? (
                          <p className={`mt-0.5 text-[10px] font-black ${delta.up ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-slate-500 dark:text-slate-400'}`}>{delta.up ? '▲' : '▼'} {delta.text}</p>
                        ) : same ? (
                          <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" strokeWidth={3} /> Same</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
  
          </div>
          </div>
        ))}
      </div>
        {total > 1 && (
          <p className="mb-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400">
            <ChevronLeft className="h-3 w-3" /> Swipe for the {index < total - 1 ? 'next' : 'previous'} comp <ChevronRight className="h-3 w-3" />
          </p>
        )}
    </div>
  )
}

// The side-by-side panel's prev/next comp arrows - gold-outlined so they read as the way through the comps.
const COMP_ARROW_CLS = 'flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#C9A24D]/60 bg-[#C9A24D]/10 text-[#8b7355] shadow-sm transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-30 dark:text-[#d7b974] dark:hover:text-white'

function SideBySidePanel({ subject, comp, comps, onSelectIndex, index, total, onUpdate, onUpdateStrength, onUpdateQuality, onPrev, onNext, onContinueClick, onOpenSubjectDetails, onOpenCompDetails, focusSignal = 0 }: {
  subject: CmaSubjectProperty, comp: CmaComparable, comps: CmaComparable[], onSelectIndex: (i: number) => void, index: number, total: number, onUpdate: (p: Partial<CmaComparable>) => void,
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
  const psf = pricePerSqft(comp.sale_price ?? comp.list_price, agSqft(comp))
  const subjectPsf = subject.list_price && agSqft(subject) ? pricePerSqft(subject.list_price, agSqft(subject)) : null
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
      {/* Phones: title + Pricing, then Photos/Map and the comp arrows on the row under it. Computers
          (user, 10/21): one row - the title, the comp arrows in the middle, Photos/Map + Continue on the right. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 sm:px-4">
        {/* Phones (user, 10/21): Pricing sits on the title line, so the row under it has room for
            the Photos/Map switch with its words showing, and the comp arrows. */}
        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-span-1">
          <p className="truncate text-base font-black text-[#111827] dark:text-white sm:text-lg">
            <span className="sm:hidden">Subject vs. Comp #{index + 1}</span><span className="hidden sm:inline">Comparing Subject vs. Comp #{index + 1}</span>
          </p>
        </div>
        {/* Photos/Map in the middle, the comp arrows on the right (user, 10/21: swapped, and the
            arrows made to stand out - gold outline, bigger chevrons, a bolder count). */}
        <div className="flex items-center justify-start gap-2 sm:col-start-3 sm:row-start-1 sm:justify-end">
          {(compHasGeo || subjectHasGeo) && (
            // Both choices always visible (user, 10/21: after switching to the map there was no
            // clear way back to the listing photos) - the active one is filled.
            <div role="group" aria-label="Show photos or map" className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-transparent">
              {([['photos', 'Photos', ImageIcon], ['map', 'Map', MapPin]] as const).map(([key, label, Icon]) => {
                const on = (key === 'map') === showMaps
                return (
                  <button key={key} type="button" aria-pressed={on} onClick={() => setShowMaps(key === 'map')}
                    title={key === 'map' ? 'Show both homes on a map - stays on as you flip through comps' : 'Show the listing photos'}
                    className={`inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition sm:gap-1 sm:px-3 ${
                      on ? 'bg-[#C9A24D] text-white shadow-sm shadow-[#C9A24D]/30' : 'text-gray-500 hover:text-[#8b7355] dark:text-gray-400 dark:hover:text-[#d7b974]'
                    }`}>
                    <Icon className="h-3.5 w-3.5" /> <span>{label}</span>
                  </button>
                )
              })}
            </div>
          )}
          <button onClick={onContinueClick} className="cma-btn hidden items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] sm:inline-flex">
            Continue to Pricing <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
        <div className="flex flex-nowrap items-center justify-end gap-1.5 sm:col-start-2 sm:row-start-1 sm:justify-center sm:gap-2">
          <div className="flex items-center gap-1.5">
            <button onClick={onPrev} disabled={index <= 0} aria-label="Previous comp" className={COMP_ARROW_CLS}><ChevronLeft className="h-5 w-5" strokeWidth={2.5} /></button>
            <span className="min-w-[2.6rem] text-center text-xs font-black tabular-nums text-[#111827] dark:text-white">{index + 1} / {total}</span>
            <button onClick={onNext} disabled={index >= total - 1} aria-label="Next comp" className={COMP_ARROW_CLS}><ChevronRight className="h-5 w-5" strokeWidth={2.5} /></button>
          </div>
        </div>
      </div>

      <PhoneCompare
        subject={subject} comp={comp} comps={comps} index={index} total={total} showMaps={showMaps}
        onSelectIndex={onSelectIndex} onOpenSubjectDetails={onOpenSubjectDetails} onOpenCompDetails={onOpenCompDetails}
      />

      <div className="hidden grid-cols-1 divide-y divide-gray-100 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-gray-800">
        <div className="flex flex-col p-4">
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
          <div className="mt-auto grid grid-flow-row-dense grid-cols-6 gap-1 pt-3">
            <CmaFactChip compact icon={DollarSign} value={formatMoney(subject.list_price, { compact: true })} label="Price" />
            <CmaFactChip compact icon={Calculator} value={subjectPsf ? `$${Math.round(subjectPsf)}` : '—'} label="$/Sqft" />
            <CmaFactChip compact span={pairSpan(agSqft(subject), agSqft(comp))} icon={Ruler} {...sqftChipProps(agSqft(subject))} label="Sqft above grade" />
            <CmaFactChip compact icon={Bed} value={subject.beds ?? '—'} label="Beds" />
            <CmaFactChip compact icon={Bath} value={subject.baths ?? '—'} label="Baths" />
            <CmaFactChip compact icon={LandPlot} value={subject.lot_size ? sqftToAcres(subject.lot_size) : '—'} label="Acres" />
            <CmaFactChip compact icon={Building2} value={subject.year_built ?? '—'} label="Built" />
            {basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area) && (
              <CmaFactChip compact span={pairSpan(basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area), basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area))} icon={Layers} value={basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area)!} label="Basement" />
            )}
            {subject.school_district && <CmaFactChip compact span={pairSpan(subject.school_district, comp.school_district)} icon={GraduationCap} value={subject.school_district} label="School" />}
            <CmaFactChip compact icon={Calendar} value={subject.days_on_market ?? '—'} label="DOM" />
          </div>
        </div>
        <div className="flex flex-col p-4">
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
          <div className="mt-auto grid grid-flow-row-dense grid-cols-6 gap-1 pt-3">
            <CmaFactChip compact icon={DollarSign} value={formatMoney(comp.sale_price ?? comp.list_price, { compact: true })} label="Price" vs={chipVs(subject.list_price, comp.sale_price ?? comp.list_price, { money: true })} />
            <CmaFactChip compact icon={Calculator} value={psf ? `$${Math.round(psf)}` : '—'} label="$/Sqft" vs={chipVs(subjectPsf, psf, { money: true })} />
            <CmaFactChip compact span={pairSpan(agSqft(subject), agSqft(comp))} icon={Ruler} {...sqftChipProps(agSqft(comp))} label="Sqft above grade" vs={chipVs(agSqft(subject), agSqft(comp), { unit: 'sf' })} />
            <CmaFactChip compact icon={Bed} value={comp.beds ?? '—'} label="Beds" vs={chipVs(subject.beds, comp.beds, { decimals: 1 })} />
            <CmaFactChip compact icon={Bath} value={comp.baths ?? '—'} label="Baths" vs={chipVs(subject.baths, comp.baths, { decimals: 1 })} />
            <CmaFactChip compact icon={LandPlot} value={comp.lot_size ? sqftToAcres(comp.lot_size) : '—'} label="Acres" vs={chipVs(subject.lot_size ? sqftToAcres(subject.lot_size) : null, comp.lot_size ? sqftToAcres(comp.lot_size) : null, { unit: 'ac', decimals: 2 })} />
            <CmaFactChip compact icon={Building2} value={comp.year_built ?? '—'} label="Built" vs={chipVs(subject.year_built, comp.year_built, { unit: 'yrs' })} />
            {basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area) && (
              <CmaFactChip compact span={pairSpan(basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area), basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area))} icon={Layers} value={basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area)!} label="Basement" vs={chipVs(basementFactValue(subject.basement, subject.below_grade_finished_area, subject.sqft, subject.above_grade_finished_area), basementFactValue(comp.basement, comp.below_grade_finished_area, comp.sqft, comp.above_grade_finished_area))} />
            )}
            {comp.school_district && <CmaFactChip compact span={pairSpan(subject.school_district, comp.school_district)} icon={GraduationCap} value={comp.school_district} label="School" vs={chipVs(subject.school_district, comp.school_district)} />}
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
            <button onClick={onPrev} disabled={index <= 0} aria-label="Previous comp" className={COMP_ARROW_CLS}><ChevronLeft className="h-5 w-5" strokeWidth={2.5} /></button>
            <span className="min-w-[2.6rem] text-center text-xs font-black tabular-nums text-[#111827] dark:text-white">{index + 1} / {total}</span>
            <button onClick={onNext} disabled={index >= total - 1} aria-label="Next comp" className={COMP_ARROW_CLS}><ChevronRight className="h-5 w-5" strokeWidth={2.5} /></button>
          </div>
          <span aria-hidden className="hidden sm:block" />
        </div>
        <p className="mb-3 mt-1 hidden text-[11px] font-semibold text-gray-500 dark:text-gray-400 sm:block">Each row describes this comp relative to the subject — "Comp Superior" means Comp #{index + 1} is the better one in that category; "Comp Inferior" means the subject is. Ratings are weighed in the final value review, not added as dollar lines.</p>
        <p className="mb-3 mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 sm:hidden">How Comp #{index + 1} compares — "Superior" means the comp is the better one.</p>
        {/* Comp Weight is a different kind of question from everything below it - it's asking how
            much analytical weight to give this comp overall, not how one attribute compares to
            the subject - so it gets its own bracketed "bubble" (bolder gold border + gradient +
            glow, its own header row) instead of sitting quietly in the same divided list as the
            quality-dimension rows. */}
        <div className="relative mb-3 overflow-hidden rounded-xl border-2 border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/15 via-white to-white p-2.5 shadow-[0_8px_24px_-12px_rgba(201,162,77,0.6)] dark:border-[#C9A24D]/70 dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517]">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase leading-tight tracking-wide text-[#8b7355] dark:text-[#d7b974] sm:w-24">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              Comp Weight
            </span>
            <div className="min-w-0 flex-1">
              <OptionGrid options={STRENGTH_OPTIONS} value={normalizeStrength(comp.strength)} onChange={onUpdateStrength} tones={STRENGTH_TIER_STYLES} />
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
          {comp.quality.lot === 'n_a' || isCondoSubject(subject)
            ? <QualityRowLayout label="Lot"><span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 dark:bg-gray-800">N/A - condo</span></QualityRowLayout>
            : <QualityRow label="Lot" options={QUALITY_3} value={comp.quality.lot} onChange={v => onUpdateQuality('lot', v)} colorCoded />}
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
        {/* The comp note (AI-written until the agent edits it) - a roomy box that grows with its
            text so the whole suggestion is readable without scrolling inside it (user, 10/20). */}
        {(() => {
          const isAiText = !!comp.ai_commentary && comp.commentary === comp.ai_commentary
          return (
            <div className={`mt-3 rounded-2xl border transition ${isAiText ? 'border-[#C9A24D]/35 bg-[#C9A24D]/5 p-2' : 'border-transparent'}`}>
              <p className={`flex items-center gap-1.5 px-2 pb-1.5 pt-0.5 text-[10px] font-black uppercase tracking-wide ${isAiText ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-400'}`}>
                {isAiText ? <><Sparkles className="h-3 w-3" /> AI Generated note</> : 'Your note on this comp'}
              </p>
              <AutoGrowTextarea
                value={comp.commentary || ''}
                onChange={v => onUpdate({ commentary: v })}
                placeholder="Why is this a strong or weak comp? Renovations, finish quality, land, functional vs. wasted space, what the sale demonstrates about the market..."
                className={`w-full resize-none rounded-xl px-3.5 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:text-white ${
                  isAiText ? 'border border-transparent bg-white/70 dark:bg-black/20' : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]'
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
// A textarea as tall as its text (at least ~5 lines), re-measured as the text changes and when the
// comp switches - so a long AI note is fully visible instead of hidden behind a two-line box.
function AutoGrowTextarea({ value, onChange, placeholder, className = '' }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(132, el.scrollHeight + 2)}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={5} className={className} />
}

function QualityRowLayout({ label, children }: { label: string, children: React.ReactNode }) {
  // Phones: the label on its own line above the choices (a 6rem label column squeezed the three
  // choices into two-line pills). Wider screens: label column on the left, like before.
  return (
    <div className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <p className="shrink-0 text-[10px] font-black uppercase leading-tight tracking-wide text-gray-700 dark:text-gray-400 sm:w-24">{label}</p>
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

// Phone wording for the rating choices - the full "Comp Inferior" / "Different from Subject"
// labels wrapped to two or three lines in a phone-width pill. The row's hint says it's the comp.
const SHORT_OPTION_LABEL: Record<string, string> = {
  'Comp Inferior': 'Inferior', 'Comp Superior': 'Superior',
  'Different from Subject': 'Different', 'Same as Subject': 'Same', 'Similar to Subject': 'Similar',
}

// One segmented row of equal-width choices; the picked one's colour slides across to the next pick.
function OptionGrid({ options, value, onChange, colorCoded, tones }: {
  options: { value: string, label: string }[], value?: string | null, onChange: (v: string) => void, colorCoded?: boolean,
  /** Per-value colour classes for the picked choice (defaults to the quality-tier colours / gold). */
  tones?: Record<string, string>
}) {
  const groupId = useId()
  const reduce = useReducedMotion()
  return (
    <div className="grid gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/70" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(opt => {
        const on = value === opt.value
        const tone = (tones && tones[opt.value]) || (colorCoded ? AGENT_QUALITY_TIER_STYLES[opt.value] : '') || 'bg-[#C9A24D] text-white'
        const toneText = tone.split(' ').filter(c => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')
        const toneBg = tone.split(' ').filter(c => !c.startsWith('text-') && !c.startsWith('dark:text-')).join(' ')
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={on}
            className={`relative min-h-[36px] rounded-lg px-1.5 py-2 text-center text-[10px] font-black uppercase leading-tight tracking-wide transition-colors duration-200 active:scale-[0.97] ${
              on ? toneText : 'text-gray-600 hover:bg-white/80 dark:text-gray-400 dark:hover:bg-gray-700/60'
            }`}
          >
            {on && (
              <motion.span
                layoutId={reduce ? undefined : `opt-${groupId}`}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                className={`absolute inset-0 rounded-lg shadow-md ${toneBg}`}
              />
            )}
            <span className="relative">
              <span className="sm:hidden">{SHORT_OPTION_LABEL[opt.label] || opt.label}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </span>
          </button>
        )
      })}
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
  { key: 'psf', label: 'Price / Sq Ft (above grade)', format: v => { const p = pricePerSqft(v.sale_price ?? v.list_price, agSqft(v)); return p ? `${p}` : '—' } },
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

// The same approach as the client report's Comparable Overview (app/cma/[slug]): on a phone the
// table keeps readable columns and slides sideways with the row names pinned on the left - on a
// SOLID background (the old pinned cells inherited a see-through row colour, so the sliding
// columns showed through and the words piled on top of each other, user 10/20). Wider screens fit
// every column without scrolling.
function ComparisonTable({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const pinned = 'sticky left-0 z-[2] w-[108px] min-w-[108px] whitespace-normal leading-tight shadow-[6px_0_10px_-8px_rgba(17,24,39,0.35)] sm:static sm:w-[16%] sm:min-w-0 sm:shadow-none'
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 sm:hidden">Swipe to see every comparable →</p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 pb-0.5 [scrollbar-width:thin] dark:border-gray-800 sm:overflow-hidden sm:rounded-2xl">
        <table className="w-full min-w-[600px] border-collapse text-[12.5px] sm:min-w-0 sm:table-fixed sm:text-sm">
          <thead>
            <tr className="border-b-2 border-[#111827] dark:border-white/80 sm:border-b sm:border-gray-200 sm:dark:border-gray-800">
              <th className={`${pinned} bg-white p-2.5 text-left text-[10px] font-black uppercase tracking-wide text-gray-400 dark:bg-[#151517] sm:bg-gray-50 sm:p-3 sm:dark:bg-[#1a1a1c]`}></th>
              <th className="bg-[#fbf6ea] p-2.5 text-left align-bottom text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:bg-[#211d14] dark:text-[#d7b974] sm:p-3">
                <span className="block truncate">Subject</span>
                <span className="mt-0.5 block truncate text-[9px] normal-case tracking-normal text-gray-400" title={subject.street_address || undefined}>{subject.street_address || '—'}</span>
              </th>
              {comparables.map((c, i) => (
                <th key={c.id} className="bg-white p-2.5 text-left align-bottom text-[11px] font-black uppercase tracking-wide text-gray-600 dark:bg-[#151517] dark:text-gray-400 sm:bg-gray-50 sm:p-3 sm:dark:bg-[#1a1a1c]">
                  <span className="block truncate">#{i + 1}</span>
                  <span className="mt-0.5 block truncate text-[9px] normal-case tracking-normal text-gray-400" title={c.street_address || undefined}>{c.street_address || '—'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => {
              const zebra = i % 2 === 1
              const rowBg = zebra ? 'bg-[#f7f7f8] dark:bg-[#1a1a1c]' : 'bg-white dark:bg-[#151517]'
              const subjectValue = row.format(subject)
              return (
                <tr key={row.label} className={`group border-t border-gray-100 dark:border-gray-800 ${rowBg}`}>
                  <td className={`${pinned} ${rowBg} p-2.5 text-[11.5px] font-bold text-gray-600 transition-colors group-hover:bg-[#f6efdc] dark:text-gray-400 dark:group-hover:bg-[#2a2416] sm:truncate sm:p-3 sm:text-xs`}>{row.label}</td>
                  <td className={`truncate p-2.5 text-[12.5px] font-black text-[#111827] transition-colors group-hover:bg-[#f6efdc] dark:text-white dark:group-hover:bg-[#2a2416] sm:p-3 sm:text-xs ${zebra ? 'bg-[#f6f0e1] dark:bg-[#1f1b13]' : 'bg-[#fbf7ee] dark:bg-[#1c1912]'}`} title={String(subjectValue)}>{subjectValue}</td>
                  {comparables.map(c => {
                    const value = row.format(c)
                    return <td key={c.id} className="truncate p-2.5 text-[12.5px] font-semibold text-gray-700 transition-colors group-hover:bg-[#f6efdc] dark:text-gray-300 dark:group-hover:bg-[#2a2416] sm:p-3 sm:text-xs" title={String(value)}>{value}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PsfChart({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const bars = comparables.map((c, i) => ({
    label: `#${i + 1}`,
    value: pricePerSqft(effectiveCompPrice(c), c.sqft) ?? 0,
  }))
  const subjectPsf = subject.list_price && agSqft(subject) ? pricePerSqft(subject.list_price, agSqft(subject)) : null
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

// Agent-only (grader, 10/21): the asking-price check moved the value 5%+ away from what the comps say -
// both numbers, so the agent decides before it goes out. Never in the PDF or the client link.
function AgentReviewBanner({ report }: { report: CmaReport }) {
  const note = report.pricing?.ai_estimate?.agent_review
  const pendingNote = (report.pricing?.ai_estimate as { current_competition?: { review?: string | null } } | null)?.current_competition?.review
  if (!note?.message && pendingNote) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">Review before sending</p>
          <p className="mt-0.5 text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">{pendingNote.replace(/^Review before sending:s*/, '')}</p>
        </div>
      </div>
    )
  }
  if (!note?.message) return null
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">Review before sending</p>
        <p className="mt-0.5 text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">{note.message.replace(/^Review before sending:s*/, '')}</p>
        <p className="mt-1.5 text-[11px] font-black tabular-nums text-amber-800 dark:text-amber-300">Comps alone: {formatMoney(note.comps_value)} · Final value: {formatMoney(note.final_value)}</p>
      </div>
    </div>
  )
}

function PricingStep({ report, onSave, onReportUpdated, onNext, onBack }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => Promise<CmaReport | null>, onReportUpdated: (r: CmaReport) => void, onNext: () => void, onBack?: () => void }) {
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
      <FlowDock step={4} total={5} onBack={onBack} onContinue={handleContinue} continueLabel="Review" />
      <AgentReviewBanner report={report} />
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

      <div className="hidden justify-end gap-2 sm:flex">
        <button onClick={handleContinue} className="cma-btn inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
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
  const [pdfBusy, setPdfBusy] = useState<'' | 'open' | 'download'>('')
  // iPhones get the PDF built ahead of time so a tap can hand it over (lib/pdfFile)
  const pdfFile = usePdfFile(
    () => agent ? <CmaPresentationDocument report={report} agent={agent} /> : null,
    `CMA-${(report.subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
    `${report.id}:${report.updated_at ?? ''}`, !!agent,
  )
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
      <FlowDock step={5} total={5} onBack={() => onJump('pricing')} continueLabel="Send" onContinue={() => document.getElementById('cma-complete-send')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      <AgentReviewBanner report={report} />
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
        {/* "How we got there" - the agent-only adjustment grid (10/20). The raw ValuationTracePanel
            stays admin-only (CmaLookupPanel, via the report's support code). */}
        <CmaHowWeGotThere estimate={report.pricing?.ai_estimate} />
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

      {!presentation.hidden_sections.includes('competition') && <CurrentCompetition report={report} agentView />}

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
            { key: 'competition', label: 'Current Competition' },
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

      <div id="cma-complete-send" className="scroll-mt-20" />
      <SectionCard title="Complete & Send" subtitle="Preview the PDF, copy the client link, or open the live CMA in a new tab.">
        {/* Rearranged 10/21 (user: "nicer animations and clicks, rearrange for mobile and
            desktop"). Mark Ready stays THE action (user, 10/17): a big gold button. Next to it on a
            computer - under it on a phone - three equal tiles: Open PDF, Download, Share link.
            Every press gives a squish, the icon nudges on hover, and a finished action flashes a
            check. The small switches, report code and Delete sit on their own row under a line. */}
        <div className="grid gap-2.5 sm:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)] sm:items-stretch">
          <motion.button
            onClick={markReady}
            disabled={readyState !== 'idle'}
            whileTap={readyState === 'idle' ? { scale: 0.96 } : undefined}
            className={`group relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl px-6 text-sm font-black uppercase tracking-wide shadow-lg transition-[background-color,box-shadow,transform] duration-300 disabled:cursor-default sm:h-auto sm:min-h-[4.5rem] ${
              readyState === 'done'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-600/30'
                : readyState === 'saving'
                  ? 'bg-[#C9A24D]/70 text-white shadow-[#C9A24D]/20'
                  : 'bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e0b85f] text-white shadow-[#C9A24D]/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#C9A24D]/50'
            }`}
          >
            <span className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ${readyState === 'done' ? 'translate-x-full' : 'group-hover:translate-x-full'}`} />
            {readyState === 'idle' && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#C9A24D]/50 animate-pulse" />}
            {readyState === 'saving' ? (
              <Loader2 className="relative h-4 w-4 animate-spin" />
            ) : readyState === 'done' ? (
              <span key="ready-check" className="cma-check-pop relative flex h-6 w-6 items-center justify-center rounded-full bg-white/25"><Check className="h-4 w-4" strokeWidth={3} /></span>
            ) : (
              <Sparkles className="relative h-4 w-4 transition group-hover:rotate-12 group-hover:scale-110" />
            )}
            <span className="relative">{readyState === 'saving' ? 'Marking Ready...' : readyState === 'done' ? 'Ready to send' : 'Mark Ready'}</span>
          </motion.button>

          <div className="grid grid-cols-3 gap-2">
            {/* Open in a new tab / save as a file - never replaces this page (user, 10/21) */}
            {(['open', 'download'] as const).map(kind => (
              <ExportTile
                key={kind}
                icon={kind === 'open' ? ExternalLink : Download}
                label={pdfFile.iosHint === 'preparing' ? 'Preparing…' : pdfFile.iosHint === 'tap' ? 'Tap again' : kind === 'open' ? 'Open PDF' : 'Download'}
                hint={kind === 'open' ? 'New tab' : 'Save the PDF'}
                title={kind === 'open' ? 'Open the PDF in a new tab' : 'Save the PDF to this device'}
                busy={pdfBusy === kind || pdfFile.iosHint === 'preparing'}
                disabled={!agent || !!pdfBusy}
                onClick={async () => {
                  if (!agent) return false
                  setPdfBusy(kind)
                  try { await pdfFile.run(kind === 'open' ? 'tab' : 'share'); return true }
                  catch { showToast("Couldn't make the PDF. Try again in a moment.", 'error'); return false }
                  finally { setPdfBusy('') }
                }}
              />
            ))}
            <ExportTile
              icon={Share2}
              label="Share link"
              hint="Copy or send"
              title="Share Link"
              dark
              busy={sharing}
              disabled={sharing}
              onClick={async () => { await handleShare(); return false }}
            />
          </div>
        </div>

        {/* Once it's marked ready, a way out right here (user, 10/21: reopening a finished CMA meant
            scrolling all the way back up to the back arrow to leave it). */}
        {readyState === 'done' && (
          <Link href="/studio/cma" className="cma-btn mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            <ArrowLeft className="h-4 w-4" /> Done - back to my CMAs
          </Link>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">

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
              title={`Visitor default theme: ${presentation.default_theme === 'light' ? 'Ivory' : 'Midnight'} - click to switch`}
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

// One export action on the last step (Open PDF / Download / Share link). Icon in a round badge over
// the label on a phone, beside it on a computer. Squishes on press, the icon nudges up on hover,
// and when `onClick` resolves true the badge flashes a check for a moment.
function ExportTile({ icon: Icon, label, hint, title, busy, disabled, dark = false, onClick }: {
  icon: React.ComponentType<{ className?: string }>, label: string, hint: string, title: string,
  busy: boolean, disabled: boolean, dark?: boolean, onClick: () => Promise<boolean>,
}) {
  const reduce = useReducedMotion()
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])
  return (
    <motion.button
      type="button"
      title={title}
      disabled={disabled}
      whileTap={disabled || reduce ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      onClick={async () => {
        if (await onClick()) {
          setFlash(true)
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setFlash(false), 1600)
        }
      }}
      className={`group relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border px-2 py-2.5 text-center transition-[border-color,box-shadow,transform,background-color] duration-300 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:justify-start sm:gap-3 sm:px-3.5 sm:text-left [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:disabled:hover:translate-y-0 ${
        dark
          ? 'border-[#111827] bg-[#111827] text-white shadow-md shadow-black/20 [@media(hover:hover)]:hover:shadow-lg dark:border-white dark:bg-white dark:text-[#111827]'
          : 'border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] text-[#8b7355] [@media(hover:hover)]:hover:border-[#C9A24D]/60 [@media(hover:hover)]:hover:bg-[#C9A24D]/[0.12] [@media(hover:hover)]:hover:shadow-[0_12px_24px_-16px_rgba(201,162,77,0.9)] dark:text-[#d7b974]'
      }`}
    >
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
        flash ? 'bg-emerald-500 text-white' : dark ? 'bg-white/15 dark:bg-[#111827]/10' : 'bg-white shadow-sm dark:bg-black/30'
      }`}>
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : flash
            ? <Check key="flash" className="cma-check-pop h-4 w-4" strokeWidth={3} />
            : <Icon className="h-4 w-4 transition-transform duration-300 [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:scale-110" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10.5px] font-black uppercase tracking-wide sm:text-[11px]">{flash ? 'Done' : label}</span>
        <span className={`hidden truncate text-[10.5px] font-semibold sm:block ${dark ? 'text-white/60 dark:text-[#111827]/55' : 'text-[#8b7355]/70 dark:text-[#d7b974]/60'}`}>{hint}</span>
      </span>
    </motion.button>
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

