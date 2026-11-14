// Every keyframe + bespoke class the pitch deck uses. Fixed-size canvas (see PitchDeck), so plain
// px everywhere. No backdrop blur and no animated filter blur (site-wide lag rule, 10/11).
export const PITCH_CSS = `
.pd-root{--gold:#C9A24D;--gold2:#e8c97a;--gold3:#f3dfa8;--ink:#0b0d14;color:#fff;background:#07080c;-webkit-font-smoothing:antialiased;user-select:none;-webkit-tap-highlight-color:transparent}
.pd-bg{position:absolute;inset:0;overflow:hidden;background:linear-gradient(135deg,#0a0c13 0%,#111a2b 52%,#2a2116 100%)}
.pd-aurora{position:absolute;inset:-40%;background:radial-gradient(34% 34% at 30% 34%,rgba(201,162,77,.20),transparent),radial-gradient(36% 36% at 72% 66%,rgba(78,108,170,.20),transparent)}
.pd-floor{position:absolute;left:-30%;right:-30%;bottom:-6%;height:46%;transform:perspective(520px) rotateX(66deg);transform-origin:50% 100%;background-image:linear-gradient(rgba(201,162,77,.26) 1px,transparent 1px),linear-gradient(90deg,rgba(201,162,77,.26) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:linear-gradient(to top,#000,rgba(0,0,0,.5) 45%,transparent);mask-image:linear-gradient(to top,#000,rgba(0,0,0,.5) 45%,transparent)}
.pd-vig{position:absolute;inset:0;background:radial-gradient(ellipse 78% 74% at 50% 46%,transparent 42%,rgba(4,5,8,.82) 100%)}
.pd-dust{position:absolute;width:3px;height:3px;border-radius:99px;background:#f1d58b;box-shadow:0 0 8px 2px rgba(241,213,139,.5);opacity:0;animation:pdDust 8s ease-in-out infinite}
.pd-serif{font-family:var(--pd-serif),Georgia,serif}
.pd-gold{background:linear-gradient(100deg,#b88a2e 0%,#e8c97a 35%,#fff1c8 50%,#e8c97a 65%,#b88a2e 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;background-position:30% 0;padding:0 .12em .12em 0;margin:0 -.12em -.12em 0}
.pd-rise{opacity:0;animation:pdRise .55s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--d,0ms)}
.pd-fade{opacity:0;animation:pdFade 1s ease forwards;animation-delay:var(--d,0ms)}
.pd-sweep{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 32%,rgba(241,213,139,.13) 46%,rgba(255,255,255,.08) 50%,transparent 62%);transform:translateX(-120%);animation:pdSweep 1.5s cubic-bezier(.4,0,.2,1) .1s forwards}
.pd-kicker{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(201,162,77,.45);background:rgba(201,162,77,.10);color:var(--gold2);border-radius:99px;font-weight:900;text-transform:uppercase;letter-spacing:.24em}
.pd-ai{display:inline-flex;align-items:center;gap:5px;border-radius:99px;background:linear-gradient(90deg,#C9A24D,#f1d58b,#C9A24D);color:#111827;font-weight:900;letter-spacing:.08em;box-shadow:0 0 16px rgba(201,162,77,.5)}
.pd-tile{display:grid;place-items:center;border-radius:26%;background:linear-gradient(135deg,#f3dfa8,#C9A24D 55%,#8b6a2b);color:#111827;box-shadow:0 18px 40px -12px rgba(201,162,77,.55)}

/* how-it's-done chips (left) */
.pd-chip{display:flex;align-items:center;gap:12px;opacity:.38;transition:opacity .5s ease}
.pd-chip[data-s="on"],.pd-chip[data-s="done"]{opacity:1}
.pd-num{display:grid;place-items:center;flex:none;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);font-weight:900;transition:all .45s ease}
.pd-chip[data-s="on"] .pd-num{border-color:var(--gold2);color:#111827;background:var(--gold2);box-shadow:0 0 0 7px rgba(232,201,122,.16)}
.pd-chip[data-s="done"] .pd-num{border-color:var(--gold);color:var(--gold2);background:rgba(201,162,77,.14)}
.pd-link{height:2px;flex:1;min-width:14px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden}
.pd-link i{display:block;height:100%;width:0;background:var(--gold);transition:width .9s ease}
.pd-link[data-on="1"] i{width:100%}

/* the step card (right) that plays before the result shows */
.pd-stepcard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:36px;border:1px solid rgba(201,162,77,.35);background:linear-gradient(160deg,#141b2c,#0d111b 60%,#1d1810);box-shadow:0 40px 90px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06);transition:opacity .55s ease,transform .7s cubic-bezier(.2,.8,.2,1);overflow:hidden}
.pd-stepcard[data-off="1"]{opacity:0;transform:translate(-50%,-50%) scale(.9);pointer-events:none}
.pd-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0;transform:translateY(26px);transition:opacity .22s ease,transform .5s cubic-bezier(.2,.8,.2,1)}
.pd-face[data-on="1"]{opacity:1;transform:none;transition:opacity .45s ease .24s,transform .6s cubic-bezier(.2,.8,.2,1) .24s}
.pd-face[data-past="1"]{transform:translateY(-26px)}
.pd-tap{position:absolute;border-radius:99px;border:2px solid var(--gold2);opacity:0}
.pd-face[data-on="1"] .pd-tap{animation:pdTap 1s ease-out .25s 1}
.pd-face[data-on="1"] .pd-pop{animation:pdPop .6s cubic-bezier(.3,1.5,.5,1) both}
.pd-bars{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:8px}
.pd-bars i{display:block;height:4px;width:46px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden}
.pd-bars i b{display:block;height:100%;width:0;background:var(--gold2)}
.pd-bars i[data-on="1"] b{width:100%;transition:width 2.1s linear}
.pd-bars i[data-done="1"] b{width:100%}

/* the result */
.pd-result{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateY(24px) scale(.975);transition:opacity .45s ease,transform .6s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.pd-result[data-on="1"]{opacity:1;transform:none}
.pd-result[data-on="1"] .pd-zoom{pointer-events:auto;cursor:zoom-in}
.pd-look{display:inline-flex;align-items:center;border-radius:99px;border:1.5px solid rgba(201,162,77,.7);background:rgba(201,162,77,.12);color:var(--gold3);font-weight:900;cursor:pointer;transition:background .2s,color .2s}
.pd-look:hover{background:var(--gold2);color:#111827}
.pd-why{display:flex;align-items:flex-start;opacity:0;transform:translateY(16px);transition:opacity .7s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
.pd-why[data-on="1"]{opacity:1;transform:none}
.pd-check{display:grid;place-items:center;flex:none;border-radius:99px;background:rgba(201,162,77,.16);color:var(--gold2);border:1px solid rgba(201,162,77,.5)}

/* devices */
.pd-phone{position:relative;border-radius:46px;background:#08090c;box-shadow:0 0 0 1.5px rgba(232,201,122,.38),0 0 0 9px #101219,0 0 0 10.5px rgba(255,255,255,.08),0 50px 100px -30px rgba(0,0,0,.9),0 0 90px -20px rgba(201,162,77,.28)}
.pd-phone .pd-screen{position:absolute;inset:0;border-radius:38px;overflow:hidden;background:#111}
.pd-notch{position:absolute;left:50%;top:10px;width:86px;height:22px;margin-left:-43px;border-radius:99px;background:#08090c;z-index:3}
.pd-laptop .pd-lid{position:relative;border-radius:18px 18px 4px 4px;background:#0b0c10;padding:12px 12px 14px;box-shadow:0 0 0 1.5px rgba(232,201,122,.32),0 50px 100px -34px rgba(0,0,0,.9),0 0 110px -30px rgba(201,162,77,.3)}
.pd-laptop .pd-screen{position:relative;border-radius:8px;overflow:hidden;background:#111}
.pd-laptop .pd-base{height:15px;margin:0 -56px;border-radius:3px 3px 16px 16px;background:linear-gradient(#2a2d36,#15171d);box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
.pd-laptop .pd-base::after{content:"";display:block;width:120px;height:5px;margin:0 auto;border-radius:0 0 8px 8px;background:#0b0c10}
.pd-tablet{position:relative;border-radius:30px;background:#08090c;box-shadow:0 0 0 1.5px rgba(232,201,122,.36),0 0 0 12px #101219,0 0 0 13.5px rgba(255,255,255,.08),0 50px 100px -30px rgba(0,0,0,.9),0 0 90px -20px rgba(201,162,77,.28)}
.pd-tablet .pd-screen{position:absolute;inset:0;border-radius:20px;overflow:hidden;background:#111}
.pd-shot{display:block;width:100%;height:auto;will-change:transform}
.pd-glare{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.07) 0%,transparent 28%)}

/* kit sheets */
.pd-sheet{position:absolute;left:50%;top:50%;border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 30px 60px -18px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.2);transform:translate(-50%,-50%) rotate(0deg) scale(.86);transition:transform .8s cubic-bezier(.2,.8,.2,1);transition-delay:var(--sd,0ms)}
.pd-result[data-on="1"] .pd-sheet{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r))}
.pd-tag{white-space:nowrap;cursor:zoom-in;border-radius:99px;background:#0d111b;border:1px solid rgba(201,162,77,.5);color:var(--gold3);font-weight:900;letter-spacing:.04em;opacity:0;transition:opacity .4s ease .7s;box-shadow:0 10px 24px -8px rgba(0,0,0,.7)}
.pd-result[data-on="1"] .pd-tag{opacity:1}

/* before / after */
.pd-cmp{position:relative;overflow:hidden;border-radius:20px;box-shadow:0 0 0 1.5px rgba(232,201,122,.35),0 40px 80px -30px rgba(0,0,0,.9)}
.pd-cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pd-result[data-on="1"] .pd-after{animation:pdWipe 5.5s cubic-bezier(.6,0,.4,1) var(--wd,.6s) infinite alternate both}
.pd-after{clip-path:inset(0 100% 0 0)}
.pd-bar{position:absolute;top:0;bottom:0;left:0;width:3px;margin-left:-1.5px;background:var(--gold3);box-shadow:0 0 18px 2px rgba(243,223,168,.8)}
.pd-result[data-on="1"] .pd-bar{animation:pdBar 5.5s cubic-bezier(.6,0,.4,1) var(--wd,.6s) infinite alternate both}
.pd-lab{position:absolute;bottom:14px;border-radius:99px;background:rgba(8,9,12,.82);font-weight:900;letter-spacing:.12em;text-transform:uppercase}

/* design wall */
.pd-wall{position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent)}
.pd-col{display:flex;flex-direction:column;animation:pdUp var(--dur,48s) linear infinite}
.pd-col[data-rev="1"]{animation-name:pdDown}
.pd-col img{display:block;width:100%;border-radius:12px;box-shadow:0 14px 30px -12px rgba(0,0,0,.8),0 0 0 1px rgba(232,201,122,.22)}

/* stack slide */
.pd-pill{position:relative;display:inline-flex;align-items:center;border-radius:99px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);font-weight:800;color:#d5d8df;transition:color .6s ease,opacity .6s ease}
.pd-pill s{position:absolute;left:10px;right:10px;top:50%;height:2.5px;margin-top:-1px;border-radius:9px;background:var(--gold);transform:scaleX(0);transform-origin:0 50%;transition:transform .5s ease}
.pd-pill[data-x="1"]{color:#7d828d}
.pd-pill[data-x="1"] s{transform:scaleX(1)}
.pd-card{border-radius:30px;border:1px solid rgba(201,162,77,.4);background:linear-gradient(160deg,#161d2e,#0d111b 60%,#221b10);box-shadow:0 40px 90px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06)}
.pd-pop2{opacity:0;transform:scale(.92) translateY(20px);transition:opacity .7s ease,transform .9s cubic-bezier(.2,.8,.2,1)}
.pd-pop2[data-on="1"]{opacity:1;transform:none}
.pd-mini{border-radius:22px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(160deg,rgba(255,255,255,.055),rgba(255,255,255,.02))}

.pd-slide{transition:opacity .13s ease,transform .13s ease}
.pd-slide[data-leave="1"]{opacity:0;transform:translateY(-10px)}

/* play / pause + slider under a result */
.pd-scrubwrap{position:absolute;left:0;right:0;display:flex;justify-content:center;opacity:0;pointer-events:none;transition:opacity .4s ease .5s;z-index:5}
.pd-scrubwrap[data-on="1"]{opacity:1;pointer-events:auto}
.pd-scrub{display:inline-flex;align-items:center;border-radius:99px;border:1px solid rgba(201,162,77,.5);background:#0d111b;box-shadow:0 12px 30px -10px rgba(0,0,0,.8)}
.pd-scrub button{display:grid;place-items:center;border-radius:99px;background:var(--gold2);color:#111827;cursor:pointer;flex:none}
.pd-scrub input{-webkit-appearance:none;appearance:none;height:5px;border-radius:9px;background:rgba(255,255,255,.22);outline:none;cursor:pointer}
.pd-scrub input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:99px;background:var(--gold3);box-shadow:0 0 0 4px rgba(243,223,168,.18);cursor:grab}
.pd-scrub input::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:99px;background:var(--gold3);cursor:grab}
/* sign-in: the camera view over the phone, and the ring on the sheet's code */
.pd-scan{position:absolute;inset:0;overflow:hidden;background:#0b0b0d;opacity:0;pointer-events:none;transition:opacity .45s ease}
.pd-scan[data-on="1"]{opacity:1}
.pd-frame{position:absolute;left:50%;top:50%;width:176px;height:176px;margin:-88px 0 0 -88px;border-radius:22px;box-shadow:0 0 0 3px var(--gold3),0 0 0 999px rgba(0,0,0,.28)}
.pd-frame i{position:absolute;left:10px;right:10px;top:8px;height:3px;border-radius:9px;background:var(--gold3);box-shadow:0 0 14px 2px rgba(243,223,168,.9)}
.pd-scan[data-on="1"] .pd-frame i{animation:pdScanline 1.4s ease-in-out infinite alternate}
.pd-qr{position:absolute;width:86px;height:86px;margin:-43px 0 0 -43px;border-radius:14px;border:3px solid var(--gold);opacity:0;transition:opacity .4s ease}
.pd-qr[data-on="1"]{opacity:1;animation:pdQr 1.4s ease-in-out infinite alternate}
@keyframes pdScanline{from{transform:translateY(0)}to{transform:translateY(156px)}}
@keyframes pdQr{from{box-shadow:0 0 0 0 rgba(201,162,77,.55)}to{box-shadow:0 0 0 12px rgba(201,162,77,0)}}

/* chrome */
.pd-ctl{display:grid;place-items:center;border-radius:99px;border:1px solid rgba(255,255,255,.14);background:rgba(10,12,18,.7);color:#cfd3db;cursor:pointer;transition:color .2s,border-color .2s}
.pd-ctl:hover{color:var(--gold3);border-color:rgba(201,162,77,.7)}
.pd-seg{flex:1;padding:12px 0;cursor:pointer}
.pd-seg i{display:block;height:3px;border-radius:9px;background:rgba(255,255,255,.16);transition:background .4s}
.pd-seg:hover i{background:rgba(255,255,255,.4)}
.pd-seg[data-on="1"] i{background:var(--gold)}
.pd-seg[data-cur="1"] i{background:var(--gold3);box-shadow:0 0 10px rgba(243,223,168,.7)}

@keyframes pdSpin{to{transform:rotate(360deg)}}
@keyframes pdFloor{from{background-position:0 0}to{background-position:0 64px}}
@keyframes pdDust{0%{opacity:0;transform:translateY(14px) scale(.6)}25%{opacity:.85}70%{opacity:.45}100%{opacity:0;transform:translateY(-60px)}}
@keyframes pdShine{0%{background-position:100% 0}55%,100%{background-position:0 0}}
@keyframes pdRise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes pdFade{to{opacity:1}}
@keyframes pdSweep{to{transform:translateX(120%)}}
@keyframes pdAi{0%,100%{box-shadow:0 0 14px rgba(201,162,77,.5)}50%{box-shadow:0 0 28px rgba(241,213,139,.9)}}
@keyframes pdTap{0%{opacity:.9;transform:scale(.5)}100%{opacity:0;transform:scale(1.9)}}
@keyframes pdPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes pdScroll{from{transform:translateY(0)}to{transform:translateY(calc(-100% + var(--vh)))}}
@keyframes pdWipe{0%,12%{clip-path:inset(0 100% 0 0)}88%,100%{clip-path:inset(0 0 0 0)}}
@keyframes pdBar{0%,12%{left:0}88%,100%{left:100%}}
@keyframes pdUp{from{transform:translateY(0)}to{transform:translateY(-50%)}}
@keyframes pdDown{from{transform:translateY(-50%)}to{transform:translateY(0)}}
@keyframes pdHint{0%,100%{transform:translateX(0)}50%{transform:translateX(8px)}}
@media (prefers-reduced-motion:reduce){.pd-aurora,.pd-floor,.pd-dust,.pd-gold,.pd-ai{animation:none}}
`
