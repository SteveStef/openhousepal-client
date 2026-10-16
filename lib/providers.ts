// Which sign-in providers agents can connect right now. Google (Calendar + Gmail) is fully set up
// and verified; Outlook (Calendar + email) shows "Coming soon" everywhere until it is. Flip to true
// to turn every Outlook connect button back on at once.
export const OUTLOOK_LIVE = false

/** Fired (localStorage + same-tab event) when a connection finishes in its own tab, so the page
 * that opened it refreshes without a reload. See app/settings/connected. */
export const CONNECTED_EVENT = 'ohp-connected'

/** Open a provider's sign-in in a NEW tab, so the page that asked (setup) is never interrupted.
 * The tab is opened right away, inside the click, so browsers don't block it, then pointed at the
 * sign-in once the URL comes back. Returns false if it couldn't open (caller shows an error). */
export async function openSignInTab(getUrl: () => Promise<string | null | undefined>): Promise<boolean> {
  const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
  const url = await getUrl()
  if (!url) { tab?.close(); return false }
  if (tab) { tab.location.href = url; return true }
  return false
}
