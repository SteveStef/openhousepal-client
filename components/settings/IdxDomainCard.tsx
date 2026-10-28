'use client'

// Settings -> IDX Website -> "IDX Domain": an IDX agent's addresses in one squared section.
// Three addresses, never conflated (see backend site_routes._link_domain_state):
//   - the DEFAULT address, <slug>.openhousepal.com - free, automatic, always works
//   - the agent's OWN domain - only one they uploaded/connected themselves, once it's fully live
//   - plain openhousepal.com - what every link uses unless an own domain is connected (any plan)
// "Use my own domain for my links" can only be on when a real custom domain is connected; the
// default subdomain is never presented as "your own domain".
// LinkDomainShortcut is the one-line version the website builder's Domain tab shows.
import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Globe, Link2, Loader2, Lock, PowerOff, Star } from 'lucide-react'
import api from '@/lib/api-service'
import { useSaveTracker } from '@/components/ui/SaveStatus'
import DomainHealthBanner from '@/components/DomainHealthBanner'
import DomainWarningSheet from '@/components/domains/DomainWarningSheet'
import type { LinkDomainState } from '@/types'

export type { LinkDomainState }

const hostOf = (url?: string | null) => {
  try { return url ? new URL(url).host : '' } catch { return url || '' }
}

export function useLinkDomain() {
  const [state, setState] = useState<LinkDomainState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // On Settings the page's save status shows these switches' saves too (components/ui/SaveStatus).
  const tracker = useSaveTracker()
  const tracked = <T,>(job: () => Promise<T>, key: string) => (tracker ? tracker.track(job, { key }) : job())
  useEffect(() => {
    api.sites.getLinkDomain().then(({ success, data }) => { if (success && data) setState(data) })
  }, [])
  const setUseOwn = async (on: boolean) => {
    if (!state || saving || (on && !state.has_custom_domain)) return
    const prev = state
    setState({ ...state, use_own_domain: on, current_base_url: on && state.own_base_url ? state.own_base_url : state.platform_base_url })
    setSaving(true)
    setError(null)
    const { success, data } = await tracked(async () => {
      const r = await api.sites.setLinkDomain(on)
      if (r.success && r.data) { setState(r.data); setError(null) }
      return r
    }, 'link-domain')
    setSaving(false)
    if (!(success && data)) { setState(prev); setError("Couldn't save that - try again.") }
  }
  const setSiteEnabled = async (on: boolean) => {
    if (!state || saving) return false
    setSaving(true)
    setError(null)
    const { success, data } = await tracked(async () => {
      const r = await api.sites.setSiteEnabled(on)
      if (r.success && r.data) { setState(r.data); setError(null) }
      return r
    }, 'site-enabled')
    setSaving(false)
    if (success && data) return true
    setError("Couldn't save that - try again.")
    return false
  }
  return { state, saving, error, setUseOwn, setSiteEnabled }
}

export type LinkDomainHook = ReturnType<typeof useLinkDomain>

function Switch({ on, disabled, onClick, label, saving }: { on: boolean; disabled?: boolean; onClick: () => void; label: string; saving?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      {saving && <Loader2 className="absolute -left-6 h-4 w-4 animate-spin text-gray-400" />}
    </button>
  )
}

function ActiveChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30">
      <CheckCircle2 className="h-2.5 w-2.5" /> Active
    </span>
  )
}

function DefaultChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827]">
      <Star className="h-2.5 w-2.5" /> Default
    </span>
  )
}

export default function IdxDomainCard({ children, linkDomain }: { children?: ReactNode; linkDomain?: LinkDomainHook }) {
  const own = useLinkDomain()
  const { state, saving, error, setUseOwn } = linkDomain || own
  const siteOff = state?.site_enabled === false
  const hasCustom = !!state?.has_custom_domain
  const on = !!state?.use_own_domain
  // links really use the own domain right now (it opens) - then the free address forwards to it
  const ownLive = on && !!state?.own_base_url && state?.current_base_url === state?.own_base_url
  // Tapping the switch before a domain is connected points them to where they connect one.
  const [needDomain, setNeedDomain] = useState(false)

  return (
    <section id="idx-domain" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><Globe className="h-4 w-4" /></span>
        <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">IDX Domain</h2>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
        Your web addresses and which one your links use.
      </p>
      <DomainHealthBanner inline className="mt-4" />

      {/* The address list only earns its space once there's a domain of their own to compare -
          before that, the domain manager below already shows the free address. */}
      {state && hasCustom && (
        <div className="mt-4 space-y-2">
          {/* Default - free, automatic */}
          {/* The agent's own, uploaded domain - shines as live; "Default" while links use it */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-300 bg-gradient-to-br from-white via-emerald-50/60 to-[#f3fbf6] px-3.5 py-2.5 shadow-[0_12px_30px_-22px_rgba(16,185,129,.6)] dark:border-emerald-500/35 dark:from-[#101814] dark:via-[#0f1a15] dark:to-emerald-500/[0.10]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs font-bold text-[#111827] dark:text-white">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="truncate">{state.custom_domain}</span>
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-200/80">Your own domain — connected and live.</p>
              </div>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                <ActiveChip />
                {ownLive && <DefaultChip />}
              </span>
            </div>
          </div>
          {/* Default - free, automatic */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 dark:border-gray-800">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold text-[#111827] dark:text-white">{hostOf(state.default_base_url)}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{ownLive
                ? `Your free OpenHousePal address — still works and sends visitors to ${state.custom_domain}.`
                : 'Your free OpenHousePal address — included with IDX, set up automatically.'}</p>
            </div>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              <ActiveChip />
              {!ownLive && <DefaultChip />}
            </span>
          </div>
          {/* The "Both links work..." note sits under the own domain in the domain manager below. */}
        </div>
      )}

      {siteOff ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <PowerOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-black text-amber-900 dark:text-amber-200">Your IDX website is turned off</p>
            <p className="mt-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              These addresses aren&apos;t served while it&apos;s off, so your QR codes and links use <span className="font-mono">{hostOf(state?.platform_base_url)}</span> instead. Turn it back on above any time.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#111827] dark:text-white">Use my own domain for my links</p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {hasCustom
                ? 'New sign-in QR codes, Guest Passes, Showcases, forms and copied links use your own domain. Turn it off to keep them on openhousepal.com.'
                : 'Have a domain like janesmithhomes.com? Connect it first - then switch this on and your new links use it. Until then they use openhousepal.com.'}
            </p>
            {!hasCustom && (
              <Link href="/studio/website?tab=domains" className={`mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wide transition hover:-translate-y-0.5 ${needDomain ? 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827] shadow-md shadow-[#C9A24D]/30' : 'border border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300'}`}>
                <Globe className="h-3.5 w-3.5" /> Connect my domain <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {needDomain && !hasCustom && <p className="mt-2 text-xs font-bold text-[#8b6a2b] dark:text-[#e8c97a]">Connect your domain first - this switch turns on once it&apos;s connected.</p>}
            {state && (
              <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
                <span className="shrink-0">Your links use</span>
                <span className="truncate font-mono text-[#8b7355] dark:text-[#d7b974]">{hostOf(state.current_base_url)}</span>
              </p>
            )}
            {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
          </div>
          <Switch on={on} saving={saving} disabled={!state || saving} onClick={() => (hasCustom ? setUseOwn(!on) : setNeedDomain(true))} label="Use my own domain for my links" />
        </div>
      )}

      {children && <div className="mt-5">{children}</div>}
    </section>
  )
}

// The IDX website on/off switch - Settings -> IDX Website (top card). Off = the public site isn't
// served at all and every link falls back to openhousepal.com; on = back exactly as published.
export function IdxSiteSwitch({ linkDomain }: { linkDomain: LinkDomainHook }) {
  const { state, saving, error, setSiteEnabled } = linkDomain
  const on = state?.site_enabled !== false
  const [askOff, setAskOff] = useState(false)
  const toggle = async () => {
    if (on) { setAskOff(true); return }
    await setSiteEnabled(true)
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <DomainWarningSheet open={askOff} onClose={() => setAskOff(false)} onConfirm={() => setSiteEnabled(false)}
        title="Turn off your IDX website?" subtitle="Nothing is deleted"
        points={[
          { text: <>Your IDX website stops opening on all your addresses{state?.custom_domain ? <> (including <b className="font-mono">{state.custom_domain}</b>)</> : null} - visitors see a &quot;not available&quot; page.</> },
          { text: <>Every new QR code, Guest Pass, Showcase, form and copied link uses <b>openhousepal.com</b> instead.</> },
          { text: <>Your Agent Hub, open houses, leads and the rest of your plan keep working as usual.</>, tone: 'ok' },
          { text: <>Your pages and settings are kept - switch it back on any time and it&apos;s back exactly as published.</>, tone: 'ok' },
        ]}
        confirmLabel="Turn it off" cancelLabel="Keep it on" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">IDX Website</p>
        <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{on ? 'On — your IDX website is live on your addresses' : 'Off — you’re using a website of your own'}</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
          {on
            ? 'Already have a website? Turn this off - your QR codes, Agent Hub, signature and other links will use openhousepal.com instead.'
            : 'Your IDX site isn’t shown to anyone and nothing links to it. Everything else in your plan keeps working. Turn it on to publish it again.'}
        </p>
        {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
      </div>
      <Switch on={on} saving={saving} disabled={!state || saving} onClick={toggle} label="IDX website on or off" />
    </div>
  )
}

export function LinkDomainShortcut() {
  const { state } = useLinkDomain()
  if (!state) return null
  const label = state.site_enabled === false ? 'IDX site: off' : state.use_own_domain ? 'Own domain: on' : state.has_custom_domain ? 'Own domain: off' : 'Default address'
  const own = state.site_enabled !== false && !!state.use_own_domain
  return (
    // Phones: stacked - label + status on one line, the full address under it, a real Change pill
    // (owner, 10/24: the one-row version wrapped the label and cut the domain off at 390px).
    <Link href="/settings#idx-domain" className={`group mb-4 flex flex-col gap-2.5 rounded-2xl border bg-white px-4 py-3 ${own ? 'border-emerald-300 dark:border-emerald-500/35' : 'border-gray-200'} text-left shadow-sm transition-colors hover:border-[#C9A24D] ${own ? '' : 'dark:border-gray-800'} dark:bg-[#151517] sm:flex-row sm:items-center sm:justify-between sm:gap-3`}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-400">Your links use</span>
          {/* The own domain in use reads as live - green, like its card below (user, 10/27: a grey
              "Own domain: on" didn't look on) */}
          {own ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Own domain · live</span>
          ) : (
            <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-300">{label}</span>
          )}
        </span>
        <span className={`mt-1 flex items-center gap-1.5 break-all font-mono text-[13px] font-bold leading-snug ${own ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>{own && <Lock className="h-3.5 w-3.5 shrink-0" />}{hostOf(state.current_base_url)}</span>
      </span>
      <span className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-gray-600 transition group-hover:border-[#C9A24D] group-hover:text-[#111827] dark:border-gray-700 dark:text-gray-300 dark:group-hover:text-white sm:self-center">
        Change <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
