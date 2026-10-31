'use client'

import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LUXE_CSS } from '@/components/ui/LuxeHero'

// The LuxeHero's "alive" background (ivory + gold in light mode, near-black in dark, drifting gold
// aurora, faint grid, gold top-edge sweep, sparkles, cursor glow, faint icon watermark) as a
// reusable surface for in-page section headers and feature cards, so everything below a page's
// header matches it instead of each section inventing its own band.

const SPARKS: [string, string, number][] = [['14%', '28%', 0.4], ['42%', '18%', 2.1], ['63%', '62%', 3.4], ['82%', '24%', 1.2], ['30%', '78%', 4.4]]

export function LuxeSurface({ icon: Icon, className = '', children, sparks = true, grid = true, as: Tag = 'div', ...rest }: {
  icon?: LucideIcon
  className?: string
  children?: React.ReactNode
  sparks?: boolean
  grid?: boolean
  as?: 'div' | 'section' | 'header'
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  const ref = useRef<HTMLElement | null>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--lx-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--lx-y', `${e.clientY - r.top}px`)
  }
  return (
    <Tag
      ref={ref as never}
      onMouseMove={onMove}
      className={`lx-hero group/lx relative isolate overflow-hidden ${className}`}
      {...rest}
    >
      <style>{LUXE_CSS}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0 bg-[radial-gradient(110%_130%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#fffdf8_0%,#fbf6ec_55%,#f4ead7_100%)] dark:hidden" />
        <div className="absolute inset-0 hidden bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.20),transparent_55%),linear-gradient(135deg,#0b0f0e_0%,#111827_55%,#1d1810_100%)] dark:block" />
        <div className="lx-aurora-a absolute -bottom-40 -left-28 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.20),rgba(201,162,77,.09)_45%,transparent)]" />
        <div className="lx-aurora-b absolute -top-40 left-[26%] h-80 w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(243,217,160,.35),rgba(243,217,160,.15)_45%,transparent)] dark:bg-[radial-gradient(closest-side,rgba(139,106,43,.20),rgba(139,106,43,.09)_45%,transparent)]" />
        {grid && <div className="lx-grid absolute inset-0" />}
        {Icon && <Icon className="lx-mark absolute -bottom-8 right-4 h-36 w-36 text-[#C9A24D]/[0.10] dark:text-[#e8c97a]/[0.06]" strokeWidth={0.8} />}
        <div className="lx-glow absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/lx:opacity-100" />
        <div className="lx-edge absolute inset-x-0 top-0 h-px" />
        {sparks && SPARKS.map((sp, k) => <span key={k} className="lx-spark absolute" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2]}s` }} />)}
      </div>
      {children}
    </Tag>
  )
}

/** A section's header band in the luxe style: gold icon tile, kicker, serif title (<em> = shimmering gold), subtitle, right-side slot. */
export function LuxeSectionHeader({ icon: Icon, kicker, title, subtitle, aside, className = '' }: {
  icon: LucideIcon
  kicker?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <LuxeSurface icon={Icon} className={`border-b border-[#C9A24D]/25 px-5 py-5 text-[#111827] dark:border-white/[0.07] dark:text-white sm:px-6 ${className}`}>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8c97a] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-[0_10px_24px_-10px_rgba(201,162,77,.9)]">
            <span className="lx-shine absolute inset-0 overflow-hidden rounded-2xl" />
            <Icon className="relative h-5 w-5" />
          </span>
          <div className="min-w-0">
            {kicker && <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">{kicker}</p>}
            <h2 className="lx-title font-serif text-xl font-black leading-tight tracking-tight sm:text-2xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs font-semibold text-[#6b5a45] dark:text-white/55">{subtitle}</p>}
          </div>
        </div>
        {aside && <div className="relative shrink-0">{aside}</div>}
      </div>
    </LuxeSurface>
  )
}

// ---------------------------------------------------------------------------------------------
// The Tools page's feature-card language (ProductCard / ToolLinkCard on /studio), shared so other
// pages' pick-one grids (Studio's "What are you creating marketing for?") are the same cards and
// not a smaller cousin: faint grid in the top-right, a gold edge sweep on hover, drifting aurora,
// sparkles, cursor glow, and the title's last word in gold.
// ---------------------------------------------------------------------------------------------

/** Render once per page that uses `ohp-tool-grid` / `ohp-tool-edge` (the lx-* classes come from LuxeHero's LUXE_CSS). */
export const TOOL_CARD_CSS = `.ohp-tool-grid{background-image:linear-gradient(rgba(139,115,85,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(139,115,85,.07) 1px,transparent 1px);background-size:28px 28px;-webkit-mask-image:radial-gradient(80% 70% at 100% 0%,#000,transparent 70%);mask-image:radial-gradient(80% 70% at 100% 0%,#000,transparent 70%)}.dark .ohp-tool-grid{background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)}.ohp-tool-edge{background:linear-gradient(90deg,transparent,#C9A24D 30%,#f1d58b 50%,#C9A24D 70%,transparent);background-size:200% 100%;animation:ohpToolEdge 2.6s linear infinite}@keyframes ohpToolEdge{0%{background-position:100% 0}100%{background-position:-100% 0}}@media (prefers-reduced-motion:reduce){.ohp-tool-edge{animation:none}}`

/** The ivory + gold card surface (light) / near-black (dark) every Tools-style card sits on. */
export const TOOL_CARD_SURFACE = 'lx-hero group/lx group relative overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] shadow-[0_20px_44px_-32px_rgba(139,115,85,.6)] transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.75)] dark:border-white/[0.08] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)]'

/** Dark tile with the gold icon (flips to a gold tile in dark mode) - the card's icon badge. */
export const TOOL_CARD_ICON_TILE = 'relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_4px_16px_-2px_rgba(201,162,77,0.5)] dark:from-[#e8c97a] dark:to-[#C9A24D] dark:text-[#111827]'

/** Cursor-follow gold glow (LuxeHero's lx-glow reads --lx-x/--lx-y off the nearest .lx-hero). */
export function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--lx-x', `${e.clientX - r.left}px`)
  el.style.setProperty('--lx-y', `${e.clientY - r.top}px`)
}

/** The headers' "alive" layer, scaled to a card: drifting gold aurora, a gold edge sweep, a few
  * sparkles and the cursor glow. `seed` staggers each card's timing so a grid never pulses in sync. */
export function CardAlive({ seed }: { seed: number }) {
  const d = -((seed * 1.7) % 9)
  const sparks: [string, string, number][] = [[`${18 + (seed * 7) % 50}%`, '22%', 0], [`${55 + (seed * 3) % 30}%`, '64%', 1.8], [`${30 + (seed * 5) % 40}%`, '84%', 3.4]]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="lx-aurora-a absolute -bottom-40 -left-28 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.16),rgba(201,162,77,.07)_45%,transparent)]" style={{ animationDelay: `${d}s` }} />
      <div className="lx-aurora-b absolute -top-36 left-[18%] h-72 w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(243,217,160,.30),rgba(243,217,160,.13)_45%,transparent)] dark:bg-[radial-gradient(closest-side,rgba(139,106,43,.20),rgba(139,106,43,.09)_45%,transparent)]" style={{ animationDelay: `${d * 1.3}s` }} />
      <div className="lx-glow absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/lx:opacity-100" />
      <div className="lx-edge absolute inset-x-0 top-0 h-px" style={{ animationDelay: `${d}s` }} />
      {sparks.map((sp, k) => <span key={k} className="lx-spark absolute" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2] + Math.abs(d) * 0.4}s` }} />)}
    </div>
  )
}

/** Same words, last one in the gold serif italic the page headers use ("Agent *Hub*"). One-word titles stay as they are. */
export function GoldLastWord({ text }: { text: string }) {
  const i = text.lastIndexOf(' ')
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i + 1)}<em className="font-light text-[#a8803a] dark:text-[#e8c97a]">{text.slice(i + 1)}</em></>
}
