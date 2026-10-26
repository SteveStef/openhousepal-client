// Which paths are the agent app (OpenHousePal's own header + page loader) and which are someone's
// public page (Agent Hub, IDX site, Showcase, open-house sign-in...). One rule for AppHeader and
// PageGate. Any NEW top-level app page must be added to the lookahead below, or it's treated as an
// agent's public page (/{hub-slug}) and loses the header.
const NO_HEADER_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/open-house/',
  '/property/',
  '/showcase/',
  '/d/', // one-tap "Mark as done" page linked from calendar follow-ups
  '/studio/design/', // the Studio design editor (and its /print render) - a focused, full-screen tool with its own Back
  '/unsubscribe',
  '/cma/',
  '/net-sheet/',
  '/cash-needed/',
  // Website Builder's public renderer - the isPublicAgentPage regex below only covers 1-2
  // segment paths, so a nested site page (/ohp-site-render/host/some/nested/page) needs its
  // own explicit exclusion here, same as /AgentHub/ has.
  '/ohp-site-render/',
  // The Spotlight theme / draft preview - the template's own page chrome only.
  '/spotlight-preview/',
  // The one-time setup flow - a focused page with its own top bar.
  '/setup',
]

export function isPublicAgentPage(pathname: string | null | undefined): boolean {
  return Boolean(
    pathname?.match(/^\/(?!admin(?:\/|$)|agent-hub$|activity$|dash$|leads(?:\/|$)|studio(?:\/|$)|assistant(?:\/|$)|login$|register$|forgot-password$|reset-password$|open-house(?:\/|$)|open-houses(?:\/|$)|privacy$|terms$|unsubscribe$|checkout$|discovery$|broker-authorization$|showcase(?:s)?(?:\/|$)|settings(?:\/|$)|setup$|upgrade-required$)[^/]+(?:\/[^/]+)?\/?$/) ||
    // A public article (/{hub}/blogs/{slug}) - never the Studio's own blog editor (/studio/blogs/{id}).
    pathname?.match(/^\/(?!studio\/)[^/]+\/blogs\/[^/]+\/?$/) ||
    pathname?.startsWith('/AgentHub/')
  )
}

/** True when the page shows OpenHousePal's own header. */
export function hasAppHeader(pathname: string | null | undefined): boolean {
  return !(NO_HEADER_PATHS.some(path => pathname?.startsWith(path)) || isPublicAgentPage(pathname))
}

/** The agent's working pages - these open behind the logo loader until their data is in. The
 * homepage and the legal pages are marketing, not app. */
export function isGatedAppPage(pathname: string | null | undefined): boolean {
  if (!pathname || pathname === '/' || pathname === '/privacy' || pathname === '/terms') return false
  return hasAppHeader(pathname)
}
