// The live site preview's outlines, tags and "what that does" rings - shared by the website editor
// (WebsiteEditorShell) and the setup flow's mini site preview (SiteMiniPreview).
// Outlines + tags for the live preview (sized for the real-size preview, not Spotlight's scaled one).
export const PREVIEW_FX_CSS = `
.ohp-prev [data-ohp-block]{position:relative}
.ohp-prev [data-ohp-block]::after,.ohp-prev[data-ohp-hfocus] .ohp-zoom>header::after{content:"";position:absolute;inset:calc(6px/var(--z,1));border-radius:calc(16px/var(--z,1));pointer-events:none;z-index:40;opacity:0;transition:opacity .4s ease}
.ohp-prev [data-ohp-block][data-ohp-focus]::after,.ohp-prev[data-ohp-hfocus] .ohp-zoom>header::after{opacity:1;border:calc(2px/var(--z,1)) solid #C9A24D;box-shadow:0 0 0 4px rgba(201,162,77,.16),0 0 40px rgba(201,162,77,.35),inset 0 0 30px rgba(201,162,77,.12);animation:ohpFocusIn .5s ease both}
.ohp-prev [data-ohp-block][data-ohp-focus]::before,.ohp-prev[data-ohp-hfocus] .ohp-zoom>header::before,.ohp-prev [data-ohp-fx]::before{position:absolute;left:50%;z-index:41;padding:calc(6px/var(--z,1)) calc(13px/var(--z,1));border-radius:999px;font:800 calc(11px/var(--z,1))/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;pointer-events:none;transform:translateX(-50%);box-shadow:0 8px 20px -8px rgba(0,0,0,.4)}
.ohp-prev [data-ohp-block][data-ohp-focus]::before{content:attr(data-ohp-tag);top:calc(16px/var(--z,1));background:#C9A24D;color:#111827;animation:ohpTagIn .45s ease both}
.ohp-prev[data-ohp-hfocus] .ohp-zoom>header::before{content:var(--ohp-htag);top:auto;bottom:calc(-14px/var(--z,1));background:#C9A24D;color:#111827;text-transform:none;letter-spacing:.02em;animation:ohpTagIn .45s ease both}
.ohp-prev [data-ohp-block][data-ohp-fx]::after{opacity:1}
.ohp-prev [data-ohp-block][data-ohp-fx="in"]::after,.ohp-prev [data-ohp-block][data-ohp-fx="move"]::after{border:calc(3px/var(--z,1)) solid #C9A24D;box-shadow:0 0 0 6px rgba(201,162,77,.18),0 0 60px rgba(201,162,77,.55),inset 0 0 50px rgba(201,162,77,.22);animation:ohpGlowIn 2.8s ease both}
.ohp-prev [data-ohp-block][data-ohp-fx="out"]::after{border:calc(3px/var(--z,1)) solid #ef4444;box-shadow:0 0 0 6px rgba(239,68,68,.15),0 0 60px rgba(239,68,68,.45),inset 0 0 50px rgba(239,68,68,.18);animation:ohpGlowOut 1.7s ease both}
.ohp-prev [data-ohp-block][data-ohp-fx]::before{top:calc(22px/var(--z,1))}
.ohp-prev [data-ohp-block][data-ohp-fx="in"]::before{content:"✓  Added to your site";background:#C9A24D;color:#111827;animation:ohpTag 2.8s ease both}
.ohp-prev [data-ohp-block][data-ohp-fx="move"]::before{content:"Moved";background:#C9A24D;color:#111827;animation:ohpTag 1.6s ease both}
.ohp-prev [data-ohp-block][data-ohp-fx="out"]::before{content:"Removing from your site";background:#ef4444;color:#fff;animation:ohpTag 1.7s ease both}
.ohp-addr{animation:ohpAddr 1.8s ease-in-out 2}
.ohp-prev[data-ohp-spotting] [data-ohp-block][data-ohp-focus]::before,.ohp-prev[data-ohp-spotting][data-ohp-hfocus] .ohp-zoom>header::before,.ohp-prev[data-ohp-spotting] [data-ohp-block][data-ohp-focus]::after,.ohp-prev[data-ohp-spotting][data-ohp-hfocus] .ohp-zoom>header::after{opacity:0!important;transition:opacity .2s ease}
.ohp-spot{position:absolute;z-index:60;pointer-events:none;border-radius:16px;transition:top .3s ease,left .3s ease,width .3s ease,height .3s ease,opacity .4s ease}
.ohp-spot[data-kind="on"],.ohp-spot[data-kind="change"]{border:3px solid #C9A24D;box-shadow:0 0 0 6px rgba(201,162,77,.18),0 0 60px rgba(201,162,77,.55),inset 0 0 50px rgba(201,162,77,.2);animation:ohpSpotIn 2.4s ease both}
.ohp-spot[data-kind="off"]{border:3px solid #ef4444;box-shadow:0 0 0 6px rgba(239,68,68,.15),0 0 60px rgba(239,68,68,.45),inset 0 0 50px rgba(239,68,68,.16);animation:ohpGlowOut 1.5s ease both}
.ohp-spot[data-fading]{opacity:0}
.ohp-spot-tag{position:absolute;left:50%;z-index:1;padding:6px 13px;border-radius:999px;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap;max-width:calc(100vw - 40px);overflow:hidden;text-overflow:ellipsis;pointer-events:none;transform:translateX(-50%);box-shadow:0 8px 20px -8px rgba(0,0,0,.45);background:#C9A24D;color:#111827;animation:ohpTagIn .4s ease both}
.ohp-spot[data-kind="off"] .ohp-spot-tag{background:#ef4444;color:#fff}
.ohp-spot-tag[data-at="in"]{top:14px}
.ohp-spot-tag[data-at="above"]{bottom:calc(100% + 8px)}
.ohp-spot-tag[data-at="below"]{top:calc(100% + 8px)}
.ohp-spot-tag[data-align="start"]{left:0;transform:none;animation-name:ohpTagInFlat}
.ohp-spot-tag[data-align="end"]{left:auto;right:0;transform:none;animation-name:ohpTagInFlat}
.ohp-spot-tag[data-at="static"]{position:relative;left:auto;transform:none;margin-top:18px;animation-name:ohpTagInFlat}
@keyframes ohpTagInFlat{from{opacity:0;translate:0 -8px}to{opacity:1;translate:0 0}}
.ohp-loader-demo{animation:ohpDemo 3.2s ease both}
@keyframes ohpSpotIn{0%{opacity:0;transform:scale(1.02)}10%{opacity:1;transform:none}30%{opacity:.55}48%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes ohpDemo{0%{opacity:0}10%,85%{opacity:1}100%{opacity:0}}
@keyframes ohpFocusIn{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}
@keyframes ohpTagIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes ohpGlowIn{0%{opacity:0}12%{opacity:1}30%{opacity:.5}48%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes ohpGlowOut{0%{opacity:0}20%{opacity:1}40%{opacity:.6}60%{opacity:1}100%{opacity:1}}
@keyframes ohpTag{0%{opacity:0;transform:translate(-50%,-10px)}12%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
@keyframes ohpAddr{0%,100%{box-shadow:0 0 0 0 rgba(201,162,77,.5)}50%{box-shadow:0 0 0 6px rgba(201,162,77,0)}}
@media (prefers-reduced-motion: reduce){.ohp-spot,.ohp-spot-tag,.ohp-loader-demo,.ohp-prev [data-ohp-block]::after,.ohp-prev [data-ohp-block]::before,.ohp-prev .ohp-zoom>header::after,.ohp-prev .ohp-zoom>header::before,.ohp-addr{animation:none!important}}
`
