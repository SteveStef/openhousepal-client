import { SiteTheme } from '../types'
import { fontClass } from './fontClass'

interface SaleCard {
  id: string
  listing_key?: string | null
  address: string | null
  city: string | null
  state: string | null
  price: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  sold_date?: string | null
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${value}`
}

export default function RecentSalesBlock({ data, theme, siteId, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const sales: SaleCard[] = data.resolved || []
  // No reliable local sold-property data yet is common (Bright sync may not have closed
  // listings matched to this agent) - hide the section rather than show an empty grid.
  if (!sales.length) return null

  // Derived directly from the same real rows being rendered below - never a separately fetched
  // or fabricated summary figure.
  const totalVolume = sales.reduce((sum, s) => sum + (s.price || 0), 0)

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="text-center">
        <h2 className={`text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
          {data.headline || 'Recently Sold'}
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
          <span className="font-bold text-gray-500">{sales.length} {sales.length === 1 ? 'Home' : 'Homes'} Sold</span>
          {totalVolume > 0 && <span className="font-bold text-gray-500">{formatVolume(totalVolume)} in Volume</span>}
        </div>
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {sales.map(sale => {
          const statLine = [
            sale.bedrooms != null ? `${sale.bedrooms} bd` : null,
            sale.bathrooms != null ? `${sale.bathrooms} ba` : null,
            sale.living_area != null ? `${sale.living_area.toLocaleString()} sqft` : null,
          ].filter(Boolean).join(' · ')
          const card = (
            <div className="ohp-card group overflow-hidden rounded-3xl bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(17,24,39,0.16)]">
              <div className="relative aspect-[4/3] w-full bg-gray-100 bg-cover bg-center" style={{ backgroundImage: (sale as any).photo ? `url(${(sale as any).photo})` : undefined }}>
                <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm" style={{ backgroundColor: theme.primary_color }}>Sold</span>
              </div>
              <div className="p-5">
                {sale.price != null && <p className={`text-xl font-black ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>${sale.price.toLocaleString()}</p>}
                <p className={`mt-1 truncate text-sm font-bold text-gray-700 ${fontClass(theme.body_font)}`}>{sale.address}</p>
                <p className="text-xs text-gray-400">{[sale.city, sale.state].filter(Boolean).join(', ')}</p>
                {statLine && <p className="mt-2 text-xs font-semibold text-gray-500">{statLine}</p>}
              </div>
            </div>
          )
          return sale.listing_key && siteId ? (
            <a key={sale.id} href={`${basePrefix}/properties/${encodeURIComponent(sale.listing_key)}`}>{card}</a>
          ) : <div key={sale.id}>{card}</div>
        })}
      </div>
    </section>
  )
}
