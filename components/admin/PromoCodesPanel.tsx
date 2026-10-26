'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Copy, CreditCard, FlaskConical, Loader2, Plus, Receipt, Ticket, Trash2, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { BillingGroup, PayPalPlanTerms, PromoCode, PromoCodeInput } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { copyText } from '@/lib/copyText'
import { PLAN_CHIP, PLAN_LABEL } from './AgentControlPanel'
import { Box, FIELD, L, Mini, Sel, Stat } from './BrokerageGroupsPanel'

const CYCLE: Record<string, string> = { monthly: '/mo', quarterly: '/qtr', yearly: '/yr' }
const PER_MONTH: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }
const STATE: Record<PromoCode['state'], [string, string]> = {
  active: ['Active', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  off: ['Switched off', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
  expired: ['Expired', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
  used_up: ['Used up', 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'],
}
const TIERS = ['IDX', 'PREMIUM', 'BASIC', 'PRO_NO_MLS', 'NO_MLS']
const money = (n?: number | null) => n == null ? '-' : `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const shortDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

/** Admin "Codes": reusable sign-up codes for a team or a deal - a special PayPal plan, or billed by us. */
export default function PromoCodesPanel({ groups, onToast, onAgentsChanged }: {
  groups: BillingGroup[]
  onToast: (message: string, type: 'success' | 'error') => void
  onAgentsChanged?: () => void
}) {
  const [codes, setCodes] = useState<PromoCode[] | null>(null)
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const load = async () => {
    const r = await api.admin.getPromoCodes()
    if (r.success && r.data) setCodes(r.data)
    else { setCodes([]); onToast(r.error || "Couldn't load codes", 'error') }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = codes || []
  const active = list.filter(c => c.state === 'active')
  const signups = list.reduce((n, c) => n + c.uses, 0)
  const billedAgents = list.filter(c => c.kind === 'billed_by_us' && !c.test_copy_of_user_id).flatMap(c => c.agents.map(a => ({ a, c })))
  const monthly = billedAgents.reduce((n, { c }) => n + (c.custom_price || 0) / (PER_MONTH[c.billing_cycle || 'monthly'] || 1), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><Ticket className="h-5 w-5 text-[#C9A24D]" /> Codes</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            Sign-up codes for a team or a deal. A code can put agents on a special PayPal plan (like IDX with no setup fee), or switch their account on with no PayPal so you bill them yourself at a custom price. Agents type it at checkout.
          </p>
        </div>
        <button onClick={() => setOpenId('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-black dark:bg-white dark:text-[#111827]">
          <Plus className="h-4 w-4" /> New code
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active codes" value={active.length} />
        <Stat label="Sign-ups with a code" value={signups} />
        <Stat label="Billed by you" value={billedAgents.length} sub="Agents you invoice yourself" />
        <Stat label="You bill per month" value={money(Math.round(monthly))} sub="From billed-by-you codes" />
      </div>

      {codes === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
          <Ticket className="h-9 w-9 text-gray-300" />
          <p className="font-black text-gray-600 dark:text-gray-300">No codes yet</p>
          <p className="max-w-md text-sm font-semibold text-gray-400">Make one for each team you pitch, e.g. SMITHTEAM for IDX with the setup fee waived.</p>
          <button onClick={() => setOpenId('new')} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> New code</button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(c => (
            <button key={c.id} onClick={() => setOpenId(c.id)}
              className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-lg dark:border-gray-800 dark:bg-[#151517]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-lg font-black tracking-wider text-[#111827] dark:text-white">{c.code}</p>
                  <p className="truncate text-xs font-semibold text-gray-400">{c.label || (c.test_copy_of_user_id ? 'Test account' : c.kind === 'billed_by_us' ? 'Billed by you' : 'Special PayPal plan')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${STATE[c.state][1]}`}>{STATE[c.state][0]}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Mini label="Used" value={`${c.uses}${c.max_uses ? ` / ${c.max_uses}` : ''}`} />
                <Mini label="They pay" value={c.test_copy_of_user_id ? 'Free test' : c.kind === 'billed_by_us' ? (c.custom_price != null ? `${money(c.custom_price)}${CYCLE[c.billing_cycle || 'monthly']}` : 'Not set') : 'Via PayPal'} />
                <Mini label="Ends" value={c.expires_at ? shortDate(c.expires_at) : 'Never'} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PLAN_CHIP[c.plan_tier]}`}>{PLAN_LABEL[c.plan_tier]}</span>
                {c.test_copy_of_user_id
                  ? <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300"><FlaskConical className="h-3 w-3" />Test account</span>
                  : <span className="inline-flex items-center gap-1">{c.kind === 'billed_by_us' ? <Receipt className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}{c.kind === 'billed_by_us' ? 'Billed by you' : 'PayPal plan'}</span>}
                {c.billing_group_name && <span>· {c.billing_group_name}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {openId && (
          <CodeDrawer key={openId} code={openId === 'new' ? null : list.find(c => c.id === openId) || null} groups={groups}
            onClose={() => setOpenId(null)} onToast={onToast}
            onSaved={async (c, created) => { await load(); onAgentsChanged?.(); if (created && c) setOpenId(c.id) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

function CodeDrawer({ code, groups, onClose, onSaved, onToast }: {
  code: PromoCode | null; groups: BillingGroup[]
  onClose: () => void; onSaved: (c: PromoCode | null, created: boolean) => Promise<void>
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [form, setForm] = useState<PromoCodeInput>(() => code ? {
    code: code.code, label: code.label, kind: code.kind, plan_tier: code.plan_tier, paypal_plan_id: code.paypal_plan_id,
    custom_price: code.custom_price, billing_cycle: code.billing_cycle, billing_group_id: code.billing_group_id,
    max_uses: code.max_uses, expires_at: code.expires_at, is_active: code.is_active, notes: code.notes,
    test_copy_of_user_id: code.test_copy_of_user_id,
  } : { code: '', kind: 'paypal_plan', plan_tier: 'IDX', billing_cycle: 'monthly', is_active: true })
  // A test-account code: free, and the Bright sign-up takes the copied agent's MLS ID with it.
  const [isTest, setIsTest] = useState(!!code?.test_copy_of_user_id)
  const [sources, setSources] = useState<{ id: string; name: string; mls_id: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [plans, setPlans] = useState<{ plan_tier: string; plan_id: string; label: string }[]>([])
  const [terms, setTerms] = useState<PayPalPlanTerms | null>(null)
  const [termsError, setTermsError] = useState('')
  const [checking, setChecking] = useState(false)
  const set = (k: keyof PromoCodeInput, v: unknown) => setForm(f => ({ ...f, [k]: v === '' ? null : v }))
  const billedByUs = form.kind === 'billed_by_us'
  const signupLink = code && typeof window !== 'undefined' ? `${window.location.origin}/register?code=${code.code}` : ''

  useEffect(() => { api.admin.getPromoPlans().then(r => { if (r.success && r.data) setPlans(r.data) }) }, [])
  useEffect(() => { if (isTest) api.admin.getTestCopySources().then(r => { if (r.success && r.data) setSources(r.data) }) }, [isTest])
  const pickPay = (v: string) => {
    if (v === 'test') { setIsTest(true); setForm(f => ({ ...f, kind: 'billed_by_us', custom_price: null, max_uses: f.max_uses ?? 1 })) }
    else { setIsTest(false); setForm(f => ({ ...f, kind: v as PromoCode['kind'], test_copy_of_user_id: null })) }
  }
  // What PayPal will actually charge on the chosen plan - shown before the code is saved.
  useEffect(() => {
    setTerms(null); setTermsError('')
    const id = (form.paypal_plan_id || '').trim()
    if (billedByUs || !id.startsWith('P-') || id.length < 10) return
    let live = true
    setChecking(true)
    const t = setTimeout(() => {
      api.admin.checkPromoPlan(id).then(r => {
        if (!live) return
        setChecking(false)
        if (r.success && r.data) setTerms(r.data)
        else setTermsError(r.error || "PayPal doesn't know that plan ID")
      })
    }, 400)
    return () => { live = false; clearTimeout(t) }
  }, [form.paypal_plan_id, billedByUs])

  const quickPicks = useMemo(() => plans.filter(p => p.plan_tier === form.plan_tier), [plans, form.plan_tier])
  const expiresDay = form.expires_at ? new Date(form.expires_at).toISOString().slice(0, 10) : ''

  const save = async () => {
    if (!(form.code || '').trim()) { onToast('Give the code a name, like SMITHTEAM', 'error'); return }
    if (isTest && !form.test_copy_of_user_id) { onToast('Pick the agent the test account copies', 'error'); return }
    setSaving(true)
    const body: PromoCodeInput = { ...form }
    const r = code ? await api.admin.updatePromoCode(code.id, body) : await api.admin.createPromoCode(body)
    setSaving(false)
    if (r.success && r.data) { onToast(code ? 'Code saved' : `${r.data.code} is ready - share it with the team`, 'success'); await onSaved(r.data, !code) }
    else onToast(r.error || "Couldn't save the code", 'error')
  }
  const toggle = async () => {
    if (!code) return
    const r = await api.admin.updatePromoCode(code.id, { is_active: !code.is_active })
    if (r.success) { onToast(code.is_active ? 'Code switched off - nobody new can use it' : 'Code switched back on', 'success'); await onSaved(r.data || null, false) }
    else onToast(r.error || "Couldn't change it", 'error')
  }
  const remove = async () => {
    if (!code) return
    const r = await api.admin.deletePromoCode(code.id)
    setConfirmDelete(false)
    if (r.success) { onToast('Code deleted', 'success'); await onSaved(null, false); onClose() }
    else onToast(r.error || "Couldn't delete it", 'error')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-[#111827] dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Codes</button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-mono text-2xl font-black tracking-wider text-[#111827] dark:text-white">{code ? code.code : 'New code'}</h3>
            {code && (
              <button onClick={() => copyText(code.code).then(() => onToast('Code copied', 'success'))} className="inline-flex items-center gap-1 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]"><Copy className="h-3.5 w-3.5" /> Copy</button>
            )}
            {code && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATE[code.state][1]}`}>{STATE[code.state][0]}</span>}
          </div>

          <Box title="The code">
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="Code agents type *"><input className={FIELD + ' font-mono uppercase tracking-wider'} value={form.code || ''} onChange={e => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="SMITHTEAM" /></L>
              <L label="Name (only you see it)"><input className={FIELD} value={form.label || ''} onChange={e => set('label', e.target.value)} placeholder="Smith Team - setup fee waived" /></L>
              <L label="Plan they get">
                <Sel value={form.plan_tier || 'IDX'} onChange={v => setForm(f => ({ ...f, plan_tier: v, paypal_plan_id: null }))} options={TIERS.map(t => [t, PLAN_LABEL[t]])} />
              </L>
              <L label="How they pay">
                <Sel value={isTest ? 'test' : form.kind || 'paypal_plan'} onChange={pickPay} options={[['paypal_plan', 'PayPal - a special plan'], ['billed_by_us', 'We bill them ourselves'], ['test', 'Free - test account']]} />
              </L>
            </div>
          </Box>

          {isTest ? (
            <Box title="Test account">
              <L label="Copies this agent (their MLS ID, listings, sales and open houses)">
                <Sel value={form.test_copy_of_user_id || ''} onChange={v => set('test_copy_of_user_id', v)}
                  options={[['', 'Pick an agent'], ...sources.map(s => [s.id, `${s.name} - MLS ID ${s.mls_id}`])]} />
              </L>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                Send the tester the sign-up link below. On the Bright MLS sign-up they enter that agent&apos;s MLS ID and it&apos;s accepted with this code; the account becomes a test copy. Approve them in Agents like any Bright agent, then they type this code at checkout to switch the plan on - nobody pays, and it only works for that test account.
              </p>
              {code && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 dark:bg-violet-500/10">
                  <span className="min-w-0 flex-1 break-all font-mono text-xs font-bold text-violet-800 dark:text-violet-200">{signupLink}</span>
                  <button onClick={() => copyText(signupLink).then(() => onToast('Sign-up link copied', 'success'))} className="inline-flex items-center gap-1 text-xs font-black text-violet-700 hover:underline dark:text-violet-300"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                </div>
              )}
            </Box>
          ) : billedByUs ? (
            <Box title="What you'll bill them">
              <div className="grid gap-3 sm:grid-cols-2">
                <L label="Price"><input className={FIELD} type="number" min={0} step="0.01" value={form.custom_price ?? ''} onChange={e => set('custom_price', e.target.value === '' ? null : Number(e.target.value))} placeholder="79.00" /></L>
                <L label="Every"><Sel value={form.billing_cycle || 'monthly'} onChange={v => set('billing_cycle', v)} options={[['monthly', 'Month'], ['quarterly', 'Quarter'], ['yearly', 'Year']]} /></L>
              </div>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                Their account switches on the moment they enter the code - no PayPal. You send their invoices. Each sign-up pings Discord so you know to bill them, and they're listed below.
              </p>
            </Box>
          ) : (
            <Box title="The PayPal plan">
              {quickPicks.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickPicks.map(p => (
                    <button key={p.plan_id} type="button" onClick={() => set('paypal_plan_id', p.plan_id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${form.paypal_plan_id === p.plan_id ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/50 dark:border-gray-700 dark:text-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <L label="PayPal plan ID"><input className={FIELD + ' font-mono'} value={form.paypal_plan_id || ''} onChange={e => set('paypal_plan_id', e.target.value.trim())} placeholder="P-XXXXXXXXXXXXXXXXXXXXXXXX" /></L>
              <div className="mt-3 rounded-xl bg-[#faf9f7] px-3 py-2.5 text-xs font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                {checking ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking with PayPal...</span>
                  : termsError ? <span className="text-red-600 dark:text-red-400">{termsError}</span>
                  : terms ? (
                    <span>
                      PayPal will charge <b>{terms.price != null ? `${money(terms.price)}/${(terms.interval || 'month').toLowerCase()}` : 'an unknown price'}</b>
                      {' · '}setup fee <b>{terms.setup_fee ? money(terms.setup_fee) : 'none'}</b>
                      {' · '}free trial <b>{terms.trial_days ? `${terms.trial_days} days` : 'none'}</b>
                      {terms.name ? <span className="text-gray-400"> · {terms.name}</span> : null}
                      {terms.status && terms.status !== 'ACTIVE' && <span className="text-red-600"> · switched off in PayPal</span>}
                    </span>
                  ) : 'Pick a plan above or paste a plan ID from PayPal. What PayPal will charge shows here.'}
              </div>
            </Box>
          )}

          <Box title="Limits">
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="How many agents can use it"><input className={FIELD} type="number" min={1} value={form.max_uses ?? ''} onChange={e => set('max_uses', e.target.value === '' ? null : Number(e.target.value))} placeholder="Leave blank for unlimited" /></L>
              <L label="Stops working after"><input className={FIELD} type="date" value={expiresDay} onChange={e => set('expires_at', e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null)} /></L>
              <L label="Add sign-ups to a brokerage group">
                <Sel value={form.billing_group_id || ''} onChange={v => set('billing_group_id', v)} options={[['', 'No group'], ...groups.map(g => [g.id, g.name])]} />
              </L>
            </div>
            <L label="Notes" className="mt-3"><textarea className={FIELD + ' min-h-[70px]'} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="The deal - who it's for, what was agreed..." /></L>
          </Box>

          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {code ? 'Save changes' : 'Create code'}
            </button>
            {code && (
              <button onClick={toggle} className="rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
                {code.is_active ? 'Switch off' : 'Switch on'}
              </button>
            )}
            {code && (
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 dark:border-red-500/25 dark:text-red-300 dark:hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>

          {code && (
            <Box title={`Signed up with this code (${code.agents.length})`}>
              {code.agents.length === 0 ? (
                <p className="text-sm font-semibold text-gray-400">Nobody yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {code.agents.map(a => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{a.name}</p>
                        <p className="truncate text-xs font-semibold text-gray-400">{a.email} · joined {shortDate(a.joined_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.plan_tier && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PLAN_CHIP[a.plan_tier]}`}>{PLAN_LABEL[a.plan_tier]}</span>}
                        <span className="text-[11px] font-bold capitalize text-gray-500">{(a.subscription_status || '').toLowerCase().replace('_', ' ')}</span>
                        {code.kind === 'billed_by_us' && !code.test_copy_of_user_id && code.custom_price != null && <span className="text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">bill {money(code.custom_price)}{CYCLE[code.billing_cycle || 'monthly']}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          )}
        </div>
        <ConfirmationModal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove}
          title={`Delete ${code?.code}?`}
          message={!code?.uses ? "Nobody has used it, so it's simply removed."
            : `${code.uses} ${code.uses === 1 ? 'agent has' : 'agents have'} used it. They keep their plan${code.kind === 'billed_by_us' ? ' and you keep billing them' : ''}, but this list of who used it${code.kind === 'billed_by_us' ? ' and the price you bill them' : ''} goes away. To just stop new sign-ups, switch it off instead.`}
          confirmText="Delete" />
      </motion.div>
    </motion.div>
  )
}
