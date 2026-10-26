'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Activity, ArrowRight, Building2, Check, Globe, Home, Inbox, Loader2, Mail, ShieldCheck, Sparkles, TrendingDown, UserPlus, Users,
} from 'lucide-react'
import api, { type AdminDomainIssue } from '@/lib/api-service'
import type { AdminActivityOverview, BillingGroup, User } from '@/types'
import { timeAgo } from '@/lib/leadActivity'
import { AgentDrawer } from './AgentActivityPanel'
import { billingOf, PLAN_CHIP, PLAN_LABEL } from './AgentControlPanel'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export default function AdminOverviewPanel({ users, groups, supportUnread, questionsUnread, onGo, onApprove }: {
  users: User[]
  groups: BillingGroup[]
  supportUnread: number
  questionsUnread: number
  onGo: (tab: string) => void
  onApprove: (u: User) => Promise<void>
}) {
  const [act, setAct] = useState<AdminActivityOverview | null>(null)
  const [drawer, setDrawer] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  useEffect(() => { api.admin.getActivity().then(r => { if (r.success && r.data) setAct(r.data) }) }, [])
  // Agents whose own domain isn't working (the server checks them every few hours) - reach out.
  const [domainIssues, setDomainIssues] = useState<AdminDomainIssue[]>([])
  useEffect(() => { api.admin.getDomainIssues().then(r => { if (r.success && r.data) setDomainIssues(r.data.issues || []) }) }, [])

  const agents = useMemo(() => users.filter(u => !u.is_admin), [users])
  const groupsById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const pending = agents.filter(u => !u.broker_authorized)
  const pays = useMemo(() => {
    const c: Record<string, number> = { paypal: 0, group: 0, managed: 0, trial: 0, unpaid: 0 }
    for (const u of agents) c[billingOf(u, groupsById).kind]++
    return c
  }, [agents, groupsById])
  const newest = [...agents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
  const nudge = (act?.agents || []).filter(a => a.health === 'slipping' || a.health === 'inactive')
    .sort((a, b) => new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime()).slice(0, 5)
  const topUsed = [...(act?.adoption || [])].filter(a => a.kind === 'action').sort((a, b) => b.agents_30 - a.agents_30).slice(0, 5)
  const dropped = [...(act?.adoption || [])].filter(a => a.kind === 'action' && a.once + a.stopped > 0).sort((a, b) => (b.once + b.stopped) - (a.once + a.stopped)).slice(0, 5)
  const t = act?.totals

  return (
    <div className="space-y-5">
      {/* the numbers that matter */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Big icon={Users} label="Agents" value={agents.length} sub={`${pays.paypal + pays.group + pays.managed} paying · ${pays.trial} on trial`} onClick={() => onGo('agents')} />
        <Big icon={ShieldCheck} label="Waiting for approval" value={pending.length} warn={pending.length > 0} onClick={() => onGo('agents')} />
        <Big icon={Activity} label="In the app this week" value={t ? t.active_7 : '…'} sub={t ? `${pct(t.active_7, t.agents)}% of agents` : undefined} onClick={() => onGo('activity')} />
        <Big icon={Home} label="Open houses with sign-ins" value={t ? `${pct(t.open_houses_with_signins, t.open_houses_held)}%` : '…'} sub={t ? `${t.signins} sign-ins` : undefined} onClick={() => onGo('activity')} />
        <Big icon={Sparkles} label="Leads this month" value={t ? t.leads_30 : '…'} onClick={() => onGo('activity')} />
        <Big icon={Inbox} label="Unread messages" value={supportUnread + questionsUnread} sub={`${supportUnread} support · ${questionsUnread} questions`} warn={supportUnread + questionsUnread > 0} onClick={() => onGo(supportUnread ? 'support' : 'questions')} />
      </div>

      {domainIssues.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm dark:border-red-500/30 dark:bg-[#151517] sm:p-5">
          <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">
            <Globe className="h-4 w-4 text-red-500" /> Domains that aren&apos;t working
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-500/10 dark:text-red-300">{domainIssues.length}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">The agent sees this on their Dash too - a quick note from you usually gets it fixed.</p>
          <div className="mt-2 divide-y divide-gray-100 dark:divide-white/[0.06]">
            {domainIssues.map(i => (
              <div key={i.agent_id + i.hostname + i.code} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <button type="button" onClick={() => setDrawer(i.agent_id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[13px] font-black text-[#111827] dark:text-white">{i.agent_name}{i.brokerage ? <span className="font-semibold text-gray-400"> · {i.brokerage}</span> : null}</span>
                  <span className="block text-[12px] font-bold text-red-700 dark:text-red-300">{i.title}</span>
                  <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{i.fix}</span>
                </button>
                <a href={`mailto:${i.agent_email}?subject=${encodeURIComponent(`Quick fix for ${i.hostname}`)}&body=${encodeURIComponent(`Hi ${i.agent_name.split(' ')[0]},

Quick heads up - ${i.title}.

${i.fix}

Happy to help if you get stuck.`)}`}
                  className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-[#111827] px-2.5 py-1.5 max-sm:px-3.5 max-sm:py-2.5 text-[11px] font-black text-white hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827] sm:self-center">
                  <Mail className="h-3 w-3" /> Email {i.agent_name.split(' ')[0]}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* approvals */}
        <Card title="Waiting for approval" action={pending.length > 5 ? { label: `All ${pending.length}`, onClick: () => onGo('agents') } : undefined}>
          {pending.length === 0 ? <Empty icon={Check} text="Everyone's approved." /> : pending.slice(0, 5).map(u => (
            <Row key={u.id} title={`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} sub={`${u.brokerage || 'No brokerage'} · joined ${timeAgo(u.created_at).toLowerCase()}`}>
              <button disabled={approving === u.id} onClick={async () => { setApproving(u.id); await onApprove(u); setApproving(null) }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 max-sm:px-3.5 max-sm:py-2.5 text-[11px] font-black text-white hover:bg-[#C9A24D] disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                {approving === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Approve
              </button>
            </Row>
          ))}
        </Card>

        {/* nudges */}
        <Card title="Could use a nudge" action={{ label: 'Activity', onClick: () => onGo('activity') }}>
          {!act ? <Empty icon={Loader2} text="Loading..." spin /> : nudge.length === 0 ? <Empty icon={Check} text="Nobody's slipping right now." /> : nudge.map(a => (
            <Row key={a.id} title={a.name} sub={`Last in ${a.last_seen_at ? timeAgo(a.last_seen_at).toLowerCase() : 'never'}${a.tried_once.length ? ` · tried ${a.tried_once.length} thing${a.tried_once.length === 1 ? '' : 's'} once` : ''}`} onClick={() => setDrawer(a.id)}>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${a.health === 'inactive' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>{a.health === 'inactive' ? 'Inactive' : 'Slipping'}</span>
            </Row>
          ))}
        </Card>

        {/* newest */}
        <Card title="Newest agents" action={{ label: 'Agents', onClick: () => onGo('agents') }}>
          {newest.length === 0 ? <Empty icon={UserPlus} text="No agents yet." /> : newest.map(u => (
            <Row key={u.id} title={`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} sub={`Joined ${timeAgo(u.created_at).toLowerCase()} · ${billingOf(u, groupsById).label}`} onClick={() => setDrawer(u.id)}>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PLAN_CHIP[u.plan_tier || 'FREE']}`}>{PLAN_LABEL[u.plan_tier || 'FREE']}</span>
            </Row>
          ))}
        </Card>

        {/* how they pay */}
        <Card title="How agents pay">
          {([['paypal', 'Their own PayPal', 'bg-sky-500'], ['group', 'Brokerage groups', 'bg-[#C9A24D]'], ['managed', 'Managed (no PayPal)', 'bg-amber-400'], ['trial', 'Trial', 'bg-emerald-500'], ['unpaid', 'Not paying', 'bg-gray-300 dark:bg-white/20']] as const).map(([k, l, c]) => (
            <div key={k} className="py-1.5">
              <div className="flex justify-between text-xs font-bold"><span className="text-gray-600 dark:text-gray-300">{l}</span><span className="text-[#111827] dark:text-white">{pays[k]}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]"><div className={`h-full rounded-full ${c}`} style={{ width: `${pct(pays[k], agents.length)}%` }} /></div>
            </div>
          ))}
        </Card>

        {/* most used / dropped */}
        <Card title="Most used this month" action={{ label: 'All features', onClick: () => onGo('activity') }}>
          {!act ? <Empty icon={Loader2} text="Loading..." spin /> : topUsed.map(a => (
            <div key={a.key} className="flex items-center justify-between gap-2 py-1.5 text-xs font-bold">
              <span className="truncate text-gray-600 dark:text-gray-300">{a.label}</span>
              <span className="shrink-0 text-[#111827] dark:text-white">{a.agents_30} of {act.totals.agents}</span>
            </div>
          ))}
          {dropped.length > 0 && (
            <>
              <p className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400"><TrendingDown className="h-3 w-3" /> Tried, then dropped</p>
              {dropped.map(a => (
                <div key={a.key} className="flex items-center justify-between gap-2 py-1 text-xs font-bold">
                  <span className="truncate text-gray-600 dark:text-gray-300">{a.label}</span>
                  <span className="shrink-0 text-amber-700 dark:text-amber-300">{a.once + a.stopped}</span>
                </div>
              ))}
            </>
          )}
        </Card>

        {/* groups */}
        <Card title="Brokerage groups" action={{ label: groups.length ? 'Manage' : 'Set up', onClick: () => onGo('groups') }}>
          {groups.length === 0 ? <Empty icon={Building2} text="No brokerage deals yet." /> : groups.slice(0, 5).map(g => (
            <Row key={g.id} title={g.name} sub={`${g.members.length}${g.seats ? ` of ${g.seats}` : ''} ${(g.seats || g.members.length) === 1 ? 'agent' : 'agents'}${g.amount != null ? ` · $${g.amount.toLocaleString()}/${g.billing_cycle === 'monthly' ? 'mo' : g.billing_cycle === 'yearly' ? 'yr' : 'qtr'}` : ''}`} onClick={() => onGo('groups')}>
              <span className="text-[10px] font-black capitalize text-gray-400">{g.status}</span>
            </Row>
          ))}
        </Card>
      </div>

      <AnimatePresence>{drawer && <AgentDrawer id={drawer} onClose={() => setDrawer(null)} />}</AnimatePresence>
    </div>
  )
}

function Big({ icon: Icon, label, value, sub, warn, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; warn?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#151517] ${warn ? 'border-red-200 dark:border-red-500/30' : 'border-gray-100 hover:border-[#C9A24D]/40 dark:border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <Icon className={`h-4 w-4 ${warn ? 'text-red-500' : 'text-[#C9A24D]'}`} />
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${warn ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{sub}</p>}
    </button>
  )
}

function Card({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{title}</p>
        {action && <button onClick={action.onClick} className="inline-flex items-center gap-0.5 max-sm:-my-2 max-sm:py-2 max-sm:pl-2 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">{action.label} <ArrowRight className="h-3 w-3" /></button>}
      </div>
      {children}
    </div>
  )
}

function Row({ title, sub, onClick, children }: { title: string; sub: string; onClick?: () => void; children?: React.ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#111827] dark:text-white">{title}</span>
        <span className="block truncate text-[11px] font-semibold text-gray-400">{sub}</span>
      </span>
      {children}
    </>
  )
  return onClick
    ? <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter') onClick() }} className="-mx-2 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03]">{body}</div>
    : <div className="flex items-center gap-2 py-2">{body}</div>
}

function Empty({ icon: Icon, text, spin }: { icon: React.ComponentType<{ className?: string }>; text: string; spin?: boolean }) {
  return <p className="flex items-center gap-2 py-4 text-sm font-semibold text-gray-400"><Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} /> {text}</p>
}

