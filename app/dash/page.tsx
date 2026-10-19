'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity, AlertTriangle, ArrowRight, Calculator, CalendarClock, ChevronDown, Clapperboard, ClipboardList, GripVertical, Link2, Home, Image as ImageIcon,
  Layout as LayoutIcon, LayoutDashboard, Lock, Mail, Newspaper, Plus, Users,
} from 'lucide-react'
import api from '@/lib/api-service'
import { HostRequest, Lead, MyListingsResponse, Notification, StatSummary } from '@/types'
import LuxeHero, { LuxeStats, luxePill } from '@/components/ui/LuxeHero'
import MissedShowcasesBanner from '@/components/MissedShowcasesBanner'
import OhpLoader from '@/components/brand/OhpLoader'
import NewListingSpotlightCard from '@/components/dash/NewListingSpotlightCard'
import SetupChecklistCard from '@/components/dash/SetupChecklistCard'
import DomainHealthBanner from '@/components/DomainHealthBanner'
import StatCard from '@/components/stats/StatCard'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import DashLeadCard from '@/components/dash/DashLeadCard'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import DashActivityFeed from '@/components/dash/DashActivityFeed'
import { DiscoveryListing } from '@/components/dash/DashOpensPanel'
import { DiscoveryListingStatus } from '@/components/dash/DashDiscoveryPanel'
import DashManagerCard from '@/components/dash/DashManagerCard'
import DashCardHeader, { type DashStatusTone } from '@/components/dash/DashCardHeader'
import DashDiscoveryCard from '@/components/dash/DashDiscoveryCard'
import TasksPanel, { CalendarChip } from '@/components/tasks/TasksPanel'
import { useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'
import ScrollableSection from '@/components/dash/ScrollableSection'
import { getNavFeatureAccess, type NavFeatureKey } from '@/lib/navAccess'
import { AUTO_HIDE_WHEN_READ_TYPES, visibleNotifications } from '@/lib/notificationDisplay'

const STAT_CARDS: { metric: keyof StatSummary; label: string; icon: React.ComponentType<{ className?: string }>; isPercent?: boolean }[] = [
  { metric: 'agent_hub_visits', label: 'Agent Hub Visitors', icon: Link2 },
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

const QUICK_CREATE: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; feature?: NavFeatureKey }[] = [
  { label: 'Create Open House Kit', href: '/open-houses', icon: Home },
  { label: 'Create Showcase', href: '/showcases?new=1', icon: LayoutIcon, feature: 'showcases' },
  { label: 'Create Form', href: '/studio/forms?new=1', icon: ClipboardList },
  { label: 'Create Design', href: '/studio/design?new=1', icon: ImageIcon, feature: 'design_studio' },
  { label: 'Create Blog Post', href: '/studio/blogs?new=1', icon: Newspaper, feature: 'blogs' },
  { label: 'Create CMA', href: '/studio/cma?new=1', icon: Calculator, feature: 'cma' },
  { label: 'Media Lab', href: '/studio/media', icon: Clapperboard, feature: 'ai_media' },
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
  const { user, isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const { listingAgentCount: openHouseActionCount, hostCount: openHouseHostActionCount, listingAgentUnseenUpdates, counteredAsHost, incomingAsks } = useOpenHouseActionCounts()
  // Host requests on my listings waiting on my answer - one per request (its offered time slots
  // grouped), active listings only: the same number the Opens menu badge counts.
  const pendingHostRequests = Math.max(0, (openHouseActionCount || 0) - (listingAgentUnseenUpdates || 0))
  const [loading, setLoading] = useState(true)
  const [statSummary, setStatSummary] = useState<StatSummary | null>(null)
  const [newLeads, setNewLeads] = useState<Lead[]>([])
  const [activityNotifications, setActivityNotifications] = useState<Notification[]>([])
  const [hostRequests, setHostRequests] = useState<HostRequest[]>([])
  // Hosting requests this agent SENT (Discovery card's "Your hosting": counters, confirmed, waiting).
  const [myHostRequests, setMyHostRequests] = useState<HostRequest[]>([])
  const [discoveryListings, setDiscoveryListings] = useState<DiscoveryListing[]>([])
  // null (never loaded), then true/false once the first /api/discovery response comes back -
  // preferences is only null server-side when the agent has never saved a Discovery search at
  // all (see GetDiscoveryResponse.preferences), which is a different empty state from "searched,
  // zero matches right now" - defaulting to true avoids flashing the "set up your search" CTA
  // for a returning agent before this first response lands.
  const [hasDiscoveryPreferences, setHasDiscoveryPreferences] = useState(true)
  const [discoveryListingStatuses, setDiscoveryListingStatuses] = useState<Record<string, DiscoveryListingStatus>>({})
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
  // One shared order across the panels - split into two columns below (even index -> left, odd
  // index -> right) so Leads and Activity - the first two in this default order - land side by
  // side as the top row, and Manager (index 2) / Discovery (index 3) land side by side as the
  // next row. v5 (was v4) - the shared tabbed "Open House Manager" card was split back into its
  // own Manager and Discovery cards, so old saved orders pick up the two new keys cleanly.
  // Keys with no panel this render (Manager when the agent owns no listings) are filtered out
  // where `order` is consumed, so they never leave an empty draggable slot.
  // Follow-ups isn't in this list - it's positioned separately (see followupsAtTop below), not
  // part of the draggable set. v7 (was v6): dropping it here means a saved v6 order carrying that
  // key would try to render a panel that no longer exists in this set - useOrderedList's merge
  // only keeps saved ids present in defaultOrder, so bumping the storage key isn't strictly
  // required for that, but does it cleanly for every existing saved order at once.
  const dashPanelsDrag = useOrderedList('dash:panelOrder:v7', ['New Leads', 'Activity', 'Open House Manager', 'Open House Discovery'])
  const [followupOpenCount, setFollowupOpenCount] = useState<number | null>(null)
  // Hidden entirely while the agent has Follow-ups switched off (null = still checking - keep it).
  const followupsOn = useFollowupsEnabled().enabled !== false
  const refreshFollowupCount = useCallback(() => {
    api.tasks.counts().then(r => { if (r.success && r.data) setFollowupOpenCount(r.data.overdue + r.data.today) })
  }, [])
  useEffect(() => { refreshFollowupCount() }, [refreshFollowupCount])

  const loadDashData = useCallback(async (isFirstLoad = false) => {
    const [statsRes, attentionLeadsRes, recentLeadsRes, activityNotificationsRes, hostRequestsRes, discoveryRes, myListingsRes] = await Promise.all([
      api.stats.getSummary(),
      // Unlimited - every lead needing attention, however many that is, always shown (and always
      // the true badge count, unpadded).
      api.leads.list({ needsAttention: true, sort: 'newest' }),
      // Backfill pool so the panel never goes empty just because everything's been addressed - see
      // the merge below, which only pulls from this to pad up to a 5-card floor.
      api.leads.list({ sort: 'newest', limit: 30 }),
      // Same source and 30-day window as the notification bell, not a leads query - this panel
      // is meant to mirror the bell's "what actually happened recently" feed, not a leads
      // priority list (that mismatch was the point of this change: it used to show each of the
      // 6 highest-priority leads' own last-touch date, which could scatter across many
      // unrelated days instead of reflecting today's real activity).
      api.notifications.getAll(false, 30),
      api.openHouseManager.getHostRequests('pending'),
      api.discovery.get(),
      api.openHouseManager.getMyListings(),
    ])
    // Not in the Promise.all above: the No-MLS plans get a 403 here, which must never hold up Dash.
    api.openHouseManager.getMyRequests().then(r => { if (r.success && r.data) setMyHostRequests(r.data) }).catch(() => {})

    if (statsRes.success && statsRes.data) setStatSummary(statsRes.data)
    if (attentionLeadsRes.success && attentionLeadsRes.data) {
      // Brand-new guests WITHOUT an agent lead the panel (user, 10/17); someone with an agent only
      // shows here when you left a note on them recently. The server already only flags a
      // represented lead when it has a note you haven't looked at since.
      const recentNote = (l: Lead) => !!l.note_at && Date.now() - new Date(l.note_at).getTime() < 14 * 864e5
      const belongs = (l: Lead) => l.represented !== 'yes' || recentNote(l)
      const attentionLeads = attentionLeadsRes.data.filter(belongs)
        .sort((a, b) => Number(a.represented === 'yes') - Number(b.represented === 'yes'))
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
        const padding = recentLeadsRes.data.filter(l => !seen.has(l.id) && belongs(l))
        setNewLeads([...attentionLeads, ...padding].slice(0, MIN_DISPLAY))
      }
    }
    if (activityNotificationsRes.success && activityNotificationsRes.data) setActivityNotifications(activityNotificationsRes.data)
    if (hostRequestsRes.success && hostRequestsRes.data) setHostRequests(hostRequestsRes.data)
    if (discoveryRes.success && discoveryRes.data) {
      setDiscoveryListings((discoveryRes.data as any).data || [])
      setHasDiscoveryPreferences((discoveryRes.data as any).preferences != null)
    }
    // Dash only shows listings that can still need a host - under contract (Pending / Active Under
    // Contract) or off the market has nothing to find a host for. They stay on the Manager page.
    if (myListingsRes.success && myListingsRes.data) {
      const d = myListingsRes.data
      setMyListings({ ...d, listings: d.listings.filter(l => l.hosting_blocked !== 'pending' && l.hosting_blocked !== 'off_market') })
    }

    setLastUpdated(new Date())
    if (isFirstLoad) setLoading(false)
  }, [])

  // Real per-listing schedule data for the "Open House Discovery" shortcut panel - same call
  // Discovery's own page makes for the properties it renders, just scoped to the handful the
  // panel actually shows (see DashDiscoveryPanel's own top-3-by-distance slice).
  useEffect(() => {
    const keys = discoveryListings.map(l => l.ListingKey).filter(Boolean)
    if (keys.length === 0) {
      setDiscoveryListingStatuses({})
      return
    }
    api.openHouseManager.getListingStatuses(keys).then(({ success, data }) => {
      if (success && data) setDiscoveryListingStatuses(data)
    })
  }, [discoveryListings])

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
    // Paused while the tab is in the background (no point re-pulling seven feeds nobody's looking
    // at); coming back to the tab refetches right away (the focus / visibility handlers).
    const interval = setInterval(() => { if (!document.hidden) loadDashData() }, POLL_INTERVAL_MS)
    const handleVisible = () => { if (!document.hidden) loadDashData() }
    document.addEventListener('visibilitychange', handleVisible)
    const tick = setInterval(() => setNowTick(Date.now()), 15000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(LEADS_REFRESH_EVENT, handleRefresh)
      window.removeEventListener(OPEN_HOUSE_REFRESH_EVENT, handleRefresh)
      clearInterval(interval)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [loadDashData, isAuthenticated])

  const updatedAgo = (() => {
    if (!lastUpdated) return null
    const diffSecs = Math.max(0, Math.round((nowTick - lastUpdated.getTime()) / 1000))
    if (diffSecs < 5) return 'just now'
    if (diffSecs < 60) return `${diffSecs}s ago`
    return `${Math.round(diffSecs / 60)}m ago`
  })()

  // newLeads is already needs_attention-only, newest-first (see the fetch above) - no further
  // client-side filtering/sorting needed, just take the top few for display. The panel itself
  // only shows 4 rows at a time (see ScrollableSection below) and scrolls for the rest, up to
  // this cap of 12 (3x the visible count, same ratio Activity below uses).
  const topNewLeads = newLeads.slice(0, 12)

  // Same feed the bell shows (most-recent-first, last 30 days) - just capped tighter since this
  // is a small dashboard panel, not the full dropdown. Activity rows are shorter than lead cards,
  // so it takes ~7 rows (not 6) to actually fill the same visible height as Leads' 4 cards - see
  // the matching max-h-[430px] on both ScrollableSections below. 21 = 3x that, same ratio as Leads.
  // AI Video alerts drop out once seen (see lib/notificationDisplay.tsx) rather than just
  // graying out like every other type - viewing them here counts as "seen" too (below).
  const topActivityNotifications = visibleNotifications(activityNotifications).slice(0, 21)

  useEffect(() => {
    const hasUnseenAutoHide = activityNotifications.some(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) && !n.isRead)
    if (!hasUnseenAutoHide) return
    api.notifications.markTypesAsRead(Array.from(AUTO_HIDE_WHEN_READ_TYPES)).then(() => {
      setActivityNotifications(prev => prev.map(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) ? { ...n, isRead: true } : n))
    })
  }, [activityNotifications])

  // One combined set - all 4 render in a single masonry-style flow (see dashPanelsDrag/the
  // columns-based layout below) instead of two separate fixed 2-up rows, so a short panel (e.g.
  // Activity with just 1-2 items) doesn't leave dead space next to it that nothing else can fill.
  // Counted over the whole 30-day feed (not just the 21 rows shown) - the same number the bell shows.
  const activityUnread = visibleNotifications(activityNotifications).filter(n => !n.isRead).length
  const allPanels: Record<string, React.ReactNode> = {
    'Activity': (
      <DashPanel
        title="Activity" icon={Activity} viewHref="/activity" viewLabel="Full history"
        status={activityUnread ? `${activityUnread} new` : 'Nothing new'} statusTone={activityUnread ? 'gold' : 'muted'}
        isEmpty={topActivityNotifications.length === 0}
        emptyLabel="Your recent activity — lead replies, open house sign-ins, form fills, and more — will show up here as it happens."
      >
        <ScrollableSection maxHeightClass="max-h-[430px]" viewHref="/activity" viewLabel="Full history">
          <DashActivityFeed notifications={topActivityNotifications}
            onRead={id => setActivityNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))} />
        </ScrollableSection>
      </DashPanel>
    ),
    'New Leads': (
      <DashPanel
        title="Leads" icon={Mail} viewHref="/leads" badgeCount={newLeadsCount} badgeExact
        status={newLeadsCount ? `${newLeadsCount} unread` : 'All caught up'} statusTone={newLeadsCount ? 'red' : 'green'}
        isEmpty={topNewLeads.length === 0}
        emptyLabel="New leads will show up here — open house sign-ins, form fills, and inquiries from your Agent Hub, the moment someone reaches out."
      >
        <ScrollableSection maxHeightClass="max-h-[430px]" viewHref="/leads" viewLabel="View all leads">
          <div className="flex min-w-0 flex-col gap-2.5">
            {topNewLeads.map(lead => <DashLeadCard key={lead.id} lead={lead} onOpenLead={() => setSelectedLeadId(lead.id)} />)}
          </div>
        </ScrollableSection>
      </DashPanel>
    ),
    // Manager is only its own card for agents who actually have listings to manage - otherwise
    // there's nothing for it to show and Discovery covers the "find an open to host" case alone.
    ...((myListings?.listings.length || 0) > 0 ? {
      'Open House Manager': (
        <DashManagerCard
          myListings={myListings}
          hostRequests={hostRequests}
          discoveryListings={discoveryListings}
          actionCount={openHouseActionCount}
          hasSearchPreferences={hasDiscoveryPreferences}
        />
      ),
    } : {}),
    'Open House Discovery': (
      <DashDiscoveryCard
        listings={discoveryListings}
        statuses={discoveryListingStatuses}
        actionCount={openHouseHostActionCount}
        hasSearchPreferences={hasDiscoveryPreferences}
        myRequests={myHostRequests}
        counteredAsHost={counteredAsHost}
        incomingAsks={incomingAsks}
      />
    ),
  }

  // Follow-ups is deliberately NOT part of the draggable two-column set above - its position is
  // urgency-driven, not a layout preference: pinned full-width at the very top when something is
  // actually due (same "surface it, don't make them go looking" as the host-requests banner), or
  // tucked full-width at the bottom, out of the way, once the agent is caught up. Defaults to the
  // bottom while the count is still loading (null) so it doesn't pop to the top and then back down.
  const followupsAtTop = followupsOn && (followupOpenCount ?? 0) > 0
  // Hide/show for this visit only - coming back to Dash (or reloading) opens it again, so what's
  // due is always in front of the agent.
  const [followupsHidden, setFollowupsHidden] = useState(false)
  const followupsPanel = !followupsOn ? null : (
    <DashPanel
      title="Follow-ups" icon={CalendarClock} viewHref="/leads/tasks" viewLabel="All follow-ups"
      status={followupOpenCount ? `${followupOpenCount} due` : 'All clear'} statusTone={followupOpenCount ? 'red' : 'green'}
      badgeCount={followupOpenCount ?? undefined} badgeExact
      headerExtra={<>
        <CalendarChip />
        <button type="button" onClick={() => setFollowupsHidden(h => !h)} aria-expanded={!followupsHidden}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400 dark:hover:text-[#d7b974]">
          <ChevronDown className={`h-3 w-3 transition-transform ${followupsHidden ? '' : 'rotate-180'}`} /> {followupsHidden ? 'Show' : 'Hide'}
        </button>
      </>}
    >
      {/* No ScrollableSection here (unlike Leads/Activity) - Follow-ups' own grid already spreads
          rows sideways instead of stacking them tall. TasksPanel renders its own "nothing due"
          state, keeps anything checked off today at the bottom (so an accidental check is easy
          to undo), and ends with the calendar connected / not-connected line. */}
      {/* Kept mounted while hidden, so Show is instant and the count keeps updating. */}
      <div className="min-w-0 px-1.5 py-2" hidden={followupsHidden}>
        <TasksPanel compact onCountChange={refreshFollowupCount} />
      </div>
    </DashPanel>
  )

  if (isCheckingAuth || !isAuthenticated) {
    return <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" />
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        {/* The shared luxe header (same look as Listing Spotlight): today's three to-do counts on
            the right, the quick-create links inside it. Same links, same plan locks as before. */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <LuxeHero
            kicker="Dash"
            icon={LayoutDashboard}
            compact
            title={<>What needs your <em>attention.</em></>}
            subtitle={<><span className="sm:hidden">Leads, activity, open houses &amp; follow-ups.</span><span className="hidden sm:inline">New leads, activity, open houses and follow-ups - everything that needs a look today.</span></>}
            subtitleClassName="whitespace-nowrap lg:max-w-none"
            kickerNote={updatedAgo && (
              <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" /> Updated {updatedAgo}</>
            )}
            // Phones: no stat tiles or quick-create pills up here (user, 10/17) - screen space goes
            // to what needs attention; the same links live in the menu.
            asideClassName="max-sm:hidden lg:w-[400px] lg:-mt-6"
            actionsClassName="max-sm:hidden"
            aside={
              <LuxeStats
                stats={[
                  { label: 'Unread', value: newLeadsCount, icon: Users, alert: newLeadsCount > 0 },
                  { label: 'Open houses', value: (openHouseActionCount || 0) + (openHouseHostActionCount || 0), icon: Home, alert: ((openHouseActionCount || 0) + (openHouseHostActionCount || 0)) > 0 },
                  ...(followupsOn ? [{ label: 'Follow-ups', value: followupOpenCount ?? '-', icon: CalendarClock, urgent: (followupOpenCount || 0) > 0 }] : []),
                ]}
                note="Waiting on you right now · updates on its own"
              />
            }
            actions={
              <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2 [&>*]:min-w-0">
                {QUICK_CREATE.map(action => {
                  const access = action.feature ? getNavFeatureAccess(user?.plan_tier, action.feature) : { visible: true, locked: false, upgradeHref: '' }
                  if (!access.visible) return null
                  return (
                    <Link
                      key={action.label}
                      href={access.locked ? access.upgradeHref : action.href}
                      className={`${luxePill()} max-sm:justify-start max-sm:px-2.5 max-sm:py-1.5 max-sm:text-[11px] ${access.locked ? 'opacity-50 hover:opacity-100' : ''}`}
                    >
                      {access.locked ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-[#a8803a] dark:text-[#e8c97a]" />} <span className="truncate"><span className="sm:hidden">{action.label.replace(/^Create /, '')}</span><span className="hidden sm:inline">{action.label}</span></span>
                    </Link>
                  )
                })}
              </div>
            }
          />
        </motion.div>

        {/* The setup flow - every step for this plan, until all are done (skipped ones stay as chips). */}
        <DomainHealthBanner className="mt-4" />
        <SetupChecklistCard className="mt-4" />

        {/* KPI strip */}
        {statSummary && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-4 grid min-w-0 grid-cols-3 gap-1.5 max-sm:hidden sm:gap-2.5 lg:grid-cols-6">
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

        {pendingHostRequests > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.02 }} className="mt-4">
            <Link
              href="/open-houses/my-listings?panel=host-requests"
              className="animate-pulse-glow flex min-w-0 items-center gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 dark:border-amber-500/60 dark:bg-amber-500/10"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="min-w-0 flex-1 text-sm font-black text-amber-800 dark:text-amber-300">
                {pendingHostRequests} host request{pendingHostRequests === 1 ? '' : 's'} waiting on your response
              </p>
              <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            </Link>
          </motion.div>
        )}

        {/* A brand-new listing without a Listing Spotlight yet -> one tap to make one. */}
        <NewListingSpotlightCard className="mt-4" />

        {/* Basic only: guests who'd already have a Showcase on Premium (renders nothing otherwise). */}
        <MissedShowcasesBanner className="mt-4" />


        {loading && (
          <OhpLoader fullScreen={false} className="mt-8" />
        )}

        {!loading && (
          <>
            {/* Mobile: a fixed single-column order (Follow-ups pinned top/bottom by urgency, then
                Leads, Activity, Manager, Discovery) - not draggable, since the masonry below only
                collapses cleanly into that order at md: and up. Splitting dashPanelsDrag.order by
                index parity into two columns (see below) doesn't produce this sequence once those
                columns stack on a narrow screen. */}
            <div className="mt-8 flex min-w-0 flex-col gap-4 md:hidden">
              {followupsAtTop && <div className="min-w-0">{followupsPanel}</div>}
              {['New Leads', 'Activity', 'Open House Manager', 'Open House Discovery'].filter(key => allPanels[key]).map(key => (
                <div key={key} className="min-w-0">{allPanels[key]}</div>
              ))}
              {!followupsAtTop && followupsPanel && <div className="min-w-0">{followupsPanel}</div>}
            </div>

            {/* Follow-ups pinned full-width above the grid when something's actually due - same
                "surface it, don't make them go looking" placement as the host-requests banner
                above, just below it in priority (a follow-up isn't as time-sensitive as another
                agent waiting on a response). */}
            {followupsAtTop && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mt-8 hidden min-w-0 md:block">
                {followupsPanel}
              </motion.div>
            )}

            {/* Manual masonry (md: and up): the order list is split left/right by index (even ->
                left column, odd -> right), each rendered as its own independently-stacking flex
                column instead of relying on CSS multi-column's browser-decided balancing (which
                reorders panels by height and won't reliably keep Leads/Activity - the first two in
                the default order - side by side as the top row). A short panel (e.g. Activity with
                only 1-2 items) just lets the next panel in that same column start right below it,
                with no dead space dictated by the other column's height (`items-start` keeps the
                two columns from stretching to match each other). */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className={`hidden min-w-0 items-start gap-4 sm:gap-5 md:grid md:grid-cols-2 ${followupsAtTop ? 'mt-4' : 'mt-8'}`}>
              {[0, 1].map(columnIndex => (
                <div key={columnIndex} className="flex min-w-0 flex-col gap-4 sm:gap-5">
                  {dashPanelsDrag.order.filter(key => allPanels[key]).filter((_, i) => i % 2 === columnIndex).map(key => (
                    <div key={key} {...dashPanelsDrag.dragProps(key)} className={`group relative min-w-0 cursor-grab rounded-2xl active:cursor-grabbing ${dashPanelsDrag.draggedId === key ? 'opacity-40' : ''}`}>
                      <DragHandle dragging={dashPanelsDrag.draggedId === key} />
                      {allPanels[key]}
                    </div>
                  ))}
                </div>
              ))}
            </motion.div>

            {/* Follow-ups pinned full-width below the grid, out of the way, once caught up. */}
            {!followupsAtTop && followupsPanel && (
              <div className="mt-4 hidden min-w-0 md:block">
                {followupsPanel}
              </div>
            )}
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

function DashPanel({ title, icon: Icon, children, viewHref, viewLabel, badgeCount, badgeExact, large, isEmpty, emptyLabel, emptyMinHeightClass = 'min-h-[430px]', headerExtra, status, statusTone }: {
  /** One line under the title saying where things stand ("1 needs a reply"). */
  status?: React.ReactNode
  statusTone?: DashStatusTone
  /** Small status chip shown in the title row (never its own line). */
  headerExtra?: React.ReactNode
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
  // How tall the empty-state placeholder floors out at. Defaults to Leads/Activity's own
  // ScrollableSection max-height (max-h-[430px]) so those two never visibly shrink when empty.
  // Follow-ups overrides this much smaller (see its own comment below) - its "full" state is
  // realistically a couple of short rows, not a scrolling list, so matching Leads/Activity's
  // floor left a mostly-empty box even when it had nothing due.
  emptyMinHeightClass?: string
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbf8f2] shadow-sm transition-shadow duration-300 hover:border-[#C9A24D]/40 hover:shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)] dark:border-gray-800 dark:from-[#141416] dark:to-[#121110] ${large ? 'p-4 sm:p-6' : 'p-3 sm:p-5'}`}>
      <DashCardHeader
        icon={Icon} title={title} href={viewHref} badgeCount={badgeCount} badgeExact={badgeExact} large={large}
        status={status} statusTone={statusTone} extra={headerExtra} viewHref={viewHref} viewLabel={viewLabel}
      />
      <div className="mt-3 min-w-0">
        {isEmpty ? (
          // Same min-height as the ScrollableSection it replaces (max-h-[430px] everywhere this
          // panel is used) - otherwise an empty panel collapses to just this placeholder's height
          // and the whole card visibly shrinks compared to its "full" size, throwing off the
          // two-column masonry layout it sits in.
          <div className={`flex min-w-0 items-center justify-center ${emptyMinHeightClass}`}>
            <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">{emptyLabel}</p>
          </div>
        ) : children}
      </div>
    </div>
  )
}
