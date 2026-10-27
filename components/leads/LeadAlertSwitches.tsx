'use client'

// One person's alert switches (owner, 10/27) - the same three on the "Mark as done" page (every
// follow-up) and in the lead's own Follow-ups section:
//   - their follow-ups on the calendar. Turning it off slides open the follow-up question: keep
//     them in OpenHousePal (Follow-ups page + Dash), or stop them completely.
//   - activity alert emails about them (Showcase likes + comments).
// Only this one person changes. Saves on every flip; a failed save flips back.
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BellOff, CalendarDays, Check, LayoutDashboard, Mail } from 'lucide-react'
import OhpSwitch from '@/components/ui/OhpSwitch'

export type LeadAlerts = { calendar: boolean; in_app: boolean; emails: boolean }

export default function LeadAlertSwitches({ firstName, alerts, onSave, className = '' }: {
  firstName: string
  alerts: LeadAlerts
  /** Save a change; resolve with the saved switches, or null when it failed. */
  onSave: (patch: Partial<LeadAlerts>) => Promise<LeadAlerts | null>
  className?: string
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState<LeadAlerts>(alerts)
  const [busy, setBusy] = useState<keyof LeadAlerts | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const name = firstName || 'them'

  const save = async (key: keyof LeadAlerts, patch: Partial<LeadAlerts>) => {
    const before = shown
    // Flip at once (calendar on brings the follow-ups back too - nothing on a calendar without them).
    setShown(s => ({ ...s, ...patch, ...(patch.calendar ? { in_app: true } : {}) }))
    setBusy(key)
    setError('')
    const r = await onSave(patch)
    setBusy(null)
    if (r) {
      setShown(r)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1600)
    } else {
      setShown(before)
      setError("That didn't save - check your connection and try again.")
    }
  }

  const row = 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-gray-50 active:scale-[0.99] dark:hover:bg-white/[0.04]'
  const tile = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#e8c97a] shadow-sm dark:bg-white/10'
  const choice = (on: boolean) => `flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12px] font-black transition active:scale-[0.97] ${
    on ? 'bg-[#111827] text-white shadow-sm dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Alerts for {name}</p>
        <AnimatePresence>
          {saved && (
            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600">
              <Check className="h-3 w-3" strokeWidth={3} /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1.5 space-y-1">
        {/* Calendar */}
        <button type="button" role="switch" aria-checked={shown.calendar} disabled={busy !== null}
          onClick={() => save('calendar', { calendar: !shown.calendar })} className={row} data-testid="lead-alert-calendar">
          <span className={tile}><CalendarDays className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-snug text-[#111827] dark:text-white">Put {name}&apos;s follow-ups on my calendar</span>
            <span className="block text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">
              {shown.calendar ? 'Each one shows up on your calendar with an alert.' : shown.in_app ? 'Off - they stay in OpenHousePal only.' : 'Off - and no new follow-ups for them.'}
            </span>
          </span>
          <OhpSwitch as="span" on={shown.calendar} busy={busy === 'calendar'} />
        </button>

        {/* Calendar off: keep them in OpenHousePal, or stop them completely? */}
        <AnimatePresence initial={false}>
          {!shown.calendar && (
            <motion.div key="keep" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden">
              <div className="mx-1 mb-1 mt-0.5 rounded-2xl border border-[#C9A24D]/30 bg-[#fbf7ee] p-3 dark:border-[#C9A24D]/20 dark:bg-[#1c1a14]">
                <p className="text-[13px] font-black leading-snug text-[#111827] dark:text-white">Still want {name}&apos;s follow-ups in OpenHousePal?</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-600 dark:text-gray-400">They&apos;d stay on your Follow-ups page and Dash - just not on your calendar.</p>
                <div className="mt-2.5 flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10" role="radiogroup" aria-label={`${name}'s follow-ups in OpenHousePal`}>
                  <button type="button" role="radio" aria-checked={shown.in_app} disabled={busy !== null}
                    onClick={() => { if (!shown.in_app) save('in_app', { in_app: true }) }} className={choice(shown.in_app)} data-testid="lead-alert-keep">
                    <LayoutDashboard className="h-3.5 w-3.5" /> Yes, keep them here
                  </button>
                  <button type="button" role="radio" aria-checked={!shown.in_app} disabled={busy !== null}
                    onClick={() => { if (shown.in_app) save('in_app', { in_app: false }) }} className={choice(!shown.in_app)} data-testid="lead-alert-stop">
                    <BellOff className="h-3.5 w-3.5" /> No, stop them
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emails */}
        <button type="button" role="switch" aria-checked={shown.emails} disabled={busy !== null}
          onClick={() => save('emails', { emails: !shown.emails })} className={row} data-testid="lead-alert-emails">
          <span className={tile}><Mail className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black leading-snug text-[#111827] dark:text-white">Email me when {name} likes or comments</span>
            <span className="block text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">
              {shown.emails ? 'Homes they like and comment on in their Showcase.' : "Off - you'll still see it in their activity."}
            </span>
          </span>
          <OhpSwitch as="span" on={shown.emails} busy={busy === 'emails'} />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[10.5px] font-semibold text-gray-400">Only for {name} - your other leads aren&apos;t affected.</p>
      {error && <p className="mt-1 px-1 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  )
}
