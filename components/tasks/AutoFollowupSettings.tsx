'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Bell, BellOff, UserPlus, BellRing, CalendarClock, CheckCircle2, ChevronDown, ClipboardList, Clock, Home, KeyRound, Loader2, Lock, MessageSquareText, Siren, Sparkles, Sun, Zap } from 'lucide-react'
import MessageTemplateEditor from './MessageTemplateEditor'
import CalendarAlertPreview from './CalendarAlertPreview'
import api from '@/lib/api-service'
import type { AutoFollowupRule, FollowupAlerts, FollowupSettings, FollowupStyle, FollowupWhen } from '@/types'
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus'
import { LuxeSectionHeader } from '@/components/ui/LuxeSurface'

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
const SPRING = { type: 'spring', stiffness: 500, damping: 34 } as const

/** Two-option pill switch (Same day | Next day, Phone alert | All-day) - the dark pill slides
 * between options instead of jumping. The pill's spot is measured inside this control and moved
 * with x/width only - a shared-layout (layoutId) pill re-animated whenever anything else on the
 * page moved (a row above growing, a spinner appearing), which read as a glitch. */
function Segmented<T extends string>({ value, options, onChange, disabled, iconsFromSm }: {
  value: T
  options: { id: T; label: string; icon?: typeof Clock }[]
  onChange: (v: T) => void
  disabled?: boolean
  /** Phones: labels only, tighter - so a situation's two switches fit on one line. */
  iconsFromSm?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const btns = useRef<Partial<Record<T, HTMLButtonElement | null>>>({})
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = btns.current[value]
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    // Fonts finishing loading can change the labels' widths after the first paint.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && wrap.current) ro.observe(wrap.current)
    return () => ro?.disconnect()
  }, [value])
  return (
    <div ref={wrap} className={`relative inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5 transition-opacity dark:border-gray-700 dark:bg-white/5 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      {pill && (
        <motion.span
          aria-hidden
          initial={false}
          animate={{ x: pill.x, width: pill.w }}
          transition={SPRING}
          className="absolute bottom-0.5 left-0 top-0.5 rounded-full bg-[#111827] shadow-sm dark:bg-white"
        />
      )}
      {options.map(o => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            ref={el => { btns.current[o.id] = el }}
            type="button"
            onClick={() => { if (!active) onChange(o.id) }}
            className={`relative inline-flex items-center gap-1 whitespace-nowrap rounded-full py-1 text-[10px] font-black uppercase tracking-wide transition-colors duration-200 active:opacity-70 ${iconsFromSm ? 'px-2 sm:px-2.5' : 'px-2.5'} ${
              active ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <span className="relative inline-flex items-center gap-1">
              {o.icon && (
                <motion.span key={active ? 'on' : 'off'} initial={active ? { rotate: -30, scale: 0.6 } : false} animate={{ rotate: 0, scale: 1 }} transition={SPRING} className={iconsFromSm ? 'hidden sm:inline-flex' : 'inline-flex'}>
                  <o.icon className="h-3 w-3" />
                </motion.span>
              )}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** On/off switch with a springy knob. The knob slides a fixed 16px - NOT a `layout` animation,
 * which also animated every knob whenever a row above changed height (all the switches jiggled
 * when one was flipped). */
function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors duration-300 ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <motion.span initial={false} animate={{ x: on ? 16 : 0 }} transition={SPRING} className="h-4 w-4 rounded-full bg-white shadow" />
    </span>
  )
}

/** A fixed alert this situation also sends in the background - shown read-only. */
function BackgroundAlert({ alert }: { alert: NonNullable<AutoFollowupRule['background_alert']> }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-[13px] font-black text-[#111827] dark:text-white">{alert.label}</p>
        <span className="rounded-full bg-gray-200/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">Automatic · not editable</span>
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{alert.description}</p>
      <div className="mt-2.5 whitespace-pre-wrap rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] leading-relaxed text-gray-700 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] dark:text-gray-300">
        {alert.sample}
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Shows on your calendar alert and your Follow-ups list - it&apos;s for you, not the guest. Uses this situation&apos;s on/off, day and alert settings.</p>
    </div>
  )
}

const GROUP_ICON: Record<string, typeof Clock> = { open_house: Home, forms: ClipboardList, other: Sparkles }

/** A section's open/closed state, remembered in this browser (closed by default - the page opens
 * as a calm list of headings with a one-line summary each). */
function useSectionOpen(key: string, initial = false): [boolean, () => void] {
  const storageKey = `ohp:followupSection:${key}`
  // Read on first render (this panel only renders client-side, after its settings load), so a
  // section left open doesn't visibly re-open after the page appears.
  const [open, setOpen] = useState(() => {
    try {
      const v = window.localStorage.getItem(storageKey)
      return v == null ? initial : v === '1'
    } catch { return initial }
  })
  const toggle = () => setOpen(o => {
    try { window.localStorage.setItem(storageKey, o ? '0' : '1') } catch { /* private mode */ }
    return !o
  })
  return [open, toggle]
}

/** Height + fade open/close for a section's body. */
function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { type: 'spring', stiffness: 320, damping: 36 }, opacity: { duration: 0.2, delay: 0.05 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: 'easeInOut' }, opacity: { duration: 0.12 } } }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Heading above each group of situations. */
function GroupHeader({ group, index, on, total, open, onToggle, summary }: {
  group: { key: string; label: string; description: string }; index: number; on: number; total: number
  open: boolean; onToggle: () => void; summary: string
}) {
  const Icon = GROUP_ICON[group.key] || Sparkles
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} data-section={group.key}
      className="group/gh relative flex w-full items-center gap-3 overflow-hidden border-t border-[#C9A24D]/20 bg-gradient-to-r from-[#C9A24D]/[0.13] via-[#C9A24D]/[0.04] to-transparent px-5 py-3.5 text-left transition-colors hover:from-[#C9A24D]/[0.2] sm:px-6">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#C9A24D] to-[#8b7355]" />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#8b7355] shadow-sm ring-1 ring-[#C9A24D]/30 dark:bg-[#1c1a14] dark:text-[#d7b974]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[11px] font-black uppercase tracking-[0.06em] text-[#111827] dark:text-white sm:tracking-[0.14em]">
          <span className="font-mono text-[10px] text-[#C9A24D]">0{index + 1}</span> {group.label}
        </p>
        {/* Open: what the group is. Closed: which situations are in it. */}
        <p className="line-clamp-2 sm:truncate text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">{open ? group.description : summary}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black tabular-nums ${on === total ? 'bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974]' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
        {on}/{total} on
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 group-hover/gh:text-[#8b7355] ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

/** One group of situations: heading (the dropdown) + its rows. */
function GroupSection({ group, index, rules, children }: {
  group: { key: string; label: string; description: string }; index: number; rules: AutoFollowupRule[]; children: React.ReactNode
}) {
  const [open, toggle] = useSectionOpen(group.key)
  return (
    <section>
      <GroupHeader group={group} index={index} on={rules.filter(r => r.enabled).length} total={rules.length}
        open={open} onToggle={toggle} summary={rules.map(r => r.label).join(' · ')} />
      <Reveal open={open}>
        <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">{children}</div>
      </Reveal>
    </section>
  )
}

/** A little calendar event, drawn the way it sits on the phone's calendar. */
function MiniEvent({ allDay, time }: { allDay?: boolean; time?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border-l-[3px] border-[#C9A24D] bg-[#C9A24D]/15 px-2 py-1.5 text-[11px] font-bold text-[#5c4a2a] dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a] ${allDay ? '' : 'ml-9'}`}>
      <span className="min-w-0 flex-1 truncate">[Reach Out] Follow up with Jane Buyer</span>
      {allDay ? <span className="shrink-0 text-[9px] font-black uppercase tracking-wide opacity-60">All day</span> : <span className="shrink-0 text-[9px] font-black opacity-60">{time}</span>}
    </div>
  )
}

/** How a follow-up reaches the phone - the two ways, side by side, so "Set time" vs "All day" on
 * each situation below makes sense. The buzz settings belong to "Set time" only (a calendar can't
 * ring at a set time for an all-day item). */
function CalendarAlertsCard({ alerts, choices, saving, onChange }: {
  alerts: FollowupAlerts; choices: number[]; saving: boolean; onChange: (patch: Partial<FollowupAlerts>) => void
}) {
  const at = 10 * 60 + 15 // 10:15 sample slot
  const fmt = (m: number) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`
  const buzzes = [alerts.before ? { t: fmt(at - alerts.before), label: `${alerts.before} min before` } : null, alerts.at_start ? { t: fmt(at), label: 'at the time' } : null].filter(Boolean) as { t: string; label: string }[]
  const [open, toggle] = useSectionOpen('calendar')
  const buzzSummary = [alerts.before ? `${alerts.before} min before` : null, alerts.at_start ? 'at the time' : null].filter(Boolean).join(' + ')
  return (
    <div className="bg-[#fbfaf7] dark:bg-white/[0.02]">
      <button type="button" onClick={toggle} aria-expanded={open} data-section="calendar"
        className="group/gh flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
          <BellRing className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-[#111827] group-hover/gh:text-[#8b7355] dark:text-white">How follow-ups show on your calendar</span>
          <span className="line-clamp-2 sm:line-clamp-1 text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">
            {open
              ? <>Each situation is <b className="text-[#111827] dark:text-white">Set time</b> or <b className="text-[#111827] dark:text-white">All day</b>. Only a set time makes your phone buzz.</>
              : <>Set time buzzes <b className="text-[#8b7355] dark:text-[#d7b974]">{buzzSummary || 'never'}</b> · All day doesn&apos;t buzz</>}
          </span>
        </span>
        <span className="inline-flex h-3.5 w-3.5 shrink-0">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 group-hover/gh:text-[#8b7355] ${open ? 'rotate-180' : ''}`} />
      </button>
      <Reveal open={open}>
      <div className="px-5 pb-5 sm:px-6">
      <div className="grid gap-3 md:grid-cols-2">
        {/* Set time */}
        <div className="relative overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-white p-3.5 shadow-[0_10px_30px_-22px_rgba(201,162,77,0.8)] dark:bg-[#151517]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Bell className="h-3.5 w-3.5" /></span>
            <p className="text-[12px] font-black uppercase tracking-wide text-[#111827] dark:text-white">Set time</p>
            <span className="ml-auto inline-flex h-3.5 w-3.5">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}</span>
          </div>
          <div className="relative mt-2.5 space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400"><span className="w-7 text-right">10</span><span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" /></div>
            <MiniEvent time="10:15" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400"><span className="w-7 text-right">11</span><span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" /></div>
          </div>
          <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {buzzes.length ? buzzes.map(b => (
                <motion.span key={b.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-[#111827]">
                  <BellRing className="h-3 w-3 text-[#C9A24D]" /> {b.t} · {b.label}
                </motion.span>
              )) : (
                <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400">
                  <BellOff className="h-3 w-3" /> On your calendar, no buzz
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Your phone buzzes</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Segmented<string>
                  value={String(alerts.before)}
                  onChange={v => onChange({ before: Number(v) })}
                  options={choices.map(m => ({ id: String(m), label: m ? String(m) : 'None' }))}
                />
                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-wide text-gray-400">min before</span>
              </span>
              <button type="button" onClick={() => onChange({ at_start: !alerts.at_start })} aria-pressed={alerts.at_start}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-[10px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-transparent dark:text-gray-300">
                <Toggle on={alerts.at_start} /> Again at the time
              </button>
            </div>
          </div>
        </div>

        {/* All day */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-[#151517]">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300"><CalendarClock className="h-3.5 w-3.5" /></span>
            <p className="text-[12px] font-black uppercase tracking-wide text-[#111827] dark:text-white">All day</p>
          </div>
          <div className="mt-2.5 space-y-1">
            <MiniEvent allDay />
            <div className="hidden items-center gap-2 text-[10px] font-bold text-gray-400 md:flex"><span className="w-7 text-right">9</span><span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" /></div>
            <div className="hidden items-center gap-2 text-[10px] font-bold text-gray-400 md:flex"><span className="w-7 text-right">10</span><span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" /></div>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-gray-400"><BellOff className="h-3 w-3" /> No buzz</p>
          <p className="mt-3 border-t border-gray-100 pt-3 text-[11px] font-medium leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
            Sits at the top of that day as a reminder. Calendars can&apos;t buzz all-day items - pick <b>Set time</b> for the buzz.
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-[10px] font-semibold leading-relaxed text-gray-400">
        <b>Same day</b> = within ~2 hours (8am-5pm); after 5pm it&apos;s the next morning. <b>Next day</b> = a free time tomorrow, 8am-5pm.
        Ones you add yourself: with a time = <b>Set time</b>, without = <b>All day</b>. Both show as Free, so they never block your calendar.<span className="hidden sm:inline"> Outlook allows one buzz per event, so it uses the first.</span>
      </p>
      </div>
      </Reveal>
    </div>
  )
}

/** Read-only preview for a situation that's an alert, not a message (nothing to send or edit). */
function AlertOnlyPreview({ rule, contactNote }: { rule: AutoFollowupRule; contactNote: string }) {
  const Icon = rule.key === 'disclosure_request' ? KeyRound : MessageSquareText
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="overflow-hidden">
      {/* Left: what it is + the sample alert text. Right: the real calendar alert, top-aligned and
          capped in height so the section stays compact. */}
      <div className="-mx-2 mt-3 grid items-start gap-4 rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fbf7ee] to-white p-3 shadow-inner sm:mx-0 sm:p-4 dark:from-[#1c1a14] dark:to-[#151517] lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Siren className="h-4 w-4 text-[#C9A24D]" />
            <p className="text-sm font-black text-[#111827] dark:text-white">An alert for you - not a message</p>
            <span className="rounded-full bg-gray-200/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400"><Lock className="-mt-px mr-0.5 inline h-2.5 w-2.5" /> Nothing to edit</span>
          </div>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
            {rule.key === 'disclosure_request'
              ? 'There’s nothing to write here - they asked for a document. The alert tells you exactly what to do, with their email on its own line so you can copy it into your mail app and send the disclosure.'
              : rule.key === 'private_feedback'
                ? 'Every unhappy review is different, so a pre-written text could come across as canned. The alert shows the stars and exactly what they wrote - you reach out in your own words (a quick call usually goes further than a text).'
                : rule.key === 'showcase_search_request'
                ? 'There’s nothing to send yet - they asked you to change their search. The alert quotes exactly what they asked for; update their Showcase, then let them know.'
                : 'People comment all sorts of things, so a pre-written reply wouldn’t fit. The alert shows what they said, which home, and a link straight to it - you reply in your own words.'}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{contactNote}</p>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">What you&apos;ll see · sample lead</p>
          <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B]">
            <div className="flex items-center gap-2 border-b border-gray-100 bg-[#C9A24D]/10 px-3 py-2 dark:border-gray-800">
              <Icon className="h-3.5 w-3.5 text-[#8b7355] dark:text-[#d7b974]" />
              <p className="truncate text-[11px] font-black text-[#111827] dark:text-white">
                {rule.key === 'disclosure_request' ? '[Send Disclosure] Send the disclosure to Jane Buyer'
                  : rule.key === 'private_feedback' ? '[Reach Out - Unhappy Review] Follow up with Jane Buyer'
                  : rule.key === 'showcase_search_request' ? "[Update Search] Update Jane Buyer's Showcase search"
                  : '[Reply to Comment] Follow up with Jane Buyer'}
              </p>
            </div>
            <p className="whitespace-pre-wrap px-3 py-2.5 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">{rule.alert_only?.sample}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">The calendar alert</p>
          <div className="mt-2"><CalendarAlertPreview ruleKey={rule.key} maxHeightClass="max-h-[300px]" /></div>
        </div>
      </div>
    </motion.div>
  )
}

/** How Can We Help: Buyer / Seller message switch. */
function AudienceSwitch({ value, onChange, sellerCustom }: { value: 'buyer' | 'seller'; onChange: (v: 'buyer' | 'seller') => void; sellerCustom?: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#C9A24D]/30 bg-white/70 px-3 py-2.5 dark:bg-white/[0.03]">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Editing the message for</p>
      <Segmented<'buyer' | 'seller'>
        value={value}
        onChange={onChange}
        options={[{ id: 'buyer', label: 'Buyers', icon: Home }, { id: 'seller', label: 'Sellers', icon: KeyRound }]}
      />
      {sellerCustom && <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24D]" title="Seller message customized" />}
      <p className="w-full text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {value === 'seller'
          ? 'Sellers are flagged as a 🏡 SELLER LEAD on your list and calendar. This message mentions their home and the price they put in, and asks for a quick call.'
          : 'Buyers without an agent also get a Showcase built from their answers - part 2 introduces it.'}
      </p>
    </div>
  )
}

export default function AutoFollowupSettings() {
  const [settings, setSettings] = useState<FollowupSettings | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [audience, setAudience] = useState<'buyer' | 'seller'>('buyer')
  const cal = useIntegrationStatus()

  useEffect(() => {
    api.tasks.autoRules().then(r => { if (r.success && r.data) setSettings(r.data) })
  }, [])
  // Opened from the Settings shortcut (#automatic-followups) - this loads after the page, so the
  // browser's own jump to the anchor misses it.
  const loaded = !!settings
  useEffect(() => {
    if (loaded && window.location.hash === '#automatic-followups') {
      setTimeout(() => document.getElementById('automatic-followups')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }, [loaded])

  if (!settings) return null
  const { rules, work_hours } = settings
  const onCount = rules.filter(r => r.enabled).length
  const calendarOk = cal.calendarConnected && !cal.calendarNeedsReconnect
  const hoursLabel = `${hourLabel(work_hours.start)}–${hourLabel(work_hours.end)}`

  const save = async (key: string, body: Parameters<typeof api.tasks.setAutoRules>[0], optimistic: FollowupSettings) => {
    const before = settings
    setSaving(key)
    setSettings(optimistic)
    const res = await api.tasks.setAutoRules(body)
    setSettings(res.success && res.data ? res.data : before)
    setSaving(null)
  }

  const updateRule = (rule: AutoFollowupRule, patch: Partial<Pick<AutoFollowupRule, 'enabled' | 'when' | 'style'>>) =>
    save(rule.key, { rules: { [rule.key]: patch } }, { ...settings, rules: rules.map(r => r.key === rule.key ? { ...r, ...patch } : r) })

  const saveTemplate = async (rule: AutoFollowupRule, next: { template: string; pitch?: string }) => {
    setSaving(`tpl-${rule.key}`)
    const body = rule.seller && audience === 'seller' ? { seller_template: next.template } : next
    const res = await api.tasks.setAutoRules({ rules: { [rule.key]: body } })
    if (res.success && res.data) {
      setSettings(res.data)
      setEditing(null)
    }
    setSaving(null)
  }

  const toggleEditor = (key: string) => {
    setEditing(editing === key ? null : key)
    setAudience('buyer')
  }

  const renderRule = (rule: AutoFollowupRule) => {
    const open = editing === rule.key
    const alertOnly = !!rule.alert_only
    const seller = !!rule.seller && audience === 'seller'
    return (
      <div key={rule.key} className={`px-5 py-3.5 transition-colors duration-300 sm:px-6 ${rule.enabled ? '' : 'bg-gray-50/60 dark:bg-white/[0.02]'} ${open ? 'bg-[#C9A24D]/[0.04]' : ''}`}>
        {/* The bar opens this situation's message; only the switch turns it on/off. */}
        <div
          onClick={() => toggleEditor(rule.key)}
          className="group/bar -mx-2 flex cursor-pointer flex-col gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-[#C9A24D]/[0.06] lg:flex-row lg:items-center"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); updateRule(rule, { enabled: !rule.enabled }) }}
              aria-pressed={rule.enabled}
              aria-label={`${rule.enabled ? 'Turn off' : 'Turn on'} ${rule.label}`}
              className="shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#C9A24D]/30"
            >
              <Toggle on={rule.enabled} />
            </button>
            <span className="min-w-0" role="button" aria-expanded={open}>
              <span className={`flex items-start gap-1.5 text-[13px] font-black transition-colors ${rule.enabled ? 'text-[#111827] group-hover/bar:text-[#8b7355] dark:text-white dark:group-hover/bar:text-[#d7b974]' : 'text-gray-400'}`}>
                <span className="min-w-0 flex-1">
                  {rule.label}
                  {alertOnly && <span className="ml-1.5 whitespace-nowrap rounded-full bg-gray-100 px-1.5 py-0.5 align-middle text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">Alert only</span>}
                  {(rule.custom_template || rule.custom_pitch || rule.custom_seller_template) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#C9A24D] align-middle sm:hidden" title="Customized" />}
                </span>
                <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform sm:hidden ${open ? 'rotate-180' : ''}`} />
              </span>
              <span className="block text-[11px] font-medium leading-snug text-gray-500 dark:text-gray-400">{rule.description}</span>
              {!rule.enabled && <span className="mt-1 block text-[10px] font-bold text-gray-400">Off - nothing is added for this situation</span>}
            </span>
          </div>
          <div className={`flex-wrap items-center gap-1.5 sm:gap-2 sm:pl-12 lg:pl-0 ${rule.enabled ? 'flex' : 'hidden lg:flex lg:invisible'}`} onClick={e => e.stopPropagation()}>
            <Segmented<FollowupWhen>
              iconsFromSm
              value={rule.when}
              disabled={!rule.enabled}
              onChange={v => updateRule(rule, { when: v })}
              options={[{ id: 'same_day', label: 'Same day', icon: Zap }, { id: 'next_day', label: 'Next day', icon: Sun }]}
            />
            <Segmented<FollowupStyle>
              iconsFromSm
              value={rule.style}
              disabled={!rule.enabled}
              onChange={v => updateRule(rule, { style: v })}
              options={[{ id: 'timed', label: 'Set time', icon: Bell }, { id: 'all_day', label: 'All day', icon: CalendarClock }]}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => toggleEditor(rule.key)}
              className={`hidden items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 sm:inline-flex text-[10px] font-black uppercase tracking-wide transition ${
                open
                  ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]'
                  : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400'
              }`}
            >
              {alertOnly ? <Siren className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />} {alertOnly ? 'Alert' : 'Message'}
              {(rule.custom_template || rule.custom_pitch || rule.custom_seller_template) && <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24D]" title="Customized" />}
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.button>
            {/* Fixed slot, so the spinner never nudges the controls onto another line. */}
            <span className="inline-flex h-3.5 w-3.5">{saving === rule.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}</span>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {open && alertOnly && (
            <AlertOnlyPreview key="alert" rule={rule} contactNote="Their contact card rides along on the calendar alert - one tap adds them to your phone's contacts, with what they asked for in the notes." />
          )}
          {open && !alertOnly && (
            <MessageTemplateEditor
              key={`${rule.key}-${seller ? 'seller' : 'buyer'}-${rule.template}-${rule.pitch || ''}-${rule.seller_template || ''}`}
              template={seller ? rule.seller_template || '' : rule.template}
              defaultTemplate={seller ? rule.seller!.default_template : rule.default_template}
              tokens={seller ? rule.seller!.tokens : rule.tokens}
              isCustom={seller ? !!rule.custom_seller_template : rule.custom_template}
              pitch={seller ? undefined : rule.pitch}
              defaultPitch={seller ? undefined : rule.default_pitch}
              pitchTokens={seller ? undefined : rule.pitch_tokens}
              pitchStyle={seller ? null : rule.pitch_style}
              isCustomPitch={seller ? false : rule.custom_pitch}
              signature={settings.footer}
              ruleKey={rule.key}
              seller={seller}
              saving={saving === `tpl-${rule.key}`}
              onSave={t => saveTemplate(rule, t)}
              onClose={() => setEditing(null)}
              header={rule.seller && <AudienceSwitch value={audience} onChange={setAudience} sellerCustom={rule.custom_seller_template} />}
              footer={rule.background_alert && <BackgroundAlert alert={rule.background_alert} />}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div id="automatic-followups" className="mt-8 scroll-mt-6 overflow-hidden rounded-3xl border border-[#C9A24D]/30 bg-white shadow-[0_24px_60px_-30px_rgba(201,162,77,0.45)] dark:bg-[#151517]">
      {/* Header band - the luxe section header, matching the page's LuxeHero */}
      <LuxeSectionHeader
        icon={Zap}
        kicker="Never miss a lead"
        title={<>Automatic <em>follow-ups</em></>}
        subtitle={<>{onCount} of {rules.length} on · each one pings your phone at the right moment</>}
        aside={cal.loaded && (calendarOk ? (
          <Link href="/studio/calendar" className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Connected &amp; syncing to {cal.calendarLabel}{cal.calendarEmail ? ` · ${cal.calendarEmail}` : ''}
          </Link>
        ) : (
          <Link href="/studio/calendar" className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50/90 px-3 py-1.5 text-[11px] font-black text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100 dark:border-amber-300/40 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25">
            <AlertTriangle className="h-3.5 w-3.5" /> {cal.calendarNeedsReconnect ? 'Reconnect your calendar' : 'Connect your calendar'} to get phone alerts <ArrowRight className="h-3 w-3" />
          </Link>
        ))}
      />

      {/* Set time vs All day - and how a set-time follow-up buzzes the phone */}
      <CalendarAlertsCard
        alerts={settings.alerts}
        choices={settings.alert_before_choices}
        saving={saving === 'alerts'}
        onChange={patch => save('alerts', { alerts: patch }, { ...settings, alerts: { ...settings.alerts, ...patch } })}
      />

      {/* Situations, under their headings */}
      {settings.groups.map((g, gi) => {
        const inGroup = rules.filter(r => (r.group || 'other') === g.key)
        if (!inGroup.length) return null
        return (
          <GroupSection key={g.key} group={g} index={gi} rules={inGroup}>
            {inGroup.map(renderRule)}
          </GroupSection>
        )
      })}

      {/* How to dismiss - three short lines, not a paragraph */}
      <div className="border-t border-[#C9A24D]/20 bg-[#C9A24D]/[0.07] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">From the calendar alert</p>
        <ul className="mt-2 space-y-1.5 text-xs font-medium leading-snug text-gray-600 dark:text-gray-300">
          <li className="flex gap-2"><CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /><span><b className="text-[#111827] dark:text-white">Mark as done</b> checks it off here and crosses it out on your calendar.</span></li>
          <li className="flex gap-2"><UserPlus className="mt-px h-4 w-4 shrink-0 text-[#C9A24D]" /><span><b className="text-[#111827] dark:text-white">Save to contacts</b> adds them to your phone, notes included.</span></li>
          <li className="flex gap-2"><Clock className="mt-px h-4 w-4 shrink-0 text-gray-400" /><span>Missed ones move to today each morning for up to a week. One open follow-up per person - no duplicates.</span></li>
        </ul>
      </div>
    </div>
  )
}
