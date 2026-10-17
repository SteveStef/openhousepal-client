'use client'

// Photo grids in the Studio flows wait for EVERY photo before showing any (user, 10/17: "it
// shouldn't just load each one in singular - wait until they're all loaded and then show them in a
// stunning animation, with the OpenHousePal loading symbol, in all flows"). The house-logo loader
// holds the space; then the tiles rise in one after another. A slow or broken photo never holds
// the grid hostage (it opens after a few seconds regardless). Photos already seen this visit show
// straight away.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { OhpSpinner } from '@/components/brand/OhpLoader'

const settled = new Set<string>()

export function usePhotosReady(urls: string[], timeoutMs = 8000): boolean {
  const key = urls.join('\n')
  const [ready, setReady] = useState(() => urls.every(u => !u || settled.has(u)))
  useEffect(() => {
    const todo = urls.filter(u => u && !settled.has(u))
    if (!todo.length) { setReady(true); return }
    setReady(false)
    let left = todo.length
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }
    const imgs = todo.map(u => {
      const img = new Image()
      const one = () => { settled.add(u); if (--left <= 0) finish() }
      img.onload = one
      img.onerror = one
      img.decoding = 'async'
      img.src = u
      return img
    })
    const t = window.setTimeout(finish, timeoutMs)
    return () => { done = true; window.clearTimeout(t); imgs.forEach(i => { i.onload = null; i.onerror = null }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeoutMs])
  return ready
}

/** Wraps a photo grid: the loader until every photo is in, then the grid with its tiles revealed
 *  one after another (the `ohp-reveal` CSS in globals.css staggers the grid's direct children). */
export default function PhotoGridGate({ urls, children, minHeight = 180, label = 'Loading your photos' }: {
  urls: string[]
  children: ReactNode
  minHeight?: number
  label?: string
}) {
  const ready = usePhotosReady(urls)
  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C9A24D]/30 bg-[#fffaf0]/60 dark:bg-white/[0.02]" style={{ minHeight }}>
        <OhpSpinner size={40} />
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">{label}</p>
      </div>
    )
  }
  return <>{children}</>
}
