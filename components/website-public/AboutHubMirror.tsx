'use client'

import { salesAreRecent, salesWords } from '@/lib/salesWording'
import { Calendar, DollarSign, Facebook, Globe, Home as HomeIcon, Instagram, Mail, MapPin, Music2, Phone, TrendingUp, Youtube, type LucideIcon } from 'lucide-react'
import { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'

interface HubForm { id: string; slug?: string | null; title: string; form_type: string }
interface HubItem { id?: string; title?: string; image?: string | null; link: string }
interface HubListing {
  listing_key: string
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  status?: string | null
  photo?: string | null
}
interface HubProfile {
  name?: string; title?: string; bio?: string; market?: string; brokerage?: string
  photo_url?: string; phone?: string; email?: string
  social_links?: { id: string; label: string; url: string }[]
  stats?: { active_listings?: number; sold_count?: number; sold_volume?: number }
}
export interface AboutHubData {
  profile: HubProfile
  videos: HubItem[]
  tours: HubItem[]
  recent_sales: HubListing[]
  listings: HubListing[]
  blog_posts: { slug: string; title: string; category?: string | null; cover_image_url?: string | null }[]
  // Same ids/order as the real Agent Hub editor's section list (sales/listings/videos/tours/
  // blogs) - see content_adapters.get_agent_hub_snapshot. Hidden sections already arrive as
  // empty arrays above; this only controls the ORDER the remaining ones render in.
  section_order?: string[]
  buying_form?: HubForm | null
  selling_form?: HubForm | null
  home_value_form?: HubForm | null
  showing_form?: HubForm | null
}

const DEFAULT_SECTION_ORDER = ['sales', 'listings', 'videos', 'tours', 'blogs']

const SOCIAL_ICONS: Record<string, LucideIcon> = { instagram: Instagram, facebook: Facebook, youtube: Youtube, tiktok: Music2, website: Globe }

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${value}`
}

function youtubeThumbnail(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : ''
}

function ListingCard({ listing, badge, theme, siteId, basePrefix }: { listing: HubListing; badge: string; theme: SiteTheme; siteId?: string; basePrefix: string }) {
  const statLine = [
    listing.bedrooms != null ? `${listing.bedrooms} bd` : null,
    listing.bathrooms != null ? `${listing.bathrooms} ba` : null,
    listing.living_area != null ? `${listing.living_area.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' · ')
  const card = (
    <div className="ohp-card group overflow-hidden rounded-3xl bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(17,24,39,0.16)]">
      <div className="relative aspect-[4/3] w-full bg-gray-100 bg-cover bg-center" style={{ backgroundImage: listing.photo ? `url(${listing.photo})` : undefined }}>
        <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm" style={{ backgroundColor: theme.primary_color }}>{badge}</span>
      </div>
      <div className="p-5">
        {listing.price != null && <p className={`text-xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>${listing.price.toLocaleString()}</p>}
        {listing.address && <p className={`mt-1 truncate text-sm font-bold text-gray-700 ${fontClass(theme.body_font)}`}>{listing.address}</p>}
        <p className="text-xs text-gray-400">{[listing.city, listing.state].filter(Boolean).join(', ')}</p>
        {statLine && <p className="mt-2 text-xs font-semibold text-gray-500">{statLine}</p>}
      </div>
    </div>
  )
  return siteId ? <a href={`${basePrefix}/properties/${encodeURIComponent(listing.listing_key)}`}>{card}</a> : <div>{card}</div>
}

function HubMediaTile({ item, theme }: { item: HubItem; theme: SiteTheme }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer" className="ohp-card group relative block overflow-hidden rounded-2xl bg-gray-900 shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${youtubeThumbnail(item.link)})` }} />
        <div className="pointer-events-none absolute inset-0 bg-black/20" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-110">
            <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent" style={{ borderLeftColor: theme.primary_color }} />
          </span>
        </span>
      </div>
      {item.title && <p className="truncate p-3 text-xs font-bold text-white">{item.title}</p>}
    </a>
  )
}

// The site's About page mirrors the agent's real Agent Hub (openhousepal.com/{slug}) instead of a
// separate hand-written bio block, so an agent's own site can work as their link-tree too - real
// data only (content_adapters.get_agent_hub_snapshot), restyled to this site's own theme instead
// of OpenHousePal's fixed branding. Deliberately not a pixel copy of the real Agent Hub page's
// auto-scroll carousels/mobile layout - same content, presented the way every other section of
// this site already is (grid shelves, matching card patterns).
export default function AboutHubMirror({ data, theme, siteId, basePrefix = '' }: { data: AboutHubData; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const p = data.profile || {}
  const stats = p.stats || {}
  const salesRecent = salesAreRecent(stats.sold_volume ?? data.recent_sales.reduce((t, l: any) => t + (l.price || l.close_price || 0), 0))
  const statItems = [
    stats.active_listings ? { label: stats.active_listings === 1 ? 'Active Listing' : 'Active Listings', value: String(stats.active_listings) } : null,
    stats.sold_count ? { label: salesRecent ? (stats.sold_count === 1 ? 'Recent Sale' : 'Recent Sales') : (stats.sold_count === 1 ? 'Home Sold' : 'Homes Sold'), value: String(stats.sold_count) } : null,
    stats.sold_volume ? { label: 'Sales Volume', value: formatVolume(stats.sold_volume) } : null,
  ].filter(Boolean) as { label: string; value: string }[]
  const socialLinks = (p.social_links || []).filter(l => l.url?.trim())

  const quickActions = [
    data.buying_form && { form: data.buying_form, icon: HomeIcon, label: data.buying_form.title || "I'm Buying" },
    data.selling_form && { form: data.selling_form, icon: TrendingUp, label: data.selling_form.title || "I'm Selling" },
  ].filter(Boolean) as { form: HubForm; icon: LucideIcon; label: string }[]
  const formHref = (form: HubForm) => `${basePrefix}/forms/${encodeURIComponent(form.slug || form.id)}?site_chrome=1`

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      {/* Profile card - same visual language as AboutAgentBlock, just with contact/social/quick
          actions layered in since this page now stands in for the full Agent Hub. */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_30px_rgba(17,24,39,0.06)] ring-1 ring-black/[0.04]">
        <div className="flex flex-col items-center gap-10 p-8 sm:flex-row sm:items-start sm:p-12">
          {p.photo_url && (
            <div className="relative shrink-0">
              <img src={p.photo_url} alt={p.name || ''} className="h-40 w-40 rounded-2xl object-cover shadow-lg ring-4 ring-white" />
              <span className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full ring-4 ring-white" style={{ backgroundColor: theme.secondary_color }} />
            </div>
          )}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>Meet Your Agent</p>
            {p.name && <h1 className={`mt-2 text-3xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>{p.name}</h1>}
            {(p.title || p.brokerage) && <p className="mt-1 text-sm font-bold uppercase tracking-wide text-gray-400">{[p.title, p.brokerage].filter(Boolean).join(' · ')}</p>}
            {p.market && <p className="mt-0.5 flex items-center justify-center gap-1 text-sm text-gray-400 sm:justify-start"><MapPin className="h-3.5 w-3.5" />{p.market}</p>}
            {p.bio && <p className={`mt-5 leading-relaxed text-gray-600 ${fontClass(theme.body_font)}`}>{p.bio}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {p.phone && (
                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide text-white" style={{ backgroundColor: theme.primary_color }}>
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-wide" style={{ borderColor: 'var(--site-heading)', color: 'var(--site-heading)' }}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
              )}
              {socialLinks.map(link => {
                const Icon = SOCIAL_ICONS[link.id] || Globe
                return (
                  <a key={link.id} href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noreferrer" aria-label={link.label} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-gray-300">
                    <Icon className="h-4 w-4" />
                  </a>
                )
              })}
            </div>

            {(quickActions.length > 0 || data.home_value_form || data.showing_form) && (
              <div className="mt-6 max-w-md">
                {quickActions.length > 0 && (
                  <div className={`grid gap-2 ${quickActions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {quickActions.map(({ form, icon: Icon, label }) => (
                      <a key={form.id} href={formHref(form)} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-xs font-black uppercase tracking-wide text-[#111827] shadow-sm transition hover:-translate-y-0.5">
                        <Icon className="h-4 w-4 shrink-0" /> {label}
                      </a>
                    ))}
                  </div>
                )}
                {data.home_value_form && (
                  <a href={formHref(data.home_value_form)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wide transition hover:-translate-y-0.5" style={{ borderColor: `${theme.secondary_color}60`, backgroundColor: `${theme.secondary_color}15`, color: theme.primary_color }}>
                    <DollarSign className="h-4 w-4 shrink-0" /> {data.home_value_form.title || "What's My Home Worth?"}
                  </a>
                )}
                {data.showing_form && (
                  <a href={formHref(data.showing_form)} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:-translate-y-0.5" style={{ backgroundColor: theme.primary_color }}>
                    <Calendar className="h-4 w-4 shrink-0" /> {data.showing_form.title || 'Schedule a Showing'}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {statItems.length > 0 && (
          <div className="grid border-t border-gray-100" style={{ gridTemplateColumns: `repeat(${statItems.length}, minmax(0, 1fr))` }}>
            {statItems.map(stat => (
              <div key={stat.label} className="px-4 py-6 text-center" style={{ backgroundColor: `${theme.primary_color}05` }}>
                <p className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>{stat.value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(() => {
        const sections: Record<string, React.ReactNode> = {
          listings: data.listings.length > 0 && (
            <section key="listings" className="mt-16">
              <h2 className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>My Listings</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data.listings.map(l => <ListingCard key={l.listing_key} listing={l} badge="For Sale" theme={theme} siteId={siteId} basePrefix={basePrefix} />)}
              </div>
            </section>
          ),
          sales: data.recent_sales.length > 0 && (
            <section key="sales" className="mt-16">
              <h2 className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>{salesWords('Recent Sales', salesRecent)}</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data.recent_sales.map(l => <ListingCard key={l.listing_key} listing={l} badge="Sold" theme={theme} siteId={undefined} basePrefix={basePrefix} />)}
              </div>
            </section>
          ),
          videos: data.videos.length > 0 && (
            <section key="videos" className="mt-16">
              <h2 className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>Videos</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data.videos.map(v => <HubMediaTile key={v.id || v.link} item={v} theme={theme} />)}
              </div>
            </section>
          ),
          tours: data.tours.length > 0 && (
            <section key="tours" className="mt-16">
              <h2 className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>House Tours</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data.tours.map(t => <HubMediaTile key={t.id || t.link} item={t} theme={theme} />)}
              </div>
            </section>
          ),
          blogs: data.blog_posts.length > 0 && (
            <section key="blogs" className="mt-16">
              <h2 className={`text-2xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>Latest Articles</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {data.blog_posts.map(post => (
                  <a key={post.slug} href={`${basePrefix}/blog/${post.slug}`} className="ohp-card group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="aspect-video w-full bg-gray-100 bg-cover bg-center" style={{ backgroundImage: post.cover_image_url ? `url(${post.cover_image_url})` : undefined }} />
                    <div className="p-4">
                      {post.category && <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: theme.secondary_color }}>{post.category}</p>}
                      <h3 className="mt-1 line-clamp-2 text-sm font-black text-[#111827]">{post.title}</h3>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ),
        }
        return (data.section_order || DEFAULT_SECTION_ORDER).map(id => sections[id] || null)
      })()}
    </main>
  )
}
