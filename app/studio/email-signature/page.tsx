'use client'

import { OhpWordmark } from '@/components/brand/OhpBrand'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ACCENT_SWATCHES } from '@/lib/accentSwatches'
import { brandColorName, brandSignaturePatch, luxeAllowedFor, modeLabel, useBrandKit } from '@/lib/brandKit'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import api, { API_BASE_URL } from '@/lib/api-service'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import { useOwnDomainBase, agentHubUrl as agentHubLink } from '@/lib/ownDomainLinks'
import { buildDesignPreviewHtml } from '@/lib/signaturePreview'
import { buildSignatureSiteInput } from '@/lib/signatureSiteData'
import SignatureWebCard from '@/components/studio/blogs/SignatureWebCard'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import { epochDayIndex, formatSaleStatus, getEligibleListings, getSalesRotationPool, getSaleSummary } from '@/lib/agentSales'
import DraggableAvatarPhoto from '@/components/agent-hub/DraggableAvatarPhoto'
import { getSocialBrandClass } from '@/components/agent-hub/SocialLinksEditor'
import type { AgentFormConfig } from '@/types'
import {
  BadgeCheck, Check, Copy, ExternalLink, Mail, Palette, Plus, RefreshCw, Sparkles, Trash2, X,
  Image as ImageIcon, User as UserIcon, MousePointerClick, Share2, Loader2, Home, TrendingUp, BarChart3,
  Phone, AtSign, Briefcase, Users, Globe, Instagram, Facebook, Youtube, Music2, Moon, Sun,
} from 'lucide-react'

import {
  DEFAULT_SIGNATURE_CONFIG as DEFAULT_CONFIG, FONT_OPTIONS, FORM_BUTTON_DEFAULTS, FORM_BUTTON_ORDER, LUXE_FONT, MAX_CTA_BUTTONS,
  bustImageCache, fontStackFor, luxeAccentFor, mergeSignatureConfig as mergeConfig, seedSignatureButtons, seedSignatureSocials, staleSignatureFields, withoutFields, wrapRealHtmlForPreview,
  type CtaButton, type SignatureConfig, type SignatureField,
} from '@/lib/signatureConfig'

const SECTIONS: { id: string; label: string; icon: typeof UserIcon; iconClass?: string }[] = [
  { id: 'identity', label: 'Identity', icon: UserIcon },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'buttons', label: 'Buttons', icon: MousePointerClick },
  { id: 'banner', label: 'Banner', icon: ImageIcon },
  { id: 'customize', label: 'Customize', icon: Palette },
]

export default function EmailSignaturePage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<SignatureConfig>(DEFAULT_CONFIG)
  const [hubConfig, setHubConfig] = useState<any>({})
  const [agentHubSlug, setAgentHubSlug] = useState('')
  const [myForms, setMyForms] = useState<AgentFormConfig[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [activeSection, setActiveSection] = useState('identity')
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [copying, setCopying] = useState(false)
  const [installTab, setInstallTab] = useState<'gmail' | 'outlook' | 'outlook_desktop' | 'apple'>('gmail')
  // The ACTUAL install HTML (build_signature_html on the backend), rendered in its own iframe
  // inside the modal so an agent can see exactly what pasting into Gmail will look like without
  // actually pasting into Gmail every time they tweak something - this fetch is the same one
  // copyHtml makes, just also kept around to display rather than only to copy. Loaded fresh each
  // time the modal opens (see openInstallModal) rather than kept in sync with every keystroke -
  // build_signature_html reads the agent's last SAVED config (900ms after an edit, see saveConfig
  // above), so a fetch mid-edit could show stale content anyway.
  const [realHtml, setRealHtml] = useState<string | null>(null)
  // True once the agent has copied their signature at least once AND something baked into that
  // pasted HTML (text, colors, which icons/buttons/blocks show) has changed since - the server
  // compares a fingerprint of the current install HTML against the one recorded at copy time.
  // Photo, sales, stats, listing and every link update in an installed signature on their own, so
  // they never trip this.
  const [needsRecopy, setNeedsRecopy] = useState(false)
  // 'images' only ever comes back for Outlook desktop / Apple Mail installs - the two apps that keep
  // their own copy of the pictures when a signature is pasted (see /me/html on the backend).
  const [recopyReason, setRecopyReason] = useState<'edits' | 'images' | null>(null)
  // False on a dev machine: the copied signature's images/links would point at this computer, which
  // Gmail and recipients' phones can't reach - every picture breaks the moment the email is sent.
  const [publicReady, setPublicReady] = useState(true)
  const [realHtmlLoading, setRealHtmlLoading] = useState(false)
  // The install HTML arrives fast but its banner/stat images are rendered server-side and take a
  // moment - keep the loader up until the frame (images included) has fully loaded.
  const [realFrameReady, setRealFrameReady] = useState(false)
  // The editor box's height is held only while a tab swaps (its panel briefly empties during the
  // animation) - then released, so a shorter tab, or Luxe hiding the font picker, closes up instead
  // of leaving a gap above the preview.
  const [editorMinH, setEditorMinH] = useState(0)
  const editorLastH = useRef(0)
  const editorRoRef = useRef<ResizeObserver | null>(null)
  const editorBoxRef = useCallback((el: HTMLDivElement | null) => {
    editorRoRef.current?.disconnect()
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { editorLastH.current = el.offsetHeight })
    ro.observe(el)
    editorRoRef.current = ro
  }, [])
  useLayoutEffect(() => {
    if (!editorLastH.current) return
    setEditorMinH(editorLastH.current)
    const t = setTimeout(() => setEditorMinH(0), 450)
    return () => clearTimeout(t)
  }, [activeSection])
  const [realHtmlError, setRealHtmlError] = useState(false)
  // Reported by the tiny resize script wrapRealHtmlForPreview injects (see below) - a fixed-height
  // box left a visibly blank strip under any signature shorter than it (no banner/stats), the same
  // "blank window around the card" problem the Live Preview's own dynamic previewHeight already
  // solves above.
  const [realHtmlHeight, setRealHtmlHeight] = useState(200)
  // Which of the two main-screen previews is showing - "site" (the animated CSS/flexbox design,
  // the version this card will eventually appear in on IDX bios/footers elsewhere on
  // OpenHousePal) or "email" (the real install HTML, same as what Copy HTML actually pastes).
  // Both used to live in different places (site version always visible here, email version
  // buried inside the Install modal) - explicit ask was to surface both on the main screen behind
  // one switch instead.
  const [previewMode, setPreviewMode] = useState<'site' | 'email'>('site')
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seededDefaultsRef = useRef(false)
  const [previewHeight, setPreviewHeight] = useState(190)
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const photoPositionSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // While actively dragging the photo, this tracks the in-progress position for the small
  // Customize-tab avatar control ONLY - the big Live Preview below (an iframe whose entire
  // srcDoc gets replaced on every change to hubConfig) deliberately does NOT read this, so
  // dragging feels smooth instead of the whole preview flashing/reloading on every pixel of
  // movement. hubConfig (and the preview it drives) only updates once, when the drag ends - see
  // the DraggableAvatarPhoto usage below.
  const [draftPhotoPosition, setDraftPhotoPosition] = useState<{ x: number; y: number } | null>(null)

  // Drags the SAME Agent Hub photo focal point Settings' own cropper writes (profilePhotoPosition,
  // a % pair) - not a signature-only copy - so fixing the crop here also fixes it everywhere else
  // that photo shows up (Agent Hub, this signature's install HTML), with nothing to re-paste.
  // Called once the drag ENDS (see draftPhotoPosition above) - updates hubConfig (which the Live
  // Preview reads) exactly once per drag instead of on every intermediate pixel, then
  // debounce-saves onto a config fetched fresh right before the write (same guard Settings' own
  // autosave uses), so a stale hubConfig snapshot from page load never clobbers something changed
  // elsewhere since.
  const updatePhotoPosition = (position: { x: number; y: number }) => {
    setDraftPhotoPosition(null)
    setHubConfig((current: any) => ({ ...current, profilePhotoPosition: position }))
    if (photoPositionSaveTimeout.current) clearTimeout(photoPositionSaveTimeout.current)
    photoPositionSaveTimeout.current = setTimeout(async () => {
      const current = await api.agentHub.getMine()
      const currentConfig = (current.success && current.data?.config ? current.data.config : {}) as any
      await api.agentHub.saveConfig({ ...currentConfig, profilePhotoPosition: position })
    }, 700)
  }

  // Switching editor tabs re-triggers the live preview's entrance animation immediately (see the
  // 'signature-preview-replay' listener in signaturePreview.ts) instead of leaving it to wait for
  // its own scheduled 8s replay - makes the tab switch feel connected to what's below it.
  useEffect(() => {
    previewFrameRef.current?.contentWindow?.postMessage({ type: 'signature-preview-replay' }, '*')
  }, [activeSection])

  const ownDomainBase = useOwnDomainBase()
  const agentHubUrl = agentHubSlug ? agentHubLink(ownDomainBase, agentHubSlug) : ''

  // Which of the 5 rail-icon networks (website counts as one, same as Agent Hub's own social rail)
  // actually have a real, enabled link saved in Agent Hub - shared by the live preview and by the
  // Social/Contact tab toggles, which use it to disable a toggle nobody could turn on to anything.
  const socialUrls = useMemo(() => {
    const links: any[] = hubConfig.socialLinks || []
    const result: Record<string, string> = {}
    for (const net of ['website', 'instagram', 'facebook', 'youtube', 'tiktok']) {
      const link = links.find(l => l && l.id === net && l.enabled && String(l.url || '').trim())
      if (link) {
        const url = String(link.url).trim()
        result[net] = url.startsWith('http') ? url : `https://${url}`
      }
    }
    return result
  }, [hubConfig])

  // Self-healing: if a toggle was left on but the underlying value was since removed/cleared in
  // Settings (a social link, or the Team name), turn it off rather than silently rendering
  // something that goes nowhere or shows blank - matches the "can't turn it on without a value"
  // rule the toggle itself enforces going forward.
  // First visit: the socials they already added go on (seedSignatureSocials) - once.
  useEffect(() => {
    if (!loaded) return
    const seeded = seedSignatureSocials(config, hubConfig)
    if (seeded) update(() => seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hubConfig])

  useEffect(() => {
    if (!loaded) return
    const stale = staleSignatureFields(config, hubConfig)
    if (!stale.length) return
    update(current => withoutFields(current, stale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, socialUrls, hubConfig.profile?.team])

  // The preview iframe reports its own real rendered height (signaturePreview.ts's ResizeObserver
  // script) instead of sitting in a fixed-size box - a signature with no banner is a lot shorter
  // than one with a banner + stats column, and a fixed height either wasted space on the short one
  // or risked clipping the tall one.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'signature-preview-height' && typeof e.data.height === 'number') {
        setPreviewHeight(Math.ceil(e.data.height))
      } else if (e.data && e.data.type === 'signature-real-preview-height' && typeof e.data.height === 'number') {
        setRealHtmlHeight(Math.ceil(e.data.height))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    Promise.all([api.emailSignature.getMine(), api.agentHub.getMine(), api.forms.getMine()]).then(([sigRes, hubRes, formsRes]) => {
      if (sigRes.success && sigRes.data) setConfig(mergeConfig(sigRes.data.config))
      if (hubRes.success && hubRes.data) {
        setHubConfig(hubRes.data.config || {})
        setAgentHubSlug(hubRes.data.slug || '')
      }
      if (formsRes.success && formsRes.data) setMyForms(formsRes.data)
      setLoaded(true)
    })
  }, [])

  // Smart default: once the agent's premade forms are known and they haven't added any buttons
  // yet, seed the two most useful ones instead of leaving the block empty - same "reuse what we
  // already know" philosophy as the field toggles. "My Agent Hub" itself is NOT seeded here - it's
  // always rendered automatically as the first, solid-filled action pill (see the backend's
  // _action_row_html), so seeding it again here would just duplicate it.
  useEffect(() => {
    if (!loaded || seededDefaultsRef.current || !myForms.length) return
    if (config.ctaButtons.length > 0) { seededDefaultsRef.current = true; return }
    seededDefaultsRef.current = true
    const buttons: CtaButton[] = seedSignatureButtons(myForms)
    if (buttons.length) setConfig(current => ({ ...current, ctaButtons: buttons }))
  }, [loaded, myForms, config.ctaButtons.length])

  const refreshRecopyState = async () => {
    const res = await api.emailSignature.getHtml()
    if (res.success && res.data) {
      setNeedsRecopy(Boolean(res.data.needs_recopy))
      setRecopyReason(res.data.recopy_reason)
      setPublicReady(res.data.public_ready !== false)
    }
  }

  const saveConfig = (next: SignatureConfig) => {
    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const res = await api.emailSignature.saveConfig(next)
      if (res.success) {
        setSaveStatus('saved')
        // The Site Version preview updates itself for free (previewHtml is a useMemo off config,
        // no fetch involved) - the Email Version is real server-rendered HTML though, so it needs
        // an actual re-fetch after each save to "auto refresh... like the site version" (explicit
        // ask). Only bothers when that tab is the one showing, not on every edit regardless.
        if (previewMode === 'email') loadRealPreview()
        else refreshRecopyState()
      }
    }, 900)
  }

  const update = (updater: (current: SignatureConfig) => SignatureConfig) => {
    setConfig(current => {
      const next = updater(current)
      saveConfig(next)
      return next
    })
  }
  // "My Brand Kit" (default for a new signature) or "Choose my own" - lib/brandKit. Any look pick
  // below (color, Luxe, finish, Ivory / Midnight) makes it the signature's own.
  const brandKit = useBrandKit()
  const sigLuxeAllowed = luxeAllowedFor(user)
  const followsBrand = config.lookSource === 'brand'
  const applyBrandLook = () => update(current => ({ ...current, ...brandSignaturePatch(brandKit.look, sigLuxeAllowed) }))
  const updateLook = (updater: (current: SignatureConfig) => SignatureConfig) => update(current => ({ ...updater(current), lookSource: 'own' }))

  const fmtMoney = (value?: number) => (value ? `$${Math.round(value).toLocaleString()}` : '')

  // Same M/K/B convention as _fmt_compact_money in email_signature_service.py - $17,240,000
  // becomes "$17.24M", $1,230,000,000 becomes "$1.23B" (added, explicit ask - a total crossing a
  // billion used to just keep counting in M, e.g. "$1234.57M"). Used only for the Stats rail's
  // Volume/Avg figures (see `stats` below): that column is a fixed 88px pill, and full-precision
  // fmtMoney() (built for the wider listing-price display) runs any 7-figure volume - which is
  // most agents - straight past its edge. "Sold" stays a plain integer, never this.
  const fmtCompactMoney = (value?: number) => {
    if (!value) return '$0'
    if (value >= 1_000_000_000) {
      const b = value / 1_000_000_000
      const rounded = b === Math.trunc(b) ? b : Math.round(b * 100) / 100
      return `$${rounded}B`
    }
    if (value >= 1_000_000) {
      const m = value / 1_000_000
      const rounded = m === Math.trunc(m) ? m : Math.round(m * 100) / 100
      return `$${rounded}M`
    }
    if (value >= 1_000) return `$${Math.round(value / 1000)}K`
    return `$${Math.round(value).toLocaleString()}`
  }

  // The single place that turns the current form state (config + hubConfig + myForms) into the
  // props buildDesignPreviewHtml needs - shared by the Live Preview (interactive:true, the
  // in-app iframe) and by copyHtml (interactive:false, what actually goes on the clipboard), so
  // there's exactly one computation of "what does the signature actually contain" and the two can
  // never disagree about content, only about the interactive-only extras (see signaturePreview.ts).
  const previewData = useMemo(() => {
    // Shared with the public card that closes every blog article (lib/signatureSiteData).
    const { identity, socials, buttons, listing, saleCards, listingHref, salesHref, stats, rotation, salesRecent } = buildSignatureSiteInput({
      config, hubConfig, agentHubSlug, ownerId: user?.id, forms: myForms,
      fallbackName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), fallbackPhoto: user?.photo_url || '',
    })
    return { identity, socials, buttons, listing, saleCards, listingHref, salesHref, stats, rotation, salesRecent }
  }, [config, hubConfig, agentHubSlug, user, myForms])

  // The Live Preview is the actual downloaded design (real CSS animations, real flexbox, the
  // exact classes from animated-email-signature-design/app/globals.css - see lib/
  // signaturePreview.ts) computed client-side from the current form state, not fetched from the
  // server - it updates instantly on every edit instead of waiting on a network round-trip, and
  // it's visually exact because it runs in a real browser (this iframe) instead of being
  // translated into email-safe HTML first.
  //
  // "Copy HTML" does NOT copy this markup, on purpose - Gmail/Outlook/Apple Mail's signature
  // boxes strip <style> blocks on paste, which is where every keyframe, ::before/::after
  // pseudo-element (the halo glow, the "Stats" label, the divider line) and hover state here
  // lives, and none of them survive. It instead fetches build_signature_html() from the backend
  // (email_signature_service.py, via api.emailSignature.getHtml() - see copyHtml below), a
  // table-based, fully inline-styled translation of this SAME design that pre-bakes the fancy
  // parts (photo halo, Save Contact bar, listing card) as server-rendered GIF/JPEG images instead
  // of CSS effects, so it actually survives a real paste. That backend HTML also fetches the
  // photo/listing/badge images live by URL every time the installed signature is VIEWED, not just
  // once at copy time - so a new sale, a new listing, or a changed accent color shows up with no
  // re-copy-paste ever required, which this client-rendered preview can't do on its own.
  // The Site Version preview (10/24): the very card websites now show (SignatureWebCard - Guest
  // Pass, CMA, Spotlight, IDX, blogs), built from the same form state. The EMAIL version below is
  // untouched and still comes from the backend's install HTML.
  const siteInput = useMemo(() => buildSignatureSiteInput({
    config, hubConfig, agentHubSlug, ownerId: user?.id, forms: myForms,
    fallbackName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), fallbackPhoto: user?.photo_url || '',
  }), [config, hubConfig, agentHubSlug, user, myForms])

  const previewHtml = useMemo(() => buildDesignPreviewHtml({
    ...previewData,
    accent: config.luxe ? luxeAccentFor(config.luxeMetal) : config.accentColor, fontFamily: fontStackFor(config.luxe ? LUXE_FONT : config.fontFamily), dark: config.darkMode, luxe: config.luxe, metal: config.luxeMetal,
  }), [previewData, config.accentColor, config.fontFamily, config.darkMode, config.luxe, config.luxeMetal])

  const updateField = (key: string, updates: Partial<SignatureField>) => {
    update(current => ({ ...current, fields: { ...current.fields, [key]: { ...current.fields[key], ...updates } } }))
  }

  const updateCtaButton = (id: string, updates: Partial<CtaButton>) => {
    update(current => ({ ...current, ctaButtons: current.ctaButtons.map(b => b.id === id ? { ...b, ...updates } : b) }))
  }

  const addCtaButton = (label: string, url: string, formType?: string) => {
    if (config.ctaButtons.length >= MAX_CTA_BUTTONS) return
    update(current => ({ ...current, ctaButtons: [...current.ctaButtons, { id: `cta-${Date.now()}`, label, formType, url, enabled: true }] }))
  }

  const removeCtaButton = (id: string) => {
    update(current => ({ ...current, ctaButtons: current.ctaButtons.filter(b => b.id !== id) }))
  }

  const updateBanner = (updates: Partial<SignatureConfig['banner']>) => {
    update(current => ({ ...current, banner: { ...current.banner, ...updates } }))
  }

  const loadRealPreview = async () => {
    setRealHtmlError(false)
    setRealHtmlLoading(true)
    try {
      const res = await api.emailSignature.getHtml()
      if (!res.success || !res.data?.html) throw new Error('signature html fetch failed')
      setNeedsRecopy(Boolean(res.data.needs_recopy))
      setRecopyReason(res.data.recopy_reason)
      setRealFrameReady(false)
      setRealHtml(wrapRealHtmlForPreview(bustImageCache(res.data.html)))
    } catch {
      setRealHtmlError(true)
    } finally {
      setRealHtmlLoading(false)
    }
  }

  // Fetches the real install HTML the first time the main-screen switch flips to "Email Version" -
  // loaded && !realHtml && !realHtmlLoading guards against re-fetching on every re-render while
  // the switch stays on "email" (the saveConfig success handler above covers refreshing it again
  // after that first load, on every subsequent edit).
  useEffect(() => {
    if (previewMode === 'email' && loaded && !realHtml && !realHtmlLoading) loadRealPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, loaded])

  // No longer also loads the real-HTML preview here - that preview used to live inside this modal
  // too (redundant "Actual Install Preview" section, removed) now that the main screen's Email
  // Version switch covers the exact same thing (explicit ask: "remove the preview in the install
  // signature button").
  useEffect(() => {
    if (loaded) refreshRecopyState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const openInstallModal = () => {
    setShowInstallModal(true)
  }

  // Gmail's (and Outlook web's, and Apple Mail's) signature box is a rich-text editor, not an
  // HTML-source field - pasting into it only renders as an actual formatted signature if the
  // clipboard itself carries real HTML data (the same thing that happens when you select and copy
  // formatted text off any webpage). writeText() alone puts the HTML markup on the clipboard as
  // PLAIN text, so pasting it just inserted the literal "<table role=..." source as visible text
  // - it never rendered. write() with a ClipboardItem carrying a text/html blob (plus a text/plain
  // fallback for editors that only accept plain text) is what makes a normal Ctrl/Cmd+V paste
  // reproduce the actual rendered look, matching how "copy this rendered content" already works
  // anywhere else on the web.
  //
  // Fetched fresh from the backend on every click rather than cached/precomputed client-side -
  // build_signature_html() reads the agent's saved EmailSignature.config (900ms after the last
  // edit, see saveConfig above), so a click right after a fast edit still gets the current state
  // instead of whatever was true when the modal first opened.
  const copyHtml = async () => {
    setCopyError(false)
    setCopying(true)
    try {
      const res = await api.emailSignature.getHtml()
      if (!res.success || !res.data?.html) throw new Error('signature html fetch failed')
      const html = res.data.html
      const htmlHash = res.data.html_hash
      const assetsHash = res.data.assets_hash
      setPublicReady(res.data.public_ready !== false)
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(html)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      // Record what was just copied (and into which app - the open install tab), so later edits
      // that need a re-paste can be flagged.
      if (htmlHash) {
        api.emailSignature.markInstalled(htmlHash, assetsHash, installTab).then(r => { if (r.success) { setNeedsRecopy(false); setRecopyReason(null) } })
      }
    } catch {
      setCopyError(true)
    } finally {
      setCopying(false)
    }
  }

  const shownListings = getEligibleListings(hubConfig.myListings || []).filter(l => l.visible !== false)
  const hasListings = shownListings.length > 0
  const hasSales = (hubConfig.recentSales || []).length > 0
  const hasAnyListingContent = hasListings || hasSales

  return (
    <AuthGuard>
      <SubscriptionGuard requireEmailSignatureAccess>
        <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
          <div className="mx-auto max-w-5xl px-4 py-4 sm:py-8">
            <PageHeader
              icon={Mail}
              backHref="/studio"
              backLabel="Tools"
              kicker="Signature"
              title={<>Your brand, <em>in every email</em></>}
              subtitle="Your branding in your email, on your site, and everywhere you show up - built once, always in sync."
              subtitleClassName="max-w-none lg:whitespace-nowrap"
              asideClassName="w-full lg:w-auto lg:self-start lg:-mt-5"
              tabs={needsRecopy ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 dark:border-red-500/30 dark:bg-red-500/10"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" /></span>
                  <p className="min-w-0 flex-1 text-xs font-semibold text-red-900/80 dark:text-red-100/80">
                    {recopyReason === 'images' ? (
                      <><span className="font-black text-red-700 dark:text-red-300">Re-copy to show your new photo, listing or sales.</span> Outlook desktop and Apple Mail keep their own copy of your signature&apos;s pictures when you paste it.</>
                    ) : (
                      <><span className="font-black text-red-700 dark:text-red-300">Re-copy to apply your latest edits.</span> Text, colors and which icons or buttons show live inside the signature you pasted - photo, sales, stats and links already update on their own.</>
                    )}
                  </p>
                  <button
                    onClick={openInstallModal}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-sm shadow-red-600/30 transition hover:-translate-y-0.5 hover:bg-red-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-copy
                  </button>
                </motion.div>
              ) : undefined}
              actions={
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400">
                    {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                  </span>
                  <button
                    onClick={openInstallModal}
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-xs uppercase tracking-wide font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative">Install Signature</span>
                  </button>
                </div>
              }
            />

            {/* Only shown when it's actually true (server-side fingerprint of the install HTML vs.
                the one recorded at the last copy) - most edits never trip it, since the photo,
                sales, stats, listing and every link update in an installed signature by themselves. */}

            {/* Controls - the editor panel is the exact same box the Live Preview below uses:
                max-w-3xl, mx-auto, full width, untouched by the rail at all. The rail is
                POSITIONED (absolute, hung off the panel's own left edge), not laid out inline
                next to the panel - an inline rail-beside-panel row (either "add width for the
                rail" or "share the same total width with the rail") always ends up moving the
                PANEL's own visual center away from the page's true center, which is what read as
                "off to the right" - the panel is the dominant visual mass, so ITS center is what
                has to land exactly on the Live Preview's center, not the combined rail+panel
                block's center. Always positioned this way (no responsive hide/show swapping back
                to a different layout) so there's only one version to reason about. */}
            <div className="mx-auto max-w-3xl">
              <div className="relative" style={{ minHeight: editorMinH || undefined }}>
                <nav className="absolute right-full top-0 mr-3 w-36">
                  <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                    {SECTIONS.map(s => {
                      const active = activeSection === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveSection(s.id)}
                          className={`group relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition-colors duration-200 ${active ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}
                        >
                          {active && (
                            <motion.span
                              layoutId="signature-tab-active"
                              className="absolute inset-0 rounded-xl bg-[#111827] shadow-sm dark:bg-white"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            />
                          )}
                          <span className="relative flex min-w-0 items-center gap-2">
                            <s.icon className={`ohp-icon-draw ${s.iconClass || ''} h-4 w-4 shrink-0`} strokeWidth={2.4} />
                            <span className="min-w-0 truncate">{s.label}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </nav>

                  <div ref={editorBoxRef} className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]">
                  <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="p-4"
                  >
                    {activeSection === 'identity' && (
                      <div className="space-y-4">
                        <EditElsewhereNote href="/settings#profile" text="Headshot, name, title, brokerage, team, phone & email come from your Profile in Settings." />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <FieldToggle icon={UserIcon} label="Headshot" field={config.fields.headshot} onChange={(u) => updateField('headshot', u)} />
                          <FieldToggle icon={UserIcon} label="Name" field={config.fields.name} onChange={(u) => updateField('name', u)} />
                          <FieldToggle icon={Briefcase} label="Job Title" field={config.fields.title} onChange={(u) => updateField('title', u)} />
                          <FieldToggle icon={Briefcase} label="Brokerage" field={config.fields.company} onChange={(u) => updateField('company', u)} />
                          <FieldToggle
                            icon={Users}
                            label="Team"
                            field={config.fields.team}
                            onChange={(u) => updateField('team', u)}
                            disabledHint={String(hubConfig.profile?.team || '').trim() ? undefined : 'Add your team name in Settings to enable this.'}
                            disabledHref="/settings#profile"
                          />
                          <FieldToggle icon={Phone} label="Phone" field={config.fields.phone} onChange={(u) => updateField('phone', u)} />
                          <FieldToggle icon={AtSign} label="Email" field={config.fields.email} onChange={(u) => updateField('email', u)} />
                          <FieldToggle icon={Home} label="Agent Hub link" field={config.fields.agentHubUrl} onChange={(u) => updateField('agentHubUrl', u)} />
                        </div>
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#3B82F6]">
                            <BadgeCheck className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Verified badge</p>
                            <p className="text-[11px] font-semibold text-gray-400">Small blue checkmark next to your name - a design accent, not a real verification.</p>
                          </div>
                          <button
                            onClick={() => update(current => ({ ...current, showVerifiedBadge: !current.showVerifiedBadge }))}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition ${config.showVerifiedBadge ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                            aria-label={`${config.showVerifiedBadge ? 'Remove' : 'Add'} verified badge`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${config.showVerifiedBadge ? 'left-4 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeSection === 'social' && (
                      <div className="space-y-4">
                        <EditElsewhereNote href="/settings#profile" text="Add or edit your links under Social Links in Settings - toggle here which ones show on the signature. A link with nothing filled in can't be turned on." />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {([
                            ['website', 'Website', Globe],
                            ['instagram', 'Instagram', Instagram],
                            ['facebook', 'Facebook', Facebook],
                            ['youtube', 'YouTube', Youtube],
                            ['tiktok', 'TikTok', Music2],
                          ] as const).map(([net, label, icon]) => (
                            <FieldToggle
                              key={net}
                              icon={icon}
                              iconColorClass={getSocialBrandClass(net)}
                              label={label}
                              field={config.fields[net]}
                              onChange={(u) => updateField(net, u)}
                              disabledHint={socialUrls[net] ? undefined : `Add your ${label} link in Settings to enable this.`}
                              disabledHref="/settings#profile"
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-semibold text-gray-400">Icons pop in gently when the signature loads, then hold in place.</p>
                      </div>
                    )}

                    {activeSection === 'buttons' && (
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold text-gray-400">
                          &quot;My Agent Hub&quot; always leads - pick up to {MAX_CTA_BUTTONS} more from your real Agent Hub forms. Each one opens and works exactly like clicking that form on your Agent Hub, and always points at the current version even if you rename it later.
                        </p>
                        <div className="space-y-2">
                          {config.ctaButtons.map(button => (
                            <div key={button.id} className={`flex items-center gap-3 rounded-xl border p-3 transition ${button.enabled ? 'border-[#C9A24D]/50 bg-[#fbfaf7] dark:bg-white/5' : 'border-gray-200 dark:border-gray-700'}`}>
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${button.enabled ? 'bg-[#C9A24D]/15 text-[#8b7355]' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                                <MousePointerClick className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <select
                                  value={button.formType}
                                  onChange={(e) => {
                                    const f = myForms.find(x => x.form_type === e.target.value)
                                    updateCtaButton(button.id, { formType: e.target.value, label: FORM_BUTTON_DEFAULTS[e.target.value] || f?.title || button.label })
                                  }}
                                  className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                                >
                                  {FORM_BUTTON_ORDER
                                    .map(formType => myForms.find(f => f.form_type === formType))
                                    .filter((f): f is AgentFormConfig => Boolean(f))
                                    .map(f => (
                                      <option key={f.form_type} value={f.form_type}>{FORM_BUTTON_DEFAULTS[f.form_type] || f.title}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-[10px] font-semibold text-gray-400">Linked to: {myForms.find(f => f.form_type === button.formType)?.title}</p>
                              </div>
                              <button
                                onClick={() => updateCtaButton(button.id, { enabled: !button.enabled })}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition ${button.enabled ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                              >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${button.enabled ? 'left-4 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                              </button>
                              <button onClick={() => removeCtaButton(button.id)} className="shrink-0 text-gray-300 hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {config.ctaButtons.length < MAX_CTA_BUTTONS && (
                          <div className="flex flex-wrap gap-1.5">
                            {FORM_BUTTON_ORDER
                              .map(formType => myForms.find(f => f.form_type === formType))
                              .filter((f): f is AgentFormConfig => Boolean(f) && !config.ctaButtons.some(b => b.formType === f!.form_type))
                              .map(f => (
                                <QuickAddChip
                                  key={f.form_type}
                                  label={FORM_BUTTON_DEFAULTS[f.form_type] || f.title}
                                  onClick={() => addCtaButton(FORM_BUTTON_DEFAULTS[f.form_type] || f.title, '', f.form_type)}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeSection === 'banner' && (
                      <div className="space-y-3">
                        <EditElsewhereNote
                          inline
                          text="Listings & sales sync from the MLS - manage them in Settings."
                          links={[{ href: '/settings#listings', label: 'Listings' }, { href: '/settings#recent-sales', label: 'Recent Sales' }]}
                        />
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-[#fbfaf7] p-2.5 dark:bg-[#0B0B0B]">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Show my listings &amp; sales</span>
                          <button
                            onClick={() => update(current => ({ ...current, blockVisibility: { banner: !current.blockVisibility.banner } }))}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition ${config.blockVisibility.banner ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                            aria-label={`${config.blockVisibility.banner ? 'Turn off' : 'Turn on'} listings and sales`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${config.blockVisibility.banner ? 'left-4 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                          </button>
                        </div>
                        {config.blockVisibility.banner && (
                          <>
                            {!hasAnyListingContent && !config.banner.showStats && (
                              <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                                Add a listing or recent sale in Settings first - the banner needs at least one to show.
                              </p>
                            )}
                            <div>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Show</p>
                              <div className="space-y-2">
                                <BannerShowRow
                                  icon={Home}
                                  label="Featured listing"
                                  hint={hasListings ? 'Most recent listings, photo + price + specs' : 'No active listings yet'}
                                  checked={config.banner.showFeaturedListing}
                                  onChange={(v) => updateBanner({ showFeaturedListing: v })}
                                />
                                <BannerShowRow
                                  icon={TrendingUp}
                                  label="Recent sales"
                                  hint={hasSales ? 'One or two show like a featured listing (two take turns); three or more show side by side' : 'No recent sales yet'}
                                  checked={config.banner.showRecentSales}
                                  onChange={(v) => updateBanner({ showRecentSales: v })}
                                />
                              </div>
                              <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                {config.banner.showFeaturedListing && config.banner.showRecentSales
                                  ? "Smart: shows your active listing when you have one, and falls back to recent sales when you don't."
                                  : 'Automatically rotates to a different listing/sale each day.'}
                              </p>
                              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                                <RefreshCw className="mt-px h-3.5 w-3.5 shrink-0" />
                                <span><span className="font-black">Updates on its own.</span> New listings, sales, stats and your photo show up in the signature you already pasted - no need to re-copy it. If your email app ever needs a re-copy, we&apos;ll tell you right here.</span>
                              </p>
                            </div>
                          </>
                        )}
                        {/* Its own switch - stats show with listings & sales off too (as a slim strip). */}
                        <BannerShowRow
                          icon={BarChart3}
                          label="My stats"
                          hint={config.blockVisibility.banner ? 'Volume / Closed / Avg Price, on the right edge of the card' : 'Volume / Closed / Avg Price, as a slim strip under your name'}
                          checked={config.banner.showStats}
                          onChange={(v) => updateBanner({ showStats: v })}
                        />
                      </div>
                    )}

                    {activeSection === 'customize' && (
                      <div className="space-y-5">
                        <div>
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Look</p>
                          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where the look comes from">
                            {([['brand', 'My Brand Kit', `${brandKit.look.theme === 'luxe' && sigLuxeAllowed ? `Luxe · ${LUXE_METALS[brandKit.look.metal].label}` : `Classic · ${brandColorName(brandKit.look.accent) || 'Custom color'}`} · ${modeLabel(brandKit.look.dark)}`], ['own', 'Choose my own', 'Pick a color, Luxe and Ivory or Midnight below.']] as const).map(([id, name, blurb]) => {
                              const on = (id === 'brand') === followsBrand
                              return (
                                <button key={id} type="button" role="radio" aria-checked={on} data-testid={`sig-look-${id}`}
                                  onClick={() => (id === 'brand' ? applyBrandLook() : !followsBrand ? undefined : update(current => ({ ...current, lookSource: 'own' })))}
                                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-gray-700'}`}>
                                  <span className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">{id === 'brand' ? <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" /> : <Palette className="h-3.5 w-3.5 text-gray-400" />}{name}{on && <Check className="ml-auto h-4 w-4 text-[#C9A24D]" />}</span>
                                  <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{blurb}</span>
                                </button>
                              )
                            })}
                          </div>
                          {followsBrand && <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Follows your <Link href="/studio/brand-kit" className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#e8c97a]">Branding</Link> - change it there and this changes too. Picking anything below makes it this signature&apos;s own.</p>}
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                        {config.luxe ? (
                          <motion.div key="metal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-400">
                              <Palette className="h-3.5 w-3.5" /> Luxe finish <span className="normal-case tracking-normal text-gray-400">- same Luxe look, your metal</span>
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {LUXE_METAL_ORDER.map(m => {
                                const mp = LUXE_METALS[m]
                                const on = config.luxeMetal === m
                                return (
                                  <motion.button key={m} type="button" whileTap={{ scale: 0.95 }} onClick={() => updateLook(current => ({ ...current, luxeMetal: m }))}
                                    className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${on ? 'shadow-[0_10px_24px_-14px_rgba(0,0,0,.45)]' : 'border-gray-200 dark:border-gray-700'}`}
                                    style={on ? { borderColor: mp.base } : undefined}>
                                    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${mp.deep}, ${mp.base} 40%, ${mp.pale} 55%, ${mp.light} 70%, ${mp.deep})` }}>
                                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                                    </span>
                                    <span className="text-xs font-black text-[#111827] dark:text-white">{mp.label}</span>
                                    {on && <motion.span layoutId="sig-metal-check" className="ml-auto flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: mp.base }}><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></motion.span>}
                                  </motion.button>
                                )
                              })}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="accent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-400">
                              <Palette className="h-3.5 w-3.5" /> Accent Color
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {ACCENT_SWATCHES.map((swatch, i) =>
                                'divider' in swatch ? (
                                  <span key={`divider-${i}`} className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                                ) : (
                                  <button
                                    key={swatch.color}
                                    onClick={() => updateLook(current => ({ ...current, accentColor: swatch.color }))}
                                    className={`h-8 w-8 shrink-0 rounded-full border-2 ring-1 ring-inset ring-black/10 transition hover:-translate-y-0.5 hover:scale-110 active:scale-95 ${config.accentColor === swatch.color ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                                    style={{ backgroundColor: swatch.color }}
                                    title={swatch.label}
                                    aria-label={swatch.label}
                                  />
                                )
                              )}
                            </div>
                          </motion.div>
                        )}
                        </AnimatePresence>
                        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Photo &amp; Theme</p>
                          {/* Two centered columns instead of one left-to-right row with the caption
                              trailing below everything - the photo control and its own caption read
                              as one unit on the left, Light/Dark and ITS caption as one unit on the
                              right, rather than a single paragraph that used to describe both halves
                              at once from underneath. */}
                          <div className="flex items-start gap-4">
                            <div className="flex flex-[0.7] flex-col items-center gap-2 text-center">
                              {(hubConfig.profilePhotoUrl || user?.photo_url) && (
                                <DraggableAvatarPhoto
                                  url={hubConfig.profilePhotoUrl || user?.photo_url}
                                  position={draftPhotoPosition ?? hubConfig.profilePhotoPosition}
                                  onPositionChange={setDraftPhotoPosition}
                                  onDragEnd={updatePhotoPosition}
                                  ringColor={config.luxe ? luxeAccentFor(config.luxeMetal) : config.accentColor}
                                  size={56}
                                />
                              )}
                              <p className="text-[11px] font-semibold text-gray-400">Drag your photo to fix a tight crop.</p>
                            </div>
                            <span className="mt-2 h-16 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                            <div className="flex flex-1 flex-col items-center gap-2 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-2 xl:flex-nowrap">
                                <ThemeSwatchButton
                                  label="Ivory"
                                  icon={Sun}
                                  active={!config.darkMode}
                                  onClick={() => updateLook(current => ({ ...current, darkMode: false }))}
                                  preview={config.luxe ? 'linear-gradient(135deg, #fffdf8 0%, #f4ead7 100%)' : 'linear-gradient(135deg, #fffdfa 0%, #f6f2eb 100%)'}
                                  previewText="#171817"
                                />
                                <ThemeSwatchButton
                                  label="Midnight"
                                  icon={Moon}
                                  active={config.darkMode}
                                  onClick={() => updateLook(current => ({ ...current, darkMode: true }))}
                                  preview={config.luxe ? 'linear-gradient(135deg, #111827 0%, #2a2218 100%)' : 'linear-gradient(135deg, #1B1D22 0%, #0D0E11 100%)'}
                                  previewText="#F4F2EC"
                                />
                              </div>
                              <p className="text-[11px] font-semibold text-gray-400">Applies everywhere instantly, nothing to re-paste.</p>
                            </div>
                            <span className="mt-2 h-16 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                            {/* OpenHousePal Luxe premade theme - compact, beside Light/Dark. */}
                            <button
                              type="button"
                              onClick={() => updateLook(current => ({ ...current, luxe: !current.luxe }))}
                              aria-pressed={config.luxe}
                              title="Gold, serif and the Spotlight's light - ivory or midnight. Turn off to style it yourself."
                              className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 self-stretch overflow-hidden rounded-xl border px-2.5 py-2 text-center transition-all duration-300 active:scale-[0.97] ${config.luxe ? 'border-[#C9A24D] shadow-[0_12px_28px_-18px_rgba(201,162,77,.95)]' : 'border-[#C9A24D]/35 hover:border-[#C9A24D]/70'}`}
                              style={{ background: config.luxe ? 'radial-gradient(120% 140% at 100% 0%, rgba(201,162,77,.32), transparent 55%), linear-gradient(135deg,#111827 0%,#1b1a17 55%,#2a2218 100%)' : 'radial-gradient(120% 140% at 100% 0%, rgba(201,162,77,.2), transparent 55%), linear-gradient(135deg,#fffdf8 0%,#fbf6ec 55%,#f4ead7 100%)' }}
                            >
                              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
                              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-1000 group-hover:translate-x-[400%]" />
                              <span className={`relative text-[9px] font-black uppercase tracking-[0.24em] ${config.luxe ? 'text-[#e8c97a]' : 'text-[#8b7355]'}`}>Premade theme</span>
                              <span className="relative flex items-center gap-2">
                                <span className={`flex items-center gap-1.5 whitespace-nowrap font-serif text-[15px] font-black leading-none ${config.luxe ? 'text-white' : 'text-[#111827]'}`}>
                                  <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" /><OhpWordmark className="text-[15px]" /> <em className="font-light text-[#C9A24D]">Luxe</em>
                                </span>
                                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${config.luxe ? 'bg-[#C9A24D]' : 'bg-gray-300'}`}>
                                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${config.luxe ? 'left-[18px]' : 'left-0.5'}`} />
                                </span>
                              </span>
                            </button>
                          </div>
                        </div>
                        {!config.luxe && (
                        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Font</p>
                          {/* One row for all 4 - a 2x2 grid was pushing this control to roughly twice
                              the height every other row on this tab takes for a single choice. Just
                              the label (no "Aa Bb Cc" sample line) is what actually fits 4 across. */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {FONT_OPTIONS.map(f => (
                              <button
                                key={f.id}
                                onClick={() => update(current => ({ ...current, fontFamily: f.id }))}
                                title={f.label}
                                className={`truncate rounded-lg border px-1.5 py-2.5 text-center text-[11px] font-bold transition ${config.fontFamily === f.id ? 'border-[#111827] bg-[#fbfaf7] text-[#111827] dark:border-white dark:bg-white/5 dark:text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'}`}
                                style={{ fontFamily: f.stack }}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1.5 text-[11px] font-semibold text-gray-400">Email-safe fonts only - every option here renders correctly in Gmail and Outlook, unlike a custom web font (which they'd both strip anyway).</p>
                        </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                  </AnimatePresence>
                  </div>
              </div>
            </div>

            {/* A visible break between the editor and the preview below it, now with the Site/
                Email switch built into the same divider instead of a plain "Live Preview" label -
                both versions live on the main screen now (the email version used to only show up
                buried inside the Install modal below), explicit ask. */}
            <div className="mx-auto mt-4 flex max-w-3xl items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-gray-200 dark:via-gray-800 dark:to-gray-800" />
              <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 p-0.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
                {([['site', Sparkles, 'Site Version'], ['email', Mail, 'Email Version']] as const).map(([mode, ModeIcon, label]) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`group relative flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-300 ${previewMode === mode ? 'text-white' : 'opacity-60 hover:opacity-100'}`}
                  >
                    {/* Same shared-layout sliding pill the editor rail above uses (signature-tab-active) -
                        explicit ask: switching versions should be "a smooth graphic animation
                        transition", not an instant color swap. */}
                    {previewMode === mode && (
                      <motion.span layoutId="signature-preview-mode" className="absolute inset-0 rounded-full bg-[#C9A24D]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                    )}
                    <span className="relative flex items-center gap-1.5"><ModeIcon className="ohp-icon-draw h-3 w-3" /> {label}</span>
                  </button>
                ))}
              </div>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 to-gray-200 dark:via-gray-800 dark:to-gray-800" />
            </div>
            {/* Plain-language explanations, not the old dev-facing one ("no CSS animation,
                gradients, or flexbox survive a real inbox") - explicit ask: written for an agent,
                not an engineer, and should actually explain why the two look/move differently
                instead of leaving that as a surprise. */}
            <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={previewMode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-gray-400"
            >
              {previewMode === 'site'
                ? "Exactly how your card shows on your web pages - the Guest Pass, CMAs, Spotlights, your IDX site and blogs. Built for websites: big buttons, stacked on phones."
                : "Exactly what gets pasted into Gmail, Outlook, or Apple Mail. Email inboxes can't run the same animations a webpage can, so this version is calmer and settles in place - that's normal, not a bug."}
            </motion.p>
            </AnimatePresence>

            {/* Just the signature itself, either version - no bordered/padded/shadowed "browser
                window" card wrapping it any more (explicit ask: "don't have room outside of the
                render... blank page in background... only wan[t] to see the entire signature").
                Both iframe documents set their own body background to transparent, so the card
                floats directly on this page's own background instead of a separate white/dark
                rectangle behind it. */}
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={previewMode}
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-4 max-w-3xl"
            >
              {previewMode === 'site' && (
                // Exactly what websites show (SignatureWebCard). followPage off: the app's own dark
                // mode doesn't recolour it - only the agent's dark setting does (on a dark website
                // it follows that page).
                <div className="min-w-0">
                  <SignatureWebCard input={siteInput} formPaths={[]} followPage={false} onForm={url => window.open(url, '_blank', 'noopener')} />
                </div>
              )}
              {previewMode === 'email' && (
                <>
                  {/* realHtmlLoading alone (not realHtmlLoading && !realHtml) - explicit ask: "dont
                      show the signature at all as it slowly loads every time" - a refresh after an
                      edit used to leave the OLD signature sitting there while images silently
                      swapped out underneath it one at a time, which read as broken/flickery, not
                      "loading". This now fully hides whatever's already loaded and shows a single
                      clean loading state instead, every time a fetch is in flight - first load or
                      refresh, no difference. */}
                  {!realHtmlError && (realHtmlLoading || !realHtml || !realFrameReady) && (
                    <div className="flex h-44 flex-col items-center justify-center gap-4">
                      <span className="relative grid h-14 w-14 place-items-center">
                        <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#C9A24D]/15 border-t-[#C9A24D] [animation-duration:1.1s]" />
                        <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-[#e8c97a]/70 [animation-direction:reverse] [animation-duration:1.6s]" />
                        <Mail className="h-5 w-5 text-[#C9A24D]" />
                      </span>
                      <div className="text-center">
                        <p className="font-serif text-sm font-black text-[#111827] dark:text-white">Building your email version</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Exactly what Gmail and Outlook will show</p>
                      </div>
                    </div>
                  )}
                  {!realHtmlLoading && realHtmlError && (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-[11px] font-semibold text-red-500">
                      Couldn&apos;t load the install preview - check your connection and try again.
                      <button onClick={loadRealPreview} className="text-gray-500 underline">Retry</button>
                    </div>
                  )}
                  {!realHtmlLoading && realHtml && (
                    <iframe
                      title="Actual install HTML preview"
                      srcDoc={realHtml}
                      onLoad={() => setRealFrameReady(true)}
                      style={{ height: realFrameReady ? realHtmlHeight : 0, colorScheme: 'light' }}
                      className={`w-full border-0 bg-transparent transition-[height,opacity] duration-300 ${realFrameReady ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                      sandbox="allow-scripts"
                    />
                  )}
                </>
              )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInstallModal(false)}>
            {/* max-w-3xl - matches the Live Preview's own container width above, now that this
                modal no longer renders its own separate (and separately buggy) copy of the
                preview - it's just instructions + the Copy HTML button. */}
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#151517]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black dark:text-white">Install Your Signature</h2>
                <button onClick={() => setShowInstallModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>

              {/* 2 x 2 on phones - in one row the names wrapped to 3 lines and Apple Mail ran off the edge */}
              <div className="mt-4 grid grid-cols-2 gap-x-2 border-b border-gray-200 sm:flex sm:gap-2 dark:border-gray-700">
                {(['gmail', 'outlook', 'outlook_desktop', 'apple'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setInstallTab(tab)}
                    className={`whitespace-nowrap px-1.5 py-2 text-xs font-black uppercase tracking-wide transition sm:px-3 ${installTab === tab ? 'border-b-2 border-[#C9A24D] text-[#111827] dark:text-white' : 'text-gray-400'}`}
                  >
                    {tab === 'gmail' ? 'Gmail' : tab === 'outlook' ? 'Outlook web / new' : tab === 'outlook_desktop' ? 'Outlook desktop' : 'Apple Mail'}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                {installTab === 'gmail' && (
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Copy the signature below with &quot;Copy HTML&quot;.</li>
                    <li>In Gmail, open Settings (gear icon) &rarr; See all settings.</li>
                    <li>Under the General tab, scroll to Signature &rarr; Create new.</li>
                    <li>Click inside the signature box and paste (Ctrl/Cmd+V).</li>
                    <li>Scroll down and click Save Changes.</li>
                  </ol>
                )}
                {installTab === 'outlook' && (
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Copy the signature below with &quot;Copy HTML&quot;.</li>
                    <li>In Outlook, go to Settings &rarr; Mail &rarr; Compose and reply.</li>
                    <li>Under Email signature, click New signature and name it.</li>
                    <li>Click inside the editor box and paste (Ctrl/Cmd+V).</li>
                    <li>Set it as your default signature for new messages, then Save.</li>
                  </ol>
                )}
                {installTab === 'outlook_desktop' && (
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Copy the signature below with &quot;Copy HTML&quot;.</li>
                    <li>In classic Outlook for Windows, go to File &rarr; Options &rarr; Mail &rarr; Signatures.</li>
                    <li>Click New, name it, then click inside the edit box and paste (Ctrl+V).</li>
                    <li>Pick it for New messages and Replies/forwards, then click OK.</li>
                  </ol>
                )}
                {installTab === 'apple' && (
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Copy the signature below with &quot;Copy HTML&quot;.</li>
                    <li>Open Mail &rarr; Settings &rarr; Signatures.</li>
                    <li>Select your account, click + to add a new signature.</li>
                    <li>Click inside the signature preview box and paste (Cmd+V).</li>
                    <li>Close Settings - it saves automatically.</li>
                  </ol>
                )}
              </div>

              {/* Gmail / Outlook web load the strip's picture fresh every time (owner, 10/24: "keep it +
                  add that line"). Outlook desktop / Apple Mail keep their own copy - see the note below. */}
              {(installTab === 'gmail' || installTab === 'outlook') && (
                <p data-testid="sig-auto-update-note" className="mt-3 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                  <span>Your featured home and sales update by themselves - no re-copy needed.</span>
                </p>
              )}

              {(installTab === 'outlook_desktop' || installTab === 'apple') && (
                <p className="mt-3 rounded-lg bg-gray-100 p-2.5 text-[11px] font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  {installTab === 'apple' ? 'Apple Mail' : 'Outlook desktop'}{' '}saves its own copy of your signature&apos;s pictures, so a new photo, listing or sale won&apos;t appear by itself there. We&apos;ll show a Re-copy reminder on this page whenever that happens.
                </p>
              )}

              <p className="mt-3 rounded-lg bg-[#C9A24D]/10 p-2.5 text-[11px] font-semibold text-[#8b7355] dark:text-[#d7b974]">
                Heads up: no email client runs animation, so the motion in the Live Preview above never appears once installed - that's expected. What you paste keeps the same photo, colors, layout, and listing card, just resting on its final frame instead of animating in.
              </p>

              <p className="mt-3 text-[11px] font-semibold text-gray-400">
                Click Copy HTML, then paste (Ctrl/Cmd+V) directly into your email client's signature box - don't paste it anywhere else first (like a notes app), or it'll paste as plain text instead of a formatted signature.
              </p>

              {!publicReady && (
                <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[11px] font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  Test copy only: this signature&apos;s pictures and links point at a test server that only this computer can reach. It will look fine while you paste, but every picture breaks once the email is sent or opened on a phone. Copy it from the live OpenHousePal site to send real emails.
                </p>
              )}

              {copyError && (
                <p className="mt-2 text-[11px] font-semibold text-red-500">
                  Couldn&apos;t load your signature - check your connection and try again.
                </p>
              )}

              <button
                onClick={copyHtml}
                disabled={!loaded || copying}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#111827] py-3 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]"
              >
                {copying ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</> : copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy HTML</>}
              </button>

            </div>
          </div>
        )}
      </SubscriptionGuard>
    </AuthGuard>
  )
}

// Same compact single-row footprint as the Font buttons right above this in the Customize tab -
// a small round swatch dot instead of a full-width gradient preview bar, which was blowing this
// up to roughly 2x the height of every other control on the tab for what's just a binary toggle.
function ThemeSwatchButton({ label, icon: Icon, active, onClick, preview, previewText }: {
  label: string
  icon: typeof Sun
  active: boolean
  onClick: () => void
  preview: string
  previewText: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${active ? 'border-[#111827] bg-[#fbfaf7] dark:border-white dark:bg-white/5' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10" style={{ background: preview, color: previewText }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold text-[#111827] dark:text-white">{label}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
    </button>
  )
}

function EditElsewhereNote({ href, text, links, inline = false }: { href?: string; text: string; links?: { href: string; label: string }[]; inline?: boolean }) {
  const targets = links || (href ? [{ href, label: 'Edit' }] : [])
  return (
    <div className={`flex justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-[#fbfaf7] p-2.5 dark:border-gray-700 dark:bg-[#0B0B0B] ${inline ? 'items-center' : 'items-start'}`}>
      <p className={`text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400 ${inline ? 'min-w-0 truncate' : ''}`}>{text}</p>
      <div className={`flex shrink-0 gap-1 ${inline ? 'flex-row items-center' : 'flex-col items-end'}`}>
        {targets.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-600 dark:bg-[#151517] dark:text-gray-300"
          >
            {t.label} <ExternalLink className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function QuickAddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-500 transition hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
    >
      <Plus className="h-3 w-3" /> {label}
    </button>
  )
}

// Same bordered-card-with-icon-chip language as BannerShowRow, so Identity/Social don't read as
// a plainer, less-finished tab than Banner right next to it.
function FieldToggle({ label, field, onChange, icon: Icon, iconColorClass, disabledHint, disabledHref }: {
  label: string
  field: SignatureField
  onChange: (updates: Partial<SignatureField>) => void
  icon?: typeof Home
  // Overrides the chip's default gold/gray icon color - used for the Social row so
  // Instagram/Facebook/YouTube/Website show their real brand color instead of the generic tint
  // every other field (Headshot, Name, Job Title, ...) uses.
  iconColorClass?: string
  // When set, the toggle can't be switched on - hovering it explains why and offers a way to fix
  // it, instead of silently letting the agent enable something with nothing behind it.
  disabledHint?: string
  disabledHref?: string
}) {
  const disabled = Boolean(disabledHint)
  const checked = field.include
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${disabled ? 'border-gray-100 opacity-60 dark:border-gray-800' : checked ? 'border-[#C9A24D]/50 bg-[#fbfaf7] dark:bg-white/5' : 'border-gray-200 dark:border-gray-700'}`}>
      {Icon && (
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColorClass ? 'bg-white dark:bg-gray-800' : checked && !disabled ? 'bg-[#C9A24D]/15 text-[#8b7355]' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
          <Icon className={`h-4 w-4 ${iconColorClass || ''}`} />
        </div>
      )}
      <span className={`min-w-0 flex-1 text-xs font-bold ${disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'}`}>{label}</span>
      {disabled ? (
        <div className="group relative shrink-0">
          <span className="relative block h-5 w-9 cursor-not-allowed rounded-full bg-gray-200 dark:bg-gray-800">
            <span className="absolute left-1 top-0.5 h-4 w-4 rounded-full bg-white dark:bg-gray-600" />
          </span>
          {/* The visible tooltip sits inside an outer wrapper with NO gap of its own (top-full,
              zero margin) - the 6px visual gap is pt-1.5 padding on this OUTER box instead of
              margin, so that padding strip is still part of .group's hoverable descendant area.
              With the old margin-top version, moving the mouse from the toggle down toward the
              tooltip crossed a dead pixel strip that belonged to neither element, which ended
              .group's :hover state (and therefore this tooltip's opacity/pointer-events) before
              the mouse ever reached the "Go to Settings" link - the tooltip vanished right as you
              tried to click it. */}
          <div className="pointer-events-none absolute right-0 top-full z-20 w-max max-w-[200px] pt-1.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
            <div className="rounded-lg bg-gray-900 px-2.5 py-2 text-[10px] font-semibold leading-snug text-white shadow-lg dark:bg-white dark:text-gray-900">
              {disabledHint}
              {disabledHref && (
                <Link href={disabledHref} className="mt-1 flex items-center gap-1 font-black text-[#d7b974] underline underline-offset-2 dark:text-[#8b7355]">
                  Go to Settings &amp; enable it <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onChange({ include: !field.include })}
          className={`relative h-5 w-9 shrink-0 rounded-full transition ${field.include ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
          aria-label={`${field.include ? 'Remove' : 'Include'} ${label}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${field.include ? 'left-4 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
        </button>
      )}
    </div>
  )
}


function BannerShowRow({ icon: Icon, label, hint, checked, onChange }: {
  icon: typeof Home
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${checked ? 'border-[#C9A24D]/50 bg-[#fbfaf7] dark:bg-white/5' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-[#C9A24D]/15 text-[#8b7355]' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{label}</p>
        {hint && <p className="text-[11px] font-semibold text-gray-400">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
        aria-label={`${checked ? 'Turn off' : 'Turn on'} ${label}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full transition ${checked ? 'left-4 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
      </button>
    </div>
  )
}
