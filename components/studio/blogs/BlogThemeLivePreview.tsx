'use client'

import { useEffect, useRef, useState } from 'react'
import { BlogThemedArticle, blogTheme } from './BlogThemes'
import type { BlogThemeId } from '@/types'

// A real, scaled-down article in a given theme - the exact component the public article uses, with
// sample paragraphs - so picking a look shows what readers will actually see instead of a swatch.

const W = 1000 // the width the article lays out at before scaling

export default function BlogThemeLivePreview({ theme, title, subtitle, category, agentName, agentPhoto, coverUrl, height = 340, className = '', children }: {
  theme: BlogThemeId; title: string; subtitle?: string | null; category?: string | null; agentName?: string; agentPhoto?: string | null; coverUrl?: string | null; height?: number; className?: string
  /** The real article body (e.g. a just-written draft) in place of the sample paragraphs. */
  children?: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const dark = blogTheme(theme).id === 'midnight'
  const ink = dark ? '#e5e7eb' : '#1f2937'
  const head = dark ? '#ffffff' : '#111827'
  return (
    <div ref={box} className={`pointer-events-none relative w-full select-none overflow-hidden ${className}`} style={{ height }} aria-hidden>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, transform: `scale(${scale})` }}>
        <BlogThemedArticle
          preview
          mode={dark ? 'dark' : 'light'}
          theme={theme}
          title={title || 'What buyers should know about the Main Line this fall'}
          subtitle={subtitle || 'A clear, local look at prices, inventory and what it takes to win the home you want.'}
          category={category || 'Buyers'}
          coverUrl={coverUrl || (typeof window !== 'undefined' ? `${window.location.origin}/home.jpg` : '/home.jpg')}
          publishedAt={new Date().toISOString()}
          readingTimeMinutes={6}
          agent={{ name: agentName || 'Your Name', title: 'Real Estate Agent', photoUrl: agentPhoto || null }}
        >
          {children || <div className="blog-article space-y-5">
            <p style={{ color: ink, fontSize: 18, lineHeight: 1.85 }}>If you are starting your search this season, the first thing to know is how quickly the best homes go - and what that means for how you prepare before you ever tour one.</p>
            <h2 className="font-serif text-3xl font-black" style={{ color: head }}>What the numbers say</h2>
            <p style={{ color: ink, fontSize: 18, lineHeight: 1.85 }}>Here is what recent sales tell us about pricing, days on market and the offers that are winning right now.</p>
          </div>}
        </BlogThemedArticle>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: `linear-gradient(to bottom, transparent, ${dark ? '#0b0f0e' : 'rgba(255,255,255,.0)'})` }} />
    </div>
  )
}
