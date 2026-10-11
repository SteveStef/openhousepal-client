'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, Copy, Home, ChevronLeft, ChevronRight, CalendarCheck2, FileText, Mail, Phone, QrCode, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { OpenHouseFormRequest } from '@/types'
import api from '@/lib/api-service'
import { copyText } from '@/lib/copyText'

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

// "Rachel Kimberly-Anderson" -> "Rachel K." - phones show the short form so it never wraps.
const shortName = (full: string) => {
  const parts = (full || '').trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0] || ''
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
    <div className={`grid grid-cols-1 gap-3 ${variant === 'card' ? 'lg:grid-cols-2' : ''}`}>
      <AnimatePresence initial={false} mode="popLayout">
      {visible.map((req, idx) => {
        const note = req.formType === 'disclosure'
          ? (req.wantsAnotherTour ? `Wants another tour${req.anotherTourTime ? ` — ${req.anotherTourTime}` : ''}` : '')
          : (req.wantsDisclosure ? 'Also wants disclosure' : (req.preferredVisitTime || ''))
        const needsAction = !req.completedAt
        const isDisclosure = req.formType === 'disclosure'
        const [street, ...rest] = (req.propertyAddress || 'Open House').split(',')
        const dateLabel = new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
            className={`group overflow-hidden rounded-2xl border bg-white shadow-[0_14px_34px_-28px_rgba(139,115,85,.8)] transition-[box-shadow,border-color] duration-300 hover:shadow-[0_22px_44px_-28px_rgba(139,115,85,.9)] dark:bg-[#151517] ${focusId === req.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#0B0B0B]' : ''} ${needsAction ? 'border-red-200 dark:border-red-900/50' : 'border-[#C9A24D]/20 dark:border-white/[0.08]'}`}
          >
            {(() => {
              const photo = req.propertyImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={req.propertyImage} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]/60"><Home size={20} /></div>
              )
              const typePill = (
                <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-black uppercase leading-none tracking-widest ${isDisclosure ? 'bg-[#111827]/90 text-[#e8c97a]' : 'bg-white/95 text-[#8b7355]'} shadow-sm`}>
                  {isDisclosure ? <FileText size={9} /> : <CalendarCheck2 size={9} />}
                  {isDisclosure ? 'Disclosure' : 'Second visit'}
                </span>
              )
              const contacts = ([['email', req.email, Mail], ['phone', req.phone, Phone]] as const).filter(([, v]) => !!v)
              const copy = (e: React.MouseEvent, kind: string, value: string) => {
                const key = `${req.id}-${kind}`
                copyToClipboard(e, value); setCopiedKey(key); setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1200)
              }
              const action = (chip: boolean) => req.completedAt ? (
                <span className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 font-black uppercase leading-none tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 ${chip ? 'px-2.5 py-1 text-[9px]' : 'w-full px-3 py-2 text-[10px]'}`}>
                  <Check size={10} /> {isDisclosure ? 'Sent' : 'Scheduled'}
                </span>
              ) : (
                <button
                  onClick={() => handleComplete(req.id)}
                  disabled={completingId === req.id}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap border border-[#C9A24D]/50 bg-[#C9A24D]/10 font-black uppercase leading-none tracking-widest text-[#8b7355] transition hover:border-[#111827] hover:bg-[#111827] hover:text-white disabled:opacity-50 dark:text-[#e8c97a] dark:hover:border-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-[#111827] ${chip ? 'rounded-full px-2.5 py-1 text-[9px]' : 'w-full rounded-xl px-3 py-2.5 text-[10px]'}`}
                >
                  {completingId === req.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                  {isDisclosure ? 'Mark sent' : 'Mark scheduled'}
                </button>
              )
              return (
                <>
                  {/* Phones: a short photo banner (home, type, date on it), then the person. */}
                  <div className="lg:hidden">
                    <div className="relative h-24 w-full overflow-hidden">
                      {photo}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <span className="absolute left-2 top-2 flex">{typePill}</span>
                      <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ">{dateLabel}</span>
                      <p className="absolute inset-x-3 bottom-2.5 truncate text-[12px] font-black text-white drop-shadow">{street}{rest.length ? <span className="font-semibold text-white/75">,{rest.join(',')}</span> : null}</p>
                      {needsAction && <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 to-red-400" />}
                    </div>
                    <div className="p-3">
                      <p className="truncate font-serif text-base font-black leading-tight text-[#111827] dark:text-white">{shortName(req.fullName)}</p>
                      {note && <p className="mt-1 line-clamp-2 text-[11px] font-black leading-snug text-[#8b7355] dark:text-[#e8c97a]">{note}</p>}
                      <div className={`mt-2.5 grid gap-2 ${contacts.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {contacts.map(([kind, value, Icon]) => {
                          const copied = copiedKey === `${req.id}-${kind}`
                          return (
                            <button key={kind} onClick={(e) => copy(e, kind, value)} title={`Copy ${kind}`}
                              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-black transition ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}>
                              <Icon size={12} className="shrink-0" /> {copied ? 'Copied' : `Copy ${kind}`}
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-2.5">{action(false)}</div>
                    </div>
                  </div>

                  {/* Desktop: one compact row - inset photo, then name (+ the action as a small chip),
                      home + date, what they asked for, and email + phone together on one line. */}
                  <div className="hidden gap-3.5 p-3 lg:flex">
                    <div className="relative h-[84px] w-[92px] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5">
                      {photo}
                      <span className="absolute inset-x-1 bottom-1.5 flex justify-center">{typePill}</span>
                      {needsAction && <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 to-red-400" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-serif text-[15px] font-black leading-tight text-[#111827] dark:text-white" title={req.fullName}>{req.fullName}</p>
                        <div className="shrink-0">{action(true)}</div>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-[#8b7355] dark:text-[#e8c97a]">
                        {street}{rest.length ? <span className="font-semibold text-gray-400">,{rest.join(',')}</span> : null}
                        <span className="font-semibold text-gray-400"> · {dateLabel}</span>
                      </p>
                      {note && <p className="mt-0.5 truncate text-[11px] font-black text-[#111827] dark:text-white" title={note}>{note}</p>}
                      {contacts.length > 0 && (
                        <div className="mt-1.5 flex min-w-0 max-w-full items-center self-start rounded-lg bg-[#faf9f7] px-2 py-1 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-100 dark:bg-white/[0.04] dark:text-gray-400 dark:ring-white/10">
                          {contacts.map(([kind, value, Icon], i) => {
                            const copied = copiedKey === `${req.id}-${kind}`
                            return (
                              <button key={kind} onClick={(e) => copy(e, kind, value)} title={`Copy ${kind}`}
                                className={`group/copy flex items-center gap-1 transition hover:text-[#8b7355] dark:hover:text-[#e8c97a] ${kind === 'email' ? 'min-w-0' : 'shrink-0'} ${i > 0 ? 'ml-2 border-l border-gray-200 pl-2 dark:border-white/10' : ''}`}>
                                <Icon size={11} className="shrink-0 text-gray-400" />
                                <span className="truncate">{value}</span>
                                {copied ? <Check size={11} className="shrink-0 text-emerald-500" /> : <Copy size={10} className="shrink-0 text-gray-300 group-hover/copy:text-[#C9A24D]" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
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
  const pager = totalPages > 1 && (
    <div className="mt-2 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => setPage(p => Math.max(0, p - 1))}
        disabled={currentPage === 0}
        aria-label="Previous page"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition hover:border-[#C9A24D]/50 hover:text-[#8b7355] disabled:pointer-events-none disabled:opacity-30 dark:border-gray-700 dark:hover:text-[#d7b974]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Page {currentPage + 1} of {totalPages}</span>
      <button
        type="button"
        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition hover:border-[#C9A24D]/50 hover:text-[#8b7355] disabled:pointer-events-none disabled:opacity-30 dark:border-gray-700 dark:hover:text-[#d7b974]"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  if (variant === 'inline') return <div>{stats}{tabs}{list}{pager}</div>

  return (
    <section id="requests" className="relative mt-8 scroll-mt-24 overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#fffdf8] via-white to-[#fbf6ec] p-5 shadow-[0_24px_50px_-38px_rgba(139,115,85,.8)] dark:border-white/[0.08] dark:from-[#151517] dark:via-[#121214] dark:to-[#1a1712] sm:p-6">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#C9A24D]/12 blur-3xl" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30"><QrCode className="h-5 w-5" /></span>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3 w-3" /> From your cheat sheets</p>
            <h2 className="font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Disclosure &amp; Second Visits</h2>
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
