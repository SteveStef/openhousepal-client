// The stars behind the homepage (owner, 11/06: no grid, no odd glowing, just the nice stars). Small
// gold points on the page's own color, in both looks. They only fade, on their own layers, so
// scrolling never redraws them (see the Blur lag fix).

const CSS = String.raw`
@keyframes ohpStarTwinkle { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
.ohp-stars { color: #c9a24d; opacity: .6; }
.dark .ohp-stars { color: #f1dca6; opacity: 1; }
.ohp-star { position: absolute; left: 0; top: 0; width: 1px; height: 1px; border-radius: 50%; animation: ohpStarTwinkle 8s ease-in-out infinite; will-change: opacity; }
@media (prefers-reduced-motion: reduce) { .ohp-star { animation: none; opacity: .8; } }
`

/** One group of stars as one dot with many shadows. Placed by screen size, so it fits every device. */
function starGroup(seed: number, count: number): string {
  let s = seed
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 100).toFixed(2), y = (rnd() * 100).toFixed(2), kind = rnd()
    // Most are pinpricks; a few shine a little brighter.
    out.push(`${x}vw ${y}vh 0 ${kind > 0.92 ? '.9px' : kind > 0.55 ? '.5px' : '.2px'} currentColor`)
  }
  return out.join(',')
}

const GROUPS = [
  { shadow: starGroup(11, 34), delay: '0s', extra: '' },
  { shadow: starGroup(29, 34), delay: '-2.7s', extra: '' },
  { shadow: starGroup(47, 30), delay: '-5.3s', extra: 'max-sm:hidden' },
]

/** Its parent needs `relative z-0`, so the stars stay behind this page and nothing else. */
export default function HomeStars() {
  return (
    <div aria-hidden className="ohp-stars pointer-events-none fixed inset-0 -z-10 overflow-hidden" data-testid="home-stars">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {GROUPS.map(g => <span key={g.delay} className={`ohp-star ${g.extra}`} style={{ boxShadow: g.shadow, animationDelay: g.delay }} />)}
    </div>
  )
}
