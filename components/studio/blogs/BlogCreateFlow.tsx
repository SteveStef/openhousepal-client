'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Building2, Check, Home, Hammer, Lightbulb, Loader2, MapPin, PenLine, Sparkles,
  TrendingUp, Users, Wand2, X, type LucideIcon,
} from 'lucide-react'
import { BLOG_TOPICS, BlogTopicTemplate, buildStarterBlocks } from '@/lib/studio/blogTopics'
import api from '@/lib/api-service'
import type { BlogThemeId } from '@/types'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import BlogAiWriter from './BlogAiWriter'
import FlowDock from '@/components/ui/FlowDock'
import { backdropMotion, useIsPhone, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

const CATEGORY_ORDER = ['Buyers', 'Sellers', 'Market Updates', 'Neighborhoods', 'Homeownership', 'Investments', 'New Construction']
const CATEGORY_ICON: Record<string, LucideIcon> = {
  Buyers: Users, Sellers: Home, 'Market Updates': TrendingUp, Neighborhoods: MapPin, Homeownership: Building2, Investments: TrendingUp, 'New Construction': Hammer,
}
const STEPS = [
  { label: 'Situation', icon: Lightbulb },
  { label: 'Title', icon: PenLine },
  { label: 'Write', icon: Wand2 },
]

// New article: what it's for (a premade idea or your own) -> its title -> write it with AI (which
// asks what it needs to know, then has the agent pick the look on the real draft) or start from
// scratch (the look is picked in the editor, on the article itself).
export default function BlogCreateFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [picked, setPicked] = useState<BlogTopicTemplate | 'custom' | null>(null)
  const [title, setTitle] = useState('')
  // Scratch articles start on Luxe (the default look); the agent changes it in the editor.
  const theme: BlogThemeId = 'luxe'
  const [creating, setCreating] = useState(false)
  const [showAi, setShowAi] = useState(false)
  // Back from the AI writer: on a phone the sheet is already up, so it fades back in place.
  const [backFromAi, setBackFromAi] = useState(false)
  const [estimate, setEstimate] = useState<number | null>(null)

  const template = picked && picked !== 'custom' ? picked : null
  // Phones (10/22, "make blog as good as CMA"): one tall sheet that slides up, keeps the same height
  // on every step (no jumping), and can be pulled down to close. Computers keep the centred window.
  const isPhone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, isPhone && !creating && !showAi)
  // The title box grows with the title (a long one wraps instead of scrolling out of sight).
  const titleRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [title, step])
  useEffect(() => {
    if (step !== 2 || estimate !== null) return
    api.blogs.aiEstimate('standard').then(res => { if (res.success && res.data?.percent != null) setEstimate(res.data.percent) })
  }, [step, estimate])

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n) }
  const pick = (p: BlogTopicTemplate | 'custom') => {
    setPicked(p)
    setTitle(p === 'custom' ? '' : p.title)
    setDir(1); setStep(1)
  }
  const canNext = step === 0 ? picked !== null : step === 1 ? title.trim().length >= 3 : true

  const startScratch = async () => {
    setCreating(true)
    const response = await api.blogs.create(title.trim() || 'Untitled Article', template?.category, buildStarterBlocks(template), theme)
    setCreating(false)
    if (response.success && response.data) router.push(`/studio/blogs/${response.data.id}`)
  }

  if (showAi) {
    return (
      <BlogAiWriter
        initialTopic={title.trim()}
        initialCategory={template?.category}
        titleBased
        onClose={() => { setBackFromAi(true); setShowAi(false) }}
        fromFlow
        // Left while it writes: back to Blogs, where the article shows "AI is writing".
        onLeave={() => { onClose(); window.location.assign('/studio/blogs') }}
        onDone={result => router.push(`/studio/blogs/${result.blog.id}?ai=1`)}
      />
    )
  }

  return (
    <motion.div {...backdropMotion} className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0f17]/70 sm:items-center sm:p-6" onClick={onClose}>
      <motion.div
        ref={sheetRef}
        {...(isPhone ? (backFromAi ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } }, exit: sheetMotion.exit } : sheetMotion) : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const } },
          exit: { opacity: 0, y: 14, transition: { duration: 0.16 } },
        })}
        style={isPhone ? { y: sheetY } : undefined}
        onClick={e => e.stopPropagation()}
        className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_40px_90px_-30px_rgba(17,24,39,.6)] dark:bg-[#111113] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-3xl"
      >
        {/* Header - the luxe header language, with the step rail */}
        <div className="relative shrink-0 overflow-hidden border-b border-[#C9A24D]/25 dark:border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#fffdf8_0%,#fbf6ec_55%,#f4ead7_100%)] dark:bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.2),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
          {/* Phones: the pull-down handle */}
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#8b7355]/30 dark:bg-white/20 sm:hidden" />
          <div className="relative flex items-start justify-between gap-3 px-5 pb-3 pt-6 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b7355] dark:text-[#e8c97a]">New Article</p>
              <h2 className="mt-1 font-serif text-[1.4rem] font-black leading-tight min-[380px]:text-2xl text-[#111827] dark:text-white sm:text-3xl">
                {step === 0 && <>What&apos;s it <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">about?</em></>}
                {step === 1 && <>Give it a <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">title</em></>}
                {step === 2 && <>How should we <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">write it?</em></>}
              </h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 sm:h-9 sm:w-9 place-items-center rounded-full border border-[#C9A24D]/25 bg-white/70 text-[#8b7355] transition hover:rotate-90 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex items-center gap-1 px-4 pb-3.5 sm:pb-3">
            {STEPS.map((s, i) => {
              const on = i === step
              const done = i < step
              const Icon = done ? Check : s.icon
              return (
                <div key={s.label} className="flex flex-1 items-center gap-1">
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => go(i)}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] sm:py-1.5 font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : done ? 'text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]' : 'cursor-default text-gray-400 dark:text-white/35'}`}
                  >
                    {on && <motion.span layoutId="blog-flow-step" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
                    <Icon className={`relative h-3.5 w-3.5 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />
                    <span className={`relative sm:inline ${on ? 'inline' : 'hidden'}`}>{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className="relative h-px flex-1 overflow-hidden rounded-full bg-[#C9A24D]/20">
                      <motion.span className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain sm:[scrollbar-gutter:stable]" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="p-5 sm:p-6"
            >
              {step === 0 && (
                <div className="space-y-6">
                  {/* Your own idea - first, it's the most common */}
                  <button
                    onClick={() => pick('custom')}
                    className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border-2 p-4 text-left transition sm:gap-4 ${picked === 'custom' ? 'border-[#C9A24D] bg-[#fbf3df] dark:bg-[#C9A24D]/10' : 'border-dashed border-[#C9A24D]/50 hover:-translate-y-0.5 hover:border-[#C9A24D] hover:bg-[#fffdf8] dark:hover:bg-white/[0.03]'}`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md"><Lightbulb className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-lg font-black text-[#111827] dark:text-white">My own idea</span>
                      <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Type any topic - a neighborhood, a market question, a story from a closing.</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A24D] transition-transform group-hover:translate-x-0.5" />
                  </button>

                  {CATEGORY_ORDER.map((category, ci) => {
                    const topics = BLOG_TOPICS.filter(t => t.category === category)
                    if (!topics.length) return null
                    const Icon = CATEGORY_ICON[category] || Lightbulb
                    return (
                      <motion.div key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(ci * 0.05, 0.3) }}>
                        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">
                          <Icon className="h-3.5 w-3.5" /> {category}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {topics.map(t => {
                            const on = template?.id === t.id
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => pick(t)}
                                className={`w-full rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.99] sm:p-3.5 ${on ? 'border-[#C9A24D] bg-[#fbf3df] dark:bg-[#C9A24D]/10' : 'border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/10'}`}
                              >
                                <p className="text-[13px] font-black text-[#111827] dark:text-white">{t.title}</p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{t.description}</p>
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">Article title</span>
                    <textarea
                      ref={titleRef}
                      autoFocus
                      rows={1}
                      value={title}
                      onChange={e => setTitle(e.target.value.replace(/\n/g, ' '))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (canNext) go(2) } }}
                      placeholder={picked === 'custom' ? 'e.g. What buyers should know about older homes in Bryn Mawr' : ''}
                      className="mt-2 block w-full resize-none overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 py-4 font-serif text-xl font-black leading-snug text-[#111827] outline-none transition placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:text-gray-300 focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                    />
                  </label>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {template ? <>Started from <span className="font-black text-[#8b7355] dark:text-[#e8c97a]">{template.title}</span> - make it yours. The AI builds the article around this title.</> : 'A clear, specific title works best - the AI builds the whole article around it.'}
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowAi(true)}
                    className="group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-[#C9A24D]/60 bg-gradient-to-r from-[#111827] via-[#172033] to-[#4a3820] p-4 text-left active:scale-[0.99] sm:gap-4 sm:p-5 shadow-[0_18px_40px_-18px_rgba(201,162,77,0.7)] transition hover:-translate-y-0.5"
                  >
                    <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-card-shimmer" />
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[#111827] shadow-md sm:h-12 sm:w-12"><Sparkles className="h-5 w-5 sm:h-6 sm:w-6" /></span>
                    <div className="relative min-w-0 flex-1">
                      <p className="font-serif text-lg font-black text-white">Write it with AI</p>
                      <p className="text-xs font-semibold text-gray-300">A few quick questions about the area and your take, then a complete article in your voice.</p>
                      <p className="mt-1.5 text-[11px] font-black text-[#e8c97a]">
                        {estimate != null ? `Uses about ${estimate < 1 ? estimate.toFixed(1) : Math.round(estimate)}% of your monthly AI` : 'Uses your monthly AI allowance'}
                      </p>
                    </div>
                    <ArrowRight className="relative hidden h-5 w-5 shrink-0 text-[#C9A24D] transition-transform group-hover:translate-x-1 min-[380px]:block" />
                  </button>
                  <div className="rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/10">
                    <MonthlyAiUsageMeter variant="inline" />
                  </div>
                  <button
                    onClick={startScratch}
                    disabled={creating}
                    className="group flex w-full items-center gap-3.5 rounded-2xl border-2 border-dashed border-gray-300 p-4 text-left transition active:scale-[0.99] sm:gap-4 sm:p-5 hover:-translate-y-0.5 hover:border-[#C9A24D] disabled:opacity-60 dark:border-white/15"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fbf3df] sm:h-12 sm:w-12 text-[#8b7355] dark:bg-white/[0.06] dark:text-[#e8c97a]">
                      {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <PenLine className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg font-black text-[#111827] dark:text-white">Start from scratch</p>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{template ? 'Opens with a suggested structure for this kind of article - you write it.' : 'A blank article you write yourself.'}</p>
                    </div>
                    <ArrowRight className="hidden h-5 w-5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#C9A24D] min-[380px]:block" />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Phones: the flow bar (components/ui/FlowDock) in place of the footer below - same go().
            The first and last steps are picks (a card moves you on), so they have no Continue. */}
        <FlowDock inline step={step + 1} total={STEPS.length}
          onBack={step > 0 ? () => go(step - 1) : undefined}
          onContinue={step > 0 && step < 2 ? () => go(step + 1) : undefined} disabled={!canNext} />
        <div className="hidden shrink-0 items-center justify-between border-t border-gray-100 bg-[#FAFAF7]/80 px-6 py-4 dark:border-white/[0.06] dark:bg-white/[0.02] sm:flex">
          <button
            onClick={() => (step === 0 ? onClose() : go(step - 1))}
            className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step > 0 && step < 2 && (
            <button
              onClick={() => go(step + 1)}
              disabled={!canNext}
              className="group inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]"
            >
              Continue <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
