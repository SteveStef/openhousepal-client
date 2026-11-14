'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import api from '@/lib/api-service'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { AgentTable, Card, Columns, Kpi, KpiGrid, Note, SERIES, TrendChart, ago, n0, pctTxt, planName, type Col } from './ui'

// Admin Insights -> AI chat (backend admin_chat_usage_service via /admin/ai/chat-usage): who uses the
// AI helper, how much, for roughly how long, what it costs and what they get done with it. Counts,
// times and feature names only - the agents' messages are never shown.

type D = any
const PERIODS = [
  { days: 1, label: '24 hours' }, { days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' },
  { days: 365, label: '12 months' }, { days: 0, label: 'All time' },
]
const STORE = 'ohp_admin_chat_days'
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`))
const inP = (label: string) => (label === 'All time' ? 'all time' : `the last ${label}`)

function savedDays(): number {
  if (typeof window === 'undefined') return 30
  try {
    const raw = localStorage.getItem(STORE)
    const v = Number(raw)
    return raw !== null && PERIODS.some(p => p.days === v) ? v : 30
  } catch {
    return 30
  }
}

/** 45 sec / 12 min / 3 hr 5 min */
export function durTxt(s?: number | null) {
  if (s == null) return '-'
  const v = Math.round(s)
  if (v < 60) return `${v} sec`
  const mins = Math.round(v / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), mm = mins % 60
  return mm ? `${h} hr ${mm} min` : `${h} hr`
}

function usd(v?: number | null) {
  if (v == null) return '-'
  if (v === 0) return '$0'
  if (v < 0.01) return '<$0.01'
  return `$${v.toFixed(2)}`
}

const when = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString(undefined, { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '-'

function Change({ now, before }: { now: number; before?: number | null }) {
  if (before == null || (!before && !now)) return null
  if (now === before) return <span className="text-gray-400">same as the period before</span>
  const up = now > before
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      <Icon className="h-3 w-3" />{before ? `${up ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : 'new'} vs the period before
    </span>
  )
}

const STATE: Record<string, { label: string; cls: string }> = {
  done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  skipped: { label: 'Not used', cls: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  open: { label: 'Working', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
}

/** Feature groups: one bar per group, split into things done (cards confirmed) and lookups. */
function Features({ groups, empty = 'No features used through the chat yet' }: { groups: D[]; empty?: string }) {
  const max = Math.max(1, ...groups.map(g => g.done + g.lookups))
  if (!groups.length) return <p className="py-6 text-center text-xs font-semibold text-gray-400">{empty}</p>
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-3 rounded-sm ${SERIES[0].bg}`} />Done (card confirmed)</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-3 rounded-sm ${SERIES[1].bg}`} />Looked up</span>
      </div>
      <ul className="space-y-2.5">
        {groups.map(g => (
          <li key={g.key} title={`${g.label}: ${g.done} done of ${g.made} cards, ${g.lookups} lookups, ${g.agents} agent${g.agents === 1 ? '' : 's'}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-bold text-gray-700 dark:text-gray-200">{g.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                <span className="font-black text-[#111827] dark:text-white">{n0(g.done)}</span> done{g.made > g.done ? ` of ${n0(g.made)}` : ''} · {n0(g.lookups)} looked up
                {g.agents != null && <span className="max-sm:hidden"> · {g.agents} agent{g.agents === 1 ? '' : 's'}</span>}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
              <div className={SERIES[0].bg} style={{ width: `${(g.done / max) * 100}%` }} />
              <div className={SERIES[1].bg} style={{ width: `${(g.lookups / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Every kind of card the chat made: how many, and what happened to them. */
function Actions({ rows, showAgents = true }: { rows: D[]; showAgents?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-xs font-semibold text-gray-400">No cards made yet</p>
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
      <table className="w-full min-w-[460px] text-left text-xs">
        <thead className="bg-gray-50/80 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
          <tr>
            <th className="px-3 py-2.5 font-black">Card</th>
            <th className="px-3 py-2.5 text-right font-black">Made</th>
            <th className="px-3 py-2.5 text-right font-black">Done</th>
            <th className="px-3 py-2.5 text-right font-black" title="Cancelled, never tapped, expired or replaced by a newer card">Not used</th>
            <th className="px-3 py-2.5 text-right font-black">Failed</th>
            {showAgents && <th className="px-3 py-2.5 text-right font-black">Agents</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(a => (
            <tr key={a.tool} className="text-gray-700 dark:text-gray-200">
              <td className="px-3 py-2.5">
                <p className="font-black text-[#111827] dark:text-white">{a.label}</p>
                <p className="text-[10px] font-semibold text-gray-400">{a.group_label}</p>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(a.made)}</td>
              <td className="px-3 py-2.5 text-right font-black tabular-nums text-emerald-700 dark:text-emerald-400">{n0(a.done)}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-500 dark:text-gray-400">{n0(a.skipped)}</td>
              <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${a.failed ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{n0(a.failed)}</td>
              {showAgents && <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(a.agents)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HowMeasured({ d }: { d: D }) {
  return (
    <Note>
      How time is measured: nothing records when the chat window is open, so it&apos;s estimated from message times. An agent&apos;s
      messages and the replies are put in order; more than {d.gap_minutes} minutes of quiet starts a new session; a session runs from
      its first message to its last, plus {Math.round(d.reading_seconds / 60)} minute to read the last reply. Only counts, times and
      feature names are shown here - never what agents typed.
    </Note>
  )
}

// ---------------------------------------------------------------- one agent

function AgentSheet({ agent, days, period, onClose }: { agent: D | null; days: number; period: string; onClose: () => void }) {
  const [d, setD] = useState<D>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!agent) return
    setD(null)
    setErr(null)
    let live = true
    api.admin.getAgentChatUsage(agent.id, days).then(r => {
      if (!live) return
      if (r.success) setD(r.data)
      else setErr(r.error || "Couldn't load this agent")
    })
    return () => { live = false }
  }, [agent, days])
  const al = d?.allowance
  return (
    <OhSheet open={!!agent} onClose={onClose} width="max-w-3xl" title={agent?.name || ''}
      subtitle={`${planName(agent?.plan_tier)} · AI chat, ${inP(period)}`} icon={<Bot className="h-5 w-5" />}>
      {err ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p>
      ) : !d ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Messages" value={n0(d.messages)} sub={`${n0(d.chats)} chat${d.chats === 1 ? '' : 's'} · on ${n0(d.active_days)} day${d.active_days === 1 ? '' : 's'}`} />
            <Kpi label="Time chatting" value={durTxt(d.seconds)} sub={`${n0(d.sessions)} session${d.sessions === 1 ? '' : 's'} · avg ${durTxt(d.avg_session_seconds)}`} />
            <Kpi label="Things done" value={n0(d.things_done)} sub={`of ${n0(d.cards_made)} cards · ${n0(d.lookups)} lookups`} />
            <Kpi label="Chat cost" value={usd(d.cost_usd)} sub={d.ai_share_pct != null ? `${pctTxt(d.ai_share_pct)} of their AI spend` : 'no AI spend'} />
          </div>
          <Note>
            First used the chat {d.first_used_at ? when(d.first_used_at) : 'never'} · last {d.last_used_at ? `${ago(d.last_used_at).toLowerCase()} (${when(d.last_used_at)})` : 'never'}.
            {al && al.limit_usd ? ` This billing period chat has used ${pctTxt(al.chat_pct_of_allowance ?? 0)} of their AI Usage allowance (${usd(al.chat_cost_usd)}).` : ''}
            {d.blocked ? ` ${n0(d.blocked)} message${d.blocked === 1 ? ' was' : 's were'} stopped by a limit.` : ''}
          </Note>
          {d.messages > 0 && (
            <Card title="Messages" sub={`Each ${d.unit}`}>
              <TrendChart data={d.series} unit={d.unit} height={160} series={[{ key: 'messages', label: 'Messages' }, { key: 'chats', label: 'Chats' }]} />
            </Card>
          )}
          <Card title="What they use it for" sub="Cards they confirmed, and what the chat looked up for them">
            <Features groups={d.groups.map((g: D) => ({ ...g, agents: null }))} />
          </Card>
          <Card title="Cards the chat made for them">
            <Actions rows={d.actions} showAgents={false} />
          </Card>
          <Card title="Recent sessions" sub="Newest first">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.recent_sessions.map((s: D) => (
                <li key={s.start} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="font-black text-[#111827] dark:text-white">{when(s.start)}</span>
                  <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                    <span className="font-black text-[#111827] dark:text-white">{durTxt(s.seconds)}</span> · {n0(s.messages)} message{s.messages === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
              {!d.recent_sessions.length && <li className="py-6 text-center text-xs font-semibold text-gray-400">No sessions in this period</li>}
            </ul>
          </Card>
          <Card title="Their chats" sub="Newest first - counts and features only, not what was said">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.conversations.map((c: D) => (
                <li key={c.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-black text-[#111827] dark:text-white">
                      {when(c.last_at)}
                      {c.deleted_by_agent && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/5 dark:text-gray-400">Deleted by agent</span>}
                    </span>
                    <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                      {n0(c.messages)} message{c.messages === 1 ? '' : 's'} · {durTxt(c.seconds)} · {usd(c.cost_usd)}
                    </span>
                  </div>
                  {(c.cards.length > 0 || c.looked_up.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.cards.map((k: D, i: number) => (
                        <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${(STATE[k.state] || STATE.skipped).cls}`} title={`${k.group} - ${(STATE[k.state] || STATE.skipped).label}`}>
                          {k.label} · {(STATE[k.state] || STATE.skipped).label}
                        </span>
                      ))}
                      {c.looked_up.map((l: string) => (
                        <span key={l} className="rounded-full bg-[#2a78d6]/10 px-2 py-0.5 text-[10px] font-bold text-[#1f5fae] dark:bg-[#3987e5]/15 dark:text-[#8db8f0]">Looked up: {l}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!d.conversations.length && <li className="py-6 text-center text-xs font-semibold text-gray-400">No chats in this period</li>}
            </ul>
          </Card>
          <HowMeasured d={d} />
        </div>
      )}
    </OhSheet>
  )
}

// ---------------------------------------------------------------- the page

export default function ChatUsagePanel({ title, blurb }: { title: string; blurb: string }) {
  const [days, setDays] = useState<number>(savedDays)
  const [data, setData] = useState<D>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agent, setAgent] = useState<D>(null)

  // Only the newest request counts (quick period switches must never leave an older answer on screen).
  const latest = useRef(0)
  const load = useCallback(() => {
    const ticket = ++latest.current
    setLoading(true)
    setError(null)
    api.admin.getChatUsage(days).then(r => {
      if (ticket !== latest.current) return
      if (r.success && r.data) setData(r.data)
      else setError(r.error || "Couldn't load these numbers")
      setLoading(false)
    })
  }, [days])
  useEffect(load, [load])

  const pick = (v: number) => {
    setDays(v)
    try { localStorage.setItem(STORE, String(v)) } catch { /* per-browser nicety only */ }
  }
  const ready = data && data.days === days
  const label = PERIODS.find(p => p.days === days)?.label || ''
  const k = data?.kpis

  const cols: Col<D>[] = [
    { key: 'messages', label: 'Messages', value: r => r.messages, num: true, hint: 'Messages the agent sent' },
    { key: 'chats', label: 'Chats', value: r => r.chats, num: true },
    { key: 'seconds', label: 'Time', value: r => r.seconds, num: true, render: r => r.seconds ? durTxt(r.seconds) : <span className="text-gray-300 dark:text-gray-600">-</span>, hint: 'Estimated from message times' },
    { key: 'sessions', label: 'Sessions', value: r => r.sessions, num: true },
    { key: 'avg_session_seconds', label: 'Avg session', value: r => r.avg_session_seconds, num: true, render: r => durTxt(r.avg_session_seconds) },
    { key: 'things_done', label: 'Things done', value: r => r.things_done, num: true, hint: 'Cards the agent confirmed' },
    { key: 'lookups', label: 'Lookups', value: r => r.lookups, num: true },
    { key: 'cost_usd', label: 'Chat cost', value: r => r.cost_usd, num: true, render: r => usd(r.cost_usd) },
    { key: 'ai_share_pct', label: 'Of AI spend', value: r => r.ai_share_pct, num: true, render: r => pctTxt(r.ai_share_pct), hint: "Chat's share of everything this agent spent on AI in the period" },
    { key: 'last_used_at', label: 'Last used', value: r => r.last_used_at ? new Date(r.last_used_at).getTime() : 0, render: r => ago(r.last_used_at) },
    { key: 'top_features', label: 'Uses it for', value: r => (r.top_features || []).join(', '), render: r => r.top_features?.length ? <span className="text-gray-500 dark:text-gray-400">{r.top_features.join(', ')}</span> : <span className="text-gray-300 dark:text-gray-600">-</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{title}</h2>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{blurb}</p>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full">
          <div role="radiogroup" aria-label="Time period" className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200 dark:bg-[#151517] dark:ring-white/10 max-sm:grid max-sm:min-w-0 max-sm:flex-1 max-sm:grid-cols-3">
            {PERIODS.map(p => (
              <button key={p.days} role="radio" aria-checked={days === p.days} onClick={() => pick(p.days)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black transition sm:px-3 max-sm:whitespace-nowrap max-sm:px-1 max-sm:py-2.5 ${days === p.days ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} aria-label="Refresh" title="Refresh"
            className="rounded-xl bg-white p-2 max-sm:p-3 text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-[#111827] dark:bg-[#151517] dark:text-gray-400 dark:ring-white/10 dark:hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!ready && !error && (
        <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Adding it up…</div>
      )}
      {ready && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <KpiGrid>
            <Kpi label="Agents who chatted" value={`${n0(k.agents_chatted)} of ${n0(k.agents_total)}`}
              sub={<>{pctTxt(k.agents_chatted_pct)} of agents{k.prev_agents_chatted != null ? ` · ${n0(k.prev_agents_chatted)} the period before` : ''}</>} />
            <Kpi label="Messages sent" value={n0(k.messages)} sub={<>{n0(k.chats)} chat{k.chats === 1 ? '' : 's'} · <Change now={k.messages} before={k.prev_messages} /></>} />
            <Kpi label="Time chatting" value={durTxt(k.seconds)} sub={`${n0(k.sessions)} session${k.sessions === 1 ? '' : 's'} · avg ${durTxt(k.avg_session_seconds)} · longest ${durTxt(k.longest_session_seconds)}`} />
            <Kpi label="Things done in chat" value={n0(k.things_done)} sub={`of ${n0(k.cards_made)} cards made · ${n0(k.lookups)} lookups`} />
            <Kpi label="Chat AI cost" value={usd(k.cost_usd)} sub={`${k.ai_share_pct != null ? `${pctTxt(k.ai_share_pct)} of agents' AI spend` : 'no AI spend'}${k.cost_per_message_usd != null ? ` · ${usd(k.cost_per_message_usd)} a message` : ''}`} />
            <Kpi label="Stopped by a limit" value={n0(k.blocked)} warn={k.blocked > 0} sub="Messages a usage or speed limit turned away" />
          </KpiGrid>

          <Card title="Chat use" sub={`Each ${data.unit} - ${inP(label)}`}>
            <TrendChart data={data.series} unit={data.unit} series={[{ key: 'messages', label: 'Messages' }, { key: 'chats', label: 'Chats' }, { key: 'agents', label: 'Agents' }]} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="What agents use it for" sub={`Cards confirmed and lookups, by feature - ${inP(label)}`}>
              <Features groups={data.groups} />
            </Card>
            <Card title="When agents chat" sub="Messages sent by hour of the day (Eastern)">
              <Columns values={data.hours} labels={HOURS} every={3} />
            </Card>
          </div>

          <Card title="Cards the chat made" sub={`Every kind of Confirm card, and what happened to it - ${inP(label)}`}>
            <Actions rows={data.actions} />
          </Card>

          <Card title="Every agent" sub="Tap an agent for their sessions, chats and features. Scroll sideways for more.">
            <AgentTable rows={data.agents} cols={cols} initialSort="messages" onOpen={r => setAgent(r)} empty="No agents yet" />
          </Card>

          <HowMeasured d={data} />
        </div>
      )}
      <AgentSheet agent={agent} days={days} period={label} onClose={() => setAgent(null)} />
    </div>
  )
}
