'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Footer from '@/components/Footer'
import { FEATURE_TABS, type FeatureTabKey } from '@/components/home/featureTabsData'
import { HouseMotif, PinRouteMotif, KeyMotif, ChatMotif, QrBadge, StarBadge, ShieldBadge, MailBadge } from '@/components/home/LineArtMotifs'
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { useAuth } from '@/contexts/AuthContext'
import { BasicPricingCard, PremiumPricingCard, IdxPricingCard, NoMlsPricingCard, ProNoMlsPricingCard } from '@/components/pricing/PricingCards'
import api from '@/lib/api-service'
import { Check, ChevronDown, Loader2, Send, Sparkles } from 'lucide-react'
import HeroTagline from '@/components/home/HeroTagline'

// The FAQ section's closing "Ask Us a Question" card. Logged-in agents already have a real
// ticket inbox (Header's Help icon / /settings/help), so this just routes them straight into the
// new-ticket form there instead of re-implementing submission. A signed-out visitor has no
// account for a ticket thread to belong to, so instead this collects a one-off email + message
// and posts it to the public (no-auth) endpoint - it lands in its own "Questions" tab in the
// admin dashboard, kept separate from agents' own support tickets.
function AskQuestionCard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !message.trim() || submitting) return
    setSubmitting(true)
    setError('')
    const { success, error: err } = await api.publicQuestions.submit(email.trim(), message.trim())
    setSubmitting(false)
    if (success) {
      setSubmitted(true)
      setEmail('')
      setMessage('')
    } else {
      setError(err || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-[#151517]/80 shadow-sm p-8 text-center">
      <h4 className="text-xl font-bold text-[#0B0B0B] dark:text-white mb-2">Still have a question?</h4>
      <p className="text-[#6B7280] dark:text-gray-400 font-medium mb-6">We're happy to help - ask us anything.</p>

      {isAuthenticated ? (
        <Link
          href="/settings/help?compose=1&category=support"
          className="inline-flex items-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-6 py-3.5 font-bold hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
        >
          <Send className="w-4 h-4" /> Ask Us a Question
        </Link>
      ) : submitted ? (
        <p className="text-[#C9A24D] font-bold">Thanks! We'll get back to you soon.</p>
      ) : (
        <div className="max-w-md mx-auto flex flex-col gap-3 text-left">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Your question"
            rows={3}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white resize-none"
          />
          {error && <p className="text-sm font-bold text-red-500">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] dark:bg-white text-white dark:text-[#111827] px-6 py-3.5 font-bold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Sending...' : 'Ask Us a Question'}
          </button>
        </div>
      )}
    </div>
  )
}

function FAQItem({ faq, index, isVisible }: { faq: { question: string; answer: string }; index: number; isVisible: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={`relative rounded-3xl border transition-all duration-300 ${isOpen ? 'border-[#C9A24D]/50 bg-gradient-to-br from-white/95 to-[#fbf3df]/90 shadow-[0_24px_50px_-30px_rgba(201,162,77,0.8)] dark:from-[#151517]/95 dark:to-[#C9A24D]/10' : 'border-[#C9A24D]/15 bg-white/80 shadow-[0_14px_34px_-28px_rgba(139,115,85,0.6)] hover:-translate-y-0.5 hover:border-[#C9A24D]/40 dark:border-white/[0.07] dark:bg-[#151517]/80'} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} overflow-hidden`}
      style={{ transitionDelay: isVisible ? '0ms' : `${index * 100}ms` }}
    >
      <span aria-hidden className={`absolute inset-y-5 left-0 w-1 rounded-r-full bg-gradient-to-b from-[#C9A24D] to-[#e8c97a] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 sm:px-8 py-6 text-left flex items-center justify-between gap-4"
      >
        <h5 className="font-serif text-lg sm:text-xl font-black text-[#0B0B0B] dark:text-gray-100 pr-4">{faq.question}</h5>
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-180 bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[#111827] shadow-md shadow-[#C9A24D]/40' : 'bg-[#fbf3df] text-[#8b7355] dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div
        className={`px-6 sm:px-8 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-7 opacity-100' : 'max-h-0 pb-0 opacity-0'}`}
      >
        <p className="text-[#4b5563] dark:text-gray-300 leading-relaxed font-medium">{faq.answer}</p>
      </div>
    </div>
  )
}

// Hero sparkles: left/top %, twinkle delay.
const HERO_SPARKS: [string, string, number][] = [['6%', '18%', 0], ['92%', '12%', 1.4], ['14%', '78%', 2.6], ['86%', '70%', 0.8], ['48%', '4%', 3.4], ['70%', '92%', 2]]

// The gold serif italic used for the last words of every homepage heading (same as the app's page
// headers), with a slow shimmer through it.
const HOME_CSS = `.ohp-home-em{background:linear-gradient(100deg,#8b6a2b 0%,#C9A24D 30%,#f1d58b 50%,#C9A24D 70%,#8b6a2b 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ohpHomeEm 7s ease-in-out infinite}.dark .ohp-home-em{background-image:linear-gradient(100deg,#C9A24D 0%,#e8c97a 30%,#fff3cf 50%,#e8c97a 70%,#C9A24D 100%)}@keyframes ohpHomeEm{0%,100%{background-position:100% 0}50%{background-position:0% 0}}.ohp-motif-float{animation:ohpMotifFloat 9s ease-in-out infinite}.ohp-motif-float:nth-of-type(2n){animation-duration:11s;animation-delay:-3s}.ohp-motif-float:nth-of-type(3n){animation-duration:13s;animation-delay:-6s}@keyframes ohpMotifFloat{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -12px;rotate:-3deg}}.ohp-home-spark{width:6px;height:6px;border-radius:999px;background:radial-gradient(circle,#f1d58b,#C9A24D 60%,transparent 70%);box-shadow:0 0 12px 2px rgba(201,162,77,.45);opacity:0;animation:ohpHomeSpark 4.5s ease-in-out infinite}@keyframes ohpHomeSpark{0%,100%{opacity:0;transform:scale(.4)}45%{opacity:.9;transform:scale(1)}}.ohp-tier-spin{animation:ohpTierSpin 5s linear infinite}@keyframes ohpTierSpin{to{transform:rotate(1turn)}}.ohp-tier-shine{transform:translateX(-120%) skewX(-12deg)}.group:hover .ohp-tier-shine{transition:transform .9s cubic-bezier(.22,.61,.36,1);transform:translateX(320%) skewX(-12deg)}.ohp-idx-glint{background:linear-gradient(100deg,#f3dfa8 0%,#f3dfa8 38%,#fff 50%,#f3dfa8 62%,#f3dfa8 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ohpHomeEm 5s ease-in-out infinite}.ohp-idx-aurora{animation:ohpIdxAurora 7s ease-in-out infinite alternate}.ohp-idx-aurora-b{animation:ohpIdxAurora 9s ease-in-out infinite alternate-reverse}@keyframes ohpIdxAurora{from{transform:translateX(-45%)}to{transform:translateX(45%)}}.ohp-idx-grid{animation:ohpIdxGrid 14s linear infinite}@keyframes ohpIdxGrid{to{background-position:18px 18px}}.ohp-idx-skyline path{stroke-dasharray:1400;stroke-dashoffset:1400;animation:ohpIdxDraw 6s ease-in-out infinite alternate}@keyframes ohpIdxDraw{to{stroke-dashoffset:0}}.ohp-idx-spark{box-shadow:0 0 8px 2px rgba(243,223,168,.6);opacity:0;animation:ohpHomeSpark 4.5s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ohp-home-em,.ohp-home-spark,.ohp-motif-float,.ohp-tier-spin,.ohp-idx-glint,.ohp-idx-aurora,.ohp-idx-aurora-b,.ohp-idx-grid,.ohp-idx-spark{animation:none}.ohp-idx-skyline path{animation:none;stroke-dashoffset:0}.ohp-home-spark{opacity:.5}}`

// The homepage's snap-scroll sections, top to bottom - drives the desktop wheel-jump nav and
// which section is currently considered "active".
const SECTIONS = [
  { id: 'hero' },
  { id: 'tools' },
  { id: 'story' },
  { id: 'pricing' },
  { id: 'faq' },
] as const
type SectionId = typeof SECTIONS[number]['id']

// What the floating "keep scrolling" cue says while each section is active - names the section
// coming up next, not a generic "scroll down", so it reads as a running table of contents rather
// than a one-off hint. No entry for 'faq' (the last section) - the cue hides there instead.
const NEXT_SECTION_LABEL: Partial<Record<SectionId, string>> = {
  hero: 'See How It Works',
  tools: 'See Real Results',
  story: 'See Pricing',
  pricing: 'See FAQs',
}

// Tools with AI built in - they wear the little gold "AI" chip in the Our Tools grid.
const AI_TOOLS = new Set<string>(['blogs', 'cma', 'aimedia', 'listingpage', 'kits', 'showcase', 'idx'])
function AiChip() {
  return (
    <span className="inline-flex items-center gap-px rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f1d58b] px-1.5 py-px text-[8px] font-black uppercase leading-none tracking-wide text-[#111827] shadow-[0_0_10px_rgba(201,162,77,0.5)]">
      <Sparkles className="h-2 w-2" />AI
    </span>
  )
}

// FEATURE_TABS key -> the icon's dedicated draw-in class in globals.css (tools not listed use the
// generic ohp-icon-draw rule, which already animates their icon correctly).
const TOOL_ICON_ASSEMBLE: Record<string, string> = {
  discovery: 'ohp-icon-assemble-search',
  forms: 'ohp-icon-assemble-forms',
  signature: 'ohp-icon-assemble-mail',
  aimedia: 'ohp-icon-assemble-clapper',
  blogs: 'ohp-icon-assemble-blog',
  calsync: 'ohp-icon-assemble-calendar',
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B]" />}>
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // The logo in the header links here with `?view=marketing` when already logged in (see
  // Header.tsx) so clicking it actually shows the homepage instead of instantly bouncing back to
  // /dash below - every other way of landing on `/` (typing the URL, the post-login redirect,
  // etc.) has no such param and keeps defaulting to /dash exactly as before.
  const viewMarketingAnyway = searchParams.get('view') === 'marketing'
  const { isAuthenticated, isLoading: isCheckingAuth } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [pricingAudience, setPricingAudience] = useState<'bright' | 'no_mls'>('bright')
  // Mobile-only plan-select bar under the audience toggle: below `md` only the selected plan's
  // card is rendered at all (the grid becomes a one-at-a-time switcher instead of a long stack to
  // scroll through), starting on the entry-level plan for each audience. md+ always shows every
  // card in the full grid regardless of this state.
  const [selectedBrightPlan, setSelectedBrightPlan] = useState<'BASIC' | 'PREMIUM' | 'IDX'>('BASIC')
  const [selectedNoMlsPlan, setSelectedNoMlsPlan] = useState<'NO_MLS' | 'PRO_NO_MLS'>('NO_MLS')
  const BRIGHT_PLAN_RANK: Record<'BASIC' | 'PREMIUM' | 'IDX', number> = { BASIC: 0, PREMIUM: 1, IDX: 2 }
  const NO_MLS_PLAN_RANK: Record<'NO_MLS' | 'PRO_NO_MLS', number> = { NO_MLS: 0, PRO_NO_MLS: 1 }
  // Which way the mobile single-card view should slide in from - set right before the selection
  // itself changes, based on whether the tapped plan outranks the one currently showing, so
  // moving up-tier slides in from the right and moving down-tier slides in from the left.
  const [brightSwitchDir, setBrightSwitchDir] = useState<'left' | 'right'>('right')
  const [noMlsSwitchDir, setNoMlsSwitchDir] = useState<'left' | 'right'>('right')
  const brightPlanCardClass = (key: 'BASIC' | 'PREMIUM' | 'IDX') =>
    selectedBrightPlan === key
      ? `${brightSwitchDir === 'right' ? 'animate-tab-in-right' : 'animate-tab-in-left'} md:animate-none`
      : 'hidden md:block'
  const noMlsPlanCardClass = (key: 'NO_MLS' | 'PRO_NO_MLS') =>
    selectedNoMlsPlan === key
      ? `${noMlsSwitchDir === 'right' ? 'animate-tab-in-right' : 'animate-tab-in-left'} md:animate-none`
      : 'hidden md:block'
  const [activeFeature, setActiveFeature] = useState<FeatureTabKey>('signin')
  const currentFeature = FEATURE_TABS.find(t => t.key === activeFeature)!
  const ActiveDemo = currentFeature.Demo
  const successVideoRef = useRef<HTMLVideoElement>(null)
  const toolDemoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})
  const [activeSection, setActiveSection] = useState<SectionId>('hero')
  const [seenSections, setSeenSections] = useState<Set<SectionId>>(() => new Set<SectionId>(['hero']))

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Feeds --ohp-header-h (see .ohp-hero-mobile-center in globals.css) - the header's real
  // rendered height, which differs by breakpoint (bigger logo/subtitle line at sm+), so the
  // mobile centering fix below always compensates by the actual current height instead of a
  // guessed constant. AppHeader is a layout-level component always mounted before this page's own
  // content, so it's safe to measure unconditionally on mount.
  useEffect(() => {
    const setHeaderHeightVar = () => {
      const h = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty('--ohp-header-h', `${h}px`)
    }
    setHeaderHeightVar()
    window.addEventListener('resize', setHeaderHeightVar)
    return () => window.removeEventListener('resize', setHeaderHeightVar)
  }, [])

  // Hero subhead: slowly alternates "Built by real estate agents." / "Used by real estate
  // agents.", each swap re-triggering the sliding reveal + highlight wipe (see .ohp-hero-highlight).

  // Tracks which section is front-and-center (drives the dot nav) and which sections have ever
  // been scrolled into view (drives each section's one-time reveal animation - once seen, a
  // section stays "populated" rather than re-animating every time it scrolls past).
  //
  // Depends on isCheckingAuth (not []): while auth is still resolving, this component renders a
  // placeholder <div> instead of the real sections below, so on that first pass every section
  // ref is null and there's nothing to observe. Re-running once isCheckingAuth flips to false -
  // the same render that mounts the real sections - is what lets this effect actually find them.
  useEffect(() => {
    if (isCheckingAuth) return
    const elements = Object.entries(sectionRefs.current).filter(([, el]) => el) as [SectionId, HTMLElement][]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.section as SectionId | undefined
          if (!id) return
          if (entry.isIntersecting) {
            setSeenSections(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
          }
          if (entry.intersectionRatio >= 0.5) {
            setActiveSection(id)
          }
        })
      },
      { threshold: [0, 0.5, 1] }
    )
    elements.forEach(([, el]) => observer.observe(el))
    return () => observer.disconnect()
  }, [isCheckingAuth])

  // Eased scroll to a section - used by the section dot nav and the floating "keep scrolling" cue.
  // (The old wheel-driven section jumping was removed; the page scrolls normally.)
  const activeSectionRef = useRef<SectionId>('hero')
  const isSectionAnimatingRef = useRef(false)
  useEffect(() => { activeSectionRef.current = activeSection }, [activeSection])

  // Used by the wheel handler below - lands a section's top edge just under the sticky header
  // instead of at the very top of the viewport, so the header never
  // overlaps/covers the first bit of whatever section just scrolled into place. Reads the header's
  // real height live instead of a hardcoded pixel value since it differs by breakpoint.
  const animateScrollTo = (targetEl: HTMLElement) => {
    isSectionAnimatingRef.current = true
    const headerOffset = document.querySelector('header')?.getBoundingClientRect().height ?? 0
    const startY = window.scrollY
    // offsetTop chain, NOT getBoundingClientRect - a section scrolling into view for the first
    // time still has its one-time reveal transform (translateY) applied, which would throw the
    // rect-based target off by that amount and make the downward jump land wrong then visibly
    // settle. offsetTop is the layout position and ignores transforms.
    let layoutTop = 0
    for (let node: HTMLElement | null = targetEl; node; node = node.offsetParent as HTMLElement | null) {
      layoutTop += node.offsetTop
    }
    const targetY = Math.max(0, layoutTop - headerOffset)
    const distance = targetY - startY
    // Duration scales with distance (clamped) instead of a fixed 720ms - a short hop (hero->tools)
    // and a long one (past a tall Pricing/FAQ section) used to take the same time, so the long one
    // visibly outran the easing curve and felt like a harder jump. ~0.45ms per pixel keeps
    // perceived velocity consistent across every section pair on this page.
    const duration = Math.min(900, Math.max(520, Math.abs(distance) * 0.45))
    const startTime = performance.now()
    // Ease-out (not in-out) - the jump starts moving the instant the wheel crosses the edge
    // instead of easing in from a standstill, which is what read as sluggish/unresponsive, then
    // decelerates smoothly into the next section instead of stopping abruptly.
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

    const step = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      window.scrollTo(0, startY + distance * easeOutQuint(t))
      if (t < 1) {
        requestAnimationFrame(step)
      } else {
        isSectionAnimatingRef.current = false
      }
    }
    requestAnimationFrame(step)
  }

  // The one-wheel-tick-per-section jump (and the phones-only scroll-snap) were removed 2026-09-30 -
  // the homepage now scrolls normally.

  // The success-story video only starts playing once a visitor actually scrolls it into view,
  // instead of autoplaying immediately on page load. Same isCheckingAuth dependency as the
  // section observer above, for the same reason - the <video> doesn't exist yet on the first,
  // placeholder render.
  useEffect(() => {
    if (isCheckingAuth) return
    const video = successVideoRef.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [isCheckingAuth])

  useEffect(() => {
    if (!isCheckingAuth && isAuthenticated && !viewMarketingAnyway) {
      router.replace('/dash')
    }
  }, [isCheckingAuth, isAuthenticated, viewMarketingAnyway, router])

  // Footer links (Features / Pricing / FAQ) arrive as /?view=marketing#tools etc. The first paint
  // is a blank placeholder while sign-in resolves, so the browser's own jump to #tools finds
  // nothing - scroll there once the real sections exist.
  useEffect(() => {
    if (isCheckingAuth || (isAuthenticated && !viewMarketingAnyway)) return
    const id = window.location.hash.slice(1)
    if (!id) return
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => window.clearTimeout(t)
  }, [isCheckingAuth, isAuthenticated, viewMarketingAnyway])

  // On mobile the tool tabs sit below the live demo (mobile reorders it above via `order-2`, but
  // scrolling through the tabs first still puts the demo above the fold once a visitor is
  // scrolled down to tap one). Tapping a tab nudges the page down just enough to bring the demo's
  // top back under the header, so the updated demo and the blurb beneath the tabs both land on
  // screen together instead of requiring a manual scroll back up. Desktop (lg+) shows the demo
  // beside the tabs already, so this is skipped there.
  const handleToolTabClick = (key: FeatureTabKey) => {
    setActiveFeature(key)
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return
    requestAnimationFrame(() => {
      const el = toolDemoRef.current
      if (!el) return
      const headerOffset = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const rect = el.getBoundingClientRect()
      const targetY = window.scrollY + rect.top - headerOffset - 8
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    })
  }


  if (isCheckingAuth || (isAuthenticated && !viewMarketingAnyway)) {
    return <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B]" />
  }


  // In-flow version of the "there's more below" cue - used inside a section whose content
  // already fills the screen, where the fixed floating pill would sit on top of real content
  // instead of empty space. Placed once, right after that section's own last piece of content
  // (the tool's description paragraph; the plan cards), so it scrolls away with the page normally
  // instead of needing to track anything - being in-flow IS how it "follows scroll".
  // mobileOnly (default true, Tools' case): hidden at sm+, since the fixed cue keeps covering
  // Tools on desktop, where there's enough spare room around the demo for it not to overlap.
  // mobileOnly=false (Pricing's case): shown at every breakpoint - Pricing's cards run edge-to-
  // edge on desktop too, so the fixed cue overlapped there just like it did on mobile; this inline
  // version replaces it entirely for Pricing rather than only filling in below `sm`.
  const renderInlineCue = (fromSection: SectionId, mobileOnly = true) => {
    const index = SECTIONS.findIndex(s => s.id === fromSection)
    const nextSection = SECTIONS[index + 1]
    const label = nextSection ? NEXT_SECTION_LABEL[fromSection] : undefined
    if (!nextSection || !label) return null
    return (
      <button
        onClick={() => {
          const target = sectionRefs.current[nextSection.id]
          if (target) animateScrollTo(target)
        }}
        aria-label={`Scroll down to ${label.replace(/^See /i, '')}`}
        className={`${mobileOnly ? 'sm:hidden' : ''} mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-[#151517]/80 px-3.5 py-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] text-[#6B7280] dark:text-gray-400 hover:text-[#C9A24D] dark:hover:text-[#C9A24D] transition-all duration-300`}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
        <span className="relative flex items-center justify-center w-5 h-5">
          <span className="animate-scroll-cue-ring absolute inset-0 rounded-full border-2 border-[#C9A24D]" />
          <ChevronDown className="animate-scroll-cue w-4 h-4" strokeWidth={2.5} />
        </span>
      </button>
    )
  }

  return (
    // z-0 here matters more than it looks: without an explicit z-index, `relative` alone doesn't
    // establish a stacking context, so the fixed background layer's -z-10 below escaped to the
    // page's root stacking context instead of staying scoped under this wrapper - which meant the
    // entire global background (mesh blobs, grid, dot texture) was silently invisible, painting
    // behind the real root layer instead of behind this page's own content. Confirmed by sampling
    // rendered pixels, not just the computed style, which looked correct the whole time.
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B] relative z-0 transition-colors duration-300">
      {/* Sophisticated Background Architecture - fixed to the viewport (not the scrollable
          content) so it stays put behind every snap section instead of only covering the first
          screen's worth of height. */}
      {/* No mix-blend-mode and no continuous animation here - this layer now spans the whole
          multi-screen page (fixed, behind every section) instead of just one screen, and
          blend-mode compositing has to be recalculated every frame as content scrolls over it,
          which was the main cause of scroll feeling low-frame-rate on this page specifically. */}
      {/* transform-gpu promotes this whole layer to its own compositor layer so its large blurred
          blobs aren't repainted every frame as the sections scroll over it - that repaint was the
          main thing making desktop scroll feel low-frame-rate here. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 transform-gpu">
        {/* Layer 1 - color mesh: mixing in the dark navy brand tone so the wash reads as a proper
            gradient mesh (varied hue + size + depth) rather than one color repeated. The two
            bottom blobs were removed - at that size/blur they read as a washed-out white/cream
            fog in the bottom corners rather than a deliberate accent. */}
        <div className="animate-bg-blob-in absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/10 dark:bg-[#C9A24D]/5 rounded-full blur-[120px]" />
        <div className="animate-bg-blob-in delay-200 absolute top-[18%] right-[-12%] w-[820px] h-[820px] bg-[#111827]/[0.05] dark:bg-[#C9A24D]/5 rounded-full blur-[110px]" />
        <div className="animate-bg-blob-in delay-400 absolute top-[46%] left-[38%] w-[520px] h-[520px] bg-[#f0d494]/[0.14] dark:bg-[#f0d494]/[0.04] rounded-full blur-[100px]" />

        {/* Layer 2 - architectural blueprint grid: a large-scale line grid (not dots), the actual
            "floor plan" texture a real estate site earns, layered under the fine dot grid below so
            the two read as macro + micro structure instead of one flat pattern. A 1px line spaced
            140px apart covers ~1.4% of the area even at full opacity, so a normal-looking opacity
            coefficient on it is still invisible on screen - confirmed by sampling actual rendered
            pixels, not just eyeballing a screenshot. Went to a 1.5px line and 0.22 opacity, which
            is what it actually takes for a hairline that sparse to read as a visible grid. */}
        <div className="animate-bg-fade-in delay-600 absolute inset-0" style={{
          backgroundImage:
            'linear-gradient(to right, #C9A24D 1.5px, transparent 1.5px), linear-gradient(to bottom, #C9A24D 1.5px, transparent 1.5px)',
          backgroundSize: '140px 140px',
          '--ohp-bg-target-opacity': 0.22,
        } as React.CSSProperties} />

        {/* Layer 3 - fine dot grid: the micro texture that keeps layer 2 from feeling empty
            between its lines. Same visibility-math fix as layer 2 - a 1px-radius dot every 48px
            covers a tiny fraction of the area, so this needed a bigger dot and higher opacity too. */}
        <div className="animate-bg-fade-in delay-900 absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #C9A24D 1.75px, transparent 0)',
          backgroundSize: '48px 48px',
          '--ohp-bg-target-opacity': 0.18,
        } as React.CSSProperties}></div>

      </div>

      <style>{HOME_CSS}</style>
      {/* Navigation */}
      <div className={`relative z-50 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>

      </div>

      {/* Hero Section - a single centered pitch (badge, headline, subheading, CTA, trial
          reassurance). No side graphic - it read as an afterthought next to this much copy, so
          this leans fully into being a clean, centered statement instead. Static on load (no
          curtain/stagger) - the one deliberate motion here is the gold underline beneath "More
          Business." drawing itself in once, then a quiet shimmer catching across it forever. */}
      <section
        ref={el => { sectionRefs.current.hero = el }}
        data-section="hero"
        className="ohp-home-scroll-section min-h-[calc(100dvh-var(--ohp-header-h,77px))] snap-start relative z-10 flex items-center">
        {/* The section already starts below the header, so it's sized to exactly the visible area
            under it (--ohp-header-h, measured in JS) and flex-centered - no upward shift here, unlike
            the sections below; the old -8% shift + 82dvh height pinned the badge under the header. */}
        <div className="max-w-4xl mx-auto px-6 w-full text-center">
          <div className="relative pt-4 sm:pt-8 lg:pt-10 pb-6 sm:pb-10 lg:pb-12">
            {/* Layered glow - bigger and doubled-up now that it's the sole visual behind a
                centered statement, for more depth than a single flat blur. */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] -z-10">
              <div className="absolute top-0 left-1/4 w-80 h-80 bg-[#C9A24D]/20 rounded-full blur-[100px]"></div>
              <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#111827]/10 dark:bg-[#C9A24D]/10 rounded-full blur-[100px]"></div>
            </div>

            {/* A few gold sparkles twinkling around the statement (opacity/scale only - cheap). */}
            {HERO_SPARKS.map((sp, k) => <span key={k} aria-hidden className="ohp-home-spark pointer-events-none absolute hidden sm:block" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2]}s` }} />)}

            {/* Trusted badge - hidden on mobile to save vertical space */}
            <div className="relative hidden sm:inline-flex items-center gap-2 overflow-hidden px-3.5 py-1.5 bg-gradient-to-r from-white/90 to-[#fbf3df]/90 dark:from-[#151517]/90 dark:to-[#C9A24D]/10 rounded-full border border-[#C9A24D]/40 mb-6 shadow-[0_8px_24px_-10px_rgba(201,162,77,0.55)] ">
              <span className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 dark:via-white/10 to-transparent animate-shimmer-mini" />
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A24D] opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C9A24D]" /></span>
              <span className="relative text-[10px] font-black text-[#8b7355] dark:text-[#e8c97a] tracking-[0.25em] uppercase">Trusted by Top Agents</span>
            </div>

            <h1 className="relative font-serif text-[3rem] sm:text-[4.5rem] lg:text-[5.6rem] font-black text-[#0B0B0B] dark:text-white mb-6 sm:mb-8 leading-[0.98] tracking-[-0.02em]">
              {/* Flanking the headline itself now, not the CTA button below - that placement kept
                  reading badly next to the button's own glow/shimmer effects no matter the size.
                  The headline is the widest, most prominent element in this column and has clear
                  margin on both sides at this breakpoint with nothing else competing for space. */}
              <HouseMotif
                visible={seenSections.has('hero')}
                className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 left-full ml-10 xl:ml-16 w-[260px] h-[260px] text-[#C9A24D] opacity-[0.26] dark:opacity-[0.32] -z-10"
              />
              <QrBadge
                visible={seenSections.has('hero')}
                className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 right-full mr-10 xl:mr-16 w-[230px] h-[230px] text-[#C9A24D] opacity-[0.24] dark:opacity-[0.3] -z-10"
              />
              Less Busywork.{' '}
              <span className="relative inline-block">
                <em className="ohp-home-em font-light pr-[0.06em]">
                  More Business.
                </em>
                <div className="absolute -bottom-2 left-0 w-full h-1.5 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#C9A24D] to-transparent opacity-40 origin-left animate-underline-draw"></div>
                  <div className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-shimmer-mini"></div>
                </div>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[#4b5563] dark:text-gray-300 font-medium mb-2 sm:mb-3 max-w-xl mx-auto text-balance">
              The most capable platform in real estate.
            </p>
            <p className="text-base sm:text-lg font-medium text-[#6B7280] dark:text-gray-400 mb-8 sm:mb-10 h-9 flex items-center justify-center" aria-label="Built by real estate agents. Used by real estate agents.">
              <HeroTagline />
            </p>

            <div className="relative inline-block">
              <div className="absolute -inset-3 rounded-[2rem] bg-[#C9A24D]/40 blur-xl opacity-70 animate-glow-pulse -z-10"></div>
              <Link
                href="/register"
                className="group relative inline-flex items-center px-12 py-6 bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#111827] dark:from-white dark:via-gray-50 dark:to-white text-white dark:text-[#111827] rounded-2xl font-bold text-xl overflow-hidden shadow-[0_16px_40px_-8px_rgba(17,24,39,0.45)] transform transition-all duration-300 hover:scale-105 hover:shadow-[0_24px_55px_-8px_rgba(201,162,77,0.55)] active:scale-95 whitespace-nowrap"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 dark:via-[#C9A24D]/25 to-transparent animate-shimmer-mini"></span>
                <span className="relative z-10 flex items-center justify-center">
                  Start Free Trial
                  <svg className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm font-semibold text-[#6B7280] dark:text-gray-400">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C9A24D]" strokeWidth={3} /> {TRIAL_PERIOD_DAYS}-day free trial</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C9A24D]" strokeWidth={3} /> Cancel anytime</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#C9A24D]" strokeWidth={3} /> No commitment</span>
            </div>

            <div className="mt-8">{renderInlineCue('hero', false)}</div>
          </div>
        </div>
      </section>

      {/* Tools Agents Actually Need - the interactive feature explorer, its own section below
          the hero pitch: kicker/heading/tabs/description on the left, live animated demo on the
          right (or below, on mobile) - one cohesive section, not split across sub-blocks. */}
      <section
        id="tools"
        ref={el => { sectionRefs.current.tools = el }}
        data-section="tools"
        className="ohp-home-scroll-section scroll-mt-20 snap-start relative z-10 flex items-center pt-4 pb-14 sm:pt-6 sm:pb-20"
      >
        <SectionSeam />
        <div className="relative max-w-7xl mx-auto px-6 w-full">
          {/* No decorative corner motifs here (unlike Hero/Story/Pricing/FAQ) - this section's
              two-column grid runs nearly the full section width with no natural clear margin, so
              every placement tried (edge-centered, corner, shrunk corner) ended up sitting on top
              of the heading, tabs, or demo instead of beside them. Left plain rather than keep
              fighting a layout that doesn't have room for it. */}
          {/* delay-300: this section is normally reached via the wheel-jump nav's ~650ms animated
              scroll (see the wheel handler above), which starts the IntersectionObserver's "seen"
              trigger almost immediately - without a delay, most of this fade plays out while the
              viewport is still visibly moving and reads as "just there" rather than an animation.
              The delay lets it start once the jump has settled, so it's an actually-visible beat -
              same fix applied to Story/Pricing/FAQ's headings below, so all four read the same. */}
          <div className={`transform transition-all duration-1000 delay-300 ${seenSections.has('tools') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {/* `contents` on the inner wrapper (not grid-template-areas row-spanning) for the
                mobile reorder - a grid item spanning two auto rows next to the header+tabs stack
                would let the (much taller) demo inflate those row tracks, pushing the tabs away
                from the header/kicker with dead space on desktop. `contents` dissolves the
                wrapper below `lg` so header/tabs become independent, orderable grid items with
                no such coupling; above `lg` it becomes a normal flex column, sized purely by its
                own content, completely independent of the demo's height. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 sm:gap-x-8 lg:gap-x-12 gap-y-5 sm:gap-y-6 items-start">
              {/* lg:-mt-6: the left column (heading + tabs + description) runs taller than the
                  demo mockup on the right, so top-aligning both left it reading bottom-heavy - a
                  slight upward nudge here balances its visual center against the shorter demo
                  instead of both starting flush at the same row edge. */}
              <div className="contents lg:flex lg:flex-col lg:gap-4 lg:-mt-6">
                <div className="relative order-1 text-center lg:text-left">
                  <h2 className="font-serif text-[clamp(1.5rem,7vw,2rem)] lg:text-6xl font-black text-[#0B0B0B] dark:text-white leading-[0.98] tracking-[-0.02em]">
                    <span className="block">Our Tools</span>
                    <span className="relative inline-block mt-1 lg:mt-2">
                      <em className="ohp-home-em font-light pr-[0.06em]">
                        How They Work
                      </em>
                      <div className="absolute -bottom-2 left-0 w-full h-1.5 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#C9A24D] to-transparent opacity-40 origin-left animate-underline-draw"></div>
                        <div className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-shimmer-mini"></div>
                      </div>
                    </span>
                  </h2>
                  <span className="mt-6 flex items-center justify-center gap-3 text-[11px] sm:text-xs font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a] lg:justify-start"><span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A24D] lg:hidden" />One Platform. Every Tool:<span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A24D]" /></span>
                </div>

                <div className="relative order-3">
                  {/* Feature tabs - a fixed 6-column grid, every card the same height so it stays
                      seamless. Most tools are square 1-col cards (icon over label). Agent Hub,
                      Showcases, and Kits sit directly above IDX as a row of three (col-span-2)
                      cards with a gold-tinted badge icon and gradient border - a deliberate middle
                      tier between the plain small tiles and IDX's full-width bar with its
                      always-on shimmer, so the grid builds small -> mid -> flagship. Active tab
                      gets a solid gold fill. */}
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2 max-w-md mx-auto lg:max-w-none lg:mx-0">
                    {FEATURE_TABS.map((tab) => {
                      const Icon = tab.icon
                      // Tools whose icon has its own dedicated assemble animation (globals.css) -
                      // the same one the nav, Studio hub, and each demo's title slide use - so the
                      // mini card draws in identically instead of falling back to the generic rule.
                      const iconAssembleClass = TOOL_ICON_ASSEMBLE[tab.key] ?? ''
                      const isActive = tab.key === activeFeature
                      const isBar = tab.key === 'idx'
                      const isHalf = tab.key === 'agenthub' || tab.key === 'showcase' || tab.key === 'kits'
                      if (isBar) {
                        // IDX - the flagship: a gold light that runs around its border, a drifting
                        // gold aurora inside midnight, a gold medallion icon and a glinting serif label.
                        return (
                          <button
                            key={tab.key}
                            onClick={() => handleToolTabClick(tab.key)}
                            className={`group col-span-6 relative overflow-hidden rounded-2xl p-[1.5px] transition-all duration-300 hover:-translate-y-0.5 ${isActive ? 'shadow-[0_18px_44px_-12px_rgba(201,162,77,0.8)]' : 'shadow-[0_12px_34px_-12px_rgba(201,162,77,0.6)] hover:shadow-[0_18px_44px_-12px_rgba(201,162,77,0.75)]'}`}
                          >
                            <span aria-hidden className="ohp-tier-spin pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] bg-[conic-gradient(from_0deg,#5a4520_0%,#C9A24D_18%,#fff3cf_25%,#C9A24D_32%,#5a4520_50%,#C9A24D_68%,#fff3cf_75%,#C9A24D_82%,#5a4520_100%)]" style={{ translate: '-50% -50%' }} />
                            <span className="relative flex items-center justify-center gap-3 overflow-hidden rounded-[14.5px] bg-[radial-gradient(120%_160%_at_50%_0%,#2a2218_0%,#111827_55%,#0b0b0b_100%)] px-4 py-3.5">
                              <span aria-hidden className="ohp-idx-aurora pointer-events-none absolute -top-8 left-1/4 h-20 w-1/2 rounded-full bg-[#C9A24D]/45 blur-2xl" />
                              <span aria-hidden className="ohp-idx-aurora-b pointer-events-none absolute -bottom-10 right-[10%] h-20 w-2/5 rounded-full bg-[#e8c97a]/25 blur-2xl" />
                              <span aria-hidden className="ohp-idx-grid pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:18px_18px]" />
                              <svg aria-hidden className="ohp-idx-skyline pointer-events-none absolute inset-x-0 bottom-0 h-7 w-full text-[#C9A24D]/35" viewBox="0 0 600 28" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1"><path d="M0 27h30V17l12-9 12 9v10h22V12h16v15h20V15l15-11 15 11v12h26V9h10V3h8v6h10v18h24V17l14-10 14 10v10h20V13h18v14h24V16l16-12 16 12v11h18V10h14v17h26V18l12-9 12 9v9h30V14h16v13h22V16l15-11 15 11v11h40" /></svg>
                              {[['12%', '30%', 0], ['31%', '70%', 1.3], ['63%', '26%', 2.4], ['84%', '64%', 0.7]].map(([l, t, d], k) => (
                                <span key={k} aria-hidden className="ohp-idx-spark pointer-events-none absolute h-1 w-1 rounded-full bg-[#f3dfa8]" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
                              ))}
                              <span aria-hidden className="ohp-tier-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                              <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-card-shimmer" />
                              <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_0_0_3px_rgba(201,162,77,0.22),0_0_18px_rgba(201,162,77,0.55)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]">
                                <Icon className="ohp-icon-draw h-4 w-4 text-[#111827]" />
                              </span>
                              <span className="ohp-idx-glint relative text-sm font-bold sm:text-base">{tab.label}</span>
                              <span className="relative"><AiChip /></span>
                              {isActive && <span aria-hidden className="absolute bottom-1.5 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />}
                            </span>
                          </button>
                        )
                      }
                      if (isHalf) {
                        // Agent Hub / Showcases / Kits - the middle tier: ivory-to-gold glass with a
                        // midnight medallion icon and a serif label. The gold light only runs around
                        // the border while one is selected, so the IDX bar below stays the flagship.
                        return (
                          <button
                            key={tab.key}
                            onClick={() => handleToolTabClick(tab.key)}
                            className={`group col-span-2 relative overflow-hidden rounded-2xl p-[1.5px] transition-all duration-300 hover:-translate-y-0.5 ${isActive ? 'scale-[1.02] shadow-[0_14px_32px_-12px_rgba(201,162,77,0.75)]' : 'bg-gradient-to-br from-[#e8c97a]/80 via-[#C9A24D]/35 to-[#C9A24D]/70 shadow-[0_8px_22px_-14px_rgba(139,115,85,0.7)] hover:shadow-[0_14px_30px_-14px_rgba(201,162,77,0.8)] dark:from-[#C9A24D]/55 dark:via-white/10 dark:to-[#C9A24D]/45'}`}
                          >
                            {isActive && <span aria-hidden className="ohp-tier-spin pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[260%] bg-[conic-gradient(from_0deg,#8b6a2b_0%,#C9A24D_20%,#fff3cf_25%,#C9A24D_30%,#8b6a2b_50%,#C9A24D_70%,#fff3cf_75%,#C9A24D_80%,#8b6a2b_100%)]" style={{ translate: '-50% -50%' }} />}
                            <span className={`relative flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14.5px] px-2 py-2.5 ${isActive ? 'bg-[radial-gradient(120%_140%_at_50%_0%,#2a2218_0%,#111827_60%,#0b0b0b_100%)]' : 'bg-gradient-to-br from-[#fffdf8] via-[#fbf6ec] to-[#f4ead7] dark:from-[#1a1814] dark:via-[#141416] dark:to-[#1d1810]'}`}>
                              <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
                              <span aria-hidden className="ohp-tier-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
                              <span className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg] ${isActive ? 'bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_0_16px_rgba(201,162,77,0.6)]' : 'bg-gradient-to-br from-[#111827] to-[#2a2218] ring-1 ring-[#C9A24D]/60 shadow-[0_6px_14px_-6px_rgba(17,24,39,0.7)]'}`}>
                                <Icon className={`ohp-icon-draw h-4 w-4 ${isActive ? 'text-[#111827]' : 'text-[#e8c97a]'}`} />
                              </span>
                              <span className={`relative text-[11px] font-bold leading-tight sm:text-[12px] ${isActive ? 'text-[#f3dfa8]' : 'text-[#111827] dark:text-white'}`}>{tab.label}</span>
                              {AI_TOOLS.has(tab.key) && <span className="absolute right-1.5 top-1.5"><AiChip /></span>}
                            </span>
                          </button>
                        )
                      }
                      // Every other tool - the base tier of the same family as the row above: ivory
                      // glass with a fine gold edge and a soft gold medallion; selected, it turns
                      // midnight with a gold medallion like the Agent Hub row (sizes unchanged).
                      return (
                        <button
                          key={tab.key}
                          onClick={() => handleToolTabClick(tab.key)}
                          className={`group relative col-span-1 min-h-[4.25rem] overflow-hidden rounded-xl p-px text-center transition-all duration-300 hover:-translate-y-0.5 ${
                            isActive
                              ? 'scale-[1.02] bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_12px_28px_-12px_rgba(201,162,77,0.75)]'
                              : 'bg-gradient-to-br from-[#C9A24D]/35 via-gray-200 to-[#C9A24D]/25 shadow-[0_4px_14px_-10px_rgba(139,115,85,0.6)] hover:from-[#C9A24D]/70 hover:to-[#C9A24D]/55 hover:shadow-[0_10px_22px_-12px_rgba(201,162,77,0.7)] dark:via-white/10'
                          }`}
                        >
                          <span className={`relative flex h-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[11px] px-1.5 py-2 text-[10px] font-bold leading-tight sm:text-[11px] ${
                            isActive
                              ? 'bg-[radial-gradient(120%_140%_at_50%_0%,#2a2218_0%,#111827_60%,#0b0b0b_100%)] text-[#f3dfa8]'
                              : 'bg-gradient-to-b from-white to-[#fbf7ef] text-[#374151] group-hover:text-[#0B0B0B] dark:from-[#1a1a1d] dark:to-[#16151a] dark:text-gray-300 dark:group-hover:text-white'
                          }`}>
                            <span aria-hidden className={`pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300 ${isActive ? 'via-[#e8c97a] opacity-100' : 'via-[#C9A24D] opacity-0 group-hover:opacity-100'}`} />
                            <span className={`relative flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg] ${
                              isActive
                                ? 'bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-[0_0_14px_rgba(201,162,77,0.55)]'
                                : 'bg-[#C9A24D]/12 text-[#8b7355] ring-1 ring-[#C9A24D]/30 group-hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]'
                            }`}>
                              <Icon className={`ohp-icon-draw ${iconAssembleClass} w-[18px] h-[18px] flex-shrink-0`} />
                            </span>
                            <span className="relative">{tab.label}</span>
                            {/* AI-powered tools wear a tiny "AI" chip on the tile itself */}
                            {AI_TOOLS.has(tab.key) && (
                              <span className={`absolute right-1 top-1 inline-flex items-center gap-px rounded-full px-1 py-px text-[7px] font-black uppercase leading-none tracking-wide ${isActive ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D] text-[#111827]'}`}>
                                <Sparkles className="h-2 w-2" />AI
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <p key={currentFeature.key} className="text-base text-[#6B7280] dark:text-gray-400 font-light mt-6 max-w-md mx-auto lg:max-w-none lg:mx-0 text-center lg:text-left animate-fadeIn">
                    {currentFeature.key === 'signin'
                      ? (() => {
                          const [before, after] = currentFeature.blurb.split('Showcase')
                          return (
                            <>
                              {before}
                              <button
                                type="button"
                                onClick={() => setActiveFeature('showcase')}
                                className="font-bold text-[#C9A24D] underline decoration-dotted underline-offset-2 hover:decoration-solid"
                              >
                                Showcase
                              </button>
                              {after}
                            </>
                          )
                        })()
                      : currentFeature.blurb}{' '}
                    <Link
                      href="/register"
                      className="group inline-flex items-center align-middle ml-1 text-[#C9A24D] font-bold text-sm whitespace-nowrap hover:underline underline-offset-2"
                    >
                      Start Free Trial
                      <svg className="w-3.5 h-3.5 ml-0.5 animate-arrow-nudge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </p>
                </div>
              </div>

              {/* Live demo - shown above the tabs on mobile (order-2, between the header's order-1
                  and the tabs' order-3) so a visitor sees a working example immediately, then
                  explores other tools via the tabs below; unchanged side-by-side placement on
                  desktop, sized purely by its own content. */}
              <div className="relative order-2" ref={toolDemoRef}>
                <div key={currentFeature.key} className="relative z-10 transition-all duration-700 animate-fadeIn transform scale-90 origin-top">
                  <ActiveDemo />
                </div>

                {/* Visual Glow Backdrop */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[130%] -z-10">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#C9A24D]/20 via-transparent to-[#111827]/10 rounded-full blur-[100px]"></div>
                </div>
              </div>
            </div>
            <div className="mt-8 lg:mt-10">{renderInlineCue('tools', false)}</div>
          </div>
        </div>
      </section>

      <section
        id="story"
        ref={el => { sectionRefs.current.story = el }}
        data-section="story"
        className="ohp-home-scroll-section scroll-mt-20 snap-start relative z-10 flex items-center justify-center py-14 sm:py-20"
      >
        <SectionSeam />
        {/* Anchored to the section's own left/right edges (not the max-w-4xl column below) so
            the decoration flanks the whole section - the bar chart is the numbers, the star is
            what they earned him. */}
        <PinRouteMotif
          visible={seenSections.has('story')}
          className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 right-4 xl:right-10 w-[260px] h-[260px] text-[#C9A24D] opacity-[0.22] dark:opacity-[0.28] -z-10"
        />
        <StarBadge
          visible={seenSections.has('story')}
          className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 left-4 xl:left-10 w-[260px] h-[260px] text-[#C9A24D] opacity-[0.2] dark:opacity-[0.26] -z-10"
        />
        <div className="relative max-w-4xl mx-auto px-6 ohp-hero-mobile-center">
          <div className={`relative text-center mb-8 transform transition-all duration-1000 delay-300 ${seenSections.has('story') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="mb-3"><span className="inline-flex items-center justify-center gap-3 text-[11px] sm:text-xs font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]"><span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A24D]" />A Real Success Story<span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A24D]" /></span></div>
            <h3 className="font-serif text-3xl sm:text-5xl font-black text-[#0B0B0B] dark:text-white mb-4 tracking-[-0.02em]">How It Helped <em className="ohp-home-em font-light pr-[0.06em]">Peter Stefanatos</em></h3>
            <p className="text-lg text-[#4b5563] dark:text-gray-300 font-normal max-w-2xl mx-auto">
              OpenHousePal enabled Peter Stefanatos to sell $15M+ in his first year in real estate - one of the highest volumes in PA - all through open houses run with the right system, the OpenHousePal System.
            </p>
          </div>
          <div aria-hidden className={`pointer-events-none absolute -inset-x-10 bottom-0 top-1/3 -z-10 rounded-full bg-[#C9A24D]/25 blur-[90px] transition-opacity duration-1000 ${seenSections.has('story') ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`relative rounded-[28px] overflow-hidden p-1.5 bg-gradient-to-br from-[#f1d58b]/70 via-white/60 to-[#C9A24D]/50 dark:from-[#C9A24D]/40 dark:via-white/5 dark:to-[#C9A24D]/30 shadow-[0_40px_80px_-30px_rgba(139,115,85,0.6)] transform transition-all duration-1000 delay-500 ${seenSections.has('story') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="relative rounded-[22px] overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative">
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
               <video
                ref={successVideoRef}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
                controls
              >
                <source src="/Comp_1_R2.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
          </div>
          {renderInlineCue('story', false)}
        </div>
      </section>

      {/* How It Works - Redesigned Vertical Timeline
          Disabled per request (not needed right now, keeping the code so it's an easy revert -
          just flip this back to `true`). */}
      {false && <div id="how-it-works" className="relative z-10 py-24 bg-white/50 dark:bg-[#151517]/50 overflow-hidden transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6">
          <div className={`text-center mb-24 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <span className="text-[#C9A24D] font-bold tracking-widest uppercase text-sm mb-4 block">Simple Workflow</span>
            <h3 className="text-4xl sm:text-5xl font-extrabold text-[#0B0B0B] dark:text-white mb-6 tracking-tight">How It Works</h3>
            <p className="text-xl text-[#6B7280] dark:text-gray-400 font-light max-w-2xl mx-auto">
              From your first open house to your own branded website - every tool works together in four automated steps.
            </p>
          </div>

          <div className="relative">
            {/* Central Line (Desktop) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A24D]/20 via-[#C9A24D]/50 to-[#C9A24D]/20 hidden md:block -translate-x-1/2"></div>
            
            {/* Mobile Line (Left) */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A24D]/20 via-[#C9A24D]/50 to-[#C9A24D]/20 md:hidden"></div>

            <div className="space-y-24">
              {[
                {
                  step: 1,
                  title: "Create Your Open House Kit",
                  description: "Enter the property address and instantly get a QR sign-in sheet, printable flyers, a custom lead form, and a full CMA report - all generated for you in seconds.",
                  icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
                  image: "/CreateOpenHouse.png"
                },
                {
                  step: 2,
                  title: "Visitors Sign In",
                  description: "Guests scan your QR code to sign in on their own phone - no app required. Every response feeds straight into your dashboard, whether it's from an open house, a custom form, or a listing you found through Discovery.",
                  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  image: "/SignIn.png"
                },
                {
                  step: 3,
                  title: "AI Showcases & Marketing",
                  description: "We instantly build a personalized property showcase for every visitor, plus on-brand flyers and social posts with Studio - all ready to send or post in one click.",
                  icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
                  image: "/showcase.png"
                },
                {
                  step: 4,
                  title: "Grow With Your Own Brand",
                  description: "Track engagement and follow up with hot leads, then grow your presence with your Agent Hub, blog, and a full IDX website - everything under your own name.",
                  icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                  image: "/feedback.png"
                }
              ].map((item, index) => (
                <div key={index} className={`relative flex flex-col md:flex-row items-center justify-between group ${index % 2 === 0 ? '' : 'md:flex-row-reverse'}`}>
                  
                  {/* Center Marker (Desktop) */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-[#151517] border-4 border-[#faf9f7] dark:border-[#0B0B0B] shadow-lg z-10 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-4 h-4 bg-[#C9A24D] rounded-full"></div>
                  </div>

                  {/* Visual Side */}
                  <div className="w-full md:w-[45%] pl-20 md:pl-0 mb-8 md:mb-0 flex justify-center">
                    <div className={`relative w-full ${item.image ? 'max-w-lg' : 'max-w-sm'} aspect-[4/3] ${item.image ? '' : 'bg-gradient-to-br from-[#111827] to-[#3a2f25] rounded-3xl shadow-2xl'} flex items-center justify-center transform transition-all duration-500 hover:scale-105 hover:rotate-1 ${item.image ? '' : 'group-hover:shadow-[#C9A24D]/30'} ${index % 2 === 0 ? 'md:mr-auto' : 'md:ml-auto'}`}>
                      {/* Decorative Circles - only show if no image */}
                      {!item.image && (
                        <>
                          <div className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                          <div className="absolute bottom-4 left-4 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
                        </>
                      )}
                      
                      {/* Big Icon or Image */}
                      {item.image ? (
                        <div className="relative w-full h-full">
                          <Image 
                            src={item.image} 
                            alt={item.title} 
                            fill
                            className="object-contain drop-shadow-xl"
                            quality={100}
                            unoptimized
                          />
                        </div>
                      ) : (
                        <svg className="w-24 h-24 text-white/90 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={item.icon} />
                        </svg>
                      )}

                      {/* Floating Badge */}
                      <div className="absolute -bottom-6 inline-flex items-center px-6 py-3 bg-white dark:bg-[#151517] rounded-xl shadow-xl border border-transparent dark:border-gray-800">
                        <span className="text-4xl font-black text-[#C9A24D] mr-3">{item.step}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step</span>
                      </div>
                    </div>
                  </div>

                  {/* Text Side */}
                  <div className={`w-full md:w-[45%] pl-20 md:pl-0 ${index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:text-left md:pl-12'}`}>
                    {/* Mobile Step Number (Left Line) */}
                    <div className="absolute left-8 top-0 -translate-x-1/2 flex md:hidden items-center justify-center w-10 h-10 rounded-full bg-[#C9A24D] text-white font-bold shadow-lg border-4 border-[#faf9f7] dark:border-[#0B0B0B] z-10">
                      {item.step}
                    </div>

                    <h4 className="text-3xl font-bold text-[#0B0B0B] dark:text-white mb-4">
                      {item.title === 'Create Your Open House Kit' ? (
                        <>
                          Create Your Open House <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D]">Kit</span>
                        </>
                      ) : item.title}
                    </h4>
                    <p className="text-lg text-[#6B7280] dark:text-gray-400 font-light leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>}

      {/* Subscription Tiers */}
      <section
        id="pricing"
        ref={el => { sectionRefs.current.pricing = el }}
        data-section="pricing"
        className="ohp-home-scroll-section scroll-mt-20 snap-start py-14 sm:py-20 relative z-10 overflow-hidden"
      >
        <SectionSeam />
        <div className="relative">
        {/* Background Accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-[#C9A24D]/3 rounded-full blur-[120px] -z-10" />
        <div className={`relative max-w-3xl mx-auto text-center mb-6 transform transition-all duration-1000 delay-300 ${seenSections.has('pricing') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Flanking "Invest in Your Growth" itself (not the section's outer edges) - right-full/
              left-full relative to this narrow heading column puts them right next to the claim,
              with no card-grid content anywhere near this height to overlap. */}
          <ShieldBadge
            visible={seenSections.has('pricing')}
            className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 right-full mr-6 xl:mr-10 w-[190px] h-[190px] text-[#C9A24D] opacity-[0.2] dark:opacity-[0.26] -z-10"
          />
          <KeyMotif
            visible={seenSections.has('pricing')}
            className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 left-full ml-6 xl:ml-10 w-[230px] h-[230px] text-[#C9A24D] opacity-[0.24] dark:opacity-[0.3] -z-10"
          />
          <div className="mb-3"><span className="inline-flex items-center justify-center gap-3 text-[11px] sm:text-xs font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]"><span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A24D]" />Simple Pricing<span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A24D]" /></span></div>
          <h3 className="font-serif text-4xl sm:text-6xl font-black text-[#0B0B0B] dark:text-white tracking-[-0.02em]">Invest in <em className="ohp-home-em font-light pr-[0.06em]">Your Growth</em></h3>
        </div>

        {/* Audience Toggle */}
        <div className="flex justify-center mb-6 px-6">
          {/* Two equal halves with one gold-on-ink pill that glides between them (plain CSS). */}
          <div className="relative grid grid-cols-2 rounded-full border border-[#C9A24D]/30 dark:border-white/10 bg-white/85 dark:bg-[#151517]/85 p-1 shadow-[0_10px_30px_-14px_rgba(139,115,85,0.55)] ">
            <span aria-hidden className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#111827] shadow-lg shadow-[#111827]/20 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] ${pricingAudience === 'no_mls' ? 'translate-x-full' : 'translate-x-0'}`} />
            {([['bright', 'Bright MLS Agent'], ['no_mls', 'Non-Bright MLS']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPricingAudience(id)}
                className={`relative px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-colors duration-300 ${pricingAudience === id ? 'text-white dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400 hover:text-[#0B0B0B] dark:hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile-only plan-select bar - below `md` the grid renders only the selected plan's
            card at a time (not a scrollable stack), so this is how a visitor switches between
            them. A small sparkle marks any plan ranked above the one currently showing, as a
            quiet "there's a better plan than this one" cue - it clears once you're on the top tier. */}
        <div className="flex justify-center mb-6 px-6 md:hidden">
          <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1 shadow-sm overflow-x-auto max-w-full">
            {pricingAudience === 'bright' ? (
              <>
                {(['BASIC', 'PREMIUM', 'IDX'] as const).map(key => {
                  const isSelected = selectedBrightPlan === key
                  const isBetter = BRIGHT_PLAN_RANK[key] > BRIGHT_PLAN_RANK[selectedBrightPlan]
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setBrightSwitchDir(BRIGHT_PLAN_RANK[key] > BRIGHT_PLAN_RANK[selectedBrightPlan] ? 'right' : 'left')
                        setSelectedBrightPlan(key)
                      }}
                      className={`relative flex items-center gap-1 overflow-hidden px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${isSelected ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400 hover:text-[#0B0B0B] dark:hover:text-white'}`}
                    >
                      {/* IDX is the flagship tier - shimmer it like its own card does (see
                          .animate-card-shimmer on IdxPricingCard) whenever it isn't the one
                          already showing, as a quiet "look at this one" nudge. */}
                      {key === 'IDX' && !isSelected && (
                        <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#C9A24D]/40 to-transparent animate-card-shimmer" />
                      )}
                      <span className="relative">{PRICING_PLANS[key].name}</span>
                      {isBetter && <Sparkles className="relative w-3 h-3 text-[#C9A24D]" />}
                    </button>
                  )
                })}
              </>
            ) : (
              <>
                {(['NO_MLS', 'PRO_NO_MLS'] as const).map(key => {
                  const isSelected = selectedNoMlsPlan === key
                  const isBetter = NO_MLS_PLAN_RANK[key] > NO_MLS_PLAN_RANK[selectedNoMlsPlan]
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setNoMlsSwitchDir(NO_MLS_PLAN_RANK[key] > NO_MLS_PLAN_RANK[selectedNoMlsPlan] ? 'right' : 'left')
                        setSelectedNoMlsPlan(key)
                      }}
                      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${isSelected ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400 hover:text-[#0B0B0B] dark:hover:text-white'}`}
                    >
                      {PRICING_PLANS[key].name}
                      {isBetter && <Sparkles className="w-3 h-3 text-[#C9A24D]" />}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Both audiences' grids stay permanently mounted (toggled with a plain `hidden`, not a
            keyed remount) - switching audience used to fully unmount/remount whichever grid was
            leaving/entering, which tore down and rebuilt every card component under it. That was
            the "refresh" flash: the heading/toggle above never actually moved, but the whole card
            area below flickered as if the page had reloaded. Toggling `hidden` instead just
            replays each grid's tab-in animation (CSS animations restart on display:none -> block)
            without ever destroying the mounted cards. */}
        <div className={`grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6 items-stretch ${pricingAudience === 'bright' ? 'animate-tab-in-left' : 'hidden'}`}>
          <div id="plan-basic" className={brightPlanCardClass('BASIC')}><BasicPricingCard isVisible={seenSections.has('pricing')} /></div>
          <div id="plan-premium" className={brightPlanCardClass('PREMIUM')}><PremiumPricingCard isVisible={seenSections.has('pricing')} /></div>
          <div id="plan-idx" className={brightPlanCardClass('IDX')}><IdxPricingCard isVisible={seenSections.has('pricing')} /></div>
        </div>
        <div className={`grid md:grid-cols-2 gap-8 max-w-4xl mx-auto px-6 items-stretch ${pricingAudience === 'no_mls' ? 'animate-tab-in-right' : 'hidden'}`}>
          <div id="plan-no_mls" className={noMlsPlanCardClass('NO_MLS')}><NoMlsPricingCard isVisible={seenSections.has('pricing')} /></div>
          <div id="plan-pro_no_mls" className={noMlsPlanCardClass('PRO_NO_MLS')}><ProNoMlsPricingCard isVisible={seenSections.has('pricing')} /></div>
        </div>

        {renderInlineCue('pricing', false)}
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        ref={el => { sectionRefs.current.faq = el }}
        data-section="faq"
        className="ohp-home-scroll-section scroll-mt-20 snap-start py-14 sm:py-20 relative z-10 overflow-hidden"
      >
        <SectionSeam />
        <div className="relative max-w-4xl mx-auto px-6">
          <div className={`relative text-center mb-16 transform transition-all duration-1000 delay-300 ${seenSections.has('faq') ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {/* Flanking the "Questions?" heading itself - right-full/left-full relative to this
                heading block puts them right next to the claim with nothing else at that height
                to overlap. Pulled in tighter still (mr-1/ml-1) so the pair reads as close together
                framing the heading, not floating off to either side. */}
            <ChatMotif
              visible={seenSections.has('faq')}
              className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 right-full mr-1 xl:mr-3 w-[190px] h-[190px] text-[#C9A24D] opacity-[0.22] dark:opacity-[0.28] -z-10"
            />
            <MailBadge
              visible={seenSections.has('faq')}
              className="ohp-motif-float hidden lg:block absolute top-1/2 -translate-y-1/2 left-full ml-1 xl:ml-3 w-[190px] h-[190px] text-[#C9A24D] opacity-[0.2] dark:opacity-[0.26] -z-10"
            />
            <div className="mb-3"><span className="inline-flex items-center justify-center gap-3 text-[11px] sm:text-xs font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]"><span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A24D]" />Common Questions<span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A24D]" /></span></div>
            <h3 className="font-serif text-4xl sm:text-6xl font-black text-[#0B0B0B] dark:text-white mb-5 tracking-[-0.02em] text-center"><em className="ohp-home-em font-light pr-[0.06em]">Questions?</em></h3>
            <p className="text-xl text-[#4b5563] dark:text-gray-300 font-normal">
              We're here to help you succeed.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What's the difference between Basic, Premium, and IDX?",
                answer: `Each plan includes everything in the one before it. Basic (${PRICING_PLANS.BASIC.priceString}/month) has Bright MLS integration, Open House Kits & Sign-In, Forms, CMA, Discovery + Manager, and Calendar & CRM sync. Premium (${PRICING_PLANS.PREMIUM.priceString}/month) adds Agent Hub, Showcases, Studio, Blogs, and Review Hub. IDX (${PRICING_PLANS.IDX.priceString}/month) adds a full IDX website on your own domain, plus Media Lab, Spotlight, and Signature. No Bright MLS? See the No-MLS question below.`
              },
              {
                question: "What is a Showcase?",
                answer: "A shared home-search hub you make for a client. They like, comment on, and request tours of homes, and new matching listings are added automatically - so they stay engaged with you for the whole search. Included on Premium and IDX."
              },
              {
                question: "What's included in my Agent Hub?",
                answer: "Your branded one-page site - socials, sales, current listings, videos, and blog posts, all in one shareable link. Included on No-MLS Premium, Premium, and IDX."
              },
              {
                question: "What does Studio do?",
                answer: "Polished flyers, mailers, and social posts that auto-fill from your listing in the style you pick - ready to download in minutes. Included on No-MLS Premium, Premium, and IDX."
              },
              {
                question: "What is Review Hub?",
                answer: "One review link for your clients. 4-5 star reviews go straight to Google and Zillow with their words already copied; anything lower comes to you privately. Your best reviews can also show on your Agent Hub. Included on No-MLS Premium, Premium, and IDX."
              },
              {
                question: "I don't have Bright MLS access - can I still use OpenHousePal?",
                answer: `Yes. No-MLS Basic (${PRICING_PLANS.NO_MLS.priceString}/month) gives you Leads, Forms, Calendar & CRM sync, and Open House Kits & Sign-In using property details you enter yourself. No-MLS Premium (${PRICING_PLANS.PRO_NO_MLS.priceString}/month) adds Agent Hub, Studio, Media Lab, Blogs, Review Hub, and Signature.`
              }
            ].map((faq, index) => (
              <FAQItem key={index} faq={faq} index={index} isVisible={seenSections.has('faq')} />
            ))}
          </div>

          <AskQuestionCard isAuthenticated={isAuthenticated} />
        </div>
      </section>

      {/* The "See ..." scroll cues are in-flow at the bottom of each section (renderInlineCue),
          so they scroll away with the page instead of floating over content. */}

      <Footer />
    </div>
  )
}

// The seam between homepage sections: a gold hairline that fades out at both ends, a soft glow
// pooled beneath it and a small diamond at its center - so one section flows into the next
// instead of a screen of empty space between them.
function SectionSeam() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      <div className="relative h-px w-[min(880px,82%)] bg-gradient-to-r from-transparent via-[#C9A24D]/55 to-transparent">
        <div className="absolute left-1/2 top-0 h-16 w-2/3 -translate-x-1/2 rounded-full bg-[#C9A24D]/10 blur-2xl" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#C9A24D]/70 bg-[#FAFAF7] dark:bg-[#0B0B0B]" />
      </div>
    </div>
  )
}
