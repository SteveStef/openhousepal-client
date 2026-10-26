'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowLeft, Building2, Check, ChevronDown, Copy, Loader2, Mail, Phone, Plus, Receipt, Search, Trash2, UserMinus, Users, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import type { BillingGroup, BillingGroupInput, User } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { timeAgo } from '@/lib/leadActivity'
import { PLAN_CHIP, PLAN_LABEL } from './AgentControlPanel'
import { copyText } from '@/lib/copyText'

const CYCLE: Record<string, string> = { monthly: '/mo', quarterly: '/qtr', yearly: '/yr' }
const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }
const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  paused: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  ended: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400',
}
const money = (n?: number | null) => n == null ? '-' : `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const activeWeek = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 7 * 864e5

export default function BrokerageGroupsPanel({ users, groups, onChanged, onToast }: {
  users: User[]
  groups: BillingGroup[]
  onChanged: () => Promise<void> | void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const active = groups.filter(g => g.status === 'active')
  const covered = groups.reduce((n, g) => n + g.members.length, 0)
  const monthly = active.reduce((n, g) => n + (g.amount || 0) / (PER_MONTH[g.billing_cycle] || 1), 0)
  const doublePaying = groups.flatMap(g => g.members.filter(m => m.has_paypal_subscription))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><Building2 className="h-5 w-5 text-[#C9A24D]" /> Brokerage groups</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            Custom deals where a brokerage pays for its agents (invoiced through PayPal). Put the agents a deal covers in its group so you always know who it pays for.
          </p>
        </div>
        <button onClick={() => setOpenId('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-black dark:bg-white dark:text-[#111827]">
          <Plus className="h-4 w-4" /> New group
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active deals" value={active.length} />
        <Stat label="Agents covered" value={covered} />
        <Stat label="Brought in per month" value={money(Math.round(monthly))} sub="Active deals, any billing cycle" />
        <Stat label="May be paying twice" value={doublePaying.length} sub="In a group but still on their own PayPal" warn={doublePaying.length > 0} />
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
          <Building2 className="h-9 w-9 text-gray-300" />
          <p className="font-black text-gray-600 dark:text-gray-300">No brokerage groups yet</p>
          <p className="max-w-md text-sm font-semibold text-gray-400">Make one for each brokerage you have a custom deal with, then add the agents it pays for.</p>
          <button onClick={() => setOpenId('new')} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> New group</button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(g => {
            const inWeek = g.members.filter(m => activeWeek(m.last_seen_at)).length
            return (
              <button key={g.id} onClick={() => setOpenId(g.id)}
                className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-lg dark:border-gray-800 dark:bg-[#151517]">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-[#111827] dark:text-white">{g.name}</p>
                    <p className="truncate text-xs font-semibold text-gray-400">{g.brokerage || 'Brokerage not set'}{g.contact_name ? ` · ${g.contact_name}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${STATUS_CLS[g.status]}`}>{g.status}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Mini label="Agents" value={`${g.members.length}${g.seats ? ` / ${g.seats}` : ''}`} />
                  <Mini label="Deal" value={g.amount != null ? `${money(g.amount)}${CYCLE[g.billing_cycle]}` : '-'} />
                  <Mini label="Per agent" value={g.per_agent != null ? money(g.per_agent) : '-'} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  {g.plan_tier && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PLAN_CHIP[g.plan_tier]}`}>{PLAN_LABEL[g.plan_tier]}</span>}
                  <span>{inWeek} of {g.members.length} in the app this week</span>
                  {g.next_invoice_on && <span>· next invoice {new Date(g.next_invoice_on + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                  {g.members.some(m => m.has_paypal_subscription) && <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> someone may be paying twice</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {openId && (
          <GroupDrawer key={openId} group={openId === 'new' ? null : groups.find(g => g.id === openId) || null} users={users} groups={groups}
            onClose={() => setOpenId(null)} onSaved={async (g, created) => { await onChanged(); if (created && g) setOpenId(g.id) }} onToast={onToast} />
        )}
      </AnimatePresence>
    </div>
  )
}

export function Stat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-[#151517] ${warn ? 'border-red-200 dark:border-red-500/30' : 'border-gray-100 dark:border-gray-800'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${warn ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{sub}</p>}
    </div>
  )
}

export function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#faf9f7] px-3 py-2 dark:bg-white/[0.04]">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="truncate text-sm font-black text-[#111827] dark:text-white max-sm:whitespace-normal max-sm:text-[13px] max-sm:leading-tight">{value}</p>
    </div>
  )
}

export const FIELD = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'

function GroupDrawer({ group, users, groups, onClose, onSaved, onToast }: {
  group: BillingGroup | null; users: User[]; groups: BillingGroup[]
  onClose: () => void; onSaved: (g: BillingGroup | null, created: boolean) => Promise<void>
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [form, setForm] = useState<BillingGroupInput>(() => group ? {
    name: group.name, brokerage: group.brokerage, contact_name: group.contact_name, contact_email: group.contact_email, contact_phone: group.contact_phone,
    paypal_reference: group.paypal_reference, amount: group.amount, billing_cycle: group.billing_cycle, seats: group.seats, plan_tier: group.plan_tier,
    status: group.status, started_on: group.started_on, next_invoice_on: group.next_invoice_on, notes: group.notes,
  } : { name: '', billing_cycle: 'monthly', status: 'active', plan_tier: 'PREMIUM' })
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [applyPlan, setApplyPlan] = useState(true)
  const [confirm, setConfirm] = useState<'delete' | 'apply' | null>(null)
  // Agents just added who were paying through their own PayPal - it keeps charging them until cancelled there.
  const [paypalWarning, setPaypalWarning] = useState<{ id: string; name: string; subscription_id: string }[]>([])
  const set = (k: keyof BillingGroupInput, v: unknown) => setForm(f => ({ ...f, [k]: v === '' ? null : v }))

  const groupName = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups])
  const candidates = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!group || !s) return []
    return users.filter(u => !u.is_admin && u.billing_group_id !== group.id)
      .filter(u => [u.email, u.first_name, u.last_name, u.brokerage].some(v => (v || '').toLowerCase().includes(s))).slice(0, 8)
  }, [users, q, group])

  const save = async () => {
    if (!(form.name || '').trim()) { onToast('Give the group a name', 'error'); return }
    setSaving(true)
    const r = group ? await api.admin.updateGroup(group.id, form) : await api.admin.createGroup(form)
    setSaving(false)
    if (r.success && r.data) { onToast(group ? 'Group saved' : 'Group created - now add its agents', 'success'); await onSaved(r.data, !group) }
    else onToast(r.error || "Couldn't save the group", 'error')
  }
  const add = async () => {
    if (!group || !picked.size) return
    setSaving(true)
    const r = await api.admin.addGroupMembers(group.id, Array.from(picked), applyPlan)
    setSaving(false)
    if (r.success) {
      const twice = r.data?.had_paypal || []
      if (twice.length) setPaypalWarning(twice)
      else onToast(`Added ${picked.size} ${picked.size === 1 ? 'agent' : 'agents'}`, 'success')
      setPicked(new Set()); setQ(''); await onSaved(r.data || null, false)
    }
    else onToast(r.error || "Couldn't add them", 'error')
  }
  const remove = async (userId: string) => {
    if (!group) return
    const r = await api.admin.removeGroupMember(group.id, userId)
    if (r.success) { onToast('Taken out of the group - their plan is unchanged', 'success'); await onSaved(r.data || null, false) }
  }
  const doConfirm = async () => {
    if (!group) return
    setSaving(true)
    if (confirm === 'delete') {
      const r = await api.admin.deleteGroup(group.id)
      setSaving(false); setConfirm(null)
      if (r.success) { onToast('Group deleted', 'success'); await onSaved(null, false); onClose() }
      return
    }
    const r = await api.admin.applyGroupPlan(group.id)
    setSaving(false); setConfirm(null)
    if (r.success) { onToast(`Everyone in ${group.name} is on ${PLAN_LABEL[group.plan_tier || ''] || 'the group plan'}`, 'success'); await onSaved(r.data || null, false) }
    else onToast(r.error || "Couldn't apply the plan", 'error')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/50 max-sm:!m-0" onClick={onClose}>
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-[#111827] dark:hover:text-white max-sm:min-h-[44px] max-sm:pr-3"><ArrowLeft className="h-4 w-4" /> Groups</button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:bg-gray-100 max-sm:text-gray-600 dark:max-sm:bg-white/10 dark:max-sm:text-gray-200"><X className="h-4 w-4 max-sm:h-5 max-sm:w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <h3 className="text-2xl font-black text-[#111827] dark:text-white">{group ? group.name : 'New brokerage group'}</h3>

          <Box title="The deal">
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="Group name *"><input className={FIELD} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Compass - Main Line team" /></L>
              <L label="Brokerage"><input className={FIELD} value={form.brokerage || ''} onChange={e => set('brokerage', e.target.value)} placeholder="Compass" /></L>
              <L label="Plan its agents get">
                <Sel value={form.plan_tier || ''} onChange={v => set('plan_tier', v)} options={[['', 'No set plan'], ...['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX'].map(t => [t, PLAN_LABEL[t]])]} />
              </L>
              <L label="Status"><Sel value={form.status || 'active'} onChange={v => set('status', v)} options={[['active', 'Active'], ['paused', 'Paused'], ['ended', 'Ended']]} /></L>
              <L label="Amount they pay"><input className={FIELD} type="number" min={0} step="0.01" value={form.amount ?? ''} onChange={e => set('amount', e.target.value === '' ? null : Number(e.target.value))} placeholder="1500" /></L>
              <L label="Every"><Sel value={form.billing_cycle || 'monthly'} onChange={v => set('billing_cycle', v)} options={[['monthly', 'Month'], ['quarterly', 'Quarter'], ['yearly', 'Year']]} /></L>
              <L label="Seats in the deal"><input className={FIELD} type="number" min={0} value={form.seats ?? ''} onChange={e => set('seats', e.target.value === '' ? null : Number(e.target.value))} placeholder="Leave blank if no set number" /></L>
              <L label="PayPal invoice / reference"><input className={FIELD} value={form.paypal_reference || ''} onChange={e => set('paypal_reference', e.target.value)} placeholder="INV2-XXXX-XXXX" /></L>
              <L label="Started"><input className={FIELD} type="date" value={form.started_on || ''} onChange={e => set('started_on', e.target.value)} /></L>
              <L label="Next invoice"><input className={FIELD} type="date" value={form.next_invoice_on || ''} onChange={e => set('next_invoice_on', e.target.value)} /></L>
            </div>
          </Box>

          <Box title="Who to bill">
            <div className="grid gap-3 sm:grid-cols-3">
              <L label="Contact"><input className={FIELD} value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} placeholder="Managing broker" /></L>
              <L label="Email"><input className={FIELD} type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} /></L>
              <L label="Phone"><input className={FIELD} type="tel" value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} /></L>
            </div>
            <L label="Notes" className="mt-3"><textarea className={FIELD + ' min-h-[80px]'} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Anything about the deal - discounts, renewal terms..." /></L>
            {group?.paypal_reference && (
              <button onClick={() => copyText(group.paypal_reference!).then(() => onToast('Reference copied', 'success'))}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]"><Receipt className="h-3.5 w-3.5" /> Copy PayPal reference <Copy className="h-3 w-3" /></button>
            )}
          </Box>

          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {group ? 'Save changes' : 'Create group'}
            </button>
            {group && (
              <button onClick={() => setConfirm('delete')} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 dark:border-red-500/25 dark:text-red-300 dark:hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>

          {paypalWarning.length > 0 && (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
              <p className="flex items-center gap-2 text-sm font-black text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /> Cancel their own PayPal subscription</p>
              <p className="mt-1 text-xs font-semibold text-red-700/90 dark:text-red-300/90">
                These agents were paying through their own PayPal. They're now on the brokerage plan here, but PayPal will keep charging them until you cancel it in your PayPal dashboard:
              </p>
              <ul className="mt-2 space-y-1">
                {paypalWarning.map(w => (
                  <li key={w.id} className="flex flex-wrap items-center gap-2 text-xs font-bold text-red-800 dark:text-red-200">
                    {w.name} <code className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] dark:bg-black/30">{w.subscription_id}</code>
                    <button onClick={() => copyText(w.subscription_id).then(() => onToast('Subscription ID copied', 'success'))} className="inline-flex items-center gap-1 text-[11px] underline"><Copy className="h-3 w-3" /> Copy</button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setPaypalWarning([])} className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-black text-white">Done - I&apos;ll cancel it in PayPal</button>
            </div>
          )}

          {group && (
            <Box title={`Agents in this group (${group.members.length}${group.seats ? ` of ${group.seats} seats` : ''})`}>
              {group.members.length === 0 ? <p className="text-sm font-semibold text-gray-400">No agents yet - add them below.</p> : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
                  {group.members.map(m => (
                    <div key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{m.name}</p>
                        <p className="truncate text-[11px] font-semibold text-gray-400">{m.email} · {m.last_seen_at ? `in ${timeAgo(m.last_seen_at).toLowerCase()}` : 'not seen yet'}</p>
                        {m.has_paypal_subscription && <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> Still on their own PayPal subscription - cancel it in PayPal</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PLAN_CHIP[m.plan_tier || 'FREE']}`}>{PLAN_LABEL[m.plan_tier || 'FREE']}</span>
                      <button onClick={() => remove(m.id)} title="Take out of this group (plan unchanged)" aria-label="Take out of this group" className="rounded-lg p-1.5 max-sm:p-3 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><UserMinus className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              {group.plan_tier && group.members.some(m => m.plan_tier !== group.plan_tier || (m.subscription_status || '').toUpperCase() !== 'ACTIVE') && (
                <button onClick={() => setConfirm('apply')} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">
                  <Check className="h-3.5 w-3.5" /> Put everyone on {PLAN_LABEL[group.plan_tier]}
                </button>
              )}

              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-400">Add agents</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, email or brokerage" className={FIELD + ' pl-9'} />
                </div>
                {candidates.length > 0 && (
                  <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white dark:divide-white/[0.06] dark:border-white/[0.06] dark:bg-[#151517]">
                    {candidates.map(u => {
                      const on = picked.has(u.id)
                      return (
                        <label key={u.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                          <input type="checkbox" checked={on} onChange={() => setPicked(p => { const n = new Set(p); if (on) n.delete(u.id); else n.add(u.id); return n })} className="h-4 w-4 accent-[#C9A24D]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-[#111827] dark:text-white">{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</span>
                            <span className="block truncate text-[11px] text-gray-400">{u.email}{u.brokerage ? ` · ${u.brokerage}` : ''}{u.billing_group_id ? ` · now in ${groupName[u.billing_group_id] || 'another group'}` : ''}</span>
                          </span>
                          {u.subscription_id && <span className="shrink-0 text-[10px] font-black text-red-600 dark:text-red-400">Own PayPal</span>}
                        </label>
                      )
                    })}
                  </div>
                )}
                {q && candidates.length === 0 && <p className="mt-2 text-xs font-semibold text-gray-400">No agents match.</p>}
                {picked.size > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {group.plan_tier && (
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                        <input type="checkbox" checked={applyPlan} onChange={e => setApplyPlan(e.target.checked)} className="h-4 w-4 accent-[#C9A24D]" />
                        Give them {PLAN_LABEL[group.plan_tier]}, paid by the brokerage
                      </label>
                    )}
                    <button onClick={add} disabled={saving} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                      <Users className="h-3.5 w-3.5" /> Add {picked.size}
                    </button>
                  </div>
                )}
              </div>
            </Box>
          )}

          {group?.contact_email && (
            <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-500">
              <a href={`mailto:${group.contact_email}`} className="inline-flex items-center gap-1 hover:text-[#8b7355]"><Mail className="h-3.5 w-3.5" /> {group.contact_email}</a>
              {group.contact_phone && <a href={`tel:${group.contact_phone}`} className="inline-flex items-center gap-1 hover:text-[#8b7355]"><Phone className="h-3.5 w-3.5" /> {group.contact_phone}</a>}
            </div>
          )}
        </div>
      </motion.div>

      <ConfirmationModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={doConfirm} isLoading={saving}
        title={confirm === 'delete' ? `Delete ${group?.name}?` : `Put everyone on ${PLAN_LABEL[group?.plan_tier || ''] || 'the group plan'}?`}
        message={confirm === 'delete'
          ? 'The group and its deal details are removed. Its agents keep their accounts and current plans - change those on the Agents tab if the deal ended.'
          : 'Every agent in this group gets this plan, paid by the brokerage (no PayPal subscription on their account). This does not touch PayPal - cancel anyone\'s own PayPal subscription there.'}
        confirmText={confirm === 'delete' ? 'Delete group' : 'Yes, update everyone'} />
    </motion.div>
  )
}

export function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-gray-400">{title}</p>
      {children}
    </div>
  )
}

export function L({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">{label}</span>{children}</label>
}

export function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={FIELD + ' appearance-none pr-9'}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  )
}
