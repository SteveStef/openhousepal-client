'use client'

import HubReadinessNotice from '@/components/agent-hub/HubReadinessNotice'
import OhpLoader from '@/components/brand/OhpLoader'

import { ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowUpRight, Bell, CalendarClock, Camera, Check, ChevronDown, CircleUser, Copy, CreditCard, Globe, Layers, Loader2, Lock, MapPin, Palette, Plug, Search, Settings as SettingsIcon, Star, ToolCase } from 'lucide-react'
import { OHP_SUBDOMAINS_LIVE, ohpHostUrl } from '@/lib/publicResourceLinks'
import type { NotificationPreferences, Site } from '@/types'
import { useToolConnectionStatus } from '@/lib/toolsStatus'
import { BIO_MAX_CHARS, fitBio } from '@/lib/agentBio'
import api, { API_BASE_URL } from '@/lib/api-service'
import { PRICING_PLANS } from '@/lib/pricing'
import { useAuth } from '@/contexts/AuthContext'
import RecentSalesPanel from '@/components/agent-hub/RecentSalesPanel'
import SocialLinksEditor, { SocialLink, defaultSocialLinks } from '@/components/agent-hub/SocialLinksEditor'
import DraggableAvatarPhoto from '@/components/agent-hub/DraggableAvatarPhoto'
import { IdxDomainNotice } from '@/components/IdxDomainNotice'
import DomainsPanel from '@/components/studio/website/DomainsPanel'
import IdxDomainCard, { IdxSiteSwitch, useLinkDomain } from '@/components/settings/IdxDomainCard'
import FollowupsSwitch, { useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import LuxeHero from '@/components/ui/LuxeHero'
import StorageMeter from '@/components/StorageMeter'
import { AiWriteButton, ComplianceChips } from '@/components/ai/AiWriteButton'
import { AgentSale, getEligibleListings, getEligibleSales } from '@/lib/agentSales'
import { HubPanelsOpen } from '@/components/agent-hub/HubPanelChrome'
import MyListingsPanel from '@/components/agent-hub/MyListingsPanel'
import ListingLinkRoutingPanel from '@/components/agent-hub/ListingLinkRoutingPanel'
import BillingPanel from '@/components/settings/BillingPanel'
import { useSettingsCompleteness } from '@/hooks/useSettingsCompleteness'
import { toJpeg } from '@/components/setup/SetupUi'
import { getBrokeragePhone, getOfficePhone, upgradeHubPhones } from '@/lib/hubPhones'

// The "IDX Website" settings tab (IDX plan only). Answers three real questions for an IDX agent
// in one glance - is my site actually live, what's my address, and is my custom domain's DNS
// actually connected - instead of the old single link-out card. The domain/DNS status and actions
// (add / check / make primary / delete) reuse the exact same DomainsPanel + api.sites.* calls the
// website builder's own Domain settings use (components/studio/website/DomainsPanel.tsx), so this
// isn't a second implementation to drift out of sync - it's the same live manager, just reachable
// from Settings too.
function IdxTab() {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [site, setSite] = useState<Site | null>(null)
  const [siteLoading, setSiteLoading] = useState(true)
  // One shared link-domain state for the on/off switch AND the domain card, so flipping one
  // updates the other (and the addresses shown) immediately.
  const linkDomain = useLinkDomain()
  const siteOn = linkDomain.state ? linkDomain.state.site_enabled : site?.is_enabled !== false
  useEffect(() => {
    api.sites.getMine().then(({ success, data }) => { if (success && data) setSite(data); setSiteLoading(false) })
  }, [])
  useEffect(() => {
    api.sites.getPublicBaseUrl().then(({ success, data }) => { if (success && data) setBaseUrl(data.base_url) })
  }, [linkDomain.state?.current_base_url])

  const isPublished = site?.status === 'PUBLISHED'
  // The website's own address (never the links base, which is openhousepal.com for most agents):
  // their connected domain once it's live, otherwise the free <slug>.openhousepal.com.
  const siteHost = (() => {
    const u = linkDomain.state?.own_base_url || linkDomain.state?.default_base_url
    try { return u ? new URL(u).host : '' } catch { return '' }
  })()
  const siteLink = siteHost ? ohpHostUrl(siteHost) : ''
  const [copied, setCopied] = useState(false)

  return (
    <div id="idx" className="scroll-mt-24 space-y-4">
      <IdxSiteSwitch linkDomain={linkDomain} />

      {/* Site status + address - the two things worth knowing at a glance before digging into DNS. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your Website</p>
            {siteLoading ? (
              <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking status…</div>
            ) : !siteOn ? (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-white/10 dark:text-gray-300">
                <AlertCircle className="h-3 w-3" /> Turned off — not visible to anyone
              </span>
            ) : (
              <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isPublished ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                {isPublished ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {isPublished ? 'Published & live' : 'Draft — not published yet'}
              </span>
            )}
            {siteHost ? (
              <div className="mt-2 flex min-w-0 items-center gap-1.5">
                <p className={`break-all font-mono text-[13px] font-bold ${siteOn ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-400 line-through'}`}>{siteHost}</p>
                {siteOn && (
                  <button type="button" title="Copy my website address" onClick={() => { navigator.clipboard?.writeText(siteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) }}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 p-1 text-gray-400 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ) : <p className="mt-2 text-xs font-bold text-gray-400">Loading…</p>}
            {isPublished && site?.published_at && (
              <p className="mt-1 text-xs font-semibold text-gray-400">Last published {new Date(site.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {siteLink && siteOn && isPublished && (
              <a href={siteLink} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
                <ArrowUpRight className="ohp-icon-draw h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /> View My Website
              </a>
            )}
            <Link href="/studio/website" className="group inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-gray-700 dark:text-gray-300 dark:hover:text-white">
              <Globe className="ohp-icon-draw h-3.5 w-3.5" /> Edit My Website
            </Link>
          </div>
        </div>
        {siteOn && !isPublished && !siteLoading && (
          <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Your site is still in draft - visitors won&apos;t see it until you publish from the website editor.
          </p>
        )}
        {siteOn && isPublished && !OHP_SUBDOMAINS_LIVE && !linkDomain.state?.own_base_url && (
          <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Your own address switches on soon. Until then, &ldquo;View My Website&rdquo; opens the very same site on openhousepal.com.
          </p>
        )}
      </div>

      {/* IDX Domain - which address links use, plus the real domain manager (DNS/verification
          status and connect/check/primary/delete), all in one squared-off section. */}
      <IdxDomainCard linkDomain={linkDomain}>
        {site && <DomainsPanel subdomainSlug={site.subdomain_slug} />}
      </IdxDomainCard>

      {/* Settings keeps the basics; everything else lives in the website editor - one tap to each part. */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">More website settings</p>
        <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Everything else about your website is in the website editor. Jump straight to:</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['content', Layers, 'Pages & sections', 'Your home page, About, Contact'],
            ['design', Palette, 'Look & colors', 'Classic or Luxe, light or dark'],
            ['featured', Star, 'Featured homes', 'Header homes and your Featured page'],
            ['areas', MapPin, 'Towns you serve', 'Town pages and local data'],
            ['search', Search, 'Google', 'Search titles and descriptions'],
            ['domains', Globe, 'Domain', 'Connect a domain you own'],
          ] as const).map(([id, Icon, title, blurb]) => (
            <Link key={id} href={`/studio/website?tab=${id}`} className="group flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-gray-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[13px] font-black text-[#111827] dark:text-white">{title}<ArrowUpRight className="h-3.5 w-3.5 text-gray-300 transition group-hover:text-[#C9A24D]" /></span>
                <span className="block text-[11.5px] font-semibold text-gray-400">{blurb}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {siteOn && <IdxDomainNotice baseUrl={baseUrl} subtle />}
    </div>
  )
}

// Autosave status pill - every field in Profile/Contact saves itself (debounced) as the agent
// types, so there's no Save button to press or forget to press. This just quietly confirms it
// happened: a spinner while the debounced save is in flight, then a checkmark for a couple
// seconds, then it fades away rather than sitting there permanently saying "Saved".
function AutosaveStatus({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <div className="mt-4 flex h-5 items-center">
      <AnimatePresence mode="wait">
        {saving ? (
          <motion.span
            key="saving"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 dark:text-gray-500"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
          </motion.span>
        ) : saved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
          >
            <Check className="h-3.5 w-3.5" /> Saved automatically
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SettingsAccordion({ title, subtitle, incomplete = false, hideStatus = false, closeSignal, children }: { title: string; subtitle?: string; incomplete?: boolean; hideStatus?: boolean; closeSignal?: number; children: ReactNode }) {
  // Synced with the same Complete/Incomplete state Studio -> Site shows for this section: starts
  // open while incomplete (so the agent notices what's left to fill in) and auto-collapses the
  // moment it becomes complete, without fighting the agent if they reopen a completed section.
  // `hideStatus` sections (Calendar, Reviews, Integrations, ...) have no completeness gate and now
  // live one-per-tab, so they start open rather than making the agent click to reveal them.
  const [isOpen, setIsOpen] = useState(incomplete || hideStatus)
  const wasIncomplete = useRef(incomplete)
  useEffect(() => {
    if (wasIncomplete.current && !incomplete) setIsOpen(false)
    wasIncomplete.current = incomplete
  }, [incomplete])

  // Auto-close after a successful Save - closeSignal starts undefined and only becomes a real
  // number once a save actually happens, so this never fires on initial mount. A short delay
  // keeps the "Saved" confirmation on screen for a beat before the section tucks itself away,
  // instead of snapping shut the instant Save is clicked.
  useEffect(() => {
    if (closeSignal === undefined) return
    const timer = setTimeout(() => setIsOpen(false), 900)
    return () => clearTimeout(timer)
  }, [closeSignal])

  return (
    <div className={`mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors duration-300 dark:bg-[#151517] ${incomplete ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-800'}`}>
      <button type="button" onClick={() => setIsOpen(current => !current)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">{title}</h2>
            {hideStatus ? null : incomplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertCircle className="h-3 w-3" /> Incomplete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Complete
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="shrink-0">
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.22 } }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 p-5 dark:border-gray-800 sm:p-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// A plain, always-visible card - same rounded-2xl/border/shadow language as SettingsAccordion,
// just without the collapse chrome. Used where there's nothing worth hiding (Password, Account),
// matching the plain-card pattern the standalone Calendar/Reviews/Integrations pages already use.
function SettingsCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6 ${className}`}>
      <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

type TabId = 'profile' | 'notifications' | 'tools' | 'idx' | 'billing' | 'account'

const TABS: { id: TabId; label: string; icon: typeof CircleUser; iconClass?: string; idxOnly?: boolean }[] = [
  { id: 'profile', label: 'Profile', icon: CircleUser },
  { id: 'notifications', label: 'Notifications', icon: Bell, iconClass: 'ohp-icon-assemble-bell' },
  { id: 'tools', label: 'Tools', icon: ToolCase, iconClass: 'ohp-icon-assemble-tools' },
  { id: 'idx', label: 'IDX Website', icon: Globe, idxOnly: true },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'account', label: 'Account', icon: Lock },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState({ name: '', title: '', brokerage: '', team: '', market: '', licenseNumber: '', about: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Contact - same Agent Hub config.contact ({call, text, email}) that Studio > Site's Contact
  // group reads/writes, so filling this in here or there shows up in both places.
  const [contact, setContact] = useState({ call: '', text: '', email: '', officePhone: '', brokeragePhone: '' })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactSaved, setContactSaved] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoPosition, setProfilePhotoPosition] = useState({ x: 50, y: 50 })
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Recent Sales and Social Links - same Agent Hub config the Studio > Site editor reads/writes,
  // via the same shared components, so an edit made here or there shows up in both places.
  const [recentSales, setRecentSales] = useState<AgentSale[]>([])
  const [showSalesStats, setShowSalesStats] = useState(true)
  const [salesMinPrice, setSalesMinPrice] = useState(0)
  const [salesCarousel, setSalesCarousel] = useState(true)
  const [salesAutoScroll, setSalesAutoScroll] = useState(true)
  // My Listings - same Agent Hub config (config.myListings) and same panel component as Studio >
  // Site, so Settings has the identical Listings section Studio > Site does, not just Recent Sales.
  const [myListings, setMyListings] = useState<AgentSale[]>([])
  const [listingsCarousel, setListingsCarousel] = useState(true)
  const [listingsAutoScroll, setListingsAutoScroll] = useState(true)
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(defaultSocialLinks)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    api.agentHub.getMine().then(response => {
      const config = (response.success && response.data?.config ? response.data.config : {}) as any
      if (response.success) {
        // Seed anything the agent already gave us at signup (name, brokerage, email, title,
        // market) so Profile/Contact aren't blank on a brand-new account - only used as a
        // fallback where the Agent Hub config doesn't already have its own value.
        const signupName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
        setProfile({
          name: config?.profile?.name || signupName,
          title: config?.profile?.title || user.professional_title || '',
          brokerage: config?.profile?.brokerage || user.brokerage || '',
          team: config?.profile?.team || '',
          market: config?.profile?.market || user.market || '',
          licenseNumber: config?.profile?.licenseNumber || '',
          about: config?.profile?.about || '',
        })
        setContact({
          call: config?.contact?.call || '',
          text: config?.contact?.text || '',
          email: config?.contact?.email || user.email || '',
          // Two numbers kept apart: the agent's own office line (Save Contact) and the brokerage's
          // main number (compliance, never on Save Contact) - lib/hubPhones.
          officePhone: getOfficePhone(config),
          brokeragePhone: getBrokeragePhone(config),
        })
        if (config?.profilePhotoUrl) setProfilePhotoUrl(config.profilePhotoUrl)
        if (config?.profilePhotoPosition?.x !== undefined) {
          setProfilePhotoPosition({ x: Number(config.profilePhotoPosition.x) || 50, y: Number(config.profilePhotoPosition.y) || 50 })
        }
        if (Array.isArray(config?.recentSales)) setRecentSales(getEligibleSales(config.recentSales))
        if (typeof config?.showSalesStats === 'boolean') setShowSalesStats(config.showSalesStats)
        if (typeof config?.salesMinPrice === 'number') setSalesMinPrice(config.salesMinPrice)
        if (typeof config?.salesCarousel === 'boolean') setSalesCarousel(config.salesCarousel)
        if (typeof config?.salesAutoScroll === 'boolean') setSalesAutoScroll(config.salesAutoScroll)
        if (Array.isArray(config?.myListings)) setMyListings(getEligibleListings(config.myListings))
        if (typeof config?.listingsCarousel === 'boolean') setListingsCarousel(config.listingsCarousel)
        if (typeof config?.listingsAutoScroll === 'boolean') setListingsAutoScroll(config.listingsAutoScroll)
        if (Array.isArray(config?.socialLinks)) {
          setSocialLinks(current => current.map(link => {
            const saved = config.socialLinks.find((item: any) => item.id === link.id)
            return saved ? { ...link, url: saved.url, enabled: saved.enabled } : link
          }))
        }
      }
      setLoading(false)
    })
  }, [user])

  // Every save on this page reads the whole Agent Hub config fresh and writes it back, so two saves
  // running at once (Profile + Contact autosaves, a Social Links edit) could each read the old
  // config and the later write would undo the earlier one. They queue up and run one at a time.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const queueSave = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = saveQueue.current.then(job, job)
    saveQueue.current = run.catch(() => undefined)
    return run
  }

  // Fetches the current config fresh (so we never clobber sections this page doesn't manage,
  // like videos/tours/blogs from the full Agent Hub editor) and merges the given patch into it.
  const saveHubConfigPatch = (patch: Record<string, any>) => queueSave(async () => {
    const current = await api.agentHub.getMine()
    const config = (current.success && current.data?.config ? current.data.config : {}) as any
    await api.agentHub.saveConfig({ ...config, ...patch })
  })

  const handleSaveRecentSales = async (overrides?: { recentSales?: AgentSale[]; showSalesStats?: boolean; salesCarousel?: boolean; salesAutoScroll?: boolean; salesMinPrice?: number }) => {
    const nextRecentSales = overrides?.recentSales ?? recentSales
    const nextShowSalesStats = overrides?.showSalesStats ?? showSalesStats
    const nextSalesCarousel = overrides?.salesCarousel ?? salesCarousel
    const nextSalesAutoScroll = overrides?.salesAutoScroll ?? salesAutoScroll
    const nextSalesMinPrice = overrides?.salesMinPrice ?? salesMinPrice
    setRecentSales(nextRecentSales)
    setShowSalesStats(nextShowSalesStats)
    setSalesCarousel(nextSalesCarousel)
    setSalesAutoScroll(nextSalesAutoScroll)
    setSalesMinPrice(nextSalesMinPrice)
    await saveHubConfigPatch({
      recentSales: nextRecentSales,
      showSalesStats: nextShowSalesStats,
      salesCarousel: nextSalesCarousel,
      salesAutoScroll: nextSalesAutoScroll,
      salesMinPrice: nextSalesMinPrice,
    })
  }

  // Same shared Agent Hub config (config.myListings) as Studio > Site's Listings panel - an edit
  // made here or there shows up in both places immediately, same as Recent Sales above.
  const handleSaveMyListings = async (overrides?: { myListings?: AgentSale[]; listingsCarousel?: boolean; listingsAutoScroll?: boolean }) => {
    const nextMyListings = overrides?.myListings ?? myListings
    const nextListingsCarousel = overrides?.listingsCarousel ?? listingsCarousel
    const nextListingsAutoScroll = overrides?.listingsAutoScroll ?? listingsAutoScroll
    setMyListings(nextMyListings)
    setListingsCarousel(nextListingsCarousel)
    setListingsAutoScroll(nextListingsAutoScroll)
    await saveHubConfigPatch({
      myListings: nextMyListings,
      listingsCarousel: nextListingsCarousel,
      listingsAutoScroll: nextListingsAutoScroll,
    })
  }

  // Saved by the debounced autosave below - one save after the agent stops typing a link, not
  // one per keystroke.
  const updateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    setSocialLinks(current => current.map(link => link.id === id ? { ...link, ...updates } : link))
  }

  const updateProfileField = (field: keyof typeof profile, value: string) => {
    setProfile(current => ({ ...current, [field]: value }))
    setProfileSaved(false)
  }

  const updateContactField = (field: keyof typeof contact, value: string) => {
    setContact(current => ({ ...current, [field]: value }))
    setContactSaved(false)
  }

  // Autosave - debounced 700ms after the last edit to Profile (fields, About, or the photo/its
  // position) so a burst of keystrokes or a photo drag sends one request, not one per change.
  // The `Ref` guards skip the run that fires the moment the initial fetch populates these fields.
  const profileLoadedRef = useRef(false)
  useEffect(() => {
    if (loading) return
    if (!profileLoadedRef.current) { profileLoadedRef.current = true; return }
    setProfileSaved(false)
    const timer = setTimeout(async () => {
      setProfileSaving(true)
      await queueSave(async () => {
        const current = await api.agentHub.getMine()
        const config = (current.success && current.data?.config ? current.data.config : {}) as any
        const nextConfig = { ...config, profile: { ...config.profile, ...profile }, profilePhotoUrl, profilePhotoPosition }
        await Promise.all([
          api.agentHub.saveConfig(nextConfig),
          api.agentHub.updateProfile({ title: profile.title, market: profile.market, name: profile.name, brokerage: profile.brokerage }),
        ])
      })
      setProfileSaving(false)
      setProfileSaved(true)
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profilePhotoUrl, profilePhotoPosition, loading])
  useEffect(() => {
    if (!profileSaved) return
    const timer = setTimeout(() => setProfileSaved(false), 2500)
    return () => clearTimeout(timer)
  }, [profileSaved])

  // Same debounced-autosave pattern for Contact, independent of Profile's timer/status.
  const contactLoadedRef = useRef(false)
  useEffect(() => {
    if (loading) return
    if (!contactLoadedRef.current) { contactLoadedRef.current = true; return }
    setContactSaved(false)
    const timer = setTimeout(async () => {
      setContactSaving(true)
      // The office line lives on the Save Contact card (same place the setup flow saves it); Studio
      // prints it on every mailer / flyer / door hanger.
      await queueSave(async () => {
        const current = await api.agentHub.getMine()
        const config = upgradeHubPhones((current.success && current.data?.config ? current.data.config : {}) as any)
        const card = config.contactCard || {}
        const fields = card.fields || {}
        const office = contact.officePhone.trim()
        await api.agentHub.saveConfig({
          ...config,
          profile: { ...(config.profile || {}), brokeragePhone: contact.brokeragePhone.trim() },
          contact: { ...(config.contact || {}), call: contact.call, text: contact.text, email: contact.email },
          contactCard: { ...card, fields: { ...fields, officePhone: { ...(fields.officePhone || {}), value: office, include: !!office } } },
        })
      })
      setContactSaving(false)
      setContactSaved(true)
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, loading])
  useEffect(() => {
    if (!contactSaved) return
    const timer = setTimeout(() => setContactSaved(false), 2500)
    return () => clearTimeout(timer)
  }, [contactSaved])

  // Social Links - same debounced autosave (a switch flip or a typed link saves once it settles).
  const socialLoadedRef = useRef(false)
  useEffect(() => {
    if (loading) return
    if (!socialLoadedRef.current) { socialLoadedRef.current = true; return }
    const timer = setTimeout(() => {
      saveHubConfigPatch({ socialLinks: socialLinks.map(({ id, label, url, enabled }) => ({ id, label, url, enabled })) })
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialLinks, loading])

  const handleProfilePhotoChange = async (file?: File) => {
    if (!file) return
    setPhotoUploading(true)
    setPhotoError('')
    // Same as the setup flow: any phone photo (PNG, WebP, a 12 MB camera shot) is turned into a
    // right-sized JPG first, instead of being turned away.
    let jpg: File = file
    try {
      if (!(file.type === 'image/jpeg' && file.size < 4.5 * 1024 * 1024)) jpg = await toJpeg(file)
    } catch {
      setPhotoError('That photo couldn’t be read - please try a JPG or PNG.')
      setPhotoUploading(false)
      return
    }
    const response = await api.agentHub.uploadPhoto(jpg)
    if (response.success && response.data) {
      const url = response.data.photo_url.startsWith('http') ? response.data.photo_url : `${API_BASE_URL}${response.data.photo_url}`
      setProfilePhotoUrl(url)
      setProfilePhotoPosition({ x: 50, y: 50 })
      setProfileSaved(false)
    } else {
      setPhotoError(response.error || 'Unable to upload photo. Please try a JPG under 5MB.')
    }
    setPhotoUploading(false)
  }

  const profileMissing = !profile.name.trim() || !profile.title.trim() || !profile.brokerage.trim()
  const contactMissing = !contact.call.trim() || !contact.text.trim() || !contact.email.trim() || !contact.brokeragePhone.trim()
  const socialLinksMissing = !socialLinks.some(link => link.enabled && link.url.trim())
  const profileGroupIncomplete = profileMissing || contactMissing || socialLinksMissing
  const salesIncomplete = getEligibleSales(recentSales).filter(sale => sale.visible).length === 0
  const listingsIncomplete = getEligibleListings(myListings).filter(listing => listing.visible).length === 0
  const planName = user?.plan_tier
    ? (PRICING_PLANS[user.plan_tier as keyof typeof PRICING_PLANS]?.name ?? null)
    : null

  // Left-rail tabs. The hash keeps deep links working (/settings#integrations from the Leads
  // page, #calendar-sync from Tasks, #calendar from the Google OAuth return). Calendar, Reviews,
  // and Integrations moved out to their own standalone pages under Tools - old links/redirects
  // pointing at those hashes (including the backend's own OAuth-callback redirect, which still
  // sends the browser to /settings?calendar={status}#calendar) get forwarded on to the new page
  // instead of silently landing on a tab that no longer exists.
  const [tab, setTab] = useState<TabId>('profile')
  const hashApplied = useRef(false)
  // #listings / #recent-sales (from the Email Signature page) open that panel, not just scroll to it.
  const [deepPanel, setDeepPanel] = useState<'listings' | 'recent-sales' | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || hashApplied.current) return
    if (authLoading) return  // wait for `user` so an IDX deep-link resolves
    hashApplied.current = true
    if (window.location.search.includes('calendar=')) {
      router.replace(`/studio/calendar${window.location.search}`)
      return
    }
    const h = window.location.hash.replace('#', '')
    const movedOut: Record<string, string> = {
      calendar: '/studio/calendar', 'calendar-sync': '/studio/calendar',
      reviews: '/studio/reviews',
      integrations: '/studio/integrations',
    }
    if (movedOut[h]) { router.replace(movedOut[h]); return }
    const map: Record<string, TabId> = {
      profile: 'profile', notifications: 'notifications',
      tools: 'tools',
      idx: 'idx', 'idx-domain': 'idx', domain: 'idx',
      billing: 'billing', subscription: 'billing',
      account: 'account', password: 'account',
    }
    // Listings / Recent Sales live on the Profile tab - open it and bring that panel into view.
    if (h === 'listings' || h === 'recent-sales') {
      setTab('profile')
      setDeepPanel(h)
      setTimeout(() => document.getElementById(h === 'listings' ? 'settings-listings' : 'settings-recent-sales')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
      return
    }
    const target = map[h]
    if (target && !(target === 'idx' && user?.plan_tier !== 'IDX')) setTab(target)
  }, [authLoading, user?.plan_tier, router])
  const selectTab = (id: TabId) => {
    setTab(id)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `${window.location.pathname}#${id}`)
  }

  if (loading || authLoading) {
    return (
      <OhpLoader />
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {/* Header - the shared luxe header: plan chip top-right, AI usage + storage lined up with
            the title and the line under it. */}
        <LuxeHero
          compact
          className="mb-6"
          kicker="Settings"
          icon={SettingsIcon}
          title={<>Your account, <em>your way.</em></>}
          subtitle={<>Kept in sync with{' '}<Link href="/studio/site" className="underline decoration-[#C9A24D]/50 underline-offset-2 transition-colors hover:text-[#8b7355]">Tools → Site</Link>.</>}
          badge={planName && (
            <button type="button" onClick={() => selectTab('billing')} title="Manage your plan"
              className="group inline-flex shrink-0 items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
              {planName} Plan
              <ArrowUpRight className="ohp-icon-draw h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          )}
          aside={
            <div className="w-full space-y-1.5 lg:mt-0.5">
              <MonthlyAiUsageMeter variant="inline" compact stretch />
              <StorageMeter variant="inline" compact stretch />
            </div>
          }
        />

        <div className="mt-2 flex flex-col gap-6 md:flex-row md:items-start">
          {/* Left rail — vertical on desktop, a horizontal scroll strip on mobile */}
          <nav className="md:sticky md:top-6 md:w-52 md:shrink-0">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
              {TABS.filter(t => !t.idxOnly || user?.plan_tier === 'IDX').map(t => {
                const Icon = t.icon
                const active = tab === t.id
                const incomplete = t.id === 'profile' && profileGroupIncomplete
                return (
                  <button key={t.id} type="button" onClick={() => selectTab(t.id)}
                    // Phones: the strip scrolls sideways - keep the open tab in view (e.g. arriving
                    // on #billing from an email), without moving the page itself.
                    ref={active ? (el) => { const strip = el?.parentElement; if (el && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: el.offsetLeft - strip.offsetLeft - 8, behavior: 'smooth' }) } : undefined}
                    className={`group relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-black transition-colors duration-200 ${active ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                    {/* Same sliding shared-layout pill as the Signature editor's section rail
                        (explicit ask: tab changes here should look just like that one). */}
                    {active && (
                      <motion.span layoutId="settings-tab-active" className="absolute inset-0 rounded-xl bg-[#111827] shadow-sm dark:bg-white" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                    )}
                    <span className="relative flex w-full items-center gap-2.5">
                      <Icon className={`ohp-icon-draw ${t.iconClass || ''} h-4 w-4 shrink-0`} strokeWidth={2.4} />
                      {t.label}
                      {incomplete && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" aria-label="needs attention" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Panel — one tab's content at a time */}
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
            {tab === 'profile' && (
              <div className="space-y-6">
                <SetupLink />
                {/* Identity + Contact + Social, split into their own cards side-by-side on wide
                    screens instead of one long stacked accordion - same fields, same autosave,
                    same Complete/Incomplete badges, just laid out so the "who you are" core
                    identity reads at a glance next to the shorter "how to reach you" groups. */}
                <div className="grid gap-6 lg:grid-cols-5 lg:items-stretch">
                  {/* Core identity - photo, name/title/brokerage/team/market/license, About */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6 lg:col-span-3">
                    <SubHeading title="Profile" incomplete={profileMissing} subtitle="Shown on your Agent Hub and public forms - kept in sync with Tools → Site." />
                    {!profilePhotoUrl && (
                      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
                        <Camera className="h-4 w-4 shrink-0" />
                        Add a profile photo - visitors see a blank avatar until you upload one.
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-[#0B0B0B]">
                      <DraggableAvatarPhoto url={profilePhotoUrl} position={profilePhotoPosition} onPositionChange={(pos) => { setProfilePhotoPosition(pos); setProfileSaved(false) }} size={64} uploading={photoUploading} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Profile photo</p>
                        <p className="text-xs font-semibold text-gray-400">Drag the circle to reposition if it looks off-centered.</p>
                        <label className={`mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white transition hover:bg-black active:scale-[0.98] dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200 ${photoUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                          {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                          {photoUploading ? 'Uploading…' : profilePhotoUrl ? 'Change photo' : 'Upload photo'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={photoUploading}
                            onChange={(event) => { handleProfilePhotoChange(event.target.files?.[0]); event.target.value = '' }}
                            className="sr-only"
                          />
                        </label>
                        {photoError && <p className="mt-2 text-xs font-bold text-red-600">{photoError}</p>}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Full Name" value={profile.name} onChange={v => updateProfileField('name', v)} required />
                      <Field label="Title" value={profile.title} onChange={v => updateProfileField('title', v)} placeholder="e.g. Listing Agent" required />
                      <Field label="Brokerage" value={profile.brokerage} onChange={v => updateProfileField('brokerage', v)} required />
                      <Field label="Team" value={profile.team} onChange={v => updateProfileField('team', v)} placeholder="e.g. The Johnson Group" />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">About</label>
                        <AiWriteButton
                          purpose="bio_polish"
                          getContext={() => profile.about}
                          onResult={text => updateProfileField('about', fitBio(text))}
                          disabled={!profile.about.trim()}
                        />
                      </div>
                      <textarea
                        value={profile.about}
                        onChange={event => updateProfileField('about', event.target.value)}
                        maxLength={Math.max(BIO_MAX_CHARS, profile.about.length)}
                        rows={4}
                        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                      />
                      <p className={`mt-1 text-[11px] font-semibold ${profile.about.length > BIO_MAX_CHARS ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                        {profile.about.length > BIO_MAX_CHARS
                          ? `${profile.about.length}/${BIO_MAX_CHARS} - too long to fully print on your Brag Sheet. Shorten it to ${BIO_MAX_CHARS} characters or only the first 3 lines will show.`
                          : `${profile.about.length}/${BIO_MAX_CHARS} - kept to 3 lines so your Brag Sheet always fits on one page.`}
                      </p>
                      <div className="mt-1.5">
                        <ComplianceChips text={profile.about} onApply={text => updateProfileField('about', text)} />
                      </div>
                    </div>
                    <AutosaveStatus saving={profileSaving} saved={profileSaved} />
                    {profileMissing && (
                      <p className="-mt-2 text-xs font-bold text-red-600 dark:text-red-400">Full Name, Title, and Brokerage are still needed - visitors won&apos;t see this section complete until they&apos;re filled in.</p>
                    )}
                  </div>

                  {/* Contact - the shorter, supporting group in a narrower right column. Social
                      Links used to live here too, squeezed into this same narrow column - it now
                      gets its own full-width card below instead (judgment call on task "social
                      links is super smushed in the corner"), so each platform's row has real room. */}
                  {/* Market + License Number moved here from Profile (explicit ask: even out the two
                      cards so they line up) - both still save through the Profile autosave. */}
                  <div className="lg:col-span-2">
                    <div className="h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
                      <SubHeading title="Contact" incomplete={contactMissing} subtitle="How visitors reach you, and where you work." />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <Field label="Mobile Number (Call)" value={contact.call} onChange={v => updateContactField('call', v)} placeholder="(555) 123-4567" required />
                        <Field label="Text Phone Number" value={contact.text} onChange={v => updateContactField('text', v)} placeholder="(555) 123-4567" required />
                        <Field label="Contact Email" value={contact.email} onChange={v => updateContactField('email', v)} placeholder="you@example.com" required />
                        <Field label="Office Phone (optional)" value={contact.officePhone} onChange={v => updateContactField('officePhone', v)} placeholder="(555) 123-4589" hint="Your own office or direct line. It goes on your Save Contact card." />
                        <Field label="Your Brokerage's Phone" value={contact.brokeragePhone} onChange={v => updateContactField('brokeragePhone', v)} placeholder="(555) 123-4500" required hint="Your brokerage's main number. It's printed on your designs for compliance and never goes on your Save Contact card." />
                        <Field label="Market" value={profile.market} onChange={v => updateProfileField('market', v)} placeholder="e.g. Greater Philadelphia" />
                        <LockedField label="License Number" value={profile.licenseNumber} />
                      </div>
                      <AutosaveStatus saving={contactSaving} saved={contactSaved} />
                      {contactMissing && (
                        <p className="-mt-2 text-xs font-bold text-red-600 dark:text-red-400">Call, Text, Email, and your brokerage&apos;s phone are still needed - Studio can&apos;t make print designs without your brokerage&apos;s phone.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Social Links - a full-width card of its own now (was squeezed into the narrow
                    right column above alongside Contact) so each platform's icon/label/toggle/URL
                    row has real breathing room instead of being crammed onto one line. */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
                  <SubHeading title="Social Links" incomplete={socialLinksMissing} subtitle="Shown on your public Agent Hub." />
                  <div className="mt-4">
                    <SocialLinksEditor socialLinks={socialLinks} onChange={updateSocialLink} animateIcons={false} />
                  </div>
                </div>

                {/* My Listings - before Recent Sales, matching Studio > Site's own section order. Same
                    panel and same Agent Hub config, styled to match the other settings cards. */}
                <div id="settings-listings" className="scroll-mt-24" />
                <HubPanelsOpen.Provider value={deepPanel === 'listings'}>
                <MyListingsPanel
                  key={deepPanel === 'listings' ? 'listings-open' : 'listings'}
                  listings={myListings}
                  setListings={setMyListings}
                  carousel={listingsCarousel}
                  setCarousel={setListingsCarousel}
                  autoScroll={listingsAutoScroll}
                  setAutoScroll={setListingsAutoScroll}
                  onChange={() => {}}
                  onSave={handleSaveMyListings}
                  plain
                  incomplete={listingsIncomplete}
                />
                </HubPanelsOpen.Provider>

                {/* Listing Link Routing - shows where My Listings/Email Signature clicks currently go
                    (Listing Spotlight vs generic property page) and lets the agent switch a listing back
                    to the plain page. Fetches its own data (GET /agent-hub/me/listing-routing), so it
                    doesn't need any of the myListings state this page already tracks. */}
                <ListingLinkRoutingPanel />

                {/* Recent Sales - same panel and same Agent Hub config as Studio > Site, styled to match the other settings cards */}
                <div id="settings-recent-sales" className="scroll-mt-24" />
                <HubPanelsOpen.Provider value={deepPanel === 'recent-sales'}>
                <RecentSalesPanel
                  key={deepPanel === 'recent-sales' ? 'sales-open' : 'sales'}
                  reLicenseNumber={profile.licenseNumber}
                  agentSales={recentSales}
                  setAgentSales={setRecentSales}
                  showStats={showSalesStats}
                  setShowStats={setShowSalesStats}
                  carousel={salesCarousel}
                  setCarousel={setSalesCarousel}
                  autoScroll={salesAutoScroll}
                  setAutoScroll={setSalesAutoScroll}
                  minPrice={salesMinPrice}
                  setMinPrice={setSalesMinPrice}
                  onChange={() => {}}
                  onSave={handleSaveRecentSales}
                  plain
                  incomplete={salesIncomplete}
                />
                </HubPanelsOpen.Provider>
              </div>
            )}

            {tab === 'notifications' && <NotificationPrefsSection />}

            {tab === 'tools' && <ToolsStatusSection planTier={user?.plan_tier} />}

            {tab === 'idx' && user?.plan_tier === 'IDX' && <><HubReadinessNotice className="mb-4" /><IdxTab /></>}

            {tab === 'billing' && (
              <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>}>
                <BillingPanel embedded />
              </Suspense>
            )}

            {tab === 'account' && (
              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <PasswordSection />
                <AccountSection onGoToBilling={() => selectTab('billing')} />
              </div>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// Section heading inside the combined Profile accordion, with the same Complete / Incomplete
// pill the top-level settings cards use.
function SubHeading({ title, subtitle, incomplete }: { title: string; subtitle: string; incomplete: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-lg font-black text-[#111827] dark:text-white">{title}</h3>
        {incomplete ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-3 w-3" /> Incomplete
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Complete
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}

// A real license identifier shouldn't be self-editable (same reasoning as MLS ID, which has
// never had an edit control here) - it's shown locked, with the same "contact support to change"
// path everything else in that category uses, instead of a plain text input.
// The way back into the setup flow from Settings - its progress, and every step to revisit.
function SetupLink() {
  const { setup, items, loaded } = useSettingsCompleteness()
  if (!loaded || !setup) return null
  const done = items.filter(i => !i.missing).length
  const skipped = items.filter(i => i.skipped).length
  return (
    <Link href="/setup" className="group flex items-center gap-4 rounded-2xl border border-[#C9A24D]/35 bg-gradient-to-br from-[#fffaf0] to-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:from-[#1b1813] dark:to-[#151517]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[11px] font-black text-[#e8c97a] ring-1 ring-[#C9A24D]/40">{done}/{items.length}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[#111827] dark:text-white">{setup.complete ? 'Account setup - all done' : 'Account setup'}</span>
        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{setup.complete ? 'Walk through it again anytime - everything you change there shows up here too.' : skipped ? `${skipped} skipped - finish anytime, one simple step at a time.` : 'The simple step-by-step way to fill all of this in.'}</span>
      </span>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-[#C9A24D] transition group-hover:translate-x-0.5" />
    </Link>
  )
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
      <div className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-3 py-2.5 text-sm font-semibold text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400">
        {value ? <span>{value}</span> : <Link href="/setup?step=license" className="font-black text-[#8b6a2b] underline-offset-2 hover:underline dark:text-[#e8c97a]">Not set - add it</Link>}
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required = false, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; hint?: string }) {
  const isEmpty = required && !value.trim()
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:bg-[#0B0B0B] dark:text-white ${
          isEmpty ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700'
        }`}
      />
      {hint && <p className="mt-1 text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

// A small pill/switch toggle. Disabled = the channel isn't live yet (push).
function Toggle({ on, onClick, disabled = false, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 ${
        disabled
          ? 'cursor-not-allowed bg-gray-200 opacity-50 dark:bg-gray-700'
          : on
            ? 'bg-[#C9A24D]'
            : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

// A thin, read-only status panel - NOT a re-implementation of Calendar/Reviews/Integrations. It
// reads the same connection-state fields those pages already fetch (via the same api.integrations
// / api.agentHub.listReviews calls) just to answer "is this set up or not", then hands off to the
// real standalone page (in a new tab) for anything more than glancing at that status. Keeping the
// actual connect/disconnect/save logic out of Settings entirely is the whole point - one place per
// piece of functionality, not two that can drift out of sync.
function ToolsStatusSection({ planTier }: { planTier?: string }) {
  // Shared with the Tools page's own Calendar/Reviews/Integrations cards (lib/toolsStatus.ts) -
  // one fetch-and-compute, so the two can't show different answers for the same connection.
  // Follow-ups' status line comes from the same shared hook as the Tools page (it knows a phone
  // alert needs a connected calendar) - this used to be worked out separately here and said
  // "buzzes 15 min before" even with no calendar connected.
  const { loading, calendarStatus, calendarOk, reviewsStatus, reviewsOk, reviewsAvailable, integrationsStatus, integrationsOk, followupsStatus, followupsTone } = useToolConnectionStatus(planTier)
  const followupsOn = useFollowupsEnabled().enabled !== false

  const rows: { id: string; icon: typeof CalendarClock; iconClass?: string; title: string; blurb: string; status: string; ok: boolean; href: string; locked?: boolean }[] = [
    { id: 'calendar', icon: CalendarClock, iconClass: 'ohp-icon-assemble-calendar', title: 'Calendar', blurb: 'Tasks and open houses on your calendar.', status: calendarStatus, ok: calendarOk, href: '/studio/calendar' },
    { id: 'reviews', icon: Star, title: 'Reviews', blurb: 'Collect client reviews and post the best ones.', status: reviewsStatus, ok: reviewsOk, href: '/studio/reviews', locked: !reviewsAvailable },
    { id: 'integrations', icon: Plug, iconClass: 'ohp-icon-assemble-plug', title: 'Integrations', blurb: 'Send leads to your CRM, pull leads from portals.', status: integrationsStatus, ok: integrationsOk, href: '/studio/integrations' },
  ]

  return (
    <SettingsAccordion title="Tools" subtitle="A quick check that Calendar, Reviews, Integrations and Follow-ups are set up - manage each in its own page." hideStatus>
      {/* Follow-ups: the on/off switch with its status + Manage link inside it (was a switch card
          AND a second Follow-ups row below saying much the same thing). */}
      <FollowupsSwitch className="mb-5">
        {followupsOn && !loading && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`flex items-center gap-1.5 text-xs font-bold ${followupsTone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {followupsTone === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {followupsStatus}
            </span>
            <a href="/leads/tasks#automatic-followups" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#8b6a2b] hover:underline dark:text-[#e8c97a]">
              Manage <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </FollowupsSwitch>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(row => {
            const Icon = row.icon
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="group flex min-w-0 items-center gap-3">
                  {/* Same dark tile + builder-draw icon as the Tools page cards (explicit ask: these
                      should follow the Tools page / nav animations, not their own colored chips). */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${row.locked ? 'bg-gray-100 text-gray-400 dark:bg-white/5' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
                    <Icon className={`ohp-icon-draw ${row.iconClass || ''} h-[18px] w-[18px]`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#111827] dark:text-white">{row.title}</p>
                    <p className="text-xs font-semibold text-gray-400">{row.blurb}</p>
                    <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-bold ${row.locked ? 'text-gray-400' : row.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {!row.locked && (row.ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />)}
                      {row.status}
                    </p>
                  </div>
                </div>
                {row.locked ? (
                  <Link
                    href={`/upgrade-required?tier=PREMIUM&feature=${encodeURIComponent('Client Reviews')}`}
                    className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300"
                  >
                    Upgrade to unlock
                  </Link>
                ) : (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827]"
                  >
                    {row.ok ? 'Manage' : 'Open & Set Up'} <ArrowUpRight className="ohp-icon-draw h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SettingsAccordion>
  )
}

// Change your password while signed in. Proves it's you by re-entering the current one - there's
// no emailed code / 2FA in the system, so the "forgot password" email link stays the path for
// someone locked out.
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !saving

  const submit = async () => {
    setError('')
    setDone(false)
    if (next !== confirm) { setError('The new passwords don’t match.'); return }
    if (next.length < 8) { setError('Use at least 8 characters.'); return }
    setSaving(true)
    const { success, error: apiError } = await api.auth.changePassword(current, next)
    setSaving(false)
    if (!success) { setError(apiError || 'Could not change your password.'); return }
    setCurrent(''); setNext(''); setConfirm(''); setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  const inputCls = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'

  return (
    <SettingsCard title="Password" subtitle="Change the password you use to sign in.">
      <div className="grid gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current password</label>
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">New password</label>
          <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} />
          {tooShort && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">Use at least 8 characters.</p>}
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm new password</label>
          <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
          {mismatch && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">The new passwords don&apos;t match.</p>}
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="group inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="ohp-icon-draw h-4 w-4" />} Update password
          </button>
          {done && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Password changed
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-400">
          Forgot your current password? <Link href="/forgot-password" className="underline decoration-gray-300 underline-offset-2 hover:text-[#C9A24D]">Reset it by email</Link> instead.
        </p>
      </div>
    </SettingsCard>
  )
}

// Read-only account facts. These aren't self-serve editable (MLS ID is unique and tied to
// listing matching, email is the login) - changing them is a support action - but there was
// nowhere in the app to even see them together.
function AccountSection({ onGoToBilling }: { onGoToBilling: () => void }) {
  const { user } = useAuth()
  if (!user) return null

  const rows: { label: string; value: string }[] = [
    { label: 'Sign-in email', value: user.email },
    user.mls_id ? { label: 'MLS ID', value: user.mls_id } : { label: 'License number', value: user.license_number || 'Not set' },
    { label: 'State', value: user.state || '—' },
    { label: 'Plan', value: PRICING_PLANS[user.plan_tier as keyof typeof PRICING_PLANS]?.name || user.plan_tier || '—' },
    { label: 'Status', value: (user.subscription_status || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) || '—' },
    {
      label: 'Member since',
      value: user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—',
    },
  ]

  return (
    <SettingsCard title="Account" subtitle="Your sign-in and plan details.">
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="shrink-0 whitespace-nowrap text-xs font-black uppercase tracking-widest text-gray-400">{r.label}</dt>
            <dd className="min-w-0 break-all text-right text-sm font-bold text-[#111827] dark:text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs font-semibold text-gray-400">
        Need to change your sign-in email, MLS ID or license number?{' '}
        <Link href="/settings/help?compose=1&category=support" className="underline decoration-gray-300 underline-offset-2 hover:text-[#C9A24D]">Contact support</Link>{' '}and we&apos;ll update it.
      </p>
      <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:grid-cols-3 lg:grid-cols-1">
        <Link href="/open-houses/my-listings" className="rounded-xl border border-gray-200 px-3 py-2.5 text-center text-xs font-black text-gray-700 transition hover:border-[#C9A24D]/50 dark:border-gray-700 dark:text-gray-200">
          Your team →
        </Link>
        <Link href={user.plan_tier === 'IDX' ? '/studio/website' : '/studio/site'} className="rounded-xl border border-gray-200 px-3 py-2.5 text-center text-xs font-black text-gray-700 transition hover:border-[#C9A24D]/50 dark:border-gray-700 dark:text-gray-200">
          {user.plan_tier === 'IDX' ? <>Website &amp; domain →</> : <>Agent Hub →</>}
        </Link>
        <button type="button" onClick={onGoToBilling} className="rounded-xl border border-gray-200 px-3 py-2.5 text-center text-xs font-black text-gray-700 transition hover:border-[#C9A24D]/50 dark:border-gray-700 dark:text-gray-200">
          Billing →
        </button>
      </div>
    </SettingsCard>
  )
}

// Per-category email opt-outs. The in-app bell always fires and isn't shown here.
// Push only appears once push notifications actually exist (push_available from the API).
function NotificationPrefsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(0)

  useEffect(() => {
    api.notifications.getPreferences().then(({ success, data }) => {
      if (success && data) setPrefs(data)
      setLoading(false)
    })
  }, [])

  const toggle = async (catId: string, channel: 'email' | 'push') => {
    if (!prefs) return
    const nextPrefs: NotificationPreferences = {
      ...prefs,
      preferences: {
        ...prefs.preferences,
        [catId]: { ...prefs.preferences[catId], [channel]: !prefs.preferences[catId][channel] },
      },
    }
    setPrefs(nextPrefs)
    setSaving(true)
    const { success, data } = await api.notifications.updatePreferences(nextPrefs.preferences)
    setSaving(false)
    if (success && data) { setPrefs(data); setSavedTick(t => t + 1) }
  }

  useEffect(() => {
    if (!savedTick) return
    const timer = setTimeout(() => setSavedTick(0), 2500)
    return () => clearTimeout(timer)
  }, [savedTick])

  return (
    <SettingsAccordion title="Notifications" subtitle="The in-app bell always shows everything. Choose what also emails you." hideStatus>
      {loading || !prefs ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>
      ) : (
        <div>
          {/* Column headers — same flex-1 spacer + two w-14 columns + gap-6 as every row below,
              so "Email" / "Push" sit directly over their switches. */}
          <div className="flex items-center gap-4 border-b border-gray-100 pb-2 dark:border-gray-800">
            <div className="flex h-4 min-w-0 flex-1 items-center">
              {saving ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Saving</span>
              ) : savedTick ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> Saved</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <span className="w-11 text-center">Email</span>
              {prefs.push_available && <span className="w-11 text-center">Push</span>}
            </div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {prefs.categories.map(cat => {
              const row = prefs.preferences[cat.id]
              if (!row) return null
              return (
                <li key={cat.id} className="flex items-center gap-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#111827] dark:text-white">{cat.label}</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{cat.help}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-6">
                    <div className="flex w-11 justify-center">
                      <Toggle on={row.email} onClick={() => toggle(cat.id, 'email')} label={`Email me about ${cat.label}`} />
                    </div>
                    {/* Push only shows once it exists - 12 greyed-out "Soon" switches were just clutter. */}
                    {prefs.push_available && (
                      <div className="flex w-11 justify-center">
                        <Toggle on={row.push} onClick={() => toggle(cat.id, 'push')} label={`Push notify about ${cat.label}`} />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-gray-400">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You&apos;ll still see every one of these in the notification bell - this only controls email.{!prefs.push_available && ' Phone push alerts are coming soon.'}
          </p>
        </div>
      )}
    </SettingsAccordion>
  )
}
