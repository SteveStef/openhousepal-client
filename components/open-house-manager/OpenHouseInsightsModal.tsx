'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, BellRing, Calendar, CalendarCheck, Clock, Loader2, User, Users, UserX } from 'lucide-react'
import api from '@/lib/api-service'
import { ListingDetail, ScheduledOpen } from '@/types'
import EmptyState from './EmptyState'
import GuestDetailsToggle from './GuestDetailsToggle'
import WeekendCalendarCards from './WeekendCalendarCards'
import OhSheet, { FourPager, Unfold } from './OhSheet'
import { formatEventDate, formatTime, formatDuration } from './formatters'

// Insights for one of your listings: the numbers first, then what's coming up and what already
// happened - four at a time with a switcher, each past open unfolding on its own (user, 10/22: two
// opens from one reusable kit share an id, so opening one used to open both). A sheet on phones.

export default function OpenHouseInsightsModal({
  listingKey,
  onClose,
}: {
  listingKey: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!listingKey) return
    let alive = true
    setIsLoading(true)
    setLoadError('')
    api.openHouseManager.getListingDetail(listingKey).then(({ success, data, error }) => {
      if (!alive) return
      if (success && data) setDetail(data)
      else setLoadError(error || 'Unable to load insights for this listing right now.')
      setIsLoading(false)
    })
    return () => { alive = false }
  }, [listingKey])

  const allOpens: ScheduledOpen[] = detail ? [...detail.scheduled_opens, ...detail.confirmed_pending_kit] : []
  // A reusable kit whose own date got cleared back to "evergreen" (see cancel_approved_open) isn't
  // scheduled for anything specific, so it doesn't belong in a list of upcoming dates.
  const datedOpens = allOpens.filter(o => o.scheduled_date).sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
  // Most recent first - the open you're most likely checking on is the last one.
  const history = useMemo(() => [...(detail?.history || [])].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))), [detail])
  const m = detail?.key_metrics

  return (
    <OhSheet open={!!listingKey} onClose={onClose} title="Open House Insights" subtitle={detail?.address || 'Loading…'} image={detail?.image ?? null} width="max-w-2xl">
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : loadError ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load insights" description={loadError} />
      ) : detail && m ? (
        <div className="space-y-7">
          {/* the numbers */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {([
              { icon: CalendarCheck, label: 'Opens hosted', value: m.total_opens_hosted, tone: 'from-emerald-50 text-emerald-600 dark:from-emerald-500/10 dark:text-emerald-300' },
              { icon: Users, label: 'Guests', value: m.total_guests, tone: 'from-sky-50 text-sky-600 dark:from-sky-500/10 dark:text-sky-300' },
              { icon: UserX, label: 'No agent yet', value: m.unrepresented_guests, tone: 'from-rose-50 text-rose-600 dark:from-rose-500/10 dark:text-rose-300' },
              { icon: BellRing, label: 'Want similar homes', value: m.requested_updates ?? 0, tone: 'from-[#fbf3df] text-[#8b7355] dark:from-[#C9A24D]/10 dark:text-[#e8c97a]' },
            ] as const).map((t, i) => (
              <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
                className={`rounded-2xl bg-gradient-to-br to-white p-3.5 ring-1 ring-black/[0.05] dark:to-transparent dark:ring-white/[0.07] ${t.tone}`}>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider opacity-90"><t.icon className="h-3.5 w-3.5" />{t.label}</p>
                <p className="mt-1 font-serif text-3xl font-black leading-none text-[#111827] tabular-nums dark:text-white">{t.value}</p>
              </motion.div>
            ))}
          </div>
          {m.total_guests > 0 && (
            <p className="-mt-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
              About <b className="text-[#111827] dark:text-white">{Math.round((m.total_guests / Math.max(1, m.total_opens_hosted)) * 10) / 10}</b> guests per open
              {m.total_guests > 0 && <> · <b className="text-[#111827] dark:text-white">{Math.round((m.unrepresented_guests / m.total_guests) * 100)}%</b> had no agent</>}
            </p>
          )}

          {/* coming up */}
          <section>
            <SectionHead icon={Calendar} title="Coming up" count={datedOpens.length} />
            <WeekendCalendarCards opens={allOpens} />
            <div className="mt-3">
              <FourPager resetKey={listingKey} items={datedOpens}
                empty={<EmptyState compact icon={CalendarCheck} title="No opens scheduled" description="Once a host is confirmed for a date, it shows up here." />}
                render={open => {
                  const start = formatTime(open.scheduled_start_time), end = formatTime(open.scheduled_end_time)
                  return (
                    <div className="flex items-center gap-3 rounded-2xl border border-[#C9A24D]/25 bg-white p-3 dark:bg-[#141416]">
                      <DateTile date={open.scheduled_date} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{formatEventDate(open.scheduled_date)}</p>
                        <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{open.hosting_agent_id === 'BRIGHT-MLS' ? 'Posted in Bright MLS' : `Hosted by ${open.hosting_agent_name}`}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {start && end && <span className="text-xs font-black text-[#111827] dark:text-white">{start} - {end}</span>}
                        {!open.kit_built && open.hosting_agent_id !== 'BRIGHT-MLS' && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">Kit not built</span>}
                      </div>
                    </div>
                  )
                }} />
            </div>
          </section>

          {/* what happened */}
          <section>
            <SectionHead icon={Clock} title="Past opens" count={history.length} />
            <FourPager resetKey={listingKey} items={history}
              empty={<EmptyState compact icon={Users} title="No finished opens yet" description="When an open house here wraps up, its guests and results show up here." />}
              render={row => {
                const duration = formatDuration(row.start_time, row.end_time)
                return (
                  <Unfold head={() => (
                    <div className="flex items-center gap-3">
                      <DateTile date={row.event_date} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{formatEventDate(row.event_date)}</p>
                        <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{row.hosting_agent_name}</p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <Chip>{row.total_guests} guest{row.total_guests === 1 ? '' : 's'}</Chip>
                        {row.unrepresented_guests > 0 && <Chip tone="rose">{row.unrepresented_guests} no agent</Chip>}
                      </div>
                    </div>
                  )}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Fact label="Host" value={row.hosting_agent_name} sub={row.hosting_agent_brokerage || undefined} />
                      <Fact label="How long" value={duration || 'Not recorded'} sub={row.start_time && row.end_time ? `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` : undefined} />
                      <Fact label="Guests" value={String(row.total_guests)} />
                      <Fact label="No agent yet" value={String(row.unrepresented_guests)} sub={row.requested_updates ? `${row.requested_updates} want similar homes` : undefined} />
                    </div>
                    <div className="mt-3">
                      {row.share_guests_enabled ? (
                        <GuestDetailsToggle eventId={row.id} windowDate={row.event_date} />
                      ) : (
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400"><User className="h-3 w-3" /> Guest names are private unless {row.hosting_agent_name} chooses to share them.</p>
                      )}
                    </div>
                  </Unfold>
                )
              }} />
          </section>
        </div>
      ) : null}
    </OhSheet>
  )
}

function SectionHead({ icon: Icon, title, count }: { icon: React.ComponentType<{ className?: string }>; title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#C9A24D]" />
      <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-[#111827] dark:text-white">{title}</h3>
      <span className="rounded-full bg-[#C9A24D]/12 px-2 py-0.5 text-[10px] font-black text-[#8b7355] tabular-nums dark:text-[#e8c97a]">{count}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/30 to-transparent" />
    </div>
  )
}

export function DateTile({ date }: { date?: string | null }) {
  const d = date ? new Date(`${date}T00:00:00`) : null
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#fbf3df] to-white text-center ring-1 ring-[#C9A24D]/25 dark:from-[#C9A24D]/15 dark:to-transparent">
      <span className="leading-none">
        <span className="block text-[9px] font-black uppercase text-[#8b7355] dark:text-[#e8c97a]">{d ? d.toLocaleDateString('en-US', { month: 'short' }) : '—'}</span>
        <span className="block text-lg font-black text-[#111827] dark:text-white">{d ? d.getDate() : ''}</span>
      </span>
    </span>
  )
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'rose' }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone === 'rose' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>{children}</span>
}

export function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black text-[#111827] dark:text-white">{value}</p>
      {sub && <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}
