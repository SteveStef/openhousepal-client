'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity, ArrowRight, Calculator, Calendar, ClipboardList, GripVertical, Globe2, Home, Image as ImageIcon,
  Layout as LayoutIcon, LayoutDashboard, Loader2, Mail, Newspaper, Plus, Search, Users,
} from 'lucide-react'
import api from '@/lib/api-service'
import { AgentFormConfig, HostRequest, Lead, MyListingsResponse, Notification, OpenHouse, StatSummary } from '@/types'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/stats/StatCard'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import DashLeadCard from '@/components/dash/DashLeadCard'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import DashActivityFeed from '@/components/dash/DashActivityFeed'
import DashOpensPanel, { DiscoveryListing } from '@/components/dash/DashOpensPanel'
import DashKitsAndFormsPanel from '@/components/dash/DashKitsAndFormsPanel'
import ScrollableSection from '@/components/dash/ScrollableSection'

const STAT_CARDS: { metric: keyof StatSummary; label: string; icon: React.ComponentType<{ className?: string }>; isPercent?: boolean }[] = [
  { metric: 'agent_hub_visits', label: 'Agent Hub Visitors', icon: Globe2 },
  { metric: 'new_leads', label: 'New Leads', icon: Users },
  { metric: 'open_house_signins', label: 'Sign-ins', icon: Home },
  { metric: 'form_views', label: 'Forms Viewed', icon: ClipboardList },
  { metric: 'form_fills', label: 'Forms Filled', icon: ClipboardList },
  { metric: 'blog_reads', label: 'Blog Reads', icon: Newspaper },
]

// Reorderable list of card keys, persisted per-browser. Unknown/new keys (e.g. a card added
// in a later release) are appended automatically rather than dropped.
function useOrderedList(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState(defaultOrder)
  const orderRef = useRef(defaultOrder)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return
      const saved: string[] = JSON.parse(stored)
      const known = new Set(defaultOrder)
      const merged = [...saved.filter(id => known.has(id)), ...defaultOrder.filter(id => !saved.includes(id))]
      orderRef.current = merged
      setOrder(merged)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const moveDragged = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const current = orderRef.current
    const withoutDragged = current.filter(id => id !== draggedId)
    const targetIndex = withoutDragged.findIndex(id => id === targetId)
    const next = [...withoutDragged]
    next.splice(targetIndex, 0, draggedId)
    const changed = next.some((id, index) => id !== current[index])
    if (!changed) return
    orderRef.current = next
    setOrder(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  return {
    order,
    draggedId,
    dragProps: (id: string) => ({
      draggable: true,
      onDragStart: () => setDraggedId(id),
      onDragOver: (event: React.DragEvent) => { event.preventDefault(); moveDragged(id) },
      onDragEnd: () => setDraggedId(null),
    }),
  }
}

function DragHandle({ dragging }: { dragging: boolean }) {
  return (
    <span className={`pointer-events-none absolute right-2 top-2 z-10 rounded-md p-1 text-gray-300 transition-opacity dark:text-gray-600 ${dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      <GripVertical className="h-3.5 w-3.5" />
    </span>
  )
}

const QUICK_CREATE = [
  { label: 'Create Open House Kit', href: '/open-houses', icon: Home },
  { label: 'Create Showcase', href: '/showcases?new=1', icon: LayoutIcon },
  { label: 'Create Form', href: '/studio/forms?new=1', icon: ClipboardList },
  { label: 'Create Design', href: '/studio/design?new=1', icon: ImageIcon },
  { label: 'Create Blog Post', href: '/studio/blogs?new=1', icon: Newspaper },
  { label: 'Create CMA', href: '/studio/cma?new=1', icon: Calculator },
]

// Same cross-page "someone acted elsewhere, refresh now" convention used by the Header badges -
// listening for these directly (rather than importing + calling the hooks a second time) lets
// Dash refresh its own broader data set the instant a host request or lead gets resolved
// anywhere else in the app, instead of waiting for the next poll.
const LEADS_REFRESH_EVENT = 'leads-notification-count:refresh'
const OPEN_HOUSE_REFRESH_EVENT = 'openhouse-action-counts:refresh'
// Matches the near-real-time poll interval used by the notification bell and action-count hooks.
const POLL_INTERVAL_MS = 8000

export default function DashPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const { listingAgentCount: openHouseActionCount, hostCount: openHouseHostActionCount } = useOpenHouseActionCounts()
  const [loading, setLoading] = useState(true)
  const [statSummary, setStatSummary] = useState<StatSummary | null>(null)
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([])
  const [newLeads, setNewLeads] = useState<Lead[]>([])
  const [activityNotifications, setActivityNotifications] = useState<Notification[]>([])
  const [forms, setForms] = useState<AgentFormConfig[]>([])
  const [pendingSubmissionsByForm, setPendingSubmissionsByForm] = useState<Record<string, number>>({})
  const [hostRequests, setHostRequests] = useState<HostRequest[]>([])
  const [discoveryListings, setDiscoveryListings] = useState<DiscoveryListing[]>([])
  const [myListings, setMyListings] = useState<MyListingsResponse | null>(null)
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  // Rendered once at the page's top level, not nested inside each DashLeadCard - nesting a full
  // fixed-overlay modal deep inside the draggable/animated panel grid caused it to glitch violently
  // on open (framer-motion's layout animation and the panel drag handling both fighting a huge
  // subtree suddenly appearing inside them). This mirrors exactly how the main Leads list page
  // already does it (a single selectedLeadId + one modal at the bottom of the page).
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const statDrag = useOrderedList('dash:statOrder', STAT_CARDS.map(c => c.metric))
  // One shared order across all 4 panels (was two separate 2-up rows) - split into two columns
  // below (even index -> left, odd index -> right) so Leads and Activity - the first two in this
  // default order - always land side by side as the top row, with the masonry reflow happening
  // independently within each column beneath them. v2 (was v1) so anyone with an old saved order
  // picks up this corrected default instead of whatever they'd dragged into place before.
  const dashPanelsDrag = useOrderedList('dash:panelOrder:v2', ['New Leads', 'Activity', 'Manage Your Opens', 'Open House Kits & Forms'])

  const loadDashData = useCallback(async (isFirstLoad = false) => {
    const [statsRes, openHousesRes, attentionLeadsRes, recentLeadsRes, activityNotificationsRes, formsRes, hostRequestsRes, discoveryRes, myListingsRes] = await Promise.all([
      api.stats.getSummary(),
      api.openHouses.getAll(),
      // Unlimited - every lead needing attention, however many that is, always shown (and always
      // the true badge count, unpadded).
      api.leads.list({ needsAttention: true, sort: 'newest' }),
      // Backfill pool so the panel never goes empty just because everything's been addressed - see
      // the merge below, which only pulls from this to pad up to a 5-card floor.
      api.leads.list({ sort: 'newest', limit: 10 }),
      // Same source and 30-day window as the notification bell, not a leads query - this panel
      // is meant to mirror the bell's "what actually happened recently" feed, not a leads
      // priority list (that mismatch was the point of this change: it used to show each of the
      // 6 highest-priority leads' own last-touch date, which could scatter across many
      // unrelated days instead of reflecting today's real activity).
      api.notifications.getAll(false, 30),
      api.forms.getMine(),
      api.openHouseManager.getHostRequests('pending'),
      api.discovery.get(),
      api.openHouseManager.getMyListings(),
    ])

    if (statsRes.success && statsRes.data) setStatSummary(statsRes.data)
    if (openHousesRes.success && openHousesRes.data) setOpenHouses(openHousesRes.data)
    if (attentionLeadsRes.success && attentionLeadsRes.data) {
      const attentionLeads = attentionLeadsRes.data
      setNewLeadsCount(attentionLeads.length)
      const MIN_DISPLAY = 5
      if (attentionLeads.length >= MIN_DISPLAY || !recentLeadsRes.success || !recentLeadsRes.data) {
        setNewLeads(attentionLeads)
      } else {
        // Fewer leads need attention than the panel's floor - pad with the most recently active
        // leads (already needs_attention-first since attentionLeads goes first) so the panel
        // still reads as a real feed instead of going empty/near-empty the moment everything's
        // been addressed.
        const seen = new Set(attentionLeads.map(l => l.id))
        const padding = recentLeadsRes.data.filter(l => !seen.has(l.id))
        setNewLeads([...attentionLeads, ...padding].slice(0, MIN_DISPLAY))
      }
    }
    if (activityNotificationsRes.success && activityNotificationsRes.data) setActivityNotifications(activityNotificationsRes.data)
    if (hostRequestsRes.success && hostRequestsRes.data) setHostRequests(hostRequestsRes.data)
    if (discoveryRes.success && discoveryRes.data) setDiscoveryListings((discoveryRes.data as any).data || [])
    if (myListingsRes.success && myListingsRes.data) setMyListings(myListingsRes.data)

    if (formsRes.success && formsRes.data) {
      setForms(formsRes.data)
      const submissionCounts: Record<string, number> = {}
      await Promise.all(formsRes.data.map(async form => {
        const subRes = await api.forms.getSubmissions(form.id)
        if (subRes.success && subRes.data) {
          submissionCounts[form.id] = subRes.data.filter(s => !s.is_reviewed).length
        }
      }))
      setPendingSubmissionsByForm(submissionCounts)
    }

    setLastUpdated(new Date())
    if (isFirstLoad) setLoading(false)
  }, [])

  // Marketing homepage (app/page.tsx) redirects the other way (authenticated -> here) -
  // this is the mirror image, so a logged-out visitor never lands on the dashboard shell.
  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      router.replace('/')
    }
  }, [isCheckingAuth, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return

    loadDashData(true)

    const handleFocus = () => loadDashData()
    const handleRefresh = () => loadDashData()
    window.addEventListener('focus', handleFocus)
    window.addEventListener(LEADS_REFRESH_EVENT, handleRefresh)
    window.addEventListener(OPEN_HOUSE_REFRESH_EVENT, handleRefresh)
    const interval = setInterval(() => loadDashData(), POLL_INTERVAL_MS)
    const tick = setInterval(() => setNowTick(Date.now()), 15000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(LEADS_REFRESH_EVENT, handleRefresh)
      window.removeEventListener(OPEN_HOUSE_REFRESH_EVENT, handleRefresh)
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [loadDashData, isAuthenticated])

  const updatedAgo = (() => {
    if (!lastUpdated) return null
    const diffSecs = Math.max(0, Math.round((nowTick - lastUpdated.getTime()) / 1000))
    if (diffSecs < 5) return 'just now'
    if (diffSecs < 60) return `${diffSecs}s ago`
    return `${Math.round(diffSecs / 60)}m ago`
  })()

  const totalPendingSubmissions = Object.values(pendingSubmissionsByForm).reduce((sum, n) => sum + n, 0)
  const hasOwnListings = (myListings?.listings.length || 0) > 0
  // newLeads is already needs_attention-only, newest-first (see the fetch above) - no further
  // client-side filtering/sorting needed, just take the top few for display. The panel itself
  // only shows 4 rows at a time (see ScrollableSection below) and scrolls for the rest, up to
  // this cap of 12 (3x the visible count, same ratio Activity below uses).
  const topNewLeads = newLeads.slice(0, 12)

  // Same feed the bell shows (most-recent-first, last 30 days) - just capped tighter since this
  // is a small dashboard panel, not the full dropdown. Activity rows are shorter than lead cards,
  // so it takes ~7 rows (not 6) to actually fill the same visible height as Leads' 4 cards - see
  // the matching max-h-[430px] on both ScrollableSections below. 21 = 3x that, same ratio as Leads.
  const topActivityNotifications = activityNotifications.slice(0, 21)

  // One combined set - all 4 render in a single masonry-style flow (see dashPanelsDrag/the
  // columns-based layout below) instead of two separate fixed 2-up rows, so a short panel (e.g.
  // Activity with just 1-2 items) doesn't leave dead space next to it that nothing else can fill.
  const allPanels: Record<string, React.ReactNode> = {
    'Activity': (
      <DashPanel title="Activity" icon={Activity} viewHref="/activity" viewLabel="Full history" isEmpty={topActivityNotifications.length === 0} emptyLabel="No recent activity">
        <ScrollableSection maxHeightClass="max-h-[430px]" viewHref="/activity" viewLabel="Full history">
          <DashActivityFeed notifications={topActivityNotifications} />
        </ScrollableSection>
      </DashPanel>
    ),
    'New Leads': (
      <DashPanel title="Leads" icon={Mail} viewHref="/leads" badgeCount={newLeadsCount} badgeExact isEmpty={topNewLeads.length === 0} emptyLabel="No new leads">
        <ScrollableSection maxHeightClass="max-h-[430px]" viewHref="/leads" viewLabel="View all leads">
          <div className="flex min-w-0 flex-col gap-2.5">
            {topNewLeads.map(lead => <DashLeadCard key={lead.id} lead={lead} onOpenLead={() => setSelectedLeadId(lead.id)} />)}
          </div>
        </ScrollableSection>
      </DashPanel>
    ),
    'Manage Your Opens': (
      <DashPanel
        title={hasOwnListings ? 'Opens & Listings' : 'Find an Open House'}
        icon={hasOwnListings ? Calendar : Search}
        viewHref={hasOwnListings ? '/open-houses/my-listings' : '/discovery'}
        large
        badgeCount={hasOwnListings ? openHouseActionCount : openHouseHostActionCount}
      >
        <DashOpensPanel listings={myListings?.listings || []} hostRequests={hostRequests} discoveryListings={discoveryListings} />
      </DashPanel>
    ),
    'Open House Kits & Forms': (
      <DashPanel title="Open House Kits & Forms" icon={Home} viewHref="/open-houses" large badgeCount={totalPendingSubmissions}>
        <DashKitsAndFormsPanel openHouses={openHouses} forms={forms} pendingSubmissionsByForm={pendingSubmissionsByForm} />
      </DashPanel>
    ),
  }

  if (isCheckingAuth || !isAuthenticated) {
    return <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" />
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <PageHeader
            icon={LayoutDashboard}
            title="What needs your attention"
            subtitle="New leads, recent activity, open houses, and everything else that needs a look today — all in one place."
            compact
            badge={updatedAgo && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400 sm:text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Updated {updatedAgo}
              </span>
            )}
          />
        </motion.div>

        {/* Quick create */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} className="mt-6 flex min-w-0 flex-wrap gap-2">
          {QUICK_CREATE.map(action => (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-gray-700 dark:bg-[#151517] dark:text-white sm:px-3.5"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{action.label}</span>
            </Link>
          ))}
        </motion.div>

        {/* KPI strip */}
        {statSummary && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-6 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2.5 lg:grid-cols-6">
            {statDrag.order.map(metric => {
              const card = STAT_CARDS.find(c => c.metric === metric)
              if (!card) return null
              const { metric: cardMetric, label, icon, isPercent } = card
              return (
                <div key={metric} {...statDrag.dragProps(metric)} className={`group relative min-w-0 cursor-grab rounded-xl active:cursor-grabbing ${statDrag.draggedId === metric ? 'opacity-40' : ''}`}>
                  <DragHandle dragging={statDrag.draggedId === metric} />
                  <StatCard compact metric={cardMetric} label={label} icon={icon} entry={statSummary[cardMetric] || { current: 0, previous: 0, percent: 0 }} isPercent={isPercent} />
                </div>
              )
            })}
          </motion.div>
        )}

        {loading && (
          <div className="mt-16 flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your dashboard...
          </div>
        )}

        {!loading && (
          <>
            {/* Mobile: a fixed single-column order (Leads, then Activity, then Opens & Listings,
                then Open House Kits & Forms last) - not draggable, since the masonry below only
                collapses cleanly into that order at md: and up. Splitting dashPanelsDrag.order by
                index parity into two columns (see below) doesn't produce this sequence once those
                columns stack on a narrow screen - column 0 (Leads, Opens & Listings) would render
                fully before column 1 (Activity, Kits & Forms) even started. */}
            <div className="mt-8 flex min-w-0 flex-col gap-4 md:hidden">
              {['New Leads', 'Activity', 'Manage Your Opens', 'Open House Kits & Forms'].map(key => (
                <div key={key} className="min-w-0">{allPanels[key]}</div>
              ))}
            </div>

            {/* Manual masonry (md: and up): the order list is split left/right by index (even ->
                left column, odd -> right), each rendered as its own independently-stacking flex
                column instead of relying on CSS multi-column's browser-decided balancing (which
                reorders panels by height and won't reliably keep Leads/Activity - the first two in
                the default order - side by side as the top row). A short panel (e.g. Activity with
                only 1-2 items) just lets the next panel in that same column start right below it,
                with no dead space dictated by the other column's height (`items-start` keeps the
                two columns from stretching to match each other). */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="mt-8 hidden min-w-0 items-start gap-4 sm:gap-5 md:grid md:grid-cols-2">
              {[0, 1].map(columnIndex => (
                <div key={columnIndex} className="flex min-w-0 flex-col gap-4 sm:gap-5">
                  {dashPanelsDrag.order.filter((_, i) => i % 2 === columnIndex).map(key => (
                    <div key={key} {...dashPanelsDrag.dragProps(key)} className={`group relative min-w-0 cursor-grab rounded-2xl active:cursor-grabbing ${dashPanelsDrag.draggedId === key ? 'opacity-40' : ''}`}>
                      <DragHandle dragging={dashPanelsDrag.draggedId === key} />
                      {allPanels[key]}
                    </div>
                  ))}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </div>

      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          onClose={() => { setSelectedLeadId(null); loadDashData() }}
          onChanged={loadDashData}
        />
      )}
    </div>
  )
}

function DashPanel({ title, icon: Icon, children, viewHref, viewLabel, badgeCount, badgeExact, large, isEmpty, emptyLabel }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  viewHref: string
  viewLabel?: string
  badgeCount?: number
  // Leads only has a handful of "needs attention" leads at a time, unlike the other panels' action
  // counts - showing the real number is more useful there than the generic "9+" cap.
  badgeExact?: boolean
  large?: boolean
  isEmpty?: boolean
  emptyLabel?: string
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-gray-200 bg-[#fbfaf7] dark:border-gray-800 dark:bg-[#111113] ${large ? 'p-4 sm:p-6' : 'p-3 sm:p-5'}`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Link href={viewHref} className={`flex min-w-0 items-center gap-2 font-serif font-black text-[#111827] hover:text-[#8b7355] dark:text-white dark:hover:text-[#d7b974] ${large ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
          <Icon className={`shrink-0 text-[#8b7355] ${large ? 'h-5 w-5' : 'h-4 w-4'}`} /> <span className="min-w-0 truncate">{title}</span>
          {!!badgeCount && badgeCount > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
              {!badgeExact && badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Link>
        <Link href={viewHref} className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[#8b7355] hover:text-[#111827] dark:hover:text-white">
          {viewLabel || 'View all'} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-3 min-w-0">
        {isEmpty ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">{emptyLabel}</p>
        ) : children}
      </div>
    </div>
  )
}
