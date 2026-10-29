'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import { useEffect, useRef, useState } from 'react'
import { X, FileText, Mail, Phone, User, MapPin, Trash2, ArrowLeft, ChevronLeft, ChevronRight, Copy, Check, CalendarCheck, CalendarDays, Hourglass, Loader2 } from 'lucide-react'
import { AgentFormConfig, FormSubmissionAnswer, FormSubmissionListItem } from '@/types'
import api from '@/lib/api-service'
import { tourWhen } from '@/components/TourStatusWindow'
import { copyText } from '@/lib/copyText'
import { useEscapeToClose } from '@/components/ui/windowMotion'
import { AnimatePresence, motion } from 'framer-motion'
import { WhenDoneMoment, WhenSheet, clockText, dayText, parseYmd, whenText, ymd } from '@/components/ui/WhenPicker'
import { useAuth } from '@/contexts/AuthContext'
import OpenShowcaseButton from '@/components/OpenShowcaseButton'

interface FormResultsModalProps {
  isOpen: boolean
  onClose: () => void
  form: AgentFormConfig | null
  submissions: FormSubmissionListItem[]
  isLoading: boolean
  onToggleReviewed: (submissionId: string, isReviewed: boolean) => Promise<void>
  onDeleteSubmission: (submission: FormSubmissionListItem) => void
  /** Open straight onto this submission (deep link from a lead's Activity). */
  initialSubmissionId?: string
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

// An answer as a person reads it: lists with ", " (they came out "Berwyn,Wayne"), money as
// "$600,000" (was "600000"), dates and times in words.
function answerText(entry: FormSubmissionAnswer): string {
  const v = entry.value as unknown
  if (Array.isArray(v)) return v.map(String).join(', ')
  const raw = String(v ?? '').trim()
  if (entry.type === 'currency' && /^\d+(\.\d+)?$/.test(raw.replace(/[$,]/g, ''))) return `$${Number(raw.replace(/[$,]/g, '')).toLocaleString('en-US')}`
  if (entry.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00`)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (entry.type === 'time' && /^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':').map(Number)
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
  return raw
}

function extractGroupName(entries: FormSubmissionAnswer[]) {
  const first = entries.find(entry => /first name/i.test(entry.label))
  const last = entries.find(entry => /last name/i.test(entry.label))
  if (first || last) return [first?.value, last?.value].filter(Boolean).join(' ')
  const single = entries.find(entry => /^(legal )?name$|full name/i.test(entry.label))
  return single ? String(single.value) : ''
}

// No card wrapper of its own — every contact group renders with identical styling, stacked inside one shared card.
function ContactInfoSection({ title, entries }: { title: string; entries: FormSubmissionAnswer[] }) {
  const [copiedField, setCopiedField] = useState<string>('')
  const name = extractGroupName(entries)
  const email = entries.find(entry => entry.type === 'email' && entry.value)
  const phone = entries.find(entry => entry.type === 'phone' && entry.value)
  const usedIds = new Set([email?.questionId, phone?.questionId, ...entries.filter(entry => /first name|last name|^(legal )?name$|full name/i.test(entry.label)).map(entry => entry.questionId)])
  const otherEntries = entries.filter(entry => !usedIds.has(entry.questionId) && entry.value !== undefined && entry.value !== null && String(entry.value).trim() !== '')

  const handleCopy = (field: string, value: string) => {
    copyText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(current => current === field ? '' : current), 1200)
  }

  const CopyButton = ({ field, value }: { field: string; value: string }) => (
    <button
      type="button"
      onClick={() => handleCopy(field, value)}
      className="ml-1.5 shrink-0 rounded-md p-1 text-gray-300 transition hover:bg-gray-100 hover:text-[#8b7355] dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-[#e8cf8a]"
      aria-label={`Copy ${field}`}
      title={`Copy ${field}`}
    >
      {copiedField === field ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  )

  return (
    <div>
      <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
        {title}
      </h4>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {name && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><User size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <span className="truncate font-medium text-[#111827] dark:text-white">{name}</span>
            <CopyButton field="name" value={name} />
          </div>
        )}
        {email && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><Mail size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <a href={`mailto:${email.value}`} className="truncate font-medium text-[#6B7280] transition-colors hover:text-[#C9A24D] dark:text-gray-400">{String(email.value)}</a>
            <CopyButton field="email" value={String(email.value)} />
          </div>
        )}
        {phone && (
          <div className="flex items-center text-[#6B7280] dark:text-gray-400">
            <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800"><Phone size={14} className="text-gray-400 dark:text-gray-500" /></div>
            <a href={`tel:${phone.value}`} className="font-medium text-[#6B7280] transition-colors hover:text-[#C9A24D] dark:text-gray-400">{String(phone.value)}</a>
            <CopyButton field="phone" value={String(phone.value)} />
          </div>
        )}
        {otherEntries.map(entry => (
          <div key={entry.questionId} className="flex items-center text-[#6B7280] dark:text-gray-400">
            <span className="truncate text-xs font-medium"><span className="text-gray-400 dark:text-gray-500">{entry.label}:</span> <span className="text-[#111827] dark:text-white">{answerText(entry)}</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

type Showing = NonNullable<FormSubmissionListItem['showing']>

// Schedule a Showing: the times they offered as big cards - "Confirm this one" - or another time
// they agreed on, picked step by step (user, 10/22). Then one short "is this right?" step and a
// "Confirmed" moment. Their form link flips from Pending to Confirmed and they're emailed, same as
// a Showcase tour (same PUT as before).
function ShowingConfirmSection({ submission, showing, onSaved }: { submission: FormSubmissionListItem; showing: Showing; onSaved: (next: Showing) => void }) {
  const { user } = useAuth()
  const offered = (showing.preferred || []).filter(p => p.date)
  const confirmed = showing.confirmed_date && showing.confirmed_time ? { date: showing.confirmed_date, time: showing.confirmed_time } : null
  const [editing, setEditing] = useState(!confirmed)
  const [stage, setStage] = useState<'pick' | 'confirm' | 'done'>('pick')
  const [chosen, setChosen] = useState<{ date: string; time: string; offered: boolean } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const first = (submission.contact_name || '').trim().split(' ')[0] || 'them'

  // The agent's own busy blocks (connected Google / Outlook calendar) - a clash is flagged on a
  // card and crossed out in the picker. Nothing connected = nothing flagged.
  const [busy, setBusy] = useState<{ start: string; end: string }[]>([])
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    api.properties.getAgentBusy(user.id).then(list => { if (alive) setBusy(list || []) }).catch(() => {})
    return () => { alive = false }
  }, [user?.id])
  const clashes = (date: string, time: string) => {
    const [h, m] = time.split(':').map(Number)
    const d = parseYmd(date); d.setHours(h, m, 0, 0)
    const a = d.getTime(), b = a + 30 * 60000
    return busy.some(x => Date.parse(x.start) < b && Date.parse(x.end) > a)
  }
  const passed = (date: string, time?: string | null) => {
    const today = ymd(new Date())
    if (date < today) return true
    if (date > today || !time) return false
    const [h, m] = time.split(':').map(Number)
    const now = new Date()
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
  }

  useEffect(() => { setEditing(!confirmed); setStage('pick'); setChosen(null); setError('') }, [submission.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (date: string | null, time: string | null) => {
    setSaving(true)
    setError('')
    const res = await api.forms.confirmShowing(submission.id, date, time)
    setSaving(false)
    if (!res.success || !res.data) { setError(res.error || 'Could not save that right now.'); return false }
    onSaved(res.data.showing || { ...showing, confirmed_date: date, confirmed_time: time })
    return true
  }
  const confirmChosen = async () => {
    if (!chosen) return
    if (await save(chosen.date, chosen.time)) setStage('done')
  }
  // The "Confirmed" moment, then the card folds back to its confirmed header.
  useEffect(() => {
    if (stage !== 'done') return
    const t = window.setTimeout(() => { setEditing(false); setStage('pick'); setChosen(null) }, 2600)
    return () => window.clearTimeout(t)
  }, [stage])

  const pickOffered = (slot: { date: string; time?: string | null }) => {
    setError('')
    if (!slot.time) { setSheetDate(slot.date); setSheetOpen(true); return }
    setChosen({ date: slot.date, time: slot.time, offered: true })
    setStage('confirm')
  }
  const when = (date: string, time: string) => whenText({ date, time }, 'datetime')
  const slide = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
    exit: { opacity: 0, x: -18, transition: { duration: 0.14 } },
  } as const

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className={`flex items-center gap-3 px-4 py-3 text-white ${confirmed ? 'bg-emerald-600' : 'bg-[#111827]'}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${confirmed ? 'bg-white text-emerald-600' : 'bg-amber-400 text-[#111827]'}`}>
          {confirmed ? <CalendarCheck className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/70 sm:tracking-[0.22em]">{confirmed ? 'Showing confirmed' : 'Showing request - pending'}</p>
          <p className="truncate text-sm font-black">{confirmed ? tourWhen(confirmed.date, confirmed.time, true) : `Confirm a time and ${first} sees it on their link`}</p>
        </div>
        {confirmed && !editing && (
          <div className="ml-auto flex shrink-0 gap-1.5">
            <button type="button" onClick={() => { setEditing(true); setStage('pick') }} className="rounded-lg bg-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition hover:bg-white/25">Change</button>
            <button type="button" disabled={saving} onClick={async () => { if (await save(null, null)) { setEditing(true); setStage('pick') } }} className="rounded-lg bg-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition hover:bg-white/25 disabled:opacity-50">{saving ? '...' : 'Undo'}</button>
          </div>
        )}
      </div>
      {editing && (
        <div className="bg-white p-4 dark:bg-[#151517]">
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'pick' && (
              <motion.div key="pick" {...slide} className="space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Times {first} offered</p>
                {offered.map((slot, i) => {
                  const dt = parseYmd(slot.date)
                  const gone = passed(slot.date, slot.time)
                  const clash = !!slot.time && !gone && clashes(slot.date, slot.time)
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${i === 0 ? 'border-[#C9A24D]/50 bg-[#C9A24D]/[0.06]' : 'border-gray-200 dark:border-gray-800'} ${gone ? 'opacity-60' : ''}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#111827] text-white shadow-sm dark:bg-white dark:text-[#111827]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#e8c97a] dark:text-[#a8843a]">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="font-serif text-xl font-black leading-none">{dt.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-[15px] font-black text-[#111827] dark:text-white">{dayText(slot.date, true)}</p>
                          <p className="text-[13px] font-bold text-gray-500 dark:text-gray-400">{slot.time ? `at ${clockText(slot.time)}` : 'No time given'}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {i === 0 && <span className="rounded-full bg-[#C9A24D]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#7a5f22] dark:text-[#e8c97a]">Top pick</span>}
                            {clash && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">Busy on your calendar</span>}
                            {gone && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:bg-white/10">Already passed</span>}
                          </div>
                        </div>
                      </div>
                      <motion.button type="button" whileTap={{ scale: 0.96 }} disabled={gone} onClick={() => pickOffered(slot)}
                        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-[12px] font-black uppercase tracking-widest text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-white/10">
                        <CalendarCheck className="h-4 w-4" /> {slot.time ? 'Confirm this one' : 'Pick the time'}
                      </motion.button>
                    </motion.div>
                  )
                })}
                <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => { setSheetDate(null); setSheetOpen(true) }}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-[12px] font-black uppercase tracking-widest text-gray-500 transition hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-gray-700 dark:text-gray-400">
                  <CalendarDays className="h-4 w-4" /> {offered.length ? 'Another time you agreed on' : 'Pick the time you agreed on'}
                </motion.button>
                {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
                {confirmed && (
                  <button type="button" onClick={() => setEditing(false)} className="w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Keep {tourWhen(confirmed.date, confirmed.time)}</button>
                )}
              </motion.div>
            )}
            {stage === 'confirm' && chosen && (
              <motion.div key="confirm" {...slide}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">Is this right?</p>
                <div className="mt-2 flex items-center gap-2.5 rounded-2xl border border-dashed border-[#C9A24D]/50 p-3 sm:gap-3 sm:p-4">
                  <div className="flex h-14 w-14 shrink-0 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] text-[#111827] shadow-[0_12px_22px_-10px_rgba(201,162,77,.9)]">
                    <span className="text-[10px] font-black uppercase tracking-widest">{parseYmd(chosen.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="font-serif text-2xl font-black leading-none">{parseYmd(chosen.date).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    {/* one line: on a phone the gold tile already says the month and day */}
                    <p className="truncate whitespace-nowrap font-serif text-[18px] font-black leading-tight text-[#111827] dark:text-white sm:text-xl">
                      <span className="sm:hidden">{parseYmd(chosen.date).toLocaleDateString('en-US', { weekday: 'short' })} · {clockText(chosen.time)}</span>
                      <span className="max-sm:hidden">{whenText({ date: chosen.date, time: chosen.time }, 'datetime', 'any time', true)}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400">Showing with {submission.contact_name || 'your client'}{chosen.offered ? '' : ' - a time you agreed on'}</p>
                  </div>
                </div>
                {clashes(chosen.date, chosen.time) && <p className="mt-2 text-[12px] font-bold text-amber-600 dark:text-amber-400">Heads up - something is already on your calendar then.</p>}
                <p className="mt-3 text-[12px] font-medium text-gray-500 dark:text-gray-400">{first} gets an email, and their showing link switches from Pending to Confirmed.</p>
                {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <button type="button" disabled={saving} onClick={() => { setStage('pick'); setError('') }} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={confirmChosen} disabled={saving}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-600 px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60 sm:ml-auto sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Confirm &amp; notify {first}
                  </motion.button>
                </div>
              </motion.div>
            )}
            {stage === 'done' && chosen && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <WhenDoneMoment title="Confirmed" text={<>{when(chosen.date, chosen.time)}. {first} just got an email, and their link now says Confirmed.</>} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <WhenSheet open={sheetOpen} onClose={() => setSheetOpen(false)} mode="datetime" busy={busy}
        value={sheetDate ? { date: sheetDate, time: null } : confirmed ? { date: confirmed.date, time: confirmed.time } : null}
        title="The time you agreed on" kicker="Confirm a showing"
        context={submission.property_address || null} contextSub={`Showing with ${submission.contact_name || first}`}
        intro={busy.length ? 'Crossed-out times are already booked on your calendar.' : undefined}
        doneLabel="Next"
        onDone={v => { if (v.date && v.time) { setChosen({ date: v.date, time: v.time, offered: false }); setStage('confirm'); setError('') } setSheetOpen(false) }} />
    </div>
  )
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr)
  const diffMins = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function FormResultsModal({ isOpen, onClose, form, submissions, isLoading, onToggleReviewed, onDeleteSubmission, initialSubmissionId }: FormResultsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeResultsTab, setActiveResultsTab] = useState<'new' | 'reviewed'>('new')
  const openedInitial = useRef(false)
  useEscapeToClose(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null)
      setActiveResultsTab('new')
      openedInitial.current = false
    }
  }, [isOpen, form?.id])

  // Opened onto one person (a person's chip in the Forms header, a form's only new response, or
  // "View Submission" on a lead's Activity): straight to their answers - no list of names first,
  // and Back closes the window instead of showing that list.
  const solo = Boolean(initialSubmissionId)
  useEffect(() => {
    if (!isOpen || !initialSubmissionId || openedInitial.current) return
    const hit = submissions.find(submission => submission.id === initialSubmissionId)
    if (!hit) return
    openedInitial.current = true
    setActiveResultsTab(hit.is_reviewed ? 'reviewed' : 'new')
    setSelectedId(hit.id)
  }, [isOpen, submissions, initialSubmissionId])

  // Opening someone's answers IS reviewing them - no separate "Mark Reviewed" step (their
  // follow-up is what tracks reaching out).
  const selectedForSeen = selectedId ? submissions.find(submission => submission.id === selectedId) : undefined
  useEffect(() => {
    if (isOpen && selectedForSeen && !selectedForSeen.is_reviewed) onToggleReviewed(selectedForSeen.id, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedForSeen?.id])

  if (!isOpen || !form) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const newSubmissions = submissions.filter(submission => !submission.is_reviewed)
  const reviewedSubmissions = submissions.filter(submission => submission.is_reviewed)
  const pendingCount = newSubmissions.length
  const visibleSubmissions = activeResultsTab === 'new' ? newSubmissions : reviewedSubmissions
  const selected = selectedId ? submissions.find(submission => submission.id === selectedId) || null : null
  const selectedVisibleIndex = selected ? submissions.findIndex(submission => submission.id === selected.id) : -1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleBackdropClick}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-colors dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6">
          <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
            {selected && !solo ? (
              <button
                onClick={() => setSelectedId(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400"
                aria-label="Back to all submissions"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="rounded-xl bg-[#111827] p-2.5 shadow-md dark:bg-white sm:rounded-2xl sm:p-3">
                <FileText className="text-white dark:text-[#111827]" size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black tracking-tight text-[#111827] dark:text-white sm:text-2xl">
                {selected ? (selected.contact_name || 'Anonymous submission') : form.title}
              </h2>
              <p className="mt-0.5 truncate text-xs font-medium text-[#6B7280] dark:text-gray-400 sm:text-sm">
                {selected
                  ? `${new Date(selected.created_at).toLocaleString()}${selected.campaign_name ? ` · Campaign: ${selected.campaign_name}` : ''}`
                  : `${pendingCount} new · ${submissions.length} total`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selected && !solo && (
              <div className="hidden items-center gap-1 sm:flex">
                <button
                  onClick={() => { if (selectedVisibleIndex > 0) setSelectedId(submissions[selectedVisibleIndex - 1].id) }}
                  disabled={selectedVisibleIndex <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-30 dark:border-gray-700 dark:text-gray-400"
                  aria-label="Previous submission"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { if (selectedVisibleIndex !== -1 && selectedVisibleIndex < submissions.length - 1) setSelectedId(submissions[selectedVisibleIndex + 1].id) }}
                  disabled={selectedVisibleIndex === -1 || selectedVisibleIndex === submissions.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-30 dark:border-gray-700 dark:text-gray-400"
                  aria-label="Next submission"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <OhpSpinner size={34} />
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#111827] dark:text-white">No submissions yet</h3>
              <p className="text-[#6B7280] dark:text-gray-400">Submissions from this form will appear here.</p>
            </div>
          ) : selected ? (
            <div className="p-4 sm:p-6">
              <SubmissionDetail key={selected.id} submission={selected} onToggleReviewed={onToggleReviewed}
                onDelete={() => { onDeleteSubmission(selected); if (solo) onClose(); else setSelectedId(null) }} />
            </div>
          ) : (
            <div>
              <div className="flex gap-1 border-b border-gray-100 bg-white px-4 pt-3 dark:border-gray-800 dark:bg-[#151517] sm:px-6">
                {([
                  { id: 'new' as const, label: 'New', count: newSubmissions.length },
                  { id: 'reviewed' as const, label: 'Opened', count: reviewedSubmissions.length },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResultsTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-black transition ${
                      activeResultsTab === tab.id
                        ? 'border-[#C9A24D] text-[#111827] dark:text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      activeResultsTab === tab.id
                        ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:bg-[#C9A24D]/20 dark:text-[#e8cf8a]'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {visibleSubmissions.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-[#6B7280] dark:text-gray-400">
                    {activeResultsTab === 'new' ? "You're all caught up - no new submissions." : 'Nobody opened yet.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleSubmissions.map(submission => (
                    <button
                      key={submission.id}
                      onClick={() => setSelectedId(submission.id)}
                      className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white dark:hover:bg-[#151517] sm:p-5"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          submission.is_reviewed
                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                        }`}
                      >
                        {getInitials(submission.contact_name || '?')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-black text-[#111827] dark:text-white">{submission.contact_name || 'Anonymous'}</p>
                          {!submission.is_reviewed && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">New</span>
                          )}
                        </div>
                        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                          {submission.contact_email || submission.contact_phone || submission.property_address || 'No contact details'}
                          {submission.campaign_name && <span className="text-gray-400"> · Campaign: {submission.campaign_name}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400">{formatRelative(submission.created_at)}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!selected && (
          <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[#111827] px-6 py-3.5 font-bold text-white shadow-lg shadow-[#111827]/10 transition-all duration-300 hover:scale-[1.01] hover:bg-[#C9A24D] hover:shadow-xl dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:py-4"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** One person's answers - contact, the showing (confirm a time), every response, Delete. Used in
 *  the Results window and inline in a form's Results tab (opens in place, no second window). */
export function SubmissionDetail({ submission: selected, onToggleReviewed, onDelete, framed = true }: {
  submission: FormSubmissionListItem
  onToggleReviewed: (submissionId: string, isReviewed: boolean) => Promise<void>
  onDelete: () => void
  /** false = no card of its own (it sits in a card already). */
  framed?: boolean
}) {
  const [showingSaved, setShowingSaved] = useState<Showing | null>(null)
  const groupedSections: { title: string; entries: FormSubmissionAnswer[] }[] = []
  {
    const order: string[] = []
    const map = new Map<string, FormSubmissionAnswer[]>()
    for (const answer of selected.answers) {
      const key = answer.sectionTitle || '__none__'
      if (!map.has(key)) { map.set(key, []); order.push(key) }
      map.get(key)!.push(answer)
    }
    for (const key of order) groupedSections.push({ title: key === '__none__' ? '' : key, entries: map.get(key)! })
  }
  const contactGroups = groupedSections.filter(group => group.entries.some(entry => entry.type === 'email' || entry.type === 'phone'))
  if (contactGroups.length === 0 && (selected.contact_name || selected.contact_email || selected.contact_phone)) {
    contactGroups.push({
      title: '',
      entries: [
        ...(selected.contact_name ? [{ questionId: '__contact_name', label: 'Name', type: 'short_text' as const, value: selected.contact_name }] : []),
        ...(selected.contact_email ? [{ questionId: '__contact_email', label: 'Email', type: 'email' as const, value: selected.contact_email }] : []),
        ...(selected.contact_phone ? [{ questionId: '__contact_phone', label: 'Phone', type: 'phone' as const, value: selected.contact_phone }] : []),
      ],
    })
  }
  const contactEntryIds = new Set(contactGroups.flatMap(group => group.entries.map(entry => entry.questionId)))
  const otherAnswers = selected.answers.filter(answer => !contactEntryIds.has(answer.questionId))
  return (
              <div className={framed ? 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6' : ''}>
                {/* This answer built them a Showcase - one tap to it (user, 10/28). */}
                {selected.showcase_id && (
                  <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
                    <p className="min-w-0 flex-1 text-xs font-bold leading-snug text-emerald-800 dark:text-emerald-200">This answer built {selected.contact_name?.split(' ')[0] || 'them'} a Showcase</p>
                    <OpenShowcaseButton showcaseId={selected.showcase_id} />
                  </div>
                )}
                {selected.form_type === 'showing' && (showingSaved || selected.showing) && (
                  <ShowingConfirmSection
                    submission={selected}
                    showing={(showingSaved || selected.showing)!}
                    onSaved={next => {
                      setShowingSaved(next)
                      if (next.confirmed_date && !selected.is_reviewed) onToggleReviewed(selected.id, true)
                    }}
                  />
                )}
                {selected.property_address && (
                  <div className={contactGroups.length > 0 ? 'border-b border-gray-100 pb-6 dark:border-gray-800' : ''}>
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
                      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
                      Property
                    </h4>
                    <div className="mt-3 flex items-center text-[#6B7280] dark:text-gray-400">
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                        <MapPin size={14} className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <span className="truncate font-medium text-[#111827] dark:text-white">{selected.property_address}</span>
                    </div>
                  </div>
                )}

                {contactGroups.map((group, index) => (
                  <div key={group.title || index} className={index > 0 || selected.property_address ? 'mt-6 border-t border-gray-100 pt-6 dark:border-gray-800' : ''}>
                    <ContactInfoSection title={`Contact ${index + 1}`} entries={group.entries} />
                  </div>
                ))}

                <div className="mt-6 space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800">
                  <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-[#111827] dark:text-white sm:text-xs">
                    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"></span>
                    Full Responses
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {otherAnswers.filter(answer => answer.value !== undefined && answer.value !== null && String(answer.value).trim() !== '').map(answer => (
                      <div key={answer.questionId} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{answer.label}</p>
                        <p className="mt-1 break-words text-sm font-medium text-[#111827] dark:text-gray-100">{answerText(answer)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-6 dark:border-gray-800">
                  <button
                    onClick={onDelete}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                    aria-label="Delete submission"
                    title="Delete submission"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
  )
}
