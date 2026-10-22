import { NextRequest, NextResponse } from 'next/server'
import { hubOwnDomainTarget } from './lib/hubOwnDomainRedirect'

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

// Next.js 16 renamed Middleware to Proxy (filename proxy.ts, same functionality/API) - this
// used to be middleware.ts/export function middleware.
export async function proxy(request: NextRequest) {
  const rawHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase()
  const hostWithoutPort = rawHost.split(':')[0]

  if (!rawHost || APP_HOSTNAMES.has(rawHost) || APP_HOSTNAMES.has(hostWithoutPort)) {
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
