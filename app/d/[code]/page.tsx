'use client'

// One-tap "Mark as done" page, linked as the first line of every follow-up's calendar event.
// Opening it checks the follow-up off (the POST runs from the browser, so link-preview bots that
// don't run JS can't trigger it) and takes the event off the agent's calendar. Below it, the
// agent's OTHER follow-ups due today / overdue - "Did you also do these?" - each one tap to clear.
// No login needed - each item's own code is its key, and all a code can do is check that one
// follow-up off or undo it.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
// Plain <a> links into the app on purpose: this page is served as a visitor page (no sign-in
// wrapper), and a client-side <Link> would carry that layout into /leads/tasks and crash it.
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Loader2, Mail, MessageSquare, Phone, RotateCcw, UserPlus, XCircle } from 'lucide-react'
import api from '@/lib/api-service'
import type { PublicFollowup, PublicFollowupOther } from '@/types'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { copyText } from '@/lib/copyText'

function dueLabel(o: PublicFollowupOther): string {
  if (o.overdue) return 'Overdue'
  if (!o.due_at || o.all_day) return 'Today'
  return `Today · ${new Date(o.due_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

/** Who this follow-up is about - stays on the page done or not, so their info (and the one-tap
 * "save to contacts", notes included) never goes away with the follow-up. */
function ContactCard({ code, contact }: { code: string; contact: NonNullable<PublicFollowup['contact']> }) {
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    if (!contact.email) return
    copyText(contact.email).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const btn = 'flex min-w-0 flex-1 flex-col items-center gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-1 py-2 text-[10px] font-black uppercase text-gray-600 transition active:scale-95 hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700 dark:bg-white/5 dark:text-gray-300'
  return (
    <div className="border-t border-gray-100 px-5 py-4 text-left dark:border-gray-800">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b7355] text-sm font-black text-white shadow-sm">
          {(contact.name || contact.email || '?').trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{contact.name || 'Contact'}</p>
          <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {[contact.phone && prettyPhone(contact.phone), contact.email].filter(Boolean).join(' · ') || 'No phone or email given'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {contact.phone && <a href={`tel:${contact.phone}`} className={btn}><Phone className="h-4 w-4" /> Call</a>}
        {contact.phone && <a href={`sms:${contact.phone}`} className={btn}><MessageSquare className="h-4 w-4" /> Text</a>}
        {contact.email && (
          <button type="button" onClick={copyEmail} className={btn}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy email'}
          </button>
        )}
        {contact.email && <a href={`mailto:${contact.email}`} className={btn}><Mail className="h-4 w-4" /> Email</a>}
      </div>
      {/* Plain <a>: a Next route that hands the phone a vCard (Create New Contact, notes included). */}
      <a href={`/d/${encodeURIComponent(code)}/contact`}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-[0.98] hover:brightness-110 dark:bg-white dark:text-[#111827]">
        <UserPlus className="h-4 w-4 text-[#C9A24D]" /> Save {contact.name?.split(' ')[0] || 'them'} to your contacts
      </a>
      <p className="mt-1.5 text-center text-[10px] font-semibold text-gray-400">Name, phone and email filled in - plus what they asked for and your notes.</p>
    </div>
  )
}

export default function MarkDonePage() {
  const { code } = useParams<{ code: string }>()
  const [task, setTask] = useState<PublicFollowup | null>(null)
  const [others, setOthers] = useState<PublicFollowupOther[]>([])
  const [doneOthers, setDoneOthers] = useState<Set<string>>(new Set())
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    api.tasks.publicDone(code).then(r => {
      if (r.success && r.data) {
        setTask(r.data)
        setOthers(r.data.others || [])
        setState('ready')
      } else setState('error')
    })
  }, [code])

  const toggleMain = async () => {
    if (!task) return
    setBusy(code)
    const r = task.done ? await api.tasks.publicUndo(code) : await api.tasks.publicDone(code)
    if (r.success && r.data) setTask(r.data)
    setBusy(null)
  }

  // The list stays as first loaded - checking one off just marks it (and allows undo) instead of
  // making it jump out from under the agent's thumb.
  const toggleOther = async (o: PublicFollowupOther) => {
    const isDone = doneOthers.has(o.code)
    setBusy(o.code)
    const r = isDone ? await api.tasks.publicUndo(o.code) : await api.tasks.publicDone(o.code)
    if (r.success && r.data) {
      setDoneOthers(prev => {
        const next = new Set(prev)
        if (r.data!.done) next.add(o.code); else next.delete(o.code)
        return next
      })
    }
    setBusy(null)
  }

  const remaining = others.filter(o => !doneOthers.has(o.code)).length

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#0B0B0B] via-[#1a2438] to-[#4a3820] px-4 py-8 sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] dark:bg-[#151517]">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm font-bold">Checking it off…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="px-6 py-12">
            <XCircle className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">This link isn&apos;t active</p>
            <p className="mt-1 text-sm font-medium text-gray-500">The follow-up may have been deleted. You can manage all of them in OpenHousePal.</p>
            <a href="/leads/tasks" className="mt-5 inline-block rounded-xl bg-[#C9A24D] px-5 py-2.5 text-sm font-black text-[#111827]">Open Follow-ups</a>
          </div>
        )}

        {state === 'ready' && task && (
          <>
            <div className={`px-6 pb-5 pt-8 transition-colors ${task.done ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-white/5'}`}>
              <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${task.done ? 'bg-emerald-500 shadow-[0_12px_30px_-8px_rgba(16,185,129,0.7)]' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <CheckCircle2 className={`h-9 w-9 ${task.done ? 'text-white' : 'text-gray-400'}`} strokeWidth={2.5} />
              </div>
              <OhpWordmark className="mt-3 text-lg text-[#111827] dark:text-white" />
              <p className="mt-0.5 text-2xl font-black text-[#111827] dark:text-white">{task.done ? 'Done - nice work!' : 'Marked not done'}</p>
              <p className="mt-2 text-base font-black text-[#111827] dark:text-white">{task.title}</p>
              {task.context && <p className="mt-0.5 text-sm font-medium text-gray-500 dark:text-gray-400">{task.context}</p>}
              <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {task.done ? "Checked off in OpenHousePal and crossed out on your calendar." : "Back on your follow-up list and your calendar."}
              </p>
              <button
                onClick={toggleMain}
                disabled={busy === code}
                className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black transition disabled:opacity-60 ${
                  task.done
                    ? 'text-gray-500 hover:bg-white hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                    : 'bg-emerald-500 text-white hover:brightness-105'
                }`}
              >
                {busy === code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : task.done ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {task.done ? 'Undo' : 'Mark as done'}
              </button>
            </div>

            {task.contact && <ContactCard code={code} contact={task.contact} />}

            {others.length > 0 ? (
              <div className="border-t border-gray-100 px-4 py-4 text-left dark:border-gray-800">
                <p className="px-1 text-sm font-black text-[#111827] dark:text-white">Did you also do these?</p>
                <p className="px-1 text-[11px] font-semibold text-gray-400">
                  {remaining > 0 ? `${remaining} more due today - tap any you've already handled.` : "That's everything due today. 🎉"}
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {others.map(o => {
                    const isDone = doneOthers.has(o.code)
                    return (
                      <button
                        key={o.code}
                        onClick={() => toggleOther(o)}
                        disabled={busy === o.code}
                        className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                          isDone
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20'
                            : 'border-gray-200 hover:border-[#C9A24D]/60 hover:bg-[#C9A24D]/5 dark:border-gray-800'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                          {busy === o.code ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" /> : isDone && <Check className="h-3 w-3" strokeWidth={3.5} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] font-black leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-[#111827] dark:text-white'}`}>{o.title}</span>
                          {o.context && <span className="block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{o.context}</span>}
                          <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${isDone ? 'text-emerald-600' : o.overdue ? 'text-red-600 dark:text-red-400' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>
                            {isDone ? <><Check className="h-3 w-3" /> Done · tap to undo</> : <>{o.overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {dueLabel(o)}</>}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="border-t border-gray-100 px-6 py-4 text-xs font-semibold text-gray-400 dark:border-gray-800">Nothing else due today. 🎉</p>
            )}

            <div className="border-t border-gray-100 px-6 py-3 dark:border-gray-800">
              <a href="/leads/tasks" className="text-xs font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Open all follow-ups in OpenHousePal →</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
