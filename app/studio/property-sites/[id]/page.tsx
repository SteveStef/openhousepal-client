'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { smartBackClick } from '@/lib/navHistory'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clapperboard, Copy, Download, ExternalLink, Eye, EyeOff, Globe, Home,
  Image as ImageIcon, Images, Loader2, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Upload, Video, Wand2, X,
  Box, Calculator, FileText, LayoutTemplate, Mail, MessageSquare, PartyPopper,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import FormQrCode from '@/components/forms/FormQrCode'
import ChaptersEditor from '@/components/property-sites/ChaptersEditor'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import { HEADER_DEMO, LIVING_PHOTO_ENABLED, MEDIA_LAB_DEMO, HeaderPhotoTips, HeroPreviewFrame, KeepGoing, KeepGoingNote, ScaledPreview, WorkingBar } from '@/components/property-sites/editor/FlowParts'
import RoomsStep from '@/components/property-sites/editor/RoomsStep'
import HeroFramer from '@/components/property-sites/editor/HeroFramer'
import type { HeaderMode, HeaderMotion, HeroFrame, SpotlightHeader, TownPhoto } from '@/components/property-sites/spotlight/model'
import type { TownFacts } from '@/components/property-sites/spotlight/TownSection'
import { allFeatureTags as allTags, autoFeatured, rankFeature } from '@/components/property-sites/spotlight/features'
import api from '@/lib/api-service'
import { notify } from '@/contexts/ToastContext'
import { propertyWebsitePublicUrl } from '@/lib/publicResourceLinks'
import type { PropertyWebsite, PropertyWebsiteAgent, PropertyWebsiteChapter, PropertyWebsiteDocument, PropertyWebsiteFloorPlan, PropertyWebsiteOpenHouse, PropertyWebsiteTemplateId, StudioMediaAsset, SiteDomain } from '@/types'
import { copyText } from '@/lib/copyText'

// Every toggle here maps 1:1 to a section_visibility key both public templates read (see
// components/property-sites/spotlight/model.ts buildSpotlight). A section with no content hides
// itself regardless - these only let the agent hide one that DOES have content.
const SECTION_LABELS: Record<string, string> = {
  story: 'Property Story', gallery: 'Photo Gallery', features: 'Features & Amenities', video: 'AI Video',
  virtual_tour: '3D Virtual Tour', floor_plans: 'Floor Plans', details: 'Property Details',
  location: 'Location & Schools', explore_nearby: 'Explore Nearby (places)', payment: 'Payment Estimator',
  open_houses: 'Open Houses', documents: 'Documents', agents: 'Listing Agent', town: 'About the Town',
  guest_tools: 'Follow this home & fact sheet', signature: 'My email signature card (in Listing Agent)',
}
// Which part of the page each switch controls (the Sections step's live preview glides there).
const SECTION_ANCHORS: Record<string, string> = {
  story: 'story', gallery: 'photos', features: 'features', video: 'video', virtual_tour: 'tour', floor_plans: 'floor-plans',
  details: 'details', location: 'location', explore_nearby: 'explore-nearby', payment: 'payment', open_houses: 'open-houses',
  documents: 'documents', agents: 'agent', town: 'town', guest_tools: 'guest-tools', signature: 'agent',
}

const TEMPLATE_OPTIONS: { id: PropertyWebsiteTemplateId; name: string; blurb: string; preview: string }[] = [
  { id: 'editorial_estate', name: 'Editorial Estate', blurb: 'Paper-light, like a magazine feature.', preview: 'linear-gradient(135deg, #f3efe6 0%, #f3efe6 55%, #10201e 55%, #10201e 80%, #d9c38d 80%, #d9c38d 100%)' },
  { id: 'cinematic_luxury', name: 'Luxe', blurb: 'Midnight and gold - full-bleed, film-like, the OpenHousePal Luxe look.', preview: 'linear-gradient(135deg, #0A0A0A 0%, #0A0A0A 62%, #C9A24D 62%, #C9A24D 100%)' },
]
const TEMPLATE_NAMES: Record<string, string> = Object.fromEntries(TEMPLATE_OPTIONS.map(t => [t.id, t.name]))

// The guided flow, like Studio's: one thing at a time, Back / Next, jump to any step.
const STEPS = [
  { key: 'design', label: 'Design' },
  { key: 'header', label: 'Header' },
  { key: 'story', label: 'Story' },
  { key: 'standouts', label: 'Stand-outs' },
  { key: 'town', label: 'The town' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'extras', label: 'Extras' },
  { key: 'sections', label: 'Sections' },
  { key: 'review', label: 'Review & publish' },
] as const
type StepKey = typeof STEPS[number]['key']

const MOTIONS: { id: HeaderMotion; label: string }[] = [
  { id: 'out', label: 'Slow zoom out' },
  { id: 'in', label: 'Slow zoom in' },
  { id: 'both', label: 'Both (drifts in and out)' },
  { id: 'none', label: 'No movement' },
]
type TownPhotoOption = { url: string; thumb: string; caption: string; credit: string; source_url: string | null }
type HeaderVideo = NonNullable<SpotlightHeader['video']>

function PropertySiteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [site, setSite] = useState<PropertyWebsite | null>(null)
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<StudioMediaAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [justPublished, setJustPublished] = useState(false)
  const [downloadQr, setDownloadQr] = useState<(() => void) | null>(null)
  const handleQrReady = useCallback((fn: () => void) => setDownloadQr(() => fn), [])

  // Editable draft state, seeded from the server draft once loaded.
  const [heroImage, setHeroImage] = useState<string | null>(null)
  const [storyPhoto, setStoryPhoto] = useState<string | null>(null)
  // The photo beside the story is picked by AI (the same cheap photo pass Room by room uses) -
  // the agent just sees what it chose and can swap it.
  const [storyPick, setStoryPick] = useState<'idle' | 'busy' | 'ai' | 'mine'>('idle')
  const [storyPickerOpen, setStoryPickerOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [storyMode, setStoryMode] = useState<'short' | 'original'>('original')
  const [storyShort, setStoryShort] = useState<string | null>(null)
  const [storyBusy, setStoryBusy] = useState(false)
  const [featured, setFeatured] = useState<string[]>([])
  const [notableFacts, setNotableFacts] = useState<string[]>([])
  const [highlights, setHighlights] = useState<string[]>([])
  const [chapters, setChapters] = useState<PropertyWebsiteChapter[]>([])
  const [suggestingHighlights, setSuggestingHighlights] = useState(false)
  const [town, setTown] = useState<{ name: string; body: string; hidden: boolean; facts: TownFacts | null; photo?: TownPhoto | null; photo_off?: boolean }>({ name: '', body: '', hidden: false, facts: null })
  const [townPhotos, setTownPhotos] = useState<TownPhotoOption[] | null>(null)
  const [townPickerOpen, setTownPickerOpen] = useState(false)
  const [townUploading, setTownUploading] = useState(false)
  const [townBusy, setTownBusy] = useState(false)
  const [autoSetupDone, setAutoSetupDone] = useState(true)
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null)
  const [virtualTourUrl, setVirtualTourUrl] = useState('')
  const [floorPlans, setFloorPlans] = useState<PropertyWebsiteFloorPlan[]>([])
  const [documents, setDocuments] = useState<PropertyWebsiteDocument[]>([])
  const [agents, setAgents] = useState<PropertyWebsiteAgent[]>([])
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [templateId, setTemplateId] = useState<PropertyWebsiteTemplateId>('cinematic_luxury')
  // New sites start at the beginning of the flow. After that the step the agent was on is
  // remembered per site, so the AI finishing (which tidies ?new&story off the address) or a
  // refresh never jumps them to Review & publish before they've been through it. Opened later:
  // an unpublished page picks up where they left off (Design if they never started), a live page
  // opens on its overview.
  const stepStore = `spotlight-step:${id}`
  const [step, setStep] = useState<StepKey>(() => {
    if (searchParams.get('new') || searchParams.get('story')) return 'design'
    try { const saved = localStorage.getItem(stepStore); if (saved && STEPS.some(x => x.key === saved)) return saved as StepKey } catch { /* private mode */ }
    return 'review'
  })
  useEffect(() => { try { localStorage.setItem(stepStore, step) } catch { /* private mode */ } }, [step, stepStore])
  // The header: how it moves, plus the AI living photo (made in the background while the agent
  // carries on through the flow, then shown side by side with the still photo at the end).
  const [header, setHeader] = useState<{ motion: HeaderMotion; video: HeaderVideo | null; frame: HeroFrame | null }>({ motion: 'out', video: null, frame: null })
  const [headerChoice, setHeaderChoice] = useState<HeaderMode>('photo')
  const [job, setJob] = useState<{ status: 'processing' | 'looping' | 'ready' | 'failed'; startedAt: number; error?: string; costUsd?: number } | null>(null)
  const [startingVideo, setStartingVideo] = useState(false)
  // Remakes only: what was wrong last time ("keep the gate still") - added to the AI's instructions.
  const [fixNote, setFixNote] = useState('')
  const [headerClosing, setHeaderClosing] = useState(false)
  const [remaking, setRemaking] = useState(false)
  const [estimate, setEstimate] = useState<{ styles: Record<'dusk', { usd: number; percent: number | null }>; limit_usd: number | null; used_percent: number | null; rooms?: { usd: number; percent: number | null } } | null>(null)
  const [usageTick, setUsageTick] = useState(0)
  const [compare, setCompare] = useState<'video' | 'photo'>('video')
  const [clock, setClock] = useState(() => Date.now())
  const [autoPublishing, setAutoPublishing] = useState(false)
  const sectionsFrame = useRef<HTMLIFrameElement>(null)
  // Only the agent-typed dates - Open House Manager / MLS open houses are read live on the
  // public page, never copied into the draft.
  const [openHouses, setOpenHouses] = useState<PropertyWebsiteOpenHouse[]>([])
  const [savedKey, setSavedKey] = useState('')
  const { user } = useAuth()
  // The agent's Website-Builder custom domains, if any - a published Spotlight is also served at
  // <domain>/listings/<slug>, so the copied share link should use that when it exists.
  const [siteDomains, setSiteDomains] = useState<SiteDomain[]>([])
  // First-open automatic setup: which steps are running / done (drives the setup card).
  // 'skip' = never needed (not shown); 'fail' = tried and came back empty (row stays, so nothing jumps)
  const [setupSteps, setSetupSteps] = useState<{ key: string; label: string; state: 'wait' | 'run' | 'done' | 'skip' | 'fail' }[]>([])

  const stepPicked = useRef(false)
  const load = async () => {
    setLoading(true)
    const { success, data } = await api.propertySites.get(id)
    if (success && data) {
      setSite(data)
      // First load only: a live page opens on its overview; one not published yet opens where the
      // agent left off - Design when they never got going (no remembered step, no ?new link).
      if (!stepPicked.current) {
        stepPicked.current = true
        let saved: string | null = null
        try { saved = localStorage.getItem(stepStore) } catch { /* private mode */ }
        if (data.status === 'PUBLISHED' && !searchParams.get('new')) setStep('review')
        else if (!saved && !searchParams.get('new') && !searchParams.get('story')) setStep('design')
      }
      const d = data.draft_data || {}
      setHeroImage(d.hero_image ?? data.property_snapshot.photos?.[0] ?? null)
      setStoryPhoto((d as { story_photo?: string | null }).story_photo ?? null)
      setDescription(d.description_override ?? data.property_snapshot.description ?? '')
      setStoryMode(d.story_mode === 'short' ? 'short' : 'original')
      setStoryShort(d.story_short || null)
      setFeatured(d.featured_amenities || [])
      setNotableFacts(d.notable_facts || [])
      setHighlights(d.highlights || [])
      setChapters(d.chapters || [])
      setTown({ name: d.town_story?.name || tidyTown(data.property_snapshot.city) || '', body: d.town_story?.body || '', hidden: !!d.town_story?.hidden, facts: d.town_story?.facts || null, photo: d.town_story?.photo || null, photo_off: !!(d.town_story as { photo_off?: boolean } | null | undefined)?.photo_off })
      const h = d.header || {}
      setHeader({ motion: h.motion || 'out', video: h.video?.asset_id ? h.video : null, frame: h.frame || null })
      setHeaderChoice(LIVING_PHOTO_ENABLED && (h.mode === 'video' || (h.video?.asset_id && !h.video?.url)) ? 'video' : h.mode === 'cycle' ? 'cycle' : 'photo')
      if (LIVING_PHOTO_ENABLED && h.video?.asset_id) setJob({ status: h.video.url ? 'ready' : 'processing', startedAt: Date.now() })
      setAutoSetupDone(!!d.auto_setup_done)
      setVideoAssetId(d.video_asset_id ?? null)
      setVirtualTourUrl(d.virtual_tour_url || '')
      setFloorPlans(d.floor_plans || [])
      setDocuments(d.documents || [])
      setAgents(d.agents || [])
      setVisibility(d.section_visibility || {})
      setTemplateId((d.template_id as PropertyWebsiteTemplateId) || data.template_id)
      setOpenHouses((d.open_houses || []).filter(o => o.manual))
      setSavedKey('')
    }
    setLoading(false)
  }
  // Load once per site - a second (dev double-mount) load landing after the first-open setup
  // had started would wipe the amenities it just picked.
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (loadedFor.current === id) return
    loadedFor.current = id
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    api.mediaLab.listAssets({ limit: 60 }).then(({ success, data }) => {
      if (success && data) setVideos(data.assets.filter(a => a.kind === 'video' && a.status === 'succeeded'))
    })
    api.sites.getDomains().then(({ success, data }) => {
      if (success && data) setSiteDomains(data)
    }).catch(() => {})
  }, [])

  // Videos are already scoped server-side to this agent's own account; only a real address (or
  // listing_key) match is offered, so a video made for a different property never appears here.
  // Hands this home to AI Media (new tab) so the agent lands on "Pick photos" for a video.
  const openVideoMaker = () => {
    if (!site) return
    const snap = site.property_snapshot
    try {
      localStorage.setItem('ohp:media-prefill', JSON.stringify({
        at: Date.now(), mode: 'video',
        property: {
          listing_key: site.listing_key || snap.listing_key || null, address: snap.address, city: snap.city, state: snap.state, zipcode: snap.zipcode,
          price: snap.price, beds: snap.beds, baths: snap.baths, sqft: snap.sqft, acres: snap.lot_size_acres, year_built: snap.year_built,
          image_url: heroImage || snap.photos?.[0] || null, photos: heroImage ? [heroImage, ...(snap.photos || []).filter(u => u !== heroImage)] : snap.photos,
          status: snap.status, description: snap.description,
        },
      }))
    } catch { /* storage blocked - AI Media still opens, the agent just picks the home */ }
    window.open('/studio/media/new?prefill=1', '_blank', 'noopener')
  }

  const matchingVideos = useMemo(() => {
    if (!site) return []
    const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const siteAddr = norm(site.property_snapshot.address)
    return videos.filter(v => {
      const lp = v.linked_property as { listing_key?: string | null; address?: string } | null | undefined
      if (site.listing_key && lp?.listing_key) return lp.listing_key === site.listing_key
      return !!lp?.address && norm(lp.address) === siteAddr
    })
  }, [videos, site])
  const [previewVideo, setPreviewVideo] = useState<StudioMediaAsset | null>(null)

  // Every feature tag, big-ticket items first (a pool before a railing).
  const allFeatureTags = useMemo(() => {
    const f = site?.property_snapshot.features
    if (!f) return []
    const tags = allTags({ interior: f.interior || [], exterior: f.exterior || [], lifestyle: f.lifestyle || [], community: f.community || [], other: f.other || [] })
    return tags.map(rankFeature).sort((a, b) => b.score - a.score)
  }, [site])

  const toggleFeatured = (tag: string) => {
    setFeatured(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length >= 12 ? prev : [...prev, tag])
  }
  // Sections default to shown (no saved value = on), so flip what's on screen - `!prev[key]` turned
  // an unset (shown) section "on" again and the first click looked like it did nothing.
  const toggleSection = (key: string) => setVisibility(prev => ({ ...prev, [key]: prev[key] === false, ...(key === 'open_houses' ? { open_houses_by_agent: true } : {}) }))
  const originalDescription = site?.property_snapshot.description || ''

  // ---- AI helpers (each one small copywriter call, on the agent's monthly AI allowance) ----
  const aiHighlights = async (source: string): Promise<string[]> => {
    const res = await api.ai.copywrite({ purpose: 'property_site_highlights', context: source })
    if (!res.success || !res.data?.text) return []
    return res.data.text.split('\n').map(l => l.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean)
  }
  const aiShortStory = async (): Promise<string | null> => {
    if (!originalDescription.trim()) return null
    const res = await api.ai.copywrite({ purpose: 'property_site_story_short', context: originalDescription })
    return res.success && res.data?.text ? res.data.text.trim() : null
  }
  const aiTown = async (name: string): Promise<TownFacts | null> => {
    const p = site?.property_snapshot
    if (!name.trim() || !p) return null
    const context = [`Town: ${name}${p.state ? `, ${p.state}` : ''}`, p.county && `County: ${tidyTown(String(p.county).replace(/-[A-Za-z]{2}$/, ''))}`, p.township && `Township: ${tidyTown(p.township)}`].filter(Boolean).join('\n')
    const res = await api.ai.copywrite({ purpose: 'property_site_town_facts', context })
    if (!res.success || !res.data?.text) return null
    return parseTownFacts(res.data.text)
  }

  const suggestHighlights = async () => {
    const desc = description.trim()
    if (!desc) return
    setSuggestingHighlights(true)
    const suggested = await aiHighlights(desc)
    setSuggestingHighlights(false)
    setHighlights(prev => {
      const existing = new Set(prev.map(h => h.toLowerCase()))
      const merged = [...prev]
      for (const s of suggested) {
        if (merged.length >= 8) break
        if (!existing.has(s.toLowerCase())) { merged.push(s); existing.add(s.toLowerCase()) }
      }
      return merged
    })
  }

  const chooseStory = async (mode: 'short' | 'original') => {
    setStoryMode(mode)
    if (mode === 'original') { setDescription(originalDescription); return }
    if (storyShort) { setDescription(storyShort); return }
    setStoryBusy(true)
    const short = await aiShortStory()
    setStoryBusy(false)
    if (short) { setStoryShort(short); setDescription(short) } else setStoryMode('original')
  }
  const regenerateStory = async () => {
    setStoryBusy(true)
    const short = await aiShortStory()
    setStoryBusy(false)
    if (short) { setStoryShort(short); setDescription(short); setStoryMode('short') }
  }
  const regenerateTown = async () => {
    setTownBusy(true)
    const facts = await aiTown(town.name)
    setTownBusy(false)
    if (facts) setTown(t => ({ ...t, facts, body: '', hidden: false }))
  }

  // First open: pre-pick the big-ticket amenities, write the highlights, polish the story (when
  // the agent chose the short version when creating the site) and draft "About the town" - so
  // the page is complete before the agent touches anything. Runs once per site.
  const setupRan = useRef(false)
  useEffect(() => {
    if (!site || autoSetupDone || setupRan.current) return
    setupRan.current = true
    const d = site.draft_data || {}
    const wantShort = searchParams.get('story') === 'short'
    const cityName = tidyTown(site.property_snapshot.city) || ''
    const steps: { key: string; label: string; state: 'wait' | 'run' | 'done' | 'skip' | 'fail' }[] = [
      { key: 'featured', label: 'Picking the standout amenities', state: (d.featured_amenities || []).length || !allFeatureTags.length ? 'skip' : 'wait' },
      { key: 'highlights', label: 'Writing the highlights', state: (d.highlights || []).length || !description.trim() ? 'skip' : 'wait' },
      { key: 'story', label: 'Polishing the property story', state: wantShort && originalDescription.trim() ? 'wait' : 'skip' },
      { key: 'town', label: cityName ? `Writing about ${cityName}` : 'Writing about the town', state: d.town_story?.body || d.town_story?.facts || !cityName ? 'skip' : 'wait' },
    ]
    setSetupSteps(steps)
    const mark = (key: string, state: 'run' | 'done' | 'fail') => setSetupSteps(list => list.map(s => (s.key === key ? { ...s, state } : s)))
    ;(async () => {
      if (steps[0].state === 'wait') {
        mark('featured', 'run')
        setFeatured(autoFeatured(allFeatureTags.map(r => r.label)))
        await new Promise(r => setTimeout(r, 450))
        mark('featured', 'done')
      }
      const jobs: Promise<void>[] = []
      if (steps[1].state === 'wait') {
        mark('highlights', 'run')
        jobs.push(aiHighlights(description).then(list => { if (list.length) setHighlights(list.slice(0, 8)); mark('highlights', list.length ? 'done' : 'fail') }))
      }
      if (steps[2].state === 'wait') {
        mark('story', 'run')
        jobs.push(aiShortStory().then(short => {
          if (short) { setStoryShort(short); setDescription(short); setStoryMode('short') }
          mark('story', short ? 'done' : 'fail')
        }))
      }
      if (steps[3].state === 'wait') {
        mark('town', 'run')
        jobs.push(aiTown(cityName).then(facts => {
          if (facts) setTown(t => ({ ...t, name: cityName, body: '', hidden: false, facts }))
          mark('town', facts ? 'done' : 'fail')
        }))
      }
      await Promise.all(jobs)
      setAutoSetupDone(true)
      if (searchParams.get('story')) router.replace(`/studio/property-sites/${site.id}`)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, autoSetupDone])

  // template_id only rides along once it actually differs from the live template (or the draft
  // already carries one) - so merely opening + saving an old site doesn't flag "unpublished changes".
  const sendTemplate = !!site && (templateId !== site.template_id || !!site.draft_data?.template_id)
  const payload = useMemo(() => ({
    ...(sendTemplate ? { template_id: templateId } : {}),
    hero_image: heroImage,
    story_photo: storyPhoto,
    description_override: description,
    story_mode: storyMode,
    story_short: storyShort,
    featured_amenities: featured,
    notable_facts: notableFacts,
    highlights,
    chapters,
    town_story: town.body.trim() || town.facts ? town : null,
    header: {
      // A living photo that isn't ready yet never goes live - the still photo stands in.
      mode: headerChoice === 'video' ? (header.video?.url && header.video.reviewed && LIVING_PHOTO_ENABLED ? 'video' : 'photo') : headerChoice,
      motion: header.motion,
      video: header.video,
      frame: header.frame,
    },
    auto_setup_done: autoSetupDone,
    video_asset_id: videoAssetId,
    virtual_tour_url: virtualTourUrl.trim() || null,
    floor_plans: floorPlans.filter(f => f.image_url),
    documents: documents.filter(d => d.url),
    agents: agents.filter(a => a.name?.trim()),
    open_houses: openHouses.filter(o => o.date).map(o => ({ ...o, manual: true })),
    section_visibility: visibility,
  }), [sendTemplate, templateId, heroImage, storyPhoto, description, storyMode, storyShort, featured, notableFacts, highlights, chapters, town, autoSetupDone, videoAssetId, virtualTourUrl, floorPlans, documents, agents, openHouses, visibility, header, headerChoice])
  const payloadKey = JSON.stringify(payload)
  // The first render after load establishes the "saved" baseline.
  useEffect(() => { if (site && !savedKey) setSavedKey(payloadKey) }, [site, savedKey, payloadKey])
  const dirty = !!savedKey && savedKey !== payloadKey
  const liveOutOfDate = site?.status === 'PUBLISHED' && (dirty || JSON.stringify(site.draft_data) !== JSON.stringify(site.published_snapshot))

  const save = async (): Promise<boolean> => {
    if (!site) return false
    setSaving(true)
    setError('')
    const key = payloadKey
    const { success, data, error: e } = await api.propertySites.updateDraft(site.id, payload as any)
    setSaving(false)
    if (success && data) {
      setSite(data)
      setSavedKey(key)
      return true
    }
    setError(e || 'Could not save changes.')
    return false
  }
  // Autosave - every edit is kept a moment after it's made; nothing to remember to press.
  useEffect(() => {
    if (!dirty || saving || publishing) return
    const t = window.setTimeout(() => { void save() }, 1200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, payloadKey, saving, publishing])

  // The live page is cached for a few seconds - ask it to refresh right away after publishing.
  const refreshLive = () => fetch('/api/website-property-sites/revalidate', { method: 'POST' }).catch(() => {})

  const publish = async (opts?: { quiet?: boolean }) => {
    if (!site) return
    if (opts?.quiet) setAutoPublishing(true)
    setPublishing(true)
    const saved = dirty ? await save() : true
    if (!saved) { setPublishing(false); return }
    const { success, data, error: e } = await api.propertySites.publish(site.id)
    setPublishing(false)
    setAutoPublishing(false)
    if (success && data) {
      setSite(data)
      await refreshLive()
      if (!opts?.quiet) {
        if (header.video?.url && !header.video.reviewed) setHeader(h => ({ ...h, video: h.video ? { ...h.video, reviewed: true } : h.video }))
        setJustPublished(true)
        window.setTimeout(() => setJustPublished(false), 2600)
      }
    } else setError(e || 'Could not publish.')
  }

  const unpublish = async () => {
    if (!site) return
    setPublishing(true)
    const { success, data } = await api.propertySites.unpublish(site.id)
    setPublishing(false)
    if (success && data) { setSite(data); await refreshLive() }
  }

  // ---- story photo: let the AI pick it once, as soon as the editor opens ----
  useEffect(() => {
    if (!site || storyPick !== 'idle') return
    const photos = site.property_snapshot.photos || []
    if (storyPhoto || photos.length < 2) {
      const picks = ((site.draft_data as { photo_ai?: { story_photos?: string[] } } | null)?.photo_ai?.story_photos) || []
      setStoryPick(storyPhoto && picks.includes(storyPhoto) ? 'ai' : 'mine')
      return
    }
    setStoryPick('busy')
    api.propertySites.autoStoryPhoto(site.id).then(({ success, data }) => {
      if (success && data?.story_photo) {
        setStoryPhoto(cur => cur || data.story_photo)
        setStoryPick('ai')
        setUsageTick(t => t + 1)
      } else setStoryPick('mine')
    })
  }, [site?.id, storyPick]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- living photo: estimate, start, follow in the background, loop when done ----
  useEffect(() => {
    if (!site) return
    api.propertySites.headerEstimate(site.id).then(({ success, data }) => { if (success && data) setEstimate(data) })
  }, [site?.id, usageTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const headerAssetId = header.video?.asset_id || null
  // One follow-up loop for the whole processing -> looping stretch (keyed on "still working",
  // not the exact status), so moving on to "looping" never cancels the loop request in flight.
  const following = !!job && (job.status === 'processing' || job.status === 'looping')
  useEffect(() => {
    if (!site || !headerAssetId || !following) return
    let alive = true
    let busy = false
    const check = async () => {
      if (busy) return
      busy = true
      try { await step() } finally { busy = false }
    }
    const step = async () => {
      const { success, data } = await api.mediaLab.getAsset(headerAssetId)
      if (!alive || !success || !data) return
      if (data.created_at) setJob(j => (j && j.status === 'processing' ? { ...j, startedAt: Math.min(j.startedAt, Date.parse(data.created_at)) } : j))
      if (data.status === 'failed') {
        setJob({ status: 'failed', startedAt: Date.now(), error: data.error_message || 'The AI couldn’t finish this one.' })
        setUsageTick(t => t + 1)
      } else if (data.status === 'succeeded' || ((data.options as Record<string, unknown> | null)?.upscale_base_url && data.created_at && Date.now() - Date.parse(data.created_at) > 10 * 60 * 1000)) {
        // Same finished video as Media Lab (its 2K finish included). Only if that finish is
        // badly stuck (10+ min) is the loop built from the render underneath it.
        setJob(j => ({ ...(j || { startedAt: Date.now() }), status: 'looping' }))
        const loop = await api.propertySites.buildHeaderLoop(site.id, headerAssetId)
        if (!alive) return
        if (loop.success && loop.data) {
          const { url, poster } = loop.data
          setHeader(h => ({ ...h, video: { ...(h.video || { asset_id: headerAssetId }), url, poster } }))
          setJob({ status: 'ready', startedAt: Date.now(), costUsd: data.cost_usd ?? loop.data.cost_usd })
        } else {
          setJob({ status: 'failed', startedAt: Date.now(), error: loop.error || 'Couldn’t prepare the video for the page.' })
        }
        setUsageTick(t => t + 1)
      }
    }
    void check()
    const t = window.setInterval(check, 6000)
    return () => { alive = false; window.clearInterval(t) }
  }, [site?.id, headerAssetId, following]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (job?.status !== 'processing' && job?.status !== 'looping') return
    const t = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [job?.status])

  const startHeaderVideo = async () => {
    if (!site || !heroImage) return
    setStartingVideo(true)
    setError('')
    const { success, data, error: e } = await api.propertySites.createHeaderVideo(site.id, heroImage, fixNote.trim() || undefined)
    setStartingVideo(false)
    if (success && data) {
      setHeader(h => ({ ...h, video: { asset_id: data.asset_id, style: 'dusk', photo: heroImage, url: null, poster: null } }))
      setJob({ status: 'processing', startedAt: Date.now() })
      setHeaderChoice('video')
      setUsageTick(t => t + 1)
    } else setError(e || 'Could not start the living photo. Try again in a moment.')
  }
  const reuseHeaderVideo = (v: StudioMediaAsset) => {
    setHeader(h => ({ ...h, video: { asset_id: v.id, style: 'dusk', photo: v.source_photo_url || null, url: null, poster: null } }))
    setJob({ status: 'processing', startedAt: Date.now() })
    setHeaderChoice('video')
  }
  // Header clips already made for this home (on any of the agent's sites) - free to reuse.
  const headerVideos = matchingVideos.filter(v => {
    const o = (v.options || {}) as Record<string, any>
    return o.video_variant_effective?.label === 'spotlight_header' || String(o.custom_name || '').startsWith('Spotlight header')
  })
  // A normal Media Lab clip: render + its 2K finish, usually 3-4 minutes.
  const expectedSecs = 210
  const jobPct = !job ? 0 : job.status === 'ready' ? 100 : job.status === 'looping' ? 96 : job.status === 'failed' ? 0
    : Math.max(4, Math.min(92, Math.round(((clock - job.startedAt) / 1000 / expectedSecs) * 90)))
  // Past its usual time the bar switches to a sweeping "still working" state instead of
  // sitting on a frozen number.
  const jobOverdue = !!job && job.status === 'processing' && (clock - job.startedAt) / 1000 > expectedSecs
  const jobWorking = !!job && (job.status === 'processing' || job.status === 'looping')

  // ---- town photo: credited photos of the town itself ----
  useEffect(() => {
    if (!site || townPhotos !== null) return
    if (step !== 'town' && !(setupSteps.some(s => s.key === 'town' && s.state === 'done'))) return
    api.propertySites.townPhotos(site.id, town.name || undefined).then(({ success, data }) => {
      const list = success && data ? data.photos : []
      setTownPhotos(list)
      if (list[0]) setTown(t => (t.photo || t.photo_off ? t : { ...t, photo: { url: list[0].url, credit: list[0].credit, caption: list[0].caption, source_url: list[0].source_url } }))
    })
  }, [site?.id, step, setupSteps, townPhotos]) // eslint-disable-line react-hooks/exhaustive-deps
  const uploadTownPhoto = async (file: File) => {
    if (!site) return
    setTownUploading(true)
    const { success, data } = await api.propertySites.uploadFloorPlan(site.id, file)
    setTownUploading(false)
    if (success && data) { setTown(t => ({ ...t, photo: { url: data.url, credit: '', caption: '' }, photo_off: false })); setTownPickerOpen(false) }
    else notify("That photo couldn't be uploaded - use a JPG under 10MB.")
  }

  const stepIndex = STEPS.findIndex(x => x.key === step)
  // Snap to the step bar first, then swap the step in (its cards rise in on their own). A smooth
  // scroll while the page under it changes height fought itself and looked glitchy.
  const goStep = (key: StepKey) => {
    const nav = document.querySelector('nav[aria-label=Steps]')
    const top = nav ? nav.getBoundingClientRect().top + window.scrollY - 96 : 0
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    setStep(key)
  }

  // Once a page is live, every saved change goes live by itself - nothing to remember to press.
  const liveNow = site?.status === 'PUBLISHED'
  const outOfDate = !!site && liveNow && JSON.stringify(site.draft_data) !== JSON.stringify(site.published_snapshot)
  useEffect(() => {
    if (!liveNow || !outOfDate || dirty || saving || publishing) return
    const t = window.setTimeout(() => { void publish({ quiet: true }) }, 900)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveNow, outOfDate, dirty, saving, publishing])

  // Sections step: tell the live preview what's shown and glide it to the section just changed.
  const toggleSectionLive = (key: string) => {
    const next: Record<string, boolean> = { ...visibility, [key]: !(visibility[key] !== false), ...(key === 'open_houses' ? { open_houses_by_agent: true } : {}) }
    setVisibility(next)
    const win = sectionsFrame.current?.contentWindow
    if (!win) return
    // The preview plays it: scroll there, outline, then fold the section away / open it up.
    const anchor = SECTION_ANCHORS[key]
    if (!anchor) { win.postMessage({ type: 'ohp-preview', visibility: next }, window.location.origin); return }
    win.postMessage({ type: 'ohp-preview', change: { id: anchor, show: next[key] !== false, visibility: next } }, window.location.origin)
  }

  const copyLink = () => {
    if (!site) return
    const helperUrl = propertyWebsitePublicUrl(site.slug, siteDomains)
    copyText(helperUrl.includes('/ohp-site-render/') ? helperUrl : (site.public_url || helperUrl)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (loading) {
    return <OhpLoader />
  }
  if (!site) {
    return <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B] text-sm font-bold text-gray-500">Property website not found.</div>
  }

  const p = site.property_snapshot
  // The backend's public_url is authoritative (custom domain only while the agent's IDX site is
  // switched on); the local helper still wins in local dev, where it points at ohp-site-render.
  const helperUrl = propertyWebsitePublicUrl(site.slug, siteDomains)
  const publicUrl = helperUrl.includes('/ohp-site-render/') ? helperUrl : (site.public_url || helperUrl)
  const live = site.status === 'PUBLISHED'
  const setupRunning = setupSteps.some(s => s.state === 'run' || s.state === 'wait')
  const shownSetup = setupSteps.filter(s => s.state !== 'skip')
  const saveLabel = saving ? 'Saving…' : dirty ? 'Unsaved' : 'All changes saved'
  const cityLabel = tidyTown(p.city) || 'the town'

  // The three header looks (still / slideshow / living photo) - stacked in the left column next to
  // the live preview, or in a row above the living-photo example.
  const modeCards = (stacked: boolean) => (
    <div className={stacked ? 'space-y-2' : 'grid gap-2 sm:grid-cols-3'}>
            {([
              ['photo', ImageIcon, 'Still photo', 'Your main photo with a slow, gentle zoom.'],
              ['cycle', Images, 'Photo slideshow', 'Your listing photos dissolve one into the next.'],
              ['video', Wand2, 'Living photo', 'AI brings your main photo to life - it loops forever.'],
            ] as const).map(([id, Icon, name, blurb]) => {
              const soon = id === 'video' && !LIVING_PHOTO_ENABLED
              return (
                <button key={id} onClick={() => { if (!soon) setHeaderChoice(id) }} disabled={soon} aria-disabled={soon}
                  className={`relative w-full rounded-xl border-2 p-3 text-left transition ${stacked ? 'flex items-center gap-3' : ''} ${soon ? 'cursor-not-allowed border-dashed border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.02]' : headerChoice === id ? 'border-[#C9A24D] bg-[#C9A24D]/5 ring-2 ring-[#C9A24D]/20' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                  {soon
                    ? <span className="absolute right-2 top-2 rounded-full bg-[#111827] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#e8c97a] dark:bg-white/10">Coming soon</span>
                    : headerChoice === id && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" /></span>}
                  <Icon className={`h-4 w-4 shrink-0 ${soon ? 'text-gray-300 dark:text-gray-600' : 'text-[#C9A24D]'}`} />
                  <span className="block min-w-0 pr-16">
                  <p className={`${stacked ? '' : 'mt-2'} flex items-center gap-1.5 text-xs font-black ${soon ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#111827] dark:text-white'}`}>{name}{id === 'video' && !soon && <span className="rounded-full bg-[#111827] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#C9A24D] dark:bg-white/10">AI</span>}</p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold leading-snug text-gray-400 dark:text-gray-500">{soon ? 'AI video of your photo - being perfected' : blurb}</p>
                  </span>
                </button>
              )
            })}
          </div>
  )

  // The whole header editor (photo, how it moves, living photo). The Header step shows it, and so
  // does Review while a finished living photo is still waiting for the agent's say-so.
  const headerEditor = () => (
    <>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Main photo</p>
          <div className="grid items-start gap-4 md:grid-cols-[1.15fr_1fr]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gray-100 shadow-md dark:bg-gray-800">
              {heroImage && <img key={heroImage} src={heroImage} alt="" className="ohp-modal-pop h-full w-full object-cover" />}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white"><Check className="h-3 w-3 text-[#C9A24D]" /> Opens your page</span>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Tap any photo to make it your header.</p>
              <div className="grid max-h-[300px] grid-cols-4 gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {(p.photos || []).map(url => (
                  <button key={url} onClick={() => { if (url !== heroImage) setHeader(h => ({ ...h, frame: null })); setHeroImage(url) }} className={`relative aspect-[4/3] overflow-hidden rounded-lg transition ${heroImage === url ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-80 hover:opacity-100'}`}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {heroImage === url && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" /></span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3"><HeaderPhotoTips video={headerChoice === 'video'} /></div>
          {heroImage && headerChoice !== 'video' && (
            <div className="mt-5">
              <HeroFramer photo={heroImage} frame={header.frame} onChange={fr => setHeader(h => ({ ...h, frame: fr }))} motion={header.motion} mode={headerChoice} />
            </div>
          )}

          {headerChoice !== 'video' ? (
            <div className="mt-7 grid items-start gap-6 md:grid-cols-[minmax(240px,1fr)_2fr]">
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">How it moves</p>
                {modeCards(true)}
                <div className="mt-5">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{headerChoice === 'cycle' ? 'Each photo' : 'The photo'}</p>
                  <div className="space-y-1.5">
                    {MOTIONS.map(mo => (
                      <button key={mo.id} onClick={() => setHeader(h => ({ ...h, motion: mo.id }))}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-black transition ${header.motion === mo.id ? 'border-[#C9A24D] bg-[#C9A24D]/5 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/50 dark:border-gray-800 dark:text-gray-400'}`}>
                        {mo.label}{header.motion === mo.id && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}
                      </button>
                    ))}
                  </div>
                  {headerChoice === 'cycle' && <p className="mt-2 text-[10px] font-semibold text-gray-400">Starts with your main photo, then the next photos in your listing order - about 6 seconds each.</p>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Your page, live</p>
                <ScaledPreview
                  src={`/spotlight-preview/${templateId}?site=${site.id}&embed=1&mode=${headerChoice}&motion=${header.motion}${heroImage ? `&hero=${encodeURIComponent(heroImage)}` : ''}${header.frame ? `&fx=${header.frame.x}&fy=${header.frame.y}&fz=${header.frame.zoom}` : ''}`}
                  label={`${site.slug}.openhousepal.com`}
                />
              </div>
            </div>
          ) : (
            <>
            <p className="mb-2 mt-7 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">How it moves</p>
            {modeCards(false)}
            <div className="mt-5 space-y-5">
              {job?.status === 'ready' && header.video?.url ? (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600"><Check className="h-3.5 w-3.5" /> Your living photo, on your page</p>
                  <ScaledPreview src={`/spotlight-preview/${templateId}?site=${site.id}&embed=1&mode=video&video=${encodeURIComponent(header.video.url)}${header.video.poster ? `&poster=${encodeURIComponent(header.video.poster)}` : ''}`} label={`${site.slug}.openhousepal.com`} />
                </div>
              ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Real example · made from one photo</p>
                    <HeroPreviewFrame template={templateId} hero={HEADER_DEMO.photo} photos={[]} mode="video" motion="none" videoUrl={HEADER_DEMO.loop} videoPoster={HEADER_DEMO.photo}
                      address={HEADER_DEMO.address} place={HEADER_DEMO.place} price={HEADER_DEMO.price} stats={HEADER_DEMO.stats} label="26-old-gulph-rd.openhousepal.com" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">The photo it started from</p>
                      <img src={HEADER_DEMO.photo} alt="" className="aspect-[16/10] w-full rounded-xl object-cover shadow" />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Another Media Lab video</p>
                      <div className="relative">
                        <video src={MEDIA_LAB_DEMO.clip} poster={MEDIA_LAB_DEMO.photo} muted autoPlay loop playsInline className="aspect-video w-full rounded-xl bg-black object-cover shadow" />
                        <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 p-1 pr-2 text-[9px] font-black uppercase tracking-wide text-white">
                          <img src={MEDIA_LAB_DEMO.photo} alt="" className="h-7 w-10 rounded object-cover" /> From this photo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid items-start gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">What it does</p>
                  <div className="rounded-xl border border-[#C9A24D]/40 bg-gradient-to-br from-[#C9A24D]/10 via-transparent to-[#5b4b8a]/10 p-3.5">
                    <p className="flex items-center justify-between gap-2 text-sm font-black text-[#111827] dark:text-white">
                      Day to dusk, slow push-in
                      {estimate?.styles.dusk?.percent != null && <span className="shrink-0 text-[10px] font-black text-[#8b7355] dark:text-[#d7b974]">~{estimate.styles.dusk.percent}% of monthly AI</span>}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">The camera creeps slowly toward your home while the sky turns to sunset and the windows begin to glow. Made exactly like your Media Lab videos, then looped so it plays forever.</p>
                    <p className="mt-2 text-[10px] font-bold text-gray-400">Best with a bright daytime photo of the front.</p>
                  </div>
                </div>
                <div>
                  <MonthlyAiUsageMeter variant="card" refreshKey={usageTick} />
                  {!job || job.status === 'failed' ? (
                    <>
                      {job?.status === 'failed' && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-300">{job.error} You can try again.</p>}
                      <button onClick={startHeaderVideo} disabled={startingVideo || !heroImage}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] py-3 text-sm font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60">
                        {startingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {startingVideo ? 'Starting…' : `Yes, make my living photo${estimate?.styles.dusk?.percent != null ? ` (~${estimate.styles.dusk.percent}%)` : ''}`}
                      </button>
                      {(remaking || headerVideos.length > 0) && (
                        <label className="mt-3 block">
                          <span className="text-[11px] font-black text-[#111827] dark:text-white">Anything to fix from last time? <span className="font-semibold text-gray-400">(optional)</span></span>
                          <input value={fixNote} onChange={e => setFixNote(e.target.value.slice(0, 110))} placeholder="e.g. keep the gate still, less zoom, no new lights"
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white" />
                          <span className="mt-1 block text-[10px] font-semibold text-gray-400">We add this to the AI&apos;s instructions. It usually helps, but AI video can&apos;t promise every detail.</span>
                        </label>
                      )}
                      <p className="mt-1.5 text-[10px] font-semibold text-gray-400">A few minutes, in the background - keep going. You&apos;ll see it next to your still photo at the end and choose. It&apos;s also saved in your Media Lab.</p>
                      {headerVideos.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Already made for this home - free to reuse</p>
                          <div className="grid grid-cols-3 gap-2">
                            {headerVideos.slice(0, 6).map(v => (
                              <button key={v.id} onClick={() => reuseHeaderVideo(v)} className="relative aspect-video overflow-hidden rounded-lg bg-black ring-[#C9A24D] hover:ring-2">
                                <video src={v.result_url || undefined} muted playsInline className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3">
                      <p className="flex items-center gap-2 text-xs font-black text-[#111827] dark:text-white">
                        {job.status === 'ready' ? <Check className="h-4 w-4 text-emerald-500" /> : <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" />}
                        {job.status === 'ready' ? 'Your living photo is ready.' : job.status === 'looping' ? 'Almost done - making it loop smoothly…' : jobOverdue ? 'Still working - a few more moments…' : 'Making your living photo…'}
                      </p>
                      <div className="mt-2"><WorkingBar pct={jobPct} overdue={jobOverdue} done={job.status === 'ready'} /></div>
                      {jobWorking && <KeepGoingNote text="Keep going - it finishes in the background" />}
                      {job.status === 'ready' && (
                        <button onClick={() => { setJob(null); setHeader(h => ({ ...h, video: null })); setHeaderChoice('video'); setRemaking(true); if (step === 'review') goStep('header') }}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">
                          <RefreshCw className="h-3 w-3" /> Not happy with it? Make a new one{estimate?.styles.dusk?.percent != null ? ` (~${estimate.styles.dusk.percent}%)` : ''}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </>
          )}
    </>
  )

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      {/* Top bar: what this is, whether it's live, and the one button that matters. */}
      <div className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 dark:border-white/10 dark:bg-[#111113]/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/studio/property-sites" onClick={smartBackClick(router)} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white" aria-label="All property websites">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
            {heroImage && <img src={heroImage} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-[15px] font-black text-[#111827] dark:text-white sm:text-base">{p.address}</p>
            <p className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-gray-400">
              <span className={`inline-flex min-w-0 items-center gap-1.5 ${live ? (liveOutOfDate ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? (liveOutOfDate ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-300'}`} />
                <span className="truncate">{live ? (autoPublishing || liveOutOfDate ? 'Live · updating…' : 'Live · up to date') : 'Not published yet'}</span>
              </span>
              <span className="hidden sm:inline">· {saveLabel}</span>
            </p>
          </div>
          <div className="hidden xl:block"><MonthlyAiUsageMeter variant="inline" compact refreshKey={usageTick} /></div>
          {jobWorking && (
            <button onClick={() => goStep('review')} className="hidden items-center gap-2 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2 text-[11px] font-black text-[#8b7355] md:inline-flex dark:text-[#d7b974]" title="Your living photo is being made - it's shown at the end">
              <Clapperboard className="h-3.5 w-3.5 animate-pulse" /> Living photo
              <span className="w-16"><WorkingBar pct={jobPct} overdue={jobOverdue} /></span>
              {jobOverdue ? 'finishing' : `${jobPct}%`}
            </button>
          )}
          {live && (
            <a href={`${publicUrl}?ohp_owner=1`} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] sm:inline-flex dark:border-white/10 dark:text-white">
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
          )}
          <button
            onClick={() => publish()}
            disabled={publishing || live}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black shadow-sm transition disabled:cursor-default ${
              live
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] text-[#111827] shadow-[#C9A24D]/30 hover:-translate-y-0.5 hover:shadow-lg'
            }`}
          >
            {publishing && !autoPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : live ? <Check className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            {publishing && !autoPublishing ? 'Publishing…' : justPublished ? 'Published!' : live ? 'Live' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-32 pt-5">
        {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

        {/* Automatic setup, shown while it runs on a new site. */}
        {shownSetup.length > 0 && (
          <div className="ohp-modal-pop mb-5 overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffaf0] to-white p-5 shadow-sm dark:from-[#1c1812] dark:to-[#151517]">
            <style>{`.su-sweep{background:linear-gradient(90deg,transparent,rgba(201,162,77,.45),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:suSweep 1.3s linear infinite}@keyframes suSweep{from{background-position:-40% 0}to{background-position:140% 0}}`}</style>
            {/* Every row is there from the first frame and keeps its size - only the icon and the
                little bar under it change, so the page never shifts while the AI works. */}
            <p className="flex items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white">
              <Sparkles className="h-4 w-4 text-[#C9A24D]" /> {setupRunning ? 'Setting up your site…' : 'Your site is set up'}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{setupRunning ? 'A few seconds - everything stays editable.' : 'Look it over, change anything, then publish.'}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {shownSetup.map(s => {
                const working = s.state === 'run' || s.state === 'wait'
                return (
                  <li key={s.key} className="relative flex h-11 items-center gap-2.5 overflow-hidden rounded-xl bg-white/70 px-3 text-sm font-bold text-[#111827] ring-1 ring-[#C9A24D]/15 dark:bg-white/[0.03] dark:text-white">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${s.state === 'done' ? 'bg-emerald-500 text-white' : s.state === 'fail' ? 'bg-gray-200 text-gray-500 dark:bg-white/10' : 'bg-[#C9A24D]/15 text-[#8b7355]'}`}>
                      {s.state === 'done' ? <Check className="h-3.5 w-3.5" /> : s.state === 'fail' ? <X className="h-3 w-3" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${s.state === 'done' ? 'text-emerald-600' : 'text-gray-400'}`}>{s.state === 'done' ? 'Done' : s.state === 'fail' ? 'Skipped' : 'Working'}</span>
                    <span className={`absolute inset-x-0 bottom-0 h-[2px] ${working ? 'su-sweep' : s.state === 'done' ? 'bg-emerald-400/60' : ''}`} />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* The flow: every step, jump anywhere - a centered glass rail, a gold progress line
            behind the steps, and the current step lifted on a dark pill that glides between them. */}
        <nav className="-mx-4 mb-6 overflow-x-auto px-4 py-1 [scrollbar-width:none]" aria-label="Steps">
          <ol className="relative mx-auto flex w-max items-center gap-0.5 rounded-full border border-[#C9A24D]/25 bg-gradient-to-br from-white/90 via-[#fffdf8]/90 to-[#fbf3df]/90 p-1.5 shadow-[0_14px_34px_-22px_rgba(139,115,85,.8)] dark:border-white/10 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-[#C9A24D]/[0.06]">
            <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
            {STEPS.map((x, i) => {
              const on = x.key === step
              const done = i < stepIndex
              const liveDone = x.key === 'review' && live
              return (
                <li key={x.key} className="relative flex items-center">
                  {i > 0 && <span aria-hidden className={`h-px w-2 sm:w-3 ${i <= stepIndex ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-white/10'}`} />}
                  <button onClick={() => goStep(x.key)} className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-colors duration-300 ${on ? (liveDone ? 'text-white' : 'text-white dark:text-[#111827]') : liveDone ? 'text-emerald-700 dark:text-emerald-300' : done ? 'text-[#8b6a2b] hover:text-[#111827] dark:text-[#e8c97a] dark:hover:text-white' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}>
                    {on && <motion.span layoutId="spStepPill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className={`absolute inset-0 rounded-full shadow-[0_8px_20px_-10px_rgba(17,24,39,.8)] ${liveDone ? 'bg-emerald-600' : 'bg-gradient-to-br from-[#111827] to-[#2a2218] ring-1 ring-[#C9A24D]/50 dark:from-white dark:to-[#fbf3df]'}`} />}
                    <span className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors duration-300 ${liveDone ? 'bg-emerald-500 text-white' : on ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-[0_0_10px_rgba(201,162,77,.6)]' : done ? 'bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]' : 'bg-gray-100 dark:bg-white/10'}`}>{done || liveDone ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span className="relative whitespace-nowrap">{liveDone ? 'Live - done' : x.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {step === 'design' && (
        <EditorCard step={1} title="Pick a Design" subtitle="This is your home in each design - live. Same content either way, switch any time.">
          <div className="grid gap-5 lg:grid-cols-2">
            {TEMPLATE_OPTIONS.map(t => {
              const on = templateId === t.id
              return (
                <div key={t.id} className={`group min-w-0 rounded-2xl border-2 p-2.5 transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5 shadow-[0_18px_40px_-24px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-gray-800'}`}>
                  <button onClick={() => setTemplateId(t.id)} className="block w-full text-left" aria-pressed={on}>
                    <ScaledPreview src={`/spotlight-preview/${t.id}?site=${site.id}&embed=1`} aspect={0.62} label={`${site.slug}.openhousepal.com`} />
                  </button>
                  {/* Name, Select and Preview on one line; the blurb underneath */}
                  <div className="px-1.5 pb-1 pt-3">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 font-serif text-base font-black leading-tight text-[#111827] sm:truncate sm:text-lg dark:text-white">{t.id === 'cinematic_luxury' ? <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#C9A24D]" /><em className="bg-gradient-to-r from-[#8b6a2b] via-[#C9A24D] to-[#e8c97a] bg-clip-text font-light italic text-transparent">{t.name}</em></span> : t.name}</p>
                      <button onClick={() => setTemplateId(t.id)} aria-pressed={on}
                        className={`inline-flex min-w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition ${on ? 'bg-[#C9A24D] text-white shadow-sm' : 'bg-[#111827] text-white hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]'}`}>
                        {on ? <><Check className="h-3.5 w-3.5" /> Selected</> : 'Select'}
                      </button>
                      <a href={`/spotlight-preview/${t.id}?site=${site.id}`} target="_blank" rel="noreferrer" title="Preview" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
                        <ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Preview</span>
                      </a>
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{t.blurb}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-[11px] font-semibold text-gray-400">
            Want to see a finished page first? <a href="/spotlight-preview/editorial_estate" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline">Editorial sample</a> · <a href="/spotlight-preview/cinematic_luxury" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline">Luxe sample</a> (one of Peter Stefanatos&apos; sales).
            {live ? ' Switching changes your live page.' : ''}
          </p>
        </EditorCard>
        )}

        {step === 'header' && (
        <EditorCard step={2} title="The Header" subtitle="The first thing people see. Pick the photo, then how it moves - the preview is your real page.">
          {headerEditor()}
        </EditorCard>
        )}

        {step === 'story' && (<>
        {/* 2 - the story */}
        <EditorCard step={3} title="The Story" subtitle="The words about the home. The short version is written from your listing description - nothing made up.">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <ToggleRow icon={Calculator} title="Monthly payment calculator" body="Buyers see an estimated monthly payment and can play with the numbers." on={visibility.payment !== false} onChange={() => toggleSection('payment')} />
            <ToggleRow icon={FileText} title="Follow this home & fact sheet" body="Guests can get price / open house emails and print the key facts." on={visibility.guest_tools !== false} onChange={() => toggleSection('guest_tools')} />
          </div>
          <div className="mb-3 inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {([['short', 'Short & polished'], ['original', 'Original description']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => chooseStory(mode)} disabled={storyBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-black transition ${storyMode === mode ? 'bg-white text-[#111827] shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400'}`}>
                {mode === 'short' && (storyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" />)} {label}
              </button>
            ))}
          </div>
          <AutoTextarea
            value={description} onChange={setDescription}
            className="w-full resize-none overflow-hidden rounded-xl border border-gray-200 bg-white p-3.5 text-sm font-medium leading-relaxed text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
          />
          <p className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-400">
            <span>{description.trim().split(/\s+/).filter(Boolean).length} words</span>
            {storyMode === 'short' && <button onClick={regenerateStory} disabled={storyBusy} className="inline-flex items-center gap-1 font-black text-[#8b7355] hover:underline disabled:opacity-50 dark:text-[#d7b974]"><RefreshCw className="h-3 w-3" /> Write it again</button>}
          </p>
          <p className="mb-2 mt-6 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Photo beside the story</p>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800">
              {storyPick === 'busy'
                ? <div className="flex h-full w-full items-center justify-center animate-pulse bg-gray-200 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>
                : (storyPhoto || (p.photos || [])[2]) && <img src={storyPhoto || (p.photos || [])[2]} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">
                {storyPick === 'busy' ? 'AI is picking the best photo…' : storyPick === 'ai' ? <><Sparkles className="h-4 w-4 text-[#C9A24D]" /> Picked by AI</> : 'Your pick'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                {storyPick === 'ai' ? 'It looked at every photo and chose the one that sets the scene best next to your words.' : 'Shown next to these words on your page.'}
              </p>
              <button onClick={() => setStoryPickerOpen(o => !o)} disabled={storyPick === 'busy'} className="mt-1.5 text-[11px] font-black text-[#8b7355] hover:underline disabled:opacity-50 dark:text-[#d7b974]">
                {storyPickerOpen ? 'Done' : 'Choose a different photo'}
              </button>
            </div>
          </div>
          {storyPickerOpen && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {(p.photos || []).slice(0, 24).map(url => {
                const chosen = (storyPhoto || (p.photos || [])[2]) === url
                return (
                  <button key={url} onClick={() => { setStoryPhoto(url); setStoryPick('mine') }} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition ${chosen ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-75 hover:opacity-100'}`}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {chosen && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-white"><Check className="h-2.5 w-2.5" /></span>}
                  </button>
                )
              })}
            </div>
          )}
        </EditorCard>
        </>)}

        {step === 'standouts' && (<>
        {/* 3 - what stands out */}
        <EditorCard step={4} title="What Stands Out" subtitle="Already picked for you - the big-ticket items lead. Tap to add or remove.">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Featured amenities · {featured.length}/12</p>
          <div className="flex flex-wrap gap-2">
            {allFeatureTags.map(r => {
              const on = featured.includes(r.label)
              const Icon = r.icon
              return (
                <button
                  key={r.label} onClick={() => toggleFeatured(r.label)}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[11px] font-bold transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#d7b974]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/40 dark:border-gray-800 dark:text-gray-400'}`}
                >
                  {r.score >= 44 && <Icon className="h-3 w-3" />}{r.display}{on && <Check className="h-3 w-3" />}
                </button>
              )
            })}
            {allFeatureTags.length === 0 && <p className="text-sm font-semibold text-gray-400">No MLS feature data for this listing.</p>}
          </div>
          <p className="mb-2 mt-6 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Highlights · the phrases that scroll across the page</p>
          <StringListEditor
            items={highlights} onChange={setHighlights} max={8} placeholder="e.g. Curved Hanging Staircase"
            onSuggest={description.trim() ? suggestHighlights : undefined} suggesting={suggestingHighlights}
          />
          <p className="mb-2 mt-6 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Notable facts · optional (e.g. &ldquo;44-Car Automotive Estate&rdquo;)</p>
          <StringListEditor items={notableFacts} onChange={setNotableFacts} max={3} placeholder="e.g. 45,000-Gallon Pool" />
        </EditorCard>
        </>)}

        {step === 'town' && (<>
        {/* 4 - the town */}
        <EditorCard step={5} title={`About ${cityLabel}`} subtitle="A short section about the town - written for you, with a real photo of it. Tap anything to change it.">
          <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1f3b36] via-[#24324a] to-[#5a3d1c]">
            {town.photo?.url && <img src={town.photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            <div className="relative flex min-h-[220px] flex-col justify-end p-5 text-white sm:min-h-[260px] sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">{town.hidden ? 'Hidden on your page' : 'On your page'}</p>
              <p className="mt-1 font-serif text-4xl font-light leading-none sm:text-5xl">Life in <em className="text-[#e8c97a]">{town.name || cityLabel}.</em></p>
              {town.facts?.tagline && <p className="mt-2 max-w-xl font-serif text-base italic text-white/85">{town.facts.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {town.photo?.caption && <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold">{town.photo.caption}</span>}
                <button onClick={() => setTownPickerOpen(o => !o)} className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-[#111827] hover:bg-white">{town.photo ? 'Change photo' : 'Pick a photo'}</button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={town.name} onChange={e => setTown(t => ({ ...t, name: e.target.value }))} placeholder="Town name" className="w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white" />
            <button onClick={regenerateTown} disabled={townBusy || !town.name.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#C9A24D]/50 px-3 py-2 text-[11px] font-black text-[#8b7355] hover:bg-[#C9A24D]/5 disabled:opacity-50 dark:text-[#d7b974]">
              {townBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {town.facts || town.body ? 'Write it again' : 'Write it for me'}
            </button>
            <button onClick={() => setTown(t => ({ ...t, hidden: !t.hidden }))} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">
              {town.hidden ? <><EyeOff className="h-3.5 w-3.5" /> Hidden on the page</> : <><Eye className="h-3.5 w-3.5 text-[#C9A24D]" /> Shown on the page</>}
            </button>
          </div>
          <div className="mt-5">
            {!town.photo && <p className="text-[11px] font-semibold text-gray-400">No town photo yet - pick one below, or the section shows without one.</p>}
            {(townPickerOpen || !town.photo) && (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {townPhotos === null && <div className="col-span-3 flex items-center gap-2 py-3 text-xs font-semibold text-gray-400 sm:col-span-5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding photos of {cityLabel}…</div>}
                {(townPhotos || []).map(ph => (
                  <button key={ph.url} onClick={() => { setTown(t => ({ ...t, photo: { url: ph.url, credit: ph.credit, caption: ph.caption, source_url: ph.source_url }, photo_off: false })); setTownPickerOpen(false) }}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-lg transition ${town.photo?.url === ph.url ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-90 hover:opacity-100'}`} title={ph.caption}>
                    <img src={ph.thumb} alt={ph.caption} loading="lazy" className="h-full w-full object-cover" />
                    {ph.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">{ph.caption}</span>}
                  </button>
                ))}
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-[10px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
                  {townUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Your own
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadTownPhoto(f); e.currentTarget.value = '' }} />
                </label>
                {town.photo && (
                  <button onClick={() => { setTown(t => ({ ...t, photo: null, photo_off: true })); setTownPickerOpen(false) }} className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 text-[10px] font-black text-gray-500 hover:border-red-300 hover:text-red-600 dark:border-gray-800">
                    <X className="h-4 w-4" /> No photo
                  </button>
                )}
              </div>
            )}
            {townPhotos && townPhotos.length > 0 && <p className="mt-2 text-[10px] font-semibold text-gray-400">Free photos from Wikimedia Commons - the photographer is credited under the photo on your page.</p>}
          </div>
          {town.facts ? (
            <TownFactsEditor facts={town.facts} onChange={facts => setTown(t => ({ ...t, facts }))} />
          ) : town.body ? (
            <textarea
              value={town.body} onChange={e => setTown(t => ({ ...t, body: e.target.value }))} rows={5}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3.5 text-sm font-medium leading-relaxed text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
            />
          ) : (
            <p className="mt-3 rounded-xl border-2 border-dashed border-gray-200 p-5 text-center text-xs font-semibold text-gray-400 dark:border-gray-800">Press “Write it for me” - we’ll fill in the downtown, what {cityLabel} is known for, why people move there and how to get around.</p>
          )}
          {(town.facts || town.body) && <p className="mt-3 text-[11px] font-semibold text-gray-400">Written from general knowledge - give it a quick read, and fix or remove anything that isn’t right.</p>}
        </EditorCard>
        </>)}

        {step === 'rooms' && (<>
        {/* 5 - photo chapters */}
        <EditorCard step={6} title="Room by Room" badge="Optional · New" subtitle="Your home's best spaces, each with its own full-screen moment. AI does the sorting.">
          <RoomsStep siteId={site.id} photos={p.photos || []} chapters={chapters} onChange={setChapters} description={originalDescription || description} percent={estimate?.rooms?.percent} onSpent={() => setUsageTick(t => t + 1)} />
        </EditorCard>
        </>)}

        {step === 'extras' && (<>
        <EditorCard step={7} title="Video, Tour & Files" subtitle="All optional - anything left empty simply doesn't show.">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">AI video tour</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button onClick={() => setVideoAssetId(null)} className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left ${!videoAssetId ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 dark:border-gray-800'}`}>
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800"><Video className="h-4 w-4" /></div>
              <span className="text-xs font-black text-[#111827] dark:text-white">None</span>
            </button>
            {jobWorking && header.video?.photo && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/5 p-2.5">
                <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-black"><img src={header.video.photo} alt="" className="h-full w-full object-cover opacity-60" /><span className="fp-shimmer absolute inset-0" /></div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-[#111827] dark:text-white">Living photo</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#8b7355]"><Loader2 className="h-3 w-3 animate-spin" /> Being made - shows up in the header</span>
                </span>
              </div>
            )}
            {matchingVideos.map(v => (
              <div key={v.id} className={`group relative flex items-center gap-2 rounded-xl border-2 p-2.5 text-left ${videoAssetId === v.id ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 dark:border-gray-800'}`}>
                <button onClick={() => setVideoAssetId(v.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-black"><video src={v.result_url || undefined} className="h-full w-full object-cover" muted /></div>
                  <span className="truncate text-xs font-black text-[#111827] dark:text-white">{v.options?.custom_name || `Video · ${new Date(v.created_at).toLocaleDateString()}`}</span>
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewVideo(v) }} title="Preview this video" aria-label="Preview this video"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80">
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={openVideoMaker} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/5 p-3 text-left transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D] text-white"><Video className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black text-[#111827] dark:text-white">Make a full AI video tour of this home</span>
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">Opens Media Lab in a new tab with this home&apos;s photos ready. It shows up here when it&apos;s done.</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[#8b7355]" />
          </button>

          <div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#C9A24D] dark:bg-white/10"><Box className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-[#111827] dark:text-white">3D tour</p>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Paste a Matterport (or any 3D tour) link - it gets its own full-screen section.</p>
              </div>
              {virtualTourUrl.trim() && /^https?:\/\//i.test(virtualTourUrl.trim()) && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3 w-3" /> Added</span>}
            </div>
            <input
              value={virtualTourUrl} onChange={e => setVirtualTourUrl(e.target.value)} placeholder="https://my.matterport.com/show/?m=..."
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
            />
            {virtualTourUrl.trim() && !/^https?:\/\//i.test(virtualTourUrl.trim()) && (
              <p className="mt-1.5 text-[11px] font-bold text-amber-600">Paste the full link, starting with https:// - otherwise the tour won&apos;t show on the page.</p>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FileList
              icon={LayoutTemplate} title="Floor plans" hint="JPG or PNG" accept="image/jpeg,image/png"
              rows={floorPlans.map(f => ({ label: f.label, url: f.image_url }))}
              onChange={rows => setFloorPlans(rows.map(r => ({ label: r.label, image_url: r.url })))}
              onUpload={async file => { const { success, data } = await api.propertySites.uploadFloorPlan(site.id, file); return success && data ? data.url : null }}
            />
            <FileList
              icon={FileText} title="Documents" hint="Brochure, disclosures - PDF or image" accept="application/pdf,image/jpeg,image/png"
              rows={documents}
              onChange={rows => setDocuments(rows)}
              onUpload={async file => { const { success, data } = await api.propertySites.uploadDocument(site.id, file); return success && data ? data.url : null }}
            />
          </div>
        </EditorCard>
        <EditorCard step={7} title="Open Houses" subtitle="Pulled live from your Open House Manager and the MLS - a new one shows up on its own, and each drops off once it's over.">
          <LiveOpenHouses siteId={site.id} refreshKey={openHouses.length} />
          <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Add a date yourself</p>
          <OpenHousesEditor rows={openHouses} onChange={setOpenHouses} />
        </EditorCard>
        </>)}

        {step === 'sections' && (<>
        <EditorCard step={8} title="Show or Hide Sections" subtitle="Flip a switch and watch your page change on the right.">
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="space-y-1.5">
              {Object.entries(SECTION_LABELS).map(([key, label]) => {
                const on = visibility[key] !== false
                return (
                  <button key={key} onClick={() => toggleSectionLive(key)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${on ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1A1A1C]' : 'border-dashed border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-transparent'}`}>
                    <span className={`text-xs font-black ${on ? 'text-[#111827] dark:text-white' : 'text-gray-400 line-through'}`}>{label}</span>
                    <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} /></span>
                  </button>
                )
              })}
            </div>
            <div className="lg:sticky lg:top-24">
              <ScaledPreview ref={sectionsFrame} src={`/spotlight-preview/${templateId}?site=${site.id}&embed=1`} aspect={1.25} label={`${site.slug}.openhousepal.com`}
                onLoad={() => sectionsFrame.current?.contentWindow?.postMessage({ type: 'ohp-preview', visibility }, window.location.origin)} />
              <p className="mt-2 text-center text-[10px] font-semibold text-gray-400">Live preview - sections with nothing in them never show.</p>
            </div>
          </div>
        </EditorCard>
        </>)}

        {step === 'review' && (
          <>
            {header.video && job && !header.video.reviewed && (
              <div className={`transition-all duration-[420ms] ease-out ${headerClosing ? '-translate-y-2 scale-[.98] opacity-0' : ''}`}>
              <EditorCard step={9} title={job.status === 'ready' ? 'Your header' : 'Your living photo'} subtitle={job.status === 'ready' ? 'Your living photo is ready. Keep it, or switch to the still photo or slideshow - the preview shows exactly what you pick.' : 'Being made in the background - it usually takes 2 to 4 minutes.'}>
                {job.status === 'ready' && header.video.url ? (
                  <div>
                    {headerEditor()}
                    <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-5 dark:border-gray-800">
                      <p className="min-w-0 flex-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        {job.costUsd && estimate?.limit_usd ? <>The living photo used about <b className="text-red-600 dark:text-red-400">{Math.max(1, Math.round((job.costUsd / estimate.limit_usd) * 100))}%</b> of your monthly AI.</> : 'The living photo was charged to your monthly AI allowance.'}{' '}It&apos;s saved in your Media Lab either way.
                      </p>
                      <button onClick={() => { setHeaderClosing(true); window.setTimeout(() => { setHeader(h => ({ ...h, video: h.video ? { ...h.video, reviewed: true } : h.video })); setHeaderClosing(false) }, 420) }}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-[#111827]">
                        <Check className="h-4 w-4" /> Use this header
                      </button>
                    </div>
                  </div>
                ) : job.status === 'failed' ? (
                  <div>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-300">{job.error}</p>
                    <button onClick={() => goStep('header')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#8b7355] hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Try again in the Header step</button>
                  </div>
                ) : (
                  <div className="grid items-center gap-5 md:grid-cols-[1.4fr_1fr]">
                    <div className="relative">
                      <HeroPreviewFrame template={templateId} hero={header.video.photo || heroImage} photos={[]} mode="photo" motion="none"
                        address={tidyTown(p.address.split(',')[0])} place={[tidyTown(p.city), p.state].filter(Boolean).join(', ')} price={p.price ? `$${Math.round(p.price).toLocaleString()}` : null} stats={[]} />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 overflow-hidden rounded-b-xl"><span className="hvd-shimmer absolute inset-0" /></div>
                    </div>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-[#111827] dark:text-white"><Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> {job.status === 'looping' ? 'Making it loop smoothly…' : jobOverdue ? 'Finishing up…' : 'Bringing your photo to life…'}</p>
                      <div className="mt-3"><WorkingBar pct={jobPct} overdue={jobOverdue} /></div>
                      <p className="mt-1.5 text-[11px] font-semibold text-gray-400">{jobOverdue ? 'Taking a little longer than usual - still working.' : `${jobPct}%`} You can publish now - the still photo shows until you choose the living photo.</p>
                    </div>
                  </div>
                )}
              </EditorCard>
              </div>
            )}

            {(() => {
              const roomCount = chapters.filter(c => c.enabled && c.photos.length).length
              const extras = [videoAssetId && 'video', virtualTourUrl.trim() && '3D tour', floorPlans.some(f => f.image_url) && 'floor plans', documents.some(d => d.url) && 'documents'].filter(Boolean).join(' · ')
              const hidden = Object.values(visibility).filter(v => v === false).length
              const townOn = !(town.hidden || !(town.facts || town.body))
              // Every step counts as done once it's been chosen - "none added" or "not shown" is a
              // choice too. The 9th step is publishing itself.
              const rows: [StepKey, string, string, typeof Home][] = [
                ['design', 'Design', TEMPLATE_NAMES[templateId], LayoutTemplate],
                ['header', 'Header', headerChoice === 'cycle' ? `Photo slideshow · ${MOTIONS.find(x => x.id === header.motion)?.label.toLowerCase()}` : `Still photo · ${MOTIONS.find(x => x.id === header.motion)?.label.toLowerCase()}`, ImageIcon],
                ['story', 'Story', `${storyMode === 'short' ? 'Short & polished' : 'Original'} · ${description.trim().split(/\s+/).filter(Boolean).length} words`, FileText],
                ['standouts', 'Stand-outs', `${featured.length} amenities · ${highlights.length} highlights`, Sparkles],
                ['town', 'The town', townOn ? `${town.name}${town.photo ? ' · with photo' : ''}` : 'Not shown', Home],
                ['rooms', 'Room by room', roomCount ? `${roomCount} spaces` : 'Not used', Images],
                ['extras', 'Extras', extras || 'None added', Box],
                ['sections', 'Sections', hidden ? `${hidden} hidden` : 'Everything shown', Eye],
              ]
              const doneCount = rows.length + (live ? 1 : 0)
              return (
                <section className="ohp-rise mt-4 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                  <style>{`.rv-shine{position:relative;overflow:hidden}.rv-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-100%);animation:rvShine 3.2s ease-in-out infinite}@keyframes rvShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}.rv-seg{transform-origin:left;animation:rvSeg .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i)*90ms + .2s)}@keyframes rvSeg{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (prefers-reduced-motion:reduce){.rv-shine:after,.rv-seg{animation:none}}`}</style>
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1a17] via-[#111827] to-[#3a2c14] p-5 text-white sm:p-7">
                    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C9A24D]/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
                    <div className="relative grid items-center gap-6 lg:grid-cols-[1.3fr_1fr]">
                      <ScaledPreview src={`/spotlight-preview/${templateId}?site=${site.id}&embed=1`} aspect={0.6} label={`${site.slug}.openhousepal.com`} />
                      <div>
                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><span className="h-px w-6 bg-[#e8c97a]" /> Step 9 · Review &amp; publish</p>
                        <h3 className="mt-2 font-serif text-3xl font-black leading-[1.05] sm:text-4xl">{live ? <>Your page is <em className="font-light text-[#e8c97a]">live.</em></> : <>Your page is <em className="font-light text-[#e8c97a]">ready.</em></>}</h3>
                        <p className="mt-2 text-[13px] font-semibold text-white/60">{live ? <><span className="font-black text-white/85">All {STEPS.length} steps done.</span> <span className="lg:whitespace-nowrap">Tap any card below to change something - it goes live&nbsp;by&nbsp;itself.</span></> : `${doneCount} of ${STEPS.length} steps done - publish to finish.`}</p>
                        <div className="mt-4 flex gap-1.5" aria-hidden>
                          {STEPS.map((x, i) => <span key={x.key} className={`rv-seg h-1.5 flex-1 rounded-full ${i < doneCount ? 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]' : 'bg-white/15'}`} style={{ ['--i' as string]: i }} />)}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2">
                          {!live && (
                            <button onClick={() => publish()} disabled={publishing}
                              className="rv-shine inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-6 py-3.5 text-sm font-black text-[#111827] shadow-xl shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 disabled:opacity-70">
                              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} {publishing ? 'Publishing…' : 'Publish my page'}
                            </button>
                          )}
                          <button onClick={async () => { const url = `/spotlight-preview/${templateId}?site=${site.id}`; const w = window.open('about:blank', '_blank'); if (dirty) await save(); if (w) w.location.href = url; else window.open(url, '_blank') }}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm font-black text-white transition hover:border-[#e8c97a] hover:bg-white/10 ${live ? 'flex-1' : ''}`}>
                            <Eye className="h-4 w-4" /> Preview my page
                          </button>
                          {live && (
                            <button onClick={unpublish} disabled={publishing}
                              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-black text-white/70 transition hover:border-red-400/70 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60">
                              <EyeOff className="h-4 w-4" /> Take offline
                            </button>
                          )}
                        </div>
                        {live && (
                          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5">
                            <FormQrCode url={publicUrl} size={58} onDownloadReady={handleQrReady} />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300"><PartyPopper className="h-3 w-3" /> Live · share it</p>
                              <p className="truncate font-mono text-[11px] text-white/80">{publicUrl.replace(/^https?:\/\//, '')}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg bg-[#C9A24D] px-2.5 py-1.5 text-[10px] font-black text-[#111827] transition hover:brightness-110">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}</button>
                                <button onClick={() => downloadQr?.()} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-white/10"><Download className="h-3 w-3" /> QR</button>
                                <a href={`sms:?&body=${encodeURIComponent(publicUrl)}`} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-white/10"><MessageSquare className="h-3 w-3" /> Text</a>
                                <a href={`mailto:?subject=${encodeURIComponent(p.address)}&body=${encodeURIComponent(publicUrl)}`} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-white/10"><Mail className="h-3 w-3" /> Email</a>
                                <a href={`${publicUrl}?ohp_owner=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-white/10"><ExternalLink className="h-3 w-3" /> Open</a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                    {rows.map(([key, label, value, Icon], i) => (
                      <button key={key} onClick={() => goStep(key)} style={{ ['--i' as string]: i }}
                        className="ohp-rise group relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbf8f2] p-3.5 text-left transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D] hover:shadow-[0_16px_30px_-18px_rgba(201,162,77,.8)] dark:border-gray-800 dark:from-[#1a1a1c] dark:to-[#17150f]">
                        <div className="flex items-center justify-between">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-[#e8c97a] transition group-hover:scale-110 dark:bg-white/10"><Icon className="h-4 w-4" /></span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <Check className="h-2.5 w-2.5" /> Done
                          </span>
                        </div>
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">{label}</p>
                        <p className="mt-0.5 truncate text-sm font-black text-[#111827] dark:text-white">{value}</p>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-[#8b7355] opacity-0 transition group-hover:opacity-100 dark:text-[#d7b974]"><Pencil className="h-3 w-3" /> Edit</span>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })()}

          </>
        )}

        {/* Back / Next */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/80 bg-white/90 dark:border-white/10 dark:bg-[#111113]/90">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <button onClick={() => goStep(STEPS[Math.max(0, stepIndex - 1)].key)} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-black text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/5">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <span className="hidden text-[11px] font-bold text-gray-400 sm:inline">Step {stepIndex + 1} of {STEPS.length} · {live ? (autoPublishing ? 'Updating your live page…' : 'Saved & live') : saveLabel}</span>
            {step === 'header' && jobWorking && <span className="ml-auto hidden md:inline-flex"><KeepGoing text="Keep going" /></span>}
            {stepIndex < STEPS.length - 1 ? (
              <button onClick={() => goStep(STEPS[stepIndex + 1].key)} className={`${step === 'header' && jobWorking ? 'md:ml-2' : ''} ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827]`}>
                Next: {STEPS[stepIndex + 1].label} <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              live ? (
                // Live and saved - nothing left to do, so the last button just closes the editor.
                <span className="ml-auto flex items-center gap-3">
                  <span className="hidden items-center gap-1.5 text-xs font-black text-emerald-600 sm:inline-flex dark:text-emerald-400">
                    {autoPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {autoPublishing ? 'Updating your page…' : 'Live & saved'}
                  </span>
                  <button onClick={() => router.push('/studio/property-sites')} disabled={autoPublishing || saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                    <X className="h-4 w-4" /> Close
                  </button>
                </span>
              ) : (
                <button onClick={() => publish()} disabled={publishing} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-5 py-2.5 text-sm font-black text-[#111827] disabled:opacity-60">
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Publish
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ohpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,162,77,.45) } 50% { box-shadow: 0 0 0 8px rgba(201,162,77,0) } }
        .ohp-pulse { animation: ohpPulse 2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .ohp-pulse { animation: none !important } }
      `}</style>

      <style>{`.hvd-shimmer{background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);background-size:220% 100%;animation:hvdShim 1.3s linear infinite}@keyframes hvdShim{from{background-position:120% 0}to{background-position:-120% 0}}`}</style>

      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewVideo(null)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-white">{previewVideo.options?.custom_name || `Video · ${new Date(previewVideo.created_at).toLocaleDateString()}`}</p>
              <button onClick={() => setPreviewVideo(null)} className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>
            <video src={previewVideo.result_url || undefined} controls autoPlay className="max-h-[75vh] w-full rounded-xl bg-black" />
          </div>
        </div>
      )}
    </div>
  )
}

// The town facts arrive as JSON text from the copywriter - keep only well-formed short fields.
function parseTownFacts(text: string): TownFacts | null {
  try {
    const raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
    const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map(x => str(x, n)).filter(Boolean).slice(0, max) : [])
    const dt = raw.downtown && typeof raw.downtown === 'object' ? raw.downtown : {}
    const facts: TownFacts = {
      tagline: str(raw.tagline, 140),
      known_for: list(raw.known_for, 50, 6),
      downtown: { name: str(dt.name, 60), where: str(dt.where, 90), highlights: list(dt.highlights, 60, 4) },
      why_move: list(raw.why_move, 90, 4),
      getting_around: (Array.isArray(raw.getting_around) ? raw.getting_around : [])
        .map((g: any) => ({ label: str(g?.label, 80), detail: str(g?.detail, 60) })).filter((g: { label: string }) => g.label).slice(0, 3),
      outdoors: list(raw.outdoors, 60, 4),
      whats_new: str(raw.whats_new, 140),
    }
    return facts.tagline || facts.known_for?.length || facts.downtown?.name || facts.why_move?.length ? facts : null
  } catch {
    return null
  }
}

// A coloured group in the town editor - module-level so typing never remounts the inputs.
function Group({ tone, title, children, wide }: { tone: string; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${tone} ${wide ? 'lg:col-span-2' : ''}`}>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
      {children}
    </div>
  )
}

function TownFactsEditor({ facts, onChange }: { facts: TownFacts; onChange: (f: TownFacts) => void }) {
  const input = 'w-full rounded-lg border border-white/0 bg-white/80 px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:bg-black/20 dark:text-white'
  const dt = facts.downtown || {}
  const around = facts.getting_around || []
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <Group tone="bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" title="One line about the town" wide>
        <input value={facts.tagline || ''} onChange={e => onChange({ ...facts, tagline: e.target.value })} className={input} placeholder="One line about the town" />
      </Group>
      <Group tone="bg-violet-50 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200" title="Known for">
        <StringListEditor items={facts.known_for || []} onChange={v => onChange({ ...facts, known_for: v })} max={6} placeholder="e.g. Historic King Street" />
      </Group>
      <Group tone="bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200" title="Downtown">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={dt.name || ''} onChange={e => onChange({ ...facts, downtown: { ...dt, name: e.target.value } })} className={input} placeholder="Name (e.g. King Street)" />
          <input value={dt.where || ''} onChange={e => onChange({ ...facts, downtown: { ...dt, where: e.target.value } })} className={input} placeholder="Where it is" />
        </div>
        <div className="mt-2"><StringListEditor items={dt.highlights || []} onChange={v => onChange({ ...facts, downtown: { ...dt, highlights: v } })} max={4} placeholder="What's there" /></div>
      </Group>
      <Group tone="bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200" title="Why people move here">
        <StringListEditor items={facts.why_move || []} onChange={v => onChange({ ...facts, why_move: v })} max={4} placeholder="e.g. Direct rail into Philadelphia" />
      </Group>
      <Group tone="bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200" title="Getting around">
        <div className="space-y-2">
          {around.map((g, i) => (
            <div key={i} className="flex gap-2">
              <input value={g.label} onChange={e => onChange({ ...facts, getting_around: around.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={input} placeholder="Destination or line" />
              <input value={g.detail || ''} onChange={e => onChange({ ...facts, getting_around: around.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} className={input} placeholder="about 40 min" />
              <button onClick={() => onChange({ ...facts, getting_around: around.filter((_, j) => j !== i) })} className="shrink-0 rounded-lg p-2 opacity-60 hover:bg-white hover:text-red-600 hover:opacity-100" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {around.length < 3 && (
            <button onClick={() => onChange({ ...facts, getting_around: [...around, { label: '', detail: '' }] })} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-current px-3 py-1.5 text-[11px] font-black opacity-70 hover:opacity-100">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </Group>
      <Group tone="bg-lime-50 text-lime-900 dark:bg-lime-500/10 dark:text-lime-200" title="The outdoors">
        <StringListEditor items={facts.outdoors || []} onChange={v => onChange({ ...facts, outdoors: v })} max={4} placeholder="e.g. Chester Valley Trail" />
      </Group>
      <Group tone="bg-orange-50 text-orange-900 dark:bg-orange-500/10 dark:text-orange-200" title="New in town (optional)" wide>
        <input value={facts.whats_new || ''} onChange={e => onChange({ ...facts, whats_new: e.target.value })} className={input} placeholder="Something new that just opened" />
      </Group>
    </div>
  )
}

// MLS city/county names often arrive in capitals ("MALVERN") - read as a normal name.
function tidyTown(value?: string | null): string {
  const v = (value || '').trim()
  if (!v || /[a-z]/.test(v)) return v
  return v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// A tiny drawing of each design's opening screen, so the two choices actually look different.
function TemplateMini({ id, photo, address }: { id: PropertyWebsiteTemplateId; photo: string | null; address: string }) {
  const street = address.split(',')[0]
  if (id === 'cinematic_luxury') {
    return (
      <span className="relative block aspect-[16/10] overflow-hidden bg-[#0A0A0A]">
        {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
        <span className="absolute left-2 right-2 top-1.5 flex items-center justify-between"><span className="h-1 w-6 rounded-full bg-white/70" /><span className="h-1.5 w-5 rounded-full bg-[#C9A24D]" /></span>
        <span className="absolute bottom-[30%] left-2 right-2">
          <span className="block truncate font-serif text-[13px] font-light leading-none text-white">{street}</span>
          <span className="mt-1 flex gap-1"><span className="h-1 w-5 rounded-full bg-white/60" /><span className="h-1 w-3 rounded-full bg-white/40" /><span className="h-1 w-3 rounded-full bg-white/40" /></span>
        </span>
        <span className="absolute inset-x-0 bottom-0 space-y-1 overflow-hidden border-t border-white/10 bg-black/70 px-2 py-1.5">
          <span className="block h-[3px] w-[140%] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.55)_0_14px,transparent_14px_20px)]" />
          <span className="block h-[3px] w-[140%] -translate-x-6 bg-[repeating-linear-gradient(90deg,rgba(201,162,77,.8)_0_10px,transparent_10px_18px)]" />
        </span>
      </span>
    )
  }
  const [first, ...rest] = street.split(' ')
  return (
    <span className="relative block aspect-[16/10] overflow-hidden bg-[#f3efe6]">
      <span className="absolute inset-x-0 top-0 h-[74%] overflow-hidden bg-[#091513]">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover opacity-70 saturate-[.8] transition duration-700 group-hover:scale-105" />}
        <span className="absolute inset-0 bg-gradient-to-b from-[#091513]/60 via-transparent to-[#091513]/90" />
        <span className="absolute left-2 right-2 top-1.5 flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-[#f3efe6]/70 bg-[#f3efe6]/30" /><span className="h-1 w-7 rounded-full bg-[#f3efe6]/70" /></span>
        <span className="absolute bottom-2.5 left-2 right-2">
          <span className="block truncate font-serif text-[14px] leading-none tracking-tight text-[#f3efe6]"><i>{first}</i> {rest.join(' ')}</span>
          <span className="mt-1.5 flex items-center gap-1 border-t border-[#f3efe6]/30 pt-1"><span className="h-1.5 w-6 bg-[#f3efe6]" /><span className="h-1.5 w-6 border border-[#f3efe6]/70" /></span>
        </span>
      </span>
      <span className="absolute inset-x-2 bottom-1.5 top-[78%] flex flex-col justify-center gap-1">
        <span className="h-1 w-10 rounded-full bg-[#10201e]/50" />
        <span className="h-1 w-16 rounded-full bg-[#10201e]/25" />
      </span>
    </span>
  )
}

function ToggleRow({ icon: Icon, title, body, on, onChange }: { icon: typeof Calculator; title: string; body: string; on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${on ? 'border-[#C9A24D]/60 bg-[#C9A24D]/5' : 'border-gray-200 dark:border-gray-800'}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black text-[#111827] dark:text-white">{title}</span>
        <span className="block text-[10px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{body}</span>
      </span>
      <span className={`relative mt-1 h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} /></span>
    </button>
  )
}

// A textarea that grows to fit everything in it - no inner scrolling.
function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={4} className={className} />
}

// Floor plans / documents: title, count and the add buttons on one line; each file a tidy row.
function FileList({ icon: Icon, title, hint, accept, rows, onChange, onUpload }: {
  icon: typeof FileText; title: string; hint: string; accept: string
  rows: { label: string; url: string }[]
  onChange: (rows: { label: string; url: string }[]) => void
  onUpload: (file: File) => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const add = async (file: File) => {
    setBusy(true); setErr('')
    const url = await onUpload(file)
    setBusy(false)
    if (url) onChange([...rows, { label: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), url }])
    else setErr('Upload failed - check the file type and size.')
  }
  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#C9A24D] dark:bg-white/10"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-[#111827] dark:text-white">{title}{rows.length > 0 && <span className="ml-1.5 rounded-full bg-[#C9A24D]/15 px-1.5 py-0.5 text-[10px] text-[#8b7355]">{rows.length}</span>}</p>
          <p className="truncate text-[10px] font-semibold text-gray-400">{hint}</p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#C9A24D] px-3 py-2 text-[11px] font-black text-[#111827] transition hover:brightness-110">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
          <input type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) void add(f) }} />
        </label>
        <button onClick={() => onChange([...rows, { label: '', url: '' }])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] dark:border-gray-700" title="Add a link instead">
          <Plus className="h-3.5 w-3.5" /> Link
        </button>
      </div>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 p-1.5 dark:bg-white/5">
              {/\.(jpe?g|png|webp)(\?|$)/i.test(r.url) ? <img src={r.url} alt="" className="h-8 w-10 shrink-0 rounded object-cover" /> : <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded bg-white text-gray-400 dark:bg-black/30"><FileText className="h-4 w-4" /></span>}
              <input value={r.label} onChange={e => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Name" className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[#111827] outline-none dark:text-white" />
              {!r.url && <input value={r.url} onChange={e => onChange(rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] outline-none dark:border-gray-700 dark:bg-black/20 dark:text-white" />}
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-2 text-[11px] font-bold text-red-600">{err}</p>}
    </div>
  )
}

function EditorCard({ step, title, subtitle, badge, children }: { step?: number; title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="ohp-rise mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        {step != null && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-xs font-black text-[#C9A24D] dark:bg-white/10">{step}</span>}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">
            {title}
            {badge && <span className="rounded-full bg-[#C9A24D]/12 px-2 py-0.5 font-sans text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{badge}</span>}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function StringListEditor({
  items, onChange, max, placeholder, onSuggest, suggesting,
}: {
  items: string[]
  onChange: (items: string[]) => void
  max: number
  placeholder: string
  onSuggest?: () => void
  suggesting?: boolean
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value || items.length >= max) return
    onChange([...items, value])
    setDraft('')
  }
  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1.5 text-xs font-bold text-[#111827] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white">
              {item}
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" aria-label={`Remove ${item}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {items.length < max && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
          />
          <button onClick={add} className="shrink-0 rounded-lg border border-dashed border-gray-300 p-2 text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700" aria-label="Add">
            <Plus className="h-3.5 w-3.5" />
          </button>
          {onSuggest && (
            <button
              onClick={onSuggest} disabled={suggesting}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-[#C9A24D]/50 px-3 py-2 text-[11px] font-black text-[#8b7355] hover:bg-[#C9A24D]/5 disabled:opacity-50 dark:text-[#d7b974]"
            >
              {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Suggest
            </button>
          )}
        </div>
      )}
      <p className="mt-1.5 text-[10px] font-bold text-gray-400">{items.length}/{max}</p>
    </div>
  )
}

function ListEditor<T extends Record<string, string>>({
  rows, onChange, empty, fields, uploadField, uploadAccept, onUpload,
}: {
  rows: T[]; onChange: (rows: T[]) => void; empty: T; fields: { key: keyof T; placeholder: string }[]
  // When provided, each row gets an Upload button that fills this field with the real S3 URL a
  // successful upload returns - the manual text input next to it stays usable for a
  // link-elsewhere fallback (Dropbox/Drive/etc) instead of forcing an upload.
  uploadField?: keyof T
  uploadAccept?: string
  onUpload?: (file: File) => Promise<string | null>
}) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')

  const handleFile = async (i: number, file: File) => {
    if (!onUpload || !uploadField) return
    setUploadingIndex(i)
    setUploadError('')
    const url = await onUpload(file)
    setUploadingIndex(null)
    if (url) onChange(rows.map((r, j) => (j === i ? { ...r, [uploadField]: url } : r)))
    else setUploadError('Upload failed. Check the file type/size and try again.')
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {fields.map(f => (
            <input
              key={String(f.key)} value={row[f.key] || ''} placeholder={f.placeholder}
              onChange={e => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
            />
          ))}
          {onUpload && (
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-gray-400">
              {uploadingIndex === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <input
                type="file" accept={uploadAccept} className="hidden"
                onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) handleFile(i, file) }}
              />
            </label>
          )}
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
      <button onClick={() => onChange([...rows, empty])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  )
}

function AgentsEditor({ agents, onChange, self }: { agents: PropertyWebsiteAgent[]; onChange: (a: PropertyWebsiteAgent[]) => void; self: { name: string; email: string } | null }) {
  const blank: PropertyWebsiteAgent = { name: '', title: '', phone: '', email: '', brokerage: '', license_number: '', photo_url: '' }
  const set = (i: number, patch: Partial<PropertyWebsiteAgent>) => onChange(agents.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const norm = (v?: string | null) => (v || '').toLowerCase().replace(/[^a-z0-9@.]/g, '')
  // A row describing the agent themselves (older sites saved one) refines their own profile card
  // on the live page rather than adding a second card - flag it so that's not a surprise.
  const isSelf = (a: PropertyWebsiteAgent) => !!self && ((!!norm(a.email) && norm(a.email) === norm(self.email)) || (!!norm(a.name) && norm(a.name) === norm(self.name)))
  const input = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white"
  return (
    <div className="space-y-3">
      {agents.map((a, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{isSelf(a) ? 'You - merged into your profile card' : `Co-listing agent ${i + 1}`}</p>
            <button onClick={() => onChange(agents.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Remove agent">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={a.name} onChange={e => set(i, { name: e.target.value })} placeholder="Full name" className={input} />
            <input value={a.title || ''} onChange={e => set(i, { title: e.target.value })} placeholder="Title" className={input} />
            <input value={a.phone || ''} onChange={e => set(i, { phone: e.target.value })} placeholder="Phone" className={input} />
            <input value={a.email || ''} onChange={e => set(i, { email: e.target.value })} placeholder="Email" className={input} />
            <input value={a.brokerage || ''} onChange={e => set(i, { brokerage: e.target.value })} placeholder="Brokerage" className={input} />
            <input value={a.license_number || ''} onChange={e => set(i, { license_number: e.target.value })} placeholder="License #" className={input} />
            <input value={a.photo_url || ''} onChange={e => set(i, { photo_url: e.target.value })} placeholder="Headshot URL (optional)" className={`${input} sm:col-span-2`} />
          </div>
        </div>
      ))}
      {agents.length < 3 && (
        <button onClick={() => onChange([...agents, blank])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          <Plus className="h-3.5 w-3.5" /> Add co-listing agent
        </button>
      )}
    </div>
  )
}

// What the page shows right now - re-read every 30s while the editor is open, so an open house
// scheduled (or cancelled) in the Open House Manager appears here without a reload.
function LiveOpenHouses({ siteId, refreshKey }: { siteId: string; refreshKey: number }) {
  const [rows, setRows] = useState<{ id: string; date: string; start_time: string | null; end_time: string | null; source: string }[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => api.propertySites.openHouses(siteId).then(r => { if (alive && r.success && r.data) setRows(r.data.open_houses) })
    load()
    const t = window.setInterval(load, 30000)
    return () => { alive = false; window.clearInterval(t) }
  }, [siteId, refreshKey])
  const clock = (t: string | null) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const SOURCE: Record<string, string> = { open_house_manager: 'Open House Manager', mls: 'MLS', manual: 'Added here' }
  if (rows === null) return <div className="flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your schedule…</div>
  if (!rows.length) return (
    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400">
      No upcoming open houses for this home right now. Schedule one in the <a href="/open-houses" className="font-black text-[#8b7355] hover:underline">Open House Manager</a> and it appears on the page by itself.
    </p>
  )
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map(o => {
        const d = new Date(`${o.date}T00:00:00`)
        return (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] to-[#fbf3df] px-3 py-2.5 dark:border-white/10 dark:from-white/[0.04] dark:to-[#C9A24D]/[0.06]">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#111827] text-white shadow-sm">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#e8c97a]">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
              <span className="font-serif text-lg font-black leading-none">{d.getDate()}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{d.toLocaleDateString('en-US', { weekday: 'long' })}{o.start_time ? ` · ${clock(o.start_time)}${o.end_time ? `–${clock(o.end_time)}` : ''}` : ''}</p>
              <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On your page · {SOURCE[o.source] || 'Scheduled'}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OpenHousesEditor({ rows, onChange }: { rows: PropertyWebsiteOpenHouse[]; onChange: (rows: PropertyWebsiteOpenHouse[]) => void }) {
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const set = (i: number, patch: Partial<PropertyWebsiteOpenHouse>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const input = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id || i} className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#C9A24D]" />
          <input type="date" min={todayIso} value={r.date || ''} onChange={e => set(i, { date: e.target.value })} className={input} aria-label="Open house date" />
          <input type="time" value={(r.start_time || '').slice(0, 5)} onChange={e => set(i, { start_time: e.target.value })} className={input} aria-label="Start time" />
          <span className="text-xs font-bold text-gray-400">to</span>
          <input type="time" value={(r.end_time || '').slice(0, 5)} onChange={e => set(i, { end_time: e.target.value })} className={input} aria-label="End time" />
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Remove date">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {r.date && r.date < todayIso && <span className="text-[10px] font-bold text-amber-600">Past - hidden on the page</span>}
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, { id: `manual-${Date.now()}`, date: '', start_time: '13:00', end_time: '15:00', manual: true }])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700"
      >
        <Plus className="h-3.5 w-3.5" /> Add open house date
      </button>
    </div>
  )
}

export default function PropertySiteEditorPageGuarded() {
  return (
    <AuthGuard>
      <SubscriptionGuard requiredTier="IDX">
        <Suspense fallback={null}>
          <PropertySiteEditorPage />
        </Suspense>
      </SubscriptionGuard>
    </AuthGuard>
  )
}
