import { OhpWordmark } from './OhpBrand'

// The agent-side page loader: our house draws itself in the middle of the screen, the window
// glints, the gold door swings open and light spills out, gold ripples breathe behind it - then it
// fades and plays again. Pure CSS so it works in loading.tsx (server) and client guards alike.

const CSS = `
.ohp-ld{--g:#C9A24D}
:is(.dark) .ohp-ld{--g:#D9B460}
.ohp-ld-stage{position:relative;width:132px;height:132px;display:grid;place-items:center}
.ohp-ld-ring{position:absolute;inset:0;border-radius:9999px;border:1.5px solid var(--g);opacity:0;animation:ohpLdRing 3.2s cubic-bezier(.2,.6,.3,1) infinite}
.ohp-ld-ring:nth-child(2){animation-delay:1.05s}
.ohp-ld-ring:nth-child(3){animation-delay:2.1s}
.ohp-ld-halo{position:absolute;width:118px;height:118px;border-radius:9999px;background:radial-gradient(circle,color-mix(in srgb,var(--g) 26%,transparent) 0%,transparent 68%);animation:ohpLdHalo 3.2s ease-in-out infinite}
.ohp-ld-house{position:relative;height:84px;width:auto;overflow:visible;animation:ohpLdFloat 3.2s ease-in-out infinite}
.ohp-ld-house .r,.ohp-ld-house .w{stroke-dasharray:1;stroke-dashoffset:1;animation:ohpLdDraw 3.2s cubic-bezier(.65,0,.35,1) infinite}
.ohp-ld-house .w{animation-name:ohpLdDrawW}
.ohp-ld-house .win{transform-box:fill-box;transform-origin:center;animation:ohpLdWin 3.2s ease-out infinite}
.ohp-ld-house .door{transform-box:fill-box;transform-origin:100% 100%;animation:ohpLdDoor 3.2s cubic-bezier(.3,1.4,.5,1) infinite}
.ohp-ld-house .glow{transform-box:fill-box;transform-origin:50% 100%;animation:ohpLdGlow 3.2s ease-out infinite}
.ohp-ld-bar{position:relative;width:132px;height:3px;border-radius:9999px;overflow:hidden;background:color-mix(in srgb,var(--g) 16%,transparent)}
.ohp-ld-bar::after{content:"";position:absolute;inset:0;width:40%;border-radius:9999px;background:linear-gradient(90deg,transparent,var(--g),transparent);animation:ohpLdBar 1.6s ease-in-out infinite}
.ohp-ld-in{animation:ohpLdIn .5s ease-out both}
@keyframes ohpLdRing{0%{transform:scale(.55);opacity:0}15%{opacity:.5}100%{transform:scale(1.35);opacity:0}}
@keyframes ohpLdHalo{0%,30%{transform:scale(.7);opacity:.3}55%,80%{transform:scale(1.08);opacity:1}100%{transform:scale(.7);opacity:.3}}
@keyframes ohpLdFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes ohpLdDraw{0%{stroke-dashoffset:1;opacity:1}28%,84%{stroke-dashoffset:0;opacity:1}96%,100%{stroke-dashoffset:0;opacity:0}}
@keyframes ohpLdDrawW{0%,8%{stroke-dashoffset:1;opacity:1}38%,84%{stroke-dashoffset:0;opacity:1}96%,100%{stroke-dashoffset:0;opacity:0}}
@keyframes ohpLdWin{0%,34%{transform:scale(0);opacity:0}42%{transform:scale(1.5);opacity:1}48%,84%{transform:scale(1);opacity:1}96%,100%{opacity:0}}
@keyframes ohpLdDoor{0%,40%{transform:scaleX(0)}56%,84%{transform:scaleX(1);opacity:1}96%,100%{transform:scaleX(1);opacity:0}}
@keyframes ohpLdGlow{0%,46%{opacity:0;transform:scale(.4)}62%{opacity:.9;transform:scale(1.05)}84%{opacity:.55;transform:scale(1)}96%,100%{opacity:0}}
@keyframes ohpLdBar{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@keyframes ohpLdIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ohp-ld *,.ohp-ld *::after{animation-duration:0s!important;animation-iteration-count:1!important}.ohp-ld-house .r,.ohp-ld-house .w{stroke-dashoffset:0}.ohp-ld-house .door,.ohp-ld-house .win{transform:none}}
`

/** Full-screen centered loader. Agent pages: the house + the OpenHousePal wordmark under it.
 * Guest-facing pages pass `guest` - just the house (their agent's brand is the star there).
 * `label` = optional line under it. */
export default function OhpLoader({ label, fullScreen = true, className = '', guest = false }: {
  label?: string
  fullScreen?: boolean
  className?: string
  guest?: boolean
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label || 'Loading'}
      className={`ohp-ld flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]' : 'py-20'} ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ohp-ld-in flex flex-col items-center gap-6">
        <div className="ohp-ld-stage">
          <span className="ohp-ld-ring" /><span className="ohp-ld-ring" /><span className="ohp-ld-ring" />
          <span className="ohp-ld-halo" />
          <svg viewBox="0 3 40 44" className="ohp-ld-house text-[#111827] dark:text-white" aria-hidden="true">
            <defs>
              <radialGradient id="ohpLdLight" cx="50%" cy="100%" r="80%">
                <stop offset="0%" stopColor="var(--g)" stopOpacity=".75" />
                <stop offset="100%" stopColor="var(--g)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path className="glow" d="M14 46 L19.5 31.8 L25.5 29.5 L31 46 Z" fill="url(#ohpLdLight)" />
            <path className="r" pathLength={1} d="M3.5 22.5 L20 8 L36.5 22.5" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            <path className="w" pathLength={1} d="M7 20 V43 H14.5 M25.5 43 H33 V20" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            <circle className="win" cx="20" cy="18.6" r="2.4" fill="var(--g)" />
            <path className="door" d="M25.5 46 V29.5 L19.5 31.8 V46 Z" fill="var(--g)" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-3">
          {!guest && <OhpWordmark className="text-xl text-[#111827] dark:text-white" />}
          <span className="ohp-ld-bar" />
          {label && <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#d7b974]">{label}</p>}
        </div>
      </div>
    </div>
  )
}

/** The same house, small and inline - in place of a plain spinning circle (buttons, a list that's
 * loading, a panel that's fetching). Only shown while something is actually loading. */
export function OhpSpinner({ size = 20, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label || 'Loading'} className="ohp-ld inline-flex items-center gap-2">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg viewBox="0 3 40 44" className={`ohp-ld-house shrink-0 text-[#111827] dark:text-white ${className}`} style={{ animation: 'none', height: size, width: 'auto' }} aria-hidden="true">
        <path className="r" pathLength={1} d="M3.5 22.5 L20 8 L36.5 22.5" fill="none" stroke="currentColor" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
        <path className="w" pathLength={1} d="M7 20 V43 H14.5 M25.5 43 H33 V20" fill="none" stroke="currentColor" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle className="win" cx="20" cy="18.6" r="2.6" fill="var(--g)" />
        <path className="door" d="M25.5 46 V29.5 L19.5 31.8 V46 Z" fill="var(--g)" />
      </svg>
      {label && <span className="text-sm font-bold text-gray-400">{label}</span>}
    </span>
  )
}
