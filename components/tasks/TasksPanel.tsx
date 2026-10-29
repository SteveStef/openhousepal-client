'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  Phone, CheckSquare, Check, Plus,
  Clock, AlertTriangle, ChevronDown, CalendarClock, CalendarCheck, Loader2, X, ArrowRight, Plug,
  CheckCircle2, Sparkles,
} from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import type { AgentTask, LeadEvent, TaskBucket, TaskKind } from '@/types'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import OhpLoader from '@/components/brand/OhpLoader'
import FollowupCard from './FollowupCard'
import { AnimatePresence, motion } from 'framer-motion'
import { WhenSheet, addDays, nextWeekday, whenText, ymd } from '@/components/ui/WhenPicker'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

const DASH_ROWS_KEY = 'dash:followupRows'
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus'

const KIND_LABEL: Record<TaskKind, string> = {
  call: 'Call', text: 'Text', email: 'Email', showing: 'Showing', general: 'To-do',
}
const BUCKET_META: { id: Exclude<TaskBucket, 'done'>; label: string; tone: string }[] = [
  { id: 'overdue', label: 'Overdue', tone: 'text-red-600 dark:text-red-400' },
  { id: 'today', label: 'Today', tone: 'text-[#C9A24D]' },
  { id: 'upcoming', label: 'Upcoming', tone: 'text-gray-500 dark:text-gray-400' },
  { id: 'someday', label: 'Someday', tone: 'text-gray-400' },
]

const isToday = (iso?: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Connected = just an icon with a small green check + the provider name (no pill, no extra
 * text); not connected = an amber warning pill linking to where it's fixed. Built to sit on the
 * same line as a page / panel title - never its own row. */
export function ConnectionStatus({ connected, icon: Icon, name, warning, href, title }: {
  connected: boolean
  icon: typeof Phone
  name: string
  warning: string
  href: string
  title?: string
}) {
  if (connected) {
    return (
      <Link href={href} title={title} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-bold text-gray-500 transition hover:text-[#111827] dark:text-gray-400 dark:hover:text-white">
        <span className="relative inline-flex">
          <Icon className="h-4 w-4" />
          <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#151517]">
            <Check className="h-2 w-2 text-white" strokeWidth={4} />
          </span>
        </span>
        <span className="ml-0.5">{name}</span>
      </Link>
    )
  }
  return (
    <Link href={href} title={title} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800 transition hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle className="h-3 w-3" /> {warning}
    </Link>
  )
}

export function CalendarChip() {
  const { loaded, calendarConnected, calendarProvider, calendarLabel, calendarNeedsReconnect } = useIntegrationStatus()
  if (!loaded) return null
  return (
    <ConnectionStatus
      connected={calendarConnected && !calendarNeedsReconnect}
      icon={CalendarClock}
      name={calendarProvider}
      warning={calendarNeedsReconnect ? 'Reconnect calendar' : 'Connect calendar'}
      href="/studio/calendar"
      title={calendarConnected ? `Follow-ups sync to your ${calendarLabel} automatically` : 'Follow-ups only reach your phone once a calendar is connected'}
    />
  )
}

// Leads header button - same shape as the Follow-ups button beside it: red while no CRM is
// connected, green with gold once leads are flowing to one.
export function CrmChip({ large = false, className = '' }: { large?: boolean; className?: string } = {}) {
  const { loaded, crmConnected, crmLabel } = useIntegrationStatus()
  if (!loaded) return null
  return (
    <Link
      href="/studio/integrations"
      title={crmConnected ? 'New leads are sent to your CRM automatically' : 'Send every new lead straight to Follow Up Boss, Lofty, kvCORE…'}
      className={`group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl font-black shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110 active:translate-y-0 ${large ? 'justify-center px-4 py-2.5 text-[13px]' : 'px-3.5 py-2 text-xs'} ${className} ${crmConnected
        ? 'bg-gradient-to-r from-emerald-700 to-emerald-500 text-white shadow-emerald-600/30 ring-1 ring-inset ring-[#e8c97a]/70'
        : 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/30'}`}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {crmConnected
        ? <span className="relative grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#f1d58b] text-emerald-900"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
        : <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>}
      <Plug className={`relative h-3.5 w-3.5 ${crmConnected ? 'text-[#f1d58b]' : ''}`} />
      <span className="relative">{crmConnected ? `${crmLabel} connected` : 'Connect CRM'}</span>
      <ArrowRight className="relative -ml-1 h-3 w-0 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:w-3 group-hover:opacity-100" />
    </Link>
  )
}

/** One line under the follow-ups: where they're syncing, or a warning + link when no calendar is
 * connected (follow-ups only reach the agent's phone once one is). */
export function CalendarStatusLine({ className = '' }: { className?: string }) {
  const { loaded, calendarConnected, calendarLabel, calendarNeedsReconnect } = useIntegrationStatus()
  if (!loaded) return null
  if (calendarConnected && !calendarNeedsReconnect) {
    return (
      <p className={`flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 ${className}`}>
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Follow-ups sync to your {calendarLabel} automatically.
      </p>
    )
  }
  return (
    <Link
      href="/studio/calendar"
      className={`flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800 transition hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {calendarNeedsReconnect
          ? 'Your calendar stopped syncing - reconnect it so follow-ups keep reaching your phone.'
          : "Your calendar isn't connected - follow-ups won't show up on your phone until it is."}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-black">{calendarNeedsReconnect ? 'Reconnect' : 'Connect'} <ArrowRight className="h-3 w-3" /></span>
    </Link>
  )
}

export default function TasksPanel({
  leadId,
  leadName,
  compact = false,
  onCountChange,
  showCalendarStatus = false,
  composerOpen,
  onComposerClose,
  singleColumn = false,
  onChanged,
  className = '',
  focusTaskId,
  events,
}: {
  /** Scope to a single lead + prefill new tasks with it. */
  leadId?: string
  leadName?: string | null
  /** Dashboard widget mode: overdue + today only (plus what was checked off today), no composer. */
  compact?: boolean
  onCountChange?: (openCount: number) => void
  /** Show the calendar connected / not-connected line under the list. */
  showCalendarStatus?: boolean
  /** Set when the page puts its own "Add" button in the header: the composer opens from there
   * and the dashed "Add a follow-up" bar isn't shown. */
  composerOpen?: boolean
  onComposerClose?: () => void
  /** One card per row - for narrow spots like a lead's own view. */
  singleColumn?: boolean
  /** Fired after a follow-up here is added, checked off, reopened, snoozed or deleted (a lead's
   * view refreshes - checking one off marks the lead contacted). */
  onChanged?: () => void
  className?: string
  /** Opened from a notification about one follow-up: scroll to it and glow it gold. */
  focusTaskId?: string | null
  /** The lead's activity (their own page) - suggests a follow-up from the latest thing they did. */
  events?: LeadEvent[]
}) {
  const { user } = useAuth()
  const changedRef = useRef(onChanged)
  changedRef.current = onChanged
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showOlderDone, setShowOlderDone] = useState(false)
  const [doneShown, setDoneShown] = useState(12)
  // Checked off during this visit - kept in place (checked) until the page is left.
  const [justDone, setJustDone] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  // Dash: one row of three cards, or two - the agent's choice, remembered on this device.
  const [dashRows, setDashRows] = useState<1 | 2>(1)
  useEffect(() => {
    if (!compact) return
    try { if (localStorage.getItem(DASH_ROWS_KEY) === '2') setDashRows(2) } catch { /* private mode */ }
  }, [compact])
  const toggleDashRows = () => setDashRows(r => {
    const next = r === 1 ? 2 : 1
    try { localStorage.setItem(DASH_ROWS_KEY, String(next)) } catch { /* private mode */ }
    return next
  })

  // Completed ones are always fetched: anything checked off TODAY stays on the list (checked,
  // moved to the bottom) so an accidental click is easy to see and undo; older ones sit behind
  // "Show older completed" on the full page.
  const load = useCallback(async () => {
    const res = await api.tasks.list({ leadId, includeDone: true })
    if (res.success && res.data) {
      setTasks(res.data)
      onCountChange?.(res.data.filter(t => !t.completed_at).length)
    }
    setLoading(false)
  }, [leadId, onCountChange])

  useEffect(() => { load() }, [load])

  const patch = async (id: string, body: Parameters<typeof api.tasks.update>[1]) => {
    setBusyId(id)
    const res = await api.tasks.update(id, body)
    if (res.success) await load()
    setBusyId(null)
    changedRef.current?.()
  }

  const remove = async (id: string) => {
    setBusyId(id)
    await api.tasks.remove(id)
    await load()
    setBusyId(null)
    changedRef.current?.()
  }

  const snooze = (t: AgentTask, days: number) => {
    const base = t.due_at ? new Date(t.due_at) : new Date()
    if (!t.due_at) base.setHours(9, 0, 0, 0)
    // The choices read "Tomorrow" / "In 3 days" / "Next week" - counted from today at the same
    // time of day, never from the old date (4 days late + "Tomorrow" used to land 3 days ago,
    // where its reminder fired again at once).
    const now = new Date()
    base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
    base.setDate(base.getDate() + days)
    patch(t.id, { due_at: base.toISOString(), remind_at: base.toISOString() })
  }
  // "Pick a day…": that date, same time of day (9am if it had none).
  const pickDay = (t: AgentTask, ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    const base = t.due_at ? new Date(t.due_at) : new Date()
    if (!t.due_at) base.setHours(9, 0, 0, 0)
    base.setFullYear(y, m - 1, d)
    patch(t.id, { due_at: base.toISOString(), remind_at: base.toISOString() })
  }

  const grouped = useMemo(() => {
    const g: Record<string, AgentTask[]> = { overdue: [], today: [], upcoming: [], someday: [], done: [] }
    for (const t of tasks) (g[t.bucket] ||= []).push(t)
    return g
  }, [tasks])

  // A checked-off one sits in the folded "completed" list - unfold it so the card can be shown.
  const focusIsOlderDone = !!focusTaskId && grouped.done.some(t => t.id === focusTaskId && !justDone.has(t.id))
  useEffect(() => { if (focusIsOlderDone) { setShowOlderDone(true); setDoneShown(n => Math.max(n, 200)) } }, [focusIsOlderDone])
  const scrolledToFocus = useRef(false)
  useEffect(() => {
    if (!focusTaskId || loading || scrolledToFocus.current) return
    const el = document.getElementById(`followup-${focusTaskId}`)
    if (!el) return
    scrolledToFocus.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  const justDoneTasks = grouped.done.filter(t => justDone.has(t.id))
  const olderDone = grouped.done.filter(t => !justDone.has(t.id))
  const doneTodayCount = grouped.done.filter(t => isToday(t.completed_at)).length
  const openCount = tasks.filter(t => !t.completed_at).length
  // Dash only: overdue follow-ups more than a week past due go to the back of the line, after
  // what's due today, so a backlog never buries today. They still show (and count) - dropping them
  // left the widget saying "Nothing due" under a header that said "8 due".
  const weekAgo = Date.now() - 7 * 864e5
  const staleOverdue = grouped.overdue.filter(t => t.due_at && new Date(t.due_at).getTime() < weekAgo)
  const compactOpen = [...grouped.overdue.filter(t => !staleOverdue.includes(t)), ...grouped.today, ...staleOverdue]

  const renderCard = (t: AgentTask) => {
    const done = !!t.completed_at
    return (
      <div key={t.id} id={`followup-${t.id}`} className={`h-full rounded-2xl transition-shadow duration-700 ${focusTaskId === t.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-[#faf9f7] dark:ring-offset-[#0B0B0B]' : ''}`}>
      <FollowupCard
        t={t}
        busy={busyId === t.id}
        // Not when this list is already scoped to one lead (it's shown on that lead's own profile).
        clickable={!!t.lead_id && !leadId}
        onOpenLead={() => setOpenLeadId(t.lead_id!)}
        onToggleDone={() => {
          setJustDone(prev => { const next = new Set(prev); if (done) next.delete(t.id); else next.add(t.id); return next })
          if (done) api.tasks.reopen(t.id).then(load).then(() => changedRef.current?.()); else patch(t.id, { completed: true })
        }}
        onSnooze={days => snooze(t, days)}
        onPickDay={ymd => pickDay(t, ymd)}
        onDelete={() => remove(t.id)}
      />
      </div>
    )
  }

  // Three to a row - the full card, same on the Dash as on the Follow-ups page.
  const GRID = singleColumn ? 'grid grid-cols-1 gap-3'
    : compact ? 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3' : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
  // Dash: what needs attention first; anything just checked off goes to the back of the line, so
  // the next open one slides into its spot (and a checked card only shows when there's room).
  const dashQueue = [...compactOpen, ...justDoneTasks]
  const dashVisible = dashQueue.slice(0, dashRows * 3)
  const dashHiddenOpen = Math.max(0, compactOpen.length - dashVisible.filter(t => !t.completed_at).length)
  const nothingOpen = compact ? compactOpen.length === 0 : openCount === 0

  return (
    <div className={className}>
      {!compact && leadId && events && !loading && (
        <SuggestedFollowups leadId={leadId} onAdded={() => { load(); changedRef.current?.() }}
          items={suggestFollowups(events, leadName, tasks.filter(t => !t.completed_at).map(t => t.title), likesCoveredUntil(tasks), tasks, (user?.first_name || '').trim())} />
      )}
      {!compact && (composerOpen === undefined
        ? <QuickAdd leadId={leadId} leadName={leadName} onAdded={() => { load(); changedRef.current?.() }} />
        : composerOpen && <QuickAdd leadId={leadId} leadName={leadName} onAdded={() => { load(); changedRef.current?.() }} startOpen onClose={onComposerClose} />)}

      {loading ? (
        // The same OpenHousePal loader as every other page (no blur - it lags).
        <OhpLoader fullScreen={false} label="Loading follow-ups" className={compact ? '!py-6' : '!py-12'} />
      ) : (
        <div className="space-y-4">
          {nothingOpen && compact && (
            <div className={`rounded-xl border border-dashed border-gray-200 text-center dark:border-gray-700 ${compact ? 'py-5' : 'py-8'}`}>
              <CheckSquare className="mx-auto h-6 w-6 text-gray-300" />
              <p className="mt-2 text-sm font-bold text-gray-400">
                {compact ? "Nothing due - you're clear." : leadId ? 'No follow-ups for this lead yet.' : "You're all caught up."}
              </p>
            </div>
          )}

          {compact ? (
            // Dash: one flat list - each card already says "Today" / "Overdue", so no separate
            // "TODAY 1" header line eating vertical space above it.
            <>
              {dashVisible.length > 0 && (
                <motion.div layout className={GRID}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {dashVisible.map(t => (
                      <motion.div key={t.id} layout className="h-full"
                        initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
                        {renderCard(t)}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              {/* Checked off and moved behind the open ones - one tap to bring it back. */}
              {(() => {
                const hidden = justDoneTasks.filter(t => !dashVisible.includes(t))
                if (!hidden.length) return null
                const lastId = Array.from(justDone).reverse().find(id => hidden.some(t => t.id === id))
                const last = hidden.find(t => t.id === lastId) || hidden[hidden.length - 1]
                const who = (last.lead?.name || last.title).replace(/\s*\(test\)\s*$/i, '')
                return (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12px] font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07] dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      Checked off {who}{hidden.length > 1 ? ` + ${hidden.length - 1} more` : ''}
                    </span>
                    <button type="button" disabled={busyId === last.id}
                      onClick={() => { setJustDone(prev => { const next = new Set(prev); next.delete(last.id); return next }); api.tasks.reopen(last.id).then(load) }}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
                      Undo
                    </button>
                  </div>
                )
              })()}
              {(dashQueue.length > 3 || dashHiddenOpen > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {dashQueue.length > 3 ? (
                    <button type="button" onClick={toggleDashRows}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600 shadow-sm transition hover:border-[#C9A24D]/50 hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:text-[#d7b974]">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dashRows === 2 ? 'rotate-180' : ''}`} />
                      {dashRows === 2 ? 'Show 1 row' : 'Show 2 rows'}
                    </button>
                  ) : <span />}
                  {dashHiddenOpen > 0 && (
                    <Link href="/leads/tasks" className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-[#8b7355] dark:hover:text-[#d7b974]">
                      +{dashHiddenOpen} more on your Follow-ups page <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            BUCKET_META.map(b => {
              const items = grouped[b.id]
              if (!items?.length) return null
              return (
                <div key={b.id}>
                  <p className={`mb-1.5 text-[11px] font-black uppercase tracking-widest ${b.tone}`}>
                    {b.label} <span className="text-gray-300 dark:text-gray-600">{items.length}</span>
                  </p>
                  <div className={GRID}>{items.map(t => renderCard(t))}</div>
                </div>
              )
            })
          )}

          {/* Just checked off (this visit) - stays right here, checked, so an accidental click is
              obvious and one click to undo. */}
          {!compact && justDoneTasks.length > 0 && <div className={GRID}>{justDoneTasks.map(t => renderCard(t))}</div>}

          {/* Everything else completed collapses into ONE bar - never a wall of checked cards.
              Opens 12 at a time. The Dash widget doesn't show it at all. */}
          {/* With nothing open, "all caught up" and Completed are ONE slim bar (not a big empty
              box plus a second bar); with follow-ups due, Completed sits under them as before. */}
          {!compact && (grouped.done.length > 0 || nothingOpen) && (
            <div className={`rounded-xl border ${nothingOpen ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'}`}>
              <button
                onClick={() => { if (olderDone.length) { setShowOlderDone(v => !v); setDoneShown(12) } }}
                className={`flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left ${olderDone.length ? '' : 'cursor-default'}`}
              >
                {nothingOpen ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[12px] font-black text-emerald-800 dark:text-emerald-300">
                      {leadId ? 'No open follow-ups for this lead' : "You're all caught up"}
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Completed</span>
                  </>
                )}
                {/* Counts include what was just checked off on this visit (those cards stay in
                    place above for an easy undo), so the numbers move the moment you check one. */}
                {grouped.done.length > 0 && (
                  <span className="text-[11px] font-bold tabular-nums text-gray-400">
                    {doneTodayCount > 0 && `${doneTodayCount} done today · `}{grouped.done.length} completed in the last 2 weeks
                  </span>
                )}
                {olderDone.length > 0 && <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition ${showOlderDone ? 'rotate-180' : ''}`} />}
              </button>
              {showOlderDone && (
                <div className="border-t border-gray-100 p-2 dark:border-gray-800">
                  <div className={GRID}>{olderDone.slice(0, doneShown).map(t => renderCard(t))}</div>
                  {olderDone.length > doneShown ? (
                    <button onClick={() => setDoneShown(n => n + 12)} className="mt-2 w-full text-center text-[11px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
                      Show {Math.min(12, olderDone.length - doneShown)} more
                    </button>
                  ) : (
                    <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">Completed follow-ups clear out on their own after a while.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCalendarStatus && !loading && <CalendarStatusLine className="mt-3" />}

      {/* Portaled to <body> - this panel sits inside framer-motion (transformed) wrappers on the
          Dash, which would otherwise pin the fixed overlay to the panel instead of the screen. */}
      {openLeadId && typeof document !== 'undefined' && createPortal(
        <LeadDetailModal leadId={openLeadId} onClose={() => { setOpenLeadId(null); load() }} onChanged={load} />,
        document.body,
      )}
    </div>
  )
}

function QuickAdd({ leadId, leadName, onAdded, startOpen = false, onClose }: {
  leadId?: string; leadName?: string | null; onAdded: () => void
  /** Opened from a button elsewhere (the page header) - closing hands control back. */
  startOpen?: boolean; onClose?: () => void
}) {
  const [open, setOpenState] = useState(startOpen)
  const setOpen = (v: boolean) => { setOpenState(v); if (!v) onClose?.() }
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('call')
  const [priority, setPriority] = useState<'normal' | 'high'>('normal')
  const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'custom' | 'none'>('tomorrow')
  const [custom, setCustom] = useState('')  // yyyy-mm-dd
  const [time, setTime] = useState('')      // HH:MM, empty = any time that day (all-day event)
  const [saving, setSaving] = useState(false)
  const [whenOpen, setWhenOpen] = useState(false)
  // Phones: "Add a follow-up" opens a slide-up window with everything in it right away (owner,
  // 10/26 - it used to open in the page, and the slide-up only came with "Add a time").
  const phone = useIsPhone()

  // The chosen day (local), or null for Someday.
  const pickedDay = (): Date | null => {
    if (dateMode === 'none') return null
    if (dateMode === 'custom') {
      if (!custom) return null
      const [y, m, d] = custom.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    const d = new Date(); d.setHours(0, 0, 0, 0)
    if (dateMode === 'tomorrow') d.setDate(d.getDate() + 1)
    return d
  }
  const at = (day: Date, h: number, m: number) => { const d = new Date(day); d.setHours(h, m, 0, 0); return d }
  const day = pickedDay()
  const [hh, mm] = time ? time.split(':').map(Number) : [NaN, NaN]
  const timePassed = !!(day && time && at(day, hh, mm).getTime() < Date.now())

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    // A time = a timed event that buzzes the phone (per the alert settings below). No time = an
    // all-day item for that day - it never shows as "overdue" at some made-up hour.
    let due: string | null = null, remind: string | null = null, allDay = false
    if (day && time) {
      due = remind = at(day, hh, mm).toISOString()
    } else if (day) {
      allDay = true
      due = at(day, 12, 0).toISOString()
      remind = new Date(Math.max(at(day, 9, 0).getTime(), Date.now())).toISOString()
    }
    const res = await api.tasks.create({
      title: title.trim(), kind, priority, due_at: due, remind_at: remind, all_day: allDay,
      lead_id: leadId ?? null,
    })
    setSaving(false)
    if (res.success) {
      setTitle(''); setKind('call'); setPriority('normal'); setDateMode('tomorrow'); setCustom(''); setTime('')
      setOpen(false)
      onAdded()
    }
  }

  const closedButton = (
      <button
        onClick={() => setOpen(true)}
        className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-sm font-bold text-gray-400 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700"
      >
        <Plus className="h-4 w-4" /> Add a follow-up{leadName ? ` for ${leadName}` : ''}
      </button>
  )
  if (!open && !phone) return closedButton

  const body = (
    <>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
          placeholder="What needs doing?"
          className={`min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white ${phone ? 'py-3 text-base' : 'py-2 text-sm'}`}
        />
        {!phone && <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(['call', 'text', 'email', 'showing', 'general'] as TaskKind[]).map(k => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition ${
              kind === k ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-200 text-gray-400 dark:border-gray-700'
            }`}>
            {KIND_LABEL[k]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <button onClick={() => setPriority(p => p === 'high' ? 'normal' : 'high')}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition ${
            priority === 'high' ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-400 dark:border-gray-700'
          }`}>
          <AlertTriangle className="h-3 w-3" /> High
        </button>
      </div>
      {/* When (user, 10/22): quick picks first, then the step-by-step picker for any other day
          and the time - same saved values as the old date / time boxes. */}
      <p className="mb-1.5 mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">When</p>
      <div className="flex flex-wrap gap-1.5">
        {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['custom', 'Pick a day…'], ['none', 'Someday']] as const).map(([m, label]) => (
          <motion.button key={m} type="button" whileTap={{ scale: 0.95 }} onClick={() => (m === 'custom' ? setWhenOpen(true) : setDateMode(m))}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12px] font-black uppercase tracking-wide transition ${
              dateMode === m ? 'bg-[#C9A24D] text-[#111827]' : 'border border-gray-200 text-gray-500 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-400'
            }`}>
            {m === 'custom' && <CalendarClock className="h-3.5 w-3.5" />}{label}
          </motion.button>
        ))}
      </div>
      {dateMode !== 'none' && day && (
        <div className="mt-2">
          <button type="button" onClick={() => setWhenOpen(true)}
            className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-[#FAFAF7] px-3 text-left transition hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]">
            <Clock className="h-4 w-4 shrink-0 text-[#C9A24D]" />
            <span className="min-w-0 flex-1 truncate text-sm font-black text-[#111827] dark:text-white">
              {whenText({ date: ymd(day), time: time || null, anytime: !time }, 'datetime', 'any time (all-day)')}
            </span>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">{time ? 'Change' : 'Add a time'}</span>
          </button>
          <p className={`mt-1 text-[11px] font-semibold ${timePassed ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
            {timePassed ? 'That time has already passed today' : time ? 'Buzzes your phone at that time' : 'No time = any time that day (all-day)'}
          </p>
        </div>
      )}
      <WhenSheet open={whenOpen} onClose={() => setWhenOpen(false)} mode="datetime" allowAnytime="Any time that day"
        title="When should we remind you?" kicker="Follow-up"
        context={title.trim() || 'Your new follow-up'} contextSub={leadName || null}
        value={day ? { date: ymd(day), time: time || null, anytime: !time } : null}
        suggestions={[
          { label: 'Today', date: addDays(0), anytime: true },
          { label: 'Tomorrow', date: addDays(1), anytime: true },
          { label: 'In 3 days', date: addDays(3), anytime: true },
          { label: 'Next Monday', date: nextWeekday(1), anytime: true },
        ]}
        suggestionsLabel="Quick picks - then add a time if you like"
        onDone={v => {
          if (!v.date) return
          const mode = v.date === addDays(0) ? 'today' : v.date === addDays(1) ? 'tomorrow' : 'custom'
          setDateMode(mode)
          setCustom(mode === 'custom' ? v.date : '')
          setTime(v.anytime ? '' : v.time || '')
          setWhenOpen(false)
        }} />
      <div className={phone ? 'mt-4' : 'mt-2 flex justify-end'}>
        <button onClick={submit} disabled={saving || !title.trim()}
          className={`inline-flex items-center justify-center gap-1.5 bg-[#C9A24D] font-black uppercase tracking-wide text-[#111827] transition hover:brightness-105 disabled:opacity-50 ${phone ? 'h-12 w-full rounded-2xl text-sm' : 'rounded-lg px-4 py-2 text-xs'}`}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {phone ? 'Add follow-up' : 'Add'}
        </button>
      </div>
    </>
  )
  if (phone) {
    return <>{closedButton}<ComposerSheet open={open} onClose={() => setOpen(false)} leadName={leadName}>{body}</ComposerSheet></>
  }
  return <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-[#151517]">{body}</div>
}

function ComposerSheet({ open, onClose, leadName, children }: { open: boolean; onClose: () => void; leadName?: string | null; children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const release = usePagePin(open)
  if (!host) return null
  return createPortal(
    <AnimatePresence onExitComplete={() => release()}>
      {open && <ComposerWindow key="composer" onClose={onClose} leadName={leadName}>{children}</ComposerWindow>}
    </AnimatePresence>,
    host,
  )
}

function ComposerWindow({ onClose, leadName, children }: { onClose: () => void; leadName?: string | null; children: React.ReactNode }) {
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, true)
  useEscapeToClose(onClose)
  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[140] flex items-end bg-[#0b0b0c]/60">
      <motion.div ref={sheetRef} {...sheetMotion} style={{ y }} role="dialog" aria-modal="true" aria-label="New follow-up" data-testid="followup-composer"
        className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.5)] dark:bg-[#151517]">
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">New follow-up</p>
            <p className="truncate font-serif text-xl font-black text-[#111827] dark:text-white">{leadName ? `For ${leadName}` : 'Your follow-up'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ------------------------------------------------------------------------------------------------
// Suggested follow-ups (owner, 10/26): on a lead's page, one tap puts "call / text them" on
// tomorrow's calendar, based on the latest thing they did. The calendar event already carries
// their name, phone, email and a save-to-contacts link (calendar_sync_service), so the follow-up
// itself just says what happened.
type Suggestion = { key: string; kind: TaskKind; title: string; why: string; note: string; message?: string }

// Each suggestion's ready-to-send text (owner, 10/29), in the agent's voice and signed with their
// footer (the server adds it - `signed`). {showcase} = their Showcase link, put last. A home is
// named only when they brought it up themselves (visited, asked, commented) - never what they
// browsed. `covers`: the automatic follow-ups that already handle this situation with the agent's
// own message (tasks_service AUTO_FOLLOWUP_RULES) - when one exists, no second suggestion.
const hi = (f: string, me: string) => (me ? `Hi ${f}, it's ${me}!` : `Hi ${f}!`)
const ANSWER = '[ANSWER THEIR QUESTION]'  // tasks_service.FILL_IN_ANSWER - the card says to fill it in
type SuggestRule = {
  key: string; kind: TaskKind; title: (first: string, street: string) => string
  message?: (first: string, me: string, street: string) => string
  covers?: string[]
}
const SUGGEST: Partial<Record<LeadEvent['source_type'], SuggestRule>> = {
  // Its automatic follow-up (open house sign-in) has the agent's own message + Showcase - none here.
  open_house_visitor: { key: 'visit', kind: 'call', title: (f, s) => `Call ${f} - thanks for coming to ${s || 'the open house'}`,
    covers: ['open_house_signin', 'similar_homes_qr', 'open_house_noted'] },
  // A second visit REQUEST (they want another look), not a second sign-in.
  open_house_second_visit: { key: 'visit', kind: 'call', title: (f, s) => `Call ${f} - wants another look at ${s || 'the home'}`,
    message: (f, me, s) => `${hi(f, me)} Thanks for wanting another look at ${s || 'the home'}. Let me know if you have any questions or would like to set up a private tour.`,
    covers: ['second_visit_request', 'open_house_signin'] },
  open_house_disclosure: { key: 'disclosure', kind: 'call', title: (f, s) => `Call ${f} about the disclosures${s ? ` for ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} I just emailed you the seller disclosures for ${s || 'the home'}. Let me know if you have any questions once you've had a look.`,
    covers: ['disclosure_request', 'open_house_signin'] },
  property_tour: { key: 'tour', kind: 'call', title: (f, s) => `Set up ${f}'s showing${s ? ` of ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Got your request to see ${s || 'the home'} - what day and time work best for you? I'll get it set up.`,
    covers: ['showing_request'] },
  property_page_tour_request: { key: 'tour', kind: 'call', title: (f, s) => `Set up ${f}'s showing${s ? ` of ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Got your request to see ${s || 'the home'} - what day and time work best for you? I'll get it set up.`,
    covers: ['showing_request'] },
  property_website_tour_request: { key: 'tour', kind: 'call', title: (f, s) => `Set up ${f}'s showing${s ? ` of ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Got your request to see ${s || 'the home'} - what day and time work best for you? I'll get it set up.`,
    covers: ['showing_request'] },
  form_submission: { key: 'reply', kind: 'call', title: f => `Get back to ${f} about their form`,
    message: (f, me) => `${hi(f, me)} Thanks for filling out my form - I got your answers. When's a good time for a quick call to talk through what you're looking for?`,
    covers: ['form_submission', 'buyer_form', 'how_can_we_help', 'showcase_setup'] },
  property_website_inquiry: { key: 'reply', kind: 'call', title: (f, s) => `Answer ${f}'s question${s ? ` about ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Thanks for reaching out about ${s || 'the home'}. ${ANSWER} Happy to set up a time for you to see it, too.`,
    covers: ['listing_inquiry'] },
  property_page_inquiry: { key: 'reply', kind: 'call', title: (f, s) => `Answer ${f}'s question${s ? ` about ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Thanks for reaching out about ${s || 'the home'}. ${ANSWER} Happy to set up a time for you to see it, too.`,
    covers: ['listing_inquiry'] },
  blog_inquiry: { key: 'reply', kind: 'call', title: f => `Answer ${f}'s question`,
    message: (f, me) => `${hi(f, me)} Thanks for your question on my blog. ${ANSWER} Let me know if there's anything else I can help with.` },
  portal_lead: { key: 'reply', kind: 'call', title: f => `Call ${f} - new lead`,
    message: (f, me) => `${hi(f, me)} Thanks for reaching out - I'd love to help with your home search. When's a good time for a quick call?`,
    covers: ['listing_inquiry'] },
  property_comment: { key: 'comment', kind: 'text', title: (f, s) => `Answer ${f}'s comment${s ? ` on ${s}` : ''}`,
    message: (f, me, s) => `${hi(f, me)} Thanks for your note on ${s || 'that home'}. ${ANSWER}`,
    covers: ['showcase_comment'] },
  showcase_refine: { key: 'search', kind: 'text', title: f => `Check in with ${f} about their search`,
    message: (f, me) => `${hi(f, me)} Got your note about your search - I've updated your Showcase, so the new homes should be a better fit. Take a look and let me know what you think!\n\n{showcase}`,
    covers: ['showcase_search_request'] },
  showcase_search_changed: { key: 'search', kind: 'text', title: f => `Check in with ${f} about their new search`,
    message: (f, me) => `${hi(f, me)} Just checking in on your home search - let me know if you'd like me to fine-tune anything or set up some tours.\n\n{showcase}` },
  // email_clicked, showcase_view, showcase_like (+ showcase_dislike): see browseSuggestion below -
  // no message of their own; the server's check-in (tasks_service.checkin_message) is used.
  invite_rsvp: { key: 'rsvp', kind: 'text', title: f => `Thank ${f} for the RSVP`,
    message: (f, me) => `${hi(f, me)} Thanks for the RSVP - I really appreciate you letting me know. Reach out anytime if you have any questions.`,
    covers: ['invite_rsvp'] },
}

// "239 WINDHAM DR, WAYNE" (some listings come in all caps) -> "239 Windham Dr, Wayne"
const tidyAddress = (raw: string) => raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : raw
const streetOf = (address: string) => address.split(',')[0].trim()

// A sitting in their Showcase (owner, 10/27): email clicks, homes looked at, homes liked. The click
// row never says which link it was, but the Showcase logs the home they opened seconds later
// ("Looked at 795 Mancill Rd"), so clicks, views and likes each within BROWSE_GAP of the next are
// one sitting, and ONE follow-up names the home(s) from it:
//  - liked homes first ("Text Lori about 795 Mancill Rd - they liked it" / name 2-3 / "the 5 homes
//    they liked"), counting each home once and never one they've since passed on;
//  - else the homes they looked at ("... - they clicked through to look at it" when an email click
//    led there);
//  - else a click with no home seen keeps the generic "they clicked your email".
// A home already named by a newer sitting's suggestion isn't named again by an older one.
const BROWSE_TYPES = new Set<LeadEvent['source_type']>(['email_clicked', 'showcase_view', 'showcase_like', 'showcase_dislike'])
const BROWSE_GAP = 2 * 3600e3
const homeKey = (address: string) => streetOf(address).toLowerCase()
const joinList = (items: string[]) => items.length <= 1 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

type BrowsePick = { key: string; kind: TaskKind; title: string; did: string; homes: string[] }

function browseSuggestion(sitting: LeadEvent[], first: string, passedOn: Set<string>, named: Set<string>): BrowsePick | null {
  // Newest first; each home once.
  const liked: string[] = [], viewed: string[] = []
  let lastHomeAt = 0, hadHomes = false
  for (const x of sitting) {
    if ((x.source_type !== 'showcase_view' && x.source_type !== 'showcase_like') || !x.property_address) continue
    const home = tidyAddress(x.property_address.trim())
    const k = homeKey(home)
    hadHomes = true
    if (passedOn.has(k) || named.has(k)) continue
    lastHomeAt = Math.max(lastHomeAt, Date.parse(x.occurred_at))
    const into = x.source_type === 'showcase_like' ? liked : viewed
    if (!into.some(h => homeKey(h) === k)) into.push(home)
  }
  const lookedOnly = viewed.filter(h => !liked.some(l => homeKey(l) === homeKey(h)))
  const click = sitting.find(x => x.source_type === 'email_clicked')
  if (!liked.length && !lookedOnly.length) {
    // Every home in it was passed on or already suggested - nothing new to text about.
    if (!click || hadHomes) return null
    return { key: 'email', kind: 'text', title: `Check in with ${first} - they clicked your email`, did: click.summary, homes: [] }
  }
  // No message saved with these: the server writes a friendly check-in for a text follow-up that has
  // none (tasks_service.checkin_message) - the homes stay in the agent's notes, never in the text
  // (user, 10/29: it mustn't feel like the agent is watching).
  // "Clicked through" only when the click came first and a home was opened after it.
  const through = !!click && Date.parse(click.occurred_at) <= lastHomeAt
  const lead = through ? `${click!.summary}, then ` : ''
  const tail = click && !through ? `; also ${lowerFirst(click.summary)}` : ''
  // One home: street + town; several: every street.
  const list = (homes: string[]) => homes.length === 1 ? homes[0] : joinList(homes.map(streetOf))
  if (liked.length) {
    const streets = liked.map(streetOf)
    const title = liked.length === 1 ? `Text ${first} about ${streets[0]} - they liked it`
      : liked.length <= 3 ? `Text ${first} about ${joinList(streets)} - they liked ${liked.length === 2 ? 'both' : 'them'}`
        : `Text ${first} about the ${liked.length} homes they liked`
    const also = lookedOnly.length ? `; also looked at ${list(lookedOnly)}` : ''
    const did = `${lead}${lead ? 'liked' : 'Liked'} ${list(liked)}${lead ? '' : ' in their Showcase'}${also}${tail}`
    return { key: 'likes', kind: 'text', title, did, homes: [...liked, ...lookedOnly] }
  }
  const title = lookedOnly.length === 1
    ? `Text ${first} about ${streetOf(lookedOnly[0])} - ${through ? 'they clicked through to look at it' : 'they looked at it in their Showcase'}`
    : `Text ${first} about the ${lookedOnly.length} homes they looked at`
  const did = `${lead}${lead ? 'looked at' : 'Looked at'} ${list(lookedOnly)}${lead ? '' : ' in their Showcase'}${tail}`
  return { key: 'email', kind: 'text', title, did, homes: lookedOnly }
}

function happenedWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 864e5)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return days <= 0 ? `today ${time}` : days === 1 ? `yesterday ${time}` : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// The automatic "homes they liked" follow-up (tasks_service showcase_likes) already covers likes up to
// here: all of them while one is open, else those before the last one was checked off. Its own
// card says it all - no second, on-screen suggestion for the same likes.
function likesCoveredUntil(tasks: AgentTask[]): number {
  const cards = tasks.filter(t => t.auto_source === 'showcase_likes')
  if (cards.some(t => !t.completed_at)) return Infinity
  return Math.max(0, ...cards.map(t => Date.parse(t.completed_at || '') || 0))
}

export function suggestFollowups(events: LeadEvent[], name: string | null | undefined, openTitles: string[], likesCovered = 0,
  tasks: AgentTask[] = [], me = ''): Suggestion[] {
  const first = (name || '').trim().split(/\s+/)[0] || 'them'
  const byNewest = [...events].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
  const recent = byNewest.filter(e => Date.now() - Date.parse(e.occurred_at) < 7 * 864e5)
  // Homes whose latest like / pass is a pass - never suggested as "liked" (or looked at).
  const passedOn = new Set<string>()
  const reacted = new Set<string>()
  for (const e of byNewest) {
    if ((e.source_type !== 'showcase_like' && e.source_type !== 'showcase_dislike') || !e.property_address) continue
    const k = homeKey(tidyAddress(e.property_address.trim()))
    if (reacted.has(k)) continue
    reacted.add(k)
    if (e.source_type === 'showcase_dislike') passedOn.add(k)
  }
  const out: Suggestion[] = []
  const used = new Set<string>()
  const named = new Set<string>()
  const consumed = new Set<LeadEvent>()
  for (let i = 0; i < recent.length; i++) {
    const e = recent[i]
    if (BROWSE_TYPES.has(e.source_type)) {
      if (consumed.has(e)) continue
      // This click / view / like and the ones before it in the same sitting.
      const sitting: LeadEvent[] = []
      let at = Date.parse(e.occurred_at)
      for (const x of recent.slice(i)) {
        if (!BROWSE_TYPES.has(x.source_type)) continue
        const t = Date.parse(x.occurred_at)
        if (at - t > BROWSE_GAP) break
        sitting.push(x)
        consumed.add(x)
        at = t
      }
      let s = browseSuggestion(sitting, first, passedOn, named)
      const lastLike = Math.max(0, ...sitting.filter(x => x.source_type === 'showcase_like').map(x => Date.parse(x.occurred_at)))
      if (s?.key === 'likes' && lastLike <= likesCovered) {
        // Their liked homes are on the automatic card already - what's left to suggest is any home
        // they only clicked through to / looked at in the same sitting.
        sitting.forEach(x => { if (x.source_type === 'showcase_like' && x.property_address) named.add(homeKey(tidyAddress(x.property_address.trim()))) })
        s = browseSuggestion(sitting.filter(x => x.source_type !== 'showcase_like'), first, passedOn, named)
        if (s && !s.homes.length) s = null   // a bare "they clicked your email" adds nothing next to the card
      }
      if (!s || used.has(s.key)) continue
      used.add(s.key)
      s.homes.forEach(h => named.add(homeKey(h)))
      if (openTitles.includes(s.title)) continue
      const why = `${s.did} · ${happenedWhen(e.occurred_at)}`
      out.push({ key: s.key, kind: s.kind, title: s.title, why, note: `What happened: ${why}` })
      if (out.length === 2) break
      continue
    }
    const rule = SUGGEST[e.source_type]
    if (!rule || used.has(rule.key)) continue
    used.add(rule.key)
    const street = streetOf(tidyAddress((e.property_address || '').trim()))
    const title = rule.title(first, street)
    if (openTitles.includes(title)) continue
    // Its automatic follow-up is already there (still open, or made for this) - no second copy.
    const at = Date.parse(e.occurred_at)
    if (rule.covers?.some(src => tasks.some(t => t.auto_source === src && (!t.completed_at || Date.parse(t.created_at) >= at - 10 * 60e3)))) continue
    const why = `${e.summary} · ${happenedWhen(e.occurred_at)}`
    // Their first name as the server writes it (tasks_service._guest_first): "JOHN" reads John.
    const guest = first === 'them' ? '' : first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first
    out.push({ key: rule.key, kind: rule.kind, title, why, note: `What happened: ${why}`, message: guest ? rule.message?.(guest, me, street) : undefined })
    if (out.length === 2) break
  }
  return out
}

function SuggestedFollowups({ leadId, items, onAdded }: { leadId: string; items: Suggestion[]; onAdded: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  if (!items.length) return null
  const add = async (s: Suggestion) => {
    setBusy(s.key)
    // Tomorrow, any time (all-day) - the phone buzzes at 9 AM.
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + 1)
    const at = (h: number) => { const d = new Date(day); d.setHours(h, 0, 0, 0); return d.toISOString() }
    const res = await api.tasks.create({ title: s.title, kind: s.kind, priority: 'normal', due_at: at(12), remind_at: at(9), all_day: true, lead_id: leadId, notes: s.note, ...(s.message ? { suggested_message: s.message, signed: true } : {}) })
    setBusy(null)
    if (res.success) { setAdded(a => [...a, s.key]); onAdded() }
  }
  return (
    <div className="mb-3 rounded-xl border border-[#C9A24D]/30 bg-[#fffaf0] p-3 dark:border-[#C9A24D]/20 dark:bg-[#C9A24D]/[0.06]" data-testid="suggested-followups">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /> Suggested from what they just did</p>
      {items.map(s => {
        const done = added.includes(s.key)
        return (
          <div key={s.key} className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-[12rem] flex-1">
              <p className="text-[13.5px] font-black leading-snug text-[#111827] dark:text-white">{s.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{s.why}</p>
            </div>
            <button type="button" disabled={!!busy || done} onClick={() => add(s)}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-black transition max-sm:w-full max-sm:justify-center ${done
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                : 'bg-[#111827] text-white hover:-translate-y-px dark:bg-[#C9A24D] dark:text-[#111827]'}`}>
              {busy === s.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {done ? 'Added for tomorrow' : 'Add for tomorrow'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
