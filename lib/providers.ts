// Which sign-in providers agents can connect right now. Google (Calendar + Gmail) is fully set up
// and verified; Outlook (Calendar + email) shows "Coming soon" everywhere until it is. Flip to true
// to turn every Outlook connect button back on at once.
export const OUTLOOK_LIVE = false

/** Fired (localStorage + same-tab event) when a connection finishes in its own tab, so the page
 * that opened it refreshes without a reload. See app/settings/connected. */
export const CONNECTED_EVENT = 'ohp-connected'

const SIGN_IN_WAIT_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening {provider}… | OpenHousePal</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827}
  @media (prefers-color-scheme:dark){body{background:#0B0B0B;color:#fff}}
  .box{text-align:center;padding:24px}
  svg{width:64px;height:64px;animation:rise 1.6s ease-in-out infinite}
  @keyframes rise{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .brand{margin-top:14px;font-weight:800;font-size:22px;letter-spacing:-.02em}
  .brand b{color:#C9A24D}
  .msg{margin-top:8px;font-size:15px;font-weight:600;color:#6B7280}
  .bar{margin:18px auto 0;width:140px;height:4px;border-radius:4px;background:rgba(201,162,77,.2);overflow:hidden}
  .bar i{display:block;width:40%;height:100%;border-radius:4px;background:#C9A24D;animation:slide 1.1s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
</style></head><body><div class="box">
<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 30 32 10l24 20" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 26v28h34V26" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><rect x="27" y="36" width="10" height="18" rx="2" fill="#C9A24D"/></svg>
<div class="brand">Open<b>House</b>Pal</div>
<div class="msg">Opening {provider} sign-in…</div>
<div class="bar"><i></i></div>
</div></body></html>`

/** Open a provider's sign-in in a NEW tab, so the page that asked (setup) is never interrupted.
 * The tab is opened right away, inside the click, so browsers don't block it, then pointed at the
 * sign-in once the URL comes back. Returns false if it couldn't open (caller shows an error). */
export async function openSignInTab(getUrl: () => Promise<string | null | undefined>, provider = 'Google'): Promise<boolean> {
  const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
  // Never a blank white tab while Google's sign-in page loads (owner, 10/26): the tab shows the
  // OpenHousePal house and "Opening Google..." until the sign-in page replaces it.
  if (tab) {
    try {
      tab.document.write(SIGN_IN_WAIT_HTML.replace(/{provider}/g, provider))
      tab.document.close()
    } catch { /* the tab still opens the sign-in */ }
  }
  const url = await getUrl()
  if (!url) { tab?.close(); return false }
  if (tab) { tab.location.href = url; return true }
  return false
}
