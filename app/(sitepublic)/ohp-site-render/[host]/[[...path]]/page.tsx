import { Metadata, Viewport } from 'next'
import {
  OpenHouseFrame, PropertyGallery, FeaturedPageClient, PropertyMapSearch, PropertyLocationMap, ExploreNearby, NeighborhoodCompareLauncher, WebsitePublicFormPage, ContactPageView, NeighborhoodsExplorer, MediaHub, SiteBlogArticle, IdxPropertyPage, MyShowcase, ShowcaseBuilder, CinematicLuxuryTemplate, EditorialEstateTemplate, SpotlightFactSheet,
} from '@/components/website-public/LazySiteParts'
import { cookies, headers } from 'next/headers'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import {
  ArrowRight, Bath, BedDouble, Building2, Calendar, Coffee, DollarSign,
  GraduationCap, Heart, HeartPulse, Home, LandPlot, MapPin, Ruler,
  School, ShoppingBag, ShoppingBasket, Sparkles, Train, Trees, TrendingUp, Utensils,
} from 'lucide-react'
import { autoListingMeta, autoPageMeta, autoPostMeta, autoSectionMeta, autoTownMeta, seoClip, withSiteName, type SeoCtx } from '@/lib/siteSeoAuto'
import SitePageRenderer from '@/components/website-public/SitePageRenderer'
import SiteShell from '@/components/website-public/SiteShell'
import { SiteHeader, SiteFooter } from '@/components/website-public/SiteChrome'
import ClassicPageHero from '@/components/website-public/ClassicPageHero'
import { formatCompactPrice } from '@/components/website-public/listingFormat'
import ShowcaseCreatorCTA from '@/components/website-public/ShowcaseCreatorCTA'
import ReviewsPage from '@/components/website-public/ReviewsPage'
import HomeValuePage from '@/components/website-public/HomeValuePage'
import HomeCard from '@/components/website-public/HomeCard'
import SiteFormLauncher from '@/components/website-public/SiteFormLauncher'
import SiteNavProgress from '@/components/website-public/SiteNavProgress'
import { normalizeSiteTheme } from '@/lib/siteTheme'
import { cardVersion, ogFetch, showcaseHomeShareText, showcaseShareText, siteLookParam } from '@/lib/og/shared'
import { toTitleCase } from '@/lib/cheatSheetContent'
import { fontClass } from '@/components/website-public/blocks/fontClass'
import BlogCoverArt from '@/components/BlogCoverArt'
import IdxOneTap from '@/components/website-public/IdxOneTap'
import RememberShowcase from '@/components/website-public/showcase/RememberShowcase'
import FramePathSync from '@/components/public-site/FramePathSync'
import { resolveMediaUrl } from '@/lib/api-service'
import { DEFAULT_SITE_THEME, SearchFilterParams, SiteContent, type SiteTheme } from '@/components/website-public/types'
import type { PropertySiteResolveResponse } from '@/components/property-sites/CinematicLuxuryTemplate'
import { formatOpenHouseTime, upcomingOpenHouses } from '@/lib/mlsOpenHouses'
import { tidyAllCaps } from '@/lib/cheatSheetContent'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg, sizedImage } from '@/lib/siteImage'
import { type CommunityHomesParams, ListingCard, TownPageView, categoryEntities, townHomesQuery } from '@/components/website-public/town/TownPage'
import { daysOnMarketStat } from '@/components/website-public/townGuide'

// Route-specific client pieces (Spotlight templates, map search, Showcase builder, town widgets...)
// come from LazySiteParts (next/dynamic inside a client module) so each page only ships its own JS -
// they all used to download on every page (10/19).

// Server Component only - this is the entire CORS story for Website Builder (see
// backend/app/api/public_site_routes.py). INTERNAL_API_URL is server-only (no NEXT_PUBLIC_
// prefix), never shipped to the browser, distinct from the browser-facing NEXT_PUBLIC_API_URL.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

interface ResolveResponse {
  site_id: string
  subdomain_slug: string
  published_snapshot: SiteContent
  redirect_to: string | null
  canonical_hostname: string | null
  /** Search Console codes for the home page's google-site-verification tag (ours + the agent's). */
  google_verification?: string[]
}

// Next.js dedupes identical fetch() calls (same URL + options) within one request, so calling
// this from both generateMetadata and the page component below costs one network round trip,
// not two. `path` is passed through so the backend hydrates ONLY the page actually being
// requested - see public_site_routes.resolve_site / content_adapters.hydrate_page_blocks.
async function resolveSite(host: string, path: string): Promise<ResolveResponse | null> {
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) return null
  return res.json()
}

// Single Property Websites - a completely separate resolver/table (see
// backend/app/services/website/domain_resolution_service.resolve_property_site), tried ONLY
// after resolveSite above returns null. Since a property site and an agent's whole Site can
// never share a slug (enforced at creation - see property_website_service._unique_property_slug),
// this is purely additive: it never changes what resolveSite itself returns or how the rest of
// this file renders a real Site.
async function resolvePropertySite(host: string, path: string): Promise<PropertySiteResolveResponse | null> {
  // Tagged so publishing from the editor refreshes the live page at once (see
  // app/api/website-property-sites/revalidate) instead of after the 30s cache window.
  const res = await fetch(`${INTERNAL_API_URL}/public/property-sites/resolve?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`, {
    next: { revalidate: 30, tags: ['property-sites'] },
  })
  if (!res.ok) return null
  return res.json()
}

function findPage(resolved: ResolveResponse, path?: string[]) {
  const pages = resolved.published_snapshot?.pages || []
  const requestedSlug = (path || []).join('/')
  return requestedSlug ? pages.find(p => p.slug === requestedSlug) : pages.find(p => p.is_home) || pages[0]
}

function showcaseCtaListingsForPage(page: any): any[] {
  const blocks = page?.blocks || []
  const featured = blocks.find((block: any) => block?.type === 'featured_listings')
  return Array.isArray(featured?.data?.resolved) ? featured.data.resolved.filter((item: any) => item?.photo) : []
}

function joinPath(path?: string[]) {
  return (path || []).join('/')
}

// proxy.ts rewrites real visits (peter-stefanatos.openhousepal.com/properties) to this route
// while leaving the browser's actual address bar - and therefore what absolute links like
// "/properties" resolve against - on the real subdomain, so plain absolute paths just work.
// Direct local testing (localhost:3000/ohp-site-render/{host}/...) has no such rewrite: the
// browser bar really is on localhost, so the same absolute paths would 404 into the unrelated
// Agent Hub /[slug] route instead of back into this site. Detecting that case (via the actual
// incoming Host header, not the [host] URL param) and prefixing internal links with
// /ohp-site-render/{host} makes every link work correctly in both situations with the same code.
// The app's own hostnames serve a site the same way (openhousepal.com/ohp-site-render/<host>) -
// the link handed out while an agent's own address doesn't open yet (see publicResourceLinks).
const LOCAL_TEST_HOSTS = new Set([
  'localhost:3000', 'localhost', '127.0.0.1:3000', '127.0.0.1',
  OHP_BASE_DOMAIN, `www.${OHP_BASE_DOMAIN}`, `app.${OHP_BASE_DOMAIN}`,
])

async function getBasePrefix(host: string): Promise<string> {
  const hdrs = await headers()
  const incomingHost = (hdrs.get('x-forwarded-host') || hdrs.get('host') || '').toLowerCase()
  return LOCAL_TEST_HOSTS.has(incomingHost) || LOCAL_TEST_HOSTS.has(incomingHost.split(':')[0]) ? `/ohp-site-render/${encodeURIComponent(host)}` : ''
}

async function baseMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ host: string; path?: string[] }>
  searchParams: Promise<SearchFilterParams>
}): Promise<Metadata> {
  const { host: rawHost, path } = await params
  const host = decodeURIComponent(rawHost)
  const resolved = await resolveSite(host, joinPath(path))
  // A Spotlight lives at the root of its own <slug>.openhousepal.com, or at /listings/<slug> on the
  // agent's connected custom domain (where the agent's whole site also resolves).
  const spotlightOnCustomDomain = Boolean(resolved && path?.[0] === 'listings' && path[1] && !path[2])
  // A Spotlight's printable fact sheet (…/fact-sheet): its own plain title, never indexed.
  const segs = path || []
  const factSheet = segs[segs.length - 1] === 'fact-sheet' && (!resolved ? segs.length === 1 : segs[0] === 'listings' && segs.length === 3)
  if (!resolved || spotlightOnCustomDomain || factSheet) {
    const propertySite = await resolvePropertySite(host, joinPath(path))
    if (propertySite && factSheet) {
      return { title: `Fact sheet | ${toTitleCase(propertySite.property.address || '')}`, robots: { index: false, follow: false } }
    }
    if (propertySite) {
      // MLS data is all caps ("1 DOVECOTE LN") - tab titles and link previews read better title-cased.
      const cityState = [propertySite.property.city ? toTitleCase(propertySite.property.city) : '', propertySite.property.state].filter(Boolean).join(', ')
      const street = toTitleCase(propertySite.property.address || '')
      const title = cityState ? `${street} | ${cityState}` : street
      // Agent-branded social-share image for the Spotlight listing (see app/api/og/[kind]).
      // Search/social snippet built from real listing facts (price, beds/baths/sq ft) plus the
      // opening of the listing's own description - never a generic tagline when there's data.
      const sp = propertySite.property
      // ?v= changes with what the card shows, so apps that cache previews by address re-fetch it.
      const spAgent: any = (propertySite as any).agents?.[0] || {}
      const ogImage = ogCard('spotlight', {
        host, path: joinPath(path),
        v: cardVersion('c3', sp.address, sp.city, sp.status, sp.price, (sp as any).close_price, (propertySite as any).content?.hero_image, (propertySite as any).brand_kit?.secondary_color, (propertySite as any).template_id, spAgent.name, spAgent.brokerage, spAgent.photo_url),
      })
      const facts = [
        sp.price ? `$${Math.round(sp.price).toLocaleString('en-US')}` : null,
        sp.beds != null ? `${sp.beds} bd` : null,
        sp.baths != null ? `${sp.baths} ba` : null,
        sp.sqft ? `${Math.round(sp.sqft).toLocaleString('en-US')} sq ft` : null,
      ].filter(Boolean).join(' · ')
      const blurb = (propertySite.content?.description_override || sp.description || '').replace(/\s+/g, ' ').trim()
      const description = [facts, blurb ? (blurb.length > 150 ? `${blurb.slice(0, 150).replace(/\s+\S*$/, '')}…` : blurb) : `${sp.address}${cityState ? `, ${cityState}` : ''} — take the full tour.`]
        .filter(Boolean).join(' — ')
      const canonical = `https://${propertySite.canonical_hostname || host}${path?.length && !spotlightOnCustomDomain ? `/${joinPath(path)}` : ''}`
      return {
        title,
        description,
        alternates: { canonical },
        openGraph: { title, description, type: 'website', url: canonical, images: [{ url: ogImage, width: 1200, height: 630 }] },
        twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
        // The tab icon the agent uploaded for their website - their Spotlights wear it too.
        ...((propertySite as any).agent_icon ? { icons: { icon: [{ url: (propertySite as any).agent_icon }], apple: [{ url: (propertySite as any).agent_icon }] } } : {}),
      }
    }
    return {}
  }
  if (resolved.redirect_to) return {}

  const canonicalSegments = path?.[0] === 'communities' ? ['neighborhoods', ...(path || []).slice(1)] : (path || [])
  const canonicalPath = joinPath(canonicalSegments)
  const metadataParams = await searchParams
  const canonicalQuery = canonicalSegments[0] === 'neighborhoods' && canonicalSegments[1] === 'compare'
    ? queryString(metadataParams, ['areas'])
    : ''
  const canonical = resolved.canonical_hostname ? `https://${resolved.canonical_hostname}/${canonicalPath}` : undefined
  const canonicalWithQuery = canonical && canonicalQuery ? `${canonical}?${canonicalQuery}` : canonical

  // Reserved sections (blog/properties) aren't page-builder pages, so they don't have a
  // matching entry in published_snapshot.pages - give them their own titles.
  if (path?.[0] === 'blog') {
    if (path[1]) {
      const hubSlug = await resolveAgentHubSlug(resolved.site_id)
      const post = hubSlug ? await fetchJson(`${INTERNAL_API_URL}/studio/blogs/public/${encodeURIComponent(hubSlug)}/${encodeURIComponent(path[1])}?track=false`) : null
      const opening = ((post?.blocks || []) as any[]).map(b => String(b?.data?.text || b?.data?.html || '').replace(/<[^>]+>/g, ' ')).join(' ')
      const auto = post ? autoPostMeta(post, opening) : null
      return ownPageMetadata(
        post?.seoTitle || post?.socialTitle || post?.title || 'Blog post',
        canonical || undefined,
        {
          description: post?.metaDescription || post?.socialDescription || auto?.description || undefined,
          ogImage: hubSlug ? ogCard('blog', { agent: hubSlug, post: path[1] }) : undefined,
        },
      )
    }
    return { title: 'Media', alternates: canonical ? { canonical } : undefined }
  }
  if (path?.[0] === 'properties' && path[1]) {
    const p = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/properties/${encodeURIComponent(path[1])}`)
    return listingMetadata(p, canonical, ogCard('idxlisting', { site: resolved.site_id, listing: path[1], own: '1', ...listingCardKeys(resolved, p) }))
  }
  if (path?.[0] === 'search' && path[1] === 'properties' && path[2]) {
    const p = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/search/properties/${encodeURIComponent(path[2])}`)
    return listingMetadata(p, canonical, ogCard('idxlisting', { site: resolved.site_id, listing: path[2], ...listingCardKeys(resolved, p) }))
  }
  if (path?.[0] === 'properties') {
    return { title: 'Properties', alternates: canonical ? { canonical } : undefined }
  }
  if (path?.[0] === 'search') {
    return { title: 'Search Homes', alternates: canonical ? { canonical } : undefined }
  }
  if (path?.[0] === 'communities' || path?.[0] === 'neighborhoods') {
    return { title: path[1] === 'compare' ? 'Neighborhood Compare' : 'Neighborhoods', alternates: canonicalWithQuery ? { canonical: canonicalWithQuery } : undefined }
  }
  if (path?.[0] === 'forms') {
    if (path[1]) {
      const formRes = await fetch(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/forms/${encodeURIComponent(path[1])}?track_view=false`, { cache: 'no-store' })
      const form = formRes.ok ? await formRes.json() : null
      const hubSlug = await resolveAgentHubSlug(resolved.site_id)
      return publicAliasMetadata(
        form?.headline || form?.title || 'Form',
        hubSlug && form?.slug ? `https://${OHP_BASE_DOMAIN}/${encodeURIComponent(hubSlug)}/${encodeURIComponent(form.slug)}` : undefined,
        {
          description: form?.subtitle,
          ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c3', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
        },
      )
    }
    return publicAliasMetadata('Form')
  }
  if (path?.[0] === 'contact' && !path[1]) {
    const formRes = await fetch(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/forms/by-type/how_can_i_help?track_view=false`, { cache: 'no-store' })
    const form = formRes.ok ? await formRes.json() : null
    const hubSlug = await resolveAgentHubSlug(resolved.site_id)
    return ownPageMetadata(
      form?.headline || form?.title || 'How Can We Help',
      canonical || undefined,
      {
        description: form?.subtitle,
        ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c3', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
      },
    )
  }
  if (path?.[0] === 'create-showcase' && !path[1]) {
    const formRes = await fetch(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/showcase-creator?track_view=false`, { cache: 'no-store' })
    const form = formRes.ok ? await formRes.json() : null
    const hubSlug = await resolveAgentHubSlug(resolved.site_id)
    return publicAliasMetadata(
      form?.headline || form?.title || 'Create Showcase',
      hubSlug && form?.slug ? `https://${OHP_BASE_DOMAIN}/${encodeURIComponent(hubSlug)}/${encodeURIComponent(form.slug)}` : undefined,
      {
        description: form?.subtitle,
        ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c3', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
      },
    )
  }
  if (path?.[0] === 'open-house' && path[1]) {
    // A guest's own Guest Pass is personal - never indexed.
    if (path[2] === 'pass') return { title: 'Your Guest Pass', robots: { index: false, follow: false } }
    return publicAliasMetadata('Open house sign-in', `https://${OHP_BASE_DOMAIN}/open-house/${encodeURIComponent(path[1])}`)
  }
  if (path?.[0] === 'showcase' || path?.[0] === 'showcases') {
    // Named for the guest it was made for ("Lori's personal Showcase") - the same text as the
    // openhousepal.com link; applySiteSeo leaves the site name off private client links.
    const data = path[1] ? await ogFetch<any>(`/collections/shared/${encodeURIComponent(path[1])}`, 120) : null
    // /showcase/dana-k7q2/732-buck-ln - one home in it (the agent's Send): that home's own card.
    const one = path[1] && path[2] ? showcaseHomeShareText(data, decodeURIComponent(path[2])) : null
    const share = one || showcaseShareText(data)
    const accent = normalizeSiteTheme({ ...DEFAULT_SITE_THEME, ...(resolved.published_snapshot?.theme || {}) }).secondary_color?.replace('#', '')
    return publicAliasMetadata(
      share.title,
      path[1] ? `https://${OHP_BASE_DOMAIN}/showcase/${encodeURIComponent(path[1])}${one ? `/${encodeURIComponent(path[2])}` : ''}` : undefined,
      // in the site's own colour, like the Showcase itself on this domain
      {
        description: share.description,
        ogImage: !path[1] ? undefined : one
          ? ogCard('showcasehome', { token: path[1], home: path[2], accent, v: share.v })
          : ogCard('showcase', { token: path[1], accent, v: share.v }),
      },
    )
  }
  if (path?.[0] === 'cma' && path[1]) {
    const cma = await fetchJson(`${INTERNAL_API_URL}/api/cma/public/${encodeURIComponent(path[1])}`)
    const subj = cma?.subject || {}
    const address = [subj.street_address, subj.city].filter(Boolean).join(', ')
    return publicAliasMetadata(
      address ? `What ${address} is worth` : 'Home value analysis',
      `https://${OHP_BASE_DOMAIN}/cma/${encodeURIComponent(path[1])}`,
      {
        description: `A market analysis${address ? ` for ${address}` : ''} — comparable sales and a recommended price.`,
        ogImage: ogCard('cma', { slug: path[1] }),
      },
    )
  }
  if (path?.[0] === 'hub' || path?.[0] === 'agent-hub') {
    const hubSlug = await resolveAgentHubSlug(resolved.site_id)
    return publicAliasMetadata(
      'Agent Hub',
      hubSlug ? `https://${OHP_BASE_DOMAIN}/${encodeURIComponent(hubSlug)}` : undefined,
      { ogImage: hubSlug ? ogCard('hub', { agent: hubSlug }) : undefined },
    )
  }
  if (path?.[0] === 'home-value' && !path[1]) {
    return ownPageMetadata('Home Value', canonical || undefined)
  }
  if (path?.[0] === 'testimonials' && !path[1]) {
    return ownPageMetadata('Client Reviews', canonical || undefined, { description: 'What clients say - real reviews from buyers and sellers.' })
  }
  if (path?.[0] === 'sales' && !path[1]) {
    return publicAliasMetadata('Sales', canonical || undefined)  // a filtered copy of the hub page - not for Google
  }
  if (path?.[0] === 'about' && !path[1]) {
    const hubSlug = await resolveAgentHubSlug(resolved.site_id)
    return ownPageMetadata('About', canonical || undefined, { ogImage: hubSlug ? ogCard('hub', { agent: hubSlug }) : undefined })
  }

  const page = findPage(resolved, path)
  if (page) {
    return {
      title: page.title,
      alternates: canonical ? { canonical } : undefined,
      openGraph: page.title ? { title: page.title } : undefined,
    }
  }

  // No page-builder page matched - might be a community page (e.g. /villanova-pa), which lives
  // in the shared Area system rather than published_snapshot.pages. See findPage's caller.
  if (path?.length === 1) {
    const area = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas/${encodeURIComponent(path[0])}`, TOWN_TAGS)
    if (area) {
      const [profile, areaList] = await Promise.all([
        fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
        fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`, TOWN_TAGS),
      ])
      const summary = ((areaList || []) as any[]).find(a => a.slug === area.slug) || {}
      const auto = autoTownMeta({ ...summary, ...area, active_count: summary.active_count ?? area.facts?.market_stats?.active_count, median_price: summary.median_price ?? area.facts?.market_stats?.median_price }, { agent: profile || {}, towns: [] })
      const image = summary.photo || area.facts?.photos?.items?.[0]?.url
      return {
        title: auto.title,
        description: auto.description,
        alternates: canonical ? { canonical } : undefined,
        openGraph: { title: auto.title, description: auto.description, type: 'website', ...(image ? { images: [{ url: image }] } : {}) },
        twitter: { card: image ? 'summary_large_image' : 'summary', title: auto.title, description: auto.description, ...(image ? { images: [image] } : {}) },
      }
    }
  }
  return {}
}

// A client's Showcase (a full-screen frame, ShowcaseAliasPage) draws to the very bottom edge of an
// iPhone, like the Showcase does on openhousepal.com. Merged with the root layout's viewport.
export async function generateViewport({ params }: { params: Promise<{ host: string; path?: string[] }> }): Promise<Viewport> {
  const { path } = await params
  return (path?.[0] === 'showcase' || path?.[0] === 'showcases') && path[1] ? { width: 'device-width', initialScale: 1, viewportFit: 'cover' } : {}
}

export async function generateMetadata(args: {
  params: Promise<{ host: string; path?: string[] }>
  searchParams: Promise<SearchFilterParams>
}): Promise<Metadata> {
  const meta = await baseMetadata(args)
  const { host: rawHost, path } = await args.params
  const resolved = await resolveSite(decodeURIComponent(rawHost), joinPath(path))
  if (!resolved || resolved.redirect_to || (path?.[0] === 'listings' && path[1] && !path[2])) return meta
  const [profile, areaList] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`, TOWN_TAGS),
  ])
  const ctx: SeoCtx = {
    agent: profile || {},
    towns: ((areaList || []) as any[]).map(a => a.name).filter(Boolean),
    reviews: profile?.rating || null,
  }
  return applySiteSeo(meta, resolved, path, profile, ctx, ((areaList || []) as any[]).map(a => a.slug))
}

// The built-in sections a Google sub-link can point at (keys of SiteSeo.pages besides page slugs).
const SEO_SECTION_KEYS = new Set(['search', 'properties', 'neighborhoods', 'blog', 'about', 'contact', 'testimonials', 'home-value'])

// The agent's Google settings (IDX editor -> Google tab): the home result's title + description,
// every main page's own title + description (what Google shows as sub-links), the browser-tab
// icon, the site name, and whether search engines may index the site at all.
function applySiteSeo(meta: Metadata, resolved: ResolveResponse, path: string[] | undefined, profile: any, ctx: SeoCtx, areaSlugs: string[] = []): Metadata {
  const snapshot: any = resolved.published_snapshot || {}
  const seo = snapshot.seo || {}
  const pages = snapshot.pages || []
  const home = pages.find((p: any) => p.is_home) || pages[0]
  const siteName = (seo.site_name || '').trim() || (home?.title && home.title !== 'Home' ? home.title : '') || profile?.name || ''
  // Tab icon: the agent's own upload, else the OpenHousePal house mark for everyone (owner, 10/24).
  const icon = seo.favicon_url || '/icon-512.png'
  const segs = path || []
  const key = segs.length === 0 ? 'home' : segs.length === 1 ? (segs[0] === 'communities' ? 'neighborhoods' : segs[0]) : null
  const isPageSlug = key && key !== 'home' && pages.some((p: any) => p.slug === key)
  const custom = key && key !== 'home' ? seo.pages?.[key] : null
  const baseTitle = typeof meta.title === 'string' ? meta.title : undefined
  let title = meta.title
  let description = meta.description
  // Automatic title + description (lib/siteSeoAuto - the same text the editor's Google tab previews).
  // A page the agent made (or the starter Sold page): its own automatic wording, the same the
  // Google tab previews - it used to fall through to the site-wide description.
  const ownPage = isPageSlug && !SEO_SECTION_KEYS.has(key!) ? pages.find((p: any) => p.slug === key) : null
  const auto = key && (SEO_SECTION_KEYS.has(key) || !isPageSlug) ? autoSectionMeta(key, ctx) : ownPage ? (autoSectionMeta(key!, ctx) || autoPageMeta(ownPage, ctx)) : null
  if (key === 'home') {
    title = (seo.home_title || '').trim() || auto?.title || siteName || baseTitle
    description = (seo.description || '').trim() || meta.description || auto?.description
  } else if (key && (SEO_SECTION_KEYS.has(key) || isPageSlug)) {
    const base = auto?.title || baseTitle
    title = (custom?.title || '').trim() || (base && siteName ? withSiteName(base, siteName) : base)
    description = (custom?.description || '').trim() || auto?.description || meta.description || (seo.description || '').trim() || undefined
  } else if (key && areaSlugs.includes(key)) {
    // a neighborhood page - the agent can override its Google text in the Google tab too
    title = (custom?.title || '').trim() || (baseTitle && siteName ? withSiteName(baseTitle, siteName) : baseTitle)
    description = (custom?.description || '').trim() || meta.description
  } else if (segs[0] === 'showcase' || segs[0] === 'showcases' || segs[0] === 'forms' || segs[0] === 'create-showcase') {
    // A guest's own Showcase is named for them alone - no " | Agent Name" on the end. A form is
    // just its own title too ("Let's Find Your Next Home", not "... | Peter ..." - user, 10/24).
  } else if (baseTitle && siteName && !baseTitle.includes(siteName)) {
    // every other page (a home, a blog post) carries the site's name too, when it fits
    title = withSiteName(baseTitle, siteName)
  }
  const share = seo.share_image_url || undefined
  // The designed site card (link previews #10): read by the card off the site's own subdomain
  // address (works for an own-domain site too); ?v= follows the look, name, photo and market.
  const siteCard = share || ogCard('site', {
    site: resolved.site_id,
    host: resolved.subdomain_slug ? `${resolved.subdomain_slug}.${OHP_BASE_DOMAIN}` : undefined,
    v: cardVersion('c3', siteLookParam(snapshot.theme), seo.site_name, home?.title, profile?.name, profile?.brokerage, profile?.photo_url, profile?.market, ctx.towns.slice(0, 4).join(',')),
  })
  const hasOwnImage = !!(meta.openGraph as any)?.images
  return {
    ...meta,
    title,
    description,
    applicationName: siteName || undefined,
    // Phones' home-screen icon: our default is see-through, which iPhones fill with black (a black
    // house on black) - so the white-backed apple-touch-icon unless the agent uploaded their own.
    ...(icon ? { icons: { icon: [{ url: icon }], apple: [{ url: seo.favicon_url || '/apple-touch-icon.png' }] } } : {}),
    ...(seo.allow_indexing === false ? { robots: { index: false, follow: false } } : {}),
    // Search Console ownership proof (google_search_service - automatic, plus any code the agent
    // pasted). Google only looks on the home page.
    ...(key === 'home' && resolved.google_verification?.length ? { verification: { google: resolved.google_verification } } : {}),
    openGraph: {
      ...(meta.openGraph || {}),
      ...(title ? { title: title as string } : {}),
      ...(description ? { description: description as string } : {}),
      ...(siteName ? { siteName } : {}),
      // No image of its own: the agent's own image if they set one, else the designed site card (user, 10/17).
      ...(!hasOwnImage ? { images: [{ url: siteCard, ...(share ? {} : { width: 1200, height: 630 }) }] } : {}),
    },
    twitter: {
      ...((meta.twitter as any) || {}),
      card: 'summary_large_image' as const,
      ...(title ? { title: title as string } : {}),
      ...(description ? { description: description as string } : {}),
      ...(!hasOwnImage ? { images: [siteCard] } : {}),
    },
  }
}

// schema.org data for the home page: who the business is and what its main pages are - the
// structured signals Google uses for the site name, logo and sub-links.
function siteJsonLd(resolved: ResolveResponse, host: string, profile: any) {
  const snapshot: any = resolved.published_snapshot || {}
  const seo = snapshot.seo || {}
  const pages = (snapshot.pages || []) as any[]
  const home = pages.find(p => p.is_home) || pages[0]
  const origin = `https://${resolved.canonical_hostname || host}`
  const siteName = (seo.site_name || '').trim() || (home?.title && home.title !== 'Home' ? home.title : '') || profile?.name || resolved.subdomain_slug
  const logo = seo.favicon_url || snapshot.theme?.logo_url || undefined
  const nav: [string, string][] = [
    ['search', 'Search Homes'], ['properties', 'Featured Listings'], ['neighborhoods', 'Neighborhoods'], ['blog', 'Media'],
    ...pages.filter(p => !p.is_home && p.slug).map(p => [p.slug, p.title] as [string, string]),
    ['about', 'About'], ['contact', 'Contact'],
  ]
  return [
    {
      '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: origin,
      // Lets Google offer a search box for the site right in the result.
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    },
    agentJsonLd(origin, siteName, profile, { logo, description: (seo.description || '').trim() || undefined, shareRating: seo.share_rating }),
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: nav.map(([slug, name], i) => ({
        '@type': 'SiteNavigationElement', position: i + 1, name: seo.pages?.[slug]?.title || name, url: `${origin}/${slug}`,
        ...(seo.pages?.[slug]?.description ? { description: seo.pages[slug].description } : {}),
      })),
    },
  ]
}

// The agent as a business - shared by the home page, About and Reviews: contact details, the
// towns served, social profiles and the star rating - but the rating (and the reviews with it)
// ONLY when the backend says it's safe to share (profile.google_rating: 3+ reviews, 4.0+, none
// filtered out) and the agent hasn't switched it off in the Google tab. No rating = nothing sent.
function agentJsonLd(origin: string, siteName: string, profile: any, opts: { logo?: string; description?: string; reviews?: any[]; shareRating?: boolean } = {}) {
  const socials = (Array.isArray(profile?.social_links) ? profile.social_links : []).map((l: any) => l?.url).filter((u: any) => typeof u === 'string' && /^https?:\/\//.test(u))
  const rating = opts.shareRating === false ? null : profile?.google_rating
  return {
    '@context': 'https://schema.org', '@type': 'RealEstateAgent', '@id': `${origin}/#agent`, name: profile?.name || siteName, url: origin,
    ...(opts.logo ? { logo: opts.logo } : {}),
    ...(profile?.photo_url || opts.logo ? { image: profile?.photo_url || opts.logo } : {}),
    ...(profile?.phone ? { telephone: profile.phone } : {}),
    ...(profile?.email ? { email: profile.email } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(profile?.market ? { areaServed: profile.market } : {}),
    ...(profile?.brokerage ? { parentOrganization: { '@type': 'RealEstateAgent', name: profile.brokerage } } : {}),
    ...(socials.length ? { sameAs: socials } : {}),
    ...(rating?.count && rating?.average ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(rating.average).toFixed(2), reviewCount: rating.count, bestRating: 5, worstRating: 1 } } : {}),
    ...(rating && opts.reviews?.length ? {
      review: opts.reviews.slice(0, 10).map((r: any) => ({
        '@type': 'Review', author: { '@type': 'Person', name: r.author || 'Client' },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        ...(r.body ? { reviewBody: String(r.body).slice(0, 500) } : {}),
        ...(r.date ? { datePublished: String(r.date).slice(0, 10) } : {}),
      })),
    } : {}),
  }
}

/** "Home > Neighborhoods > Wayne" - Google shows this path in place of the bare URL. */
function breadcrumbJsonLd(origin: string, trail: [string, string][]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Home', ''] as [string, string], ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${origin}${path ? `/${path}` : ''}` })),
  }
}

function JsonLd({ data }: { data: any }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

const SECTION_CRUMBS: Record<string, string> = {
  search: 'Search Homes', properties: 'Featured Homes', neighborhoods: 'Neighborhoods', blog: 'Articles & Media',
  testimonials: 'Reviews', about: 'About', contact: 'Contact', 'home-value': 'Home Value',
}

// Google structured data for the page being viewed (the home page has its own, siteJsonLd):
// breadcrumbs everywhere, a Place for each town (its FAQ is on the page itself), the agent with
// their reviews on About/Reviews, a BlogPosting for each article and a RealEstateListing (with
// its price as an Offer) for each home. All fetches are the same cached ones the page makes.
async function pageStructuredData(resolved: ResolveResponse, host: string, path: string[], profile: any, areas: any[], reviews: any, siteName: string): Promise<any[]> {
  const origin = `https://${resolved.canonical_hostname || host}`
  const out: any[] = []
  const [seg0, seg1, seg2] = path
  const pages = (resolved.published_snapshot?.pages || []) as any[]
  const town = path.length === 1 ? areas.find(a => a.slug === seg0) : null
  if (town) {
    const place = [town.name, town.state].filter(Boolean).join(', ')
    out.push(breadcrumbJsonLd(origin, [['Neighborhoods', 'neighborhoods'], [place, town.slug]]))
    out.push({
      '@context': 'https://schema.org', '@type': 'Place', name: place, url: `${origin}/${town.slug}`,
      address: { '@type': 'PostalAddress', addressLocality: town.name, ...(town.state ? { addressRegion: town.state } : {}), addressCountry: 'US' },
      ...(town.photo ? { image: town.photo } : {}),
      ...(town.summary ? { description: seoClip(town.summary, 300) } : {}),
    })
    return out
  }
  if (seg0 && SECTION_CRUMBS[seg0] && !seg1) out.push(breadcrumbJsonLd(origin, [[SECTION_CRUMBS[seg0], seg0]]))
  else if (seg0 && !seg1) { const pg = pages.find(p => p.slug === seg0); if (pg) out.push(breadcrumbJsonLd(origin, [[pg.title || seg0, seg0]])) }
  if ((seg0 === 'testimonials' && reviews?.show) || seg0 === 'about') {
    out.push(agentJsonLd(origin, siteName, profile, { reviews: seg0 === 'testimonials' ? reviews?.reviews : undefined, shareRating: (resolved.published_snapshot as any)?.seo?.share_rating }))
  }
  if (seg0 === 'blog' && seg1) {
    const post = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/blog/${encodeURIComponent(seg1)}`)
    if (post) {
      out.push(breadcrumbJsonLd(origin, [['Articles & Media', 'blog'], [post.title, `blog/${post.slug}`]]))
      out.push({
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: seoClip(post.seo_title || post.title, 110),
        url: `${origin}/blog/${post.slug}`, mainEntityOfPage: `${origin}/blog/${post.slug}`,
        ...(post.meta_description || post.subtitle ? { description: post.meta_description || post.subtitle } : {}),
        ...(post.cover_image_url ? { image: [post.cover_image_url] } : {}),
        ...(post.published_at ? { datePublished: post.published_at } : {}),
        ...(post.category ? { articleSection: post.category } : {}),
        author: { '@type': 'Person', name: post.agent_name || profile?.name || siteName, url: `${origin}/about` },
        publisher: { '@id': `${origin}/#agent`, '@type': 'RealEstateAgent', name: profile?.name || siteName },
      })
    }
  }
  const listingKey = seg0 === 'properties' && seg1 ? seg1 : seg0 === 'search' && seg1 === 'properties' && seg2 ? seg2 : null
  if (listingKey) {
    const p = await fetchJson(seg0 === 'properties'
      ? `${INTERNAL_API_URL}/public/sites/${resolved.site_id}/properties/${encodeURIComponent(listingKey)}`
      : `${INTERNAL_API_URL}/public/sites/${resolved.site_id}/search/properties/${encodeURIComponent(listingKey)}`)
    if (p) {
      const url = `${origin}/${path.join('/')}`
      const street = p.address_withheld ? null : tidyAllCaps(p.address)
      const name = [street, tidyAllCaps(p.city), p.state].filter(Boolean).join(', ')
      const status = String(p.status || '').toLowerCase()
      const photos = (Array.isArray(p.photos) && p.photos.length ? p.photos : p.photo ? [p.photo] : []).slice(0, 6)
      out.push(breadcrumbJsonLd(origin, seg0 === 'properties' ? [['Featured Homes', 'properties'], [name || 'Home', path.join('/')]] : [['Search Homes', 'search'], [name || 'Home', path.join('/')]]))
      out.push({
        '@context': 'https://schema.org', '@type': 'RealEstateListing', name: name || 'Home for sale', url,
        ...(photos.length ? { image: photos } : {}),
        ...(p.description ? { description: seoClip(String(p.description), 300) } : {}),
        ...(p.price && !status.startsWith('closed') ? {
          offers: { '@type': 'Offer', price: Math.round(p.price), priceCurrency: 'USD', availability: status.includes('contract') || status.startsWith('pending') ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock', url },
        } : {}),
        about: {
          '@type': /condo/i.test(p.property_type || '') ? 'Apartment' : 'SingleFamilyResidence',
          address: { '@type': 'PostalAddress', ...(street ? { streetAddress: street } : {}), ...(p.city ? { addressLocality: tidyAllCaps(p.city) } : {}), ...(p.state ? { addressRegion: p.state } : {}), ...(p.zipcode ? { postalCode: p.zipcode } : {}), addressCountry: 'US' },
          ...(p.bedrooms != null ? { numberOfBedrooms: p.bedrooms } : {}),
          ...(p.bathrooms != null ? { numberOfBathroomsTotal: p.bathrooms } : {}),
          ...(p.living_area ? { floorSize: { '@type': 'QuantitativeValue', value: Math.round(p.living_area), unitCode: 'FTK' } } : {}),
          ...(p.latitude && p.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } } : {}),
        },
      })
    }
  }
  return out
}

// tags: town pages are tagged so an admin edit (Neighborhoods tab) can expire them at once -
// app/api/website-areas/revalidate.
async function fetchJson(url: string, tags?: string[]) {
  const res = await fetch(url, { next: { revalidate: 30, ...(tags ? { tags } : {}) } })
  if (!res.ok) return null
  return res.json()
}

const TOWN_TAGS = ['town-pages']

async function fetchFreshJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

function queryString(params: Record<string, any>, allowedKeys?: string[]) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (allowedKeys && !allowedKeys.includes(key)) continue
    if (typeof value === 'string' && value) qs.set(key, value)
  }
  return qs.toString()
}

function publicAliasMetadata(
  title: string,
  canonical?: string,
  opts?: { description?: string; ogImage?: string },
): Metadata {
  const description = opts?.description
  const images = opts?.ogImage ? [{ url: opts.ogImage, width: 1200, height: 630 }] : undefined
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: canonical ? { canonical } : undefined,
    openGraph: { title, description, images },
    twitter: images ? { card: 'summary_large_image', title, description, images: [opts!.ogImage!] } : undefined,
  }
}

// The agent's own page on their own domain (blog post, About, Contact): same shape as
// publicAliasMetadata, but indexable with its canonical here - these are what the agent wants found.
function ownPageMetadata(title: string, canonical?: string, opts?: { description?: string; ogImage?: string }): Metadata {
  const { robots: _noindex, ...rest } = publicAliasMetadata(title, canonical, opts)
  return rest
}


// A home's page: "239 Windham Dr, Exton, PA 19341 - $1,300,000" + a facts description + its photo -
// what Google and a text message preview show. A home whose seller withheld the address is named
// by its town only (the API already replaced the street).
function listingMetadata(p: any, canonical?: string, card?: string): Metadata {
  if (!p) return {}
  const { title, description } = autoListingMeta(p)
  // The designed share card (photo + the agent, like a Showcase property link); the raw photo only if there's no card.
  const photo = card || (Array.isArray(p.photos) && p.photos[0]) || p.photo
  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: { title, description, type: 'website', ...(canonical ? { url: canonical } : {}), ...(photo ? { images: [card ? { url: photo, width: 1200, height: 630 } : { url: photo }] } : {}) },
    twitter: { card: photo ? 'summary_large_image' : 'summary', title, description, ...(photo ? { images: [photo] } : {}) },
  }
}

// A listing card's look (the site's Classic accent / Luxe metal) and version (what it shows), so
// an edit to the site's colors or the home's price / status gives the card a new address.
function listingCardKeys(resolved: ResolveResponse, p: any): Record<string, string> {
  const look = siteLookParam(resolved.published_snapshot?.theme)
  const photo = (Array.isArray(p?.photos) && p.photos[0]) || p?.photo
  return { look, v: cardVersion('c3', look, p?.address, p?.status, p?.price, p?.report?.ClosePrice, typeof photo === 'string' ? photo : photo?.url) }
}

// Share-card image URL on the OpenHousePal app (absolute — these pages run on the agent's own
// domain, where /api/og isn't served).
function ogCard(kind: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  return `https://${OHP_BASE_DOMAIN}/api/og/${kind}?${qs.toString()}`
}

// /profile, not /about: same slug, but /about is the whole Agent Hub snapshot (~500 KB) and every
// page already fetches /profile (Next dedupes it), so this costs nothing extra.
async function resolveAgentHubSlug(siteId: string): Promise<string | null> {
  const profile = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`)
  return profile?.agent_hub_slug || null
}

function formatPostDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function estimateReadTime(blocks: any[]): number {
  const text = (blocks || [])
    .map(b => (b?.data?.text || b?.data?.html || '').replace(/<[^>]*>/g, ' '))
    .join(' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// The lead "Editor's Pick" article - a dramatic full-bleed text-on-photo treatment (same visual
// language as FeaturedHeroCard on the Properties page) rather than just a bigger version of the
// plain white grid card, so the Media hub opens with real drama instead of a thumbnail wall.
// The lead story: a split card (cover left, words right) about half a screen tall - not a full-
// screen poster that pushed every other article below the fold.
function FeaturedArticleCard({ post, theme, basePrefix }: { post: any; theme: any; basePrefix: string }) {
  const gold = theme.secondary_color
  const serif = fontClass(theme.heading_font, 'font-serif')
  return (
    <a href={`${basePrefix}/blog/${post.slug}`} className="group relative grid overflow-hidden rounded-[28px] bg-white shadow-[0_30px_70px_-40px_rgba(17,24,39,.5)] ring-1 ring-black/[0.05] transition duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-40px_rgba(17,24,39,.6)] lg:grid-cols-[1.15fr_1fr]">
      <div className="relative min-h-[240px] overflow-hidden sm:min-h-[300px] lg:min-h-[380px]">
        {post.cover_image_url ? (
          <SitePhoto src={resolveMediaUrl(post.cover_image_url)} widths={IMG.half} className="absolute inset-0 transition-transform duration-[1.6s] ease-out group-hover:scale-105 object-cover h-full w-full" />
        ) : (
          <div className="absolute inset-0"><BlogCoverArt category={post.category} title={post.title} tone="site" showWord={false} /></div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/10" />
        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: gold, color: theme.primary_color }}>Editor&apos;s Pick</span>
          {post.category && <span className="rounded-full bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow ">{post.category}</span>}
        </div>
      </div>
      <div className="relative flex flex-col justify-center p-7 sm:p-9 lg:p-11" style={{ background: `radial-gradient(110% 130% at 100% 0%, ${gold}26, transparent 55%), linear-gradient(135deg, #fffdf8 0%, var(--site-cream, #fbf6ec) 100%)` }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}><span className="h-px w-8" style={{ backgroundColor: gold }} />{post.published_at ? formatPostDate(post.published_at) : 'Latest'}</p>
        <h2 className={`ohp-site-heading mt-4 text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl ${serif}`} style={{ color: 'var(--site-heading)' }}>{post.title}</h2>
        {post.subtitle && <p className="mt-4 line-clamp-3 text-base leading-relaxed text-gray-600">{post.subtitle}</p>}
        <span className="mt-7 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition group-hover:translate-x-0.5" style={{ backgroundColor: theme.primary_color }}>
          Read the story <ArrowRight className="h-3.5 w-3.5" style={{ color: gold }} />
        </span>
      </div>
    </a>
  )
}

function BlogCard({ post, theme, basePrefix }: { post: any; theme: any; basePrefix: string }) {
  return (
    <a
      href={`${basePrefix}/blog/${post.slug}`}
      className="ohp-card group overflow-hidden rounded-3xl bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(17,24,39,0.18)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: theme.primary_color }}>
        {post.cover_image_url ? (
          <SitePhoto src={resolveMediaUrl(post.cover_image_url)} widths={IMG.card} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-110 object-cover" />
        ) : (
          <BlogCoverArt category={post.category} title={post.title} tone="site" showWord={!post.category} />
        )}
        {post.cover_image_url && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />}
        {post.category && (
          <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
            {post.category}
          </span>
        )}
        {post.has_video && (
          <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm">
            <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent" style={{ borderLeftColor: theme.primary_color }} />
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="ohp-site-heading text-base font-black text-gray-800">{post.title}</p>
        {post.subtitle && <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">{post.subtitle}</p>}
        {post.published_at && <p className="mt-3 text-xs font-semibold text-gray-400">{formatPostDate(post.published_at)}</p>}
      </div>
    </a>
  )
}

function HubMediaCard({ item, theme, kind }: { item: { id?: string; title?: string; image?: string | null; link: string }; theme: any; kind: 'video' | 'tour' }) {
  const gold = theme.secondary_color
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noreferrer"
      className="ohp-card group relative block overflow-hidden rounded-[22px] bg-gray-900 shadow-[0_20px_50px_-30px_rgba(17,24,39,.6)] ring-1 ring-black/[0.05] transition hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(17,24,39,.7)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-800">
        <SitePhoto src={item.image} widths={IMG.card} className="h-full w-full transition-transform duration-[1.4s] ease-out group-hover:scale-105 object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
        <span className="absolute left-4 top-4 rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white ">{kind === 'tour' ? 'House Tour' : 'Video'}</span>
        <span className="absolute left-1/2 top-[42%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span className="absolute inset-0 rounded-full border opacity-70" style={{ borderColor: gold }} />
          <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-[0_0_24px_rgba(0,0,0,.45)] transition group-hover:scale-110" style={{ backgroundColor: gold }}>
            <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent" style={{ borderLeftColor: theme.primary_color }} />
          </span>
        </span>
        {item.title && (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className="block h-px w-8" style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }} />
            <p className={`mt-2 line-clamp-2 text-[15px] font-black leading-snug text-white ${fontClass(theme.heading_font, 'font-serif')}`}>{item.title}</p>
          </div>
        )}
      </div>
    </a>
  )
}

async function BlogIndex({ siteId, theme, basePrefix }: { siteId: string; theme: any; basePrefix: string; category?: string }) {
  const [media, profile] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/blog?limit=48`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`),
  ])
  const posts: any[] = media?.posts || []
  const videos: any[] = media?.videos || []
  const tours: any[] = media?.tours || []
  if (!posts.length && !videos.length && !tours.length) {
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-40 text-center text-gray-400">No media published yet.</main>
  }
  // The streaming-style hub (now-showing hero, tabs, gliding rows, video player) - MediaHub.
  return <MediaHub theme={theme} basePrefix={basePrefix} posts={posts} videos={videos} tours={tours} agentName={profile?.name} channelUrl={media?.channel_url} />
}

async function BlogDetail({ siteId, slug, theme, basePrefix, path }: { siteId: string; slug: string; theme: any; basePrefix: string; path?: string[] }) {
  const [post, media] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/blog/${encodeURIComponent(slug)}`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/blog?limit=48`),
  ])
  if (!post) {
    // an old site's /blog/<post> that isn't a post here
    const oldTo = path ? await oldLinkTarget(siteId, path) : null
    if (oldTo) permanentRedirect(`${basePrefix}${oldTo}`)
    notFound()
  }
  const hubSlug = await resolveAgentHubSlug(siteId)
  const related = ((media?.posts || []) as any[])
    .filter(p => p.slug !== slug && (!post.category || p.category === post.category))
    .slice(0, 3)
  const readTime = estimateReadTime(post.blocks)

  const gold = theme.secondary_color
  const serif = fontClass(theme.heading_font, 'font-serif')
  return (
    <main>
      {/* Luxe article header - gold light, kicker, serif title, byline (same language as the Spotlight) */}
      <header className="relative overflow-hidden" style={{ background: `radial-gradient(110% 130% at 100% 0%, ${gold}33, transparent 55%), linear-gradient(135deg, var(--site-bg) 0%, var(--site-bg-alt) 100%)` }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(139,115,85,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(139,115,85,.8)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(70%_80%_at_80%_0%,#000,transparent_75%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-12">
          <a href={`${basePrefix}/blog`} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-gray-800 shadow-sm transition hover:-translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5 rotate-180" /> All Articles
          </a>
          <p className="mt-8 flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.28em]" style={{ color: gold }}>
            <span className="h-px w-8" style={{ backgroundColor: gold }} />{post.category || 'Journal'}
          </p>
          <h1 className={`ohp-site-heading mt-3 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl ${serif}`} style={{ color: 'var(--site-heading)' }}>{post.title}</h1>
          {post.subtitle && <p className="mt-4 text-lg leading-relaxed text-gray-600 sm:text-xl">{post.subtitle}</p>}
          {post.agent_name && (
            <div className="mt-7 flex items-center gap-3">
              {post.agent_photo_url && <img src={sizedImage(resolveMediaUrl(post.agent_photo_url), 128)} loading="lazy" decoding="async" alt={post.agent_name} className="h-11 w-11 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: gold }} />}
              <div>
                <p className="text-sm font-black text-gray-900">{post.agent_name}</p>
                <p className="text-xs font-semibold text-gray-500">
                  {[post.published_at ? formatPostDate(post.published_at) : null, readTime ? `${readTime} min read` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {post.cover_image_url && (
        <div className="mx-auto -mt-2 max-w-5xl px-6 pt-8">
          <div className="overflow-hidden rounded-[28px] p-1.5 shadow-[0_40px_80px_-50px_rgba(0,0,0,.7)]" style={{ background: `linear-gradient(135deg, ${gold}aa, #fff, ${gold}88)` }}>
            <img src={sizedImage(resolveMediaUrl(post.cover_image_url), 1200)} loading="lazy" decoding="async" alt={post.title} className="aspect-[16/9] w-full rounded-[22px] object-cover" />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-[28px] border bg-white p-6 shadow-[0_30px_60px_-46px_rgba(139,115,85,.7)] sm:p-10" style={{ borderColor: `${gold}33` }}>
          <SiteBlogArticle
            hubSlug={hubSlug}
            blogSlug={post.slug}
            blocks={post.blocks}
            agent={{ name: post.agent_name, brokerage: post.agent_brokerage, photoUrl: post.agent_photo_url, title: post.agent_title }}
            accentColor={gold}
            mode={theme.mode === 'dark' ? 'dark' : 'light'}
            luxe={theme.template !== 'default'}
            basePrefix={basePrefix}
            related={related.map((r: any) => ({ slug: r.slug, title: r.title, category: r.category, coverImageUrl: r.cover_image_url }))}
            // The site's own footer already ends every page with the signature card.
            signatureCard={false}
            signatureTowns={post.area_towns || []}
            neighborhoodLinks={post.neighborhood_links || []}
          />
        </div>

        <div className="ohp-dark-band relative mt-10 overflow-hidden rounded-[28px] p-8 text-center text-white" style={{ backgroundColor: theme.primary_color }}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30" style={{ background: `radial-gradient(closest-side, ${gold} 0%, ${gold} 40%, transparent 100%)` }} />
          <p className="relative text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: 'var(--site-accent-text)' }}>Your next move</p>
          <h2 className={`relative mt-2 text-2xl font-black ${serif}`}>Have questions about the market?</h2>
          <p className="relative mt-2 text-sm text-white/65">Let&apos;s talk through what this means for your next move.</p>
          <a href={`${basePrefix}/contact`} className="ohp-gold-sheen relative mt-5 inline-flex items-center gap-2 rounded-full px-7 py-3 text-xs font-black uppercase tracking-widest shadow-lg transition hover:-translate-y-0.5" style={theme.template !== 'default' ? { backgroundColor: gold, color: theme.primary_color } : { backgroundColor: '#ffffff', color: theme.primary_color }}>
            Get in touch <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </main>
  )
}

async function PropertiesIndex({ siteId, theme, basePrefix }: { siteId: string; theme: any; basePrefix: string }) {
  const listings: any[] = (await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/properties`)) || []
  if (!listings.length) {
    return <main className="mx-auto max-w-3xl px-6 py-24 text-center text-gray-400">No active listings right now.</main>
  }

  // Up to 10 for the top hero's auto-cycling carousel (see FeaturedHeroCarousel) - already in
  // whatever order the agent's own Featured page settings produced (content_adapters.
  // get_featured_page_listings), this just windows through them 3 at a time. Everything past
  // that goes in the grid below.
  const heroPool = listings.slice(0, 10)
  const rest = listings.slice(10)

  return (
    <main>
      <FeaturedPageClient siteId={siteId} theme={theme} basePrefix={basePrefix} heroPool={heroPool} rest={rest} />
      {/* The footer's closing band carries the "let's talk" forms - no second one here. */}
    </main>
  )
}

function areaHoverFactLines(area: any): string[] {
  const facts = area.hover_facts || {}
  return [
    ...(facts.market || []).slice(0, 1),
    ...(area.school_districts?.length ? [`${area.school_districts.slice(0, 2).join(' / ')} schools`] : []),
    ...(facts.downtown?.length ? [`Town center: ${facts.downtown[0]}`] : []),
    ...(facts.parks?.length ? [`Parks: ${facts.parks.slice(0, 2).join(' / ')}`] : []),
    ...(facts.restaurants_shopping?.length ? [`Dining & shops: ${facts.restaurants_shopping.slice(0, 2).join(' / ')}`] : []),
    ...(facts.transportation?.length ? [`Transit: ${facts.transportation[0]}`] : []),
  ].filter(Boolean).slice(0, 4)
}

function AreaCard({ area, theme, basePrefix, featured = false }: { area: any; theme: any; basePrefix: string; featured?: boolean }) {
  const hoverFacts = areaHoverFactLines(area)
  return (
    <a
      href={`${basePrefix}/${area.slug}`}
      className={`ohp-card group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(17,24,39,0.18)] ${featured ? 'sm:col-span-2 sm:row-span-2' : ''}`}
    >
      <div className={`relative w-full overflow-hidden bg-gray-100 ${featured ? 'aspect-[16/11]' : 'aspect-[4/3]'}`}>
        <SitePhoto src={area.photo} widths={IMG.card} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-110 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {featured && (
          <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-sm" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
            Featured Neighborhood
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className={`ohp-site-heading font-black text-white ${featured ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{area.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-white/80"><MapPin className="h-3 w-3" />{[area.county, area.state].filter(Boolean).join(', ')}</p>
        </div>
      </div>
      {featured ? (
        // The big card carries a real introduction to the town - schools, the town center,
        // parks, dining and transit - instead of a tall white box with two lines in it.
        <div className="flex flex-1 flex-col gap-4 p-6">
          {area.summary && <p className="line-clamp-3 text-[15px] leading-relaxed text-gray-600">{area.summary}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['Schools', area.school_districts?.length ? area.school_districts.slice(0, 2).join(' / ') : null],
              ['Town center', area.hover_facts?.downtown?.[0] || null],
              ['Parks', area.hover_facts?.parks?.length ? area.hover_facts.parks.slice(0, 2).join(' / ') : null],
              ['Dining & shops', area.hover_facts?.restaurants_shopping?.length ? area.hover_facts.restaurants_shopping.slice(0, 2).join(' / ') : null],
              ['Getting around', area.hover_facts?.transportation?.[0] || null],
              ['Market', area.hover_facts?.market?.[0] || null],
            ] as [string, string | null][]).filter(([, v]) => v).slice(0, 4).map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-3.5" style={{ borderColor: `${theme.secondary_color}40`, backgroundColor: `${theme.secondary_color}0d` }}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.secondary_color }}>{label}</p>
                <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 border-t border-gray-100 pt-4 text-xs font-bold text-gray-600">
            <span className="flex items-center gap-4">
              {area.median_price != null && <span>{formatCompactPrice(area.median_price)} <span className="font-medium text-gray-400">median</span></span>}
              {area.active_count != null && <span>{area.active_count} <span className="font-medium text-gray-400">for sale</span></span>}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-transform group-hover:translate-x-1" style={{ color: theme.secondary_color }}>Explore {area.name} <ArrowRight className="h-3.5 w-3.5" /></span>
          </div>
        </div>
      ) : (area.median_price != null || area.active_count != null || area.summary) && (
        <div className="flex flex-1 flex-col justify-between gap-3 p-5">
          {area.summary && <p className="line-clamp-2 text-sm text-gray-500">{area.summary}</p>}
          {(area.median_price != null || area.active_count != null) && (
            <div className="flex items-center gap-4 border-t border-gray-100 pt-3 text-xs font-bold text-gray-600">
              {area.median_price != null && <span>{formatCompactPrice(area.median_price)} <span className="font-medium text-gray-400">median</span></span>}
              {area.active_count != null && <span>{area.active_count} <span className="font-medium text-gray-400">for sale</span></span>}
            </div>
          )}
          {hoverFacts.length > 0 && (
            <ul className="hidden space-y-1 border-t border-gray-100 pt-3 text-xs font-semibold text-gray-500 group-hover:block group-focus-visible:block">
              {hoverFacts.map((line, index) => <li key={index} className="line-clamp-1">{line}</li>)}
            </ul>
          )}
        </div>
      )}
    </a>
  )
}

async function CommunitiesIndex({ siteId, theme, basePrefix }: { siteId: string; theme: any; basePrefix: string }) {
  const areas = (await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS)) || []
  if (!areas.length) {
    return <main className="mx-auto max-w-3xl px-6 pb-24 pt-40 text-center text-gray-400">No neighborhoods listed yet.</main>
  }
  // NeighborhoodsExplorer: hero + town search + bento of town cards + "help me choose"; the
  // side-by-side compare tool closes the page.
  return (
    <NeighborhoodsExplorer areas={areas} theme={theme} basePrefix={basePrefix}
      compare={<div key="compare" className="pb-16"><NeighborhoodCompareLauncher areas={areas} basePrefix={basePrefix} theme={theme} /></div>} />
  )
}

async function PropertyDetail({ siteId, listingKey, theme, basePrefix, path }: { siteId: string; listingKey: string; theme: any; basePrefix: string; path?: string[] }) {
  const p = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/properties/${encodeURIComponent(listingKey)}`)
  if (!p) {
    // an old site's /properties/<home> that isn't a listing here
    const oldTo = path ? await oldLinkTarget(siteId, path) : null
    if (oldTo) permanentRedirect(`${basePrefix}${oldTo}`)
    notFound()
  }
  return <PropertyDetailView p={p} theme={theme} basePrefix={basePrefix} siteId={siteId} />
}

// Shared by PropertyDetail (this agent's own listings) and SearchPropertyDetail (any full-MLS
// search result, see get_public_mls_property_detail) - same rendering either way, only the
// fetch differs. `p.similar` is only ever present for the agent-owned path. `siteId` is optional
// (SearchPropertyDetail passes a rewritten basePrefix but no siteId) - the community cross-link
// and "contact this agent" sections only render when it's available.
async function PropertyDetailView({ p, theme, basePrefix, siteId }: { p: any; theme: any; basePrefix: string; siteId?: string }) {
  // The agent's own listing with a published Listing Spotlight: the Spotlight IS its page.
  if (p.spotlight_url) redirect(p.spotlight_url)
  // The agent's forms are fetched as soon as their hub is known, alongside the rest (not after it).
  const hubAndForms = siteId ? resolveAgentHubSlug(siteId).then(async slug => ({
    slug,
    forms: (slug ? (await fetchJson(`${INTERNAL_API_URL}/agent-hub/forms/public/${encodeURIComponent(slug)}`)) || [] : []) as any[],
  })) : Promise.resolve({ slug: null as string | null, forms: [] as any[] })
  const [areasRaw, agentProfile, { slug: hubSlug, forms }] = await Promise.all([
    siteId ? fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS) : Promise.resolve(null),
    siteId ? fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`) : Promise.resolve(null),
    hubAndForms,
  ])
  const areas: any[] = areasRaw || []
  const matchedArea = p.city ? areas.find((a: any) => a.name?.toLowerCase() === String(p.city).toLowerCase()) : null
  // "Request a tour": the agent's "Schedule a Showing" form, answered right on the page (IdxTourRequest).
  const showingForm = forms.find((f: any) => f.formType === 'showing')
  const nearby = siteId && p.listing_key && p.latitude != null && p.longitude != null ? (
    <ExploreNearby
      siteId={siteId}
      kind="property"
      listingKey={p.listing_key}
      title="Explore Nearby"
      originLabel={p.address || 'this home'}
      origin={{ lat: Number(p.latitude), lng: Number(p.longitude) }}
      theme={theme}
    />
  ) : null
  const similar = p.similar?.length > 0 ? (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {p.similar.slice(0, 6).map((item: any) => <HomeCard key={item.listing_key} listing={item} theme={theme} basePrefix={basePrefix} />)}
    </div>
  ) : null

  return (
    <>
      <IdxPropertyPage
        p={p}
        theme={theme}
        basePrefix={basePrefix}
        siteId={siteId}
        agent={agentProfile}
        showing={hubSlug && showingForm ? { path: `/${hubSlug}/${showingForm.slug}`, hubSlug, formSlug: showingForm.slug, formId: showingForm.formId || null } : null}
        matchedArea={matchedArea ? { slug: matchedArea.slug, name: matchedArea.name } : null}
        nearby={nearby}
        similar={similar}
      />
      {/* The full Bright notice is in the site footer right below (SiteFooter idxNotice). */}
      <div className="pb-20 lg:pb-0" />
    </>
  )
}

// The About page - a live mirror of this agent's real Agent Hub (see
// content_adapters.get_agent_hub_snapshot) rather than a separately hand-written bio block, so
// the agent's own site can work as their link-tree too, not just openhousepal.com/{slug}.
async function AboutPage({ siteId, basePrefix, host, framed = false, query = '', hubPage = '' }: { siteId: string; basePrefix: string; host: string; framed?: boolean; query?: string; hubPage?: '' | 'sales' }) {
  const slug = await resolveAgentHubSlug(siteId)
  if (!slug) notFound()
  const visitorQs = new URLSearchParams(query)
  // /sales?town=X&from=/x-pa (a town page's "View all"): the hub's Sales page filtered to that
  // town, its Back returning to the page the visitor came from. Only a path on this site.
  const from = visitorQs.get('from') || ''
  const fromPath = /^\/(?!\/)/.test(from) ? from : ''
  // Where the framed hub sends a visitor "home" (form submitted, Back with no history). Absolute on
  // the agent's own address: the hub runs on openhousepal.com, where a bare "/" would land on
  // OpenHousePal's own homepage instead of this site's.
  const idxReturn = encodeURIComponent(fromPath
    ? (basePrefix ? fromPath : `https://${host}${fromPath}`)
    : (basePrefix ? `${basePrefix}/` : `https://${host}/`))
  // The visit's own params reach the hub inside (?src=qr counts a QR scan, ?intro=0 from setup,
  // campaign tags) - incl. old openhousepal.com/<slug> links forwarded here (proxy.ts).
  for (const k of ['idx_light', 'idx_return', 'preview', 'from']) visitorQs.delete(k)
  const extra = visitorQs.toString() ? `&${visitorQs.toString()}` : ''
  const hubPath = `/${encodeURIComponent(slug)}${hubPage ? `/${hubPage}` : ''}`
  const src = basePrefix.startsWith('/ohp-site-render/')
    ? `${hubPath}?idx_light=1&idx_return=${idxReturn}${extra}`
    : `https://${OHP_BASE_DOMAIN}${hubPath}?idx_light=1&idx_return=${idxReturn}${extra}`
  return (
    // dvh, not vh: on phones 100vh runs under the browser bar and cut off the hub's bottom. The
    // 18px overhang (hides the frame's scrollbar) only on desktop - phones have no scrollbar, so it
    // was cutting 18px off the hub's right edge.
    <main className={`${framed ? 'h-[calc(100dvh-5rem)]' : 'h-[100dvh]'} w-full overflow-hidden bg-[#f7f5f1]`}>
      <iframe src={src} title="Agent Hub" className="h-full w-full border-0 lg:w-[calc(100%+18px)]" />
    </main>
  )
}

async function ShowcaseAliasPage({ siteId, shareToken, home, basePrefix, accent }: { siteId: string; shareToken: string; home?: string; basePrefix: string; accent?: string }) {
  const data = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/showcase/${encodeURIComponent(shareToken)}`)
  if (!data) notFound()
  // In the site's own colour (lib/accentRecolor via ?accent=).
  const rest = `/showcase/${encodeURIComponent(shareToken)}${home ? `/${encodeURIComponent(home)}` : ''}${accent ? `?accent=${encodeURIComponent(accent.replace('#', ''))}` : ''}`
  const src = basePrefix.startsWith('/ohp-site-render/') ? rest : `https://${OHP_BASE_DOMAIN}${rest}`
  const mine = await fetchFreshJson(`${INTERNAL_API_URL}/public/sites/${siteId}/my-showcase/${encodeURIComponent(shareToken)}`)
  // The whole screen, to the very bottom edge (viewport-fit=cover, generateViewport below) - a
  // 100dvh box stopped short of iPhone Safari's floating bottom bar and left an empty band above it
  // (user, 10/28). The top and sides stay clear of the notch; the frame is told the bottom edge.
  return (
    <main className="fixed inset-0 overflow-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {mine?.code && <RememberShowcase code={mine.code} name={mine.name} />}
      <FramePathSync src={src} basePrefix={basePrefix.startsWith('/ohp-site-render/') ? basePrefix : ''} prefix={`/showcase/${encodeURIComponent(shareToken)}`} />
      <iframe src={src} title="Showcase" className="h-full w-full border-0" />
    </main>
  )
}

// An IDX agent's sign-in QR codes carry their own domain (resolve_owner_public_base_url), so
// /open-house/{id}/... - the sign-in page, its kiosk, disclosure / second-visit forms and the
// guest's Guest Pass - arrives here. Same framed treatment as a Showcase: the app's own page,
// full screen, so it works exactly as on openhousepal.com (its API calls, the redirect to the
// Guest Pass, new tabs) while the address bar keeps the agent's domain.
function OpenHouseAliasPage({ rest, query, basePrefix }: { rest: string[]; query: string; basePrefix: string }) {
  const tail = `/open-house/${rest.map(encodeURIComponent).join('/')}${query ? `?${query}` : ''}`
  const src = basePrefix.startsWith('/ohp-site-render/') ? tail : `https://${OHP_BASE_DOMAIN}${tail}`
  return <OpenHouseFrame src={src} basePrefix={basePrefix.startsWith('/ohp-site-render/') ? basePrefix : ''} />
}

// Agent Hub links (the hub, Sales, forms, reviews, blogs) are minted as <base>/<hub-slug>/... for
// every plan, so an IDX agent's QR codes, signature and emails carry the same path whether the base
// is openhousepal.com or their own domain. Here the agent's domain opens that same app page framed,
// with the address bar kept on the agent's domain.
function HubAliasPage({ rest, query, basePrefix }: { rest: string[]; query: string; basePrefix: string }) {
  const tail = `/${rest.map(encodeURIComponent).join('/')}${query ? `?${query}` : ''}`
  const src = basePrefix.startsWith('/ohp-site-render/') ? tail : `https://${OHP_BASE_DOMAIN}${tail}`
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#f7f5f1]">
      <iframe src={src} title="Agent Hub" allow="fullscreen; clipboard-write" className="h-full w-full border-0" />
    </main>
  )
}

async function CmaAliasPage({ siteId, shareSlug, basePrefix }: { siteId: string; shareSlug: string; basePrefix: string }) {
  const data = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/cma/${encodeURIComponent(shareSlug)}`)
  if (!data) notFound()
  const src = basePrefix.startsWith('/ohp-site-render/')
    ? `/cma/${encodeURIComponent(shareSlug)}`
    : `https://${OHP_BASE_DOMAIN}/cma/${encodeURIComponent(shareSlug)}`
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#f7f5f1]">
      <iframe src={src} title="Comparative Market Analysis" className="h-full w-full border-0" />
    </main>
  )
}

async function FormAliasPage({ siteId, formId, basePrefix, forceLightMode = false, embeddedInSiteChrome = false, campaignToken = null }: { siteId: string; formId: string; basePrefix: string; forceLightMode?: boolean; embeddedInSiteChrome?: boolean; campaignToken?: string | null }) {
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${siteId}/forms/${encodeURIComponent(formId)}${campaignToken ? `?c=${encodeURIComponent(campaignToken)}` : ''}`, { cache: 'no-store' })
  const form = res.ok ? await res.json() : null
  if (!form) notFound()
  return <WebsitePublicFormPage siteId={siteId} formId={formId} agentHubPath={`${basePrefix}/hub`} basePrefix={basePrefix} initialForm={form} forceLightMode={forceLightMode} embeddedInSiteChrome={embeddedInSiteChrome} campaignToken={campaignToken} />
}

async function ContactAliasPage({ siteId, basePrefix }: { siteId: string; basePrefix: string }) {
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${siteId}/forms/by-type/how_can_i_help`, { cache: 'no-store' })
  const form = res.ok ? await res.json() : null
  if (!form) notFound()
  return <WebsitePublicFormPage siteId={siteId} formId={form.formId || form.form_id} agentHubPath={`${basePrefix}/hub`} basePrefix={basePrefix} initialForm={form} forceLightMode embeddedInSiteChrome />
}

// The visitor this browser remembers (lib/visitor.ts writes it; same cookie, read here on the server).
async function siteVisitorCookie(): Promise<{ name: string; firstName: string; email: string; showcase?: string } | null> {
  const raw = (await cookies()).get('ohp_visitor')?.value
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw))
    const email = typeof v?.e === 'string' && v.e.includes('@') ? v.e : ''
    const showcase = typeof v?.s === 'string' && /^[\w-]{3,80}$/.test(v.s) ? v.s : undefined
    return email || showcase ? { name: String(v.n || ''), firstName: String(v.f || ''), email, ...(showcase ? { showcase } : {}) } : null
  } catch { return null }
}

async function MyShowcaseRoute({ siteId, basePrefix, theme, create, town }: { siteId: string; basePrefix: string; theme: SiteTheme; create: boolean; town?: string | null }) {
  const visitor = await siteVisitorCookie()
  const [summary, areas, profile] = await Promise.all([
    visitor?.showcase ? fetchFreshJson(`${INTERNAL_API_URL}/public/sites/${siteId}/my-showcase/${encodeURIComponent(visitor.showcase)}`) : Promise.resolve(null),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`),
  ])
  const accent = theme.secondary_color || '#C9A24D'
  const agent = { name: profile?.name || null, photo_url: profile?.photo_url || null }
  const areaList = ((areas || []) as any[]).map(a => ({ name: a.name, state: a.state, slug: a.slug, photo: a.photo || null }))
  if (summary?.code && !create) {
    return <MyShowcase summary={summary} siteId={siteId} basePrefix={basePrefix} accent={accent} agent={agent} areas={areaList} headingClass="ohp-site-heading" />
  }
  // ?town= (a town page's "Get alerts"): start on the towns step with that town already ticked.
  const startTown = typeof town === 'string' ? town.trim().slice(0, 80) : ''
  return <ShowcaseBuilder siteId={siteId} basePrefix={basePrefix} accent={accent} agent={agent} areas={areaList} existingCode={summary?.code || null} serverVisitor={visitor} headingClass="ohp-site-heading"
    {...(startTown ? { initial: { cities: [startTown] }, startStep: 'place' as const } : {})} />
}

// The Search tab's results - real full-MLS search (see content_adapters.get_search_results),
// 'q' parsed deterministically with no AI/LLM call. A real IDX map+list+grid experience (Phase
// 6): every result with coordinates gets a pin, click a pin or a list card to highlight the
// other, same detail page either way - see PropertyMapSearch.
async function SearchResults({ siteId, theme, basePrefix, filters }: { siteId: string; theme: any; basePrefix: string; filters: SearchFilterParams }) {
  const params = new URLSearchParams()
  params.set('q', filters.q || '')
  for (const key of ['min_price', 'max_price', 'min_beds', 'min_baths', 'property_type', 'min_sqft', 'max_sqft', 'min_acres', 'min_year_built', 'school_district', 'sort', 'include_rentals', 'area'] as const) {
    if (filters[key]) params.set(key, filters[key] as string)
  }
  // Landing on /search directly (not just arriving from a hero search) still gets the real
  // map+list IDX experience, not a placeholder - a blank query defaults server-side to the
  // agent's own served areas instead of an unscoped full-MLS dump (see get_search_results).
  const data = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/search?${params.toString()}`)
  const results = data?.results || []
  // Fields the free-text box's own parser inferred (e.g. "2 beds over 3M radnor schools") but
  // the visitor never explicitly clicked in the filter bar - shown back as the bar's own values
  // so a visitor can see (and adjust) what their search actually matched against, rather than
  // the bar looking blank while results are silently filtered by something invisible.
  const applied = data?.applied_filters || {}
  const effectiveFilters: SearchFilterParams = {
    ...filters,
    min_price: filters.min_price || (applied.min_price != null ? String(applied.min_price) : undefined),
    max_price: filters.max_price || (applied.max_price != null ? String(applied.max_price) : undefined),
    min_beds: filters.min_beds || (applied.min_beds != null ? String(applied.min_beds) : undefined),
    min_baths: filters.min_baths || (applied.min_baths != null ? String(applied.min_baths) : undefined),
    school_district: filters.school_district || applied.school_district || undefined,
    property_type: filters.property_type || applied.property_type || undefined,
    min_acres: filters.min_acres || (applied.min_acres != null ? String(applied.min_acres) : undefined),
  }
  return <PropertyMapSearch listings={results} theme={theme} basePrefix={basePrefix} filters={effectiveFilters} towns={Array.isArray(applied.cities) ? applied.cities : []} />
}

async function SearchPropertyDetail({ siteId, listingKey, theme, basePrefix }: { siteId: string; listingKey: string; theme: any; basePrefix: string }) {
  const owner = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/search/properties/${encodeURIComponent(listingKey)}`)
  if (!owner) notFound()
  return <PropertyDetailView p={owner} theme={theme} basePrefix={basePrefix} siteId={siteId} />
}


interface NeighborhoodCompareParams {
  areas?: string
  first?: string
}

function areaSubtitle(area: any) {
  return [area.parent_area_name, area.county, area.state].filter(Boolean).join(', ')
}

function areaSummary(area: any) {
  const facts = area.facts || {}
  return area.narrative?.summary || facts.market_context?.notes || facts.downtown_centers?.notes || ''
}

function compareCategoryNames(area: any, category: string, limit = 5) {
  return categoryEntities((area.facts || {})[category]).slice(0, limit).map(e => e.name).filter(Boolean)
}

function compareCategoryNote(area: any, category: string) {
  return String(((area.facts || {})[category] || {}).notes || '').trim()
}

function schoolDistrictNames(area: any) {
  return (((area.facts || {}).public_schools || {}).districts || []).map((d: any) => d.name).filter(Boolean)
}

function publicSchoolNames(area: any, limit = 6) {
  const data = ((area.facts || {}).public_schools || {})
  return [
    ...(data.elementary_schools || []),
    ...(data.middle_schools || []),
    ...(data.high_schools || []),
  ].map((s: any) => s.name).filter(Boolean).slice(0, limit)
}

function compareText(area: any) {
  const facts = area.facts || {}
  return JSON.stringify({
    name: area.name,
    slug: area.slug,
    type: area.area_type,
    parent: area.parent_area_name,
    narrative: area.narrative,
    market: facts.market_context,
    restaurants: facts.restaurants,
    shopping: facts.shopping,
    parks: facts.parks,
    downtown: facts.downtown_centers,
    transportation: facts.transportation,
  }).toLowerCase()
}

function isPhiladelphiaNeighborhood(area: any) {
  const text = `${area.name || ''} ${area.slug || ''} ${area.parent_area_name || ''}`.toLowerCase()
  return area.area_type === 'neighborhood' && /philadelphia|center city|rittenhouse|fishtown|south philly|south philadelphia/.test(text)
}

function primaryAreaFeel(area: any) {
  const text = compareText(area)
  if (isPhiladelphiaNeighborhood(area)) return 'urban'
  if (/suburban|main line|estate|larger propert|acre|township|residential|campus/.test(text)) {
    if (/walkab|downtown|commercial center|town center|village|septa|train|rail/.test(text)) return 'walkable_town'
    return 'suburban'
  }
  if (/urban|city|walkab|downtown|center city|commercial center|septa|train|rail|transit/.test(text)) return 'walkable_town'
  return 'mixed'
}

function feelPhrase(feel: string) {
  if (feel === 'urban') return 'more urban and Center City-oriented'
  if (feel === 'walkable_town') return 'more walkable or town-center oriented'
  if (feel === 'suburban') return 'more suburban or residential'
  return 'more mixed'
}

function isUrbanish(area: any) {
  const feel = primaryAreaFeel(area)
  return feel === 'urban' || feel === 'walkable_town'
}

function isSuburbanish(area: any) {
  return primaryAreaFeel(area) === 'suburban'
}

function clearCountWinner(a: any, b: any, category: string) {
  const aCount = compareCategoryNames(a, category, 20).length
  const bCount = compareCategoryNames(b, category, 20).length
  if (Math.abs(aCount - bCount) < 2) return null
  return aCount > bCount ? a : b
}

function inventoryWinner(a: any, b: any) {
  const aTotal = a.inventory?.total || 0
  const bTotal = b.inventory?.total || 0
  const diff = Math.abs(aTotal - bTotal)
  if (diff < 5 && (Math.max(aTotal, bTotal) < Math.max(1, Math.min(aTotal, bTotal) * 1.75))) return null
  return aTotal > bTotal ? a : b
}

function differenceLines(a: any, b: any) {
  const lines: string[] = []
  const aFeel = primaryAreaFeel(a)
  const bFeel = primaryAreaFeel(b)
  if (aFeel !== bFeel && aFeel !== 'mixed' && bFeel !== 'mixed') {
    lines.push(`${a.name} reads ${feelPhrase(aFeel)} in the stored guide, while ${b.name} reads ${feelPhrase(bFeel)}.`)
  }

  const diningWinner = clearCountWinner(a, b, 'restaurants')
  if (diningWinner) {
    const other = diningWinner.slug === a.slug ? b : a
    lines.push(`${diningWinner.name} has more researched dining entries in this guide than ${other.name}.`)
  }

  const transitWinner = clearCountWinner(a, b, 'transportation')
  if (transitWinner) {
    const other = transitWinner.slug === a.slug ? b : a
    lines.push(`${transitWinner.name} has more researched transportation references than ${other.name}.`)
  }

  const invWinner = inventoryWinner(a, b)
  if (invWinner) {
    const other = invWinner.slug === a.slug ? b : a
    lines.push(`${invWinner.name} currently has more active homes in OHP listing data than ${other.name}.`)
  }

  const aDistricts = schoolDistrictNames(a)
  const bDistricts = schoolDistrictNames(b)
  if (aDistricts.length && bDistricts.length && aDistricts.join('|') !== bDistricts.join('|')) {
    lines.push(`${a.name} and ${b.name} show different public-school district context; verify exact assignment by property address.`)
  }
  return lines.slice(0, 4)
}

function bestForItems(a: any, b: any) {
  const items: { label: string; winner?: any; neutral?: string }[] = []
  const aFeel = primaryAreaFeel(a)
  const bFeel = primaryAreaFeel(b)
  const dining = clearCountWinner(a, b, 'restaurants')
  if (dining) items.push({ label: 'Dining and restaurants', winner: dining })
  const parks = clearCountWinner(a, b, 'parks')
  if (parks) items.push({ label: 'Parks and recreation', winner: parks })
  const transit = clearCountWinner(a, b, 'transportation')
  if (transit) items.push({ label: 'Transit context', winner: transit })
  const inv = inventoryWinner(a, b)
  if (inv) items.push({ label: 'More inventory right now', winner: inv })
  if (aFeel !== bFeel) {
    if (aFeel === 'urban') items.push({ label: 'More urban or Center City feel', winner: a })
    else if (bFeel === 'urban') items.push({ label: 'More urban or Center City feel', winner: b })
    if (aFeel === 'walkable_town') items.push({ label: 'More walkable town-center feel', winner: a })
    else if (bFeel === 'walkable_town') items.push({ label: 'More walkable town-center feel', winner: b })
    if (aFeel === 'suburban') items.push({ label: 'More suburban or residential feel', winner: a })
    else if (bFeel === 'suburban') items.push({ label: 'More suburban or residential feel', winner: b })
  }
  if (!items.length) items.push({ label: 'Overall fit', neutral: 'Different strengths' })
  return items.slice(0, 6)
}

function CompareHeroCard({ area, theme, basePrefix }: { area: any; theme: any; basePrefix: string }) {
  const market = area.market_stats || {}
  const listings = area.inventory?.listings || []
  const heroPhoto = listings.find((listing: any) => listing?.photo)?.photo
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_60px_rgba(17,24,39,0.12)] ring-1 ring-black/[0.04]">
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: sizedBg(resolveMediaUrl(heroPhoto), 1920) }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="ohp-site-heading text-3xl font-black">{area.name}</p>
          {areaSubtitle(area) && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-white/75"><MapPin className="h-3.5 w-3.5" />{areaSubtitle(area)}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {areaSummary(area) && <p className="line-clamp-4 text-sm leading-relaxed text-gray-600">{areaSummary(area)}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <CompareMiniStat label="Homes for sale" value={String(area.inventory?.total || 0)} theme={theme} />
          <CompareMiniStat label="Median list price" value={market.median_price != null ? formatCompactPrice(market.median_price) : 'Not shown'} theme={theme} />
          <CompareMiniStat label={daysOnMarketStat(market)?.[0] || 'Median days on market'} value={daysOnMarketStat(market)?.[1] || 'Not shown'} theme={theme} />
          <CompareMiniStat label="School district" value={schoolDistrictNames(area)[0] || 'See schools below'} theme={theme} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`${basePrefix}/${area.slug}`} className="rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white" style={{ backgroundColor: theme.primary_color }}>
            View {area.name}
          </a>
          <a href={`${basePrefix}/${area.slug}#homes`} className="rounded-full border px-5 py-2.5 text-xs font-black uppercase tracking-wide" style={{ borderColor: 'rgba(var(--site-primary-rgb),0.25)', color: 'var(--site-heading)' }}>
            View Homes
          </a>
        </div>
        {listings.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {listings.map((item: any) => <ListingCard key={item.listing_key} item={item} theme={theme} basePrefix={basePrefix} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CompareMiniStat({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="ohp-site-heading text-xl font-black capitalize" style={{ color: 'var(--site-heading)' }}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

function CompareList({ title, icon: Icon, values, note, theme }: { title: string; icon: any; values: string[]; note?: string; theme: any }) {
  if (!values.length && !note) return null
  return (
    <div className="rounded-[1.25rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme.secondary_color}1a`, color: theme.secondary_color }}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{title}</h3>
      </div>
      {note && <p className="mt-3 text-sm leading-relaxed text-gray-500">{note}</p>}
      {values.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm font-semibold text-gray-700">
          {values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}
        </ul>
      )}
    </div>
  )
}

function CompareSection({ title, subtitle, left, right, children }: { title: string; subtitle: string; left: any; right: any; children: (area: any) => React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-400">{title}</p>
        <h2 className="ohp-site-heading mt-2 text-2xl font-black text-gray-900 sm:text-3xl">{subtitle}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-black text-gray-800">{left.name}</p>
          {children(left)}
        </div>
        <div>
          <p className="mb-3 text-sm font-black text-gray-800">{right.name}</p>
          {children(right)}
        </div>
      </div>
    </section>
  )
}

async function NeighborhoodComparePage({ siteId, theme, basePrefix, compareParams }: { siteId: string; theme: any; basePrefix: string; compareParams: NeighborhoodCompareParams }) {
  const areasParam = (compareParams.areas || '').trim()
  if (!areasParam) {
    const selectable = (await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS)) || []
    return (
      <main>
      {theme.template === 'default' ? (
        <ClassicPageHero eyebrow="Neighborhood compare" title="Choose two" accent="neighborhoods" subtitle="Pick any two of the neighborhoods this agent serves and see them side by side." align="center" />
      ) : (
        <>
        <div className="relative px-6 py-20 text-center" style={{ backgroundColor: theme.primary_color }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: theme.secondary_color }}>Neighborhood Compare</p>
          <h1 className="ohp-site-heading mx-auto mt-3 max-w-3xl text-4xl font-black text-white sm:text-6xl">Choose two neighborhoods</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/70">Compare only the neighborhoods this agent serves, using existing research and live OHP listing data.</p>
          <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        </div>
        </>
      )}
        <NeighborhoodCompareLauncher areas={selectable} basePrefix={basePrefix} theme={theme} initialFirstSlug={compareParams.first} />
      </main>
    )
  }

  const [compare, selectable] = await Promise.all([
    fetchFreshJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas/compare?${new URLSearchParams({ slugs: areasParam }).toString()}`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS),
  ])
  if (!compare?.areas || compare.areas.length !== 2) notFound()
  const [left, right] = compare.areas
  const differences = differenceLines(left, right)
  const bestFor = bestForItems(left, right)

  return (
    <main>
      {theme.template === 'default' ? (
        <ClassicPageHero
          eyebrow="Neighborhood compare"
          title={`${left.name} vs`}
          accent={right.name}
          subtitle="Homes for sale, prices, schools, the town centers and daily life - side by side, so you can see which one fits."
          photos={[left, right].flatMap((a: any) => (a.inventory?.listings || []).filter((l: any) => l?.photo).slice(0, 2).map((l: any) => resolveMediaUrl(l.photo) as string)).slice(0, 3)}
          breadcrumb={<><a href={`${basePrefix}/`} className="hover:underline">Home</a> / <a href={`${basePrefix}/neighborhoods`} className="hover:underline">Neighborhoods</a> / <span>Compare</span></>}
        />
      ) : (
        <>
      {/* Two towns, two halves: a real home from each behind its name, a gold "vs" seal on the seam. */}
      <div className="relative overflow-hidden px-6 pb-20 pt-32 text-white" style={{ backgroundColor: theme.primary_color }}>
        <div className="absolute inset-0 grid grid-cols-2">
          {[left, right].map((a: any) => {
            const ph = (a.inventory?.listings || []).find((l: any) => l?.photo)?.photo
            return ph ? <SitePhoto key={a.slug} src={resolveMediaUrl(ph)} widths={IMG.card} className="ohp-hero-pan h-full w-full opacity-60 object-cover" /> : <div key={a.slug} />
          })}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/40" />
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: `linear-gradient(180deg, transparent, ${theme.secondary_color}, transparent)` }} />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>Neighborhood compare</span>
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
          </div>
          <h1 className={`ohp-site-heading mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-4xl font-black leading-tight sm:text-7xl ${fontClass(theme.heading_font, 'font-serif')}`}>
            <span>{left.name}</span>
            <span className="grid h-14 w-14 place-items-center rounded-full text-lg font-black shadow-[0_0_40px_rgba(0,0,0,.5)] sm:h-16 sm:w-16" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>vs</span>
            <span>{right.name}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">Homes for sale, prices, schools, the town centers and daily life - side by side, so you can see which one fits.</p>
          <a href={`${basePrefix}/neighborhoods`} className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10">
            <ArrowRight className="h-3.5 w-3.5 rotate-180" /> All neighborhoods
          </a>
        </div>
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </div>
        </>
      )}

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-2">
        <CompareHeroCard area={left} theme={theme} basePrefix={basePrefix} />
        <CompareHeroCard area={right} theme={theme} basePrefix={basePrefix} />
      </section>

      <NeighborhoodCompareLauncher
        areas={selectable || []}
        basePrefix={basePrefix}
        theme={theme}
        initialFirstSlug={left.slug}
        initialSecondSlug={right.slug}
      />

      <section className="px-6 py-12" style={{ backgroundColor: `${theme.primary_color}08` }}>
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: theme.secondary_color }}>What Feels Different?</p>
            {differences.length > 0 ? (
              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-gray-600">
                {differences.map((line, index) => <li key={index} className="rounded-2xl bg-gray-50 p-4">{line}</li>)}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">The stored research does not show a clear, defensible difference yet. Review the side-by-side facts below.</p>
            )}
          </div>
          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: theme.secondary_color }}>Best For</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {bestFor.map((item, index) => (
                <span key={index} className="rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-gray-600">
                  {item.label}: <span style={{ color: 'var(--site-heading)' }}>{item.winner?.name || item.neutral}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CompareSection title="Housing & Market" subtitle="Current housing activity" left={left} right={right}>
        {area => (
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareMiniStat label="Homes for sale" value={String(area.inventory?.total || 0)} theme={theme} />
            <CompareMiniStat label="Median list price" value={area.market_stats?.median_price != null ? `$${area.market_stats.median_price.toLocaleString()}` : 'Not shown'} theme={theme} />
            <CompareMiniStat label={daysOnMarketStat(area.market_stats)?.[0] || 'Median days on market'} value={daysOnMarketStat(area.market_stats)?.[1] || 'Not shown'} theme={theme} />
            <CompareMiniStat label="Avg $ / sqft" value={area.market_stats?.avg_price_per_sqft != null ? `$${area.market_stats.avg_price_per_sqft.toLocaleString()}` : 'Not shown'} theme={theme} />
            <div className="sm:col-span-2">
              <CompareList title="Market context" icon={TrendingUp} values={(area.facts?.market_context?.stats || []).slice(0, 4).map((s: any) => `${s.label}: ${s.value}`)} note={compareCategoryNote(area, 'market_context')} theme={theme} />
            </div>
          </div>
        )}
      </CompareSection>

      <CompareSection title="Schools" subtitle="Districts and school options" left={left} right={right}>
        {area => (
          <div className="grid gap-4">
            <CompareList title="Public-school districts" icon={GraduationCap} values={schoolDistrictNames(area)} note={(area.facts?.public_schools || {}).boundary_caveat} theme={theme} />
            <CompareList title="Notable public schools" icon={School} values={publicSchoolNames(area)} theme={theme} />
            <CompareList title="Private schools" icon={GraduationCap} values={compareCategoryNames(area, 'private_schools', 6)} note={compareCategoryNote(area, 'private_schools')} theme={theme} />
            <p className="rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">School assignment can depend on exact property address and can change. Verify current attendance zones with the district before making a decision based on schools alone.</p>
          </div>
        )}
      </CompareSection>

      <CompareSection title="Lifestyle" subtitle="Daily-life places and local character" left={left} right={right}>
        {area => (
          <div className="grid gap-4">
            <CompareList title="Restaurants" icon={Utensils} values={compareCategoryNames(area, 'restaurants')} note={compareCategoryNote(area, 'restaurants')} theme={theme} />
            <CompareList title="Shopping" icon={ShoppingBag} values={compareCategoryNames(area, 'shopping')} note={compareCategoryNote(area, 'shopping')} theme={theme} />
            <CompareList title="Grocery" icon={ShoppingBasket} values={compareCategoryNames(area, 'grocery')} note={compareCategoryNote(area, 'grocery')} theme={theme} />
            <CompareList title="Parks & recreation" icon={Trees} values={compareCategoryNames(area, 'parks')} note={compareCategoryNote(area, 'parks')} theme={theme} />
            <CompareList title="Downtown and centers" icon={Building2} values={compareCategoryNames(area, 'downtown_centers')} note={compareCategoryNote(area, 'downtown_centers')} theme={theme} />
          </div>
        )}
      </CompareSection>

      <CompareSection title="Getting Around" subtitle="Transportation and commute context" left={left} right={right}>
        {area => <CompareList title="Transportation" icon={Train} values={compareCategoryNames(area, 'transportation', 7)} note={compareCategoryNote(area, 'transportation')} theme={theme} />}
      </CompareSection>

      <CompareSection title="Services & Convenience" subtitle="Everyday support nearby" left={left} right={right}>
        {area => (
          <div className="grid gap-4">
            <CompareList title="Medical" icon={HeartPulse} values={compareCategoryNames(area, 'medical')} note={compareCategoryNote(area, 'medical')} theme={theme} />
            <CompareList title="Everyday amenities" icon={Coffee} values={[...compareCategoryNames(area, 'grocery', 3), ...compareCategoryNames(area, 'shopping', 3)]} theme={theme} />
          </div>
        )}
      </CompareSection>

      <section className="mx-auto max-w-6xl px-6 pb-16 text-center">
        <a href={`${basePrefix}/contact`} className="ohp-gold-sheen inline-flex rounded-full px-8 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:-translate-y-0.5" style={{ backgroundColor: theme.primary_color }}>
          Talk Through These Neighborhoods
        </a>
      </section>
    </main>
  )
}

async function CommunityPage({ siteId, slug, theme, basePrefix, homesParams }: { siteId: string; slug: string; theme: any; basePrefix: string; homesParams: CommunityHomesParams }) {
  const area = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas/${encodeURIComponent(slug)}`, TOWN_TAGS)
  if (!area) notFound()

  const { listingsQs } = townHomesQuery(homesParams)
  const [listingsRes, profile, areaList] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas/${encodeURIComponent(slug)}/listings?${listingsQs.toString()}`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`, TOWN_TAGS),
  ])
  // The page itself is components/website-public/town/TownPage (shared with the admin's town preview).
  return <TownPageView area={area} listingsRes={listingsRes} profile={profile} areaList={areaList} siteId={siteId} slug={slug} theme={theme} basePrefix={basePrefix} homesParams={homesParams} />
}

// Page names other real estate websites use (IDX vendors, WordPress themes, Squarespace...) -> the
// page here that does the same job. Checked only after the agent's own pages, Agent Hub links and
// built-in sections, so it never shadows anything real. Anything else gets the site's own friendly
// "page not found" (not-found.tsx), which Google drops from its results.
const LEGACY_PAGE_PATHS: Array<[RegExp, string]> = [
  [/^(about[-_]?(me|us)?|bio|meet[-_].*|our[-_]?(team|agents?|story)|team|agents?|who[-_]we[-_]are)$/, '/about'],
  [/^(contact[-_]?(me|us)?|get[-_]in[-_]touch|reach[-_]out|connect)$/, '/contact'],
  [/^(listings?|my[-_]listings|featured([-_](listings|properties|homes))?|exclusive[-_]listings|current[-_]listings|our[-_]listings|properties[-_]for[-_]sale)$/, '/properties'],
  [/^(home[-_]?search|search[-_](homes|properties|listings|mls)|property[-_]search|idx|mls([-_]search)?|find[-_]a[-_]home|homes[-_]for[-_]sale|for[-_]sale|buy|buyers?|buying)$/, '/search'],
  [/^(blogs|news|articles|posts|insights|market[-_](updates?|reports?))$/, '/blog'],
  [/^(sold|sold[-_](listings|homes|properties)|past[-_](sales|transactions)|recent[-_]sales|closed)$/, '/sales'],
  [/^(home[-_]?(value|valuation|worth|evaluation)([-_].*)?|whats?[-_]my[-_]home[-_]worth|sell|sellers?|selling|cma)$/, '/home-value'],
  [/^(areas?|communities|community|neighbou?rhoods?[-_].*|towns)$/, '/neighborhoods'],
  [/^(testimonials?[-_].*|client[-_]reviews|reviews[-_].*)$/, '/testimonials'],
  [/^(index\.(html?|php)|home|wp-.*|.*\.(php|aspx?|html?))$/, '/'],
]

// An address from the site that used to live on the agent's own domain -> the page here the old-links
// scan matched it to (backend services/website/old_links_service; the agent can change or turn one off
// on the Domain tab). One cached call per address; null when it isn't one of the old site's pages.
async function oldLinkTarget(siteId: string, path: string[]): Promise<string | null> {
  const joined = '/' + path.map(seg => { try { return decodeURIComponent(seg) } catch { return seg } }).join('/')
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/sites/${siteId}/redirects?path=${encodeURIComponent(joined)}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    // a path on this site only - never '//other-host'
    return typeof data?.target === 'string' && /^\/(?!\/)/.test(data.target) ? data.target : null
  } catch {
    return null
  }
}

function legacyPagePath(path: string[]): string | null {
  const first = (path[0] || '').toLowerCase()
  for (const [re, to] of LEGACY_PAGE_PATHS) if (re.test(first)) return to
  return null
}

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ host: string; path?: string[] }>
  searchParams: Promise<SearchFilterParams>
}) {
  const { host: rawHost, path } = await params
  const host = decodeURIComponent(rawHost)
  const resolved = await resolveSite(host, joinPath(path))
  if (!resolved) {
    const propertySite = await resolvePropertySite(host, joinPath(path))
    if (propertySite) {
      const publicUrl = `https://${propertySite.canonical_hostname || host}`
      // <slug>.openhousepal.com/fact-sheet - the listing's one-page fact sheet, opened in its own tab.
      if (path?.[0] === 'fact-sheet' && !path[1]) return <SpotlightFactSheet data={propertySite} publicUrl={publicUrl} />
      if (propertySite.template_id === 'editorial_estate') {
        return <EditorialEstateTemplate data={propertySite} publicUrl={publicUrl} />
      }
      return <CinematicLuxuryTemplate data={propertySite} publicUrl={publicUrl} />
    }
    notFound()
  }

  // e.g. the non-primary half of an apex/www pair - preserve the request path across the
  // redirect (permanentRedirect issues a 308, treated the same as a 301 for SEO purposes,
  // and is the App Router's supported way to do a permanent redirect).
  if (resolved.redirect_to) {
    const suffix = path && path.length ? `/${path.join('/')}` : ''
    permanentRedirect(`https://${resolved.redirect_to}${suffix}`)
  }

  const snapshot = resolved.published_snapshot
  let theme = { ...DEFAULT_SITE_THEME, ...(snapshot?.theme || {}) }
  const pages = snapshot?.pages || []
  const homePage = pages.find(p => p.is_home) || pages[0]
  const siteName = homePage?.title || resolved.subdomain_slug
  const basePrefix = await getBasePrefix(host)
  // Local preview only (the /ohp-site-render/... test URL, never a real domain): try a look or
  // mode without publishing - ?ohp_template=default|luxe&ohp_mode=light|dark.
  if (basePrefix.startsWith('/ohp-site-render/')) {
    const previewParams = (await searchParams) as unknown as Record<string, string | undefined>
    if (previewParams.ohp_template === 'default' || previewParams.ohp_template === 'luxe') theme.template = previewParams.ohp_template
    if (previewParams.ohp_mode === 'light' || previewParams.ohp_mode === 'dark') theme.mode = previewParams.ohp_mode
    if (previewParams.ohp_metal === 'gold' || previewParams.ohp_metal === 'silver' || previewParams.ohp_metal === 'bronze') theme.luxe_metal = previewParams.ohp_metal
    if (previewParams.ohp_accent && /^[0-9a-f]{6}$/i.test(previewParams.ohp_accent)) theme.secondary_color = `#${previewParams.ohp_accent}`
  }
  // Luxe's accent snapped to its metal, Classic's never a metal (lib/siteTheme).
  theme = normalizeSiteTheme(theme)

  if (path?.[0] === 'communities') {
    const legacyParams = await searchParams
    const redirectedPath = ['neighborhoods', ...path.slice(1)].join('/')
    const qs = queryString(legacyParams)
    permanentRedirect(`${basePrefix}/${redirectedPath}${qs ? `?${qs}` : ''}`)
  }

  // Reserved sections powered directly by OHP Blogs/Properties, not the page-builder block
  // system - checked before the generic page lookup so an agent can never shadow them by
  // naming a custom page "blog" or "properties".
  let content
  // The header is only transparent-over-dark while the page it's sitting on actually opens with
  // a dark hero (see HeroBlock) - true for every reserved index route that now opens with its own
  // cinematic dark hero (Properties, Blog, Communities, a single-segment Community page), and for
  // page-builder pages whose first block really is a visible hero. False for detail pages (no
  // hero) and Search (light filter-bar top, not a dark hero), where white nav text would be
  // invisible over a plain cream background.
  let hasDarkHero = false
  let exactExternalResource = false
  let hideFooter = false
  // The page already closes with its own contact section - skip the footer's closing band.
  let pageHasContactCta = false
  let showShowcaseCreatorCta = false
  let showcaseCreatorListings: any[] = []
  let oldLinkTo: string | null = null
  const currentSearchParams = await searchParams
  const wantsSiteChrome = currentSearchParams.site_chrome === '1'
  // Classic opens every page on a light banner (ClassicPageHero / the split home hero), so its
  // header is always the solid one - only Luxe sits transparent over a dark photo hero.
  const luxeLook = theme.template !== 'default'
  if (path?.[0] === 'blog') {
    if (path[1]) {
      content = <BlogDetail siteId={resolved.site_id} slug={path[1]} theme={theme} basePrefix={basePrefix} path={path} />
    } else {
      content = <BlogIndex siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} category={currentSearchParams.category} />
      hasDarkHero = true
    }
  } else if (path?.[0] === 'properties') {
    if (path[1]) {
      content = <PropertyDetail siteId={resolved.site_id} listingKey={path[1]} theme={theme} basePrefix={basePrefix} path={path} />
    } else {
      content = <PropertiesIndex siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} />
      hasDarkHero = true
    }
  } else if (path?.[0] === 'search') {
    content = path[1] === 'properties' && path[2]
      ? <SearchPropertyDetail siteId={resolved.site_id} listingKey={path[2]} theme={theme} basePrefix={`${basePrefix}/search`} />
      : <SearchResults siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} filters={currentSearchParams} />
  } else if (path?.[0] === 'neighborhoods') {
    if (path[1] === 'compare') {
      content = <NeighborhoodComparePage siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} compareParams={currentSearchParams} />
    } else {
      content = <CommunitiesIndex siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} />
    }
    hasDarkHero = true
  } else if (path?.[0] === 'contact' && !path[1]) {
    // The agent + every way to reach them, with their general form right on the page.
    const contactProfile = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`)
    content = contactProfile?.agent_hub_slug
      ? <ContactPageView profile={contactProfile} theme={theme} basePrefix={basePrefix} />
      : <ContactAliasPage siteId={resolved.site_id} basePrefix={basePrefix} />
    hasDarkHero = true
  } else if (path?.[0] === 'listings' && path[1] && (!path[2] || (path[2] === 'fact-sheet' && !path[3]))) {
    // A Listing Spotlight on the agent's own connected domain (<domain>/listings/<slug>) - the
    // link the app hands out once a custom domain is ACTIVE (see property_website_service.public_url).
    const propertySite = await resolvePropertySite(host, joinPath(path))
    if (!propertySite) {
      // not a Spotlight - maybe an old site's /listings/<home> (the old-links scan)
      const oldTo = await oldLinkTarget(resolved.site_id, path)
      if (oldTo) permanentRedirect(`${basePrefix}${oldTo}`)
      notFound()
    }
    const publicUrl = `https://${propertySite.canonical_hostname || host}`
    if (path[2] === 'fact-sheet') return <SpotlightFactSheet data={propertySite} publicUrl={publicUrl} />
    return propertySite.template_id === 'editorial_estate'
      ? <EditorialEstateTemplate data={propertySite} publicUrl={publicUrl} />
      : <CinematicLuxuryTemplate data={propertySite} publicUrl={publicUrl} />
  } else if (path?.[0] === 'forms' && path[1] && !path[2]) {
    content = <FormAliasPage siteId={resolved.site_id} formId={path[1]} basePrefix={basePrefix} forceLightMode={wantsSiteChrome} embeddedInSiteChrome={wantsSiteChrome} campaignToken={currentSearchParams.c ?? null} />
    exactExternalResource = !wantsSiteChrome
  } else if ((path?.[0] === 'my-showcase' || path?.[0] === 'create-showcase') && !path[1]) {
    // "{first}'s Showcase" (the glowing header tab) and every "Create my Showcase" button: their
    // Showcase if this browser knows it (the ohp_visitor cookie - lib/visitor), else the builder.
    content = <MyShowcaseRoute siteId={resolved.site_id} basePrefix={basePrefix} theme={theme} create={path[0] === 'create-showcase'} town={typeof (currentSearchParams as Record<string, unknown>).town === 'string' ? (currentSearchParams as Record<string, string>).town : null} />
    hideFooter = true
  } else if ((path?.[0] === 'showcase' || path?.[0] === 'showcases') && path[1] && !path[3]) {
    // /showcase/dana-k7q2 (or the old long token), optionally /732-buck-ln for one home in it.
    content = <ShowcaseAliasPage siteId={resolved.site_id} shareToken={path[1]} home={path[2]} basePrefix={basePrefix} accent={theme.secondary_color} />
    exactExternalResource = true
  } else if (path?.[0] === 'open-house' && path[1] && path.length <= 4) {
    content = <OpenHouseAliasPage rest={path.slice(1)} query={queryString(currentSearchParams)} basePrefix={basePrefix} />
    exactExternalResource = true
  } else if (path?.[0] === 'cma' && path[1] && !path[2]) {
    content = <CmaAliasPage siteId={resolved.site_id} shareSlug={path[1]} basePrefix={basePrefix} />
    exactExternalResource = true
  } else if ((path?.[0] === 'hub' || path?.[0] === 'agent-hub') && !path[1]) {
    content = <AboutPage siteId={resolved.site_id} basePrefix={basePrefix} host={host} framed query={queryString(currentSearchParams)} />
    hideFooter = true
  } else if (path?.[0] === 'about' && !path[1]) {
    content = <AboutPage siteId={resolved.site_id} basePrefix={basePrefix} host={host} framed />
    hideFooter = true
  } else if (path?.[0] === 'sales' && !path[1]) {
    // The Agent Hub's Sales page inside the site - a town page's "View all" (?town=&from=).
    content = <AboutPage siteId={resolved.site_id} basePrefix={basePrefix} host={host} framed query={queryString(currentSearchParams)} hubPage="sales" />
    hideFooter = true
  } else if (path?.[0] === 'home-value' && !path[1]) {
    // "What's my home worth?" landing page - for ads, mailers and the agent's email signature.
    const [hvProfile, hvAreas, hvReviews] = await Promise.all([
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`, TOWN_TAGS),
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
    ])
    content = <HomeValuePage theme={theme} basePrefix={basePrefix} profile={hvProfile} areas={hvAreas || []} reviews={hvReviews} />
    hasDarkHero = true
    pageHasContactCta = true
  } else if (path?.[0] === 'testimonials' && !path[1]) {
    // The Reviews page - only while the agent has "Show on my IDX website" on (Studio -> Reviews).
    // Same 30s cache as the menu link below, so the page and its link always agree.
    const [siteReviews, reviewsAgent] = await Promise.all([
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
    ])
    if (!siteReviews?.show) notFound()
    content = <ReviewsPage data={siteReviews} theme={theme} basePrefix={basePrefix} agent={reviewsAgent} />
    hasDarkHero = true
    pageHasContactCta = true  // it closes with its own "next success story" card
  } else {
    const page = findPage(resolved, path)
    if (page) {
      const isHomeOrSellerPage = Boolean(page.is_home || /sell|seller/i.test(`${page.slug} ${page.title}`))
      const pageShowcaseListings = showcaseCtaListingsForPage(page)
      const showcaseAgent = isHomeOrSellerPage ? await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`) : null
      const showcaseCta = isHomeOrSellerPage
        ? <ShowcaseCreatorCTA theme={theme} basePrefix={basePrefix} listings={pageShowcaseListings} agent={showcaseAgent} />
        : null
      content = <SitePageRenderer page={page} theme={theme} siteId={resolved.site_id} basePrefix={basePrefix} homeExperience={Boolean(page.is_home)} afterCommunitiesContent={showcaseCta} />
      hasDarkHero = page.blocks?.[0]?.type === 'hero' && !page.blocks[0]?.hidden
      pageHasContactCta = !page.is_home && (page.blocks || []).some((b: any) => b.type === 'contact_cta' && !b.hidden)
      showShowcaseCreatorCta = false
      showcaseCreatorListings = pageShowcaseListings
    } else if (path?.length && path.length <= 3 && path[0].toLowerCase() === (await resolveAgentHubSlug(resolved.site_id))?.toLowerCase()) {
      content = <HubAliasPage rest={path} query={queryString(currentSearchParams)} basePrefix={basePrefix} />
      exactExternalResource = true
    } else if (path?.length === 1 && ['sales', 'reviews', 'review'].includes(path[0].toLowerCase()) && await resolveAgentHubSlug(resolved.site_id)) {
      // The short own-domain addresses the app hands out (site_service.OwnerLinks): /sales and
      // /reviews open the Agent Hub's Sales page and review form - unless the agent made a page
      // with that name, which findPage above already served.
      const hubSlug = (await resolveAgentHubSlug(resolved.site_id)) as string
      content = <HubAliasPage rest={[hubSlug, path[0].toLowerCase() === 'sales' ? 'sales' : 'review']} query={queryString(currentSearchParams)} basePrefix={basePrefix} />
      exactExternalResource = true
    } else if (path?.length && (oldLinkTo = await oldLinkTarget(resolved.site_id, path))) {
      // A page of the site that used to live on this domain, found by the old-links scan (Internet
      // Archive) and matched to its page here - more exact than the generic names below.
      permanentRedirect(`${basePrefix}${oldLinkTo}`)
    } else if (path?.length && legacyPagePath(path)) {
      // An address from the site that used to live on this domain (Google still lists it) -
      // sent to the same kind of page here instead of "page not found" (user, 10/20).
      permanentRedirect(`${basePrefix}${legacyPagePath(path)}`)
    } else if (path?.length === 1) {
      // No page-builder page matched a single-segment path - try the shared Area system before
      // giving up, since community pages (/villanova-pa) aren't page-builder pages (see
      // CommunityPage above). CommunityPage itself calls notFound() if the slug isn't real.
      content = <CommunityPage siteId={resolved.site_id} slug={path[0]} theme={theme} basePrefix={basePrefix} homesParams={currentSearchParams} />
      hasDarkHero = true
      pageHasContactCta = true  // a town page closes with its own "Thinking about <town>?" band
    } else {
      notFound()
    }
  }

  if (exactExternalResource) {
    return content
  }

  const [footerAreas, footerProfile, footerReviews] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`, TOWN_TAGS),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
  ])
  const hasReviews = Boolean(footerReviews?.show)
  const hasSoldPage = pages.some(p => p.slug === 'sold')
  const pageLd = path?.length && snapshot?.seo?.allow_indexing !== false
    ? await pageStructuredData(resolved, host, path, footerProfile, footerAreas || [], footerReviews, footerProfile?.name || siteName)
    : []

  return (
    <SiteShell theme={theme} siteKey={resolved.subdomain_slug} agentName={footerProfile?.name || siteName} brandLogo={footerProfile?.brand_logo_url}>
      {!path?.length && <JsonLd data={siteJsonLd(resolved, host, footerProfile)} />}
      {pageLd.map((d, i) => <JsonLd key={i} data={d} />)}
      <SiteHeader theme={theme} pages={pages} siteName={siteName} basePrefix={basePrefix} hasCommunities={(footerAreas || []).length > 0} agentProfile={footerProfile || undefined} hasDarkHero={hasDarkHero && luxeLook} siteKey={resolved.subdomain_slug} hasReviews={hasReviews} />
      {/* The header is `fixed` (see SiteChrome) so it can float transparently over the hero
          photo at the very top of the page - that means it's out of document flow on EVERY
          page, not just hero ones, so any page without a hero needs this top padding or its
          content renders hidden underneath the header instead of below it. */}
      <div className={hasDarkHero && luxeLook ? '' : 'pt-20'}>
        {content}
        {showShowcaseCreatorCta && <ShowcaseCreatorCTA theme={theme} basePrefix={basePrefix} listings={showcaseCreatorListings} agent={footerProfile} />}
      </div>
      {!hideFooter && <SiteFooter theme={theme} siteName={footerProfile?.name || siteName} areas={footerAreas || []} hasSoldPage={hasSoldPage} hasReviews={hasReviews} profile={footerProfile || undefined} signatureSlug={footerProfile?.signature_hub_slug} basePrefix={basePrefix} showCta={!pageHasContactCta && path?.[0] !== 'contact' && path?.[0] !== 'search' && !(path?.[0] === 'blog' && path[1])} idxNotice />}
      {/* Every data-ohp-form button on the page opens the agent's form in a window. */}
      <SiteFormLauncher forms={footerProfile?.forms || []} hubSlug={footerProfile?.agent_hub_slug} siteId={resolved.site_id} />
      {/* Google One Tap - only shows on the agent's *.openhousepal.com address (IdxOneTap). */}
      <IdxOneTap siteId={resolved.site_id} listingKey={path?.[0] === 'properties' && path[1] && !path[2] ? path[1] : null} />
      <SiteNavProgress />
    </SiteShell>
  )
}
