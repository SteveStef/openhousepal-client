'use client'

import NeighborhoodLinksPicker, { articleTextOf } from '@/components/studio/blogs/NeighborhoodLinksPicker'
import OhpLoader from '@/components/brand/OhpLoader'

import Link from 'next/link'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf } from '@/lib/luxeMetals'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { smartBack } from '@/lib/navHistory'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import { readyClock } from '@/lib/blogOvernight'
import { WhenSheet, addDays, nextWeekday, whenText, ymd } from '@/components/ui/WhenPicker'
import BlogThemeLivePreview from '@/components/studio/blogs/BlogThemeLivePreview'
import { MapPin as MapPinIcon, Lock } from 'lucide-react'
import {
  ArrowLeft, Archive, Calendar, Check, ChevronDown, Crown, Eye, EyeOff,
  ExternalLink, ImagePlus, Link2, Loader2, Newspaper, Palette, PenLine,
  Save, Search, Share2, ShieldAlert, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { EyeOff as EyeOffIcon, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { hasEmailSignatureAccess, getNavFeatureAccess } from '@/lib/navAccess'
import api, { resolveMediaUrl, type LinkableAreas } from '@/lib/api-service'
import { notify } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import GoogleVisibilityNote from '@/components/ui/GoogleVisibilityNote'
import { Blog, BlogAiContext, BlogAiRefineAction, BlogBlock, BrandKit } from '@/types'
import { BLOG_CATEGORIES } from '@/lib/studio/blogTopics'
import { buildGenericDefaultBlocks } from '@/lib/studio/designFormats'
import BlogArticleBody from '@/components/studio/blogs/BlogArticleBody'
import BlogCanvasEditor from '@/components/studio/blogs/editor/BlogCanvasEditor'
import { REFINABLE_TYPES, unitRange } from '@/components/studio/blogs/editor/blockOps'
import { BLOG_THEMES, BlogThemedArticle, CLASSIC_BLOG_ACCENTS, blogAccent, blogSignatureMatch, blogTheme, classicAccent } from '@/components/studio/blogs/BlogThemes'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import VerifiedPanel from '@/components/studio/blogs/VerifiedPanel'
import AiCoverMaker from '@/components/studio/blogs/AiCoverMaker'
import ConfirmationModal from '@/components/ConfirmationModal'
import BlogFinishStep, { applyFinish, emptyFinish, type FinishChoices } from '@/components/studio/blogs/BlogFinishStep'
import { luxeBlogAllowed, luxeBlogUpgrade } from '@/lib/navAccess'
import BlogAiWriter from '@/components/studio/blogs/BlogAiWriter'
import { startAiActivity, endAiActivity } from '@/lib/aiActivity'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { copyText } from '@/lib/copyText'
import { markOwnerLink } from '@/lib/ownerDevice'

// ---------------------------------------------------------------------------
// The article itself is edited on the page: components/studio/blogs/editor (BlogCanvasEditor).
// This file is the shell around it - the top bar, the Fact-check and Look tabs, Review & Publish.
// AI generation lives in components/studio/blogs/BlogAiWriter.tsx (the guided interview).
// ---------------------------------------------------------------------------

function blockPlainText(b: BlogBlock): string {
  const d = b.data || {}
  if (Array.isArray(d.items)) return d.items.join('\n')
  const raw = d.html || d.text || d.label || ''
  return String(raw).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&bull;/g, '•').replace(/&nbsp;/g, ' ')
}

// Every heading starts a section that runs to the next heading. The editor groups blocks this way
// (like Spotlight's sections) so a whole section can be folded, removed from the article - kept
// in the editor with "Add back" - or deleted for good. A removed section is a heading with
// data.hidden; the public renderer (BlogArticleBody.visibleBlocks) leaves it out.
function sectionInfo(blocks: BlogBlock[]) {
  const owner: Record<string, string | null> = {}
  const count: Record<string, number> = {}
  const headings: BlogBlock[] = []
  let current: string | null = null
  for (const b of blocks) {
    if (b.type === 'heading') { current = b.id; headings.push(b); count[b.id] = 0; owner[b.id] = null; continue }
    owner[b.id] = current
    if (current) count[current] += 1
  }
  return { owner, count, headings }
}

const headingText = (b: BlogBlock) => blockPlainText(b).trim() || 'Untitled section'

export default function BlogEditorPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard requireStudioDesignAccess>
        <BlogEditorPageInner />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function BlogEditorPageInner() {
  const [hoverLook, setHoverLook] = useState<Blog['theme'] | null>(null)
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [agentHubSlug, setAgentHubSlug] = useState<string | null>(null)
  // The agent's forms, so the preview's closing buttons open the real form like the live article.
  const [hubForms, setHubForms] = useState<{ formType: string; slug: string; title?: string }[]>([])
  // The agent's IDX neighborhood pages - so the preview shows the article's linked towns like the live one.
  const [linkableAreas, setLinkableAreas] = useState<LinkableAreas | null>(null)
  useEffect(() => { api.blogs.linkableAreas().then(r => { if (r.success && r.data) setLinkableAreas(r.data) }) }, [])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  // A plan below IDX can preview the Luxe article theme (with the upgrade pitch) without saving it.
  const [luxePeek, setLuxePeek] = useState(false)
  const [showAiDraft, setShowAiDraft] = useState(false)
  // ?ai=1 = just generated by the AI Blog Writer (BlogCreateFlow) - shows the review banner.
  const [aiDraft, setAiDraft] = useState(false)
  // The Finish step (video + closing pitch) when the agent didn't get to it in the writer - they
  // left while it was writing, or came back to it later.
  const [finishDismissed, setFinishDismissed] = useState(false)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('ai') === '1') setAiDraft(true) }, [])
  const [numbersToVerify, setNumbersToVerify] = useState<string[]>([])
  const [refineBusy, setRefineBusy] = useState<string | null>(null)
  const [refineError, setRefineError] = useState('')
  const blogRef = useRef<Blog | null>(null)
  blogRef.current = blog
  const editorAgent = useMemo(() => ({
    name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), brokerage: user?.brokerage, photoUrl: resolveMediaUrl(user?.photo_url),
    title: user?.professional_title, phone: (user as any)?.phone, email: user?.email,
  }), [user])
  const townsKey = JSON.stringify((((blog?.ai_review as any)?.towns || []) as any[]).map(t => t?.town))
  const editorTowns = useMemo(() => JSON.parse(townsKey) as string[], [townsKey])
  const linkedKey = (blog?.linked_areas || []).join('|')
  const editorLinks = useMemo(() => (linkableAreas?.ready ? linkedKey.split('|').filter(Boolean).map(slug => linkableAreas.areas.find(a => a.slug === slug)).filter(Boolean).map(a => ({ ...a!, url: a!.url || '#' })) : []), [linkableAreas, linkedKey])
  const editorFormHref = useMemo(() => (agentHubSlug ? ((slug: string) => `/${agentHubSlug}/${slug}?src=blog`) : undefined), [agentHubSlug])
  const [publishBusy, setPublishBusy] = useState(false)
  const [marketingBusy, setMarketingBusy] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  // The editor is three tabs instead of one long scroll (user, 10/17): the fact-check + finishing
  // touches, the look + cover, and the writing itself.
  const [tab, setTab] = useState<'finish' | 'look' | 'write'>('write')
  const tabFor = useRef<string | null>(null)
  const [liveLink, setLiveLink] = useState<string | null>(null)
  const [confirmRewrite, setConfirmRewrite] = useState(false)
  const [copied, setCopied] = useState(false)

  // IDX agents share the new domain-resolved /blog/{slug} route (their own IDX domain, or their
  // free openhousepal.com IDX subdomain if they haven't connected one) - never the old
  // /{slug}/blogs/{slug} link, which would be a second, wrong-domain copy of the same post.
  // Everyone else keeps the original Agent Hub link, which is all they've ever had.
  const resolveBlogLink = async (): Promise<string | null> => {
    if (!blog || !agentHubSlug) return null
    if (user?.plan_tier === 'IDX') {
      const { success, data } = await api.sites.getPublicBaseUrl()
      // is_idx_site false = IDX website switched off / not published: fall through to the Agent Hub link.
      if (success && data && data.is_idx_site !== false) return `${data.base_url}/blog/${blog.slug}`
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/${agentHubSlug}/blogs/${blog.slug}`
  }

  // First open of an article: an AI draft not finished yet starts on its finishing tab.
  useEffect(() => {
    if (!blog || tabFor.current === blog.id) return
    tabFor.current = blog.id
    setTab(blog.ai_review?.status === 'done' && !blog.ai_review.finished ? 'finish' : 'write')
  }, [blog])
  // Published: "View live" opens the real page (IDX site or Agent Hub).
  useEffect(() => {
    if (blog?.status !== 'PUBLISHED' || !agentHubSlug) { setLiveLink(null); return }
    resolveBlogLink().then(setLiveLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blog?.status, blog?.slug, agentHubSlug])

  const handleCopyLink = async () => {
    const link = await resolveBlogLink()
    if (!link) return
    await copyText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    Promise.all([api.blogs.get(params.id), api.studio.getBrandKit(), api.agentHub.getMine()]).then(([blogRes, brandKitRes, hubRes]) => {
      if (blogRes.success && blogRes.data) setBlog(blogRes.data)
      if (brandKitRes.success && brandKitRes.data) setBrandKit(brandKitRes.data)
      if (hubRes.success && hubRes.data) setAgentHubSlug(hubRes.data.slug)
      // "Preview" on a draft's card in the Blogs list opens straight into the preview.
      try { if (new URLSearchParams(window.location.search).get('preview') === '1') setShowPreview(true) } catch { /* no window */ }
      setLoading(false)
    })
    api.forms.getMine().then(res => {
      if (res.success && res.data) setHubForms(res.data.filter(f => f.is_enabled !== false).map(f => ({ formType: f.form_type, slug: f.slug, title: f.title })))
    })
  }, [params.id])

  // Opened while the AI is still writing it (the agent left the writer screen): follow the job and
  // load the finished draft the moment it's ready.
  const aiRunning = blog?.ai_review?.status === 'running'
  useEffect(() => {
    if (!aiRunning || !blog) return
    let alive = true
    const tick = async () => {
      const res = await api.blogs.aiJob(blog.id)
      if (!alive || !res.success || !res.data) return
      if (res.data.status === 'done' && res.data.result) { setBlog(res.data.result.blog); setAiDraft(true) }
      // Didn't finish: a new article becomes an unfinished AI draft (the writer opens on the
      // failure, answers intact); a rewrite goes back to the article as it was.
      else if (res.data.status === 'failed') {
        const fresh = await api.blogs.get(blog.id)
        if (fresh.success && fresh.data) setBlog(fresh.data)
        else router.push('/studio/blogs')
      }
      else setBlog(b => (b ? { ...b, ai_review: { ...(b.ai_review || {}), stage: res.data!.stage } } : b))
    }
    // An overnight article takes an hour or more - no need to ask every four seconds.
    const t = setInterval(tick, (blog.ai_review as any)?.mode === 'overnight' ? 30000 : 4000)
    return () => { alive = false; clearInterval(t) }
  }, [aiRunning, blog?.id])

  const persist = (next: Blog) => {
    setBlog(next)
    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const response = await api.blogs.update(next.id, {
        title: next.title, subtitle: next.subtitle, cover_image_url: next.cover_image_url, category: next.category, theme: next.theme || undefined,
        tags: next.tags, blocks: next.blocks, linked_properties: next.linked_properties,
        seo_title: next.seo_title, meta_description: next.meta_description, focus_keyword: next.focus_keyword,
        social_title: next.social_title, social_description: next.social_description, social_image_url: next.social_image_url,
        is_indexed: next.is_indexed, luxe_metal: next.luxe_metal || undefined, accent_color: next.accent_color || undefined,
      })
      setSaveStatus(response.success ? 'saved' : 'error')
      if (response.success) {
        // The server says whether the saved words still match what the fact-check read - the report's
        // "Verified" line follows it right away (only that one flag is taken from the reply).
        const edited = (response.data as Blog | undefined)?.ai_review?.edited
        if (typeof edited === 'boolean') setBlog(b => (b && b.id === next.id && b.ai_review && !!b.ai_review.edited !== edited ? { ...b, ai_review: { ...b.ai_review, edited } } : b))
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 1500)
      }
    }, 700)
  }

  // Every edit starts from the newest copy of the article (not the one from the last draw), so two
  // quick edits - a letter in the title, then a section moved - can't overwrite each other.
  const patchBlog = (patch: Partial<Blog>) => {
    const cur = blogRef.current
    if (!cur) return
    const next = { ...cur, ...patch }
    blogRef.current = next
    persist(next)
  }
  const updateBlocks = (blocks: BlogBlock[]) => patchBlog({ blocks })
  const setSectionHidden = (headingId: string, hidden: boolean) => {
    const cur = blogRef.current
    if (cur) updateBlocks(cur.blocks.map(b => (b.id === headingId ? { ...b, data: { ...(b.data || {}), hidden } } : b)))
  }

  const handleRefineSection = async (headingId: string, action: BlogAiRefineAction, instruction?: string) => {
    if (!blog) return
    const range = unitRange(blog.blocks, headingId)
    if (!range) return
    setRefineBusy(headingId); setRefineError('')
    startAiActivity()
    // The AI rewrites the section's words. Its photos, videos and data cards (a payment example, a
    // town spotlight) are not sent and not replaced: they used to be lost when a section was refined.
    const res = await api.blogs.aiRefineSection({
      title: blog.title, section_blocks: blog.blocks.slice(range[0], range[1]).filter(b => REFINABLE_TYPES.includes(b.type)), article_blocks: blog.blocks, action, instruction,
    })
    endAiActivity()
    setRefineBusy(null)
    if (!res.success || !res.data) { setRefineError(res.error || 'Could not refine that section.'); return }
    const verify = res.data.numbers_to_verify
    // Fresh ids so every contentEditable block re-seeds with the new text.
    const fresh = res.data.blocks.map(b => ({ ...b, id: `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))
    // Latest blog (the agent may have kept typing while the AI worked), not the pre-await copy.
    const current = blogRef.current
    const r = current ? unitRange(current.blocks, headingId) : null
    if (current && r) {
      const old = current.blocks.slice(r[0], r[1])
      const kept = old.filter(b => !REFINABLE_TYPES.includes(b.type))
      // The section keeps its heading even when the AI's reply left one out.
      const words = fresh.length && fresh[0].type !== 'heading' && old[0]?.type === 'heading' ? [old[0], ...fresh] : fresh
      patchBlog({ blocks: [...current.blocks.slice(0, r[0]), ...words, ...kept, ...current.blocks.slice(r[1])] })
    }
    if (verify.length) setNumbersToVerify(n => Array.from(new Set([...n, ...verify])))
  }

  const handleCoverUpload = async (file: File) => {
    if (!blog) return
    setUploadingCover(true)
    const response = await api.studio.uploadMedia(file)
    if (response.success && response.data) persist({ ...blog, cover_image_url: response.data.url })
    else notify(response.error || "That photo couldn't be uploaded - use a JPG under 10MB.")
    setUploadingCover(false)
  }

  const handleStatusChange = async (status: Blog['status'], scheduledAt?: string) => {
    if (!blog) return
    setPublishBusy(true)
    const response = await api.blogs.updateStatus(blog.id, status, scheduledAt)
    if (response.success && response.data) setBlog(response.data)
    setPublishBusy(false)
  }

  const handleCreateMarketing = async () => {
    if (!blog || !agentHubSlug) return
    setMarketingBusy(true)
    const blogLink = (await resolveBlogLink()) || ''
    const blocks = buildGenericDefaultBlocks('instagram_post')
      .filter(b => b.type !== 'price' && b.type !== 'facts')
      .map(b => {
        if (b.type === 'hero_photo') return { ...b, overrides: { image_url: blog.cover_image_url || undefined } }
        if (b.type === 'headline') return { ...b, data: { text: blog.category || 'New Article' } }
        if (b.type === 'address') return { ...b, overrides: { address: blog.title, cityState: '' } }
        if (b.type === 'qr_code') return { ...b, data: { target: 'custom', customUrl: blogLink, label: 'Read the Full Article' } }
        return b
      })
    const response = await api.designs.create({ design_type: 'instagram_post', style_id: 'editorial', color_mode: 'light', name: `Promote: ${blog.title}`, blocks, branding_mode: 'personal' })
    setMarketingBusy(false)
    if (response.success && response.data) router.push(`/studio/design/${response.data.id}`)
  }

  if (loading || !blog) {
    return <OhpLoader />
  }
  // An unfinished AI draft (answers autosaved, or a run that failed): straight back into the writer,
  // on the step the agent left (user, 10/17).
  if (blog.ai_review?.new && (blog.ai_review.status === 'interview' || blog.ai_review.status === 'failed')) {
    return (
      <div className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]">
        <BlogAiWriter
          resume={{ draftId: blog.id, brief: blog.ai_review.brief || { topic: blog.title }, step: blog.ai_review.step, error: blog.ai_review.status === 'failed' ? (blog.ai_review.error || 'The AI writer could not finish this draft.') : undefined }}
          initialTopic={blog.title}
          initialCategory={blog.category || undefined}
          onClose={() => router.push('/studio/blogs')}
          onLeave={() => router.push('/studio/blogs')}
          onDone={result => { setBlog(result.blog); setNumbersToVerify(result.numbers_to_verify); setAiDraft(true) }}
        />
      </div>
    )
  }
  if (blog.ai_review?.status === 'running' && (blog.ai_review as any)?.mode === 'overnight') {
    const night = (blog.ai_review as any).overnight || {}
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f1] px-4 dark:bg-[#0B0B0B] sm:px-6">
        <LuxeSurface className="w-full max-w-md rounded-3xl border border-[#C9A24D]/30 p-6 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b7355] dark:text-[#e8c97a]">AI Blog Writer · Save usage mode</p>
          <p className="mt-2 line-clamp-4 font-serif text-2xl font-black leading-tight">Still writing “{blog.title}”</p>
          <div className="mt-5 space-y-2.5 text-sm font-bold">
            <p className="flex items-start gap-2.5"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#C9A24D] dark:text-[#e8c97a]" /> <span>{night.likely_at ? <>Likely ready by {readyClock(night.likely_at)}</> : 'Usually ready within an hour or two'}</span></p>
            <p className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" /> <span>The same article - made a little slower, so it usually uses about half the AI</span></p>
            <p className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" /> <span>Your bell lights up and we email you when it&apos;s ready</span></p>
          </div>
          <p className="mt-5 text-[11px] font-semibold text-gray-500 dark:text-white/55">
            You can leave this page - it opens here on its own when it&apos;s done.{night.cap_minutes ? ` If the slower line is busy, we finish it the fast way ourselves after ${night.cap_minutes} minutes; the steps finished that way use the normal amount of AI.` : ''}
          </p>
          <Link href="/studio/blogs" className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Back to my blogs</Link>
        </LuxeSurface>
      </div>
    )
  }
  if (blog.ai_review?.status === 'running') {
    const steps = [['gathering', 'Gathering what we know'], ['research', 'Researching what is missing'], ['write', 'Writing in your voice'], ['fact_check', 'Fact-checking every claim'], ['finishing', 'Fixing and finishing']]
    const at = Math.max(0, steps.findIndex(([k]) => k === blog.ai_review?.stage))
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f1] px-4 dark:bg-[#0B0B0B] sm:px-6">
        {/* LuxeSurface is cream in light mode, so the words are dark there (white-on-cream was unreadable). */}
        <LuxeSurface className="w-full max-w-md rounded-3xl border border-[#C9A24D]/30 p-6 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b7355] dark:text-[#e8c97a]">AI Blog Writer</p>
          <p className="mt-2 line-clamp-4 font-serif text-2xl font-black leading-tight">Still writing “{blog.title}”</p>
          <div className="mt-5 space-y-2.5">
            {steps.map(([k, label], i) => (
              <p key={k} className={`flex items-center gap-2.5 text-sm font-bold transition-colors duration-500 ${i <= at ? 'text-[#111827] dark:text-white' : 'text-[#111827]/35 dark:text-white/35'}`}>
                {i < at ? <Check className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" /> : i === at ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#C9A24D] dark:text-[#e8c97a]" /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[#111827]/15 dark:border-white/20" />}
                {label}
              </p>
            ))}
          </div>
          <p className="mt-5 text-[11px] font-semibold text-gray-500 dark:text-white/55">It opens here on its own when it's done - usually a few minutes. You can leave: your bell lights up when it's ready.</p>
        </LuxeSurface>
      </div>
    )
  }
  const sections = sectionInfo(blog.blocks)
  const signatureOn = blog.use_signature_card !== false && hasEmailSignatureAccess(user?.plan_tier)

  return (
    <div className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]">
      {/* Review & Publish takes the editor's place, inside the app (the OpenHousePal navbar stays
          on top, so home is always one tap away). The editor stays mounted underneath, hidden. */}
      {showPublish && (
        <PublishScreen
          blog={blog}
          busy={publishBusy}
          onChange={persist}
          onStatusChange={handleStatusChange}
          onPreview={() => { setShowPublish(false); setShowPreview(true) }}
          liveLink={liveLink}
          onClose={() => { setShowPublish(false); window.scrollTo({ top: 0 }) }}
        />
      )}
      <div className={showPublish ? 'hidden' : undefined}>
      {/* Top bar */}
      {/* Solid (not see-through): the article scrolling under a 90% bar showed through it. */}
      <div data-blog-topbar className="sticky top-0 z-30 border-b border-gray-200 bg-[#fbfaf7] dark:border-gray-800 dark:bg-[#0B0B0B]">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => smartBack(router, '/studio/blogs')} aria-label="Back to Blogs" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-[#111827] active:scale-95 dark:hover:bg-gray-800 dark:hover:text-white sm:h-auto sm:w-auto sm:rounded-lg sm:p-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="min-w-0 truncate text-sm font-black text-gray-500 dark:text-gray-400 sm:text-gray-400">{blog.title || 'Untitled Article'}</p>
          <span className="hidden sm:inline-flex"><StatusBadge status={blog.status} /></span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-gray-400 sm:inline-flex sm:items-center sm:gap-1.5">
            {saveStatus === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>}
            {saveStatus === 'error' && <span className="text-red-500">Save failed</span>}
            {saveStatus === 'idle' && lastSavedAt && `Last saved ${lastSavedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
          </span>
          <button onClick={() => { if (blog.blocks.some(b => blockPlainText(b).trim())) setConfirmRewrite(true); else setShowAiDraft(true) }} aria-label="Draft with AI" title="Draft with AI" className="inline-flex items-center gap-2 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2 sm:px-4 text-sm font-black text-[#8b7355] hover:bg-[#C9A24D]/20 dark:text-[#d7b974] transition hover:-translate-y-0.5 active:scale-95">
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Draft with AI</span>
          </button>
          {blog.status === 'PUBLISHED' && liveLink ? (
            <a href={markOwnerLink(liveLink)} target="_blank" rel="noopener" aria-label="View live" title="Open the live article" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 sm:px-4 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white transition hover:-translate-y-0.5 active:scale-95">
              <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">View live</span>
            </a>
          ) : (
            <button onClick={() => setShowPreview(true)} aria-label="Preview" title="Preview" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 sm:px-4 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white transition hover:-translate-y-0.5 active:scale-95">
              <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span>
            </button>
          )}
          {blog.status === 'PUBLISHED' && (
            <button onClick={handleCopyLink} aria-label="Copy link" title="Copy link" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 sm:px-4 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white transition hover:-translate-y-0.5 active:scale-95">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />} <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          )}
          {blog.status === 'PUBLISHED' && (
            <button onClick={handleCreateMarketing} disabled={marketingBusy} className="hidden items-center gap-2 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-4 py-2 text-sm font-black text-[#8b7355] hover:bg-[#C9A24D]/20 disabled:opacity-60 dark:text-[#d7b974] md:inline-flex">
              {marketingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Create Marketing
            </button>
          )}
          <button
            onClick={() => { setShowPublish(true); window.scrollTo({ top: 0 }) }}
            className="lx-shine relative hidden items-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black active:scale-95 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] sm:inline-flex"
          >
            {blog.status === 'PUBLISHED' ? <Check className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />}
            {blog.status === 'PUBLISHED' ? 'Published' : blog.status === 'SCHEDULED' ? 'Scheduled' : 'Review and Publish'}
          </button>
        </div>
      </div>
      {/* Tabs - on phones the Publish button sits at the end of this row, so the title above keeps its room. */}
      {/* Tight tab padding on phones: at 375px the Write tab was cut off behind Publish ("Writ") - 11/14. */}
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 pb-2 sm:px-6">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
        {([
          ...(blog.ai_review?.status === 'done' ? [{ id: 'finish', label: 'Finishing touches', short: 'Finish', icon: ShieldCheck, dot: !blog.ai_review.finished && !finishDismissed }] : []),
          { id: 'look', label: 'Look & cover', short: 'Look', icon: Palette, dot: !blog.cover_image_url },
          { id: 'write', label: 'Write', short: 'Write', icon: PenLine, dot: false },
        ] as const).map(t => {
          const on = tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} type="button" onClick={() => { setTab(t.id as 'finish' | 'look' | 'write'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className={`relative inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-2 py-2 text-xs font-black transition-colors sm:min-h-0 sm:gap-1.5 sm:px-3.5 ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
              {on && <motion.span layoutId="blog-editor-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
              <Icon className={`relative h-3.5 w-3.5 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />
              <span className="relative sm:hidden">{t.short}</span>
              <span className="relative hidden sm:inline">{t.label}</span>
              {t.dot && <span className="relative h-1.5 w-1.5 rounded-full bg-[#C9A24D]" />}
            </button>
          )
        })}
      </div>
        <button
          onClick={() => { setShowPublish(true); window.scrollTo({ top: 0 }) }}
          className="lx-shine relative inline-flex min-h-[40px] shrink-0 items-center gap-1.5 overflow-hidden rounded-xl bg-[#111827] px-3.5 text-[13px] font-black text-white shadow-sm transition active:scale-95 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] sm:hidden"
        >
          {blog.status === 'PUBLISHED' ? <Check className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />}
          {blog.status === 'PUBLISHED' ? 'Live' : blog.status === 'SCHEDULED' ? 'Scheduled' : 'Publish'}
        </button>
      </div>
      </div>

      {/* Write: the article as readers will see it, edited right on the page. */}
      {tab === 'write' ? (
        <>
          {refineError && <p className="mx-auto mt-3 max-w-4xl rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">{refineError}</p>}
          <BlogCanvasEditor
            blog={blog}
            agent={editorAgent}
            signatureOn={signatureOn}
            signatureHubSlug={signatureOn ? agentHubSlug : null}
            signatureTowns={editorTowns}
            forms={hubForms}
            formHref={editorFormHref}
            neighborhoodLinks={editorLinks}
            onBlocks={updateBlocks}
            onMeta={patchBlog}
            onOpenLook={() => { setTab('look'); window.scrollTo({ top: 0 }) }}
            onOpenPublish={() => { setShowPublish(true); window.scrollTo({ top: 0 }) }}
            refineBusy={refineBusy}
            onRefine={handleRefineSection}
          />
        </>
      ) : (
      <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-8 sm:pt-8">
        {refineError && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">{refineError}</p>}
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
        {tab === 'finish' && blog.ai_review && (
          <div className="space-y-5">
            {/* One quiet line: checked and ready. No stats and no "double-check" list (owner 11/15). */}
            <VerifiedPanel review={blog.ai_review} />
            <AnimatePresence>
              {!finishDismissed && !blog.ai_review.finished ? (
                <EditorFinishCard key="fin" blog={blog}
                  onApply={next => { persist({ ...next, ai_review: { ...(next.ai_review || {}), finished: true } }); setFinishDismissed(true); api.blogs.aiFinished(blog.id); setTab('look') }}
                  onDismiss={() => { setFinishDismissed(true); api.blogs.aiFinished(blog.id); setTab('look') }} />
              ) : (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/15">
                  <p className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300"><Check className="h-4 w-4" /> Finishing touches are in. Edit anything on the Write tab.</p>
                  <button type="button" onClick={() => setTab('write')} className="inline-flex items-center gap-1 rounded-xl bg-[#111827] px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]">Go to writing <ChevronRightIcon className="h-3.5 w-3.5" /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {tab === 'look' && (
          <div className="space-y-6">
        {/* Cover */}
        <div className="group relative overflow-hidden rounded-2xl">
          {blog.cover_image_url ? (
            <img src={resolveMediaUrl(blog.cover_image_url)} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : (
            <button type="button" onClick={() => coverInputRef.current?.click()} className="group/cv relative flex aspect-[16/9] sm:aspect-[5/2] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-[#C9A24D]/40 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(135deg,#fffdf8,#fbf6ec)] transition hover:border-[#C9A24D] dark:bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(135deg,#121214,#17140f)]">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-lg transition group-hover/cv:-translate-y-1 group-hover/cv:rotate-[-4deg]"><ImagePlus className="h-6 w-6" /></span>
              <span className="font-serif text-lg font-black text-[#111827] dark:text-white">Add a cover photo</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">It leads the article, your Hub card and every share - a wide JPG works best.</span>
            </button>
          )}
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className={`absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs font-black text-white transition hover:bg-black/75 active:scale-95 ${blog.cover_image_url ? 'opacity-0 group-hover:opacity-100' : 'hidden'}`}
          >
            {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {blog.cover_image_url ? 'Replace cover' : 'Add cover image'}
          </button>
          <input ref={coverInputRef} type="file" accept="image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleCoverUpload(f) }} />
        </div>
            <AiCoverMaker blogId={blog.id} idea={(blog.ai_review as any)?.cover_image_idea || blog.title} coverUrl={blog.cover_image_url}
              onUse={url => persist({ ...blog, cover_image_url: url })} />
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        {/* Category + the article's look on the Agent Hub */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Category</span><CategoryPicker value={blog.category} onChange={category => persist({ ...blog, category })} /></div>
          <div className="relative flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Article theme" onMouseLeave={() => setHoverLook(null)}>
            <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Look</span>
            {BLOG_THEMES.map(t => {
              const on = blogTheme(blog.theme).id === t.id
              const locked = !!t.idx && !luxeBlogAllowed(user?.plan_tier)
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={locked ? `${t.label} - ${t.blurb} (IDX - tap to preview)` : `${t.label} - ${t.blurb}`}
                  onMouseEnter={() => setHoverLook(t.id)}
                  onClick={() => { if (locked) { setLuxePeek(true); setShowPreview(true); return } persist({ ...blog, theme: t.id }) }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black transition hover:-translate-y-0.5 active:scale-95 ${on ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#111827] dark:text-white' : t.idx ? 'border-[#C9A24D]/50 bg-gradient-to-r from-[#111827] to-[#2a2218] text-[#e8c97a] hover:border-[#C9A24D]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-400'}`}
                >
                  {t.idx ? <Crown className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }} />}
                  {t.label}
                  {locked && <span className="rounded-full bg-[#C9A24D] px-1 text-[8px] leading-[14px] text-[#111827]">{luxeBlogUpgrade(user?.plan_tier).label}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Classic: the same accent choices as the Agent Hub's Classic (user, 10/18). */}
        {blogTheme(blog.theme).id === 'luxe' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center justify-end gap-1.5" role="radiogroup" aria-label="Classic color">
            <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Color</span>
            {CLASSIC_BLOG_ACCENTS.map(c => {
              const on = classicAccent(blog.accent_color).toLowerCase() === c.color.toLowerCase()
              return (
                <button key={c.color} type="button" role="radio" aria-checked={on} title={c.label} aria-label={c.label} onClick={() => persist({ ...blog, accent_color: c.color })}
                  className={`h-7 w-7 rounded-full ring-offset-2 transition hover:scale-110 active:scale-95 sm:h-6 sm:w-6 dark:ring-offset-[#0b0b0c] ${on ? 'ring-2 ring-[#111827] dark:ring-white' : 'ring-1 ring-black/10 dark:ring-white/15'}`}
                  style={{ background: c.color }} />
              )
            })}
          </motion.div>
        )}
        {blogTheme(blog.theme).id === 'luxe_plus' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center justify-end gap-1.5" role="radiogroup" aria-label="Luxe finish">
            <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Finish</span>
            {LUXE_METAL_ORDER.map(k => {
              const m = LUXE_METALS[k]
              const on = metalOf(blog.luxe_metal) === k
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => persist({ ...blog, luxe_metal: k })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black transition hover:-translate-y-0.5 active:scale-95 ${on ? 'border-[#111827] bg-white text-[#111827] shadow-sm dark:border-white dark:bg-white/10 dark:text-white' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}>
                  <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${m.pale}, ${m.base} 55%, ${m.deep})` }} />
                  {m.label}
                </button>
              )
            })}
          </motion.div>
        )}
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:border-white/10">Live example · {blogTheme(hoverLook || blog.theme).label}</p>
                <BlogThemeLivePreview metal={blog.luxe_metal} accent={blog.accent_color} theme={hoverLook || blog.theme || 'luxe'} title={blog.title} category={blog.category} coverUrl={blog.cover_image_url ? resolveMediaUrl(blog.cover_image_url) : null} agentName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()} agentPhoto={user?.photo_url ? resolveMediaUrl(user.photo_url) : null} height={320} />
              </div>
            </div>
        {/* Sections at a glance - tap to keep or remove a whole section */}
        {sections.headings.length > 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="mb-2 flex flex-wrap items-baseline gap-x-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Sections <span className="font-semibold normal-case tracking-normal text-gray-400">- tap one to remove it from the article or add it back</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sections.headings.map((h, i) => {
                const off = !!h.data?.hidden
                return (
                  <motion.button key={h.id} type="button" layout whileTap={{ scale: 0.94 }} onClick={() => setSectionHidden(h.id, !off)}
                    title={off ? 'Add this section back' : 'Remove this section from the article'}
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black transition hover:-translate-y-0.5 ${off ? 'border-dashed border-gray-300 text-gray-400 line-through decoration-gray-300 dark:border-gray-700' : 'border-[#C9A24D]/50 bg-[#C9A24D]/10 text-[#111827] dark:text-white'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${off ? 'bg-gray-200 text-gray-500 dark:bg-gray-800' : 'bg-[#C9A24D] text-[#111827]'}`}>{off ? <EyeOffIcon className="h-2.5 w-2.5" /> : i + 1}</span>
                    <span className="truncate">{headingText(h)}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}
            <div className="flex justify-end">
              <button type="button" onClick={() => { setTab('write'); window.scrollTo({ top: 0 }) }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">Next: write <ChevronRightIcon className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}

        </motion.div>
        </AnimatePresence>
      </div>
      )}
      </div>

      <ConfirmationModal
        isOpen={confirmRewrite}
        onClose={() => setConfirmRewrite(false)}
        onConfirm={() => { setConfirmRewrite(false); setShowAiDraft(true) }}
        title="Rewrite this article with AI?"
        message="The AI writer will replace this article's current text with a new draft. Your title and look stay until it's done."
        confirmText="Rewrite it"
        cancelText="Keep my article"
      />

      <AnimatePresence>
      {showAiDraft && (
        <BlogAiWriter
          key="ai-draft"
          blogId={blog.id}
          initialTopic={blog.title && blog.title !== 'Untitled Article' ? blog.title : ''}
          initialCategory={blog.category || undefined}
          onClose={() => setShowAiDraft(false)}
          onDone={result => {
            // The backend already saved the new draft - drop any pending debounced save of the
            // old content so it can't overwrite it, then show the fresh article.
            if (saveTimeout.current) clearTimeout(saveTimeout.current)
            setBlog(result.blog)
            setNumbersToVerify(result.numbers_to_verify)
            setAiDraft(true)
            setShowAiDraft(false)
          }}
        />
      )}
      </AnimatePresence>

      {showPreview && (
        // Exactly how it will look on the Agent Hub, in its theme.
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <button onClick={() => { setShowPreview(false); setLuxePeek(false) }} className="fixed right-4 top-4 z-[60] inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-black text-white shadow-xl"><X className="h-4 w-4" /> Close preview</button>
          {luxePeek && <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl"><LuxeUpgradePitch floating feature="Luxe article theme" tier={luxeBlogUpgrade(user?.plan_tier).tier} tierLabel={luxeBlogUpgrade(user?.plan_tier).label} text={`This is your article in Luxe. Upgrade to ${luxeBlogUpgrade(user?.plan_tier).label} to publish it this way - it stays in its current look until then.`} /></div>}
          <BlogThemedArticle
            readerToggle
            signatureOn={signatureOn && !!agentHubSlug}
            metal={blog.luxe_metal}
            accent={blog.accent_color}
            theme={luxePeek ? 'luxe_plus' : blog.theme}
            title={blog.title || 'Untitled Article'}
            subtitle={blog.subtitle}
            category={blog.category}
            coverUrl={blog.cover_image_url}
            publishedAt={blog.published_at || new Date().toISOString()}
            agent={{ name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), title: user?.professional_title, brokerage: user?.brokerage, photoUrl: user?.photo_url }}
          >
            <BlogArticleBody neighborhoodLinks={linkableAreas?.ready ? (blog.linked_areas || []).map(s => linkableAreas.areas.find(a => a.slug === s)).filter(Boolean).map(a => ({ ...a!, url: a!.url || '#' })) : []} blocks={blog.blocks} signatureHubSlug={signatureOn ? agentHubSlug : null} signatureTowns={((blog.ai_review as any)?.towns || []).map((t: any) => t.town)} signatureMatch={blogSignatureMatch(luxePeek ? 'luxe_plus' : blog.theme, blog.luxe_metal, blog.accent_color)} forms={hubForms} formHref={agentHubSlug ? (slug => `/${agentHubSlug}/${slug}?src=blog`) : undefined} accentColor={blogAccent(luxePeek ? 'luxe_plus' : blog.theme, blog.luxe_metal, blog.accent_color)} agent={{ name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), brokerage: user?.brokerage, photoUrl: resolveMediaUrl(user?.photo_url), title: user?.professional_title, phone: (user as any)?.phone, email: user?.email }} />
          </BlogThemedArticle>
        </div>
      )}
    </div>
  )
}

function EditorFinishCard({ blog, onApply, onDismiss }: { blog: Blog; onApply: (next: Blog) => void; onDismiss: () => void }) {
  const { user } = useAuth()
  const [ctx, setCtx] = useState<BlogAiContext | null>(null)
  const canSig = hasEmailSignatureAccess(user?.plan_tier)
  const [choices, setChoices] = useState<FinishChoices>(emptyFinish(blog.use_signature_card !== false))
  const [busy, setBusy] = useState(false)
  const [linkedAreas, setLinkedAreas] = useState<string[]>(blog.linked_areas || [])
  useEffect(() => { api.blogs.aiContext().then(r => { if (r.success && r.data) setCtx(r.data) }) }, [])
  const areas = ((blog.ai_review as any)?.towns || []).map((t: any) => t.town).filter(Boolean) as string[]
  const apply = async () => {
    setBusy(true)
    let next = { ...blog, blocks: applyFinish(blog.blocks, choices, ctx, areas) }
    if (canSig && choices.signature !== (blog.use_signature_card !== false)) {
      const r = await api.blogs.updateHubVisibility(blog.id, { use_signature_card: choices.signature })
      if (r.success && r.data) next = { ...next, use_signature_card: r.data.use_signature_card }
    }
    if (JSON.stringify(linkedAreas) !== JSON.stringify(blog.linked_areas || [])) {
      const r = await api.blogs.updateHubVisibility(blog.id, { linked_areas: linkedAreas })
      if (r.success && r.data) next = { ...next, linked_areas: r.data.linked_areas }
    }
    setBusy(false)
    onApply(next)
  }
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden rounded-2xl border border-[#C9A24D]/35 bg-[#fffdf8] p-4 shadow-[0_24px_50px_-36px_rgba(201,162,77,.9)] dark:bg-[#151517]">
      {ctx ? <BlogFinishStep ctx={ctx} blocks={blog.blocks} areas={areas} value={choices} onChange={setChoices} canSignature={canSig} /> : <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        <NeighborhoodLinksPicker value={linkedAreas} articleText={articleTextOf(blog.blocks)} autoPick
          onChange={slugs => { setLinkedAreas(slugs); api.blogs.updateHubVisibility(blog.id, { linked_areas: slugs }) }} />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onDismiss} className="rounded-xl px-3 py-2 text-xs font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">Not now</button>
        <motion.button type="button" whileTap={{ scale: 0.96 }} disabled={busy || !ctx} onClick={apply} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-[#111827]">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add to my article
        </motion.button>
      </div>
    </motion.div>
  )
}

function CategoryPicker({ value, onChange }: { value?: string | null; onChange: (category: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(current => !current)} className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
        {value || 'Choose category'} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 w-56 space-y-0.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-800 dark:bg-[#1A1A1C]">
            {BLOG_CATEGORIES.map(category => (
              <button key={category} onClick={() => { onChange(category); setOpen(false) }} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-bold text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white">
                {category}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Blog['status'] }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    SCHEDULED: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
    PUBLISHED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
    UNPUBLISHED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    ARCHIVED: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
  }
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${styles[status]}`}>{status.toLowerCase()}</span>
}

// Substack-style publishing step: writing and publishing are deliberately separate screens, so the
// main canvas never has to carry SEO/social/visibility fields alongside the actual prose.
function PublishScreen({ blog, busy, onChange, onStatusChange, onPreview, onClose, liveLink }: {
  blog: Blog
  liveLink?: string | null
  busy: boolean
  onChange: (blog: Blog) => void
  onStatusChange: (status: Blog['status'], scheduledAt?: string) => void
  onPreview: () => void
  onClose: () => void
}) {
  const { user } = useAuth()
  const [slugInput, setSlugInput] = useState(blog.slug)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'saved' | 'confirm'>('idle')
  const [tagInput, setTagInput] = useState('')
  const [scheduleValue, setScheduleValue] = useState('') // YYYY-MM-DDTHH:MM, local - as the old date-time box gave
  const [scheduleSheet, setScheduleSheet] = useState(false)
  // Quick picks; "This Saturday 9 AM" on a Saturday after 9 rolls to next Saturday.
  const scheduleQuickPicks = [
    { label: 'Tomorrow 8 AM', date: addDays(1), time: '08:00' },
    { label: 'This Saturday 9 AM', date: new Date(`${nextWeekday(6, true)}T09:00`).getTime() > Date.now() ? nextWeekday(6, true) : nextWeekday(6), time: '09:00' },
    { label: 'Next Monday 8 AM', date: nextWeekday(1), time: '08:00' },
  ]
  const [uploadingSocial, setUploadingSocial] = useState(false)
  const socialInputRef = useRef<HTMLInputElement>(null)
  const inputClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold sm:text-sm outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
  const labelClass = 'flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50'

  // A published article's link change asks first, right here (user, 10/17 - not a browser pop-up).
  const handleSlugSave = async (confirmed = false) => {
    if (slugInput === blog.slug) return
    if (blog.status === 'PUBLISHED' && !confirmed) { setSlugStatus('confirm'); return }
    setSlugStatus('checking')
    const check = await api.blogs.checkSlug(blog.id, slugInput)
    if (!check.success || !check.data?.available) { setSlugStatus('taken'); return }
    const response = await api.blogs.updateSlug(blog.id, slugInput)
    if (response.success && response.data) { onChange(response.data); setSlugStatus('saved') }
  }

  const tags = blog.tags || []
  const addTag = () => {
    const value = tagInput.trim()
    if (!value || tags.includes(value)) { setTagInput(''); return }
    onChange({ ...blog, tags: [...tags, value] })
    setTagInput('')
  }
  const removeTag = (tag: string) => onChange({ ...blog, tags: tags.filter(t => t !== tag) })

  const handleSocialUpload = async (file: File) => {
    setUploadingSocial(true)
    const response = await api.studio.uploadMedia(file)
    if (response.success && response.data) onChange({ ...blog, social_image_url: response.data.url })
    else notify(response.error || "That photo couldn't be uploaded - use a JPG under 10MB.")
    setUploadingSocial(false)
  }

  const seoTitle = blog.seo_title || blog.title || ''
  const metaDesc = blog.meta_description || blog.subtitle || ''
  const shareImage = blog.social_image_url || blog.cover_image_url
  const checks = [
    { ok: !!(blog.title || '').trim() && blog.title !== 'Untitled Article', label: 'A real title' },
    { ok: !!blog.cover_image_url, label: 'Cover photo' },
    { ok: !!blog.category, label: 'Category' },
    { ok: (blog.meta_description || '').trim().length >= 70, label: 'Search description' },
    { ok: !!shareImage, label: 'Share image' },
  ]
  const ready = checks.filter(c => c.ok).length
  const statusLabel = blog.status === 'PUBLISHED' ? 'Live' : blog.status === 'SCHEDULED' ? 'Scheduled' : blog.status === 'ARCHIVED' ? 'Archived' : blog.status === 'UNPUBLISHED' ? 'Unpublished' : 'Draft'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]">
      <div className="sticky top-0 z-10 border-b border-[#C9A24D]/25 bg-[#fbfaf7] dark:border-white/10 dark:bg-[#0B0B0B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onClose} className="group inline-flex min-h-[40px] items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-black sm:min-h-0 text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back to writing
          </motion.button>
          <p className="hidden font-serif text-lg font-black text-[#111827] dark:text-white sm:block">Review <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">&amp; Publish</em></p>
          {blog.status === 'PUBLISHED' && liveLink ? (
            <a href={markOwnerLink(liveLink)} target="_blank" rel="noopener" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black sm:min-h-0 text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={onPreview} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black sm:min-h-0 text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-transparent dark:text-white">
              <Eye className="h-3.5 w-3.5" /> Full preview
            </motion.button>
          )}
        </div>
      </div>

      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:gap-6 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 sm:space-y-5">
          {/* Publish */}
          <motion.section variants={pubRise}>
            <LuxeSurface icon={Newspaper} className="rounded-3xl border border-[#C9A24D]/30 p-5 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">Publish</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${blog.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-white/80 text-gray-500 dark:bg-white/5 dark:text-white/60'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${blog.status === 'PUBLISHED' ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} />{statusLabel}
                </span>
              </div>
              <p className="lx-title mt-1 font-serif text-2xl font-black">{blog.status === 'PUBLISHED' ? <>It&apos;s <em>live</em></> : <>Ready when <em>you are</em></>}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => onStatusChange('PUBLISHED')} disabled={busy}
                  className="lx-shine relative inline-flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-3.5 text-sm font-black text-[#111827] shadow-[0_14px_30px_-14px_rgba(201,162,77,.9)] transition hover:-translate-y-0.5 disabled:opacity-60">
                  <span className="relative inline-flex items-center gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {blog.status === 'PUBLISHED' ? 'Update published article' : 'Publish now'}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => onStatusChange('DRAFT')} disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C9A24D]/30 bg-white/80 px-4 py-3.5 text-sm font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
                  <Save className="h-4 w-4" /> Save as draft
                </motion.button>
              </div>
              {/* Schedule it (user, 10/22): quick picks, or the step-by-step day + time picker, and a
                  plain "Goes live ..." line. Same value as the old date-time box (local time). */}
              <div className="mt-3 rounded-2xl border border-[#C9A24D]/25 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]"><Calendar className="h-3.5 w-3.5" /> Or schedule it</p>
                {blog.status === 'SCHEDULED' && blog.scheduled_at && !scheduleValue && (
                  <p className="mt-1.5 text-[13px] font-bold text-[#111827] dark:text-white">Scheduled - goes live {whenText({ date: ymd(new Date(blog.scheduled_at)), time: `${String(new Date(blog.scheduled_at).getHours()).padStart(2, '0')}:${String(new Date(blog.scheduled_at).getMinutes()).padStart(2, '0')}` }, 'datetime')}</p>
                )}
                {/* Phones: one tidy full-width list (ragged pills of different widths looked unfinished). */}
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap">
                  {scheduleQuickPicks.map(q => {
                    const v = `${q.date}T${q.time}`
                    const on = scheduleValue === v
                    return (
                      <motion.button key={q.label} type="button" whileTap={{ scale: 0.95 }} onClick={() => setScheduleValue(on ? '' : v)}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-black transition ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                        {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" />} {q.label}
                      </motion.button>
                    )
                  })}
                  <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => setScheduleSheet(true)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dashed px-3.5 text-[13px] font-black transition ${scheduleValue && !scheduleQuickPicks.some(q => `${q.date}T${q.time}` === scheduleValue) ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15 dark:text-gray-400'}`}>
                    <Calendar className="h-3.5 w-3.5" /> Pick a day &amp; time…
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {scheduleValue && (
                    <motion.div key="golive" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <p className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl bg-[#C9A24D]/10 px-3 text-[14px] font-black text-[#7a5f22] dark:text-[#e8c97a]">
                          <Calendar className="h-4 w-4 shrink-0" /> Goes live {whenText({ date: scheduleValue.slice(0, 10), time: scheduleValue.slice(11, 16) }, 'datetime')}
                        </p>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if (scheduleValue) onStatusChange('SCHEDULED', new Date(scheduleValue).toISOString()) }} disabled={!scheduleValue || busy}
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-5 text-[12px] font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />} Schedule
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <WhenSheet open={scheduleSheet} onClose={() => setScheduleSheet(false)} mode="datetime"
                title="When should it go live?" kicker="Schedule your article" summaryPrefix="Goes live"
                photo={blog.cover_image_url ? resolveMediaUrl(blog.cover_image_url) : null} context={blog.title || null} contextSub={blog.category || null}
                value={scheduleValue ? { date: scheduleValue.slice(0, 10), time: scheduleValue.slice(11, 16) } : null}
                suggestions={scheduleQuickPicks.map(q => ({ label: q.label, date: q.date, time: q.time }))}
                onDone={v => { if (v.date && v.time) setScheduleValue(`${v.date}T${v.time}`); setScheduleSheet(false) }} />
              <div className="mt-2 flex items-center gap-1">
                {blog.status === 'PUBLISHED' && (
                  <button onClick={() => onStatusChange('UNPUBLISHED')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-gray-500 transition hover:bg-white/70 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
                    <EyeOff className="h-3.5 w-3.5" /> Unpublish
                  </button>
                )}
                <button onClick={() => onStatusChange('ARCHIVED')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-gray-500 transition hover:bg-white/70 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
            </LuxeSurface>
          </motion.section>

          {/* Article */}
          <PubSection icon={Newspaper} title="Article" hint="How it's filed on your Agent Hub and IDX site.">
            <span className={labelClass}>Category</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BLOG_CATEGORIES.map(category => {
                const on = blog.category === category
                return (
                  <motion.button key={category} whileTap={{ scale: 0.94 }} onClick={() => onChange({ ...blog, category })}
                    className={`relative rounded-full px-3.5 py-2 text-[12px] font-black transition sm:px-3 sm:py-1.5 sm:text-[11px] ${on ? 'text-[#111827]' : 'border border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#111827] dark:border-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>
                    {on && <motion.span layoutId="pub-cat" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                    <span className="relative">{category}</span>
                  </motion.button>
                )
              })}
            </div>
            <span className={`${labelClass} mt-5`}>Tags</span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 p-2 transition focus-within:border-[#C9A24D] dark:border-gray-700">
              <AnimatePresence initial={false}>
                {tags.map(tag => (
                  <motion.span key={tag} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="inline-flex items-center gap-1 rounded-full bg-[#fbf3df] px-3 py-1 text-xs font-bold text-[#6b5a45] dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]">
                    #{tag} <button onClick={() => removeTag(tag)} className="text-[#8b7355]/60 transition hover:text-red-500"><X className="h-3 w-3" /></button>
                  </motion.span>
                ))}
              </AnimatePresence>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} onBlur={addTag} placeholder="Add a tag, press Enter" className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-base font-semibold sm:text-sm outline-none dark:text-white" />
            </div>
            <PubToggle className="mt-4" label="Featured on Agent Hub" hint="Pins it to the front of your Hub's articles." on={!!blog.agent_hub_featured}
              onToggle={async () => { const r = await api.blogs.updateHubVisibility(blog.id, { agent_hub_featured: !blog.agent_hub_featured }); if (r.success && r.data) onChange(r.data) }} />
          </PubSection>

          {/* Link */}
          <PubSection icon={Link2} title="Article link" hint="The last part of the address - keep it short and readable.">
            <div className="mt-1 flex items-center overflow-hidden rounded-xl border border-gray-200 transition focus-within:border-[#C9A24D] focus-within:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700">
              <span className="shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-400 dark:border-gray-700 dark:bg-white/[0.03]">/blogs/</span>
              <input value={slugInput} onChange={e => { setSlugInput(e.target.value); setSlugStatus('idle') }} onBlur={() => handleSlugSave()} className="min-w-0 flex-1 bg-white px-3 py-3 text-base font-semibold sm:text-sm outline-none dark:bg-[#0B0B0B] dark:text-white" />
            </div>
            <AnimatePresence mode="wait">
              {slugStatus === 'confirm' && (
                <motion.div key="w" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
                  <p className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200"><ShieldAlert className="h-4 w-4" /> This article is live</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">Changing its link breaks links people already shared and resets where it shows in Google.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleSlugSave(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-amber-700">Change the link</button>
                    <button type="button" onClick={() => { setSlugInput(blog.slug); setSlugStatus('idle') }} className="rounded-lg px-3 py-1.5 text-[11px] font-black text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30">Keep the old link</button>
                  </div>
                </motion.div>
              )}
              {slugStatus === 'checking' && <motion.p key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1.5 text-[11px] font-bold text-gray-400">Checking...</motion.p>}
              {slugStatus === 'taken' && <motion.p key="t" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-[11px] font-bold text-red-500">You already have an article with this link.</motion.p>}
              {slugStatus === 'saved' && <motion.p key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check className="h-3 w-3" /> Updated</motion.p>}
            </AnimatePresence>
          </PubSection>

          {/* SEO */}
          <PubSection icon={Search} title="On Google" hint="The blue headline and the line under it in search results.">
            <label className="block"><span className={labelClass}>Search title <Counter n={(blog.seo_title || '').length} max={60} /></span>
              <input value={blog.seo_title || ''} onChange={e => onChange({ ...blog, seo_title: e.target.value })} placeholder={blog.title} className={inputClass} />
            </label>
            <label className="mt-4 block"><span className={labelClass}>Search description <Counter n={(blog.meta_description || '').length} max={160} /></span>
              <textarea rows={2} value={blog.meta_description || ''} onChange={e => onChange({ ...blog, meta_description: e.target.value })} placeholder="One or two sentences on what readers will learn." className={`${inputClass} min-h-[8.5rem] resize-none sm:min-h-0`} />
            </label>
            <PubToggle className="mt-4" label="Let Google find this article" hint="Off keeps it out of search results - it still works by link." on={!!blog.is_indexed} onToggle={() => onChange({ ...blog, is_indexed: !blog.is_indexed })} />
            {blog.is_indexed && <GoogleVisibilityNote kind="blog" className="mt-4" />}
          </PubSection>

          {/* Social */}
          <PubSection icon={Share2} title="When it's shared" hint="The card people see on Facebook, LinkedIn and texts.">
            <div className="group relative overflow-hidden rounded-2xl">
              {blog.social_image_url ? (
                <img src={resolveMediaUrl(blog.social_image_url)} alt="" className="aspect-[1200/630] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              ) : (
                <button type="button" onClick={() => socialInputRef.current?.click()} className="flex aspect-[1200/630] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9A24D]/40 bg-[#fffaf0] text-[#8b7355] transition hover:border-[#C9A24D] dark:bg-white/[0.02] dark:text-[#e8c97a]">
                  <ImagePlus className="h-6 w-6" /><span className="text-xs font-black">Add a share image</span><span className="text-[10px] font-semibold opacity-70">{blog.cover_image_url ? 'Otherwise your cover photo is used' : '1200 x 630 works best'}</span>
                </button>
              )}
              {blog.social_image_url && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => socialInputRef.current?.click()} disabled={uploadingSocial} className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-black/75">
                  {uploadingSocial ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Replace
                </motion.button>
              )}
              <input ref={socialInputRef} type="file" accept="image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleSocialUpload(f) }} />
            </div>
            <label className="mt-4 block"><span className={labelClass}>Share title</span>
              <input value={blog.social_title || ''} onChange={e => onChange({ ...blog, social_title: e.target.value })} placeholder={blog.title} className={inputClass} />
            </label>
            <label className="mt-4 block"><span className={labelClass}>Share description</span>
              <textarea rows={2} value={blog.social_description || ''} onChange={e => onChange({ ...blog, social_description: e.target.value })} placeholder={metaDesc} className={`${inputClass} min-h-[8.5rem] resize-none sm:min-h-0`} />
            </label>
          </PubSection>

          {/* IDX neighborhood pages */}
          <PubSection icon={MapPinIcon} title="Neighborhood pages" hint="Link the towns you write about to their pages on your IDX website.">
            <NeighborhoodLinksPicker compact value={blog.linked_areas || []} articleText={articleTextOf(blog.blocks)}
              onChange={async slugs => { onChange({ ...blog, linked_areas: slugs }); const r = await api.blogs.updateHubVisibility(blog.id, { linked_areas: slugs }); if (r.success && r.data) onChange(r.data) }} />
          </PubSection>

          {/* Where it shows */}
          <PubSection icon={Eye} title="Where it shows" hint="Hiding keeps it published - just off that page.">
            <PubToggle label="Show on my Agent Hub" hint="In your Hub's Blogs section." on={!!blog.agent_hub_visible}
              onToggle={async () => { const r = await api.blogs.updateHubVisibility(blog.id, { agent_hub_visible: !blog.agent_hub_visible }); if (r.success && r.data) onChange(r.data) }} />
            {(() => {
              const idx = getNavFeatureAccess(user?.plan_tier, 'idx_website')
              if (idx.visible && !idx.locked) return (
                <PubToggle className="mt-2" label="Show on my IDX Site" hint="In your IDX site's Journal and Latest Articles." on={blog.idx_visible !== false}
                  onToggle={async () => { const r = await api.blogs.updateHubVisibility(blog.id, { idx_visible: blog.idx_visible === false }); if (r.success && r.data) onChange(r.data) }} />
              )
              if (!idx.visible) return null
              return (
                <Link href={idx.upgradeHref} className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-[#C9A24D]/40 bg-[#C9A24D]/[0.04] px-3 py-2.5 transition hover:border-[#C9A24D]">
                  <Lock className="h-4 w-4 shrink-0 text-[#8b7355]" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-black text-gray-500 dark:text-gray-300">Show on my IDX Site</span><span className="block text-xs font-semibold text-gray-400">Upgrade to IDX to publish your blogs on your own IDX website too.</span></span>
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#111827]">Upgrade</span>
                </Link>
              )
            })()}
            {hasEmailSignatureAccess(user?.plan_tier) && (
              <PubToggle className="mt-2" label="End with my email signature" hint="Your signature card replaces the small contact card at the end of the article." on={blog.use_signature_card !== false}
                onToggle={async () => { const r = await api.blogs.updateHubVisibility(blog.id, { use_signature_card: blog.use_signature_card === false }); if (r.success && r.data) onChange(r.data) }} />
            )}
          </PubSection>
        </div>

        {/* Right rail: readiness + live previews */}
        <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-20 lg:self-start">
          <motion.div variants={pubRise} className="rounded-3xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffaf0] to-[#f6ead2] p-5 dark:border-white/10 dark:from-[#C9A24D]/10 dark:to-transparent">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">Ready to publish</p>
              <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{ready}<span className="text-sm text-gray-400">/{checks.length}</span></p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#8b6a2b] via-[#C9A24D] to-[#e8c97a]" initial={false} animate={{ width: `${(ready / checks.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {checks.map(c => (
                <li key={c.label} className="flex items-center gap-2 text-xs font-bold text-[#111827] dark:text-white/80">
                  <motion.span initial={false} animate={{ scale: c.ok ? [1, 1.25, 1] : 1 }} className={`flex h-4 w-4 items-center justify-center rounded-full ${c.ok ? 'bg-emerald-500 text-white' : 'bg-white text-gray-300 ring-1 ring-gray-200 dark:bg-white/5 dark:ring-white/10'}`}>
                    {c.ok && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                  </motion.span>
                  <span className={c.ok ? '' : 'text-gray-500 dark:text-white/50'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={pubRise} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121214]">
            <p className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:border-white/10">Live article <span className="normal-case tracking-normal text-[#8b7355] dark:text-[#e8c97a]">{blogTheme(blog.theme).label} look</span></p>
            <BlogThemeLivePreview metal={blog.luxe_metal} accent={blog.accent_color} theme={blogTheme(blog.theme).id} title={blog.title} category={blog.category} coverUrl={blog.cover_image_url ? resolveMediaUrl(blog.cover_image_url) : null} agentName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()} agentPhoto={user?.photo_url ? resolveMediaUrl(user.photo_url) : null} height={230} />
          </motion.div>

          <motion.div variants={pubRise} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#121214]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400" style={{ fontFamily: 'inherit' }}>On Google</p>
            <p className="truncate text-xs text-[#4d5156] dark:text-[#bdc1c6]">{`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Your name'} · /blogs/{blog.slug}</p>
            <p className="mt-0.5 line-clamp-2 text-[17px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{seoTitle || 'Untitled Article'}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">{metaDesc || 'Add a search description so Google shows your words here instead of guessing.'}</p>
          </motion.div>

          <motion.div variants={pubRise} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121214]">
            <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">When shared</p>
            <div className="m-3 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              {shareImage ? <img src={resolveMediaUrl(shareImage)} alt="" className="aspect-[1200/630] w-full object-cover" /> : <div className="aspect-[1200/630] w-full bg-gradient-to-br from-[#fbf6ec] to-[#f1e3c2] dark:from-[#1d1810] dark:to-[#111827]" />}
              <div className="bg-[#f0f2f5] px-3 py-2 dark:bg-white/[0.04]">
                <p className="text-[10px] uppercase text-gray-500">openhousepal.com</p>
                <p className="line-clamp-1 text-sm font-bold text-[#111827] dark:text-white">{blog.social_title || blog.title}</p>
                <p className="line-clamp-1 text-xs text-gray-500">{blog.social_description || metaDesc}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const pubRise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] } } }

function PubSection({ icon: Icon, title, hint, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; children: React.ReactNode }) {
  return (
    <motion.section variants={pubRise} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#C9A24D]/35 dark:border-white/[0.07] dark:bg-[#121214] sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-sm"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
      </div>
      {children}
    </motion.section>
  )
}

function PubToggle({ label, hint, on, onToggle, className = '' }: { label: string; hint?: string; on: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={on}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${on ? 'border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-400/20 dark:bg-emerald-400/[0.05]' : 'border-gray-200 bg-[#fbfaf7] dark:border-gray-700 dark:bg-white/[0.02]'} ${className}`}>
      <span>
        <span className="block text-sm font-black text-[#111827] dark:text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={`h-[18px] w-[18px] rounded-full bg-white shadow ${on ? 'ml-[22px]' : 'ml-[3px]'}`} />
      </span>
    </button>
  )
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-[10px] font-black tabular-nums normal-case tracking-normal ${n > max ? 'text-amber-600' : n > max * 0.85 ? 'text-[#8b7355]' : 'text-gray-300'}`}>{n}/{max}</span>
}

