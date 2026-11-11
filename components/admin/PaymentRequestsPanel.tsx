'use client'

// Admin > People > Payments: custom payment requests. Pick who it's for (a brokerage group, one
// agent, or anyone by name + email), the price, one time or recurring and how often, the plan it
// gives and how many people it covers - then email the pay link or copy it. The payer pays with any
// card once at /pay/<token> and it charges by itself (backend payment_request_service.py).
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowLeft, Building2, Check, CheckCircle2, Copy, ExternalLink, Loader2, Mail, MoreHorizontal, Pencil, SlidersHorizontal, Plus, Receipt, RefreshCw, Search, Trash2, User as UserIcon, UserPlus, X, XCircle,
} from 'lucide-react'
import api from '@/lib/api-service'
import type { BillingGroup, PaymentCycle, PaymentRequest, PaymentRequestInput, User } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { copyText } from '@/lib/copyText'
import { PLAN_LABEL } from './AgentControlPanel'
import { Box, FIELD, L, Sel, Stat } from './BrokerageGroupsPanel'

const CYCLES: [PaymentCycle, string][] = [['once', 'One time'], ['monthly', 'Monthly'], ['quarterly', '3 months'], ['semiannual', '6 months'], ['yearly', 'Yearly']]
const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }
const EVERY_WORDS: Record<string, string> = { once: 'one time', monthly: 'every month', quarterly: 'every 3 months', semiannual: 'every 6 months', yearly: 'every year' }
const STATUS: Record<string, [string, string]> = {
  open: ['Waiting to pay', 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'],
  active: ['Active - charging', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  paid: ['Paid', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  past_due: ['Card failed', 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'],
  cancelled: ['Cancelled', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
  ended: ['Finished', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
}
const money = (n?: number | null) => n == null ? '-' : `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const shortDay = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''

export default function PaymentRequestsPanel({ users, groups, onToast, onGroupsChanged }: {
  users: User[]
  groups: BillingGroup[]
  onToast: (message: string, type: 'success' | 'error') => void
  onGroupsChanged: () => Promise<void> | void
}) {
  const [rows, setRows] = useState<PaymentRequest[] | null>(null)
  const [open, setOpen] = useState<PaymentRequest | 'new' | null>(null)
  const [made, setMade] = useState<PaymentRequest | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'cancel' | 'delete'; req: PaymentRequest } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [changing, setChanging] = useState<PaymentRequest | null>(null)

  const load = async () => {
    const r = await api.admin.getPaymentRequests()
    if (r.success && r.data) setRows(r.data)
    else { setRows([]); onToast(r.error || "Couldn't load payment requests", 'error') }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const put = (r: PaymentRequest) => setRows(prev => (prev || []).some(x => x.id === r.id) ? (prev || []).map(x => x.id === r.id ? r : x) : [r, ...(prev || [])])
  const list = rows || []
  const waiting = list.filter(r => r.status === 'open').length
  const charging = list.filter(r => r.status === 'active')
  const perMonth = charging.reduce((n, r) => n + r.amount / (PER_MONTH[r.cycle] || 1), 0)
  const failed = list.filter(r => r.status === 'past_due').length

  const act = async (req: PaymentRequest, what: 'send' | 'refresh') => {
    setBusy(req.id + what)
    const r = what === 'send' ? await api.admin.sendPaymentRequest(req.id) : await api.admin.refreshPaymentRequest(req.id)
    setBusy(null)
    if (r.success && r.data) { put(r.data); onToast(what === 'send' ? `Emailed to ${req.payer_email}` : 'Up to date with PayPal', 'success') }
    else onToast(r.error || 'That didn’t work - try again', 'error')
  }
  const doConfirm = async () => {
    if (!confirm) return
    setBusy(confirm.req.id + confirm.kind)
    if (confirm.kind === 'cancel') {
      const r = await api.admin.cancelPaymentRequest(confirm.req.id)
      if (r.success && r.data) { put(r.data); onToast('Cancelled - no more charges', 'success') } else onToast(r.error || "Couldn't cancel", 'error')
    } else {
      const r = await api.admin.deletePaymentRequest(confirm.req.id)
      if (r.success) { setRows(prev => (prev || []).filter(x => x.id !== confirm.req.id)); onToast('Deleted', 'success') } else onToast(r.error || "Couldn't delete", 'error')
    }
    setBusy(null); setConfirm(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><Receipt className="h-5 w-5 text-[#C9A24D]" /> Payment requests</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            Any deal, any price: one time, or charged automatically every month, 3 months, 6 months or year. They pay with any debit or credit card once - no PayPal account needed.
          </p>
        </div>
        <button onClick={() => setOpen('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-black max-sm:w-full max-sm:justify-center max-sm:py-3 dark:bg-white dark:text-[#111827]">
          <Plus className="h-4 w-4" /> New payment request
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting to pay" value={waiting} />
        <Stat label="Charging" value={charging.length} sub="Card on file, automatic" />
        <Stat label="Per month" value={money(Math.round(perMonth))} sub="From what's charging" />
        <Stat label="Card failed" value={failed} sub={failed ? 'They were emailed' : 'All good'} warn={failed > 0} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
          <Receipt className="h-9 w-9 text-gray-300" />
          <p className="font-black text-gray-600 dark:text-gray-300">No payment requests yet</p>
          <p className="max-w-md text-sm font-semibold text-gray-400">Make one for a brokerage deal, a team, or a single agent - you get a link to email or text them.</p>
          <button onClick={() => setOpen('new')} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> New payment request</button>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(sec => {
            const items = list.filter(r => sec.statuses.includes(r.status))
            if (!items.length) return null
            const hidden = sec.key === 'done' && !showDone
            return (
              <section key={sec.key}>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${sec.dot}`} />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{sec.label} · {items.length}</h3>
                  {sec.key === 'done' && (
                    <button onClick={() => setShowDone(v => !v)} className="ml-auto text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">{showDone ? 'Hide' : 'Show'}</button>
                  )}
                </div>
                {!hidden && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map(r => (
                      <RequestCard key={r.id} r={r} busy={busy} onToast={onToast} onSend={() => act(r, 'send')} onRefresh={() => act(r, 'refresh')}
                        onEdit={() => setOpen(r)} onChange={() => setChanging(r)} onStop={() => setConfirm({ kind: 'cancel', req: r })} onDelete={() => setConfirm({ kind: 'delete', req: r })} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <RequestDrawer key={open === 'new' ? 'new' : open.id} req={open === 'new' ? null : open} existing={list} users={users} groups={groups} onToast={onToast}
            onClose={() => setOpen(null)}
            onSaved={async (r, created) => { put(r); setOpen(null); if (created) setMade(r); await onGroupsChanged() }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {made && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 max-sm:!m-0" onClick={() => setMade(null)}>
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl dark:bg-[#151517]">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              <h3 className="mt-2 text-xl font-black text-[#111827] dark:text-white">Payment request ready</h3>
              <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                {made.emailed ? `Emailed to ${made.payer_email}. ` : made.emailed === false ? 'The email didn’t go out - send the link yourself. ' : ''}
                {made.price_line} - they pay once with a card{made.cycle !== 'once' ? ' and it charges by itself after that' : ''}.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#faf9f7] p-2 pl-3 dark:border-gray-700 dark:bg-black/30">
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-600 dark:text-gray-300">{made.link}</span>
                <button onClick={() => copyText(made.link).then(() => onToast('Pay link copied', 'success'))} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]"><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
              <button onClick={() => setMade(null)} className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-black text-gray-600 dark:border-gray-700 dark:text-gray-300">Done</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {changing && <ChangeDeal key={changing.id} r={changing} onClose={() => setChanging(null)} onToast={onToast}
          onSaved={async r => { put(r); setChanging(null); await onGroupsChanged() }} />}
      </AnimatePresence>

      <ConfirmationModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={doConfirm} isLoading={!!busy}
        title={confirm?.kind === 'cancel' ? `Stop charging for “${confirm.req.title}”?` : `Delete “${confirm?.req.title}”?`}
        message={confirm?.kind === 'cancel'
          ? 'Their card is never charged again (PayPal cancels it now). Payments already made stay paid, and nobody’s plan changes - switch plans on the Agents tab if the deal ended. This can’t be undone; make a new request to start again.'
          : 'The link stops working. Nobody has paid it, so nothing else changes.'}
        confirmText={confirm?.kind === 'cancel' ? 'Yes, stop charging' : 'Delete'} />
    </div>
  )
}

const SECTIONS = [
  { key: 'attention', label: 'Needs attention', statuses: ['past_due'], dot: 'bg-red-500' },
  { key: 'waiting', label: 'Waiting to pay', statuses: ['open'], dot: 'bg-sky-500' },
  { key: 'charging', label: 'Charging', statuses: ['active', 'paid'], dot: 'bg-emerald-500' },
  { key: 'done', label: 'Finished', statuses: ['cancelled', 'ended'], dot: 'bg-gray-300 dark:bg-gray-600' },
]

const CHIP_BTN = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition disabled:opacity-50 max-sm:min-h-[42px] max-sm:flex-1'

function RequestCard({ r, busy, onToast, onSend, onRefresh, onEdit, onChange, onStop, onDelete }: {
  r: PaymentRequest; busy: string | null
  onToast: (message: string, type: 'success' | 'error') => void
  onSend: () => void; onRefresh: () => void; onEdit: () => void; onChange: () => void; onStop: () => void; onDelete: () => void
}) {
  const [label, cls] = STATUS[r.status] || STATUS.open
  const who = r.group_name || r.user_name || r.payer_name || r.payer_email || 'No payer set'
  const payable = r.status === 'open' || r.status === 'past_due'
  const finished = r.status === 'cancelled' || r.status === 'ended'
  const failed = r.status === 'past_due'
  const menu: MenuItem[] = [
    ...(r.status === 'active' || r.status === 'past_due' || r.status === 'paid' ? [{ label: 'Change the deal', icon: SlidersHorizontal, onClick: onChange }] : []),
    { label: 'Open pay page', icon: ExternalLink, href: r.link },
    ...(r.paypal_subscription_id ? [{ label: 'Check PayPal now', icon: RefreshCw, onClick: onRefresh }] : []),
    ...(r.status === 'open' && !r.paypal_subscription_id ? [{ label: 'Edit', icon: Pencil, onClick: onEdit }] : []),
    ...((r.status === 'open' || r.status === 'active' || r.status === 'past_due') && (r.paypal_subscription_id || r.payments_count > 0)
      ? [{ label: 'Stop charging', icon: XCircle, onClick: onStop, danger: true }] : []),
    ...(!r.paypal_subscription_id && r.payments_count === 0 && r.status !== 'cancelled' ? [{ label: 'Delete', icon: Trash2, onClick: onDelete, danger: true }] : []),
  ]
  return (
    <div className={`relative min-w-0 rounded-3xl border p-5 shadow-sm transition max-sm:p-4 ${failed
      ? 'border-red-200 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/[0.06]'
      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'} ${finished ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${failed ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-[#C9A24D]/12 text-[#8b7355] dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]'}`}>
          {r.group_name ? <Building2 className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[15px] font-black leading-snug text-[#111827] dark:text-white">{r.title}</p>
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${cls}`}>{label}</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">{who}{r.payer_email && who !== r.payer_email ? ` · ${r.payer_email}` : ''}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="text-[26px] font-black leading-none tracking-tight text-[#111827] dark:text-white">
          {money(r.amount)}<span className="ml-1.5 text-sm font-bold tracking-normal text-gray-400">{CYCLE_SHORT[r.cycle]}{r.cycle !== 'once' && r.total_payments ? ` · ${r.total_payments} payments` : ''}</span>
        </p>
        {r.payments_count > 0 && (
          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">{money(r.amount_paid_total)} in · {r.payments_count} paid</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.plan_tier && <Pill>{PLAN_LABEL[r.plan_tier]}</Pill>}
        {r.seats ? <Pill>{r.seats} {r.seats === 1 ? 'person' : 'people'}</Pill> : null}
        {r.next_charge_at && r.status === 'active' && <Pill>Next charge {shortDay(r.next_charge_at)}</Pill>}
        {r.status === 'open' && <Pill>{r.sent_at ? `Emailed ${shortDay(r.sent_at)}${r.sent_count > 1 ? ` · ${r.sent_count}x` : ''}` : 'Not emailed yet'}</Pill>}
        {r.status === 'cancelled' && r.cancelled_at && <Pill>Stopped {shortDay(r.cancelled_at)}</Pill>}
      </div>

      {failed && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-red-100/70 px-3 py-2 text-xs font-bold text-red-800 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> Their card didn’t go through{r.next_charge_at ? ` (${shortDay(r.next_charge_at)})` : ''}. They were emailed to put in a new card at the same link - plans are unchanged until you decide.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3.5 dark:border-white/[0.06]">
        <button onClick={() => copyText(r.link).then(() => onToast('Pay link copied', 'success'))}
          className={`${CHIP_BTN} bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]`}>
          <Copy className="h-3.5 w-3.5" /> Copy link
        </button>
        {payable && r.payer_email && (
          <button onClick={onSend} disabled={busy === r.id + 'send'}
            className={`${CHIP_BTN} border border-gray-200 text-gray-700 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-200`}>
            {busy === r.id + 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} {r.sent_at ? 'Email again' : 'Email it'}
          </button>
        )}
        <MoreMenu items={menu} busy={busy === r.id + 'refresh'} />
      </div>
    </div>
  )
}

const CYCLE_SHORT: Record<string, string> = { once: 'one time', monthly: '/ month', quarterly: '/ 3 months', semiannual: '/ 6 months', yearly: '/ year' }

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{children}</span>
}

export type MenuItem = { label: string; icon: typeof Copy; onClick?: () => void; href?: string; danger?: boolean }

export function MoreMenu({ items, busy }: { items: MenuItem[]; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close); document.addEventListener('touchstart', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const row = 'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-bold transition hover:bg-gray-50 dark:hover:bg-white/[0.05] max-sm:py-3'
  return (
    <div ref={ref} className="relative ml-auto">
      <button onClick={() => setOpen(v => !v)} aria-label="More" aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#111827] max-sm:h-[42px] max-sm:w-[42px] dark:border-gray-700 dark:text-gray-300 dark:hover:text-white">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-[#1c1c1f]">
          {items.map(it => it.href ? (
            <a key={it.label} href={it.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={`${row} text-gray-700 dark:text-gray-200`}>
              <it.icon className="h-4 w-4 text-gray-400" /> {it.label}
            </a>
          ) : (
            <button key={it.label} onClick={() => { setOpen(false); it.onClick?.() }}
              className={`${row} ${it.danger ? 'text-red-600 dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}`}>
              <it.icon className={`h-4 w-4 ${it.danger ? '' : 'text-gray-400'}`} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Who = 'group' | 'agent' | 'other'

function RequestDrawer({ req, existing, users, groups, onClose, onSaved, onToast }: {
  req: PaymentRequest | null; existing: PaymentRequest[]; users: User[]; groups: BillingGroup[]
  onClose: () => void; onSaved: (r: PaymentRequest, created: boolean) => Promise<void>
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [who, setWho] = useState<Who>(req ? (req.billing_group_id ? 'group' : req.user_id ? 'agent' : 'other') : 'group')
  const [groupId, setGroupId] = useState<string>(req?.billing_group_id || (groups[0]?.id ?? 'new'))
  const [newGroup, setNewGroup] = useState('')
  const [agentId, setAgentId] = useState<string | null>(req?.user_id || null)
  const [q, setQ] = useState('')
  const [f, setF] = useState<PaymentRequestInput>(() => req ? {
    title: req.title, note: req.note, amount: req.amount, cycle: req.cycle, total_payments: req.total_payments,
    payer_name: req.payer_name, payer_email: req.payer_email, plan_tier: req.plan_tier, seats: req.seats,
  } : { title: '', cycle: 'monthly', plan_tier: 'PREMIUM' })
  const group = groups.find(g => g.id === groupId) || null
  const [aiPer, setAiPer] = useState<string>(group?.ai_budget_per_agent_usd != null ? String(group.ai_budget_per_agent_usd) : '')
  const [aiTotal, setAiTotal] = useState<string>(group?.ai_budget_total_usd != null ? String(group.ai_budget_total_usd) : '')
  const [saving, setSaving] = useState<'email' | 'link' | null>(null)
  const set = (k: keyof PaymentRequestInput, v: unknown) => setF(p => ({ ...p, [k]: v === '' ? null : v }))
  const agent = users.find(u => u.id === agentId) || null
  // A running payment for the same group / agent: this new one may be the new deal that replaces it.
  const running = req ? [] : existing.filter(x => (x.status === 'active' || x.status === 'past_due') && (
    (who === 'group' && groupId !== 'new' && x.billing_group_id === groupId) || (who === 'agent' && agentId && x.user_id === agentId)))
  const [replaces, setReplaces] = useState<string | null>(null)
  useEffect(() => { setReplaces(running[0]?.id ?? null) }, [who, groupId, agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fill who pays from the group's contact / the agent's account (only blanks).
  useEffect(() => {
    if (req) return
    if (who === 'group' && group) {
      setF(p => ({ ...p, payer_name: group.contact_name || null, payer_email: group.contact_email || null, seats: p.seats ?? (group.seats || group.members.length || null) }))
      setAiPer(group.ai_budget_per_agent_usd != null ? String(group.ai_budget_per_agent_usd) : '')
      setAiTotal(group.ai_budget_total_usd != null ? String(group.ai_budget_total_usd) : '')
    }
    if (who === 'agent' && agent) setF(p => ({ ...p, payer_name: `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || null, payer_email: agent.email, seats: 1 }))
  }, [who, groupId, agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return users.filter(u => !u.is_admin).filter(u => [u.email, u.first_name, u.last_name, u.brokerage].some(v => (v || '').toLowerCase().includes(s))).slice(0, 6)
  }, [users, q])

  const save = async (send: boolean) => {
    if (!(f.title || '').trim()) { onToast('Say what the payment is for', 'error'); return }
    if (!f.amount || f.amount < 1) { onToast('Put in the amount', 'error'); return }
    if (who === 'group' && groupId === 'new' && !newGroup.trim()) { onToast('Name the new group', 'error'); return }
    if (who === 'agent' && !agentId) { onToast('Pick the agent', 'error'); return }
    if (send && !f.payer_email) { onToast('Add their email to send it', 'error'); return }
    setSaving(send ? 'email' : 'link')
    const body: PaymentRequestInput = {
      ...f, total_payments: f.cycle === 'once' ? null : f.total_payments,
      ...(req ? {} : {
        billing_group_id: who === 'group' && groupId !== 'new' ? groupId : null,
        new_group_name: who === 'group' && groupId === 'new' ? newGroup.trim() : null,
        user_id: who === 'agent' ? agentId : null,
        replaces_request_id: running.some(x => x.id === replaces) ? replaces : null,
        send_email: send,
      }),
    }
    const r = req ? await api.admin.updatePaymentRequest(req.id, body) : await api.admin.createPaymentRequest(body)
    if (!(r.success && r.data)) { setSaving(null); onToast(r.error || "Couldn't save it", 'error'); return }
    // The group's AI usage lives on the group itself.
    const gid = r.data.billing_group_id
    if (who === 'group' && gid) {
      const per = aiPer.trim() ? Number(aiPer) : null
      const tot = aiTotal.trim() ? Number(aiTotal) : null
      const g = groups.find(x => x.id === gid)
      if (!g || (g.ai_budget_per_agent_usd ?? null) !== per || (g.ai_budget_total_usd ?? null) !== tot) {
        const u = await api.admin.updateGroup(gid, { ai_budget_per_agent_usd: per, ai_budget_total_usd: tot })
        if (!u.success) onToast(u.error || "The request is made, but the AI usage didn't save - set it on the group", 'error')
      }
    }
    setSaving(null)
    if (req) onToast('Saved - same link', 'success')
    await onSaved(r.data, !req)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/50 max-sm:!m-0" onClick={onClose}>
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-[#111827] dark:hover:text-white max-sm:min-h-[44px] max-sm:pr-3"><ArrowLeft className="h-4 w-4" /> Payments</button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:bg-gray-100 max-sm:text-gray-600 dark:max-sm:bg-white/10 dark:max-sm:text-gray-200"><X className="h-4 w-4 max-sm:h-5 max-sm:w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <h3 className="text-2xl font-black text-[#111827] dark:text-white">{req ? 'Edit payment request' : 'New payment request'}</h3>

          <Box title="1 · Who it's for">
            {!req && (
              <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.05]">
                {([['group', 'A group', Building2], ['agent', 'One agent', UserIcon], ['other', 'Someone else', UserPlus]] as const).map(([k, l, Icon]) => (
                  <button key={k} onClick={() => setWho(k)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black transition max-sm:flex-col max-sm:gap-0.5 max-sm:py-2.5 ${who === k ? 'bg-white text-[#111827] shadow-sm dark:bg-[#151517] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Icon className="h-3.5 w-3.5" /> {l}
                  </button>
                ))}
              </div>
            )}
            {who === 'group' && (
              req ? <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{req.group_name || 'Group'}</p> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <L label="Brokerage group"><Sel value={groupId} onChange={setGroupId} options={[...groups.map(g => [g.id, `${g.name} (${g.members.length} agents)`]), ['new', '+ Make a new group']]} /></L>
                  {groupId === 'new' && <L label="New group's name"><input className={FIELD} value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="e.g. Compass - Main Line team" /></L>}
                </div>
              )
            )}
            {who === 'agent' && (
              req ? <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{req.user_name}</p> : agent ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-[#faf9f7] px-3 py-2.5 dark:border-gray-700 dark:bg-black/20">
                  <span className="min-w-0"><span className="block truncate text-sm font-black text-[#111827] dark:text-white">{`${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email}</span><span className="block truncate text-[11px] font-semibold text-gray-400">{agent.email}</span></span>
                  <button onClick={() => setAgentId(null)} className="text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">Change</button>
                </div>
              ) : (
                <div>
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search agents by name or email" className={FIELD + ' pl-9'} /></div>
                  {matches.length > 0 && (
                    <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white dark:divide-white/[0.06] dark:border-white/[0.06] dark:bg-[#151517]">
                      {matches.map(u => (
                        <button key={u.id} onClick={() => { setAgentId(u.id); setQ('') }} className="block w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                          <span className="block truncate text-sm font-bold text-[#111827] dark:text-white">{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</span>
                          <span className="block truncate text-[11px] text-gray-400">{u.email}{u.brokerage ? ` · ${u.brokerage}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            {who === 'other' && !req && <p className="text-xs font-semibold text-gray-400">Anyone - just put their name and email below.</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <L label="Who pays - name"><input className={FIELD} value={f.payer_name || ''} onChange={e => set('payer_name', e.target.value)} placeholder="Managing broker" /></L>
              <L label="Their email (the link goes here)"><input className={FIELD} type="email" value={f.payer_email || ''} onChange={e => set('payer_email', e.target.value)} placeholder="name@brokerage.com" /></L>
            </div>
          </Box>

          <Box title="2 · The deal">
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="What it's for *" className="sm:col-span-2"><input className={FIELD} value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Compass Main Line - OpenHousePal Premium for 12 agents" /></L>
              <L label="Price *">
                <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                  <input className={FIELD + ' pl-7'} type="number" inputMode="decimal" min={1} step="0.01" value={f.amount ?? ''} onChange={e => set('amount', e.target.value === '' ? null : Number(e.target.value))} placeholder="500" /></div>
              </L>
              <L label="People it covers"><input className={FIELD} type="number" inputMode="numeric" min={1} value={f.seats ?? ''} onChange={e => set('seats', e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 12" /></L>
            </div>
            <p className="mb-1.5 mt-3 text-[11px] font-black text-gray-500 dark:text-gray-400">How often</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
              {CYCLES.map(([k, l]) => (
                <button key={k} onClick={() => set('cycle', k)}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-black transition ${f.cycle === k ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`}>
                  {l}
                </button>
              ))}
            </div>
            {f.cycle !== 'once' && (
              <L label="Stop after this many payments" className="mt-3">
                <input className={FIELD} type="number" inputMode="numeric" min={1} max={120} value={f.total_payments ?? ''} onChange={e => set('total_payments', e.target.value === '' ? null : Number(e.target.value))} placeholder="Blank = keeps charging until you stop it" />
              </L>
            )}
            {f.amount ? (
              <p className="mt-3 rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-bold text-[#8b7355] dark:text-[#e8c97a]">
                They pay {money(f.amount)} now{f.cycle !== 'once' ? `, then ${money(f.amount)} ${EVERY_WORDS[f.cycle || 'monthly']} automatically${f.total_payments ? ` (${f.total_payments} payments in all)` : ' until you stop it'}` : ''}.
                {f.seats && f.seats > 1 ? ` That's ${money(Math.round(f.amount / f.seats * 100) / 100)} per person.` : ''}
              </p>
            ) : null}
            <L label="Note to them (optional)" className="mt-3"><textarea className={FIELD + ' min-h-[70px]'} value={f.note || ''} onChange={e => set('note', e.target.value)} placeholder="Shown on the pay page and in the email" /></L>
          </Box>

          <Box title="3 · What they get once paid">
            <L label="Plan">
              <Sel value={f.plan_tier || ''} onChange={v => set('plan_tier', v)} options={[['', 'No plan change'], ...['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX'].map(t => [t, PLAN_LABEL[t]])]} />
            </L>
            <p className="mt-2 text-[11px] font-semibold text-gray-400">
              {who === 'group' ? 'Everyone in the group gets this plan, paid by the deal, as soon as the first payment goes through.' : who === 'agent' ? 'The agent gets this plan, paid by the deal, as soon as the first payment goes through.' : 'Nobody’s plan changes - put them in a group or pick an agent to give a plan.'}
            </p>
            {who === 'group' && (
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">AI usage for this group</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <L label="Each agent, per month">
                    <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                      <input className={FIELD + ' pl-7'} type="number" inputMode="decimal" min={1} value={aiPer} onChange={e => setAiPer(e.target.value)} placeholder="Plan's normal allowance" /></div>
                  </L>
                  <L label="Whole group together, per month">
                    <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                      <input className={FIELD + ' pl-7'} type="number" inputMode="decimal" min={1} value={aiTotal} onChange={e => setAiTotal(e.target.value)} placeholder="No group limit" /></div>
                  </L>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-gray-400">Blank = what everyone has now. Agents only ever see a percent bar, never dollars.</p>
              </div>
            )}
          </Box>

          {running.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p className="flex items-center gap-1.5 text-sm font-black text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> They already pay you</p>
              {running.map(x => (
                <label key={x.id} className="mt-2 flex items-start gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <input type="checkbox" checked={replaces === x.id} onChange={e => setReplaces(e.target.checked ? x.id : null)} className="mt-0.5 h-4 w-4 accent-[#C9A24D]" />
                  <span>This replaces “{x.title}” ({x.price_line}) - stop charging that one as soon as this new one is paid.</span>
                </label>
              ))}
              <p className="mt-2 text-[11px] font-semibold text-amber-800/80 dark:text-amber-200/70">Leave it unticked if this is an extra charge on top (for example a one-time setup fee).</p>
            </div>
          )}

          {!req && <p className="flex items-start gap-1.5 pb-2 text-[11px] font-semibold text-gray-400"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> Nothing is charged until they open the link and put in their card.</p>}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-gray-200 bg-[#faf9f7]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-gray-800 dark:bg-[#0B0B0B]/95">
          {req ? (
            <button onClick={() => save(false)} disabled={!!saving} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
            </button>
          ) : (
            <>
              <button onClick={() => save(true)} disabled={!!saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                {saving === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Create &amp; email
              </button>
              <button onClick={() => save(false)} disabled={!!saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white py-3 text-sm font-black text-gray-700 disabled:opacity-50 sm:flex-none sm:px-5 dark:border-gray-700 dark:bg-transparent dark:text-gray-200">
                {saving === 'link' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Link only
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ChangeDeal({ r, onClose, onSaved, onToast }: {
  r: PaymentRequest; onClose: () => void
  onSaved: (r: PaymentRequest) => Promise<void>
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [amount, setAmount] = useState(String(r.amount))
  const [plan, setPlan] = useState(r.plan_tier || '')
  const [seats, setSeats] = useState(r.seats != null ? String(r.seats) : '')
  const [saving, setSaving] = useState(false)
  const recurring = r.cycle !== 'once'
  const newAmount = Number(amount)
  const priceChanged = recurring && amount.trim() !== '' && Math.abs(newAmount - r.amount) > 0.004
  const save = async () => {
    if (priceChanged && (!Number.isFinite(newAmount) || newAmount < 1)) { onToast('Put in a price of $1 or more', 'error'); return }
    const body: { amount?: number; plan_tier?: string | null; seats?: number | null } = {}
    if (priceChanged) body.amount = newAmount
    if (plan && plan !== (r.plan_tier || '')) body.plan_tier = plan
    if (seats.trim() !== '' && Number(seats) !== r.seats) body.seats = Number(seats)
    if (!Object.keys(body).length) { onClose(); return }
    setSaving(true)
    const res = await api.admin.changePaymentRequest(r.id, body)
    setSaving(false)
    if (res.success && res.data) { onToast(res.data.change_notes?.join(' ') || 'Deal updated', 'success'); await onSaved(res.data) }
    else onToast(res.error || 'That didn’t save - nothing was changed', 'error')
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center max-sm:!m-0 max-sm:p-0" onClick={onClose}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl max-sm:rounded-b-none max-sm:p-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:bg-[#151517]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#9a7a35] dark:text-[#e6c47c]">Change the deal</p>
            <h3 className="mt-1 text-lg font-black leading-snug text-[#111827] dark:text-white">{r.title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {recurring && (
            <L label={`Price ${EVERY_WORDS[r.cycle]}`}>
              <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                <input className={FIELD + ' pl-7'} type="number" inputMode="decimal" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            </L>
          )}
          <div className="grid grid-cols-2 gap-3">
            <L label="Plan they get">
              <Sel value={plan} onChange={setPlan} options={[['', 'No plan change'], ...['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX'].map(t => [t, PLAN_LABEL[t]])]} />
            </L>
            <L label="People it covers"><input className={FIELD} type="number" inputMode="numeric" min={1} value={seats} onChange={e => setSeats(e.target.value)} placeholder="-" /></L>
          </div>
        </div>
        <div className="mt-4 space-y-1.5 rounded-xl bg-[#faf9f7] p-3 text-[11.5px] font-semibold leading-relaxed text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
          {recurring
            ? <p><b className="text-[#111827] dark:text-white">Price:</b> starts with the next charge that's at least 10 days away. PayPal emails them about it - same card, same link, nothing to cancel.</p>
            : <p><b className="text-[#111827] dark:text-white">One-time payment:</b> the price can't change after it's paid. Send a new request for any difference.</p>}
          <p><b className="text-[#111827] dark:text-white">Plan and people:</b> change right now{r.group_name ? ` for everyone in ${r.group_name}` : ''}.</p>
          {r.group_name && <p><b className="text-[#111827] dark:text-white">AI usage and adding people:</b> on the {r.group_name} group page - they change instantly.</p>}
        </div>
        <button onClick={save} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save the new deal
        </button>
      </motion.div>
    </motion.div>
  )
}
