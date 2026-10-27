'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { ArrowLeft, Calculator, Check, Download, Home, Loader2, Moon, Plus, Search, Share2, Sun, Trash2, User, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import api from '@/lib/api-service'
import { CmaMode, CmaReport, CmaReportListItem, CmaStatus, Site, SiteDomain } from '@/types'
import { CMA_STATUS_STYLES, formatMoney, timeAgo } from '@/lib/cma'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import { LuxeTabs } from '@/components/ui/LuxeHero'
import { AlertTriangle, CheckCircle2, LayoutGrid, PenLine, Sparkles } from 'lucide-react'
import { estimatedProgress, estimatedTimeLeft } from '@/lib/cmaProgress'
import { isTouchPhone, saveFile } from '@/lib/mobileShare'

// Which finished AI runs the agent has already opened from this list (per browser): report id ->
// the generation_started_at of the run they saw. A run that finished in the last few hours and
// hasn't been opened yet keeps a small "AI analysis ready" badge on its card.
const AI_SEEN_KEY = 'ohp-cma-ai-seen'
const AI_READY_BADGE_HOURS = 6
const readAiSeen = (): Record<string, string> => {
  try { return JSON.parse(window.localStorage.getItem(AI_SEEN_KEY) || '{}') || {} } catch { return {} }
}
const startedMs = (r: CmaReportListItem) => (r.generation_started_at ? new Date(r.generation_started_at).getTime() : NaN)

// Icons for the CMA status tabs in the header.
const CMA_STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = { ALL: LayoutGrid, DRAFT: PenLine, READY: CheckCircle2, SHARED: Share2 }
import WarningConfirmModal from '@/components/WarningConfirmModal'
import CmaShareLinksModal from '@/components/CmaShareLinksModal'
import { CmaPresentationDocument } from '@/lib/pdfs'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'

const STATUS_TABS: (CmaStatus | 'ALL')[] = ['ALL', 'DRAFT', 'READY', 'SHARED']

export default function CmaDashboardPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard requireMlsAccess>
        <Suspense fallback={null}>
          <CmaDashboardInner />
        </Suspense>
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function CmaDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { user } = useAuth()
  const [reports, setReports] = useState<CmaReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<CmaStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [agent, setAgent] = useState<any>(null)
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  const [shareLinks, setShareLinks] = useState<{ openHousePalUrl: string, websiteUrl: string | null } | null>(null)

  const load = () => {
    setLoading(true)
    api.cma.list().then(response => {
      if (response.success && response.data) setReports(response.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  // A report's AI analysis can still be running server-side even after backing out to this list -
  // the request that started it keeps going regardless of which page is open, so a card must be
  // able to show that on its own instead of just looking idle. Poll quietly (no loading skeleton)
  // every 4s while any card is mid-generation, and tick each card's estimated % every second from
  // its server start time (user, 10/21: two CMAs at once, watched from this list). Both stop as
  // soon as nothing is generating.
  const anyGenerating = reports.some(r => r.generation_status === 'generating')
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!anyGenerating) return
    const poll = setInterval(() => {
      api.cma.list().then(response => {
        if (response.success && response.data) setReports(response.data)
      })
    }, 4000)
    const tick = setInterval(() => setNowMs(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [anyGenerating])

  // Runs that finish while this page is open get a clear "finished - click to continue" card (the
  // report still needs the agent's review and pricing, so it's not "done"), plus a toast.
  const prevGenStatus = useRef<Map<string, CmaReportListItem['generation_status']>>(new Map())
  const [justFinished, setJustFinished] = useState<Set<string>>(() => new Set())
  const [aiSeen, setAiSeen] = useState<Record<string, string>>({})
  useEffect(() => { setAiSeen(readAiSeen()) }, [])
  useEffect(() => {
    const prev = prevGenStatus.current
    const finished: CmaReportListItem[] = []
    for (const r of reports) {
      if (prev.get(r.id) === 'generating' && r.generation_status === 'complete') finished.push(r)
      if (prev.get(r.id) === 'generating' && r.generation_status === 'failed') {
        showToast(`The AI analysis for ${r.subject_address?.split(',')[0] || 'a CMA'} didn't finish - open it to try again.`, 'error')
      }
    }
    prevGenStatus.current = new Map(reports.map(r => [r.id, r.generation_status]))
    if (finished.length) {
      setJustFinished(s => { const n = new Set(s); finished.forEach(r => n.add(r.id)); return n })
      showToast(finished.length === 1
        ? `AI analysis finished for ${finished[0].subject_address?.split(',')[0] || 'your CMA'} - open it to review and price it.`
        : `${finished.length} AI analyses finished - open them to review and price them.`, 'success')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports])
  const markAiSeen = (report: CmaReportListItem) => {
    if (report.generation_status !== 'complete' || !report.generation_started_at) return
    const next = { ...readAiSeen(), [report.id]: report.generation_started_at }
    try { window.localStorage.setItem(AI_SEEN_KEY, JSON.stringify(next)) } catch { /* private mode - badge just stays */ }
    setAiSeen(next)
  }
  const aiReadyUnseen = (r: CmaReportListItem) => {
    if (r.generation_status !== 'complete' || r.status !== 'DRAFT' || !r.generation_started_at) return false
    if (aiSeen[r.id] === r.generation_started_at) return false
    const t = startedMs(r)
    return Number.isFinite(t) && Date.now() - t < AI_READY_BADGE_HOURS * 3600_000
  }

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

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowCreate(true)
  }, [searchParams])

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (statusTab !== 'ALL' && r.status !== statusTab) return false
      const term = search.trim().toLowerCase()
      if (term && !(r.subject_address || '').toLowerCase().includes(term) && !(r.client_name || '').toLowerCase().includes(term)) return false
      return true
    })
  }, [reports, statusTab, search])

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setPendingDeleteId(id)
  }

  const ensureShareSlug = async (report: CmaReportListItem): Promise<string | null> => {
    if (report.share_slug) return report.share_slug
    setSharingId(report.id)
    const response = await api.cma.share(report.id)
    setSharingId(null)
    if (!response.success || !response.data) {
      showToast(response.error || 'Could not create a share link.', 'error')
      return null
    }
    load()
    return response.data.share_slug
  }

  const buildShareLinks = (slug: string) => ({
    openHousePalUrl: openHousePalPublicUrl(`/cma/${slug}`),
    websiteUrl: websitePublicUrl(idxSite, idxDomains, `/cma/${slug}`),
  })

  const handleShare = async (report: CmaReportListItem, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const slug = await ensureShareSlug(report)
    if (!slug) return
    setShareLinks(buildShareLinks(slug))
  }

  // Same as the PDF button inside a CMA (user, 10/24): a computer downloads it straight away; a
  // phone hands it to the Share sheet (Save to Files, AirDrop, Mail...) and it never opens in this
  // tab. A phone only allows the Share sheet during the tap itself and the PDF takes a few seconds
  // to build, so when the tap has expired by then the button turns into "Save" - one more tap.
  const [readyPdf, setReadyPdf] = useState<{ id: string, blob: Blob, name: string } | null>(null)
  const handleDownload = async (report: CmaReportListItem, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (readyPdf?.id === report.id) {
      const ready = readyPdf
      setReadyPdf(null)
      await saveFile(ready.blob, ready.name)
      return
    }
    if (!agent) {
      showToast('Agent details are still loading. Try again in a moment.', 'error')
      return
    }
    setDownloadingId(report.id)
    const response = await api.cma.get(report.id)
    if (!response.success || !response.data) {
      setDownloadingId(null)
      showToast(response.error || 'Could not download this CMA.', 'error')
      return
    }
    try {
      const fullReport = response.data as CmaReport
      const fileName = `CMA-${(fullReport.subject?.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`
      const blob = await pdf(<CmaPresentationDocument report={fullReport as any} agent={agent} />).toBlob()
      const tapStillLive = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive
      if (isTouchPhone() && !tapStillLive) {
        setReadyPdf({ id: report.id, blob, name: fileName })
        showToast('Your PDF is ready - tap Save to keep it.', 'success')
      } else {
        await saveFile(blob, fileName)
      }
    } catch {
      showToast('Could not generate this CMA PDF.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  // Optimistic - flips the card's icon immediately rather than waiting on the round trip, then
  // reverts if the save actually fails. Hits the dedicated /theme endpoint (merges server-side)
  // rather than a full presentation PATCH, since this card only knows default_theme, not the
  // report's hidden_sections/hidden_comp_ids/cover_photo_url.
  const handleToggleTheme = async (report: CmaReportListItem, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const next = report.default_theme === 'light' ? 'dark' : 'light'
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, default_theme: next } : r))
    const response = await api.cma.updateTheme(report.id, next)
    if (!response.success) {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, default_theme: report.default_theme } : r))
      showToast(response.error || "Could not update this CMA's default theme.", 'error')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    const response = await api.cma.remove(pendingDeleteId)
    setIsDeleting(false)
    const deletedId = pendingDeleteId
    setPendingDeleteId(null)
    // Drop it from local state directly instead of waiting on a re-fetch - AnimatePresence below
    // picks up the removal from this array and plays the exit animation immediately, rather than
    // the card just vanishing (or waiting on a network round-trip first).
    if (response.success) setReports(prev => prev.filter(r => r.id !== deletedId))
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <StudioPageHeader
          icon={Calculator}
          kicker="Comparative Market Analysis"
          title={<>Price it right, <em>prove it</em></>}
          subtitle="Build a client-ready pricing report from comparable sales and your own judgment."
          asideClassName="w-full lg:w-[360px] lg:self-center"
          actions={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by address or client..."
                className="w-full rounded-xl border-2 border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-800 dark:bg-[#151517] dark:text-white"
              />
            </div>
          }
          tabs={
            <LuxeTabs
              label="CMA status"
              active={statusTab}
              onChange={setStatusTab}
              items={STATUS_TABS.map(tab => ({ id: tab, label: tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase(), icon: CMA_STATUS_ICON[tab] || LayoutGrid }))}
              pinEnd
              end={
                <button
                  onClick={() => setShowCreate(true)}
                  className="lx-shine group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                >
                  <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" /> <span className="hidden sm:inline">Create New CMA</span><span className="sm:hidden">Create</span>
                </button>
              }
            />
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {loading && (
            <div className="col-span-full flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading CMAs...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gray-300 p-16 text-center dark:border-gray-700">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C9A24D]/10">
                <Calculator className="h-7 w-7 text-[#C9A24D]" />
              </div>
              <p className="text-lg font-black text-gray-700 dark:text-gray-300">No CMAs yet</p>
              <p className="max-w-xs text-sm font-semibold text-gray-400">Build a client-ready pricing report from comparable sales and your own judgment.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#C9A24D]/30 transition hover:shadow-xl hover:shadow-[#C9A24D]/40"
              >
                <Plus className="h-4 w-4" /> Create Your First CMA
              </button>
            </div>
          )}
          {/* popLayout lets a deleted card's exit animation play in place while the rest of the
              grid smoothly reflows into the gap it leaves, instead of the whole grid just
              snapping to its new layout the instant the card disappears from the array. */}
          <AnimatePresence mode="popLayout">
          {!loading && filtered.map(report => {
            const hasFairValue = report.fair_value != null
            const compactFairValue = formatMoney(report.fair_value, { compact: true })
            const isGenerating = report.generation_status === 'generating'
            const genElapsedMs = Number.isFinite(startedMs(report)) ? Math.max(0, nowMs - startedMs(report)) : 0
            const genProgress = isGenerating ? estimatedProgress(genElapsedMs, report.comparable_count) : null
            const genPct = genProgress ? Math.round(genProgress.pct) : 0
            const finishedNow = report.generation_status === 'complete' && justFinished.has(report.id) && aiSeen[report.id] !== report.generation_started_at
            const readyBadge = !finishedNow && aiReadyUnseen(report)
            const failedNoValue = report.generation_status === 'failed' && !hasFairValue
            return (
            <motion.div
              key={report.id}
              layout
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={`overflow-hidden rounded-3xl border bg-white shadow-md transition-colors hover:border-[#C9A24D]/50 hover:shadow-xl dark:bg-[#151517] ${
                finishedNow ? 'border-emerald-400 ring-2 ring-emerald-400/40 dark:border-emerald-500'
                  : isGenerating ? 'border-[#C9A24D]/60 dark:border-[#C9A24D]/50'
                  : 'border-gray-200 dark:border-gray-800'
              }`}>
              <Link href={`/studio/cma/${report.id}`} className="block" onClick={() => markAiSeen(report)}>
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {report.subject_photo_url ? (
                    <img src={report.subject_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />
                  {isGenerating && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black/55">
                      <motion.div
                        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                      />
                      {/* Estimated, paced like the editor's progress bar (lib/cmaProgress). Sits between
                          the status pills and the address so neither is covered, even on a phone card. */}
                      <div className="absolute inset-x-0 bottom-[52px] top-9 flex flex-col items-center justify-center px-4 text-center">
                        <p className="flex items-baseline gap-1.5">
                          <span className="hidden text-[9px] font-black uppercase tracking-[0.16em] text-[#e8c97a] sm:inline">AI analysis</span>
                          <span className="font-serif text-2xl font-black tabular-nums leading-none text-white drop-shadow">{genPct}%</span>
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-white/20">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] transition-[width] duration-1000 ease-linear" style={{ width: `${genPct}%` }} />
                        </div>
                        <p className="mt-1 hidden text-[10px] font-bold text-white/85 sm:block">{estimatedTimeLeft(genElapsedMs)}</p>
                      </div>
                    </div>
                  )}
                  {finishedNow && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-900/80 via-black/55 to-[#8b7355]/70"
                    >
                      <div className="absolute inset-x-0 bottom-[52px] top-9 flex flex-col items-center justify-center px-3 text-center">
                        <p className="flex items-center gap-1.5 text-xs font-black text-white drop-shadow">
                          <motion.span
                            initial={{ scale: 0.4 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                          >
                            <Check className="h-3 w-3" strokeWidth={3.5} />
                          </motion.span>
                          AI analysis finished
                        </p>
                        <span className="mt-1.5 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow">
                          Click to continue
                        </span>
                      </div>
                    </motion.div>
                  )}
                  {failedNoValue && (
                    <div className="pointer-events-none absolute inset-0 bg-black/55" title={report.generation_error || undefined}>
                      <div className="absolute inset-x-0 bottom-[52px] top-9 flex flex-col items-center justify-center px-3 text-center">
                        <p className="flex items-center gap-1.5 text-xs font-black text-white drop-shadow">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" /> AI analysis didn&apos;t finish
                        </p>
                        <p className="mt-0.5 hidden text-[10px] font-bold text-white/85 sm:block">Open to retry</p>
                      </div>
                    </div>
                  )}
                  {/* Status on the left, Buyer/Listing on the right, "AI ready" in the middle -
                      they used to pile up on top of each other in the top-right (user, 10/24). */}
                  <div className="absolute inset-x-2 top-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:inset-x-2.5 sm:top-2.5">
                    <span className={`justify-self-start rounded-full px-2 py-1 text-[8.5px] font-black uppercase leading-none tracking-wide shadow sm:px-2.5 sm:text-[9px] ${CMA_STATUS_STYLES[report.status]}`}>
                      {report.status.toLowerCase()}
                    </span>
                    {readyBadge ? (
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-1.5 py-1 text-[8.5px] font-black uppercase leading-none tracking-wide text-[#111827] shadow sm:gap-1 sm:px-2 sm:text-[9px]">
                        <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> AI ready
                      </span>
                    ) : <span />}
                    <span className="justify-self-end rounded-full bg-black/60 px-2 py-1 text-[8.5px] font-black uppercase leading-none tracking-wide text-white shadow sm:px-2.5 sm:text-[9px]">
                      {report.mode === 'buyer' ? 'Buyer' : 'Listing'}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p className="truncate text-xs font-black text-white drop-shadow-sm">{report.subject_address ? report.subject_address.split(',')[0] : 'No address yet'}</p>
                    {report.client_name && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-bold text-white/85">
                        <User className="h-3 w-3 shrink-0" /> {report.client_name}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
              <div className="p-2.5">
                <Link href={`/studio/cma/${report.id}`} className="block" onClick={() => markAiSeen(report)}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase tracking-wide text-gray-400">Fair Value</p>
                      {isGenerating ? (
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-black text-[#8b7355] dark:text-[#d7b974]">
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> Analyzing… {genPct}%
                        </p>
                      ) : finishedNow && !hasFairValue ? (
                        <p className="mt-0.5 truncate text-xs font-black text-emerald-600 dark:text-emerald-400">Ready to review</p>
                      ) : failedNoValue ? (
                        <p className="mt-0.5 truncate text-xs font-black text-amber-600 dark:text-amber-400">Open to retry</p>
                      ) : (
                        <p className={`mt-0.5 truncate text-xs font-black ${
                          !hasFairValue
                            ? 'text-gray-500 dark:text-gray-300'
                            : 'text-[#8b7355] dark:text-[#d7b974]'
                        }`}>
                          {hasFairValue ? compactFairValue : 'No estimate yet'}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        {report.comparable_count} comp{report.comparable_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-wide text-gray-400">Edited {timeAgo(report.updated_at || report.created_at)}</p>
                </Link>
                <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-1 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                  <button
                    onClick={event => handleShare(report, event)}
                    title="Copy Share Link"
                    disabled={sharingId === report.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-1.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-60 dark:border-gray-700 dark:text-gray-300"
                  >
                    {sharingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={event => handleDownload(report, event)}
                    title={readyPdf?.id === report.id ? 'Save the PDF' : 'Download PDF'}
                    disabled={downloadingId === report.id || !agent}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition disabled:opacity-60 ${readyPdf?.id === report.id ? 'animate-pulse border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300'}`}
                  >
                    {downloadingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : readyPdf?.id === report.id ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Save</> : <Download className="h-3.5 w-3.5" />}
                  </button>
                  {/* Same sliding switch as the Review step's Share section - which state is
                      active reads at a glance instead of needing to compare two small icon
                      buttons against each other. Kept compact at every card size, not just mobile -
                      5-per-row on desktop leaves cards about as narrow as the 2-per-row mobile layout. */}
                  <button
                    onClick={event => handleToggleTheme(report, event)}
                    title={`Visitor default theme: ${report.default_theme === 'light' ? 'Ivory' : 'Midnight'} - click to switch`}
                    aria-label="Toggle visitor default theme"
                    aria-pressed={report.default_theme !== 'light'}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      report.default_theme === 'light' ? 'bg-gray-200 ring-1 ring-inset ring-black/5 dark:bg-gray-600 dark:ring-white/20' : 'bg-[#111827] ring-1 ring-inset ring-[#C9A24D]/40 dark:bg-[#C9A24D]/35 dark:ring-[#C9A24D]/60'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${
                        report.default_theme === 'light' ? 'translate-x-0' : 'translate-x-5'
                      }`}
                    >
                      {report.default_theme === 'light' ? <Sun className="h-3 w-3 text-[#C9A24D]" /> : <Moon className="h-3 w-3 text-[#111827]" />}
                    </span>
                  </button>
                  <button
                    onClick={event => handleDelete(report.id, event)}
                    title="Delete"
                    aria-label="Delete CMA"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-red-500 transition hover:border-red-600 hover:bg-red-600 hover:text-white dark:border-gray-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )})}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateCmaModal
            onClose={() => { setShowCreate(false); router.replace('/studio/cma') }}
            onCreated={id => router.push(`/studio/cma/${id}`)}
          />
        )}
      </AnimatePresence>

      <WarningConfirmModal
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete this CMA?"
        message="This will permanently remove the report, including any comps, pricing, and analysis you've added. This can't be undone."
        confirmText="Delete CMA"
        isLoading={isDeleting}
      />

      <CmaShareLinksModal
        isOpen={!!shareLinks}
        onClose={() => setShareLinks(null)}
        openHousePalUrl={shareLinks?.openHousePalUrl || null}
        websiteUrl={shareLinks?.websiteUrl || null}
      />
    </div>
  )
}

// The "New CMA" window (user, 10/20: "poorly animated"). Phones: a sheet that slides up from the
// bottom and pulls down to close (the Showcase sheet's own mechanics - components/ui/windowMotion).
// Wider screens: a centred window that springs up into place. Either way the two report types are
// big cards whose gold selection glides between them, and Continue presses with the builder's
// button feel. The page behind is pinned while it's open.
function CreateCmaModal({ onClose, onCreated }: { onClose: () => void, onCreated: (id: string) => void }) {
  const [clientName, setClientName] = useState('')
  const [mode, setMode] = useState<CmaMode>('listing')
  const [isCreating, setIsCreating] = useState(false)
  const [open, setOpen] = useState(true)
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const sheetMotion = useSheetMotion()
  const close = useCallback(() => setOpen(false), [])
  const { sheetRef, y } = useSwipeToClose(close, phone && open && !isCreating)
  const releasePagePin = usePagePin(open)
  useEscapeToClose(close, open && !isCreating)

  const handleCreate = async () => {
    setIsCreating(true)
    const response = await api.cma.create({ client_name: clientName.trim() || undefined, mode })
    if (response.success && response.data) onCreated(response.data.id)
    else setIsCreating(false)
  }

  const options: { value: CmaMode, title: string, sub: string, icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'listing', title: 'Seller / Listing', sub: 'What should this home list for?', icon: Home },
    { value: 'buyer', title: 'Buyer / Offer', sub: 'What should my buyer offer?', icon: User },
  ]

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence onExitComplete={() => { releasePagePin(); onClose() }}>
      {open && (
        <motion.div
          key="cma-create"
          data-scroll-lock="off"
          className="cma-touch fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          onClick={() => { if (!isCreating) close() }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[#0B0B0B]/70"
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
            aria-label="New CMA"
            className="relative w-full max-w-md overflow-hidden rounded-t-[28px] border border-gray-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl dark:border-gray-800 dark:bg-[#151517] sm:rounded-[28px] sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#C9A24D]/15 blur-3xl" />
            <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.05, delayChildren: reduce ? 0 : 0.08 } } }}
              className="relative"
            >
              <motion.div variants={CREATE_ITEM} className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#e0b85f] text-white shadow-lg shadow-[#C9A24D]/30">
                    <Calculator className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-serif text-xl font-black tracking-tight text-[#111827] dark:text-white">New CMA</p>
                    <p className="text-xs font-semibold text-gray-400">You&apos;ll pick the subject property next.</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                  onClick={close}
                  aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-[#111827] dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </motion.div>

              <motion.div variants={CREATE_ITEM} className="mt-5">
                <label htmlFor="cma-client-name" className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Client name (optional)</label>
                <input
                  id="cma-client-name"
                  value={clientName}
                  onChange={event => setClientName(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter' && !isCreating) handleCreate() }}
                  placeholder="e.g. The Johnsons"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base font-semibold outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white sm:text-sm"
                />
              </motion.div>

              <motion.div variants={CREATE_ITEM} className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">This CMA is for a...</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                  {options.map(opt => {
                    const on = mode === opt.value
                    const Icon = opt.icon
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setMode(opt.value)}
                        aria-pressed={on}
                        className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-colors duration-300 ${on ? 'border-[#C9A24D]' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}`}
                      >
                        {on && <motion.span layoutId="cma-create-mode" transition={{ type: 'spring', stiffness: 460, damping: 36 }} className="absolute inset-0 bg-gradient-to-br from-[#C9A24D]/20 via-[#C9A24D]/10 to-transparent" />}
                        <span className="relative flex items-center justify-between">
                          <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors duration-300 ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}><Icon className="h-4 w-4" /></span>
                          <span className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-colors duration-300 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                            {on && <Check className="cma-check-pop h-3 w-3" strokeWidth={3} />}
                          </span>
                        </span>
                        <span className={`relative mt-2 block text-sm font-black ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{opt.title}</span>
                        <span className="relative mt-0.5 block text-[11px] font-semibold leading-snug text-gray-400">{opt.sub}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>

              <motion.div variants={CREATE_ITEM}>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="cma-btn mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-black/10 disabled:opacity-80 dark:bg-white dark:text-[#111827]"
                >
                  {isCreating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up your CMA…</>
                    : <>Continue to Subject Property <ArrowLeft className="h-4 w-4 rotate-180" /></>}
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const CREATE_ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } },
} as const
