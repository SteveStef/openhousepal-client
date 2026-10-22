'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Check, ChevronDown, ImagePlus, Loader2, Sparkles, Sunset, Trash2, Upload, Video, Wand2,
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import ListingPhotoSearch, { type PhotoSearchTab } from '@/components/studio/media/ListingPhotoSearch'
import RemoveAreaPainter from '@/components/studio/media/RemoveAreaPainter'
import FlowDock from '@/components/ui/FlowDock'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'
import type {
  LinkedProperty, StudioEnhancement, StudioImageEffect, StudioMediaAsset, StudioMediaOptions,
} from '@/types'
import {
  Chip, EFFECTS, EnhancementOptions, MAX_VIDEO_PHOTOS, ModeCard, OHP_MEDIA_STYLE, OptionRow,
  PhotoGeneratingCard, PhotoGrid, ROOM_TYPES, STAGING_STYLES, Section, estimatedVideoSeconds, stageLabel,
} from '@/components/studio/media/shared'

const STUDIO_MEDIA_STAGES = ['Property', 'What to make', 'Pick photos', 'Generate']

// The create wizard, split out of the old single page into its own route (matching CMA's "New
// CMA" -> its own page). Unlike CMA (which creates an empty draft row up front and routes there
// immediately), no StudioMediaAsset exists until Generate actually succeeds - there's nothing to
// route to before that. So this page owns the whole source -> mode -> photos -> generate flow
// itself, and only navigates to /studio/media/[id] once a real asset id exists.
function CreateMediaPage() {
  const router = useRouter()
  const { user } = useAuth()
  const canUseListings = hasMlsAccess(user?.plan_tier)

  const [property, setProperty] = useState<LinkedProperty | null>(null)
  const [sourceTab, setSourceTab] = useState<PhotoSearchTab>('mine')
  const [mode, setMode] = useState<'photo' | 'video' | null>(null)
  const [photo, setPhoto] = useState<{ url: string; kind: 'listing' | 'upload' } | null>(null)
  const [videoPhotos, setVideoPhotos] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [uploadAssets, setUploadAssets] = useState<StudioMediaAsset[]>([])
  const [uploading, setUploading] = useState(false)
  // Step 1 folds to a one-line bar once Photo/Video is picked (like step 2 does) - "Change" opens it.
  const [sourceOpen, setSourceOpen] = useState(false)
  // Photos dragged in from the desktop: the whole page is the drop zone (counter, because
  // dragenter/dragleave fire for every child the pointer crosses).
  const [dragDepth, setDragDepth] = useState(0)
  const [effects, setEffects] = useState<StudioImageEffect[]>([])
  const [options, setOptions] = useState<StudioMediaOptions>({})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const afterPickerRef = useRef<HTMLDivElement>(null)
  const wasPickerOpenRef = useRef(pickerOpen)

  // Opened from another tool (e.g. a Spotlight's "Make a video" link) with the property handed
  // over in localStorage - land straight on "Pick photos" for a video of that home.
  useEffect(() => {
    if (!canUseListings || !new URLSearchParams(window.location.search).get('prefill')) return
    try {
      const raw = localStorage.getItem('ohp:media-prefill')
      localStorage.removeItem('ohp:media-prefill')
      const hand = raw ? JSON.parse(raw) : null
      if (!hand?.property?.address || Date.now() - (hand.at || 0) > 10 * 60 * 1000) return
      setProperty(hand.property as LinkedProperty)
      if (hand.mode === 'video' || hand.mode === 'photo') setMode(hand.mode)
    } catch { /* storage unavailable - the agent just picks the property as usual */ }
  }, [canUseListings])

  useEffect(() => {
    if (wasPickerOpenRef.current && !pickerOpen) {
      requestAnimationFrame(() => afterPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    wasPickerOpenRef.current = pickerOpen
  }, [pickerOpen])

  const [usage, setUsage] = useState<Awaited<ReturnType<typeof api.mediaLab.usage>>['data'] | null>(null)
  const [usageTick, setUsageTick] = useState(0)
  const refreshUsage = () => setUsageTick(t => t + 1)
  useEffect(() => {
    let alive = true
    api.mediaLab.usage().then(r => { if (alive && r.success && r.data) setUsage(r.data) })
    return () => { alive = false }
  }, [usageTick])

  useEffect(() => {
    let alive = true
    api.mediaLab.listAssets({ kind: 'upload', limit: 60 }).then(r => { if (alive && r.success && r.data) setUploadAssets(r.data.assets) })
    return () => { alive = false }
  }, [usageTick])

  const uploadPhotos = useMemo(() => uploadAssets.map(a => a.result_url).filter((u): u is string => !!u), [uploadAssets])
  const softCapped = !!usage?.studio_soft_capped
  const storageFull = !!usage && usage.storage_cap_bytes > 0 && usage.storage_used_bytes >= usage.storage_cap_bytes

  const videoRawEstUsd = useMemo(() => {
    if (!usage?.video_clip_price_usd || videoPhotos.length === 0) return null
    const secondsPerClip = usage.video_seconds_per_clip || 5
    const renderCost = videoPhotos.length * usage.video_clip_price_usd
    const enhanceCost = videoPhotos.length * (usage.video_photo_enhance_price_usd || 0)
    const upscaleCost = videoPhotos.length * secondsPerClip * (usage.video_upscale_price_per_second_usd || 0)
    return renderCost + enhanceCost + upscaleCost
  }, [usage, videoPhotos.length])

  const videoEstimatedPct = useMemo(() => {
    if (!usage?.month_ai_budget_usd || videoRawEstUsd == null) return null
    return Math.round((videoRawEstUsd / usage.month_ai_budget_usd) * 100)
  }, [usage, videoRawEstUsd])

  useEffect(() => {
    if (!generating) { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } setElapsed(0); return }
    const startedAt = Date.now()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, 500)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [generating])

  const isVideo = mode === 'video'
  const isTimelapse = isVideo && options.video_style === 'day_to_twilight'
  // Day -> Twilight timelapse is one still-camera clip from one photo, not several stitched
  // together (see the backend's studio_media_video_timelapse_* override) - every other video
  // style keeps the normal up-to-MAX_VIDEO_PHOTOS multi-photo reel.
  const maxVideoPhotos = isTimelapse ? 1 : MAX_VIDEO_PHOTOS
  const selectedUrls = isVideo ? videoPhotos : (photo ? [photo.url] : [])
  const selCount = selectedUrls.length
  const videoReview = isVideo && videoPhotos.length >= maxVideoPhotos && !pickerOpen

  useEffect(() => {
    if (!isVideo) { if (selCount === 0) setPickerOpen(true); return }
    if (videoPhotos.length >= maxVideoPhotos) setPickerOpen(false)
    else if (selCount === 0) setPickerOpen(true)
  }, [isVideo, selCount, videoPhotos.length, maxVideoPhotos])

  // Switching TO the timelapse style after already picking several photos (the Style chips sit
  // below the photo grid) would otherwise leave a selection the backend now hard-rejects - trim
  // down to just the first pick rather than surprise the agent with a 422 at Generate time.
  useEffect(() => {
    if (isTimelapse) setVideoPhotos(prev => (prev.length > 1 ? prev.slice(0, 1) : prev))
  }, [isTimelapse])

  const estUsage = useMemo(() => {
    if (!usage?.month_ai_budget_usd) return null
    const est = isVideo ? (videoRawEstUsd ?? usage.video_est_usd) : usage.image_est_usd
    if (est == null) return null
    const pct = Math.max(1, Math.round((est / usage.month_ai_budget_usd) * 100))
    const used = usage.month_ai_used_usd ?? 0
    return { pct, wouldExhaust: used + est >= usage.month_ai_budget_usd }
  }, [usage, isVideo, videoRawEstUsd])

  const listingPhotos = useMemo(() => {
    if (!property) return []
    if (property.photos && property.photos.length > 0) return property.photos
    return property.image_url ? [property.image_url] : []
  }, [property])
  const usingUploads = !canUseListings || sourceTab === 'upload'
  const hasSource = canUseListings
    ? (!!property || (sourceTab === 'upload' && uploadPhotos.length > 0))
    : uploadPhotos.length > 0
  const step = !hasSource ? 1 : !mode ? 2 : 3

  const optionsValid = useMemo(() => {
    if (isVideo) return videoPhotos.length >= 1 && videoPhotos.length <= maxVideoPhotos
    if (effects.length === 0) return false
    if (effects.includes('virtual_staging')) return !!options.room_type && !!options.style
    return true
  }, [isVideo, videoPhotos.length, maxVideoPhotos, effects, options])

  const resetSelection = () => { setError('') }
  const pickMode = (m: 'photo' | 'video') => { setMode(m); setSourceOpen(false); setEffects([]); setOptions({}); setPhoto(null); setVideoPhotos([]); resetSelection() }
  const startOver = () => { setMode(null); setPhoto(null); setVideoPhotos([]); setEffects([]); setOptions({}); resetSelection() }
  const changeSource = () => { setProperty(null); setSourceTab('mine'); startOver() }

  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
  const onPageDragEnter = (e: React.DragEvent) => { if (!isFileDrag(e)) return; e.preventDefault(); setDragDepth(d => d + 1) }
  const onPageDragOver = (e: React.DragEvent) => { if (!isFileDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
  const onPageDragLeave = (e: React.DragEvent) => { if (!isFileDrag(e)) return; setDragDepth(d => Math.max(0, d - 1)) }
  const onPageDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragDepth(0)
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    // Dropped photos go to "Your uploads" - switch there so they show up right away.
    if (canUseListings && sourceTab !== 'upload') { setSourceTab('upload'); setPhoto(null); setVideoPhotos([]) }
    onUpload(files)
  }

  const onUpload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => /^image\/(jpe?g|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name))
    if (!list.length) { setError('Upload JPG, PNG or WebP photos under 12MB.'); return }
    setUploading(true); setError('')
    for (const file of list) {
      const { success, data, error: e } = await api.mediaLab.uploadPhoto(file)
      if (!success || !data) { setError(e || 'Upload failed. Use JPG, PNG or WebP photos under 12MB.'); continue }
      setUploadAssets(prev => (prev.some(a => a.id === data.id) ? prev : [data, ...prev]))
    }
    setUploading(false)
    refreshUsage()
  }

  const removeUpload = async (asset: StudioMediaAsset) => {
    const { success, error: e } = await api.mediaLab.remove(asset.id)
    if (!success) { setError(e || 'Could not remove that upload.'); return }
    setUploadAssets(prev => prev.filter(a => a.id !== asset.id))
    setVideoPhotos(prev => prev.filter(u => u !== asset.result_url))
    if (photo?.url === asset.result_url) setPhoto(null)
    refreshUsage()
  }

  const toggleVideoPhoto = (url: string) => {
    setVideoPhotos(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url)
      // Single-photo styles swap the pick instead of just ignoring the click once "full" -
      // clicking a different photo while one's already selected should replace it, not require
      // deselecting first.
      if (maxVideoPhotos === 1) return [url]
      if (prev.length >= maxVideoPhotos) return prev
      return [...prev, url]
    })
  }

  const pickPhoto = (url: string, kind: 'listing' | 'upload') => {
    if (isVideo) toggleVideoPhoto(url)
    else { setPhoto({ url, kind }); setPickerOpen(false); setOptions(o => ({ ...o, remove_areas: undefined })) }
  }

  const generate = async () => {
    setGenerating(true); setError('')
    const linked = canUseListings && property ? property : null
    const res = isVideo
      ? await api.mediaLab.generate({
          action: 'animate',
          photos: videoPhotos,
          source_photo_url: videoPhotos[0],
          source_kind: usingUploads ? 'upload' : 'listing',
          linked_property: usingUploads ? null : linked,
          options,
        })
      : await api.mediaLab.generate({
          action: 'stack',
          effects,
          source_photo_url: photo!.url,
          source_kind: photo!.kind,
          linked_property: photo!.kind === 'listing' ? linked : null,
          options,
        })
    if (res.success && res.data) {
      router.replace(`/studio/media/${res.data.id}`)
    } else {
      setGenerating(false)
      setError(res.error || 'Generation failed. Try again in a moment.')
    }
  }

  const uploadLibrary = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">Upload your own photos</p>
        <span className="text-[10px] font-semibold text-gray-400">{uploadPhotos.length} in your library</span>
      </div>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 px-3 py-1.5 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 hover:text-[#8b7355] disabled:opacity-60 dark:border-gray-700"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Upload photos
      </button>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.currentTarget.value = '' }} />
      {uploadPhotos.length > 0 && (
        <div className="mt-2.5 grid max-h-[300px] auto-rows-max grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
          {uploadAssets.map(a => a.result_url && (
            <div key={a.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-sm dark:border-gray-800">
              <img src={a.result_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              <button onClick={() => removeUpload(a)} title="Remove" className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 group-hover:flex">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] font-semibold text-gray-400">JPG, PNG or WebP, up to 12MB each. Your library stays across sessions, separate from any listing's photos.</p>
    </div>
  )

  const busy = generating

  return (
    <div className="ohp-media-lab relative min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]"
      onDragEnter={onPageDragEnter} onDragOver={onPageDragOver} onDragLeave={onPageDragLeave} onDrop={onPageDrop}>
      <style>{OHP_MEDIA_STYLE}</style>
      {dragDepth > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/55 p-6">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[#e0b85f] bg-white/95 px-10 py-9 text-center shadow-2xl dark:bg-[#151517]/95">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#e0b85f] text-[#111827]"><ImagePlus className="h-7 w-7" /></span>
            <p className="font-serif text-xl font-black text-[#111827] dark:text-white">Drop to add to your uploads</p>
            <p className="text-xs font-semibold text-gray-500">JPG, PNG or WebP - up to 12MB each</p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:py-6">
        <div className="sticky top-0 z-10 relative -mx-4 mb-4 overflow-hidden border-b border-gray-200 bg-white/95 dark:border-gray-800 dark:bg-[#151517]/95 sm:-mx-0 sm:rounded-2xl sm:border">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] to-[#e0b85f]" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 sm:px-5">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#e0b85f] text-[#111827] shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="whitespace-nowrap font-serif text-base font-black text-[#111827] dark:text-white sm:text-lg">Create New</p>
            </div>
            <div className="min-w-[160px] flex-1">
              <StepBar step={step} busy={busy} onJumpToSource={changeSource} onJumpToMode={startOver} />
            </div>
            <Link
              href="/studio/media"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </Link>
          </div>
        </div>

        {/* Working from their own uploads, the library (with Upload + remove) stays open above the
            next steps - it used to vanish the moment one upload existed, so a second photo could
            never be added. */}
        {mode && !sourceOpen && (step === 1 || !canUseListings || usingUploads) ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-black text-[#111827] dark:text-white">Choose photos</p>
              <p className="truncate text-[11px] font-semibold text-gray-500">{usingUploads ? `Your uploads · ${uploadPhotos.length} ${uploadPhotos.length === 1 ? 'photo' : 'photos'}` : property?.address || 'Listing photos'} · drag more photos onto the page anytime</p>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-60 dark:border-gray-700 dark:text-gray-300">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add photos
            </button>
            <button type="button" onClick={() => setSourceOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300">
              Change <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.currentTarget.value = '' }} />
          </div>
        ) : (step === 1 || !canUseListings || usingUploads) && (
          <Section step={1} title="Choose photos" active={step === 1} overflowVisible raised>
            {canUseListings ? (
              <>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">Pick a property, or upload your own photos</p>
                <ListingPhotoSearch
                  value={property}
                  onChange={(p) => { setProperty(p); setPhoto(null); setVideoPhotos([]) }}
                  tab={sourceTab}
                  onTabChange={setSourceTab}
                  uploadSlot={uploadLibrary}
                />
              </>
            ) : (
              uploadLibrary
            )}
          </Section>
        )}

        {hasSource && !mode && (
          <Section step={2} title="What do you want to make?" active={step === 2}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={mode === 'photo'} onClick={() => pickMode('photo')}
                icon={Wand2} title="Photo edit"
                blurb="Stack twilight, lights-on, virtual staging & enhancement onto one photo — all applied as a single combined edit."
              />
              <ModeCard
                active={mode === 'video'} onClick={() => pickMode('video')}
                icon={Video} title="AI Video"
                blurb={`Up to ${MAX_VIDEO_PHOTOS} photos → a ~${MAX_VIDEO_PHOTOS * 5}s marketing video, ~5s per photo with a gentle camera move on each.`}
              />
            </div>
          </Section>
        )}

        {mode && (
          <Section step={3} title={isVideo ? (isTimelapse ? 'Pick a photo' : 'Pick photos, in order') : 'Pick a photo & effects'} active={step === 3}>
            {videoReview ? (
              <div ref={afterPickerRef} className="ohp-reveal mb-4 overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 bg-gradient-to-br from-[#C9A24D]/[0.1] via-white to-white p-4 shadow-[0_0_44px_-14px_rgba(201,162,77,0.55)] dark:via-[#151517] dark:to-[#151517]">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827] shadow-md shadow-[#C9A24D]/40">
                    <Check className="h-4 w-4" strokeWidth={3.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-base font-black text-[#111827] dark:text-white">
                      {isTimelapse ? 'Photo picked — ready to render' : `All ${maxVideoPhotos} photos picked — ready to render`}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {isTimelapse ? 'One still-camera clip, about 6 seconds' : 'One smooth 1080p video · shown in this order'}
                      {videoEstimatedPct !== null && <> · <span className="font-black text-[#8b7355] dark:text-[#d7b974]">~{videoEstimatedPct}% of your monthly allowance</span></>}
                    </p>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {videoPhotos.map((u, i) => (
                    <div
                      key={u}
                      style={{ animationDelay: `${i * 55}ms` }}
                      className="ohp-pop relative aspect-square overflow-hidden rounded-lg border-2 border-[#C9A24D]/40 shadow-sm"
                    >
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] font-black text-[#111827] shadow">{i + 1}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={generate}
                    disabled={busy || softCapped || storageFull}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2a2e] px-6 py-2.5 text-sm font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50 dark:from-white dark:to-gray-200 dark:text-[#111827]"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#C9A24D]" />}
                    {busy ? 'Working…' : 'Create video'}
                  </button>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-gray-300"
                  >
                    Change photos
                  </button>
                </div>
                <p className="mt-3 overflow-x-auto whitespace-nowrap text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  Takes up to ~{Math.max(3, Math.round(estimatedVideoSeconds(videoPhotos.length) / 60))} minutes to fully render. Feel free to leave this page — or close OpenHousePal entirely — it keeps working in the background. We'll drop a notification in your Activity bell the moment it's ready.
                </p>
              </div>
            ) : (!pickerOpen && selCount > 0) ? (
              <div className="ohp-reveal mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {selectedUrls.slice(0, 5).map((u, i) => (
                      <div key={u} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-white shadow-sm dark:border-[#151517]">
                        <img src={u} alt="" className="h-full w-full object-cover" />
                        {isVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-black text-white">{i + 1}</span>}
                      </div>
                    ))}
                    {selectedUrls.length > 5 && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-[#111827] text-[10px] font-black text-white dark:border-[#151517]">+{selectedUrls.length - 5}</div>
                    )}
                  </div>
                  <p className="truncate text-xs font-black text-[#8b7355] dark:text-[#d7b974]">
                    {isVideo ? (isTimelapse ? '1 photo selected' : `${selCount} of ${maxVideoPhotos} photos selected`) : '1 photo selected'}
                  </p>
                </div>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-gray-300"
                >
                  Change photos
                </button>
              </div>
            ) : usingUploads ? (
              uploadPhotos.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">Your uploads <span className="text-gray-400">({uploadPhotos.length})</span></p>
                  <PhotoGrid photos={uploadPhotos} kind="upload" isVideo={isVideo} videoPhotos={videoPhotos} selectedUrl={photo?.url ?? null} uploadAssets={uploadAssets} onPick={pickPhoto} onRemoveUpload={removeUpload} />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
                  No uploads yet — hit "Change" above and add some photos.
                </p>
              )
            ) : (
              listingPhotos.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">
                    {property?.address ? `${property.address} — listing photos` : 'Listing photos'} <span className="text-gray-400">({listingPhotos.length})</span>
                  </p>
                  <PhotoGrid photos={listingPhotos} kind="listing" isVideo={isVideo} videoPhotos={videoPhotos} selectedUrl={photo?.url ?? null} uploadAssets={uploadAssets} onPick={pickPhoto} onRemoveUpload={removeUpload} />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
                  This listing has no photos — hit "Change" above to pick another or upload your own.
                </p>
              )
            )}
            {isVideo && !videoReview && (
              <p className="mt-2 overflow-hidden truncate whitespace-nowrap text-xs font-semibold text-gray-500 dark:text-gray-400">
                {videoPhotos.length === 0 ? (
                  isTimelapse ? 'Pick 1 photo — ideally an exterior with a real sky and windows.' : `Pick up to ${maxVideoPhotos} photos, in the order you want them shown.`
                ) : isTimelapse ? (
                  <>
                    1 photo selected · still-camera clip, about 6 seconds
                    {videoEstimatedPct !== null && <> · <span className="font-black text-[#8b7355] dark:text-[#d7b974]">~{videoEstimatedPct}% of your monthly allowance</span></>}
                  </>
                ) : (
                  <>
                    {videoPhotos.length} of {maxVideoPhotos} selected · smooth 1080p video
                    {videoEstimatedPct !== null && <> · <span className="font-black text-[#8b7355] dark:text-[#d7b974]">~{videoEstimatedPct}% of your monthly allowance</span></>}
                  </>
                )}
              </p>
            )}

            {!isVideo && (
              <div ref={afterPickerRef} className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400">
                    <Wand2 className="h-3.5 w-3.5 text-[#C9A24D]" /> Effects — stack any, applied as one edit
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {EFFECTS.map((ef) => {
                      const on = effects.includes(ef.id)
                      return (
                        <button
                          key={ef.id}
                          onClick={() => setEffects(prev => on ? prev.filter(x => x !== ef.id) : [...prev, ef.id])}
                          className={`relative flex flex-col items-start gap-1 rounded-xl border-2 p-2.5 pr-7 text-left transition ${on ? 'border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/15 to-transparent' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-[#151517]'}`}
                        >
                          <span className="text-sm font-black text-[#111827] dark:text-white">{ef.label}</span>
                          <span className="w-full truncate text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">{ef.blurb}</span>
                          {on && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {effects.includes('virtual_staging') && (
                  <>
                    <OptionRow label="Room type">
                      {ROOM_TYPES.map((r) => <Chip key={r.id} active={options.room_type === r.id} onClick={() => setOptions(o => ({ ...o, room_type: r.id }))}>{r.label}</Chip>)}
                    </OptionRow>
                    <OptionRow label="Style">
                      {STAGING_STYLES.map((s) => <Chip key={s.id} active={options.style === s.id} onClick={() => setOptions(o => ({ ...o, style: s.id }))}>{s.label}</Chip>)}
                    </OptionRow>
                    <OptionRow label={'"Virtually Staged" tag on export'}>
                      {([
                        { id: 'off', label: 'Off' },
                        { id: 'bottom-right', label: 'Bottom right' },
                        { id: 'bottom-middle', label: 'Bottom middle' },
                      ] as const).map((p) => (
                        <Chip key={p.id} active={(options.staging_tag || 'off') === p.id} onClick={() => setOptions(o => ({ ...o, staging_tag: p.id }))}>{p.label}</Chip>
                      ))}
                    </OptionRow>
                  </>
                )}
                {effects.includes('enhance') && (
                  <EnhancementOptions value={options.enhancements || []} onToggle={id => setOptions(o => {
                    const set = new Set(o.enhancements || [])
                    set.has(id) ? set.delete(id) : set.add(id)
                    return { ...o, enhancements: Array.from(set) as StudioEnhancement[] }
                  })} />
                )}
                {effects.includes('enhance') && photo && (options.enhancements || []).some(e => e === 'declutter' || e === 'remove_furniture') && (
                  <RemoveAreaPainter photoUrl={photo.url} value={options.remove_areas || []}
                    onChange={next => setOptions(o => ({ ...o, remove_areas: next.length ? next : undefined }))} />
                )}
              </div>
            )}

            {isVideo && (
              <div className="mt-5 space-y-2">
                <OptionRow label="Style">
                  <Chip active={(options.video_style || 'standard') === 'standard'} onClick={() => setOptions(o => ({ ...o, video_style: 'standard' }))}>
                    Standard — gentle camera move
                  </Chip>
                  <Chip active={options.video_style === 'day_to_twilight'} onClick={() => setOptions(o => ({ ...o, video_style: 'day_to_twilight' }))}>
                    <span className="inline-flex items-center gap-1"><Sunset className="h-3 w-3" /> Day → Twilight timelapse</span>
                  </Chip>
                </OptionRow>
                {options.video_style === 'day_to_twilight' && (
                  <p className="flex items-start gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    <Sunset className="mt-0.5 h-3 w-3 shrink-0 text-[#C9A24D]" />
                    One photo, one clip of about 6 seconds — the camera holds completely still while daylight fades to dusk. Works best on an exterior photo with a real sky and windows.
                  </p>
                )}
              </div>
            )}

            {softCapped && (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                You've used most of this month's AI allowance, so AI Studio photo &amp; video are paused until it resets on the 1st. CMAs, cheat sheets and chat still work.
              </p>
            )}
            {!softCapped && estUsage && optionsValid && (
              <p className="mt-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Estimated: about <span className="font-black text-[#8b7355] dark:text-[#d7b974]">{estUsage.pct}%</span> of this month's AI usage
                {typeof usage?.month_ai_percent === 'number' ? ` (you're at ${usage.month_ai_percent}% now)` : ''}.
                {estUsage.wouldExhaust ? ' This may use up the rest of your monthly allowance.' : ''}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>
            )}
            {!videoReview && !busy && (
              <div className="mt-3">
                <button
                  onClick={generate}
                  disabled={busy || !optionsValid || (!isVideo && !photo) || softCapped || storageFull}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2a2e] px-5 py-2.5 text-sm font-black text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50 dark:from-white dark:to-gray-200 dark:text-[#111827]"
                >
                  <Sparkles className="h-4 w-4 text-[#C9A24D]" />
                  {isVideo ? 'Create video' : 'Generate'}
                </button>
              </div>
            )}

            {busy && !isVideo && (
              <PhotoGeneratingCard
                src={photo?.url}
                label={stageLabel(false, elapsed, effects.map(e => EFFECTS.find(x => x.id === e)?.label || e).join(' + '))}
                elapsed={elapsed}
              />
            )}
            {busy && isVideo && (
              <p className="mt-4 flex items-center gap-2 text-xs font-black text-[#8b7355] dark:text-[#d7b974]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Queuing your shots with OpenHousePal AI…
              </p>
            )}
          </Section>
        )}
      </div>
      {/* Phones: the flow bar (components/ui/FlowDock). Steps 1-2 move on by picking (a photo
          source, then Photo / Video), so only step 3 has the main action - the same generate() and
          the same can't-press rules as the Create / Generate button on the page. Back = the
          StepBar's own jumps (change the photos, change what to make). */}
      <FlowDock step={step} total={3}
        onBack={step === 2 ? changeSource : step === 3 ? startOver : undefined} backDisabled={busy}
        {...(step === 3 ? {
          onContinue: generate,
          busy,
          disabled: videoReview ? (softCapped || storageFull) : (!optionsValid || (!isVideo && !photo) || softCapped || storageFull),
          continueLabel: busy ? 'Working…' : isVideo ? 'Create' : 'Generate',
          icon: <Sparkles />,
        } : {})} />
    </div>
  )
}

function StepBar({ step, busy, onJumpToSource, onJumpToMode }: {
  step: number; busy: boolean
  onJumpToSource: () => void; onJumpToMode: () => void
}) {
  const stageIndex = step === 1 ? 1 : step === 2 ? 2 : busy ? 4 : 3
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState(0)
  const stageIndexRef = useRef(stageIndex)
  stageIndexRef.current = stageIndex
  useLayoutEffect(() => {
    const el = stepButtonRefs.current[stageIndex - 1]
    if (el) setBarWidth(el.offsetLeft + el.offsetWidth)
  }, [stageIndex])
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const btn = stepButtonRefs.current[stageIndexRef.current - 1]
      if (btn) setBarWidth(btn.offsetLeft + btn.offsetWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white/85 p-1.5 shadow-sm dark:border-gray-800 dark:bg-[#151517]/85">
      <div
        className="absolute bottom-1.5 left-1.5 top-1.5 rounded-xl bg-gradient-to-r from-[#111827] via-[#8b7355] to-[#C9A24D] shadow-[0_10px_30px_-18px_rgba(201,162,77,0.9)] transition-[width] duration-500 dark:from-white dark:via-[#d7b974] dark:to-[#C9A24D]"
        style={{ width: barWidth ? `${barWidth}px` : 0 }}
      />
      <div ref={gridRef} className="relative grid grid-cols-4 gap-1">
        {STUDIO_MEDIA_STAGES.map((label, i) => {
          const n = i + 1
          const isCurrent = n === stageIndex
          const isDone = n < stageIndex
          const jumpTo = n === 1 ? onJumpToSource : n === 2 ? onJumpToMode : undefined
          const clickable = isDone && !!jumpTo
          return (
            <button
              key={label}
              type="button"
              ref={el => { stepButtonRefs.current[i] = el }}
              onClick={clickable ? jumpTo : undefined}
              disabled={!clickable}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-[9px] font-black uppercase tracking-wide transition-all duration-500 sm:gap-2 sm:px-2 sm:text-[10px] ${clickable ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/10' : 'cursor-default'} ${
                isCurrent
                  ? 'scale-[1.02] bg-white text-[#111827] shadow-md ring-1 ring-[#C9A24D]/40 dark:bg-[#0B0B0B] dark:text-white'
                  : isDone
                    ? 'text-white dark:text-[#111827]'
                    : 'text-gray-400'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition sm:h-6 sm:w-6 ${
                isCurrent
                  ? 'bg-[#C9A24D] text-white shadow-[0_0_0_4px_rgba(201,162,77,0.16)]'
                  : isDone
                    ? 'bg-white/20 text-white ring-1 ring-white/30 dark:bg-black/10 dark:text-[#111827] dark:ring-black/10'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className="hidden min-w-0 truncate xl:block">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CreateMediaPageGuarded() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireStudioMediaAccess>
          <CreateMediaPage />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
