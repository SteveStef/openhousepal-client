'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Activity, Building2, Calendar, ChevronDown, FlaskConical, Hash, Mail, MapPin, RefreshCw, Search, ShieldAlert, ShieldCheck, Users,
} from 'lucide-react'
import api from '@/lib/api-service'
import type { BillingGroup, User } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import Pager from '@/components/ui/Pager'
import { timeAgo } from '@/lib/leadActivity'
import { AgentDrawer } from './AgentActivityPanel'

export const PLAN_TIERS = ['FREE', 'NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX'] as const
export const PLAN_LABEL: Record<string, string> = { FREE: 'No plan', NO_MLS: 'No-MLS', PRO_NO_MLS: 'Pro No-MLS', BASIC: 'Basic', PREMIUM: 'Premium', IDX: 'IDX' }
export const PLAN_CHIP: Record<string, string> = {
  IDX: 'bg-purple-600 text-white', PREMIUM: 'bg-[#C9A24D] text-white', BASIC: 'bg-blue-600 text-white',
  PRO_NO_MLS: 'bg-indigo-600 text-white', NO_MLS: 'bg-teal-600 text-white', FREE: 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300',
}

/** How an agent pays: their own PayPal, a brokerage group, a managed (admin-set) plan, a trial, or not at all. */
export function billingOf(u: Pick<User, 'subscription_id' | 'subscription_status' | 'plan_tier' | 'billing_group_id'>, groups: Record<string, BillingGroup>) {
  const status = (u.subscription_status || '').toUpperCase()
  if (u.billing_group_id && groups[u.billing_group_id]) return { kind: 'group', label: groups[u.billing_group_id].name, cls: 'bg-[#111827] text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]' }
  if (u.subscription_id) return { kind: 'paypal', label: status === 'ACTIVE' ? 'PayPal' : `PayPal · ${status.toLowerCase().replace('_', ' ')}`, cls: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25' }
  if (status === 'ACTIVE' && u.plan_tier) return { kind: 'managed', label: 'Managed (no PayPal)', cls: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25' }
  if (status === 'TRIAL') return { kind: 'trial', label: 'Trial', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25' }
  return { kind: 'unpaid', label: status ? status.toLowerCase().replace('_', ' ') : 'Not paying', cls: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400' }
}

type Access = 'all' | 'authorized' | 'pending'
type Billing = 'all' | 'paypal' | 'group' | 'managed' | 'trial' | 'unpaid'
type Sort = 'newest' | 'seen' | 'name'
const PAGE = 20

export default function AgentControlPanel({ users, setUsers, groups, onToast, onRefresh, onGroupsChanged }: {
  users: User[]
  setUsers: (u: User[]) => void
  groups: BillingGroup[]
  onToast: (message: string, type: 'success' | 'error') => void
  onRefresh: () => void
  onGroupsChanged: () => void
}) {
  const [q, setQ] = useState('')
  const [access, setAccess] = useState<Access>('all')
  const [plan, setPlan] = useState<string>('all')
  const [billing, setBilling] = useState<Billing>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [page, setPage] = useState(1)
  const [activityFor, setActivityFor] = useState<string | null>(null)
  const [planChange, setPlanChange] = useState<{ u: User; tier: string } | null>(null)
  const [groupChange, setGroupChange] = useState<{ u: User; groupId: string } | null>(null)
  const [testCopy, setTestCopy] = useState<{ u: User; sourceId: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const groupsById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const usersById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])
  const name = (u: User) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
  // Agents a test account can copy: real agents with an MLS ID.
  const copyable = useMemo(() => users.filter(u => !u.is_admin && u.mls_id && !u.test_copy_of_user_id)
    .sort((a, b) => name(a).localeCompare(name(b))), [users])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return users
      .filter(u => !u.is_admin)
      .filter(u => !s || [u.email, u.first_name, u.last_name, u.brokerage, u.mls_id, u.state].some(v => (v || '').toLowerCase().includes(s)))
      .filter(u => access === 'all' || (access === 'authorized' ? u.broker_authorized : !u.broker_authorized))
      .filter(u => plan === 'all' || (u.plan_tier || 'FREE') === plan)
      .filter(u => billing === 'all' || billingOf(u, groupsById).kind === billing)
      .sort({
        newest: (a: User, b: User) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        seen: (a: User, b: User) => new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime(),
        name: (a: User, b: User) => name(a).localeCompare(name(b)),
      }[sort])
  }, [users, q, access, plan, billing, sort, groupsById])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const cur = Math.min(page, pages)
  const resetPage = () => setPage(1)

  // Approve / take away access - always asked first (owner, 10/26: one tap on a phone took access away).
  const [authChange, setAuthChange] = useState<User | null>(null)
  const confirmAuth = async () => {
    if (!authChange) return
    setBusy(true)
    await toggleAuth(authChange)
    setBusy(false)
    setAuthChange(null)
  }
  const toggleAuth = async (u: User) => {
    const r = await api.admin.toggleAuthorization(u.id, !!u.broker_authorized)
    if (r.success) {
      setUsers(users.map(x => x.id === u.id ? { ...x, broker_authorized: !u.broker_authorized } : x))
      onToast(`${name(u)} ${u.broker_authorized ? 'no longer has access' : 'is approved'}`, 'success')
    } else onToast(r.error || "Couldn't change access", 'error')
  }

  const confirmPlan = async () => {
    if (!planChange) return
    setBusy(true)
    const { u, tier } = planChange
    const r = await api.admin.updatePlanTier(u.id, tier)
    if (r.success) {
      setUsers(users.map(x => x.id === u.id ? { ...x, plan_tier: tier === 'FREE' ? undefined : tier, subscription_status: tier === 'FREE' ? 'PENDING_PAYMENT' : 'ACTIVE', subscription_id: undefined } : x))
      onToast(`${name(u)} is now on ${PLAN_LABEL[tier]}`, 'success')
    } else onToast(r.error || "Couldn't change the plan", 'error')
    setBusy(false); setPlanChange(null)
  }

  const confirmGroup = async () => {
    if (!groupChange) return
    setBusy(true)
    const { u, groupId } = groupChange
    const r = groupId
      ? await api.admin.addGroupMembers(groupId, [u.id], true)
      : await api.admin.removeGroupMember(u.billing_group_id!, u.id)
    if (r.success) {
      const g = groupId ? groupsById[groupId] : null
      setUsers(users.map(x => x.id === u.id ? {
        ...x, billing_group_id: groupId || null,
        ...(g?.plan_tier ? { plan_tier: g.plan_tier, subscription_status: 'ACTIVE', subscription_id: undefined } : {}),
      } : x))
      onGroupsChanged()
      const twice = groupId ? r.data?.had_paypal || [] : []
      if (twice.length) onToast(`${name(u)} added to ${g?.name} - cancel their own PayPal subscription (${twice[0].subscription_id}) in PayPal so they aren't charged twice`, 'error')
      else onToast(groupId ? `${name(u)} added to ${g?.name}` : `${name(u)} taken out of their group`, 'success')
    } else onToast(r.error || "Couldn't change their group", 'error')
    setBusy(false); setGroupChange(null)
  }

  const confirmTestCopy = async () => {
    if (!testCopy) return
    setBusy(true)
    const { u, sourceId } = testCopy
    const r = await api.admin.setTestCopy(u.id, sourceId)
    if (r.success) {
      setUsers(users.map(x => x.id === u.id ? {
        ...x, test_copy_of_user_id: r.data?.test_copy_of_user_id ?? null, mls_id: r.data?.mls_id ?? undefined,
        ...(sourceId ? { broker_authorized: true } : {}),
      } : x))
      onToast(sourceId ? `${name(u)} is now a test copy of ${name(usersById[sourceId])}` : `${name(u)} is no longer a test copy`, 'success')
      setTestCopy(null)
    } else onToast(r.error || "Couldn't change the test copy", 'error')
    setBusy(false)
  }

  const selectCls = 'appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-8 text-xs font-bold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        <div className="relative min-w-[220px] flex-[2] basis-full sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); resetPage() }} placeholder="Search name, email, brokerage, MLS ID or state"
            className="w-full rounded-xl border border-gray-200 bg-[#faf9f7] py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] focus:bg-white dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
        </div>
        {([
          [access, (v: string) => setAccess(v as Access), [['all', 'Access: all'], ['authorized', 'Approved'], ['pending', 'Waiting for approval']]],
          [plan, setPlan, [['all', 'Plan: any'], ...PLAN_TIERS.map(t => [t, PLAN_LABEL[t]])]],
          [billing, (v: string) => setBilling(v as Billing), [['all', 'Pays: any way'], ['paypal', 'Own PayPal'], ['group', 'Brokerage group'], ['managed', 'Managed (no PayPal)'], ['trial', 'Trial'], ['unpaid', 'Not paying']]],
          [sort, (v: string) => setSort(v as Sort), [['newest', 'Newest first'], ['seen', 'Last in the app'], ['name', 'Name A-Z']]],
        ] as [string, (v: string) => void, string[][]][]).map(([value, set, opts], i) => (
          <label key={i} className="relative min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none">
            <select value={value} onChange={e => { set(e.target.value); resetPage() }} className={`w-full ${selectCls} max-sm:min-h-[44px]`}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </label>
        ))}
        <button onClick={onRefresh} title="Reload agents" className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 max-sm:min-h-[44px] max-sm:w-full max-sm:gap-1.5 max-sm:text-xs max-sm:font-black">
          <RefreshCw className="h-4 w-4" /><span className="sm:hidden">Reload agents</span>
        </button>
      </div>

      <p className="px-1 text-xs font-bold text-gray-400">{list.length} {list.length === 1 ? 'agent' : 'agents'}</p>

      <div className="space-y-2">
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center dark:border-gray-800">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-sm font-black text-gray-500">No agents match</p>
            <button onClick={() => { setQ(''); setAccess('all'); setPlan('all'); setBilling('all') }} className="text-xs font-black text-[#8b7355] hover:underline">Clear filters</button>
          </div>
        )}
        {list.slice((cur - 1) * PAGE, cur * PAGE).map(u => {
          const b = billingOf(u, groupsById)
          const tier = u.plan_tier || 'FREE'
          return (
            <div key={u.id} className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/15 text-sm font-black uppercase text-[#8b7355] dark:text-[#e8c97a]">
                  {(u.first_name?.[0] || u.email[0])}{u.last_name?.[0] || ''}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-black text-[#111827] dark:text-white">{name(u)}</p>
                    {!u.broker_authorized && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600 dark:bg-red-500/10 dark:text-red-300">Waiting for approval</span>}
                    {u.test_copy_of_user_id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                        <FlaskConical className="h-3 w-3" /> Test copy of {usersById[u.test_copy_of_user_id] ? name(usersById[u.test_copy_of_user_id]) : 'an agent'}
                      </span>
                    )}
                  </div>
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-gray-400"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{u.email}</span></p>
                </div>
              </div>
              <div className="min-w-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <p className="flex items-center gap-1 truncate font-bold text-[#111827] dark:text-gray-200"><Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {u.brokerage || 'No brokerage given'}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  {u.state && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{u.state}</span>}
                  {u.mls_id && <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{u.mls_id}</span>}
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </p>
                <p className="mt-0.5">Last in the app: <b className="text-[#111827] dark:text-gray-200">{u.last_seen_at ? timeAgo(u.last_seen_at) : 'not since tracking began'}</b></p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end max-sm:grid max-sm:grid-cols-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${b.cls} max-sm:col-span-2 max-sm:justify-self-start`} title="How they pay">{b.label}</span>
                <label className="relative max-sm:block max-sm:min-w-0">
                  <select value={tier} onChange={e => e.target.value !== tier && setPlanChange({ u, tier: e.target.value })} aria-label="Plan"
                    className={`appearance-none rounded-xl py-2 pl-3 pr-7 text-[11px] font-black outline-none ${PLAN_CHIP[tier]} max-sm:min-h-[44px] max-sm:w-full`}>
                    {PLAN_TIERS.map(t => <option key={t} value={t} className="bg-white text-[#111827]">{PLAN_LABEL[t]}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
                </label>
                <label className="relative max-sm:block max-sm:min-w-0">
                  <select value={u.billing_group_id || ''} onChange={e => setGroupChange({ u, groupId: e.target.value })} aria-label="Brokerage group"
                    className={selectCls + ' py-2 text-[11px] max-sm:min-h-[44px] max-sm:w-full'}>
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                </label>
                {(u.test_copy_of_user_id || !u.mls_id) && (
                  <button onClick={() => setTestCopy({ u, sourceId: u.test_copy_of_user_id || '' })} title="Make this a test account that shares a real agent's MLS ID and data"
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black text-gray-600 hover:border-violet-300 hover:text-violet-700 dark:border-gray-700 dark:text-gray-300 max-sm:min-h-[44px] max-sm:justify-center">
                    <FlaskConical className="h-3.5 w-3.5" /> Test copy
                  </button>
                )}
                <button onClick={() => setActivityFor(u.id)} title="What they've been doing"
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300 max-sm:min-h-[44px] max-sm:justify-center">
                  <Activity className="h-3.5 w-3.5" /> Activity
                </button>
                <button onClick={() => setAuthChange(u)}
                  className={`group/a inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition max-sm:min-h-[44px] max-sm:justify-center ${(u.test_copy_of_user_id || !u.mls_id) ? 'max-sm:col-span-2' : ''} ${u.broker_authorized
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-[#111827] text-white hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827]'}`}>
                  {u.broker_authorized ? (
                    <><span className="inline-flex items-center gap-1 group-hover/a:hidden"><ShieldCheck className="h-3.5 w-3.5" /> Approved</span>
                      <span className="hidden items-center gap-1 group-hover/a:inline-flex"><ShieldAlert className="h-3.5 w-3.5" /> Revoke</span></>
                  ) : <><ShieldCheck className="h-3.5 w-3.5" /> Approve</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <Pager page={cur} pages={pages} onChange={n => setPage(Math.min(Math.max(1, n), pages))} />

      <ConfirmationModal
        isOpen={!!authChange}
        onClose={() => setAuthChange(null)}
        onConfirm={confirmAuth}
        title={authChange?.broker_authorized ? `Take away ${name(authChange)}'s access?` : `Approve ${authChange ? name(authChange) : ''}?`}
        message={authChange?.broker_authorized
          ? 'They lose access to OpenHousePal right away and go back to "waiting for approval". Their account, data and plan stay - you can approve them again any time.'
          : "They get an email saying they're approved and can pick their plan."}
        confirmText={authChange?.broker_authorized ? 'Yes, take away access' : 'Yes, approve'}
        isLoading={busy}
      />
      <ConfirmationModal
        isOpen={!!planChange}
        onClose={() => setPlanChange(null)}
        onConfirm={confirmPlan}
        title={`Change ${planChange ? name(planChange.u) : ''}'s plan to ${planChange ? PLAN_LABEL[planChange.tier] : ''}?`}
        message={`This ONLY updates OpenHousePal. It does NOT cancel or change their PayPal subscription.${planChange?.u.subscription_id ? ' This agent HAS a PayPal subscription - manage it in PayPal too, or they may keep being charged.' : ''} Use this for manual overrides and brokerage-paid agents.`}
        confirmText="Yes, change plan"
        isLoading={busy}
      />
      <ConfirmationModal
        isOpen={!!groupChange}
        onClose={() => setGroupChange(null)}
        onConfirm={confirmGroup}
        title={groupChange?.groupId ? `Add ${name(groupChange.u)} to ${groupsById[groupChange.groupId]?.name}?` : `Take ${groupChange ? name(groupChange.u) : ''} out of their group?`}
        message={groupChange?.groupId
          ? `${groupsById[groupChange.groupId]?.plan_tier ? `They'll get the group's ${PLAN_LABEL[groupsById[groupChange.groupId].plan_tier!]} plan, paid by the brokerage (no PayPal on their account).` : 'Their plan stays as it is (the group has no plan set).'}${groupChange.u.subscription_id ? ' They still have their own PayPal subscription - cancel it in PayPal so they aren\'t charged twice.' : ''}`
          : 'Their plan stays as it is - change it here if the brokerage stops paying for them.'}
        confirmText={groupChange?.groupId ? 'Add to group' : 'Take out'}
        isLoading={busy}
      />
      <ConfirmationModal
        isOpen={!!testCopy}
        onClose={() => setTestCopy(null)}
        onConfirm={confirmTestCopy}
        title={testCopy ? `Test copy: ${name(testCopy.u)}` : ''}
        message="A test copy gets the chosen agent's MLS ID, so it shows their listings, sales and open houses - for trying OpenHousePal with real data. Notices about those listings still go to the real agent. Choose no one to stop it (the MLS ID comes off this account)."
        confirmText={testCopy?.sourceId ? 'Make test copy' : 'Stop test copy'}
        isLoading={busy}
      >
        {testCopy && (
          <label className="relative block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-gray-400">Copy this agent</span>
            <select id="test-copy-source" value={testCopy.sourceId} onChange={e => setTestCopy({ ...testCopy, sourceId: e.target.value })} className={`w-full ${selectCls}`}>
              <option value="">No one (not a test copy)</option>
              {copyable.filter(s => s.id !== testCopy.u.id).map(s => <option key={s.id} value={s.id}>{name(s)} · MLS {s.mls_id}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-3 right-2.5 h-3.5 w-3.5 text-gray-400" />
          </label>
        )}
      </ConfirmationModal>
      <AnimatePresence>{activityFor && <AgentDrawer id={activityFor} onClose={() => setActivityFor(null)} />}</AnimatePresence>
    </div>
  )
}
