'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowLeft, CalendarDays, Check, ChevronDown, Home, Loader2, RefreshCw, Search, TrendingDown, Users, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import Pager from '@/components/ui/Pager'
import { timeAgo } from '@/lib/leadActivity'
import type {
  AdminActivityAgentDetail, AdminActivityAgentRow, AdminActivityOverview, AdminAgentHealth, AdminFeatureStatus, BillingGroup,
} from '@/types'

// Plain words for the tracker's labels.
const HEALTH: Record<AdminAgentHealth, { label: string; cls: string; hint: string }> = {
  power: { label: 'Power user', cls: 'bg-emerald-600 text-white', hint: 'In the app this week and on 8+ days in the last 30' },
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25', hint: 'Used it in the last 7 days' },
  slipping: { label: 'Slipping', cls: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25', hint: 'Last used 1-4 weeks ago' },
  inactive: { label: 'Inactive', cls: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25', hint: 'Nothing in over a month' },
  never: { label: 'No visits yet', cls: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400', hint: 'Hasn\'t used it since tracking began' },
}
const STATUS: Record<AdminFeatureStatus, { label: string; cls: string }> = {
  regular: { label: 'Keeps using', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  recent: { label: 'Used recently', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  once: { label: 'Tried once', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  stopped: { label: 'Stopped', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  never: { label: 'Never', cls: 'bg-gray-100 text-gray-400 dark:bg-white/[0.05] dark:text-gray-500' },
}

const PLAN_NAME: Record<string, string> = { NO_MLS: 'No-MLS', PRO_NO_MLS: 'Pro No-MLS', BASIC: 'Basic', PREMIUM: 'Premium', IDX: 'IDX' }
const planName = (t?: string | null) => (t && PLAN_NAME[t]) || 'No plan'
const statusName = (s?: string | null) => (s || '').toLowerCase().replace('_', ' ') || '-'

type Filter = 'all' | 'paying' | 'trial' | 'attention'
type Sort = 'seen' | 'most' | 'least' | 'newest' | 'name'
const PAGE = 15

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const shortDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${cls}`}>{children}</span>
}

function Kpi({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#151517] ${warn ? 'border-red-200 dark:border-red-500/30' : 'border-gray-100 dark:border-gray-800'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${warn ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{sub}</p>}
    </div>
  )
}

export default function AgentActivityPanel({ groups = [] }: { groups?: BillingGroup[] }) {
  const [data, setData] = useState<AdminActivityOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'agents' | 'features'>('agents')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState('')
  const [sort, setSort] = useState<Sort>('seen')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.admin.getActivity().then(r => { if (r.success && r.data) setData(r.data); setLoading(false) })
  }
  useEffect(load, [])
  useEffect(() => setPage(1), [q, filter, sort, group])

  const label = (key: string) => data?.adoption.find(a => a.key === key)?.label || key

  const agents = useMemo(() => {
    if (!data) return []
    const s = q.trim().toLowerCase()
    const seen = (a: AdminActivityAgentRow) => a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
    return data.agents
      .filter(a => !s || a.name.toLowerCase().includes(s) || a.email.toLowerCase().includes(s) || (a.brokerage || '').toLowerCase().includes(s))
      .filter(a => filter === 'all' ? true
        : filter === 'paying' ? (a.subscription_status || '').toUpperCase() === 'ACTIVE'
        : filter === 'trial' ? (a.subscription_status || '').toUpperCase() === 'TRIAL'
        : a.health === 'slipping' || a.health === 'inactive' || a.health === 'never')
      .filter(a => !group || a.billing_group_id === group)
      .sort({
        seen: (a: AdminActivityAgentRow, b: AdminActivityAgentRow) => seen(b) - seen(a),
        most: (a: AdminActivityAgentRow, b: AdminActivityAgentRow) => b.active_days_30 - a.active_days_30 || b.features_used_30 - a.features_used_30,
        least: (a: AdminActivityAgentRow, b: AdminActivityAgentRow) => seen(a) - seen(b),
        newest: (a: AdminActivityAgentRow, b: AdminActivityAgentRow) => new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime(),
        name: (a: AdminActivityAgentRow, b: AdminActivityAgentRow) => a.name.localeCompare(b.name),
      }[sort])
  }, [data, q, filter, sort, group])
  const pages = Math.max(1, Math.ceil(agents.length / PAGE))
  const cur = Math.min(page, pages)

  if (loading && !data) return <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!data) return <p className="py-20 text-center text-sm font-bold text-gray-400">Couldn&apos;t load the tracker - try again.</p>
  const t = data.totals
  const attention = data.agents.filter(a => a.health === 'slipping' || a.health === 'inactive').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><Activity className="h-5 w-5 text-[#C9A24D]" /> Agent Activity</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            What every agent is using, how often, and whether it&apos;s working for them. Counts only - their clients&apos; names and contact details are never shown here.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 max-sm:py-2.5 text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Agents" value={t.agents} sub={`${t.paying} paying`} />
        <Kpi label="In today" value={t.active_today} />
        <Kpi label="This week" value={t.active_7} sub={`${pct(t.active_7, t.agents)}% of agents`} />
        <Kpi label="This month" value={t.active_30} sub={`${pct(t.active_30, t.agents)}% of agents`} />
        <Kpi label="Slipping / gone" value={attention} sub="No use in 7+ days" warn={attention > 0} />
        <Kpi label="Open houses w/ sign-ins" value={`${pct(t.open_houses_with_signins, t.open_houses_held)}%`} sub={`${t.open_houses_with_signins} of ${t.open_houses_held} held · ${t.signins} sign-ins`} warn={t.open_houses_held > 0 && pct(t.open_houses_with_signins, t.open_houses_held) < 50} />
        <Kpi label="Leads (30 days)" value={t.leads_30} />
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border border-gray-100 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-[#151517] max-sm:w-full">
        {(['agents', 'features'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest transition max-sm:flex-1 max-sm:py-2.5 ${view === v ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#C9A24D]'}`}>
            {v === 'agents' ? 'By agent' : 'By feature'}
          </button>
        ))}
      </div>

      {view === 'agents' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search agent, email or brokerage"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
            </div>
            <Select value={filter} onChange={v => setFilter(v as Filter)} options={[['all', 'All agents'], ['paying', 'Paying'], ['trial', 'On trial'], ['attention', 'Slipping or inactive']]} />
            {groups.length > 0 && <Select value={group} onChange={setGroup} options={[['', 'Any brokerage group'], ...groups.map(g => [g.id, g.name] as [string, string])]} />}
            <Select value={sort} onChange={v => setSort(v as Sort)} options={[['seen', 'Last in the app'], ['most', 'Most active'], ['least', 'Least active'], ['newest', 'Newest agents'], ['name', 'Name A-Z']]} />
          </div>

          <div className="space-y-2">
            {agents.length === 0 && <p className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm font-bold text-gray-400 dark:border-gray-800">No agents match.</p>}
            {agents.slice((cur - 1) * PAGE, cur * PAGE).map(a => {
              const h = HEALTH[a.health]
              const oh = a.open_houses
              return (
                <button key={a.id} onClick={() => setOpenId(a.id)}
                  className="grid w-full gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-[#C9A24D]/50 hover:shadow-md dark:border-gray-800 dark:bg-[#151517] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-black text-[#111827] dark:text-white">{a.name}</p>
                      <span title={h.hint}><Chip cls={h.cls}>{h.label}</Chip></span>
                    </div>
                    <p className="truncate text-xs font-semibold text-gray-400">{a.email}{a.brokerage ? ` · ${a.brokerage}` : ''}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-gray-400">{planName(a.plan_tier)} · {statusName(a.subscription_status)} · joined {shortDate(a.joined_at)}</p>
                  </div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <p><span className="font-black text-[#111827] dark:text-white">{a.last_seen_at ? timeAgo(a.last_seen_at) : 'Never'}</span> last in</p>
                    <p>{a.active_days_30} of 30 days active</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {a.top_features.length ? a.top_features.map(k => <Chip key={k} cls="bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]">{label(k)}</Chip>)
                        : <span className="text-xs font-semibold text-gray-400">Nothing in the last 30 days</span>}
                    </div>
                    {a.tried_once.length > 0 && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-gray-400">
                        <TrendingDown className="h-3 w-3" /> Tried once: {a.tried_once.map(label).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <p className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />
                      {oh.held ? <><span className={`font-black ${pct(oh.held_with_signins, oh.held) < 50 ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>{oh.held_with_signins} of {oh.held}</span>&nbsp;open houses got sign-ins</> : 'No open houses yet'}
                    </p>
                    <p>{oh.signins} sign-ins · {a.leads_30} leads this month</p>
                  </div>
                </button>
              )
            })}
          </div>
          {pages > 1 && <Pager page={cur} pages={pages} onChange={n => setPage(Math.min(Math.max(1, n), pages))} />}
        </>
      ) : (
        <FeaturesView data={data} />
      )}

      <AnimatePresence>{openId && <AgentDrawer id={openId} onClose={() => setOpenId(null)} />}</AnimatePresence>
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="relative max-sm:min-w-[calc(50%-0.25rem)] max-sm:flex-1">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-xs font-bold max-sm:min-h-[44px] max-sm:w-full text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </label>
  )
}

function FeaturesView({ data }: { data: AdminActivityOverview }) {
  const n = data.totals.agents
  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        <b>Keeps using</b> = used in 3+ of the last 8 weeks. <b>Tried once</b> = used it one time, over 2 weeks ago, never again. <b>Stopped</b> = used it more than once, but not in the last 30 days.
      </p>
      {data.groups.map(g => {
        const rows = data.adoption.filter(a => a.group === g.key)
        if (!rows.length) return null
        return (
          <div key={g.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
            <p className="border-b border-gray-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-gray-400 dark:border-gray-800">{g.label}</p>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map(a => (
                <div key={a.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:items-center">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">{a.label}</p>
                    <p className="text-[11px] font-semibold text-gray-400">{a.kind === 'result' ? 'Comes to them' : 'They do it'} · {a.uses_30} in the last 30 days</p>
                  </div>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                      <div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${pct(a.agents_30, n)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">{a.agents_30} of {n} agents this month · {a.agents_ever} ever</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip cls={STATUS.regular.cls}>{a.regular} keep using</Chip>
                    <Chip cls={STATUS.once.cls}>{a.once} tried once</Chip>
                    <Chip cls={STATUS.stopped.cls}>{a.stopped} stopped</Chip>
                    <Chip cls={STATUS.never.cls}>{n - a.agents_ever} never</Chip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TL_PAGE = 20
const OH_PAGE = 8

export function AgentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<AdminActivityAgentDetail | null>(null)
  const [tl, setTl] = useState<'all' | 'action' | 'result'>('all')
  const [tlPage, setTlPage] = useState(1)
  const [ohPage, setOhPage] = useState(1)
  useEffect(() => { api.admin.getActivityAgent(id).then(r => { if (r.success && r.data) setD(r.data) }) }, [id])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const timeline = useMemo(() => (d?.timeline || []).filter(e => tl === 'all' || e.kind === tl), [d, tl])
  const tlPages = Math.max(1, Math.ceil(timeline.length / TL_PAGE))
  const tlCur = Math.min(tlPage, tlPages)
  const ohPages = Math.max(1, Math.ceil((d?.open_houses.length || 0) / OH_PAGE))
  const ohCur = Math.min(ohPage, ohPages)
  const maxWeek = Math.max(1, ...(d?.weeks || []).map(w => w.actions + w.results))
  let lastDay = ''

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/50 max-sm:!m-0" onClick={onClose}>
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-[#111827] dark:hover:text-white max-sm:min-h-[44px] max-sm:pr-3"><ArrowLeft className="h-4 w-4" /> All agents</button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:bg-gray-100 max-sm:text-gray-600 dark:max-sm:bg-white/10 dark:max-sm:text-gray-200"><X className="h-4 w-4 max-sm:h-5 max-sm:w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {!d ? <div className="flex justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-black text-[#111827] dark:text-white">{d.agent.name}</h3>
                  <span title={HEALTH[d.agent.health].hint}><Chip cls={HEALTH[d.agent.health].cls}>{HEALTH[d.agent.health].label}</Chip></span>
                </div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{d.agent.email}{d.agent.brokerage ? ` · ${d.agent.brokerage}` : ''}</p>
                <p className="mt-1 text-xs font-bold text-gray-400">
                  {planName(d.agent.plan_tier)} · {statusName(d.agent.subscription_status)} · joined {shortDate(d.agent.joined_at)} · last in {d.agent.last_seen_at ? timeAgo(d.agent.last_seen_at).toLowerCase() : 'never'} · {d.agent.active_days_30} of the last 30 days
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(d.setup_labels).map(([k, l]) => {
                    const done = d.setup.includes(k)
                    return <Chip key={k} cls={done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.05] dark:text-gray-500'}>{done ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}{l}</Chip>
                  })}
                </div>
              </div>

              {/* 12 weeks at a glance */}
              <Section title="Last 12 weeks">
                <div className="flex h-28 items-end gap-1.5">
                  {d.weeks.map(w => (
                    <div key={w.week_of} className="group relative flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full flex-col justify-end overflow-hidden rounded-t-md bg-gray-100 dark:bg-white/[0.04]">
                        <div className="w-full bg-gray-300 dark:bg-white/20" style={{ height: `${(w.results / maxWeek) * 100}%` }} />
                        <div className="w-full bg-[#C9A24D]" style={{ height: `${(w.actions / maxWeek) * 100}%` }} />
                      </div>
                      <span className="text-[9px] font-bold text-gray-400">{new Date(w.week_of + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                      <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-[#111827] px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                        {w.actions} done · {w.results} came in · {w.days_active}d in app
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-gray-400">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#C9A24D]" /> Things they did</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-white/20" /> Things that came in (sign-ins, leads...)</span>
                </p>
              </Section>

              {/* every feature, grouped */}
              <Section title="What they use">
                <div className="space-y-4">
                  {d.groups.map(g => {
                    const rows = d.features.filter(f => f.group === g.key)
                    return (
                      <div key={g.key}>
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">{g.label}</p>
                        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
                          {rows.map(f => (
                            <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)]">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-bold text-[#111827] dark:text-white">{f.label}</p>
                                <p className="text-[11px] font-semibold text-gray-400 sm:hidden">{f.total} total · {f.last_30} this month{f.last_at ? ` · last ${timeAgo(f.last_at).toLowerCase()}` : ''}</p>
                              </div>
                              <Chip cls={STATUS[f.status].cls}>{STATUS[f.status].label}</Chip>
                              <p className="hidden text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 sm:block">
                                <span className="font-black text-[#111827] dark:text-white">{f.total}</span> total · {f.last_30} this month
                                {f.last_at && <><br />last {timeAgo(f.last_at).toLowerCase()} · first {shortDate(f.first_at)}</>}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>

              {/* open houses + sign-ins */}
              <Section title={`Open houses (${d.open_houses.length})`}>
                {d.open_houses.length === 0 ? <p className="text-sm font-semibold text-gray-400">None yet.</p> : (
                  <>
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
                      {d.open_houses.slice((ohCur - 1) * OH_PAGE, ohCur * OH_PAGE).map(o => (
                        <div key={o.id} className="flex items-center gap-3 px-3 py-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold text-[#111827] dark:text-white">{o.address}{o.city ? `, ${o.city}` : ''}</p>
                            <p className="text-[11px] font-semibold text-gray-400">{shortDate(o.date)}{!o.held ? ' · upcoming' : ''}{o.removed ? ' · removed' : ''}</p>
                          </div>
                          <Chip cls={o.signins ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : o.held ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.05]'}>
                            {o.signins} sign-in{o.signins === 1 ? '' : 's'}
                          </Chip>
                        </div>
                      ))}
                    </div>
                    <Pager page={ohCur} pages={ohPages} onChange={n => setOhPage(Math.min(Math.max(1, n), ohPages))} prevLabel="Newer" nextLabel="Older" className="mt-3" />
                  </>
                )}
              </Section>

              {/* what happened, newest first */}
              <Section title="Recent activity">
                <div className="mb-3 flex flex-wrap gap-1">
                  {([['all', 'Everything'], ['action', 'What they did'], ['result', 'What came in']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => { setTl(k); setTlPage(1) }}
                      className={`rounded-full px-3 py-1.5 max-sm:py-2.5 text-[11px] font-black ${tl === k ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]'}`}>{l}</button>
                  ))}
                </div>
                {timeline.length === 0 ? <p className="text-sm font-semibold text-gray-400">Nothing yet.</p> : (
                  <>
                    <div>
                      {timeline.slice((tlCur - 1) * TL_PAGE, tlCur * TL_PAGE).map((e, i) => {
                        const day = new Date(e.at).toDateString()
                        const head = day !== lastDay
                        lastDay = day
                        return (
                          <div key={i}>
                            {head && <p className={`mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 ${i ? 'mt-3' : ''}`}>{new Date(e.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                            <div className="flex items-center gap-2.5 py-1">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${e.kind === 'action' ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-white/25'}`} />
                              <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#111827] dark:text-white">{e.label}</p>
                              <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-400">{new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Pager page={tlCur} pages={tlPages} onChange={n => setTlPage(Math.min(Math.max(1, n), tlPages))} prevLabel="Newer" nextLabel="Older" className="mt-3" />
                  </>
                )}
              </Section>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {children}
    </div>
  )
}
