import { Plus_Jakarta_Sans } from 'next/font/google'

// The OpenHousePal logo (chosen 2026-10-03): the name in Plus Jakarta Sans 800 where the O holds a
// gold keyhole, the H is our little house (roof, round window, open gold door) and the P carries a
// gold yard sign on two hooks inside its loop. `OhpHouse` is the house H on its own - the icon.
// Ink is currentColor (so it follows text-* / dark: classes); gold comes from --ohp-gold.
// Pure markup + CSS (no hooks) so server components, loading.tsx files and the public sites can
// all use it. `animate` plays the entrance once on mount.

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['800'], display: 'swap' })

const CSS = `
.ohp-brand{--ohp-gold:#C9A24D}
:is(.dark) .ohp-brand,.ohp-brand.ohp-on-dark{--ohp-gold:#D9B460}
.ohp-wm{display:inline-flex;align-items:baseline;white-space:nowrap;line-height:1;letter-spacing:-0.03em;text-transform:none;font-weight:800}
.ohp-wm svg{height:.97em;width:auto;overflow:visible;flex:none}
.ohp-wm .ohp-l{display:inline-block}
.ohp-anim .ohp-l{opacity:0;transform:translateY(.32em);filter:blur(3px);animation:ohpRise .62s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i) * 55ms)}
.ohp-anim .ohp-roof,.ohp-anim .ohp-walls{stroke-dasharray:1;stroke-dashoffset:1;animation:ohpDraw .75s cubic-bezier(.65,0,.35,1) .25s forwards}
.ohp-anim .ohp-walls{animation-delay:.4s}
.ohp-anim .ohp-win{opacity:0;animation:ohpPop .4s cubic-bezier(.3,1.6,.5,1) .9s forwards;transform-box:fill-box;transform-origin:center}
.ohp-anim .ohp-door{transform-box:fill-box;transform-origin:100% 100%;transform:scaleX(0);animation:ohpDoor .7s cubic-bezier(.3,1.5,.5,1) 1s forwards}
.ohp-anim .ohp-key{transform-box:fill-box;transform-origin:center;opacity:0;animation:ohpPop .5s cubic-bezier(.3,1.7,.5,1) .55s forwards}
.ohp-anim .ohp-sign{transform-box:fill-box;transform-origin:50% 0;opacity:0;animation:ohpSwing 1.5s ease-out .8s forwards}
@keyframes ohpRise{to{opacity:1;transform:none;filter:none}}
@keyframes ohpDraw{to{stroke-dashoffset:0}}
@keyframes ohpPop{0%{opacity:0;transform:scale(.2)}100%{opacity:1;transform:scale(1)}}
@keyframes ohpDoor{to{transform:scaleX(1)}}
@keyframes ohpSwing{0%{opacity:0;transform:rotate(-34deg)}12%{opacity:1}30%{transform:rotate(16deg)}50%{transform:rotate(-8deg)}68%{transform:rotate(4deg)}84%{transform:rotate(-1.5deg)}100%{opacity:1;transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.ohp-anim .ohp-l,.ohp-anim .ohp-roof,.ohp-anim .ohp-walls,.ohp-anim .ohp-win,.ohp-anim .ohp-door,.ohp-anim .ohp-key,.ohp-anim .ohp-sign,.ohp-anim `

export function OhpBrandStyle() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}

const INK = 'currentColor'
const GOLD = 'var(--ohp-gold)'

function HouseShapes({ stroke = 6 }: { stroke?: number }) {
  return (
    <>
      <path className="ohp-roof" pathLength={1} d="M3.5 22.5 L20 8 L36.5 22.5" fill="none" stroke={INK} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path className="ohp-walls" pathLength={1} d="M7 20 V43 H14.5 M25.5 43 H33 V20" fill="none" stroke={INK} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle className="ohp-win" cx="20" cy="18.6" r="2.5" fill="none" stroke={INK} strokeWidth={2.4} />
      <path className="ohp-door" d="M25.5 46 V29.5 L19.5 31.8 V46 Z" fill={GOLD} />
    </>
  )
}

/** The full name. Size it with a font-size class (text-xl, text-3xl...). */
export function OhpWordmark({ className = '', animate = false, onDark = false, label = 'OpenHousePal' }: {
  className?: string
  animate?: boolean
  onDark?: boolean
  label?: string
}) {
  let i = 0
  const L = (child: React.ReactNode) => <span className="ohp-l" style={{ ['--i' as string]: i++ }}>{child}</span>
  return (
    <span role="img" aria-label={label}
      className={`ohp-brand ohp-wm ${jakarta.className} ${animate ? 'ohp-anim' : ''} ${onDark ? 'ohp-on-dark' : ''} relative ${className}`}>
      <OhpBrandStyle />
      {L(
        <svg viewBox="0 0 42 46" aria-hidden="true" style={{ marginRight: '0.01em' }}>
          <circle cx="20.5" cy="28.4" r="14.9" fill="none" stroke={INK} strokeWidth={7.2} />
          <g className="ohp-key">
            <circle cx="20.5" cy="25.6" r="3.7" fill={GOLD} />
            <path d="M18.7 27 L17.4 34.2 Q17.3 34.8 17.9 34.8 H23.1 Q23.7 34.8 23.6 34.2 L22.3 27 Z" fill={GOLD} />
          </g>
        </svg>,
      )}
      {L('p')}{L('e')}{L('n')}
      {L(<svg viewBox="0 0 40 46" aria-hidden="true" style={{ margin: '0 0.015em' }}><HouseShapes /></svg>)}
      {L('o')}{L('u')}{L('s')}{L('e')}
      {L(
        <svg viewBox="0 0 32 46" aria-hidden="true" style={{ marginLeft: '0.03em' }}>
          <g transform="translate(0 46) scale(1 1.045) translate(0 -46)">
            <path fillRule="evenodd" fill={INK} d="M2 12 H20 A11 11 0 0 1 20 34 H8 V45 Q8 46 7 46 H2 Q1 46 1 45 V13 Q1 12 2 12 Z M8 17 H20 A6 6 0 0 1 20 29 H8 Z" />
            <g className="ohp-sign">
              <rect x="11.5" y="16.6" width="1.6" height="2.2" fill={INK} />
              <rect x="19.4" y="16.6" width="1.6" height="2.2" fill={INK} />
              <rect x="10.3" y="18.6" width="12" height="8.2" rx="1.8" fill={GOLD} />
            </g>
          </g>
        </svg>,
      )}
      {L('a')}{L('l')}
    </span>
  )
}

/** The house H on its own - the OpenHousePal icon. Size it with h-* (width follows). */
export function OhpHouse({ className = '', animate = false, onDark = false, title }: {
  className?: string
  animate?: boolean
  onDark?: boolean
  title?: string
}) {
  return (
    <svg viewBox="0 3 40 44" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      className={`ohp-brand ${animate ? 'ohp-anim' : ''} ${onDark ? 'ohp-on-dark' : ''} w-auto overflow-visible ${className}`}>
      <OhpBrandStyle />
      <HouseShapes />
    </svg>
  )
}
