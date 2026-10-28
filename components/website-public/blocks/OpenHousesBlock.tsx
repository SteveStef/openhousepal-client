import { CalendarDays, Clock } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { IMG } from '@/lib/siteImage'
import SitePhoto from '../SitePhoto'
import { cleanStreet } from '../listingFormat'

interface OpenHouseCard {
  id: string
  listing_key?: string | null
  address: string | null
  city: string | null
  state: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  photo: string | null
  scheduled_date: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
}

// A YYYY-MM-DD day, read as that calendar day everywhere (no viewer time zone shifting it).
function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${m} ${period}`
}

// Upcoming open houses: the same card as the sold and town cards - price on the photo, "Street,
// Town", the facts - with the day on the photo and the hours below. A card opens the home's page
// (it was a dead card: "tap one to see the home" did nothing - 10/27).
export default function OpenHousesBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  const events: OpenHouseCard[] = data.resolved || []
  // No upcoming open houses is the common state between events, not a broken page.
  if (!events.length) return null
  const luxe = theme.template !== 'default'

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 className={`ohp-site-heading text-center text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
        {data.headline || 'Upcoming Open Houses'}
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map(event => {
          const statLine = [
            event.bedrooms != null ? `${event.bedrooms} bd` : null,
            event.bathrooms != null ? `${event.bathrooms} ba` : null,
            event.living_area != null ? `${Math.round(event.living_area).toLocaleString('en-US')} sqft` : null,
          ].filter(Boolean).join(' · ')
          const card = (
            <div className={`ohp-card group h-full overflow-hidden shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(17,24,39,0.16)] ${luxe ? 'rounded-3xl' : 'rounded-2xl'}`} style={{ backgroundColor: 'var(--site-surface)' }}>
              <div className="relative aspect-[16/11] w-full overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                <SitePhoto src={event.photo} widths={IMG.card} className="ohp-mls-crop absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                {event.scheduled_date && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                    <CalendarDays className="h-3 w-3" /> {formatDate(event.scheduled_date)}
                  </span>
                )}
                {event.price != null && event.price > 0 && <p className={`absolute bottom-3 left-4 text-[28px] font-black leading-none text-white [text-shadow:0_2px_14px_rgba(0,0,0,.6)] ${fontClass(theme.heading_font, 'font-serif')}`}>${Math.round(event.price).toLocaleString('en-US')}</p>}
              </div>
              <div className="px-5 py-4">
                <p className={`truncate text-[17px] font-bold ${fontClass(theme.body_font)}`} style={{ color: 'var(--site-heading)' }}>
                  {cleanStreet(event.address, event.city) || 'Address on request'}
                  {event.city && <span className="font-semibold" style={{ color: 'var(--site-muted)' }}>, {event.city}</span>}
                </p>
                {statLine && <p className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{statLine}</p>}
                {event.scheduled_start_time && (
                  <p className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs font-black" style={{ borderColor: 'var(--site-line)', color: 'var(--site-accent-text)' }}>
                    <Clock className="h-3.5 w-3.5" /> Open {formatTime(event.scheduled_start_time)}{event.scheduled_end_time ? ` - ${formatTime(event.scheduled_end_time)}` : ''}
                  </p>
                )}
              </div>
            </div>
          )
          return event.listing_key
            ? <a key={event.id} href={`${basePrefix}/properties/${encodeURIComponent(event.listing_key)}`} className="block">{card}</a>
            : <div key={event.id}>{card}</div>
        })}
      </div>
    </section>
  )
}
