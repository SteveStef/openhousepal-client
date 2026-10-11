'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// Caps a dash panel's list to a scrollable ~3-items-tall window (more revealed by scrolling,
// same as any other view - this isn't a mobile-only affordance) with a "view all" link as the
// last item, so it's always reachable at the bottom of the scroll instead of only up top in the
// panel header. maxHeightClass is per-caller since row heights differ (a lead card vs. an
// activity row vs. a thumbnail row).
export default function ScrollableSection({ maxHeightClass, viewHref, viewLabel = 'View all', children }: {
  maxHeightClass: string
  viewHref: string
  viewLabel?: string
  children: React.ReactNode
}) {
  // px/py on the scroll container is not cosmetic: it clips its own overflow, so an edge row that
  // lifts on hover (hover:-translate-y-*) or carries an outside ring / glow (the red "needs
  // attention" lead card) would get its top/side shaved off against the clip edge. The padding +
  // scroll-py gives that lift and glow room to render inside the scroll box.
  return (
    <div className={`min-w-0 space-y-2 overflow-y-auto px-1.5 py-2 scroll-py-2 ${maxHeightClass}`}>
      {children}
      <Link
        href={viewHref}
        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 py-2 text-xs font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 dark:border-gray-700 dark:text-[#d7b974] dark:hover:border-[#C9A24D]"
      >
        {viewLabel} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
