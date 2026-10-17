'use client'

// Which optional pieces does THIS design actually draw? (user, 10/17: the Words card offered an
// "Instagram button" and the You card a logo on designs that never show them.)
//
// Whether a layout draws the social button or the logo depends on the layout, size, situation and
// even the content (price shown, open house or not) - rules spread through DesignCanvas. So instead
// of copying those rules, a hidden copy of the design is drawn with a button and a logo switched
// on, and we look for them (DesignCanvas marks them with data-probe). Re-checked a moment after
// the design changes.

import { useEffect, useMemo, useRef, useState } from 'react'
import DesignCanvas, { DesignCanvasContext } from '@/components/studio/design/DesignCanvas'
import type { BrandKit, DesignBlock } from '@/types'

export type DesignDraws = { button: boolean; logo: boolean }

// A 1x1 PNG - only for the hidden copy, when the agent has no logo yet.
const PROBE_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export default function DesignFeatureProbe({ blocks, ctx, brandKit, onResult }: {
  blocks: DesignBlock[]
  ctx: DesignCanvasContext
  brandKit: BrandKit | null
  onResult: (draws: DesignDraws) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [snap, setSnap] = useState<{ blocks: DesignBlock[]; ctx: DesignCanvasContext } | null>(null)

  // Debounced: the probe follows the design, but not on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const probeBlocks = blocks.map(b => b.type === 'headline' ? { ...b, data: { ...b.data, socialButton: 'Learn More' } }
        : b.type === 'brokerage_branding' ? { ...b, hidden: false } : b)
      const mode = brandKit?.personal_logo_url ? 'personal' : brandKit?.team_logo_url ? 'team' : brandKit?.brokerage_logo_url ? 'brokerage' : 'personal'
      const kit = (brandKit?.personal_logo_url || brandKit?.team_logo_url || brandKit?.brokerage_logo_url)
        ? brandKit : ({ ...(brandKit || {}), personal_logo_url: PROBE_LOGO } as BrandKit)
      setSnap({ blocks: probeBlocks, ctx: { ...ctx, brandingMode: mode, brandKit: kit } })
    }, 350)
    return () => window.clearTimeout(t)
  }, [blocks, ctx, brandKit])

  const last = useRef('')
  useEffect(() => {
    if (!snap) return
    const id = window.requestAnimationFrame(() => {
      const el = box.current
      if (!el) return
      const draws = { button: !!el.querySelector('[data-probe="social-btn"]'), logo: !!el.querySelector('[data-probe="logo"]') }
      const key = JSON.stringify(draws)
      if (key !== last.current) { last.current = key; onResult(draws) }
    })
    return () => window.cancelAnimationFrame(id)
  }, [snap, onResult])

  const canvas = useMemo(() => snap ? <DesignCanvas blocks={snap.blocks} ctx={snap.ctx} /> : null, [snap])
  return (
    <div ref={box} aria-hidden style={{ position: 'fixed', left: -12000, top: 0, width: 320, visibility: 'hidden', pointerEvents: 'none', contain: 'layout paint' }}>
      {canvas}
    </div>
  )
}
