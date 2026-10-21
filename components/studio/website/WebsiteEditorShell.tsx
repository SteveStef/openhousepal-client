'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Globe, Layers, Loader2, MapPin, MessageSquareQuote, Monitor, Palette, PlaySquare, Rocket, Save, Search, Star } from 'lucide-react'
import api from '@/lib/api-service'
import { FeaturedSettings, MediaSettings, Site, SiteBlock, SitePage, SiteSeo, SiteTheme } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import SearchAppearancePanel, { DEFAULT_SITE_SEO } from './SearchAppearancePanel'
import GoogleResultPreview from './GoogleResultPreview'
import { seoCtxFrom, type SeoPreviewPage } from './SeoPagesList'
import type { SeoPagesData } from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import SitePageRenderer from '@/components/website-public/SitePageRenderer'
import ShowcaseCreatorCTA from '@/components/website-public/ShowcaseCreatorCTA'
import { SiteHeader, SiteFooter } from '@/components/website-public/SiteChrome'
import { DEFAULT_SITE_THEME } from '@/components/website-public/types'
import { siteFontVariables } from '@/lib/site-fonts'
import { normalizeSiteTheme, siteLuxeMetal, siteMode, siteTemplate, siteThemeVars } from '@/lib/siteTheme'
import { LUXE_METALS } from '@/lib/luxeMetals'
import { accentLabel } from '@/lib/accentSwatches'
import SiteLoader from '@/components/website-public/SiteLoader'
import { BLOCK_FIELD_SCHEMA } from './blockFieldSchema'
import '@/app/(sitepublic)/site-theme.css'
import BlockEditorPanel from './BlockEditorPanel'
import { PREVIEW_FX_CSS } from './previewFx'
import ThemePanel from './ThemePanel'
import DomainsPanel from './DomainsPanel'
import { LinkDomainShortcut } from '@/components/settings/IdxDomainCard'
import AreasPanel from './AreasPanel'
import FeaturedSettingsPanel from './FeaturedSettingsPanel'
import HeaderHomesPanel from './HeaderHomesPanel'
import MediaSettingsPanel from './MediaSettingsPanel'
import ReviewsSettingsPanel from './ReviewsSettingsPanel'
import { copyText } from '@/lib/copyText'
import { hubMissing } from '@/components/agent-hub/HubReadinessNotice'
import { ohpHostUrl } from '@/lib/publicResourceLinks'
import { siteProfileFromHub, type SiteChromeProfile } from '@/lib/siteProfileFromHub'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

const DEFAULT_FEATURED_SETTINGS: FeaturedSettings = { mode: 'my_listings', min_price: null, max_price: null, towns: [], school_districts: [], sort: 'newest', prioritize_my_listings: true }
const DEFAULT_MEDIA_SETTINGS: MediaSettings = { show_videos: true, show_tours: true }

export type EditorTab = 'content' | 'design' | 'featured' | 'media' | 'reviews' | 'areas' | 'search' | 'domains'

export const TABS: { id: EditorTab; label: string; icon: typeof Layers; title: string; blurb: string }[] = [
  { id: 'content', label: 'Sections', icon: Layers, title: 'Build Your Home Page', blurb: 'Drag sections into any order, switch them on or off, open one to edit it. Add more from the catalogue - each arrives complete and working.' },
  { id: 'design', label: 'Design', icon: Palette, title: 'Look & Feel', blurb: 'Classic or Luxe, your accent color, light or dark by default - one click changes the whole site.' },
  { id: 'featured', label: 'Featured', icon: Star, title: 'Featured Homes', blurb: 'The newest homes in your header, and what your Featured page shows.' },
  { id: 'media', label: 'Media', icon: PlaySquare, title: 'Videos & Tours', blurb: 'Show listing videos and 3D tours on your site.' },
  { id: 'reviews', label: 'Reviews', icon: MessageSquareQuote, title: 'Client Reviews', blurb: 'Show or hide your Reviews page - your rating and what clients say, with a menu link.' },
  { id: 'areas', label: 'Areas', icon: MapPin, title: 'Areas You Serve', blurb: 'Each town gets its own page on your site with real schools, transportation, parks and market data.' },
  { id: 'search', label: 'Google', icon: Search, title: 'How You Look on Google', blurb: 'Your name, headline, tab icon and the sub-links under your result - with a live Google preview.' },
  { id: 'domains', label: 'Domain', icon: Globe, title: 'Your Domain', blurb: 'Your OpenHousePal address, or connect a domain you own.' },
]

function emptyHomePage(): SitePage {
  return { id: `page-${Date.now()}`, slug: '', title: 'Home', is_home: true, blocks: [] }
}

// `tab`/`onTabChange`: when the page passes them, the section bar lives in the page header
// (LuxeTabs) and this editor just follows it; without them it shows its own bar.
export default function WebsiteEditorShell({ onActionsChange, onBarEndChange, tab: tabProp, onTabChange }: {
  onActionsChange?: (actions: React.ReactNode) => void
  /** The save status shown at the right end of the page header's section bar. */
  onBarEndChange?: (node: React.ReactNode) => void
  tab?: EditorTab
  onTabChange?: (tab: EditorTab) => void
}) {
  const { showToast } = useToast()
  const [site, setSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const [homePage, setHomePage] = useState<SitePage>(emptyHomePage())
  // Every page besides Home (About, Contact, Sold, any custom page) - the Content tab only edits
  // Home, but a save must never drop these. Kept verbatim from whatever the server last had and
  // spliced back in on every save (see saveDraft) - previously saveDraft sent `pages: [homePage]`
  // outright, which silently deleted every other page from the draft (and, once published, the
  // live site) on the very first save after the starter template created them.
  const [otherPages, setOtherPages] = useState<SitePage[]>([])
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_SITE_THEME)
  const [featuredSettings, setFeaturedSettings] = useState<FeaturedSettings>(DEFAULT_FEATURED_SETTINGS)
  const [mediaSettings, setMediaSettings] = useState<MediaSettings>(DEFAULT_MEDIA_SETTINGS)
  const [seo, setSeo] = useState<SiteSeo>(DEFAULT_SITE_SEO)
  const [seoFocus, setSeoFocus] = useState('home')
  // The Google tab's "Every page on Google" facts (towns, articles, homes) - loaded the first time
  // the tab opens; reopening the tab refreshes them.
  const [seoData, setSeoData] = useState<SeoPagesData | null>(null)
  const [seoPreviewPage, setSeoPreviewPage] = useState<SeoPreviewPage | null>(null)
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ownTab, setOwnTab] = useState<EditorTab>('content')
  const activeTab = tabProp ?? ownTab
  useEffect(() => {
    if (activeTab !== 'search') return
    let live = true
    api.sites.getSeoPages().then(r => { if (live && r.success && r.data) setSeoData(r.data) })
    return () => { live = false }
  }, [activeTab])
  // Back on the home/brand fields, the preview shows the main result again.
  useEffect(() => { if (!seoFocus.startsWith('pg:')) setSeoPreviewPage(null) }, [seoFocus])
  const setActiveTab = (t: EditorTab) => { setOwnTab(t); onTabChange?.(t) }
  // The draft's raw blocks (data.resolved_photos, resolved_areas, agent profile, etc.) are only
  // ever populated server-side (see content_adapters.hydrate_page_blocks), so rendering
  // homePage.blocks directly in the preview would show empty/default content instead of what a
  // real visitor sees. Hydrated on every blocks change (debounced) via a preview-only endpoint -
  // homePage itself (the actual edit/save state) never holds resolved data.
  const [previewBlocks, setPreviewBlocks] = useState<SiteBlock[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  // Only GET /studio/sites/me carries it (later saves return the site without it), so it's kept
  // apart from `site` - the preview footer's signature card source.
  const [signatureSlug, setSignatureSlug] = useState<string | null>(null)
  // The agent's name, photo and contact details for the preview's header and footer - the same
  // details the live site shows (built from the Agent Hub, so it works before publishing too).
  const [chromeProfile, setChromeProfile] = useState<SiteChromeProfile | undefined>(undefined)

  useEffect(() => {
    api.agentHub.getMine().then(r => setChromeProfile(siteProfileFromHub(r.success ? r.data?.config : null, user)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    api.sites.getMine().then(async res => {
      if (res.success && res.data) {
        setSite(res.data)
        setSignatureSlug(res.data.signature_hub_slug || null)
        const existingHome = res.data.draft_data?.pages?.find(p => p.is_home)
        setHomePage(existingHome || emptyHomePage())
        setOtherPages(res.data.draft_data?.pages?.filter(p => !p.is_home) || [])
        if (res.data.draft_data?.featured_settings) setFeaturedSettings({ ...DEFAULT_FEATURED_SETTINGS, ...res.data.draft_data.featured_settings })
        if (res.data.draft_data?.media_settings) setMediaSettings(res.data.draft_data.media_settings)
        if (res.data.draft_data?.seo) setSeo({ ...DEFAULT_SITE_SEO, ...res.data.draft_data.seo, pages: res.data.draft_data.seo.pages || {} })
        // Every site now uses the same template, so it's applied automatically the first time an
        // agent opens a brand new (blockless) site instead of a manual "Apply Template" button.
        if (!existingHome?.blocks?.length) {
          const templateRes = await api.sites.applyTemplate()
          if (templateRes.success && templateRes.data) {
            setSite(templateRes.data)
            const home = templateRes.data.draft_data?.pages?.find(p => p.is_home)
            if (home) setHomePage(home)
            setOtherPages(templateRes.data.draft_data?.pages?.filter(p => !p.is_home) || [])
          }
        }

        const draftTheme = res.data.draft_data?.theme
        if (draftTheme) {
          setTheme(draftTheme)
        } else {
          // Brand new site, no theme saved yet - start from the agent's real Brand Kit (Studio >
          // Design) instead of a generic default, so colors/fonts/logo are right the first time
          // they open this tab, not something they have to re-enter here.
          const brandKit = await api.studio.getBrandKit()
          if (brandKit.success && brandKit.data) {
            const bk = brandKit.data
            setTheme({
              ...DEFAULT_SITE_THEME,
              primary_color: bk.primary_color || DEFAULT_SITE_THEME.primary_color,
              secondary_color: bk.secondary_color || DEFAULT_SITE_THEME.secondary_color,
              heading_font: bk.heading_font || DEFAULT_SITE_THEME.heading_font,
              body_font: bk.body_font || DEFAULT_SITE_THEME.body_font,
              logo_url: bk.personal_logo_url || bk.team_logo_url || bk.brokerage_logo_url || DEFAULT_SITE_THEME.logo_url,
            })
          } else {
            setTheme(DEFAULT_SITE_THEME)
          }
        }
      } else {
        showToast(res.error || 'Could not load your website.', 'error')
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bumped whenever something the preview depends on changes OUTSIDE homePage.blocks/
  // featuredSettings - right now just AreasPanel's add/remove, which mutates served areas
  // directly server-side (AgentMarketArea rows, not draft_data) with no client-side field this
  // effect could otherwise watch. Without this, adding/removing a served town never touched the
  // preview at all - it kept showing whatever areas were resolved on the last unrelated re-hydrate,
  // and looked like it needed a full page refresh to pick up (because it did).
  const [areasVersion, setAreasVersion] = useState(0)
  // The menu's Neighborhoods link shows once they serve a town - same rule as the live site.
  const [areaCount, setAreaCount] = useState(0)
  useEffect(() => { api.sites.getAreas(true).then(r => setAreaCount(r.success && r.data ? r.data.length : 0)) }, [areasVersion])
  // Reviews page on (Reviews tab) - the preview's menu shows its "Reviews" link while it is.
  const [reviewsShowing, setReviewsShowing] = useState(false)
  useEffect(() => {
    api.agentHub.listReviews().then(r => {
      if (!r.success || !r.data) return
      const min = r.data.settings.min_rating ?? 1
      setReviewsShowing(!!r.data.settings.show_on_idx && r.data.reviews.some(x => x.status === 'published' && x.rating >= min))
    })
  }, [])

  // Debounced so fast typing (e.g. the Hero headline field) doesn't fire a hydration request per
  // keystroke - only once input settles. Also re-runs on featuredSettings changes now - the
  // featured_listings block reads the Featured tab's settings directly (see
  // content_adapters.get_featured_page_listings), so editing that tab has to refresh this same
  // preview, not just editing page-builder blocks.
  useEffect(() => {
    if (!site) return
    setPreviewLoading(true)
    const seq = ++previewSeq.current
    const timeoutId = setTimeout(() => {
      api.sites.previewBlocks(homePage.blocks, featuredSettings).then(res => {
        if (seq !== previewSeq.current) return
        if (res.success && res.data) showPreview(res.data.blocks)
        setPreviewLoading(false)
      })
    }, 250)
    return () => clearTimeout(timeoutId)
  }, [site, homePage.blocks, featuredSettings, areasVersion])

  // The site's address: the agent's own domain once it's connected and live (primary + ACTIVE -
  // the same rule as every share link, lib/publicResourceLinks), else https://{slug}.openhousepal.com.
  // Re-read when they leave the Domain tab, so connecting a domain updates the link right away.
  // It used to always show the openhousepal.com address, even with a domain connected (user, 10/20).
  const [ownDomain, setOwnDomain] = useState<string | null>(null)
  useEffect(() => {
    if (!site || activeTab === 'domains') return
    let live = true
    api.sites.getDomains().then(res => {
      if (!live || !res.success) return
      setOwnDomain((res.data || []).find(d => d.is_primary && d.status === 'ACTIVE')?.hostname || null)
    })
    return () => { live = false }
  }, [site, activeTab])
  const siteUrl = site ? ohpHostUrl(ownDomain || `${site.subdomain_slug}.${OHP_BASE_DOMAIN}`) : ''

  // ---- Live preview that follows what you're editing (same feel as the Spotlight editor) ----
  // The open tab (and, on Content, the open section) is scrolled into view and outlined in gold.
  // Hiding/deleting a section scrolls to it, flags it red and folds it away; showing/adding one
  // waits for it to render, then scrolls to it and unfolds it with a gold "Added" glow.
  const previewRef = useRef<HTMLDivElement>(null)
  const previewSeq = useRef(0)
  const [zoom, setZoom] = useState(1)
  // On desktop the preview is one steady window on every tab: the height of the Content tab's
  // card (Your Home Page, sections closed) - it never grows or shrinks with the tab or with a
  // section being opened. Never taller than the screen, never shorter than a useful 300px.
  const [cardEl, setCardEl] = useState<HTMLElement | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [fitH, setFitH] = useState<number | null>(null)
  const windowH = useRef<number | null>(null)
  const tabNow = useRef(activeTab)
  tabNow.current = activeTab
  const blockOpenNow = useRef(false)
  useEffect(() => {
    if (!cardEl) return
    const fit = () => {
      if (window.innerWidth < 1024) { setFitH(null); return }
      if (tabNow.current === 'content' && !blockOpenNow.current) windowH.current = cardEl.offsetHeight
      const bar = barRef.current?.offsetHeight || 37
      setFitH(Math.max(300, Math.min(windowH.current ?? 460, window.innerHeight - 120)) - bar - 2)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cardEl)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [cardEl])
  const zoomRef = useRef(1)
  useEffect(() => {
    const box = previewRef.current
    if (!box) return
    const fit = () => {
      const z = window.innerWidth >= 1024 && box.clientWidth < DESKTOP_W ? box.clientWidth / DESKTOP_W : 1
      zoomRef.current = z
      setZoom(z)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [loading, !!site]) // eslint-disable-line react-hooks/exhaustive-deps
  // Sections that finished folding away - dropped from the preview right away, even if the
  // refreshed preview data hasn't arrived yet.
  const [gone, setGone] = useState<Set<string>>(new Set())
  // Sections switched off that are still playing their "Removing from your site" exit - kept on
  // screen until the fold finishes (the preview draws the current blocks right away, so without
  // this a hidden section vanished before its exit could play).
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [openBlockId, setOpenBlockId] = useState<string | null>(null)
  blockOpenNow.current = !!openBlockId
  const fxQueue = useRef<Promise<void>>(Promise.resolve())
  const frozen = useRef(false)
  const pendingPreview = useRef<SiteBlock[] | null>(null)
  const waitingIn = useRef<{ id: string; kind: 'in' | 'move'; done: () => void } | null>(null)

  // While a section is being folded away, hold back fresh preview data so it can't vanish mid-fold.
  const showPreview = (blocks: SiteBlock[]) => {
    if (frozen.current) pendingPreview.current = blocks
    else setPreviewBlocks(blocks)
  }

  const findBlockEl = (id: string) => previewRef.current?.querySelector<HTMLElement>(`[data-ohp-block="${id}"]`) || null
  const scrollPreview = (el: HTMLElement | null) => {
    const box = previewRef.current
    if (!box) return wait(0)
    const top = el ? el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 84 * zoomRef.current : 0
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    return wait(Math.min(700, 250 + Math.abs(box.scrollTop - top) / 6))
  }

  const playOut = async (id: string) => {
    const el = findBlockEl(id)
    if (!el) { setLeaving(l => { const n = new Set(l); n.delete(id); return n }); setGone(g => new Set(g).add(id)); return }
    frozen.current = true
    try {
      await scrollPreview(el)
      el.dataset.ohpFx = 'out'
      await wait(1000)
      el.style.height = `${el.offsetHeight}px`
      el.style.overflow = 'hidden'
      void el.offsetHeight
      el.style.transition = `height .75s ${FX_EASE}, opacity .5s ease, transform .75s ${FX_EASE}`
      el.style.height = '0px'
      el.style.opacity = '0'
      el.style.transform = 'scale(.97)'
      await wait(780)
      setGone(g => new Set(g).add(id))
    } finally {
      setLeaving(l => { const n = new Set(l); n.delete(id); return n })
      frozen.current = false
      if (pendingPreview.current) { setPreviewBlocks(pendingPreview.current); pendingPreview.current = null }
    }
  }

  // Resolves once the section shows up in the preview (after the preview data refreshes).
  const playIn = (id: string, kind: 'in' | 'move') => new Promise<void>(done => {
    let fold: HTMLStyleElement | null = null
    if (kind === 'in') {
      fold = document.createElement('style')
      fold.textContent = `[data-ohp-block="${id}"]{height:0!important;overflow:hidden!important;opacity:0!important}`
      document.head.appendChild(fold)
    }
    const finish = () => { fold?.remove(); done() }
    waitingIn.current = { id, kind, done: finish }
    window.setTimeout(() => { if (waitingIn.current?.id === id) { waitingIn.current = null; finish() } }, 8000)
  })

  // After every preview refresh: if a section was waiting to come in, it's on screen now.
  useEffect(() => {
    const w = waitingIn.current
    if (!w || previewLoading) return
    const el = findBlockEl(w.id)
    if (!el) return
    waitingIn.current = null
    ;(async () => {
      el.style.cssText = ''
      delete el.dataset.ohpFx
      if (w.kind === 'in') {
        el.style.height = '0px'
        el.style.overflow = 'hidden'
        el.style.opacity = '0'
        w.done()
        await scrollPreview(el)
        const target = el.scrollHeight
        void el.offsetHeight
        el.style.transition = `height .85s ${FX_EASE}, opacity .6s ease .2s`
        el.style.height = `${target}px`
        el.style.opacity = '1'
        el.dataset.ohpFx = 'in'
        await wait(880)
        el.style.cssText = ''
        await wait(2000)
      } else {
        w.done()
        await scrollPreview(el)
        el.dataset.ohpFx = 'move'
        await wait(1600)
      }
      delete el.dataset.ohpFx
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewBlocks, previewLoading])

  const updateBlocks = (blocks: SiteBlock[]) => {
    const prev = homePage.blocks
    const before = new Map(prev.map(b => [b.id, b]))
    const after = new Map(blocks.map(b => [b.id, b]))
    let change: { id: string; kind: 'out' | 'in' | 'move' } | null = null
    for (const b of prev) {
      const n = after.get(b.id)
      if (!b.hidden && (!n || n.hidden)) { change = { id: b.id, kind: 'out' }; break }
      if (b.hidden && n && !n.hidden) { change = { id: b.id, kind: 'in' }; break }
    }
    if (!change) for (const b of blocks) if (!before.has(b.id) && !b.hidden) { change = { id: b.id, kind: 'in' }; break }
    if (!change && prev.length === blocks.length && prev.some((b, i) => b.id !== blocks[i].id)) {
      const moved = blocks.find((b, i) => b.id !== prev[i].id && !b.hidden)
      if (moved) change = { id: moved.id, kind: 'move' }
    }
    if (change && change.kind !== 'out' && gone.has(change.id)) {
      const id = change.id
      setGone(g => { const n = new Set(g); n.delete(id); return n })
    }
    if (change?.kind === 'out') { const id = change.id; setLeaving(l => new Set(l).add(id)) }
    if (!change) sectionSpot(prev, blocks)
    if (change) {
      const c = change
      // Start waiting for an incoming section before the edit lands, so it never flashes in unfolded.
      const job = c.kind === 'out' ? null : playIn(c.id, c.kind)
      fxQueue.current = fxQueue.current.then(() => (c.kind === 'out' ? playOut(c.id) : job!)).catch(() => {})
    }
    setHomePage(p => ({ ...p, blocks }))
  }

  // ---- "Show me what that does" - every other setting ----
  // Flip a switch or pick a color on any tab and the preview scrolls to the part of the site it
  // changes and rings it: red "Turning off..." while the old look stays put (it only goes once the
  // red has played), gold "Added..." once the new part has drawn, gold for a change. The newest one
  // always wins - a quick second click never waits behind the first.
  const [spot, setSpot] = useState<{ key: number; kind: SpotKind; label: string; rect: SpotRect; fading?: boolean } | null>(null)
  const [hold, setHold] = useState<SpotHold>({})
  const [loaderDemo, setLoaderDemo] = useState<{ key: number; top: number; height: number } | null>(null)
  const spotSeq = useRef(0)
  const spotKey = useRef(0)
  const spotEl = useRef<HTMLElement | null>(null)
  const previewLoadingRef = useRef(false)
  previewLoadingRef.current = previewLoading
  const blocksRef = useRef(homePage.blocks)
  blocksRef.current = homePage.blocks

  const measureEl = (el: HTMLElement): SpotRect | null => {
    const box = previewRef.current
    if (!box || !el.isConnected) return null
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { top: r.top - b.top + box.scrollTop, left: r.left - b.left + box.scrollLeft, width: r.width, height: r.height }
  }
  const showSpot = (el: HTMLElement, kind: SpotKind, label: string) => {
    const rect = measureEl(el)
    if (!rect) return false
    spotEl.current = el
    setSpot({ key: ++spotKey.current, kind, label, rect })
    return true
  }
  const inPreview = (sel: string) => () => previewRef.current?.querySelector<HTMLElement>(sel) || null
  const blockOfType = (type: SiteBlock['type']) => () => {
    const id = blocksRef.current.find(b => b.type === type && !b.hidden)?.id
    return id ? findBlockEl(id) : null
  }
  const firstBlock = inPreview('[data-ohp-block]')
  const either = (...finds: (() => HTMLElement | null)[]) => () => { for (const f of finds) { const el = f(); if (el) return el } return null }

  const runSpot = async (plan: SpotPlan) => {
    const seq = ++spotSeq.current
    const alive = () => seq === spotSeq.current
    setSpot(null)
    spotEl.current = null
    setHold(plan.hold || {})
    await wait(90)
    if (plan.refresh) { await wait(320); await waitUntil(() => !previewLoadingRef.current, 6000) }
    if (!alive()) return
    const el = plan.kind === 'off' ? plan.find() : await waitUntil(plan.find, 3000)
    if (!alive()) return
    if (!el) { setHold({}); return }
    if (!plan.noScroll) await scrollPreview(el)
    if (!alive() || !showSpot(el, plan.kind, plan.label)) { if (alive()) setHold({}); return }
    if (plan.kind === 'off') {
      await wait(1500)
      if (!alive()) return
      setHold({})
      if (plan.then) {
        await wait(450)
        if (!alive()) return
        const next = plan.find()
        if (next && showSpot(next, 'change', plan.then)) await wait(2300)
      } else {
        setSpot(s => (s ? { ...s, fading: true } : s))
        await wait(450)
      }
    } else {
      await wait(2400)
    }
    if (alive()) { setSpot(null); spotEl.current = null }
  }

  // The ring follows its target while it settles (a card loading in, the page reflowing).
  useEffect(() => {
    if (!spot) return
    const t = window.setInterval(() => {
      const el = spotEl.current
      const r = el ? measureEl(el) : null
      if (!r) return
      setSpot(s => (s && (Math.abs(s.rect.top - r.top) > 1 || Math.abs(s.rect.height - r.height) > 1 || Math.abs(s.rect.left - r.left) > 1 || Math.abs(s.rect.width - r.width) > 1) ? { ...s, rect: r } : s))
    }, 120)
    return () => window.clearInterval(t)
  }, [spot?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Design tab: what each change points at.
  const themeSpot = (prev: SiteTheme, next: SiteTheme): SpotPlan | null => {
    const sig = (t: SiteTheme) => t.footer_signature === true
    if (sig(prev) !== sig(next)) {
      const find = inPreview('[data-ohp-spot="footer-agent"]')
      return sig(next)
        ? { kind: 'on', find, label: signatureSlug ? 'Added · your email signature card' : 'Your signature card shows here once you make one (Studio → Email Signature)' }
        : { kind: 'off', find, label: 'Turning off · your signature card', then: 'Now · your plain name & contact card', hold: { theme: { footer_signature: true } } }
    }
    const modeSwitch = (t: SiteTheme) => t.allow_mode_toggle !== false
    if (modeSwitch(prev) !== modeSwitch(next)) {
      const find = inPreview('[data-ohp-spot="mode-toggle"]')
      return modeSwitch(next)
        ? { kind: 'on', find, noScroll: true, label: 'Added · a light / dark switch for visitors' }
        : { kind: 'off', find, noScroll: true, label: 'Removing · the light / dark switch', hold: { theme: { allow_mode_toggle: true } } }
    }
    if ((prev.logo_url || null) !== (next.logo_url || null)) {
      const find = inPreview('[data-ohp-spot="logo"]')
      if (!next.logo_url) return { kind: 'off', find, noScroll: true, label: 'Removing · your logo', then: 'Now · a simple home icon', hold: { theme: { logo_url: prev.logo_url } } }
      return { kind: prev.logo_url ? 'change' : 'on', find, noScroll: true, label: prev.logo_url ? 'Your new logo' : 'Added · your logo' }
    }
    if (!prev.follow_brand_kit && next.follow_brand_kit) return { kind: 'change', find: firstBlock, label: 'Matched your Brand Kit · colors, fonts & logo' }
    if (siteTemplate(prev) !== siteTemplate(next)) return { kind: 'change', find: firstBlock, label: siteTemplate(next) === 'luxe' ? 'Luxe look · across your whole site' : 'Classic look · across your whole site' }
    if (siteTemplate(next) === 'luxe' && siteLuxeMetal(prev) !== siteLuxeMetal(next)) return { kind: 'change', find: firstBlock, label: `${LUXE_METALS[siteLuxeMetal(next)].label} finish · buttons, lines & highlights` }
    if ((prev.secondary_color || '').toLowerCase() !== (next.secondary_color || '').toLowerCase()) return { kind: 'change', find: firstBlock, label: `${accentLabel(next.secondary_color) || 'New'} accent · buttons & highlights everywhere` }
    if ((prev.primary_color || '').toLowerCase() !== (next.primary_color || '').toLowerCase()) return { kind: 'change', find: firstBlock, label: 'New color · dark panels & buttons' }
    if (siteMode(prev) !== siteMode(next)) return { kind: 'change', find: firstBlock, label: siteMode(next) === 'dark' ? 'Dark pages by default' : 'Light pages by default' }
    if (prev.heading_font !== next.heading_font) return { kind: 'change', find: either(inPreview('[data-ohp-block] h1'), inPreview('[data-ohp-block] h2')), label: `Headings · ${FONT_NAMES[next.heading_font] || 'new font'}` }
    if (prev.body_font !== next.body_font) return { kind: 'change', find: inPreview('[data-ohp-block] p'), label: `Body text · ${FONT_NAMES[next.body_font] || 'new font'}` }
    return null
  }
  const onThemeChange = (next: SiteTheme) => {
    const prev = theme
    setTheme(next)
    if ((prev.loader_logo_url || null) !== (next.loader_logo_url || null)) {
      // Nothing on the page shows the loading mark - so play it, right in the preview.
      const box = previewRef.current
      if (box) {
        spotSeq.current++
        setSpot(null)
        const key = ++spotKey.current
        setLoaderDemo({ key, top: box.scrollTop, height: box.clientHeight })
        window.setTimeout(() => setLoaderDemo(d => (d?.key === key ? null : d)), 3200)
      }
      return
    }
    const plan = themeSpot(prev, next)
    if (plan) runSpot(plan)
  }

  // Featured tab: the header's homes, and the Featured homes section.
  const onHeaderHomesChange = (heroId: string, patch: Record<string, any>) => {
    updateBlocks(homePage.blocks.map(b => (b.id === heroId ? { ...b, data: { ...b.data, ...patch, _template_generated: false } } : b)))
    const find = () => findBlockEl(heroId)
    if ('header_mine_first' in patch) {
      runSpot(patch.header_mine_first ? { kind: 'on', find, refresh: true, label: 'Your own listings lead the header' } : { kind: 'off', find, label: 'Your listings no longer go first' })
      return
    }
    const towns: string[] = Array.isArray(patch.header_towns) ? patch.header_towns : []
    const label = 'header_towns' in patch ? (towns.length ? `Header homes · ${towns.join(', ')}` : 'Header homes · all your towns')
      : 'photo_property_type' in patch ? 'Header homes · that home type'
      : 'photo_source_mode' in patch ? 'Header · the newest homes for sale'
      : 'Header homes · your price range'
    runSpot({ kind: 'change', find, refresh: true, label })
  }
  const onFeaturedChange = (next: FeaturedSettings) => {
    const prev = featuredSettings
    setFeaturedSettings(next)
    const find = either(blockOfType('featured_listings'), inPreview('[data-ohp-spot="nav-featured"]'))
    if (prev.prioritize_my_listings !== next.prioritize_my_listings) {
      runSpot(next.prioritize_my_listings ? { kind: 'on', find, refresh: true, label: 'Your own listings go first' } : { kind: 'off', find, label: 'Your listings no longer go first' })
      return
    }
    runSpot({ kind: 'change', find, refresh: true, label: 'Featured homes · updated' })
  }

  // Media tab: those live on the Media page - the menu's Media link is where visitors find them.
  const onMediaChange = (next: MediaSettings) => {
    const prev = mediaSettings
    setMediaSettings(next)
    const find = inPreview('[data-ohp-spot="nav-media"]')
    if (prev.show_videos !== next.show_videos) runSpot({ kind: next.show_videos ? 'on' : 'off', find, noScroll: true, label: next.show_videos ? 'Videos now show on your Media page' : 'Videos hidden from your Media page' })
    else if (prev.show_tours !== next.show_tours) runSpot({ kind: next.show_tours ? 'on' : 'off', find, noScroll: true, label: next.show_tours ? 'House tours now show on your Media page' : 'House tours hidden from your Media page' })
  }

  // Reviews tab: the Reviews link in the menu (and footer).
  const reviewsNow = useRef(reviewsShowing)
  reviewsNow.current = reviewsShowing
  const onReviewsShowing = (next: boolean) => {
    if (next === reviewsNow.current) return
    reviewsNow.current = next
    setReviewsShowing(next)
    const find = either(inPreview('[data-ohp-spot="nav-reviews"]'), inPreview('[data-ohp-spot="foot-reviews"]'))
    runSpot(next
      ? { kind: 'on', find, noScroll: true, label: 'Added · Reviews in your menu & footer' }
      : { kind: 'off', find, noScroll: true, label: 'Removing · Reviews from your menu & footer', hold: { reviews: true } })
  }
  // Switched on with no review to show yet - nothing appears, so say why.
  const onReviewsSwitch = (on: boolean, hasReviews: boolean) => {
    if (hasReviews) return
    const find = inPreview('.ohp-zoom > header')
    runSpot(on
      ? { kind: 'change', find, noScroll: true, label: 'Reviews joins your menu once you have a review to show' }
      : { kind: 'off', find, noScroll: true, label: 'Reviews page is off' })
  }
  const onReviewsMinRating = (onlyTop: boolean) => {
    runSpot({ kind: onlyTop ? 'on' : 'change', find: inPreview('[data-ohp-spot="nav-reviews"]'), noScroll: true, label: onlyTop ? 'Reviews page · only 4 and 5-star reviews' : 'Reviews page · every review' })
  }

  // Areas tab: the Neighborhoods section.
  const onAreasChange = (what?: { added?: string; removed?: string }) => {
    setAreasVersion(v => v + 1)
    const find = either(blockOfType('communities'), inPreview('[data-ohp-spot="nav-neighborhoods"]'))
    if (what?.added) runSpot({ kind: 'on', find, refresh: true, label: `Added · ${what.added}` })
    else if (what?.removed) runSpot({ kind: 'off', find, label: `Removing · ${what.removed}` })
  }

  // Sections tab: a switch or a choice inside a section rings that section.
  const sectionSpot = (prev: SiteBlock[], next: SiteBlock[]) => {
    if (tabNow.current !== 'content' || prev.length !== next.length) return
    const i = next.findIndex((b, k) => b.id === prev[k].id && b.hidden === prev[k].hidden && b.data !== prev[k].data)
    if (i < 0) return
    const before = prev[i].data || {}
    const after = next[i].data || {}
    for (const f of BLOCK_FIELD_SCHEMA[next[i].type] || []) {
      const read = (d: Record<string, any>) => { const [a, c] = f.key.split('.'); const v = c ? d[a]?.[c] : d[a]; return v == null ? '' : String(v) }
      const was = read(before), now = read(after)
      if (was === now) continue
      const find = () => findBlockEl(next[i].id)
      if (f.kind === 'checkbox') {
        const on = (v: string) => (v === '' ? !!f.defaultChecked : v === 'true')
        if (on(was) !== on(now)) runSpot(on(now) ? { kind: 'on', find, refresh: true, label: `On · ${f.label}` } : { kind: 'off', find, label: `Off · ${f.label}` })
      } else if (f.kind === 'select') {
        runSpot({ kind: 'change', find, refresh: true, label: `${f.label} · ${f.options?.find(o => o.value === now)?.label || 'changed'}` })
      } else if (f.kind === 'image') {
        runSpot({ kind: now ? 'change' : 'off', find, refresh: true, label: now ? 'New photo' : 'Photo removed' })
      }
      return
    }
  }

  // What the preview spotlights for the open tab.
  const focusFor = (): { blockId?: string | null; header?: string; tag: string } => {
    const first = (type: SiteBlock['type']) => homePage.blocks.find(b => b.type === type && !b.hidden)?.id || null
    switch (activeTab) {
      case 'content': return { blockId: openBlockId, tag: 'Editing' }
      case 'featured': return { blockId: first('hero') || first('featured_listings'), tag: 'Header homes' }
      case 'areas': return { blockId: first('communities'), tag: 'Your areas' }
      case 'design': return { header: theme.template === 'default' ? 'Classic look · your colors, fonts & logo' : 'Luxe look · your colors, fonts & logo', tag: '' }
      case 'media': return { header: 'Videos & tours live on your Media page', tag: '' }
      case 'reviews': return { header: reviewsShowing ? 'Reviews is in your menu - it opens your Reviews page' : 'Reviews page is off', tag: '' }
      default: return { tag: '' }
    }
  }
  const focus = focusFor()

  // Scroll the preview to whatever the open tab/section is about.
  useEffect(() => {
    if (!site || frozen.current || waitingIn.current) return
    const t = window.setTimeout(() => {
      if (focus.blockId) { const el = findBlockEl(focus.blockId); if (el) scrollPreview(el) }
      else scrollPreview(null)
    }, 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, focus.blockId, !!site])

  // What was last loaded/saved, so the header can say "Unsaved changes" vs "All changes saved".
  const savedSnap = useRef<string | null>(null)
  const snap = () => JSON.stringify([homePage, otherPages, theme, featuredSettings, mediaSettings, seo])
  useEffect(() => { if (!loading && savedSnap.current === null) savedSnap.current = snap() }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !loading && savedSnap.current !== null && savedSnap.current !== snap()

  const saveDraft = async (): Promise<boolean> => {
    setSaving(true)
    const res = await api.sites.updateDraft({ pages: [...otherPages, homePage], theme, featured_settings: featuredSettings, media_settings: mediaSettings, seo })
    setSaving(false)
    if (res.success && res.data) {
      savedSnap.current = snap()
      setSite(res.data)
      return true
    }
    showToast(res.error || 'Could not save your draft.', 'error')
    return false
  }

  const handleSaveDraft = async () => {
    const ok = await saveDraft()
    if (ok) showToast('Draft saved.', 'success')
  }

  const handlePublish = async () => {
    // The site is built from the Agent Hub - say what will show up blank before it goes live.
    const hub = await api.agentHub.getMine()
    const blanks = hubMissing(hub.success ? hub.data?.config : null, user).filter(m => m.required)
    if (blanks.length && !window.confirm(`Your Agent Hub is missing: ${blanks.map(m => m.label).join(', ')}.

Your website is built from your Agent Hub, so these parts will show up blank. Publish anyway?`)) return
    setPublishing(true)
    const savedOk = await saveDraft()
    if (savedOk) {
      const res = await api.sites.publish()
      if (res.success && res.data) {
        setSite(res.data)
        showToast('Your website is live.', 'success')
      } else {
        showToast(res.error || 'Could not publish your website.', 'error')
      }
    }
    setPublishing(false)
  }

  const copyUrl = () => {
    copyText(siteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // The status pill, URL/copy/open-in-new-window row, and Save/Publish buttons all live on the
  // page header's own row (same row as the title), not down here - the state behind them still
  // belongs to this component since that's where the site/draft state lives, so they're handed
  // up to the parent page via a callback instead of duplicating that state.
  useEffect(() => {
    if (!onActionsChange) return
    onActionsChange(
      !site ? null : (
        <div className="w-full rounded-2xl border border-gray-200/80 bg-white/85 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none">
          <div className="flex min-w-0 items-center gap-2">
            <span title={site.is_enabled === false ? 'Your IDX website is switched off in Settings -> IDX Website, so it is not shown to anyone.' : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
              site.is_enabled === false ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                : site.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/60'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${site.is_enabled === false ? 'bg-amber-500' : site.status === 'PUBLISHED' ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} />
              {site.is_enabled === false ? 'Turned off' : site.status === 'PUBLISHED' ? 'Live' : 'Draft'}
            </span>
            <a href={siteUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-[#8b7355] hover:underline dark:text-[#e8c97a]">{siteUrl.replace(/^https?:\/\//, '')}</a>
            <button onClick={copyUrl} title="Copy link" className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a href={siteUrl} target="_blank" rel="noreferrer" title="Open in new window" className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
            </button>
            <button
              onClick={handlePublish}
              disabled={saving || publishing}
              className="lx-shine relative inline-flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-sm font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
            </button>
          </div>
        </div>
      )
    )
    return () => onActionsChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, siteUrl, copied, saving, publishing])

  useEffect(() => {
    if (!onBarEndChange) return
    onBarEndChange(!site ? null : (
      <>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
          saving || publishing ? 'border-[#C9A24D]/40 bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]'
            : dirty ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
        }`}>
          {saving || publishing
            ? <><Loader2 className="h-3 w-3 animate-spin" /> {publishing ? 'Publishing' : 'Saving'}</>
            : dirty
              ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Unsaved changes</>
              : <><Check className="h-3 w-3" /> All changes saved</>}
        </span>
        <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
          View site <ExternalLink className="h-3 w-3" />
        </a>
      </>
    ))
    return () => onBarEndChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, siteUrl, dirty, saving, publishing])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-gray-400">
        Could not load your website. Try refreshing the page.
      </div>
    )
  }

  const hasDarkHero = homePage.blocks?.[0]?.type === 'hero' && !homePage.blocks[0]?.hidden

  // What the preview shows RIGHT NOW: the agent's current blocks (so a headline change or a
  // reorder lands on the next keystroke), each carrying the live data (resolved listings, areas,
  // photos...) from the last server hydration of that same block. The server round-trip then
  // only refreshes the data, instead of being the thing the whole preview waits on.
  const resolvedById = new Map(previewBlocks.map(b => [b.id, b]))
  const liveBlocks = homePage.blocks.map(b => {
    if (leaving.has(b.id) && !gone.has(b.id)) b = { ...b, hidden: false }
    const hydrated = resolvedById.get(b.id)
    if (!hydrated) return gone.has(b.id) ? { ...b, hidden: true } : b
    const carried: Record<string, any> = {}
    for (const [k, v] of Object.entries(hydrated.data || {})) if (k === 'resolved' || k.startsWith('resolved_') || k.startsWith('agent_') || k === 'profile') carried[k] = v
    const merged = { ...b, data: { ...carried, ...(b.data || {}) } }
    return gone.has(b.id) ? { ...merged, hidden: true } : merged
  })

  const tab = TABS.find(t => t.id === activeTab)!
  // Same CSS variables + data-template/data-mode the public SiteShell sets, so the preview is
  // the real site: accent swatches, Classic/Luxe and light/dark all land here instantly.
  // While a "Turning off..." ring plays, the preview keeps the old look (see runSpot).
  const shownTheme = hold.theme ? { ...theme, ...hold.theme } as SiteTheme : theme
  const themeVars = siteThemeVars(shownTheme)
  // What visitors see (Luxe snapped to its metal, Classic never a metal) - the preview renders this.
  const viewTheme = normalizeSiteTheme(shownTheme)
  const shownReviews = hold.reviews ?? reviewsShowing
  const seoDefaults = {
    siteName: (homePage.title && homePage.title !== 'Home' ? homePage.title : '') || [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    area: seoData?.agent?.market || featuredSettings.towns?.[0] || '',
    logoUrl: theme.logo_url,
  }

  return (
    <div>
      {/* Every part of the site, one pill each - same feel as the Spotlight editor's step bar */}
      {!tabProp && <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Site sections">
        <div className="flex min-w-max items-center gap-1.5 rounded-2xl border border-gray-200 bg-white/80 p-1.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]/80">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition ${
                  active
                    ? 'bg-[#111827] text-white shadow dark:bg-white dark:text-[#111827]'
                    : 'text-gray-500 hover:bg-[#C9A24D]/10 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#e8c97a] dark:text-[#8b7355]' : ''}`} /> {t.label}
              </button>
            )
          })}
        </div>
      </nav>}

      <div className={`${tabProp ? '' : 'mt-5 '}grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]`}>
        <section key={activeTab} ref={setCardEl} className="ohp-rise rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbf8f2] p-4 shadow-sm dark:border-gray-800 dark:from-[#141416] dark:to-[#121110] sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#e8c97a] dark:bg-white/10"><tab.icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">{tab.title}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{tab.blurb}</p>
            </div>
          </div>
          <div className="mb-4 h-px bg-gradient-to-r from-[#C9A24D]/55 via-[#C9A24D]/15 to-transparent" />
          {activeTab === 'content' && <BlockEditorPanel blocks={homePage.blocks} onChange={updateBlocks} onOpenChange={setOpenBlockId} onSwitchTab={setActiveTab} />}
          {activeTab === 'design' && <ThemePanel theme={theme} onChange={onThemeChange} />}
          {activeTab === 'featured' && (() => {
            const hero = homePage.blocks.find(b => b.type === 'hero') || null
            return (
              <div className="space-y-3">
                <HeaderHomesPanel data={hero ? hero.data : null} onEditHero={() => setActiveTab('content')}
                  onChange={patch => hero && onHeaderHomesChange(hero.id, patch)} />
                <FeaturedSettingsPanel value={featuredSettings} onChange={onFeaturedChange} />
              </div>
            )
          })()}
          {activeTab === 'media' && <MediaSettingsPanel value={mediaSettings} onChange={onMediaChange} />}
          {activeTab === 'reviews' && <ReviewsSettingsPanel onShowingChange={onReviewsShowing} onSwitch={onReviewsSwitch} onMinRatingChange={onReviewsMinRating} siteUrl={siteUrl} />}
          {activeTab === 'areas' && <AreasPanel onChange={onAreasChange} />}
          {activeTab === 'search' && <SearchAppearancePanel seo={seo} onChange={setSeo} pages={[homePage, ...otherPages]} defaults={seoDefaults} focusKey={seoFocus} onFocusKey={setSeoFocus} data={seoData} onPreview={setSeoPreviewPage} />}
          {activeTab === 'domains' && <><LinkDomainShortcut /><DomainsPanel subdomainSlug={site.subdomain_slug} bare /></>}
        </section>

        {/* Live preview - the exact same header/footer chrome + block renderer components the
            public site uses, so what an agent sees here matches what visitors see once
            published, not just the block content in isolation. Links are inert (this isn't an
            iframe, so a real navigation would blow away the editor). */}
        {activeTab === 'search' ? (
          <div className="ohp-rise lg:sticky lg:top-24">
            <GoogleResultPreview seo={seo} pages={[homePage, ...otherPages]} defaults={seoDefaults} siteUrl={siteUrl} focusKey={seoFocus} ctx={seoData ? seoCtxFrom(seoData) : undefined} page={seoPreviewPage} rating={seoData?.google_rating ?? null} />
          </div>
        ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_50px_-30px_rgba(17,24,39,.45)] dark:border-gray-800 dark:bg-[#151517] lg:sticky lg:top-24">
          <div ref={barRef} className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-[#1c1c1e]">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className={`ml-2 min-w-0 flex-1 truncate rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-all duration-500 ${activeTab === 'domains' ? 'ohp-addr bg-[#C9A24D]/15 text-[#8b7355] ring-2 ring-[#C9A24D] dark:text-[#e8c97a]' : 'bg-white text-gray-400 dark:bg-black/30'}`}>{siteUrl.replace(/^https?:\/\//, '')}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">
              {previewLoading ? <><Loader2 className="h-3 w-3 animate-spin text-[#C9A24D]" /> Updating</> : <>{zoom < 1 && <><Monitor className="h-3 w-3" /> Desktop ·</>}<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live preview</>}
            </span>
          </div>
          <div
            ref={previewRef}
            data-ohp-hfocus={focus.header ? '' : undefined}
            data-ohp-spotting={spot || loaderDemo ? '' : undefined}
            data-template={themeVars.template}
            data-mode={themeVars.mode}
            style={{ ...themeVars.style, ...(focus.header ? { '--ohp-htag': JSON.stringify(focus.header) } : {}), ...(fitH ? { height: fitH } : {}) } as React.CSSProperties}
            className={`${siteFontVariables} ohp-site ohp-prev relative overflow-y-auto ${fitH ? '' : 'max-h-[calc(100vh-9rem)]'}`}
            onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() }}
            // ...and forms (the hero search box) - submitting one used to send the agent off the
            // editor to /search, losing unsaved changes.
            onSubmitCapture={(e) => e.preventDefault()}
          >
            <style>{PREVIEW_FX_CSS}</style>
            <div className="ohp-zoom" style={zoom < 1 ? ({ width: DESKTOP_W, zoom, '--z': zoom } as React.CSSProperties) : undefined}>
              <SiteHeader theme={viewTheme} pages={[homePage]} siteName={homePage.title || site.subdomain_slug} preview hasDarkHero={hasDarkHero} hasReviews={shownReviews} agentProfile={chromeProfile} hasCommunities={areaCount > 0} />
              <SitePageRenderer
                page={{ ...homePage, blocks: liveBlocks }}
                theme={viewTheme}
                siteId={site.id}
                editor={{ focusId: focus.blockId, focusTag: focus.tag }}
                // The live home page always carries the "create your own Showcase" section (after
                // Neighborhoods) - the preview shows it too, so it really is the whole page.
                afterCommunitiesContent={<ShowcaseCreatorCTA theme={viewTheme} basePrefix="" listings={((liveBlocks.find(b => b.type === 'featured_listings')?.data as any)?.resolved || []).filter((l: any) => l?.photo)} agent={user ? { name: [user.first_name, user.last_name].filter(Boolean).join(' '), photo_url: (user as any).profile_photo_url || null } : null} />}
              />
              <SiteFooter theme={viewTheme} siteName={homePage.title || site.subdomain_slug} signatureSlug={signatureSlug} hasReviews={shownReviews} profile={chromeProfile} />
            </div>
            {spot && (
              <div key={spot.key} aria-hidden className="ohp-spot" data-kind={spot.kind} data-fading={spot.fading ? '' : undefined}
                style={spotBox(spot.rect)}>
                <span className="ohp-spot-tag" data-at={spot.rect.height > 100 ? 'in' : spot.rect.top < 48 ? 'below' : 'above'} data-align={spotAlign(spot.rect, previewRef.current?.clientWidth || 0)}>{spot.kind === 'on' ? '✓ ' : ''}{spot.label}</span>
              </div>
            )}
            {loaderDemo && (
              <div key={loaderDemo.key} aria-hidden className="ohp-loader-demo absolute inset-x-0 z-[70] flex flex-col items-center justify-center" style={{ top: loaderDemo.top, height: loaderDemo.height, backgroundColor: 'var(--site-bg)' }}>
                <SiteLoader mark={{ initials: [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase(), logo: viewTheme.loader_logo_url || null }} />
                <span className="ohp-spot-tag" data-at="static">What visitors see while a page loads</span>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

// The width the preview lays the site out at (a real laptop/desktop page), then zooms to fit.
const DESKTOP_W = 1280

type SpotKind = 'on' | 'off' | 'change'
type SpotRect = { top: number; left: number; width: number; height: number }
/** What the preview keeps showing while a "Turning off..." ring plays. */
type SpotHold = { theme?: Partial<SiteTheme>; reviews?: boolean }
type SpotPlan = {
  kind: SpotKind
  label: string
  /** The part of the preview it's about (looked up when needed - the page may still be drawing). */
  find: () => HTMLElement | null
  hold?: SpotHold
  /** After a turn-off: what took its place, ringed in gold. */
  then?: string
  /** Wait for the preview's data to refresh first (homes, areas). */
  refresh?: boolean
  /** It's in the sticky header - always in view, no scrolling. */
  noScroll?: boolean
}
const FONT_NAMES: Record<string, string> = { serif: 'Elegant serif', sans: 'Modern sans', mono: 'Typewriter' }

async function waitUntil<T>(fn: () => T | null | undefined | false, ms: number): Promise<T | null> {
  const end = Date.now() + ms
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() > end) return null
    await wait(80)
  }
}
// A tag on a target near the preview's edge lines up with that edge instead of hanging off it.
function spotAlign(r: SpotRect, boxW: number): 'start' | 'end' | undefined {
  const mid = r.left + r.width / 2
  if (mid < 170) return 'start'
  if (boxW && boxW - mid < 170) return 'end'
  return undefined
}
// Small targets (a menu link, the logo) get a little breathing room; big ones sit just inside.
function spotBox(r: SpotRect): React.CSSProperties {
  const pad = r.height < 90 ? -7 : 6
  return { top: r.top + pad, left: r.left + pad, width: Math.max(0, r.width - pad * 2), height: Math.max(0, r.height - pad * 2) }
}
const FX_EASE = 'cubic-bezier(.65,0,.35,1)'
const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))
