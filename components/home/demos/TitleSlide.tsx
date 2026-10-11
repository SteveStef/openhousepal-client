'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Sparkles } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'

// Matches .animate-title-icon's own pop-in duration (title-icon-pop, 0.65s - see globals.css) -
// the icon's own line-draw reveal used to start at the very same instant as the block's pop-in,
// racing it (explicit ask: "make the animation of the symbol happen after the blocks animation
// entrance is done"), so it now waits for the block to finish settling before it starts.
const ICON_POP_MS = 650

// The stage around the copy: a slow gold aurora, a receding gold grid floor, a spotlight cone over
// the icon, drifting gold dust, halo rings that breathe behind the icon, and corner brackets. The
// copy itself (kicker / title / body) rises in one after another. Positions are fixed (no random)
// so server + client render the same thing. Everything stops for prefers-reduced-motion.
const DUST = [
  [8, 72, 0], [16, 34, 1.4], [24, 84, 2.6], [33, 18, 0.8], [41, 66, 3.4], [52, 88, 1.9],
  [61, 26, 0.3], [69, 74, 2.2], [77, 40, 3.9], [86, 80, 1.1], [92, 22, 2.9], [12, 50, 3.1],
  [57, 56, 4.4], [81, 60, 0.6],
] as const

const CSS = `
.ts-aurora{position:absolute;inset:-35%;background:conic-gradient(from 210deg at 50% 50%,transparent 0deg,rgba(201,162,77,.20) 60deg,transparent 120deg,rgba(80,110,170,.18) 200deg,transparent 260deg,rgba(201,162,77,.14) 320deg,transparent 360deg);filter:blur(42px);animation:tsSpin 26s linear infinite}
.ts-floor{position:absolute;left:-30%;right:-30%;bottom:-8%;height:58%;transform:perspective(380px) rotateX(64deg);transform-origin:50% 100%;
  background-image:linear-gradient(rgba(201,162,77,.38) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,77,.38) 1px,transparent 1px);background-size:44px 44px;
  -webkit-mask-image:linear-gradient(to top,#000 0%,rgba(0,0,0,.65) 45%,transparent 100%);mask-image:linear-gradient(to top,#000 0%,rgba(0,0,0,.65) 45%,transparent 100%);animation:tsFloor 6s linear infinite}
.ts-cone{position:absolute;left:50%;top:-10%;width:520px;height:420px;transform:translateX(-50%);background:radial-gradient(ellipse 50% 60% at 50% 0%,rgba(241,213,139,.22),transparent 70%);animation:tsCone 5s ease-in-out infinite}
.ts-sweep{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(241,213,139,.16) 45%,rgba(255,255,255,.10) 50%,transparent 62%);transform:translateX(-120%);animation:tsSweep 1.6s cubic-bezier(.4,0,.2,1) .25s forwards}
@keyframes tsSweep{to{transform:translateX(120%)}}
.ts-vignette{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 45%,transparent 40%,rgba(5,6,10,.75) 100%)}
.ts-dust{position:absolute;width:3px;height:3px;border-radius:9999px;background:#f1d58b;box-shadow:0 0 8px 2px rgba(241,213,139,.55);opacity:0;animation:tsDust 6.5s ease-in-out infinite}
.ts-halo{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:22px;border:1.5px solid rgba(232,201,122,.55);opacity:0;animation:tsHalo 3.2s cubic-bezier(.2,.6,.3,1) .7s infinite}
.ts-halo:nth-child(2){animation-delay:1.75s}
.ts-glow{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:9999px;background:radial-gradient(circle,rgba(201,162,77,.45),transparent 65%);filter:blur(6px);animation:tsGlow 3.2s ease-in-out infinite}
.ts-orbit{position:absolute;left:50%;top:50%;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:9999px;border:1px dashed rgba(201,162,77,.28);animation:tsSpin 18s linear infinite}
.ts-orbit::before,.ts-orbit::after{content:"";position:absolute;width:6px;height:6px;border-radius:9999px;background:#e8c97a;box-shadow:0 0 10px 2px rgba(232,201,122,.7)}
.ts-orbit::before{top:-3px;left:calc(50% - 3px)}
.ts-orbit::after{bottom:14px;right:6px;width:4px;height:4px;opacity:.7}
.ts-corner{position:absolute;width:26px;height:26px;border-color:rgba(201,162,77,.55);opacity:0;animation:tsCorner .7s ease-out .15s forwards}
.ts-rise{opacity:0;animation:tsRise .75s cubic-bezier(.2,.8,.2,1) forwards}
.ts-line{height:1px;width:0;background:linear-gradient(90deg,transparent,#C9A24D);animation:tsLine .7s ease-out .55s forwards}
.ts-line.r{background:linear-gradient(90deg,#C9A24D,transparent)}
.ts-title{background:linear-gradient(100deg,#ffffff 0%,#ffffff 38%,#f6e2ad 48%,#ffffff 58%,#ffffff 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tsShine 5.5s ease-in-out 1.4s infinite}
.ts-gold{background:linear-gradient(100deg,#b88a2e 0%,#e8c97a 35%,#fff1c8 50%,#e8c97a 65%,#b88a2e 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tsShine 4.5s ease-in-out 1s infinite}
.ts-ai{animation:tsAiIn .6s cubic-bezier(.34,1.56,.64,1) .9s both,tsAiPulse 2.8s ease-in-out 1.6s infinite}
.ts-ai-shine{position:absolute;inset:0;border-radius:9999px;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.75) 50%,transparent 65%);background-size:250% 100%;animation:tsShine 3.2s ease-in-out 1.6s infinite;mix-blend-mode:overlay}
@keyframes tsSpin{to{transform:rotate(360deg)}}
@keyframes tsFloor{from{background-position:0 0}to{background-position:0 44px}}
@keyframes tsCone{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes tsDust{0%{opacity:0;transform:translateY(10px) scale(.6)}25%{opacity:.9}70%{opacity:.5}100%{opacity:0;transform:translateY(-46px) scale(1)}}
@keyframes tsHalo{0%{opacity:.75;transform:scale(1)}100%{opacity:0;transform:scale(2.15)}}
@keyframes tsGlow{0%,100%{opacity:.65;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
@keyframes tsCorner{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes tsRise{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes tsLine{to{width:44px}}
@keyframes tsShine{0%{background-position:100% 0}55%,100%{background-position:0% 0}}
@keyframes tsAiIn{from{opacity:0;transform:scale(.4) rotate(-12deg)}to{opacity:1;transform:none}}
@keyframes tsAiPulse{0%,100%{box-shadow:0 0 14px rgba(201,162,77,.55)}50%{box-shadow:0 0 26px rgba(241,213,139,.9)}}
@media (prefers-reduced-motion:reduce){.ts-aurora,.ts-floor,.ts-cone,.ts-dust,.ts-halo,.ts-glow,.ts-orbit,.ts-title,.ts-gold,.ts-ai,.ts-ai-shine{animation:none}.ts-rise,.ts-corner{animation:none;opacity:1}.ts-sweep{display:none}.ts-line{animation:none;width:44px}.ts-dust,.ts-halo{display:none}}
`

// The last word of a multi-word title gets the site's gold accent (like the page headings'
// "Homes picked *for every buyer.*"); one-word titles shimmer whole. Same words, just styled.
function StyledTitle({ title }: { title: React.ReactNode }) {
  if (typeof title !== 'string') return <span className="ts-title">{title}</span>
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return <span className="ts-gold">{title}</span>
  const last = words.pop()
  return <><span className="ts-title">{words.join(' ')}</span>{' '}<span className="ts-gold italic">{last}</span></>
}

// A short, stylish intro slide shown once before a demo's actual walkthrough begins - copy is
// drawn from the real plan-card feature descriptions (components/pricing/PricingCards.tsx) so the
// headline promise here matches what the pricing section already says this tool does. Wrapped in
// the same BrowserFrame "computer window" chrome every other demo screen uses, with the same
// segmented progress bar spanning the whole feature's sequence (totalPages/pageIndex - this slide
// is usually page 0). The parent demo owns the actual phase-advance timeout; durationMs here just
// has to match it so the bar visibly fills to match the moment the slide disappears.
// `ai` shows the same gold "AI" corner badge the matching plan card has (PricingCards.tsx AiCorner).
export default function TitleSlide({ icon: Icon, iconClassName, kicker, title, body, durationMs = 4200, totalPages, pageIndex = 0, url = 'app.openhousepal.com', nowrapBody = false, ai = false }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; iconClassName?: string; kicker: string; title: React.ReactNode; body: string; durationMs?: number; totalPages?: number; pageIndex?: number; url?: string; nowrapBody?: boolean; ai?: boolean }) {
  // Bumping this key forces the icon block below to remount, which restarts both of its
  // animations from 0% - the `animate-title-icon` pop-in/float on the block itself, and (via
  // .ohp-play below) the SAME "core stays put, details stroke-draw in" reveal every tool icon
  // already plays on hover elsewhere on the site (home tools grid, nav, Studio cards - see
  // .ohp-icon-draw in globals.css) - replayed on demand on click.
  const [replay, setReplay] = useState(0)
  const [iconReady, setIconReady] = useState(false)
  useEffect(() => {
    setIconReady(false)
    const t = setTimeout(() => setIconReady(true), ICON_POP_MS)
    return () => clearTimeout(t)
  }, [replay])
  return (
    <BrowserFrame url={url} progress={totalPages != null ? { pages: totalPages, current: pageIndex, durationMs } : undefined}>
      <div className="relative h-[420px] overflow-hidden bg-[#06070b] animate-fadeIn">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {/* stage */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b0d14] via-[#121a2b] to-[#2a2116]" />
        <div className="ts-aurora" />
        <div className="ts-floor" />
        <div className="ts-cone" />
        {DUST.map(([x, y, d], i) => (
          <span key={i} className="ts-dust" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
        ))}
        <div className="ts-vignette" />
        <div className="ts-sweep" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
        <span className="ts-corner left-4 top-4 rounded-tl-lg border-l-2 border-t-2" />
        {!ai && <span className="ts-corner right-4 top-4 rounded-tr-lg border-r-2 border-t-2" style={{ animationDelay: '.25s' }} />}
        <span className="ts-corner bottom-4 left-4 rounded-bl-lg border-b-2 border-l-2" style={{ animationDelay: '.35s' }} />
        <span className="ts-corner bottom-4 right-4 rounded-br-lg border-b-2 border-r-2" style={{ animationDelay: '.45s' }} />

        {ai && (
          <span className="ts-ai absolute right-4 top-4 z-10 inline-flex items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D] px-3 py-1.5 text-[11px] font-black uppercase leading-none tracking-wider text-[#111827] ring-1 ring-white/40">
            <span className="ts-ai-shine" />
            <Sparkles className="relative h-3.5 w-3.5" strokeWidth={2.5} /><span className="relative">AI</span>
          </span>
        )}

        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center sm:px-10">
          {/* icon - the tile itself and its animations are the site-wide icon theme, untouched */}
          <div className="relative mb-7 grid h-16 w-16 place-items-center">
            <span className="ts-glow" />
            <span className="ts-orbit" />
            <span className="pointer-events-none absolute inset-0"><span className="ts-halo" /><span className="ts-halo" /></span>
            <div
              key={replay}
              onClick={() => setReplay(n => n + 1)}
              role="button"
              aria-label="Replay icon animation"
              // group + ohp-play: the same hover-triggered class pair every other icon on the site
              // scopes its .ohp-icon-draw reveal to, except ohp-play only gets added once iconReady
              // flips (right as the block's own pop-in finishes), since there's no pointer on an
              // auto-playing slide. Until then, ohp-icon-pending holds the icon's "detail" strokes
              // in their undrawn state so it enters unfinished.
              className={`group ${iconReady ? 'ohp-play' : 'ohp-icon-pending'} animate-title-icon relative w-16 h-16 rounded-2xl bg-[#C9A24D] flex items-center justify-center shadow-lg shadow-[#C9A24D]/40 cursor-pointer`}
            >
              <Icon className={`w-8 h-8 text-[#111827] ohp-icon-draw ${iconClassName || ''}`} strokeWidth={2.5} />
            </div>
          </div>

          <div className="ts-rise mb-3 flex items-center gap-3" style={{ animationDelay: '.35s' }}>
            <span className="ts-line" />
            <span className="rounded-full border border-[#C9A24D]/45 bg-[#C9A24D]/10 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.24em] text-[#e8c97a] shadow-[0_0_18px_-4px_rgba(201,162,77,.6)] ">{kicker}</span>
            <span className="ts-line r" />
          </div>
          <h4 className="ts-rise mb-4 max-w-[480px] text-balance font-serif text-[2rem] font-black leading-[1.08] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-[2.6rem]" style={{ animationDelay: '.55s' }}>
            <StyledTitle title={title} />
          </h4>
          <p className={`ts-rise font-medium leading-relaxed text-white/75 ${nowrapBody ? 'text-xs sm:text-[15px] sm:whitespace-nowrap' : 'max-w-[440px] whitespace-pre-line text-sm sm:text-[15px]'}`} style={{ animationDelay: '.8s' }}>{body}</p>
        </div>
      </div>
    </BrowserFrame>
  )
}
