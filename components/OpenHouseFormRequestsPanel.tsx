'use client'

import { useEffect, useRef, useState } from 'react'
import NumberPager, { scrollListTop } from '@/components/ui/NumberPager'
import { Loader2, Check, Home, CalendarCheck2, FileText, Mail, Phone, QrCode, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { OpenHouseFormRequest } from '@/types'
import api from '@/lib/api-service'
import { copyText } from '@/lib/copyText'
import { toTitleCase } from '@/lib/cheatSheetContent'
import { refreshOpenRequestsCount } from '@/hooks/useOpenRequestsCount'
import { refreshFormsActionCount } from '@/hooks/useFormsActionCount'

// Where the guest asked (10/25) - shown on every request.
const SOURCE_LABEL: Record<string, string> = { guest_pass: 'Guest Pass', cheat_sheet: 'Cheat Sheet QR', invite: 'Invite' }

interface OpenHouseFormRequestsPanelProps {
  // 'card' (default) renders its own heading + count badge, for a standalone section (Open
  // Houses tab). 'inline' skips that chrome so it can sit under a heading the parent already
  // renders (Forms Results tab).
  variant?: 'card' | 'inline'
  limit?: number
  // Fires whenever the "still needs action" (Upcoming) count changes, so a parent that wants to
  // surface this section higher on the page when there's something to do can react to it.
  onActionNeededChange?: (count: number) => void
  // Shows/hides the Total/Disclosure/Second Visit/Completed tile strip - defaults to always on
  // (the Open Houses tab's standalone 'card' use), but the Forms page's 'inline' use gates this
  // behind its own Stats toggle button to keep the default view compact.
  showStats?: boolean
}

const TABS: { id: 'upcoming' | 'past'; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

// "Request Seller Disclosure" / "Schedule a Second Visit" submissions scanned from Cheat Sheet
// QR codes, across all of the agent's open houses - shared between the Open Houses tab and the
// Forms Results tab so both show the same data.
export function OpenHouseFormRequestsPanel({ variant = 'card', limit = 8, onActionNeededChange, showStats = true }: OpenHouseFormRequestsPanelProps) {
  const [requests, setRequests] = useState<OpenHouseFormRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // Page-number pagination (not an ever-growing "show more") so this card's height stays put
  // regardless of how much history there is - resets to page 1 on tab change so switching tabs
  // never lands on an out-of-range page from the other one.
  const [page, setPage] = useState(0)
  // Deep link (?request=<id> - from a lead's page, the Leads list, the digest): the tab + page
  // holding that exact request, scrolled into view and highlighted.
  const [focusId, setFocusId] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    api.openHouses.getFormRequests().then(({ success, data }) => {
      if (success && data) {
        setRequests(data)
        let wanted: string | null = null
        try { wanted = new URLSearchParams(window.location.search).get('request') } catch { /* no window */ }
        const hit = wanted ? data.find(r => r.id === wanted) : undefined
        if (hit) {
          const inTab = data.filter(r => (hit.completedAt ? !!r.completedAt : !r.completedAt))
          setTab(hit.completedAt ? 'past' : 'upcoming')
          setPage(Math.floor(Math.max(0, inTab.findIndex(r => r.id === hit.id)) / limit))
          setFocusId(hit.id)
        }
      }
      setIsLoading(false)
    })
  }, [limit])

  useEffect(() => {
    if (!focusId || isLoading) return
    const t = setTimeout(() => document.getElementById(`ohreq-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return () => clearTimeout(t)
  }, [focusId, isLoading])

  const upcoming = requests.filter(r => !r.completedAt)
  const past = requests.filter(r => r.completedAt)
  const disclosureCount = requests.filter(r => r.formType === 'disclosure').length
  const secondVisitCount = requests.filter(r => r.formType === 'second_visit').length

  useEffect(() => {
    onActionNeededChange?.(upcoming.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming.length])

  const handleComplete = async (id: string) => {
    setCompletingId(id)
    const { success, data } = await api.openHouses.completeFormRequest(id)
    if (success && data) {
      setRequests(current => current.map(r => r.id === id ? data : r))
      // The red badges on the Opens tab / Forms clear right away.
      refreshOpenRequestsCount(); refreshFormsActionCount()
    }
    setCompletingId(null)
  }

  const copyToClipboard = (event: React.MouseEvent, value: string) => {
    event.stopPropagation()
    void copyText(value)
  }

  if (variant === 'card' && isLoading) return null

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>
  }

  if (requests.length === 0 && variant === 'inline') {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No requests yet.</p>
  }

  const filtered = tab === 'upcoming' ? upcoming : past
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(currentPage * limit, currentPage * limit + limit)

  const stats = !showStats ? null : (
    <div className="mb-3 grid grid-cols-4 gap-2">
      {[
        { label: 'Total', value: requests.length },
        { label: 'Disclosure', value: disclosureCount },
        { label: 'Second Visit', value: secondVisitCount },
        { label: 'Completed', value: past.length },
      ].map(tile => (
        <div key={tile.label} className="rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-center dark:border-gray-800 dark:bg-[#151517]">
          <p className="text-lg font-black text-[#111827] dark:text-white">{tile.value}</p>
          <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-widest text-gray-400">{tile.label}</p>
        </div>
      ))}
    </div>
  )

  const tabs = (
    <div className={`${variant === "card" ? "" : "mb-3 "}inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/25 bg-white/80 p-1 dark:border-white/10 dark:bg-white/[0.04]`}>
      {TABS.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => { setTab(t.id); setPage(0) }}
          className={`relative rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
            tab === t.id ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#8b7355] dark:hover:text-[#e8c97a]'
          }`}
        >
          {tab === t.id && <motion.span layoutId={`ohreq-tab-${variant}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
          <span className="relative">{t.label} {t.id === 'upcoming' ? (upcoming.length ? `· ${upcoming.length}` : '') : past.length ? `· ${past.length}` : ''}</span>
        </button>
      ))}
    </div>
  )

  const list = visible.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C9A24D]/35 bg-white/60 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md"><Check className="h-5 w-5" /></span>
      <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{tab === 'upcoming' ? 'All caught up' : 'Nothing completed yet'}</p>
      <p className="max-w-sm text-xs font-semibold text-gray-500 dark:text-gray-400">
        {tab === 'upcoming'
          ? 'When a guest scans a cheat sheet to ask for the seller disclosure or a second visit, it lands here for you to handle.'
          : 'Requests you mark sent or scheduled move here.'}
      </p>
    </div>
  ) : (
    // Inline = the Forms page, where this sits in a half-width card - one per row there, or each
    // card gets crushed to a sliver beside its photo.
    <div className={`grid grid-cols-1 gap-2.5 ${variant === 'card' ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
      <AnimatePresence initial={false} mode="popLayout">
      {visible.map((req, idx) => {
        const note = req.formType === 'disclosure'
          ? (req.wantsAnotherTour ? `Wants another tour${req.anotherTourTime ? ` — ${req.anotherTourTime}` : ''}` : '')
          : (req.wantsDisclosure ? 'Also wants disclosure' : (req.preferredVisitTime || ''))
        const needsAction = !req.completedAt
        const isDisclosure = req.formType === 'disclosure'
        const [street, ...rest] = (req.propertyAddress || 'Open House').split(',')
        const dateLabel = new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        const via = SOURCE_LABEL[req.source || 'cheat_sheet'] || 'Cheat Sheet QR'
        return (
          <motion.div
            key={req.id}
            id={`ohreq-${req.id}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32, delay: Math.min(idx * 0.04, 0.25) }}
            onClick={() => focusId === req.id && setFocusId(null)}
            className={`group overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_-22px_rgba(139,115,85,.8)] transition-[box-shadow,border-color] duration-300 hover:shadow-[0_18px_36px_-24px_rgba(139,115,85,.9)] dark:bg-[#151517] ${focusId === req.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#0B0B0B]' : ''} ${needsAction ? 'border-gray-200/90 dark:border-white/[0.1]' : 'border-gray-100 opacity-90 dark:border-white/[0.06]'}`}
          >
            {(() => {
              const contacts = ([['email', req.email, Mail], ['phone', req.phone, Phone]] as const).filter(([, v]) => !!v)
              const copy = (e: React.MouseEvent, kind: string, value: string) => {
                const key = `${req.id}-${kind}`
                copyToClipboard(e, value); setCopiedKey(key); setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1200)
              }
              // WHAT to do is the headline (user, 10/25): its own colour + icon per kind.
              const look = isDisclosure
                ? { Icon: FileText, task: "Send the seller's disclosure", done: 'Disclosure sent', tile: 'bg-sky-600 text-white', text: 'text-sky-700 dark:text-sky-300', stripe: 'bg-sky-500' }
                : { Icon: CalendarCheck2, task: 'Schedule a second visit', done: 'Second visit scheduled', tile: 'bg-emerald-600 text-white', text: 'text-emerald-700 dark:text-emerald-300', stripe: 'bg-emerald-500' }
              return (
                <div className="relative flex h-full flex-col gap-2.5 p-3 pl-4">
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${needsAction ? look.stripe : 'bg-gray-200 dark:bg-white/10'}`} />
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm ${needsAction ? look.tile : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}>
                      <look.Icon className="h-[18px] w-[18px]" />
                    </span>
                    <p className={`min-w-0 flex-1 text-[15px] font-black leading-tight ${needsAction ? look.text : 'text-gray-400'}`}>
                      {needsAction ? look.task : look.done}
                    </p>
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-400">{dateLabel}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    {req.propertyImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={req.propertyImage} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-black/5" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]/70"><Home size={15} /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-[#111827] dark:text-white" title={req.propertyAddress || undefined}>
                        {toTitleCase(street.trim())}{rest.length ? <span className="font-semibold text-gray-400">, {toTitleCase(rest[0].trim())}</span> : null}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="font-black text-gray-700 dark:text-gray-200" title={req.fullName}>{req.fullName}</span>
                        <span> · via </span><span className="font-black text-[#8b7355] dark:text-[#e8c97a]">{via}</span>
                      </p>
                    </div>
                  </div>
                  {note && <p className="-mt-1 truncate pl-[46px] text-[11px] font-bold text-[#111827] dark:text-gray-200" title={note}>{note}</p>}
                  <div className="mt-auto flex items-center gap-1.5">
                    {contacts.map(([kind, value, Icon]) => {
                      const copied = copiedKey === `${req.id}-${kind}`
                      return (
                        <button key={kind} type="button" onClick={(e) => copy(e, kind, value)} title={copied ? 'Copied' : `Copy ${kind}: ${value}`} aria-label={`Copy ${kind}`}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-gray-300'}`}>
                          {copied ? <Check size={14} /> : <Icon size={14} />}
                        </button>
                      )
                    })}
                    {req.completedAt ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <Check size={11} /> {isDisclosure ? 'Sent' : 'Scheduled'}
                      </span>
                    ) : (
                      <button type="button" onClick={() => handleComplete(req.id)} disabled={completingId === req.id}
                        className="ml-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3.5 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#8b7355] disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#e8c97a]">
                        {completingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {isDisclosure ? 'Mark sent' : 'Mark scheduled'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )
      })}
      </AnimatePresence>
    </div>
  )

  // Page-number nav, not a growing "show more" - flips between fixed-size pages of `limit` items
  // each so this card's footprint stays put regardless of how much history there is, instead of
  // stretching the tab taller every time there's more to see.
  // Page numbers + arrows (user, 10/24 - the section piled up); a new page brings the top of THIS
  // section back into view, not the top of the page.
  const pager = (
    <NumberPager
      page={currentPage}
      pages={totalPages}
      onChange={n => { setPage(n); scrollListTop(sectionRef.current) }}
      total={filtered.length}
      size={limit}
      className="mt-4"
    />
  )

  if (variant === 'inline') return <div ref={sectionRef as React.RefObject<HTMLDivElement>}>{stats}{tabs}{list}{pager}</div>

  return (
    <section id="requests" ref={sectionRef} className="relative mt-8 scroll-mt-24 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#fffdf8] via-white to-[#fbf6ec] p-5 shadow-[0_24px_50px_-38px_rgba(139,115,85,.8)] dark:border-white/[0.08] dark:from-[#151517] dark:via-[#121214] dark:to-[#1a1712] sm:p-6">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#C9A24D]/12 blur-3xl" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30"><QrCode className="h-5 w-5" /></span>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3 w-3" /> {upcoming.length ? `${upcoming.length} waiting on you` : "Requests from your guests"}</p>
            <h2 className="font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Disclosure &amp; <span className="whitespace-nowrap">Second Visits</span></h2>
          </div>
        </div>
        {requests.length > 0 && tabs}
      </div>
      <div className="relative">
        {list}
        {pager}
      </div>
    </section>
  )
}
