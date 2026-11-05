'use client'

import { LUXE_METALS, type LuxeMetal } from '@/lib/luxeMetals'

// The Luxe forms' background (owner, 11/05: "when you click Luxe it should make the background
// animations much nicer"). A grand estate, drawn in the metal as a fine architect's line, sits along
// the bottom: it sketches itself in when the form opens, then its windows light up room by room while
// slow beams of light cross the page, the sunburst behind it turns and gold dust rises.
//
// Everything that keeps moving is opacity or transform on its own layer, so the phone's graphics chip
// does the work: no blur, and no per-window repaint. That's why the windows sit in three separate
// pictures that fade as a whole, and the stars are one dot with many shadows. Only the sketch-in
// repaints, for its first few seconds.

const CSS = String.raw`
.lx-bk { --lx-line: rgba(var(--lx-deep-rgb),.62); --lx-line-soft: rgba(var(--lx-deep-rgb),.26); --lx-glow: rgba(var(--lx-rgb),.55); --lx-ray: rgba(var(--lx-rgb),.13); --lx-beam: rgba(var(--lx-rgb),.16); --lx-dust: rgb(var(--lx-rgb)); --lx-sheen: rgba(255,255,255,.75); }
.dark .lx-bk:not(.lx-bk-day) { --lx-line: rgba(var(--lx-light-rgb),.58); --lx-line-soft: rgba(var(--lx-light-rgb),.2); --lx-glow: rgba(var(--lx-light-rgb),.92); --lx-ray: rgba(var(--lx-rgb),.1); --lx-beam: rgba(var(--lx-rgb),.13); --lx-dust: rgb(var(--lx-light-rgb)); --lx-sheen: rgba(var(--lx-light-rgb),.2); }
@keyframes lxDraw { to { stroke-dashoffset: 0; } }
@keyframes lxRise { from { opacity: 0; transform: translate3d(0,18px,0); } to { opacity: 1; transform: none; } }
@keyframes lxPush { from { transform: scale(1); } to { transform: scale(1.045); } }
@keyframes lxSpin { to { transform: translate3d(-50%,0,0) rotate(360deg); } }
@keyframes lxBeamA { 0% { transform: translate3d(-70vw,0,0) rotate(18deg); } 100% { transform: translate3d(120vw,0,0) rotate(18deg); } }
@keyframes lxBeamB { 0% { transform: translate3d(120vw,0,0) rotate(-14deg); } 100% { transform: translate3d(-70vw,0,0) rotate(-14deg); } }
@keyframes lxWin { 0%, 100% { opacity: .12; } 42%, 62% { opacity: 1; } }
@keyframes lxStar { 0%, 100% { opacity: .18; } 50% { opacity: .95; } }
@keyframes lxDust { 0% { opacity: 0; transform: translate3d(0,0,0) scale(.6); } 18% { opacity: .95; } 80% { opacity: .7; } 100% { opacity: 0; transform: translate3d(var(--dx,14px),-46vh,0) scale(1.1); } }
@keyframes lxSheen { 0% { transform: translate3d(-40vw,0,0) skewX(-18deg); } 55%, 100% { transform: translate3d(130vw,0,0) skewX(-18deg); } }
.lx-draw path, .lx-draw line, .lx-draw circle, .lx-draw rect { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lxDraw 3.4s cubic-bezier(.5,.05,.2,1) forwards; }
.lx-house { animation: lxRise 1.4s ease-out both, lxPush 34s ease-in-out 1.4s infinite alternate; transform-origin: 50% 100%; will-change: transform; }
.lx-rays { animation: lxSpin 150s linear infinite; will-change: transform; }
.lx-beam-a { animation: lxBeamA 26s linear infinite; will-change: transform; }
.lx-beam-b { animation: lxBeamB 34s linear -13s infinite; will-change: transform; }
.lx-win { opacity: .12; animation: lxWin 11s ease-in-out infinite; will-change: opacity; }
.lx-win-2 { animation-delay: 3.6s; }
.lx-win-3 { animation-delay: 7.2s; }
.lx-star { animation: lxStar 6s ease-in-out infinite; will-change: opacity; }
.lx-dust { animation: lxDust 15s ease-in-out infinite; will-change: transform, opacity; }
.lx-sheen { animation: lxSheen 15s ease-in-out 3.5s infinite; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .lx-house, .lx-rays, .lx-beam-a, .lx-beam-b, .lx-win, .lx-star, .lx-dust, .lx-sheen { animation: none; }
  .lx-draw path, .lx-draw line, .lx-draw circle, .lx-draw rect { animation: none; stroke-dashoffset: 0; }
  .lx-win { opacity: .75; } .lx-dust, .lx-sheen, .lx-beam-a, .lx-beam-b { display: none; }
}
`

/** An arched window as one path. */
const arch = (x: number, y: number, w: number, h: number) => `M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}Z`
const square = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`
const mirror = (x: number, w: number) => 1640 - x - w

// x, y, w, h of the left side; the right side is its mirror image.
const WING_TOP: [number, number, number, number][] = [[352, 176, 34, 40], [424, 176, 34, 40], [496, 176, 34, 40], [568, 176, 34, 40]]
const WING_LOW: [number, number, number, number][] = [[352, 232, 34, 40], [424, 232, 34, 40], [496, 232, 34, 40], [568, 232, 34, 40]]
const PAVILION: [number, number, number, number][] = [[172, 218, 30, 56], [226, 218, 30, 56]]
const COLUMNS = [664, 716, 768, 858, 910, 962]

/** Every window, split into three groups that take turns glowing. */
const WINDOWS = (() => {
  const all: string[][] = [[], [], []]
  const add = (d: string, n: number) => all[n % 3].push(d)
  let n = 0
  for (const [x, y, w, h] of [...WING_TOP, ...WING_LOW]) {
    add(arch(x, y, w, h), n)
    add(arch(mirror(x, w), y, w, h), n + 1)
    n += 1
  }
  for (const [x, y, w, h] of PAVILION) {
    add(square(x, y, w, h), n)
    add(square(mirror(x, w), y, w, h), n + 2)
    n += 1
  }
  // The great hall behind the columns, and the fanlight over the door
  add(arch(684, 160, 26, 46), 0); add(arch(930, 160, 26, 46), 1); add(arch(736, 160, 26, 46), 2); add(arch(878, 160, 26, 46), 0)
  add(arch(786, 200, 68, 92), 1)
  return all
})()

const DUST: [number, number, number, number][] = [
  [8, 62, 0, 16], [17, 84, -4.5, -12], [27, 70, -9, 22], [38, 90, -2, -18], [47, 76, -12, 12],
  [58, 88, -6.5, -10], [68, 72, -1, 20], [79, 86, -10, -16], [90, 66, -3.5, 14], [13, 44, -7.5, 10],
  [62, 48, -13, -14], [84, 42, -5, 18],
]

// Stars in screen units: one dot painted many times, in two groups that fade in turn.
const STARS = [[6, 9], [15, 22], [22, 6], [31, 16], [41, 8], [52, 19], [63, 5], [72, 15], [83, 9], [93, 21], [11, 33], [36, 28], [58, 31], [78, 29], [89, 38], [26, 40]]
const starShadow = (odd: number) => STARS.filter((_, i) => i % 2 === odd).map(([x, y]) => `${x}vw ${y}vh 0 0 rgba(255,255,255,.9)`).join(',')

export default function LuxeMotionBackdrop({ metal, light = false }: { metal: LuxeMetal; light?: boolean }) {
  const m = LUXE_METALS[metal]
  const vars = { ['--lx-rgb' as string]: m.rgb, ['--lx-light-rgb' as string]: m.lightRgb, ['--lx-deep-rgb' as string]: m.deepRgb } as React.CSSProperties
  // The line art fades out at its base, so nothing cuts off along the screen's edge.
  const groundFade = 'linear-gradient(to bottom, #000 calc(100% - 26px), transparent 100%)'
  const stroke = { fill: 'none', stroke: 'var(--lx-line)', strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' as const }
  const soft = { ...stroke, stroke: 'var(--lx-line-soft)' }
  const line = (d: string, delay: number, s: Record<string, unknown> = stroke) => <path key={d} d={d} pathLength={1} style={{ ...s, animationDelay: `${delay}s` }} />
  return (
    <div className={`lx-bk pointer-events-none absolute inset-0 -z-10 overflow-hidden ${light ? 'lx-bk-day' : ''}`} style={vars} aria-hidden data-testid="luxe-backdrop">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* the sunburst behind the house, turning very slowly */}
      <div className="lx-rays absolute left-1/2 top-[92%] h-[170vmax] w-[170vmax] rounded-full"
        style={{ marginTop: '-85vmax', transform: 'translate3d(-50%,0,0)', background: 'repeating-conic-gradient(from 0deg, var(--lx-ray) 0deg 2.2deg, transparent 2.2deg 15deg)', WebkitMaskImage: 'radial-gradient(closest-side, #000 18%, transparent 74%)', maskImage: 'radial-gradient(closest-side, #000 18%, transparent 74%)' }} />

      {/* two long beams of light crossing the page in opposite directions */}
      <div className="lx-beam-a absolute -top-[30%] left-0 h-[170%] w-[22vw] min-w-[120px]" style={{ background: 'linear-gradient(90deg, transparent, var(--lx-beam), transparent)' }} />
      <div className="lx-beam-b absolute -top-[30%] left-0 h-[170%] w-[34vw] min-w-[170px]" style={{ background: 'linear-gradient(90deg, transparent, var(--lx-beam), transparent)' }} />

      {/* stars, at night only */}
      {!light && (
        <div className="hidden dark:block">
          <span className="lx-star absolute left-0 top-0 h-[2px] w-[2px] rounded-full" style={{ boxShadow: starShadow(0) }} />
          <span className="lx-star absolute left-0 top-0 h-[2px] w-[2px] rounded-full" style={{ boxShadow: starShadow(1), animationDelay: '-3s' }} />
        </div>
      )}

      {/* the estate. A short screen (a phone turned sideways) has no room for it. */}
      <div className="lx-house absolute inset-x-0 bottom-0 h-[clamp(170px,31vh,340px)] overflow-hidden [@media(max-height:620px)]:hidden" style={{ WebkitMaskImage: groundFade, maskImage: groundFade }}>
        {WINDOWS.map((group, i) => (
          <svg key={i} viewBox="0 0 1640 300" preserveAspectRatio="xMidYMax slice" className={`lx-win ${i ? `lx-win-${i + 1}` : ''} absolute inset-0 h-full w-full`}>
            <path d={group.join('')} style={{ fill: 'var(--lx-glow)' }} />
          </svg>
        ))}
        <svg viewBox="0 0 1640 300" preserveAspectRatio="xMidYMax slice" className="lx-draw absolute inset-0 h-full w-full">
          {/* great arcs over the roofline */}
          {[250, 320, 396].map((r, i) => <path key={r} d={`M${820 - r} 292A${r} ${r} 0 0 1 ${820 + r} 292`} pathLength={1} style={{ ...soft, animationDelay: `${0.5 + i * 0.25}s` }} />)}
          {/* the ground */}
          {line('M0 292H1640', 0)}
          {/* the portico: pediment, roundel, entablature, steps */}
          {line('M620 118L820 44L1020 118Z', 0.5)}
          {line('M656 112L820 54L984 112', 0.8, soft)}
          {line('M640 130H1000M640 142H1000', 0.7)}
          <circle cx={820} cy={92} r={15} pathLength={1} style={{ ...stroke, animationDelay: '1s' }} />
          {line('M620 292V282H1020V292M606 292V286H1034V292', 0.9)}
          {COLUMNS.map((x, i) => line(`M${x} 142V282M${x + 14} 142V282M${x - 4} 148H${x + 18}M${x - 4} 276H${x + 18}`, 0.9 + i * 0.08))}
          {/* the front door under its fanlight */}
          {line(arch(786, 200, 68, 92), 1.3)}
          {line('M820 200V292M786 234H854', 1.5, soft)}
          {/* main house and roof, then a matching wing each side */}
          {line('M640 142V282M1000 142V282', 0.6)}
          {line('M340 152L388 96H620M1300 152L1252 96H1020', 0.5)}
          {line('M320 152H640M1000 152H1320M332 158H640M1000 158H1308', 0.7)}
          {line('M332 158V292M1308 158V292', 0.8)}
          {[...WING_TOP, ...WING_LOW].flatMap(([x, y, w, h], i) => [line(arch(x, y, w, h), 1.1 + i * 0.05), line(arch(mirror(x, w), y, w, h), 1.1 + i * 0.05)])}
          {/* chimneys */}
          {line('M430 96V70H456V96M424 70H462M1210 96V70H1184V96M1216 70H1178', 1)}
          {/* a low pavilion at each end */}
          {line('M332 204H150L176 176H332M1308 204H1490L1464 176H1308', 0.9)}
          {line('M158 204V292M1482 204V292', 1)}
          {PAVILION.flatMap(([x, y, w, h], i) => [line(square(x, y, w, h), 1.3 + i * 0.1), line(square(mirror(x, w), y, w, h), 1.3 + i * 0.1)])}
          {/* cypresses and clipped hedges in the garden */}
          {[70, 112, 1528, 1570].map((x, i) => line(`M${x} 292C${x - 16} 240 ${x - 8} 176 ${x} 150C${x + 8} 176 ${x + 16} 240 ${x} 292`, 1.1 + i * 0.1))}
          {line('M0 292C30 268 44 268 60 292M120 292C134 270 148 270 158 292M1482 292C1492 270 1506 270 1520 292M1580 292C1596 268 1610 268 1640 292', 1.4, soft)}
        </svg>
        {/* a slow glint of light passing over the house */}
        <div className="lx-sheen absolute inset-y-0 left-0 w-[16vw] min-w-[90px]" style={{ background: 'linear-gradient(90deg, transparent, var(--lx-sheen), transparent)', opacity: 0.5, WebkitMaskImage: 'linear-gradient(to top, #000 55%, transparent)', maskImage: 'linear-gradient(to top, #000 55%, transparent)' }} />
      </div>

      {/* gold dust rising */}
      {DUST.map(([x, y, delay, dx], i) => (
        <span key={i} className="lx-dust absolute h-[3px] w-[3px] rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: 'var(--lx-dust)', animationDelay: `${delay}s`, ['--dx' as string]: `${dx}px` }} />
      ))}
    </div>
  )
}

