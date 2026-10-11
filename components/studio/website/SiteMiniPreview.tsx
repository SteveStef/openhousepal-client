'use client'

// A small, live copy of the agent's IDX website for the setup flow - the very same header, sections
// and footer the website editor's preview (and the live site) draw, from the agent's draft. Theme
// changes land instantly (they're just CSS variables); data changes (towns, header homes) re-fetch
// the sections' real content. `focus` scrolls it to what the step is about and rings it in gold;
// each change makes the ring (and a small "what changed" tag) pulse again.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Monitor } from 'lucide-react'
import api from '@/lib/api-service'
import type { FeaturedSettings, Site, SiteBlock, SitePage, SiteTheme } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import SitePageRenderer from '@/components/website-public/SitePageRenderer'
import ShowcaseCreatorCTA from '@/components/website-public/ShowcaseCreatorCTA'
import { SiteFooter, SiteHeader } from '@/components/website-public/SiteChrome'
import { DEFAULT_SITE_THEME } from '@/components/website-public/types'
import { siteFontVariables } from '@/lib/site-fonts'
import { normalizeSiteTheme, siteThemeVars } from '@/lib/siteTheme'
import { siteProfileFromHub, type SiteChromeProfile } from '@/lib/siteProfileFromHub'
import { PREVIEW_FX_CSS } from './previewFx'
import '@/app/(sitepublic)/site-theme.css'

const DESKTOP_W = 1280
const MISSING: Record<string, string> = {
  communities: 'Your home page has no Neighborhoods section - each town still gets its own page, in your menu.',
  hero: 'Your home page has no header section - add "Header" in the website editor.',
  featured_listings: 'Your Featured page shows these homes.',
}
const FOCUS_TAGS: Record<string, string> = { communities: 'Your neighborhoods', hero: 'Your header homes', featured_listings: 'Your featured homes' }

export default function SiteMiniPreview({ site, theme, featured, focus = 'top', refreshKey = 0, quietKey = 0, note, hasReviews = false, height = 300 }: {
  /** The draft site (loaded here when not given). */
  site?: Site | null
  /** The theme being picked (overrides the draft's). */
  theme?: SiteTheme
  featured?: FeaturedSettings
  /** What to show: the top of the page, or a section type (scrolled to and ringed in gold). */
  focus?: 'top' | SiteBlock['type']
  /** Bump to re-fetch the sections' live content (a town added or removed elsewhere). */
  refreshKey?: number
  /** Re-fetches without the "changed" pulse (a town's facts finishing in the background). */
  quietKey?: number
  /** The small gold tag shown on the ring after a change. */
  note?: string
  hasReviews?: boolean
  height?: number
}) {
  const { user } = useAuth()
  const [ownSite, setOwnSite] = useState<Site | null>(null)
  const [profile, setProfile] = useState<SiteChromeProfile | undefined>(undefined)
  const [hydrated, setHydrated] = useState<SiteBlock[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pulse, setPulse] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => { if (site === undefined) api.sites.getMine().then(r => { if (r.success && r.data) setOwnSite(r.data) }) }, [site])
  useEffect(() => { api.agentHub.getMine().then(r => setProfile(siteProfileFromHub(r.success ? r.data?.config : null, user))) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // The menu's Neighborhoods link shows once they serve a town, like the live site.
  const [areaCount, setAreaCount] = useState(0)
  useEffect(() => { api.sites.getAreas().then(r => setAreaCount(r.success && r.data ? r.data.length : 0)) }, [refreshKey, quietKey])
  const s = site === undefined ? ownSite : site
  // Only the first load of the site carries the signature card's source - keep it.
  const [sigSlug, setSigSlug] = useState<string | null>(null)
  useEffect(() => { if (s?.signature_hub_slug) setSigSlug(s.signature_hub_slug) }, [s])
  const home: SitePage | null = useMemo(() => {
    const pages = (s?.draft_data?.pages || []) as SitePage[]
    return pages.find(p => p.is_home) || null
  }, [s])
  const shownTheme = normalizeSiteTheme((theme || s?.draft_data?.theme || DEFAULT_SITE_THEME) as SiteTheme)
  const vars = siteThemeVars(shownTheme)
  const feat = featured || (s?.draft_data?.featured_settings as FeaturedSettings | undefined)

  // the sections' live content (homes, towns, photos) - only the server can fill these in
  const blocksKey = JSON.stringify(home?.blocks || [])
  const featKey = JSON.stringify(feat || null)
  useEffect(() => {
    if (!home) return
    const n = ++seq.current
    setLoading(true)
    const t = window.setTimeout(() => {
      api.sites.previewBlocks(home.blocks, feat).then(r => {
        if (n !== seq.current) return
        if (r.success && r.data) setHydrated(r.data.blocks)
        setLoading(false)
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [blocksKey, featKey, refreshKey, quietKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // desktop: the real desktop page, zoomed to fit; phones: the phone layout as it is
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setZoom(window.innerWidth >= 1024 && el.clientWidth < DESKTOP_W ? el.clientWidth / DESKTOP_W : 1)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [!!home]) // eslint-disable-line react-hooks/exhaustive-deps

  const blocks = useMemo(() => {
    if (!home) return []
    const byId = new Map((hydrated || []).map(b => [b.id, b]))
    return home.blocks.map(b => {
      const h = byId.get(b.id)
      if (!h) return b
      const carried: Record<string, any> = {}
      for (const [k, v] of Object.entries(h.data || {})) if (k === 'resolved' || k.startsWith('resolved_') || k.startsWith('agent_') || k === 'profile') carried[k] = v
      return { ...b, data: { ...carried, ...(b.data || {}) } }
    })
  }, [home, hydrated])
  const focusId = focus === 'top' ? null : blocks.find(b => b.type === focus && !b.hidden)?.id || null

  // follow the focus, and pulse on every change
  const changeKey = JSON.stringify([shownTheme, featKey, refreshKey, hasReviews, note])
  const firstChange = useRef(true)
  useEffect(() => {
    if (firstChange.current) { firstChange.current = false; return }
    setPulse(p => p + 1)
  }, [changeKey])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const t = window.setTimeout(() => {
      const target = focusId ? el.querySelector<HTMLElement>(`[data-ohp-block="${focusId}"]`) : null
      const top = target ? target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 70 * zoom : 0
      el.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 200)
    return () => window.clearTimeout(t)
  }, [focusId, hydrated, zoom, pulse])

  if (!s) return <div className="flex items-center justify-center rounded-2xl border-2 border-[#ece5d6] dark:border-white/10" style={{ height }}><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const name = profile?.name || s.subdomain_slug
  const hasDarkHero = home?.blocks?.[0]?.type === 'hero' && !home.blocks[0]?.hidden

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[#ece5d6] bg-white shadow-[0_24px_50px_-34px_rgba(17,24,39,.55)] dark:border-white/10 dark:bg-[#151517]">
      {focus !== 'top' && home && hydrated && !focusId && (
        <span className="absolute left-1/2 top-12 z-[80] w-max max-w-[90%] -translate-x-1/2 rounded-full bg-[#111827]/90 px-3.5 py-2 text-center text-[11.5px] font-bold text-white shadow-lg">
          {MISSING[focus] || 'This part isn’t on your home page.'}
        </span>
      )}
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-[#1c1c1e]">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-1 font-mono text-[10px] font-semibold text-gray-400 dark:bg-black/30">{s.subdomain_slug}.openhousepal.com</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-gray-400">
          {loading ? <><Loader2 className="h-3 w-3 animate-spin text-[#C9A24D]" /> Updating</> : <>{zoom < 1 && <Monitor className="h-3 w-3" />}<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live preview</>}
        </span>
      </div>
      <div
        ref={box}
        data-template={vars.template}
        data-mode={vars.mode}
        style={{ ...vars.style, height } as React.CSSProperties}
        className={`${siteFontVariables} ohp-site ohp-prev relative overflow-y-auto overscroll-contain`}
        onClickCapture={e => { if ((e.target as HTMLElement).closest('a,button')) e.preventDefault() }}
        onSubmitCapture={e => e.preventDefault()}
      >
        <style>{PREVIEW_FX_CSS}</style>
        <div className="ohp-zoom pointer-events-none" style={zoom < 1 ? ({ width: DESKTOP_W, zoom, '--z': zoom } as React.CSSProperties) : undefined}>
          {home ? (
            <>
              <SiteHeader theme={shownTheme} pages={[home]} siteName={name} preview hasDarkHero={hasDarkHero} hasReviews={hasReviews} agentProfile={profile} hasCommunities={areaCount > 0} />
              <SitePageRenderer
                page={{ ...home, blocks }}
                theme={shownTheme}
                siteId={s.id}
                editor={{ focusId, focusTag: note || FOCUS_TAGS[focus] || 'This part' }}
                afterCommunitiesContent={<ShowcaseCreatorCTA theme={shownTheme} basePrefix="" listings={((blocks.find(b => b.type === 'featured_listings')?.data as any)?.resolved || []).filter((l: any) => l?.photo)} agent={profile ? { name: profile.name, photo_url: profile.photo_url || null } : null} />}
              />
              <SiteFooter theme={shownTheme} siteName={name} signatureSlug={sigSlug} hasReviews={hasReviews} profile={profile} />
            </>
          ) : (
            <div className="flex items-center justify-center" style={{ height }}><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          )}
        </div>
        {pulse > 0 && <span key={pulse} aria-hidden className="ohp-mini-pulse pointer-events-none absolute inset-x-0 z-[70]" style={{ top: box.current?.scrollTop || 0, height }} />}
        <style>{`.ohp-mini-pulse{box-shadow:inset 0 0 0 3px #C9A24D,inset 0 0 50px rgba(201,162,77,.35);animation:ohpMiniPulse 1.1s ease both}@keyframes ohpMiniPulse{0%{opacity:0}20%{opacity:1}100%{opacity:0}}@media (prefers-reduced-motion:reduce){.ohp-mini-pulse{animation:none;opacity:0}}`}</style>
      </div>
    </div>
  )
}
