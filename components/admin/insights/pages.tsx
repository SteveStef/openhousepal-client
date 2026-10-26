'use client'

import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import {
  AgentTable, BarList, Card, Columns, Funnel, Kpi, KpiGrid, Note, TrendChart, ago, n0, pctOf, pctTxt, secsTxt, type Col,
} from './ui'

// The six admin Insights pages. Each gets one response from /admin/insights/<page>
// (admin_insights_service) - plain words, counts only; agents named, guests never.

type D = any
const inP = (period: string) => (period === 'All time' ? 'all time' : `the last ${period}`)
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`))
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MODE: Record<string, string> = { phone: "Guest's own phone (QR)", kiosk: "Agent's tablet (kiosk)", unknown: 'Not recorded (older sign-ins)' }
const DEVICE: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer', unknown: 'Not recorded' }
const SOURCE: Record<string, string> = { open_house: 'From an open house sign-in', form: 'From a form', manual: 'Made by the agent' }
const ASLEEP: Record<string, string> = { no_response: 'Client stopped opening emails', agent: 'Agent turned it off' }
const FORM_TYPE: Record<string, string> = {
  buying: 'Buying', selling: 'Selling', home_value: 'Home value', showcase_request: 'Showcase request', how_can_i_help: 'How can I help',
  showing: 'Schedule a showing', make_me_sell: 'Make me sell', buyer_onboarding: 'Buyer onboarding', seller_onboarding: 'Seller onboarding', custom: 'Custom form',
}
const formName = (k: string) => FORM_TYPE[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const AUDIENCE: Record<string, string> = { agent: 'To agents (alerts, briefings)', client: "To agents' clients", account: 'Account emails (codes, resets)' }

function Link({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
      {children} <ArrowRight className="h-3 w-3" />
    </button>
  )
}

// ---------------------------------------------------------------- summary

export function SummaryPage({ d, period, onGo }: { d: D; period: string; onGo: (t: string) => void }) {
  const a = d.agents, h = d.headline
  return (
    <>
      <KpiGrid>
        <Kpi label="Agents" value={n0(a.total)} sub={`${a.joined} joined in ${inP(period)}`} onClick={() => onGo('agents')} />
        <Kpi label="In the app today" value={n0(a.active_today)} sub={`${a.active_7} this week · ${a.active_30} this month`} onClick={() => onGo('activity')} />
        <Kpi label="Paying" value={n0(a.paying)} sub={`${a.trial} on trial · ${a.cancelled} cancelled`} good={a.paying > 0} />
        <Kpi label="Agents active" value={n0(a.active_in_period)} sub={`${pctTxt(pctOf(a.active_in_period, a.total))} of agents used it in ${inP(period)}`} />
        <Kpi label="Open house sign-ins" value={n0(h.signins)} onClick={() => onGo('signins')} />
        <Kpi label="Showcases made" value={n0(h.showcases)} sub={`${n0(h.guest_showcase_actions)} things clients did on them`} onClick={() => onGo('showcases')} />
        <Kpi label="New leads" value={n0(h.leads)} onClick={() => onGo('guests')} />
        <Kpi label="Client emails" value={n0(h.client_emails)} sub={`${pctTxt(h.client_open_rate)} opened · ${pctTxt(h.client_click_rate)} clicked`} onClick={() => onGo('emails')} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Agents in the app" sub={`How many agents used OpenHousePal each ${d.unit} - ${inP(period)}`}>
          <TrendChart data={d.series} unit={d.unit} series={[{ key: 'active', label: 'Agents in the app' }]} />
        </Card>
        <Card title="What's happening" sub={`Each ${d.unit} - ${inP(period)}`}>
          <TrendChart data={d.series} unit={d.unit} series={[{ key: 'signins', label: 'Sign-ins' }, { key: 'showcases', label: 'Showcases made' }, { key: 'leads', label: 'New leads' }]} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Plans" sub="Every agent, by plan">
          <BarList items={Object.entries(a.plans as Record<string, number>).map(([k, v]) => ({ label: k === 'NONE' ? 'No plan' : ({ NO_MLS: 'No-MLS', PRO_NO_MLS: 'Pro No-MLS', BASIC: 'Basic', PREMIUM: 'Premium', IDX: 'IDX' } as Record<string, string>)[k] || k, value: v })).sort((x, y) => y.value - x.value)} />
        </Card>
        <Card title="Look closer" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['signins', 'Sign-ins & forms', 'How long sign-ins take and how many finish'],
              ['showcases', 'Showcases', 'How many clients open them and keep using them'],
              ['emails', 'Emails', 'Everything sent - opened, clicked, bounced'],
              ['tools', 'Agent tools', 'Which tools each agent uses'],
              ['guests', 'Guests', 'What guests and clients do'],
              ['activity', 'Agent activity', 'One agent at a time, week by week'],
            ].map(([k, t, s]) => (
              <button key={k} onClick={() => onGo(k)} className="rounded-2xl border border-gray-100 p-3 text-left transition hover:border-[#C9A24D]/50 hover:bg-[#C9A24D]/[0.04] dark:border-gray-800">
                <p className="text-sm font-black text-[#111827] dark:text-white">{t}</p>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{s}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- sign-ins

export function SigninsPage({ d, period }: { d: D; period: string }) {
  const k = d.kpis, f = d.forms
  const cols: Col<any>[] = [
    { key: 'open_houses', label: 'Open houses', value: r => r.open_houses, num: true, hint: 'Held in this period' },
    { key: 'with_signins', label: 'Got sign-ins', value: r => r.with_signins, num: true, hint: 'Open houses with at least one sign-in' },
    { key: 'signins', label: 'Sign-ins', value: r => r.signins, num: true },
    { key: 'per_open_house', label: 'Per open house', value: r => r.per_open_house, num: true, render: r => r.per_open_house == null ? '-' : r.per_open_house },
    { key: 'completion', label: 'Finished', value: r => r.completion, num: true, render: r => pctTxt(r.completion), hint: 'Sign-ins out of times the form was opened' },
    { key: 'avg_seconds', label: 'Avg time', value: r => r.avg_seconds, num: true, render: r => secsTxt(r.avg_seconds) },
  ]
  const formCols: Col<any>[] = [
    { key: 'views', label: 'Opened', value: r => r.views, num: true },
    { key: 'started', label: 'Started', value: r => r.started, num: true },
    { key: 'finished', label: 'Finished', value: r => r.finished, num: true },
    { key: 'finish_rate', label: 'Finish rate', value: r => r.finish_rate, num: true, render: r => pctTxt(r.finish_rate) },
    { key: 'avg_seconds', label: 'Avg time', value: r => r.avg_seconds, num: true, render: r => secsTxt(r.avg_seconds) },
  ]
  return (
    <>
      <KpiGrid>
        <Kpi label="Sign-ins" value={n0(k.signins)} sub={`at ${n0(k.open_houses)} open houses held`} />
        <Kpi label="Avg time to sign in" value={secsTxt(k.avg_seconds)} sub={k.timed ? `Middle guest: ${secsTxt(k.median_seconds)} · ${n0(k.timed)} timed` : 'Timed from the next sign-in on'} />
        <Kpi label="Form finished" value={pctTxt(k.completion)} sub={`${n0(k.views)} times the form was opened`} />
        <Kpi label="Open houses with sign-ins" value={pctTxt(pctOf(k.open_houses_with_signins, k.open_houses))} sub={`${n0(k.open_houses_with_signins)} of ${n0(k.open_houses)} · ${k.per_open_house ?? '-'} per open house`} />
        <Kpi label="Already have an agent" value={pctTxt(k.has_agent)} sub="of guests who signed in" />
        <Kpi label="Got a Showcase" value={pctTxt(k.showcase_rate)} sub={`${n0(k.showcases_made)} Showcases made from sign-ins`} />
      </KpiGrid>
      {!k.timed && <Note>Sign-in timing is new: from now on every sign-in records how long the guest took, from first tapping the form to pressing Sign in. Older sign-ins weren't timed.</Note>}
      <Card title="Sign-ins" sub={`Each ${d.unit} - ${inP(period)}`}>
        <TrendChart data={d.series} unit={d.unit} series={[{ key: 'views', label: 'Form opened' }, { key: 'signins', label: 'Signed in' }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="How long it took" sub="From first tap to Sign in">
          <BarList items={d.durations.map((x: D) => ({ label: x.label, value: x.count }))} empty="No timed sign-ins yet" />
        </Card>
        <Card title="Where they signed in">
          <BarList items={d.modes.map((x: D) => ({ label: MODE[x.key] || x.key, value: x.count, sub: x.avg_seconds ? `avg ${secsTxt(x.avg_seconds)}` : undefined }))} />
        </Card>
        <Card title="Device">
          <BarList items={d.devices.map((x: D) => ({ label: DEVICE[x.key] || x.key, value: x.count }))} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Time of day" sub="Sign-ins by hour (Eastern)"><Columns values={d.hours} labels={HOURS} every={3} /></Card>
        <Card title="Day of the week" sub="Sign-ins by day"><Columns values={d.weekdays} labels={WEEKDAYS} /></Card>
      </div>
      <Card title="By agent" sub={`Open house sign-ins - ${inP(period)}`}>
        <AgentTable rows={d.agents} cols={cols} initialSort="signins" />
      </Card>

      <h3 className="pt-2 text-base font-black text-[#111827] dark:text-white">Agent Hub forms</h3>
      <KpiGrid>
        <Kpi label="Forms opened" value={n0(f.totals.views)} />
        <Kpi label="Started" value={n0(f.totals.started)} sub={`${pctTxt(pctOf(f.totals.started, f.totals.views))} of opens`} />
        <Kpi label="Finished" value={n0(f.totals.finished)} sub={`${pctTxt(f.totals.finish_rate)} of opens`} />
        <Kpi label="Avg time to finish" value={secsTxt(f.totals.avg_seconds)} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Forms funnel">
          <Funnel steps={[{ label: 'Opened the form', value: f.totals.views }, { label: 'Answered a question', value: f.totals.started }, { label: 'Sent it', value: f.totals.finished }]} />
        </Card>
        <Card title="By kind of form">
          <BarList items={f.types.map((x: D) => ({ label: formName(x.key), value: x.views, sub: `${pctTxt(x.finish_rate)} finish · ${secsTxt(x.avg_seconds)}` }))}
            valueText={v => `${n0(v)} opened`} />
        </Card>
      </div>
      <Card title="Forms by agent"><AgentTable rows={f.agents} cols={formCols} initialSort="views" empty="No form visits in this period" /></Card>
    </>
  )
}

// ---------------------------------------------------------------- showcases

export function ShowcasesPage({ d, period }: { d: D; period: string }) {
  const k = d.kpis
  const cols: Col<any>[] = [
    { key: 'total', label: 'Showcases', value: r => r.total, num: true, hint: 'All they have' },
    { key: 'made', label: 'Made', value: r => r.made, num: true, hint: 'Made in this period' },
    { key: 'used_rate', label: 'Opened by client', value: r => r.used_rate, num: true, render: r => r.total ? `${pctTxt(r.used_rate)} (${r.used})` : '-' },
    { key: 'active_7', label: 'In use this week', value: r => r.active_7, num: true },
    { key: 'asleep', label: 'Asleep', value: r => r.asleep, num: true },
    { key: 'client_actions', label: 'Client actions', value: r => r.client_actions, num: true, hint: 'Views, likes, passes, comments, tours, search changes' },
    { key: 'likes', label: 'Likes', value: r => r.likes, num: true },
    { key: 'tours', label: 'Tours', value: r => r.tours, num: true },
  ]
  return (
    <>
      <KpiGrid>
        <Kpi label="Showcases made" value={n0(k.made)} sub={`in ${inP(period)} · ${n0(k.total)} in all`} />
        <Kpi label="Opened by the client" value={pctTxt(k.made_used_rate)} sub={`${n0(k.made_used)} of the ${n0(k.made)} made · ${pctTxt(k.used_rate)} of all`} good={(k.made_used_rate ?? 0) >= 50} />
        <Kpi label="In use this week" value={n0(k.active_7)} sub={`${pctTxt(k.active_7_rate)} of ${n0(k.live)} switched on · ${n0(k.active_30)} this month`} />
        <Kpi label="Asleep" value={n0(k.asleep)} sub="No longer matching or emailing" />
        <Kpi label="Homes liked" value={n0(k.likes)} sub={`${n0(k.passes)} passed on`} />
        <Kpi label="Comments" value={n0(k.comments)} sub="from clients" />
        <Kpi label="Tour requests" value={n0(k.tours)} />
        <Kpi label="Showcase emails" value={n0(k.emails_sent)} sub={`${pctTxt(k.email_open_rate)} opened · ${pctTxt(k.email_click_rate)} clicked`} />
      </KpiGrid>
      <Card title="Showcases" sub={`Each ${d.unit} - ${inP(period)}`}>
        <TrendChart data={d.series} unit={d.unit} series={[{ key: 'made', label: 'Made' }, { key: 'client_actions', label: 'Things clients did' }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Do clients use them?" sub="Every Showcase, all time">
          <Funnel steps={[{ label: 'Showcases', value: k.total }, { label: 'Opened by the client', value: k.used }, { label: 'Used in the last 30 days', value: k.active_30 }, { label: 'Used this week', value: k.active_7 }]} />
        </Card>
        <Card title="How they were made" sub={inP(period)}>
          <BarList items={d.sources.map((x: D) => ({ label: SOURCE[x.key] || x.key, value: x.count }))} empty="None made in this period" />
        </Card>
        <Card title="Why they're asleep">
          <BarList items={d.asleep.map((x: D) => ({ label: ASLEEP[x.key] || x.key, value: x.count }))} empty="None asleep" />
        </Card>
      </div>
      <Card title="What clients did" sub={inP(period)}>
        <BarList items={[
          { label: 'Opened a home', value: k.views }, { label: 'Liked a home', value: k.likes }, { label: 'Passed on a home', value: k.passes },
          { label: 'Commented', value: k.comments }, { label: 'Asked for a tour', value: k.tours }, { label: 'Changed their search', value: k.search_changes },
        ]} empty="Nothing yet in this period" />
      </Card>
      <Card title="By agent"><AgentTable rows={d.agents} cols={cols} initialSort="total" /></Card>
    </>
  )
}

// ---------------------------------------------------------------- emails

export function EmailsPage({ d, period }: { d: D; period: string }) {
  const k = d.kpis, c = d.client
  const cols: Col<any>[] = [
    { key: 'to_agent', label: 'Emails to them', value: r => r.to_agent, num: true, hint: 'Alerts and briefings OpenHousePal sent the agent' },
    { key: 'client_sent', label: 'To their clients', value: r => r.client_sent, num: true },
    { key: 'open_rate', label: 'Opened', value: r => r.open_rate, num: true, render: r => pctTxt(r.open_rate) },
    { key: 'click_rate', label: 'Clicked', value: r => r.click_rate, num: true, render: r => pctTxt(r.click_rate) },
    { key: 'bounced', label: 'Bounced / spam', value: r => r.bounced, num: true },
    { key: 'mailbox', label: 'From own mailbox', value: r => r.mailbox, num: true, render: r => r.mailbox_connected ? `${n0(r.mailbox)} ✓` : n0(r.mailbox), hint: '✓ = Gmail / Outlook connected' },
  ]
  return (
    <>
      <KpiGrid>
        <Kpi label="Emails sent" value={n0(k.sent)} sub={`all kinds, ${inP(period)}`} />
        <Kpi label="Delivered" value={n0(k.delivered)} sub="Mailgun confirmed it arrived" />
        <Kpi label="Bounced" value={n0(k.bounced)} warn={k.bounced > 0} sub={`${n0(k.spam)} marked as spam`} />
        <Kpi label="Didn't send" value={n0(k.failed)} warn={k.failed > 0} />
        <Kpi label="Client emails" value={n0(c.sent)} sub={`${n0(c.via_mailbox)} from the agent's own mailbox`} />
        <Kpi label="Opened" value={pctTxt(c.opened_rate)} sub={`${n0(c.opened)} client emails opened`} good={(c.opened_rate ?? 0) >= 30} />
        <Kpi label="Clicked" value={pctTxt(c.clicked_rate)} sub={`${n0(c.clicked)} clicked a link`} />
        <Kpi label="Client bounces" value={pctTxt(c.bounced_rate)} warn={(c.bounced_rate ?? 0) > 2} sub={`${n0(c.bounced)} bounced · ${n0(c.spam)} spam`} />
      </KpiGrid>
      <Note>
        Opens and clicks are tracked on emails to agents&apos; clients (Showcase updates, sign-in thank-yous, tour confirmations...). Every email of any kind is counted
        {d.tracking_from ? ` since ${new Date(d.tracking_from).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ' from now on'}; client emails go back further.
        {k.held > 0 && ` ${n0(k.held)} were test emails held back on this computer (never sent).`}
      </Note>
      <Card title="Emails" sub={`Each ${d.unit} - ${inP(period)}`}>
        <TrendChart data={d.series} unit={d.unit} series={[{ key: 'client', label: 'Client emails sent' }, { key: 'opened', label: 'Opened' }, { key: 'clicked', label: 'Clicked' }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Who they went to">
          <BarList items={Object.entries(d.audiences as Record<string, D>).map(([key, v]) => ({ label: AUDIENCE[key] || key, value: v.sent + v.failed, sub: v.bounced ? `${v.bounced} bounced` : undefined }))} empty="No emails in this period" />
        </Card>
        <Card title="Client email funnel" sub={inP(period)}>
          <Funnel steps={[{ label: 'Sent', value: c.sent }, { label: 'Opened', value: c.opened }, { label: 'Clicked a link', value: c.clicked }]} />
        </Card>
      </div>
      <Card title="Every kind of email" sub="Opened and clicked only exist for tracked client emails">
        {/* Phones: one line per email kind instead of the 7-column table. */}
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800 sm:hidden">
          {d.templates.map((t: D) => (
            <li key={t.template} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[13px] font-black leading-snug text-[#111827] dark:text-white">{t.label}</p>
                <p className="shrink-0 text-[13px] font-black tabular-nums text-[#111827] dark:text-white">{n0(t.sent)} <span className="text-[10px] font-semibold text-gray-400">sent</span></p>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold capitalize text-gray-500 dark:text-gray-400">
                {t.audience}
                {t.failed ? ` · ${n0(t.failed)} didn't send` : ''}
                {t.bounced + t.spam ? ` · ${n0(t.bounced + t.spam)} bounced` : ''}
                {t.tracked ? ` · ${pctTxt(t.open_rate)} opened · ${pctTxt(t.click_rate)} clicked` : ''}
              </p>
            </li>
          ))}
          {!d.templates.length && <li className="px-3 py-8 text-center text-xs font-semibold text-gray-400">No emails in this period</li>}
        </ul>
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 max-sm:hidden">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-gray-50/80 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
              <tr>{['Email', 'To', 'Sent', "Didn't send", 'Bounced', 'Opened', 'Clicked'].map((h, i) => <th key={h} className={`px-3 py-2.5 font-black ${i > 1 ? 'text-right' : ''}`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.templates.map((t: D) => (
                <tr key={t.template} className="text-gray-700 dark:text-gray-200">
                  <td className="px-3 py-2.5 font-black text-[#111827] dark:text-white">{t.label}</td>
                  <td className="px-3 py-2.5 font-semibold capitalize">{t.audience}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(t.sent)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(t.failed)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n0(t.bounced + t.spam)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.tracked ? pctTxt(t.open_rate) : '-'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.tracked ? pctTxt(t.click_rate) : '-'}</td>
                </tr>
              ))}
              {!d.templates.length && <tr><td colSpan={7} className="px-3 py-8 text-center font-semibold text-gray-400">No emails in this period</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="By agent"><AgentTable rows={d.agents} cols={cols} initialSort="client_sent" /></Card>
    </>
  )
}

// ---------------------------------------------------------------- tools

export function ToolsPage({ d, period, onGo }: { d: D; period: string; onGo: (t: string) => void }) {
  const actions = d.features.filter((f: D) => f.kind === 'action')
  const results = d.features.filter((f: D) => f.kind === 'result')
  const used = [...actions].sort((a: D, b: D) => b.agents - a.agents || b.uses - a.uses)
  const cols: Col<any>[] = [
    { key: 'active_days', label: 'Days in app', value: r => r.active_days, num: true },
    { key: 'last_seen_at', label: 'Last seen', value: r => r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0, render: r => ago(r.last_seen_at) },
    { key: 'features_used', label: 'Tools used', value: r => r.features_used, num: true },
    { key: 'actions', label: 'Things done', value: r => r.actions, num: true },
    ...used.map((f: D) => ({ key: f.key, label: f.label, value: (r: D) => r.counts[f.key] || 0, num: true, render: (r: D) => r.counts[f.key] ? n0(r.counts[f.key]) : <span className="text-gray-300 dark:text-gray-600">-</span> })),
  ]
  const change = (f: D) => {
    if (f.prev_uses == null || (!f.prev_uses && !f.uses)) return null
    if (f.uses === f.prev_uses) return <span className="text-gray-400">same</span>
    const up = f.uses >= f.prev_uses
    const Icon = up ? TrendingUp : TrendingDown
    return <span className={`inline-flex items-center gap-0.5 ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}><Icon className="h-3 w-3" />{f.prev_uses ? pctTxt(Math.round(((f.uses - f.prev_uses) / f.prev_uses) * 100)) : 'new'}</span>
  }
  return (
    <>
      <Card title="Things agents did" sub={`Each ${d.unit} - ${inP(period)}`} action={<Link onClick={() => onGo('activity')}>One agent at a time</Link>}>
        <TrendChart data={d.series} unit={d.unit} series={[{ key: 'actions', label: 'Things agents did' }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tools, by how many agents use them" sub={`${inP(period)} - and the change from the period before`}>
          <ul className="space-y-2.5">
            {used.map((f: D) => (
              <li key={f.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-200">{f.label}</span>
                  <span className="flex shrink-0 items-baseline gap-2 font-semibold text-gray-500 dark:text-gray-400">
                    <span className="font-black tabular-nums text-[#111827] dark:text-white">{f.agents} agent{f.agents === 1 ? '' : 's'}</span>
                    {n0(f.uses)} uses {change(f)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${Math.max(f.agents ? 2 : 0, f.agents_rate || 0)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What came back to agents" sub={inP(period)}>
          <BarList items={results.map((f: D) => ({ label: f.label, value: f.uses, sub: `${f.agents} agent${f.agents === 1 ? '' : 's'}` })).sort((a: D, b: D) => b.value - a.value)}
            valueText={v => n0(v)} />
        </Card>
      </div>
      <Card title="Every agent, every tool" sub={`How many times each agent used each tool - ${inP(period)}. Scroll sideways for more.`}>
        <AgentTable rows={d.agents} cols={cols} initialSort="actions" />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- guests

export function GuestsPage({ d, period }: { d: D; period: string }) {
  const k = d.kpis
  const cols: Col<any>[] = [
    { key: 'total', label: 'All', value: r => r.total, num: true },
    { key: 'hub', label: 'Agent Hub visits', value: r => r.hub, num: true },
    { key: 'spotlight', label: 'Spotlight visits', value: r => r.spotlight, num: true },
    { key: 'signins', label: 'Sign-ins', value: r => r.signins, num: true },
    { key: 'forms', label: 'Forms sent', value: r => r.forms, num: true },
    { key: 'showcase', label: 'Showcase actions', value: r => r.showcase, num: true },
    { key: 'email_opens', label: 'Email opens', value: r => r.email_opens, num: true },
  ]
  return (
    <>
      <KpiGrid>
        <Kpi label="Agent Hub visits" value={n0(k.hub_visits)} sub={`${n0(k.hub_unique)} different people · ${n0(k.hub_clicks)} clicks`} />
        <Kpi label="Spotlight visits" value={n0(k.spotlight_visits)} sub={`${n0(k.spotlight_unique)} different people`} />
        <Kpi label="Blog reads" value={n0(k.blog_views)} sub={`${n0(k.blog_clicks)} clicks from posts`} />
        <Kpi label="Forms sent" value={n0(k.form_finished)} sub={`${n0(k.form_views)} opened · ${n0(k.form_started)} started`} />
        <Kpi label="Open house sign-ins" value={n0(k.signins)} sub={`${n0(k.signin_views)} times the form was opened`} />
        <Kpi label="Showcase homes opened" value={n0(k.showcase_views)} sub={`${n0(k.likes)} liked · ${n0(k.passes)} passed`} />
        <Kpi label="Tour requests" value={n0(k.tours)} sub={`${n0(k.comments)} comments · ${n0(k.search_changes)} search changes`} />
        <Kpi label="New leads" value={n0(k.new_leads)} sub={`${n0(k.email_opens)} email opens · ${n0(k.email_clicks)} clicks`} />
      </KpiGrid>
      <Card title="Visits" sub={`Each ${d.unit} - ${inP(period)}`}>
        <TrendChart data={d.series} unit={d.unit} series={[{ key: 'hub', label: 'Agent Hub' }, { key: 'spotlight', label: 'Spotlight' }, { key: 'showcase', label: 'Showcase actions' }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sign-ins and forms" sub={`Each ${d.unit}`}>
          <TrendChart data={d.series} unit={d.unit} height={170} series={[{ key: 'signins', label: 'Open house sign-ins' }, { key: 'forms', label: 'Forms sent' }]} />
        </Card>
        <Card title="Where new leads came from" sub={`First time we saw them - ${inP(period)}`}>
          <BarList items={d.origins.map((o: D) => ({ label: o.label, value: o.count }))} empty="No new leads in this period" />
        </Card>
      </div>
      <Card title="By agent" sub="What each agent's guests and clients did"><AgentTable rows={d.agents} cols={cols} initialSort="total" /></Card>
    </>
  )
}
