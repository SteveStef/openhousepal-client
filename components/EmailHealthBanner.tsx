'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, MailWarning, Send, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { EmailHealth } from '@/types'

/** The agent's own emails (owner, 11/11; first built 10/24 - backend agent_email_health_service):
 *  - weekly: 4 of our emails in a row unopened -> "Your daily digest emails went to weekly" with
 *    That's fine / Make daily again.
 *  - off: then 3 weekly summaries unopened -> "Your digest emails are paused" with Turn back on.
 *  Both say to check junk/spam. Closed while still paused, one small "Turn back on" line stays.
 *  Opening any of our emails puts them straight back to normal. Nothing at all when all is well. */
export default function EmailHealthBanner({ className = '' }: { className?: string }) {
  const [h, setH] = useState<EmailHealth | null>(null)
  const [busy, setBusy] = useState<'' | 'test' | 'restore' | 'dismiss'>('')
  const [note, setNote] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let live = true
    api.emailHealth.get().then(r => { if (live && r.success && r.data) setH(r.data) })
    return () => { live = false }
  }, [])

  const BACK = 'Daily emails are back on.'
  const act = async (kind: 'test' | 'restore' | 'dismiss') => {
    setBusy(kind)
    const r = kind === 'test' ? await api.emailHealth.sendTest() : kind === 'restore' ? await api.emailHealth.restore() : await api.emailHealth.dismiss()
    setBusy('')
    if (!r.success || !r.data) { setNote("That didn't go through - please try again."); return }
    if (kind === 'dismiss') { setH(r.data); setOpen(false); return }
    if (kind === 'restore') {
      setNote(BACK)
      setH(r.data)
      window.setTimeout(() => setOpen(false), 2200)
      return
    }
    setH(r.data)
    setNote((r.data as EmailHealth & { sent?: boolean }).sent
      ? `Sent to ${r.data.email || 'your email'}. Look in your inbox AND junk/spam for "Test email from OpenHousePal".`
      : 'We just sent one - give it a few minutes, then check junk/spam too.')
  }

  if (!h) return null
  const off = h.mode === 'off'
  const weekly = h.mode === 'weekly'
  const back = note === BACK

  // Closed while still paused: one small line at the top.
  if (off && !back && (!h.show_banner || !open)) {
    return (
      <p className={`text-center text-[12px] font-semibold text-gray-500 dark:text-gray-400 ${className}`} data-testid="email-health-small">
        Your digest emails are paused ·{' '}
        <button type="button" onClick={() => act('restore')} disabled={!!busy} className="font-black text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">
          {busy === 'restore' ? 'Turning on…' : 'Turn back on'}
        </button>
      </p>
    )
  }

  const show = (h.show_banner || back) && open && (weekly || off || back)
  const btn = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black transition disabled:opacity-60'
  const dark = `${btn} bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]`
  const light = `${btn} bg-white text-[#111827] ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-white/5 dark:text-white dark:ring-white/15`

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.section
          id="email-health"
          role="alert"
          key="email-health"
          data-testid="email-health-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={`overflow-hidden ${className}`}
        >
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-500/30 dark:bg-[#151517] sm:p-6">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-400 to-[#C9A24D]" />
            {!back && (
              <button onClick={() => act('dismiss')} disabled={!!busy} aria-label="Close"
                className="absolute right-2.5 top-2.5 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white">
                {busy === 'dismiss' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 sm:flex">
                {back ? <Check className="h-5 w-5" /> : <MailWarning className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1 pr-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">{back ? 'Your inbox' : 'Update'}</p>
                <h2 className="mt-1 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">
                  {back ? 'Daily emails are back on' : off ? 'Your digest emails are paused' : 'Your daily digest emails went to weekly'}
                </h2>
                {!back && (
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
                    {off
                      ? <>You didn&apos;t open our last {h.second_strike} weekly summaries, so routine emails (your daily digest, round-ups) are paused until you open one of our emails or turn them back on.</>
                      : <>You haven&apos;t opened our last {h.first_strike} emails, so routine ones (your daily digest, round-ups) now come as one weekly summary.{h.held > 0 && ` ${h.held} update${h.held === 1 ? ' is' : 's are'} waiting for it.`}</>}
                    {' '}<strong className="text-[#111827] dark:text-white">New leads, tour requests and account emails still arrive right away.</strong>
                    {' '}Not seeing our emails? Check your junk or spam folder{h.email ? <> for <strong className="text-[#111827] dark:text-white">{h.email}</strong></> : null} and move ours to your inbox.
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {note && !back && (
                    <motion.p key="note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <span className="mt-3 block rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold leading-snug text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{note}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {!back && (
                <div className="flex shrink-0 flex-col gap-2 sm:mr-7 sm:w-[220px] sm:self-center">
                  {off ? (
                    <button onClick={() => act('restore')} disabled={!!busy} className={dark}>
                      {busy === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Turn back on
                    </button>
                  ) : (
                    <>
                      <button onClick={() => act('restore')} disabled={!!busy} className={dark}>
                        {busy === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Make daily again
                      </button>
                      <button onClick={() => act('dismiss')} disabled={!!busy} className={light}>That&apos;s fine</button>
                    </>
                  )}
                  <button onClick={() => act('test')} disabled={!!busy || !h.can_test}
                    className={`${btn} ${!h.can_test ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' : 'text-gray-600 hover:text-[#111827] dark:text-gray-300 dark:hover:text-white'}`}>
                    {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : h.can_test ? <Send className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {h.can_test ? 'Send me a test email' : 'Test email sent'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
