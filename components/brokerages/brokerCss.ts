// The For Brokerages page's motion. Same rule as the rest of the marketing pages: only opacity and
// transform move (no blur, no backdrop filters), and everything rests for prefers-reduced-motion.
// The mk-* classes mirror components/marketing/MarketingPage.tsx (MarketingMotion adds mk-hide/mk-in).
export const BROKER_CSS = String.raw`
@keyframes mkRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes mkSheen { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes mkSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes mkTwinkle { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: .95; transform: scale(1.1); } }
@keyframes brDrift { from { transform: translate3d(-18px, 10px, 0) scale(1); } to { transform: translate3d(22px, -14px, 0) scale(1.1); } }
@keyframes brRow { 0%, 4% { opacity: 0; transform: translateY(12px) scale(.98); } 9%, 80% { opacity: 1; transform: none; } 88%, 100% { opacity: 0; transform: translateY(-6px); } }
@keyframes brPulse { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.9); opacity: 0; } }
@keyframes brFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes brMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.mk-rise { animation: mkRise .85s cubic-bezier(.16,1,.3,1) both; animation-delay: var(--d, 0ms); }
.mk-gold { background: linear-gradient(100deg, #f3dfa8, #e8c97a 30%, #fff3cf 50%, #C9A24D 70%, #f3dfa8); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mkSheen 7s ease-in-out infinite; padding-right: .06em; }
.br-ink-gold { background: linear-gradient(100deg, #8b6a2b, #C9A24D 35%, #e3c27a 50%, #C9A24D 65%, #8b6a2b); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mkSheen 8s ease-in-out infinite; padding-right: .06em; }
.dark .br-ink-gold { background-image: linear-gradient(100deg, #C9A24D, #e8c97a 35%, #fff3cf 50%, #e8c97a 65%, #C9A24D); }
.mk-sweep { animation: mkSweep 5.5s ease-in-out infinite; will-change: transform; }
.mk-spark { animation: mkTwinkle 4.5s ease-in-out infinite; }
.mk-hide { opacity: 0; transform: translateY(26px); }
.mk-in { opacity: 1; transform: none; transition: opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1); transition-delay: var(--d, 0ms); }
.mk-card { transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease; }
.mk-card:hover { transform: translateY(-4px); border-color: rgba(201,162,77,.65); box-shadow: 0 24px 44px -30px rgba(139,106,43,.75); }
.mk-card:hover .mk-icon { transform: scale(1.1) rotate(-4deg); }
.mk-icon { transition: transform .3s cubic-bezier(.16,1,.3,1); }
.mk-cta { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease; }
.mk-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -14px rgba(201,162,77,.9); }
.br-orb { animation: brDrift 16s ease-in-out infinite alternate; will-change: transform; }
.br-row { opacity: 0; animation: brRow 13s cubic-bezier(.16,1,.3,1) infinite; animation-delay: var(--rd, 0s); }
.br-pulse { animation: brPulse 2s ease-out infinite; }
.br-float { animation: brFloat 7s ease-in-out infinite; }
.br-marquee { animation: brMarquee 38s linear infinite; will-change: transform; }
.br-marquee-wrap:hover .br-marquee { animation-play-state: paused; }
.br-strike { transform: scaleX(1); transform-origin: left center; transition: transform .7s cubic-bezier(.16,1,.3,1); transition-delay: var(--sd, 300ms); }
.mk-hide .br-strike { transform: scaleX(0); }
.br-faq summary::-webkit-details-marker { display: none; }
.br-faq[open] .br-faq-plus { transform: rotate(45deg); }
.br-faq-plus { transition: transform .3s cubic-bezier(.16,1,.3,1); }
@media (prefers-reduced-motion: reduce) {
  .mk-rise, .mk-gold, .br-ink-gold, .mk-sweep, .mk-spark, .br-orb, .br-pulse, .br-float, .br-marquee { animation: none; }
  .br-row { animation: none; opacity: 1; }
  .mk-card, .mk-in, .mk-icon, .mk-cta, .br-strike { transition: none; }
}
`
