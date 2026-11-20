'use client'

// The Review step: the REAL client report (CmaReportView), editable in place.
//   - tap any wording or number and type; each section moves, hides or (an agent's own note) deletes;
//     a comp moves; before the AI has written the report it also comes off or goes back on, and one can be
//     added (after that the comps are locked - see cmaCompsLocked); any photo can be made a home's main photo;
//   - Mark ready / Open PDF / Download / Share sit in the bar at the top;
//   - every edit is kept on the report (see lib/cmaReport for where) and saved by itself, and the PDF buttons
//     build from the very copy on screen - so the page, the client link and the PDF always agree.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Download, ExternalLink, Eye, EyeOff, GripVertical, LayoutList, Loader2, Lock, Moon, MoreHorizontal,
  Pencil, Plus, RotateCcw, Share2, Sparkles, Sun, Trash2, Undo2,
} from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { usePdfFile } from '@/lib/pdfFile'
import { hasEmailSignatureAccess } from '@/lib/navAccess'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import { CMA_STATUS_STYLES, CmaGuidanceSection, cmaSupportCode, formatMoney, sortComparables } from '@/lib/cma'
import { cmaQaBlocking, isStaleArtifactOnly } from '@/lib/cmaQa'
import {
  CMA_SECTIONS, CmaFigureKey, CmaTextKey, cmaAdoptSavedRatings, cmaCompsLocked, cmaDefaultFigure, cmaDefaultSections, cmaEngineNumbering, cmaFigureEdited, cmaFigurePatch, cmaIsHidden,
  cmaNotes, cmaNumberingSnapshot, cmaSectionOrder, cmaSectionsToText, cmaShownComparables, cmaTextEdited, isNoteKey, noteKey,
} from '@/lib/cmaReport'
import { CmaPresentationDocument } from '@/lib/pdfs'
import { CmaComparable, CmaPresentationSettings, CmaPublicResponse, CmaQualityAssessment, CmaReport, Site, SiteDomain } from '@/types'
import FlowDock from '@/components/ui/FlowDock'
import GrammarFixButton, { type GrammarChange, type GrammarItem } from '@/components/ui/GrammarFix'
import CmaSheet from '@/components/cma/CmaSheet'
import CmaShareLinksModal from '@/components/CmaShareLinksModal'
import WarningConfirmModal from '@/components/WarningConfirmModal'
import CmaReportView from './CmaReportView'
import type { CmaEditHooks, CmaSectionState, EditorComp } from './editTypes'

type Save = (patch: Partial<CmaReport>, opts?: { silent?: boolean }) => Promise<CmaReport | null>
type Draft = Pick<CmaReport, 'client_name' | 'presentation' | 'comparables' | 'pricing'>

const SECTION_LABEL: Record<string, string> = Object.fromEntries(CMA_SECTIONS.map(s => [s.key, s.label]))
const emptyPresentation = (): CmaPresentationSettings => ({ hidden_sections: [], hidden_comp_ids: [] })
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(16).slice(2)}`)

/** True when the comps on the report are not the ones its value was worked out from. Comps lock once the AI has
 *  written the report (owner, 11/16), so this can only be true on a report changed before that rule. */
function compsChangedSinceRun(report: Pick<CmaReport, 'comparables' | 'pricing' | 'presentation' | 'mode' | 'subject'>): { changed: boolean, removed: number, added: number } {
  if (!report.pricing?.ai_estimate) return { changed: false, removed: 0, added: 0 }
  const run = cmaEngineNumbering(report)
  const now = report.comparables.filter(c => c.is_included).map(c => c.id)
  const removed = run.filter(id => !now.includes(id)).length
  const added = now.filter(id => !run.includes(id)).length
  return { changed: removed + added > 0, removed, added }
}

// ---- Small pieces of the editor's chrome -----------------------------------------------------------------------

const barBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 outline-none transition hover:bg-[#C9A24D]/15 hover:text-[#8b7355] focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-90 disabled:pointer-events-none disabled:opacity-25 dark:text-gray-400 dark:hover:text-[#d7b974] max-sm:h-9 max-sm:w-9'

function SectionBar({ label, state, onUp, onDown, onToggle, onDelete }: {
  label: string, state: CmaSectionState, onUp: () => void, onDown: () => void, onToggle: () => void, onDelete?: () => void,
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#C9A24D]/45 bg-[#C9A24D]/[0.06] py-1 pl-3 pr-1">
      <p className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">
        <span className="truncate">{label}</span>
        {state.hidden && <span className="shrink-0 rounded-full bg-gray-500/15 px-2 py-0.5 text-[9px] tracking-wide text-gray-500 dark:text-gray-400">Hidden from the client</span>}
        {!state.hidden && state.empty && <span className="shrink-0 rounded-full bg-gray-500/15 px-2 py-0.5 text-[9px] tracking-wide text-gray-500 dark:text-gray-400">Nothing to show yet</span>}
      </p>
      <div className="flex shrink-0 items-center">
        {!state.fixed && (
          <>
            <button type="button" className={barBtn} title="Move up" aria-label={`Move ${label} up`} disabled={state.first} onClick={onUp}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" className={barBtn} title="Move down" aria-label={`Move ${label} down`} disabled={state.last} onClick={onDown}><ArrowDown className="h-4 w-4" /></button>
          </>
        )}
        {onDelete
          ? <button type="button" className={`${barBtn} hover:!bg-red-500/15 hover:!text-red-600`} title="Delete this section" aria-label={`Delete ${label}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
          : (
            <button type="button" className={`${barBtn} w-auto gap-1.5 px-2.5 text-[10px] font-black uppercase tracking-wide max-sm:w-auto`} aria-pressed={state.hidden} onClick={onToggle}
              title={state.hidden ? 'Show this section to the client' : 'Hide this section from the client'}>
              {state.hidden ? <><Eye className="h-4 w-4" /> Show</> : <><EyeOff className="h-4 w-4" /> Hide</>}
            </button>
          )}
      </div>
    </div>
  )
}

function ArrangeRow({ id, label, hidden, fixed, note, onToggle }: { id: string, label: string, hidden: boolean, fixed: boolean, note: boolean, onToggle: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} whileDrag={{ scale: 1.02, boxShadow: '0 18px 40px -18px rgba(17,24,39,0.55)' }}
      className={`flex select-none items-center gap-2 rounded-2xl border bg-white px-2 py-1.5 dark:bg-[#1b1b1e] ${hidden ? 'border-gray-200 opacity-60 dark:border-gray-800' : 'border-[#C9A24D]/40'}`}>
      <button type="button" aria-label={`Drag ${label}`} disabled={fixed} onPointerDown={e => { if (!fixed) controls.start(e) }}
        className="flex h-10 w-9 shrink-0 touch-none items-center justify-center rounded-lg text-gray-400 disabled:opacity-20 [&:not(:disabled)]:cursor-grab [&:not(:disabled)]:active:cursor-grabbing">
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#111827] dark:text-white">{label}</span>
        <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400">{fixed ? 'Always first' : note ? 'Your own section' : hidden ? 'Hidden from the client' : 'On the report'}</span>
      </span>
      {!note && (
        <button type="button" onClick={onToggle} aria-pressed={hidden} aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-90 ${hidden ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]'}`}>
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </Reorder.Item>
  )
}

function Switch({ on, onClick, label, hint, left, right }: { on: boolean, onClick: () => void, label: string, hint?: string, left?: React.ReactNode, right?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[#C9A24D]/60 active:scale-[0.99] dark:border-gray-800 dark:bg-[#1b1b1e]">
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#111827] dark:text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${on ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700'}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#111827] shadow transition-transform duration-300 ${on ? 'translate-x-5' : 'translate-x-0'}`}>{on ? right : left}</span>
      </span>
    </button>
  )
}

// ---- The editor -------------------------------------------------------------------------------------------------

export default function CmaReportEditor({ report, onSave, onReportUpdated, onBack, onGoToPricing, onDeleted, reviewCount = 0, renderAddComp }: {
  report: CmaReport
  onSave: Save
  onReportUpdated: (r: CmaReport) => void
  onBack: () => void
  onGoToPricing: () => void
  onDeleted: () => void
  /** How many agent-only "check before sending" notes the report has (they live in the Pricing step). */
  reviewCount?: number
  /** The add-a-comp window (the page owns comp search), used only before the AI has written the report.
   *  Called with what the editor knows; returns the window. */
  renderAddComp?: (p: { open: boolean, onClose: () => void, comparables: CmaComparable[], onAdd: (c: CmaComparable) => void }) => React.ReactNode
}) {
  const { showToast } = useToast()
  const router = useRouter()
  const { user } = useAuth()
  const reduce = useReducedMotion()

  // ---- The copy being edited. Typing lands here first (instant), then saves by itself a moment later. ----------
  const [draft, setDraftState] = useState<Draft>(() => ({ client_name: report.client_name, presentation: report.presentation || emptyPresentation(), comparables: report.comparables, pricing: report.pricing }))
  const draftRef = useRef(draft)
  const seededId = useRef(report.id)
  useEffect(() => {
    if (seededId.current === report.id) return
    seededId.current = report.id
    const next = { client_name: report.client_name, presentation: report.presentation || emptyPresentation(), comparables: report.comparables, pricing: report.pricing }
    draftRef.current = next
    setDraftState(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id])
  const reportRef = useRef(report)
  reportRef.current = report
  // On a written report the ratings are the saved ones (a save that changes one is refused whole - the note typed
  // with it too): the copy being edited never keeps a rating the saved report does not have.
  useEffect(() => {
    if (!cmaCompsLocked(report)) return
    const next = cmaAdoptSavedRatings(draftRef.current.comparables, report.comparables)
    if (next === draftRef.current.comparables) return
    draftRef.current = { ...draftRef.current, comparables: next }
    if ('comparables' in pending.current) pending.current.comparables = next
    setDraftState(draftRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.comparables, report.ai_analysis])

  const pending = useRef<Partial<CmaReport>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(async (): Promise<CmaReport | null> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const patch = pending.current
    pending.current = {}
    if (Object.keys(patch).length === 0) return null
    const r = reportRef.current
    // An edit made here is the agent finishing the report, not un-finishing it: a shared report keeps its
    // link live (the server would otherwise send a changed report back to Draft).
    if (('comparables' in patch || 'pricing' in patch) && (r.status === 'READY' || r.status === 'SHARED') && !('status' in patch)) patch.status = r.status
    const saved = await onSave(patch, { silent: true })
    // A save after the engine's final check leaves the report marked "changed since the check" - the free
    // re-stamp clears that (no AI, no cost), exactly as the other steps do.
    if (saved && isStaleArtifactOnly(cmaQaBlocking(saved))) {
      const res = await api.cma.resyncQa(saved.id)
      if (res.success && res.data) { onReportUpdated(res.data); return res.data }
    }
    return saved
  }, [onSave, onReportUpdated])
  /** Change the copy being edited. `lazy` = typing: the page catches up a beat later so each key stays instant. */
  const change = useCallback((fn: (d: Draft) => Partial<Draft>, opts: { lazy?: boolean, now?: boolean } = {}) => {
    const patch = fn(draftRef.current)
    draftRef.current = { ...draftRef.current, ...patch }
    Object.assign(pending.current, patch)
    if (drawTimer.current) { clearTimeout(drawTimer.current); drawTimer.current = null }
    if (opts.lazy) drawTimer.current = setTimeout(() => setDraftState(draftRef.current), 220)
    else setDraftState(draftRef.current)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flush() }, opts.now ? 0 : 700)
  }, [flush])
  // Leaving the step (or the tab) with something typed: it is saved on the way out.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      if (drawTimer.current) clearTimeout(drawTimer.current)
      void flush()
    }
  }, [flush])

  const working = useMemo<CmaReport>(() => ({ ...report, ...draft }), [report, draft])
  const pres = draft.presentation
  const setPres = (fn: (p: CmaPresentationSettings) => CmaPresentationSettings, opts?: { lazy?: boolean, now?: boolean }) => change(d => ({ presentation: fn(d.presentation || emptyPresentation()) }), opts)

  // ---- The agent (as the client page and the PDF show them) -----------------------------------------------------
  const [agent, setAgent] = useState<CmaPublicResponse['agent'] | null>(null)
  const [hubSlug, setHubSlug] = useState<string | null>(null)
  useEffect(() => {
    Promise.allSettled([api.studio.getBrandKit(), api.agentHub.getMine()]).then(([brandResult, hubResult]) => {
      const brandRes = brandResult.status === 'fulfilled' ? brandResult.value : null
      const hubRes = hubResult.status === 'fulfilled' ? hubResult.value : null
      const brand = brandRes?.success ? brandRes.data : null
      const hub = hubRes?.success ? (hubRes.data as any) : null
      const hubConfig = hub?.config || null
      const photo = hubConfig?.profilePhotoUrl || hubConfig?.profile_photo_url || user?.photo_url || null
      setHubSlug(hub?.slug || null)
      setAgent({
        name: user ? `${user.first_name} ${user.last_name}` : '',
        headshot_url: photo,
        brokerage: user?.brokerage || null,
        email: hubConfig?.contact?.email || user?.email || null,
        phone: hubConfig?.contact?.call || hubConfig?.contact?.phone || hubConfig?.contact?.mobile || (user as any)?.phone || null,
        logo_url: brand?.personal_logo_url || brand?.brokerage_logo_url || null,
        primary_color: brand?.primary_color || '#111827',
        secondary_color: brand?.secondary_color || '#C9A24D',
        agent_hub_slug: hub?.slug || null,
        idx_site_url: null,
      })
    })
  }, [user])
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  useEffect(() => {
    // Only IDX plans have a website - asking on other plans just 403s (console noise).
    if (!user || user.plan_tier !== 'IDX') return
    Promise.all([api.sites.getMine(), api.sites.getDomains()]).then(([s, d]) => {
      if (s.success && s.data) setIdxSite(s.data)
      if (d.success && d.data) setIdxDomains(d.data)
    }).catch(() => {})
  }, [user?.plan_tier])   // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo<CmaPublicResponse>(() => ({
    client_name: working.client_name, mode: working.mode, subject: working.subject, comparables: working.comparables, pricing: working.pricing,
    market_context: working.market_context, improvements: working.improvements, presentation: working.presentation,
    agent: agent || { name: user ? `${user.first_name} ${user.last_name}` : '', brokerage: user?.brokerage || null, email: user?.email || null },
    signature_hub_slug: hasEmailSignatureAccess(user?.plan_tier) && report.use_signature_card !== false ? hubSlug : null,
    map_ref: report.id, updated_at: report.updated_at,
  }), [working, agent, user, hubSlug, report.id, report.updated_at, report.use_signature_card])

  // ---- The client's look: the page takes the theme the client link opens in, so this IS what they get ------------
  const theme: 'light' | 'dark' = pres?.default_theme === 'light' ? 'light' : 'dark'
  useLayoutEffect(() => {
    const root = document.documentElement
    const had = root.classList.contains('dark')
    root.classList.toggle('dark', theme === 'dark')
    return () => { root.classList.toggle('dark', had) }
  }, [theme])

  // ---- PDF, share, ready, delete -------------------------------------------------------------------------------
  const [pdfBusy, setPdfBusy] = useState<'' | 'open' | 'download'>('')
  const pdfReport = useMemo(() => ({ ...working, map_ref: report.id }), [working, report.id])
  const pdfFile = usePdfFile(
    () => (agent ? <CmaPresentationDocument report={pdfReport} agent={agent as any} /> : null),
    `CMA-${(report.subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
    `${report.id}:${report.updated_at ?? ''}`, !!agent,
  )
  const runPdf = async (kind: 'open' | 'download') => {
    if (!agent || pdfBusy) return
    setPdfBusy(kind)
    try { await pdfFile.run(kind === 'open' ? 'tab' : 'share') }
    catch { showToast("Couldn't make the PDF. Try again in a moment.", 'error') }
    finally { setPdfBusy('') }
  }
  const [showShare, setShowShare] = useState(false)
  const [shareLinks, setShareLinks] = useState<{ openHousePalUrl: string, websiteUrl: string | null } | null>(null)
  const [sharing, setSharing] = useState(false)
  const handleShare = async () => {
    setSharing(true)
    await flush()
    const response = await api.cma.share(report.id)
    if (response.success && response.data) {
      await onSave({}, { silent: true })   // brings the Shared status and the link back into the page
      setShareLinks({ openHousePalUrl: openHousePalPublicUrl(response.data.public_path), websiteUrl: websitePublicUrl(idxSite, idxDomains, response.data.public_path) })
      setShowShare(true)
    } else showToast(response.error || 'Could not create a share link.', 'error')
    setSharing(false)
  }
  const done = report.status === 'READY' || report.status === 'SHARED'
  const [readying, setReadying] = useState(false)
  const markReady = async () => {
    if (readying || done) return
    setReadying(true)
    await flush()
    const saved = await onSave({ status: 'READY' }, { silent: true })
    setReadying(false)
    if (saved) showToast('CMA marked ready', 'success')
  }
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    setDeleting(true)
    const response = await api.cma.remove(report.id)
    setDeleting(false)
    if (response.success) onDeleted()
    else { setShowDelete(false); showToast(response.error || 'Could not delete this CMA.', 'error') }
  }

  // ---- Sections --------------------------------------------------------------------------------------------------
  const order = cmaSectionOrder(working)
  const setOrder = (next: string[]) => setPres(p => ({ ...p, section_order: ['subject', ...next.filter(k => k !== 'subject')] }), { now: true })
  const moveSection = (key: string, dir: -1 | 1) => {
    const movable = order.filter(k => k !== 'subject')
    const i = movable.indexOf(key), j = i + dir
    if (i < 0 || j < 0 || j >= movable.length) return
    ;[movable[i], movable[j]] = [movable[j], movable[i]]
    setOrder(movable)
  }
  const toggleHidden = (key: string) => setPres(p => {
    const hidden = new Set(p.hidden_sections || [])
    hidden.has(key) ? hidden.delete(key) : hidden.add(key)
    return { ...p, hidden_sections: Array.from(hidden) }
  }, { now: true })
  const [focusNote, setFocusNote] = useState<string | null>(null)
  const addNote = (afterKey: string | null) => {
    const id = newId()
    setPres(p => {
      const current = cmaSectionOrder({ ...working, presentation: p })
      const at = afterKey ? current.indexOf(afterKey) + 1 : current.length
      const next = [...current]
      next.splice(at > 0 ? at : next.length, 0, noteKey(id))
      return { ...p, notes: [...(p.notes || []), { id, title: '', body: '' }], section_order: next }
    }, { now: true })
    setFocusNote(id)
  }
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const removeNote = (id: string) => setPres(p => ({ ...p, notes: (p.notes || []).filter(n => n.id !== id), section_order: (p.section_order || []).filter(k => k !== noteKey(id)) }), { now: true })
  useEffect(() => {
    if (!focusNote) return
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-cma-section="note:${focusNote}"] [role="textbox"]`)
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
      el?.focus({ preventScroll: true })
      setFocusNote(null)
    }, 120)
    return () => clearTimeout(t)
  }, [focusNote, reduce])

  // ---- Comps -------------------------------------------------------------------------------------------------------
  const shown = cmaShownComparables(working)
  const changeComps = (fn: (list: CmaComparable[]) => CmaComparable[], opts?: { lazy?: boolean, now?: boolean, structural?: boolean }) => change(d => {
    const next: Partial<Draft> = { comparables: fn(d.comparables) }
    // Before the comps first move, keep the numbers the report's wording uses for them (see lib/cmaReport).
    if (opts?.structural) next.presentation = cmaNumberingSnapshot({ ...working, ...d })
    return next
  }, opts)
  const moveComp = (id: string, dir: -1 | 1) => {
    const i = shown.findIndex(c => c.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= shown.length) return
    const a = shown[i], b = shown[j]
    changeComps(list => list.map(c => (c.id === a.id ? { ...c, order_index: b.order_index } : c.id === b.id ? { ...c, order_index: a.order_index } : c)), { now: true, structural: true })
  }
  // Comps lock once the AI has written the report (owner, 11/16: "you can only change comps before you click
  // the AI button ... you can still edit text manually ... just like we do on blogs"). The server refuses a
  // change to which comps are on a finished report, so none is offered here: no remove, no put back, no add.
  // Moving a comp up or down, its note and its ratings stay.
  const locked = cmaCompsLocked(report)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const removeComp = (id: string) => { if (!locked) changeComps(list => list.map(c => (c.id === id ? { ...c, is_included: false, override_reason: c.override_reason || 'Taken off the report by the agent' } : c)), { now: true, structural: true }) }
  const restoreComp = (id: string) => {
    // (a comp hidden from the client on an older report is still ON the report, so showing it again is not a
    // comp change and stays possible after the lock)
    const off = draftRef.current.comparables.find(c => c.id === id)?.is_included === false
    if (off && locked) return
    if (off) changeComps(list => list.map(c => (c.id === id ? { ...c, is_included: true, override_reason: null } : c)), { now: true, structural: true })
    if ((pres?.hidden_comp_ids || []).includes(id)) setPres(p => ({ ...p, hidden_comp_ids: (p.hidden_comp_ids || []).filter(x => x !== id) }), { now: true })
  }
  const [addOpen, setAddOpen] = useState(false)
  const addComp = (c: CmaComparable) => {
    if (locked) return
    changeComps(list => [...list, { ...c, is_included: true, order_index: Math.max(-1, ...list.map(x => x.order_index ?? 0)) + 1 }], { now: true, structural: true })
    showToast(`${c.street_address || 'The home'} is on the report as a comp.`, 'success')
  }
  // Only a report whose comps were changed BEFORE the lock can differ from its run. It keeps one way back to a
  // write-up that matches: the refresh below. No new report can get into this state.
  const compChange = compsChangedSinceRun(working)
  const soldLeft = working.comparables.filter(c => c.is_included && c.status === 'sold').length

  // "Refresh value and write-up": the real re-run (uses the agent's AI allowance) - asked first, never automatic.
  const [refreshAsk, setRefreshAsk] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshValue = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshAsk(false)
    await flush()
    const res = await api.cma.recomputeValuation(report.id)
    setRefreshing(false)
    if (res.success && res.data) {
      // The server's fresh report replaces the working copy: new value, range and wording. What the agent typed
      // themselves (presentation) comes back with it untouched.
      const next = { client_name: res.data.client_name, presentation: res.data.presentation || emptyPresentation(), comparables: res.data.comparables, pricing: res.data.pricing }
      draftRef.current = next
      pending.current = {}
      setDraftState(next)
      onReportUpdated(res.data)
      setVersions(v => Object.fromEntries(['valuation_notes', 'inspection', 'offer', 'pricing_strategy', 'listing_prep', 'competition_commentary'].map(k => [k, (v[k] || 0) + 1])))
      showToast('Value and write-up refreshed from the comps on this report.', 'success')
    } else {
      showToast(res.error || 'The refresh did not go through. Nothing was changed.', 'error')
    }
  }

  // ---- Wording and numbers ---------------------------------------------------------------------------------------
  const [versions, setVersions] = useState<Record<string, number>>({})
  const setText = (key: CmaTextKey, sections: CmaGuidanceSection[]) => {
    const text = cmaSectionsToText(sections)
    const own = cmaSectionsToText(cmaDefaultSections({ ...working, presentation: { ...(draftRef.current.presentation || emptyPresentation()), text: {} } }, key))
    setPres(p => {
      const t = { ...(p.text || {}) }
      if (text === own) delete t[key]   // typed back to the report's own wording: no longer "changed"
      else t[key] = text
      return { ...p, text: t }
    }, { lazy: true })
  }
  const resetText = (key: CmaTextKey) => {
    setPres(p => { const t = { ...(p.text || {}) }; delete t[key]; return { ...p, text: t } }, { now: true })
    setVersions(v => ({ ...v, [key]: (v[key] || 0) + 1 }))
  }
  const setFigure = (key: CmaFigureKey, value: number | null) => change(d => cmaFigurePatch({ ...working, ...d }, key, value) as Partial<Draft>, { now: true })
  const resetFigure = (key: CmaFigureKey) => setPres(p => { const f = { ...(p.figures || {}) }; delete f[key]; return { ...p, figures: f } }, { now: true })

  // Sections and comps glide to their new place when the agent moves, hides, removes or adds one. Done by hand
  // (measure, then a short transform) rather than with the animation library's layout feature: that one, running
  // at the same moment a window was closing, left the closed window on the page - invisible and blocking taps.
  const flipRoot = useRef<HTMLDivElement>(null)
  const flipPrev = useRef<Map<string, number>>(new Map())
  const flipOrder = useRef('')
  const orderSignature = `${order.join(',')}|${working.comparables.map(c => `${c.id}:${c.order_index}:${c.is_included ? 1 : 0}`).join(',')}`
  useLayoutEffect(() => {
    const root = flipRoot.current
    if (!root) return
    const now = new Map<string, number>()
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flip]'))
    for (const el of els) now.set(el.dataset.flip as string, el.getBoundingClientRect().top + window.scrollY)
    if (flipOrder.current && flipOrder.current !== orderSignature && !reduce) {
      for (const el of els) {
        const before = flipPrev.current.get(el.dataset.flip as string)
        const after = now.get(el.dataset.flip as string)
        if (before == null || after == null) continue
        const dy = before - after
        if (Math.abs(dy) < 2 || Math.abs(dy) > 6000) continue
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: Math.min(520, 260 + Math.abs(dy) * 0.12), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
      }
    }
    flipOrder.current = orderSignature
    flipPrev.current = now
  })

  // ---- Fix grammar (11/19): only what the agent typed - their own wording, their own notes, comp paragraphs they wrote
  const TEXT_LABELS: Record<string, string> = {
    valuation_notes: 'Value notes', inspection: 'Inspection', offer: 'Offer', pricing_strategy: 'Pricing strategy',
    listing_prep: 'Listing prep', competition_commentary: 'Competition',
  }
  const grammarItems: GrammarItem[] = [
    ...Object.entries(pres?.text || {}).filter(([, v]) => (v || '').trim())
      .map(([k, v]) => ({ id: `text:${k}`, text: v, label: k.startsWith('title:') ? 'A heading' : (TEXT_LABELS[k] || 'Your wording') })),
    ...(pres?.notes || []).flatMap(n => [
      ...(n.title?.trim() ? [{ id: `note-title:${n.id}`, text: n.title, label: 'Your note - title' }] : []),
      ...(n.body?.trim() ? [{ id: `note-body:${n.id}`, text: n.body, label: 'Your note' }] : []),
    ]),
    ...working.comparables.filter(c => (c.commentary || '').trim() && (c.commentary_by_agent || (c.commentary || '').trim() !== (c.ai_commentary || '').trim()))
      .map(c => ({ id: `comp:${c.id}`, text: c.commentary || '', label: `Comp - ${c.street_address || 'paragraph'}` })),
  ]
  const applyGrammar = (picked: GrammarChange[]) => {
    const texts = picked.filter(c => c.id.startsWith('text:'))
    const notes = picked.filter(c => c.id.startsWith('note-'))
    const compsFixed = new Map(picked.filter(c => c.id.startsWith('comp:')).map(c => [c.id.slice(5), c.after]))
    if (texts.length || notes.length) {
      setPres(p => ({
        ...p,
        text: { ...(p.text || {}), ...Object.fromEntries(texts.map(c => [c.id.slice(5), c.after])) },
        notes: (p.notes || []).map(n => {
          const t = notes.find(c => c.id === `note-title:${n.id}`)
          const b = notes.find(c => c.id === `note-body:${n.id}`)
          return t || b ? { ...n, ...(t ? { title: t.after } : {}), ...(b ? { body: b.after } : {}) } : n
        }),
      }), { now: true })
      if (texts.length) setVersions(v => ({ ...v, ...Object.fromEntries(texts.map(c => [c.id.slice(5), (v[c.id.slice(5)] || 0) + 1])) }))
    }
    if (compsFixed.size) changeComps(list => list.map(c => (compsFixed.has(c.id) ? { ...c, commentary: compsFixed.get(c.id) || c.commentary, commentary_by_agent: true } : c)), { now: true })
  }

  const [mode, setMode] = useState<'edit' | 'client'>('edit')
  const [arrange, setArrange] = useState(false)
  const [more, setMore] = useState(false)

  const edit: CmaEditHooks = {
    section: (key, label, state, content) => (
      <div data-flip={key} data-cma-section={key} className="scroll-mt-28">
        <SectionBar label={label} state={state} onUp={() => moveSection(key, -1)} onDown={() => moveSection(key, 1)} onToggle={() => toggleHidden(key)}
          onDelete={isNoteKey(key) ? () => {
            const note = cmaNotes(working).find(n => noteKey(n.id) === key)
            if (note && ((note.title || '').trim() || (note.body || '').trim())) setDeleteNoteId(note.id)
            else if (note) removeNote(note.id)
          } : undefined} />
        {content
          ? <div className={state.hidden ? 'pointer-events-none select-none opacity-40 grayscale' : ''} aria-hidden={state.hidden || undefined}>{content}</div>
          : (
            <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
              {key === 'competition' ? 'Homes for sale and under contract show here once the report has an analysis.' : 'This section fills in once the report has comps to show.'}
            </p>
          )}
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => addNote(key)} className="group inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 hover:text-[#8b7355] active:scale-95 dark:border-gray-700 dark:hover:text-[#d7b974]">
            <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" /> Add your own section here
          </button>
        </div>
      </div>
    ),
    wrapComp: (comp, node) => <div data-flip={`comp:${comp.id}`}>{node}</div>,
    compBar: (comp: EditorComp, shownIndex, state) => {
      const off = shownIndex == null
      return (
        <div className={`flex items-center justify-between gap-2 border-b border-dashed py-1 pl-4 pr-1.5 ${off ? 'border-gray-300 bg-gray-500/[0.06] dark:border-gray-700' : 'border-[#C9A24D]/45 bg-[#C9A24D]/[0.06]'}`}>
          <p className={`min-w-0 truncate text-[10px] font-black uppercase tracking-[0.16em] ${off ? 'text-gray-500' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>
            {off ? <>Off the report<span className="max-sm:hidden"> - the client does not see it</span></> : <>Comp #{shownIndex + 1}<span className="max-sm:hidden"> on the report</span></>}
          </p>
          <div className="flex shrink-0 items-center">
            {off ? (
              <button type="button" onClick={() => restoreComp(comp.id)} className={`${barBtn} pointer-events-auto w-auto gap-1.5 px-2.5 text-[10px] font-black uppercase tracking-wide max-sm:w-auto`}><Undo2 className="h-4 w-4" /> Put it back</button>
            ) : (
              <>
                <button type="button" className={barBtn} title="Move up" aria-label="Move this comp up" disabled={state.first} onClick={() => moveComp(comp.id, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className={barBtn} title="Move down" aria-label="Move this comp down" disabled={state.last} onClick={() => moveComp(comp.id, 1)}><ArrowDown className="h-4 w-4" /></button>
                {!locked && <button type="button" className={`${barBtn} w-auto gap-1.5 px-2.5 text-[10px] font-black uppercase tracking-wide hover:!bg-red-500/15 hover:!text-red-600 max-sm:w-auto`} onClick={() => setRemoveId(comp.id)} aria-label="Remove this comp from the report"><Trash2 className="h-4 w-4" /><span className="max-sm:hidden">Remove</span></button>}
              </>
            )}
          </div>
        </div>
      )
    },
    compsLocked: locked,
    ratingsLocked: locked,
    addCompTile: () => locked ? (
      <p data-cma-comps-locked className="flex items-start gap-2.5 rounded-2xl border border-dashed border-gray-300 px-4 py-3.5 text-xs font-semibold leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
        <span>Comps and ratings are locked once the AI has written the report. To change them, <Link href="/studio/cma?new=1" className="font-black text-[#8b7355] underline underline-offset-2 hover:text-[#111827] dark:text-[#d7b974] dark:hover:text-white">start a new CMA</Link>.</span>
      </p>
    ) : renderAddComp ? (
      <button type="button" onClick={() => setAddOpen(true)} className="group flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.04] px-6 py-9 text-center transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 active:scale-[0.99]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow-lg transition-transform group-hover:scale-110"><Plus className="h-6 w-6" /></span>
        <span className="font-serif text-xl font-black text-[#111827] dark:text-white">Add another comp</span>
        <span className="max-w-sm text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">Pick a home from our database. It goes on the map, the table and the charts right away.</span>
      </button>
    ) : null,
    partBar: (key, label, hidden) => (
      <button type="button" onClick={() => toggleHidden(key)} aria-pressed={hidden} title={hidden ? `Show ${label} to the client` : `Hide ${label} from the client`}
        className="pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-[#C9A24D]/60 px-2.5 text-[9px] font-black uppercase tracking-wide text-[#C9A24D] transition hover:bg-[#C9A24D]/15 active:scale-95">
        {hidden ? <><Eye className="h-3.5 w-3.5" /> Hidden - show it</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
      </button>
    ),
    setText,
    textVersion: key => versions[key] || 0,
    textReset: key => cmaTextEdited(working, key) ? (
      <button type="button" onClick={() => resetText(key)} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 underline-offset-4 transition hover:text-[#C9A24D] hover:underline">
        <RotateCcw className="h-3 w-3" /> Back to the original wording
      </button>
    ) : null,
    setLabel: (key, value) => setPres(p => {
      const t = { ...(p.text || {}) }
      if (value.trim()) t[key] = value.trim(); else delete t[key]
      return { ...p, text: t }
    }, { lazy: true }),
    setFigure,
    figureReset: key => {
      if (!cmaFigureEdited(working, key) || !working.pricing?.ai_estimate) return null
      const own = cmaDefaultFigure({ ...working, presentation: { ...(pres || emptyPresentation()), figures: {} } }, key)
      return (
        <button type="button" onClick={() => resetFigure(key)} className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-gray-400 underline-offset-4 transition hover:text-[#C9A24D] hover:underline">
          <RotateCcw className="h-2.5 w-2.5" /> {own != null ? `Back to ${formatMoney(own)}` : 'Clear my number'}
        </button>
      )
    },
    setCompNote: (id, text) => changeComps(list => list.map(c => (c.id === id ? { ...c, commentary: text, commentary_by_agent: true } : c)), { lazy: true }),
    // Ratings and the classification lock with the comps (the server refuses a save that changes one).
    setCompQuality: (id, key: keyof CmaQualityAssessment, value) => locked ? undefined : changeComps(list => list.map(c => (c.id === id ? { ...c, quality: { ...c.quality, [key]: value } } : c)), { now: true }),
    setCompStrength: (id, value) => locked ? undefined : changeComps(list => list.map(c => (c.id === id ? { ...c, strength: value as CmaComparable['strength'] } : c)), { now: true }),
    pickPhoto: (who, url) => { setPres(p => ({ ...p, photo_picks: { ...(p.photo_picks || {}), [who]: url } }), { now: true }); showToast('That is the main photo now - on the report and in the PDF.', 'success') },
    setNote: (id, patch) => setPres(p => ({ ...p, notes: (p.notes || []).map(n => (n.id === id ? { ...n, ...patch } : n)) }), { lazy: true }),
    setClientName: value => change(() => ({ client_name: value }), { lazy: true }),
  }

  const isTester = !!user?.is_admin || /@example\.com$/i.test(user?.email || '')
  const reviewSheetOn = pres?.review_sheet ?? /@example\.com$/i.test(user?.email || '')
  const removing = removeId ? working.comparables.find(c => c.id === removeId) : null
  const pdfLabel = (kind: 'open' | 'download') => pdfFile.iosHint === 'preparing' ? 'Preparing…' : pdfFile.iosHint === 'tap' ? 'Tap again' : kind === 'open' ? 'Open PDF' : 'Download'
  const tool = 'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-[11px] font-black uppercase tracking-wide text-[#111827] shadow-sm outline-none transition hover:border-[#C9A24D] hover:text-[#8b7355] focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-95 disabled:opacity-50 dark:border-gray-700 dark:bg-[#1b1b1e] dark:text-white dark:hover:text-[#d7b974]'

  return (
    <div className="space-y-3">
      <FlowDock step={5} total={5} onBack={onBack} continueLabel={done ? 'Back to CMAs' : 'Mark ready'} busy={readying}
        onContinue={done ? () => router.push('/studio/cma') : markReady} />

      {/* ---- Complete and send: at the top, and it stays in reach while the report scrolls ----
           Both rows fill the bar on every screen (owner 11/19: on a computer they used to stop partway and
           leave the right side empty): the main button and the Edit / Client switch stretch, the rest keep their size. */}
      <div className="sticky top-2 z-30 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-[0_14px_34px_-22px_rgba(17,24,39,0.55)] dark:border-gray-800 dark:bg-[#151517]/95 sm:p-2.5">
        <div className="flex items-center gap-2">
          <motion.button type="button" onClick={done ? undefined : markReady} disabled={readying} whileTap={done ? undefined : { scale: 0.96 }}
            className={`group relative inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl px-4 text-[12px] font-black uppercase tracking-wide text-white shadow-md transition sm:px-6 ${
              done ? 'cursor-default bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e0b85f] hover:shadow-lg hover:shadow-[#C9A24D]/40'}`}>
            {readying ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Sparkles className="h-4 w-4 transition group-hover:rotate-12" />}
            <span className="truncate">{readying ? 'Marking ready…' : report.status === 'SHARED' ? <><span className="sm:hidden">Link is live</span><span className="hidden sm:inline">Shared - link is live</span></> : done ? 'Ready to send' : 'Mark ready'}</span>
          </motion.button>
          <button type="button" className={`${tool} max-sm:hidden`} disabled={!agent || !!pdfBusy} onClick={() => runPdf('open')} title="Open the PDF in a new tab">
            {pdfBusy === 'open' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}<span className="hidden md:inline">{pdfLabel('open')}</span>
          </button>
          <button type="button" className={tool} disabled={!agent || !!pdfBusy} onClick={() => runPdf('download')} title="Save the PDF to this device">
            {pdfBusy === 'download' || pdfFile.iosHint === 'preparing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden md:inline">{pdfLabel('download')}</span>
          </button>
          <button type="button" disabled={sharing} onClick={handleShare} title="Get the client link"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111827] px-3.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm outline-none transition hover:bg-black focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-95 disabled:opacity-60 dark:bg-white dark:text-[#111827]">
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}<span className="hidden sm:inline">Share link</span>
          </button>
          <button type="button" className={`${tool} w-11 px-0`} onClick={() => setMore(true)} aria-label="More report settings" title="More"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative grid h-10 flex-1 grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
            <span aria-hidden className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-lg bg-[#111827] shadow transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] dark:bg-white ${mode === 'client' ? 'translate-x-full' : ''}`} />
            {(['edit', 'client'] as const).map(m => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                className={`relative flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide outline-none transition focus-visible:ring-2 focus-visible:ring-[#C9A24D] ${mode === m ? 'text-white dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400'}`}>
                <span className="relative flex items-center gap-1.5 whitespace-nowrap">{m === 'edit' ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{m === 'edit' ? 'Edit' : <><span className="sm:hidden">Client</span><span className="hidden sm:inline">Client view</span></>}</span>
              </button>
            ))}
          </div>
          <button type="button" className={`${tool} h-10`} onClick={() => setArrange(true)} title="Arrange the sections" aria-label="Arrange"><LayoutList className="h-4 w-4" /><span className="max-sm:hidden">Arrange</span></button>
          <button type="button" className={`${tool} h-10`} title={`The client link opens in ${theme === 'dark' ? 'Midnight' : 'Ivory'} - tap to switch`} aria-label="Switch the look the client link opens in"
            onClick={() => setPres(p => ({ ...p, default_theme: theme === 'dark' ? 'light' : 'dark' }), { now: true })}>
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}<span className="hidden lg:inline">{theme === 'dark' ? 'Midnight' : 'Ivory'}</span>
          </button>
          {mode === 'edit' && <GrammarFixButton items={grammarItems} where="a home value report (CMA) for a client" onApply={applyGrammar} className={`${tool} h-10`} />}
          {reviewCount > 0 && (
            <button type="button" onClick={onGoToPricing} title="Things to check before sending - in the Pricing step"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-[11px] font-black uppercase tracking-wide text-amber-800 transition hover:bg-amber-100 active:scale-95 dark:border-amber-900/50 dark:bg-amber-900/15 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /><span className="hidden sm:inline">{reviewCount} to check</span><span className="sm:hidden">{reviewCount}</span>
            </button>
          )}
        </div>
      </div>

      {compChange.changed && (
        <div data-cma-comps-differ className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-900/40 dark:bg-amber-900/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-xs font-semibold leading-relaxed text-amber-900 dark:text-amber-200">
            <p className="font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">The comps are not the ones the value came from <span className="font-semibold normal-case tracking-normal opacity-70">· only you see this</span></p>
            <p className="mt-0.5">
              {[compChange.removed ? `${compChange.removed} taken off` : null, compChange.added ? `${compChange.added} added` : null].filter(Boolean).join(', ')} after the value was worked out.
              The comp pages, the map, the table and the charts show the comps as they are now; the value and the write-up are still the earlier ones.
              {soldLeft >= 2 ? ' One refresh brings them back in step.' : ' With fewer than two sold homes left there is not enough to support a value - start a new CMA for this home.'}
            </p>
            {soldLeft >= 2 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <button type="button" disabled={refreshing} onClick={() => setRefreshAsk(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#111827] px-4 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-black active:scale-95 disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#e8c97a] dark:text-[#8b7355]" />} {refreshing ? 'Refreshing…' : 'Refresh value and write-up'}
                </button>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3 w-3" /> Uses your monthly AI</span>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <p className="px-1 text-[11px] font-bold text-gray-400">
          This is the report your client gets. Tap any words or a number to change them. Changes save by themselves{report.status === 'SHARED' ? ' and the client link updates right away' : ''}.
        </p>
      )}

      <div ref={flipRoot} className="overflow-hidden rounded-3xl border border-gray-200 shadow-[0_24px_60px_-40px_rgba(17,24,39,0.6)] dark:border-gray-800 max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0">
        <CmaReportView data={data} edit={mode === 'edit' ? edit : undefined} />
      </div>

      {done && (
        <Link href="/studio/cma" className="cma-btn flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
          <ArrowLeft className="h-4 w-4" /> Done - back to my CMAs
        </Link>
      )}

      {/* ---- Arrange: every section in one short list - drag to re-order, tap the eye to hide ---- */}
      <CmaSheet open={arrange} onClose={() => setArrange(false)} title="Arrange the report" subtitle="Drag a section to move it. Tap the eye to hide it from your client." maxWidth="sm:max-w-md">
        <div className="space-y-3 px-4 py-4 sm:px-6">
          <Reorder.Group axis="y" values={order} onReorder={next => setOrder(next as string[])} className="space-y-2">
            {order.map(key => {
              const note = isNoteKey(key)
              const label = note ? (cmaNotes(working).find(n => noteKey(n.id) === key)?.title || 'Your own section') : (SECTION_LABEL[key] || key)
              return <ArrangeRow key={key} id={key} label={label} note={note} fixed={key === 'subject'} hidden={cmaIsHidden(working, key)} onToggle={() => toggleHidden(key)} />
            })}
          </Reorder.Group>
          <button type="button" onClick={() => { setArrange(false); addNote(order[order.length - 2] || null) }} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9A24D]/50 px-4 py-3 text-xs font-black uppercase tracking-wide text-[#8b7355] transition hover:bg-[#C9A24D]/10 active:scale-[0.99] dark:text-[#d7b974]">
            <Plus className="h-4 w-4" /> Add your own section
          </button>
        </div>
      </CmaSheet>

      {/* ---- More: the switches and the rarely-used things ---- */}
      <CmaSheet open={more} onClose={() => setMore(false)} title="Report settings" maxWidth="sm:max-w-md">
        <div className="space-y-2.5 px-4 py-4 sm:px-6">
          <button type="button" disabled={!agent || !!pdfBusy} onClick={() => runPdf('open')} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-black text-[#111827] transition hover:border-[#C9A24D]/60 active:scale-[0.99] disabled:opacity-50 dark:border-gray-800 dark:bg-[#1b1b1e] dark:text-white sm:hidden">
            Open the PDF in a new tab {pdfBusy === 'open' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4 text-[#C9A24D]" />}
          </button>
          <Switch on={theme === 'dark'} label="Client link opens in Midnight" hint="Off = Ivory (light). Your client can still switch it on their side."
            left={<Sun className="h-3.5 w-3.5 text-[#C9A24D]" />} right={<Moon className="h-3.5 w-3.5" />}
            onClick={() => setPres(p => ({ ...p, default_theme: theme === 'dark' ? 'light' : 'dark' }), { now: true })} />
          {hasEmailSignatureAccess(user?.plan_tier) && (
            <Switch on={report.use_signature_card !== false} label="End with my signature card" hint="On the web version your email signature card closes the report. The PDF keeps its own footer."
              onClick={async () => { const saved = await onSave({ use_signature_card: report.use_signature_card === false } as Partial<CmaReport>, { silent: true }); if (saved) onReportUpdated(saved) }} />
          )}
          {isTester && (
            <Switch on={reviewSheetOn} label="Engine review sheet (testing)" hint="Testing only: adds the engine's own review pages to the end of the PDF."
              onClick={() => setPres(p => ({ ...p, review_sheet: !reviewSheetOn }), { now: true })} />
          )}
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#1b1b1e]">
            <p className="text-sm font-black text-[#111827] dark:text-white">Report code: <span className="font-mono tracking-wide text-[#8b7355] dark:text-[#d7b974]">{cmaSupportCode(report.id)}</span></p>
            <p className="mt-0.5 text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">Something look wrong with the numbers or the wording? Send us a ticket with this code and we can pull up this exact CMA.</p>
            <Link href={`/settings/help?compose=1&cma_code=${encodeURIComponent(cmaSupportCode(report.id))}`} className="mt-2.5 inline-flex h-9 items-center rounded-xl border border-gray-200 px-3.5 text-[11px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-white">Submit a ticket</Link>
          </div>
          <button type="button" onClick={() => { setMore(false); setShowDelete(true) }} disabled={deleting} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-black uppercase tracking-wide text-red-600 transition hover:bg-red-50 active:scale-[0.99] dark:border-red-900/40 dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" /> Delete this CMA
          </button>
        </div>
      </CmaSheet>

      {/* ---- Taking a comp off the report ---- */}
      <CmaSheet open={!!removing} onClose={() => setRemoveId(null)} title="Take this comp off the report?" maxWidth="sm:max-w-md"
        footer={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRemoveId(null)} className="h-11 flex-1 rounded-xl border border-gray-200 text-[13px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">Keep it</button>
            <button type="button" onClick={() => { if (removeId) removeComp(removeId); setRemoveId(null) }} className="h-11 flex-[1.4] rounded-xl bg-red-600 text-[13px] font-black text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98]">Take it off</button>
          </div>
        }>
        <div className="space-y-2.5 px-4 py-4 text-[13px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300 sm:px-6">
          <p><span className="font-black text-[#111827] dark:text-white">{removing?.street_address}</span> comes off everywhere your client looks: its page, its pin on the map, its column in the table and its bars in the charts. The other comps are re-numbered, in the wording too.</p>
          {removing?.status === 'sold' && soldLeft <= 2 && <p className="rounded-xl bg-amber-50 px-3 py-2 font-bold text-amber-800 dark:bg-amber-900/15 dark:text-amber-300">This leaves fewer than two sold homes on the report - not enough to support a value.</p>}
          <p className="text-xs text-gray-400">It stays in your list, greyed out, with a button to put it back.</p>
        </div>
      </CmaSheet>

      {/* ---- Refresh value and write-up: a real AI run, so it asks first ---- */}
      <CmaSheet open={refreshAsk} onClose={() => setRefreshAsk(false)} title="Refresh the value and the write-up?" maxWidth="sm:max-w-md"
        footer={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRefreshAsk(false)} className="h-11 flex-1 rounded-xl border border-gray-200 text-[13px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">Not now</button>
            <button type="button" onClick={refreshValue} className="inline-flex h-11 flex-[1.6] items-center justify-center gap-2 rounded-xl bg-[#111827] text-[13px] font-black text-white shadow-sm transition hover:bg-black active:scale-[0.98] dark:bg-white dark:text-[#111827]"><Sparkles className="h-4 w-4 text-[#e8c97a] dark:text-[#8b7355]" /> Refresh with AI</button>
          </div>
        }>
        <div className="space-y-2.5 px-4 py-4 text-[13px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300 sm:px-6">
          <p>This is a new AI run. It re-works the <span className="font-black text-[#111827] dark:text-white">value, the range and the report's wording</span> from the comps as they are now.</p>
          <p className="flex items-start gap-2 rounded-xl bg-[#C9A24D]/10 px-3 py-2 font-bold text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> It uses your monthly AI allowance, like a new analysis (a smaller amount: no photos are read again).</p>
          <p>Wording and numbers you typed yourself stay as you set them. It can take a minute or two; you can keep reading the report while it runs.</p>
        </div>
      </CmaSheet>

      {!locked && renderAddComp?.({ open: addOpen, onClose: () => setAddOpen(false), comparables: working.comparables, onAdd: addComp })}

      <WarningConfirmModal isOpen={!!deleteNoteId} onClose={() => setDeleteNoteId(null)} onConfirm={() => { if (deleteNoteId) removeNote(deleteNoteId); setDeleteNoteId(null) }}
        title="Delete this section?" message="The section you wrote comes off the report and the PDF. This can't be undone." confirmText="Delete section" />
      <WarningConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={confirmDelete} title="Delete this CMA?"
        message="This will permanently remove the report, including any comps, pricing, and analysis you've added. This can't be undone." confirmText="Delete CMA" isLoading={deleting} />
      <CmaShareLinksModal isOpen={showShare && !!shareLinks} onClose={() => setShowShare(false)} openHousePalUrl={shareLinks?.openHousePalUrl || null} websiteUrl={shareLinks?.websiteUrl || null} />
    </div>
  )
}
