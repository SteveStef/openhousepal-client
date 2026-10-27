import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { IMG } from '@/lib/siteImage'
import { cleanStreet, statusBadgeColor } from '../listingFormat'
import SitePhoto from '../SitePhoto'
import { salesAreRecent } from '@/lib/salesWording'

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

  // All the agent's sales (their Agent Hub list - the same numbers as the About strip and the
  // hub), sent with the block; the shown cards' own sum only for an older payload without them.
  const soldCount: number = data.sold_count || sales.length
  const totalVolume: number = data.sold_volume || sales.reduce((sum, s) => sum + (s.price || 0), 0)

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="text-center">
        <h2 className={`text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
          {data.headline || 'Recently Sold'}
        </h2>
        {/* Hidden when the agent turned off "Show my sold stats" (setup Sales step). */}
        {data.show_stats !== false && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
            <span className="font-bold text-gray-500">{soldCount} {salesAreRecent(totalVolume) ? (soldCount === 1 ? 'Recent Sale' : 'Recent Sales') : (soldCount === 1 ? 'Home Sold' : 'Homes Sold')}</span>
            {totalVolume > 0 && <span className="font-bold text-gray-500">{formatVolume(totalVolume)} in Volume</span>}
          </div>
        )}
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sales.map(sale => {
          const statLine = [
            sale.bedrooms != null ? `${sale.bedrooms} bd` : null,
            sale.bathrooms != null ? `${sale.bathrooms} ba` : null,
            sale.living_area != null ? `${sale.living_area.toLocaleString()} sqft` : null,
          ].filter(Boolean).join(' · ')
          // Price on the photo (shadowed so it reads on any photo), then "street, Town" on one line -
          // the town the same size in a softer colour, no state / ZIP - and the facts below (user, 10/27).
          const card = (
            <div className="ohp-card group overflow-hidden rounded-3xl shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(17,24,39,0.16)]" style={{ backgroundColor: 'var(--site-surface)' }}>
              <div className="relative aspect-[16/11] w-full overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                <SitePhoto src={(sale as any).photo} widths={IMG.card} className="ohp-mls-crop absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                {/* Sold is red everywhere (listingFormat.statusBadgeColor) - it was the theme's dark color */}
                <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: statusBadgeColor('CLOSED').bg, color: statusBadgeColor('CLOSED').fg }}>Sold</span>
                {sale.price != null && <p className={`absolute bottom-3 left-4 text-[28px] font-black leading-none text-white [text-shadow:0_2px_14px_rgba(0,0,0,.6)] ${fontClass(theme.heading_font, 'font-serif')}`}>${sale.price.toLocaleString()}</p>}
              </div>
              <div className="px-5 py-4">
                <p className={`truncate text-[17px] font-bold ${fontClass(theme.body_font)}`} style={{ color: 'var(--site-heading)' }}>
                  {cleanStreet(sale.address, sale.city) || 'Address on request'}
                  {sale.city && <span className="font-semibold" style={{ color: 'var(--site-muted)' }}>, {sale.city}</span>}
                </p>
                {statLine && <p className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{statLine}</p>}
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
