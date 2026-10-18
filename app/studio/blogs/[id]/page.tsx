'use client'

import NeighborhoodLinksPicker, { articleTextOf } from '@/components/studio/blogs/NeighborhoodLinksPicker'
import OhpLoader from '@/components/brand/OhpLoader'

import Link from 'next/link'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf } from '@/lib/luxeMetals'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { smartBack } from '@/lib/navHistory'
import { AnimatePresence, Reorder, motion, useDragControls, type Variants } from 'framer-motion'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import BlogThemeLivePreview from '@/components/studio/blogs/BlogThemeLivePreview'
import AreaSpotlightSection, { type AreaCard } from '@/components/studio/blogs/AreaSpotlightSection'
import { MapPin as MapPinIcon, Lock } from 'lucide-react'
import {
  AlignCenter, AlignLeft, ArrowLeft, Archive, Bold, Calendar, Check, ChevronDown, Crown, Eye, EyeOff, GripVertical,
  ExternalLink, ImagePlus, Italic, Link2, Loader2, Mail, Newspaper, Palette, PenLine, Plus, QrCode as QrCodeIcon, Quote as QuoteIcon,
  Save, Search, Share2, ShieldAlert, ShieldCheck, Sparkles, Strikethrough, Trash2, Underline, User as UserIcon, Video, Wand2, X,
} from 'lucide-react'
import { ClipboardList as ClipboardListIcon } from 'lucide-react'
import { Eye as EyeIcon, EyeOff as EyeOffIcon, ChevronRight as ChevronRightIcon, RotateCcw as RotateCcwIcon } from 'lucide-react'
import { hasEmailSignatureAccess, getNavFeatureAccess } from '@/lib/navAccess'
import { qrDataUrl } from '@/lib/qr'
import api, { resolveMediaUrl, type LinkableAreas } from '@/lib/api-service'
import { notify } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { AgentFormConfig, Blog, BlogAiContext, BlogAiRefineAction, BlogBlock, BrandKit, LinkedProperty } from '@/types'
import { ADDABLE_BLOG_BLOCK_TYPES, BLOG_CATEGORIES, BLOG_CTA_FORMS, ctaFormTypeOf, textStyleClasses } from '@/lib/studio/blogTopics'
import { buildGenericDefaultBlocks } from '@/lib/studio/designFormats'
import { escapeHtml } from '@/lib/studio/sanitizeHtml'
import BlogArticleBody, { PropertyCardDisplay } from '@/components/studio/blogs/BlogArticleBody'
import { BLOG_THEMES, BlogThemedArticle, CLASSIC_BLOG_ACCENTS, blogAccent, blogSignatureMatch, blogTheme, classicAccent } from '@/components/studio/blogs/BlogThemes'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import VerifiedPanel from '@/components/studio/blogs/VerifiedPanel'
import AiCoverMaker from '@/components/studio/blogs/AiCoverMaker'
import ConfirmationModal from '@/components/ConfirmationModal'
import { PropertyShowcase, VideoShowcase } from '@/components/studio/blogs/ShowcaseBlocks'
import BlogFinishStep, { applyFinish, emptyFinish, type FinishChoices } from '@/components/studio/blogs/BlogFinishStep'
import { luxeBlogAllowed, luxeBlogUpgrade } from '@/lib/navAccess'
import PropertySelector from '@/components/studio/PropertySelector'
import BlogAiWriter from '@/components/studio/blogs/BlogAiWriter'
import { startAiActivity, endAiActivity } from '@/lib/aiActivity'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { copyText } from '@/lib/copyText'

function newBlock(type: BlogBlock['type']): BlogBlock {
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, data: {} }
}

function richInitialHtml(data: any): string {
  return data?.html ?? (data?.text ? escapeHtml(data.text) : '')
}

// ---------------------------------------------------------------------------
// AI helpers - section refine (per H2 section) + whole-article Fair Housing check. Generation
// itself lives in components/studio/blogs/BlogAiWriter.tsx (the guided interview).
// ---------------------------------------------------------------------------

function blockPlainText(b: BlogBlock): string {
  const d = b.data || {}
  if (Array.isArray(d.items)) return d.items.join('\n')
  const raw = d.html || d.text || d.label || ''
  return String(raw).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&bull;/g, '•').replace(/&nbsp;/g, ' ')
}

// A "section" = a heading block plus everything after it up to the next heading.
function sectionRange(blocks: BlogBlock[], headingId: string): [number, number] | null {
  const start = blocks.findIndex(b => b.id === headingId)
  if (start === -1) return null
  let end = start + 1
  while (end < blocks.length && blocks[end].type !== 'heading') end++
  return [start, end]
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

const REFINE_ACTIONS: { id: BlogAiRefineAction; label: string }[] = [
  { id: 'rewrite', label: 'Rewrite it fresher' },
  { id: 'expand', label: 'Expand with more depth' },
  { id: 'shorten', label: 'Make it shorter' },
  { id: 'more_local', label: 'Make it more local' },
  { id: 'more_personal', label: 'Make it more personal' },
  { id: 'simplify', label: 'Simplify the language' },
]

function SectionRefineMenu({ onRun, onClose, busy }: { onRun: (action: BlogAiRefineAction, instruction?: string) => void; onClose: () => void; busy: boolean }) {
  const [custom, setCustom] = useState('')
  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" onClick={onClose} aria-label="Close" />
      <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-800 dark:bg-[#1A1A1C]">
        <p className="flex items-center gap-1 px-2 pb-1 pt-1 text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3 w-3" /> Refine this section with AI</p>
        {REFINE_ACTIONS.map(a => (
          <button key={a.id} disabled={busy} onClick={() => onRun(a.id)} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-bold text-[#111827] hover:bg-[#C9A24D]/10 disabled:opacity-40 dark:text-white">{a.label}</button>
        ))}
        <div className="mt-1 flex gap-1 border-t border-gray-100 p-1.5 dark:border-gray-800">
          <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) onRun('custom', custom.trim()) }} placeholder="Or tell it what to change…" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:text-white" />
          <button disabled={busy || !custom.trim()} onClick={() => onRun('custom', custom.trim())} className="rounded-lg bg-[#C9A24D] px-2 text-[#111827] disabled:opacity-40"><Wand2 className="h-3.5 w-3.5" /></button>
        </div>
        <p className="px-2 pb-1 text-[9px] font-semibold text-gray-400">Uses your monthly AI credits. Never adds new numbers.</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Stable, module-scope building blocks (never redefined inside a render —
// redefining an input-rendering component inside another component's body
// makes React remount it on every keystroke, which is what was cutting off typing)
// ---------------------------------------------------------------------------

function AutoGrowTextarea({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      rows={1}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 ${className || ''}`}
    />
  )
}

// Range-boundary comparison, not string/offset math, so it stays correct across inline marks
// (bold/italic spans, links) instead of only counting one text node.
function isCaretAtEnd(el: HTMLElement, range: Range): boolean {
  const full = document.createRange()
  full.selectNodeContents(el)
  full.setStart(range.endContainer, range.endOffset)
  return full.toString().length === 0
}
function isCaretAtStart(el: HTMLElement, range: Range): boolean {
  const full = document.createRange()
  full.selectNodeContents(el)
  full.setEnd(range.startContainer, range.startOffset)
  return full.toString().length === 0
}

// An uncontrolled contentEditable block: seeds its DOM once from `html` on mount and never
// overwrites it again from props (only the parent's onChangeHtml -> saved state loop would trigger
// that, and re-applying innerHTML on every keystroke is exactly what causes cursor loss/remounts).
// The caller must key this by something that changes when the block should genuinely reset
// (block id + type), not on ordinary content edits.
function RichTextBlock({
  html, placeholder, className, onChangeHtml, onEnterAtEnd, onBackspaceAtStart, onSlashChange, slashMenuOpen, registerRef,
}: {
  html: string
  placeholder: string
  className: string
  onChangeHtml: (html: string) => void
  onEnterAtEnd?: () => void
  onBackspaceAtStart?: () => void
  onSlashChange?: (query: string | null) => void
  slashMenuOpen?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = html
      initialized.current = true
    }
    registerRef?.(ref.current)
    return () => registerRef?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInput = () => {
    const el = ref.current
    if (!el) return
    onChangeHtml(el.innerHTML)
    if (onSlashChange) {
      const text = el.textContent || ''
      onSlashChange(text.startsWith('/') ? text.slice(1) : null)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenuOpen && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && onEnterAtEnd) {
      const el = ref.current
      const sel = window.getSelection()
      if (el && sel && sel.rangeCount > 0 && isCaretAtEnd(el, sel.getRangeAt(0))) {
        event.preventDefault()
        onEnterAtEnd()
        return
      }
    }
    if (event.key === 'Backspace' && onBackspaceAtStart) {
      const el = ref.current
      const sel = window.getSelection()
      const isEmpty = !el || el.textContent === ''
      if (isEmpty && el && sel && sel.rangeCount > 0 && sel.isCollapsed && isCaretAtStart(el, sel.getRangeAt(0))) {
        event.preventDefault()
        onBackspaceAtStart()
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className={`rich-text-block w-full outline-none empty:before:pointer-events-none empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-gray-600 ${className}`}
    />
  )
}

// One global floating toolbar (portaled to <body>) that tracks the live text selection anywhere
// inside the article body and applies inline marks via execCommand - deliberately not per-block,
// since a selection only ever lives in one place at a time.
function FloatingTextToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [, bump] = useState(0)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      const container = containerRef.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) { setRect(null); return }
      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) { setRect(null); return }
      const box = range.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) { setRect(null); return }
      setRect(box)
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [containerRef])

  if (!rect || typeof document === 'undefined') return null

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    bump(n => n + 1)
  }
  const isActive = (command: string) => { try { return document.queryCommandState(command) } catch { return false } }
  const btnClass = (active: boolean) => `rounded-md p-1.5 transition ${active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`

  return createPortal(
    <div
      className="fixed z-[60] flex items-center gap-0.5 rounded-xl border border-black/40 bg-[#111827] p-1 shadow-2xl"
      style={{ top: rect.top + window.scrollY - 46, left: rect.left + window.scrollX + rect.width / 2, transform: 'translateX(-50%)' }}
      onMouseDown={event => event.preventDefault()}
    >
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} className={btnClass(isActive('bold'))} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} className={btnClass(isActive('italic'))} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} className={btnClass(isActive('underline'))} title="Underline"><Underline className="h-3.5 w-3.5" /></button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('strikeThrough')} className={btnClass(isActive('strikeThrough'))} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></button>
      <span className="mx-0.5 h-4 w-px bg-white/15" />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => { const url = window.prompt('Link URL'); if (url) exec('createLink', url) }}
        className={btnClass(isActive('createLink'))}
        title="Link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  )
}

// Notion-style "/" command menu: appears inline right below the block being typed into (not
// viewport-positioned, so it naturally reflows with the document) and converts that block's type
// in place, matching what typing "/" actually does in Notion.
function SlashMenu({ query, onSelect, onClose }: { query: string; onSelect: (type: BlogBlock['type']) => void; onClose: () => void }) {
  const q = query.trim().toLowerCase()
  const groups = Object.entries(groupBy(ADDABLE_BLOG_BLOCK_TYPES, t => t.group))
    .map(([group, items]) => [group, items.filter(t => !q || t.label.toLowerCase().includes(q))] as const)
    .filter(([, items]) => items.length > 0)

  return (
    <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-gray-800 dark:bg-[#1A1A1C]">
      <button className="fixed inset-0 z-[-1]" onClick={onClose} aria-hidden />
      {groups.length === 0 && <p className="px-3 py-2 text-xs font-bold text-gray-400">No matching blocks</p>}
      {groups.map(([group, items]) => (
        <div key={group} className="mb-1">
          <p className="px-2 pb-1 pt-1 text-[9px] font-black uppercase tracking-widest text-gray-400">{group}</p>
          {items.map(t => (
            <button
              key={t.type}
              onMouseDown={event => event.preventDefault()}
              onClick={() => onSelect(t.type)}
              className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-bold text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white"
            >
              {t.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [refineFor, setRefineFor] = useState<string | null>(null)
  const [refineBusy, setRefineBusy] = useState<string | null>(null)
  const [refineError, setRefineError] = useState('')
  const blogRef = useRef<Blog | null>(null)
  blogRef.current = blog
  const [publishBusy, setPublishBusy] = useState(false)
  const [marketingBusy, setMarketingBusy] = useState(false)
  const [slashState, setSlashState] = useState<{ blockId: string; query: string } | null>(null)
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
  const bodyRef = useRef<HTMLDivElement>(null)
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingFocusId = useRef<string | null>(null)

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
    const t = setInterval(tick, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [aiRunning, blog?.id])

  // Focus a block created/merged-into by Enter or Backspace once it actually exists in the DOM.
  useEffect(() => {
    if (!pendingFocusId.current) return
    const el = blockRefs.current[pendingFocusId.current]
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    pendingFocusId.current = null
  })

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
        is_indexed: next.is_indexed, luxe_metal: next.luxe_metal || undefined,
      })
      setSaveStatus(response.success ? 'saved' : 'error')
      if (response.success) {
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 1500)
      }
    }, 700)
  }

  const updateBlocks = (blocks: BlogBlock[]) => { if (blog) persist({ ...blog, blocks }) }
  const updateBlock = (blockId: string, updater: (block: BlogBlock) => BlogBlock) => {
    if (!blog) return
    updateBlocks(blog.blocks.map(b => b.id === blockId ? updater(b) : b))
  }
  const deleteBlock = (blockId: string) => { if (blog) updateBlocks(blog.blocks.filter(b => b.id !== blockId)) }
  const setSectionHidden = (headingId: string, hidden: boolean) => updateBlock(headingId, b => ({ ...b, data: { ...(b.data || {}), hidden } }))
  const deleteSection = (headingId: string) => {
    if (!blog) return
    const r = sectionRange(blog.blocks, headingId)
    if (r) updateBlocks([...blog.blocks.slice(0, r[0]), ...blog.blocks.slice(r[1])])
  }
  const toggleCollapsed = (headingId: string) => setCollapsed(c => { const n = new Set(c); if (n.has(headingId)) n.delete(headingId); else n.add(headingId); return n })
  const insertBlockAt = (index: number, type: BlogBlock['type']) => {
    if (!blog) return
    const next = [...blog.blocks]
    next.splice(index, 0, newBlock(type))
    updateBlocks(next)
  }

  // Notion-style writing flow: Enter at the end of a block starts a fresh paragraph after it;
  // Backspace at the start of an empty block removes it and moves focus to the end of whatever's
  // above (no-op on the very first block - nothing to merge into).
  const handleEnterAtEnd = (blockId: string) => {
    if (!blog) return
    const index = blog.blocks.findIndex(b => b.id === blockId)
    if (index === -1) return
    const fresh = newBlock('paragraph')
    const next = [...blog.blocks]
    next.splice(index + 1, 0, fresh)
    pendingFocusId.current = fresh.id
    updateBlocks(next)
  }
  const handleBackspaceAtStart = (blockId: string) => {
    if (!blog) return
    const index = blog.blocks.findIndex(b => b.id === blockId)
    if (index <= 0) return
    const prev = blog.blocks[index - 1]
    pendingFocusId.current = prev.id
    updateBlocks(blog.blocks.filter(b => b.id !== blockId))
  }
  const handleConvertBlock = (blockId: string, type: BlogBlock['type']) => {
    setSlashState(null)
    updateBlock(blockId, b => ({ id: b.id, type, data: {} }))
  }

  const handleRefineSection = async (headingId: string, action: BlogAiRefineAction, instruction?: string) => {
    if (!blog) return
    const range = sectionRange(blog.blocks, headingId)
    if (!range) return
    setRefineFor(null); setRefineBusy(headingId); setRefineError('')
    startAiActivity()
    const res = await api.blogs.aiRefineSection({
      title: blog.title, section_blocks: blog.blocks.slice(range[0], range[1]), article_blocks: blog.blocks, action, instruction,
    })
    endAiActivity()
    setRefineBusy(null)
    if (!res.success || !res.data) { setRefineError(res.error || 'Could not refine that section.'); return }
    const verify = res.data.numbers_to_verify
    // Fresh ids so every contentEditable block re-seeds with the new text.
    const fresh = res.data.blocks.map(b => ({ ...b, id: `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))
    // Latest blog (the agent may have kept typing while the AI worked), not the pre-await copy.
    const current = blogRef.current
    const r = current ? sectionRange(current.blocks, headingId) : null
    if (current && r) persist({ ...current, blocks: [...current.blocks.slice(0, r[0]), ...fresh, ...current.blocks.slice(r[1])] })
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
  if (blog.ai_review?.status === 'running') {
    const steps = [['gathering', 'Gathering what we know'], ['research', 'Researching what is missing'], ['write', 'Writing in your voice'], ['fact_check', 'Fact-checking every claim'], ['finishing', 'Fixing and finishing']]
    const at = Math.max(0, steps.findIndex(([k]) => k === blog.ai_review?.stage))
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f1] px-6 dark:bg-[#0B0B0B]">
        <LuxeSurface className="w-full max-w-md rounded-3xl p-7 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">AI Blog Writer</p>
          <p className="mt-2 font-serif text-2xl font-black leading-tight">Still writing “{blog.title}”</p>
          <div className="mt-5 space-y-2.5">
            {steps.map(([k, label], i) => (
              <p key={k} className={`flex items-center gap-2.5 text-sm font-bold ${i <= at ? 'text-white' : 'text-white/35'}`}>
                {i < at ? <Check className="h-4 w-4 text-emerald-400" /> : i === at ? <Loader2 className="h-4 w-4 animate-spin text-[#e8c97a]" /> : <span className="h-4 w-4 rounded-full border-2 border-white/20" />}
                {label}
              </p>
            ))}
          </div>
          <p className="mt-5 text-[11px] font-semibold text-white/55">It opens here on its own when it's done - usually a few minutes. You can leave: your bell lights up when it's ready.</p>
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
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-[#fbfaf7]/90 dark:border-gray-800 dark:bg-[#0B0B0B]/90">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => smartBack(router, '/studio/blogs')} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="truncate text-sm font-black text-gray-400">{blog.title || 'Untitled Article'}</p>
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
            <a href={liveLink} target="_blank" rel="noopener" aria-label="View live" title="Open the live article" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 sm:px-4 text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white transition hover:-translate-y-0.5 active:scale-95">
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
            className="lx-shine relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black active:scale-95 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]"
          >
            {blog.status === 'PUBLISHED' ? <Check className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />}
            {blog.status === 'PUBLISHED' ? 'Published' : blog.status === 'SCHEDULED' ? 'Scheduled' : <><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Review and Publish</span></>}
          </button>
        </div>
      </div>
      {/* Tabs */}
      <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-6">
        {([
          ...(blog.ai_review?.status === 'done' ? [{ id: 'finish', label: 'Fact-check & finish', short: 'Finish', icon: ShieldCheck, dot: !blog.ai_review.finished && !finishDismissed }] : []),
          { id: 'look', label: 'Look & cover', short: 'Look', icon: Palette, dot: !blog.cover_image_url },
          { id: 'write', label: 'Write', short: 'Write', icon: PenLine, dot: false },
        ] as const).map(t => {
          const on = tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} type="button" onClick={() => { setTab(t.id as 'finish' | 'look' | 'write'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
              {on && <motion.span layoutId="blog-editor-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
              <Icon className={`relative h-3.5 w-3.5 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />
              <span className="relative sm:hidden">{t.short}</span>
              <span className="relative hidden sm:inline">{t.label}</span>
              {t.dot && <span className="relative h-1.5 w-1.5 rounded-full bg-[#C9A24D]" />}
            </button>
          )
        })}
      </div>
      </div>

      {/* Document - one tab at a time */}
      <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-8">
        {refineError && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">{refineError}</p>}
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
        {tab === 'finish' && blog.ai_review && (
          <div className="space-y-5">
            <VerifiedPanel review={blog.ai_review} />
            {numbersToVerify.length > 0 && (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/15 dark:text-amber-200">Double-check before publishing: {numbersToVerify.join(', ')}</p>
            )}
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
                  {locked && <span className="rounded-full bg-[#C9A24D] px-1 text-[8px] leading-[14px] text-[#111827]">IDX</span>}
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
                  className={`h-6 w-6 rounded-full ring-offset-2 transition hover:scale-110 dark:ring-offset-[#0b0b0c] ${on ? 'ring-2 ring-[#111827] dark:ring-white' : 'ring-1 ring-black/10 dark:ring-white/15'}`}
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
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
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

        {tab === 'write' && (
          <div>
        {/* Title & subtitle */}
        <AutoGrowTextarea
          value={blog.title}
          onChange={title => persist({ ...blog, title })}
          placeholder="Untitled Article"
          className="font-serif text-4xl font-black leading-[1.1] text-[#111827] dark:text-white sm:text-5xl"
        />
        <AutoGrowTextarea
          value={blog.subtitle || ''}
          onChange={subtitle => persist({ ...blog, subtitle })}
          placeholder="Add a subtitle..."
          className="mt-3 text-lg font-semibold leading-relaxed text-gray-500 dark:text-gray-400"
        />

        {/* Sections at a glance - tap to keep or remove a whole section */}
        {sections.headings.length > 1 && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
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

        {/* Body */}
        <div ref={bodyRef} className="mt-10 border-t border-gray-200 pt-8 dark:border-gray-800">
          <Reorder.Group axis="y" values={blog.blocks} onReorder={updateBlocks} className="space-y-0.5">
            {blog.blocks.map((block, index) => {
              const ownerId = sections.owner[block.id]
              const ownerBlock = ownerId ? blog.blocks.find(b => b.id === ownerId) : null
              const tucked = !!ownerId && (!!ownerBlock?.data?.hidden || collapsed.has(ownerId))
              const isHeading = block.type === 'heading'
              return (
              <SortableBlock
                key={block.id}
                block={block}
                tucked={tucked}
                inSection={!!ownerId}
                section={isHeading ? {
                  number: sections.headings.findIndex(h => h.id === block.id) + 1,
                  count: sections.count[block.id] || 0,
                  title: headingText(block),
                  hidden: !!block.data?.hidden,
                  collapsed: collapsed.has(block.id),
                  onToggleHidden: () => setSectionHidden(block.id, !block.data?.hidden),
                  onToggleCollapsed: () => toggleCollapsed(block.id),
                  onDeleteForGood: () => deleteSection(block.id),
                } : undefined}
                onDelete={() => deleteBlock(block.id)}
                onInsertAfter={type => insertBlockAt(index + 1, type)}
                refine={block.type === 'heading' ? {
                  open: refineFor === block.id,
                  busy: refineBusy === block.id,
                  onToggle: () => setRefineFor(current => (current === block.id ? null : block.id)),
                  onRun: (action, instruction) => handleRefineSection(block.id, action, instruction),
                } : undefined}
              >
                <BlockContent
                  block={block}
                  onUpdate={updater => updateBlock(block.id, updater)}
                  onEnterAtEnd={() => handleEnterAtEnd(block.id)}
                  onBackspaceAtStart={() => handleBackspaceAtStart(block.id)}
                  onSlashChange={block.type === 'paragraph' ? query => setSlashState(query === null ? null : { blockId: block.id, query }) : undefined}
                  slashMenuOpen={slashState?.blockId === block.id}
                  registerRef={el => { blockRefs.current[block.id] = el }}
                />
                {slashState?.blockId === block.id && (
                  <SlashMenu
                    query={slashState.query}
                    onClose={() => setSlashState(null)}
                    onSelect={type => handleConvertBlock(block.id, type)}
                  />
                )}
              </SortableBlock>
              )
            })}
          </Reorder.Group>

          <AddBlockMenu onAdd={type => insertBlockAt(blog.blocks.length, type)} full />
        </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      <FloatingTextToolbar containerRef={bodyRef} />
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

      {showAiDraft && (
        <BlogAiWriter
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
            <BlogArticleBody neighborhoodLinks={linkableAreas?.ready ? (blog.linked_areas || []).map(s => linkableAreas.areas.find(a => a.slug === s)).filter(Boolean).map(a => ({ ...a!, url: a!.url || '#' })) : []} blocks={blog.blocks} signatureHubSlug={signatureOn ? agentHubSlug : null} signatureTowns={((blog.ai_review as any)?.towns || []).map((t: any) => t.town)} signatureMatch={blogSignatureMatch(luxePeek ? 'luxe_plus' : blog.theme, blog.luxe_metal, blog.accent_color)} forms={hubForms} formHref={agentHubSlug ? (slug => `/${agentHubSlug}/${slug}?src=blog`) : undefined} accentColor={blogAccent(luxePeek ? 'luxe_plus' : blog.theme, blog.luxe_metal, blog.accent_color)} agent={{ name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), brokerage: user?.brokerage, photoUrl: resolveMediaUrl(user?.photo_url), title: user?.professional_title }} />
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

type SectionControls = {
  number: number; count: number; title: string; hidden: boolean; collapsed: boolean
  onToggleHidden: () => void; onToggleCollapsed: () => void; onDeleteForGood: () => void
}

function SortableBlock({ block, children, onDelete, onInsertAfter, refine, section, tucked = false, inSection = false }: {
  block: BlogBlock
  children: React.ReactNode
  onDelete: () => void
  onInsertAfter: (type: BlogBlock['type']) => void
  // Heading blocks only - this section's bar (number, fold, remove / add back, delete for good).
  section?: SectionControls
  // A block inside a folded or removed section - kept in the list (drag order) but not shown.
  tucked?: boolean
  inSection?: boolean
  // Heading blocks only - AI refine for the whole section this heading starts.
  refine?: { open: boolean; busy: boolean; onToggle: () => void; onRun: (action: BlogAiRefineAction, instruction?: string) => void }
}) {
  const controls = useDragControls()
  const [showInsert, setShowInsert] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (tucked) return <Reorder.Item value={block} dragListener={false} dragControls={controls} className="hidden" />

  if (section?.hidden) {
    return (
      <Reorder.Item value={block} dragListener={false} dragControls={controls} className="relative pt-4">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-white/[0.02]">
          <EyeOffIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Removed from the article</p>
            <p className="truncate text-sm font-black text-gray-500 line-through decoration-gray-300 dark:text-gray-400">{section.title}</p>
          </div>
          <span className="text-[11px] font-semibold text-gray-400">{section.count + 1} {section.count ? 'blocks' : 'block'}</span>
          <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={section.onToggleHidden} className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-[#e8c97a] transition hover:-translate-y-0.5 dark:bg-white/10">
            <RotateCcwIcon className="h-3 w-3" /> Add back
          </motion.button>
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1">
              <button type="button" onClick={section.onDeleteForGood} className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black text-white hover:bg-red-600">Delete for good</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full px-2 py-1.5 text-[11px] font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} title="Delete this section for good" className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </motion.div>
      </Reorder.Item>
    )
  }

  return (
    <Reorder.Item value={block} dragListener={false} dragControls={controls} className={`group relative ${inSection ? 'border-l-2 border-[#C9A24D]/20 pl-3' : ''} ${section ? 'pt-4' : ''}`}>
      {section && (
        <div className="mb-1 flex items-center gap-2">
          <button type="button" onClick={section.onToggleCollapsed} title={section.collapsed ? 'Show this section' : 'Fold this section'} className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] transition hover:bg-[#C9A24D]/20 dark:text-[#d7b974]">
            <ChevronRightIcon className={`h-3 w-3 transition ${section.collapsed ? '' : 'rotate-90'}`} /> Section {section.number}
            {section.collapsed && <span className="font-semibold normal-case tracking-normal opacity-70">· {section.count} folded</span>}
          </button>
          <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/30 to-transparent" />
          <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={section.onToggleHidden} title="Remove this whole section from the article - you can add it back" className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-400 opacity-60 transition hover:border-red-300 hover:text-red-500 hover:opacity-100 group-hover:opacity-100 dark:border-gray-700">
            <EyeOffIcon className="h-3 w-3" /> Remove
          </motion.button>
        </div>
      )}
      <div className="absolute -left-9 top-0.5 flex flex-col items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button onPointerDown={event => controls.start(event)} className="cursor-grab rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800">
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {refine && (
        <div className={`absolute -right-2 top-1 z-30 transition ${refine.open || refine.busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={refine.onToggle}
            disabled={refine.busy}
            title="Refine this section with AI"
            className="inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] shadow-sm hover:bg-[#C9A24D]/10 dark:bg-[#151517] dark:text-[#d7b974]"
          >
            {refine.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {refine.busy ? 'Refining…' : 'Refine'}
          </button>
          {refine.open && <SectionRefineMenu busy={refine.busy} onClose={refine.onToggle} onRun={refine.onRun} />}
        </div>
      )}
      <div className={`relative py-1.5 ${refine?.busy ? 'animate-pulse' : ''}`}>{children}</div>
      <div className="relative h-3" onMouseEnter={() => setShowInsert(true)} onMouseLeave={() => setShowInsert(false)}>
        {showInsert && (
          <div className="absolute left-0 right-0 top-1/2 z-20 -translate-y-1/2">
            <AddBlockMenu onAdd={onInsertAfter} />
          </div>
        )}
      </div>
    </Reorder.Item>
  )
}

function AddBlockMenu({ onAdd, full = false }: { onAdd: (type: BlogBlock['type']) => void; full?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => setOpen(current => !current)}
        className={full
          ? 'mt-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-xs font-black text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700'
          : 'flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#151517]'
        }
      >
        <Plus className="h-3.5 w-3.5" /> {full && 'Add section'}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-800 dark:bg-[#1A1A1C]">
            {Object.entries(groupBy(ADDABLE_BLOG_BLOCK_TYPES, t => t.group)).map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-2 pb-1 pt-1 text-[9px] font-black uppercase tracking-widest text-gray-400">{group}</p>
                {items.map(t => (
                  <button key={t.type} onClick={() => { onAdd(t.type); setOpen(false) }} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-bold text-[#111827] hover:bg-[#C9A24D]/10 dark:text-white">{t.label}</button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] || []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
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
  const [scheduleValue, setScheduleValue] = useState('')
  const [uploadingSocial, setUploadingSocial] = useState(false)
  const socialInputRef = useRef<HTMLInputElement>(null)
  const inputClass = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
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
      <div className="sticky top-0 z-10 border-b border-[#C9A24D]/25 bg-[#fbfaf7]/90 dark:border-white/10 dark:bg-[#0B0B0B]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onClose} className="group inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-black text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back to writing
          </motion.button>
          <p className="hidden font-serif text-lg font-black text-[#111827] dark:text-white sm:block">Review <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">&amp; Publish</em></p>
          {blog.status === 'PUBLISHED' && liveLink ? (
            <a href={liveLink} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={onPreview} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-transparent dark:text-white">
              <Eye className="h-3.5 w-3.5" /> Full preview
            </motion.button>
          )}
        </div>
      </div>

      <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Publish */}
          <motion.section variants={pubRise}>
            <LuxeSurface icon={Newspaper} className="rounded-3xl border border-[#C9A24D]/30 p-5 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">Publish</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${blog.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-white/80 text-gray-500 dark:bg-white/5 dark:text-white/60'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${blog.status === 'PUBLISHED' ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} />{statusLabel}
                </span>
              </div>
              <p className="lx-title mt-1 font-serif text-2xl font-black">{blog.status === 'PUBLISHED' ? <>It&apos;s <em>live.</em></> : <>Ready when <em>you are.</em></>}</p>
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
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#C9A24D]/25 bg-white/70 p-2 pl-3 dark:border-white/10 dark:bg-white/[0.04]">
                <Calendar className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                <input type="datetime-local" value={scheduleValue} onChange={e => setScheduleValue(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#111827] outline-none dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if (scheduleValue) onStatusChange('SCHEDULED', new Date(scheduleValue).toISOString()) }} disabled={!scheduleValue || busy}
                  className="shrink-0 rounded-lg bg-[#111827] px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                  Schedule
                </motion.button>
              </div>
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
                    className={`relative rounded-full px-3 py-1.5 text-[11px] font-black transition ${on ? 'text-[#111827]' : 'border border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#111827] dark:border-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>
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
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} onBlur={addTag} placeholder="Add a tag, press Enter" className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm font-semibold outline-none dark:text-white" />
            </div>
            <PubToggle className="mt-4" label="Featured on Agent Hub" hint="Pins it to the front of your Hub's articles." on={!!blog.agent_hub_featured}
              onToggle={async () => { const r = await api.blogs.updateHubVisibility(blog.id, { agent_hub_featured: !blog.agent_hub_featured }); if (r.success && r.data) onChange(r.data) }} />
          </PubSection>

          {/* Link */}
          <PubSection icon={Link2} title="Article link" hint="The last part of the address - keep it short and readable.">
            <div className="mt-1 flex items-center overflow-hidden rounded-xl border border-gray-200 transition focus-within:border-[#C9A24D] focus-within:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700">
              <span className="shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold text-gray-400 dark:border-gray-700 dark:bg-white/[0.03]">/blogs/</span>
              <input value={slugInput} onChange={e => { setSlugInput(e.target.value); setSlugStatus('idle') }} onBlur={() => handleSlugSave()} className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-semibold outline-none dark:bg-[#0B0B0B] dark:text-white" />
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
              <textarea rows={2} value={blog.meta_description || ''} onChange={e => onChange({ ...blog, meta_description: e.target.value })} placeholder="One or two sentences on what readers will learn." className={`${inputClass} resize-none`} />
            </label>
            <PubToggle className="mt-4" label="Let Google find this article" hint="Off keeps it out of search results - it still works by link." on={!!blog.is_indexed} onToggle={() => onChange({ ...blog, is_indexed: !blog.is_indexed })} />
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
              <textarea rows={2} value={blog.social_description || ''} onChange={e => onChange({ ...blog, social_description: e.target.value })} placeholder={metaDesc} className={`${inputClass} resize-none`} />
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
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
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

// ---------------------------------------------------------------------------
// Block content renderers (module scope, stable identity)
// ---------------------------------------------------------------------------

function BlockContent({ block, onUpdate, onEnterAtEnd, onBackspaceAtStart, onSlashChange, slashMenuOpen, registerRef }: {
  block: BlogBlock
  onUpdate: (updater: (block: BlogBlock) => BlogBlock) => void
  onEnterAtEnd?: () => void
  onBackspaceAtStart?: () => void
  onSlashChange?: (query: string | null) => void
  slashMenuOpen?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}) {
  const data = block.data || {}
  const setData = (key: string, value: any) => onUpdate(b => ({ ...b, data: { ...b.data, [key]: value } }))
  const rtKey = `${block.id}-${block.type}`

  switch (block.type) {
    case 'heading':
      return (
        <div>
          <TextStyleToolbar data={data} onChange={setData} />
          <RichTextBlock key={rtKey} html={richInitialHtml(data)} placeholder="Heading" className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white" onChangeHtml={html => setData('html', html)} onEnterAtEnd={onEnterAtEnd} onBackspaceAtStart={onBackspaceAtStart} />
        </div>
      )
    case 'subheading':
      return (
        <div>
          <TextStyleToolbar data={data} onChange={setData} />
          <RichTextBlock key={rtKey} html={richInitialHtml(data)} placeholder="Subheading" className="font-serif text-xl font-black leading-tight text-[#111827] dark:text-white" onChangeHtml={html => setData('html', html)} onEnterAtEnd={onEnterAtEnd} onBackspaceAtStart={onBackspaceAtStart} />
        </div>
      )
    case 'paragraph':
      return (
        <div className="relative">
          <TextStyleToolbar data={data} onChange={setData} allowSize />
          <RichTextBlock
            key={rtKey}
            html={richInitialHtml(data)}
            placeholder="Write something, or press '/' for commands..."
            className={`leading-relaxed text-[#374151] dark:text-gray-300 ${textStyleClasses(data, { allowSize: true })}`}
            onChangeHtml={html => setData('html', html)}
            onEnterAtEnd={onEnterAtEnd}
            onBackspaceAtStart={onBackspaceAtStart}
            onSlashChange={onSlashChange}
            slashMenuOpen={slashMenuOpen}
            registerRef={registerRef}
          />
        </div>
      )
    case 'quote':
      return (
        <div>
          <TextStyleToolbar data={data} onChange={setData} />
          <div className="flex gap-3 rounded-xl border-l-4 border-[#C9A24D] bg-[#fbfaf7] p-4 dark:bg-[#1A1A1C]">
            <QuoteIcon className="h-5 w-5 shrink-0 text-[#C9A24D]" />
            <RichTextBlock key={rtKey} html={richInitialHtml(data)} placeholder="A quote..." className={`italic text-[#374151] dark:text-gray-300 ${textStyleClasses(data)}`} onChangeHtml={html => setData('html', html)} onEnterAtEnd={onEnterAtEnd} onBackspaceAtStart={onBackspaceAtStart} />
          </div>
        </div>
      )
    case 'callout':
      return (
        <div>
          <TextStyleToolbar data={data} onChange={setData} />
          <div className="rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/10 p-4">
            <RichTextBlock key={rtKey} html={richInitialHtml(data)} placeholder="A callout worth noticing..." className="text-[#111827] dark:text-white" onChangeHtml={html => setData('html', html)} onEnterAtEnd={onEnterAtEnd} onBackspaceAtStart={onBackspaceAtStart} />
          </div>
        </div>
      )
    case 'area_spotlight':
      return <AreaSpotlightEditor area={data.area || null} onChange={area => setData('area', area)} />
    case 'property_showcase':
    case 'video_showcase': {
      // The closing pitch from the AI writer's Finish step: rename it, drop items, see it live.
      const isVideo = block.type === 'video_showcase'
      const items: any[] = (isVideo ? data.videos : data.properties) || []
      const key = isVideo ? 'videos' : 'properties'
      return (
        <div className="rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.04] p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{isVideo ? 'Videos about the area' : data.kind === 'listings' ? 'Your listings' : 'Your recent sales'} · {items.length}</p>
          <input value={data.title || ''} onChange={e => setData('title', e.target.value)} placeholder="Section title" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-serif text-lg font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <span key={it.id || it.url || it.address || i} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
                <span className="truncate">{isVideo ? (it.title || 'Video') : it.address}</span>
                <button type="button" onClick={() => setData(key, items.filter((_, j) => j !== i))} aria-label="Remove" className="rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="pointer-events-none mt-3 origin-top scale-[0.92] opacity-90">
            {isVideo ? <VideoShowcase title={data.title} videos={items} /> : <PropertyShowcase title={data.title} kind={data.kind === 'listings' ? 'listings' : 'sales'} properties={items} />}
          </div>
        </div>
      )
    }
    case 'disclaimer':
      return <AutoGrowTextarea value={data.text || ''} onChange={v => setData('text', v)} placeholder="Disclaimer text..." className="text-[11px] font-semibold leading-relaxed text-gray-400" />
    case 'divider':
      return <hr className="my-2 border-gray-200 dark:border-gray-800" />
    case 'bulleted_list':
    case 'numbered_list':
      return <ListEditor ordered={block.type === 'numbered_list'} items={data.items || ['']} onChange={items => setData('items', items)} />
    case 'button':
      return (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
            <input value={data.label || ''} onChange={e => setData('label', e.target.value)} placeholder="Button label" className="min-w-0 flex-1 bg-transparent text-sm font-black text-[#111827] outline-none dark:text-white" />
          </div>
          <input value={data.url || ''} onChange={e => setData('url', e.target.value)} placeholder="https://..." className="mt-2 w-full bg-transparent text-xs font-semibold text-gray-500 outline-none" />
        </div>
      )
    case 'cta':
      return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#8b6a2b] p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#e8c97a]">Closing section - the button opens your form right on the article</p>
          <input value={data.heading || ''} onChange={e => setData('heading', e.target.value)} placeholder="Have a question about your move?" className="mt-1 w-full bg-transparent font-serif text-lg font-black text-white outline-none placeholder:text-white/40" />
          <input value={data.label || ''} onChange={e => setData('label', e.target.value)} placeholder="Contact Me" className="mt-2 w-48 rounded-lg bg-white px-3 py-1.5 text-xs font-black text-[#111827] outline-none placeholder:text-gray-400" />
          <p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Button opens</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {BLOG_CTA_FORMS.map(f => {
              const on = ctaFormTypeOf(data) === f.formType
              return (
                <button key={f.formType} type="button"
                  onClick={() => onUpdate(b => ({ ...b, data: { ...b.data, formType: f.formType, label: f.label } }))}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${on ? 'bg-[#e8c97a] text-[#111827]' : 'bg-white/10 text-white/75 hover:bg-white/20'}`}>
                  {f.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] font-semibold text-white/45">With your email signature card switched on, the signature closes the article here instead.</p>
        </div>
      )
    case 'lead_form':
      return <LeadFormBlockEditor data={data} setData={setData} />
    case 'contact_form':
      return (
        <div className="rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-br from-white to-[#fbf3df] p-4 dark:from-[#151517] dark:to-[#1d1810]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">Contact form - readers&apos; questions arrive in Leads</p>
          <div className="mt-1 flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-[#C9A24D]" />
            <input value={data.label || ''} onChange={e => setData('label', e.target.value)} placeholder="Ask me a question" className="min-w-0 flex-1 bg-transparent font-serif text-lg font-black text-[#111827] outline-none dark:text-white" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 opacity-60">
            {['Your name', 'Email', 'Phone', 'Message'].map(f => <span key={f} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-400 dark:border-gray-700 dark:bg-[#0B0B0B]">{f}</span>)}
          </div>
        </div>
      )
    case 'image':
      return <ImageBlockEditor url={data.url} caption={data.caption} alt={data.alt} onChangeUrl={url => setData('url', url)} onChangeCaption={caption => setData('caption', caption)} onChangeAlt={alt => setData('alt', alt)} />
    case 'gallery':
      return <GalleryBlockEditor images={data.images || []} onChange={images => setData('images', images)} />
    case 'youtube':
      return <YoutubeBlockEditor url={data.url} title={data.title} onChangeUrl={url => setData('url', url)} onChangeTitle={title => setData('title', title)} />
    case 'property_card':
      return <PropertyCardEditor property={data.property || null} displaySize={data.displaySize === 'large' ? 'large' : 'compact'} onChange={property => setData('property', property)} onChangeSize={size => setData('displaySize', size)} />
    case 'agent_profile':
      return (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <UserIcon className="h-8 w-8 rounded-full bg-gray-100 p-1.5 text-gray-400 dark:bg-gray-800" />
          <p className="text-sm font-semibold text-gray-500">Your contact card, pulled from your profile. With "End with my email signature" on (Review and Publish), your signature card shows here instead.</p>
        </div>
      )
    case 'qr_code':
      return <QrBlockEditor url={data.url} label={data.label} onChangeUrl={url => setData('url', url)} onChangeLabel={label => setData('label', label)} />
    case 'related_articles':
      return <p className="rounded-xl border border-dashed border-gray-300 p-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:border-gray-700">Related articles appear automatically once published.</p>
    default:
      return null
  }
}

// Block-level layout controls (alignment, and text size for body paragraphs). Inline marks
// (bold/italic/underline/strikethrough/link) live in the floating selection toolbar instead.
function TextStyleToolbar({ data, onChange, allowSize = false }: { data: any; onChange: (key: string, value: any) => void; allowSize?: boolean }) {
  const btnClass = (active: boolean) => `rounded p-1.5 transition ${active ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`
  return (
    <div className="mb-1.5 inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-[#1A1A1C]">
      <button type="button" onClick={() => onChange('align', data?.align === 'center' ? 'left' : 'center')} className={btnClass(data?.align === 'center')} title="Center align">
        {data?.align === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
      </button>
      {allowSize && (
        <>
          <span className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />
          {(['sm', 'base', 'lg'] as const).map(size => (
            <button key={size} type="button" onClick={() => onChange('size', size)} className={`${btnClass((data?.size || 'base') === size)} px-1.5 py-1 text-[10px] font-black uppercase`} title={size === 'sm' ? 'Small text' : size === 'base' ? 'Normal text' : 'Large text'}>
              {size === 'sm' ? 'S' : size === 'base' ? 'M' : 'L'}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

function ListEditor({ items, ordered, onChange }: { items: string[]; ordered: boolean; onChange: (items: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-1.5 shrink-0 text-sm font-black text-gray-400">{ordered ? `${index + 1}.` : '•'}</span>
          <AutoGrowTextarea value={item} onChange={v => { const next = [...items]; next[index] = v; onChange(next) }} placeholder="List item" className="text-base font-medium text-[#374151] dark:text-gray-300" />
          <button onClick={() => onChange(items.filter((_, i) => i !== index))} className="mt-1 shrink-0 rounded p-1 text-gray-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="ml-5 text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">+ Add item</button>
    </div>
  )
}

function ImageBlockEditor({ url, caption, alt, onChangeUrl, onChangeCaption, onChangeAlt }: { url?: string; caption?: string; alt?: string; onChangeUrl: (url: string) => void; onChangeCaption: (caption: string) => void; onChangeAlt: (alt: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File) => {
    setUploading(true)
    const response = await api.studio.uploadMedia(file)
    if (response.success && response.data) onChangeUrl(response.data.url)
    else notify(response.error || "That photo couldn't be uploaded - use a JPG under 10MB.")
    setUploading(false)
  }
  return (
    <div>
      {url ? (
        <div className="group relative overflow-hidden rounded-xl">
          <img src={resolveMediaUrl(url)} alt={alt || ''} className="w-full object-cover" />
          <button onClick={() => inputRef.current?.click()} className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-black text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />} Replace
          </button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-xs font-black">Add image</span>
        </button>
      )}
      {url && (
        <input value={caption || ''} onChange={e => onChangeCaption(e.target.value)} placeholder="Add a caption..." className="mt-2 w-full bg-transparent text-center text-xs font-semibold text-gray-400 outline-none" />
      )}
      <input ref={inputRef} type="file" accept="image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
    </div>
  )
}

function GalleryBlockEditor({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
            <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
            <button onClick={() => onChange(images.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"><X className="h-3 w-3" /></button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg" className="hidden" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        setUploading(true)
        const response = await api.studio.uploadMedia(file)
        if (response.success && response.data) onChange([...images, response.data.url])
        else notify(response.error || "That photo couldn't be uploaded - use a JPG under 10MB.")
        setUploading(false)
      }} />
    </div>
  )
}

function YoutubeBlockEditor({ url, title, onChangeUrl, onChangeTitle }: { url?: string; title?: string; onChangeUrl: (url: string) => void; onChangeTitle: (title: string) => void }) {
  if (!url) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 shrink-0 text-gray-400" />
          <input onBlur={e => e.target.value && onChangeUrl(e.target.value)} placeholder="Paste a YouTube URL and click away..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none dark:text-white" />
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className="group relative aspect-video overflow-hidden rounded-xl bg-black">
        <img src={`https://img.youtube.com/vi/${extractYoutubeId(url)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80" />
        <button onClick={() => onChangeUrl('')} className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1.5 text-[10px] font-black text-white opacity-0 transition group-hover:opacity-100">Change video</button>
      </div>
      <input value={title || ''} onChange={e => onChangeTitle(e.target.value)} placeholder="Video title (optional)" className="mt-2 w-full bg-transparent text-sm font-bold text-[#111827] outline-none dark:text-white" />
    </div>
  )
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return match ? match[1] : ''
}

function PropertyCardEditor({ property, displaySize, onChange, onChangeSize }: { property: LinkedProperty | null; displaySize: 'compact' | 'large'; onChange: (property: LinkedProperty | null) => void; onChangeSize: (size: 'compact' | 'large') => void }) {
  const [picking, setPicking] = useState(false)
  if (!property && !picking) {
    return (
      <button onClick={() => setPicking(true)} className="w-full rounded-xl border-2 border-dashed border-gray-300 p-4 text-center text-xs font-black text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
        + Attach a property
      </button>
    )
  }
  if (picking) {
    return (
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <PropertySelector value={property} onChange={p => { onChange(p); if (p) setPicking(false) }} compact />
        <button onClick={() => setPicking(false)} className="mt-2 text-xs font-bold text-gray-400 hover:underline">Cancel</button>
      </div>
    )
  }
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-[#1A1A1C]">
        {(['compact', 'large'] as const).map(size => (
          <button
            key={size}
            onClick={() => onChangeSize(size)}
            className={`rounded px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${displaySize === size ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            {size === 'compact' ? 'Compact' : 'Full Details'}
          </button>
        ))}
      </div>
      <div className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <PropertyCardDisplay property={property!} size={displaySize} />
        <button onClick={() => setPicking(true)} className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-black text-white opacity-0 transition group-hover:opacity-100">Change</button>
      </div>
    </div>
  )
}

function QrBlockEditor({ url, label, onChangeUrl, onChangeLabel }: { url?: string; label?: string; onChangeUrl: (url: string) => void; onChangeLabel: (label: string) => void }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (!url) { setDataUrl(''); return }
    let cancelled = false
    qrDataUrl(url, { size: 240, margin: 1 }).then(d => { if (!cancelled) setDataUrl(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [url])
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      {dataUrl ? <img src={dataUrl} alt="" className="h-12 w-12 shrink-0" /> : <QrCodeIcon className="h-12 w-12 shrink-0 text-gray-200" />}
      <div className="min-w-0 flex-1 space-y-1">
        <input value={url || ''} onChange={e => onChangeUrl(e.target.value)} placeholder="Destination URL" className="w-full bg-transparent text-xs font-semibold text-[#111827] outline-none dark:text-white" />
        <input value={label || ''} onChange={e => onChangeLabel(e.target.value)} placeholder="Label" className="w-full bg-transparent text-xs font-semibold text-gray-400 outline-none" />
      </div>
    </div>
  )
}

// Lead Form block: pick one of your forms (What's My Home Worth?, I'm Buying...) - on the published
// article it's an inviting card that opens that form; responses land in Leads like any other.
function LeadFormBlockEditor({ data, setData }: { data: any; setData: (key: string, value: any) => void }) {
  const [forms, setForms] = useState<AgentFormConfig[] | null>(null)
  useEffect(() => {
    api.forms.getMine().then(res => setForms(res.success && res.data ? res.data.filter(f => f.form_type !== 'showcase_request') : []))
  }, [])
  const pick = (id: string) => {
    const f = forms?.find(x => x.id === id)
    if (!f) return
    setData('formId', f.id)
    setData('formSlug', f.slug)
    setData('title', f.headline || f.title)
    setData('description', f.subtitle || f.description || '')
  }
  return (
    <div className="rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-br from-white to-[#fbf3df] p-4 dark:from-[#151517] dark:to-[#1d1810]">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]"><ClipboardListIcon className="h-3.5 w-3.5" /> Lead form - one of your forms, right in the article</p>
      {forms === null ? (
        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your forms...</p>
      ) : forms.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-gray-500">You don&apos;t have any forms yet - make one in Tools &rsaquo; Forms.</p>
      ) : (
        <>
          <select value={data.formId || ''} onChange={e => pick(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white">
            <option value="" disabled>Choose a form...</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
          {data.formId && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-[1fr_140px]">
              <input value={data.title || ''} onChange={e => setData('title', e.target.value)} placeholder="Headline readers see" className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-serif text-sm font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              <input value={data.label || ''} onChange={e => setData('label', e.target.value)} placeholder="Button: Start" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              <input value={data.description || ''} onChange={e => setData('description', e.target.value)} placeholder="One line about what they'll get" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 sm:col-span-2" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Town Spotlight in the editor: pick one of the towns you serve (verified Areas data + live MLS
// numbers, snapshotted with an as-of date), then it shows exactly as readers will see it.
function AreaSpotlightEditor({ area, onChange }: { area: AreaCard | null; onChange: (area: AreaCard | null) => void }) {
  const [cards, setCards] = useState<AreaCard[] | null>(null)
  const [picking, setPicking] = useState(!area)
  useEffect(() => {
    if (!picking || cards) return
    api.blogs.aiContext().then(r => setCards(r.success && r.data ? ((r.data as any).area_cards || []) : []))
  }, [picking, cards])
  if (area && !picking) {
    return (
      <div className="group/as relative">
        <AreaSpotlightSection area={area} />
        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover/as:opacity-100">
          <button type="button" onClick={() => { setCards(null); setPicking(true) }} className="rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-black/75 active:scale-95">Change town / refresh data</button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#C9A24D]/40 bg-[#fffaf0] p-4 dark:bg-white/[0.02]">
      <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><MapPinIcon className="h-4 w-4 text-[#C9A24D]" /> Town Spotlight - pick a town</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">A photo-led section with the town&apos;s live market numbers, school districts and what&apos;s nearby - from your Areas.</p>
      {!cards ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading your towns...</div>
      ) : cards.length === 0 ? (
        <p className="mt-3 text-xs font-bold text-gray-500">No towns yet - add the towns you serve in IDX → Areas, then come back.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {cards.map(c => (
            <motion.button key={c.slug} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => { onChange(c); setPicking(false) }} className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left dark:border-white/10 dark:bg-[#151517]">
              <span className="block aspect-[16/9] bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: c.photo ? `url(${resolveMediaUrl(c.photo)})` : 'linear-gradient(135deg,#111827,#2a2218)' }} />
              <span className="block px-2.5 py-2"><span className="block truncate text-xs font-black text-[#111827] dark:text-white">{c.name}, {c.state}</span>{c.active_count != null && <span className="block text-[10px] font-semibold text-gray-400">{c.active_count} homes for sale</span>}</span>
            </motion.button>
          ))}
        </div>
      )}
      {area && <button type="button" onClick={() => setPicking(false)} className="mt-2 text-[11px] font-black text-gray-400 hover:text-[#111827]">Cancel</button>}
    </div>
  )
}
