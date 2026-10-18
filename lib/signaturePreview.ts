import { LUXE_METALS, metalVars, type LuxeMetal } from '@/lib/luxeMetals'
import { salesWords } from '@/lib/salesWording'
// The exact "Gallery" signature design and CSS the user built and downloaded from v0
// (animated-email-signature-design/app/page.tsx + app/globals.css), reused verbatim here for the
// Studio builder's Live Preview. This is NOT the email-install HTML (see
// email_signature_service.py on the backend) - it can't be, because Gmail/Outlook/Apple Mail
// don't run CSS @keyframes, flexbox, or web fonts inside an installed signature. This preview
// runs inside an iframe in the app itself, which is a real browser with full CSS support, so it
// can show the actual animated design pixel-for-pixel instead of an email-safe approximation.
// The install HTML is a separate, necessarily simpler translation of the same content - see the
// "Install Signature" modal.

// The photo/Save-Contact column's own reserved width - 136 -> 124 (explicit ask: "the email
// version photo size and save contact size is perfect... bring the photo dimensions over to the
// site version as its a little too wide"). The photo itself (.portrait-clip) was always 114px,
// matching the email version's own _PHOTO_CANVAS_W exactly - only this outer column's reserved
// width was ever off, at 136px (~11px more than the 114px photo + its own 11px right margin
// actually need), pushing the name/contact column further right than the email version's
// equivalent 124px-wide <td> does for the same content.
const PORTRAIT_COLUMN_W = 124

// Verbatim from the downloaded project's app/globals.css (only the component's own rules - the
// shadcn/Tailwind design-token boilerplate at the top of that file isn't used by this component,
// which uses literal Tailwind arbitrary values and inline styles instead of CSS variables).
const GALLERY_CSS = `

/* Featured listing (site version) - a real property card: photo with a slow Ken Burns drift and a
   status chip, kicker with a gold rule, address + town, specs, and the price with a "View home"
   cue. A gold light runs around the border every few seconds. */
@keyframes feat-ken { 0% { transform: scale(1.04) translateX(0); } 100% { transform: scale(1.14) translateX(-3%); } }
@keyframes feat-sweep { 0%, 55% { transform: translateX(-120%) skewX(-14deg); opacity: 0; } 62% { opacity: .9; } 80%, 100% { transform: translateX(420%) skewX(-14deg); opacity: 0; } }
@keyframes feat-edge { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
.feat-card { position: relative; display: flex; align-items: stretch; gap: 0; width: 100%; min-height: 104px; overflow: hidden; border-radius: 14px; box-sizing: border-box; isolation: isolate; animation: gallery-listing-enter .8s .55s cubic-bezier(.22,.61,.36,1) both; box-shadow: 0 10px 26px -14px rgba(0,0,0,.35); transition: transform .35s cubic-bezier(.22,.61,.36,1), box-shadow .35s; }
.feat-card:hover { transform: translateY(-2px); box-shadow: 0 18px 34px -16px rgba(0,0,0,.45); }
.feat-card::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(90deg, var(--feat-accent) 0%, color-mix(in srgb, var(--feat-accent) 30%, transparent) 30%, var(--feat-accent) 50%, color-mix(in srgb, var(--feat-accent) 30%, transparent) 70%, var(--feat-accent) 100%); background-size: 200% 100%; animation: feat-edge 6s linear infinite; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; z-index: 3; }
.feat-photo { position: relative; flex: 0 0 150px; overflow: hidden; }
.feat-photo-img { position: absolute; inset: 0; background-size: cover; background-position: center; animation: feat-ken 14s ease-in-out infinite alternate; }
.feat-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 60%, rgba(0,0,0,.18)); }
.feat-status { position: absolute; top: 7px; left: 7px; z-index: 2; padding: 3px 8px; border-radius: 999px; font-size: 7.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3); white-space: nowrap; }
.feat-body { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 10px 14px; }
.feat-kicker { display: flex; align-items: center; gap: 6px; font-size: 7.5px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
.feat-kicker i { display: inline-block; width: 14px; height: 1px; background: currentColor; }
.feat-addr { font-size: 15px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feat-loc { font-size: 10px; opacity: .62; }
.feat-specs { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 4px; }
.feat-specs span { font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 999px; background: color-mix(in srgb, var(--feat-accent) 14%, transparent); white-space: nowrap; }
.feat-side { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px 10px 12px; border-left: 1px solid color-mix(in srgb, var(--feat-accent) 35%, transparent); }
.feat-price { font-size: 18px; font-weight: 800; letter-spacing: -.03em; white-space: nowrap; }
.feat-cta { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; transition: gap .3s; }
.feat-card:hover .feat-cta { gap: 7px; }
.feat-shine { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; border-radius: inherit; }
.feat-shine::after { content: ""; position: absolute; top: 0; bottom: 0; width: 22%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: feat-sweep 7s ease-in-out 1.6s infinite; }

/* OpenHousePal Luxe (site version) - the Spotlight header's language: ivory (or midnight) with
   soft gold light, a faint grid, a gold edge that sweeps along the top, a few twinkling sparks,
   and the name set in serif with a slow gold shimmer through it. */
@keyframes lx-sig-edge { 0% { background-position: 150% 0; } 100% { background-position: -50% 0; } }
@keyframes lx-sig-drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(60px, -20px) scale(1.15); } }
@keyframes lx-sig-spark { 0%, 100% { opacity: 0; transform: scale(.4); } 45% { opacity: .9; transform: scale(1); } 60% { opacity: 0; transform: scale(.6); } }
@keyframes lx-sig-gold { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
.lx-sig-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; border-radius: inherit; }
.lx-sig-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(139,115,85,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(139,115,85,.09) 1px, transparent 1px); background-size: 28px 28px; -webkit-mask-image: radial-gradient(70% 90% at 85% 10%, #000, transparent 75%); mask-image: radial-gradient(70% 90% at 85% 10%, #000, transparent 75%); }
.lx-sig-aurora { position: absolute; left: -40px; bottom: -70px; width: 220px; height: 220px; border-radius: 999px; background: rgba(var(--m-rgb),.22); filter: blur(40px); animation: lx-sig-drift 14s ease-in-out infinite alternate; }
.lx-sig-edge { position: absolute; left: 0; right: 0; top: 0; height: 1.5px; background: linear-gradient(90deg, transparent 20%, var(--m-light) 50%, transparent 80%); background-size: 200% 100%; animation: lx-sig-edge 7s ease-in-out infinite; }
.lx-sig-spark { position: absolute; width: 3px; height: 3px; border-radius: 999px; background: var(--m-light); box-shadow: 0 0 8px 2px rgba(var(--m-light-rgb),.65); opacity: 0; animation: lx-sig-spark 5.5s ease-in-out infinite; }
.signature-gallery.lx .gallery-inner { position: relative; z-index: 1; }
.signature-gallery.lx .lx-name { font-family: Georgia, "Times New Roman", serif; font-weight: 700; letter-spacing: -.02em; }
.signature-gallery.lx .lx-name em, .signature-gallery.lx .lx-name .lx-first { font-style: italic; font-weight: 400; background-image: linear-gradient(100deg, #111827 0%, #111827 40%, var(--m-base) 47%, var(--m-light) 50%, var(--m-base) 53%, #111827 60%, #111827 100%); background-size: 320% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; padding-right: .06em; animation: lx-sig-name-shimmer 9s ease-in-out infinite; }
/* The name reads as the card's own colour (white on dark, ink on light) with a slow band of the
   metal passing through it - both names move together. */
@keyframes lx-sig-name-shimmer { 0%, 12% { background-position: 100% 0; } 60%, 100% { background-position: 0% 0; } }
.signature-gallery.lx.lx-dark .lx-name em, .signature-gallery.lx.lx-dark .lx-name .lx-first { background-image: linear-gradient(100deg, #ffffff 0%, #ffffff 40%, var(--m-light) 46%, var(--m-pale) 50%, var(--m-light) 54%, #ffffff 60%, #ffffff 100%); }
/* Luxe, taken further: the card rises in out of a blur, a gold light leak crosses it once, a gold
   light runs around its border, a slow beam passes now and then, sparks drift up, a warm gold
   spotlight follows the pointer, the name rises in, and the featured home, buttons and stats all
   pick up gold (gradient price, shining "View home", serif numbers). */
@property --lx-sig-a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes lx-sig-spin { to { --lx-sig-a: 360deg; } }
@keyframes lx-sig-in { from { opacity: 0; transform: translateY(16px) scale(.985); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes lx-sig-leak { 0% { transform: translateX(-110%); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateX(110%); opacity: 0; } }
@keyframes lx-sig-beam { 0% { transform: rotate(14deg) translateX(-200%); } 40%, 100% { transform: rotate(14deg) translateX(520%); } }
@keyframes lx-sig-rise { 0% { opacity: 0; transform: translateY(0) scale(.5); } 25% { opacity: .95; transform: translateY(-10px) scale(1); } 100% { opacity: 0; transform: translateY(-46px) scale(.6); } }
@keyframes lx-sig-name { from { opacity: 0; transform: translateY(10px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes lx-sig-shine { 0%, 60% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.signature-gallery.lx { position: relative; animation: lx-sig-in 1.1s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery.lx::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; background: conic-gradient(from var(--lx-sig-a), rgba(var(--m-rgb),.18), var(--m-light) 12%, var(--m-pale) 16%, var(--m-base) 20%, rgba(var(--m-rgb),.18) 34%, rgba(var(--m-rgb),.18) 62%, var(--m-light) 76%, var(--m-pale) 80%, var(--m-base) 84%, rgba(var(--m-rgb),.18)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: lx-sig-spin 7s linear infinite; pointer-events: none; z-index: 4; }
.lx-sig-leak { position: absolute; inset: 0; background: linear-gradient(105deg, transparent 30%, rgba(var(--m-light-rgb),.32) 46%, rgba(var(--m-pale-rgb),.38) 50%, rgba(var(--m-light-rgb),.28) 54%, transparent 70%); mix-blend-mode: screen; transform: translateX(-110%); animation: lx-sig-leak 2.6s .5s cubic-bezier(.45,0,.2,1) forwards; }
.lx-sig-beam { position: absolute; top: -40%; left: 0; width: 30%; height: 180%; background: linear-gradient(100deg, transparent, rgba(var(--m-pale-rgb),.22), transparent); transform: rotate(14deg) translateX(-200%); animation: lx-sig-beam 11s ease-in-out 3.5s infinite; }
.lx-dark .lx-sig-beam { background: linear-gradient(100deg, transparent, rgba(var(--m-light-rgb),.08), transparent); }
.lx-sig-aurora-b { left: auto; right: -60px; top: -90px; bottom: auto; width: 260px; height: 200px; background: rgba(var(--m-light-rgb),.35); animation-duration: 18s; animation-direction: alternate-reverse; }
.lx-dark .lx-sig-aurora-b { background: rgba(var(--m-deep-rgb),.25); }
.lx-sig-spot { position: absolute; inset: 0; background: radial-gradient(240px circle at var(--mx, 72%) var(--my, 18%), rgba(var(--m-light-rgb),.20), transparent 60%); }
.lx-sig-spark.lx-sig-rise { animation-name: lx-sig-rise; animation-duration: 6.5s; }
.signature-gallery.lx .lx-name { animation: lx-sig-name .9s .25s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery.lx .gallery-action { position: relative; overflow: hidden; }
.signature-gallery.lx .gallery-action::after, .signature-gallery.lx .feat-cta::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.5) 50%, transparent 65%); transform: translateX(-100%); animation: lx-sig-shine 4.2s ease-in-out infinite; pointer-events: none; }
.signature-gallery.lx .gallery-action:nth-child(2)::after { animation-delay: .6s; }
.signature-gallery.lx .gallery-action:nth-child(3)::after { animation-delay: 1.2s; }
.signature-gallery.lx .feat-addr { font-family: Georgia, "Times New Roman", serif; font-size: 16px; }
.signature-gallery.lx .feat-price { font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 700; letter-spacing: -.01em; background-image: linear-gradient(100deg, #1f2937 0%, #1f2937 38%, var(--m-base) 48%, var(--m-light) 50%, var(--m-base) 52%, #1f2937 62%, #1f2937 100%); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: lx-sig-glint 5.5s ease-in-out infinite; }
.signature-gallery.lx.lx-dark .feat-price { background-image: linear-gradient(100deg, #fff 0%, #fff 38%, var(--m-light) 48%, var(--m-pale) 50%, var(--m-light) 52%, #fff 62%, #fff 100%); }
@keyframes lx-sig-glint { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
.signature-gallery.lx .feat-cta { position: relative; overflow: hidden; background: linear-gradient(135deg, var(--m-mid), var(--m-base) 45%, var(--m-light)) !important; color: #111827 !important; box-shadow: 0 6px 14px -6px rgba(var(--m-rgb),.9); }
.signature-gallery.lx .stat-item p:first-child { font-family: Georgia, "Times New Roman", serif; color: #fff !important; }
.lx-sig-motif { position: absolute; color: rgba(var(--m-rgb),.15); animation: lx-sig-float 12s ease-in-out infinite alternate; }
.lx-dark .lx-sig-motif { color: rgba(var(--m-light-rgb),.10); }
.lx-sig-motif-b { animation-duration: 15s; animation-direction: alternate-reverse; }
.lx-sig-skyline { position: absolute; right: 124px; top: 98px; width: 230px; height: 34px; color: rgba(var(--m-rgb),.20); }
.lx-dark .lx-sig-skyline { color: rgba(var(--m-light-rgb),.12); }
.lx-sig-skyline path { stroke-dasharray: 1600; stroke-dashoffset: 1600; animation: lx-sig-draw 4.5s .6s ease-out forwards; }
@keyframes lx-sig-float { from { transform: translateY(0) rotate(-6deg); } to { transform: translateY(-12px) rotate(2deg); } }
@keyframes lx-sig-draw { to { stroke-dashoffset: 0; } }
.signature-gallery.lx .portrait-vcard, .signature-gallery.lx .feat-card, .signature-gallery.lx .gallery-rail .stat-item, .signature-gallery.lx .lx-name, .signature-gallery.lx .sale-card { transition: transform .3s cubic-bezier(.22,.61,.36,1), box-shadow .3s ease, filter .3s ease; }
.signature-gallery.lx .portrait-vcard:hover { transform: translateY(-3px) scale(1.03); }
.signature-gallery.lx .feat-card:hover { transform: translateY(-3px); box-shadow: 0 18px 34px -16px rgba(var(--m-deep-rgb),.55); }
.signature-gallery.lx .gallery-rail .stat-item:hover { transform: translateY(-3px) scale(1.05); }
.signature-gallery.lx .lx-name:hover { transform: translateX(2px); }
.signature-gallery.lx .sale-card:hover { transform: translateY(-3px) scale(1.02); }
/* Luxe Recent Sales: a metal edge that runs around the card, three big sale photos (still - no
   drifting), serif prices with a metal glint, a light that sweeps across, and each sale lifting
   with a metal ring on hover. */
.signature-gallery.lx .mini-bubble { border: 0 !important; isolation: isolate; padding: 8px 9px 8px; box-shadow: 0 16px 32px -20px rgba(var(--m-deep-rgb),.75); }
.signature-gallery.lx .mini-bubble::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.2px; background: linear-gradient(90deg, var(--m-base) 0%, rgba(var(--m-rgb),.25) 30%, var(--m-pale) 50%, rgba(var(--m-rgb),.25) 70%, var(--m-base) 100%); background-size: 200% 100%; animation: feat-edge 6s linear infinite; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; z-index: 3; }
.signature-gallery.lx .mini-bubble::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 24%; z-index: 2; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(var(--m-pale-rgb),.35), transparent); animation: lx-mini-sweep 7.5s ease-in-out 1.2s infinite; }
@keyframes lx-mini-sweep { 0%, 55% { transform: translateX(-120%) skewX(-14deg); opacity: 0; } 62% { opacity: 1; } 82%, 100% { transform: translateX(480%) skewX(-14deg); opacity: 0; } }
.signature-gallery.lx .mini-slide { min-height: 92px; border-radius: 9px; box-shadow: 0 8px 18px -10px rgba(0,0,0,.55), inset 0 0 0 1px rgba(var(--m-light-rgb),.35); transition: transform .35s cubic-bezier(.22,.61,.36,1), box-shadow .35s; }
.signature-gallery.lx .mini-slide:hover { transform: translateY(-2px); box-shadow: 0 12px 22px -10px rgba(0,0,0,.6), inset 0 0 0 1.5px var(--m-light); }
.signature-gallery.lx .mini-tag { letter-spacing: .16em; background: linear-gradient(160deg, #b23a3a 0%, #9b2c2c 48%, #7d2222 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.16), 0 6px 14px -6px rgba(110,20,20,.85); }
.signature-gallery.lx .mini-slide .mini-scrim { padding: 12px 8px 5px; background: linear-gradient(180deg, transparent, rgba(11,15,14,.88)); }
.signature-gallery.lx .mini-slide .mini-city { font-size: 8px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--m-pale); }
.signature-gallery.lx .mini-slide .mini-price { font-family: Georgia, "Times New Roman", serif; font-size: 15px; font-weight: 700; letter-spacing: -.01em; background-image: linear-gradient(100deg, #fff 0%, #fff 38%, var(--m-light) 48%, var(--m-pale) 50%, var(--m-light) 52%, #fff 62%, #fff 100%); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: lx-sig-glint 5.5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .signature-gallery.lx .mini-bubble::before, .signature-gallery.lx .mini-bubble::after, .signature-gallery.lx .mini-slide .mini-price { animation: none; } }
@media (prefers-reduced-motion: reduce) { .lx-sig-motif, .lx-sig-skyline path { animation: none; stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .feat-photo-img, .feat-shine::after, .feat-card::before, .lx-sig-edge, .lx-sig-aurora, .lx-sig-spark, .lx-sig-leak, .lx-sig-beam, .signature-gallery.lx, .signature-gallery.lx::before, .signature-gallery.lx .lx-name, .signature-gallery.lx .lx-name em, .signature-gallery.lx .gallery-action::after, .signature-gallery.lx .feat-cta::after, .signature-gallery.lx .feat-price { animation: none; } .lx-sig-leak { display: none; } }
@keyframes signature-enter { 0% { opacity: 0; transform: translateY(14px) scale(.985); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes stats-rise { 0% { opacity: 0; transform: translateY(5px); } 100% { opacity: 1; transform: translateY(0); } }
/* background-position (not transform: translateX) - a translated band only ever travels in ONE
   axis and, sized to a slice of the card, never actually reaches the far corners. Animating the
   position of a gradient drawn at 300% of the card's own size instead sweeps a true diagonal
   streak from past the top-left corner to past the bottom-right one, covering the whole sheet
   regardless of its actual width/height. */
@keyframes signature-sweep { 0%, 62% { opacity: 0; background-position: -60% -60%; } 74% { opacity: .8; } 88%, 100% { opacity: 0; background-position: 160% 160%; } }
@keyframes gallery-listing-pulse { 0%, 100% { opacity: .35; } 50% { opacity: .9; } }
@keyframes gallery-social-arrive { 0% { opacity: 0; transform: translateX(-8px) scale(.8); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
@keyframes gallery-rail-enter { 0% { opacity: 0; transform: translateX(18px); } 100% { opacity: 1; transform: translateX(0); } }
@keyframes gallery-detail-enter { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes gallery-listing-enter { 0% { opacity: 0; transform: translateY(12px) scale(.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes gallery-stats-rise { 0% { opacity: 0; transform: translateY(26px) scale(.94); } 70% { opacity: 1; transform: translateY(-3px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes gallery-social-swoop { 0% { opacity: 0; transform: translateX(-34px) rotate(-10deg); } 70% { opacity: 1; transform: translateX(4px) rotate(2deg); } 100% { opacity: 1; transform: translateX(0) rotate(0); } }
@keyframes gallery-copy-reveal { 0% { opacity: 0; transform: translateX(18px); clip-path: inset(0 100% 0 0); } 100% { opacity: 1; transform: translateX(0); clip-path: inset(0 0 0 0); } }
@keyframes gallery-actions-rise { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }

/* Pure horizontal drift now, no scale/zoom - the explicit ask was "moving very slowly side to
   side", not a pulsing zoom. Long duration (see the animation below) is what actually reads as
   "very slowly"; the keyframe itself just ping-pongs between the two extremes. */
@keyframes portrait-drift { 0%, 100% { transform: translateX(-3%); } 50% { transform: translateX(3%); } }
.signature-card { animation: signature-enter .8s cubic-bezier(.22,.61,.36,1) both; position: relative; }
/* A soft accent glow behind the photo, replacing the old double-offset-outline-lines motif -
   currentColor comes from an inline style on .portrait-frame itself (see portraitHtml below),
   never a CSS custom property scoped to an unrelated sibling, which is what silently pinned this
   to a hardcoded fallback color before. No separate ring pseudo-element anymore - that read as a
   second outline "floating" apart from the photo; the ONE outline is .portrait-clip's own real
   border below, sitting flush against the photo's actual edge. */
/* Negative top margin (not just zero) - even flush with the name/title's own top, the photo still
   read as sitting a touch low, and specifically its BOTTOM edge (the Save Contact bar) needs to
   land closer to the action buttons' own row further down for the whole right column to read as
   one aligned block. Pulling the photo up shifts its bottom edge up by the same amount without
   changing its size. The halo below still has room to bleed upward into .gallery-main's own
   padding-top without getting clipped. */
.portrait-frame { position: relative; flex: 0 0 auto; margin: -8px 11px 11px; }
/* A slow, subtle breathing pulse - opacity only, so it never risks nudging anything, and stays
   calm rather than "throbbing". Respects reduced-motion below. */
.portrait-frame::before { content: ''; position: absolute; inset: -15px; z-index: 0; pointer-events: none; border-radius: 34px; background: radial-gradient(circle at 24% 18%, color-mix(in srgb, currentColor 56%, transparent), transparent 60%), radial-gradient(circle at 82% 88%, color-mix(in srgb, currentColor 36%, transparent), transparent 56%), radial-gradient(circle at 50% 50%, color-mix(in srgb, currentColor 18%, transparent), transparent 72%); filter: blur(3px); animation: portrait-glow-pulse 7s ease-in-out infinite; }
@keyframes portrait-glow-pulse { 0%, 100% { opacity: .78; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .portrait-frame::before { animation: none; } }
/* Clips the photo to its rounded, alternating-corner frame - the halo above sits outside this
   clip on purpose, so it can bleed past the photo's own edges. The accent OUTLINE lives right
   here, flush against the photo itself (not a separate ring floating a few px out from it). */
/* A real border, not an inset box-shadow - the inset version painted OVER the photo's own edge
   pixels, which on a busy/high-contrast photo could read as blending into the image instead of a
   clean, crisp ring - compare .gallery-socials' own real border above, which never has that
   problem since there's no photo under it. A real border sits outside the image content instead
   (box-sizing:border-box, set globally below, keeps the box itself the same 114x114 size). */
/* The drift animation lives HERE now (moving the whole bordered shell), not on .portrait-image -
   it used to animate just the <img> inside a static frame, a Ken-Burns pan/zoom where the border
   stayed put and the picture slid/scaled underneath it. The explicit ask was for the photo and
   its outline to move together as ONE unit instead, the same way the picture sits still inside
   its own shell in the Customize tab's drag-photo control - only the position/crop changes there,
   never an independent pan inside a fixed frame. Translating this element (border included, since
   transform moves the whole rendered box) reads as the entire "shell" gently drifting side to
   side, with the photo inside it never moving relative to its own frame. A slow 18s cycle (not a
   quick pulse) is what actually reads as "very slowly" - a fast version of the exact same motion
   would look jittery instead of calm. */
.portrait-clip { position: relative; z-index: 1; overflow: hidden; border-radius: 18px 5px 18px 5px; border: 3px solid currentColor; animation: portrait-drift 18s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .portrait-clip { animation: none; } }
.portrait-image { display: block; width: 100%; height: 100%; object-fit: cover; filter: saturate(.92) contrast(1.05); }
/* "Save Contact" spans the full width of the photo's bottom edge (inside the same rounded clip)
   instead of a separate row below it, so it adds zero extra card height - mirrors the install
   HTML baking the same bar into the photo GIF's own pixels (see _bake_save_contact_bar in
   email_signature_service.py). Slightly wider letter-spacing and a touch more padding than the
   first pass - tight spacing at this small a size was reading as a cramped, blurry smudge rather
   than a clean label. */
/* The animated shine sweep this used to have never actually read right (didn't reliably show/
   register as intentional) - removed in favor of a persistent "elevated" treatment instead: a
   glossy inset highlight along the top edge plus a deeper inset shadow along the bottom, so the
   bar reads as a raised, glass-like pill at rest, no animation required. box-shadow here can't
   reach OUTSIDE this element the way it can on a normal button - .portrait-clip (the parent)
   clips overflow - so the elevation has to be built from inset shadows, which paint fine within
   the element's own box regardless of the ancestor's overflow:hidden. */
.portrait-vcard { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 3px 0; text-align: center; white-space: nowrap; font-size: 9px; font-weight: 800; letter-spacing: .04em; text-decoration: none; transition: filter .2s ease; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,.4), inset 0 -8px 14px rgba(0,0,0,.22); }
.portrait-vcard:hover { filter: brightness(1.1); }
/* "My Agent Hub" (always the first button) is the single most important link on the card, so it
   gets a visibly stronger, standing lift/shadow instead of blending in with the other buttons -
   the same "elevated" intent as the Save Contact bar above, just via a normal (non-clipped)
   box-shadow here since nothing clips this element. Plain black shadow, no accent color (see the
   .gallery-action comment above for why a --signature-accent-based glow doesn't actually work
   here - same bug, same fix). */
.gallery-action:first-child { box-shadow: 0 10px 20px rgba(0,0,0,.3), 0 3px 8px rgba(0,0,0,.28); transform: translateY(-1px); }
.gallery-action:first-child:hover { transform: translateY(-3px); }
.signature-card .social-dot { transition: transform .25s ease, background-color .25s ease; }
.stat-item { animation: stats-rise .8s .2s both; }
.stat-item:nth-child(2) { animation-delay: .35s; }
.stat-item:nth-child(3) { animation-delay: .5s; }
.signature-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.4) 48%, rgba(255,255,255,.68) 50%, rgba(255,255,255,.4) 52%, transparent 65%); background-size: 300% 300%; background-position: -60% -60%; animation: signature-sweep 8s cubic-bezier(.22,.61,.36,1) infinite; pointer-events: none; }
.signature-card:hover::after { animation-play-state: paused; }
.listing-photo { width: 54px; height: 42px; flex: 0 0 auto; border-radius: 8px; background: linear-gradient(135deg, #23312f 0 34%, #b58755 34% 44%, #e6d0a9 44% 60%, #75867b 60%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); background-size: cover; background-position: center; }
.gallery-inner { min-height: 150px; }
.gallery-main { min-width: 0; min-height: 150px; display: flex; flex-direction: column; box-sizing: border-box; padding-top: 10px; padding-bottom: 10px; }
.gallery-main .gallery-listing-wrap, .gallery-main .mini-bubble { width: 100% !important; box-sizing: border-box; flex: 0 0 auto; margin: 12px 0 0 !important; align-self: stretch; }
.gallery-main > .flex:first-child { min-height: 0; align-items: flex-start; }
.gallery-main .portrait-frame { margin-bottom: 0; flex: 0 0 auto; }
/* border-radius: 0 17px 17px 0 - matches (1px inside) .signature-card's own 18px radius on its
   right-side corners, where this column sits. Without this, the outer card's own overflow:hidden
   was clipping a small rounded triangle out of THIS element's square top-right/bottom-right
   corners, revealing the card's own bg color underneath right at the corners instead of the accent
   gradient reaching edge-to-edge - the exact bug already fixed in the email/HTML version's
   equivalent (see render_stats_png/_build_gallery's own matching-radius comment on the backend)
   but never carried over here (explicit ask: "stats background accent color doesn't go all the way
   to the bottom... like it does on the top and side"). */
.gallery-rail { justify-content: stretch; text-align: center; position: relative; padding-top: 34px !important; padding-bottom: 10px !important; isolation: isolate; border-radius: 0 17px 17px 0; background: linear-gradient(180deg, color-mix(in srgb, var(--signature-accent, #c78247) 92%, white), color-mix(in srgb, var(--signature-accent, #c78247) 72%, #171817)); }
.gallery-rail::before { content: 'Stats'; position: absolute; inset: 0; z-index: 1; padding-top: 10px; color: inherit; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; text-align: center; pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,.8), 0 1px 4px rgba(0,0,0,.3); background: radial-gradient(circle at 50% 10%, rgba(255,255,255,.34), transparent 32%), linear-gradient(180deg, transparent 0 82%, rgba(0,0,0,.2)); }
/* box-shadow added - a semi-transparent white line has nothing to separate it from a light/white
   accent's own near-white background at the top of the gradient (see .gallery-rail above), so it
   was effectively invisible there even though it worked fine against a darker accent. Same single
   soft dark shadow as each pill's own label underline (.stat-item p:last-child::after) below. */
.gallery-rail::after { content: ''; position: absolute; top: 27px; left: 14px; right: 14px; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent); box-shadow: 0 1px 2px rgba(0,0,0,.4); opacity: .8; }
/* height:100% + space-evenly (not flex-start) - the 3 pills used to clump at the top of this
   column, leaving a slab of bare accent color below them whenever the rest of the card was
   taller than the stats content alone. Spreading them across the full column height instead
   makes the stats side actually read as "filled". */
.gallery-rail > div { width: 100%; height: 100%; text-align: center; margin-top: 0 !important; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; gap: 7px; }
.gallery-rail .stat-item { position: relative; z-index: 2; width: 88px; min-width: 88px; margin: 0 5px; padding: 9px 8px; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; background: rgba(0,0,0,.1); box-shadow: inset 0 1px rgba(255,255,255,.14), 0 5px 12px rgba(0,0,0,.08); }
.gallery-rail .stat-item p { opacity: 1 !important; }
/* Color comes from --stat-text (set inline per-render below - see statsTextColor, always white
   now) rather than a literal #fff, so a future per-render tweak has one place to change. The
   text-shadow below is what actually keeps the numbers legible even at the lightest end of the
   rail's top-to-bottom gradient (a genuinely light/white accent) - it used to be backed up by also
   flipping to dark text there, but that read as inconsistent with every other accent's white text
   once the shadow alone was already doing the legibility work. */
.gallery-rail .stat-item p:first-child { color: var(--stat-text, #fff); font-size: 17px; font-weight: 700; line-height: 1; letter-spacing: -.03em; text-shadow: 0 1px 2px rgba(0,0,0,.9), 0 2px 8px rgba(0,0,0,.45); white-space: nowrap; }
/* A small highlight mark centered directly under the label word itself (Volume/Closed/Avg),
   not just floating in the middle of the wider pill - a fixed, deliberately short width so it
   reads as an underline on the word rather than a full-width divider. */
.gallery-rail .stat-item p:last-child { position: relative; margin-top: 4px; padding-bottom: 6px; color: var(--stat-text, #fff); opacity: .86; font-size: 7px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,.8), 0 1px 4px rgba(0,0,0,.3); }
.gallery-rail .stat-item p:last-child::after { content: ''; position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 14px; height: 2px; border-radius: 2px; background: var(--stat-text, #fff); box-shadow: 0 1px 2px rgba(0,0,0,.5); }
/* A long pill (rounded rectangle) spanning the card's full height, outlined in the agent's real
   accent color rather than filled with it (explicit ask - filled read as too heavy) - each icon
   sits on its own small white chip in its real brand color, inset within the pill. The color
   itself comes from an inline style on .gallery-socials-rail in the markup below, not a CSS
   custom property scoped to .gallery-rail (an unrelated sibling column, the stats rail) - that
   scoping was silently pinning this to the #c78247 fallback for every agent regardless of their
   actual chosen accent color, the bug this replaces. */
.gallery-socials-rail { display: flex; width: 52px; flex-shrink: 0; align-items: stretch; padding: 8px 0 8px 8px; }
/* Background is set inline per-render (see _cardWashBg), same silvery accent-tinted wash and
   left-middle glow as the Recent Sales/Featured Listing card, instead of sitting plain/transparent
   inside its own accent-outlined pill. */
.gallery-socials { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; gap: 8px; padding: 12px 4px; border: 2px solid var(--rail-accent, #c78247); border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,.08); }
.gallery-socials .social-dot { border-radius: 50%; background: #fff; transition: transform .25s ease, opacity .25s ease; }
.gallery-socials .social-dot:hover { transform: translateY(-2px) scale(1.16); box-shadow: 0 0 0 3px color-mix(in srgb, var(--rail-accent, #c78247) 55%, transparent), 0 8px 18px rgba(0,0,0,.28); }
.gallery-socials .social-dot:active { transform: scale(.94); }
/* No max-width - spans the full width .gallery-main actually gives it (up to the stats rail),
   not capped short of it. This is the exact same card template/size whether it's showing a
   featured listing or (see .mini-bubble below, the recent-sales design) the same overall height
   as one. */
/* Background is set inline per-render (see _cardWashBg/buildCardHtml) - a neutral, accent-tinted
   silvery wash instead of this class's old hardcoded warm-orange default, which used to show up
   regardless of the agent's actual chosen accent color. This fallback only shows if that inline
   style is ever missing. */
/* box-shadow added - this card had only its own border to separate it from the page behind it, so
   a light/white accent (which the border color IS, via currentColor) let the whole card flatten
   into a white/near-white page background with nothing but a near-invisible 1px edge. Same fix as
   the buttons above, same reasoning. */
.gallery-listing { min-height: 94px; width: 100%; position: relative; display: flex; align-items: center; gap: 12px; overflow: hidden; padding: 10px 14px; background: #f6f2ea; border: 1px solid currentColor; border-left: 4px solid currentColor; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.1); box-sizing: border-box; isolation: isolate; animation: gallery-listing-enter .8s .55s cubic-bezier(.22,.61,.36,1) both; }
.gallery-listing > * { position: relative; z-index: 1; }
.listing-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; order: 2; padding-top: 4px; padding-bottom: 4px; }
.listing-kicker { font-size: 8px; letter-spacing: .16em; opacity: .62; }
.listing-copy strong { font-size: 14px; letter-spacing: -.02em; }
.listing-location { font-size: 10px; opacity: .62; }
.gallery-listing .listing-photo { order: 1; flex: 0 0 118px; width: 118px; height: 92px; margin: 0; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
.gallery-listing .listing-facts { order: 3; min-width: 100px; padding-top: 3px; padding-bottom: 3px; display: flex; flex-direction: column; gap: 3px; border-left: 1px solid currentColor; padding-left: 12px; text-align: right; font-size: 10px; }
.gallery-listing .listing-facts strong { font-size: 16px; letter-spacing: -.04em; }
.gallery-listing .listing-facts span { opacity: .64; white-space: nowrap; }
.listing-highlights { margin: 7px 0 0; padding-left: 14px; font-size: 8px; line-height: 1.45; opacity: .72; }
.listing-highlights li::marker { color: currentColor; }
/* Recent-sale mode: one bubble, same overall size as a featured listing, holding a row of 3 sale
   photos that fill it (each stamped "Recently Sold", town + price at the bottom) - scrolls the
   window by one card every 4s (see the script below) when there are more than 3. */
/* A bit taller than a featured-listing card (was the same 94px min-height, matching that card's
   size exactly) - with the header's own underline mark removed just below, the 3 mini photos were
   reading as noticeably wide/short rectangles; the extra height goes straight to them. Background
   is set inline per-render (see _cardWashBg), same as .gallery-listing above - and same box-shadow
   fix too (see its comment), for the same reason: only a border, in a color that can itself be
   light/white, let this flatten into a white/near-white page with nothing else to define its edge. */
.rot-wrap { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); }
.rot-wrap > .rot-slide { min-width: 0; }
/* Narrow layout (phones): a smaller photo so the address and price both keep their room. */
@media (max-width: 600px) { .feat-photo { flex-basis: 112px; } .feat-side { padding-left: 10px; padding-right: 10px; } }
.rot-wrap > .rot-slide { grid-area: 1 / 1; opacity: 0; visibility: hidden; transform: translateY(6px) scale(.985); transition: opacity .7s ease, transform .7s cubic-bezier(.22,.61,.36,1), visibility 0s .7s; }
.rot-wrap > .rot-slide.is-on { opacity: 1; visibility: visible; transform: none; transition: opacity .7s ease, transform .7s cubic-bezier(.22,.61,.36,1), visibility 0s; }
.rot-wrap > .rot-slide .feat-card, .rot-wrap > .rot-slide.mini-bubble { animation: none; }
.gallery-main .rot-wrap > .rot-slide.mini-bubble { margin: 0 !important; min-height: 104px; }
.rot-wrap > a.rot-slide > .feat-card { height: 100%; }
.rot-dots { position: absolute; right: 10px; bottom: -11px; display: flex; gap: 4px; }
.rot-dots i { width: 5px; height: 5px; border-radius: 999px; background: currentColor; opacity: .25; transition: width .4s ease, opacity .4s ease; }
.rot-dots i.is-on { width: 14px; opacity: .8; }
.mini-bubble { width: 100%; min-height: 108px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; padding: 7px 8px 7px; background: #f6f2ea; border: 1px solid currentColor; border-left: 4px solid currentColor; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.1); overflow: hidden; animation: gallery-listing-enter .8s .55s cubic-bezier(.22,.61,.36,1) both; }
.mini-viewport { flex: 1; overflow: hidden; border-radius: 2px; }
.mini-track { display: flex; gap: 6px; height: 100%; transition: transform .5s cubic-bezier(.22,.61,.36,1); }
.mini-slide { flex: 0 0 calc((100% - 12px) / 3); position: relative; min-height: 92px; border-radius: 9px; overflow: hidden; background-size: cover; background-position: center; background-color: currentColor; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.mini-tag { position: absolute; top: 6px; left: 6px; z-index: 2; padding: 3px 7px; border-radius: 999px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 7px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #fff; background: linear-gradient(160deg, #e3365a, #b4123a); box-shadow: 0 2px 8px rgba(0,0,0,.3); white-space: nowrap; }
.mini-slide .mini-scrim { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 7px 5px; background: linear-gradient(180deg, transparent, rgba(0,0,0,.8)); }
.mini-slide .mini-city { font-size: 9.5px; font-weight: 700; color: #e9e5db; line-height: 1.3; }
.mini-slide .mini-price { font-size: 14px; font-weight: 900; color: #fff; line-height: 1.3; }
/* Two stacked SVGs (copy icon + checkmark), only one visible at a time via opacity - swapping
   which one shows is cheaper/simpler than swapping innerHTML, and avoids losing the click
   handler's own reference to the button element. */
.contact-copy-btn { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 4px; padding: 0; border: none; background: transparent; color: currentColor; opacity: .45; cursor: pointer; vertical-align: middle; position: relative; transition: opacity .15s ease; }
.contact-copy-btn:hover { opacity: .85; }
.contact-copy-btn svg { position: absolute; top: 3px; left: 3px; transition: opacity .15s ease, transform .15s ease; }
.contact-copy-btn .contact-copy-check { opacity: 0; color: #3FA35A; transform: scale(.6); }
.contact-copy-btn.copied { opacity: 1; }
.contact-copy-btn.copied svg:first-child { opacity: 0; }
.contact-copy-btn.copied .contact-copy-check { opacity: 1; transform: scale(1); }
/* display:inline-flex + align-items:center, not inline-block - min-height stretching an
   inline-block taller than its own line-box left the text hugging the TOP of the pill with
   visible dead space below it (most noticeable on "My Agent Hub", the first/solid button). */
/* A resting shadow on every button now, not just on hover - the 2nd/3rd buttons had none at rest,
   which was invisible most of the time but let them flatten into a white/near-white card background
   whenever the agent picked a light accent (nothing to distinguish the button's own edge from the
   card behind it). Lighter than "My Agent Hub"'s own standing shadow below, which still reads as
   visibly more prominent - this is enough lift to define the edge, not compete with it. */
.gallery-action { display: inline-flex !important; align-items: center; justify-content: center; min-height: 28px; border-radius: 8px !important; box-shadow: 0 3px 8px rgba(0,0,0,.18); transition: transform .25s ease, box-shadow .25s ease, filter .25s ease; position: relative; overflow: hidden; animation: gallery-detail-enter .55s .5s both; }
.gallery-action:nth-child(2) { animation-delay: .62s; }
.gallery-action:nth-child(3) { animation-delay: .74s; }
/* No colored glow here any more - it referenced --signature-accent, a custom property declared on
   .gallery-rail (the STATS column), a completely unrelated SIBLING of .gallery-main (which is
   what actually contains these buttons) - CSS custom properties only inherit down the tree from
   where they're set, so that var() never actually resolved to the real accent here and silently
   fell back to its hardcoded default (#c78247, a peachy orange) on every render, showing up as an
   obviously-wrong stray highlight especially on a dark card. Buttons get plain elevation instead -
   no accent-colored shadow at all. */
.gallery-action:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 7px 18px rgba(0,0,0,.18); }
.signature-gallery .portrait-frame { animation: gallery-detail-enter .7s .1s cubic-bezier(.22,.61,.36,1) both; color: #c78247; }
.signature-gallery .gallery-main > .flex:first-child > div:last-child { animation: gallery-detail-enter .65s .22s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery .gallery-rail { animation: gallery-rail-enter .8s .35s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery .gallery-rail .stat-item { animation: gallery-stats-rise .7s .58s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery .gallery-rail .stat-item:nth-child(2) { animation-delay: .7s; }
.signature-gallery .gallery-rail .stat-item:nth-child(3) { animation-delay: .82s; }
.signature-gallery .gallery-socials { animation: gallery-social-swoop .8s .08s cubic-bezier(.22,.61,.36,1) backwards; }
.signature-gallery .gallery-socials .social-dot { animation: gallery-social-arrive .55s cubic-bezier(.22,.61,.36,1) backwards; }
.signature-gallery .gallery-socials .social-dot:nth-child(2) { animation-delay: .08s; }
.signature-gallery .gallery-socials .social-dot:nth-child(3) { animation-delay: .16s; }
.signature-gallery .gallery-socials .social-dot:nth-child(4) { animation-delay: .24s; }
.signature-gallery .gallery-socials .social-dot:nth-child(5) { animation-delay: .32s; }
.signature-gallery .gallery-main { animation: gallery-copy-reveal .8s .16s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery .gallery-main .gallery-action { animation: gallery-actions-rise .65s .62s cubic-bezier(.22,.61,.36,1) both; }
.signature-gallery .gallery-main .gallery-action:nth-child(2) { animation-delay: .72s; }
.signature-gallery .gallery-main .gallery-action:nth-child(3) { animation-delay: .82s; }
@media (prefers-reduced-motion: reduce) {
  .gallery-rail .stat-item, .gallery-listing, .gallery-listing > .listing-photo, .mini-bubble, .gallery-socials .social-dot, .signature-gallery .portrait-frame, .signature-gallery .gallery-main, .signature-gallery .gallery-rail, .signature-gallery .gallery-action, .signature-gallery .gallery-socials { animation: none; }
}
`

// Same formula/threshold as _contrast_text/_luminance in email_signature_service.py, kept in
// sync by hand - picks readable text for the stats pills against their own accent-gradient
// background (a light accent like white/silver needs dark text, not white-on-nearly-white).
function _luminance(hex: string): number {
  const clean = (hex || '').replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function _contrastTextColor(hex: string): string {
  return _luminance(hex) > 140 ? '#111827' : '#ffffff'
}

// A neutral, silvery wash tinted faintly by the agent's accent color, plus a soft highlight glow
// on the left-middle (echoing the stats rail's own top highlight) - replaces a flat hardcoded
// warm-orange background that used to show on Recent Sales/Featured Listing/the icon rail
// regardless of the agent's actual chosen accent color.
function _cardWashBg(accent: string, dark?: boolean): string {
  const base = dark
    ? `linear-gradient(135deg, color-mix(in srgb, ${accent} 16%, #24262c) 0%, color-mix(in srgb, ${accent} 6%, #17181c) 100%)`
    : `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, #ffffff) 0%, color-mix(in srgb, ${accent} 4%, #f6f2ea) 100%)`
  // The highlight glow blends toward WHITE on the light wash, which matches the (already
  // white-ish) base it sits on - blending toward that same white on the DARK wash instead painted
  // a stark, out-of-place bright smear that didn't match the base at all ("bad" on the dark
  // theme, "perfect" on light, because only the light version's glow actually matched its base).
  // Blending toward a lighter neutral gray instead keeps the dark version's glow in the same
  // tonal family as its own base.
  const glow = dark
    ? `radial-gradient(circle at 14% 50%, color-mix(in srgb, ${accent} 55%, #4a4d54) 0%, transparent 58%)`
    : `radial-gradient(circle at 14% 50%, color-mix(in srgb, ${accent} 38%, white) 0%, transparent 58%)`
  return `${glow}, ${base}`
}

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtMoney(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  return `$${Math.round(value).toLocaleString()}`
}

// A bare 10-digit US number becomes "(610) 781-7003" instead of a hard-to-scan run of digits -
// anything else (extension, international, already-punctuated) is left exactly as entered.
function fmtPhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1)
  if (digits.length !== 10) return raw
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

// The exact same lucide-react icons Agent Hub's own social rail uses (SocialLinksEditor.tsx /
// app/[slug]/page.tsx's socialIconMap) - inlined as raw SVG path data instead of importing the
// package, since this markup gets serialized into an iframe srcDoc string, not rendered as JSX.
// 24x24 viewBox, stroke-based, matching lucide's own default styling.
const SOCIAL_ICON_PATHS: Record<string, string> = {
  website: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  youtube: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  // A filled note + curled flag (not lucide's plain Music2 circle-and-line, which read as too
  // generic/not recognizable as TikTok specifically - explicit ask for "a way more accurate
  // tiktok logo") - matches email_signature_service.py's own _draw_social_glyph tiktok case,
  // kept in sync by hand. fill/stroke set explicitly per-shape since the shared <svg> wrapper
  // below defaults every icon to fill:none/stroke:currentColor, which this one doesn't use.
  tiktok:
    '<ellipse cx="9.4" cy="17.4" rx="3.4" ry="2.9" fill="currentColor" stroke="none"/>' +
    '<rect x="11.6" y="3.8" width="1.8" height="13.6" rx="0.9" fill="currentColor" stroke="none"/>' +
    '<path d="M13.4 3.8 A3.1 3.1 0 0 1 17.3 6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
}

// Real per-network brand colors for the rail icons, instead of a flat inherited color - "website"
// has no fixed brand color and keeps a neutral dark glyph. Matches _BRAND_GLYPH_COLORS in
// email_signature_service.py exactly, so the live preview and the actual install HTML never show
// different icon colors for the same network.
const BRAND_ICON_COLORS: Record<string, string> = {
  website: '#171817',
  instagram: '#E1306C',
  facebook: '#1877F2',
  youtube: '#FF0000',
  tiktok: '#111827',
}

// glyphSize defaults to 15 (the original fixed size, at the original 24px chip - a ~0.625 ratio)
// - callers building a bigger chip (see socialsHtml's own dynamic sizing) pass a proportionally
// bigger glyph size too, so the icon inside actually grows with its chip instead of staying a
// small fixed glyph floating in an oversized circle.
function socialIconSvg(network: string, glyphSize = 15): string {
  const paths = SOCIAL_ICON_PATHS[network]
  if (!paths) return '&bull;'
  return `<svg width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

type PreviewIdentity = {
  name: string
  title: string
  company: string
  team: string
  headshot: string
  // Agent Hub's own photo focal point (Settings' photo cropper) - {x:50,y:50} is dead center.
  // Without this, object-fit:cover always centers the crop, which can cut off the top of the
  // agent's head whenever their actual photo has the face positioned higher up than that (e.g.
  // a wider/half-body shot) - the same photo the Agent Hub page itself crops correctly via this
  // exact value as a background-position.
  headshotPosition?: { x: number; y: number }
  phone: string
  email: string
  website: string
  agentHubUrl: string
  showVerifiedBadge: boolean
  // Same stable /go/{owner_id}/vcard link the install HTML uses (email_signature_service.py's
  // _build_gallery) - always resolves to the agent's current Contact Card settings, so this badge
  // never has to be re-pasted just because a phone number changed in Settings.
  vcardUrl?: string
}

type PreviewLinks = { network: string; url: string }[]
type PreviewButton = { label: string; url: string }
type PreviewListing = {
  image: string
  kicker: string
  address: string
  location: string
  price: string
  status: string
  beds?: number
  baths?: number
  sqft?: number
  acres?: number
  /** Where this exact listing opens (its Spotlight / property page); falls back to the general listings link. */
  href?: string
} | null
type PreviewStats = { volume: string; sold: string; avg: string } | null
// Recent-sale mode: a "RECENT SALES" bubble with a row of mini cards (town + price + SOLD stamp
// only, no specs) - the same overall size as the (mutually exclusive) featured-listing card above.
// The full list can be longer than 3; the bubble scrolls its window by one every 4s (see the
// script below) when there are more than 3.
type PreviewSaleMini = { image: string; city: string; price: string }
type PreviewSaleCards = PreviewSaleMini[] | null

// The clean status word + its chip color (Coming Soon black, Active green, Pending/Under Contract
// amber, Sold rose) - MLS feeds send e.g. "COMING SOON-BRIGHT".
function statusChip(raw: string): { label: string; bg: string } {
  const clean = String(raw || '').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim().toLowerCase()
  if (clean.includes('coming soon')) return { label: 'Coming Soon', bg: '#111827' }
  if (clean.includes('under contract')) return { label: 'Under Contract', bg: '#b7791f' }
  if (clean.includes('pending')) return { label: 'Pending', bg: '#b7791f' }
  if (clean.includes('sold') || clean.includes('closed')) return { label: 'Sold', bg: '#e11d48' }
  if (clean.includes('active')) return { label: 'Active', bg: '#1f9d55' }
  return { label: clean ? clean.replace(/\b\w/g, c => c.toUpperCase()) : 'Featured', bg: '#111827' }
}

// Luxe site-version background: a house and a key drifting slowly, and a line of rooftops that
// draws itself along the bottom edge - real-estate motifs in the metal, like the luxe headers.
const LX_MOTIFS = `<svg class="lx-sig-motif" style="right:128px;top:8px;width:84px;height:84px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/></svg><svg class="lx-sig-motif lx-sig-motif-b" style="right:222px;top:44px;width:40px;height:40px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l2 2M15 8l2 2"/></svg><svg class="lx-sig-skyline" viewBox="0 0 360 46" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M0 44h20V30l16-12 16 12v14h28V22h22v22h26V26l20-16 20 16v18h34V18h14V8h10v10h14v26h30V30l18-14 18 14v14h26V24h24v20h20"/></svg>`

export function buildDesignPreviewHtml(opts: {
  identity: PreviewIdentity
  socials: PreviewLinks
  buttons: PreviewButton[]
  listing: PreviewListing
  saleCards?: PreviewSaleCards
  // The agent's public Listings/Sales page - the featured-listing card and the recent-sales
  // bubble each link through to whichever one they're currently showing, same as the actual
  // install HTML (see banner_href in email_signature_service.py's _build_gallery).
  listingHref?: string
  salesHref?: string
  stats: PreviewStats
  accent: string
  fontFamily?: string
  // Customize tab's dark-mode toggle - mirrors the exact same light/dark palette
  // email_signature_service.py's _theme_colors uses for the real install HTML, so this preview
  // never shows a different theme than what actually gets installed.
  dark?: boolean
  // false when this exact HTML is going to be copied and pasted as someone's real signature
  // (see copyHtml in the Studio page) rather than shown in the editor's own iframe - omits the
  // click-interceptor (which exists ONLY to stop the Studio preview from navigating away when
  // clicked) and the parent-postMessage height report (meaningless outside that iframe). No
  // mainstream email client executes a pasted <script> at all, so this mostly doesn't matter once
  // actually installed - it's just not shipping dead/preview-only code into what's now the real
  // artifact. Defaults to true so every other existing caller (the Studio iframe itself, the
  // homepage's marketing demo) is unaffected.
  interactive?: boolean
  // OpenHousePal Luxe premade theme (Customize tab).
  luxe?: boolean
  /** Luxe finish - gold (default), silver or bronze. */
  metal?: LuxeMetal
  /** Post the rendered height to the parent frame (defaults to `interactive`). */
  reportHeight?: boolean
  /** Site version on a page (blog, Spotlight): cycle through several listings - and, when set, a
   *  "Recent Sales" slide - in the banner spot instead of one fixed card. */
  rotation?: { listings: NonNullable<PreviewListing>[]; sales?: PreviewSaleMini[] | null; salesAt?: number; listingsHref?: string; salesHref?: string } | null
  /** Stats with no listing/sales card beside them: a slim strip in the card's spot instead of the
   *  right-hand column (same as the email - email_signature_service.stats_as_strip). */
  statsStrip?: boolean
  /** false once the agent's sales volume passes $50M: "Sold" instead of "Recently sold" (lib/salesWording). */
  salesRecent?: boolean
}): string {
  const { identity, socials, buttons, listing, saleCards, listingHref, salesHref, stats, accent, fontFamily, dark, interactive = true, luxe = false, metal = 'gold', reportHeight = interactive, rotation = null, statsStrip = false, salesRecent = true } = opts
  const soldTag = salesWords('Recently Sold', salesRecent)
  const mp = LUXE_METALS[metal]
  // Same hex values as _theme_colors/CARD_BG_DARK in email_signature_service.py - kept in sync by
  // hand since one's Python and the other's TS, not a shared module.
  const cardBg = luxe
    ? (dark
      ? `radial-gradient(120% 140% at 100% 0%, rgba(${mp.rgb},.20), transparent 55%), linear-gradient(135deg, #0b0f0e 0%, #111827 55%, ${metal === 'gold' ? '#1d1810' : metal === 'bronze' ? '#20150e' : '#1a1d22'} 100%)`
      : `radial-gradient(110% 130% at 100% 0%, rgba(${mp.rgb},.22), transparent 55%), linear-gradient(135deg, #fffdf8 0%, ${metal === 'silver' ? '#f6f7f8 55%, #e9ecef' : metal === 'bronze' ? '#fbf3ec 55%, #f2e1d3' : '#fbf6ec 55%, #f4ead7'} 100%)`)
    : (dark ? '#1B1D22' : '#fffdfa')
  const cardBorder = luxe ? (dark ? `rgba(${mp.lightRgb},.28)` : `rgba(${mp.rgb},.45)`) : (dark ? '#34373E' : '#e7ddcf')
  const textColor = dark ? '#F4F2EC' : '#171817'
  const dividerRgba = dark ? 'rgba(244,242,236,.18)' : 'rgba(23,24,23,.18)'

  // Bigger icons the fewer networks the agent has filled in (explicit ask: "if the agent deselects
  // some it should make them all a bit bigger since there is more space there... on both site and
  // email version" - the email/raster version's own equivalent lives in _rail_icons_html on the
  // backend). +2px chip size per network below the max 5, capped at +8 (32px) - same shape as the
  // backend's _BADGE_SIZE_MAX logic, just independently since this is CSS/SVG, not a shared PNG.
  const socialIconChipSize = Math.min(24 + 8, 24 + 2 * (5 - socials.length))
  const socialIconGlyphSize = Math.round((socialIconChipSize * 15) / 24)
  const socialsHtml = socials
    .map(
      s =>
        `<a class="social-dot" href="${esc(s.url)}" target="_blank" rel="noreferrer" title="${esc(s.network)}" aria-label="${esc(s.network)}" style="display:grid;place-items:center;width:${socialIconChipSize}px;height:${socialIconChipSize}px;color:${BRAND_ICON_COLORS[s.network] || '#171817'};text-decoration:none;">${socialIconSvg(s.network, socialIconGlyphSize)}</a>`
    )
    .join('')

  // "Save Contact" overlaps the bottom of the photo itself (inside the same rounded .portrait-clip)
  // instead of sitting in a separate row below it, so it adds zero extra card height - mirroring
  // how the install HTML bakes the same bar into the photo GIF's own pixels (render_photo_gif /
  // _bake_save_contact_bar in email_signature_service.py) rather than a second table row. Spans
  // the photo's full width in the agent's own accent color. Text color is computed per-accent
  // (_contrastTextColor), not hardcoded white - a genuinely light/white accent made white text
  // nearly invisible against its own bar, a real legibility bug (mirrors the same fix in
  // _bake_save_contact_bar/_action_row_html on the backend). Still a flat color with no stroke - a
  // black outline was tried here and read as messy/odd at this size, and that part stands.
  const accentTextStyle = `color:${_contrastTextColor(accent)};`
  // A subtle two-tone gradient instead of a flat fill - reads as a deliberately polished metal/
  // glass pill rather than a plain color block, same intent as the true-metal accent swatches.
  const vcardBg = `linear-gradient(180deg, color-mix(in srgb, ${accent} 100%, white 14%), ${accent} 55%, color-mix(in srgb, ${accent} 100%, black 10%))`
  const vcardOverlayHtml = identity.vcardUrl
    ? `<a href="${esc(identity.vcardUrl)}" class="portrait-vcard" style="background:${vcardBg};${accentTextStyle}">Save Contact</a>`
    : ''
  const headshotPos = identity.headshotPosition
  const headshotPosStyle = headshotPos ? `object-position:${headshotPos.x}% ${headshotPos.y}%;` : ''
  const portraitFrameStyle = `color:${accent};`
  const portraitHtml = identity.headshot
    ? `<div class="portrait-frame" style="${portraitFrameStyle}"><div class="portrait-clip" style="width:114px;height:114px;"><img src="${esc(identity.headshot)}" alt="${esc(identity.name)}" class="portrait-image" style="${headshotPosStyle}" />${vcardOverlayHtml}</div></div>`
    : `<div class="portrait-frame" style="${portraitFrameStyle}"><div class="portrait-clip" style="width:114px;height:114px;"><div class="portrait-image" style="display:flex;align-items:center;justify-content:center;background:${accent};color:#fff;font-size:32px;font-weight:700;">${esc(
        (identity.name || 'A')
          .split(' ')
          .slice(0, 2)
          .map(p => p[0]?.toUpperCase() || '')
          .join('')
      )}</div>${vcardOverlayHtml}</div></div>`

  const badgeHtml = identity.showVerifiedBadge
    ? `<span style="display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#1685e5;color:#fff;flex-shrink:0;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>`
    : ''

  const subBits = [identity.title, identity.company, identity.team].filter(Boolean)
  const subLine = subBits.length
    ? `<p style="margin:4px 0 0;font-size:11px;opacity:.6;">${subBits
        .map((b, i) => (i === 0 ? esc(b) : `<span style="margin:0 6px;opacity:.45;">&middot;</span><b>${esc(b)}</b>`))
        .join('')}</p>`
    : ''

  // Website is NOT repeated here - it's already the first rail icon (a real link to the site),
  // so a second text copy of the same URL in the contact row was pure redundancy nobody asked
  // for, not a field this design is missing. Phone/Email are the only two real contact methods
  // this identity object actually carries.
  // A small copy-to-clipboard button next to each value (explicit ask) - `.contact-copy-btn`'s
  // click handler lives in the <script> block below, gated by `interactive` same as everything
  // else there, since clipboard access only makes sense in a live rendered preview.
  const copyIconSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
  const copyBtn = (value: string, label: string) =>
    `<button type="button" class="contact-copy-btn" data-copy="${esc(value)}" aria-label="Copy ${esc(label)}" title="Copy ${esc(label)}">${copyIconSvg}<svg class="contact-copy-check" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>`
  const contactItems: string[] = []
  if (identity.phone) contactItems.push(`<span style="display:inline-block;"><b style="margin-right:4px;opacity:.5;">Mobile</b>${esc(fmtPhone(identity.phone))}${copyBtn(fmtPhone(identity.phone), 'mobile number')}</span>`)
  if (identity.email) contactItems.push(`<span style="display:inline-block;${identity.phone ? `border-left:1px solid ${dividerRgba};padding-left:10px;` : ''}"><b style="margin-right:4px;opacity:.5;">Email</b>${esc(identity.email)}${copyBtn(identity.email, 'email address')}</span>`)
  const contactHtml = contactItems.length
    ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 4px;font-size:10px;font-weight:500;color:${textColor};">${contactItems.join('')}</div>`
    : ''

  // A fixed compact sans-serif here, NOT the agent's chosen body font (fontFamily, applied on
  // <body>) - a serif choice like "Editorial" is noticeably wider per character, and inheriting
  // it was pushing the 3rd button (usually "What's My Home Worth?") onto its own line instead of
  // staying put next to the other two. Buttons are compact UI, not editorial copy, so they keep
  // one consistent, space-efficient font regardless of what's picked for the name/body text.
  const actionFontStack = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
  // Every button is now solid-filled in the accent color, like "My Agent Hub" always was - the
  // secondary buttons used to be plain accent-outlined pills, which went invisible whenever the
  // accent itself was white/near-white (nothing to outline against) and read as a visual downgrade
  // next to the one solid button anyway. Same polished gradient fill as the Save Contact bar, not
  // a flat color, for a more premium look. Text color is per-accent (accentTextStyle), same fix
  // and same reasoning as Save Contact above - a black outline/stroke was tried here too and read
  // as messy/odd, so that part is still a flat color, no stroke.
  const actionBg = `linear-gradient(180deg, color-mix(in srgb, ${accent} 100%, white 14%), ${accent} 55%, color-mix(in srgb, ${accent} 100%, black 10%))`
  const actionsHtml = buttons.length
    ? `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">${buttons
        .map(b => {
          const style = `background:${actionBg};${accentTextStyle}`
          return `<a href="${esc(b.url) || '#'}" class="gallery-action" style="white-space:nowrap;border-radius:8px;padding:6px 11px;font-family:${actionFontStack};font-size:8.5px;font-weight:700;text-decoration:none;display:inline-block;${style}">${esc(b.label)}</a>`
        })
        .join('')}</div>`
    : ''

  // One shared card renderer for both a featured listing and each recent-sale card - same
  // template/size either way (kicker + status badge + photo + address + price(+specs)), so a
  // signature that has neither reads as visually consistent, not two different designs.
  const buildCardHtml = (item: NonNullable<PreviewListing>) => {
    const chip = statusChip(item.status)
    const specs = [
      item.beds ? `${item.beds} bd` : '',
      item.baths ? `${item.baths} ba` : '',
      item.sqft ? `${Math.round(item.sqft).toLocaleString()} sq ft` : '',
      item.acres ? `${item.acres} ac` : '',
    ].filter(Boolean)
    const kicker = chip.label === 'Coming Soon' ? 'Coming soon' : chip.label === 'Sold' ? salesWords('Recent sale', salesRecent) : /just listed/i.test(item.kicker) ? item.kicker : 'Featured listing'
    const ctaBg = `background:${accent};${accentTextStyle}`
    return `<div class="feat-card" style="--feat-accent:${accent};background:${_cardWashBg(accent, dark)};">
        <div class="feat-photo">
          <div class="feat-photo-img" style="${item.image ? `background-image:url('${esc(item.image)}');` : `background:linear-gradient(135deg,#111827,#2a2218);`}"></div>
          <span class="feat-status" style="background:${chip.bg};">${esc(chip.label)}</span>
        </div>
        <div class="feat-body">
          <span class="feat-kicker" style="color:${accent};"><i></i>${esc(kicker)}</span>
          <strong class="feat-addr">${esc(item.address)}</strong>
          ${item.location ? `<span class="feat-loc">${esc(item.location)}</span>` : ''}
          ${specs.length ? `<div class="feat-specs">${specs.map(sp => `<span>${esc(sp)}</span>`).join('')}</div>` : ''}
        </div>
        ${item.price ? `<div class="feat-side"><span class="feat-price">${esc(item.price)}</span><span class="feat-cta" style="${ctaBg}">View home &rarr;</span></div>` : ''}
        <span class="feat-shine"></span>
      </div>`
  }

  const rotationSlides: string[] = []
  if (rotation) {
    rotationSlides.push(...rotation.listings.map(item => `<a href="${esc(item.href || rotation.listingsHref || '#')}" class="rot-slide" style="display:block;color:inherit;text-decoration:none;">${buildCardHtml(item)}</a>`))
    if (rotation.sales && rotation.sales.length) {
      const salesSlide = `<a href="${esc(rotation.salesHref || '#')}" class="rot-slide mini-bubble" style="border-color:${accent};background:${_cardWashBg(accent, dark)};color:inherit;text-decoration:none;">
            <div class="mini-viewport"><div class="mini-track">${rotation.sales.map(it => `<div class="mini-slide" style="${it.image ? `background-image:url('${esc(it.image)}');` : `background:${accent};`}"><span class="mini-tag">${soldTag}</span><div class="mini-scrim">${it.city ? `<div class="mini-city">${esc(it.city)}</div>` : ''}${it.price ? `<div class="mini-price">${esc(it.price)}</div>` : ''}</div></div>`).join('')}</div></div>
          </a>`
      rotationSlides.splice(Math.max(0, Math.min(rotation.salesAt ?? rotationSlides.length, rotationSlides.length)), 0, salesSlide)
    }
  }
  const rotationHtml = rotationSlides.length > 1
    ? `<div class="rot-wrap" style="margin-top:12px;">${rotationSlides.map((sl, k) => sl.replace('class="rot-slide', `data-rot="${k}" class="rot-slide${k === 0 ? ' is-on' : ''}`)).join('')}${`<div class="rot-dots">${rotationSlides.map((_, k) => `<i class="${k === 0 ? 'is-on' : ''}"></i>`).join('')}</div>`}</div>`
    : ''

  const listingHtml = rotationHtml ? '' : listing
    ? `<a href="${esc(listingHref || '#')}" class="gallery-listing-wrap" style="display:block;margin-top:12px;color:inherit;text-decoration:none;">${buildCardHtml(listing)}</a>`
    : ''

  // Recent-sale mode: three sale photos, as large as the bubble allows (the same height as the
  // featured-listing card's photo), each stamped "Recently Sold" top-left with town + price at the
  // bottom - no header line, so the photos get all the room. Scrolls its window by one card every
  // 4s when there are more than 3 (see the carousel script below), cycling through the agent's
  // whole list so their other sales actually get seen.
  const saleCardsHtml = !rotationHtml && saleCards && saleCards.length
    ? `<a href="${esc(salesHref || '#')}" class="mini-bubble" style="border-color:${accent};background:${_cardWashBg(accent, dark)};margin-top:12px;color:inherit;text-decoration:none;">
        <div class="mini-viewport">
          <div class="mini-track">
            ${saleCards
              .map(
                item => `<div class="mini-slide" style="${item.image ? `background-image:url('${esc(item.image)}');` : `background:${accent};`}">
                  <span class="mini-tag">${soldTag}</span>
                  <div class="mini-scrim">
                    ${item.city ? `<div class="mini-city">${esc(item.city)}</div>` : ''}
                    ${item.price ? `<div class="mini-price">${esc(item.price)}</div>` : ''}
                  </div>
                </div>`
              )
              .join('')}
          </div>
        </div>
      </a>`
    : ''

  // Always white now, on both themes - not computed per-accent any more. That conditional (dark
  // text for a "light" accent like gold/silver/light red/white, by luminance) predates the
  // .stat-item text-shadow above (0 1px 2px rgba(0,0,0,.9), 0 2px 8px rgba(0,0,0,.45)): the shadow
  // is what actually keeps the text legible against a light accent now, the same way it already did
  // against a dark one, so the accent never needs to flip the text color itself any more. The old
  // pick was correct in isolation, but read as visibly inconsistent next to bronze (and every other
  // accent), which is what got flagged. Mirrors the identical fix in render_stats_png on the
  // backend - see this file's own module docstring for why these two must be kept in sync by hand.
  // .stat-item p:first-child is a fixed 17px/white-space:nowrap in CSS (see its own rule above) -
  // fine for a normal "$1.9M", but a big enough sales volume ("$100M", or a billion-plus total)
  // just overflowed the pill's own 88px width with no fallback at all (explicit ask: "make [it]
  // smart enough so the number fits" - mirrors the identical fix in render_stats_png on the
  // backend, see that function's own _fit_value_font). No canvas text-measurement available here
  // (this runs both server- and client-side), so this is a character-count heuristic rather than a
  // true pixel measurement - coarser than the backend's, but the backend's IS the real email/HTML
  // output people actually paste, so this just needs to keep the Studio/site preview from visibly
  // breaking, not match it to the pixel.
  const statValueStyle = (value: string) => {
    const len = value.length
    if (len <= 6) return ''
    const size = Math.max(10, 17 - (len - 6) * 1.1)
    return ` style="font-size:${size}px;"`
  }

  const statsTextColor = '#ffffff'
  const stripHtml = stats && statsStrip
    ? `<a href="${esc(salesHref || '#')}" class="stats-strip" style="--signature-accent:${accent};">
        <span class="ss-head">My stats<i></i></span>
        ${[[stats.volume, 'Volume'], [stats.sold, 'Closed'], [stats.avg, 'Avg price']].filter(([v]) => v).map(([v, l]) => `<span class="ss-pill"><b>${esc(String(v))}</b><small>${l}</small></span>`).join('')}
      </a>`
    : ''
  const statsHtml = stats && !statsStrip
    ? `<aside class="gallery-rail" style="display:flex;width:112px;flex-shrink:0;flex-direction:column;align-items:center;color:${statsTextColor};" data-accent="${accent}">
        <div class="mt-2" style="margin-top:2px;width:100%;text-align:center;--stat-text:${statsTextColor};">
          ${[
            stats.volume && `<div class="stat-item"><p${statValueStyle(stats.volume)}>${esc(stats.volume)}</p><p>Volume</p></div>`,
            stats.sold && `<div class="stat-item"><p${statValueStyle(stats.sold)}>${esc(stats.sold)}</p><p>Closed</p></div>`,
            stats.avg && `<div class="stat-item"><p${statValueStyle(stats.avg)}>${esc(stats.avg)}</p><p>Avg</p></div>`,
          ]
            .filter(Boolean)
            .join('')}
        </div>
      </aside>`
    : ''

  // A long pill spanning the card's FULL height (not centered in a short column), outlined in the
  // agent's real accent color, sitting right at the card's own left edge. The accent color is set
  // as a --rail-accent custom property directly on this same element (not the unrelated .gallery-rail
  // stats column - see the .gallery-socials comment above for why that was a bug).
  const railHtml = socialsHtml
    ? `<aside class="gallery-socials-rail" style="--rail-accent:${accent};">
        <div class="gallery-socials" style="background:${_cardWashBg(accent, dark)};">${socialsHtml}</div>
      </aside>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* The downloaded project builds on Tailwind's preflight reset (zeroed margins on every
     heading/paragraph/list), which isn't loaded here - without it, bare browser default <p>
     margins (~1em top+bottom each) were silently stacking inside the stats pills and elsewhere,
     making the whole card measurably taller than the design actually needs. This reproduces just
     the part of preflight that matters for this component. */
  * { box-sizing: border-box; }
  h1, h2, h3, h4, h5, h6, p, ul, ol, li, figure, blockquote, dl, dd { margin: 0; padding: 0; list-style: none; }
  html, body { margin: 0; overflow: hidden; }
  /* No padding/background simulating an inbox around the card any more (explicit ask) - just the
     card itself, filling the iframe, so the preview doesn't read as a smaller card floating in a
     separately-colored "window". background:transparent on both html and body (explicit ask,
     repeated: "don't want to see [a] blank page in background... only wan[t] to see the entire
     signature") - without this the iframe's own document defaults to an opaque white canvas, which
     read as its own separate rectangle/page behind the card whenever the card (max-width:720px)
     was narrower than the iframe (which fills its container). Transparent lets the studio page's
     own background show through instead. */
  html { background: transparent; }
  /* padding-bottom + a shadow that fully fades within it (and within the iframe's ~24px side
     margins): the old 0 28px 70px shadow reached well past the iframe's own edges and got cut off
     there, which read as a grey/white rectangle around the card (explicit ask: "remove that so it's
     just the preview floating there"). overflow:hidden above kills the stray scrollbar. */
  body { display: flex; justify-content: center; align-items: flex-start; padding: 2px 0 26px; background: transparent; font-family: ${fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'}; color: ${textColor}; box-sizing: border-box; }
  [style*="--signature-accent"] {}
  ${GALLERY_CSS}
  .gallery-rail { --signature-accent: ${accent}; }
  .stats-strip { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 8px 10px 8px 14px; border: 1px solid var(--signature-accent); border-radius: 10px; color: #fff; text-decoration: none; background: linear-gradient(90deg, color-mix(in srgb, var(--signature-accent) 92%, white), color-mix(in srgb, var(--signature-accent) 72%, #171817)); animation: stats-rise .8s .2s both; }
  .stats-strip .ss-head { flex: 0 0 auto; margin-right: 8px; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,.8), 0 1px 4px rgba(0,0,0,.3); }
  .stats-strip .ss-head i { display: block; width: 14px; height: 2px; margin-top: 5px; border-radius: 2px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .stats-strip .ss-pill { flex: 1 1 0%; display: flex; flex-direction: column; align-items: center; padding: 7px 6px; border: 1px solid rgba(255,255,255,.3); border-radius: 9px; background: rgba(255,255,255,.13); box-shadow: inset 0 1px rgba(255,255,255,.14); }
  .stats-strip .ss-pill b { font-size: 17px; font-weight: 800; line-height: 1; letter-spacing: -.03em; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.9), 0 2px 8px rgba(0,0,0,.45); }
  .stats-strip .ss-pill small { margin-top: 4px; font-size: 8.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,.7); }
</style>
</head>
<body>
  <div class="signature-card signature-gallery${luxe ? ` lx${dark ? ' lx-dark' : ''}` : ''}" style="overflow:hidden;border-radius:18px;border:1px solid ${cardBorder};background:${cardBg};box-shadow:0 12px 26px -12px rgba(0,0,0,${dark ? '.55' : '.32'})${luxe ? `,0 26px 50px -34px rgba(${mp.deepRgb},.55);${metalVars(metal)}` : ''};max-width:720px;">
    ${luxe ? `<div class="lx-sig-layer"><div class="lx-sig-grid"></div><div class="lx-sig-aurora"></div><div class="lx-sig-aurora lx-sig-aurora-b"></div><div class="lx-sig-spot"></div><div class="lx-sig-beam"></div><div class="lx-sig-edge"></div><div class="lx-sig-leak"></div>${LX_MOTIFS}${[[12, 18, 0], [46, 10, 1.6], [70, 26, 3.1], [88, 60, 0.8]].map(([l, t, d]) => `<span class="lx-sig-spark" style="left:${l}%;top:${t}%;animation-delay:${d}s"></span>`).join('')}${[[22, 88, 0.4], [38, 70, 2.2], [58, 92, 1.2], [76, 80, 3.4], [94, 74, 2.8]].map(([l, t, d]) => `<span class="lx-sig-spark lx-sig-rise" style="left:${l}%;top:${t}%;animation-delay:${d}s"></span>`).join('')}</div>` : ''}
    <div class="gallery-inner" style="display:flex;min-height:150px;">
      ${railHtml}
      <div class="gallery-main" style="min-width:0;flex:1 1 0%;padding:16px 20px 16px ${railHtml ? '12px' : '20px'};">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="flex:0 0 auto;width:${PORTRAIT_COLUMN_W}px;">${portraitHtml}</div>
          <div style="min-width:0;flex:1 1 0%;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h3 class="${luxe ? 'lx-name' : ''}" style="margin:0;font-size:${luxe ? '22px' : '21px'};font-weight:600;letter-spacing:-.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${luxe && identity.name.trim().includes(' ') ? `<span class="lx-first">${esc(identity.name.trim().split(' ').slice(0, -1).join(' '))}</span> <em>${esc(identity.name.trim().split(' ').slice(-1)[0])}</em>` : esc(identity.name)}</h3>
              ${badgeHtml}
            </div>
            ${subLine}
            ${contactHtml}
            ${actionsHtml}
          </div>
        </div>
        ${rotationHtml}
        ${listingHtml}
        ${saleCardsHtml}
        ${stripHtml}
      </div>
      ${statsHtml}
    </div>
  </div>
  <script>
  (function () {
    // This is a live PREVIEW inside the Studio editor's own iframe, not the installed signature -
    // every link in it (CTA buttons, the listing/recent-sales card, Save Contact, the social
    // icons) is a real <a href> pointing at a real form/page so the copied HTML matches exactly,
    // but clicking one here should never actually navigate/load anything inside the editor. A
    // capturing document-level listener catches every click before it reaches the link (including
    // ones added later, e.g. via a config change re-rendering this srcDoc) rather than binding to
    // each <a> individually. Skipped entirely when this HTML is what's actually being copied to
    // the clipboard (see the interactive param) - a real installed signature's links need to
    // actually work.
    // Luxe: a warm gold spotlight follows the pointer across the card.
    if (${luxe}) {
      var lxCard = document.querySelector('.signature-gallery.lx');
      if (lxCard) lxCard.addEventListener('mousemove', function (e) {
        var r = lxCard.getBoundingClientRect();
        lxCard.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        lxCard.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    }
    if (${interactive}) {
      document.addEventListener('click', function (e) {
        var el = e.target;
        while (el && el !== document.body) {
          if (el.tagName === 'A') { e.preventDefault(); return; }
          el = el.parentElement;
        }
      }, true);

      // Copy-to-clipboard buttons next to Mobile/Email in the contact row - falls back to the
      // old execCommand('copy') path when the async Clipboard API isn't available (some sandboxed
      // iframe contexts restrict navigator.clipboard even in a modern browser).
      document.querySelectorAll('.contact-copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var text = btn.getAttribute('data-copy') || '';
          var flash = function () {
            btn.classList.add('copied');
            setTimeout(function () { btn.classList.remove('copied'); }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(flash, flash);
          } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (err) {}
            document.body.removeChild(ta);
            flash();
          }
        });
      });
    }

    // Every element with a one-shot "enter" animation - replaying it every 8s (by clearing the
    // inline animation, forcing a reflow, then handing control back to the CSS rule) makes the
    // whole card - rail icons, portrait, listing block, each stat pill, each action button -
    // stunningly pop back in together instead of just sitting there or (the old approach)
    // quietly bobbing/drifting forever, which read as jittery rather than intentional.
    var SELECTORS = [
      '.signature-card',
      '.signature-gallery .portrait-frame',
      '.signature-gallery .gallery-main > div:first-child > div:last-child',
      '.signature-gallery .gallery-rail',
      '.signature-gallery .gallery-rail .stat-item',
      '.signature-gallery .gallery-socials',
      '.signature-gallery .gallery-socials .social-dot',
      '.signature-gallery .gallery-main',
      '.gallery-listing',
      '.mini-bubble',
      '.signature-gallery .gallery-main .gallery-action',
    ];
    function replay() {
      var els = [];
      SELECTORS.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) { els.push(el); });
      });
      els.forEach(function (el) { el.style.animation = 'none'; });
      void document.body.offsetHeight;
      els.forEach(function (el) { el.style.animation = ''; });
    }
    // The editor page posts this whenever the agent switches tabs, so the entrance replays right
    // then - the only time this entrance animation plays any more besides the natural first paint.
    // Used to also repeat on its own every 8s forever (explicit ask: "stop the animation every few
    // seconds on the site version preview" - the same "distracting, not stunning, especially
    // anywhere this preview sits on a page longer than a few seconds" reasoning that already
    // killed the recent-sales bubble's own repeating re-scroll below, just never applied here too).
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'signature-preview-replay') replay();
    });
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Recent-sale mode: the "RECENT SALES" bubble always shows 3 mini cards - with more than 3,
    // plays through the rest of the list ONCE (never fewer than 3 visible at once), not on a
    // repeating timer any more (explicit ask: "remove the automatic animation every few seconds...
    // it should just do that on load or reveal if someone scrolls to see it") - a card that kept
    // re-scrolling itself forever read as distracting/gimmicky, especially anywhere this preview
    // might sit on a page longer than a few seconds (see the "other places on the site" idea).
    // Fires once via IntersectionObserver (which fires immediately if the card is already in the
    // viewport at load, so "on load" and "on scroll into view" are the same mechanism), then
    // disconnects - no pause-on-hover needed any more since there's nothing left to interrupt.
    var rot = document.querySelector('.rot-wrap');
    if (rot && !reduceMotion) {
      var slides = rot.querySelectorAll('.rot-slide');
      var dots = rot.querySelectorAll('.rot-dots i');
      var cur = 0, hover = false, seen = !window.IntersectionObserver, onFor = 0;
      rot.addEventListener('mouseenter', function () { hover = true; });
      rot.addEventListener('mouseleave', function () { hover = false; });
      if (window.IntersectionObserver) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; if (!seen) onFor = 0; }, { threshold: 0.5 }).observe(rot);
      // Counts only time the card is on screen (and not hovered): a slide stays up for 6s of
      // actually being looked at, then the next one comes in.
      setInterval(function () {
        if (hover || !seen || document.hidden || slides.length < 2) return;
        onFor += 500;
        if (onFor < 6000) return;
        onFor = 0;
        slides[cur].classList.remove('is-on'); if (dots[cur]) dots[cur].classList.remove('is-on');
        cur = (cur + 1) % slides.length;
        slides[cur].classList.add('is-on'); if (dots[cur]) dots[cur].classList.add('is-on');
      }, 500);
    }

    var miniTrack = document.querySelector('.rot-wrap') ? null : document.querySelector('.mini-track');
    if (miniTrack && !reduceMotion) {
      var miniSlides = miniTrack.querySelectorAll('.mini-slide');
      var miniMaxIndex = Math.max(0, miniSlides.length - 3);
      if (miniMaxIndex > 0) {
        var playMiniReveal = function () {
          var miniIndex = 0;
          var step = function () {
            miniIndex += 1;
            // Each slide's flex-basis is (100% - 12px)/3 (100% of the TRACK's own width, minus the
            // 2 6px gaps between 3 visible slides), so one full "slide + gap" step is (100% + 6px)/3
            // of the track width, NOT a flat 100/3% - that flat version was exactly 2px short per
            // step (the 6px gap's contribution got dropped), which is why a sliver of the next card
            // stayed visible after every scroll instead of fully sliding off. calc() reproduces the
            // exact step: 100/3% of the track's own width, plus the 2px/step this was missing.
            miniTrack.style.transform = 'translateX(calc(-' + (miniIndex * 100 / 3) + '% - ' + (miniIndex * 2) + 'px))';
            if (miniIndex < miniMaxIndex) setTimeout(step, 1100);
          };
          setTimeout(step, 700);
        };
        if (window.IntersectionObserver) {
          var miniObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                playMiniReveal();
                miniObserver.disconnect();
              }
            });
          }, { threshold: 0.4 });
          miniObserver.observe(miniTrack);
        } else {
          playMiniReveal();
        }
      }
    }

    // Reports the real rendered height to the parent page so it can size the iframe to fit the
    // actual card instead of a guessed fixed box - eliminates the dead white space below a
    // shorter card (no banner/stats) without risking clipping a taller one. postMessage works
    // fine from this sandboxed iframe's opaque origin - the parent just checks event.data.type.
    // Meaningless once this is a real installed signature (there's no parent frame listening), so
    // skipped there too (unless the caller embeds it in a page that does listen - reportHeight).
    if (${reportHeight}) {
      var lastHeight = 0;
      function reportHeight() {
        var h = document.body.scrollHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          window.parent.postMessage({ type: 'signature-preview-height', height: h }, '*');
        }
      }
      reportHeight();
      if (window.ResizeObserver) {
        new ResizeObserver(reportHeight).observe(document.body);
      } else {
        window.addEventListener('load', reportHeight);
      }
    }
  })();
  </script>
</body>
</html>`
}
