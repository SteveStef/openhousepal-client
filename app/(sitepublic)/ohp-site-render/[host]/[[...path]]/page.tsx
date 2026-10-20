import { Metadata } from 'next'
import {
  OpenHouseFrame, TownSectionNav, TownLiving, TownInsights, TownCommute, TownMap, TownWalk, PropertyGallery, FeaturedPageClient, PropertyMapSearch, PropertyLocationMap, ExploreNearby, NeighborhoodCompareLauncher, WebsitePublicFormPage, ContactPageView, NeighborhoodsExplorer, MediaHub, SiteBlogArticle, IdxPropertyPage, MyShowcase, ShowcaseBuilder, CinematicLuxuryTemplate, EditorialEstateTemplate,
} from '@/components/website-public/LazySiteParts'
import { cookies, headers } from 'next/headers'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import {
  AlertTriangle, ArrowRight, Bath, BedDouble, Building2, Calendar, Coffee, DollarSign,
  ExternalLink, GraduationCap, Heart, HeartPulse, Home, LandPlot, MapPin, Ruler,
  School, ShoppingBag, ShoppingBasket, Sparkles, Train, Trees, TrendingUp, Users, Utensils,
  Bell, ChevronDown, MessageCircle, Plus,
} from 'lucide-react'
import { buildTownFaq, firstSentences } from '@/components/website-public/townGuide'
import { autoListingMeta, autoPostMeta, autoSectionMeta, autoTownMeta, seoClip, withSiteName, type SeoCtx } from '@/lib/siteSeoAuto'
import SitePageRenderer from '@/components/website-public/SitePageRenderer'
import SiteShell from '@/components/website-public/SiteShell'
import SpotlightChip from '@/components/website-public/SpotlightChip'
import MarketTrendsSection from '@/components/website-public/MarketTrendsSection'
import { SiteHeader, SiteFooter } from '@/components/website-public/SiteChrome'
import CinematicHeroBackground from '@/components/website-public/CinematicHeroBackground'
import ClassicPageHero from '@/components/website-public/ClassicPageHero'
import { formatStatus, statusBadgeColor, formatCompactPrice } from '@/components/website-public/listingFormat'
import ShowcaseCreatorCTA from '@/components/website-public/ShowcaseCreatorCTA'
import ReviewsPage from '@/components/website-public/ReviewsPage'
import HomeValuePage from '@/components/website-public/HomeValuePage'
import HomeCard from '@/components/website-public/HomeCard'
import SiteFormLauncher from '@/components/website-public/SiteFormLauncher'
import SiteNavProgress from '@/components/website-public/SiteNavProgress'
import { normalizeSiteTheme } from '@/lib/siteTheme'
import { cardVersion, siteLookParam } from '@/lib/og/shared'
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
  if (!resolved || spotlightOnCustomDomain) {
    const propertySite = await resolvePropertySite(host, joinPath(path))
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
          ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c2', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
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
        ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c2', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
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
        ogImage: hubSlug && form?.slug ? ogCard('form', { agent: hubSlug, form: form.slug, v: cardVersion('c2', form.headline, form.title, form.subtitle, form.darkMode, JSON.stringify((form as any).look || null)) }) : undefined,
      },
    )
  }
  if (path?.[0] === 'open-house' && path[1]) {
    // A guest's own Guest Pass is personal - never indexed.
    if (path[2] === 'pass') return { title: 'Your Guest Pass', robots: { index: false, follow: false } }
    return publicAliasMetadata('Open house sign-in', `https://${OHP_BASE_DOMAIN}/open-house/${encodeURIComponent(path[1])}`)
  }
  if (path?.[0] === 'showcase' || path?.[0] === 'showcases') {
    return publicAliasMetadata(
      'A personal home showcase',
      path[1] ? `https://${OHP_BASE_DOMAIN}/showcase/${encodeURIComponent(path[1])}` : undefined,
      // in the site's own colour, like the Showcase itself on this domain
      { ogImage: path[1] ? ogCard('showcase', { token: path[1], accent: normalizeSiteTheme({ ...DEFAULT_SITE_THEME, ...(resolved.published_snapshot?.theme || {}) }).secondary_color?.replace('#', ''), v: 'c2' }) : undefined },
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
    const area = await fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas/${encodeURIComponent(path[0])}`)
    if (area) {
      const [profile, areaList] = await Promise.all([
        fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
        fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
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
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
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
  const icon = seo.favicon_url || snapshot.theme?.logo_url || null
  const segs = path || []
  const key = segs.length === 0 ? 'home' : segs.length === 1 ? (segs[0] === 'communities' ? 'neighborhoods' : segs[0]) : null
  const isPageSlug = key && key !== 'home' && pages.some((p: any) => p.slug === key)
  const custom = key && key !== 'home' ? seo.pages?.[key] : null
  const baseTitle = typeof meta.title === 'string' ? meta.title : undefined
  let title = meta.title
  let description = meta.description
  // Automatic title + description (lib/siteSeoAuto - the same text the editor's Google tab previews).
  const auto = key && (SEO_SECTION_KEYS.has(key) || !isPageSlug) ? autoSectionMeta(key, ctx) : null
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
    ...(icon ? { icons: { icon: [{ url: icon }], apple: [{ url: icon }] } } : {}),
    ...(seo.allow_indexing === false ? { robots: { index: false, follow: false } } : {}),
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

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) return null
  return res.json()
}

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

async function BlogDetail({ siteId, slug, theme, basePrefix }: { siteId: string; slug: string; theme: any; basePrefix: string }) {
  const [post, media] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/blog/${encodeURIComponent(slug)}`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/blog?limit=48`),
  ])
  if (!post) notFound()
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
  const areas = (await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`)) || []
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

async function PropertyDetail({ siteId, listingKey, theme, basePrefix }: { siteId: string; listingKey: string; theme: any; basePrefix: string }) {
  const p = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/properties/${encodeURIComponent(listingKey)}`)
  if (!p) notFound()
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
  const [areasRaw, agentProfile, hubSlug] = await Promise.all([
    siteId ? fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`) : Promise.resolve(null),
    siteId ? fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`) : Promise.resolve(null),
    siteId ? resolveAgentHubSlug(siteId) : Promise.resolve(null),
  ])
  const areas: any[] = areasRaw || []
  const matchedArea = p.city ? areas.find((a: any) => a.name?.toLowerCase() === String(p.city).toLowerCase()) : null
  // The agent's "Schedule a Showing" form opens in a window with this address filled in.
  const forms: any[] = hubSlug ? (await fetchJson(`${INTERNAL_API_URL}/agent-hub/forms/public/${encodeURIComponent(hubSlug)}`)) || [] : []
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
        showing={hubSlug && showingForm ? { path: `/${hubSlug}/${showingForm.slug}` } : null}
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
async function AboutPage({ siteId, basePrefix, host, framed = false }: { siteId: string; basePrefix: string; host: string; framed?: boolean }) {
  const slug = await resolveAgentHubSlug(siteId)
  if (!slug) notFound()
  // Where the framed hub sends a visitor "home" (form submitted, Back with no history). Absolute on
  // the agent's own address: the hub runs on openhousepal.com, where a bare "/" would land on
  // OpenHousePal's own homepage instead of this site's.
  const idxReturn = encodeURIComponent(basePrefix ? `${basePrefix}/` : `https://${host}/`)
  const src = basePrefix.startsWith('/ohp-site-render/')
    ? `/${encodeURIComponent(slug)}?idx_light=1&idx_return=${idxReturn}`
    : `https://${OHP_BASE_DOMAIN}/${encodeURIComponent(slug)}?idx_light=1&idx_return=${idxReturn}`
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
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#f7f5f1]">
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

async function MyShowcaseRoute({ siteId, basePrefix, theme, create }: { siteId: string; basePrefix: string; theme: SiteTheme; create: boolean }) {
  const visitor = await siteVisitorCookie()
  const [summary, areas, profile] = await Promise.all([
    visitor?.showcase ? fetchFreshJson(`${INTERNAL_API_URL}/public/sites/${siteId}/my-showcase/${encodeURIComponent(visitor.showcase)}`) : Promise.resolve(null),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`),
  ])
  const accent = theme.secondary_color || '#C9A24D'
  const agent = { name: profile?.name || null, photo_url: profile?.photo_url || null }
  const areaList = ((areas || []) as any[]).map(a => ({ name: a.name, state: a.state, slug: a.slug, photo: a.photo || null }))
  if (summary?.code && !create) {
    return <MyShowcase summary={summary} siteId={siteId} basePrefix={basePrefix} accent={accent} agent={agent} areas={areaList} headingClass="ohp-site-heading" />
  }
  return <ShowcaseBuilder siteId={siteId} basePrefix={basePrefix} accent={accent} agent={agent} areas={areaList} existingCode={summary?.code || null} serverVisitor={visitor} headingClass="ohp-site-heading" />
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

// Legacy raw-Places/NCES keys - still shown for an area that hasn't been re-researched under the
// AI pipeline yet (see CURATED_CATEGORY_META below for the categories that replace these once a
// MarketArea has real `research_version`/curated data - see area_research_service.py).
const FACT_SECTION_LABELS: Record<string, string> = {
  schools: 'Schools',
  parks: 'Parks',
  transportation: 'Transportation',
  downtown_areas: 'Downtown & Nearby Centers',
  amenities: 'Shops & Restaurants',
}

const SOURCE_LABELS: Record<string, string> = {
  google_places: 'Google Places',
  nces: 'U.S. Dept. of Education (NCES)',
  census_acs5: 'U.S. Census Bureau',
  ohp_local: 'OpenHousePal listing data',
  ai_research: 'AI-researched, web-sourced',
}

function FactSource({ source }: { source?: string }) {
  if (!source) return null
  return <span className="ml-1.5 text-[10px] font-semibold normal-case tracking-normal text-gray-400">via {SOURCE_LABELS[source] || source}</span>
}

// The AI-curated categories (see area_research_service.py RESEARCH_CATEGORIES) - each stored as
// { entities: [{name, relationship, city, distance_miles, source_url, source_type, confidence,
// description}], notes?, _meta }. Deliberately excludes public_schools (its own dedicated,
// richer section below - "highest level of care" per the enrichment plan) and market_context
// (its own section, clearly separated from live MLS stats).
const CURATED_CATEGORY_META: Record<string, { label: string; icon: any }> = {
  private_schools: { label: 'Private Schools', icon: School },
  grocery: { label: 'Grocery', icon: ShoppingBasket },
  parks: { label: 'Parks & Recreation', icon: Trees },
  restaurants: { label: 'Restaurants', icon: Utensils },
  shopping: { label: 'Shopping', icon: ShoppingBag },
  downtown_centers: { label: 'Downtown & Town Centers', icon: Building2 },
  medical: { label: 'Medical & Hospitals', icon: HeartPulse },
  transportation: { label: 'Transportation', icon: Train },
}

function categoryEntities(data: any): CuratedEntity[] {
  return Array.isArray(data?.entities) ? data.entities : []
}

function categoryHasContent(facts: Record<string, any>, categoryKey: string) {
  return categoryEntities(facts[categoryKey]).length > 0
}

function entityMeta(e: CuratedEntity) {
  return [
    e.category,
    e.city,
    typeof e.distance_miles === 'number' ? `${e.distance_miles.toFixed(e.distance_miles < 1 ? 1 : 0)} mi` : null,
  ].filter(Boolean).join(' · ')
}

interface CuratedEntity {
  name: string
  category?: string
  relationship?: string
  city?: string
  distance_miles?: number
  source_url?: string
  source_type?: string
  description?: string
  confidence?: number
}

const FACT_SECTION_ICONS: Record<string, any> = {
  schools: GraduationCap,
  parks: Trees,
  transportation: Train,
  downtown_areas: Building2,
  amenities: Coffee,
  demographics: Users,
}

function FactCard({ label, source, icon: Icon, theme, children }: { label: string; source?: string; icon?: any; theme: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme.secondary_color}1a`, color: theme.secondary_color }}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
          {label}<FactSource source={source} />
        </h3>
      </div>
      <div className="mt-3 text-sm text-gray-600">{children}</div>
    </div>
  )
}

// The core reusable property card - used for community inventory, agent sales/similar homes,
// and anywhere else a real MLS-backed listing needs a consistent, premium presentation.
// `dateLabel` (open houses) renders a date/time pill instead of a status badge; when neither a
// listing_key nor a usable id exists, the card renders as a plain non-clickable div rather than
// ever generating a dead /properties/{undefined} link.
function ListingCard({ item, theme, basePrefix, showStatus = true, dateLabel }: { item: any; theme: any; basePrefix: string; showStatus?: boolean; dateLabel?: string | null }) {
  const key = item.listing_key
  const badge = statusBadgeColor(item.status)
  const statLine = [
    item.bedrooms != null ? `${item.bedrooms} bd` : null,
    item.bathrooms != null ? `${item.bathrooms} ba` : null,
    item.living_area != null ? `${item.living_area.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' · ')

  const inner = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <SitePhoto src={item.photo} widths={IMG.card} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-110 object-cover" />
        {dateLabel ? (
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            {dateLabel}
          </span>
        ) : (
          showStatus && item.status && (
            <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: badge.bg, color: badge.fg }}>
              {formatStatus(item.status)}
            </span>
          )
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
        {item.price != null && (
          <span className={`absolute bottom-3 left-4 text-2xl font-black text-white drop-shadow ohp-site-heading ${fontClass(theme.heading_font, 'font-serif')}`}>
            ${item.price.toLocaleString()}
          </span>
        )}
        {item.spotlight_url ? (
          <SpotlightChip url={item.spotlight_url} className="absolute right-3 top-3" />
        ) : key && (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-400 opacity-0 shadow-sm transition group-hover:opacity-100">
            <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="truncate text-sm font-bold text-gray-700">
          {item.address}
          {item.city && <span className="font-medium" style={{ color: 'var(--site-muted)' }}>, {[item.city, item.state].filter(Boolean).join(', ')}</span>}
        </p>
        {statLine && <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-500"><span className="h-1 w-1 rounded-full" style={{ backgroundColor: theme.secondary_color }} />{statLine}</p>}
        {item.list_office_name && <p className="mt-2 truncate text-[10px] font-medium" style={{ color: 'var(--site-muted)' }}>Courtesy of {item.list_office_name}</p>}
      </div>
    </>
  )

  const className = "ohp-card group overflow-hidden rounded-[26px] bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgba(17,24,39,0.35)] hover:ring-[var(--site-gold)]/50"
  if (!key) return <div className={className}>{inner}</div>
  return <a href={`${basePrefix}/properties/${encodeURIComponent(key)}`} className={className}>{inner}</a>
}

interface CommunityHomesParams {
  homes?: string
  sort?: string
  min_price?: string
  max_price?: string
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
          <CompareMiniStat label="Days on market" value={market.median_dom != null ? String(market.median_dom) : 'Not shown'} theme={theme} />
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
    const selectable = (await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`)) || []
    return (
      <main>
      {theme.template === 'default' ? (
        <ClassicPageHero eyebrow="Neighborhood compare" title="Choose two" accent="neighborhoods." subtitle="Pick any two of the neighborhoods this agent serves and see them side by side." align="center" />
      ) : (
        <>
        <div className="relative px-6 py-20 text-center" style={{ backgroundColor: theme.primary_color }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: theme.secondary_color }}>Neighborhood Compare</p>
          <h1 className="ohp-site-heading mx-auto mt-3 max-w-3xl text-4xl font-black text-white sm:text-6xl">Choose two neighborhoods.</h1>
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
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`),
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
            <CompareMiniStat label="Median DOM" value={area.market_stats?.median_dom != null ? String(area.market_stats.median_dom) : 'Not shown'} theme={theme} />
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

// ---- Town (neighborhood) page pieces. Everything is themed through the site's CSS vars, so the
// same page reads right in Classic and Luxe, light and dark.

const TOWN_CARD_STYLE = { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }

function TownSection({ id, alt = false, children }: { id: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 px-5 py-14 sm:px-6 sm:py-20" style={alt ? { backgroundColor: 'var(--site-bg-alt)' } : undefined}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

function TownHeading({ eyebrow, title, sub, luxe, right }: { eyebrow: string; title: string; sub?: React.ReactNode; luxe: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent-text)' }}>
          {luxe && <span className="h-px w-7" style={{ backgroundColor: 'var(--site-accent)' }} />}{eyebrow}
        </p>
        <h2 className={`ohp-site-heading mt-2 text-[1.75rem] font-black leading-[1.1] sm:text-[2.4rem] ${luxe ? 'tracking-tight' : 'tracking-[-0.02em]'}`} style={{ color: 'var(--site-heading)' }}>{title}</h2>
        {sub && <p className="mt-2.5 text-sm leading-relaxed sm:text-[15px]" style={{ color: 'var(--site-muted)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function TownSubheading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-black sm:text-xl" style={{ color: 'var(--site-heading)' }}>
      {children}
      {count != null && <span className="rounded-full px-2 py-0.5 text-[11px] font-black" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}>{count}</span>}
    </h3>
  )
}

/** "See all" folds - plain <details>, so long lists stay out of the way and need no JavaScript. */
function TownMore({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/more mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black transition hover:-translate-y-0.5 [&::-webkit-details-marker]:hidden"
        style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
        <span className="group-open/more:hidden">{label}</span><span className="hidden group-open/more:inline">Show less</span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open/more:rotate-180" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

function TownPlaceRow({ e }: { e: CuratedEntity }) {
  const meta = entityMeta(e)
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      {e.source_url
        ? <a href={e.source_url} target="_blank" rel="noreferrer" className="text-[15px] font-bold hover:underline" style={{ color: 'var(--site-heading)' }}>{e.name}</a>
        : <span className="text-[15px] font-bold" style={{ color: 'var(--site-heading)' }}>{e.name}</span>}
      {meta && <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{meta}</p>}
      {e.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{e.description}</p>}
    </li>
  )
}

// One "Living here" / "Getting around" card - the researched summary in a sentence or two, the
// top three places, and the rest folded away.
function TownPlaceCard({ categoryKey, data, luxe, label }: { categoryKey: string; data: any; luxe: boolean; label?: string }) {
  const meta = CURATED_CATEGORY_META[categoryKey]
  const items = categoryEntities(data)
  if (!meta || !items.length) return null
  const Icon = meta.icon
  return (
    <div className={`border p-5 sm:p-6 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-black" style={{ color: 'var(--site-heading)' }}>{label || meta.label}</h3>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{items.length} {items.length === 1 ? 'place' : 'places'}</p>
        </div>
      </div>
      {data?.notes && <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{firstSentences(data.notes, 2)}</p>}
      <ul className="mt-4 divide-y border-t pt-4" style={{ borderColor: 'var(--site-line)' }}>
        {items.slice(0, 3).map((e, i) => <TownPlaceRow key={i} e={e} />)}
      </ul>
      {items.length > 3 && (
        <TownMore label={`See all ${items.length}`}>
          <ul className="divide-y" style={{ borderColor: 'var(--site-line)' }}>
            {items.slice(3).map((e, i) => <TownPlaceRow key={i} e={e} />)}
          </ul>
        </TownMore>
      )}
    </div>
  )
}

function TownSchoolColumn({ label, schools }: { label: string; schools: { name: string; district?: string; source_url?: string }[] }) {
  if (!schools.length) return null
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-muted)' }}>{label}</p>
      <ul className="mt-2 space-y-2">
        {schools.map((s, i) => (
          <li key={i} className="text-sm font-semibold leading-snug" style={{ color: 'var(--site-ink)' }}>
            {s.source_url ? <a href={s.source_url} target="_blank" rel="noreferrer" className="hover:underline">{s.name}</a> : s.name}
            {s.district && <span className="block text-[11px] font-medium" style={{ color: 'var(--site-muted)' }}>{s.district}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Schools - the researched districts and schools by level (or the raw NCES list for a town not
// researched yet), private schools, and the always-on "confirm with the district" note.
function TownSchools({ facts, name, luxe }: { facts: Record<string, any>; name: string; luxe: boolean }) {
  const ps = facts.public_schools || {}
  const districts: { name: string; source_url?: string; share?: number }[] = ps.districts || []
  const raw: any[] = Array.isArray(facts.schools) ? facts.schools : (facts.schools?.items || [])
  const byLevel = (level: string) => raw.filter(s => String(s.level || '').toLowerCase().startsWith(level)).map(s => ({ name: tidyAllCaps(s.name) }))
  const elementary = ps.elementary_schools || byLevel('elem')
  const middle = ps.middle_schools || byLevel('mid')
  const high = ps.high_schools || byLevel('high')
  const privateSchools = categoryEntities(facts.private_schools)
  if (!districts.length && !elementary.length && !middle.length && !high.length) return null
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className={`border p-5 sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
        {districts.length > 0 && (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-muted)' }}>{districts.length > 1 ? `${districts.length} public school districts serve ${name}` : 'Public school district'}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {districts.map((d, i) => (
                <a key={i} href={d.source_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-black ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                  <GraduationCap className="h-3.5 w-3.5" /> {d.name}
                  {districts.length > 1 && d.share ? <span className="ml-0.5 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-black">{d.share}% of homes</span> : null}
                </a>
              ))}
            </div>
          </>
        )}
        {(ps.crosses_district_boundary || ps.assignment_depends_on_exact_address) && ps.boundary_caveat && (
          <div className="mt-4 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--site-ink)' }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>{ps.boundary_caveat}</p>
          </div>
        )}
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 ${districts.length ? 'mt-6 border-t pt-6' : ''}`} style={{ borderColor: 'var(--site-line)' }}>
          <TownSchoolColumn label="Elementary" schools={elementary} />
          <TownSchoolColumn label="Middle" schools={middle} />
          <TownSchoolColumn label="High school" schools={high} />
        </div>
        <p className="mt-6 border-t pt-4 text-[11px] leading-relaxed" style={{ borderColor: 'var(--site-line)', color: 'var(--site-muted)' }}>
          School assignment depends on the exact address and can change - confirm the schools for any specific home with {districts.length === 1 ? districts[0].name : 'the school district'}.
        </p>
      </div>
      {privateSchools.length > 0 ? (
        <TownPlaceCard categoryKey="private_schools" data={facts.private_schools} luxe={luxe} label="Private & independent schools" />
      ) : <div className="hidden lg:block" />}
    </div>
  )
}

function TownGlanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-[13px] font-semibold" style={{ color: 'var(--site-muted)' }}>{label}</dt>
      <dd className="text-right text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{value}</dd>
    </div>
  )
}

async function CommunityPage({ siteId, slug, theme, basePrefix, homesParams }: { siteId: string; slug: string; theme: any; basePrefix: string; homesParams: CommunityHomesParams }) {
  const area = await fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas/${encodeURIComponent(slug)}`)
  if (!area) notFound()

  const homesLimit = Math.min(Math.max(parseInt(homesParams.homes || '9', 10) || 9, 9), 48)
  const sort = ['newest', 'price_desc', 'price_asc'].includes(homesParams.sort || '') ? homesParams.sort! : 'newest'
  const listingsQs = new URLSearchParams({ limit: String(homesLimit), sort })
  if (homesParams.min_price) listingsQs.set('min_price', homesParams.min_price)
  if (homesParams.max_price) listingsQs.set('max_price', homesParams.max_price)

  const [listingsRes, profile, areaList] = await Promise.all([
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas/${encodeURIComponent(slug)}/listings?${listingsQs.toString()}`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/profile`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${siteId}/areas`),
  ])
  const inventory = listingsRes?.listings || []
  const inventoryTotal: number = listingsRes?.total || 0

  const facts = area.facts || {}
  const demographics = facts.demographics as Record<string, any> | undefined
  const marketStats = facts.market_stats as Record<string, any> | undefined
  // Prefers the AI-curated public_schools section (real district/school counts) once an area has
  // been researched under the new pipeline; falls back to the old raw NCES list for an area that
  // hasn't been re-researched yet, so the hero/quick-facts stat never just disappears.
  const curatedSchools = facts.public_schools
  const schoolCount = curatedSchools
    ? (curatedSchools.elementary_schools?.length || 0) + (curatedSchools.middle_schools?.length || 0) + (curatedSchools.high_schools?.length || 0)
    : (Array.isArray(facts.schools) ? facts.schools.length : (facts.schools?.items?.length || 0))
  // Whether this area has been researched under the new AI pipeline at all (see
  // area_research_service.py) - if not, the "Everything You Need to Know" grid below falls back
  // to the old raw Places/NCES cards instead of rendering an empty curated grid.
  const hasCuratedResearch = Object.keys(CURATED_CATEGORY_META).some(k => (facts[k]?.entities?.length || 0) > 0) || !!curatedSchools
  const photo = facts.photos?.items?.[0]
  // The header rotates through real homes in this town (the same photo the Neighborhoods card
  // uses first, then current listings) - the researched place photo only when there are none.
  const listPhoto = ((areaList || []) as any[]).find(a => a.slug === slug)?.photo as string | undefined
  const heroPhotos = Array.from(new Set([listPhoto, ...inventory.map((i: any) => i.photo), photo?.url ? resolveMediaUrl(photo.url) : null].filter(Boolean))).slice(0, 6) as string[]
  const areaDescriptor = [
    area.parent_area_name,
    area.county,
    area.state,
  ].filter(Boolean).join(', ')
  const guideLabel = 'Neighborhood Guide'
  const currentHref = (extra: Record<string, string>) => {
    const merged: Record<string, string> = { ...(homesParams.homes ? { homes: homesParams.homes } : {}), ...(homesParams.sort ? { sort: homesParams.sort } : {}), ...(homesParams.min_price ? { min_price: homesParams.min_price } : {}), ...(homesParams.max_price ? { max_price: homesParams.max_price } : {}), ...extra }
    return `${basePrefix}/${slug}?${new URLSearchParams(merged).toString()}`
  }

  // ---- What this town actually has, so the menu and page only show real sections.
  const luxe = theme.template !== 'default'
  const townLabel = [area.name, area.state].filter(Boolean).join(', ')
  const prefill = JSON.stringify({ property_of_interest: townLabel })
  const trends = area.market_trends || {}
  const faq = buildTownFaq(area, inventoryTotal)
  const summary = String(area.narrative?.summary || '').trim()
  const summaryLead = firstSentences(summary, 3)
  const summaryRest = summary.slice(summaryLead.length).trim()
  const livingKeys = ['downtown_centers', 'restaurants', 'shopping', 'grocery', 'parks'].filter(k => categoryHasContent(facts, k))
  const legacyFacts = hasCuratedResearch ? [] : Object.entries(FACT_SECTION_LABELS).filter(([key]) => {
    const fact = facts[key]
    const items = fact?.items || (key === 'schools' ? fact : null)
    return key !== 'schools' && Array.isArray(items) && items.length > 0
  })
  const aroundKeys = ['transportation', 'medical'].filter(k => categoryHasContent(facts, k))
  const hasMarket = !!(trends.series?.length && (trends.closed_count || trends.active_count)) || (facts.market_context?.stats?.length || 0) > 0 || !!(area.insights?.gauge || area.insights?.taxes || area.insights?.money_buys)
  const hasSchools = !!facts.public_schools?.districts?.length || schoolCount > 0
  const hasAround = aroundKeys.length > 0 || !!area.explore_origin || !!facts.commute?.destinations?.length || !!facts.walk?.rows?.length
  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'homes', label: 'Homes' },
    hasMarket ? { id: 'market', label: 'Market' } : null,
    hasSchools ? { id: 'schools', label: 'Schools' } : null,
    livingKeys.length || legacyFacts.length ? { id: 'living', label: 'Living here' } : null,
    hasAround ? { id: 'around', label: 'Getting around' } : null,
    faq.length ? { id: 'faq', label: 'FAQ' } : null,
  ].filter(Boolean) as { id: string; label: string }[]

  const goodToKnow = [
    facts.downtown_centers?.notes ? { icon: Building2, label: 'Town center', text: firstSentences(facts.downtown_centers.notes, 1) } : null,
    facts.transportation?.notes ? { icon: Train, label: 'Commute', text: firstSentences(facts.transportation.notes, 1) } : null,
    facts.parks?.notes ? { icon: Trees, label: 'Outdoors', text: firstSentences(facts.parks.notes, 1) } : null,
    facts.public_schools?.districts?.length ? { icon: GraduationCap, label: 'Schools', text: `Served by ${facts.public_schools.districts.map((d: any) => d.name).join(', ')}.` } : null,
  ].filter(Boolean) as { icon: any; label: string; text: string }[]

  const d = demographics || {}
  // A mailing-address town can span townships (Haverford: Lower Merion + Haverford) - say so plainly.
  const townships = ((area.municipalities || []) as { name: string; share: number }[]).map(m => `${m.name} ${m.share}%`).join(' · ')
  const glance = ([
    townships ? ['Townships', townships] : null,
    facts.flood?.homes_checked ? ['Homes in FEMA high-risk flood zones', `${facts.flood.high_risk_pct}%`] : null,
    facts.walk?.level ? ['Getting around on foot', String(facts.walk.level)] : null,
    marketStats?.median_price != null ? ['Median list price', `$${Math.round(marketStats.median_price).toLocaleString()}`] : null,
    inventoryTotal > 0 ? ['Homes for sale now', String(inventoryTotal)] : null,
    trends.median_sold_price ? ['Median sold (12 mo)', `$${Math.round(trends.median_sold_price).toLocaleString()}`] : null,
    (marketStats?.median_dom ?? trends.median_sold_dom) != null ? ['Median days on market', String(marketStats?.median_dom ?? trends.median_sold_dom)] : null,
    d.population?.value ? ['Population', Math.round(d.population.value).toLocaleString()] : null,
    // No age / income / who-owns rows - describing residents is off-limits under Fair Housing.
    area.county ? ['County', String(area.county)] : null,
  ].filter(Boolean) as [string, string][])

  const faqJsonLd = faq.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null

  const sold = (area.market_sales || []) as any[]
  const soldCard = (item: any) => (
    <ListingCard key={item.listing_key} item={{ ...item, price: item.sold_price ?? item.price, status: 'CLOSED' }} theme={theme} basePrefix={basePrefix} dateLabel={item.sold_date ? `Sold ${new Date(`${String(item.sold_date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Sold'} />
  )
  const btnRound = luxe ? 'rounded-full' : 'rounded-xl'
  const inputStyle = { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-ink)' }

  return (
    <main>
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />}
      {!luxe ? (
        <ClassicPageHero
          eyebrow={guideLabel}
          title={area.name}
          titleTag={areaDescriptor || undefined}
          accent=""
          subtitle={summary ? <span className="line-clamp-3 block">{firstSentences(summary, 1)}</span> : undefined}
          photos={heroPhotos}
          breadcrumb={<><a href={`${basePrefix}/`} className="hover:underline">Home</a> / <a href={`${basePrefix}/neighborhoods`} className="hover:underline">Neighborhoods</a> / <span style={{ color: 'var(--site-ink-soft)' }}>{area.name}</span></>}
          stats={([
            marketStats?.median_price != null ? ['Median list price', `$${Math.round(marketStats.median_price).toLocaleString()}`] : null,
            inventoryTotal > 0 ? ['Homes for sale', String(inventoryTotal)] : null,
            marketStats?.median_dom != null ? ['Median days on market', String(marketStats.median_dom)] : null,
            schoolCount > 0 ? ['Schools', String(schoolCount)] : null,
          ].filter(Boolean) as [string, string][]).map(([label, value]) => ({ label, value }))}
        >
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#homes" className="inline-flex rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>See homes for sale</a>
            <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={`New homes in ${area.name}`} data-ohp-prefill={prefill} data-ohp-criteria={JSON.stringify({ kind: 'search', cities: [area.name] })}
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)', backgroundColor: 'var(--site-surface)' }}>
              <Bell className="h-4 w-4" style={{ color: 'var(--site-accent)' }} /> Get new-listing alerts
            </a>
          </div>
        </ClassicPageHero>
      ) : (
      <div className="relative flex min-h-[78vh] items-end overflow-hidden bg-gray-900 px-6 pb-12 pt-32 text-white sm:pb-14" style={{ backgroundColor: theme.primary_color }}>
        <CinematicHeroBackground photos={heroPhotos} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.secondary_color}, transparent)` }} />
        <div className="relative mx-auto w-full max-w-6xl">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            <a href={`${basePrefix}/`} className="hover:text-white">Home</a> /
            <a href={`${basePrefix}/neighborhoods`} className="hover:text-white">Neighborhoods</a> /
            <span className="text-white/85">{area.name}</span>
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>{guideLabel}</span>
          </div>
          {/* The county / state rides on the town's own line, small - not a second line under it. */}
          <h1 className={`ohp-site-heading mt-4 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight sm:text-8xl ${fontClass(theme.heading_font, 'font-serif')}`}>
            <span className="ohp-text-shimmer">{area.name}</span>
            {areaDescriptor && <span className="ml-4 inline-flex items-center gap-1.5 align-middle font-sans text-sm font-bold uppercase tracking-[0.18em] text-white/70 sm:text-base"><MapPin className="h-4 w-4" style={{ color: theme.secondary_color }} />{areaDescriptor}</span>}
          </h1>
          {summary && <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{firstSentences(summary, 1)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#homes" className="ohp-gold-sheen inline-flex rounded-full px-7 py-3.5 text-xs font-black uppercase tracking-widest shadow-xl transition hover:-translate-y-0.5" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
              See homes for sale
            </a>
            <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={`New homes in ${area.name}`} data-ohp-prefill={prefill} data-ohp-criteria={JSON.stringify({ kind: 'search', cities: [area.name] })}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10">
              <Bell className="h-3.5 w-3.5" /> Get new-listing alerts
            </a>
          </div>
          {glance.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 overflow-hidden rounded-[22px] border border-white/15 bg-white/[0.07] sm:flex sm:divide-x sm:divide-white/10">
              {([
                marketStats?.median_price != null ? ['Median list price', `$${Math.round(marketStats.median_price).toLocaleString()}`] : null,
                inventoryTotal > 0 ? ['Homes for sale', String(inventoryTotal)] : null,
                marketStats?.median_dom != null ? ['Median days on market', String(marketStats.median_dom)] : null,
                schoolCount > 0 ? ['Schools', String(schoolCount)] : null,
                demographics?.population?.value ? ['Residents', Math.round(Number(demographics.population.value)).toLocaleString()] : null,
              ].filter(Boolean) as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex-1 px-5 py-4">
                  <dd className={`text-2xl font-black leading-none sm:text-[1.7rem] ${fontClass(theme.heading_font, 'font-serif')}`}>{value}</dd>
                  <dt className="mt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
        {/* See SiteChrome's IntersectionObserver - marks exactly where this hero ends. */}
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </div>
      )}

      <TownSectionNav sections={sections} luxe={luxe} />

      {/* Overview - the town in a few sentences, what's good to know, the numbers at a glance and
          the agent who knows it. */}
      <TownSection id="overview">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.45fr_1fr]">
          <div className="min-w-0">
            <TownHeading luxe={luxe} eyebrow="Overview" title={`Living in ${area.name}`} />
            {summaryLead ? (
              <>
                <p className="ohp-site-body mt-5 text-[17px] leading-[1.75]" style={{ color: 'var(--site-ink-soft)' }}>{summaryLead}</p>
                {summaryRest && (
                  <TownMore label="Keep reading">
                    <p className="ohp-site-body text-[17px] leading-[1.75]" style={{ color: 'var(--site-ink-soft)' }}>{summaryRest}</p>
                  </TownMore>
                )}
              </>
            ) : (
              <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'var(--site-muted)' }}>A full guide to {area.name} is on its way - in the meantime, ask me anything about living here.</p>
            )}
            {goodToKnow.length > 0 && (
              <div className="mt-8">
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-muted)' }}>Good to know</p>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {goodToKnow.map(g => (
                    <li key={g.label} className={`flex gap-3 border p-4 ${luxe ? 'rounded-[20px]' : 'rounded-xl'}`} style={TOWN_CARD_STYLE}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}><g.icon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black" style={{ color: 'var(--site-heading)' }}>{g.label}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{g.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="min-w-0 space-y-5">
            {glance.length > 0 && (
              <div className={`border p-6 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>{area.name} at a glance</p>
                <dl className="mt-4 divide-y" style={{ borderColor: 'var(--site-line)' }}>
                  {glance.map(([label, value]) => <TownGlanceRow key={label} label={label} value={value} />)}
                </dl>
                <p className="mt-4 text-[10px] font-semibold leading-relaxed" style={{ color: 'var(--site-muted)' }}>Home numbers update live from the MLS. People numbers: U.S. Census (ACS).</p>
              </div>
            )}
            {profile?.name && (
              <div className={`flex items-center gap-4 border p-5 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                {profile.photo_url && <img src={sizedImage(resolveMediaUrl(profile.photo_url), 128)} loading="lazy" decoding="async" alt={profile.name} className="h-14 w-14 shrink-0 rounded-full object-cover" style={{ boxShadow: '0 0 0 3px var(--site-surface), 0 0 0 4px var(--site-accent)' }} />}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold" style={{ color: 'var(--site-muted)' }}>Your {area.name} expert</p>
                  <p className="truncate text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{profile.name}</p>
                  <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title={`Ask about ${area.name}`} data-ohp-prefill={prefill}
                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-black" style={{ color: 'var(--site-accent-text)' }}>
                    <MessageCircle className="h-3.5 w-3.5" /> Ask me about {area.name}
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
        <TownMap data={facts.boundaries} town={area.name} luxe={luxe} />
      </TownSection>

      {/* Homes - the agent's own listings, everything for sale (live, full MLS), open houses and
          what recently sold. */}
      <TownSection id="homes" alt>
        <TownHeading
          luxe={luxe}
          eyebrow="Homes"
          title={`Homes for sale in ${area.name}`}
          sub={inventoryTotal > 0 ? `${inventoryTotal} on the market right now - updated live from the MLS.` : 'Updated live from the MLS.'}
          right={
            <form method="GET" action={`${basePrefix}/${slug}#homes`} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <input type="hidden" name="homes" value={String(homesLimit)} />
              <input type="text" inputMode="numeric" name="min_price" defaultValue={homesParams.min_price || ''} placeholder="Min $" aria-label="Minimum price" className={`w-[5.5rem] flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle} />
              <input type="text" inputMode="numeric" name="max_price" defaultValue={homesParams.max_price || ''} placeholder="Max $" aria-label="Maximum price" className={`w-[5.5rem] flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle} />
              <select name="sort" defaultValue={sort} aria-label="Sort" className={`flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle}>
                <option value="newest">Newest</option>
                <option value="price_desc">Price: high to low</option>
                <option value="price_asc">Price: low to high</option>
              </select>
              <button type="submit" className={`px-5 py-2.5 text-xs font-black ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Apply</button>
            </form>
          }
        />

        {area.my_listings?.length > 0 && (
          <div className="mt-10">
            <TownSubheading count={area.my_listings.length}>{profile?.name ? `Listed by ${profile.name}` : 'My listings'}</TownSubheading>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.my_listings.map((item: any) => <HomeCard key={item.listing_key} listing={item} theme={theme} basePrefix={basePrefix} />)}
            </div>
          </div>
        )}

        <div className="mt-10">
          {area.my_listings?.length > 0 && <TownSubheading count={inventoryTotal}>Everything for sale</TownSubheading>}
          {inventory.length > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {inventory.map((item: any) => <HomeCard key={item.listing_key} listing={item} theme={theme} basePrefix={basePrefix} />)}
              </div>
              <div className="mt-8 flex flex-col items-center gap-3">
                {homesLimit < 48 && inventoryTotal > homesLimit && (
                  <a href={`${currentHref({ homes: String(Math.min(homesLimit + 12, 48)) })}#homes`} className={`inline-flex border-2 px-8 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ borderColor: 'var(--site-heading)', color: 'var(--site-heading)' }}>
                    Show more homes ({inventoryTotal - homesLimit} more)
                  </a>
                )}
                {homesLimit >= 48 && inventoryTotal > 48 && (
                  <p className="text-center text-xs" style={{ color: 'var(--site-muted)' }}>Showing 48 of {inventoryTotal} homes - narrow the price above, or <a href={`${basePrefix}/search?city=${encodeURIComponent(area.name)}`} className="font-bold underline">search them all on the map</a>.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm" style={{ color: 'var(--site-muted)' }}>Nothing matches these filters right now - get an alert the moment something does.</p>
          )}
        </div>

        {/* Alerts - the reason to come back. */}
        <div className={`mt-10 flex flex-col items-start gap-4 border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Bell className="h-5 w-5" /></span>
            <div>
              <p className="text-lg font-black" style={{ color: 'var(--site-heading)' }}>Be first to see new homes in {area.name}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--site-muted)' }}>Tell me what you want - matching homes come to you the day they list, in your own private Showcase.</p>
            </div>
          </div>
          <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={`New homes in ${area.name}`} data-ohp-prefill={prefill} data-ohp-criteria={JSON.stringify({ kind: 'search', cities: [area.name] })}
            className={`inline-flex shrink-0 items-center gap-2 px-6 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            Set up my alerts <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {area.open_houses?.length > 0 && (
          <div className="mt-12">
            <TownSubheading count={area.open_houses.length}>Upcoming open houses</TownSubheading>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.open_houses.map((item: any) => (
                <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} dateLabel={item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined} />
              ))}
            </div>
          </div>
        )}

        {sold.length > 0 && (
          <div className="mt-12">
            <TownSubheading>Recently sold</TownSubheading>
            <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>What homes here really sell for - the latest closed sales across the MLS.</p>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{sold.slice(0, 3).map(soldCard)}</div>
            {sold.length > 3 && (
              <TownMore label={`See ${sold.length - 3} more sales`}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{sold.slice(3).map(soldCard)}</div>
              </TownMore>
            )}
          </div>
        )}

        {area.sales?.length > 0 && (
          <div className="mt-12">
            <TownSubheading count={area.sales.length}>{profile?.name ? `Sold by ${profile.name}` : 'My recent sales'}</TownSubheading>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.sales.slice(0, 3).map((item: any) => <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} />)}
            </div>
            {area.sales.length > 3 && (
              <TownMore label={`See ${area.sales.length - 3} more`}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {area.sales.slice(3).map((item: any) => <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} />)}
                </div>
              </TownMore>
            )}
          </div>
        )}
      </TownSection>

      {/* Market - a year of closed sales, then outside research folded away. */}
      {hasMarket && (
        <TownSection id="market">
          <TownHeading luxe={luxe} eyebrow="Market" title={`What homes in ${area.name} sell for`}
            right={profile?.name ? (
              <a href={`${basePrefix}/contact`} data-ohp-form="home_value" data-ohp-form-title={`What's my ${area.name} home worth?`} data-ohp-prefill={prefill}
                className={`inline-flex items-center gap-2 border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
                <Home className="h-4 w-4" style={{ color: 'var(--site-accent)' }} /> What&apos;s my home worth?
              </a>
            ) : undefined} />
          <TownInsights data={area.insights} town={area.name} luxe={luxe} />
          <div className="mt-6"><MarketTrendsSection trends={area.market_trends} theme={theme} areaName={area.name} bare /></div>
          {(facts.market_context?.stats?.length || 0) > 0 && (
            <TownMore label={`What outside research says (${facts.market_context.stats.length})`}>
              <p className="text-xs" style={{ color: 'var(--site-muted)' }}>From outside sources, not live MLS data - each figure has its own source and date.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facts.market_context.stats.map((s: any, i: number) => (
                  <div key={i} className={`border p-5 ${luxe ? 'rounded-[20px]' : 'rounded-xl'}`} style={TOWN_CARD_STYLE}>
                    <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{s.label}</p>
                    <p className="mt-1 text-2xl font-black" style={{ color: 'var(--site-heading)' }}>{s.value}</p>
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--site-muted)' }}>{s.geography} · {s.time_period}</p>
                    {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--site-accent-text)' }}>Source <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                ))}
              </div>
            </TownMore>
          )}
        </TownSection>
      )}

      {hasSchools && (
        <TownSection id="schools" alt>
          <TownHeading luxe={luxe} eyebrow="Schools" title={`Schools in ${area.name}`} sub="Public districts and schools by level, plus private options nearby." />
          <TownSchools facts={facts} name={area.name} luxe={luxe} />
        </TownSection>
      )}

      {(livingKeys.length > 0 || legacyFacts.length > 0) && (
        <TownSection id="living">
          <TownHeading luxe={luxe} eyebrow="Living here" title={`Day-to-day life in ${area.name}`} sub="Where people eat, shop, get groceries and get outside." />
          {livingKeys.length > 0 && (
            <TownLiving town={area.name} luxe={luxe} categories={livingKeys.map(k => ({
              key: k, label: CURATED_CATEGORY_META[k]?.label || k, notes: facts[k]?.notes || null,
              items: categoryEntities(facts[k]).map(e => ({ name: e.name, category: e.category, city: e.city, distance_miles: e.distance_miles, description: e.description, source_url: e.source_url })),
            }))} />
          )}
          <div className="mt-8 gap-5 lg:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
            {legacyFacts.map(([key, label]) => {
              const items = facts[key]?.items || []
              return (
                <FactCard key={key} label={label} source={facts[key]?.source} icon={FACT_SECTION_ICONS[key]} theme={theme}>
                  <ul className="space-y-1">{items.slice(0, 6).map((item: any, i: number) => <li key={i}>{item.name}</li>)}</ul>
                </FactCard>
              )
            })}
          </div>
        </TownSection>
      )}

      {hasAround && (
        <section id="around" className="scroll-mt-32 px-5 py-14 sm:px-6 sm:py-20" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
          {(aroundKeys.length > 0 || facts.commute?.destinations?.length > 0) && (
            <div className="mx-auto max-w-6xl">
              <TownHeading luxe={luxe} eyebrow="Getting around" title="Commute, transit & care" sub={`How people get to work from ${area.name}, and the hospitals and doctors close by.`} />
              <TownCommute data={facts.commute} town={area.name} luxe={luxe} />
              <TownWalk data={facts.walk} town={area.name} luxe={luxe} />
              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {aroundKeys.map(k => <TownPlaceCard key={k} categoryKey={k} data={facts[k]} luxe={luxe} />)}
              </div>
            </div>
          )}
          <div className={`mx-auto max-w-6xl ${aroundKeys.length ? 'mt-6' : ''}`}>
            <ExploreNearby
              siteId={siteId}
              kind="area"
              slug={slug}
              title={`Explore around ${area.name}`}
              originLabel={area.name}
              origin={area.explore_origin}
              theme={theme}
              embedded
            />
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <TownSection id="faq">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <TownHeading luxe={luxe} eyebrow="FAQ" title={`${area.name} questions, answered`} sub="The things people ask most before moving here." />
              <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title={`Ask about ${area.name}`} data-ohp-prefill={prefill}
                className={`mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                <MessageCircle className="h-4 w-4" /> Ask your own question
              </a>
            </div>
            <div className="divide-y border-y" style={{ borderColor: 'var(--site-line)' }}>
              {faq.map((f, i) => (
                <details key={f.q} className="group/faq py-1" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-black sm:text-base [&::-webkit-details-marker]:hidden" style={{ color: 'var(--site-heading)' }}>
                    {f.q}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center transition group-open/faq:rotate-45 ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}><Plus className="h-4 w-4" /></span>
                  </summary>
                  <div className="pb-5 pr-10 text-[15px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>
                    <p>{f.a}</p>
                    {f.source && (f.source.url
                      ? <a href={f.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--site-accent-text)' }}>Source: {f.source.name} <ExternalLink className="h-3 w-3" /></a>
                      : <p className="mt-2 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>Source: {f.source.name}</p>)}
                    {i === faq.length - 1 && (
                      <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title={`New homes in ${area.name}`} data-ohp-prefill={prefill} data-ohp-criteria={JSON.stringify({ kind: 'search', cities: [area.name] })}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-black" style={{ color: 'var(--site-accent-text)' }}>
                        Set up my alerts <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </TownSection>
      )}

      {/* Nearby towns - each with a one-tap side-by-side compare. */}
      {area.related_areas?.length > 0 && (
        <TownSection id="nearby" alt>
          <TownHeading luxe={luxe} eyebrow="Nearby" title={`Also near ${area.name}`} sub="Weighing a few towns? Compare any two side by side." />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {area.related_areas.map((related: any) => (
              <div key={related.slug} className={`group overflow-hidden border transition hover:-translate-y-1 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                <a href={`${basePrefix}/${related.slug}`} className="block">
                  <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <SitePhoto src={resolveMediaUrl(related.photo)} widths={IMG.card} className="h-full w-full transition-transform duration-700 group-hover:scale-105 object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-3 left-4 text-xl font-black text-white">{related.name}{related.state ? `, ${related.state}` : ''}</p>
                  </div>
                </a>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--site-muted)' }}>{related.median_price != null ? `$${related.median_price.toLocaleString()} median` : 'Neighborhood guide'}</span>
                  <a href={`${basePrefix}/neighborhoods/compare?areas=${encodeURIComponent(`${slug},${related.slug}`)}`} className="text-xs font-black" style={{ color: 'var(--site-accent-text)' }}>Compare →</a>
                </div>
              </div>
            ))}
          </div>
        </TownSection>
      )}

      {/* Close - the agent, and the three things a guest might want next. */}
      <section id="contact" className="scroll-mt-32 px-5 py-16 sm:px-6 sm:py-20">
        <div className={`relative mx-auto max-w-6xl overflow-hidden p-7 sm:p-12 ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={{ backgroundColor: luxe ? theme.primary_color : 'var(--site-accent-deep)' }}>
          {heroPhotos[0] && <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16]" style={{ backgroundImage: sizedBg(heroPhotos[0], 1920) }} />}
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: luxe ? theme.secondary_color : 'rgba(255,255,255,0.7)' }}>Thinking about {area.name}?</p>
              <h2 className={`ohp-site-heading mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem] ${luxe ? fontClass(theme.heading_font, 'font-serif') : ''}`}>Let&apos;s find your place here.</h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/75">Buying or selling in {area.name}, I&apos;ll walk you through the streets, the schools and the numbers - no pressure.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`${basePrefix}/contact`} data-ohp-form="buying" data-ohp-form-title={`Buying in ${area.name}`} data-ohp-prefill={prefill}
                  className={`inline-flex px-6 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound} ${luxe ? 'ohp-gold-sheen' : ''}`} style={luxe ? { backgroundColor: theme.secondary_color, color: theme.primary_color } : { backgroundColor: '#ffffff', color: 'var(--site-accent-deep)' }}>I&apos;m buying</a>
                <a href={`${basePrefix}/contact`} data-ohp-form="selling" data-ohp-form-title={`Selling in ${area.name}`} data-ohp-prefill={prefill}
                  className={`inline-flex border border-white/40 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10 ${btnRound}`}>I&apos;m selling</a>
                {profile?.phone && <a href={`tel:${profile.phone}`} className={`inline-flex border border-white/40 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10 ${btnRound}`}>Call {profile.phone}</a>}
              </div>
            </div>
            {profile?.name && (
              <div className="flex items-center gap-4 lg:justify-end">
                {profile.photo_url && <img src={sizedImage(resolveMediaUrl(profile.photo_url), 256)} loading="lazy" decoding="async" alt={profile.name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white/20" />}
                <div className="min-w-0">
                  <p className="text-lg font-black text-white">{profile.name}</p>
                  {profile.brokerage && <p className="text-xs font-semibold text-white/60">{profile.brokerage}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
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
  const currentSearchParams = await searchParams
  const wantsSiteChrome = currentSearchParams.site_chrome === '1'
  // Classic opens every page on a light banner (ClassicPageHero / the split home hero), so its
  // header is always the solid one - only Luxe sits transparent over a dark photo hero.
  const luxeLook = theme.template !== 'default'
  if (path?.[0] === 'blog') {
    if (path[1]) {
      content = <BlogDetail siteId={resolved.site_id} slug={path[1]} theme={theme} basePrefix={basePrefix} />
    } else {
      content = <BlogIndex siteId={resolved.site_id} theme={theme} basePrefix={basePrefix} category={currentSearchParams.category} />
      hasDarkHero = true
    }
  } else if (path?.[0] === 'properties') {
    if (path[1]) {
      content = <PropertyDetail siteId={resolved.site_id} listingKey={path[1]} theme={theme} basePrefix={basePrefix} />
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
  } else if (path?.[0] === 'listings' && path[1] && !path[2]) {
    // A Listing Spotlight on the agent's own connected domain (<domain>/listings/<slug>) - the
    // link the app hands out once a custom domain is ACTIVE (see property_website_service.public_url).
    const propertySite = await resolvePropertySite(host, joinPath(path))
    if (!propertySite) notFound()
    const publicUrl = `https://${propertySite.canonical_hostname || host}`
    return propertySite.template_id === 'editorial_estate'
      ? <EditorialEstateTemplate data={propertySite} publicUrl={publicUrl} />
      : <CinematicLuxuryTemplate data={propertySite} publicUrl={publicUrl} />
  } else if (path?.[0] === 'forms' && path[1] && !path[2]) {
    content = <FormAliasPage siteId={resolved.site_id} formId={path[1]} basePrefix={basePrefix} forceLightMode={wantsSiteChrome} embeddedInSiteChrome={wantsSiteChrome} campaignToken={currentSearchParams.c ?? null} />
    exactExternalResource = !wantsSiteChrome
  } else if ((path?.[0] === 'my-showcase' || path?.[0] === 'create-showcase') && !path[1]) {
    // "{first}'s Showcase" (the glowing header tab) and every "Create my Showcase" button: their
    // Showcase if this browser knows it (the ohp_visitor cookie - lib/visitor), else the builder.
    content = <MyShowcaseRoute siteId={resolved.site_id} basePrefix={basePrefix} theme={theme} create={path[0] === 'create-showcase'} />
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
    content = <AboutPage siteId={resolved.site_id} basePrefix={basePrefix} host={host} framed />
    hideFooter = true
  } else if (path?.[0] === 'about' && !path[1]) {
    content = <AboutPage siteId={resolved.site_id} basePrefix={basePrefix} host={host} framed />
    hideFooter = true
  } else if (path?.[0] === 'home-value' && !path[1]) {
    // "What's my home worth?" landing page - for ads, mailers and the agent's email signature.
    const [hvProfile, hvAreas, hvReviews] = await Promise.all([
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
      fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
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
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
    fetchJson(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
  ])
  const hasReviews = Boolean(footerReviews?.show)
  const hasSoldPage = pages.some(p => p.slug === 'sold')
  const pageLd = path?.length && snapshot?.seo?.allow_indexing !== false
    ? await pageStructuredData(resolved, host, path, footerProfile, footerAreas || [], footerReviews, footerProfile?.name || siteName)
    : []

  return (
    <SiteShell theme={theme} siteKey={resolved.subdomain_slug} agentName={footerProfile?.name || siteName}>
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
