'use client'

// "● LIVE · Updated just now" - tells a buyer the homes they're looking at are being kept current
// (a Showcase or the Guest Pass's Similar Homes). Only use it where the page really does refresh
// itself: `checkedAt` is when the data was last pulled, and the "updated" time ticks from there.
import { useEffect, useState } from 'react'

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`
}

const agoShort = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

export default function LiveIndicator({ checkedAt, note, className = '', compact = false }: {
  checkedAt?: number | string | null
  // Short extra line after "Updated ..." (hidden on phones).
  note?: string
  className?: string
  // Two short lines ("● LIVE" over "43m ago") - fits beside a name and another button on a phone.
  compact?: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])
  const at = checkedAt ? new Date(checkedAt).getTime() : null

  if (compact) {
    return (
      <span className={`inline-flex flex-col justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 leading-none text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300 ${className}`}
        title={at ? `These homes update automatically from the MLS - updated ${ago(now - at)}` : 'These homes update automatically from the MLS'}>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.16em]">Live</span>
        </span>
        {at && <span className="mt-1 whitespace-nowrap text-[9px] font-bold text-emerald-700/80 dark:text-emerald-300/80">{agoShort(now - at)}</span>}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] py-1 pl-2 pr-2.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300 ${className}`}
      title="These homes update automatically from the MLS"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-black uppercase tracking-[0.18em]">Live</span>
      {at && <span className="whitespace-nowrap text-emerald-700/80 dark:text-emerald-300/80">· Updated {ago(now - at)}</span>}
      {note && <span className="hidden truncate text-emerald-700/70 dark:text-emerald-300/70 sm:inline">· {note}</span>}
    </span>
  )
}
