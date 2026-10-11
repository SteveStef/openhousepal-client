'use client'

// The cover for an article that has no photo - designed on purpose, not an empty box. The art is
// picked from who the article is for (its category): Buyers get a key and a doorway, Sellers a
// sold sign and rooftops, Market/Insights a rising chart line, Neighborhood/Community a skyline,
// Lifestyle/Home a house in a frame, anything else the OpenHousePal rooftops. Each one drifts
// slowly and a soft light passes through it. Shared by the Agent Hub and the IDX site so the two
// never show different covers for the same article. `tone` follows the surface: 'ink' is the
// midnight card (hub Luxe, hub Classic covers), 'site' uses the IDX site's own CSS colors.

import { type CSSProperties } from 'react'

export type CoverKind = 'buyers' | 'sellers' | 'market' | 'community' | 'home' | 'general'

export function coverKindFor(category?: string | null, title?: string | null): CoverKind {
  const s = `${category || ''} ${title || ''}`.toLowerCase()
  if (/buy|first[- ]time|mortgage|offer|closing/.test(s)) return 'buyers'
  if (/sell|list|staging|pricing|downsiz/.test(s)) return 'sellers'
  if (/market|insight|update|trend|rate|data|report|forecast/.test(s)) return 'market'
  if (/neighbo|communit|town|area|local|guide|school|living in/.test(s)) return 'community'
  if (/home|lifestyle|design|renovat|garden|tips|maint/.test(s)) return 'home'
  return 'general'
}

const PALETTE: Record<CoverKind, { a: string; b: string; glow: string }> = {
  buyers: { a: '#0f2e26', b: '#1c5a49', glow: '232,201,122' },
  sellers: { a: '#2a1a12', b: '#6e4426', glow: '219,164,124' },
  market: { a: '#131a33', b: '#2a3466', glow: '201,162,77' },
  community: { a: '#1a1510', b: '#3a2d1a', glow: '232,201,122' },
  home: { a: '#0b0f0e', b: '#1d2b2a', glow: '201,162,77' },
  general: { a: '#111827', b: '#2a2218', glow: '201,162,77' },
}

const WORD: Record<CoverKind, string> = { buyers: 'For buyers', sellers: 'For sellers', market: 'Market insight', community: 'Community', home: 'At home', general: 'Journal' }

function Motif({ kind }: { kind: CoverKind }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 0.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'buyers':
      return (<svg viewBox="0 0 48 48" {...p}><path d="M8 40V18l16-11 16 11v22" /><path d="M20 40V27h8v13" /><circle cx="36" cy="14" r="4" /><path d="m33 17-9 9M27 23l2 2M25 25l2 2" /></svg>)
    case 'sellers':
      return (<svg viewBox="0 0 48 48" {...p}><path d="M4 42h40" /><path d="M10 42V22l10-8 10 8v20" /><path d="M30 42V26l6-5 6 5v16" /><rect x="14" y="8" width="18" height="9" rx="1.5" /><path d="M23 17v5" /><path d="M18 12.5h10" /></svg>)
    case 'market':
      return (<svg viewBox="0 0 48 48" {...p}><path d="M6 40h36" /><path d="M8 34l9-10 7 6 8-11 8 5" /><path d="m34 19 6 5v-7z" /><path d="M10 40V30M19 40V26M27 40V32M35 40V26M43 40V22" opacity=".45" /></svg>)
    case 'community':
      return (<svg viewBox="0 0 48 48" {...p}><path d="M2 42h44" /><path d="M5 42V26l6-5 6 5v16" /><path d="M17 42V20h10v22" /><path d="M27 42V30l7-6 7 6v12" /><path d="M20 24h4M20 29h4M20 34h4M8 31h2M36 33h2" opacity=".6" /><circle cx="37" cy="10" r="3.5" /></svg>)
    case 'home':
      return (<svg viewBox="0 0 48 48" {...p}><rect x="5" y="5" width="38" height="38" rx="3" /><path d="M12 30l12-11 12 11" /><path d="M15 28v10h18V28" /><path d="M21 38v-6h6v6" /></svg>)
    default:
      return (<svg viewBox="0 0 48 48" {...p}><path d="M2 40h44" /><path d="M6 40V28l6-5 6 5v12" /><path d="M18 40V22l6-5 6 5v18" /><path d="M30 40V30l6-5 6 5v10" /><path d="M24 23v4M12 29v3M36 31v3" opacity=".6" /></svg>)
  }
}

export default function BlogCoverArt({ category, title, tone = 'ink', className = '', showWord = true }: {
  category?: string | null
  title?: string | null
  /** 'ink' = midnight card in the OpenHousePal palette; 'site' = the IDX site's own colors. */
  tone?: 'ink' | 'site'
  className?: string
  showWord?: boolean
}) {
  const kind = coverKindFor(category, title)
  const pal = PALETTE[kind]
  const style: CSSProperties = tone === 'site'
    ? { background: `radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--site-accent, #C9A24D) 45%, transparent), transparent 55%), linear-gradient(135deg, var(--site-primary, ${pal.a}), color-mix(in srgb, var(--site-primary, ${pal.b}) 70%, #000))`, ['--bca-glow' as string]: 'var(--site-accent-light, #e8c97a)' }
    : { background: `radial-gradient(120% 120% at 100% 0%, rgba(${pal.glow},.42), transparent 55%), linear-gradient(135deg, ${pal.a}, ${pal.b})`, ['--bca-glow' as string]: `rgb(${pal.glow})` }
  return (
    <div className={`bca relative h-full w-full overflow-hidden ${className}`} style={style} aria-hidden>
      <style>{CSS}</style>
      <span className="bca-grid" />
      <span className="bca-orb" />
      <span className="bca-motif"><Motif kind={kind} /></span>
      <span className="bca-motif bca-motif-b"><Motif kind={kind} /></span>
      <span className="bca-sheen" />
      {showWord && <span className="bca-word">{WORD[kind]}</span>}
    </div>
  )
}

const CSS = `
.bca { color: var(--bca-glow); }
.bca-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 28px 28px; -webkit-mask-image: radial-gradient(80% 70% at 70% 20%, #000, transparent 75%); mask-image: radial-gradient(80% 70% at 70% 20%, #000, transparent 75%); }
.bca-orb { position: absolute; right: -18%; top: -22%; width: 70%; aspect-ratio: 1; border-radius: 999px; background: radial-gradient(circle, color-mix(in srgb, var(--bca-glow) 38%, transparent), transparent 65%); filter: blur(12px); animation: bcaOrb 9s ease-in-out infinite alternate; }
.bca-motif { position: absolute; right: 8%; top: 12%; width: 46%; max-width: 150px; opacity: .55; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--bca-glow) 45%, transparent)); animation: bcaFloat 12s ease-in-out infinite alternate; }
.bca-motif svg { width: 100%; height: auto; }
.bca-motif-b { right: auto; left: -6%; top: 48%; width: 34%; max-width: 110px; opacity: .16; animation-duration: 16s; animation-direction: alternate-reverse; }
.bca-sheen { position: absolute; top: -20%; bottom: -20%; left: 0; width: 28%; background: linear-gradient(100deg, transparent, color-mix(in srgb, var(--bca-glow) 22%, transparent), transparent); transform: translateX(-160%) skewX(-14deg); animation: bcaSheen 8s ease-in-out 1.5s infinite; }
.bca-word { position: absolute; left: 16px; top: 14px; font-size: 9px; font-weight: 900; letter-spacing: .28em; text-transform: uppercase; color: color-mix(in srgb, var(--bca-glow) 85%, #fff); opacity: .9; }
@keyframes bcaOrb { from { transform: translate(0,0) scale(1); } to { transform: translate(-10%, 12%) scale(1.15); } }
@keyframes bcaFloat { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-10px) rotate(2deg); } }
@keyframes bcaSheen { 0%, 60% { transform: translateX(-160%) skewX(-14deg); } 100% { transform: translateX(520%) skewX(-14deg); } }
@media (prefers-reduced-motion: reduce) { .bca-orb, .bca-motif, .bca-sheen { animation: none; } }
`
