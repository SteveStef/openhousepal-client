import { Site, SiteDomain } from '@/types'

const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
const CLIENT_URL = (process.env.NEXT_PUBLIC_CLIENT_URL || `https://${OHP_BASE_DOMAIN}`).replace(/\/$/, '')
const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1'])
// The free <slug>.openhousepal.com addresses only open once the wildcard DNS record
// (*.openhousepal.com) exists. Until NEXT_PUBLIC_OHP_SUBDOMAINS_LIVE=true, links use the same page
// on openhousepal.com (/ohp-site-render/<host>), which always works.
export const OHP_SUBDOMAINS_LIVE = process.env.NEXT_PUBLIC_OHP_SUBDOMAINS_LIVE === 'true'
const SUBDOMAINS_LIVE = OHP_SUBDOMAINS_LIVE

/** A public page on an agent's <slug>.openhousepal.com address, as a link that opens today. */
export function ohpHostUrl(hostname: string, path = '') {
  const tail = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  if (isLocalDevHost()) return `${window.location.origin}/ohp-site-render/${encodeURIComponent(hostname)}${tail}`
  if (!SUBDOMAINS_LIVE && hostname.endsWith(`.${OHP_BASE_DOMAIN}`)) return `${CLIENT_URL}/ohp-site-render/${encodeURIComponent(hostname)}${tail}`
  return `https://${hostname}${tail}`
}

function withPath(base: string, path: string) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function isLocalDevHost() {
  return typeof window !== 'undefined' && LOCAL_TEST_HOSTS.has(window.location.hostname)
}

export function openHousePalPublicUrl(path: string) {
  if (isLocalDevHost()) {
    return withPath(window.location.origin, path)
  }
  return withPath(CLIENT_URL, path)
}

/** Where an agent's SHARE links live besides openhousepal.com: their own connected domain, and
 * nothing else. One rule for every plan - without an own domain (any plan, IDX included) every
 * link stays on openhousepal.com; the free <slug>.openhousepal.com website address is never used
 * for links. Same rule as the backend (site_service.resolve_owner_public_base_url). */
export function websitePublicHostname(site?: Site | null, domains: SiteDomain[] = []) {
  // is_enabled === false: the agent switched their IDX website off (Settings -> IDX Website) -
  // it isn't served, so nothing may link to it.
  if (!site || site.status !== 'PUBLISHED' || site.is_enabled === false) return null
  const primary = domains.find(domain => domain.is_primary && domain.status === 'ACTIVE')
  return primary?.hostname || null
}

export function websitePublicBaseUrl(site?: Site | null, domains: SiteDomain[] = []) {
  const hostname = websitePublicHostname(site, domains)
  if (!hostname) return null

  // In local dev the real IDX/custom hostnames do not resolve through DNS/Traefik, so expose
  // the same public-site route the proxy would have rewritten to in production. This keeps
  // Forms, Showcases, and Agent Hub Website Links clickable locally without changing the
  // production URL shape.
  return ohpHostUrl(hostname)
}

export function websitePublicUrl(site: Site | null | undefined, domains: SiteDomain[] | undefined, path: string) {
  const base = websitePublicBaseUrl(site, domains || [])
  return base ? withPath(base, path) : null
}

// Single Property Websites (Listing Spotlight) - default shape is <slug>.OHP_BASE_DOMAIN,
// resolved through the same local-dev-aware ohp-site-render rewrite (see
// backend/app/services/website/domain_resolution_service.resolve_property_site).
//
// When the agent has a connected custom domain on their Website Builder site, the backend ALSO
// serves a published Spotlight at <custom-domain>/listings/<slug> - so pass `domains` and we
// hand back that branded URL instead, keeping the link the agent copies on their own brand.
export function propertyWebsitePublicUrl(slug: string, domains: SiteDomain[] = []) {
  if (!isLocalDevHost()) {
    const primary = domains.find(domain => domain.is_primary && domain.status === 'ACTIVE')
    if (primary?.hostname) {
      return `https://${primary.hostname}/listings/${encodeURIComponent(slug)}`
    }
  }
  return ohpHostUrl(`${slug}.${OHP_BASE_DOMAIN}`)
}
