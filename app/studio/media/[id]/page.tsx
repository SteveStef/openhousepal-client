'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { smartBackClick } from '@/lib/navHistory'
import Link from 'next/link'
import {
  ArrowLeft, CalendarDays, Check, Clapperboard, Clock, Copy, Download, Edit3, ExternalLink, Film, Images, Loader2, Mail, MapPin, MonitorPlay,
  RectangleHorizontal, RectangleVertical, Share2, Sparkles, Square, Trash2, Wand2,
} from 'lucide-react'
import AiRunReceipt, { secondsBetween } from '@/components/ai/AiRunReceipt'
import { isTouchPhone, saveFile, shareLink } from '@/lib/mobileShare'
import { AnimatePresence, motion } from 'framer-motion'
import AuthGuard from '@/components/AuthGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BeforeAfter from '@/components/studio/media/BeforeAfter'
import {
  DEFAULT_BRANDING, DEFAULT_TITLE_CARD, VideoOverlayEditor, VideoResultPlayer, motionOn, renderMotionVideo,
} from '@/components/studio/media/VideoOverlayPanel'
import ConfirmationModal from '@/components/ConfirmationModal'
import api from '@/lib/api-service'
import { buildCheatSheetAgentData } from '@/lib/bragSheetData'
import { useAuth } from '@/contexts/AuthContext'
import type {
  BrandKit, BrandingOptions, StudioEnhancement, StudioImageEffect, StudioMediaAsset, TitleCardOptions,
} from '@/types'
import {
  EFFECTS, ENHANCEMENTS, EnhancementOptions, OHP_MEDIA_STYLE, OptionRow, PHOTO_ETA_SECONDS, ROOM_TYPES, STAGING_STYLES, Section, Chip, StagedPhoto,
  actionLabel, estimatedVideoSeconds, formatMinSec, stageLabel,
} from '@/components/studio/media/shared'
import RemoveAreaPainter from '@/components/studio/media/RemoveAreaPainter'

type VideoFmt = '16:9' | '9:16' | '1:1' | '4:5'
const VIDEO_FORMATS: { id: VideoFmt; label: string; sub: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: '16:9', label: 'Landscape', sub: 'YouTube · web · 16:9', icon: RectangleHorizontal },
  { id: '9:16', label: 'Vertical', sub: 'Reels · TikTok · Shorts · 9:16', icon: RectangleVertical },
  { id: '1:1', label: 'Square', sub: 'Instagram / Facebook feed · 1:1', icon: Square },
  { id: '4:5', label: 'Portrait', sub: 'Instagram / Facebook feed · 4:5', icon: RectangleVertical },
]
const VIDEO_FMT_PREVIEW_CLASS: Record<VideoFmt, string> = {
  '16:9': 'aspect-video max-w-[min(100%,calc(44vh*16/9))]',
  '9:16': 'aspect-[9/16] max-w-[min(340px,calc(48vh*9/16))]',
  '1:1': 'aspect-square max-w-[min(420px,46vh)]',
  '4:5': 'aspect-[4/5] max-w-[min(400px,calc(46vh*4/5))]',
}

// One project's result view - split out of the old single-page modal into its own route
// (matching CMA's /studio/cma/[id]) so opening a project no longer keeps the whole "Your
// projects" list mounted/polling underneath it. By construction a real StudioMediaAsset already
// exists by the time anyone lands here (either just created by /studio/media/new, or opened from
// the list) - this page never shows the source/mode/photo-picker sections at all, only ever the
// result (or its in-progress state).
function MediaResultPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [current, setCurrent] = useState<StudioMediaAsset | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [history, setHistory] = useState<StudioMediaAsset[]>([])
  const [fmt, setFmt] = useState<VideoFmt>('16:9')
  const [downloadingFmt, setDownloadingFmt] = useState<VideoFmt | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [savingStagingTag, setSavingStagingTag] = useState(false)
  const setStagingTag = async (position: 'bottom-right' | 'bottom-middle' | 'off') => {
    if (!current) return
    // Shown on the photo right away (the label preview), saved behind it.
    const before = current
    setCurrent({ ...current, options: { ...(current.options || {}), staging_tag: position } })
    setSavingStagingTag(true)
    const { success, data } = await api.mediaLab.setStagingTag(current.id, position)
    setSavingStagingTag(false)
    if (success && data) setCurrent(data)
    else setCurrent(before)
  }
  const [error, setError] = useState('')
  // In-browser render of a video with its motion design (see renderMotionVideo) - 0..1, null = idle.
  const [rendering, setRendering] = useState<number | null>(null)
  // The video's real length, read off the player (the stored duration is the nominal clip total).
  const [videoLength, setVideoLength] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<StudioMediaAsset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])
  useEffect(() => stopPolling, [stopPolling])

  // Set when this page saw the run finish (it was processing when opened) - plays the reveal.
  const [justFinished, setJustFinished] = useState(false)
  const pollAsset = useCallback((assetId: string, everyMs = 4000) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const { success, data } = await api.mediaLab.getAsset(assetId)
      if (!success || !data) return
      setCurrent(prev => (prev && prev.id === data.id ? data : prev))
      setHistory(prev => prev.map(h => (h.id === data.id ? data : h)))
      if (data.status !== 'processing') { stopPolling(); setJustFinished(true) }
    }, everyMs)
  }, [stopPolling])

  // Monthly AI allowance (for the "used X% of monthly AI" receipt once a run is done).
  const [monthBudget, setMonthBudget] = useState<number | null>(null)
  useEffect(() => {
    if (current?.status === 'processing') return
    let alive = true
    api.mediaLab.usage().then(r => { if (alive && r.success && r.data) setMonthBudget(r.data.month_ai_budget_usd ?? null) })
    return () => { alive = false }
  }, [current?.status])

  // Load the asset itself, then its real version history (every row sharing the same group_id -
  // all prior/later versions from this same source photo + action, not just whatever happened to
  // generate in this browser tab this session).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    api.mediaLab.getAsset(id).then(({ success, data }) => {
      if (!alive) return
      if (!success || !data) { setNotFound(true); setLoading(false); return }
      setCurrent(data)
      setLoading(false)
      // A photo edit now runs in the background too (it used to hold the request open, and a
      // phone leaving the page showed "Network error") - poll it a little faster than a video.
      if (data.status === 'processing') pollAsset(data.id, data.kind === 'video' ? 4000 : 2500)
      api.mediaLab.listAssets({ group_id: data.group_id, limit: 30 }).then(r => {
        if (alive && r.success && r.data) setHistory(r.data.assets)
      })
    })
    return () => { alive = false }
  }, [id, pollAsset])

  useEffect(() => { setFmt('16:9') }, [current?.id])

  // Actually looking at a finished video here counts as "seen it" for the AI Video Ready/Failed
  // bell alert - same trigger as opening the bell or the Activity page (see notificationDisplay.tsx).
  useEffect(() => {
    if (!current || current.kind !== 'video' || current.status === 'processing') return
    api.notifications.markTypesAsRead(['STUDIO_MEDIA_VIDEO_READY', 'STUDIO_MEDIA_VIDEO_FAILED'])
  }, [current?.id, current?.status])

  const reframeCacheRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map())
  const [previewVersion, setPreviewVersion] = useState(0)
  useEffect(() => () => { reframeCacheRef.current.forEach(v => URL.revokeObjectURL(v.url)); reframeCacheRef.current.clear() }, [])
  useEffect(() => {
    if (!current || current.kind !== 'video' || current.status !== 'succeeded' || !current.result_url) return
    if (fmt === '16:9') return
    const key = `${current.id}:${fmt}`
    if (reframeCacheRef.current.has(key)) return
    let cancelled = false
    api.mediaLab.download(current.id, fmt).then(({ success, blob }) => {
      if (cancelled) return
      if (success && blob) {
        reframeCacheRef.current.set(key, { blob, url: URL.createObjectURL(blob) })
        setPreviewVersion(v => v + 1)
      } else {
        setError('Could not load that preview format. Try again in a moment.')
        setFmt('16:9')
      }
    })
    return () => { cancelled = true }
  }, [fmt, current?.id, current?.status, current?.result_url])
  const previewSrc = useMemo(() => {
    if (!current?.result_url) return undefined
    if (fmt === '16:9') return current.result_url
    return reframeCacheRef.current.get(`${current.id}:${fmt}`)?.url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.result_url, fmt, previewVersion])

  const [titleCard, setTitleCardState] = useState<TitleCardOptions>(DEFAULT_TITLE_CARD)
  const [branding, setBrandingState] = useState<BrandingOptions>(DEFAULT_BRANDING)
  useEffect(() => {
    setTitleCardState(current?.options?.title_card ?? DEFAULT_TITLE_CARD)
    setBrandingState(current?.options?.branding ?? DEFAULT_BRANDING)
  }, [current?.id])
  const overlaySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveOverlay = useCallback((assetId: string, tc: TitleCardOptions, br: BrandingOptions) => {
    if (overlaySaveRef.current) clearTimeout(overlaySaveRef.current)
    overlaySaveRef.current = setTimeout(() => {
      api.mediaLab.updateOverlay(assetId, { title_card: tc, branding: br })
    }, 600)
  }, [])
  const setTitleCard = useCallback((next: TitleCardOptions) => {
    setTitleCardState(next)
    if (current) saveOverlay(current.id, next, branding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, branding, saveOverlay])
  const setBranding = useCallback((next: BrandingOptions) => {
    setBrandingState(next)
    if (current) saveOverlay(current.id, titleCard, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, titleCard, saveOverlay])
  useEffect(() => () => { if (overlaySaveRef.current) clearTimeout(overlaySaveRef.current) }, [])

  // Agent-given display name for this project - shown in the header and (for video) editable
  // right under the Branding section, autosaved the same debounced way as the overlay settings.
  const [name, setNameState] = useState('')
  useEffect(() => { setNameState(current?.options?.custom_name || '') }, [current?.id])
  const nameSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setName = useCallback((next: string) => {
    setNameState(next)
    if (!current) return
    if (nameSaveRef.current) clearTimeout(nameSaveRef.current)
    const assetId = current.id
    nameSaveRef.current = setTimeout(() => { api.mediaLab.rename(assetId, next) }, 600)
  }, [current])
  useEffect(() => () => { if (nameSaveRef.current) clearTimeout(nameSaveRef.current) }, [])

  // Photo-only: pick a different effect (or tweak the same one's options) without leaving this
  // page, so "Version history" on the side has a real purpose for photos - re-running lands as a
  // new sibling version in the same group, same as regenerating always has. Videos deliberately
  // don't get this (their own creation flow is the multi-step wizard, not a quick re-run).
  const [regenEffects, setRegenEffects] = useState<StudioImageEffect[]>([])
  const [regenRoomType, setRegenRoomType] = useState<string | undefined>(undefined)
  const [regenStyle, setRegenStyle] = useState<string | undefined>(undefined)
  const [regenEnhancements, setRegenEnhancements] = useState<StudioEnhancement[]>([])
  const [regenerating, setRegenerating] = useState(false)
  useEffect(() => {
    if (!current || current.kind !== 'image') return
    setRegenEffects((current.action.split('+').filter(Boolean) as StudioImageEffect[]))
    setRegenRoomType(current.options?.room_type)
    setRegenStyle(current.options?.style)
    setRegenEnhancements(current.options?.enhancements || [])
    setRegenAreas(current.options?.remove_areas || [])
  }, [current?.id])
  const [regenAreas, setRegenAreas] = useState<number[][][]>([])
  const regenValid = regenEffects.length > 0 && (!regenEffects.includes('virtual_staging') || (!!regenRoomType && !!regenStyle))
  const createNewVersion = async () => {
    if (!current || !regenValid) return
    setRegenerating(true)
    setError('')
    const { success, data, error: e } = await api.mediaLab.regenerate(current.id, {
      room_type: regenEffects.includes('virtual_staging') ? regenRoomType : undefined,
      style: regenEffects.includes('virtual_staging') ? regenStyle : undefined,
      enhancements: regenEffects.includes('enhance') ? regenEnhancements : undefined,
      remove_areas: regenEffects.includes('enhance') && regenAreas.length ? regenAreas : undefined,
    } as any, regenEffects)
    setRegenerating(false)
    if (!success || !data) { setError(e || "Couldn't start that version. Try again."); return }
    router.push(`/studio/media/${data.id}`)
  }

  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  useEffect(() => {
    let alive = true
    api.studio.getBrandKit().then(r => { if (alive && r.success && r.data) setBrandKit(r.data) })
    return () => { alive = false }
  }, [])
  const agentName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
  const agentBrokerage = user?.brokerage || ''
  const agentAvatarUrl = user?.photo_url || brandKit?.personal_logo_url || brandKit?.team_logo_url || brandKit?.brokerage_logo_url || null
  // Phone for the closing card - the same contact the agent's other print pieces use.
  const [agentPhone, setAgentPhone] = useState('')
  useEffect(() => {
    if (!user) return
    buildCheatSheetAgentData(user).then(a => setAgentPhone(a.phone || '')).catch(() => {})
  }, [user])

  const busy = current?.status === 'processing'
  useEffect(() => {
    if (!busy || !current?.created_at) { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } return }
    const startedAt = new Date(current.created_at).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, 500)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [busy, current?.created_at])

  const videoShots = useMemo(() => {
    const clips = (current?.options?.clips as { status: string; output_url?: string; final_url?: string; source?: string }[] | undefined) || []
    if (!clips.length) return null
    const rendered = clips.filter(c => !!c.output_url).length
    const enhanced = clips.filter(c => !!c.final_url).length
    const failed = clips.some(c => c.status === 'failed')
    const phase: 'rendering' | 'enhancing' | 'finishing' =
      rendered < clips.length ? 'rendering' : enhanced < clips.length ? 'enhancing' : 'finishing'
    const photos = clips.map(c => c.source).filter((s): s is string => !!s)
    return { done: rendered, doneEnhancing: enhanced, total: clips.length, failed, phase, photos }
  }, [current?.options?.clips])

  // One clip per photo - the timeline marks where they change.
  const clipCount = Math.max(1, ((current?.options?.clips as unknown[] | undefined)?.length) || Number(current?.options?.photo_count) || 1)

  const currentHasStaging = !!current && (current.action.includes('virtual_staging') || (current.options?.effects || []).includes('virtual_staging'))

  const downloadAsset = async (asset: StudioMediaAsset, ratio?: VideoFmt) => {
    const isVid = asset.kind === 'video'
    if (isVid && ratio) setDownloadingFmt(ratio)
    setError('')
    const tc = asset.id === current?.id ? titleCard : (asset.options?.title_card ?? null)
    const br = asset.id === current?.id ? branding : (asset.options?.branding ?? null)
    const overlayOn = isVid && motionOn(tc, br)
    const cached = isVid && ratio ? reframeCacheRef.current.get(`${asset.id}:${ratio}`) : undefined
    const base = cached ? { success: true, blob: cached.blob } : await api.mediaLab.download(asset.id, isVid ? ratio : undefined)
    let blob: Blob | undefined = base.success ? base.blob : undefined
    let ext = isVid ? 'mp4' : 'png'
    if (blob && overlayOn) {
      // The design is drawn into the video right here in the browser - the exact frames the
      // preview showed - then recorded.
      try {
        setRendering(0)
        const out = await renderMotionVideo({
          source: blob, titleCard: tc || DEFAULT_TITLE_CARD, branding: br || DEFAULT_BRANDING, listing: asset.linked_property ?? null,
          agent: { name: agentName, brokerage: agentBrokerage, phone: agentPhone, avatarUrl: agentAvatarUrl },
          clipCount: Math.max(1, ((asset.options?.clips as unknown[] | undefined)?.length) || Number(asset.options?.photo_count) || 1),
          onProgress: p => setRendering(p),
        })
        blob = out.blob
        ext = out.ext
      } catch {
        blob = undefined
      } finally {
        setRendering(null)
      }
    }
    if (isVid && ratio) setDownloadingFmt(null)
    if (!blob) { setError('Download failed. Try again in a moment.'); return }
    const tag = isVid && ratio && ratio !== '16:9' ? `-${ratio.replace(':', 'x')}` : ''
    // Phone: the Share sheet (Save Image / Save to Files in one tap). Computer: a plain download.
    await saveFile(blob, `${asset.action.replace(/\+/g, '-')}-${asset.id.slice(0, 8)}${tag}.${ext}`)
  }

  // Phones: a Share sheet only opens during the tap itself, so the finished photo (with its
  // "Virtually Staged" label, if on) is fetched ahead - Download / Share then hand it over at once.
  const [readyPhoto, setReadyPhoto] = useState<{ key: string; blob: Blob } | null>(null)
  const photoKey = current && current.kind === 'image' && current.status === 'succeeded' ? `${current.id}:${current.options?.staging_tag || 'off'}` : ''
  useEffect(() => {
    if (!photoKey || !current || !isTouchPhone()) return
    let alive = true
    api.mediaLab.download(current.id).then(({ success, blob }) => { if (alive && success && blob) setReadyPhoto({ key: photoKey, blob }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey])
  const photoFileName = current ? `${current.action.replace(/\+/g, '-')}-${current.id.slice(0, 8)}.png` : 'photo.png'
  const [savingPhoto, setSavingPhoto] = useState(false)
  const download = async (ratio?: VideoFmt) => {
    if (!current) return
    if (current.kind === 'image' && readyPhoto?.key === photoKey) { await saveFile(readyPhoto.blob, photoFileName); return }
    if (current.kind === 'image') setSavingPhoto(true)
    try { await downloadAsset(current, ratio) } finally { setSavingPhoto(false) }
  }

  // Share: phone = the Share sheet (the photo itself when it's ready, else its link); computer =
  // a small menu - copy the link (says "Link copied"), open it, or email it.
  const [shareMenu, setShareMenu] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!shareMenu) return
    const onDown = (e: MouseEvent) => { if (!shareRef.current?.contains(e.target as Node)) setShareMenu(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [shareMenu])
  const share = async () => {
    if (!current?.result_url) return
    if (isTouchPhone()) {
      if (current.kind === 'image' && readyPhoto?.key === photoKey && typeof File !== 'undefined') {
        const file = new File([readyPhoto.blob], photoFileName, { type: readyPhoto.blob.type || 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file] }); return } catch (e) { if ((e as Error)?.name === 'AbortError') return }
        }
      }
      await shareLink(current.result_url, name.trim() || actionLabel(current.action))
      return
    }
    setShareMenu(v => !v)
  }
  const copyShareLink = async () => {
    if (!current?.result_url) return
    const r = await shareLink(current.result_url)
    if (r === 'copied') { setShareCopied(true); window.setTimeout(() => setShareCopied(false), 1800) }
  }

  const confirmDelete = async () => {
    const asset = pendingDelete
    if (!asset) return
    setDeleting(true)
    const { success, error: e } = await api.mediaLab.remove(asset.id)
    setDeleting(false)
    setPendingDelete(null)
    if (!success) { setError(e || 'Could not delete that item.'); return }
    if (asset.id === current?.id) router.push('/studio/media')
    else setHistory(prev => prev.filter(a => a.id !== asset.id))
  }

  const openVersion = (asset: StudioMediaAsset) => {
    if (asset.id === current?.id) return
    router.push(`/studio/media/${asset.id}`)
  }

  if (loading) {
    return <OhpLoader />
  }
  if (notFound || !current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <p className="text-sm font-bold text-gray-500">Project not found.</p>
        <Link href="/studio/media" className="text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Back to your projects</Link>
      </div>
    )
  }

    // Everything worth knowing about this project, on the title line itself.
    const lp = current.linked_property
    const created = current.created_at ? new Date(current.created_at) : null
    const fh = Number(current.options?.final_height) || 0
    const res = fh >= 2160 ? '4K' : fh >= 1440 ? '2K' : fh >= 1080 ? '1080p' : fh ? `${fh}p` : ''
    const clipsN = (current.options?.clips as unknown[] | undefined)?.length || 0
    const secs = videoLength ?? (Number(current.options?.duration_seconds) || 0)
    const chip = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-gray-400'
    // `phone`: still shown on a phone, where the whole title line stays on ONE line (user, 10/24:
    // "Result / VIRTUAL STAGE / 191 PRESIDENTIAL BLVD" was wrapping onto three) - the address
    // shrinks with "…" instead of wrapping.
    const chips: { icon: React.ReactNode; label: string; title?: string; phone?: boolean; shrink?: boolean }[] = []
    if (current.kind === 'video' && secs) chips.push({ icon: <Clock className="h-3 w-3" />, label: `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`, title: 'Length' })
    if (current.kind === 'video' && clipsN > 1) chips.push({ icon: <Clapperboard className="h-3 w-3" />, label: `${clipsN} clips` })
    if (res) chips.push({ icon: <MonitorPlay className="h-3 w-3" />, label: res, title: `${current.options?.final_width}×${fh}` })
    if (lp?.address) chips.push({ icon: <MapPin className="h-3 w-3 shrink-0" />, label: lp.address.split(',')[0], title: [lp.address, lp.city, lp.state].filter(Boolean).join(', '), phone: true, shrink: true })
    if (created) chips.push({ icon: <CalendarDays className="h-3 w-3" />, label: created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(created.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }), title: created.toLocaleString() })
    const resultHeader = (
      <>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 text-[10px] font-black uppercase tracking-wide sm:gap-1.5 sm:px-2.5 sm:tracking-widest text-[#8b7355] dark:text-[#d7b974]">
          <Sparkles className="h-3 w-3" /> {actionLabel(current.action)}
        </span>
        {name.trim() && <span className="hidden min-w-0 max-w-[260px] truncate text-sm font-black text-[#111827] dark:text-white sm:inline" title={name}>{name}</span>}
        {current.status === 'processing' && <span className={`${chip} hidden border-[#C9A24D]/50 text-[#8b7355] sm:inline-flex`}><Loader2 className="h-3 w-3 animate-spin" /> Working</span>}
        {current.status === 'failed' && <span className={`${chip} border-red-200 text-red-600`}>Failed</span>}
        {chips.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5 sm:ml-auto sm:flex-wrap sm:justify-end">
            {chips.map(c => (
              <span key={c.label} className={`${c.shrink ? `${chip.replace('shrink-0 ', '')} min-w-0` : chip} ${c.phone ? '' : 'hidden sm:inline-flex'}`} title={c.title}>
                {c.icon}{c.shrink ? <span className="min-w-0 truncate">{c.label}</span> : c.label}
              </span>
            ))}
          </div>
        )}
      </>
    )

  return (
    <div className="ohp-media-lab min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style>{OHP_MEDIA_STYLE}</style>
      <div className={`mx-auto px-4 py-4 sm:py-6 ${current.kind === 'video' ? 'max-w-[1440px]' : 'max-w-5xl'}`}>
        <Section step={0} title="Result" active flush oneLine
          leading={
            <Link href="/studio/media" onClick={smartBackClick(router)} title="All projects" aria-label="Back to all projects"
              className="group grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:-translate-x-0.5 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-gray-400">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
          }
          aside={resultHeader}>
          <div className={`grid gap-5 ${current.kind === 'video' ? 'lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]' : current.status === 'processing' ? '' : 'lg:grid-cols-[minmax(0,1fr)_320px]'}`}>
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A24D]/40 bg-gradient-to-br from-[#C9A24D]/[0.08] via-white to-white p-3 shadow-[0_0_40px_-16px_rgba(201,162,77,0.5)] dark:via-[#151517] dark:to-[#151517] sm:p-4">

              {current.status === 'processing' && current.kind === 'image' && (() => {
                // A photo edit in progress: the two finished steps folded to one line each, then
                // only the generating animation - nothing else to scroll past (user, 10/24).
                const o = current.options || {}
                const detail = [
                  o.room_type && ROOM_TYPES.find(r => r.id === o.room_type)?.label,
                  o.style && STAGING_STYLES.find(s => s.id === o.style)?.label,
                  ...((o.enhancements as string[] | undefined) || []).map(e => ENHANCEMENTS.find(x => x.id === e)?.label),
                  o.remove_areas?.length ? `${o.remove_areas.length} area${o.remove_areas.length === 1 ? '' : 's'} circled` : null,
                ].filter(Boolean).join(' · ')
                const pct = Math.max(4, Math.min(96, Math.round((elapsed / PHOTO_ETA_SECONDS) * 100)))
                const doneStep = 'flex min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white/80 px-2.5 py-2 dark:border-gray-800 dark:bg-[#1A1A1C]/80'
                const tick = <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#111827] text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
                return (
                  <div className="ohp-reveal">
                    <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
                      <div className={doneStep}>
                        {tick}
                        <img src={current.source_photo_url} alt="" className="h-8 w-11 shrink-0 rounded-md object-cover" />
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-gray-400">Photo</p>
                          <p className="truncate text-xs font-black text-[#111827] dark:text-white">{lp?.address?.split(',')[0] || (current.source_kind === 'upload' ? 'Your upload' : 'Listing photo')}</p>
                        </div>
                      </div>
                      <div className={doneStep}>
                        {tick}
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-gray-400">{actionLabel(current.action)}</p>
                          <p className="truncate text-xs font-black text-[#111827] dark:text-white">{detail || 'As picked'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="relative mx-auto min-h-[380px] w-full max-w-3xl overflow-hidden rounded-xl border-2 border-[#C9A24D]/50 sm:aspect-[16/10] sm:min-h-0" style={{ boxShadow: '0 0 44px -10px rgba(201,162,77,0.5)' }}>
                      <img src={current.source_photo_url} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.5]" draggable={false} />
                      <div className="pointer-events-none absolute inset-x-0 h-1/3" style={{ animation: 'ohpScan 2.1s cubic-bezier(.4,0,.2,1) infinite', background: 'linear-gradient(180deg,transparent,rgba(230,199,122,0.5) 45%,rgba(255,255,255,0.8) 50%,rgba(230,199,122,0.5) 55%,transparent)', filter: 'blur(2px)' }} />
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="relative flex h-11 w-11 items-center justify-center">
                          <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40" style={{ animation: 'ohpGlow 1.6s ease-in-out infinite' }} />
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                        <p className="text-sm font-black text-white drop-shadow">{stageLabel(false, elapsed, actionLabel(current.action))}</p>
                        <p className="font-serif text-3xl font-black tabular-nums leading-none text-white drop-shadow">{pct}%</p>
                        <div className="h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-white/15">
                          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C9A24D,#f1d58b,#C9A24D)', backgroundSize: '200% 100%', animation: 'ohpShimmer 1.8s linear infinite' }} />
                        </div>
                        <p className="text-[11px] font-bold tabular-nums text-white/70">{formatMinSec(elapsed)} · usually about a minute</p>
                        <p className="max-w-[270px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10.5px] font-semibold leading-snug text-white/75">
                          Leave whenever you like - it keeps working and waits in your Media Lab.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
              {current.status === 'processing' && current.kind === 'video' && (
                <div
                  className="relative flex w-full min-h-[320px] flex-col items-center justify-center gap-3.5 overflow-hidden rounded-xl border-2 border-[#C9A24D]/50 px-8 py-8 text-center"
                  style={{ boxShadow: '0 0 44px -10px rgba(201,162,77,0.5)' }}
                >
                  {videoShots && videoShots.photos.length > 1 ? (
                    <div className="absolute inset-0 flex">
                      {videoShots.photos.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-full flex-1 scale-105 object-cover blur-[2px] brightness-[0.5]" draggable={false} />
                      ))}
                    </div>
                  ) : current.source_photo_url ? (
                    <img src={current.source_photo_url} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.5]" draggable={false} />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820]" />
                  )}
                  <div
                    className="pointer-events-none absolute inset-x-0 h-1/3"
                    style={{ animation: 'ohpScan 2.1s cubic-bezier(.4,0,.2,1) infinite', background: 'linear-gradient(180deg,transparent,rgba(230,199,122,0.5) 45%,rgba(255,255,255,0.8) 50%,rgba(230,199,122,0.5) 55%,transparent)', filter: 'blur(2px)' }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-3.5">
                    <div className="relative flex h-11 w-11 items-center justify-center">
                      <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40" style={{ animation: 'ohpGlow 1.6s ease-in-out infinite' }} />
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                    <p className="text-sm font-black text-white drop-shadow">
                      {stageLabel(true, elapsed, '', current.options?.clips)}
                    </p>
                    {(() => {
                      const photoCount = videoShots?.total || (current.options?.photo_count as number | undefined) || 5
                      const estTotal = estimatedVideoSeconds(photoCount)
                      const remaining = estTotal - elapsed
                      return (
                        <p className="text-[11px] font-bold text-white/70">
                          {remaining > 20 ? `Ready in about ${formatMinSec(remaining)}` : 'Finishing up now…'}
                        </p>
                      )
                    })()}
                    {(() => {
                      // A single time-based bar (real elapsed / estimated total, same math as the
                      // list page's ProjectCardVideoProgress) - always visible under the spinner,
                      // never swapped out for a per-clip thumbnail row. Reworked 2026-09-06: the
                      // old version hid this bar during the (usual, longest) "rendering" phase and
                      // showed a row of small per-clip photo chips instead - direct feedback was
                      // that the mini photos under the "Finishing up now…" text should go, and the
                      // actual time-based bar should just always be there.
                      const photoCount = videoShots?.total || (current.options?.photo_count as number | undefined) || 5
                      const estTotal = estimatedVideoSeconds(photoCount)
                      const pct = Math.max(4, Math.min(96, Math.round((elapsed / estTotal) * 100)))
                      return (
                        <div className="w-full max-w-[260px]">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full transition-[width] duration-700 ease-out"
                              style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C9A24D,#f1d58b,#C9A24D)', backgroundSize: '200% 100%', animation: 'ohpShimmer 1.8s linear infinite' }}
                            />
                          </div>
                        </div>
                      )
                    })()}
                    {(() => {
                      const photoCount = videoShots?.total || (current.options?.photo_count as number | undefined) || 5
                      const ceilingMin = Math.max(3, Math.round(estimatedVideoSeconds(photoCount) / 60))
                      return (
                        <div className="max-w-[250px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 ">
                          <p className="text-[10.5px] font-semibold leading-snug text-white/70">
                            Usually done within ~{ceilingMin} min. Feel free to close this tab — we'll notify you in the Activity bell when it's ready.
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
              {current.status === 'failed' && (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {current.error_message || 'Generation failed.'}
                </div>
              )}

              {current.status === 'succeeded' && current.kind === 'image' && current.result_url && (
                currentHasStaging ? (
                  <div>
                    {/* The "Virtually Staged" label is drawn on the preview exactly where (and as
                        big as) it lands on the downloaded photo - see apply_staging_tag. */}
                    <StagedPhoto
                      src={showOriginal ? current.source_photo_url : current.result_url}
                      tag={showOriginal ? 'off' : current.options?.staging_tag}
                      className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 ${justFinished ? 'ohp-reveal' : ''}`}
                      imgClassName="max-h-[72vh] w-auto"
                    />
                    <button onClick={() => setShowOriginal(v => !v)} className="mt-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white">
                      {showOriginal ? 'Show staged' : 'Show original'}
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wide text-gray-400">&quot;Virtually Staged&quot; label:</span>
                      {([
                        { id: 'off', label: 'Off' },
                        { id: 'bottom-middle', label: 'Bottom middle' },
                        { id: 'bottom-right', label: 'Bottom right' },
                      ] as const).map((p) => (
                        <button
                          key={p.id}
                          disabled={savingStagingTag}
                          onClick={() => setStagingTag(p.id)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition disabled:opacity-50 ${(current.options?.staging_tag || 'off') === p.id ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D]/50 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <BeforeAfter before={current.source_photo_url} after={current.result_url} alt={current.action} />
                )
              )}
              {current.status === 'succeeded' && current.kind === 'video' && current.result_url && (
                previewSrc ? (
                  <VideoResultPlayer
                    key={`${current.id}:${fmt}`}
                    previewSrc={previewSrc}
                    previewClassName={VIDEO_FMT_PREVIEW_CLASS[fmt]}
                    titleCard={titleCard}
                    branding={branding}
                    listing={current.linked_property ?? null}
                    agentName={agentName}
                    agentBrokerage={agentBrokerage}
                    agentAvatarUrl={agentAvatarUrl}
                    agentPhone={agentPhone}
                    clipCount={clipCount}
                    onTitleCardChange={setTitleCard}
                    onDuration={setVideoLength}
                  />
                ) : (
                  <div className={`relative mx-auto w-full ${VIDEO_FMT_PREVIEW_CLASS[fmt]}`}>
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-black dark:border-gray-700">
                      <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />
                      <span className="text-[10px] font-bold text-white/60">Cropping {VIDEO_FORMATS.find(f => f.id === fmt)?.label.toLowerCase()} preview…</span>
                    </div>
                  </div>
                )
              )}

              {current.status === 'succeeded' && current.kind === 'video' && current.result_url && (
                <div className="mt-3 rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.06] p-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <p className="flex items-center gap-1.5 pl-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]" title="Tap a format to preview it, or the arrow to download it. Every format is cropped from the one master render; nothing re-generates.">
                      <Download className="h-3 w-3" /> Export
                    </p>
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 md:grid-cols-4">
                      {VIDEO_FORMATS.map(f => {
                        const active = fmt === f.id
                        const dloading = downloadingFmt === f.id
                        return (
                          <div key={f.id} className={`flex items-center overflow-hidden rounded-lg border-2 transition ${active ? 'border-[#C9A24D] bg-white shadow-sm dark:bg-[#1A1A1C]' : 'border-transparent bg-white/60 hover:border-[#C9A24D]/40 dark:bg-[#1A1A1C]/60'}`}>
                            <button type="button" onClick={() => setFmt(f.id)} title={f.sub} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left">
                              <f.icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                              <span className="min-w-0 leading-tight">
                                <span className="block truncate text-[11px] font-black text-[#111827] dark:text-white">{f.label}</span>
                                <span className="block text-[8.5px] font-bold uppercase tracking-wide text-gray-400">{f.id}</span>
                              </span>
                            </button>
                            <button type="button" onClick={() => { setFmt(f.id); download(f.id) }} disabled={!!downloadingFmt} title={`Download ${f.label}`} aria-label={`Download ${f.label}`}
                              className="grid h-full w-8 shrink-0 place-items-center self-stretch bg-[#111827] text-white transition hover:bg-[#C9A24D] hover:text-[#111827] disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                              {dloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>
              )}

              {current.status === 'succeeded' && (
                // Delete on the left; Share, Download, Done on the right - all four on one line,
                // phones included (user, 10/24). Done only goes back to the list; it never saves
                // or creates anything (the project is already saved).
                <div className="mt-3 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                  <button onClick={() => setPendingDelete(current)} className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:py-2.5 font-black text-red-600 transition hover:border-red-400 hover:bg-red-50 dark:border-red-900/40 dark:bg-[#1A1A1C] dark:text-red-400 dark:hover:bg-red-900/20 sm:px-4 sm:text-xs">
                    <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete
                  </button>
                  <div ref={shareRef} className="relative sm:ml-auto">
                    <button onClick={share} aria-expanded={shareMenu} className="inline-flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:py-2.5 font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white sm:px-4 sm:text-xs">
                      <Share2 className="h-3.5 w-3.5 shrink-0" /> Share
                    </button>
                    <AnimatePresence>
                      {shareMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.16 }}
                          className="absolute bottom-full right-0 z-30 mb-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-gray-700 dark:bg-[#1A1A1C]"
                        >
                          <p className="px-2.5 pb-1 pt-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-gray-400">Share this {current.kind === 'video' ? 'video' : 'photo'}</p>
                          <button onClick={copyShareLink} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-black text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white">
                            {shareCopied ? <Check className="h-4 w-4 text-emerald-500" strokeWidth={3} /> : <Copy className="h-4 w-4 text-[#8b7355] dark:text-[#d7b974]" />}
                            {shareCopied ? 'Link copied' : 'Copy link'}
                          </button>
                          <a href={current.result_url || '#'} target="_blank" rel="noopener noreferrer" onClick={() => setShareMenu(false)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-black text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white">
                            <ExternalLink className="h-4 w-4 text-[#8b7355] dark:text-[#d7b974]" /> Open in a new tab
                          </a>
                          <a href={`mailto:?subject=${encodeURIComponent(name.trim() || actionLabel(current.action))}&body=${encodeURIComponent(current.result_url || '')}`} onClick={() => setShareMenu(false)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-black text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white">
                            <Mail className="h-4 w-4 text-[#8b7355] dark:text-[#d7b974]" /> Email it
                          </a>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {current.kind === 'image' ? (
                    <button onClick={() => download()} disabled={savingPhoto} className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:py-2.5 font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-60 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white sm:px-4 sm:text-xs">
                      {savingPhoto ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />} <span className="truncate">Download</span>
                    </button>
                  ) : (
                    <button onClick={() => download(fmt)} disabled={!!downloadingFmt} className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:py-2.5 font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-60 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white sm:px-4 sm:text-xs">
                      {downloadingFmt ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />} <span className="truncate">Download</span>
                    </button>
                  )}
                  <button onClick={() => router.push('/studio/media')} className="inline-flex flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-1 py-2 text-[11px] sm:flex-row sm:gap-1.5 sm:py-2.5 font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:text-xs">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} /> Done
                  </button>
                </div>
              )}

              {current.status === 'succeeded' && (
                <AiRunReceipt
                  className="mt-2.5"
                  label={current.kind === 'video' ? 'This video' : 'This edit'}
                  costUsd={current.cost_usd}
                  monthlyBudgetUsd={monthBudget}
                  tookSeconds={secondsBetween(current.created_at, current.updated_at)}
                />
              )}

              {/* Version history sits under the buttons now (user, 10/24). */}
              {current.kind === 'image' && current.status !== 'processing' && history.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-3.5 dark:border-gray-800">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <Images className="h-3.5 w-3.5" /> Version history <span className="text-gray-300 dark:text-gray-600">· {history.length}</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {history.map((h) => {
                      const dot = h.status === 'succeeded' ? 'bg-emerald-500' : h.status === 'failed' ? 'bg-red-500' : 'bg-[#C9A24D] animate-pulse'
                      return (
                        <button
                          key={h.id}
                          onClick={() => openVersion(h)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${current?.id === h.id ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-sm' : 'border-gray-200 bg-white hover:border-[#C9A24D]/40 dark:border-gray-800 dark:bg-[#151517]'}`}
                        >
                          <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                            {h.result_url && h.kind === 'image'
                              ? <img src={h.result_url} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center text-gray-300">{h.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> : <Film className="h-4 w-4" />}</div>}
                            <span className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-white dark:ring-[#151517] ${dot}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-[#111827] dark:text-white">{h.options?.custom_name || actionLabel(h.action)}</p>
                            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">
                              {h.status === 'processing' ? 'Generating…' : h.status === 'failed' ? 'Failed' : new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              {current?.id === h.id ? ' · viewing' : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {!(current.kind === 'image' && current.status === 'processing') && (() => {
              // Video deliberately has no "History" tab here - re-running a video isn't a cheap
              // options tweak the way a photo re-effect is, so there's no in-page regenerate flow
              // to give it a purpose, and sibling versions are still one click away from the list.
              if (current.kind === 'video') {
                return (
                  <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
                    <VideoOverlayEditor
                      titleCard={titleCard}
                      onTitleCardChange={setTitleCard}
                      branding={branding}
                      onBrandingChange={setBranding}
                      hasListing={!!current.linked_property}
                      listing={current.linked_property ?? null}
                      posterUrl={current.source_photo_url || videoShots?.photos[0] || current.linked_property?.image_url || null}
                      agent={{ name: agentName || 'Your Name', brokerage: agentBrokerage }}
                    />
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400">
                        <Edit3 className="h-3.5 w-3.5" /> Clip name
                      </label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={actionLabel(current.action)}
                        maxLength={120}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white"
                      />
                    </div>
                  </div>
                )
              }
              return (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400">
                      <Edit3 className="h-3.5 w-3.5" /> Project name
                    </label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={actionLabel(current.action)}
                      maxLength={120}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white"
                    />
                  </div>

                  <div className="rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.06] p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
                      <Wand2 className="h-3 w-3" /> Try a different effect
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {EFFECTS.map((ef) => {
                        const on = regenEffects.includes(ef.id)
                        return (
                          <button
                            key={ef.id}
                            onClick={() => setRegenEffects(prev => on ? prev.filter(x => x !== ef.id) : [...prev, ef.id])}
                            className={`relative flex flex-col items-start gap-0.5 rounded-lg border-2 px-2.5 py-1.5 pr-7 text-left transition ${on ? 'border-[#C9A24D] bg-white dark:bg-[#1A1A1C]' : 'border-transparent bg-white/60 hover:border-[#C9A24D]/40 dark:bg-[#1A1A1C]/60'}`}
                          >
                            <span className="text-xs font-black text-[#111827] dark:text-white">{ef.label}</span>
                            <span className="w-full truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">{ef.blurb}</span>
                            {on && <span className="absolute right-2 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
                          </button>
                        )
                      })}
                    </div>
                    {regenEffects.includes('virtual_staging') && (
                      <div className="mt-2.5 space-y-2">
                        <OptionRow label="Room type">
                          {ROOM_TYPES.map((r) => <Chip key={r.id} active={regenRoomType === r.id} onClick={() => setRegenRoomType(r.id)}>{r.label}</Chip>)}
                        </OptionRow>
                        <OptionRow label="Style">
                          {STAGING_STYLES.map((s) => <Chip key={s.id} active={regenStyle === s.id} onClick={() => setRegenStyle(s.id)}>{s.label}</Chip>)}
                        </OptionRow>
                      </div>
                    )}
                    {regenEffects.includes('enhance') && (
                      <div className="mt-2.5">
                        <EnhancementOptions value={regenEnhancements} onToggle={id => setRegenEnhancements(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />
                        {current?.source_photo_url && regenEnhancements.some(e => e === 'declutter' || e === 'remove_furniture') && (
                          <div className="mt-3"><RemoveAreaPainter photoUrl={current.source_photo_url} value={regenAreas} onChange={setRegenAreas} /></div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={createNewVersion}
                      disabled={!regenValid || regenerating}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] py-2 text-xs font-black text-[#111827] shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Create new version
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </Section>
      </div>

      {/* the design being rendered into the video */}
      <AnimatePresence>
        {rendering !== null && (
          <motion.div key="render" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0b0b0c]/75 p-4">
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm overflow-hidden rounded-[26px] bg-[#0b0b0c] p-6 text-center text-white ring-1 ring-white/10">
              <span className="relative mx-auto grid h-14 w-14 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#C9A24D]/30" />
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Film className="h-5 w-5" /></span>
              </span>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.26em] text-[#e8c97a]">Rendering your design</p>
              <p className="mt-1 font-serif text-3xl font-black tabular-nums">{Math.round((rendering || 0) * 100)}%</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D] transition-[width] duration-300" style={{ width: `${Math.max(3, (rendering || 0) * 100)}%` }} />
              </div>
              <p className="mt-3 text-[11px] font-semibold text-white/55">Plays through once in real time - keep this tab open.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        title="Delete this project?"
        message={`This removes the ${pendingDelete?.kind === 'video' ? 'video' : 'image'} from your storage for good. The original property photo is not touched.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/30"
      />
    </div>
  )
}

export default function MediaResultPageGuarded() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireStudioMediaAccess>
          <MediaResultPage />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}
