'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { smartBackClick } from '@/lib/navHistory'

// The small round header back arrow. Steps back to wherever the agent actually came from; only when
// this tab has no earlier in-app page (fresh tab / shared link) does it go to `fallbackHref`.
export default function BackArrow({ fallbackHref, label, className }: { fallbackHref: string; label?: string; className?: string }) {
  const router = useRouter()
  return (
    <Link
      href={fallbackHref}
      title="Back"
      aria-label={label ? `Back (or to ${label})` : 'Back'}
      onClick={smartBackClick(router)}
      className={className}
    >
      <ArrowLeft className="h-3 w-3" />
    </Link>
  )
}
