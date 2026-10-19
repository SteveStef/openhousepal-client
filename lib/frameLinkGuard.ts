// Inline script (root layout) for app pages that an agent's IDX site shows inside a frame - the
// Agent Hub (/about, /hub, /<hub-slug>/...), Showcases, open-house sign-in / Guest Pass, CMAs and
// form windows. Inside that frame, a link that leaves those pages (the hub's website icon, a
// listing's Spotlight or IDX page, a social profile, the agent's own site) used to open INSIDE the
// frame, so the visitor saw the IDX site's header, the hub, and a second copy of the whole site
// stacked inside it (user, 10/19: "3 headers"). Such links now open as a normal top-level page.
//
// Only active when the top page is an agent site: a different origin (the agent's
// subdomain / own domain framing openhousepal.com) or, in local testing, /ohp-site-render/...
// Our own same-origin previews (Studio editors, setup, kiosk) keep full control of their frames.
// Links that stay on the framed page's own app paths (hub -> Sales, a form, a Showcase home) are
// left alone so they keep working inside the site's frame, under its one header.
export const FRAME_LINK_GUARD_SCRIPT = `(function(){try{
if(window.self===window.top)return;
var pp=null;try{pp=window.top.location.pathname}catch(e){pp=null}
if(pp!==null&&pp.indexOf('/ohp-site-render/')!==0)return;
var site=/^\\/ohp-site-render\\//;
document.addEventListener('click',function(e){
if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;
var t=(a.getAttribute('target')||'').toLowerCase();if(t&&t!=='_self')return;
if(a.hasAttribute('download'))return;
var u;try{u=new URL(a.href,location.href)}catch(x){return}
if(u.protocol!=='http:'&&u.protocol!=='https:')return;
if(u.origin===location.origin&&!site.test(u.pathname)&&u.pathname!=='/')return;
a.setAttribute('target','_top');
},true);
}catch(e){}})();`
