'use client'

// Alerts, calendar, CRM, and the IDX website steps - each a thin, friendly front on the feature's
// own endpoints (notification prefs, follow-ups, calendar OAuth, CRM push, site areas/theme/publish).
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, Check, Copy, ExternalLink, Globe, Loader2, Rocket } from 'lucide-react'
import api from '@/lib/api-service'
import { CONNECTED_EVENT, OUTLOOK_LIVE, openSignInTab } from '@/lib/providers'
import { GoogleCalendarLogo, OutlookLogo } from '@/components/brand/ProviderLogos'
import type { FeaturedSettings, IntegrationsInfo, NotificationPreferences, Site, SitePage, SiteTheme } from '@/types'
import { useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'
import TownPicker from './TownPicker'
import SendAsPanel from '@/components/integrations/SendAsPanel'
import { CLASSIC_ACCENTS, CLASSIC_DEFAULT_ACCENT, normalizeSiteTheme, siteLuxeMetal } from '@/lib/siteTheme'
import { LUXE_METALS, LUXE_METAL_ORDER } from '@/lib/luxeMetals'
import HeaderHomesPanel from '@/components/studio/website/HeaderHomesPanel'
import FeaturedSettingsPanel from '@/components/studio/website/FeaturedSettingsPanel'
import { BigToggle, ChoiceCard, Field, MoreOptions, SplitPreview, StepCtx, SubHead, Swatches, emailOk, useGate } from './SetupUi'
import { ohpHostUrl } from '@/lib/publicResourceLinks'
import SiteMiniPreview from '@/components/studio/website/SiteMiniPreview'
import { accentLabel } from '@/lib/accentSwatches'

const Spinner = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>

// ---------- Lead alerts + follow-ups ----------
export function AlertsStep({ ctx }: { ctx: StepCtx }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const { enabled, setEnabled } = useFollowupsEnabled()
  useEffect(() => { api.notifications.getPreferences().then(r => { if (r.success && r.data) setPrefs(r.data) }) }, [])
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'alerts' }) } }, [])
  if (!prefs) return <Spinner />
  const toggle = (cat: string, ch: 'email' | 'push', v: boolean) => {
    const next = { ...prefs, preferences: { ...prefs.preferences, [cat]: { ...prefs.preferences[cat], [ch]: v } } }
    setPrefs(next)
    ctx.markSaving(api.notifications.updatePreferences(next.preferences))
  }
  const leads = prefs.preferences.leads
  const others = prefs.categories.filter(c => c.id !== 'leads' && prefs.preferences[c.id])
  return (
    <div className="space-y-8">
      {leads && (
        <div>
          <SubHead sub="Someone signs in at an open house, fills in a form, or asks about a home.">When I get a new lead</SubHead>
          <div className="space-y-3">
            <BigToggle on={leads.email} onChange={v => toggle('leads', 'email', v)} title="Email me" blurb="Sent to your login email." />
            <BigToggle on={leads.push} disabled={!prefs.push_available} onChange={v => toggle('leads', 'push', v)} title="Send a notification to my phone" blurb={prefs.push_available ? 'Instant pop-up on your phone.' : 'Coming soon.'} />
          </div>
        </div>
      )}
      <div>
        <SubHead sub="We make a reminder when someone needs a call, a text or a check-in.">Follow-up reminders</SubHead>
        <BigToggle on={enabled !== false} disabled={enabled === null} onChange={v => setEnabled(v)} title="Remind me who to follow up with" blurb="Turn it off if your CRM already reminds you." />
      </div>
      {others.length > 0 && (
        <MoreOptions label="Other emails we can send you">
          {others.map(c => (
            <BigToggle key={c.id} on={prefs.preferences[c.id].email} onChange={v => toggle(c.id, 'email', v)} title={c.label} blurb={c.help} />
          ))}
        </MoreOptions>
      )}
    </div>
  )
}

// ---------- Calendar ----------
/** Refetch when a sign-in finishes in its own tab (app/settings/connected) or the agent comes back. */
export function useRefreshOnConnected(refresh: () => void) {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === CONNECTED_EVENT) refresh() }
    const onFocus = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus) }
  }, [refresh])
}

export function CalendarStep({ ctx }: { ctx: StepCtx }) {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [feed, setFeed] = useState('')
  const [copied, setCopied] = useState(false)
  const load = useCallback(() => { api.integrations.get().then(r => { if (r.success && r.data) setInfo(r.data) }) }, [])
  useEffect(load, [load])
  useRefreshOnConnected(load)
  // Once Google answers, the waiting spinner stops on its own.
  useEffect(() => { if (info?.google_calendar?.connected) setBusy(false) }, [info?.google_calendar?.connected])
  useGate(ctx, { ok: true }, [])
  if (!info) return <Spinner />
  const connect = async () => {
    setBusy(true); setErr('')
    let error = ''
    const opened = await openSignInTab(async () => {
      const r = await api.integrations.googleConnectUrl('setup')
      if (!r.success) error = r.error || ''
      return r.data?.auth_url
    })
    if (!opened) {
      setErr(error || 'Your browser blocked the new tab - allow pop-ups for OpenHousePal, then press Connect again.')
      setBusy(false)
    }
  }
  const googleOn = !!info.google_calendar?.connected
  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-[22px] border-2 p-5 ${googleOn ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-[#ece5d6] bg-white dark:border-white/10 dark:bg-[#141416]'}`}>
        <span className="h-12 w-12 shrink-0"><GoogleCalendarLogo /></span>
        <div className="min-w-[10rem] flex-1">
          <p className="text-[17px] font-black text-[#111827] dark:text-white">Google Calendar</p>
          <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
            {googleOn ? `Connected${info.google_calendar?.account_email ? ` to ${info.google_calendar.account_email}` : ''}`
              : busy ? 'Finish signing in on the new tab - this updates by itself.'
              : info.google_calendar_available ? 'Takes about 30 seconds.' : 'Not available yet.'}
          </p>
        </div>
        {googleOn
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[14px] font-black text-white"><CalendarCheck className="h-4 w-4" /> Connected</span>
          : <button type="button" disabled={!info.google_calendar_available || busy} onClick={connect} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl max-sm:w-full bg-[#111827] px-6 text-[15px] font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Connect <ExternalLink className="h-4 w-4" /></button>}
      </div>
      {!OUTLOOK_LIVE && (
        <div className="flex flex-wrap items-center gap-4 rounded-[22px] border-2 border-dashed border-[#ece5d6] bg-white/60 p-5 dark:border-white/10 dark:bg-[#141416]/60">
          <span className="h-12 w-12 shrink-0 opacity-60"><OutlookLogo /></span>
          <div className="min-w-[10rem] flex-1">
            <p className="text-[17px] font-black text-gray-500 dark:text-gray-400">Outlook Calendar</p>
            <p className="text-[14px] font-medium text-gray-400">Use Google for now.</p>
          </div>
          <span className="max-sm:w-full max-sm:text-center rounded-full bg-gray-100 px-4 py-2 text-[13px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">Coming soon</span>
        </div>
      )}
      {err && <p className="text-[14px] font-bold text-rose-600">{err}</p>}
      <p className="text-[13.5px] font-medium text-gray-500 dark:text-gray-400">Google opens in a new tab - sign in there and this page updates by itself.</p>
      <MoreOptions label="Use Apple Calendar or something else?">
        <p className="text-[14px] font-medium text-gray-600 dark:text-gray-300">Copy your private calendar link and add it as a &quot;subscribed calendar&quot; in any calendar app. It shows your reminders and open houses (read-only).</p>
        {feed
          ? <button type="button" onClick={() => { navigator.clipboard.writeText(feed); setCopied(true) }} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-[14px] font-black text-white dark:bg-white dark:text-[#111827]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy my calendar link'}</button>
          : <button type="button" onClick={async () => { const r = await api.tasks.calendarFeed(); if (r.success && r.data) setFeed(r.data.url) }} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#ece5d6] px-4 py-2.5 text-[14px] font-black text-[#111827] dark:border-white/10 dark:text-white">Show my calendar link</button>}
      </MoreOptions>
    </div>
  )
}

// ---------- Your email (send guest emails from the agent's own mailbox) ----------
export function MailboxStep({ ctx }: { ctx: StepCtx }) {
  useGate(ctx, { ok: true }, [])
  return <SendAsPanel back="setup" big />
}

// ---------- CRM ----------
export function CrmStep({ ctx }: { ctx: StepCtx }) {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null)
  const [kind, setKind] = useState<'fub' | 'other'>('fub')
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [hook, setHook] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.integrations.get().then(r => {
      if (r.success && r.data) {
        setInfo(r.data); setEmail(r.data.crm_parse_email || ''); setHook(r.data.crm_webhook_url || '')
        if (!r.data.crm_fub_connected && (r.data.crm_parse_email || r.data.crm_webhook_url)) setKind('other')
      }
    })
  }, [])
  const save = async () => {
    setBusy(true); setMsg(null)
    const r = await api.integrations.update({
      crm_push_enabled: true,
      crm_webhook_url: kind === 'other' ? hook.trim() || null : info?.crm_webhook_url || null,
      crm_parse_email: kind === 'other' ? email.trim() || null : info?.crm_parse_email || null,
      ...(kind === 'fub' && key.trim() ? { crm_fub_api_key: key.trim() } : {}),
    })
    setBusy(false)
    if (r.success && r.data) {
      setInfo(r.data); setKey('')
      if (!r.data.crm_push_enabled) { setMsg({ ok: false, text: 'Add a key or address first.' }); return false }
      const t = await api.integrations.testCrm()
      setMsg({ ok: true, text: t.success && t.data ? `Connected! ${t.data.detail}` : 'Connected! New leads will be sent there.' })
      return true
    }
    setMsg({ ok: false, text: r.error || 'That didn’t work - please check and try again.' })
    return false
  }
  const connected = !!info?.crm_push_enabled
  const hasInput = kind === 'fub' ? !!key.trim() : (!!hook.trim() || emailOk(email))
  useGate(ctx, {
    ok: !(kind === 'other' && email.trim() && !emailOk(email)),
    message: kind === 'other' && email.trim() && !emailOk(email) ? 'That CRM email address doesn’t look right.' : undefined,
    onContinue: async () => { if (hasInput) return save() },
  }, [kind, key, email, hook, hasInput])
  if (!info) return <Spinner />
  return (
    <div className="space-y-6">
      {connected && <p className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[14px] font-black text-white"><Check className="h-4 w-4" /> Leads are being sent to your CRM</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard on={kind === 'fub'} onClick={() => setKind('fub')} title="Follow Up Boss" blurb={info.crm_fub_connected ? 'Connected.' : 'Paste one key and you’re done.'} />
        <ChoiceCard on={kind === 'other'} onClick={() => setKind('other')} title="Another CRM" blurb="Lofty, kvCORE, BoomTown and more." />
      </div>
      {kind === 'fub' ? (
        <Field label={info.crm_fub_connected ? 'Replace your API key' : 'Your Follow Up Boss API key'} value={key} onChange={setKey} placeholder="fka_..." autoComplete="off"
          hint='In Follow Up Boss: Admin, then API, then "Create API Key". Copy it and paste it here.' />
      ) : (
        <>
          <Field label="Your CRM's lead email" value={email} onChange={setEmail} type="email" inputMode="email" placeholder="leads@yourcrm.com" hint="Most CRMs give you a special email address that turns emails into leads. Look for 'lead parsing' or 'email in'." invalid={!!email.trim() && !emailOk(email)} />
          <MoreOptions label="Have a webhook link instead?"><Field label="Webhook link" value={hook} onChange={setHook} placeholder="https://..." inputMode="url" /></MoreOptions>
        </>
      )}
      {info.crm_fub_note && kind === 'fub' && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{info.crm_fub_note}</p>}
      <button type="button" disabled={busy || !hasInput} onClick={save} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#111827] px-6 text-[15px] font-black text-white disabled:opacity-40 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Connect & send a test lead</button>
      {msg && <p className={`text-[14px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
    </div>
  )
}

// ---------- Website areas ----------
export function AreasStep({ ctx }: { ctx: StepCtx }) {
  // No preview here - there's nothing to see until towns are picked (user, 10/15).
  useGate(ctx, { ok: true }, [])
  return <TownPicker />
}

// ---------- Website homes (header + Featured page) ----------
export function HomesStep({ ctx }: { ctx: StepCtx }) {
  const [site, setSite] = useState<Site | null>(null)
  const [homesFocus, setHomesFocus] = useState<'hero' | 'featured_listings'>('hero')
  const [homesNote, setHomesNote] = useState<string | undefined>(undefined)
  useEffect(() => {
    api.sites.getMine().then(async r => {
      if (!r.success || !r.data) return
      // A brand-new website has no pages yet - build the starter one (home page with its header,
      // About, Contact...) so there's a header to set up. Draft only; publishing is the next step.
      const hasHome = ((r.data.draft_data?.pages || []) as SitePage[]).some(p => p.is_home)
      if (!hasHome) {
        const t = await api.sites.applyTemplate()
        if (t.success && t.data) { setSite(t.data); return }
      }
      setSite(r.data)
    })
  }, [])
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'homes' }) } }, [])
  if (!site) return <Spinner />
  const pages: SitePage[] = (site.draft_data?.pages || []) as SitePage[]
  const home = pages.find(p => p.is_home) || pages[0]
  const hero = home?.blocks?.find(b => b.type === 'hero') || null
  const save = (patch: { pages?: SitePage[]; featured_settings?: FeaturedSettings }) => {
    setSite({ ...site, draft_data: { ...site.draft_data, ...patch } })
    ctx.markSaving(api.sites.updateDraft(patch).then(r => { if (r.success && r.data) setSite(r.data) }))
  }
  const featured = (site.draft_data?.featured_settings || { mode: 'served_areas', towns: [], school_districts: [], sort: 'newest', prioritize_my_listings: true }) as FeaturedSettings
  const hasFeaturedSection = pages.some(p => p.is_home && p.blocks.some(b => b.type === 'featured_listings' && !b.hidden))
  return (
    <SplitPreview preview={<SiteMiniPreview site={site} featured={featured} focus={homesFocus} note={homesNote} height="var(--setup-prev-h)" />}>
      <div className="setup-embed space-y-5">
        <HeaderHomesPanel data={hero ? hero.data : null}
          onChange={patch => {
            if (!home || !hero) return
            setHomesFocus('hero')
            setHomesNote('header_mine_first' in patch ? (patch.header_mine_first ? 'Your own listings lead' : 'Newest MLS homes lead') : 'header_towns' in patch ? 'Header homes · your towns' : 'Header homes · updated')
            save({ pages: pages.map(p => (p.id === home.id ? { ...p, blocks: p.blocks.map(b => (b.id === hero.id ? { ...b, data: { ...b.data, ...patch, _template_generated: false } } : b)) } : p)) })
          }} />
        <FeaturedSettingsPanel value={featured} onChange={v => { setHomesFocus(hasFeaturedSection ? 'featured_listings' : 'hero'); setHomesNote('Featured homes · updated'); save({ featured_settings: v }) }} />
      </div>
    </SplitPreview>
  )
}

// ---------- Website ----------
export function WebsiteStep({ ctx }: { ctx: StepCtx }) {
  const [site, setSite] = useState<Site | null>(null)
  const [base, setBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    api.sites.getMine().then(async r => {
      if (!r.success || !r.data) return
      // No pages yet (the homes step was skipped) - build the starter ones so there's a site to
      // preview and publish. Draft only, same as the homes step.
      if (!((r.data.draft_data?.pages || []) as SitePage[]).some(p => p.is_home)) {
        const t = await api.sites.applyTemplate()
        if (t.success && t.data) { setSite({ ...t.data, signature_hub_slug: r.data.signature_hub_slug }); return }
      }
      setSite(r.data)
    })
    // The website's own address (their connected domain, else the free <slug>.openhousepal.com) -
    // never the links base, which is openhousepal.com (that opened their dashboard).
    api.sites.getLinkDomain().then(r => { if (r.success && r.data) setBase(r.data.own_base_url || r.data.default_base_url) })
  }, [])
  const theme = (site?.draft_data?.theme || {}) as SiteTheme
  // Client reviews on the website (the same switch as Studio -> Reviews).
  const [showReviews, setShowReviews] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [note, setNote] = useState<string | undefined>(undefined)
  useEffect(() => {
    api.agentHub.listReviews().then(r => {
      if (!r.success || !r.data) return
      setShowReviews(!!r.data.settings.show_on_idx)
      const min = r.data.settings.min_rating ?? 1
      setReviewCount(r.data.reviews.filter(x => x.status === 'published' && x.rating >= min).length)
    })
  }, [])
  const toggleReviews = (v: boolean) => {
    setShowReviews(v)
    setNote(v ? (reviewCount ? 'Reviews added to your menu' : 'Reviews shows once you have one') : 'Reviews off')
    ctx.markSaving(api.agentHub.updateReviewSettings({ show_on_idx: v }))
  }
  const live = site?.status === 'PUBLISHED' && site?.is_enabled !== false
  const setTheme = (patch: Partial<SiteTheme>) => {
    if (!site) return
    const next = { ...theme, ...patch } as SiteTheme
    setNote(patch.mode ? (patch.mode === 'dark' ? 'Dark pages' : 'Light pages')
      : patch.template ? (patch.template === 'luxe' ? 'Luxe look' : 'Classic look')
      : patch.luxe_metal ? `${LUXE_METALS[patch.luxe_metal].label} finish`
      : patch.secondary_color ? `${accentLabel(patch.secondary_color) || 'New'} accent` : undefined)
    setSite({ ...site, draft_data: { ...site.draft_data, theme: next } })
    ctx.markSaving(api.sites.updateDraft({ theme: next }).then(r => { if (r.success && r.data) setSite(r.data) }))
  }
  const publish = async () => {
    setBusy(true); setErr('')
    if (site?.is_enabled === false) await api.sites.setSiteEnabled(true)
    const r = await api.sites.publish()
    setBusy(false)
    if (r.success && r.data) { setSite(r.data); return true }
    setErr(r.error || 'We couldn’t publish just now - please try again.')
    return false
  }
  useGate(ctx, { ok: true, onContinue: async () => { if (!live) { const ok = await publish(); if (!ok) return false } await api.setup.setState({ confirm: 'website' }) } }, [live, site?.status])
  if (!site) return <Spinner />
  const template = theme.template === 'luxe' ? 'luxe' : 'default'
  const siteHost = (() => { try { return base ? new URL(base).host : '' } catch { return '' } })()
  return (
    <SplitPreview preview={<SiteMiniPreview site={site} theme={theme} note={note} hasReviews={showReviews && reviewCount > 0} height="var(--setup-prev-h)" />}>
      <div>
        <SubHead>Style</SubHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard on={template === 'default'} onClick={() => setTheme({ template: 'default', secondary_color: normalizeSiteTheme({ ...theme, template: 'default' }).secondary_color })} title="Classic" blurb="Clean, bright and simple." />
          <ChoiceCard on={template === 'luxe'} onClick={() => setTheme({ template: 'luxe', luxe_metal: siteLuxeMetal(theme), secondary_color: LUXE_METALS[siteLuxeMetal(theme)].base })} title="Luxe" blurb="Cinematic, charcoal and metal." />
        </div>
      </div>
      {template === 'luxe' ? (
        <div>
          <SubHead>Finish</SubHead>
          <div className="grid grid-cols-3 gap-3">
            {LUXE_METAL_ORDER.map(m => {
              const p = LUXE_METALS[m]
              const on = siteLuxeMetal(theme) === m
              return (
                <button key={m} type="button" onClick={() => setTheme({ luxe_metal: m, secondary_color: p.base, follow_brand_kit: false })}
                  className={`rounded-2xl border-2 p-2.5 text-left transition ${on ? 'border-[#111827] dark:border-white' : 'border-[#e7dfcf] dark:border-white/10'}`}>
                  <span className="block h-12 rounded-xl" style={{ background: `linear-gradient(115deg, ${p.deep}, ${p.base} 35%, ${p.pale} 52%, ${p.light} 62%, ${p.deep})` }} />
                  <span className="mt-2 flex items-center gap-1 text-[15px] font-black text-[#111827] dark:text-white">{on && <Check className="h-4 w-4" />}{p.label}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[13.5px] font-medium text-gray-500">The same gold, silver and bronze as your email signature and Agent Hub.</p>
        </div>
      ) : (
        <div>
          <SubHead>Accent color</SubHead>
          <Swatches label="Accent color" colors={CLASSIC_ACCENTS} value={normalizeSiteTheme(theme).secondary_color || CLASSIC_DEFAULT_ACCENT} onChange={c => setTheme({ secondary_color: c, follow_brand_kit: false })} />
        </div>
      )}
      <BigToggle on={showReviews} onChange={toggleReviews} title="Show my client reviews on the website" blurb="A Reviews page with your star rating, plus a link in your menu (only 4-5 stars if you chose that)." />
      <div className="grid grid-cols-2 gap-3">
        <ChoiceCard on={theme.mode !== 'dark'} onClick={() => setTheme({ mode: 'light' })} title="Light" />
        <ChoiceCard on={theme.mode === 'dark'} onClick={() => setTheme({ mode: 'dark' })} title="Dark" />
      </div>
      <div className={`rounded-[22px] border-2 p-5 ${live ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-[#C9A24D]/40 bg-[#fbf6ea] dark:bg-[#1a1712]'}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${live ? 'bg-emerald-600 text-white' : 'bg-[#111827] text-[#e8c97a]'}`}>{live ? <Globe className="h-6 w-6" /> : <Rocket className="h-6 w-6" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-black text-[#111827] dark:text-white">{live ? 'Your website is live' : 'Ready when you are'}</p>
            {siteHost && <p className="truncate text-[14px] font-semibold text-gray-500 dark:text-gray-400">{siteHost}</p>}
          </div>
          {live
            ? <a href={ohpHostUrl(siteHost)} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-black text-[#111827] shadow-sm dark:bg-black/30 dark:text-white">Visit <ExternalLink className="h-4 w-4" /></a>
            : <button type="button" onClick={publish} disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#e8c97a] px-6 text-[15px] font-black text-[#111827] shadow-lg disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Put my website live</button>}
        </div>
        {!live && <p className="mt-3 text-[13.5px] font-medium text-gray-600 dark:text-gray-300">Pressing Continue puts it live too. You can change anything later in the website editor.</p>}
        <p className="mt-3 flex items-start gap-1.5 text-[13.5px] font-medium text-gray-600 dark:text-gray-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Google is set up for you - every page, town and article gets its own search title and description automatically. Preview or reword any of them in the website editor&apos;s Google tab.</p>
        {err && <p className="mt-3 text-[14px] font-bold text-rose-600">{err}</p>}
      </div>
      <MoreOptions label="Have your own web address (like janesmith.com)?">
        <p className="text-[14px] font-medium text-gray-600 dark:text-gray-300">Connect it in the website editor's Domain tab - we walk you through it step by step, and your website keeps working the whole time.</p>
        <a href="/studio/website?tab=domains" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-[14px] font-black text-white dark:bg-white dark:text-[#111827]">Connect my domain <ExternalLink className="h-4 w-4" /></a>
      </MoreOptions>
    </SplitPreview>
  )
}
