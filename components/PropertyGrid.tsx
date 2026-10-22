'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { Property } from '@/types'
import PropertyCard from './PropertyCard'
import { computeMatchScore } from '@/lib/matchScore'

interface PropertyGridProps {
  properties: Property[]
  /** What an empty grid says - the buyer's Showcase passes its own words + a "widen my search" button. */
  emptyState?: { title: string; text: string; action?: { label: string; onClick: () => void } }
  title?: string
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
  onCommentClick?: (property: Property) => void
  showDetailedViewCount?: boolean
  showNewForUnviewed?: boolean
  sortControl?: React.ReactNode
  headerAction?: React.ReactNode
  alignHeaderLeftOnMobile?: boolean
  // Rendered centered on the same row as the title/subtitle - the showcase page's "Comparing to
  // X" reference-property card, so it reads as part of the same "here's what you're looking at"
  // heading instead of a separate section competing for space above/below it.
  compareInfo?: React.ReactNode
  // Showcase search address/coordinates - when present, each card shows its straight-line distance
  // from this point plus a "Get directions" link. Absent on every other PropertyGrid usage (agent
  // dashboard, leads, etc.), where there's no single reference point to measure from.
  destination?: { address?: string | null; lat?: number | null; lng?: number | null }
  // The Showcase's "compare against" property (collection.originalProperty) - when present, each
  // card shows an "X% Match" badge scored against it (lib/matchScore.ts, same algorithm as the
  // Similar Properties picker). Omitted whenever a showcase has nothing to compare against, or the
  // agent has turned match scores off.
  compareProperty?: any
  // See PropertyCard's own doc comment - defaults to the visitor-safe "Schedule Tour" wording.
  tourButtonVariant?: 'schedule' | 'requests'
  /** See PropertyCard's cropMlsBadge (agent's own Showcase view). */
  cropMlsBadge?: boolean
  // Deep-linked from a "new match" alert (Leads tab / Daily Digest) that has a count but no
  // single property id to point at - scrolls the first card (as currently sorted) into view and
  // gives it a brief highlight ring so the agent lands on something concrete instead of a bare
  // collection page. Fires once per mount, not on every re-sort.
  highlightFirst?: boolean
  // When provided (e.g. the parent's activeTab), the grid crossfades whenever this value changes
  // instead of swapping instantly - gives switching between Matches/Liked/Disliked/Sold-Removed a
  // real transition. Keyed separately from `properties` on purpose: a like/dislike also changes
  // `properties` but shouldn't replay the animation, only an actual tab change should.
  animationKey?: string | number
  /** The tabs in their on-screen order (e.g. ['all', 'liked', 'disliked', 'sold_removed']) - the
   *  new tab's homes slide in from the side its tab sits on. */
  animationOrder?: readonly (string | number)[]
  /** Agent's Showcase: no title block - the search bar (compareInfo) then sort + count on one row. */
  compactHeader?: boolean
  /** Client's Showcase: on phones, no title / hint - just sort + count on one slim row. */
  phoneCompact?: boolean
  /** Agent's Showcase: the "I recommend this home" star on each card. */
  onRecommend?: (property: Property) => void
  /** Name on the "… recommends this home" banner. */
  recommendedBy?: string | null
  /** Showcase: off-the-market homes show the status-notice card (see PropertyCard). */
  offMarketNotice?: boolean
  /** Showcase: the notice card's "Move to Sold/Removed" (and "Move back") button. */
  onMoveToSold?: (property: Property, filed: boolean) => void
}

/** The Showcase's tabs in their on-screen order (buyer view and the agent's view). */
export const SHOWCASE_TABS = ['all', 'liked', 'disliked', 'sold_removed'] as const

export default function PropertyGrid({ properties, title = "Properties", onLike, onDislike, onPropertyClick, onScheduleTour, onCommentClick, showDetailedViewCount = false, showNewForUnviewed = false, sortControl, headerAction, alignHeaderLeftOnMobile = false, compareInfo, destination, compareProperty, tourButtonVariant, cropMlsBadge = false, highlightFirst = false, animationKey, animationOrder, emptyState, compactHeader = false, phoneCompact = false, onRecommend, recommendedBy, offMarketNotice = false, onMoveToSold }: PropertyGridProps) {
  const firstCardRef = useRef<HTMLDivElement>(null)
  const [isHighlighting, setIsHighlighting] = useState(false)
  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (!highlightFirst || hasFiredRef.current || properties.length === 0 || !firstCardRef.current) return
    hasFiredRef.current = true
    firstCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setIsHighlighting(true)
    const timer = setTimeout(() => setIsHighlighting(false), 2500)
    return () => clearTimeout(timer)
  }, [highlightFirst, properties])

  // ---- Switching tabs (user, 10/19: "not a very nice animation for each page") ----
  // The new tab's homes glide in from the side its tab sits on while the old ones slide out the
  // other way (both on screen together - never a blank moment); the first few cards settle in with
  // a tiny stagger. The list's height is held while they cross, so the page never jumps; if the new
  // tab is shorter than where you'd scrolled to, the page glides up to it instead of snapping.
  const reduce = useReducedMotion()
  const prevKeyRef = useRef(animationKey)
  const dirRef = useRef<1 | -1>(1)
  const switchedRef = useRef(false)
  if (animationKey !== prevKeyRef.current) {
    const order = (animationOrder || []) as (string | number | undefined)[]
    const from = order.indexOf(prevKeyRef.current)
    const to = order.indexOf(animationKey)
    dirRef.current = from >= 0 && to >= 0 && to < from ? -1 : 1
    switchedRef.current = true
    prevKeyRef.current = animationKey
  }
  const stageRef = useRef<HTMLDivElement>(null)
  const lastHeightRef = useRef(0)
  const lockedRef = useRef(false)
  const timersRef = useRef<number[]>([])
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    lastHeightRef.current = el.offsetHeight
    const ro = new ResizeObserver(() => { if (!lockedRef.current) lastHeightRef.current = el.offsetHeight })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const firstKeyRef = useRef(true)
  useLayoutEffect(() => {
    if (firstKeyRef.current) { firstKeyRef.current = false; return }
    const stage = stageRef.current
    if (!stage) return
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current = []
    // Hold the old height before the browser paints the new (maybe shorter) tab.
    const prevH = Math.max(lastHeightRef.current, lockedRef.current ? parseFloat(stage.style.minHeight) || 0 : 0)
    lockedRef.current = true
    stage.style.transition = ''
    stage.style.minHeight = `${prevH}px`
    const release = () => {
      stage.style.transition = reduce ? '' : 'min-height 340ms cubic-bezier(0.22, 1, 0.36, 1)'
      stage.style.minHeight = '0px'
      timersRef.current.push(window.setTimeout(() => {
        stage.style.transition = ''
        stage.style.minHeight = ''
        lockedRef.current = false
        lastHeightRef.current = stage.offsetHeight
      }, reduce ? 0 : 380))
    }
    timersRef.current.push(window.setTimeout(() => {
      // Once the old tab has gone, only the new one is left in the stage.
      const newH = (stage.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0
      if (newH < prevH) {
        const maxAfter = document.documentElement.scrollHeight - (prevH - newH) - window.innerHeight
        if (window.scrollY > maxAfter) {
          const top = stage.getBoundingClientRect().top + window.scrollY
          window.scrollTo({ top: Math.max(0, Math.min(maxAfter, top - 180)), behavior: reduce ? 'auto' : 'smooth' })
          timersRef.current.push(window.setTimeout(release, reduce ? 0 : 450))
          return
        }
      }
      release()
    }, reduce ? 180 : 300))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey])
  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), [])

  const emptyCard = (
    <div className="bg-white/50 dark:bg-[#151517]/50 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 p-12 text-center transition-colors">
      <h3 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">{emptyState?.title || 'No properties found'}</h3>
      <p className="mx-auto max-w-md text-[#6B7280] dark:text-gray-400">{emptyState?.text || 'Properties will appear here when they match customer preferences'}</p>
      {emptyState?.action && (
        <button type="button" onClick={emptyState.action.onClick} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
          {emptyState.action.label}
        </button>
      )}
    </div>
  )
  // Pages without tabs keep the plain empty card on its own (tabbed pages keep their header and
  // slide the empty card in like any other tab).
  if (properties.length === 0 && animationKey === undefined) return emptyCard

  // Cards of a tab you just switched to: the first 8 settle in with a tiny stagger, the rest are
  // simply there (no waiting to scroll). On first load cards still rise in as they scroll into view.
  const switched = switchedRef.current
  const cardMotion = (index: number) => switched
    ? (reduce || index >= 8
        ? { initial: false as const, animate: { opacity: 1, y: 0 } }
        : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const, delay: 0.05 + index * 0.035 } })
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '0px 0px -40px 0px' },
        transition: { type: 'spring' as const, stiffness: 260, damping: 30, delay: (index % 3) * 0.06 },
      }

  // grid-cols-[1fr_auto_1fr] instead of a flex row: with justify-between + mx-auto, the compare
  // card only centers within the leftover space between the title block and the sort/count block
  // - if those two are different widths (they usually are), the card lands off-center from the
  // grid below it. Two equal 1fr columns either side of the auto-width middle column guarantees
  // the middle column's midpoint is the true row midpoint, always lined up with the grid.
  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Cards rise in as they scroll into view (a short stagger across a row), and glide into their
          new spots when one leaves the list. */}
      <AnimatePresence initial={switched} mode="popLayout">
      {properties.map((property, index) => (
        <motion.div
          key={property.id}
          layout="position"
          {...cardMotion(index)}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
          ref={index === 0 ? firstCardRef : undefined}
          className={index === 0 && isHighlighting ? 'rounded-2xl ring-4 ring-[#C9A24D] ring-offset-2 dark:ring-offset-[#0B0B0B] transition-shadow duration-500' : 'rounded-2xl'}
        >
          <PropertyCard
            property={property}
            onLike={onLike}
            onDislike={onDislike}
            onPropertyClick={onPropertyClick}
            onScheduleTour={onScheduleTour}
            onCommentClick={onCommentClick}
            showDetailedViewCount={showDetailedViewCount}
            showNewForUnviewed={showNewForUnviewed}
            destination={destination}
            matchScore={compareProperty ? computeMatchScore(property, compareProperty, properties) : undefined}
            tourButtonVariant={tourButtonVariant}
            cropMlsBadge={cropMlsBadge}
            onRecommend={onRecommend}
            recommendedBy={recommendedBy}
            offMarketNotice={offMarketNotice}
            onMoveToSold={onMoveToSold}
          />
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  )

  // The tab's content: old and new tabs cross in one short directional slide + fade (ease-out),
  // with the stage holding its height meanwhile (see the switching notes above). Reduced motion: a
  // plain crossfade. Only a sideways clip, so card shadows above/below are never cut.
  const tabVariants: Variants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.18 } },
        exit: { opacity: 0, transition: { duration: 0.14 } },
      }
    : {
        enter: (d: number) => ({ opacity: 0, x: d * 40 }),
        center: { opacity: 1, x: 0, transition: { x: { duration: 0.26, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2, ease: 'easeOut' } } },
        exit: (d: number) => ({ opacity: 0, x: d * -32, transition: { x: { duration: 0.2, ease: [0.4, 0, 1, 1] }, opacity: { duration: 0.16, ease: 'easeIn' } } }),
      }
  const tabStage = animationKey === undefined ? grid : (
    <div ref={stageRef} className="relative [overflow-x:clip]">
      <AnimatePresence mode="popLayout" initial={false} custom={dirRef.current}>
        <motion.div key={animationKey} custom={dirRef.current} variants={tabVariants} initial="enter" animate="center" exit="exit">
          {properties.length === 0 ? emptyCard : grid}
        </motion.div>
      </AnimatePresence>
    </div>
  )

  const countPill = (
    <span className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-[#C9A24D]/25 bg-white text-xs font-black uppercase tracking-wider shadow-sm dark:border-[#C9A24D]/20 dark:bg-[#151517]">
      <span className="bg-[#C9A24D]/12 px-2.5 py-1.5 text-[#8b7355] dark:text-[#e8cf8a]">{properties.length}</span>
      <span className="px-2.5 py-1.5 text-[#6B7280] dark:text-gray-400">{properties.length === 1 ? 'home' : 'homes'}</span>
    </span>
  )
  if (compactHeader) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
          {compareInfo && <div className="min-w-0 flex-1">{compareInfo}</div>}
          <div className={`flex items-center gap-2 ${compareInfo ? '' : 'lg:ml-auto'}`}>{sortControl}<span className="ml-auto lg:ml-0">{countPill}</span></div>
        </div>
        {tabStage}
      </div>
    )
  }

  return (
    <div className={phoneCompact ? 'space-y-3 sm:space-y-6' : 'space-y-6'}>
      <div className={`grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:justify-items-stretch lg:text-left ${alignHeaderLeftOnMobile ? 'justify-items-stretch text-left' : phoneCompact ? 'justify-items-stretch sm:justify-items-center sm:text-center' : 'justify-items-center text-center'}`}>
        <div className={`${phoneCompact ? 'hidden sm:flex' : 'flex'} shrink-0 flex-col gap-1 ${alignHeaderLeftOnMobile ? 'items-start' : 'items-center'} lg:items-start`}>
          <div className={`flex min-w-0 flex-wrap items-center gap-2 ${alignHeaderLeftOnMobile ? 'justify-start' : 'justify-center'} lg:justify-start`}>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">{title}</h2>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
          <p className="text-[#6B7280] dark:text-gray-400 text-sm">Click on any property to view details or schedule tours</p>
        </div>
        <div className={`min-w-0 justify-self-center ${compareInfo ? "" : "hidden lg:block"}`}>{compareInfo}</div>
        <div className={phoneCompact
          ? 'flex shrink-0 items-center justify-between gap-2 sm:flex-wrap sm:justify-center sm:gap-3 sm:justify-self-center lg:justify-self-end'
          : 'flex shrink-0 flex-wrap items-center justify-center gap-3 justify-self-center lg:justify-self-end'}>
          {sortControl}
          <span className="inline-flex shrink-0 items-center overflow-hidden rounded-full border border-[#C9A24D]/25 bg-white text-xs font-black uppercase tracking-wider shadow-sm dark:border-[#C9A24D]/20 dark:bg-[#151517]">
            <span className="bg-[#C9A24D]/12 px-2.5 py-1.5 text-[#8b7355] dark:text-[#e8cf8a]">{properties.length}</span>
            <span className="px-2.5 py-1.5 text-[#6B7280] dark:text-gray-400">{phoneCompact ? (properties.length === 1 ? 'home' : 'homes') : properties.length === 1 ? 'property' : 'properties'}</span>
          </span>
        </div>
      </div>

      {tabStage}
    </div>
  )
}
