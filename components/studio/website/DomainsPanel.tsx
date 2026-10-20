'use client'

import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Copy, ExternalLink, Globe2, Loader2, Lock, Plus, RefreshCw, ShieldCheck, Star, Trash2 } from 'lucide-react'
import api from '@/lib/api-service'
import { SiteDomain } from '@/types'
import { copyText } from '@/lib/copyText'
import { ohpHostUrl } from '@/lib/publicResourceLinks'
import DomainSetupGuide from './DomainSetupGuide'
import OneClickConnect from '@/components/domains/OneClickConnect'
import BuyDomain, { PurchasedDomainCard, useDomainShop } from '@/components/domains/BuyDomain'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
// Agents can connect their own domain once the platform side (Cloudflare custom hostnames + the
// sites.openhousepal.com address) is live - until then the form says it opens soon instead of
// letting someone set up DNS that can't work yet.
const CUSTOM_DOMAINS_LIVE = process.env.NEXT_PUBLIC_CUSTOM_DOMAINS_LIVE === 'true'

// Agent-facing labels/colors - never show the raw backend status string or a resolver/ACME
// error verbatim (see backend/app/services/website/domain_verification_service.py).
const STATUS_META: Record<SiteDomain['status'], { label: string; className: string; dot: string }> = {
  PENDING: { label: 'Waiting for DNS', className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-500/30', dot: 'bg-amber-500 animate-pulse' },
  VERIFIED: { label: 'Setting up HTTPS...', className: 'bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-500/30', dot: 'bg-blue-500 animate-pulse' },
  ACTIVE: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30', dot: 'bg-emerald-500' },
  FAILED: { label: 'Problem — check DNS', className: 'bg-red-50 text-red-600 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-500/30', dot: 'bg-red-500' },
}

// Where a custom domain is in setup: DNS record -> we verify it -> HTTPS live.
const SETUP_STEPS = ['Add DNS record', 'We verify it', 'HTTPS live']
const stepOf = (status: SiteDomain['status']) => (status === 'ACTIVE' ? 3 : status === 'VERIFIED' ? 2 : 0)

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { copyText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {}) }}
      title={`${label} ${text}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border p-1.5 transition-all hover:-translate-y-0.5 ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60'}`}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function StatusChip({ status }: { status: SiteDomain['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ring-1 ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
    </span>
  )
}

function DomainRow({ domain, partner, onChanged, back, bought }: { domain: SiteDomain; partner?: SiteDomain; onChanged: () => void; back: string; bought: boolean }) {
  const [checking, setChecking] = useState(false)
  const [settingPrimary, setSettingPrimary] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isRedirect = !!domain.redirect_target_domain_id
  const step = stepOf(domain.status)
  const failed = domain.status === 'FAILED'

  const handleCheck = async () => {
    setChecking(true)
    await api.sites.checkDomain(domain.id)
    if (partner) await api.sites.checkDomain(partner.id)
    setChecking(false)
    onChanged()
  }

  const handleMakePrimary = async () => {
    setSettingPrimary(true)
    await api.sites.makeDomainPrimary(domain.id)
    setSettingPrimary(false)
    onChanged()
  }

  const handleDelete = async () => {
    if (!confirm(`Disconnect ${partner ? `${partner.hostname} and ${domain.hostname}` : domain.hostname}?`)) return
    setDeleting(true)
    await api.sites.deleteDomain(domain.id)
    setDeleting(false)
    onChanged()
  }

  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${domain.status === 'ACTIVE' ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 dark:border-emerald-500/25 dark:from-[#151517] dark:to-emerald-500/[0.06]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${domain.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-[#FAFAF7] text-[#8b7355] dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>
          {domain.status === 'ACTIVE' ? <Lock className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-all font-mono text-[13px] font-bold leading-snug text-[#111827] dark:text-white">{domain.hostname}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusChip status={domain.status} />
            {domain.is_primary && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827]">
                <Star className="h-2.5 w-2.5" /> Primary
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title={`Disconnect ${domain.hostname}`}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isRedirect && (
        <p className="mt-2 text-[11px] font-semibold text-gray-400">Redirects to your primary domain once connected.</p>
      )}

      {/* Live checklist - the three things that have to be true, ticked as our checks see them */}
      {(domain.status !== 'ACTIVE' || (partner && partner.status !== 'ACTIVE')) && (
        <ul className="mt-3 space-y-1.5">
          {[
            { label: `${domain.hostname.split('.')[0] === 'www' ? '"www"' : 'Domain'} record found`, done: domain.status === 'VERIFIED' || domain.status === 'ACTIVE', bad: failed },
            ...(partner ? [{ label: `${partner.hostname} forwards to it`, done: partner.status === 'ACTIVE', bad: false }] : []),
            { label: 'Secure padlock (https) live', done: domain.status === 'ACTIVE', bad: false },
          ].map(item => (
            <li key={item.label} className="flex items-center gap-2 text-[12px] font-semibold">
              <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${item.done ? 'bg-emerald-500 text-white' : item.bad ? 'bg-red-100 text-red-600 dark:bg-red-500/15' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}>
                {item.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={item.done ? 'text-emerald-700 dark:text-emerald-300' : item.bad ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-white/55'}>{item.label}</span>
            </li>
          ))}
          {failed && <li className="pl-6 text-[11px] font-semibold text-red-500">Your domain has a different "www" record right now - replace it with the one in step 2.</li>}
          {partner?.last_error === 'forward_http' && <li className="pl-6 text-[11px] font-semibold text-red-500">{partner.hostname} forwards to http:// - visitors get "page not found". Change the forward to https:// (on GoDaddy it&apos;s the small dropdown on the left of the address box).</li>}
        </ul>
      )}

      {domain.status !== 'ACTIVE' && bought && (
        // Bought here - we set the records ourselves; it just needs a little time.
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-emerald-50 p-2.5 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" /> Nothing for you to do - we set this up for you. New domains usually open within an hour (sometimes up to a day).
        </p>
      )}
      {domain.status !== 'ACTIVE' && !bought && <OneClickConnect domainId={domain.id} back={back} />}
      {domain.status !== 'ACTIVE' && !bought && (
        <DomainSetupGuide
          hostname={domain.hostname}
          target={domain.instructions.find(i => i.type === 'CNAME')?.value || `sites.${OHP_BASE_DOMAIN}`}
          pair={domain.instructions.some(i => i.type === 'FORWARD')}
        />
      )}
      {domain.status === 'ACTIVE' && partner && partner.status !== 'ACTIVE' && !bought && (
        <p className="mt-2 rounded-xl bg-[#FAFAF7] p-2.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-white/55">
          {partner.last_error === 'forward_http'
            ? <>Your site is live at {domain.hostname}, but {partner.hostname} forwards to http://{domain.hostname}, which shows &quot;page not found&quot;. At your domain company, change that forward to https://{domain.hostname} (on GoDaddy, switch the small http:// dropdown to https://), permanent (301).</>
            : <>Your site is live at {domain.hostname}. To make {partner.hostname} (without www) go there too, add forwarding at your domain company: forward it to https://{domain.hostname}, permanent (301).</>}
        </p>
      )}

      {(domain.status !== 'ACTIVE' || (partner && partner.status !== 'ACTIVE') || (!domain.is_primary && !isRedirect)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(domain.status !== 'ACTIVE' || (partner && partner.status !== 'ACTIVE')) && (
            <button
              onClick={handleCheck}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:bg-white dark:text-[#111827]"
            >
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Check Connection
            </button>
          )}
          {domain.status === 'ACTIVE' && !domain.is_primary && !isRedirect && (
            <button
              onClick={handleMakePrimary}
              disabled={settingPrimary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A24D]/50 bg-[#fbf3df] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#8b6a2b] transition hover:-translate-y-0.5 hover:border-[#C9A24D] disabled:opacity-50 dark:bg-[#C9A24D]/10 dark:text-[#e8c97a]"
            >
              {settingPrimary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />} Make Primary
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** `back` = where one-click connect / PayPal send the agent afterwards ('website' | 'settings' | 'setup').
 *  `startWith` opens on "I already have one" or "Get a new one". `hideFree` drops the free-address card (setup shows its own). */
export default function DomainsPanel({ subdomainSlug, bare = false, back = 'website', startWith = 'have', hideFree = false, onChanged }: {
  subdomainSlug: string; bare?: boolean; back?: string; startWith?: 'have' | 'buy'; hideFree?: boolean; onChanged?: () => void
}) {
  const [domains, setDomains] = useState<SiteDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [hostname, setHostname] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'have' | 'buy'>(startWith)
  const { shop, reload: reloadShop } = useDomainShop()
  const purchases = (shop?.purchases || []).filter(p => p.status !== 'ABANDONED')
  const boughtHosts = new Set(purchases.filter(p => p.status === 'ACTIVE' || p.status === 'REGISTERING').flatMap(p => [p.domain, `www.${p.domain}`]))

  const load = () => {
    api.sites.getDomains().then(res => {
      if (res.success && res.data) setDomains(res.data)
      setLoading(false)
    })
    onChanged?.()
  }
  const refreshAll = () => { load(); reloadShop() }
  useEffect(() => { setMode(startWith) }, [startWith])

  useEffect(() => { load() }, [])

  const hasActivePrimary = domains.some(d => d.is_primary && d.status === 'ACTIVE')
  const ohpHost = `${subdomainSlug}.${OHP_BASE_DOMAIN}`

  const handleAdd = async () => {
    const trimmed = hostname.trim().toLowerCase()
    if (!trimmed) return
    setAdding(true)
    setError(null)
    const res = await api.sites.addDomain(trimmed)
    if (res.success) {
      setHostname('')
      load()
    } else {
      setError(res.error || 'Could not connect that domain.')
    }
    setAdding(false)
  }

  return (
    <div className={bare ? '' : 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]'}>
      {!bare && (
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]">
          <Globe2 className="h-3.5 w-3.5" /> Domain
        </p>
      )}

      {/* Always-on OHP subdomain - never removable, keeps working even if a custom domain breaks */}
      {!hideFree && <div className={`${bare ? '' : 'mt-3 '}relative overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] via-[#fbf6ec] to-[#f4ead7] p-3.5 dark:border-white/10 dark:from-[#0b0f0e] dark:via-[#111827] dark:to-[#1d1810]`}>
        <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#C9A24D]/20 blur-2xl" />
        <div className="relative flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">OpenHousePal address</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {!hasActivePrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827]">
                <Star className="h-2.5 w-2.5" /> Primary
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30">
              <CheckCircle2 className="h-2.5 w-2.5" /> Active
            </span>
          </div>
        </div>
        <div className="relative mt-2 flex items-center gap-2 rounded-xl border border-white/80 bg-white/90 py-1.5 pl-3 pr-1.5 shadow-sm dark:border-white/10 dark:bg-black/30">
          <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 break-all font-mono text-[12px] font-bold leading-snug text-[#111827] dark:text-white">{ohpHost}</span>
          <CopyButton text={ohpHostUrl(ohpHost)} />
          <a href={ohpHostUrl(ohpHost)} target="_blank" rel="noreferrer" title="Open" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 transition-all hover:-translate-y-0.5 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="relative mt-2 text-[11px] font-semibold text-gray-500 dark:text-white/50">Always available, even if a custom domain has an issue.</p>
      </div>}

      <div className={`${hideFree ? '' : 'mt-5 '}flex items-center gap-2`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">Your own domain</p>
        <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
      </div>
      {loading ? (
        <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : domains.length > 0 && (
        <div className="mt-2.5 space-y-2.5">
          {domains.filter(d => !(d.redirect_target_domain_id && domains.some(m => m.id === d.redirect_target_domain_id))).map(domain => (
            <DomainRow key={domain.id} domain={domain} partner={domains.find(d => d.redirect_target_domain_id === domain.id)} onChanged={refreshAll} back={back} bought={boughtHosts.has(domain.hostname)} />
          ))}
        </div>
      )}
      {purchases.length > 0 && (
        <div className="mt-2.5 space-y-2.5">
          {purchases.map(p => <PurchasedDomainCard key={p.id} p={p} onChanged={refreshAll} />)}
        </div>
      )}

      {CUSTOM_DOMAINS_LIVE && (
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-[#f4efe4] p-1 dark:bg-white/[0.05]" role="tablist">
          {([['have', 'I already have one'], ['buy', 'Get a new one']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className={`rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-wide transition ${mode === id ? 'bg-white text-[#111827] shadow-sm dark:bg-[#1f1f22] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-white/50 dark:hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {CUSTOM_DOMAINS_LIVE && mode === 'buy' ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[#C9A24D]/50 bg-[#fffdf8] p-3 dark:border-white/15 dark:bg-white/[0.02]">
          <p className="mb-2.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-white/55">Don&apos;t have a domain yet? Pick one here - we buy it in your name and set it all up. Nothing to do at any other company.</p>
          <BuyDomain back={back} shop={shop} />
        </div>
      ) : !CUSTOM_DOMAINS_LIVE ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[#C9A24D]/50 bg-[#fffdf8] p-3.5 dark:border-white/15 dark:bg-white/[0.02]">
          <p className="text-[12.5px] font-black text-[#111827] dark:text-white">Connecting your own domain opens soon</p>
          <p className="mt-1 text-[12px] font-semibold leading-snug text-gray-500 dark:text-white/55">Have a domain like <span className="font-mono font-bold text-[#111827] dark:text-white">janesmithhomes.com</span>? You&apos;ll be able to connect it here with step-by-step help for your domain company. Your OpenHousePal address above works in the meantime.</p>
        </div>
      ) : (
      <div className="mt-3 rounded-2xl border border-dashed border-[#C9A24D]/50 bg-[#fffdf8] p-3 dark:border-white/15 dark:bg-white/[0.02]">
        {!loading && domains.length === 0 && (
          <p className="mb-2.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-white/55">Have a domain like <span className="font-mono font-bold text-[#111827] dark:text-white">janesmithhomes.com</span>? Connect it and your site lives there.</p>
        )}
        <form onSubmit={e => { e.preventDefault(); handleAdd() }} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C9A24D]" />
            <input
              value={hostname}
              onChange={e => setHostname(e.target.value)}
              placeholder="yourdomain.com"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-8 pr-3 font-mono text-sm outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !hostname.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Connect
          </button>
        </form>
        {error && <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>}
        <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-gray-400">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" /> Type it with or without www. We&apos;ll show you exactly what to click, and the secure padlock is set up for you once it connects.
        </p>
      </div>
      )}
    </div>
  )
}
