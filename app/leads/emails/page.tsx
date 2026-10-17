'use client'

// Every email an agent's clients got (from the agent's own Gmail / Outlook or from OpenHousePal),
// whether it was opened and clicked, and who is on daily / weekly / no automatic emails and why -
// the engagement rules in backend client_email_service.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ArrowUpDown, CalendarClock, Mail, MailCheck, MailOpen, MailX, MousePointerClick, Search, Send, Users, X } from 'lucide-react'
import api from '@/lib/api-service'
import LuxeHero, { LuxeStats, LuxeTabs } from '@/components/ui/LuxeHero'
import Pager from '@/components/ui/Pager'
import { ModePill, PersonSwitch, rateTone, sentence } from '@/components/emails/EmailEngagement'
import LuxeSelect from '@/components/ui/LuxeSelect'
import { AnimatePresence, motion } from 'framer-motion'
import { timeAgo } from '@/lib/leadActivity'
import type { ClientEmailRow, EmailMode, EmailPerson } from '@/types'
import type { LucideIcon } from 'lucide-react'

type Tab = 'people' | 'sent'
type ModeFilter = 'all' | EmailMode
type PeopleSort = 'recent' | 'most' | 'least' | 'name'
const PAGE = 25

export default function EmailsPage() {
  return <Suspense fallback={null}><EmailsInner /></Suspense>
}

function EmailsInner() {
  const params = useSearchParams()
  const focusEmail = params.get('email') || ''
  const [tab, setTab] = useState<Tab>(focusEmail ? 'sent' : 'people')
  // "Sending from" and "How it works" moved to Studio -> Email (user, 10/17) - old links land there.
  const router = useRouter()
  useEffect(() => {
    const t = params.get('tab')
    if (t === 'sender' || t === 'rules' || params.get('mailbox')) router.replace(`/studio/email${params.get('mailbox') ? `?mailbox=${params.get('mailbox')}` : ''}`)
  }, [params, router])
  const [people, setPeople] = useState<EmailPerson[] | null>(null)
  const [totals, setTotals] = useState({ people: 0, daily: 0, weekly: 0, off: 0 })
  const [stats, setStats] = useState<{ sent: number; open_rate: number | null; click_rate: number | null } | null>(null)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [sort, setSort] = useState<PeopleSort>('recent')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  // Sent emails (server-paged)
  const [rows, setRows] = useState<ClientEmailRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [sentPage, setSentPage] = useState(1)
  const [sentQ, setSentQ] = useState(focusEmail)
  const [sentFor, setSentFor] = useState(focusEmail)

  const loadPeople = useCallback(async () => {
    const r = await api.clientEmails.people()
    if (r.success && r.data) { setPeople(r.data.people); setTotals(r.data.totals) } else setPeople([])
  }, [])
  const loadSent = useCallback(async () => {
    const r = await api.clientEmails.log({ email: sentFor || undefined, q: sentFor ? undefined : (sentQ.trim() || undefined), limit: PAGE, offset: (sentPage - 1) * PAGE })
    if (r.success && r.data) { setRows(r.data.emails); setTotal(r.data.total); setStats(r.data.stats_30d) } else setRows([])
  }, [sentFor, sentQ, sentPage])
  useEffect(() => { loadPeople() }, [loadPeople])
  useEffect(() => { const t = setTimeout(loadSent, 200); return () => clearTimeout(t) }, [loadSent])
  useEffect(() => { setPage(1) }, [mode, sort, q])
  useEffect(() => { setSentPage(1) }, [sentQ, sentFor])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = (people || []).filter(p => (mode === 'all' || p.mode === mode) &&
      (!term || `${p.name || ''} ${p.email}`.toLowerCase().includes(term)))
    const rate = (p: EmailPerson) => (p.rate == null ? -1 : p.rate)
    if (sort === 'most') list = [...list].sort((a, b) => rate(b) - rate(a) || b.clicked - a.clicked)
    else if (sort === 'least') list = [...list].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || (b.unopened_in_a_row || 0) - (a.unopened_in_a_row || 0))
    else if (sort === 'name') list = [...list].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    return list
  }, [people, mode, sort, q])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))

  const update = (next: EmailPerson) => {
    setPeople(prev => {
      const list = (prev || []).map(p => p.email === next.email ? { ...p, ...next } : p)
      setTotals({ people: list.length, daily: list.filter(p => p.mode === 'daily').length, weekly: list.filter(p => p.mode === 'weekly').length, off: list.filter(p => p.mode === 'off').length })
      return list
    })
  }
  const showFor = (email: string) => { setSentFor(email); setSentQ(email); setTab('sent') }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <LuxeHero
          compact
          kicker="Emails"
          icon={Mail}
          backHref="/leads"
          backLabel="Leads"
          title={<>Every email, <em>tracked.</em></>}
          subtitle="What your clients were sent, if they opened it and if they clicked. People who stop opening get fewer emails, so the rest keep landing in the inbox."
          asideClassName="w-full lg:w-[400px] lg:-mt-2"
          aside={
            <LuxeStats
              note="Last 30 days"
              stats={[
                { label: 'Sent', value: stats?.sent ?? 0, icon: Send },
                { label: 'Opened', value: stats?.open_rate == null ? '-' : `${stats.open_rate}%`, icon: MailOpen },
                { label: 'Clicked', value: stats?.click_rate == null ? '-' : `${stats.click_rate}%`, icon: MousePointerClick },
                { label: 'Slowed', title: 'People on weekly or no automatic emails', value: totals.weekly + totals.off, icon: CalendarClock, alert: totals.weekly + totals.off > 0, onClick: () => { setTab('people'); setMode(totals.off ? 'off' : 'weekly') } },
              ]}
            />
          }
          tabs={
            <LuxeTabs label="Emails view" active={tab} onChange={setTab}
              items={[
                { id: 'people', label: `People ${totals.people}`, icon: Users },
                { id: 'sent', label: 'Sent emails', icon: Send },
              ]} />
          }
        />

        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
        {tab === 'people' && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {([['all', `All ${totals.people}`, Users], ['daily', `On ${totals.daily}`, MailCheck], ['weekly', `Weekly ${totals.weekly}`, CalendarClock], ['off', `Off ${totals.off}`, MailX]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${mode === id
                      ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300'}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
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

            {people === null ? <Skeleton /> : shown.length === 0 ? (
              <Empty text={people.length === 0
                ? 'No emails sent to clients yet. When guests sign in at an open house or you send a Showcase, every email shows up here with opens and clicks.'
                : 'Nobody matches this filter.'} />
            ) : (
              <div className="space-y-2.5">
                {shown.slice((page - 1) * PAGE, page * PAGE).map((p, i) => (
                  <motion.div key={p.email} data-testid="email-person"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.25) }}
                    className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#C9A24D]/50 hover:shadow-md dark:border-white/[0.08] dark:bg-[#151517] sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Who name={p.name} email={p.email} leadId={p.lead_id} badge={<ModePill mode={p.mode} code={p.code} />} />
                    </div>
                    <div className="min-w-0 sm:w-[300px] sm:shrink-0">
                      <Numbers p={p} />
                      {p.last_sent_at && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold text-gray-400" title={p.last_subject || undefined}>
                          Latest: {sentence(p.last_template)} · {when(p.last_sent_at)}
                          {p.last_clicked_at ? ` · clicked ${when(p.last_clicked_at)}` : p.last_opened_at ? ` · opened ${when(p.last_opened_at)}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                      <PersonSwitch p={p} onChanged={update} />
                      <button type="button" onClick={() => showFor(p.email)} className="inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Their emails <ArrowRight className="h-3 w-3" /></button>
                    </div>
                    {p.mode !== 'daily' && p.reason && (
                      <p className={`basis-full rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed sm:order-last ${p.mode === 'weekly' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'}`}>
                        <b>Why:</b> {p.reason}{p.since ? ` (since ${timeAgo(p.since)})` : ''}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            <Pager page={page} pages={pages} onChange={setPage} />
          </div>
        )}

        {tab === 'sent' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input value={sentQ} onChange={e => { setSentQ(e.target.value); setSentFor('') }} placeholder="Search by email address or subject"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517] dark:text-white" />
              </label>
              {(sentFor || sentQ) && (
                <button type="button" onClick={() => { setSentFor(''); setSentQ('') }} className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-black text-gray-400 hover:text-rose-500"><X className="h-3.5 w-3.5" /> Show all</button>
              )}
              <span className="ml-auto text-[11px] font-black uppercase tracking-wide text-gray-400">{total} email{total === 1 ? '' : 's'}</span>
            </div>
            {rows === null ? <Skeleton /> : rows.length === 0 ? (
              <Empty text={sentFor || sentQ ? 'No emails match.' : 'No emails sent to clients yet.'} />
            ) : (
              <div className="space-y-2.5">
                {rows.map((e, i) => (
                  <motion.div key={e.id} data-testid="email-row"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.25) }}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#C9A24D]/50 hover:shadow-md dark:border-white/[0.08] dark:bg-[#151517] sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3 sm:w-[260px] sm:shrink-0">
                      <Who name={e.name} email={e.to} leadId={e.lead_id} />
                    </div>
                    <div className="min-w-0 flex-1 border-t border-gray-100 pt-3 dark:border-white/[0.06] sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                      <p className="line-clamp-2 text-[13px] font-black leading-snug text-[#111827] dark:text-white">{e.subject || sentence(e.label)}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        {sentence(e.label)} · {e.via === 'mailbox' ? 'from your email' : 'from OpenHousePal'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#8b7355] dark:text-[#d7b974]">
                        <Send className="h-3 w-3" /> {e.status === 'failed' ? 'Tried' : 'Sent'} {when(e.sent_at || e.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.status === 'failed'
                          ? <Chip tone="rose" icon={MailX}>Didn&apos;t go through{e.error ? ` - ${e.error}` : ''}</Chip>
                          : e.opened_at
                            ? <Chip tone="emerald" icon={MailOpen}>Opened {when(e.opened_at)}{e.open_count > 1 ? ` · ${e.open_count}×` : ''}</Chip>
                            : <Chip tone="gray" icon={Mail}>Not opened yet</Chip>}
                        {e.clicked_at && <Chip tone="sky" icon={MousePointerClick}>Clicked {when(e.clicked_at)}{e.click_count > 1 ? ` · ${e.click_count}×` : ''}</Chip>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            <Pager page={sentPage} pages={Math.max(1, Math.ceil(total / PAGE))} onChange={setSentPage} prevLabel="Newer" nextLabel="Older" />
          </div>
        )}

        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// "Today 3:12 PM · 2 hr ago", "Yesterday 9:05 AM · 1 day ago", "Mon 4:40 PM · 3 days ago",
// "Sep 28, 10:15 AM · 2 wk ago" - when it happened and how long it's been, like iMessage.
function when(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const now = new Date()
  const day0 = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day0(now) - day0(d)) / 864e5)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? d.toLocaleDateString(undefined, { weekday: 'short' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
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
          {badge}
        </div>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">{email}</p>
        {leadId
          ? <Link href={`/leads?lead=${leadId}`} className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#e8c97a]">Open lead <ArrowRight className="h-3 w-3" /></Link>
          : <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-400">Not in your leads</p>}
      </div>
    </>
  )
}

// Sent / opened / clicked as three small numbers + the open rate.
function Numbers({ p }: { p: EmailPerson }) {
  const cells: [string, number, LucideIcon][] = [['Sent', p.sent, Send], ['Opened', p.opened, MailOpen], ['Clicked', p.clicked, MousePointerClick]]
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

function Chip({ tone, icon: Icon, children }: { tone: 'emerald' | 'sky' | 'rose' | 'gray'; icon: LucideIcon; children: React.ReactNode }) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
    gray: 'bg-gray-50 text-gray-500 ring-gray-200 dark:bg-white/[0.04] dark:text-gray-400 dark:ring-white/10',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${cls}`}><Icon className="h-3 w-3" /> {children}</span>
}
