'use client'

// People who started a form but never pressed Submit - what they did answer, the question they
// stopped on, when, and where they came from (backend: forms_routes.get_unfinished_responses).
// They didn't send this to the agent, so the copy nudges a gentle, helpful follow-up.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, CheckCircle2, ChevronDown, Copy, Globe, Laptop, Link2, Loader2, Mail, Phone, QrCode, Smartphone, Tablet, UserPlus, UserRound, X,
} from 'lucide-react'
import type { UnfinishedFormResponse } from '@/types'
import api from '@/lib/api-service'
import { copyText } from '@/lib/copyText'

type Filter = 'all' | 'contact' | 'live'

const SOURCE: Record<string, { label: string; icon: typeof QrCode }> = {
  qr: { label: 'QR scan', icon: QrCode }, link: { label: 'Link', icon: Link2 }, website: { label: 'Website', icon: Globe },
}
const DEVICE: Record<string, { label: string; icon: typeof QrCode }> = {
  mobile: { label: 'Phone', icon: Smartphone }, tablet: { label: 'Tablet', icon: Tablet }, desktop: { label: 'Computer', icon: Laptop },
}

function when(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

function show(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '')
}

// Shown next to the button after pressing it: they're always in Leads now - this says whether a
// follow-up was also put on the agent's list + calendar, and if not, why.
const FOLLOWUP_NOTE: Record<string, string> = {
  created: 'Added to your Leads and your Follow-ups.',
  rule_off: "Added to your Leads. No follow-up - you've turned off follow-ups for this form.",
  has_agent: 'Added to your Leads. No follow-up - they said they already have an agent.',
  already_open: 'Added to your Leads. They already have a follow-up waiting, so no second one.',
  not_created: 'Added to your Leads.',
}

function Row({ item, formId, onDismiss, onAdded }: {
  item: UnfinishedFormResponse; formId: string; onDismiss: () => void; onAdded: (leadId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canAdd = !item.leadId && !item.finishedLater && Boolean(item.contactEmail || item.contactPhone)
  const add = async () => {
    setAdding(true); setError(null)
    const r = await api.forms.addUnfinishedToLeads(formId, item.id)
    setAdding(false)
    if (!r.success || !r.data) { setError(r.error || "Couldn't add them - try again."); return }
    const f = r.data.followup
    setNote(r.data.alreadyAdded ? 'Already in your Leads.' : FOLLOWUP_NOTE[f?.created ? 'created' : (f?.reason || 'not_created')])
    onAdded(r.data.leadId)
  }
  const name = item.contactName || item.contactEmail || item.contactPhone || 'Anonymous visitor'
  const pct = item.totalQuestions ? Math.round(((item.lastQuestionNumber || item.answeredCount) / item.totalQuestions) * 100) : 0
  const src = item.source ? SOURCE[item.source] : null
  const dev = item.device ? DEVICE[item.device] : null
  const copy = async () => {
    const text = [name, item.contactEmail, item.contactPhone, '', ...item.answers.map(a => `${a.label}: ${show(a.value)}`)].filter(x => x !== null).join('\n')
    try { await copyText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30, height: 0, marginTop: 0 }}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#121214]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${item.contactName ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8cf8a]' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
          {item.contactName ? item.contactName.trim()[0]?.toUpperCase() : <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[13px] font-black text-[#111827] dark:text-white">{name}</p>
            {item.finishedLater ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Came back and submitted
              </span>
            ) : item.inProgress ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                Filling it out now
              </span>
            ) : (
              <span className="rounded-full bg-[#d55181]/10 px-2 py-0.5 text-[10px] font-black text-[#b83d6a] dark:text-[#e584a8]">
                Stopped at question {item.lastQuestionNumber ?? '?'} of {item.totalQuestions}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {[item.contactEmail, item.contactPhone].filter(Boolean).join(' · ') || 'No contact details yet'}
          </p>
          {item.lastQuestionLabel && !item.finishedLater && (
            <p className="mt-1 truncate text-[11px] font-medium text-gray-600 dark:text-gray-300">
              Last question: <span className="font-bold">&ldquo;{item.lastQuestionLabel}&rdquo;</span>
            </p>
          )}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-[#C9A24D]" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            <span>{when(item.lastActivityAt)}</span>
            {src && <span className="flex items-center gap-1"><src.icon className="h-3 w-3" />{src.label}</span>}
            {dev && <span className="flex items-center gap-1"><dev.icon className="h-3 w-3" />{dev.label}</span>}
            {item.campaignName && <span className="uppercase tracking-wide text-[#8b7355] dark:text-[#e8cf8a]">{item.campaignName}</span>}
            {item.referrer && <span>via {item.referrer}</span>}
          </div>
          {/* Add to Leads: they become a lead with what they answered + a follow-up (no Showcase -
              they didn't finish telling us what they want). */}
          {(canAdd || item.leadId) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {item.leadId ? (
                <Link href={`/leads/${item.leadId}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" /> In your Leads <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={add}
                  disabled={adding}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 dark:bg-white dark:text-[#111827]"
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add to Leads
                </motion.button>
              )}
              {note && <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{note}</span>}
              {error && <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{error}</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.contactEmail && (
            <a href={`mailto:${item.contactEmail}`} title="Email" className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white"><Mail className="h-4 w-4" /></a>
          )}
          {item.contactPhone && (
            <a href={`tel:${item.contactPhone}`} title="Call" className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white"><Phone className="h-4 w-4" /></a>
          )}
          <button onClick={onDismiss} title="Hide from this list" className="rounded-full p-2 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {item.answers.length > 0 && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex w-full items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] font-black text-gray-500 transition hover:bg-gray-50 dark:border-white/5 dark:text-gray-400 dark:hover:bg-white/[0.03]"
          >
            <span>{item.answers.length} answer{item.answers.length === 1 ? '' : 's'} so far</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <dl className="space-y-2 border-t border-gray-100 bg-[#fbfaf7] px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                  {item.answers.map(a => (
                    <div key={a.questionId}>
                      <dt className="text-[10px] font-black uppercase tracking-wide text-gray-400">{a.group && a.group !== a.label ? `${a.group} · ` : ''}{a.label}</dt>
                      <dd className="text-[12px] font-semibold text-[#111827] dark:text-white">{show(a.value)}</dd>
                    </div>
                  ))}
                  <button onClick={copy} className="mt-1 inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">
                    {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy all'}
                  </button>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.li>
  )
}

export default function UnfinishedResponses({ formId, campaign }: { formId: string; campaign?: string | null }) {
  const [items, setItems] = useState<UnfinishedFormResponse[] | null>(null)
  const [retention, setRetention] = useState(90)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let cancelled = false
    setItems(null)
    api.forms.getUnfinished(formId, campaign).then(r => {
      if (cancelled) return
      setItems(r.success && r.data ? r.data.items : [])
      if (r.success && r.data) setRetention(r.data.retentionDays)
    })
    return () => { cancelled = true }
  }, [formId, campaign])

  const shown = useMemo(() => (items || []).filter(i =>
    filter === 'contact' ? Boolean(i.contactEmail || i.contactPhone) && !i.finishedLater
      : filter === 'live' ? i.inProgress
        : true), [items, filter])

  const dismiss = (id: string) => {
    setItems(cur => (cur || []).filter(i => i.id !== id))
    api.forms.dismissUnfinished(formId, id).catch(() => {})
  }

  if (!items) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>

  const counts = {
    all: items.length,
    contact: items.filter(i => (i.contactEmail || i.contactPhone) && !i.finishedLater).length,
    live: items.filter(i => i.inProgress).length,
  }

  return (
    <div>
      <p className="text-[11px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">
        People who started this form but didn&apos;t press Submit, with what they answered and where they stopped. &ldquo;Add to Leads&rdquo; saves them with their answers and adds a follow-up, with the same message you&apos;d send if they&apos;d finished. Kept for {retention} days.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {([['all', 'All'], ['contact', 'Left contact info'], ['live', 'Filling it out now']] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${filter === key
              ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
              : 'border border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400'}`}
          >
            {label} <span className="opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <CheckCircle2 className="h-6 w-6 text-gray-300" />
          <p className="text-sm font-semibold text-gray-400">{items.length ? 'Nothing in this filter.' : 'No unfinished responses - everyone who started, finished.'}</p>
        </div>
      ) : (
        <motion.ul layout className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {shown.map(item => (
              <Row key={item.id} item={item} formId={formId} onDismiss={() => dismiss(item.id)}
                onAdded={leadId => setItems(cur => (cur || []).map(i => i.id === item.id ? { ...i, leadId } : i))} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  )
}
