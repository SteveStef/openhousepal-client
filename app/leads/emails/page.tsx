'use client'

// Every email an agent's clients got (from the agent's own Gmail / Outlook or from OpenHousePal),
// whether it was opened and clicked, and who is on daily / weekly / no automatic emails and why -
// the engagement rules in backend client_email_service.
import LeadStar from '@/components/leads/LeadStar'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ArrowUpDown, CalendarClock, ExternalLink, Mail, MailCheck, MailOpen, MailX, MousePointerClick, Search, Send, Users, X } from 'lucide-react'
import api from '@/lib/api-service'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import Pager from '@/components/ui/Pager'
import { EmailFrequencySelect, ModePill, PersonEmailsSheet, PersonSwitch, emailDay, rateTone, ruleStep, sentence } from '@/components/emails/EmailEngagement'
import { isSlowed, markSlowedSeen } from '@/lib/emailSlowedSeen'
import LuxeSelect from '@/components/ui/LuxeSelect'
import { AnimatePresence, motion } from 'framer-motion'
import type { EmailMode, EmailPerson } from '@/types'
import type { LucideIcon } from 'lucide-react'

// slowed = the rules cut their emails back because they stopped opening them.
type ModeFilter = 'all' | EmailMode | 'slowed'
type PeopleSort = 'recent' | 'most' | 'least' | 'name'
const PAGE = 25

export default function EmailsPage() {
  return <Suspense fallback={null}><EmailsInner /></Suspense>
}

function EmailsInner() {
  const params = useSearchParams()
  // Their emails open in a pop-up here, from the row or from an old ?email= link.
  const [openFor, setOpenFor] = useState<{ email: string; name?: string | null } | null>(() => {
    const e = params.get('email') || params.get('person')
    return e ? { email: e.trim().toLowerCase() } : null
  })
  // ?person=<email>: only that client is listed (the Showcase mailbox's "All emails", owner 11/18).
  const [only, setOnly] = useState<string | null>(() => (params.get('person') || '').trim().toLowerCase() || null)
  // "Sending from" and "How it works" moved to Studio -> Email (user, 10/17) - old links land there.
  const router = useRouter()
  useEffect(() => {
    const t = params.get('tab')
    if (t === 'sender' || t === 'rules' || params.get('mailbox')) router.replace(`/studio/email${params.get('mailbox') ? `?mailbox=${params.get('mailbox')}` : ''}`)
  }, [params, router])
  const [people, setPeople] = useState<EmailPerson[] | null>(null)
  const [totals, setTotals] = useState({ people: 0, daily: 0, weekly: 0, off: 0, slowed: 0 })
  const [stats, setStats] = useState<{ sent: number; open_rate: number | null; click_rate: number | null } | null>(null)
  const [mode, setMode] = useState<ModeFilter>(params.get('show') === 'slowed' ? 'slowed' : 'all')
  const [sort, setSort] = useState<PeopleSort>('recent')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const loadPeople = useCallback(async () => {
    const r = await api.clientEmails.people()
    if (r.success && r.data) {
      setPeople(r.data.people); setTotals(r.data.totals)
      // Seen here, so the number on the Leads page's Email Tracker button clears.
      markSlowedSeen(r.data.people.filter(p => isSlowed(p.code)).map(p => p.email))
    } else setPeople([])
  }, [])
  useEffect(() => { loadPeople() }, [loadPeople])
  useEffect(() => { api.clientEmails.log({ limit: 1 }).then(r => { if (r.success && r.data) setStats(r.data.stats_30d) }) }, [])
  useEffect(() => { setPage(1) }, [mode, sort, q, only])
  const onlyName = only ? ((people || []).find(p => p.email === only)?.name || only) : null

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = (people || []).filter(p => (!only || p.email === only) && (mode === 'all' || (mode === 'slowed' ? isSlowed(p.code) : p.mode === mode || (mode === 'weekly' && p.mode === 'biweekly'))) &&
      (!term || `${p.name || ''} ${p.email}`.toLowerCase().includes(term)))
    const rate = (p: EmailPerson) => (p.rate == null ? -1 : p.rate)
    if (sort === 'most') list = [...list].sort((a, b) => rate(b) - rate(a) || b.clicked - a.clicked)
    else if (sort === 'least') list = [...list].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || (b.unopened_in_a_row || 0) - (a.unopened_in_a_row || 0))
    else if (sort === 'name') list = [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    return list
  }, [people, mode, sort, q, only])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))

  const update = (next: EmailPerson) => {
    setPeople(prev => {
      const list = (prev || []).map(p => p.email === next.email ? { ...p, ...next } : p)
      setTotals({ people: list.length, daily: list.filter(p => p.mode === 'daily').length, weekly: list.filter(p => p.mode === 'weekly' || p.mode === 'biweekly').length, off: list.filter(p => p.mode === 'off').length, slowed: list.filter(p => isSlowed(p.code)).length })
      return list
    })
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <LuxeHero
          compact
          kicker="Emails"
          icon={Mail}
          backHref="/leads"
          backLabel="Leads"
          title={<>Every email, <em>tracked</em></>}
          subtitle="What your clients were sent, if they opened it and if they clicked. People who stop opening get fewer emails, so the rest keep landing in the inbox."
          asideClassName="w-full lg:w-[400px] lg:-mt-2"
          aside={
            <LuxeStats
              note="Last 30 days"
              stats={[
                { label: 'Sent', value: stats?.sent ?? 0, icon: Send },
                { label: 'Opened', value: stats?.open_rate == null ? '-' : `${stats.open_rate}%`, icon: MailOpen },
                { label: 'Clicked', value: stats?.click_rate == null ? '-' : `${stats.click_rate}%`, icon: MousePointerClick },
                { label: 'Slowed', title: 'People who stopped opening, so they get fewer emails', value: totals.slowed, icon: CalendarClock, alert: totals.slowed > 0, onClick: () => setMode('slowed') },
              ]}
            />
          }
        />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {([['all', `All ${totals.people}`, Users], ['daily', `On ${totals.daily}`, MailCheck], ['weekly', `Weekly ${totals.weekly}`, CalendarClock], ['off', `Off ${totals.off}`, MailX], ['slowed', `Slowed ${totals.slowed}`, CalendarClock]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id} data-testid={`email-filter-${id}`}
                    className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition-colors duration-200 ${mode === id
                      ? 'border-[#C9A24D] text-[#8b7355] dark:text-[#e8c97a]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300'}`}>
                    {mode === id && <motion.span layoutId="email-filter-pill" transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 rounded-full bg-[#C9A24D]/15" />}
                    <Icon className="relative h-3.5 w-3.5" /> <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-1 gap-2 sm:justify-end">
                <label className="relative min-w-0 flex-1 sm:max-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517] dark:text-white" />
                </label>
                <LuxeSelect<PeopleSort>
                  className="w-[170px] shrink-0"
                  ariaLabel="Sort people"
                  icon={<ArrowUpDown className="h-3.5 w-3.5" />}
                  value={sort}
                  onChange={setSort}
                  align="right"
                  menuWidth={220}
                  options={[
                    { value: 'recent', label: 'Latest email', hint: 'Who you emailed most recently' },
                    { value: 'most', label: 'Most engaged', hint: 'Opens the most' },
                    { value: 'least', label: 'Least engaged', hint: 'Opens the least' },
                    { value: 'name', label: 'Name A-Z' },
                  ]}
                />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {mode === 'slowed' && (
                <motion.div key="slowed-note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ height: { duration: 0.26, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }} className="overflow-hidden">
                  <p data-testid="slowed-note" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    These people stopped opening your emails, so they now get fewer: after 3 unopened days in a row they go to one a week, and after 2 unopened weekly ones automatic emails stop. That keeps your emails landing in everyone else&apos;s inbox. They go back to daily by themselves when they open one, and you can change it on any row.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {only && (
              <div data-testid="emails-only-person" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.07] px-3 py-2 text-xs font-bold text-[#5c4a2e] dark:text-[#e8c97a]">
                <span className="min-w-0 truncate">Showing only {onlyName}</span>
                <button type="button" onClick={() => { setOnly(null); router.replace('/leads/emails') }} data-testid="emails-show-everyone"
                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/50 bg-white px-2.5 py-1 text-[11px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:bg-white/5 dark:text-[#e8c97a]">
                  <X className="h-3 w-3" /> Show everyone
                </button>
              </div>
            )}

            {people === null ? <Skeleton /> : shown.length === 0 ? (
              <Empty text={people.length === 0
                ? 'No emails sent to clients yet. When guests sign in at an open house or you send a Showcase, every email shows up here with opens and clicks.'
                : 'Nobody matches this filter.'} />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${mode}|${page}|${only || ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }} className="space-y-2.5">
                {shown.slice((page - 1) * PAGE, page * PAGE).map(p => (
                  <div key={p.email} data-testid="email-person"
                    className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow] hover:border-[#C9A24D]/50 hover:shadow-md dark:border-white/[0.08] dark:bg-[#151517] sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Who name={p.name} email={p.email} leadId={p.lead_id} badge={<ModePill mode={p.mode} code={p.code} />} />
                    </div>
                    <div className="min-w-0 sm:w-[300px] sm:shrink-0">
                      <Numbers p={p} />
                      <Breakdown p={p} />
                      {p.last_sent_at && (
                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-gray-400" title={p.last_subject || undefined}>
                          Latest: {sentence(p.last_template)} · {when(p.last_sent_at)}
                          {p.last_clicked_at ? ` · clicked ${when(p.last_clicked_at)}` : p.last_opened_at ? ` · opened ${when(p.last_opened_at)}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                      <PersonSwitch p={p} onChanged={update} />
                      <EmailFrequencySelect person={p} onChanged={update} compact />
                      <button type="button" onClick={() => setOpenFor({ email: p.email, name: p.name })} data-testid="their-emails" className="inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Their emails <ArrowRight className="h-3 w-3" /></button>
                    </div>
                    {p.mode !== 'daily' && p.reason && (
                      <p className={`basis-full rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed sm:order-last ${p.mode !== 'off' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'}`}>
                        <b>Why:</b> {p.reason}{p.since ? ` (since ${emailDay(p.since, false)})` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </motion.div>
              </AnimatePresence>
            )}
            <Pager page={page} pages={pages} onChange={setPage} />
          </div>
        </motion.div>
        <PersonEmailsSheet email={openFor?.email || null} name={openFor?.name || (people || []).find(p => p.email === openFor?.email)?.name}
          person={(people || []).find(p => p.email === openFor?.email) || null} onClose={() => setOpenFor(null)} />
      </div>
    </div>
  )
}

// "Today, Nov 18 3:12 PM · 2 hr ago", "Yesterday, Nov 17 9:05 AM · 1 day ago", "Mon, Nov 16 4:40 PM · 3 days ago",
// "Sun, Sep 28 10:15 AM · 7 wk ago" - when it happened and how long it's been, like iMessage.
function when(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const now = new Date()
  const day0 = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day0(now) - day0(d)) / 864e5)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
  // Always the real date too (owner, 11/18): "Mon, Nov 16", never just "Mon".
  const day = `${days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short' })}, ${md}`
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 6e4))
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 60 * 24 ? `${Math.round(mins / 60)} hr ago`
    : mins < 60 * 24 * 7 ? `${Math.round(mins / 1440)} ${Math.round(mins / 1440) === 1 ? 'day' : 'days'} ago`
    : mins < 60 * 24 * 60 ? `${Math.round(mins / 10080)} wk ago` : `${Math.round(mins / 43200)} mo ago`
  return `${day} ${time} · ${ago}`
}

function Skeleton() {
  return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.04]" />)}</div>
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/10">
      <Mail className="mx-auto h-6 w-6 text-[#C9A24D]" />
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  )
}

// Who it is: their name first (the email underneath), opening their lead when they are one.
function Who({ name, email, leadId, badge }: { name?: string | null; email: string; leadId?: string | null; badge?: React.ReactNode }) {
  const initial = (name || email || '?').charAt(0).toUpperCase()
  const title = name
    ? <span className="truncate text-[15px] font-black text-[#111827] dark:text-white">{name}</span>
    : <span className="truncate text-[15px] font-bold italic text-gray-400">No name on file</span>
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-[#C9A24D] dark:bg-white dark:text-[#8b7355]">{initial}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {leadId
            ? <Link href={`/leads?lead=${leadId}`} title="Open their lead" className="min-w-0 truncate hover:[&>span]:text-[#8b7355] dark:hover:[&>span]:text-[#e8c97a]">{title}</Link>
            : title}
          <LeadStar leadId={leadId} email={email} />
          {badge}
        </div>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">{email}</p>
        {leadId && <a href={`/leads?lead=${leadId}`} target="_blank" rel="noopener" data-testid="emails-open-lead" className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#e8c97a]">Open lead <ExternalLink className="h-3 w-3" /></a>}
      </div>
    </>
  )
}

// The rest of the picture under the numbers (owner, 11/18): automatic vs personal, click rate, how
// many unopened in a row and where that puts them in the 3 daily -> 2 weekly -> off rule.
function Breakdown({ p }: { p: EmailPerson }) {
  const s = p.stats_90
  if (!s || !s.sent) return null
  const step = ruleStep(p)
  return (
    <div className="mt-1.5 text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400" data-testid="email-breakdown">
      <p>
        Last 90 days · {s.auto} automatic · {s.personal} personal{s.click_rate != null ? ` · ${s.click_rate}% clicked` : ''}
        {(p.unopened_in_a_row || 0) > 0 ? ` · ${p.unopened_in_a_row} unopened in a row` : ''}
      </p>
      {step && <p className="font-bold text-amber-700 dark:text-amber-300">{step}</p>}
    </div>
  )
}

// Sent / opened / clicked as three small numbers + the open rate.
function Numbers({ p }: { p: EmailPerson }) {
  const s = p.stats_90
  const cells: [string, number, LucideIcon][] = [['Sent', s ? s.sent : p.sent, Send], ['Opened', s ? s.opened : p.opened, MailOpen], ['Clicked', s ? s.clicked : p.clicked, MousePointerClick]]
  return (
    <div className="flex items-stretch gap-1.5">
      {cells.map(([label, n, Icon]) => (
        <div key={label} className="flex min-w-0 flex-1 flex-col rounded-xl bg-[#faf9f7] px-2.5 py-1.5 dark:bg-white/[0.04]">
          <span className="font-serif text-base font-black leading-none tabular-nums text-[#111827] dark:text-white">{n}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-gray-400"><Icon className="h-2.5 w-2.5" /> {label}</span>
        </div>
      ))}
      <div className={`flex min-w-[64px] flex-col justify-center rounded-xl px-2.5 py-1.5 text-center ${p.rate != null ? rateTone(p.rate) : 'bg-gray-50 text-gray-400 dark:bg-white/[0.04]'}`}>
        <span className="font-serif text-base font-black leading-none tabular-nums">{p.rate != null ? `${p.rate}%` : '-'}</span>
        <span className="mt-1 text-[9px] font-black uppercase tracking-wide opacity-80">Open rate</span>
      </div>
    </div>
  )
}
