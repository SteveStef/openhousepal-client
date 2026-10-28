import { ArrowRight, Newspaper } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import BlogCoverArt from '@/components/BlogCoverArt'
import ClassicSectionHead from './ClassicSectionHead'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg } from '@/lib/siteImage'

interface BlogCard {
  id: string
  slug: string
  title: string
  subtitle: string | null
  cover_image_url: string | null
  category: string | null
  published_at?: string | null
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

// Homepage "Latest Articles": the same section header as Featured Listings / Neighborhoods, the
// newest article as a large lead story and the rest beside it. Articles without a photo get a
// designed cover in the site's colors (never an empty grey box).
export default function BlogPostsBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  const posts: BlogCard[] = data.resolved || []
  // No published posts yet - hide, don't show an empty "Latest Articles" shell.
  if (!posts.length) return null
  const serif = fontClass(theme.heading_font, 'font-serif')
  const gold = theme.secondary_color
  const cover = (post: BlogCard) => (
    post.cover_image_url ? (
      <SitePhoto src={resolveMediaUrl(post.cover_image_url)} widths={IMG.card} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-105 object-cover" />
    ) : (
      <BlogCoverArt category={post.category} title={post.title} tone="site" />
    )
  )
  const [lead, ...rest] = posts

  if (theme.template === 'default') {
    const shown = posts.slice(0, 4)
    return (
      <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
        <div className="mx-auto max-w-7xl">
          <ClassicSectionHead font={theme.heading_font} eyebrow="Journal" title={data.headline || 'Latest Articles'} sub="Market updates, neighborhood guides and honest local advice." href={`${basePrefix}/blog`} linkLabel="All articles" />
          <div className={`mt-10 grid gap-6 sm:grid-cols-2 ${shown.length >= 4 ? 'lg:grid-cols-4' : shown.length === 3 ? 'lg:grid-cols-3' : ''}`}>
            {shown.map(post => (
              <a key={post.id} href={`${basePrefix}/blog/${post.slug}`} className="ohp-card group flex flex-col overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
                <div className="relative aspect-[16/10] overflow-hidden">{cover(post)}</div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--site-accent-text)' }}>
                    {post.category || 'Article'}{post.published_at && <span className="font-semibold normal-case tracking-normal" style={{ color: 'var(--site-faint)' }}>· {fmtDate(post.published_at)}</span>}
                  </p>
                  <p className="mt-2 line-clamp-3 text-lg font-extrabold leading-snug tracking-tight" style={{ color: 'var(--site-heading)' }}>{post.title}</p>
                  {post.subtitle && <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'var(--site-muted)' }}>{post.subtitle}</p>}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold" style={{ color: 'var(--site-heading)' }}>Read <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--site-accent)' }} /></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary_color }}>
              <Newspaper className="h-4 w-4" style={{ color: gold }} />
            </span>
            <span className="h-px w-6" style={{ backgroundColor: gold }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-text)' }}>Journal</span>
          </div>
          <h2 className={`mt-3 text-4xl font-black leading-[1.1] sm:text-5xl ${serif}`} style={{ color: 'var(--site-heading)' }}>
            {data.headline || 'Latest Articles'}
          </h2>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">Market updates, neighborhood guides and honest local advice.</p>
        </div>
        <a href={`${basePrefix}/blog`} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5" style={{ backgroundColor: theme.primary_color }}>
          All Articles <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className={`mt-12 grid gap-6 ${rest.length ? 'lg:grid-cols-[1.35fr_1fr]' : ''}`}>
        <a href={`${basePrefix}/blog/${lead.slug}`} className="group relative block min-h-[380px] overflow-hidden rounded-[28px] shadow-[0_40px_80px_-50px_rgba(0,0,0,.7)]">
          <div className="absolute inset-0">{cover(lead)}</div>
          {lead.cover_image_url && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />}
          <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
            {lead.category && <span className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: gold, color: theme.primary_color }}>{lead.category}</span>}
            <p className={`mt-3 max-w-xl text-3xl font-black leading-tight text-white ${serif}`}>{lead.title}</p>
            {lead.subtitle && <p className="mt-2 line-clamp-2 max-w-lg text-sm text-white/75">{lead.subtitle}</p>}
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest" style={{ color: gold }}>
              Read the story <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </a>

        {rest.length > 0 && (
          <div className="grid content-start gap-4">
            {rest.slice(0, 3).map(post => (
              <a key={post.id} href={`${basePrefix}/blog/${post.slug}`} className="group flex items-center gap-4 overflow-hidden rounded-[22px] bg-white p-3 shadow-[0_2px_24px_rgba(17,24,39,0.07)] ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(17,24,39,0.14)]">
                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl">{cover(post)}</div>
                <div className="min-w-0">
                  {post.category && <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent-text)' }}>{post.category}</p>}
                  <p className={`mt-0.5 line-clamp-2 text-lg font-black leading-snug text-gray-900 ${serif}`}>{post.title}</p>
                  {post.published_at && <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{fmtDate(post.published_at)}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
