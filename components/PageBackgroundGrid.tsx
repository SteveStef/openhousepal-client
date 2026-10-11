'use client'

// The same multi-layer background system built for the homepage (app/page.tsx) - a color mesh,
// an architectural blueprint grid, and a fine dot texture - extracted here so the other
// marketing-adjacent pages (login, register, privacy, terms) can share the same premium look
// instead of the flatter two-blur-orb treatment they had before. No vignette layer (removed
// site-wide) - it faded to a near-opaque cream/black wash in the corners, reading as a fog.
//
// Usage: place as the first child of a `relative` ancestor that also has an explicit `z-index`
// (e.g. `relative z-0`). Without that z-index, this layer's `-z-10` can escape to the page's root
// stacking context instead of staying scoped under that ancestor - a real bug found and fixed on
// the homepage itself, confirmed by sampling actual rendered pixels, not just the computed style
// (which looks correct either way). `position: absolute` here (not `fixed`) so it works inside a
// panel that isn't the full viewport, like the login/register split-screen's left column.
export default function PageBackgroundGrid({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}>
      <div className="animate-bg-blob-in absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/10 dark:bg-[#C9A24D]/5 rounded-full blur-[120px]" />
      <div className="animate-bg-blob-in delay-200 absolute top-[18%] right-[-12%] w-[820px] h-[820px] bg-[#111827]/[0.05] dark:bg-[#C9A24D]/5 rounded-full blur-[110px]" />
      <div className="animate-bg-blob-in delay-400 absolute top-[46%] left-[38%] w-[520px] h-[520px] bg-[#f0d494]/[0.14] dark:bg-[#f0d494]/[0.04] rounded-full blur-[100px]" />

      {/* Architectural blueprint grid - 1.5px lines at 0.22 opacity, not the more "reasonable"
          looking 0.03-0.09 tried first, which is invisible on screen: a 1.5px line spaced 140px
          apart covers ~1% of the area even at full opacity, so a normal-looking coefficient on
          top of that is imperceptible. Confirmed by sampling actual rendered pixels. */}
      <div className="animate-bg-fade-in delay-600 absolute inset-0" style={{
        backgroundImage: 'linear-gradient(to right, #C9A24D 1.5px, transparent 1.5px), linear-gradient(to bottom, #C9A24D 1.5px, transparent 1.5px)',
        backgroundSize: '140px 140px',
        '--ohp-bg-target-opacity': 0.22,
      } as React.CSSProperties} />
      <div className="animate-bg-fade-in delay-900 absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, #C9A24D 1.75px, transparent 0)',
        backgroundSize: '48px 48px',
        '--ohp-bg-target-opacity': 0.18,
      } as React.CSSProperties} />
    </div>
  )
}
