import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

// Collections (Showcases) are lead/visitor-specific curated portfolios, not general marketing
// content (see backend/app/services/website/content_adapters.get_showcases) - the honest
// integration is a link to the existing public showcase page (already has its own polished
// property-grid UI), not re-rendering showcase contents inside the website's own block system.
export default function ShowcaseBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  const shareToken = data.resolved?.share_token as string | undefined
  const name = data.resolved?.name as string | undefined
  if (!shareToken) return null

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <div className="rounded-3xl border-2 px-8 py-14 text-center" style={{ borderColor: `${theme.secondary_color}40`, backgroundColor: `${theme.secondary_color}0a` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>Curated For You</p>
        <h2 className={`mt-2 text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
          {data.headline || name || 'Curated Collection'}
        </h2>
        {data.subtext && <p className={`mx-auto mt-3 max-w-xl text-gray-600 ${fontClass(theme.body_font)}`}>{data.subtext}</p>}
        <a
          href={`${basePrefix}/showcase/${shareToken}`}
          target="_blank"
          rel="noreferrer"
          className="ohp-gold-sheen mt-8 inline-flex rounded-full px-8 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:-translate-y-0.5"
          style={{ backgroundColor: theme.primary_color }}
        >
          View Collection
        </a>
      </div>
    </section>
  )
}
