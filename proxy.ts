import { NextRequest, NextResponse } from 'next/server'
import { hubOwnDomainTarget } from './lib/hubOwnDomainRedirect'
import { subdomainOwnDomainTarget } from './lib/subdomainOwnDomainRedirect'

// Any hostname NOT in this set gets rewritten to the (sitepublic) route group - see
// app/(sitepublic)/ohp-site-render/[host]/[[...path]]/page.tsx. Nested under a literal
// "ohp-site-render" segment (not at root) to avoid colliding with the existing app/[slug]/
// (Agent Hub) dynamic route - Next.js disallows two differently-named dynamic segments at
// the same position, but a literal folder can coexist with [slug] at the same level (this
// repo already does that with app/leads/, app/dash/, etc).
const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
const APP_HOSTNAMES = new Set([
  OHP_BASE_DOMAIN,
  `www.${OHP_BASE_DOMAIN}`,
  `app.${OHP_BASE_DOMAIN}`,
  'localhost:3000',
  'localhost',
  '127.0.0.1:3000',
  '127.0.0.1',
])

// Every real top-level dashboard route folder under app/ (including app/(auth)/'s children,
// which get no URL segment of their own for the group itself) - anything else is a path Next
// can only resolve via app/[slug]/... (the Agent Hub), which is ALSO a visitor-facing public
// page even though it's served on the main app hostname rather than a custom domain/subdomain.
// Kept in sync by hand with app/'s actual folder list - there's no way to ask Next's router
// "would this path hit [slug]?" from middleware, so this mirrors its own routing precedence.
// NOTE: 'open-house' (singular) is deliberately NOT reserved, unlike 'open-houses' (plural, the
// agent's own management list). app/open-house/[openHouseEventId]/... is the visitor-facing kiosk
// sign-in flow (sign-in, disclosure, second-visit) - a walk-in guest hits this directly (QR code or
// a fullscreened kiosk tab), never authenticated as the agent, so it must get the same "hide
// dashboard chrome" treatment as Agent Hub/Forms/the public site, not the agent dashboard's chrome.
const RESERVED_APP_SEGMENTS = new Set([
  'activity', 'agenthub', 'admin', 'agent-hub', 'api', 'assistant', 'broker-authorization', 'cash-needed',
  'checkout', 'cma', 'dash', 'discovery', 'leads', 'net-sheet', 'open-houses',
  'gsi', 'privacy', 'property', 'settings', 'setup', 'showcase', 'showcases', 'studio', 'terms', 'unsubscribe',
  'upgrade-required', 'forgot-password', 'login', 'register', 'reset-password',
])

// openhousepal.com is for agents (we sell them subscriptions), so these are the only pages on the
// app's own hostname Google may list. Everything else there - each agent's Hub and forms
// (/<slug>, /<slug>/<form>), invites, follow-ups, home pages - gets `X-Robots-Tag: noindex`
// (user, 10/29: googling OpenHousePal showed "Lori D'Onofrio", "Setup My Own Showcase" under our
// own result). Agents' own sites (<slug>.openhousepal.com, own domains) aren't touched.
// Not robots.txt: a blocked page can still be listed from links, and Google can't see the noindex.
const INDEXABLE_APP_PATHS = new Set(['/', '/register', '/login', '/privacy', '/terms'])

// An agent's Hub (/<slug>/...) is shown on their own website's /hub, /about and /sales inside a
// frame. `indexifembedded` lets Google count it as part of THAT page (owner, 10/30: their hub and
// sales should be findable on their own site) while openhousepal.com/<slug> itself stays unlisted.
function isHubPath(request: NextRequest): boolean {
  const first = request.nextUrl.pathname.split('/').filter(Boolean)[0]?.toLowerCase()
  return !!first && !RESERVED_APP_SEGMENTS.has(first)
}

// One article (/<slug>/blogs/<post>) is the exception: a Premium agent's posts are meant to be found
// (owner, 10/30). The page itself decides (app/[slug]/blogs/[blogSlug]/layout.tsx) - listed only when
// the agent left "Let Google find this article" on and the post isn't also on their IDX website.
function isBlogPostPath(request: NextRequest): boolean {
  const segs = request.nextUrl.pathname.split('/').filter(Boolean)
  return segs.length === 3 && segs[1] === 'blogs' && isHubPath(request)
}

// Next.js 16 renamed Middleware to Proxy (filename proxy.ts, same functionality/API) - this
// used to be middleware.ts/export function middleware.
export async function proxy(request: NextRequest) {
  const rawHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase()
  const hostWithoutPort = rawHost.split(':')[0]

  if (!rawHost || APP_HOSTNAMES.has(rawHost) || APP_HOSTNAMES.has(hostWithoutPort)) {
    const res = await appHostResponse(request)
    const path = request.nextUrl.pathname.replace(/\/+$/, '') || '/'
    if (!INDEXABLE_APP_PATHS.has(path) && !isBlogPostPath(request)) res.headers.set('X-Robots-Tag', isHubPath(request) ? 'noindex, indexifembedded' : 'noindex')
    return res
  }
  return siteHostResponse(request, rawHost, hostWithoutPort)
}

async function appHostResponse(request: NextRequest): Promise<NextResponse> {
  // The admin's town page preview (app/admin/town-preview) draws an IDX page, so it gets the same
  // "no dashboard chrome" signal as a public site page. Only the look - the data is admin-only.
  if (request.nextUrl.pathname.startsWith('/admin/town-preview/')) {
    const previewHeaders = new Headers(request.headers)
    previewHeaders.set('x-ohp-public-site', '1')
    return NextResponse.next({ request: { headers: previewHeaders } })
  }
  const firstSegment = request.nextUrl.pathname.split('/').filter(Boolean)[0]?.toLowerCase()
  if (firstSegment && !RESERVED_APP_SEGMENTS.has(firstSegment)) {
    // openhousepal.com/<slug>/... -> the agent's own connected domain, only while it fully works
    // (lib/hubOwnDomainRedirect - never for frames/previews; any doubt = no redirect). 307 + no-store:
    // switching the domain off stops it within a minute, nothing sticks in browsers.
    const ownDomainUrl = await hubOwnDomainTarget(request)
    if (ownDomainUrl) {
      const res = NextResponse.redirect(ownDomainUrl, 307)
      res.headers.set('Cache-Control', 'no-store')
      return res
    }
    // A /[slug]/... Agent Hub request on the app's own hostname - same "hide dashboard
    // chrome" signal as the custom-domain rewrite below, just without a URL rewrite.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-ohp-public-site', '1')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  return NextResponse.next()
}

async function siteHostResponse(request: NextRequest, rawHost: string, hostWithoutPort: string): Promise<NextResponse> {
  // The app's own API routes (Explore Nearby's /api/website-nearby, link-preview images...) answer
  // the same on every host - rewriting them into the site page returned HTML, which is why Explore
  // Nearby never loaded on IDX sites or Spotlights (user, 10/18).
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next()

  // Invites (/i/<code>, and its link-preview image) open on an agent's own domain too - served by
  // app/i/[code] itself, which checks the domain belongs to the invite's agent.
  if (request.nextUrl.pathname.startsWith('/i/')) {
    const inviteHeaders = new Headers(request.headers)
    inviteHeaders.set('x-ohp-public-site', '1')
    return NextResponse.next({ request: { headers: inviteHeaders } })
  }

  // <slug>.openhousepal.com -> the agent's own domain once it's their working default address
  // (lib/subdomainOwnDomainRedirect - same rule as every link they share; any doubt = no redirect).
  const ownSiteUrl = await subdomainOwnDomainTarget(hostWithoutPort, request)
  if (ownSiteUrl) {
    const res = NextResponse.redirect(ownSiteUrl, 307)
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const url = request.nextUrl.clone()
  url.pathname = `/ohp-site-render/${encodeURIComponent(rawHost)}${url.pathname}`

  // Flags this request for the root layout (see app/layout.tsx) so it can skip mounting the
  // dashboard chrome - AppHeader, AuthProvider, AssistantWidget - on a visitor-facing public
  // site. Route groups can't opt out of the mandatory root layout on their own, so this header
  // is the explicit signal that replaces guessing from pathname/auth state (which previously let
  // the internal AI Assistant widget leak onto an agent's own live public site whenever their
  // dashboard session cookie happened to be readable there, e.g. in local dev).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-ohp-public-site', '1')
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-512.png|apple-touch-icon.png|uploads).*)'],
}
