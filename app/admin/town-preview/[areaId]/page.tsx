import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import SiteShell from '@/components/website-public/SiteShell'
import { SiteHeader, SiteFooter } from '@/components/website-public/SiteChrome'
import { TownPageView, townHomesQuery, type CommunityHomesParams } from '@/components/website-public/town/TownPage'
import { DEFAULT_SITE_THEME } from '@/components/website-public/types'
import TownPreviewChrome from '@/components/admin/TownPreviewChrome'
import { normalizeSiteTheme } from '@/lib/siteTheme'

// Admin "Neighborhoods" -> Preview page: a town's IDX page exactly as it looks on an agent's site
// (or with a stand-in agent, for a town nobody shows yet). The page itself is the real one
// (components/website-public/town/TownPage - the same code the public site route draws); the data
// comes from the admin-only GET /admin/areas/{id}/preview, which builds it with the public
// site's own functions. Never public: the backend answers the admin only, and it is never indexed.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Town page preview | Admin',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

type PreviewParams = CommunityHomesParams & { site?: string; look?: string }

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f7] p-6">
      <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-black text-[#111827]">{title}</p>
        <p className="mt-2 text-sm text-gray-600">{text}</p>
      </div>
    </main>
  )
}

export default async function TownPreviewPage({ params, searchParams }: { params: Promise<{ areaId: string }>; searchParams: Promise<PreviewParams> }) {
  const { areaId } = await params
  const sp = await searchParams
  const token = (await cookies()).get('auth_token')?.value
  if (!token) return <Notice title="Sign in as the admin" text="This preview is only for the OpenHousePal admin. Sign in, then open it again from Admin → Neighborhoods." />

  const homesParams: CommunityHomesParams = { homes: sp.homes, sort: sp.sort, min_price: sp.min_price, max_price: sp.max_price }
  const qs = new URLSearchParams(townHomesQuery(homesParams).listingsQs)
  if (sp.site) qs.set('site', sp.site)
  let res: Response
  try {
    res = await fetch(`${INTERNAL_API_URL}/admin/areas/${encodeURIComponent(areaId)}/preview?${qs.toString()}`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return <Notice title="Couldn't load the preview" text="The server didn't answer. Try again in a minute." />
  }
  if (res.status === 401 || res.status === 403) return <Notice title="Sign in as the admin" text="This preview is only for the OpenHousePal admin." />
  if (!res.ok) {
    const detail = await res.json().then(j => (typeof j?.detail === 'string' ? j.detail : ''), () => '')
    return <Notice title="Couldn't load the preview" text={detail || 'Something went wrong. Try again in a minute.'} />
  }
  const data = await res.json()

  // The same theme steps as the public page (app/(sitepublic)/.../page.tsx); a stand-in agent gets
  // the default Classic look (or Luxe, when the admin picks it).
  const site = data.site as null | { site_id: string; subdomain_slug: string; host: string; agent_name: string; theme: any; pages: any[] }
  const theme = normalizeSiteTheme(site
    ? { ...DEFAULT_SITE_THEME, ...(site.theme || {}) }
    : { ...DEFAULT_SITE_THEME, template: sp.look === 'luxe' ? 'luxe' : 'default' })
  const pages = site?.pages || []
  const homePage = pages.find((p: any) => p.is_home) || pages[0]
  const profile = data.profile
  const siteName = homePage?.title || site?.subdomain_slug || profile?.name || 'Your name here'
  const siteKey = site?.subdomain_slug || 'admin-town-preview'
  // Links that leave the town page go to the agent's real site (opened in a new tab by TownPreviewChrome).
  const basePrefix = site ? `/ohp-site-render/${encodeURIComponent(site.host)}` : ''
  const keepParams: Record<string, string> = { site: site ? site.site_id : 'none', ...(!site && sp.look === 'luxe' ? { look: 'luxe' } : {}) }
  const luxeLook = theme.template !== 'default'
  const areas = data.areas || []
  const hasReviews = Boolean(data.reviews?.show)

  return (
    <SiteShell theme={theme} siteKey={siteKey} agentName={profile?.name || siteName}>
      <SiteHeader theme={theme} pages={pages} siteName={siteName} basePrefix={basePrefix} hasCommunities={areas.length > 0} agentProfile={profile || undefined} hasDarkHero={luxeLook} siteKey={siteKey} hasReviews={hasReviews} />
      <div className={luxeLook ? '' : 'pt-20'}>
        <TownPageView
          area={data.area} listingsRes={data.listings} profile={profile} areaList={areas}
          siteId={site?.site_id || ''} slug={data.slug} theme={theme} basePrefix={basePrefix} homesParams={homesParams}
          selfPath={`/admin/town-preview/${encodeURIComponent(areaId)}`} keepParams={keepParams}
        />
      </div>
      <SiteFooter theme={theme} siteName={profile?.name || siteName} areas={areas} hasSoldPage={pages.some((p: any) => p.slug === 'sold')} hasReviews={hasReviews} profile={profile || undefined} signatureSlug={profile?.signature_hub_slug} basePrefix={basePrefix} showCta={false} idxNotice />
      <TownPreviewChrome agentName={site ? site.agent_name : null} hasSite={!!site} />
    </SiteShell>
  )
}
