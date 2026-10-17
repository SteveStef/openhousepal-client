'use client'

// The AI Blog Writer interview - Studio -> Blogs "Write it with AI" (new article) and the editor's
// "Draft with AI" (rewrite the open article). A handful of quick, real-estate-specific questions
// (topic + goal, audience + focus areas, key points + the agent's own take + facts to cite, real
// sales/listings to reference, tone/length/CTA) -> ONE metered generation on the backend
// (services/ai/ai_blog_writer_service.py) that saves a complete DRAFT: title, subtitle, SEO fields,
// category/tags and a fully structured body. The AI never publishes and never invents numbers -
// every figure it used is listed back, and any it can't trace to the brief is flagged to verify.

import VerifiedPanel from './VerifiedPanel'
import AiCoverMaker from './AiCoverMaker'
import BlogFinishStep, { applyFinish, emptyFinish, type FinishChoices } from './BlogFinishStep'
import NeighborhoodLinksPicker, { articleTextOf } from './NeighborhoodLinksPicker'
import { youtubeIdOf } from './ShowcaseBlocks'
import BlogThemeLivePreview from './BlogThemeLivePreview'
import BlogArticleBody from './BlogArticleBody'
import { BLOG_THEMES, blogTheme } from './BlogThemes'
import { luxeBlogAllowed, luxeBlogUpgrade } from '@/lib/navAccess'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import type { BlogThemeId } from '@/types'
import { hasEmailSignatureAccess } from '@/lib/navAccess'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, Clapperboard, CloudCheck, Home, Link2, Loader2, MapPin, PenLine, Play, Plus,
  RotateCcw, Search, ShieldCheck, Sparkles, Star, Target, Users, Wand2, X,
} from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { startAiActivity, endAiActivity } from '@/lib/aiActivity'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import type { BlogAiBrief, BlogAiContext, BlogAiGenerateResult, BlogAiLength, BlogAiPropertyRef, BlogAiTone, LinkedProperty } from '@/types'
import { BLOG_CTA_FORMS } from '@/lib/studio/blogTopics'

const AUDIENCES = ['Buyers', 'Sellers', 'First-time buyers', 'Move-up buyers', 'Luxury buyers', 'Investors', 'Relocating', 'Homeowners']

const TONES: { id: BlogAiTone; label: string; hint: string }[] = [
  { id: 'warm', label: 'Warm & personal', hint: 'Like advice from a trusted neighbor' },
  { id: 'professional', label: 'Professional', hint: 'Clear, confident, authoritative' },
  { id: 'luxury', label: 'Refined luxury', hint: 'Editorial and understated' },
  { id: 'straight', label: 'Straight talk', hint: 'Plain language, zero fluff' },
  { id: 'energetic', label: 'Energetic', hint: 'Upbeat and motivating' },
]

const LENGTHS: { id: BlogAiLength; label: string; hint: string }[] = [
  { id: 'short', label: 'Quick read', hint: '~650 words · 3 min' },
  { id: 'standard', label: 'Standard', hint: '~1,000 words · 5 min' },
  { id: 'long', label: 'In-depth guide', hint: '~1,700 words · 8 min' },
]

// The article's closing button opens one of these - the agent's premade forms (or the question box),
// right over the article. Same list as the editor's Call to Action block.
const CTAS = BLOG_CTA_FORMS.map(f => ({ id: f.formType, label: f.label }))

// The researched article's real steps (backend ai_blog_pipeline_service stages), in order.
// The first step's detail depends on the plan (user, 10/17 - a non-IDX agent was told about "your
// IDX pages"): see gatheringDetail().
const WRITING_STAGES: { key: string; label: string; detail: string }[] = [
  { key: 'gathering', label: 'Gathering what we know about your towns', detail: '' },
  { key: 'research', label: 'Researching what is missing', detail: 'Official sources only - county, school districts, Freddie Mac, the state' },
  { key: 'write', label: 'Writing in your voice', detail: 'Every fact tied to a dated source, your publishing rules applied' },
  { key: 'fact_check', label: 'Fact-checking every claim', detail: 'Numbers, dates, geography, Fair Housing and anything about your experience' },
  { key: 'finishing', label: 'Fixing and finishing', detail: 'Applying the fact-checker\'s fixes and building your sections' },
]

const STEPS = ['Topic', 'Audience', 'Substance', 'Style'] as const

function gatheringDetail(plan?: string | null) {
  if (plan === 'IDX') return 'Your sales, live Bright MLS numbers and the town research behind your IDX pages'
  if (plan && plan.includes('NO_MLS')) return 'What you told us, plus verified research on the towns you picked'
  return 'Your sales, live Bright MLS numbers and verified research on your towns'
}

// Common words that say nothing about which video fits an article.
const VIDEO_STOP = new Set(['what', 'when', 'where', 'which', 'with', 'your', 'about', 'that', 'this', 'from', 'into', 'know', 'should', 'have', 'they', 'their', 'there', 'than', 'then', 'them', 'will', 'just', 'more', 'most', 'some', 'like', 'make', 'need', 'want', 'every', 'before', 'after', 'over', 'home', 'homes', 'house', 'buyer', 'buyers', 'seller', 'sellers', 'real', 'estate', 'guide', 'tips', 'things', 'here', 'look', 'feel', 'year', 'this', 'it\'s'])

// Up to this many of the agent's own sales can be referenced in one article (user, 10/17).
const MAX_SALES = 4
// Towns one article can be about (and spotlight) - user, 10/17.
const MAX_TOWNS = 5
const SALES_PAGE = 8

// A textarea that grows with what's typed (no scrollbar inside a one-line box).
function AutoGrow({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; rows?: number; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={rest.rows ?? 1} className={`${className} resize-none overflow-hidden`} {...rest} />
}

/** What the writer saves as the agent goes (and what a resumed draft starts from). */
export type BlogAiResume = { draftId: string; brief: any; step?: number; error?: string }

function money(n?: number | null) {
  return n ? `$${Math.round(n).toLocaleString()}` : ''
}

function propLine(p: BlogAiPropertyRef) {
  return [p.address, p.city].filter(Boolean).join(', ') + (p.price ? ` · ${money(p.price)}` : '')
}

function toLinked(p: BlogAiPropertyRef): LinkedProperty {
  return {
    listing_key: p.id || undefined, address: p.address, city: p.city || undefined, state: p.state || undefined,
    price: p.price ?? undefined, beds: p.beds ?? undefined, baths: p.baths ?? undefined, sqft: p.sqft ?? undefined,
    status: p.status || undefined, image_url: p.image_url || undefined,
  } as LinkedProperty
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black transition duration-200 hover:-translate-y-0.5 active:scale-95 ${
        on ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-300'
      }`}
    >
      {on && <Check className="h-3 w-3" />}{children}
    </button>
  )
}

function Question({ icon: Icon, title, hint, children }: { icon: typeof Target; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-black text-[#111827] dark:text-white">
        <Icon className="h-4 w-4 text-[#8b7355] dark:text-[#d7b974]" /> {title}
      </p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-gray-400">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-gray-300 focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:placeholder:text-gray-600'

export default function BlogAiWriter({
  blogId, initialTopic = '', initialCategory, initialTheme, titleBased = false, onClose, onDone, onLeave, resume,
}: {
  /** An unfinished AI draft being picked back up (its saved answers, the step, a failure). */
  resume?: BlogAiResume
  /** "Leave it writing" while the AI works - defaults to onClose. */
  onLeave?: () => void
  /** The article's look to start from (the editor's current one; new articles start on Luxe). */
  initialTheme?: BlogThemeId
  // Set = rewrite this article in place (editor's "Draft with AI"); omitted = create a new draft.
  blogId?: string
  initialTopic?: string
  initialCategory?: string
  // Came from the new-article flow with a title already written - the first question becomes
  // "what's the angle?", with suggestions built from that title.
  titleBased?: boolean
  onClose: () => void
  onDone: (result: BlogAiGenerateResult) => void
}) {
  const { user } = useAuth()
  const [ctx, setCtx] = useState<BlogAiContext | null>(null)
  const [ctxError, setCtxError] = useState('')
  // Rewrites keep their in-progress answers on this device; new articles are saved to the server.
  const localKey = blogId ? `blog-ai-brief:${blogId}` : null
  const [rb] = useState<any>(() => {
    if (resume?.brief) return resume.brief
    if (!localKey) return {}
    try { return JSON.parse(localStorage.getItem(localKey) || '{}') || {} } catch { return {} }
  })
  const [step, setStep] = useState(() => Math.max(0, Math.min(STEPS.length - 1, resume?.step ?? rb.__step ?? 0)))
  const [phase, setPhase] = useState<'interview' | 'writing' | 'done' | 'failed'>(resume?.error ? 'failed' : 'interview')
  const [stage, setStage] = useState(0)
  const [error, setError] = useState(resume?.error || '')
  // The DRAFT article these answers are saved on (created by the first autosave of a new article).
  const [draftId, setDraftId] = useState<string | null>(resume?.draftId || null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [result, setResult] = useState<BlogAiGenerateResult | null>(null)
  const [finish, setFinish] = useState<FinishChoices>(emptyFinish(true))
  // IDX neighborhood pages this article links (saved with the Finish step).
  const [linkedAreas, setLinkedAreas] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)
  // The finished draft is a short flow (user, 10/17): 0 = how it shows on Google, 1 = its look,
  // 2 = the fact-check (folded) + how it ends.
  const [doneStep, setDoneStep] = useState(0)
  const [doneDir, setDoneDir] = useState(1)
  const goDone = (n: number) => { setDoneDir(n > doneStep ? 1 : -1); setDoneStep(n) }

  // Brief
  const [topic, setTopic] = useState<string>(rb.topic || initialTopic)
  const [goal, setGoal] = useState<string>(rb.goal || '')
  const [audiences, setAudiences] = useState<string[]>(rb.audiences || [])
  const [areas, setAreas] = useState<string[]>(rb.areas || [])
  const [areaDraft, setAreaDraft] = useState('')
  const [keyPoints, setKeyPoints] = useState<string>(rb.key_points || '')
  const [personalTake, setPersonalTake] = useState<string>(rb.personal_take || '')
  const [facts, setFacts] = useState<string>(rb.facts || '')
  const [saleIds, setSaleIds] = useState<string[]>((rb.sale_ids || []).slice(0, MAX_SALES))
  const [listingIds, setListingIds] = useState<string[]>(rb.listing_ids || (rb.listings || []).map((l: any) => l.listing_key).filter(Boolean))
  const [tone, setTone] = useState<BlogAiTone>(rb.tone || 'warm')
  const [length, setLength] = useState<BlogAiLength>(rb.length || 'standard')
  const [cta, setCta] = useState<string>(rb.cta || 'how_can_i_help')
  // A video to tie in (asked before writing, so the AI gives it a section of its own).
  const [video, setVideo] = useState<{ url: string; title?: string } | null>(rb.video || null)
  // The look, picked on the finished draft (a real example, not sample text).
  const [look, setLook] = useState<BlogThemeId>(initialTheme || 'luxe')
  const [hoverLook, setHoverLook] = useState<BlogThemeId | null>(null)
  const [lookPeek, setLookPeek] = useState(false)
  const canLuxe = luxeBlogAllowed(user?.plan_tier)
  const [videoDraft, setVideoDraft] = useState('')
  // Where a video picked before writing goes: its own section the AI writes (default), or a fixed spot.
  const [videoPos, setVideoPos] = useState<string>(rb.video_pos || 'section')

  useEffect(() => {
    api.blogs.aiContext().then(res => {
      if (res.success && res.data) setCtx(res.data)
      else setCtxError(res.error || 'Could not load the AI writer.')
    })
  }, [])

  // Writing progress comes from the job itself (polled), so each step lights up when it really starts.
  useEffect(() => { if (phase === 'writing') setStage(0) }, [phase])

  // Sales to offer: the ones in the towns picked (when there are more than 3), otherwise the most
  // recent - newest first either way, shown 10 at a time.
  const [salePage, setSalePage] = useState(0)
  // Town Spotlight: the picked towns that are towns the agent serves (verified Areas data on hand).
  const [spotlightOn, setSpotlightOn] = useState<boolean>(rb.spotlight_on ?? true)
  // Town Spotlight (user, 10/17): any plan, any town - the agent's own areas come with the context;
  // other towns come from the shared town database (researched once, then free for everyone).
  const [townCards, setTownCards] = useState<Record<string, any>>({})
  const townKey = (a: string) => a.toLowerCase().split(',')[0].trim()
  useEffect(() => {
    if (!ctx || !spotlightOn) return
    const known = new Set((((ctx as any).area_cards || []) as any[]).map(c => String(c.name || '').toLowerCase()))
    const todo = areas.filter(a => !known.has(townKey(a)) && !(townKey(a) in townCards))
    if (!todo.length) return
    setTownCards(cur => ({ ...cur, ...Object.fromEntries(todo.map(a => [townKey(a), 'researching'])) }))
    for (const a of todo) {
      let tries = 0
      const ask = async () => {
        const r = await api.blogs.townCard({ name: a })
        if (!alive.current) return
        if (r.success && r.data?.status === 'ready' && r.data.card) setTownCards(cur => ({ ...cur, [townKey(a)]: r.data!.card }))
        else if (r.success && r.data?.status === 'researching' && ++tries < 40) window.setTimeout(ask, 6000)
        else setTownCards(cur => ({ ...cur, [townKey(a)]: 'none' }))
      }
      ask()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, areas, spotlightOn])
  const spotlightCards = useMemo(() => {
    const cards: any[] = (ctx as any)?.area_cards || []
    return areas.map(a => cards.find(c => String(c.name || '').toLowerCase() === townKey(a)) || (typeof townCards[townKey(a)] === 'object' ? townCards[townKey(a)] : null))
      .filter(Boolean).slice(0, MAX_TOWNS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, areas, townCards])
  const researching = areas.filter(a => townCards[townKey(a)] === 'researching')
  // Sales (user, 10/17): the agent's sales in the towns they picked are recommended up top; "View all"
  // opens every sale with a search box and pages; up to MAX_SALES picked.
  const [saleSearch, setSaleSearch] = useState('')
  const [allSales, setAllSales] = useState(false)
  const salePool = useMemo(() => {
    const all = ctx?.recent_sales || []
    const wanted = areas.map(a => a.toLowerCase().split(',')[0].trim()).filter(Boolean)
    const inTown = wanted.length ? all.filter(s => s.city && wanted.some(w => s.city!.toLowerCase().includes(w) || w.includes(s.city!.toLowerCase()))) : []
    const q = saleSearch.trim().toLowerCase()
    const found = q ? all.filter(s => `${s.address} ${s.city || ''} ${s.state || ''}`.toLowerCase().includes(q)) : all
    return { all, recommended: inTown.slice(0, 6), found, key: `${wanted.join('|')}::${q}` }
  }, [ctx, areas, saleSearch])
  useEffect(() => { setSalePage(0) }, [salePool.key])
  const pickSale = (id: string) => {
    if (!saleIds.includes(id) && saleIds.length >= MAX_SALES) return
    toggle(saleIds, setSaleIds, id)
  }
  const firstArea = areas[0] || ctx?.served_areas[0] || ctx?.agent.market || 'your area'
  // Angles on the title the agent wrote in the step before (new-article flow), instead of generic ideas.
  const baseTitle = initialTopic.trim().replace(/[.?!]+$/, '')
  // A real town/market only - never "in your area".
  const knownArea = areas[0] || ctx?.served_areas[0] || ctx?.agent.market || ''
  const inArea = knownArea ? ` in ${knownArea}` : ''
  const titleAngles = useMemo(() => !baseTitle ? [] : [
    `${baseTitle} - what buyers${inArea} should know`,
    `${baseTitle} - what sellers${inArea} should know`,
    `${baseTitle}: a step-by-step local guide`,
    `${baseTitle} - the questions my clients ask most`,
    `${baseTitle}: what's changed this year${inArea}`,
    `${baseTitle} - common mistakes and how to avoid them`,
  ], [baseTitle, inArea])
  const genericIdeas = useMemo(() => [
    `Monthly market update for ${firstArea}`,
    `Neighborhood guide: living in ${firstArea}`,
    'A first-time buyer\'s roadmap, step by step',
    'How to prepare your home for sale this season',
    'What my recent sales say about pricing right now',
    'Questions to ask before you make an offer',
    `Relocating to ${ctx?.agent.market || firstArea}: what to know first`,
    'Just sold: the story behind a recent closing',
  ], [firstArea, ctx?.agent.market])
  const ideas = titleBased && titleAngles.length ? titleAngles : genericIdeas

  const areaOptions = useMemo(() => {
    const opts = [...(ctx?.served_areas || [])]
    // + the towns the agent sells in most (from their real closed sales)
    const counts: Record<string, number> = {}
    for (const s of ctx?.recent_sales || []) if (s.city) counts[s.city] = (counts[s.city] || 0) + 1
    for (const town of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t)) if (!opts.some(o => o.toLowerCase() === town.toLowerCase())) opts.push(town)
    if (ctx?.agent.market && !opts.includes(ctx.agent.market)) opts.unshift(ctx.agent.market)
    for (const a of areas) if (!opts.includes(a)) opts.push(a)
    return opts
  }, [ctx, areas])

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  const [areaWarn, setAreaWarn] = useState(false)
  const pickArea = (v: string) => {
    if (areas.includes(v)) { setAreas(areas.filter(x => x !== v)); return }
    if (areas.length >= MAX_TOWNS) { setAreaWarn(true); window.setTimeout(() => setAreaWarn(false), 2600); return }
    setAreas([...areas, v])
  }
  const addArea = () => {
    const v = areaDraft.trim()
    if (v && !areas.includes(v)) pickArea(v)
    setAreaDraft('')
  }

  const canNext = step === 0 ? topic.trim().length >= 4 : true
  const blocked = ctx && !ctx.ai_available

  const buildBrief = (): BlogAiBrief => {
    const sales = (ctx?.recent_sales || [])
    const listings = (ctx?.listings || []).filter(l => listingIds.includes(l.id)).map(toLinked)
    return {
      topic: topic.trim(),
      goal: goal.trim() || undefined,
      audiences,
      areas,
      key_points: keyPoints.trim() || undefined,
      personal_take: personalTake.trim() || undefined,
      facts: facts.trim() || undefined,
      include_recent_sales: saleIds.length > 0,
      sale_ids: saleIds.filter(id => sales.some(s => s.id === id)),
      area_slugs: spotlightOn ? spotlightCards.map(c => c.slug) : [],
      listings,
      video: video && youtubeIdOf(video.url) ? video : undefined,
      tone,
      length,
      cta,
      category_hint: initialCategory,
      blog_id: blogId || draftId || undefined,
    }
  }

  // Autosave (user, 10/17: "save every single step ... you can exit out and it saves everything you
  // put into the flow as a draft to finish later"): a moment after any answer changes, and on every
  // step change. A new article's answers live on its DRAFT (shown in Blogs as "Unfinished AI draft");
  // a rewrite's stay on this device. The extra fields put the picker state back exactly.
  const saving = useRef<Promise<unknown> | null>(null)
  const saveKey = JSON.stringify([topic, goal, audiences, areas, keyPoints, personalTake, facts, saleIds, listingIds, tone, length, cta, video, spotlightOn, videoPos, step])
  useEffect(() => {
    if (!ctx || phase !== 'interview' || topic.trim().length < 4) return
    const t = window.setTimeout(async () => {
      const brief = { ...buildBrief(), listing_ids: listingIds, spotlight_on: spotlightOn, video_pos: videoPos }
      if (localKey) {
        try { localStorage.setItem(localKey, JSON.stringify({ ...brief, __step: step })); setSavedAt(Date.now()) } catch { /* private mode */ }
        return
      }
      if (saving.current) await saving.current
      const req = api.blogs.saveAiBrief({ blog_id: draftId, brief, step, category_hint: initialCategory })
      saving.current = req
      const res = await req
      saving.current = null
      if (!alive.current) return
      if (res.success && res.data?.blog_id) { setDraftId(res.data.blog_id); setSavedAt(Date.now()) }
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey, ctx, phase])

  const generate = async () => {
    setError('')
    setPhase('writing')
    if (saving.current) await saving.current
    const brief = buildBrief()
    startAiActivity()
    const fail = (msg?: string) => {
      endAiActivity()
      if (!alive.current) return
      setError(msg || 'The AI writer could not finish this draft.')
      setPhase('failed')
    }
    // Researched article: runs in the background (a few minutes) - start it, then follow its steps.
    const started = await api.blogs.aiGenerateJob({ ...brief, engine: 'max' })
    if (!started.success || !started.data) return fail(started.error)
    const jobId = started.data.blog_id
    if (!blogId) setDraftId(jobId)
    if (localKey) { try { localStorage.removeItem(localKey) } catch { /* */ } }
    for (let misses = 0; ;) {
      await new Promise(r => setTimeout(r, 3000))
      if (!alive.current) return
      const res = await api.blogs.aiJob(jobId)
      if (!res.success || !res.data) {
        if (++misses > 5) return fail(res.error)
        continue
      }
      misses = 0
      if (res.data.status === 'running') {
        const i = WRITING_STAGES.findIndex(s => s.key === res.data!.stage)
        if (i >= 0) setStage(s => Math.max(s, i))
        continue
      }
      if (res.data.status === 'failed' || !res.data.result) return fail(res.data.error)
      endAiActivity()
      setResult(res.data.result)
      setDoneStep(0)
      setPhase('done')
      return
    }
  }

  // Finish step -> real blocks + the signature setting, then into the editor.
  const finishAndOpen = async () => {
    if (!result) return
    setFinishing(true)
    let blog = result.blog
    const choices = { ...finish, moveVideo: finish.moveVideo || (videoPos !== 'section' ? videoPos : null) }
    const blocks = applyFinish(blog.blocks, choices, ctx, areas)
    if (JSON.stringify(blocks) !== JSON.stringify(blog.blocks)) {
      const r = await api.blogs.update(blog.id, { blocks })
      if (r.success && r.data) blog = r.data
    }
    if (hasEmailSignatureAccess(user?.plan_tier) && finish.signature !== (blog.use_signature_card !== false)) {
      const r = await api.blogs.updateHubVisibility(blog.id, { use_signature_card: finish.signature })
      if (r.success && r.data) blog = r.data
    }
    if (linkedAreas.length) {
      const r = await api.blogs.updateHubVisibility(blog.id, { linked_areas: linkedAreas })
      if (r.success && r.data) blog = r.data
    }
    if (blog.theme !== look) {
      const r = await api.blogs.update(blog.id, { theme: look })
      if (r.success && r.data) blog = r.data
    }
    const f = await api.blogs.aiFinished(blog.id)
    if (f.success && f.data) blog = f.data
    setFinishing(false)
    onDone({ ...result, blog })
  }

  // The agent leaves while it writes: stop following here - the bell says when it's done.
  const leaveWriting = () => {
    alive.current = false
    endAiActivity()
    ;(onLeave || onClose)()
  }
  const pastedVideo = video && !(ctx?.videos || []).some(v => v.url === video.url) ? video : null
  // The agent's own videos (Agent Hub + their YouTube channel), the ones whose titles share words
  // with what this article is about first (user, 10/17: "look for a couple keywords").
  const { suggestedVideos, otherVideos } = useMemo(() => {
    const yt = (ctx?.videos || []).filter(v => youtubeIdOf(v.url))
    const words = Array.from(new Set(([topic, goal, keyPoints, ...areas].join(' ').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [])))
      .filter(w => !VIDEO_STOP.has(w))
    const scored = yt.map(v => ({ v, n: words.filter(w => (v.title || '').toLowerCase().includes(w)).length }))
    const top = scored.filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.v)
    return { suggestedVideos: top, otherVideos: yt.filter(v => !top.includes(v)) }
  }, [ctx, topic, goal, keyPoints, areas])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={phase === 'writing' ? undefined : onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]"
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-gray-100 bg-gradient-to-r from-[#111827] via-[#172033] to-[#4a3820] px-6 py-4 dark:border-gray-800">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#C9A24D]/30 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A24D] text-[#111827] shadow-md"><Sparkles className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">
                  AI Blog Writer{phase === 'interview' && !blocked && ctx ? ` · Step ${step + 1} of ${STEPS.length}` : ''}
                </p>
                <h2 className="font-serif text-xl font-black text-white">
                  {phase === 'done' ? 'Your draft is ready' : phase === 'writing' ? 'Writing your article…' : phase === 'failed' ? "This one didn't finish" : blogId ? 'Rewrite this article with AI' : resume ? 'Finish your article with AI' : 'Write an article with AI'}
                </h2>
              </div>
            </div>
            {phase !== 'writing' && (
              <button onClick={onClose} className="rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            )}
          </div>
          {phase === 'done' && result && (
            <div className="relative mt-3 flex gap-1.5">
              {['On Google', 'Its look', 'Finish'].map((label, i) => (
                <button key={label} type="button" disabled={i > doneStep} onClick={() => goDone(i)} className="flex-1 text-left disabled:cursor-default">
                  <div className={`h-1 rounded-full transition-colors ${i <= doneStep ? 'bg-[#C9A24D]' : 'bg-white/15'}`} />
                  <p className={`mt-1 text-[9px] font-black uppercase tracking-widest ${i <= doneStep ? 'text-[#f1d58b]' : 'text-white/30'}`}>{label}</p>
                </button>
              ))}
            </div>
          )}
          {phase === 'interview' && !blocked && ctx && (
            <div className="relative mt-3 flex gap-1.5">
              {STEPS.map((label, i) => (
                <div key={label} className="flex-1">
                  <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-[#C9A24D]' : 'bg-white/15'}`} />
                  <p className={`mt-1 text-[9px] font-black uppercase tracking-widest ${i <= step ? 'text-[#f1d58b]' : 'text-white/30'}`}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]">
          {!ctx && !ctxError && <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}
          {ctxError && <p className="py-10 text-center text-sm font-bold text-red-500">{ctxError}</p>}

          {blocked && (
            <div className="space-y-4 py-4 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="h-6 w-6" /></span>
              <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">You&apos;ve used this month&apos;s AI allowance</h3>
              <p className="mx-auto max-w-sm text-sm font-semibold text-gray-500 dark:text-gray-400">
                {ctx?.blocked_message || "You've reached your AI usage limit for this month."} You can still write and publish articles by hand.
              </p>
              <MonthlyAiUsageMeter variant="inline" className="mx-auto max-w-xs" />
              <div className="flex justify-center gap-2 pt-1">
                <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-black text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">Write it myself</button>
                <Link href="/settings/subscription" className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white hover:bg-black dark:bg-white dark:text-[#111827]">
                  Upgrade for more AI <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {ctx && !blocked && phase === 'interview' && (
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-6">
                {step === 0 && (
                  <>
                    <Question icon={PenLine} title={titleBased ? 'What angle should it take?' : "What's this article about?"} hint={titleBased ? 'Your title is below - sharpen it, or tap an angle built from it.' : 'A sentence is plenty. Pick an idea below to start faster.'}>
                      <textarea autoFocus value={topic} onChange={e => setTopic(e.target.value)} rows={2} placeholder="e.g. What buyers should know about older homes in Bryn Mawr" className={inputCls} />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ideas.map(idea => {
                          // An angle on the agent's own title shows just the angle ("+ the questions my clients ask most").
                          const angle = baseTitle && idea.startsWith(baseTitle) ? idea.slice(baseTitle.length).replace(/^\s*[-:]\s*/, '') : null
                          const on = topic === idea
                          return (
                            <motion.button key={idea} type="button" whileTap={{ scale: 0.95 }} onClick={() => setTopic(on && baseTitle ? baseTitle : idea)} title={idea}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:-translate-y-0.5 ${on ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/10 text-[#8b7355] hover:bg-[#C9A24D]/20 dark:text-[#d7b974]'}`}>
                              {angle ? <>{on ? <Check className="mr-1 inline h-3 w-3" /> : '+ '}{angle.charAt(0).toUpperCase() + angle.slice(1)}</> : idea}
                            </motion.button>
                          )
                        })}
                      </div>
                    </Question>
                    <Question icon={Target} title="What should a reader walk away knowing — or doing?" hint="Optional, but it sharpens the whole article.">
                      <AutoGrow value={goal} onChange={setGoal} placeholder="e.g. Feel confident about the inspection steps before making an offer" className={inputCls} />
                    </Question>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Question icon={Users} title="Who is it for?" hint="Pick any that apply.">
                      <div className="flex flex-wrap gap-1.5">
                        {AUDIENCES.map(a => <Chip key={a} on={audiences.includes(a)} onClick={() => toggle(audiences, setAudiences, a)}>{a}</Chip>)}
                      </div>
                    </Question>
                    <Question icon={MapPin} title="What area are you writing about?" hint="The towns or neighborhoods it's about, roughly. Naming them is what makes it rank locally - and what the AI needs to get the details right.">
                      <div className="flex flex-wrap gap-1.5">
                        {areaOptions.map(a => <Chip key={a} on={areas.includes(a)} onClick={() => pickArea(a)}>{a}</Chip>)}
                      </div>
                      <AnimatePresence>
                        {areaWarn && (
                          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Up to {MAX_TOWNS} towns per article - tap one to remove it first.
                          </motion.p>
                        )}
                      </AnimatePresence>
                      <div className="mt-2 flex gap-2">
                        <input value={areaDraft} onChange={e => setAreaDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addArea() } }} placeholder="Add a town or neighborhood" className={inputCls} />
                        <button type="button" onClick={addArea} className="shrink-0 rounded-xl border border-gray-200 px-3 text-gray-500 hover:border-[#C9A24D] dark:border-gray-700"><Plus className="h-4 w-4" /></button>
                      </div>
                      {(spotlightCards.length > 0 || researching.length > 0) && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-[#C9A24D]/30 bg-[#fffaf0] p-3 dark:bg-[#C9A24D]/[0.06]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-[#111827] dark:text-white">Add a Town Spotlight{spotlightCards.length === 1 ? ` for ${spotlightCards[0].name}` : ` for ${spotlightCards.length || researching.length} towns`}</p>
                              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">A photo, live market numbers, schools and what&apos;s nearby for each town - verified and dated.</p>
                            </div>
                            <button type="button" role="switch" aria-checked={spotlightOn} onClick={() => setSpotlightOn(v => !v)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${spotlightOn ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              <span className={`h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-300 ${spotlightOn ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                            </button>
                          </div>
                          <AnimatePresence initial={false}>
                            {spotlightOn && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {spotlightCards.map((c: any, k: number) => (
                                    <motion.span key={c.slug} layout initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: k * 0.05 }}
                                      className="relative block aspect-[16/10] overflow-hidden rounded-xl bg-[#111827] bg-cover bg-center ring-1 ring-black/10"
                                      style={c.photo || c.photos?.[0]?.url ? { backgroundImage: `url(${resolveMediaUrl(c.photo || c.photos[0].url)})` } : undefined}>
                                      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                                      {!(c.photo || c.photos?.[0]?.url) && <MapPin className="absolute left-1/2 top-[38%] h-5 w-5 -translate-x-1/2 text-[#e8c97a]/60" />}
                                      <span className="absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-[11px] font-black text-white">{c.name}</span>
                                    </motion.span>
                                  ))}
                                  {researching.map(a => (
                                    <span key={`r-${a}`} className="flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#C9A24D]/50 bg-white/60 text-center dark:bg-white/[0.03]">
                                      <OhpSpinner size={22} />
                                      <span className="px-2 text-[10px] font-black leading-tight text-[#8b7355] dark:text-[#e8c97a]">Looking up {a.split(',')[0]}</span>
                                    </span>
                                  ))}
                                </div>
                                {researching.length > 0 && <p className="mt-2 text-[10px] font-semibold text-gray-400">A town we haven&apos;t covered yet takes a minute or two the first time - you can keep going.</p>}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </Question>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Question icon={PenLine} title="Key points to cover" hint="Bullets are fine. Anything you'd tell a client across the table.">
                      <textarea value={keyPoints} onChange={e => setKeyPoints(e.target.value)} rows={3} placeholder={'- Why pre-approval comes first\n- What to ask at the inspection\n- How we decide on an offer price'} className={inputCls} />
                    </Question>
                    <Question icon={Sparkles} title="Your take, or a local story only you could tell" hint="This is what makes it yours instead of generic. The AI weaves it in, in your voice.">
                      <textarea value={personalTake} onChange={e => setPersonalTake(e.target.value)} rows={3} placeholder="e.g. The buyers who win here are the ones who've seen enough homes to recognize a good one in the first ten minutes." className={inputCls} />
                    </Question>
                    <Question icon={ShieldCheck} title="Numbers you want cited" hint="Prices, days on market, inventory — only what you know is true. The AI never invents a statistic.">
                      <textarea value={facts} onChange={e => setFacts(e.target.value)} rows={2} placeholder="e.g. Median sale price in Wayne last quarter: $X (source: Bright MLS)" className={inputCls} />
                    </Question>
                    {(ctx.recent_sales.length > 0 || ctx.listings.length > 0) && (
                      <Question icon={Home} title="Reference your real sales or listings?" hint="Real numbers from your account — optional.">
                        {ctx.recent_sales.length > 0 && (
                          <>
                            <p className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                              <span>Your sales <span className="normal-case tracking-normal">· pick up to {MAX_SALES}</span></span>
                              <span className={`normal-case tracking-normal ${saleIds.length >= MAX_SALES ? 'text-[#8b7355] dark:text-[#e8c97a]' : ''}`}>{saleIds.length} of {MAX_SALES} picked</span>
                            </p>
                            {/* Picked ones always stay in view */}
                            {saleIds.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {saleIds.map(id => salePool.all.find(x => x.id === id)).filter(Boolean).map(s => (
                                  <Chip key={`p-${s!.id}`} on onClick={() => pickSale(s!.id)}>{propLine(s!)}</Chip>
                                ))}
                              </div>
                            )}
                            {salePool.recommended.filter(x => !saleIds.includes(x.id)).length > 0 && (
                              <div className="mb-2 rounded-xl border border-[#C9A24D]/30 bg-[#fffaf0] p-2.5 dark:bg-[#C9A24D]/[0.06]">
                                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]"><Star className="h-3 w-3 fill-current" /> Recommended - your sales in {areas.join(', ')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {salePool.recommended.filter(x => !saleIds.includes(x.id)).map(s => <Chip key={`r-${s.id}`} on={false} onClick={() => pickSale(s.id)}>{propLine(s)}{s.sold_date ? ` · ${String(s.sold_date).slice(0, 7)}` : ''}</Chip>)}
                                </div>
                              </div>
                            )}
                            {!allSales ? (
                              <button type="button" onClick={() => setAllSales(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
                                View all {salePool.all.length} of your sales <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                                <div className="relative mb-2">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                  <input value={saleSearch} onChange={e => setSaleSearch(e.target.value)} placeholder="Search by street or town" className={`${inputCls} py-2 pl-8 text-xs`} />
                                </div>
                                <AnimatePresence mode="wait" initial={false}>
                                  <motion.div key={`${salePool.key}-${salePage}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} className="flex flex-wrap gap-1.5">
                                    {salePool.found.slice(salePage * SALES_PAGE, salePage * SALES_PAGE + SALES_PAGE).map(s => <Chip key={s.id} on={saleIds.includes(s.id)} onClick={() => pickSale(s.id)}>{propLine(s)}{s.sold_date ? ` · ${String(s.sold_date).slice(0, 7)}` : ''}</Chip>)}
                                    {salePool.found.length === 0 && <p className="text-[11px] font-semibold text-gray-400">No sales match &ldquo;{saleSearch}&rdquo;.</p>}
                                  </motion.div>
                                </AnimatePresence>
                                {salePool.found.length > SALES_PAGE && (
                                  <div className="mt-2 flex items-center justify-between">
                                    <button type="button" disabled={salePage === 0} onClick={() => setSalePage(p => p - 1)} className="rounded-lg px-2 py-1 text-[11px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/10 disabled:opacity-30 dark:text-[#e8c97a]">&larr; Newer</button>
                                    <span className="text-[10px] font-bold text-gray-400">{salePage * SALES_PAGE + 1}-{Math.min(salePool.found.length, salePage * SALES_PAGE + SALES_PAGE)} of {salePool.found.length}</span>
                                    <button type="button" disabled={(salePage + 1) * SALES_PAGE >= salePool.found.length} onClick={() => setSalePage(p => p + 1)} className="rounded-lg px-2 py-1 text-[11px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/10 disabled:opacity-30 dark:text-[#e8c97a]">Older &rarr;</button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                            {saleIds.length >= MAX_SALES && <p className="mt-1.5 text-[10px] font-bold text-[#8b7355] dark:text-[#e8c97a]">That&apos;s {MAX_SALES} - the most one article uses. Tap a picked sale to swap it.</p>}
                          </>
                        )}
                        {ctx.listings.length > 0 && (
                          <>
                            <p className="mb-1.5 mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Your active listings (added as property cards)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ctx.listings.map(l => <Chip key={l.id} on={listingIds.includes(l.id)} onClick={() => toggle(listingIds, setListingIds, l.id)}>{propLine(l)}</Chip>)}
                            </div>
                          </>
                        )}
                      </Question>
                    )}
                    <Question icon={Clapperboard} title="Tie in one of your videos?" hint="Optional. Pick one and the AI writes a section around it - the video sits right in that section.">
                      {suggestedVideos.length + otherVideos.length > 0 ? (
                        <>
                          {suggestedVideos.length > 0 && <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]"><Star className="h-3 w-3 fill-current" /> Suggested for this article</p>}
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {[...suggestedVideos, ...otherVideos].slice(0, 12).map(v => {
                              const on = video?.url === v.url
                              const fits = suggestedVideos.includes(v)
                              return (
                                <motion.button key={v.id} type="button" whileTap={{ scale: 0.95 }} title={v.title}
                                  onClick={() => { setVideo(on ? null : { url: v.url, title: v.title }); setVideoDraft('') }}
                                  className={`relative w-36 shrink-0 overflow-hidden rounded-xl border-2 text-left transition ${on ? 'border-[#C9A24D] shadow-[0_10px_24px_-14px_rgba(201,162,77,.9)]' : fits ? 'border-[#C9A24D]/40' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                                  <span className="relative block aspect-video bg-gray-100 dark:bg-white/5">
                                    <img src={v.image || `https://i.ytimg.com/vi/${youtubeIdOf(v.url)}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
                                    {fits && !on && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#C9A24D] px-1.5 text-[8px] font-black uppercase leading-[14px] text-[#111827]">Fits</span>}
                                    {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" /></span>}
                                  </span>
                                  <span className="block truncate bg-white px-2 py-1.5 text-[11px] font-black text-[#111827] dark:bg-[#151517] dark:text-white">{v.title || (v.kind === 'tour' ? 'House tour' : 'Video')}</span>
                                </motion.button>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="rounded-xl bg-[#fbfaf7] px-3 py-2 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                          Link your YouTube channel in <Link href="/studio/site" className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#e8c97a]">Agent Hub → Videos</Link> and your videos show up here, with the ones that fit each article suggested first.
                        </p>
                      )}
                      <div className="relative mt-2">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input value={videoDraft} onChange={e => { const url = e.target.value.trim(); setVideoDraft(e.target.value); setVideo(youtubeIdOf(url) ? { url } : null) }} placeholder="Or paste a YouTube link" className={`${inputCls} pl-9`} />
                      </div>
                      {pastedVideo && youtubeIdOf(pastedVideo.url) && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-3 rounded-xl border border-[#C9A24D]/40 bg-[#fffaf0] p-2 dark:bg-[#C9A24D]/[0.06]">
                          <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black">
                            <img src={`https://i.ytimg.com/vi/${youtubeIdOf(pastedVideo.url)}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                            <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-black text-[#111827] dark:text-white">{pastedVideo.title || 'Your YouTube video'}</span>
                            <span className="block truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">{pastedVideo.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </span>
                          <button type="button" onClick={() => { setVideo(null); setVideoDraft('') }} aria-label="Remove video" className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-black/5 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
                        </motion.div>
                      )}
                      {video && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 overflow-hidden">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Where it goes</p>
                          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                            {([['section', 'Its own section', 'The AI writes about it'], ['after_intro', 'After the intro', 'First thing readers see'], ['before_end', 'Near the end', 'Right before you sign off']] as const).map(([id, label, hint]) => (
                              <button key={id} type="button" onClick={() => setVideoPos(id)} className={`rounded-xl border-2 px-2 py-2 text-left transition ${videoPos === id ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
                                <span className="block text-[11px] font-black text-[#111827] dark:text-white">{label}</span>
                                <span className="block text-[10px] font-semibold leading-tight text-gray-400">{hint}</span>
                              </button>
                            ))}
                          </div>
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> {video.title ? <>&ldquo;{video.title}&rdquo;</> : 'This video'} goes in the article - you can move it once it&apos;s written.</p>
                        </motion.div>
                      )}
                    </Question>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Question icon={Wand2} title="Tone">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {TONES.map(t => (
                          <button key={t.id} type="button" onClick={() => setTone(t.id)} className={`rounded-xl border-2 p-3 text-left transition ${tone === t.id ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
                            <p className="text-xs font-black text-[#111827] dark:text-white">{t.label}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{t.hint}</p>
                          </button>
                        ))}
                      </div>
                    </Question>
                    <Question icon={PenLine} title="Length">
                      <div className="grid grid-cols-3 gap-2">
                        {LENGTHS.map(l => (
                          <button key={l.id} type="button" onClick={() => setLength(l.id)} className={`rounded-xl border-2 p-3 text-left transition ${length === l.id ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
                            <p className="text-xs font-black text-[#111827] dark:text-white">{l.label}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{l.hint}</p>
                          </button>
                        ))}
                      </div>
                    </Question>
                    <Question icon={Target} title="What should readers do at the end?">
                      <div className="flex flex-wrap gap-1.5">
                        {CTAS.map(c => <Chip key={c.id} on={cta === c.id} onClick={() => setCta(c.id)}>{c.label}</Chip>)}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-gray-400">The button opens your {cta === 'question' ? 'question box' : `"${CTAS.find(c => c.id === cta)?.label}" form`} right on the article - readers never leave.</p>
                    </Question>
                  </>
                )}

              </motion.div>
            </AnimatePresence>
          )}

          {phase === 'writing' && (
            <div className="py-2">
              <style>{'@keyframes blogInk{from{width:0}to{width:var(--w)}}@keyframes blogPen{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(6px,-3px) rotate(-14deg)}}'}</style>
              {/* A page writing itself - lines ink in, one after another, as the stages tick by. */}
              <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] to-[#fbf3df] p-5 shadow-[0_20px_44px_-30px_rgba(201,162,77,.8)] dark:border-white/10 dark:from-[#151517] dark:to-[#1d1810]">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#C9A24D]/25 blur-2xl" />
                <p className="relative text-[9px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">{initialCategory || 'Your article'}</p>
                <p className="relative mt-1 line-clamp-2 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{topic || 'Your article'}</p>
                <div className="relative mt-4 space-y-2">
                  {[96, 88, 100, 72, 94, 84, 60].map((w, i) => (
                    <div key={i} className="h-2 rounded-full bg-[#C9A24D]/10 dark:bg-white/5">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#111827]/25 to-[#C9A24D]/50 dark:from-white/20 dark:to-[#e8c97a]/50" style={{ ['--w' as any]: `${w}%`, width: 0, animation: `blogInk 2.6s ${i * 0.55 + stage * 0.15}s ease-out forwards` }} />
                    </div>
                  ))}
                </div>
                <PenLine className="absolute bottom-4 right-5 h-6 w-6 text-[#C9A24D]" style={{ animation: 'blogPen 1.1s ease-in-out infinite' }} />
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#C9A24D]/15">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" initial={{ width: '4%' }} animate={{ width: `${Math.round(((stage + 1) / WRITING_STAGES.length) * 92)}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
              </div>
              <div className="space-y-2.5">
                {WRITING_STAGES.map((s, i) => (
                  <motion.div key={s.key} layout className={`flex items-start gap-2.5 text-sm font-bold transition-opacity ${i <= stage ? 'opacity-100' : 'opacity-30'}`}>
                    <span className="mt-0.5">{i < stage ? <Check className="h-4 w-4 text-emerald-500" /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> : <span className="block h-4 w-4 rounded-full border-2 border-gray-200 dark:border-gray-700" />}</span>
                    <span className="min-w-0">
                      <span className="block text-[#111827] dark:text-white">{s.label}</span>
                      {i === stage && <motion.span initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">{s.key === 'gathering' ? gatheringDetail(user?.plan_tier) : s.detail}</motion.span>}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 space-y-2 rounded-xl border border-gray-100 bg-[#fbfaf7] p-4 dark:border-gray-800 dark:bg-[#1A1A1C]">
                <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                {[92, 100, 85, 97, 60].map((w, i) => <div key={i} className="h-2.5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />)}
              </div>
              <p className="mt-3 text-center text-[11px] font-semibold text-gray-400">Usually 2-4 minutes - it researches and fact-checks before you see it. Uses your monthly AI usage.</p>
              <div className="mt-4 flex flex-col items-center gap-1.5">
                <button type="button" onClick={leaveWriting} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                  Keep working - let me know when it&apos;s done <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <p className="text-center text-[11px] font-semibold text-gray-400">It keeps writing. Your bell lights up when it&apos;s ready, and it waits in your Blogs list.</p>
              </div>
            </div>
          )}

          {phase === 'failed' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 py-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="h-7 w-7" /></span>
              <h3 className="font-serif text-2xl font-black text-[#111827] dark:text-white">The AI couldn&apos;t finish this article</h3>
              <p className="mx-auto max-w-md rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error || 'Something went wrong while it was writing.'}</p>
              <p className="mx-auto flex max-w-md items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CloudCheck className="h-4 w-4 shrink-0" /> {blogId ? 'Your article is unchanged and your answers are still here.' : 'Everything you answered is saved as a draft in your Blogs list - nothing was lost.'}
              </p>
              {!/charged/i.test(error) && <p className="text-[11px] font-semibold text-gray-400">A try that fails is never charged.</p>}
            </motion.div>
          )}

          {phase === 'done' && result && (
            <AnimatePresence mode="wait" custom={doneDir} initial={false}>
              <motion.div key={doneStep} initial={{ opacity: 0, x: doneDir * 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: doneDir * -18 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">
                {doneStep === 0 && (
                  <>
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                {result.blog.category && <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{result.blog.category}</p>}
                <h3 className="mt-1 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{result.blog.title}</h3>
                {result.blog.subtitle && <p className="mt-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">{result.blog.subtitle}</p>}
                <div className="mt-3 rounded-xl bg-[#fbfaf7] p-3 dark:bg-[#1A1A1C]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Google preview</p>
                  <p className="mt-1 truncate text-sm font-bold text-[#1a0dab] dark:text-[#8ab4f8]">{result.blog.seo_title || result.blog.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{result.blog.meta_description}</p>
                </div>
                {result.blog.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">{result.blog.tags.map(t => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/10 dark:text-gray-300">#{t}</span>)}</div>
                )}
                <p className="mt-3 text-[11px] font-bold text-gray-400">{result.blog.blocks.length} blocks · saved as a draft — nothing is published until you say so.</p>
              </div>
                  </>
                )}
                {doneStep === 1 && (
                  <>
              {/* Its look - picked on the real draft, every style shown live */}
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="flex items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white"><Sparkles className="h-4 w-4 text-[#C9A24D]" /> Pick its look</p>
                <p className="mb-3 mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">This is your actual article. Tap a style to see it - change it any time in the editor.</p>
                <div className="flex flex-wrap gap-1.5" onMouseLeave={() => setHoverLook(null)}>
                  {BLOG_THEMES.map(t => {
                    const locked = !!t.idx && !canLuxe
                    const on = look === t.id && !lookPeek
                    return (
                      <motion.button key={t.id} type="button" whileTap={{ scale: 0.95 }} onMouseEnter={() => setHoverLook(t.id)}
                        onClick={() => { if (locked) { setLookPeek(true); setHoverLook(t.id); return } setLookPeek(false); setLook(t.id) }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition hover:-translate-y-0.5 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-300'}`}>
                        <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }} />
                        {t.label}
                        {locked && <span className="rounded-full bg-[#111827] px-1 text-[8px] leading-[14px] text-[#e8c97a]">IDX</span>}
                        {on && <Check className="h-3 w-3" />}
                      </motion.button>
                    )
                  })}
                </div>
                <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={hoverLook || (lookPeek ? 'luxe_plus' : look)} initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <BlogThemeLivePreview
                        theme={blogTheme(hoverLook || (lookPeek ? 'luxe_plus' : look)).id as BlogThemeId}
                        title={result.blog.title}
                        subtitle={result.blog.subtitle}
                        category={result.blog.category}
                        coverUrl={result.blog.cover_image_url ? resolveMediaUrl(result.blog.cover_image_url) : null}
                        agentName={[user?.first_name, user?.last_name].filter(Boolean).join(' ')}
                        agentPhoto={user?.photo_url}
                        height={380}
                      >
                        <BlogArticleBody blocks={result.blog.blocks.slice(0, 10)} agent={{ name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Your Name', photoUrl: user?.photo_url || null }} accentColor={blogTheme(hoverLook || look).accent} />
                      </BlogThemeLivePreview>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {lookPeek && !canLuxe && <LuxeUpgradePitch feature="Luxe article theme" className="mt-3" tier={luxeBlogUpgrade(user?.plan_tier).tier} tierLabel={luxeBlogUpgrade(user?.plan_tier).label} text={`Luxe gives your articles a cinematic cover, gold light and motion - it's part of ${luxeBlogUpgrade(user?.plan_tier).label}. Your article keeps the look you picked.`} />}
              </div>
                  </>
                )}
                {doneStep === 2 && (
                  <>
              {result.verification && result.verification.checked !== false && <VerifiedPanel review={result.verification} />}

              <BlogFinishStep ctx={ctx} blocks={result.blog.blocks} areas={areas} value={finish} onChange={setFinish} canSignature={hasEmailSignatureAccess(user?.plan_tier)} videoInArticle={result.blog.blocks.some(b => b.type === 'youtube')} usedSales={saleIds.length > 0} usedListings={listingIds.length > 0} />

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
                <NeighborhoodLinksPicker value={linkedAreas} articleText={articleTextOf(result.blog.blocks)} autoPick
                  onChange={slugs => { setLinkedAreas(slugs); api.blogs.updateHubVisibility(result.blog.id, { linked_areas: slugs }) }} />
              </div>

              {result.numbers_to_verify.length > 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
                  <p className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200"><AlertTriangle className="h-3.5 w-3.5" /> Double-check {result.numbers_to_verify.length === 1 ? 'this number' : 'these numbers'} before publishing</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">They don&apos;t appear word-for-word in what you gave the AI (often it&apos;s just math on your figures):</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">{result.numbers_to_verify.map(n => <span key={n} className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:bg-black/30 dark:text-amber-200">{n}</span>)}</div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" /> Every number in this draft traces back to your brief or your real sales data.
                </p>
              )}

              {result.facts_used.length > 0 && (
                <details className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <summary className="cursor-pointer text-xs font-black text-gray-500">Facts the AI used ({result.facts_used.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {result.facts_used.map((f, i) => <li key={i} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">• {f.fact} <span className="text-gray-300">({f.source.replace('_', ' ')})</span></li>)}
                  </ul>
                </details>
              )}

              <AiCoverMaker blogId={result.blog.id} idea={result.cover_image_idea} coverUrl={result.blog.cover_image_url}
                onUse={async url => {
                  const r = await api.blogs.update(result.blog.id, { cover_image_url: url })
                  if (r.success && r.data) setResult(cur => (cur ? { ...cur, blog: { ...cur.blog, cover_image_url: url } } : cur))
                }} />
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {ctx && !blocked && phase === 'interview' && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button onClick={() => (step === 0 ? onClose() : setStep(step - 1))} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-400 hover:text-[#111827] dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <div className="flex items-center gap-3">
              {savedAt && (
                <motion.span key={savedAt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                  <CloudCheck className="h-3.5 w-3.5" /> {localKey ? 'Saved' : 'Saved as draft'}
                </motion.span>
              )}
              {step > 0 && step < STEPS.length - 1 && (
                <button onClick={() => setStep(STEPS.length - 1)} className="text-xs font-black text-gray-400 hover:text-[#111827] dark:hover:text-white">Skip to style</button>
              )}
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(step + 1)} disabled={!canNext} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={generate} disabled={!topic.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827] shadow-md transition hover:brightness-105 disabled:opacity-40">
                  <Sparkles className="h-4 w-4" /> {blogId ? 'Rewrite my article' : 'Write my article'}
                </button>
              )}
            </div>
          </div>
        )}
        {phase === 'failed' && (
          <div className="grid shrink-0 grid-cols-2 items-center gap-2 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:flex sm:justify-between sm:px-6">
            <button onClick={() => { setError(''); setPhase('interview') }} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10 sm:border-transparent text-sm font-black text-gray-500 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white">
              <PenLine className="h-4 w-4" /> Edit answers
            </button>
            <button onClick={generate} disabled={!topic.trim()} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827] shadow-md transition hover:brightness-105 disabled:opacity-40">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}
        {phase === 'done' && result && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            {doneStep > 0 ? (
              <button onClick={() => goDone(doneStep - 1)} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-400 hover:text-[#111827] dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <p className="hidden text-[11px] font-semibold text-gray-400 sm:block">Saved as a draft - nothing is published until you say so.</p>
            )}
            {doneStep < 2 ? (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => goDone(doneStep + 1)} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-[#111827]">
                {doneStep === 0 ? 'Pick its look' : 'Finish up'} <ArrowRight className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.96 }} onClick={finishAndOpen} disabled={finishing} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Open in editor <ArrowRight className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
