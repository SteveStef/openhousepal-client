import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

interface Testimonial {
  id: string
  author: string
  rating: number
  body: string
  source?: string | null
  date?: string | null
}

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} viewBox="0 0 20 20" className="h-4 w-4" fill={n <= rating ? color : 'none'} stroke={n <= rating ? color : '#d1d5db'} strokeWidth="1.5">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}

export default function TestimonialsBlock({ data, theme }: { data: Record<string, any>; theme: SiteTheme }) {
  const items: Testimonial[] = data.resolved || []
  // Nothing published yet → hide the section rather than show an empty wall (same pattern as
  // Recent Sales). The agent still sees it in the editor with a placeholder.
  if (!items.length) return null

  const accent = theme.secondary_color || '#C9A24D'
  const rated = items.filter(t => t.rating > 0)
  const avg = rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : 0

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="text-center">
        <h2 className={`text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
          {data.headline || 'What Clients Say'}
        </h2>
        {avg > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Stars rating={Math.round(avg)} color={accent} />
            <span className="text-sm font-bold text-gray-500">{avg.toFixed(1)} · {items.length} review{items.length === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(t => (
          <figure key={t.id} className="ohp-card flex flex-col rounded-3xl bg-white p-6 shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04]">
            <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill={accent} aria-hidden="true">
              <path d="M9.5 4C6 5.5 4 9 4 13v7h7v-7H7c0-3 1.5-5 4-6L9.5 4zm10 0c-3.5 1.5-5.5 5-5.5 9v7h7v-7h-4c0-3 1.5-5 4-6L19.5 4z" />
            </svg>
            {t.rating > 0 && <div className="mt-3"><Stars rating={t.rating} color={accent} /></div>}
            <blockquote className={`mt-3 flex-1 text-sm leading-relaxed text-gray-600 ${fontClass(theme.body_font)}`}>“{t.body}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: theme.primary_color }}>
                {(t.author || '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className={`text-sm font-black text-gray-800 ${fontClass(theme.heading_font, 'font-serif')}`}>{t.author}</span>
              {t.source === 'google' && (
                <span className="ml-auto text-[10px] font-black uppercase tracking-wide text-gray-400">via Google</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
