'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MailWarning, RefreshCw, Send, X } from 'lucide-react'
import api from '@/lib/api-service'

type Reminder = { id: string; domain: string; email?: string | null; confirmed: boolean | null; days_left: number | null }

/** Owner, 11/11: a domain bought through OpenHousePal is registered in the agent's own name, and
 *  Name.com emails THEM a "Verify your contact information" link - if it isn't clicked within 15 days
 *  the domain pauses. This stays on the Dash and the Domains screen until Name.com says it's done.
 *  If Name.com can't tell us (confirmed null), the agent can dismiss it. */
export default function DomainConfirmReminder({ className = '', inline = false }: { className?: string; inline?: boolean }) {
  const [list, setList] = useState<Reminder[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const r = await api.sites.getDomainConfirmReminders()
    if (r.success && r.data) setList(r.data.domains || [])
  }, [])
  useEffect(() => { load() }, [load])

  if (!list.length) return null

  const say = (id: string, t: string) => setNote(n => ({ ...n, [id]: t }))
  const resend = async (d: Reminder) => {
    setBusy(d.id + 'r')
    const r = await api.sites.resendDomainEmail(d.id)
    setBusy(null)
    say(d.id, r.success && r.data?.sent ? `Sent again to ${d.email || 'your email'} - it comes from Name.com.` : "Couldn't resend just now - try again in a few minutes.")
  }
  const recheck = async (d: Reminder) => {
    setBusy(d.id + 'c')
    const r = await api.sites.getDomainConfirmReminders()
    setBusy(null)
    if (r.success && r.data) {
      setList(r.data.domains || [])
      if ((r.data.domains || []).some(x => x.id === d.id)) say(d.id, "Name.com doesn't show it confirmed yet - it can take a few minutes after you click.")
    }
  }
  const dismiss = async (d: Reminder) => {
    setBusy(d.id + 'd')
    const r = await api.sites.dismissDomainConfirmReminder(d.id)
    setBusy(null)
    if (r.success) setList(l => l.filter(x => x.id !== d.id)); else say(d.id, r.error || "Name.com still shows it as not confirmed.")
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {list.map(d => {
        const urgent = d.days_left !== null && d.days_left <= 5
        return (
          <section key={d.id} role="alert" data-testid="domain-confirm-reminder"
            className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-[#151517] ${inline ? 'p-4' : 'p-5 sm:p-6'} ${urgent ? 'border-red-300 dark:border-red-500/40' : 'border-amber-300 dark:border-amber-500/40'}`}>
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} />
            {d.confirmed === null && (
              <button type="button" onClick={() => dismiss(d)} aria-label="Dismiss" disabled={!!busy}
                className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-gray-400 hover:bg-black/5 dark:hover:bg-white/10">
                {busy === d.id + 'd' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${urgent ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                <MailWarning className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 pr-6">
                <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${urgent ? 'text-red-600 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  Action needed{d.days_left !== null ? ` · ${d.days_left === 0 ? 'last day' : `${d.days_left} day${d.days_left === 1 ? '' : 's'} left`}` : ''}
                </p>
                <h2 className="mt-1 font-serif text-lg font-black leading-tight text-[#111827] dark:text-white sm:text-xl">
                  Confirm <span className="break-all">{d.domain}</span> from the Name.com email
                </h2>
                <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
                  Name.com sent an email titled <b>&ldquo;Verify Your Contact Information&rdquo;</b> to <b className="break-all">{d.email || 'the email you used'}</b>. Open it and tap <b>Verify Email Address Now</b>. If it isn&apos;t clicked within 15 days of buying, the domain is switched off and your website stops opening there. Not in your inbox? Check junk or spam.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => recheck(d)} disabled={!!busy}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 text-xs font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                    {busy === d.id + 'c' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} I did it - check again
                  </button>
                  <button type="button" onClick={() => resend(d)} disabled={!!busy}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-xs font-black text-[#111827] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                    {busy === d.id + 'r' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send the email again
                  </button>
                </div>
                {note[d.id] && <p className="mt-2 text-xs font-bold text-gray-600 dark:text-gray-300">{note[d.id]}</p>}
                {d.confirmed === null && <p className="mt-2 text-[11px] font-semibold text-gray-400">We couldn&apos;t check with Name.com just now. Already confirmed? Close this.</p>}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
