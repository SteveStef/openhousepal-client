'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  /** Agent's Showcase: no title block - the search bar (compareInfo) then sort + count on one row. */
  compactHeader?: boolean
  /** Agent's Showcase: the "I recommend this home" star on each card. */
  onRecommend?: (property: Property) => void
  /** Name on the "… recommends this home" banner. */
  recommendedBy?: string | null
}

export default function PropertyGrid({ properties, title = "Properties", onLike, onDislike, onPropertyClick, onScheduleTour, onCommentClick, showDetailedViewCount = false, showNewForUnviewed = false, sortControl, headerAction, alignHeaderLeftOnMobile = false, compareInfo, destination, compareProperty, tourButtonVariant, cropMlsBadge = false, highlightFirst = false, animationKey, emptyState, compactHeader = false, onRecommend, recommendedBy }: PropertyGridProps) {
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

  if (properties.length === 0) {
    return (
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
      <AnimatePresence initial={false} mode="popLayout">
      {properties.map((property, index) => (
        <motion.div
          key={property.id}
          layout="position"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          transition={{ type: 'spring', stiffness: 260, damping: 30, delay: (index % 3) * 0.06 }}
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
          />
        </motion.div>
      ))}
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
        {animationKey !== undefined ? (
          <AnimatePresence mode="wait">
            <motion.div key={animationKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              {grid}
            </motion.div>
          </AnimatePresence>
        ) : grid}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:justify-items-stretch lg:text-left ${alignHeaderLeftOnMobile ? 'justify-items-stretch text-left' : 'justify-items-center text-center'}`}>
        <div className={`flex shrink-0 flex-col gap-1 ${alignHeaderLeftOnMobile ? 'items-start' : 'items-center'} lg:items-start`}>
          <div className={`flex min-w-0 flex-wrap items-center gap-2 ${alignHeaderLeftOnMobile ? 'justify-start' : 'justify-center'} lg:justify-start`}>
            <h2 className="text-xl sm:text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">{title}</h2>
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
          <p className="text-[#6B7280] dark:text-gray-400 text-sm">Click on any property to view details or schedule tours</p>
        </div>
        <div className="min-w-0 justify-self-center">{compareInfo}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 justify-self-center lg:justify-self-end">
          {sortControl}
          <span className="inline-flex items-center overflow-hidden rounded-full border border-[#C9A24D]/25 bg-white text-xs font-black uppercase tracking-wider shadow-sm dark:border-[#C9A24D]/20 dark:bg-[#151517]">
            <span className="bg-[#C9A24D]/12 px-2.5 py-1.5 text-[#8b7355] dark:text-[#e8cf8a]">{properties.length}</span>
            <span className="px-2.5 py-1.5 text-[#6B7280] dark:text-gray-400">{properties.length === 1 ? 'property' : 'properties'}</span>
          </span>
        </div>
      </div>

      {animationKey !== undefined ? (
        // A quick, understated crossfade (no bounce/spring) that only replays when the tab
        // actually changes - not on every like/dislike, which changes `properties` but not this key.
        <AnimatePresence mode="wait">
          <motion.div
            key={animationKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {grid}
          </motion.div>
        </AnimatePresence>
      ) : grid}
    </div>
  )
}
