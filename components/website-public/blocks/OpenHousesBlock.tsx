import { Clock } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { sizedBg } from '@/lib/siteImage'

interface OpenHouseCard {
  id: string
  address: string | null
  city: string | null
  state: string | null
  photo: string | null
  scheduled_date: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${m} ${period}`
}

export default function OpenHousesBlock({ data, theme }: { data: Record<string, any>; theme: SiteTheme }) {
  const events: OpenHouseCard[] = data.resolved || []
  // No upcoming open houses is the common state between events, not a broken page.
  if (!events.length) return null

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <h2 className={`text-center text-3xl font-black sm:text-4xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>
        {data.headline || 'Upcoming Open Houses'}
      </h2>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {events.map(event => (
          <div key={event.id} className="ohp-card overflow-hidden rounded-3xl bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04]">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <div className="ohp-mls-crop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(event.photo, 640) }} />
              {event.scheduled_date && (
                <span
                  className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm"
                  style={{ backgroundColor: theme.primary_color }}
                >
                  {formatDate(event.scheduled_date)}
                </span>
              )}
            </div>
            <div className="p-5">
              <p className={`truncate text-sm font-bold text-gray-700 ${fontClass(theme.body_font)}`}>{event.address}</p>
              <p className="text-xs text-gray-400">{[event.city, event.state].filter(Boolean).join(', ')}</p>
              {event.scheduled_start_time && (
                <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-4 text-xs font-semibold" style={{ color: theme.secondary_color }}>
                  <Clock className="h-3.5 w-3.5" /> {formatTime(event.scheduled_start_time)}{event.scheduled_end_time ? ` - ${formatTime(event.scheduled_end_time)}` : ''}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
