'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CalendarDays, Loader2, MailWarning, RefreshCw, Repeat2 } from 'lucide-react'
import api from '@/lib/api-service'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { AgentTable, Card, Kpi, KpiGrid, Note, TrendChart, n0, pctTxt, type Col } from './ui'

// Admin Insights -> Email health (backend admin_email_health_service): a day or a date range, every
// email we sent split agents / clients / account, opened or not, by kind, repetitive sends, and each
// agent (their own open rate on our emails + their clients'). Clients are never named.

type D = any
const AUD: Record<string, string> = { agent: 'To agents', client: 'To clients', account: 'Account emails' }
const AUD_SUB: Record<string, string> = {
  agent: 'Briefings, alerts, round-ups we send the agent',
  client: "Showcase updates, thank-yous, tour confirmations to agents' clients",
  account: 'Sign-up codes, password resets (not tracked)',
}
const MODE: Record<string, { label: string; cls: string }> = {
  normal: { label: 'Opening', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  warned: { label: 'Warned - junk?', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  weekly: { label: 'Switched to weekly', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d) }
const PRESETS = [
  { key: 'today', label: 'Today', range: () => [shift(0), shift(0)] },
  { key: 'yesterday', label: 'Yesterday', range: () => [shift(-1), shift(-1)] },
  { key: '7', label: '7 days', range: () => [shift(-6), shift(0)] },
  { key: '30', label: '30 days', range: () => [shift(-29), shift(0)] },
  { key: '90', label: '90 days', range: () => [shift(-89), shift(0)] },
] as const
const nice = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const when = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

function ModeChip({ mode }: { mode: string }) {
  const m = MODE[mode] || MODE.normal
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ${m.cls}`}>{m.label}</span>
}

function Rate({ v, n }: { v?: number | null; n?: number }) {
  if (v == null || !n) return <span className="text-gray-400">-</span>
  const tone = v >= 40 ? 'text-emerald-700 dark:text-emerald-400' : v < 15 ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'
  return <span className={`font-black ${tone}`}>{pctTxt(v)}</span>
}

/** One row per email kind: a table on a computer, stacked cards on a phone. */
function TypeTable({ rows, empty = 'No emails in this period' }: { rows: D[]; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-xs font-semibold text-gray-400">{empty}</p>
  return (
    <>
      <ul className="space-y-2 sm:hidden">
        {rows.map(t => (
          <li key={t.template + t.audience} className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-black leading-snug text-[#111827] dark:text-white">{t.label}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{AUD[t.audience] || t.audience}{t.can_wait ? ' · can wait' : ''}</p>
              </div>
              <p className="shrink-0 text-right text-[13px] tabular-nums"><Rate v={t.open_rate} n={t.tracked} /><span className="block text-[10px] font-semibold text-gray-400">opened</span></p>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              {n0(t.sent)} sent{t.tracked ? ` · ${n0(t.opened)} opened · ${n0(t.unopened)} not` : ' · not tracked'}{t.clicked ? ` · ${n0(t.clicked)} clicked` : ''}
              {t.per_person ? ` · ${t.per_person} each` : ''}{t.bounced + t.spam ? ` · ${t.bounced + t.spam} bounced/spam` : ''}
            </p>
            {t.repetitive_people > 0 && <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-amber-700 dark:text-amber-300"><Repeat2 className="h-3 w-3" /> Repetitive for {t.repetitive_people}</p>}
            {t.repeats_held > 0 && <p className="mt-1 ml-3 inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400">{t.repeats_held} repeat{t.repeats_held === 1 ? '' : 's'} held back</p>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 sm:block">
        <table className="w-full min-w-[840px] text-left text-xs">
          <thead className="bg-gray-50/80 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            <tr>{['Email', 'To', 'Sent', 'Opened', 'Not opened', 'Open rate', 'Clicked', 'Bounced / spam', 'Per person', 'Repetitive', 'Repeats held'].map((h, i) =>
              <th key={h} className={`px-3 py-2.5 font-black ${i > 1 ? 'text-right' : ''}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(t => (
              <tr key={t.template + t.audience} className="text-gray-700 dark:text-gray-200">
                <td className="px-3 py-2.5">
                  <p className="font-black text-[#111827] dark:text-white">{t.label}</p>
                  {t.can_wait && <p className="text-[10px] font-semibold text-gray-400">Can wait for the weekly summary</p>}
                </td>
                <td className="px-3 py-2.5 font-semibold">{(AUD[t.audience] || t.audience).replace('To ', '')}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(t.sent)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.tracked ? n0(t.opened) : '-'}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.tracked ? n0(t.unopened) : '-'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums"><Rate v={t.open_rate} n={t.tracked} /></td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.tracked ? n0(t.clicked) : '-'}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${t.bounced + t.spam ? 'text-red-600 dark:text-red-400' : ''}`}>{n0(t.bounced + t.spam)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.per_person ?? '-'}</td>
                <td className={`px-3 py-2.5 text-right font-black tabular-nums ${t.repetitive_people ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}`}>{t.repetitive_people || '-'}</td>
                <td className={`px-3 py-2.5 text-right font-black tabular-nums ${t.repeats_held ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'}`} title="Same email, same person, same event, same day - not sent">{t.repeats_held || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Repeats({ rows, rules }: { rows: D[]; rules: D }) {
  if (!rows.length) return <p className="py-6 text-center text-xs font-semibold text-gray-400">Nobody got the same email {rules.repeat_day}+ times in a day or {rules.repeat_week}+ in a week.</p>
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-black leading-snug text-[#111827] dark:text-white">{r.label}</p>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{r.who}</p>
          </div>
          <div className="shrink-0 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            <p className="text-[13px] font-black text-amber-700 dark:text-amber-300">{r.in_a_day} in a day</p>
            <p>{r.in_a_week} in a week · {r.total} total{r.tracked ? ` · ${r.opened} opened` : ''}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AgentSheet({ agent, start, end, onClose }: { agent: D | null; start: string; end: string; onClose: () => void }) {
  const [d, setD] = useState<D>(null)
  useEffect(() => {
    if (!agent) return
    setD(null)
    let live = true
    api.emailHealth.adminAgent(agent.id, start, end).then(r => { if (live && r.success) setD(r.data) })
    return () => { live = false }
  }, [agent, start, end])
  return (
    <OhSheet open={!!agent} onClose={onClose} width="max-w-3xl" title={agent?.name || ''}
      subtitle={start === end ? nice(start) : `${nice(start)} - ${nice(end)}`}
      icon={<MailWarning className="h-5 w-5" />} badge={agent ? <ModeChip mode={agent.mode} /> : undefined}>
      {!d ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Our emails to them" value={n0(d.agent.sent)} sub={d.agent.tracked ? <>{n0(d.agent.opened)} of {n0(d.agent.tracked)} tracked opened · <Rate v={d.agent.open_rate} n={d.agent.tracked} /></> : 'none tracked yet'} />
            <Kpi label="To their clients" value={n0(d.client.sent)} sub={d.client.tracked ? <>{n0(d.client.opened)} opened · <Rate v={d.client.open_rate} n={d.client.tracked} /></> : 'none tracked'} />
          </div>
          <Note>
            {d.mode === 'normal' ? `Opening our emails. ${d.unopened_in_a_row ? `${d.unopened_in_a_row} unopened since their last open.` : ''}`
              : d.mode === 'warned' ? `Warned ${when(d.since)} - ${d.unopened_in_a_row} of our emails unopened in a row. 5 more unopened and routine emails switch to weekly.`
              : `On weekly since ${when(d.since)}. ${d.held_now} update${d.held_now === 1 ? '' : 's'} waiting for their summary (${d.held_total} held in all).`}
          </Note>
          <Card title="By email type"><TypeTable rows={d.templates} /></Card>
          {d.repeats.length > 0 && <Card title="Repetitive"><Repeats rows={d.repeats} rules={{ repeat_day: 3, repeat_week: 6 }} /></Card>}
          <Card title="Our last 25 emails to them">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.recent.map((r: D, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#111827] dark:text-white">{r.label}{r.critical ? '' : <span className="ml-1.5 font-semibold text-gray-400">can wait</span>}</p>
                    <p className="font-semibold text-gray-400">{when(r.at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${!r.tracked ? 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                    : r.opened_at || r.clicked_at ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                    {!r.tracked ? 'Not tracked' : r.clicked_at ? 'Clicked' : r.opened_at ? 'Opened' : 'Not opened'}
                  </span>
                </li>
              ))}
              {!d.recent.length && <li className="py-6 text-center text-xs font-semibold text-gray-400">No emails to this agent yet</li>}
            </ul>
          </Card>
        </div>
      )}
    </OhSheet>
  )
}

export default function EmailHealthPanel({ title, blurb }: { title: string; blurb: string }) {
  const [preset, setPreset] = useState<string>('today')
  const [start, setStart] = useState(shift(0))
  const [end, setEnd] = useState(shift(0))
  const [data, setData] = useState<D>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agent, setAgent] = useState<D>(null)
  const latest = useRef(0)

  const load = useCallback(() => {
    const ticket = ++latest.current
    setLoading(true)
    setError(null)
    api.emailHealth.adminMetrics(start, end).then(r => {
      if (ticket !== latest.current) return
      if (r.success && r.data) setData(r.data)
      else setError(r.error || "Couldn't load these numbers")
      setLoading(false)
    })
  }, [start, end])
  useEffect(load, [load])

  const pick = (key: string) => {
    const p = PRESETS.find(x => x.key === key)
    setPreset(key)
    if (p) { const [s, e] = p.range(); setStart(s); setEnd(e) }
  }
  const setDay = (which: 'start' | 'end', v: string) => {
    if (!v) return
    setPreset('custom')
    if (which === 'start') { setStart(v); if (v > end) setEnd(v) } else setEnd(v < start ? start : v)
  }

  const cols: Col<D>[] = useMemo(() => [
    { key: 'mode', label: 'Our emails', value: r => ({ weekly: 0, warned: 1 }[r.mode as string] ?? 2), render: r => <ModeChip mode={r.mode} />, hint: 'Is the agent opening OpenHousePal emails?' },
    { key: 'to_agent', label: 'To them', value: r => r.to_agent, num: true },
    { key: 'agent_open_rate', label: 'They opened', value: r => r.agent_open_rate, num: true, render: r => <Rate v={r.agent_open_rate} n={r.agent_tracked} /> },
    { key: 'unopened_in_a_row', label: 'Unopened in a row', value: r => r.unopened_in_a_row, num: true, render: r => <span className={r.unopened_in_a_row >= 5 ? 'font-black text-amber-700 dark:text-amber-300' : ''}>{n0(r.unopened_in_a_row)}</span> },
    { key: 'client_sent', label: 'To clients', value: r => r.client_sent, num: true },
    { key: 'client_open_rate', label: 'Clients opened', value: r => r.client_open_rate, num: true, render: r => <Rate v={r.client_open_rate} n={r.client_sent} /> },
    { key: 'repetitive', label: 'Repetitive', value: r => r.repetitive, num: true },
    { key: 'bounced', label: 'Bounced / spam', value: r => r.bounced, num: true },
  ], [])

  const ready = data && data.start && !error
  const k = data?.kpis, a = data?.audiences
  const single = data && data.start === data.end
  const label = data ? (single ? nice(data.start) : `${nice(data.start)} - ${nice(data.end)}`) : ''
  const pixel = data?.pixel

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{title}</h2>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Period" className="flex flex-wrap rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200 dark:bg-[#151517] dark:ring-white/10 max-sm:w-full max-sm:flex-nowrap">
            {PRESETS.map(p => (
              <button key={p.key} role="radio" aria-checked={preset === p.key} onClick={() => pick(p.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black transition sm:px-3 max-sm:flex-1 max-sm:whitespace-nowrap max-sm:px-1 max-sm:py-2.5 ${preset === p.key ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white px-2 py-1 shadow-sm ring-1 ring-gray-200 dark:bg-[#151517] dark:ring-white/10 max-sm:min-h-[44px] max-sm:min-w-0 max-sm:flex-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400 max-sm:hidden" />
            <input type="date" aria-label="From" value={start} max={shift(0)} onChange={e => setDay('start', e.target.value)}
              className="w-[118px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:font-bold bg-transparent text-[11px] font-black text-[#111827] outline-none dark:text-white dark:[color-scheme:dark]" />
            <span className="text-[11px] font-bold text-gray-400">to</span>
            <input type="date" aria-label="To" value={end} min={start} max={shift(0)} onChange={e => setDay('end', e.target.value)}
              className="w-[118px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:font-bold bg-transparent text-[11px] font-black text-[#111827] outline-none dark:text-white dark:[color-scheme:dark]" />
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
      <AnimatePresence mode="wait">
        {ready && (
          <motion.div key="eh" initial={{ opacity: 0, y: 6 }} animate={{ opacity: loading ? 0.6 : 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">{label}</p>
            <KpiGrid>
              <Kpi label="Emails sent" value={n0(k.total)} sub={k.failed ? `${n0(k.failed)} didn't send` : 'all kinds'} warn={k.failed > 0} />
              <Kpi label="To agents" value={n0(a.agent.sent)} sub={a.agent.tracked ? <>{n0(a.agent.opened)} opened · {n0(a.agent.unopened)} not · <Rate v={a.agent.open_rate} n={a.agent.tracked} /></> : 'opens not tracked yet'} />
              <Kpi label="To clients" value={n0(a.client.sent)} sub={a.client.tracked ? <>{n0(a.client.opened)} opened · {n0(a.client.unopened)} not · <Rate v={a.client.open_rate} n={a.client.tracked} /></> : 'none tracked'} />
              <Kpi label="Account emails" value={n0(a.account.sent)} sub="codes, resets - not tracked" />
              <Kpi label="Opened overall" value={pctTxt(k.open_rate)} sub={`${n0(k.opened)} of ${n0(k.tracked)} tracked`} good={(k.open_rate ?? 0) >= 40} warn={k.tracked >= 10 && (k.open_rate ?? 0) < 15} />
              <Kpi label="Bounced / spam" value={n0(k.bounced + k.spam)} warn={k.bounced + k.spam > 0} sub={`${n0(k.bounced)} bounced · ${n0(k.spam)} spam`} />
              <Kpi label="Repetitive" value={n0(k.repetitive)} warn={k.repetitive > 0} sub={k.repeats_held ? `${n0(k.repeats_held)} repeat${k.repeats_held === 1 ? '' : 's'} held back (not sent)` : 'same person, same email, too often'} />
              <Kpi label="Agents not opening" value={n0(data.health.warned + data.health.weekly)} warn={data.health.weekly > 0}
                sub={`${data.health.warned} warned · ${data.health.weekly} on weekly`} />
            </KpiGrid>

            <Note>
              Opens come from a tiny image in each email (and a click counts too). Apple Mail loads images by itself, so Apple users always look &quot;opened&quot; - real rates are a bit lower.
              {pixel && pixel.waiting.length > 0 && <> Open tracking on agent emails switches on per email kind once its template has the image: live for {pixel.live.length} kind{pixel.live.length === 1 ? '' : 's'}, waiting on {pixel.waiting.length} ({pixel.waiting.slice(0, 4).map((t: string) => pixel.labels[t]).join(', ')}{pixel.waiting.length > 4 ? '…' : ''}). Until then those never count against an agent.</>}
            </Note>

            {!single && (
              <Card title="Day by day" sub="Sent to agents and to clients, and how many of all of them were opened">
                <TrendChart unit="day" data={data.days.map((d: D) => ({ d: d.d, agent: d.agent, client: d.client, opened: d.agent_opened + d.client_opened }))}
                  series={[{ key: 'agent', label: 'To agents' }, { key: 'client', label: 'To clients' }, { key: 'opened', label: 'Opened' }]} />
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Who they went to" sub="Opened = of the ones we can track">
                <ul className="space-y-3">
                  {(['agent', 'client', 'account'] as const).map(key => {
                    const v = a[key]
                    const share = k.total ? (v.sent / k.total) * 100 : 0
                    return (
                      <li key={key}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="min-w-0"><span className="font-black text-[#111827] dark:text-white">{AUD[key]}</span>
                            <span className="ml-1.5 hidden font-semibold text-gray-400 sm:inline">{AUD_SUB[key]}</span></span>
                          <span className="shrink-0 font-black tabular-nums text-[#111827] dark:text-white">{n0(v.sent)}{v.tracked ? <span className="ml-1.5 font-semibold text-gray-500"> · <Rate v={v.open_rate} n={v.tracked} /> opened</span> : null}</span>
                        </div>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                          <div className="h-2.5 bg-[#1baf7a] dark:bg-[#199e70]" style={{ width: `${v.sent ? (share * v.opened) / Math.max(1, v.sent) : 0}%` }} />
                          <div className="h-2.5 bg-[#2a78d6]/70 dark:bg-[#3987e5]/70" style={{ width: `${v.sent ? share * (1 - v.opened / Math.max(1, v.sent)) : 0}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#1baf7a]" /> opened</span>
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#2a78d6]/70" /> not opened / not tracked</span>
                </p>
              </Card>
              <Card title="Least opened" sub="Kinds with 3+ tracked emails, worst first - the ones hurting our score">
                {data.top_unopened.length ? (
                  <ul className="space-y-2.5">
                    {data.top_unopened.map((t: D) => (
                      <li key={t.template + t.audience}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-bold text-gray-700 dark:text-gray-200">{t.label}<span className="ml-1.5 font-semibold text-gray-400">{(AUD[t.audience] || '').toLowerCase()}</span></span>
                          <span className="shrink-0 tabular-nums"><Rate v={t.open_rate} n={t.tracked} /><span className="ml-1 font-semibold text-gray-400">· {n0(t.unopened)} unopened</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06]">
                          <div className="h-2 rounded-full bg-[#eb6834] dark:bg-[#d95926]" style={{ width: `${Math.max(2, 100 - (t.open_rate || 0))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="py-6 text-center text-xs font-semibold text-gray-400">Not enough tracked emails yet</p>}
              </Card>
            </div>

            <Card title="Repetitive emails" sub={`The same person got the same kind of email ${data.rules.repeat_day}+ times in 24 hours or ${data.rules.repeat_week}+ in 7 days`}
              action={k.repetitive ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle className="h-3 w-3" /> {k.repetitive}</span> : undefined}>
              <Repeats rows={data.repeats} rules={data.rules} />
            </Card>

            <Card title="Every kind of email" sub="Sent, opened and not opened, clicks, bounces - and how many each person got">
              <TypeTable rows={data.templates} />
            </Card>

            <Card title="By agent" sub="Tap an agent for their emails one by one">
              <AgentTable rows={data.agents} cols={cols} initialSort="to_agent" onOpen={r => setAgent(r)} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <AgentSheet agent={agent} start={start} end={end} onClose={() => setAgent(null)} />
    </div>
  )
}
