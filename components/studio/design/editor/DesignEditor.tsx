'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Download, Loader2, Minus, Move, MousePointerClick, Plus, Printer, Redo2, Smartphone, Square, Undo2, X } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { smartBack } from '@/lib/navHistory'
import { useOwnDomainBase, agentFormUrl } from '@/lib/ownDomainLinks'
import { AgentFormConfig, BrandKit, CampaignLookup, DesignBlock, DesignColorMode, DesignProject, DesignStyleId, LinkedProperty, OpenHouse } from '@/types'
import { DESIGN_FORMAT_META, blockId, getDesignFormat } from '@/lib/studio/designFormats'
import { getTemplate, getTemplatesFor } from '@/lib/studio/designTemplates'
import { formatFamily } from '@/lib/studio/designCompositions'
import { getSituation } from '@/lib/studio/designSituations'
import { designAgentFrom } from '@/lib/studio/designAgent'
import DesignCanvas, { DesignCanvasContext } from '@/components/studio/design/DesignCanvas'
import PropertySelector from '@/components/studio/PropertySelector'
import ProfileGate from '@/components/studio/design/ProfileGate'
import { profileGaps, propertyRuleFor } from '@/lib/studio/designCompliance'
import { BLOCK_TO_CARD, CardId, DetailsCard, EditorCtl, PhotoCard, Reposition, WordsCard, find } from './cards'
import { LeadsCard, LookCard, PropertyCard, YouCard } from './cardsMore'

// The one design editor. Big live preview on the left - click anything on it to change it; a
// short stack of plain-English cards on the right (Photos, Words, Price & facts, You, Look,
// Property, Leads). The layout engine does the design thinking: nothing is dragged into the wrong
// place, type never overflows, and every change autosaves with undo.

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
const SAVED_FIELDS = ['name', 'linked_property', 'blocks', 'branding_mode', 'style_id', 'color_mode', 'campaign_id', 'template_id'] as const
type Snapshot = Pick<DesignProject, (typeof SAVED_FIELDS)[number]>

function snapshot(d: DesignProject): Snapshot {
  return { name: d.name, linked_property: d.linked_property, blocks: d.blocks, branding_mode: d.branding_mode, style_id: d.style_id, color_mode: d.color_mode, campaign_id: d.campaign_id, template_id: d.template_id }
}

// Photo-related overrides tied to the previously-linked property's photo URLs - cleared whenever
// the property changes so the new listing's photos actually show instead of stale ones.
function clearStalePhotoOverrides(blocks: DesignBlock[]): DesignBlock[] {
  return blocks.map(b => {
    if (b.type === 'hero_photo' && b.overrides?.image_url !== undefined) {
      const { image_url, ...rest } = b.overrides
      return { ...b, overrides: rest, data: { ...b.data, photoFocalPoint: undefined, photoZoom: undefined, photoFit: undefined } }
    }
    if (b.type === 'photo_gallery' && b.data?.selectedPhotos?.length) return { ...b, data: { ...b.data, selectedPhotos: [], photoPositions: {} } }
    return b
  })
}

export default function DesignEditor({ designId }: { designId: string }) {
  // The agent's own domain, when they have one - QR codes and links follow it (lib/ownDomainLinks).
  const ownBase = useOwnDomainBase()
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  // A download waits until the profile has what advertising rules need (lib/studio/designCompliance).
  const [gateOpen, setGateOpen] = useState(false)
  const { showToast } = useToast()
  const isIdx = user?.plan_tier === 'IDX'

  const [design, setDesign] = useState<DesignProject | null>(null)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [hub, setHub] = useState<{ slug?: string | null; config?: Record<string, any> | null } | null>(null)
  const [agentForms, setAgentForms] = useState<AgentFormConfig[]>([])
  const [linkedOpenHouses, setLinkedOpenHouses] = useState<OpenHouse[]>([])
  const [campaignInfo, setCampaignInfo] = useState<CampaignLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  // Leaving the editor: the design settles down and the editor fades out (user 10/09: closing felt abrupt).
  const [closing, setClosing] = useState(false)
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  // The off-screen 1200px copy for the browser-side export fallback - only mounted while that runs
  // (it used to sit there always, redrawing the whole design a second time on every click).
  const [exportCopy, setExportCopy] = useState(false)
  // Same values -> same ctx object, so the memoized DesignCanvas doesn't redraw on unrelated clicks.
  const ctxRef = useRef<DesignCanvasContext | null>(null)
  const [exportMenu, setExportMenu] = useState(false)
  const [openCard, setOpenCard] = useState<CardId | null>('photo')
  const [flashCard, setFlashCard] = useState<CardId | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [reposition, setReposition] = useState<Reposition | null>(null)
  const [showPropertyPicker, setShowPropertyPicker] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    Promise.all([api.designs.get(designId), api.studio.getBrandKit(), api.agentHub.getMine(), api.forms.getMine()]).then(([d, bk, h, f]) => {
      if (d.success && d.data) setDesign(d.data)
      if (bk.success && bk.data) setBrandKit(bk.data)
      if (h.success && h.data) setHub(h.data)
      if (f.success && f.data) setAgentForms(f.data)
      setLoading(false)
    })
  }, [designId])

  const listingKey = design?.linked_property?.listing_key
  useEffect(() => {
    if (!listingKey) { setLinkedOpenHouses([]); return }
    let alive = true
    api.openHouses.getByListingKey(listingKey).then(res => { if (alive && res.success && res.data) setLinkedOpenHouses(res.data) })
    return () => { alive = false }
  }, [listingKey])

  const campaignId = design?.campaign_id
  useEffect(() => {
    if (!campaignId) { setCampaignInfo(null); return }
    let alive = true
    api.forms.getCampaignInfo(campaignId).then(res => { if (alive && res.success && res.data) setCampaignInfo(res.data) })
    return () => { alive = false }
  }, [campaignId])

  // ---- Saving (debounced autosave, flushed before export and when leaving) ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<DesignProject | null>(null)
  latest.current = design
  const writeNow = useCallback(async (d: DesignProject) => {
    setSaveStatus('saving')
    const res = await api.designs.update(d.id, snapshot(d))
    setSaveStatus(res.success ? 'saved' : 'error')
    if (res.success) window.setTimeout(() => setSaveStatus(s => (s === 'saved' ? 'idle' : s)), 1600)
    return res.success
  }, [])
  const flush = useCallback(async () => {
    if (!saveTimer.current || !latest.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    await writeNow(latest.current)
  }, [writeNow])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (saveTimer.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // ---- Undo / redo: a stack of snapshots; quick successive edits to the same thing coalesce ----
  const history = useRef<{ past: Snapshot[]; future: Snapshot[]; lastKey: string | null; lastAt: number }>({ past: [], future: [], lastKey: null, lastAt: 0 })
  const [, bump] = useState(0)
  const commit = useCallback((next: DesignProject, key = 'edit') => {
    const prev = latest.current
    if (prev) {
      const h = history.current
      const now = Date.now()
      if (!(h.lastKey === key && now - h.lastAt < 1200 && h.past.length)) h.past = [...h.past.slice(-40), snapshot(prev)]
      h.future = []
      h.lastKey = key
      h.lastAt = now
    }
    setDesign(next)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void writeNow(next) }, 600)
    bump(n => n + 1)
  }, [writeNow])
  const undo = useCallback(() => {
    const h = history.current
    const cur = latest.current
    if (!cur || !h.past.length) return
    const snap = h.past[h.past.length - 1]
    h.past = h.past.slice(0, -1)
    h.future = [snapshot(cur), ...h.future].slice(0, 40)
    h.lastKey = null
    const next = { ...cur, ...snap }
    setDesign(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void writeNow(next) }, 400)
    bump(n => n + 1)
  }, [writeNow])
  const redo = useCallback(() => {
    const h = history.current
    const cur = latest.current
    if (!cur || !h.future.length) return
    const snap = h.future[0]
    h.future = h.future.slice(1)
    h.past = [...h.past, snapshot(cur)]
    h.lastKey = null
    const next = { ...cur, ...snap }
    setDesign(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void writeNow(next) }, 400)
    bump(n => n + 1)
  }, [writeNow])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (typing) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) { e.preventDefault(); redo() }
      else if (e.key === 'Escape') { setReposition(null); setSelectedBlockId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // ---- Block operations the cards use ----
  const updateBlock = useCallback((id: string, updater: (b: DesignBlock) => DesignBlock) => {
    const d = latest.current
    if (!d) return
    commit({ ...d, blocks: d.blocks.map(b => (b.id === id ? updater(b) : b)) }, `block:${id}`)
  }, [commit])
  const addBlock = useCallback((block: DesignBlock) => {
    const d = latest.current
    if (!d) return
    commit({ ...d, blocks: [...d.blocks, block] }, `add:${block.id}`)
    setSelectedBlockId(block.id)
  }, [commit])
  const removeBlock = useCallback((id: string) => {
    const d = latest.current
    if (!d) return
    commit({ ...d, blocks: d.blocks.filter(b => b.id !== id) }, `remove:${id}`)
    setSelectedBlockId(s => (s === id ? null : s))
  }, [commit])
  const setBrandingMode = useCallback((mode: DesignProject['branding_mode']) => { const d = latest.current; if (d) commit({ ...d, branding_mode: mode }, 'branding') }, [commit])
  const changeLook = useCallback((patch: { template_id?: string; style_id?: DesignStyleId; color_mode?: DesignColorMode }) => {
    const d = latest.current
    if (!d) return
    let blocks = d.blocks
    // Layouts built around supporting photos get a gallery block added if the design has none yet.
    if (patch.template_id && patch.template_id !== d.template_id) {
      const next = getTemplate(patch.template_id)
      if (next && ['mosaic', 'collage', 'filmstrip', 'keepsake'].includes(next.composition) && !blocks.some(b => b.type === 'photo_gallery')) {
        blocks = [...blocks, { id: blockId('photo_gallery'), type: 'photo_gallery', hidden: false, data: { selectedPhotos: [], autoFillCount: 3 }, overrides: {} }]
      }
    }
    commit({ ...d, ...patch, blocks }, 'look')
  }, [commit])
  const changeProperty = useCallback((property: LinkedProperty | null) => {
    const d = latest.current
    if (!d) return
    commit({ ...d, linked_property: property, blocks: clearStalePhotoOverrides(d.blocks) }, 'property')
    if (property) setShowPropertyPicker(false)
  }, [commit])
  const resetToListing = useCallback(() => {
    const d = latest.current
    if (!d) return
    const p = d.linked_property
    commit({ ...d, blocks: d.blocks.map(b => {
      if (['address', 'price', 'facts'].includes(b.type)) return { ...b, overrides: {}, hidden: false, data: b.type === 'price' ? { ...b.data, priceSource: undefined } : b.data }
      if (b.type === 'description') return { ...b, data: { ...b.data, text: p?.description || b.data?.text || '' } }
      return b
    }) }, 'reset')
    showToast('Refilled from the listing.', 'success')
  }, [commit, showToast])
  const changeCampaign = useCallback((id: string | null) => { const d = latest.current; if (d) commit({ ...d, campaign_id: id }, 'campaign') }, [commit])

  // ---- Clicking something in the preview opens its card ----
  const selectBlock = useCallback((id: string) => {
    const d = latest.current
    const block = d?.blocks.find(b => b.id === id)
    if (!block) return
    const card = BLOCK_TO_CARD[block.type]
    setSelectedBlockId(id)
    setOpenCard(card)
    setFlashCard(card)
    window.setTimeout(() => setFlashCard(null), 900)
    window.setTimeout(() => document.getElementById(`card-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }, [])

  // ---- Preview sizing: fit the whole design in the available box, zoomable ----
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading])

  // ---- Drag-to-reframe on the preview (while the Photo card's "Adjust framing" is on) ----
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)
  const repositionTargetPos = useMemo(() => {
    if (!design || !reposition) return null
    const hero = find(design.blocks, 'hero_photo')
    const gallery = find(design.blocks, 'photo_gallery')
    if (reposition.target === 'hero') return { x: hero?.data?.photoFocalPoint?.x ?? 50, y: hero?.data?.photoFocalPoint?.y ?? 50, zoom: hero?.data?.photoZoom ?? 1 }
    const pos = gallery?.data?.photoPositions?.[reposition.target] || {}
    return { x: pos.x ?? 50, y: pos.y ?? 50, zoom: pos.zoom ?? 1 }
  }, [design, reposition])
  const applyDrag = (x: number, y: number) => {
    const d = latest.current
    if (!d || !reposition) return
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
    if (reposition.target === 'hero') {
      const hero = find(d.blocks, 'hero_photo')
      if (hero) updateBlock(hero.id, b => ({ ...b, data: { ...b.data, photoFocalPoint: { x: clamp(x), y: clamp(y) } } }))
    } else {
      const gallery = find(d.blocks, 'photo_gallery')
      if (gallery) updateBlock(gallery.id, b => ({ ...b, data: { ...b.data, photoPositions: { ...b.data?.photoPositions, [reposition.target]: { ...b.data?.photoPositions?.[reposition.target], x: clamp(x), y: clamp(y) } } } }))
    }
  }

  // ---- Export (server render = pixel-identical to the preview; browser capture as fallback) ----
  const exportRef = useRef<HTMLDivElement>(null)
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = filename
    a.href = url
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const markExported = async () => {
    const d = latest.current
    if (d && d.status === 'DRAFT') { const res = await api.designs.updateStatus(d.id, 'EXPORTED'); if (res.success && res.data) setDesign(cur => (cur ? { ...cur, status: res.data!.status } : cur)) }
  }
  const exportPng = async () => {
    const d = latest.current
    if (!d) return
    setExporting('png')
    try {
      await flush()
      const res = await api.designs.exportPng(d.id)
      if (res.success && res.blob) { downloadBlob(res.blob, `${d.name || 'design'}.png`); await markExported(); showToast('Downloaded - it is saved in your designs too.', 'success'); return }
      setExportCopy(true)
      for (let i = 0; i < 40 && !exportRef.current; i++) await new Promise(r => setTimeout(r, 50))
      if (!exportRef.current) throw new Error(res.error || 'Export failed')
      // let the copy's photos load before capturing it
      await Promise.all(Array.from(exportRef.current.querySelectorAll('img')).map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r }))))
      await new Promise(r => setTimeout(r, 300))
      const html2canvas = (await import('html2canvas')).default
      const targetWidth = DESIGN_FORMAT_META[d.design_type]?.exportPx?.[0] || 2400
      const canvas = await html2canvas(exportRef.current, { useCORS: true, scale: Math.max(2, targetWidth / exportRef.current.clientWidth), backgroundColor: null })
      const a = document.createElement('a')
      a.download = `${d.name || 'design'}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
      await markExported()
    } catch {
      showToast('The download did not work. Please try again.', 'error')
    } finally {
      setExporting(null)
      setExportCopy(false)
    }
  }
  const exportPdf = async () => {
    const d = latest.current
    if (!d) return
    setExporting('pdf')
    try {
      await flush()
      const res = await api.designs.exportPdf(d.id)
      if (res.success && res.blob) { downloadBlob(res.blob, `${d.name || 'design'}.pdf`); await markExported(); showToast('Print-ready PDF downloaded.', 'success') }
      else showToast(res.error || 'The PDF did not work. Please try again.', 'error')
    } finally {
      setExporting(null)
    }
  }

  // A post and its Story, made as a pair: the same layout, look, words, photo and price in the
  // other size - so the feed post and the Story match.
  const [twinning, setTwinning] = useState(false)
  const twinOf = (type: string): 'instagram_story' | 'instagram_post' | null =>
    type === 'instagram_story' ? 'instagram_post' : ['instagram_post', 'instagram_portrait', 'facebook_post'].includes(type) ? 'instagram_story' : null
  const makeTwin = async (composition: string) => {
    const d = latest.current
    const to = d ? twinOf(d.design_type) : null
    if (!d || !to || twinning) return
    setTwinning(true)
    try {
      await flush()
      const res = await api.designs.create({
        design_type: to, style_id: d.style_id, color_mode: d.color_mode, situation: d.situation,
        template_id: `${d.situation || 'just_listed'}__${to}__${composition}`,
        name: `${(d.name || 'Design').replace(/ · (Story|Post)$/, '')} · ${to === 'instagram_story' ? 'Story' : 'Post'}`,
        linked_property: d.linked_property, branding_mode: d.branding_mode, campaign_id: d.campaign_id,
        blocks: d.blocks.map(b => ({ ...b, id: blockId(b.type) })),
      })
      if (res.success && res.data) {
        showToast(`Your matching ${to === 'instagram_story' ? 'Story' : 'post'} is ready - same look, words and price.`, 'success')
        router.push(`/studio/design/${res.data.id}`)
      } else showToast(res.error || 'That did not work. Please try again.', 'error')
    } finally {
      setTwinning(false)
    }
  }

  if (loading || !design) {
    return <OhpLoader />
  }

  const format = getDesignFormat(design.design_type)!
  const situationDef = design.situation ? getSituation(design.situation) : undefined
  const leadGen = situationDef?.propertyAttached === false
  const templateDef = design.template_id ? getTemplate(design.template_id) : undefined
  const composition = templateDef?.composition || (getTemplatesFor(design.situation || 'just_listed', design.design_type)[0]?.composition ?? 'cinematic')
  const fam = formatFamily(format)
  const agent = designAgentFrom(user, hub)
  const gaps = user ? profileGaps(agent, format.isPrint) : []
  const reloadProfile = async () => {
    await refreshUser()
    const h = await api.agentHub.getMine()
    if (h.success && h.data) setHub(h.data)
    setGateOpen(false)
  }
  const openHouseBlock = find(design.blocks, 'open_house_details')
  const linkedOpenHouse = openHouseBlock?.data?.open_house_event_id ? linkedOpenHouses.find(oh => oh.openHouseEventId === openHouseBlock.data.open_house_event_id) : null
  const buyerForm = agentForms.find(f => f.form_type === 'buying')
  const sellerForm = agentForms.find(f => f.form_type === 'selling')
  const trackingUrl = campaignInfo && hub?.slug ? `${agentFormUrl(ownBase, hub.slug, campaignInfo.form_slug)}?c=${encodeURIComponent(campaignInfo.token)}` : null
  let ctx: DesignCanvasContext = {
    format, styleId: design.style_id as DesignStyleId, colorMode: (design.color_mode || 'light') as DesignColorMode,
    composition: templateDef?.composition, layoutHints: templateDef?.layoutHints, situation: design.situation || null,
    property: design.linked_property || null, ...agent, brandKit, agentHubSlug: hub?.slug || null, brandingMode: design.branding_mode,
    linkedOpenHouseFormUrl: linkedOpenHouse?.formUrl || null, buyerFormSlug: buyerForm?.slug || null, sellerFormSlug: sellerForm?.slug || null, campaignUrl: trackingUrl,
  }
  {
    const prev = ctxRef.current as Record<string, unknown> | null
    const next = ctx as unknown as Record<string, unknown>
    if (prev && Object.keys(next).length === Object.keys(prev).length && Object.keys(next).every(k => prev[k] === next[k] || (typeof next[k] === 'object' && JSON.stringify(prev[k]) === JSON.stringify(next[k])))) ctx = ctxRef.current!
    else ctxRef.current = ctx
  }
  const ctl: EditorCtl = {
    design, blocks: design.blocks, property: design.linked_property || null, situation: design.situation || null, leadGen, format, fam, composition, agent, brandKit, agentForms, linkedOpenHouses,
    libraryPhotos: situationDef?.photoLibrary || [], updateBlock, addBlock, removeBlock, reposition, setReposition, focusBlockId: selectedBlockId, ctx, isIdx,
    setBrandingMode, changeLook, openPropertyPicker: () => setShowPropertyPicker(true), resetToListing, campaignInfo, trackingUrl, changeCampaign,
  }

  // Fit: the whole design visible inside the stage with a little breathing room; zoom scales from there.
  const pad = 32
  const fitWidth = stage.w && stage.h ? Math.max(200, Math.min(stage.w - pad * 2, (stage.h - pad * 2) * format.aspectRatio)) : 480
  const canvasWidth = Math.round(fitWidth * zoom)
  const meta = DESIGN_FORMAT_META[design.design_type]
  const canUndo = history.current.past.length > 0
  const canRedo = history.current.future.length > 0
  const cardProps = (id: CardId) => ({ ctl, open: openCard === id, onToggle: () => setOpenCard(openCard === id ? null : id), flash: flashCard === id })
  const cards: CardId[] = ['photo', 'words', 'details', 'you', 'look', ...(leadGen ? [] : ['property' as const]), 'leads']
  const showDetails = !leadGen || !!find(design.blocks, 'open_house_details')

  return (
    <>
    {gateOpen && gaps.length > 0 && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setGateOpen(false)}>
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
          <ProfileGate gaps={gaps} onSaved={reloadProfile} />
        </div>
      </div>
    )}
    <div className={`flex h-screen flex-col bg-[#f3f1ec] transition-opacity duration-300 ease-in dark:bg-[#0B0B0B] ${closing ? 'pointer-events-none opacity-0 delay-100' : ''}`}>
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-black/5 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-[#111113]/90 sm:px-4">
        <button type="button" onClick={async () => { if (closing) return; setClosing(true); await Promise.all([flush(), new Promise(r => setTimeout(r, 340))]); smartBack(router, '/studio/design') }} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-black text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Studio</span>
        </button>
        <NameField value={design.name} onCommit={v => commit({ ...design, name: v }, 'name')} />
        <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black transition sm:inline-flex ${saveStatus === 'saving' ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300' : saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : saveStatus === 'error' ? 'bg-red-50 text-red-600' : 'opacity-0'}`}>
          {saveStatus === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : saveStatus === 'saved' ? <><Check className="h-3 w-3" /> Saved</> : saveStatus === 'error' ? 'Could not save - check your connection' : 'Saved'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white"><Redo2 className="h-4 w-4" /></button>
          {twinOf(design.design_type) && (
            <button type="button" onClick={() => makeTwin(composition)} disabled={twinning} data-testid="make-twin"
              title={twinOf(design.design_type) === 'instagram_story' ? 'Make a Story with this same design' : 'Make a square post with this same design'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-white px-3 py-2.5 text-sm font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] disabled:opacity-60 dark:bg-white/5 dark:text-white">
              {twinning ? <Loader2 className="h-4 w-4 animate-spin" /> : twinOf(design.design_type) === 'instagram_story' ? <Smartphone className="h-4 w-4 text-[#8b7355]" /> : <Square className="h-4 w-4 text-[#8b7355]" />}
              <span className="hidden md:inline">Matching {twinOf(design.design_type) === 'instagram_story' ? 'Story' : 'Post'}</span>
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => (gaps.length ? setGateOpen(true) : format.isPrint ? setExportMenu(v => !v) : exportPng())} disabled={!!exporting} className="lx-shine relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-sm font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 disabled:opacity-60">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? 'Preparing…' : 'Download'}
            </button>
            {exportMenu && format.isPrint && (
              <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#1a1a1c]" onMouseLeave={() => setExportMenu(false)}>
                <button type="button" onClick={() => { setExportMenu(false); exportPdf() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#C9A24D]/10">
                  <Printer className="h-4 w-4 shrink-0 text-[#8b7355]" /><span><span className="block text-sm font-black text-[#111827] dark:text-white">Print-ready PDF</span><span className="block text-[11px] font-semibold text-gray-400">{meta?.size} · exact size for your printer</span></span>
                </button>
                <button type="button" onClick={() => { setExportMenu(false); exportPng() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#C9A24D]/10">
                  <Download className="h-4 w-4 shrink-0 text-[#8b7355]" /><span><span className="block text-sm font-black text-[#111827] dark:text-white">High-resolution image</span><span className="block text-[11px] font-semibold text-gray-400">{meta?.exportPx?.join(' × ')} px · for email or screens</span></span>
                </button>
                <p className="mx-1 mt-1 rounded-xl bg-[#fffaf0] px-3 py-2.5 text-[11px] font-semibold leading-snug text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  Before it goes out: if your brokerage reviews marketing, get their OK first.{design.design_type === 'door_hanger' ? ' Door hangers go on doors only - never inside mailboxes (federal law).' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Preview */}
        <div className="relative flex min-h-[46vh] flex-1 flex-col lg:min-h-0">
          <div ref={stageRef} className="relative flex-1 overflow-auto" onClick={() => { if (!reposition) setSelectedBlockId(null) }}>
            <div className="flex min-h-full min-w-full items-center justify-center p-6 lg:p-8 lg:pb-16">
              <div
                className={`relative shrink-0 overflow-hidden rounded-sm shadow-[0_30px_80px_-30px_rgba(17,24,39,.55)] ${reposition ? (dragRef.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                style={{ width: canvasWidth, touchAction: reposition ? 'none' : undefined, contain: 'layout paint', transform: closing ? 'translateZ(0) translateY(18px) scale(0.9)' : 'translateZ(0)', transition: closing ? 'transform 380ms cubic-bezier(.4,0,.2,1)' : undefined }}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => {
                  if (!reposition || !repositionTargetPos) return
                  const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  dragRef.current = { px: e.clientX, py: e.clientY, x: repositionTargetPos.x, y: repositionTargetPos.y, w: r.width, h: r.height }
                  ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={e => {
                  const d = dragRef.current
                  if (!d || !reposition || !repositionTargetPos) return
                  const k = 140 / Math.max(repositionTargetPos.zoom, 0.6)
                  applyDrag(d.x - ((e.clientX - d.px) / d.w) * k, d.y - ((e.clientY - d.py) / d.h) * k)
                }}
                onPointerUp={() => { dragRef.current = null }}
                onPointerCancel={() => { dragRef.current = null }}
              >
                <div style={reposition ? { pointerEvents: 'none' } : undefined}>
                  <DesignCanvas blocks={design.blocks} ctx={ctx} selectedBlockId={reposition ? null : selectedBlockId} onSelectBlock={reposition ? undefined : selectBlock} />
                </div>
                {reposition && (
                  <span className="pointer-events-none absolute left-1/2 top-3 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
                    <Move className="h-3 w-3" /> Drag the photo to reposition
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Preview footer: hint + zoom */}
          {/* Hint + zoom: floats over the stage on desktop, sits under the preview on phones so it never covers the design. */}
          <div className="flex items-center justify-center gap-2 px-4 pb-3 lg:pointer-events-none lg:absolute lg:inset-x-0 lg:bottom-3 lg:pb-0">
            {!reposition && (
              <span className="pointer-events-auto hidden items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-500 shadow-sm dark:border-white/10 dark:bg-[#1a1a1c] dark:text-gray-300 sm:inline-flex">
                <MousePointerClick className="h-3.5 w-3.5 text-[#C9A24D]" /> Click anything in the design to change it
              </span>
            )}
            <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-black/5 bg-white/90 px-1.5 py-1 shadow-sm dark:border-white/10 dark:bg-[#1a1a1c]">
              <button type="button" onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setZoom(1)} className="w-12 text-center text-[11px] font-black text-gray-600 dark:text-gray-300" title="Fit to screen">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZoom(z => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
            </span>
            <span className="pointer-events-auto hidden rounded-full border border-black/5 bg-white/90 px-3 py-1.5 text-[11px] font-bold text-gray-400 shadow-sm dark:border-white/10 dark:bg-[#1a1a1c] md:inline-flex">{format.label} · {meta?.size}</span>
          </div>
        </div>

        {/* Cards */}
        <aside className={`w-full shrink-0 overflow-y-auto border-t border-black/5 bg-[#faf9f6] p-3 transition-transform duration-300 ease-in dark:border-white/10 dark:bg-[#0d0d0f] lg:w-[420px] lg:border-l lg:border-t-0 lg:p-4 ${closing ? 'lg:translate-x-8' : ''}`}>
          <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">What would you like to change?</p>
          <div className="space-y-2.5">
            {cards.map(id => {
              if (id === 'details' && !showDetails) return null
              const props = cardProps(id)
              return (
                <div key={id} id={`card-${id}`}>
                  {id === 'photo' && <PhotoCard {...props} />}
                  {id === 'words' && <WordsCard {...props} />}
                  {id === 'details' && <DetailsCard {...props} />}
                  {id === 'you' && <YouCard {...props} />}
                  {id === 'look' && <LookCard {...props} />}
                  {id === 'property' && <PropertyCard {...props} />}
                  {id === 'leads' && <LeadsCard {...props} />}
                </div>
              )
            })}
          </div>
          <p className="mt-4 px-1 text-[11px] font-semibold leading-relaxed text-gray-400">Everything saves automatically. Changed your mind? Undo is the arrow at the top (or Ctrl+Z).</p>
        </aside>
      </div>

      {/* Off-screen full-resolution render target for the browser-side fallback export */}
      {exportCopy && (
        <div className="pointer-events-none fixed left-[-9999px] top-0" style={{ width: 1200 }} aria-hidden>
          <DesignCanvas blocks={design.blocks} ctx={ctx} exportRef={exportRef} />
        </div>
      )}

      {showPropertyPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPropertyPicker(false)}>
          <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">{design.linked_property ? 'Change property' : 'Attach a property'}</h3>
                <p className="text-xs font-semibold text-gray-400">The address, price, facts, photos and description fill in from the listing.</p>
              </div>
              <button type="button" onClick={() => setShowPropertyPicker(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
            </div>
            <PropertySelector value={design.linked_property || null} onChange={changeProperty} only={propertyRuleFor(design.situation)} />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() && draft !== value) onCommit(draft.trim()) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      aria-label="Design name"
      className="min-w-0 flex-1 truncate rounded-xl bg-transparent px-2.5 py-1.5 text-sm font-black text-[#111827] outline-none transition hover:bg-gray-100 focus:bg-gray-100 focus:ring-2 focus:ring-[#C9A24D]/40 dark:text-white dark:hover:bg-white/10 dark:focus:bg-white/10 sm:max-w-md"
    />
  )
}
