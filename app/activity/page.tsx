'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity as ActivityIcon, ArrowUpDown, BellRing, Building2, CalendarClock, CalendarDays, CheckCheck, ClipboardList, DoorOpen, Footprints, Loader2, Mail,
  MessageSquareText, Search, Settings2, Star, Users, X,
} from 'lucide-react'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import LuxeSelect from '@/components/ui/LuxeSelect'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import { Notification } from '@/types'
import LuxeHero, { LuxeTabs, luxePill } from '@/components/ui/LuxeHero'
import Pager from '@/components/ui/Pager'
import { AUTO_HIDE_WHEN_READ_TYPES, getNotificationMeta, visibleNotifications } from '@/lib/notificationDisplay'
import { formatDateTime } from '@/lib/relativeDays'

// The full-history counterpart to the bell dropdown (NotificationDropdown) - the bell only shows
// the 10 most recent (last 30 days), so this page is where everything else lives: grouped by kind
// and by day, searchable, filterable by date, paged, and "Load older" past the newest 300.
const BATCH = 300
const PAGE = 25

// One tab per kind of thing that happens - a tab only shows once it has something in it.
type Kind = 'all' | 'unread' | 'open_houses' | 'forms' | 'tours' | 'inquiries' | 'showcases' | 'emails' | 'followups' | 'reviews' | 'hosting' | 'account'
const KIND_TYPES: Record<Exclude<Kind, 'all' | 'unread' | 'account'>, string[]> = {
  open_houses: ['OPEN_HOUSE_SIGN_IN', 'OPEN_HOUSE_SECOND_VISIT', 'OPEN_HOUSE_DISCLOSURE', 'OPEN_HOUSE_FORM_REQUEST'],
  forms: ['FORM_SUBMISSION'],
  tours: ['TOUR_REQUEST'],
  inquiries: ['PROPERTY_INQUIRY', 'PORTAL_LEAD', 'LEAD'],
  showcases: ['PROPERTY_INTERACTION', 'PROPERTY_COMMENT', 'REFINE_SEARCH_REQUEST', 'SHOWCASE_SEARCH_CHANGED', 'SHOWCASE_DIGEST', 'PROPERTY_SYNC_UPDATE'],
  emails: ['EMAIL_ACTIVITY', 'EMAIL_STATUS', 'MAILBOX_DISCONNECTED'],
  followups: ['TASK_REMINDER'],
  reviews: ['NEW_REVIEW'],
  hosting: ['HOST_REQUEST_RECEIVED', 'HOST_REQUEST_APPROVED', 'HOST_REQUEST_DECLINED', 'HOST_REQUEST_COUNTERED', 'HOST_REQUEST_COUNTER_RESPONSE',
    'DIRECT_HOST_REQUEST_RECEIVED', 'TEAM_BROADCAST_RECEIVED', 'TEAM_BROADCAST_RESPONSE', 'TEAM_BROADCAST_CLAIMED', 'TEAM_INVITE_RECEIVED',
    'TEAM_INVITE_ACCEPTED', 'TEAM_INVITE_DECLINED', 'TEAM_NEW_LISTING'],
}
function kindOf(type: string): Kind {
  for (const [k, types] of Object.entries(KIND_TYPES)) if (types.includes(type)) return k as Kind
  return 'account'
}
const KINDS: { id: Kind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: ActivityIcon },
  { id: 'unread', label: 'Unread', icon: BellRing },
  { id: 'open_houses', label: 'Opens', icon: DoorOpen },
  { id: 'forms', label: 'Forms', icon: ClipboardList },
  { id: 'tours', label: 'Tours', icon: Footprints },
  { id: 'inquiries', label: 'Questions', icon: MessageSquareText },
  { id: 'showcases', label: 'Showcases', icon: Building2 },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'followups', label: 'Follow-ups', icon: CalendarClock },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'hosting', label: 'Hosting', icon: Users },
  { id: 'account', label: 'Account', icon: Settings2 },
]

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 864e5)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

export default function ActivityPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [olderBusy, setOlderBusy] = useState(false)
  const [mayHaveOlder, setMayHaveOlder] = useState(false)

  const [kind, setKind] = useState<Kind>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) router.replace('/')
  }, [isCheckingAuth, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    api.notifications.getAll(false).then(({ success, data }) => {
      if (success && data) { setNotifications(data); setMayHaveOlder(data.length >= BATCH) }
      setLoading(false)
    })
  }, [isAuthenticated])

  const loadOlder = async () => {
    setOlderBusy(true)
    const { success, data } = await api.notifications.getAll(false, undefined, notifications.length)
    if (success && data) {
      setNotifications(prev => {
        const seen = new Set(prev.map(n => n.id))
        return [...prev, ...data.filter(n => !seen.has(n.id))]
      })
      setMayHaveOlder(data.length >= BATCH)
    }
    setOlderBusy(false)
  }

  // Viewing this page is itself a "seen it" moment for AI Video alerts (see lib/notificationDisplay.tsx)
  // - mark any unread ones read in the background so they drop out of the list (and the bell).
  useEffect(() => {
    const hasUnseenAutoHide = notifications.some(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) && !n.isRead)
    if (!hasUnseenAutoHide) return
    api.notifications.markTypesAsRead(Array.from(AUTO_HIDE_WHEN_READ_TYPES)).then(() => {
      setNotifications(prev => prev.map(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) ? { ...n, isRead: true } : n))
    })
  }, [notifications])

  const visible = useMemo(() => visibleNotifications(notifications), [notifications])

  const open = (n: Notification) => {
    if (!n.isRead) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
      api.notifications.markAsRead(n.id)
    }
    if (!n.link) return
    // On a computer it opens in a new tab so the list stays put; on a phone, right here.
    const external = /^https?:\/\//.test(n.link)
    if (external || window.innerWidth >= 640) window.open(n.link, '_blank', 'noopener,noreferrer')
    else router.push(n.link)
  }

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    await api.notifications.markAllAsRead()
  }

  // Liked and disliked both come back as PROPERTY_INTERACTION (told apart by the message's
  // "Liked "/"Disliked " prefix), and email opens vs clicks share EMAIL_ACTIVITY - split them so
  // the type filter can tell them apart.
  const filterKeyFor = (n: Notification): string => {
    const meta = getNotificationMeta(n.type, n.message, n.title)
    return `${n.type}|${meta.label}`
  }

  const inKind = (n: Notification, k: Kind) => k === 'all' || (k === 'unread' ? !n.isRead : kindOf(n.type) === k)
  const counts = useMemo(() => {
    const c = {} as Record<Kind, number>
    for (const k of KINDS) c[k.id] = visible.filter(n => inKind(n, k.id)).length
    return c
  }, [visible])

  const availableTypes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const n of visible) {
      if (!inKind(n, kind)) continue
      const key = filterKeyFor(n)
      if (!seen.has(key)) seen.set(key, getNotificationMeta(n.type, n.message, n.title).label)
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [visible, kind])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null
    let result = visible.filter(n => {
      if (!inKind(n, kind)) return false
      if (typeFilter !== 'all' && filterKeyFor(n) !== typeFilter) return false
      if (term) {
        const haystack = `${n.visitorName || ''} ${n.title || ''} ${n.message || ''} ${n.propertyAddress || ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      const t = new Date(n.timestamp).getTime()
      if (fromTime !== null && t < fromTime) return false
      if (toTime !== null && t > toTime) return false
      return true
    })
    if (sortOrder === 'oldest') result = [...result].reverse()
    return result
  }, [visible, kind, search, typeFilter, dateFrom, dateTo, sortOrder])

  useEffect(() => { setPage(1) }, [kind, search, typeFilter, dateFrom, dateTo, sortOrder])
  useEffect(() => { setTypeFilter('all') }, [kind])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const curPage = Math.min(page, pages)
  const pageItems = filtered.slice((curPage - 1) * PAGE, curPage * PAGE)
  const groups = useMemo(() => {
    const out: { day: string; items: Notification[] }[] = []
    for (const n of pageItems) {
      const day = dayLabel(n.timestamp)
      if (out.length && out[out.length - 1].day === day) out[out.length - 1].items.push(n)
      else out.push({ day, items: [n] })
    }
    return out
  }, [pageItems])

  const unread = counts.unread || 0
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const today = visible.filter(n => new Date(n.timestamp) >= startOfToday).length
  const week = visible.filter(n => Date.now() - new Date(n.timestamp).getTime() < 7 * 864e5).length
  const hasFilters = Boolean(search || typeFilter !== 'all' || dateFrom || dateTo)
  const clearFilters = () => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo('') }

  if (isCheckingAuth || !isAuthenticated) return <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" />

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-6">
        <LuxeHero
          compact
          kicker="Activity"
          icon={ActivityIcon}
          backHref="/dash"
          backLabel="Dashboard"
          title={<>Everything, <em>as it happens.</em></>}
          subtitle="Every sign-in, request, like, comment, email open and hosting update across your account."
          titleClassName="text-[1.7rem] sm:text-4xl lg:whitespace-nowrap"
          asideClassName="w-full lg:w-[330px] lg:-mt-1"
          aside={
            <div className="flex w-full flex-col items-stretch gap-2">
              {/* The numbers - small, one line. Unread jumps to the Unread tab. */}
              <div className="flex w-full items-center gap-1.5 rounded-full border border-[#C9A24D]/25 bg-white/70 px-1.5 py-1 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
                <button type="button" onClick={() => setKind('unread')} title="See what you haven't read"
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-[#C9A24D]/10 ${unread > 0 ? 'text-[#8b7355] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>
                  <span className="font-serif text-base font-black leading-none tabular-nums"><AnimatedNumber value={unread} duration={600} /></span>
                  <span className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50">Unread</span>
                </button>
                <span aria-hidden className="h-4 w-px shrink-0 bg-[#C9A24D]/30 dark:bg-white/10" />
                <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[#111827] dark:text-white">
                  <span className="font-serif text-base font-black leading-none tabular-nums"><AnimatedNumber value={today} duration={600} /></span>
                  <span className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50">Today</span>
                </span>
                <span aria-hidden className="h-4 w-px shrink-0 bg-[#C9A24D]/30 dark:bg-white/10" />
                <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[#111827] dark:text-white">
                  <span className="font-serif text-base font-black leading-none tabular-nums"><AnimatedNumber value={week} duration={600} /></span>
                  <span className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50">This week</span>
                </span>
              </div>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className={`${luxePill()} justify-center self-center lg:self-end`}>
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
          }
          tabs={
            <LuxeTabs dense label="Activity kind" active={kind} onChange={setKind}
              items={KINDS.filter(k => k.id === 'all' || k.id === 'unread' || counts[k.id] > 0).map(k => ({ id: k.id, label: `${k.label} ${counts[k.id] ?? 0}`, icon: k.icon }))} />
          }
        />

        {!loading && visible.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-white/[0.08] dark:bg-[#151517]">
            <label className="relative min-w-[180px] flex-[2]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, address or keyword"
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f7] py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-[#C9A24D] focus:bg-white dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
            <LuxeSelect<string>
              className="min-w-[170px] flex-1 sm:flex-none [&_ul]:max-h-[320px] [&_ul]:!overflow-y-auto"
              ariaLabel="Type"
              value={typeFilter}
              placeholderValue="all"
              onChange={setTypeFilter}
              menuWidth={240}
              options={[{ value: 'all', label: 'Every type' }, ...availableTypes.map(([key, label]) => ({ value: key, label }))]}
            />
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined} aria-label="From date"
                className="w-[8.6rem] rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              <span className="text-xs font-bold text-gray-400">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined} aria-label="To date"
                className="w-[8.6rem] rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </div>
            <button type="button" onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-2.5 py-2 text-xs font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">
              <ArrowUpDown className="h-3.5 w-3.5" /> {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-black text-gray-400 hover:text-rose-500"><X className="h-3.5 w-3.5" /> Clear</button>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-16 flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading activity...</div>
        )}

        {!loading && visible.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-white/10">
            <ActivityIcon className="mx-auto h-6 w-6 text-[#C9A24D]" />
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-gray-500 dark:text-gray-400">
              Nothing yet. Sign-ins, form answers, Showcase likes and comments, email opens and hosting requests all show up here the moment they happen.
            </p>
          </div>
        )}

        {!loading && visible.length > 0 && filtered.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm font-bold text-gray-400 dark:border-gray-700">
            {kind === 'unread' && !hasFilters ? 'You’re all caught up.' : 'Nothing matches.'}
            {hasFilters && <button onClick={clearFilters} className="ml-1.5 text-[#C9A24D] hover:underline">Clear filters</button>}
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div className="mt-4 space-y-4">
            {groups.map(g => (
              <section key={g.day + g.items[0].id}>
                <h2 className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{g.day}</h2>
                <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/[0.06] dark:border-white/10 dark:bg-[#151517]">
                  {g.items.map(n => {
                    const { icon: Icon, label, className } = getNotificationMeta(n.type, n.message, n.title)
                    return (
                      <button key={n.id} type="button" onClick={() => open(n)} data-testid="activity-row" data-type={n.type}
                        className={`flex w-full min-w-0 items-start gap-3 p-3.5 text-left transition hover:bg-[#faf9f7] dark:hover:bg-white/[0.03] sm:p-4 ${n.isRead ? '' : 'bg-[#C9A24D]/[0.05]'}`}>
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${className}`}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className={`min-w-0 flex-1 text-[13.5px] leading-snug text-[#111827] dark:text-white ${n.isRead ? 'font-bold' : 'font-black'}`}>{n.title}</p>
                            {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#C9A24D]" aria-label="Unread" />}
                          </div>
                          {n.message && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{n.message}</p>}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-bold text-gray-400">
                            <span className={`rounded-full border px-1.5 py-px text-[9.5px] font-black uppercase tracking-wide ${className}`}>{label}</span>
                            {n.propertyAddress && <span className="truncate">{n.propertyAddress}</span>}
                            <span className="whitespace-nowrap">{formatDateTime(n.timestamp)}</span>
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            <Pager page={curPage} pages={pages} onChange={setPage} prevLabel="Newer" nextLabel="Older" />
          </div>
        )}

        {!loading && mayHaveOlder && (curPage === pages) && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={loadOlder} disabled={olderBusy} className={luxePill()}>
              {olderBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5" />} Load older activity
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
