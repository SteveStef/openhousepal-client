'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BadgeDollarSign, Calculator, CalendarClock, Check, DoorOpen, Download, EyeOff, Facebook, FileSignature, FileText, Handshake,
  Crop, Crown, Home, ImageOff, Instagram, KeyRound, Linkedin, Loader2, Mail, Maximize2, Megaphone, Move, PenLine, Presentation, Printer, QrCode, RotateCcw, Search, Smartphone, Sparkles, Upload, X, ZoomIn,
} from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { AgentFormConfig, BrandKit, CampaignLookup, DesignBlock, DesignColorMode, DesignProject, DesignStyleId, FormCampaign, LinkedProperty, OpenHouse } from '@/types'
import { useOwnDomainBase, agentFormUrl } from '@/lib/ownDomainLinks'
import { DESIGN_FORMAT_META, DESIGN_FORMATS, DESIGN_STYLES, formatRatioLabel, getDesignFormat } from '@/lib/studio/designFormats'
import { pickBestForm } from '@/lib/studio/formFit'
import { DESIGN_SITUATIONS, DesignMessagingVariant, DesignSituationDef, DesignSituationId, getSituation } from '@/lib/studio/designSituations'
import { DesignTemplateDef, getTemplate, getTemplatesFor, isCompositionReady, isStyleReady, TemplateBuildOptions } from '@/lib/studio/designTemplates'
import { DESIGN_COLOR_MODES, joinColorMode, splitColorMode } from '@/lib/studio/designColors'
import { brandSwatch } from '@/lib/studio/designTheme'
import { LUXE_METALS } from '@/lib/luxeMetals'
import LuxeFinishPicker from '@/components/studio/design/LuxeFinishPicker'
import { isLuxeDesign } from '@/lib/studio/designCompositions'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import { designAgentFrom, DesignAgentInfo, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import PhotoGridGate from '@/components/ui/PhotoGridGate'
import PropertySelector from '@/components/studio/PropertySelector'
import ProfileGate from '@/components/studio/design/ProfileGate'
import { PROPERTY_RULE_ATTEST, profileGaps, propertyRuleFor } from '@/lib/studio/designCompliance'
import { hasMlsAccess } from '@/lib/navAccess'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { WhenSheet } from '@/components/ui/WhenPicker'
import { DesignPreview } from '@/components/studio/design/StyleThumbnail'
import { DesignCanvasContext } from '@/components/studio/design/DesignCanvas'
import { copyText } from '@/lib/copyText'
import FlowDock from '@/components/ui/FlowDock'
import { useDesignSaver } from '@/lib/studio/designDownload'
import { backdropMotion, useSheetMotion } from '@/components/ui/windowMotion'
import CampaignRedirectPicker, { CampaignRedirect, DEFAULT_CAMPAIGN_REDIRECT, campaignRedirectError, campaignRedirectPayload } from '@/components/forms/CampaignRedirectPicker'

// The Design Studio wizard - the same flow the homepage "Our Tools" Studio demo walks through:
// the moment -> where it's posted -> the property (and its photo) -> layout -> style -> color.
// Property comes BEFORE every visual choice on purpose: from step 4 on, every tile is a live
// render of the agent's own listing, photo and branding in that exact layout/style/color, at the
// real format - so they pick from real results, not from abstract swatches.

type StepId = 'situation' | 'format' | 'property' | 'tracking' | 'layout' | 'style' | 'theme' | 'crop' | 'review'
// 'tracking' = Leads: which form (and campaign) this piece sends people to. Part of the core flow,
// right after the property - required for mailers and lead-generation pieces, optional otherwise.
// 'crop' = frame the lead photo inside the chosen layout (drag, zoom, or show the whole photo).
const STEP_ORDER: StepId[] = ['situation', 'format', 'property', 'tracking', 'layout', 'style', 'theme', 'crop', 'review']

// Step change: the same glide both ways (custom = +1 forward / -1 back, from AnimatePresence so an
// exiting step always knows the newest direction).
const STEP_SLIDE = {
  enter: (d: number) => ({ opacity: 0, x: d * 22 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, delay: 0.03, ease: [0.22, 1, 0.36, 1] as const } },
  exit: (d: number) => ({ opacity: 0, x: d * -10, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const } }),
}

// Mail pieces exist to bring in leads - they always carry a tracked form.
const MAIL_FORMATS = new Set(['postcard', 'postcard_jumbo', 'letter_mailer', 'property_mailer', 'door_hanger'])

// Forms a printed QR code can open. Campaigns (own link + QR + response tracking) exist for the
// premade lead forms; custom forms are linked through their one general link. Mirrors
// CAMPAIGN_ELIGIBLE_FORM_TYPES in backend forms_routes.py.
const CAMPAIGN_FORM_TYPES = new Set(['buying', 'selling', 'home_value', 'showing', 'how_can_i_help', 'make_me_sell'])
const FORM_TYPE_LABELS: Record<string, string> = {
  buying: 'Buyer form', selling: 'Seller form', home_value: 'Home value', showing: 'Showing request',
  how_can_i_help: 'Buy or sell intake', make_me_sell: 'Make me sell', custom: 'Custom form',
}

function money(v: number | string | null | undefined): string {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString('en-US')}` : ''
}

export const SITUATION_ICONS: Record<DesignSituationId, ComponentType<{ className?: string }>> = {
  just_listed: Home,
  coming_soon: CalendarClock,
  open_house: DoorOpen,
  price_improvement: BadgeDollarSign,
  under_contract: FileSignature,
  just_sold: KeyRound,
  home_valuation: Calculator,
  make_me_sell: Handshake,
  find_your_dream_home: Search,
  social_ad: Megaphone,
}

const FORMAT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  instagram_post: Instagram,
  instagram_portrait: Instagram,
  just_sold_post: Instagram,
  instagram_story: Smartphone,
  facebook_post: Facebook,
  linkedin_post: Linkedin,
  email_graphic: Mail,
  presentation_graphic: Presentation,
}

function formatTimeOfDay(value: string): string {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`
}

function formatOpenHouseDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function propertyPhotos(property: LinkedProperty | null): string[] {
  if (!property) return []
  // The full-size gallery first - an MLS image_url is usually a smaller copy of photo 1.
  const list = property.photos?.length ? property.photos : [property.image_url]
  return Array.from(new Set(list.filter(Boolean) as string[])).slice(0, 18)
}

export default function DesignCreateFlow({ onClose, onCreated, initialSituationId, initialDesignType, initialTemplateId, initialStyleId, initialColorMode, initialProperty, initialPhoto }: {
  onClose: () => void
  onCreated?: (design: DesignProject) => void
  // Pre-seeds choices and skips past them - the dashboard's situation cards (situation), its
  // browse cards (situation + format + template + style).
  initialSituationId?: DesignSituationId
  initialDesignType?: string
  initialTemplateId?: string
  initialStyleId?: DesignStyleId
  initialColorMode?: DesignColorMode
  // Studio's "Your newest listing / latest sale" shortcut - the property comes pre-picked.
  initialProperty?: LinkedProperty | null
  /** AI Media's "Design in Studio": an edited photo (twilight, staged...) that leads the design. */
  initialPhoto?: string
}) {
  // The agent's own domain, when they have one - QR codes and links follow it (lib/ownDomainLinks).
  const ownBase = useOwnDomainBase()
  const router = useRouter()
  const { user, refreshUser } = useAuth()

  const seededSituation = initialSituationId && getSituation(initialSituationId) ? initialSituationId : null
  const seededFormat = seededSituation && initialDesignType && getSituation(seededSituation)?.formats.includes(initialDesignType) ? initialDesignType : null
  const initialStep: StepId = !seededSituation ? 'situation' : !seededFormat ? 'format' : 'property'

  const [step, setStep] = useState<StepId>(initialStep)
  const [direction, setDirection] = useState(1)
  const stepScrollRef = useRef<HTMLDivElement>(null)
  const openMotion = useSheetMotion()
  const [furthest, setFurthest] = useState(STEP_ORDER.indexOf(initialStep))
  const [situationId, setSituationId] = useState<DesignSituationId | null>(seededSituation)
  const [designType, setDesignType] = useState<string | null>(seededFormat)
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId && getTemplate(initialTemplateId) ? initialTemplateId : null)
  const [styleId, setStyleId] = useState<DesignStyleId>(initialStyleId && isStyleReady(initialStyleId) ? initialStyleId : 'modern_luxury')
  // The lead photo's framing inside the design - applied to the hero block on every preview.
  const [crop, setCrop] = useState<{ x: number; y: number; zoom: number; fit: boolean }>({ x: 50, y: 50, zoom: 1, fit: false })
  const [colorMode, setColorMode] = useState<DesignColorMode>(initialColorMode || 'light')

  const [property, setProperty] = useState<LinkedProperty | null>(initialProperty || null)
  const [skipProperty, setSkipProperty] = useState(false)
  // Typed-in homes (skip / No-MLS) can't be checked against the MLS - the agent confirms they represented it.
  const [attested, setAttested] = useState(false)
  // Property designs: the chosen hero photo (null = the listing's own main photo).
  // Lead-gen designs: undefined = the situation's first library photo, '' = no photo at all.
  const [heroPhoto, setHeroPhoto] = useState<string | null | undefined>(initialPhoto || undefined)
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(initialPhoto ? [initialPhoto] : [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Price + address on the design (listing situations).
  const [priceMode, setPriceMode] = useState<'listing' | 'manual' | 'hidden'>('listing')
  const [manualPrice, setManualPrice] = useState('')
  const [previousPrice, setPreviousPrice] = useState('')
  const [hideStreet, setHideStreet] = useState(false)
  const [hideNumber, setHideNumber] = useState(false)

  // QR code & lead tracking (print pieces).
  const [qrMode, setQrMode] = useState<'default' | 'form'>('default')
  const [qrFormId, setQrFormId] = useState<string | null>(null)
  const [campaignMode, setCampaignMode] = useState<'new' | 'existing' | 'general'>('new')
  const [qrOn, setQrOn] = useState(true)
  // The agent's headshot is on every design by default; one switch on the last step turns it off.
  const [agentPhotoOn, setAgentPhotoOn] = useState(true)
  const [campaignName, setCampaignName] = useState('')
  // Where a NEW campaign's visitors go after submitting - starts on "Same as this form" every time.
  const [campaignRedirect, setCampaignRedirect] = useState<CampaignRedirect>(DEFAULT_CAMPAIGN_REDIRECT)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [formCampaigns, setFormCampaigns] = useState<FormCampaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)

  // After Create: the "happy with it?" screen, before (optionally) the editor.
  const [created, setCreated] = useState<DesignProject | null>(null)
  const [createdCampaign, setCreatedCampaign] = useState<CampaignLookup | null>(null)

  const [messagingVariantId, setMessagingVariantId] = useState<string | null>(null)
  const [customHeadline, setCustomHeadline] = useState('')

  const [scheduledOpenHouses, setScheduledOpenHouses] = useState<OpenHouse[]>([])
  const [ohEventId, setOhEventId] = useState<string | null>(null)
  const [ohDate, setOhDate] = useState('')
  const [ohStart, setOhStart] = useState('')
  const [ohEnd, setOhEnd] = useState('')
  const [ohPickerOpen, setOhPickerOpen] = useState(false)

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [hub, setHub] = useState<{ slug?: string | null; config?: Record<string, any> | null } | null>(null)
  const [hubLoaded, setHubLoaded] = useState(false)
  const [forms, setForms] = useState<AgentFormConfig[]>([])

  useEffect(() => {
    api.studio.getBrandKit().then(res => { if (res.success && res.data) setBrandKit(res.data) })
    api.agentHub.getMine().then(res => { if (res.success && res.data) setHub(res.data) }).finally(() => setHubLoaded(true))
    api.forms.getMine().then(res => { if (res.success && res.data) setForms(res.data) })
  }, [])

  const agent: DesignAgentInfo = useMemo(() => {
    const real = designAgentFrom(user, hub)
    return real.agentName ? real : { ...SAMPLE_DESIGN_AGENT, ...Object.fromEntries(Object.entries(real).filter(([, v]) => v)) } as DesignAgentInfo
  }, [user, hub])

  const situation = situationId ? getSituation(situationId) : undefined
  const format = designType ? getDesignFormat(designType) : undefined
  const leadGen = situation?.propertyAttached === false

  // Advertising rules (lib/studio/designCompliance): nothing gets made until the profile has what
  // every ad must show (print also needs the brokerage office phone), and listing / sold designs
  // only for homes this agent represented.
  const realAgent = useMemo(() => designAgentFrom(user, hub), [user, hub])
  const gaps = hubLoaded && user ? profileGaps(realAgent, !!format?.isPrint) : []
  const reloadProfile = async () => {
    await refreshUser()
    const r = await api.agentHub.getMine()
    if (r.success && r.data) setHub(r.data)
  }
  const propertyRule = leadGen ? null : propertyRuleFor(situationId)
  const needAttest = !!propertyRule && (skipProperty || (!!property && !!user && !hasMlsAccess(user.plan_tier)))
  // OpenHousePal Luxe (the Luxe layout and the Luxe color theme) is IDX only: other plans can
  // click it and see it on their own design, but can't continue with it. IDX sees Luxe first.
  const isIdx = user?.plan_tier === 'IDX'
  const templates: DesignTemplateDef[] = useMemo(() => {
    return situationId && designType ? getTemplatesFor(situationId, designType) : []
  }, [situationId, designType])
  const picked = templates.find(t => t.id === templateId)
  const template = picked && isCompositionReady(picked.composition) ? picked : templates[0]

  // Scheduled open houses for the attached listing - offered as one-tap date/time presets.
  useEffect(() => {
    const key = property?.listing_key
    if (situationId !== 'open_house' || !key) { setScheduledOpenHouses([]); return }
    let cancelled = false
    api.openHouses.getByListingKey(key).then(res => {
      if (cancelled || !res.success || !res.data) return
      setScheduledOpenHouses(res.data)
      const soonest = [...res.data].filter(oh => oh.scheduledDate).sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''))[0]
      if (soonest && !ohDate) applyOpenHouse(soonest)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.listing_key, situationId])

  const applyOpenHouse = (oh: OpenHouse) => {
    setOhEventId(oh.openHouseEventId)
    setOhDate(oh.scheduledDate || '')
    setOhStart(oh.scheduledStartTime ? oh.scheduledStartTime.slice(0, 5) : '')
    setOhEnd(oh.scheduledEndTime ? oh.scheduledEndTime.slice(0, 5) : '')
  }

  const messaging: DesignMessagingVariant | undefined = useMemo(() => {
    if (!situation?.messagingVariants) return undefined
    if (messagingVariantId === 'custom') return customHeadline.trim() ? { id: 'custom', headline: customHeadline.trim() } : undefined
    return situation.messagingVariants.find(m => m.id === messagingVariantId) || situation.messagingVariants[0]
  }, [situation, messagingVariantId, customHeadline])

  const linkableForms = useMemo(() => forms.filter(f => f.is_enabled && (CAMPAIGN_FORM_TYPES.has(f.form_type) || f.form_type === 'custom')), [forms])
  const qrForm = qrMode === 'form' ? linkableForms.find(f => f.id === qrFormId) : undefined
  const qrFormCampaignable = !!qrForm && CAMPAIGN_FORM_TYPES.has(qrForm.form_type)

  // Required for mailers and lead-generation pieces - everything else can skip it.
  const leadsRequired = leadGen || (!!designType && MAIL_FORMATS.has(designType))
  // Best fit by the moment and (Social Ad) by what the headline asks - it follows the headline until the
  // agent picks a form themselves.
  const recommendedForm = useMemo(() => pickBestForm(linkableForms, situationId, messaging?.headline), [situationId, linkableForms, messaging?.headline])
  const formPicked = useRef(false)
  // The recommended form is pre-picked, so most agents just press Continue. Required pieces start
  // with tracking on; optional ones start off.
  useEffect(() => {
    if (!recommendedForm) return
    if (!formPicked.current || !qrFormId || !linkableForms.some(f => f.id === qrFormId)) { if (qrFormId !== recommendedForm.id) setQrFormId(recommendedForm.id) }
    if (leadsRequired) setQrMode('form')
  }, [recommendedForm, leadsRequired, linkableForms, qrFormId])

  useEffect(() => {
    if (!qrFormId) { setFormCampaigns([]); return }
    const form = linkableForms.find(f => f.id === qrFormId)
    if (!form || !CAMPAIGN_FORM_TYPES.has(form.form_type)) { setFormCampaigns([]); setCampaignMode('general'); return }
    setCampaignMode(m => (m === 'general' ? 'new' : m))
    let cancelled = false
    setLoadingCampaigns(true)
    api.forms.getCampaigns(qrFormId).then(res => {
      if (cancelled) return
      setFormCampaigns(res.success && res.data ? res.data.filter(c => !c.is_general && !c.deleted_at && c.id) : [])
      setLoadingCampaigns(false)
    })
    return () => { cancelled = true }
  }, [qrFormId, linkableForms])

  const qrTarget = useMemo(() => {
    if (qrForm) return `form:${qrForm.slug}`
    return leadGen ? 'agent_hub' : undefined
  }, [qrForm, leadGen])

  const buildOptions: TemplateBuildOptions = useMemo(() => ({
    heroPhoto: leadGen ? (heroPhoto === undefined ? undefined : heroPhoto) : (heroPhoto || null),
    openHouseDate: formatOpenHouseDate(ohDate),
    openHouseTime: ohStart && ohEnd ? `${formatTimeOfDay(ohStart)} – ${formatTimeOfDay(ohEnd)}` : ohStart ? formatTimeOfDay(ohStart) : '',
    openHouseEventId: ohEventId,
    qrTarget,
    qrLabel: qrForm && !leadGen ? 'Scan to learn more' : undefined,
    qrHidden: !!format?.isPrint && !qrOn,
    hideAgentPhoto: !agentPhotoOn,
    priceMode,
    manualPrice,
    previousPrice,
    hideStreet,
    hideNumber,
  }), [leadGen, heroPhoto, ohDate, ohStart, ohEnd, ohEventId, qrTarget, qrForm, priceMode, manualPrice, previousPrice, hideStreet, hideNumber, format, qrOn, agentPhotoOn])

  useEffect(() => { setCrop({ x: 50, y: 50, zoom: 1, fit: false }) }, [heroPhoto, property?.listing_key, property?.address])
  const cropped = crop.x !== 50 || crop.y !== 50 || crop.zoom !== 1 || crop.fit
  const withCrop = useCallback((blocks: DesignBlock[]) => (!cropped ? blocks : blocks.map(b => b.type === 'hero_photo'
    ? { ...b, data: { ...b.data, photoFocalPoint: { x: Math.round(crop.x), y: Math.round(crop.y) }, photoZoom: Math.round(crop.zoom * 100) / 100, photoFit: crop.fit } }
    : b)), [crop, cropped])

  // The short "about this home" lines every design for this listing prints: the agent's saved ones,
  // else written once by AI from the MLS remarks (then saved) - so each new design brings them over.
  // linked_property keeps the full MLS remarks (the editor's "Use the listing's description").
  const [blurb, setBlurb] = useState<{ key: string; text: string } | null>(null)
  const blurbWait = useRef<Promise<string | null> | null>(null)
  const blurbKey = property ? `${property.listing_key || ''}|${property.address || ''}|${property.city || ''}` : ''
  useEffect(() => {
    if (!property || leadGen) { blurbWait.current = null; return }
    const key = blurbKey
    const facts = [property.beds && `${property.beds} bed`, property.baths && `${property.baths} bath`, property.sqft && `${Number(property.sqft).toLocaleString()} sqft`, property.property_type, property.year_built && `built ${property.year_built}`].filter(Boolean).join(' · ')
    blurbWait.current = api.studio.listingBlurb({ listing_key: property.listing_key, address: property.address, city: property.city, remarks: property.description, facts })
      .then(r => {
        const text = r.success && r.data?.text ? r.data.text : null
        if (text) setBlurb({ key, text })
        return text
      }).catch(() => null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blurbKey, leadGen])
  const withBlurb = (p: LinkedProperty | null, text?: string | null) => (p && text ? { ...p, description: text } : p)
  const previewProperty = leadGen ? null : withBlurb(property, blurb?.key === blurbKey ? blurb.text : null)
  const blocksByTemplate = useMemo(() => {
    const map = new Map<string, DesignBlock[]>()
    for (const t of templates) map.set(t.id, withCrop(t.buildBlocks(previewProperty, messaging, buildOptions)))
    return map
  }, [templates, previewProperty, messaging, buildOptions, withCrop])

  const ctxFor = useCallback((t: DesignTemplateDef, style: DesignStyleId, color: DesignColorMode): DesignCanvasContext | null => {
    if (!format) return null
    return {
      format, styleId: style, colorMode: color, composition: t.composition, layoutHints: t.layoutHints, situation: situationId,
      property: previewProperty, ...agent, brandKit, brandingMode: 'personal',
    }
  }, [format, situationId, previewProperty, agent, brandKit])

  // ---- Selection handlers ----
  const selectSituation = (id: DesignSituationId) => {
    if (id !== situationId) {
      formPicked.current = false
      setSituationId(id)
      const next = getSituation(id)
      if (designType && !next?.formats.includes(designType)) setDesignType(null)
      setTemplateId(null)
      setMessagingVariantId(next?.messagingVariants?.[0]?.id || null)
      setHeroPhoto(initialPhoto || undefined)
    }
  }
  const selectFormat = (dt: string) => {
    if (dt !== designType) { setDesignType(dt); setTemplateId(null) }
  }
  const selectProperty = (p: LinkedProperty | null) => {
    setProperty(p)
    setHeroPhoto(initialPhoto || null)
    if (p) setSkipProperty(false)
  }

  const luxeLayoutLocked = !isIdx && template?.composition === 'luxe'
  const { base: baseColor, metal: luxeMetal } = splitColorMode(colorMode)
  const luxeThemeLocked = !isIdx && (baseColor === 'luxe' || !!luxeMetal)
  const canContinue: Record<StepId, boolean> = {
    situation: !!situationId,
    format: !!designType,
    property: leadGen ? !!messaging?.headline : (!!property || skipProperty) && (!needAttest || attested),
    layout: !!template && !luxeLayoutLocked,
    style: true,
    theme: !luxeThemeLocked,
    crop: true,
    tracking: linkableForms.length === 0 || (qrMode === 'default' ? !leadsRequired : !!qrForm && (campaignMode !== 'existing' || !!campaignId)),
    review: !creating && !(!isIdx && isLuxeDesign(template?.composition, colorMode)),
  }
  if (gaps.length && !created) (Object.keys(canContinue) as StepId[]).forEach(k => { canContinue[k] = false })

  // Steps for this piece - the QR step only exists for print formats.
  const steps: StepId[] = STEP_ORDER
  const stepIndex = Math.max(0, steps.indexOf(step))
  const reached = (id: StepId) => furthest > steps.indexOf(id)
  const goTo = (target: StepId) => {
    const ti = steps.indexOf(target)
    setDirection(ti >= stepIndex ? 1 : -1)
    setStep(target)
    setFurthest(f => Math.max(f, ti))
  }
  const next = () => {
    if (created || !canContinue[step]) return
    if (step === 'review') { void handleCreate(); return }
    goTo(steps[stepIndex + 1])
  }
  const back = () => (stepIndex === 0 ? onClose() : goTo(steps[stepIndex - 1]))
  // Situation/format are single decisions - a click selects and moves on (a beat later, so the
  // selection visibly lands first).
  const pickAndAdvance = (fn: () => void) => {
    fn()
    const target = STEP_ORDER[Math.min(STEP_ORDER.indexOf(step) + 1, STEP_ORDER.length - 1)]
    window.setTimeout(() => goTo(target), 170)
  }

  const defaultName = format && situation
    ? `${situation.label} ${format.label}${property ? ` — ${property.address}` : messaging?.headline ? ` — ${messaging.headline}` : ''}`
    : 'Untitled design'

  const handleCreate = async () => {
    if (!format || !situationId || !template || creating || created || gaps.length) return
    setCreating(true)
    setCreateError('')
    // The QR's campaign: a brand-new one for this piece (its own link + QR, counted separately in
    // Forms), an existing one, or none (the form's General link).
    let attachCampaignId: string | null = null
    if (qrForm && qrFormCampaignable) {
      if (campaignMode === 'new') {
        const linkError = campaignRedirectError(campaignRedirect)
        if (linkError) { setCreating(false); setCreateError(linkError); return }
        const res = await api.forms.createCampaign(qrForm.id, (campaignName.trim() || defaultName).slice(0, 120), campaignRedirectPayload(campaignRedirect))
        if (!res.success || !res.data?.id) {
          setCreating(false)
          setCreateError(res.error || 'Could not create the campaign. Please try again.')
          return
        }
        attachCampaignId = res.data.id
      } else if (campaignMode === 'existing' && campaignId) {
        attachCampaignId = campaignId
      }
    }
    // Make sure this home's saved / AI lines are in (the first one is written while they pick a layout).
    const blurbText = !leadGen && blurbWait.current ? await blurbWait.current : null
    const response = await api.designs.create({
      design_type: format.designType,
      style_id: styleId,
      template_id: template.id,
      situation: situationId,
      color_mode: colorMode,
      name: name.trim() || defaultName,
      linked_property: leadGen ? null : property,
      blocks: withCrop(template.buildBlocks(leadGen ? null : withBlurb(property, blurbText || (blurb?.key === blurbKey ? blurb.text : null)), messaging, buildOptions)),
      branding_mode: 'personal',
      campaign_id: attachCampaignId,
    })
    if (response.success && response.data) {
      const design = response.data
      if (attachCampaignId) {
        const info = await api.forms.getCampaignInfo(attachCampaignId)
        if (info.success && info.data) setCreatedCampaign(info.data)
      }
      setCreated(design)
      setCreating(false)
      onCreated?.(design)
    } else {
      setCreating(false)
      setCreateError(response.error || 'Something went wrong creating this design. Please try again.')
    }
  }

  const uploadPhoto = async (file: File) => {
    setUploadError('')
    if (file.type !== 'image/jpeg') { setUploadError('Please choose a JPG photo.'); return }
    setUploading(true)
    const res = await api.studio.uploadMedia(file, 'design')
    setUploading(false)
    if (res.success && res.data) {
      setUploadedPhotos(list => [res.data!.url, ...list])
      setHeroPhoto(res.data.url)
    } else {
      setUploadError(res.error || 'Upload failed. Please try again.')
    }
  }

  // ---- Keyboard: Enter continues, Esc closes, arrows move between options ----
  const optionCycle = (): { values: string[]; current: string | null; set: (v: string) => void } | null => {
    if (step === 'situation') return { values: DESIGN_SITUATIONS.map(s => s.id), current: situationId, set: v => selectSituation(v as DesignSituationId) }
    if (step === 'format' && situation) return { values: situation.formats, current: designType, set: selectFormat }
    if (step === 'layout') return { values: templates.filter(t => isCompositionReady(t.composition)).map(t => t.id), current: template?.id || null, set: setTemplateId }
    if (step === 'style') return { values: DESIGN_STYLES.filter(s => isStyleReady(s.id)).map(s => s.id), current: styleId, set: v => setStyleId(v as DesignStyleId) }
    if (step === 'theme') return { values: DESIGN_COLOR_MODES.map(c => c.id), current: baseColor, set: v => setColorMode(joinColorMode(v, luxeMetal)) }
    return null
  }
  const keyState = useRef({ next, back, onClose, optionCycle })
  keyState.current = { next, back, onClose, optionCycle }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (e.key === 'Escape') { e.preventDefault(); keyState.current.onClose(); return }
      if (e.key === 'Enter' && !e.shiftKey && (!typing || target?.dataset.enterContinues === 'true')) { e.preventDefault(); keyState.current.next(); return }
      if (typing) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const cycle = keyState.current.optionCycle()
        if (!cycle || !cycle.values.length) return
        e.preventDefault()
        const i = cycle.current ? cycle.values.indexOf(cycle.current) : -1
        const ni = e.key === 'ArrowRight' ? (i + 1) % cycle.values.length : (i - 1 + cycle.values.length) % cycle.values.length
        cycle.set(cycle.values[ni])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock page scroll behind the modal.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ---- Step copy ----
  const STEP_META: Record<StepId, { label: string; title: string; subtitle: string }> = {
    situation: { label: 'Situation', title: 'What are you marketing?', subtitle: 'Pick the moment - every design is written and art-directed for it.' },
    format: { label: 'Where it’s posted', title: 'Where will it be posted?', subtitle: 'Each placement gets its own exact size and layout.' },
    property: leadGen
      ? { label: 'Message & photo', title: 'Your message & photo', subtitle: 'No listing needed - choose the headline and the image it leads with.' }
      : { label: 'Property', title: 'Which property is this for?', subtitle: 'Address, price, facts and photos fill in automatically - then pick the photo it leads with.' },
    layout: { label: 'Layout', title: 'Choose a layout', subtitle: 'Live previews of your design - pick the composition you like best.' },
    style: { label: 'Style', title: 'Choose a style', subtitle: 'The typography and finishing details. Same content, four distinct looks.' },
    theme: { label: 'Theme', title: 'Choose a color theme', subtitle: 'Every theme is tuned for contrast - text stays legible over any photo.' },
    crop: { label: 'Photo crop', title: 'Frame your photo', subtitle: 'Drag the photo to choose what shows, zoom in or out - or show the whole photo. Nothing is cut from the file.' },
    tracking: { label: 'Leads', title: 'Track the leads this brings in', subtitle: 'Pick a form - everyone who responds is saved and counted for this piece.' },
    review: { label: 'Finish', title: 'Name it & create', subtitle: 'Everything stays editable - words, photos, style and color.' },
  }

  const railValue = (id: StepId): string | null => {
    if (id === 'situation') return situation?.label || null
    if (id === 'format') return format ? `${format.label}` : null
    if (id === 'property') return leadGen ? (messaging?.headline || null) : property ? property.address : skipProperty ? 'No property' : null
    if (id === 'layout') return reached('layout') ? template?.label || null : null
    if (id === 'style') return reached('style') ? DESIGN_STYLES.find(s => s.id === styleId)?.label || null : null
    if (id === 'theme') return reached('theme') ? [DESIGN_COLOR_MODES.find(c => c.id === baseColor)?.label, luxeMetal && `Luxe ${LUXE_METALS[luxeMetal].label}`].filter(Boolean).join(' · ') || null : null
    if (id === 'crop') return reached('crop') ? (crop.fit ? 'Whole photo' : cropped ? 'Custom framing' : 'Centered') : null
    if (id === 'tracking') return reached('tracking') ? (qrForm ? qrForm.title : 'No form') : null
    return null
  }

  const showSidePreview = stepIndex >= 2 && step !== 'review' && step !== 'crop' && !created && !!template && !!format && (step !== 'property' || leadGen || !!property || skipProperty)
  const currentCtx = template ? ctxFor(template, styleId, colorMode) : null
  const currentBlocks = template ? blocksByTemplate.get(template.id) || [] : []

  return (
    <MotionConfig reducedMotion="user">
    // Opening (owner 10/24: not smooth on a phone): the backdrop fades while the flow springs up
    // from the bottom edge like a sheet on phones, or rises into place on a computer; closing
    // reverses it (the dashboard wraps this in AnimatePresence).
    <motion.div {...backdropMotion} className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#0b0b0d]/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create a design">
      <motion.div
        {...openMotion}
        style={{ willChange: 'transform' }}
        className="flex h-full w-full max-w-[1320px] overflow-hidden bg-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] dark:bg-[#111113] sm:h-[min(92vh,920px)] sm:rounded-[28px] sm:border sm:border-black/5 dark:sm:border-white/10"
      >
        {/* Step rail */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-gray-100 bg-[#faf9f6] px-5 py-6 dark:border-white/5 dark:bg-[#0d0d0f] lg:flex">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white/10"><Sparkles className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">Design Studio</p>
              <p className="text-sm font-black text-[#111827] dark:text-white">New design</p>
            </div>
          </div>
          <nav className="mt-8 flex-1 space-y-1">
            {steps.map((id, i) => {
              const done = !!created || i < stepIndex || (i <= furthest && i !== stepIndex && !!railValue(id))
              const active = !created && id === step
              const reachable = !created && i <= furthest && (i <= stepIndex || steps.slice(0, i).every(s => canContinue[s]))
              const value = railValue(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!reachable || creating}
                  onClick={() => goTo(id)}
                  className={`group flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${active ? 'bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/[0.06] dark:ring-white/10' : reachable ? 'hover:bg-white/70 dark:hover:bg-white/[0.04]' : 'opacity-45'}`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition ${active ? 'bg-[#C9A24D] text-white' : done ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-300 text-gray-400 dark:border-white/15'}`}>
                    {done && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-black ${active ? 'text-[#111827] dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>{STEP_META[id].label}</span>
                    {value && <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-400">{value}</span>}
                  </span>
                </button>
              )
            })}
          </nav>
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-gray-400 dark:border-white/10">
            <span className="font-black text-gray-500 dark:text-gray-300">Tip:</span> press <Kbd>Enter</Kbd> to continue, <Kbd>←</Kbd><Kbd>→</Kbd> to flip options, <Kbd>Esc</Kbd> to close.
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {created && currentCtx && format ? (
            <DoneView
              design={created}
              ctx={{ ...currentCtx, campaignUrl: createdCampaign && agent.agentHubSlug ? `${agentFormUrl(ownBase, agent.agentHubSlug, createdCampaign.form_slug)}?c=${encodeURIComponent(createdCampaign.token)}` : null }}
              isPrint={format.isPrint}
              portrait={format.orientation === 'portrait'}
              narrow={format.aspectRatio < 0.5}
              square={format.orientation === 'square'}
              campaign={createdCampaign}
              formTitle={qrForm?.title || null}
              link={createdCampaign && agent.agentHubSlug
                ? `${agentFormUrl(ownBase, agent.agentHubSlug, createdCampaign.form_slug)}?c=${encodeURIComponent(createdCampaign.token)}`
                : qrForm && agent.agentHubSlug ? agentFormUrl(ownBase, agent.agentHubSlug, qrForm.slug) : null}
              onEditor={() => router.push(`/studio/design/${created.id}`)}
              onDone={async (exported: boolean) => {
                // "Done" means it's finished: a design that wasn't downloaded is marked Ready
                // (downloading already marks it Exported).
                if (!exported && created.status === 'DRAFT') await api.designs.updateStatus(created.id, 'READY')
                onClose()
              }}
            />
          ) : (<>
          <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 pb-4 pt-5 dark:border-white/5 sm:px-8 sm:pt-6">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">Step {stepIndex + 1} of {steps.length}{situation && stepIndex > 0 ? ` · ${situation.label}` : ''}</p>
              <h2 className="mt-1 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white sm:text-[28px]">{STEP_META[step].title}</h2>
              <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{STEP_META[step].subtitle}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Mobile progress */}
          <div className="flex gap-1 px-5 pt-3 lg:hidden">
            {steps.map((id, i) => <div key={id} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-[#C9A24D]' : 'bg-gray-100 dark:bg-white/10'}`} />)}
          </div>

          <div className="flex min-h-0 flex-1">
            <div ref={stepScrollRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
              {gaps.length > 0 && !created ? <ProfileGate gaps={gaps} onSaved={reloadProfile} /> : (
              // Every step starts at its top (owner 10/24: Next on a phone was glitchy - the new step
              // landed half-way down, wherever the last one had been scrolled to, then jumped). The
              // old step fades where it is, the scroll resets while nothing is on screen, and the new
              // one glides in a beat later - once its (heavy) live previews have mounted.
              <AnimatePresence mode="wait" custom={direction} initial={false} onExitComplete={() => { const el = stepScrollRef.current; if (el) el.scrollTop = 0 }}>
                <motion.div
                  key={step}
                  custom={direction}
                  style={{ willChange: 'transform, opacity' }}
                  variants={STEP_SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {step === 'situation' && (
                    <SituationStep selected={situationId} onPick={id => pickAndAdvance(() => selectSituation(id))} />
                  )}

                  {step === 'format' && situation && (
                    <FormatStep situation={situation} selected={designType} onPick={dt => pickAndAdvance(() => selectFormat(dt))} />
                  )}

                  {step === 'property' && situation && !leadGen && (
                    <div className="space-y-7">
                      <section>
                        <PropertySelector value={property} onChange={selectProperty} only={propertyRule} />
                        {!property && (
                          <button
                            type="button"
                            onClick={() => setSkipProperty(v => !v)}
                            className={`mt-3 w-full rounded-2xl border-2 border-dashed px-4 py-3 text-center text-xs font-black uppercase tracking-wide transition ${skipProperty ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-white/10'}`}
                          >
                            {skipProperty ? <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Continuing without a property - fill details in the editor</span> : 'Skip - I’ll fill in the details myself'}
                          </button>
                        )}
                        {needAttest && propertyRule && (
                          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#C9A24D]/40 bg-[#fffaf0] px-4 py-3 dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/[0.06]" data-testid="represented-attest">
                            <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24D]" />
                            <span className="text-sm font-bold leading-snug text-[#111827] dark:text-white">{PROPERTY_RULE_ATTEST[propertyRule]}</span>
                          </label>
                        )}
                      </section>

                      {(property || skipProperty) && (
                        <PhotoPicker
                          title="Lead photo"
                          hint={propertyPhotos(property).length ? 'The photo your design leads with - you can re-crop and add more in the editor.' : 'This property has no photos yet - upload one (JPG), or add it later in the editor.'}
                          photos={[...uploadedPhotos, ...propertyPhotos(property)]}
                          selected={heroPhoto || propertyPhotos(property)[0] || null}
                          onSelect={url => setHeroPhoto(url === propertyPhotos(property)[0] ? null : url)}
                          onUpload={uploadPhoto}
                          uploading={uploading}
                          error={uploadError}
                        />
                      )}

                      {(property || skipProperty) && (
                        <PriceAndAddress
                          situationId={situationId}
                          property={property}
                          mode={priceMode}
                          onMode={setPriceMode}
                          manual={manualPrice}
                          onManual={setManualPrice}
                          previous={previousPrice}
                          onPrevious={setPreviousPrice}
                          hideStreet={hideStreet}
                          onHideStreet={setHideStreet}
                          hideNumber={hideNumber}
                          onHideNumber={setHideNumber}
                        />
                      )}

                      {situationId === 'open_house' && (property || skipProperty) && (
                        <section>
                          <SectionLabel>Open house date & time</SectionLabel>
                          {/* Their scheduled open houses as big tap cards first, then the step-by-step
                              picker for any other date and hours (user, 10/22). Same values as the
                              old Date / Starts / Ends boxes. */}
                          {scheduledOpenHouses.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {scheduledOpenHouses.map((oh, i) => {
                                const on = ohEventId === oh.openHouseEventId
                                const d = oh.scheduledDate ? new Date(`${oh.scheduledDate}T00:00:00`) : null
                                return (
                                  <motion.button key={oh.id} type="button" onClick={() => applyOpenHouse(oh)}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.97 }}
                                    className={`relative flex min-h-[72px] items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-[0_12px_26px_-16px_rgba(201,162,77,.9)]' : 'border-gray-200 bg-white hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.03]'}`}>
                                    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${on ? 'bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
                                      {d ? (<>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${on ? '' : 'text-[#e8c97a] dark:text-[#a8843a]'}`}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                                        <span className="font-serif text-lg font-black leading-none">{d.getDate()}</span>
                                      </>) : <CalendarClock className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[14px] font-black text-[#111827] dark:text-white">{oh.scheduledDate ? formatOpenHouseDate(oh.scheduledDate) : 'Unscheduled'}</p>
                                      <p className="truncate text-[12px] font-bold text-gray-500 dark:text-gray-400">{oh.scheduledStartTime && oh.scheduledEndTime ? `${formatTimeOfDay(oh.scheduledStartTime)} – ${formatTimeOfDay(oh.scheduledEndTime)}` : 'No hours set'}</p>
                                      <p className="text-[9px] font-black uppercase tracking-widest text-[#a8843a] dark:text-[#e8c97a]">Your scheduled open house</p>
                                    </div>
                                    {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#111827] text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3} /></motion.span>}
                                  </motion.button>
                                )
                              })}
                            </div>
                          )}
                          {ohDate && !ohEventId && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className="mt-3 flex items-center gap-3 rounded-2xl border border-[#C9A24D] bg-[#C9A24D]/10 p-3">
                              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] text-[#111827]">
                                <span className="text-[8px] font-black uppercase tracking-widest">{new Date(`${ohDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span>
                                <span className="font-serif text-lg font-black leading-none">{new Date(`${ohDate}T00:00:00`).getDate()}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-black text-[#111827] dark:text-white">{formatOpenHouseDate(ohDate)}</p>
                                <p className="truncate text-[12px] font-bold text-gray-500 dark:text-gray-400">{ohStart && ohEnd ? `${formatTimeOfDay(ohStart)} – ${formatTimeOfDay(ohEnd)}` : ohStart ? `From ${formatTimeOfDay(ohStart)}` : 'No hours on the design'}</p>
                              </div>
                              <button type="button" onClick={() => setOhPickerOpen(true)} className="h-10 shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-black uppercase tracking-widest text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white">Change</button>
                              <button type="button" onClick={() => { setOhDate(''); setOhStart(''); setOhEnd('') }} aria-label="Clear the date" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
                            </motion.div>
                          )}
                          {!(ohDate && !ohEventId) && (
                            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setOhPickerOpen(true)}
                              className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-[12px] font-black uppercase tracking-widest text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15 dark:text-gray-400">
                              <CalendarClock className="h-4 w-4" /> {scheduledOpenHouses.length ? 'A different date & time' : 'Pick the date & time'}
                            </motion.button>
                          )}
                          <WhenSheet open={ohPickerOpen} onClose={() => setOhPickerOpen(false)} mode="range" weekendsOnly days={8}
                            title="When is the open house?" kicker="Open house"
                            photo={heroPhoto || propertyPhotos(property)[0] || null} context={property?.address || null} contextSub={property?.city || null}
                            value={ohDate ? { date: ohDate, time: ohStart || null, end: ohEnd || null, anytime: !ohStart && !ohEnd } : null}
                            allowAnytime="Just the date"
                            rangeBlocksLabel="Popular open-house times"
                            offNote="Weekends in gold"
                            onDone={v => {
                              setOhPickerOpen(false)
                              if (!v.date) return
                              setOhEventId(null)
                              setOhDate(v.date)
                              setOhStart(v.anytime ? '' : v.time || '')
                              setOhEnd(v.anytime ? '' : v.end || '')
                            }} />
                          <p className="mt-2 text-[11px] font-semibold text-gray-400">Optional - leave blank and add it later in the editor.</p>
                        </section>
                      )}
                    </div>
                  )}

                  {step === 'property' && situation && leadGen && (
                    <div className="space-y-7">
                      <section>
                        <SectionLabel>Headline</SectionLabel>
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                          {situation.messagingVariants?.map(m => (
                            <OptionCard key={m.id} selected={messagingVariantId === m.id || (!messagingVariantId && m.id === situation.messagingVariants?.[0]?.id)} onClick={() => setMessagingVariantId(m.id)}>
                              <p className="font-serif text-lg font-black leading-snug text-[#111827] dark:text-white">{m.headline}</p>
                            </OptionCard>
                          ))}
                          <OptionCard selected={messagingVariantId === 'custom'} onClick={() => setMessagingVariantId('custom')}>
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Write your own</p>
                            <input
                              value={customHeadline}
                              onChange={e => { setCustomHeadline(e.target.value); setMessagingVariantId('custom') }}
                              onFocus={() => setMessagingVariantId('custom')}
                              data-enter-continues="true"
                              maxLength={70}
                              placeholder="e.g. Is 2026 your year to move?"
                              className="mt-1.5 w-full bg-transparent font-serif text-lg font-black text-[#111827] outline-none placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-600"
                            />
                          </OptionCard>
                        </div>
                      </section>
                      <PhotoPicker
                        title="Photo"
                        hint="Lifestyle photography chosen for this message - or upload your own (JPG). “No photo” gives a pure typographic design."
                        photos={[...uploadedPhotos, ...(situation.photoLibrary || [])]}
                        selected={heroPhoto === undefined ? (situation.photoLibrary?.[0] || null) : heroPhoto || null}
                        onSelect={url => setHeroPhoto(url)}
                        onUpload={uploadPhoto}
                        uploading={uploading}
                        error={uploadError}
                        allowNone
                        noneSelected={heroPhoto === ''}
                        onSelectNone={() => setHeroPhoto('')}
                      />
                    </div>
                  )}

                  {step === 'layout' && template && (
                    <PreviewGrid columns={format?.orientation === 'landscape' ? 'wide' : 'normal'}>
                      {templates.map(t => {
                        const ctx = ctxFor(t, styleId, colorMode)
                        return ctx && (
                          <PreviewTile key={t.id} soon={!isCompositionReady(t.composition)} luxe={t.composition === 'luxe'} locked={t.composition === 'luxe' && !isIdx} selected={t.id === template.id} onClick={() => setTemplateId(t.id)} onDoubleClick={() => { setTemplateId(t.id); if (isIdx || t.composition !== 'luxe') goTo('style') }} label={t.label} description={t.description}>
                            <DesignPreview blocks={blocksByTemplate.get(t.id) || []} ctx={ctx} rounded={false} />
                          </PreviewTile>
                        )
                      })}
                    </PreviewGrid>
                  )}
                  {step === 'layout' && luxeLayoutLocked && (
                    <LuxeUpgradePitch className="mt-5" feature="Studio Luxe" text="That's your design in Luxe. Upgrade to IDX to make it - or pick another layout to keep going." />
                  )}

                  {step === 'style' && template && (
                    <PreviewGrid columns={format?.orientation === 'landscape' ? 'wide' : 'four'}>
                      {[...DESIGN_STYLES.filter(s => isStyleReady(s.id)), ...DESIGN_STYLES.filter(s => !isStyleReady(s.id))].map(s => {
                        const ctx = ctxFor(template, s.id, colorMode)
                        return ctx && (
                          <PreviewTile key={s.id} soon={!isStyleReady(s.id)} selected={s.id === styleId} onClick={() => setStyleId(s.id)} onDoubleClick={() => { setStyleId(s.id); goTo('theme') }} label={s.label} description={s.description}>
                            <DesignPreview blocks={currentBlocks} ctx={ctx} rounded={false} />
                          </PreviewTile>
                        )
                      })}
                    </PreviewGrid>
                  )}

                  {step === 'theme' && template && (
                    <>
                      <PreviewGrid columns={format?.orientation === 'landscape' ? 'wide' : 'five'}>
                        {DESIGN_COLOR_MODES.map(cm => {
                          const ctx = ctxFor(template, styleId, joinColorMode(cm.id, luxeMetal))
                          const swatch: [string, string] = cm.id === 'brand' ? brandSwatch(brandKit) : cm.swatch
                          return ctx && (
                            <PreviewTile
                              key={cm.id}
                              luxe={cm.id === 'luxe'}
                              locked={cm.id === 'luxe' && !isIdx}
                              selected={cm.id === baseColor}
                              onClick={() => setColorMode(joinColorMode(cm.id, luxeMetal))}
                              onDoubleClick={() => { setColorMode(joinColorMode(cm.id, luxeMetal)); if (isIdx || (cm.id !== 'luxe' && !luxeMetal)) goTo('crop') }}
                              label={cm.label}
                              description={cm.description}
                              adornment={<span className="flex -space-x-1">{swatch.map((c, i) => <span key={i} className="h-3.5 w-3.5 rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: c }} />)}</span>}
                            >
                              <DesignPreview blocks={currentBlocks} ctx={ctx} rounded={false} />
                            </PreviewTile>
                          )
                        })}
                      </PreviewGrid>
                      <div className="mt-5 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.04] p-4">
                        <LuxeFinishPicker value={luxeMetal} goldTheme={baseColor === 'luxe' || template?.composition === 'luxe'} locked={!isIdx} onChange={m => setColorMode(joinColorMode(baseColor, m))} />
                      </div>
                      {luxeThemeLocked && <LuxeUpgradePitch className="mt-5" feature="Studio Luxe" text={luxeMetal && baseColor !== 'luxe' ? "That's your design with a Luxe finish. Upgrade to IDX to use it - or choose None to keep going." : "That's your design in the Luxe theme. Upgrade to IDX to use it - or pick another theme to keep going."} />}
                      <p className="mt-4 text-xs font-semibold text-gray-400">
                        Brand uses your brand color (from Branding) on your print background, with your logo. <a href="/studio/brand-kit" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline">Open Branding</a>
                      </p>
                    </>
                  )}

                  {step === 'crop' && template && currentCtx && format && (
                    <CropStep
                      blocks={currentBlocks}
                      ctx={currentCtx}
                      maxWidth={format.orientation === 'portrait' ? (format.aspectRatio < 0.5 ? 260 : 440) : format.orientation === 'square' ? 520 : 760}
                      hasPhoto={!!(leadGen ? (heroPhoto === undefined ? situation?.photoLibrary?.[0] : heroPhoto) : (heroPhoto || propertyPhotos(property)[0]))}
                      crop={crop}
                      onCrop={setCrop}
                    />
                  )}

                  {step === 'tracking' && format && (
                    <TrackingStep
                      leadGen={leadGen}
                      situationId={situationId}
                      forms={linkableForms}
                      required={leadsRequired}
                      isPrint={!!format.isPrint}
                      qrOn={qrOn}
                      onQrOn={setQrOn}
                      recommendedFormId={recommendedForm?.id || null}
                      qrMode={qrMode}
                      onQrMode={mode => { setQrMode(mode); if (mode === 'form' && !qrFormId && recommendedForm) setQrFormId(recommendedForm.id) }}
                      formId={qrFormId}
                      onForm={id => { formPicked.current = true; setQrMode('form'); setQrFormId(id); setCampaignId(null); setCampaignRedirect(DEFAULT_CAMPAIGN_REDIRECT); setCampaignMode(CAMPAIGN_FORM_TYPES.has(linkableForms.find(f => f.id === id)?.form_type || '') ? 'new' : 'general') }}
                      campaignable={qrFormCampaignable}
                      campaignMode={campaignMode}
                      onCampaignMode={setCampaignMode}
                      campaignName={campaignName}
                      onCampaignName={setCampaignName}
                      campaignRedirect={campaignRedirect}
                      onCampaignRedirect={setCampaignRedirect}
                      formGoesToHub={linkableForms.find(f => f.id === qrFormId)?.redirect_to_agent_hub ?? true}
                      defaultCampaignName={defaultName}
                      campaigns={formCampaigns}
                      loadingCampaigns={loadingCampaigns}
                      campaignId={campaignId}
                      onCampaignId={id => { setCampaignId(id); setCampaignMode('existing') }}
                    />
                  )}

                  {step === 'review' && template && currentCtx && format && situation && (
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                      <div className="flex items-start justify-center rounded-3xl bg-[#f4f2ee] p-5 dark:bg-black/30 sm:p-8">
                        <div className="w-full shadow-[0_24px_60px_rgba(0,0,0,0.22)]" style={{ maxWidth: format.orientation === 'portrait' ? (format.aspectRatio < 0.5 ? 240 : 420) : format.orientation === 'square' ? 520 : 760 }}>
                          <DesignPreview blocks={currentBlocks} ctx={currentCtx} rounded={false} />
                        </div>
                      </div>
                      <div className="space-y-5">
                        <Field label="Design name">
                          <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={defaultName}
                            data-enter-continues="true"
                            className={`${inputClass} text-[15px]`}
                          />
                        </Field>
                        <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-white/5 dark:border-white/10">
                          {([
                            ['Situation', situation.label, 'situation'],
                            ['Posted to', format.label, 'format'],
                            [leadGen ? 'Message' : 'Property', leadGen ? messaging?.headline || '' : property?.address || 'Added later', 'property'],
                            ['Layout', template.label, 'layout'],
                            ['Style', DESIGN_STYLES.find(s => s.id === styleId)?.label || '', 'style'],
                            ['Theme', [DESIGN_COLOR_MODES.find(c => c.id === baseColor)?.label, luxeMetal && `Luxe ${LUXE_METALS[luxeMetal].label}`].filter(Boolean).join(' · '), 'theme'],
                            ['Photo', crop.fit ? 'Whole photo' : cropped ? 'Custom framing' : 'Centered', 'crop'],
                            ['Leads', qrForm ? `${qrForm.title}${qrFormCampaignable ? (campaignMode === 'existing' ? ` · ${formCampaigns.find(c => c.id === campaignId)?.name || 'campaign'}` : ' · new campaign') : ''}${format.isPrint ? (qrOn ? ' · QR on' : ' · no QR') : ''}` : 'No form', 'tracking'] as [string, string, StepId],
                          ] as [string, string, StepId][]).map(([k, v, target]) => (
                            <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                              <dt className="text-[11px] font-black uppercase tracking-widest text-gray-400">{k}</dt>
                              <dd className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-bold text-[#111827] dark:text-white">{v}</span>
                                <button type="button" onClick={() => goTo(target)} className="shrink-0 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Change</button>
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 dark:border-white/10">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-[#111827] dark:text-white">Your headshot</p>
                            <p className="text-[11px] font-semibold text-gray-400">{agentPhotoOn ? 'On the design, beside your name' : 'Off - just your name and contact'}</p>
                          </div>
                          <OhpSwitch on={agentPhotoOn} onChange={setAgentPhotoOn} label="Show your headshot on this design" />
                        </div>
                        <p className="text-xs font-semibold leading-relaxed text-gray-400">
                          Next: download it right away {format.isPrint ? '(print-ready PDF or PNG)' : '(full-resolution PNG)'} - or click Edit to change the photo, words, price or look.
                        </p>
                        {createError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">{createError}</p>}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              )}
            </div>

            {/* Live preview rail */}
            {showSidePreview && currentCtx && format && (
              <aside className="hidden w-[360px] shrink-0 flex-col border-l border-gray-100 bg-[#f7f5f1] px-6 py-6 dark:border-white/5 dark:bg-[#0d0d0f] xl:flex">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Live preview</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{DESIGN_FORMAT_META[format.designType]?.size}</p>
                </div>
                <div className="flex flex-1 items-center justify-center py-4">
                  <motion.div
                    key={`${template?.id}-${styleId}-${colorMode}-${heroPhoto}`}
                    initial={{ opacity: 0.4, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="w-full shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                    style={{ maxWidth: format.orientation === 'portrait' ? (format.aspectRatio < 0.5 ? 150 : format.aspectRatio < 0.7 ? 200 : 280) : 312 }}
                  >
                    <DesignPreview blocks={currentBlocks} ctx={currentCtx} rounded={false} />
                  </motion.div>
                </div>
                <p className="text-center text-[11px] font-semibold text-gray-400">{format.label} · {DESIGN_FORMAT_META[format.designType]?.placement}</p>
              </aside>
            )}
          </div>

          {/* Phones get the flow bar (components/ui/FlowDock) below instead - same Back / Continue. */}
          <footer className="hidden items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/5 sm:flex sm:px-8">
            <button type="button" onClick={back} disabled={creating} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-black text-gray-400 transition hover:text-[#111827] disabled:opacity-40 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" /> {stepIndex === 0 ? 'Cancel' : 'Back'}
            </button>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs font-semibold text-gray-400 sm:inline">
                {canContinue[step] ? <>Press <Kbd>Enter</Kbd></> : (step === 'layout' && luxeLayoutLocked) || (step === 'theme' && luxeThemeLocked) ? <span className="inline-flex items-center gap-1 font-black text-[#8b6a2b]"><Crown className="h-3.5 w-3.5" /> Luxe comes with IDX</span> : step === 'property' && !leadGen ? 'Choose a property, or skip' : step === 'situation' ? 'Pick one to continue' : step === 'format' ? 'Pick a placement' : ''}
              </span>
              <button
                type="button"
                onClick={next}
                disabled={!canContinue[step] || creating}
                className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35 dark:bg-white dark:text-[#111827] dark:hover:bg-gray-100"
              >
                {step === 'review'
                  ? creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><Check className="h-4 w-4" /> Create design</>
                  : <>Continue <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </footer>
          {/* Phones: the flow bar - Back on the left, "3 / 9" in the middle, Continue (Create on the
              last step) on the right; the same next() / back() as the footer above. */}
          <FlowDock inline step={stepIndex + 1} total={steps.length}
            onBack={stepIndex > 0 ? back : undefined} backDisabled={creating}
            onContinue={next} disabled={!canContinue[step] || creating} busy={creating}
            continueLabel={step === 'review' ? (creating ? 'Creating…' : 'Create') : 'Continue'}
            icon={step === 'review' ? <Check className="h-4 w-4" /> : undefined} />
          </>)}
        </div>
      </motion.div>
    </motion.div>
    </MotionConfig>
  )
}

// ---------------------------------------------------------------------------------------------

const inputClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#18181b] dark:text-white'

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 inline-flex min-w-[20px] items-center justify-center rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-black text-gray-500 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-white/15 dark:bg-white/5 dark:text-gray-300">{children}</kbd>
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{children}</p>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</span>
      {children}
    </label>
  )
}

function SelectedBadge() {
  return (
    <span className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow-md ring-2 ring-white dark:ring-[#111113]">
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      // Only a Space pressed on the card itself selects it - a Space typed in the "Write your own"
      // box inside it bubbles up here too, and preventing it swallowed every space (10/24).
      onKeyDown={e => { if (e.key === ' ' && e.target === e.currentTarget) { e.preventDefault(); onClick() } }}
      className={`relative cursor-pointer rounded-2xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A24D]/25 ${selected ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20'}`}
    >
      {selected && <SelectedBadge />}
      {children}
    </div>
  )
}

function SituationStep({ selected, onPick }: { selected: DesignSituationId | null; onPick: (id: DesignSituationId) => void }) {
  const groups: { title: string; note: string; items: DesignSituationDef[] }[] = [
    { title: 'Listing marketing', note: 'Built from a property', items: DESIGN_SITUATIONS.filter(s => s.propertyAttached) },
    { title: 'Lead generation', note: 'No listing needed', items: DESIGN_SITUATIONS.filter(s => !s.propertyAttached) },
  ]
  return (
    <div className="space-y-8">
      {groups.map(group => (
        <section key={group.title}>
          <div className="flex items-baseline gap-2">
            <SectionLabel>{group.title}</SectionLabel>
            <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">· {group.note}</span>
          </div>
          <div className="ohp-stagger mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map(s => {
              const Icon = SITUATION_ICONS[s.id]
              const isSel = selected === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPick(s.id)}
                  className={`group relative flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A24D]/25 ${isSel ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06] shadow-[0_10px_30px_rgba(201,162,77,0.18)]' : 'border-gray-200 bg-white hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.03] hover:ring-4 hover:ring-[#C9A24D]/15 hover:shadow-[0_14px_34px_rgba(17,24,39,0.10)] dark:border-white/10 dark:bg-white/[0.02]'}`}
                >
                  {isSel && <SelectedBadge />}
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${isSel ? 'bg-[#C9A24D] text-white' : 'bg-[#f4efe4] text-[#8b7355] group-hover:bg-[#C9A24D]/15 dark:bg-white/5 dark:text-[#d7b974]'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 pr-6">
                    <span className="block text-[15px] font-black text-[#111827] dark:text-white">{s.label}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">{s.description}</span>
                    <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-300 dark:text-gray-600">{s.formats.length} formats</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function FormatGlyph({ aspect, Icon, active }: { aspect: number; Icon?: ComponentType<{ className?: string }>; active: boolean }) {
  const box = 52
  const w = aspect >= 1 ? box : Math.max(18, box * aspect)
  const h = aspect >= 1 ? Math.max(16, box / aspect) : box
  return (
    <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center">
      <div
        className={`flex items-center justify-center rounded-[5px] border-2 transition ${active ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-300 bg-gray-50 text-gray-400 dark:border-white/20 dark:bg-white/5'}`}
        style={{ width: w, height: h }}
      >
        {Icon ? <Icon className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
      </div>
    </div>
  )
}

function FormatStep({ situation, selected, onPick }: { situation: DesignSituationDef; selected: string | null; onPick: (designType: string) => void }) {
  const formats = DESIGN_FORMATS.filter(f => situation.formats.includes(f.designType))
  const channels: ('Social' | 'Print' | 'Digital')[] = ['Social', 'Print', 'Digital']
  return (
    <div className="space-y-8">
      {channels.map(channel => {
        const items = formats.filter(f => (DESIGN_FORMAT_META[f.designType]?.channel || 'Print') === channel)
        if (!items.length) return null
        return (
          <section key={channel}>
            <SectionLabel>{channel === 'Social' ? 'Social media' : channel === 'Print' ? 'Print & mail' : 'Email & screens'}</SectionLabel>
            <div className="ohp-stagger mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(f => {
                const meta = DESIGN_FORMAT_META[f.designType]
                const isSel = selected === f.designType
                return (
                  <button
                    key={f.designType}
                    type="button"
                    onClick={() => onPick(f.designType)}
                    className={`group relative flex items-center gap-3 rounded-2xl border-2 p-3 pr-4 text-left transition duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A24D]/25 ${isSel ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06] shadow-[0_10px_30px_rgba(201,162,77,0.18)]' : 'border-gray-200 bg-white hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.03] hover:ring-4 hover:ring-[#C9A24D]/15 hover:shadow-[0_14px_34px_rgba(17,24,39,0.10)] dark:border-white/10 dark:bg-white/[0.02]'}`}
                  >
                    {isSel && <SelectedBadge />}
                    <FormatGlyph aspect={f.aspectRatio} Icon={FORMAT_ICONS[f.designType]} active={isSel} />
                    <span className="min-w-0 pr-5">
                      <span className="block text-[15px] font-black text-[#111827] dark:text-white">{f.label}</span>
                      <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{meta?.placement}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {formatRatioLabel(f.designType) && <span className="rounded-md bg-[#111827] px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white dark:bg-white dark:text-[#111827]">{formatRatioLabel(f.designType)}</span>}
                        <span className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-gray-600 dark:border-white/15 dark:text-gray-300">{meta?.size}</span>
                        <span className="text-[10px] font-bold text-gray-400">{f.isPrint ? 'PDF + PNG' : 'PNG'}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PhotoPicker({ title, hint, photos, selected, onSelect, onUpload, uploading, error, allowNone, noneSelected, onSelectNone }: {
  title: string; hint: string; photos: string[]; selected: string | null; onSelect: (url: string) => void
  onUpload: (file: File) => void; uploading: boolean; error: string
  allowNone?: boolean; noneSelected?: boolean; onSelectNone?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-1 text-xs font-semibold text-gray-400">{hint}</p>
      <PhotoGridGate urls={photos.slice(0, 30)}>
      <div className="ohp-reveal mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 text-[11px] font-black text-gray-400 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-60 dark:border-white/10"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {uploading ? 'Uploading…' : 'Upload JPG'}
        </button>
        {allowNone && (
          <button
            type="button"
            onClick={onSelectNone}
            className={`relative flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 text-[11px] font-black transition ${noneSelected ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06] text-[#8b7355]' : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-white/10'}`}
          >
            {noneSelected && <SelectedBadge />}
            <ImageOff className="h-5 w-5" /> No photo
          </button>
        )}
        {photos.map(url => {
          const isSel = !noneSelected && selected === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => onSelect(url)}
              className={`relative aspect-[4/3] overflow-hidden rounded-xl transition focus:outline-none ${isSel ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#111113]' : 'opacity-90 hover:opacity-100'}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              {isSel && <SelectedBadge />}
            </button>
          )
        })}
      </div>
      </PhotoGridGate>
      {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onUpload(file)
        }}
      />
    </section>
  )
}

function PreviewGrid({ columns, children }: { columns: 'normal' | 'four' | 'five' | 'wide'; children: ReactNode }) {
  const cls = columns === 'wide' ? 'grid-cols-1 md:grid-cols-2'
    : columns === 'four' ? 'grid-cols-2 lg:grid-cols-4'
    : columns === 'five' ? 'grid-cols-2 sm:grid-cols-3 2xl:grid-cols-5'
    : 'grid-cols-2 md:grid-cols-3'
  return <div className={`ohp-stagger grid gap-4 ${cls}`}>{children}</div>
}

function PreviewTile({ selected, onClick, onDoubleClick, label, description, adornment, children, luxe = false, locked = false, soon = false }: {
  selected: boolean; onClick: () => void; onDoubleClick?: () => void; label: string; description: string; adornment?: ReactNode; children: ReactNode
  luxe?: boolean; locked?: boolean; soon?: boolean
}) {
  if (soon && luxe) return (
    <div aria-disabled="true" title="Coming soon" className="relative flex cursor-not-allowed select-none flex-col overflow-hidden rounded-2xl border-2 border-[#C9A24D]/45 bg-gradient-to-br from-[#111827] via-[#151a22] to-[#2a2218] text-left">
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
      <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-md"><Sparkles className="h-2.5 w-2.5" /> Luxe · Coming soon</span>
      <div className="relative bg-black/30 p-3 opacity-60">
        <div className="pointer-events-none shadow-[0_8px_24px_rgba(0,0,0,0.16)]">{children}</div>
      </div>
      <div className="p-3.5">
        <p className="font-serif text-[15px] font-black text-[#f3dfa8]">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white/60">{description}</p>
      </div>
    </div>
  )
  if (soon) return (
    <div aria-disabled="true" title="Coming soon" className="relative flex cursor-not-allowed select-none flex-col overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-white text-left dark:border-white/10 dark:bg-white/[0.02]">
      <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#111827] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-md dark:bg-white dark:text-[#111827]">Coming soon</span>
      <div className="relative bg-[#f4f2ee] p-3 opacity-45 grayscale dark:bg-black/30">
        <div className="pointer-events-none shadow-[0_8px_24px_rgba(0,0,0,0.16)]">{children}</div>
      </div>
      <div className="p-3.5 opacity-60">
        <p className="text-sm font-black text-[#111827] dark:text-white">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  )
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A24D]/25 ${luxe ? 'bg-gradient-to-br from-[#111827] via-[#151a22] to-[#2a2218]' : 'bg-white dark:bg-white/[0.02]'} ${selected ? 'border-[#C9A24D] shadow-[0_14px_40px_rgba(201,162,77,0.22)]' : luxe ? 'border-[#C9A24D]/55 hover:border-[#C9A24D] hover:shadow-[0_18px_44px_rgba(201,162,77,0.35)]' : 'border-gray-200 hover:border-[#C9A24D] hover:ring-4 hover:ring-[#C9A24D]/15 hover:shadow-[0_18px_44px_rgba(17,24,39,0.14)] dark:border-white/10'}`}
    >
      {luxe && <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />}
      {luxe && <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-md">{locked ? <><Crown className="h-2.5 w-2.5" /> IDX · preview</> : <><Sparkles className="h-2.5 w-2.5" /> Luxe</>}</span>}
      {selected && <SelectedBadge />}
      <div className={`relative p-3 ${luxe ? 'bg-black/30' : 'bg-[#f4f2ee] dark:bg-black/30'}`}>
        <div className="shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.24)]">{children}</div>
        {!selected && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100">
            <span className="translate-y-1 rounded-full bg-[#111827]/90 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg transition duration-200 group-hover:translate-y-0 dark:bg-white/90 dark:text-[#111827]">Select</span>
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <p className={`text-sm font-black ${luxe ? 'font-serif text-[15px] text-[#f3dfa8]' : 'text-[#111827] dark:text-white'}`}>{label}</p>
          <p className={`mt-0.5 text-[11px] font-semibold leading-snug ${luxe ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>{description}</p>
        </div>
        {adornment && <span className="mt-0.5 shrink-0">{adornment}</span>}
      </div>
    </button>
  )
}


// Frame the lead photo inside the actual design: drag it, zoom it, or show the whole photo (no
// crop at all - it sits over a blurred copy of itself). Live, at the real format.
function CropStep({ blocks, ctx, maxWidth, hasPhoto, crop, onCrop }: {
  blocks: DesignBlock[]; ctx: DesignCanvasContext; maxWidth: number; hasPhoto: boolean
  crop: { x: number; y: number; zoom: number; fit: boolean }; onCrop: (c: { x: number; y: number; zoom: number; fit: boolean }) => void
}) {
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  if (!hasPhoto) {
    return <p className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm font-semibold text-gray-500 dark:border-white/10">This design has no photo - nothing to frame. Continue to finish.</p>
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex items-start justify-center rounded-3xl bg-[#f4f2ee] p-5 dark:bg-black/30 sm:p-8">
        <div
          className={`relative w-full touch-none select-none shadow-[0_24px_60px_rgba(0,0,0,0.22)] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ maxWidth }}
          onPointerDown={e => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            dragRef.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y, w: r.width, h: r.height }
            ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
            setDragging(true)
          }}
          onPointerMove={e => {
            const d = dragRef.current
            if (!d) return
            const k = 140 / Math.max(crop.zoom, 0.6)
            onCrop({ ...crop, x: clamp(d.x - ((e.clientX - d.px) / d.w) * k), y: clamp(d.y - ((e.clientY - d.py) / d.h) * k) })
          }}
          onPointerUp={() => { dragRef.current = null; setDragging(false) }}
          onPointerCancel={() => { dragRef.current = null; setDragging(false) }}
        >
          <DesignPreview blocks={blocks} ctx={ctx} rounded={false} />
          <span className={`pointer-events-none absolute left-1/2 top-3 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-opacity ${dragging ? 'opacity-0' : 'opacity-100'}`}>
            <Move className="h-3 w-3" /> Drag to reposition
          </span>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <SectionLabel>Zoom</SectionLabel>
          <div className="mt-3 flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              type="range" min={1} max={2.5} step={0.01} value={crop.zoom}
              onChange={e => onCrop({ ...crop, zoom: Number(e.target.value) })}
              className="w-full accent-[#C9A24D]"
              aria-label="Zoom"
            />
            <span className="w-10 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">{Math.round(crop.zoom * 100)}%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCrop({ ...crop, fit: !crop.fit, zoom: 1 })}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${crop.fit ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'}`}
        >
          <span className="flex items-center gap-3">
            <Maximize2 className="h-5 w-5 shrink-0 text-[#8b7355]" />
            <span>
              <span className="block text-sm font-black text-[#111827] dark:text-white">Show the whole photo</span>
              <span className="block text-xs font-semibold text-gray-400">Nothing cut off - the edges fill with a soft blur of it.</span>
            </span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${crop.fit ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-white/15'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${crop.fit ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
        <div>
          <SectionLabel>Quick framing</SectionLabel>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([['Top', 50, 15], ['Center', 50, 50], ['Bottom', 50, 85], ['Left', 15, 50], ['Right', 85, 50]] as const).map(([label, x, y]) => {
              const on = Math.round(crop.x) === x && Math.round(crop.y) === y
              return (
                <button key={label} type="button" onClick={() => onCrop({ ...crop, x, y })}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
                  {label}
                </button>
              )
            })}
            <button type="button" onClick={() => onCrop({ x: 50, y: 50, zoom: 1, fit: false })}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 py-2 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-[#f7f5f1] px-4 py-3 text-xs font-semibold leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <Crop className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7355]" /> Your photo file is never cut - this only sets what shows in this design. Change it again any time in the editor.
        </p>
      </div>
    </div>
  )
}

// Price + street address for listing designs: the listing's own price (Just Sold: the sale price
// when known, else its last list price), a price the agent types, or no price - and an option to
// show just the town instead of the street.
// "412 RIDGEMONT DR" -> "412 Ridgemont Dr"; "412 Ridgemont Dr" -> "Ridgemont Dr".
const niceStreet = (v: string) => (/[a-z]/.test(v) ? v : v.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()))
const stripNumber = (v: string) => v.replace(/^\s*\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?\s+/, '').trim() || v

function PriceAndAddress({ situationId, property, mode, onMode, manual, onManual, previous, onPrevious, hideStreet, onHideStreet, hideNumber, onHideNumber }: {
  situationId: DesignSituationId | null; property: LinkedProperty | null
  mode: 'listing' | 'manual' | 'hidden'; onMode: (m: 'listing' | 'manual' | 'hidden') => void
  manual: string; onManual: (v: string) => void; previous: string; onPrevious: (v: string) => void
  hideStreet: boolean; onHideStreet: (v: boolean) => void
  hideNumber: boolean; onHideNumber: (v: boolean) => void
}) {
  const sold = situationId === 'just_sold'
  const listingValue = sold && property?.close_price ? property.close_price : property?.price
  const listingLine = !property ? 'Fills in from the listing' : !money(listingValue) ? 'No price on file' : money(listingValue)
  const listingNote = !property ? '' : sold ? (property.close_price ? 'Sale price · shows “Sold for”' : 'Last list price · shows “Listed at”') : situationId === 'price_improvement' ? 'Current list price' : 'Current list price'
  const digits = (v: string) => v.replace(/[^\d]/g, '')
  const pretty = (v: string) => (v ? Number(v).toLocaleString('en-US') : '')
  return (
    <section>
      <SectionLabel>Price on the design</SectionLabel>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <OptionCard selected={mode === 'listing'} onClick={() => onMode('listing')}>
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{sold ? 'From the sale' : 'From the listing'}</p>
          <p className="mt-1 font-serif text-xl font-black text-[#111827] dark:text-white">{listingLine}</p>
          {listingNote && <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{listingNote}</p>}
        </OptionCard>
        <OptionCard selected={mode === 'manual'} onClick={() => onMode('manual')}>
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{sold ? 'Enter the sale price' : 'Enter a price'}</p>
          <div className="mt-1 flex items-center gap-1 font-serif text-xl font-black text-[#111827] dark:text-white">
            <span>$</span>
            <input
              value={pretty(manual)}
              onChange={e => { onManual(digits(e.target.value)); onMode('manual') }}
              onFocus={() => onMode('manual')}
              inputMode="numeric"
              data-enter-continues="true"
              placeholder={property?.price ? Number(listingValue || property.price).toLocaleString('en-US') : '1,250,000'}
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{sold ? 'Shows as “Sold for”' : 'Any price you want to show'}</p>
        </OptionCard>
        <OptionCard selected={mode === 'hidden'} onClick={() => onMode('hidden')}>
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">No price</p>
          <p className="mt-1 flex items-center gap-1.5 font-serif text-xl font-black text-[#111827] dark:text-white"><EyeOff className="h-4 w-4 text-gray-400" /> Leave it off</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">Turn it back on any time</p>
        </OptionCard>
      </div>
      {situationId === 'price_improvement' && mode !== 'hidden' && (
        <label className="mt-3 block max-w-xs">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">Was (optional - shown struck through)</span>
          <input
            value={pretty(previous)}
            onChange={e => onPrevious(digits(e.target.value))}
            inputMode="numeric"
            placeholder={property?.original_price ? Number(property.original_price).toLocaleString('en-US') : 'Previous price'}
            className={inputClass}
          />
        </label>
      )}
      {/* How much of the address shows - sellers who want privacy can drop the house number, or
          the whole street and show just the town. */}
      <div className="mt-4">
        <SectionLabel>Address on the design</SectionLabel>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ['full', 'Full address', property?.address ? niceStreet(property.address) : '412 Ridgemont Drive'],
            ['number', 'Hide the house number', property?.address ? stripNumber(niceStreet(property.address)) : 'Ridgemont Drive'],
            ['town', 'Town only', property?.city ? niceStreet(property.city) : 'Just the town'],
          ] as const).map(([id, label, example]) => {
            const on = (id === 'town' && hideStreet) || (id === 'number' && !hideStreet && hideNumber) || (id === 'full' && !hideStreet && !hideNumber)
            return (
              <button key={id} type="button" data-testid={`address-mode-${id}`}
                onClick={() => { onHideStreet(id === 'town'); onHideNumber(id === 'number') }}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-sm font-black text-[#111827] dark:text-white">{label}</span>{on && <Check className="h-4 w-4 shrink-0 text-[#C9A24D]" />}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-gray-400">{example}</span>
              </button>
            )
          })}
        </div>
        {(hideStreet || hideNumber) && <p className="mt-2 text-xs font-semibold text-gray-400">For sellers who want privacy. You can change it any time in the editor.</p>}
      </div>
    </section>
  )
}

// Leads: pick a form, and every response from this piece is counted in its own campaign. Built
// to be obvious - the right form is already picked, so most agents just continue.
function TrackingStep({ leadGen, situationId, forms, required, isPrint, qrOn, onQrOn, recommendedFormId, qrMode, onQrMode, formId, onForm, campaignable, campaignMode, onCampaignMode, campaignName, onCampaignName, defaultCampaignName, campaigns, loadingCampaigns, campaignId, onCampaignId, campaignRedirect, onCampaignRedirect, formGoesToHub }: {
  leadGen: boolean; situationId: DesignSituationId | null; forms: AgentFormConfig[]
  required: boolean; isPrint: boolean; qrOn: boolean; onQrOn: (v: boolean) => void; recommendedFormId: string | null
  qrMode: 'default' | 'form'; onQrMode: (m: 'default' | 'form') => void
  formId: string | null; onForm: (id: string) => void; campaignable: boolean
  campaignMode: 'new' | 'existing' | 'general'; onCampaignMode: (m: 'new' | 'existing' | 'general') => void
  campaignName: string; onCampaignName: (v: string) => void; defaultCampaignName: string
  campaigns: FormCampaign[]; loadingCampaigns: boolean; campaignId: string | null; onCampaignId: (id: string) => void
  campaignRedirect: CampaignRedirect; onCampaignRedirect: (v: CampaignRedirect) => void; formGoesToHub: boolean
}) {
  const tracking = qrMode === 'form'
  const ordered = [...forms].sort((a, b) => (a.id === recommendedFormId ? -1 : b.id === recommendedFormId ? 1 : 0))
  const noFormLabel = !isPrint ? 'No link needed' : leadGen ? 'Send them to my Agent Hub' : situationId === 'open_house' ? 'Use the open house sign-in' : 'Send them to the property page'

  if (forms.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm font-semibold text-gray-500 dark:border-white/10">
        You don’t have any forms turned on yet. <a href="/studio/site?tab=forms" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline">Turn on a form</a> to track the leads this brings in - or continue without one.
      </p>
    )
  }

  return (
    <div className="space-y-7">
      {required ? (
        <p className="flex items-start gap-2 rounded-2xl bg-[#C9A24D]/[0.08] px-4 py-3 text-sm font-semibold text-[#6f5a37] dark:text-[#d7b974]">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
          {leadGen ? 'This piece is made to bring in leads - pick the form they’ll fill out.' : 'Mailers bring in leads - pick the form people will fill out when they scan.'}
        </p>
      ) : (
        <section>
          <SectionLabel>Track leads from this design?</SectionLabel>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <OptionCard selected={tracking} onClick={() => onQrMode('form')}>
              <p className="flex items-center gap-2 text-[15px] font-black text-[#111827] dark:text-white"><Megaphone className="h-4 w-4 text-[#8b7355]" /> Yes, track leads</p>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Get a link{isPrint ? ' and QR code' : ''} to your form - see who responds.</p>
            </OptionCard>
            <OptionCard selected={!tracking} onClick={() => onQrMode('default')}>
              <p className="text-[15px] font-black text-[#111827] dark:text-white">No thanks</p>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{noFormLabel}.</p>
            </OptionCard>
          </div>
        </section>
      )}

      {tracking && (
        <>
          <section>
            <SectionLabel>Which form?</SectionLabel>
            <div className="ohp-stagger mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map(f => (
                <OptionCard key={f.id} selected={formId === f.id} onClick={() => onForm(f.id)}>
                  <p className="pr-6 text-sm font-black text-[#111827] dark:text-white">{f.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                    {FORM_TYPE_LABELS[f.form_type] || 'Form'}
                    {f.id === recommendedFormId && <span className="rounded-full bg-[#C9A24D]/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Best fit</span>}
                  </p>
                </OptionCard>
              ))}
            </div>
          </section>

          {formId && (
            <section>
              <SectionLabel>Campaign</SectionLabel>
              {campaignable ? (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <OptionCard selected={campaignMode !== 'existing'} onClick={() => onCampaignMode('new')}>
                    <p className="text-sm font-black text-[#111827] dark:text-white">New campaign <span className="ml-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Recommended</span></p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Its own link{isPrint ? ' and QR' : ''} - this piece’s leads counted on their own.</p>
                    {campaignMode !== 'existing' && (
                      <input
                        value={campaignName}
                        onChange={e => onCampaignName(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder={defaultCampaignName}
                        maxLength={120}
                        data-enter-continues="true"
                        aria-label="Campaign name"
                        className={inputClass}
                      />
                    )}
                  </OptionCard>
                  <OptionCard selected={campaignMode === 'existing'} onClick={() => onCampaignMode('existing')}>
                    <p className="text-sm font-black text-[#111827] dark:text-white">Add to one I already have</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Count it together with an existing campaign.</p>
                    {campaignMode === 'existing' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {loadingCampaigns && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</span>}
                        {!loadingCampaigns && campaigns.length === 0 && <span className="text-xs font-semibold text-gray-400">None yet on this form - start a new one.</span>}
                        {campaigns.map(c => (
                          <button
                            key={c.id!}
                            type="button"
                            onClick={e => { e.stopPropagation(); onCampaignId(c.id!) }}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-black transition ${campaignId === c.id ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}
                          >
                            {c.name} <span className="font-semibold text-gray-400">· {c.leads} lead{c.leads === 1 ? '' : 's'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </OptionCard>
                  {campaignMode !== 'existing' && (
                    <div className="sm:col-span-2 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                      <CampaignRedirectPicker value={campaignRedirect} onChange={onCampaignRedirect} formGoesToHub={formGoesToHub} compact />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-[#f7f5f1] px-4 py-3 text-xs font-semibold leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  Custom forms use one link - every response shows under this form in Forms.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {isPrint ? (
        <button
          type="button"
          onClick={() => onQrOn(!qrOn)}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${qrOn ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'}`}
        >
          <span className="flex items-center gap-3">
            <QrCode className="h-5 w-5 shrink-0 text-[#8b7355]" />
            <span>
              <span className="block text-sm font-black text-[#111827] dark:text-white">Put a QR code on it</span>
              <span className="block text-xs font-semibold text-gray-400">{qrOn ? 'People scan it with their phone camera.' : 'Off - you’ll still get the link at the end.'}</span>
            </span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${qrOn ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-white/15'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${qrOn ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      ) : tracking && (
        <p className="text-xs font-semibold text-gray-400">Social posts don’t get a QR code - you’ll get a link to paste in your caption or bio at the end.</p>
      )}
    </div>
  )
}

// After Create - happy with it? Download it now, or open the editor to change anything.
function DoneView({ design, ctx, isPrint, portrait, narrow, square, campaign, formTitle, link, onEditor, onDone }: {
  design: DesignProject; ctx: DesignCanvasContext; isPrint: boolean; portrait: boolean; narrow: boolean; square: boolean
  campaign: CampaignLookup | null; formTitle: string | null; link: string | null
  onEditor: () => void; onDone: (exported: boolean) => void
}) {
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  // Phones: the Share sheet ("Save Image"), with the file made ahead of time (lib/studio/designDownload).
  const saver = useDesignSaver()
  const busy = saver.busy
  useEffect(() => {
    saver.prebuild(design.id, 'png')
    if (isPrint) saver.prebuild(design.id, 'pdf')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id])
  const download = async (kind: 'png' | 'pdf') => {
    setError('')
    const r = await saver.save(design.id, design.name, kind)
    // The raw server message ("PNG export failed: Page.goto: Timeout...") means nothing to an agent.
    if (r === 'error') { setError("We couldn't make the file just now. Try again in a moment - or open the editor and download it there."); return }
    if (r === 'cancelled') return
    setDownloaded(true)
    if (design.status === 'DRAFT') void api.designs.updateStatus(design.id, 'EXPORTED')
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-white/5 sm:px-8 sm:pt-6">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]"><Check className="h-3.5 w-3.5" /> Design created</p>
        <h2 className="mt-1 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white sm:text-[28px]">Happy with this design?</h2>
        <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Download it now - or edit it to swap the photo, change the words or price, or try another look.</p>
      </header>
      {/* grid-cols-1 = minmax(0,1fr): an auto column grew to the design's own width on phones and
          the whole screen scrolled sideways (owner 10/24). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-w-0 items-start justify-center rounded-3xl bg-[#f4f2ee] p-4 dark:bg-black/30 sm:p-8"
        >
          <div className="w-full shadow-[0_24px_60px_rgba(0,0,0,0.22)]" style={{ maxWidth: portrait ? (narrow ? 240 : 420) : square ? 520 : 760 }}>
            <DesignPreview blocks={design.blocks} ctx={ctx} rounded={false} />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 space-y-3"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Looks good</p>
          {isPrint && (
            <p className="rounded-2xl bg-[#fffaf0] px-4 py-3 text-xs font-semibold leading-snug text-gray-600 dark:bg-white/5 dark:text-gray-300">
              Before it goes out: if your brokerage reviews marketing, get their OK first.{design.design_type === 'door_hanger' ? ' Door hangers go on doors only - never inside mailboxes (federal law).' : ''}
            </p>
          )}
          {isPrint && (
            <button type="button" onClick={() => download('pdf')} disabled={!!busy} className="flex w-full items-center gap-3 rounded-2xl bg-[#111827] px-4 py-3.5 text-left text-white shadow-sm transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#111827]">
              {busy === 'pdf' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Printer className="h-5 w-5 shrink-0" />}
              <span><span className="block text-sm font-black">{saver.phone ? 'Save' : 'Download'} print-ready PDF</span><span className="block text-[11px] font-semibold opacity-60">Exact size, 300 DPI - send to your printer</span></span>
            </button>
          )}
          <button type="button" onClick={() => download('png')} disabled={!!busy} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm transition disabled:opacity-60 ${isPrint ? 'border border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/5 dark:text-white' : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]'}`}>
            {busy === 'png' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Download className="h-5 w-5 shrink-0" />}
            <span><span className="block text-sm font-black">{saver.phone ? 'Save image' : 'Download PNG'}</span><span className="block text-[11px] font-semibold opacity-60">{isPrint ? 'Full resolution image' : 'Ready to post - full resolution'}</span></span>
          </button>
          {downloaded && <p className="text-xs font-bold text-emerald-600">{saver.phone ? 'Saved' : 'Downloaded'} - it’s in your designs too.</p>}
          {saver.sheet}
          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
              <button type="button" onClick={onEditor} className="mt-1.5 block font-black underline underline-offset-2">Open the editor</button>
            </div>
          )}

          {link && (
            <div className="rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white"><Megaphone className="h-3.5 w-3.5 text-[#8b7355]" /> {campaign ? `Tracking as “${campaign.name}”` : `Linked to ${formTitle}`}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                {isPrint ? 'Your link - share it anywhere too.' : 'Paste this link in your caption, bio or Story.'} Every response shows in Forms{campaign ? ' under this campaign' : ''}.
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-black/30">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-600 dark:text-gray-300">{link}</span>
                <button
                  type="button"
                  onClick={() => { copyText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }}
                  className="shrink-0 rounded-lg bg-[#111827] px-2.5 py-1 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-3">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Want to change something?</p>
            <button type="button" onClick={onEditor} className="mt-2 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-3.5 text-left transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.04] dark:border-white/10">
              <PenLine className="h-5 w-5 shrink-0 text-[#8b7355]" />
              <span><span className="block text-sm font-black text-[#111827] dark:text-white">Edit this design</span><span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">Swap the photo, change any words or the price, pick another layout or color</span></span>
            </button>
          </div>
        </motion.div>
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/5 sm:px-8">
        <button type="button" onClick={() => onDone(downloaded)} className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
          <Check className="h-4 w-4" /> Done
        </button>
      </footer>
    </div>
  )
}
