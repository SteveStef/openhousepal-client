'use client'

// The animated medallion each premade form wears on the Forms page (custom forms keep their QR).
// One small living drawing per form - a heart rising from a house, a coin flipping, a checklist
// ticking itself off - in the app's midnight + gold. Loops gently at rest, a touch livelier when
// the card is hovered (the card is the `group`). Pure SVG + CSS, so dozens cost nothing.

const GOLD = '#e8c97a'

type Art = { label: string; draw: React.ReactNode }

const stroke = { fill: 'none', stroke: GOLD, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const House = ({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} {...stroke}>
    <path d="M5 15.5 16 6l11 9.5" />
    <path d="M8 13.5V26h16V13.5" />
    <path d="M14 26v-6h4v6" />
  </g>
)

const Clipboard = () => (
  <g {...stroke}>
    <rect x="7" y="6" width="18" height="22" rx="3" />
    <path d="M12 6V4.5h8V6" />
    {[12, 17.5, 23].map((y, i) => (
      <g key={y}>
        <path className="fta-tick" style={{ animationDelay: `${i * 0.55}s` }} d={`M10.5 ${y}l1.6 1.6 3-3.2`} strokeDasharray="8" />
        <path d={`M17.5 ${y + 0.2}h4.5`} opacity=".55" />
      </g>
    ))}
  </g>
)

const ARTS: Record<string, Art> = {
  buying: {
    label: 'A home with a heart rising from it',
    draw: (
      <>
        <House />
        <path className="fta-rise" d="M16 15.2c-1.2-1.6-3.6-.9-3.6 1 0 1.6 2.2 2.9 3.6 4 1.4-1.1 3.6-2.4 3.6-4 0-1.9-2.4-2.6-3.6-1z" fill={GOLD} stroke="none" />
      </>
    ),
  },
  selling: {
    label: 'A for-sale sign swinging on its post',
    draw: (
      <g {...stroke}>
        <path d="M8 28V5h14" />
        <path d="M13 5v3M19 5v3" />
        <g className="fta-swing" style={{ transformOrigin: '16px 8px' }}>
          <rect x="10.5" y="8" width="11" height="8.5" rx="1.6" fill="rgba(232,201,122,.14)" />
          <path d="M13.5 12.3h5" />
        </g>
        <path d="M5 28h7" />
      </g>
    ),
  },
  home_value: {
    label: 'A home with a coin flipping beside it',
    draw: (
      <>
        <House x={-2} y={0} s={0.86} />
        <g className="fta-flip" style={{ transformOrigin: '23.5px 22px' }}>
          <circle cx="23.5" cy="22" r="5.6" fill="#1b1712" stroke={GOLD} strokeWidth="1.8" />
          <path d="M25 19.8c-.5-.6-1.2-.9-2-.9-1 0-1.8.5-1.8 1.3 0 1.8 3.9 1 3.9 2.9 0 .8-.8 1.4-1.9 1.4-.9 0-1.7-.4-2.2-1M23.3 18v.9M23.3 24.5v.9" {...stroke} strokeWidth="1.3" />
        </g>
      </>
    ),
  },
  showing: {
    label: 'A calendar with a check drawing itself',
    draw: (
      <g {...stroke}>
        <rect x="5" y="7" width="22" height="20" rx="3.5" />
        <path d="M5 12.5h22M11 4.5v4M21 4.5v4" />
        <path className="fta-draw" d="M11.5 19.5l3 3 6-6.5" strokeDasharray="16" strokeWidth="2.2" />
      </g>
    ),
  },
  how_can_i_help: {
    label: 'A chat bubble with someone typing',
    draw: (
      <>
        <path d="M6 9.5A3.5 3.5 0 0 1 9.5 6h13A3.5 3.5 0 0 1 26 9.5v8a3.5 3.5 0 0 1-3.5 3.5H14l-5.5 4.5V21h0A3.5 3.5 0 0 1 6 17.5z" {...stroke} />
        {[11.5, 16, 20.5].map((cx, i) => (
          <circle key={cx} className="fta-type" style={{ animationDelay: `${i * 0.16}s` }} cx={cx} cy="13.6" r="1.6" fill={GOLD} />
        ))}
      </>
    ),
  },
  make_me_sell: {
    label: 'A price gauge with its needle sweeping',
    draw: (
      <g {...stroke}>
        <path d="M5.5 22a10.5 10.5 0 0 1 21 0" />
        <path d="M8 17.6l1.5.9M16 11.5V13M24 17.6l-1.5.9" opacity=".7" />
        <g className="fta-needle" style={{ transformOrigin: '16px 22px' }}>
          <path d="M16 22l0-8" strokeWidth="2.2" />
        </g>
        <circle cx="16" cy="22" r="1.8" fill={GOLD} stroke="none" />
        <path d="M10 27h12" opacity=".55" />
      </g>
    ),
  },
  seller_onboarding: {
    label: 'A listing checklist ticking itself off',
    draw: <Clipboard />,
  },
  buyer_onboarding: {
    label: 'A buyer checklist ticking itself off',
    draw: <Clipboard />,
  },
  showcase_request: {
    label: 'A Showcase of homes with sparkles',
    draw: (
      <>
        <g {...stroke}>
          <rect x="5" y="6" width="10" height="9" rx="2" />
          <rect x="17" y="6" width="10" height="9" rx="2" />
          <rect x="5" y="17" width="10" height="9" rx="2" />
          <rect x="17" y="17" width="10" height="9" rx="2" fill="rgba(232,201,122,.16)" />
        </g>
        {[[22, 21.5, 0], [10, 10.5, 0.7], [27.5, 5, 1.3]].map(([cx, cy, d]) => (
          <path key={`${cx}`} className="fta-twinkle" style={{ animationDelay: `${d}s`, transformOrigin: `${cx}px ${cy}px` }}
            d={`M${cx} ${cy - 2.6}l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z`} fill={GOLD} />
        ))}
      </>
    ),
  },
}

// Small corner badges so the two onboarding checklists read differently at a glance.
const CORNER: Record<string, React.ReactNode> = {
  seller_onboarding: <path d="M3 9V2.5h5M5 2.5v1.5" {...stroke} strokeWidth="1.4" />,
  buyer_onboarding: <g {...stroke} strokeWidth="1.4"><circle cx="4" cy="5" r="2" /><path d="M6 5h3.5M8 5v1.6" /></g>,
}

export function hasFormTypeArt(formType: string) {
  return formType in ARTS
}

export default function FormTypeArt({ formType, size = 56 }: { formType: string; size?: number }) {
  const art = ARTS[formType]
  if (!art) return null
  return (
    <span
      role="img"
      aria-label={art.label}
      className="fta relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] via-[#1a1712] to-[#2a2218] shadow-[0_14px_28px_-14px_rgba(17,24,39,.65)] ring-1 ring-[#C9A24D]/35 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-[-2deg]"
      style={{ width: size, height: size }}
    >
      <style>{FTA_CSS}</style>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(232,201,122,.28),transparent_60%)]" />
      <span aria-hidden className="fta-orbit pointer-events-none absolute inset-[5px] rounded-[13px] border border-dashed border-[#C9A24D]/25" />
      <span aria-hidden className="fta-shine pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <svg viewBox="0 0 32 32" className="relative" style={{ width: size * 0.62, height: size * 0.62 }}>
        {art.draw}
      </svg>
      {CORNER[formType] && (
        <svg viewBox="0 0 11 11" className="absolute bottom-1.5 right-1.5 h-3 w-3 opacity-80">{CORNER[formType]}</svg>
      )}
    </span>
  )
}

const FTA_CSS = `
.fta-rise { animation: ftaRise 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes ftaRise { 0% { transform: translateY(5px) scale(.6); opacity: 0; } 25% { opacity: 1; } 70% { transform: translateY(-5px) scale(1); opacity: 1; } 100% { transform: translateY(-8px) scale(.9); opacity: 0; } }
.fta-swing { animation: ftaSwing 2.8s ease-in-out infinite; }
@keyframes ftaSwing { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
.fta-flip { animation: ftaFlip 3s ease-in-out infinite; }
@keyframes ftaFlip { 0%, 40%, 100% { transform: scaleX(1); } 55% { transform: scaleX(.08); } 70% { transform: scaleX(1); } }
.fta-draw { animation: ftaDraw 2.8s ease-in-out infinite; }
@keyframes ftaDraw { 0% { stroke-dashoffset: 16; } 45%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 16; opacity: .2; } }
.fta-type { animation: ftaType 1.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes ftaType { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-2.4px); opacity: 1; } }
.fta-needle { animation: ftaNeedle 3.2s cubic-bezier(.45,0,.25,1) infinite; }
@keyframes ftaNeedle { 0%, 100% { transform: rotate(-62deg); } 45% { transform: rotate(48deg); } 60% { transform: rotate(38deg); } }
.fta-tick { stroke-dashoffset: 8; animation: ftaTick 3.3s ease-in-out infinite; }
@keyframes ftaTick { 0%, 8% { stroke-dashoffset: 8; } 24%, 82% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 8; } }
.fta-twinkle { animation: ftaTwinkle 2.2s ease-in-out infinite; transform-box: fill-box; }
@keyframes ftaTwinkle { 0%, 100% { transform: scale(.35) rotate(0deg); opacity: .3; } 50% { transform: scale(1.1) rotate(45deg); opacity: 1; } }
.fta-orbit { animation: ftaOrbit 18s linear infinite; }
@keyframes ftaOrbit { to { transform: rotate(360deg); } }
.fta-shine { animation: ftaShine 6s ease-in-out infinite; }
@keyframes ftaShine { 0%, 70% { transform: translateX(0) skewX(-18deg); } 100% { transform: translateX(420%) skewX(-18deg); } }
.group:hover .fta-rise, .group:hover .fta-swing, .group:hover .fta-flip, .group:hover .fta-draw, .group:hover .fta-needle, .group:hover .fta-tick, .group:hover .fta-twinkle { animation-duration: 1.6s; }
@media (prefers-reduced-motion: reduce) { .fta * { animation: none !important; } .fta-tick, .fta-draw { stroke-dashoffset: 0; } .fta-rise { opacity: 1; transform: none; } }
`
