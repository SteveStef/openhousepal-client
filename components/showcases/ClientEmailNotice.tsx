'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, X } from 'lucide-react'
import api, { type ClientEmailState } from '@/lib/api-service'
import { CLIENT_EMAIL_EVENT, announceClientEmail } from './ClientEmailFrequency'

/** Top of the client's Showcase (owner, 11/11). When their emails were slowed to weekly or paused
 *  because they weren't being opened, say so once - with a choice and a junk-folder tip. Opening the
 *  Showcase already counts as being active again (emails go back to normal), so the wording covers
 *  "it happened, and here's where it stands now". Closed, it's gone on every device; while their
 *  emails are still off, one small "Turn back on" line stays. */
export default function ClientEmailNotice({ shareToken, onTurnedOn }: { shareToken: string; onTurnedOn?: () => void }) {
  const [st, setSt] = useState<ClientEmailState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api.public.getEmailFrequency(shareToken).then(r => { if (live && r.success && r.data) setSt(r.data) })
    const hear = (e: Event) => { const d = (e as CustomEvent<ClientEmailState>).detail; if (d) setSt(d) }
    window.addEventListener(CLIENT_EMAIL_EVENT, hear)
    return () => { live = false; window.removeEventListener(CLIENT_EMAIL_EVENT, hear) }
  }, [shareToken])

  if (!st || st.blocked) return null

  const done = (d: ClientEmailState) => { setSt(d); announceClientEmail(d) }
  const choose = async (f: 'daily' | 'weekly') => {
    setBusy(true); setError('')
    const r = await api.public.setEmailFrequency(shareToken, f)
    setBusy(false)
    if (r.success && r.data) { done(r.data); onTurnedOn?.() } else setError("That didn't save. Please try again.")
  }
  const dismiss = async () => {
    setSt(s => (s ? { ...s, notice: null } : s))
    const r = await api.public.dismissEmailNotice(shareToken)
    if (r.success && r.data && 'frequency' in r.data) done(r.data)
  }

  // No news, but their emails are off: one small line.
  if (!st.notice) {
    if (st.emails_on) return null
    return (
      <p className="mb-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400" data-testid="client-email-small">
        Email updates are off ·{' '}
        <button type="button" onClick={() => choose('daily')} disabled={busy} className="font-black text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">
          {busy ? 'Turning on…' : 'Turn back on'}
        </button>
      </p>
    )
  }

  const weekly = st.notice === 'weekly'
  const nowDaily = st.emails_on && st.mode === 'daily'
  const title = weekly ? 'Update: your daily emails switched to weekly' : (st.emails_on ? 'Your email updates were paused' : 'Your email updates are paused')
  const why = "The last few weren't opened"
  const now = weekly
    ? (nowDaily ? ", so we switched to one a week - they're daily again now that you're here." : ", so we're sending one a week instead.")
    : (st.emails_on ? ", so we stopped sending them - they're back on now that you're here." : ', so we stopped sending them for now.')
  const btn = 'min-h-[40px] rounded-xl px-3.5 text-xs font-black disabled:opacity-60'
  const main = `${btn} bg-[#111827] text-white dark:bg-white dark:text-[#111827]`
  const soft = `${btn} border border-gray-200 bg-white text-[#111827] dark:border-white/10 dark:bg-white/[0.06] dark:text-white`

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} data-testid="client-email-notice"
      className="relative mb-4 rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.08] p-4 pr-11 dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/[0.07]">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]"><Mail className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
            {why}{now} Not getting them? Check your junk or spam folder and move our email to your inbox, so they reach you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {weekly ? (
              <>
                <button type="button" onClick={() => choose('weekly')} disabled={busy} className={soft}>{nowDaily ? 'Weekly is fine' : 'That’s fine'}</button>
                <button type="button" onClick={() => choose('daily')} disabled={busy} className={main}>{nowDaily ? 'Keep daily' : 'Make daily again'}</button>
              </>
            ) : st.emails_on ? (
              <>
                <button type="button" onClick={() => choose('weekly')} disabled={busy} className={soft}>Weekly instead</button>
                <button type="button" onClick={dismiss} disabled={busy} className={main}>Got it</button>
              </>
            ) : (
              <button type="button" onClick={() => choose('daily')} disabled={busy} className={main}>Turn email updates back on</button>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
        </div>
      </div>
    </motion.div>
  )
}
