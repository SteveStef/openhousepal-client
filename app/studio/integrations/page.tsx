'use client'

import { OhpHouse } from '@/components/brand/OhpBrand'
// Standalone Integrations page - extracted out of Settings (where it used to be a tab) so it gets
// a full page's breathing room. Same real logic/API calls as before (CRM push via Follow Up Boss
// API key / lead-parsing email / webhook, plus the inbound portal-lead forwarding address), laid
// out with a plain-language explainer up top splitting the two directions ("leads OUT to your
// CRM" vs "leads IN from portals") so a non-technical agent isn't left guessing which box to fill in.

import { useEffect, useState } from 'react'
import {
  AlertCircle, ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Copy, Inbox, Loader2, Mail, MailCheck, Plug, RefreshCw, Send, Webhook, Zap,
} from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { LuxeSectionHeader, LuxeSurface } from '@/components/ui/LuxeSurface'
import api from '@/lib/api-service'
import type { IntegrationsInfo, CrmTestResult } from '@/types'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import { copyText } from '@/lib/copyText'
import { notify } from '@/contexts/ToastContext'

// "2m ago" / "3h ago" / "5d ago" for a past ISO timestamp.
function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Per-CRM setup steps - researched against each product's current help docs (Sept 2026). Where a
// CRM has more than one way in, options are listed best-first (`preferred` gets a chip).
type CrmProvider = {
  id: string
  name: string
  options: { label: string; preferred?: boolean; steps: string[] }[]
}
const CRM_PROVIDERS: CrmProvider[] = [
  { id: 'fub', name: 'Follow Up Boss', options: [
    { label: 'API key', preferred: true, steps: [
      'In Follow Up Boss, go to Admin → API.',
      'Click “Create API Key”, give it a name (e.g. “OpenHousePal”), then “Create API Key”.',
      'Copy the key right away — Follow Up Boss only shows it once (the list later shows just the last 4 digits).',
      'Paste it in the Follow Up Boss API key box. Leads then push straight into FUB as structured events.',
    ]},
    { label: 'Lead-parsing email (no key)', steps: [
      'In Follow Up Boss, go to Admin → API — your personal Lead Email Address (ends in @followupboss.me) is shown there.',
      'Copy it and paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'lofty', name: 'Lofty (formerly Chime)', options: [
    { label: 'Lead-parsing email', steps: [
      'In Lofty, open Settings → Features → Integration → Lead Capture.',
      'Copy your Lofty lead-parsing email address (the one used for email parsing, not the sending address).',
      'Paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'kvcore', name: 'kvCORE / BoldTrail', options: [
    { label: 'Lead Dropbox email', steps: [
      'In kvCORE / BoldTrail, open Lead Engine → Lead Dropbox → “Start Now”.',
      'Click the “Copy” button next to the import email address it generates.',
      'Paste it into the lead-parsing email box. (Manage or remove it later under Settings → Lead Settings.)',
    ]},
  ]},
  { id: 'sierra', name: 'Sierra Interactive', options: [
    { label: 'Custom lead-source parser email', steps: [
      'In Sierra, click the Gear icon → Integrations manager.',
      'Pick the relevant service (or a generic/custom one) to generate a site-specific parser email address.',
      'Paste that address into the lead-parsing email box.',
    ]},
  ]},
  { id: 'boomtown', name: 'BoomTown', options: [
    { label: 'Auto-Import email', steps: [
      'In BoomTown, find your account’s unique lead email address (ends in @MyBoomTownLeads.Me) — see BoomTown’s “Auto-Import Leads” help article, or ask your BoomTown Success rep.',
      'Paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'realgeeks', name: 'Real Geeks', options: [
    { label: 'Zapier webhook', steps: [
      'Real Geeks has no native lead-parsing email — use Zapier. Create a Zap with trigger “Webhooks by Zapier → Catch Hook”.',
      'Copy the Catch Hook URL and paste it into the Webhook URL box.',
      'For the Zap’s action, use Real Geeks → “Create Lead” and map name / email / phone / message from the webhook.',
    ]},
  ]},
  { id: 'wiseagent', name: 'Wise Agent', options: [
    { label: 'Lead Capture Email', steps: [
      'In Wise Agent, open Integrations → Settings → the “API Keys and Lead Email” tab (click to expand).',
      'Copy your Lead Capture Email.',
      'Paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'liondesk', name: 'LionDesk', options: [
    { label: 'Unique parsing email', steps: [
      'In LionDesk, open Settings → “Lead Import and Team Settings”.',
      'Copy your Unique Email Address (used for email parsing).',
      'Paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'ixact', name: 'IXACT Contact', options: [
    { label: 'Lead Capture via Email', steps: [
      'In IXACT Contact, go to Integrations → Lead Capture → “Lead Capture - Email”.',
      'Tick “Enable Lead Capture via Email” — it reveals the email address unique to your account.',
      'Copy that address into the lead-parsing email box.',
    ]},
  ]},
  { id: 'topproducer', name: 'Top Producer', options: [
    { label: 'Direct lead-source email', steps: [
      'In Top Producer, go to Setup → Lead Providers → Direct Lead Sources.',
      'Copy the lead notification email address it gives you (the “Forward to” address).',
      'Paste it into the lead-parsing email box.',
    ]},
  ]},
  { id: 'other', name: 'Another CRM', options: [
    { label: 'Lead-parsing email', preferred: true, steps: [
      'Almost every CRM has a “lead parsing” / “email parsing” address — look under Settings or Admin → Leads / Integrations.',
      'Paste it into the lead-parsing email box.',
    ]},
    { label: 'Webhook / Zapier', steps: [
      'If your CRM offers an inbound webhook, or you use Zapier / Make, create a “Catch Hook”.',
      'Paste that URL into the Webhook URL box and map name / email / phone in your automation.',
    ]},
  ]},
]

export default function IntegrationsPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <IntegrationsPageInner />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function IntegrationsPageInner() {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [webhook, setWebhook] = useState('')
  const [parseEmail, setParseEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<CrmTestResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [openPortal, setOpenPortal] = useState<string | null>(null)
  const [fubKey, setFubKey] = useState('')  // typed value only; the stored key is never sent back
  const [crmProvider, setCrmProvider] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const apply = (d: IntegrationsInfo) => {
    setInfo(d)
    setEnabled(d.crm_push_enabled)
    setWebhook(d.crm_webhook_url || '')
    setParseEmail(d.crm_parse_email || '')
    setFubKey('')
    if (d.crm_fub_connected) setCrmProvider(p => p || 'fub')
  }

  useEffect(() => {
    // "Send from your own email" moved to Tools -> Email (user, 10/17) - old links land there.
    if (window.location.hash === '#send-as' || new URLSearchParams(window.location.search).get('mailbox')) {
      const m = new URLSearchParams(window.location.search).get('mailbox')
      window.location.replace(`/studio/email${m ? `?mailbox=${m}` : ''}`)
      return
    }
    api.integrations.get().then(r => { if (r.success && r.data) apply(r.data); setLoading(false) })
  }, [])

  const fubConnected = !!info?.crm_fub_connected
  const dirty = !!info && (
    enabled !== info.crm_push_enabled ||
    webhook.trim() !== (info.crm_webhook_url || '') ||
    parseEmail.trim() !== (info.crm_parse_email || '') ||
    fubKey.trim() !== ''
  )
  const hasChannel = !!(webhook.trim() || parseEmail.trim() || fubConnected || fubKey.trim())

  const save = async (fubOverride?: string | null) => {
    setSaving(true)
    // Connecting a CRM for the first time switches sending on - otherwise the test lead works
    // but real leads quietly never go (the switch up top is easy to miss).
    const firstConnect = !!info && !(info.crm_fub_connected || info.crm_webhook_url || info.crm_parse_email)
    const payload: Parameters<typeof api.integrations.update>[0] = {
      crm_push_enabled: (enabled || firstConnect) && hasChannel,
      crm_webhook_url: webhook.trim() || null,
      crm_parse_email: parseEmail.trim() || null,
    }
    if (fubOverride !== undefined) payload.crm_fub_api_key = fubOverride
    else if (fubKey.trim()) payload.crm_fub_api_key = fubKey.trim()
    const r = await api.integrations.update(payload)
    setSaving(false)
    if (r.success && r.data) { apply(r.data); setSaved(true); setTimeout(() => setSaved(false), 1800) }
    else notify(r.error || 'Could not save your CRM settings - please try again.')
  }

  const disconnectFub = async () => {
    if (!confirm('Disconnect Follow Up Boss? New leads will stop pushing to it.')) return
    await save('')
  }

  const runTest = async () => {
    setTesting(true); setTestResult(null)
    if (dirty) await save()
    const r = await api.integrations.testCrm()
    setTesting(false)
    if (r.success && r.data) setTestResult(r.data)
    api.integrations.get().then(g => { if (g.success && g.data) setInfo(g.data) })
  }

  const copyAddr = () => {
    if (!info?.inbound_address) return
    copyText(info.inbound_address).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  const rotate = async () => {
    if (!confirm('Generate a new inbound address? The current one stops working immediately — you\'ll need to update every portal you gave it to.')) return
    setRotating(true)
    const r = await api.integrations.rotateInbound()
    setRotating(false)
    if (r.success && r.data) apply(r.data)
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
  const lastPushAgo = info?.crm_last_push_at ? timeAgo(info.crm_last_push_at) : null
  const provider = CRM_PROVIDERS.find(x => x.id === crmProvider)
  const pushOn = enabled && hasChannel
  // a saved key Follow Up Boss refused is not "connected" - say so in red everywhere
  const fubRejected = fubConnected && /rejected/i.test(info?.crm_fub_note || '')
  const outStatus = fubRejected ? 'Follow Up Boss key rejected' : fubConnected ? 'Follow Up Boss connected' : parseEmail.trim() ? 'Sending by email' : webhook.trim() ? 'Sending by webhook' : 'Not set up'
  const showFub = crmProvider === 'fub' || fubConnected
  const showEmail = crmProvider !== 'realgeeks' && (!!crmProvider || !!parseEmail.trim())
  const showHook = crmProvider === 'realgeeks' || showAdvanced || !!webhook.trim()
  const lastBad = /error|http\s*[45]\d\d|reject/i.test(info?.crm_last_push_status || '')

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style>{INT_CSS}</style>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <StudioPageHeader
          icon={Plug}
          kicker="CRM"
          title={<>Every lead, <em>where it belongs</em></>}
          subtitle="Send new leads to your CRM, and pull in leads forwarded from Zillow, Realtor.com and more."
        />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="space-y-5">
            {/* The whole idea as one picture: portals -> OpenHousePal -> your CRM */}
            <motion.div variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <div className="grid items-stretch gap-0 md:grid-cols-[1fr_auto_1fr]">
                <FlowSide
                  href="#leads-in" dir="in" title="Leads IN" sub="Zillow, Realtor.com, Homes.com & Facebook leads land in your Leads list."
                  status={info?.inbound_address ? 'Address ready' : 'Not set up'} ok={!!info?.inbound_address}
                  chips={['Zillow', 'Realtor.com', 'Homes.com', 'Facebook']} />
                <div className="relative flex items-center justify-center px-6 py-6 md:px-16 md:py-0">
                  <span className="int-flow int-flow-l hidden md:block" />
                  <span className="int-flow int-flow-r hidden md:block" />
                  <div className="relative flex h-20 w-20 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-white shadow-[0_18px_40px_-18px_rgba(17,24,39,.9)]">
                    <span className="absolute -inset-1 rounded-[1.6rem] border border-[#C9A24D]/40 int-pulse" />
                    <OhpHouse onDark className="h-10 text-white" title="OpenHousePal" />
                  </div>
                </div>
                <FlowSide
                  href="#leads-out" dir="out" title="Leads OUT" sub="Every new OpenHousePal lead is sent to the CRM you already use."
                  status={pushOn || fubRejected ? outStatus : hasChannel ? 'Saved - switched off' : 'Not set up'} ok={pushOn && !fubRejected}
                  chips={['Follow Up Boss', 'Lofty', 'kvCORE', 'Sierra', '+ more']} />
              </div>
              <p className="border-t border-gray-100 px-5 py-2.5 text-center text-[11px] font-semibold text-gray-500 dark:border-white/[0.06] dark:text-white/50">Two separate switches - set up either one, or both.</p>
            </motion.div>

            {/* ---------- Leads OUT: CRM push ---------- */}
            <motion.section id="leads-out" variants={rise} className="scroll-mt-24 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <LuxeSectionHeader icon={Zap} kicker="Leads out" title={<>Send leads to <em>your CRM</em></>} subtitle="Pick your CRM, connect it once, send a test - that's it."
                aside={(
                  <button type="button" role="switch" aria-checked={pushOn} disabled={!hasChannel} onClick={() => setEnabled(v => !v)}
                    title={hasChannel ? undefined : 'Connect your CRM below first'}
                    className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${pushOn ? 'border-emerald-500/35 bg-white/85 dark:bg-white/[0.06]' : 'border-gray-300 bg-white/70 dark:border-white/15 dark:bg-white/[0.04]'}`}>
                    <span className="leading-none">
                      <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/50">Sending</span>
                      <span className={`mt-1 block text-xs font-black ${pushOn ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-white/60'}`}>{pushOn ? 'On' : 'Off'}</span>
                    </span>
                    <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pushOn ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                      <span className={`h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-300 ${pushOn ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                    </span>
                  </button>
                )} />

              <div className="space-y-6 p-5 sm:p-6">
                {/* 1 - pick */}
                <StepBlock n={1} title="Which CRM do you use?" done={!!crmProvider || fubConnected}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {CRM_PROVIDERS.map(p => {
                      const active = crmProvider === p.id
                      return (
                        <motion.button key={p.id} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} onClick={() => setCrmProvider(active ? '' : p.id)}
                          className={`relative flex items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2.5 text-left transition ${active ? 'border-[#C9A24D] bg-[#fffaf0] shadow-[0_10px_24px_-14px_rgba(201,162,77,.9)] dark:bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-white/[0.08] dark:bg-[#151517]'}`}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white" style={{ background: CRM_COLORS[p.id] || '#6b7280' }}>{CRM_MARKS[p.id] || p.name.slice(0, 2)}</span>
                          <span className="min-w-0 truncate text-[11px] font-black text-[#111827] dark:text-white">{p.name.replace(' (formerly Chime)', '')}</span>
                          {active && <motion.span layoutId="crm-pick" className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-white"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></motion.span>}
                        </motion.button>
                      )
                    })}
                  </div>
                </StepBlock>

                {/* 2 - connect */}
                <StepBlock n={2} title={provider ? `Connect ${provider.name.replace(' (formerly Chime)', '')}` : 'Connect it'} done={hasChannel}>
                  {!crmProvider && !hasChannel ? (
                    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-xs font-bold text-gray-400 dark:border-white/10">Pick your CRM above and we&apos;ll show you exactly where to click.</p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="space-y-3">
                        <AnimatePresence initial={false}>
                          {showFub && (
                            <motion.div key="fub" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className={`rounded-2xl border p-4 ${fubRejected ? 'border-red-300/70 bg-red-50/40 dark:border-red-400/25 dark:bg-red-400/[0.04]' : fubConnected ? 'border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-400/20 dark:bg-emerald-400/[0.04]' : 'border-[#C9A24D]/40 bg-[#fffaf0] dark:bg-[#C9A24D]/[0.06]'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-black text-[#111827] dark:text-white">Follow Up Boss API key</p>
                                  {fubRejected
                                    ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 dark:bg-red-400/15 dark:text-red-300">Key rejected</span>
                                    : fubConnected
                                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"><Check className="h-2.5 w-2.5" /> Connected</span>
                                    : <span className="rounded-full bg-[#C9A24D]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#e8c97a]">Best option</span>}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <input value={fubKey} onChange={e => setFubKey(e.target.value)} placeholder={fubConnected ? 'Paste a new key to replace it' : 'fka_…'} type="password" className={`${inputCls} flex-1`} />
                                  {fubConnected && <button onClick={disconnectFub} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-red-600 transition hover:border-red-300 dark:border-gray-700 dark:bg-transparent">Disconnect</button>}
                                </div>
                                {fubConnected && info?.crm_fub_note && (
                                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-900/15">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <p className="text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-200">{info.crm_fub_note}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                          {showEmail && (
                            <motion.div key="email" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">
                                <Inbox className="h-3.5 w-3.5" /> {crmProvider === 'fub' ? 'Or - your Follow Up Boss lead email' : 'Your CRM’s lead-parsing email'} {parseEmail.trim() && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                              </label>
                              <input value={parseEmail} onChange={e => setParseEmail(e.target.value)} placeholder="you-abc123@yourcrm.com" className={`${inputCls} mt-1.5`} />
                              <p className="mt-1 text-[10px] font-semibold text-gray-400">We email each new lead here in the format your CRM already reads.</p>
                            </motion.div>
                          )}
                          {showHook && (
                            <motion.div key="hook" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">
                                <Webhook className="h-3.5 w-3.5" /> Webhook URL (Zapier / Make) {webhook.trim() && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                              </label>
                              <input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://hooks.zapier.com/…" className={`${inputCls} mt-1.5`} />
                              <p className="mt-1 text-[10px] font-semibold text-gray-400">We send name, email, phone, source and message for each lead.</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {!showHook && (
                          <button type="button" onClick={() => setShowAdvanced(true)} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-[#8b7355]">
                            <ChevronDown className="h-3.5 w-3.5" /> Use a webhook / Zapier instead
                          </button>
                        )}
                      </div>

                      {/* Where to click, for the CRM they picked */}
                      {provider ? (
                        <motion.div key={provider.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">Where to find it in {provider.name.replace(' (formerly Chime)', '')}</p>
                          {provider.options.map((opt, oi) => (
                            <div key={oi} className="mt-3">
                              {(provider.options.length > 1 || opt.preferred) && (
                                <p className="flex items-center gap-1.5 text-[11px] font-black text-[#111827] dark:text-white">
                                  {provider.options.length > 1 && `Option ${oi + 1} - `}{opt.label}
                                  {opt.preferred && <span className="rounded-full bg-[#C9A24D]/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#d7b974]">Best</span>}
                                </p>
                              )}
                              <ol className="mt-1.5 space-y-1.5">
                                {opt.steps.map((st, i) => (
                                  <motion.li key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="flex gap-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/20 text-[9px] font-black text-[#8b7355] dark:text-[#e8c97a]">{i + 1}</span>{st}
                                  </motion.li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </motion.div>
                      ) : (
                        <div className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs font-bold text-gray-400 dark:border-white/10">Pick your CRM in step 1 to see where to find this.</div>
                      )}
                    </div>
                  )}
                </StepBlock>

                {/* 3 - save + test */}
                <StepBlock n={3} title="Save & send a test lead" done={!!lastPushAgo && !lastBad} last>
                  <div className="flex flex-wrap items-center gap-2">
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => save()} disabled={saving || !dirty}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wide transition disabled:cursor-not-allowed ${saved ? 'bg-emerald-500 text-white' : dirty ? 'lx-shine relative overflow-hidden bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827] shadow-md shadow-[#C9A24D]/30 hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                      <span className="relative inline-flex items-center gap-2">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}{saved ? 'Saved' : dirty ? 'Save' : 'All saved'}</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={runTest} disabled={testing || !hasChannel}
                      className="group inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] disabled:opacity-40 dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 transition-transform group-hover:-rotate-12 group-hover:translate-x-0.5" />} Send test lead
                    </motion.button>
                    {lastPushAgo && !testResult && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${lastBad ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${lastBad ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        Last lead sent {lastPushAgo}{info?.crm_last_push_status ? ` · ${info.crm_last_push_status}` : ''}{lastBad ? ' - check your key / URL' : ''}
                      </span>
                    )}
                  </div>
                  <AnimatePresence>
                    {testResult && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-3 rounded-xl border px-3 py-2.5 text-xs font-semibold ${/could not|problem/i.test(testResult.detail) ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300'}`}>
                        {testResult.detail}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </StepBlock>
              </div>
            </motion.section>

            {/* ---------- Leads IN: portal forwarding ---------- */}
            <motion.section id="leads-in" variants={rise} className="scroll-mt-24 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <LuxeSectionHeader icon={Inbox} kicker="Leads in" title={<>Pull in <em>portal leads</em></>} subtitle="Forward portal lead emails to your private address - they appear in Leads, tagged “Portal Lead”." />
              <div className="space-y-5 p-5 sm:p-6">
                <LuxeSurface icon={Mail} className="rounded-2xl border border-[#C9A24D]/30 p-4 dark:border-white/[0.07] sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">Your private forwarding address</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input readOnly value={info?.inbound_address ?? ''} onFocus={e => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-xl border border-[#C9A24D]/30 bg-white/85 px-3.5 py-3 text-sm font-bold text-[#111827] outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-white" />
                    <motion.button whileTap={{ scale: 0.96 }} onClick={copyAddr}
                      className="lx-shine relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5">
                      <span className="relative inline-flex items-center gap-1.5">{copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}</span>
                    </motion.button>
                  </div>
                  <button onClick={rotate} disabled={rotating}
                    className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-red-600 disabled:opacity-50">
                    {rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Make a new address
                  </button>
                </LuxeSurface>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">How to forward from each portal</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(info?.portal_instructions || []).map(p => {
                      const open = openPortal === p.portal
                      return (
                        <motion.div key={p.portal} layout className={`overflow-hidden rounded-2xl border transition ${open ? 'border-[#C9A24D]/60 shadow-[0_14px_30px_-20px_rgba(201,162,77,.8)]' : 'border-gray-200 hover:border-[#C9A24D]/40 dark:border-white/[0.08]'}`}>
                          <button type="button" onClick={() => setOpenPortal(o => o === p.portal ? null : p.portal)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white" style={{ background: PORTAL_COLORS[p.portal] || '#6b7280' }}>{p.label.replace(/[^A-Za-z]/g, '').slice(0, 1)}</span>
                            <span className="flex-1 text-xs font-black text-[#111827] dark:text-white">{p.label}</span>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-[#C9A24D]' : ''}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-100 px-3.5 text-xs leading-relaxed text-gray-600 dark:border-white/[0.06] dark:text-gray-300">
                                <span className="block py-3">{p.steps}</span>
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </div>
    </div>
  )
}

const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } } }

const CRM_COLORS: Record<string, string> = {
  fub: '#2563eb', lofty: '#4f46e5', kvcore: '#0f766e', sierra: '#0891b2', boomtown: '#ea580c', realgeeks: '#16a34a',
  wiseagent: '#7c3aed', liondesk: '#d97706', ixact: '#0284c7', topproducer: '#be123c', other: '#8b7355',
}
const CRM_MARKS: Record<string, string> = {
  fub: 'FUB', lofty: 'Lo', kvcore: 'kv', sierra: 'Si', boomtown: 'BT', realgeeks: 'RG', wiseagent: 'WA', liondesk: 'LD', ixact: 'IX', topproducer: 'TP', other: '+',
}
const PORTAL_COLORS: Record<string, string> = { zillow: '#006AFF', realtor: '#D92228', homes: '#F26B21', facebook: '#1877F2' }

const INT_CSS = `
.int-flow{position:absolute;top:50%;height:2px;width:56px;background:repeating-linear-gradient(90deg,rgba(201,162,77,.55) 0 6px,transparent 6px 14px);background-size:28px 2px;animation:intFlow 1.1s linear infinite}
.int-flow-l{left:0}
.int-flow-r{right:0}
@keyframes intFlow{to{background-position:28px 0}}
.int-pulse{animation:intPulse 2.6s ease-in-out infinite}
@keyframes intPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
@media (prefers-reduced-motion: reduce){.int-flow,.int-pulse{animation:none}}
`

function FlowSide({ href, dir, title, sub, status, ok, chips }: { href: string; dir: 'in' | 'out'; title: string; sub: string; status: string; ok: boolean; chips: string[] }) {
  return (
    <a href={href} className="group relative block p-5 transition hover:bg-[#fffaf0] dark:hover:bg-white/[0.02] sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] transition group-hover:bg-[#C9A24D] group-hover:text-[#111827] dark:text-[#e8c97a]">
          {dir === 'in' ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
        </span>
        <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{title}</p>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/50'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} />{status}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{sub}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <motion.span key={c} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">{c}</motion.span>
        ))}
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] opacity-0 transition group-hover:opacity-100 dark:text-[#e8c97a]">Set up <ChevronDown className="h-3 w-3" /></span>
    </a>
  )
}

function StepBlock({ n, title, done, last, children }: { n: number; title: string; done: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <motion.span animate={{ backgroundColor: done ? '#10b981' : '#C9A24D' }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white shadow-sm">
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : n}
        </motion.span>
        {!last && <span className="mt-1 w-px flex-1 bg-gradient-to-b from-[#C9A24D]/40 to-transparent" />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="mb-3 mt-1 text-sm font-black text-[#111827] dark:text-white">{title}</p>
        {children}
      </div>
    </div>
  )
}
