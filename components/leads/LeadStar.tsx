'use client'

import { Star } from 'lucide-react'
import { isStarred, useStarredPeople, type Who } from '@/lib/starredPeople'

/** The small gold star beside a starred person's name, on every screen that shows them. */
export default function LeadStar({ className = '', ...who }: Who & { className?: string }) {
  const starred = useStarredPeople()
  if (!isStarred(starred, who)) return null
  return <Star data-testid="lead-star-mark" aria-label="Starred" className={`inline h-3.5 w-3.5 shrink-0 text-[#C9A24D] ${className}`} fill="currentColor" />
}
