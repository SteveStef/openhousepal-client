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
import { ArrowUpRight, Globe, Link2, Loader2, PowerOff, Star } from 'lucide-react'
import api from '@/lib/api-service'
import DomainHealthBanner from '@/components/DomainHealthBanner'
import type { LinkDomainState } from '@/types'

export type { LinkDomainState }

const hostOf = (url?: string | null) => {
  try { return url ? new URL(url).host : '' } catch { return url || '' }
}

export function useLinkDomain() {
  const [state, setState] = useState<LinkDomainState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.sites.getLinkDomain().then(({ success, data }) => { if (success && data) setState(data) })
  }, [])
  const setUseOwn = async (on: boolean) => {
    if (!state || saving || (on && !state.has_custom_domain)) return
    const prev = state
    setState({ ...state, use_own_domain: on, current_base_url: on && state.own_base_url ? state.own_base_url : state.platform_base_url })
    setSaving(true)
    setError(null)
    const { success, data } = await api.sites.setLinkDomain(on)
    setSaving(false)
    if (success && data) setState(data)
    else { setState(prev); setError("Couldn't save that - try again.") }
  }
  const setSiteEnabled = async (on: boolean) => {
    if (!state || saving) return false
    setSaving(true)
    setError(null)
    const { success, data } = await api.sites.setSiteEnabled(on)
    setSaving(false)
    if (success && data) { setState(data); return true }
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

export default function IdxDomainCard({ children, linkDomain }: { children?: ReactNode; linkDomain?: LinkDomainHook }) {
  const own = useLinkDomain()
  const { state, saving, error, setUseOwn } = linkDomain || own
  const siteOff = state?.site_enabled === false
  const hasCustom = !!state?.has_custom_domain
  const on = !!state?.use_own_domain
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
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 dark:border-gray-800">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold text-[#111827] dark:text-white">{hostOf(state.default_base_url)}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Your default address — included free with IDX, set up automatically.</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-300">Default · Free</span>
          </div>
          {/* The agent's own, uploaded domain */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 dark:border-gray-800">
            <div className="min-w-0">
              {hasCustom ? (
                <p className="truncate font-mono text-xs font-bold text-[#111827] dark:text-white">{state.custom_domain}</p>
              ) : (
                <p className="text-xs font-bold text-gray-400">No domain of your own connected yet</p>
              )}
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                {hasCustom ? 'Your own domain — connected and live.' : 'Bring a domain you own (like yourname.com) — connect it below.'}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${hasCustom ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
              {hasCustom ? <><Star className="h-2.5 w-2.5" /> Your own</> : 'Not connected'}
            </span>
          </div>
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
  const toggle = async () => {
    if (on && !confirm('Turn off your IDX website?\n\nIt stops being served (visitors get a "not available" page) and every new QR code and link uses openhousepal.com instead. Nothing is deleted - turn it back on any time.')) return
    await setSiteEnabled(!on)
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
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
  return (
    <Link href="/settings#idx-domain" className="group mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#C9A24D] dark:border-gray-800 dark:bg-[#151517]">
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Your links use</span>
        <span className="block truncate font-mono text-xs font-bold text-[#8b7355] dark:text-[#d7b974]">{hostOf(state.current_base_url)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-gray-500 group-hover:text-[#111827] dark:text-gray-400 dark:group-hover:text-white">
        {label} · Change <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
