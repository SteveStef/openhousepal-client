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
import { ArrowUpRight, Globe, Link2, Loader2, Lock, PowerOff } from 'lucide-react'
import api from '@/lib/api-service'
import { useSaveTracker } from '@/components/ui/SaveStatus'
import DomainHealthBanner from '@/components/DomainHealthBanner'
import DomainConfirmReminder from '@/components/domains/DomainConfirmReminder'
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
  const setDomainForward = async (forward: boolean) => {
    if (!state || saving) return false
    setSaving(true)
    setError(null)
    const { success, data } = await tracked(async () => {
      const r = await api.sites.setDomainForward(forward)
      if (r.success && r.data) { setState(r.data); setError(null) }
      return r
    }, 'domain-forward')
    setSaving(false)
    if (success && data) return true
    setError("Couldn't save that - try again.")
    return false
  }
  return { state, saving, error, setUseOwn, setSiteEnabled, setDomainForward }
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
  const { state, saving, error, setUseOwn, setDomainForward } = linkDomain || own
  const siteOff = state?.site_enabled === false
  const hasCustom = !!state?.has_custom_domain
  const on = !!state?.use_own_domain
  const forwards = !!state?.domain_forwards
  const [askForward, setAskForward] = useState(false)
  const hubHost = (state?.hub_url || '').replace(/^https?:\/\//, '')

  // One decision box, then the domain manager (owner, 11/18: the page had grown two "connect a
  // domain" buttons, the addresses listed twice and "your links use" shown twice). The manager
  // below already lists every address, marks the Default one and connects / buys domains, so this
  // box only answers the one question that fits the moment:
  //   website on + own domain   -> do my links use my domain?
  //   website off + own domain  -> what does my domain do while the website is off?
  //   no own domain             -> just which address links use (connecting is in the manager)
  return (
    <section id="idx-domain" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <DomainWarningSheet open={askForward} onClose={() => setAskForward(false)} onConfirm={() => setDomainForward(true)}
        title={`Turn ${state?.custom_domain || 'your domain'} off completely?`} subtitle="Your domain stays connected - nothing is deleted"
        points={[
          { text: <>Anyone who opens <b className="font-mono">{state?.custom_domain}</b> is sent to your Agent Hub on OpenHousePal{hubHub(hubHost)}.</> },
          { text: <>Google stops listing <b className="font-mono">{state?.custom_domain}</b> over the next few weeks, and anything it had built up for your domain in search fades with it.</> },
          { text: <>Business cards, signs and emails printed with your domain still open - they just land on your OpenHousePal page instead.</> },
          { text: <>Your domain stays yours and stays connected here. Paying for the domain itself is between you and your domain company.</>, tone: 'ok' },
          { text: <>Change your mind? Switch back to &quot;Shows my Agent Hub&quot; any time - visitors see it right away; Google takes a few weeks to list it again.</>, tone: 'ok' },
        ]}
        confirmLabel="Turn my domain off" cancelLabel="Keep showing my Hub" />
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><Globe className="h-4 w-4" /></span>
        <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">IDX Domain</h2>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
        Your web addresses and which one your links use.
      </p>
      <DomainConfirmReminder inline className="mt-4" />
      <DomainHealthBanner inline className="mt-4" />

      {state && siteOff && hasCustom && (
        <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800" data-testid="domain-when-off">
          <p className="text-sm font-black text-[#111827] dark:text-white">While your website is off, <span className="font-mono">{state.custom_domain}</span>…</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What your domain does while your website is off">
            {([
              { key: 'hub', active: !forwards, icon: Link2, title: 'Shows my Agent Hub', blurb: 'Your domain keeps working and shows your Agent Hub, with your name in Google.' },
              { key: 'off', active: forwards, icon: PowerOff, title: 'Turned off completely', blurb: `Every visit goes to your OpenHousePal page${hubHost ? ` (${hubHost})` : ''}. Google drops your domain over a few weeks.` },
            ] as const).map(o => (
              <button key={o.key} type="button" role="radio" aria-checked={o.active} disabled={saving || o.active} data-testid={`domain-when-off-${o.key}`}
                onClick={() => (o.key === 'off' ? setAskForward(true) : setDomainForward(false))}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-default ${o.active
                  ? o.key === 'off' ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-900/10' : 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/35 dark:bg-emerald-900/10'
                  : 'border-gray-200 hover:border-[#C9A24D] dark:border-gray-800'}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${o.active ? (o.key === 'off' ? 'border-amber-500' : 'border-emerald-500') : 'border-gray-300 dark:border-gray-600'}`}>
                  {o.active && <span className={`h-2.5 w-2.5 rounded-full ${o.key === 'off' ? 'bg-amber-500' : 'bg-emerald-500'}`} />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-black text-[#111827] dark:text-white"><o.icon className="h-3.5 w-3.5 text-[#C9A24D]" /> {o.title}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-gray-500 dark:text-gray-400">{o.blurb}</span>
                </span>
              </button>
            ))}
          </div>
          <LinksUse state={state} />
          {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
        </div>
      )}

      {state && !siteOff && hasCustom && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#111827] dark:text-white">Use my own domain for my links</p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              New sign-in QR codes, Guest Passes, Showcases, forms and copied links use your own domain. Turn it off to keep them on openhousepal.com.
            </p>
            <LinksUse state={state} />
            {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
          </div>
          <Switch on={on} saving={saving} disabled={saving} onClick={() => setUseOwn(!on)} label="Use my own domain for my links" />
        </div>
      )}

      {state && !hasCustom && (
        <div className="mt-4">
          <LinksUse state={state} />
          <p className="mt-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {siteOff
              ? 'Your website is off, so everything you share uses openhousepal.com.'
              : 'Connect a domain of your own below and your links can use it instead.'}
          </p>
        </div>
      )}

      {children && <div className="mt-5">{children}</div>}
    </section>
  )
}

const hubHub = (host: string) => (host ? <> (<span className="font-mono">{host}</span>)</> : null)

/** "Your links use <address>" - the one place it's said on this page. */
function LinksUse({ state }: { state: LinkDomainState }) {
  return (
    <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
      <span className="shrink-0">Your links use</span>
      <span className="truncate font-mono text-[#8b7355] dark:text-[#d7b974]">{hostOf(state.current_base_url)}</span>
    </p>
  )
}

// The IDX website on/off switch - Settings -> IDX Website (top card). Off = the public site isn't
// served at all and every link falls back to openhousepal.com; on = back exactly as published.
/** The same switch on the IDX feature's own Domain tab - one saved setting, so both always agree. */
export function IdxFeatureSwitch() {
  const linkDomain = useLinkDomain()
  return <div className="mb-3"><IdxSiteSwitch linkDomain={linkDomain} /></div>
}

/** `embedded`: just the row, for the top of Settings' "Your website" card (owner 11/18: one card for
 * the website's on/off, status and address instead of two). */
export function IdxSiteSwitch({ linkDomain, embedded = false }: { linkDomain: LinkDomainHook; embedded?: boolean }) {
  const { state, saving, error, setSiteEnabled } = linkDomain
  const on = state?.site_enabled !== false
  const [askOff, setAskOff] = useState(false)
  const toggle = async () => {
    if (on) { setAskOff(true); return }
    await setSiteEnabled(true)
  }
  return (
    <div className={`flex items-start justify-between gap-4 ${embedded ? '' : 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6'}`}>
      <DomainWarningSheet open={askOff} onClose={() => setAskOff(false)} onConfirm={() => setSiteEnabled(false)}
        title="Turn off your IDX website?" subtitle="Nothing is deleted"
        points={[
          { text: <>Your IDX website stops opening - visitors to your free address see a &quot;not available&quot; page.</> },
          ...(state?.custom_domain ? [{ text: state.domain_forwards
            ? <><b className="font-mono">{state.custom_domain}</b> sends visitors to your Agent Hub on OpenHousePal (you chose &quot;Turned off completely&quot;).</>
            : <><b className="font-mono">{state.custom_domain}</b> keeps working and shows your Agent Hub by itself, with your name in Google. You can turn the domain off completely under IDX Domain.</>, tone: 'ok' as const }] : []),
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
