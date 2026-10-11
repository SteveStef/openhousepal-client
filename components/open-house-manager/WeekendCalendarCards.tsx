'use client'

import { formatTimeRangeCompact } from './formatters'

// A minimal structural subset of ScheduledOpen (and Discovery's own already-scheduled-opens
// shape, which has no agent/kit info) - either can be passed here without adapting field names.
export interface WeekendCalendarOpen {
  scheduled_date?: string | null
  scheduled_start_time?: string | null
  scheduled_end_time?: string | null
  hosting_agent_name?: string | null
  hosting_agent_photo_url?: string | null
  /** Who's hosting it (an OpenHousePal agent id, or "BRIGHT-MLS" for an open posted in Bright). */
  hosting_agent_id?: string | null
}

export interface WeekendCell {
  date: string
  dayLabel: string
  monthDay: string
  weekLabel: string
  isToday: boolean
}

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The next 4 open-house days, starting TODAY - every Saturday and Sunday, plus any weekday that
// actually has an open on it (e.g. a Thursday twilight open from Bright). Rolling: once a day
// passes it drops off the front and the next one fills in at the end, so today's open (even on a
// Sunday) is always the first thing you see. Open houses are overwhelmingly on weekends, so this
// stays a quick "is it covered" glance; the full list still lives in Manage Hosts / Insights.
export function getUpcomingWeekendCells(openDates: Iterable<string> = []): WeekendCell[] {
  const withOpen = new Set(openDates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = localIso(today)
  const cells: WeekendCell[] = []
  for (let k = 0; k < 28 && cells.length < 4; k++) {
    const d = new Date(today)
    d.setDate(today.getDate() + k)
    const iso = localIso(d)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !withOpen.has(iso)) continue
    cells.push({
      date: iso,
      dayLabel: DAY[dow],
      monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekLabel: k < 7 ? 'This week' : 'Coming up',
      isToday: iso === todayIso,
    })
  }
  return cells
}

const hostFirstName = (o: WeekendCalendarOpen) => {
  const n = (o.hosting_agent_name || '').trim()
  return n && n !== 'BRIGHT-MLS' ? n.split(' ')[0] : ''
}

// How many of the days shown are covered vs still need a host (Dash's "1 scheduled · 3 needed").
export function weekendSummary(opens: WeekendCalendarOpen[]): { scheduled: number; needed: number } {
  const dates = new Set(opens.map(o => o.scheduled_date).filter((d): d is string => !!d))
  const cells = getUpcomingWeekendCells(dates)
  const scheduled = cells.filter(c => dates.has(c.date)).length
  return { scheduled, needed: cells.length - scheduled }
}

// Same 4-cell weekend-calendar look everywhere it appears (Manager's property cards, Manage
// Hosts, Insights) - built once here so all three stay visually identical instead of drifting.
export default function WeekendCalendarCards({
  opens,
  onCellClick,
  size = 'md',
  filledClickable = true,
  emptyCellTitle = 'Click to start a direct request for this date',
  filledCellTitle = 'Click to view/edit host notes for this open',
  emptyCellLabel,
  viewerId,
  othersMuted = false,
  pendingDates,
  pendingLabel = 'Requested',
  pendingTitle,
}: {
  opens: WeekendCalendarOpen[]
  // Omit to render read-only (e.g. Insights). Passed the cell and its open (if any) - the caller
  // decides what a click means (prefill a request for an empty cell, warn about shared notes for
  // a filled one).
  onCellClick?: (cell: WeekendCell, open?: WeekendCalendarOpen) => void
  size?: 'sm' | 'md' | 'lg'
  // Discovery's read-only-once-taken use: an already-scheduled cell there isn't something the
  // viewer can act on (they can't request an already-booked slot), unlike Manager's own cards
  // where clicking a filled cell opens that listing's Host Notes - so only the empty cells there
  // should render as clickable buttons.
  filledClickable?: boolean
  emptyCellTitle?: string
  filledCellTitle?: string
  // Overrides the empty-cell text (default: "Host" at sm size, "Needs Host" otherwise). Per-caller
  // since the same empty cell means something different depending on context - e.g. Manager's own
  // listings read better as "Find Host" (an action the agent still needs to take) than the default.
  emptyCellLabel?: string
  // Discovery: an open the viewer is hosting reads "You're Hosting!" in green; anyone else's is
  // greyed out (taken, nothing to do). Manager leaves this off - every hosted day there is green.
  viewerId?: string | null
  othersMuted?: boolean
  // Dates with a hosting request still waiting on an answer (Dash: the ones you asked to host in
  // Discovery, or another agent's request on your own listing) - shown as "Requested" in blue
  // instead of an open "Host" slot, so the calendar never suggests asking twice.
  pendingDates?: string[]
  pendingLabel?: string
  pendingTitle?: string
}) {
  const cells = getUpcomingWeekendCells(opens.map(o => o.scheduled_date).filter((d): d is string => !!d))
  const dayTextSize = size === 'sm' ? 'text-[7px]' : size === 'lg' ? 'text-[9px]' : 'text-[8px]'
  const dateTextSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[12px]' : 'text-[10px]'
  // Steps to shrink to as the full time-range string gets longer ("1-3 PM" fits fine at the base
  // size, but "8:30 AM-1:30 PM" doesn't - never truncate/cut it off, shrink the font instead so
  // the entire range always reads in full).
  const timeTextSteps = size === 'sm' ? ['text-[7px]', 'text-[6.5px]', 'text-[6px]'] : size === 'lg' ? ['text-[9px]', 'text-[8px]', 'text-[7px]'] : ['text-[8px]', 'text-[7px]', 'text-[6.5px]']
  const nameTextSize = size === 'lg' ? 'text-[9px]' : 'text-[8px]'
  const needsHostTextSize = size === 'lg' ? 'text-[9px]' : 'text-[8px]'
  const cellPad = size === 'lg' ? 'gap-0.5 px-1 py-2.5' : size === 'sm' ? 'gap-1 px-1 py-2' : 'gap-0.5 px-1 py-2.5'
  // Fixed height regardless of filled/empty - without this, a listing with nothing scheduled had
  // visibly shorter, oddly-spaced cells next to one with a booked date (more rows of content), so
  // cards for different listings never lined up. Sized to the filled state (its 4 rows of content
  // are the tallest), so an empty cell just centers its 3 rows within the same box.
  const cellHeight = size === 'sm' ? 'h-[84px]' : size === 'lg' ? 'h-[104px]' : 'h-[96px]'

  return (
    <div className="grid grid-cols-4 gap-1">
      {cells.map(cell => {
        const cellOpens = opens.filter(o => o.scheduled_date === cell.date)
        const open = cellOpens[0]
        const timeStr = open ? formatTimeRangeCompact(open.scheduled_start_time, open.scheduled_end_time) : null
        const timeLen = timeStr?.length ?? 0
        const timeTextSize = timeLen > 13 ? timeTextSteps[2] : timeLen > 9 ? timeTextSteps[1] : timeTextSteps[0]
        const clickable = Boolean(onCellClick) && (!open || filledClickable)
        const Wrapper = clickable ? 'button' : 'div'
        const mine = !!open && othersMuted && !!viewerId && cellOpens.some(o => o.hosting_agent_id === viewerId)
        const muted = !!open && othersMuted && !mine
        const pending = !open && !!pendingDates?.includes(cell.date)
        return (
          <Wrapper
            key={cell.date}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? (e => { e.stopPropagation(); onCellClick!(cell, open) }) : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl border text-center transition ${cellPad} ${cellHeight} ${
              mine
                ? 'border-emerald-400 bg-emerald-100 shadow-[0_0_0_3px_rgba(16,185,129,.15)] dark:border-emerald-400/60 dark:bg-emerald-500/20'
                : muted
                ? 'border-emerald-200/70 bg-emerald-50/40 opacity-55 grayscale-[35%] dark:border-emerald-500/15 dark:bg-emerald-500/[0.04]'
                : open
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                : pending
                ? 'border-dashed border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10'
                : 'border-amber-100 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5'
            } ${clickable ? (open ? 'hover:border-emerald-300 dark:hover:border-emerald-500/40 cursor-pointer' : 'hover:border-amber-300 dark:hover:border-amber-500/40 cursor-pointer') : ''}`}
            title={pending ? (pendingTitle || 'Request sent - waiting on an answer') : clickable ? (open ? filledCellTitle : emptyCellTitle) : cell.weekLabel}
          >
            {/* Day of week on its own line, date below it - was one combined "SAT SEP 5" line,
                but the two are different kinds of information (which day vs which date) and
                reading them as two short lines is quicker than one longer one. */}
            <span className={`${dayTextSize} font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap`}>
              {cell.isToday ? 'Today' : cell.dayLabel}
            </span>
            <span className={`${dateTextSize} font-black text-gray-700 dark:text-gray-200 whitespace-nowrap`}>
              {cell.monthDay}
            </span>
            {open ? (
              <>
                {/* One line, not two, and the entire range always shown in full - never abbreviated
                    or clipped. The font size steps down as the string gets longer (see
                    timeTextSteps) instead of letting the pill's edge cut off the trailing AM/PM. */}
                <span className={`mt-0.5 whitespace-nowrap ${needsHostTextSize} font-black uppercase tracking-wide ${muted ? 'text-emerald-700/70 dark:text-emerald-300/60' : 'text-emerald-600 dark:text-emerald-400'}`}>{mine ? (size === 'sm' ? 'Yours' : 'You’re Hosting!') : cell.date < new Date().toISOString().slice(0, 10) ? 'Hosted' : 'Confirmed'}</span>
                {timeStr && (
                  <span className={`mt-0.5 max-w-full whitespace-nowrap rounded-full ${muted ? 'bg-emerald-500/50' : 'bg-emerald-500'} px-1.5 py-0.5 ${timeTextSize} font-bold text-white tabular-nums`}>
                    {timeStr}
                  </span>
                )}
                {/* Who's hosting - only for a real OpenHousePal agent (an open posted straight into
                    Bright has no host on file here, so "Hosted" + the time says it all). */}
                {size !== 'sm' && hostFirstName(open) && (
                  <span className="mt-0.5 flex max-w-full min-w-0 items-center justify-center gap-1">
                    {open.hosting_agent_photo_url && (
                      <img src={open.hosting_agent_photo_url} alt="" className="h-3 w-3 shrink-0 rounded-full object-cover" />
                    )}
                    <span className={`min-w-0 truncate ${nameTextSize} font-medium text-gray-500 dark:text-gray-400`}>
                      {hostFirstName(open)}
                    </span>
                  </span>
                )}
                {cellOpens.length > 1 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-black text-white">
                    +{cellOpens.length - 1}
                  </span>
                )}
              </>
            ) : pending ? (
              <span className={`mt-0.5 ${needsHostTextSize} font-black uppercase tracking-widest text-sky-600 dark:text-sky-300`}>{pendingLabel}</span>
            ) : (
              <span className={`mt-0.5 ${needsHostTextSize} font-black uppercase tracking-widest text-amber-600 dark:text-amber-400`}>{emptyCellLabel ?? (size === 'sm' ? 'Host' : 'Needs Host')}</span>
            )}
          </Wrapper>
        )
      })}
    </div>
  )
}
