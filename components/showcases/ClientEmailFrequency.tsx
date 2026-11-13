'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Mail } from 'lucide-react'
import api, { type ClientEmailState } from '@/lib/api-service'
import OhSheet from '@/components/open-house-manager/OhSheet'

type Frequency = 'daily' | 'weekly' | 'biweekly'
const CHOICES: { id: Frequency; label: string; short: string; hint: string }[] = [
  { id: 'daily', label: 'Daily', short: 'Daily', hint: 'New homes and price changes, the day they happen' },
  { id: 'weekly', label: 'Weekly', short: 'Weekly', hint: 'One email a week with everything new' },
  { id: 'biweekly', label: 'Every 2 weeks', short: '2 wks', hint: 'One email every two weeks' },
]
// When they arrive (Eastern) - backend client_email_service.SEND_TIMES.
const TIMES: { id: string; label: string; hint: string }[] = [
  { id: '08:00', label: '8 AM', hint: 'Morning' },
  { id: '12:00', label: 'Noon', hint: 'Midday' },
  { id: '16:30', label: '4:30 PM', hint: 'Afternoon' },
  { id: '19:00', label: '7 PM', hint: 'Evening' },
]

/** Both the picker and the notice on the Showcase listen to this, so a change in one shows in the other. */
export const CLIENT_EMAIL_EVENT = 'ohp-client-email'
export function announceClientEmail(state: ClientEmailState) {
  try { window.dispatchEvent(new CustomEvent(CLIENT_EMAIL_EVENT, { detail: state })) } catch { /* old browser */ }
}

/** The client picks how often (owner, 11/07) and when (11/11) their Showcase emails come. A pull-up
 *  sheet on phones, a window on bigger screens. Hidden while their emails are off: the switch beside
 *  it comes first. The link at the top of their email (?emails=1) opens it. */
export default function ClientEmailFrequency({ shareToken, on, onTurnedOn, fallback = null }: { shareToken: string; on: boolean; onTurnedOn?: () => void; fallback?: React.ReactNode }) {
  const [value, setValue] = useState<Frequency | null>(null)
  const [time, setTime] = useState('16:30')
  const [blocked, setBlocked] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api.public.getEmailFrequency(shareToken).then(r => {
      if (!live || !r.success || !r.data) return
      setValue(r.data.frequency); setBlocked(r.data.blocked); setTime(r.data.send_time || '16:30')
    })
    const hear = (e: Event) => {
      const d = (e as CustomEvent<ClientEmailState>).detail
      if (d) { setValue(d.frequency); setBlocked(d.blocked); if (d.send_time) setTime(d.send_time) }
    }
    window.addEventListener(CLIENT_EMAIL_EVENT, hear)
    return () => { live = false; window.removeEventListener(CLIENT_EMAIL_EVENT, hear) }
  }, [shareToken])

  // "How often & when" at the top of their email lands here with ?emails=1.
  useEffect(() => {
    if (!value || blocked || !on) return
    try {
      const u = new URL(window.location.href)
      if (u.searchParams.get('emails') === '1') {
        setOpen(true)
        u.searchParams.delete('emails')
        window.history.replaceState(window.history.state, '', u.toString())
      }
    } catch { /* ignore */ }
  }, [value, blocked, on])

  if (!value || blocked || !on) return <>{fallback}</>
  const current = CHOICES.find(c => c.id === value) || CHOICES[0]

  const pick = async (id: Frequency) => {
    if (saving) return
    if (id === value) return
    setSaving(id); setError('')
    const r = await api.public.setEmailFrequency(shareToken, id)
    setSaving(null)
    if (r.success && r.data) { setValue(r.data.frequency); announceClientEmail(r.data); onTurnedOn?.() }
    else setError("That didn't save. Please try again.")
  }
  const pickTime = async (id: string) => {
    if (saving || id === time) return
    setSaving(id); setError('')
    const r = await api.public.setEmailTime(shareToken, id)
    setSaving(null)
    if (r.success && r.data) { setTime(r.data.send_time || id); announceClientEmail(r.data) }
    else setError("That didn't save. Please try again.")
  }

  return (
    <>
      <button type="button" onClick={() => { setError(''); setOpen(true) }} data-testid="client-email-frequency" aria-label={`Email updates: ${current.label}. Change how often`}
        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-[#8b7355] transition active:scale-95 dark:text-[#e8c97a] sm:text-[10px]">
        <span className="sm:hidden">{current.short}</span><span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      <OhSheet open={open} onClose={() => setOpen(false)} width="max-w-md" title="Email updates" subtitle="How often, and what time?" icon={<Mail className="h-5 w-5" />} zClass="z-[120]">
        <div className="space-y-2 pb-1" role="radiogroup" aria-label="How often">
          {CHOICES.map((c, i) => {
            const sel = c.id === value
            return (
              <motion.button key={c.id} type="button" role="radio" aria-checked={sel} onClick={() => pick(c.id)} disabled={!!saving} data-testid={`client-frequency-${c.id}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30, delay: i * 0.05 }} whileTap={{ scale: 0.98 }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-70 ${sel ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.04]'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#111827] dark:text-white">{c.label}</span>
                  <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{c.hint}</span>
                </span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${sel ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-300 dark:border-white/20'}`}>
                  {(sel || saving === c.id) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </motion.button>
            )
          })}
        </div>
        <p className="mb-2 mt-4 px-1 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">What time</p>
        <div className="grid grid-cols-4 gap-2 pb-1" role="radiogroup" aria-label="What time">
          {TIMES.map(t => {
            const sel = t.id === time
            return (
              <button key={t.id} type="button" role="radio" aria-checked={sel} onClick={() => pickTime(t.id)} disabled={!!saving} data-testid={`client-time-${t.id}`}
                className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border px-1 py-2 text-center transition-colors active:scale-[0.98] disabled:opacity-70 ${sel ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.04]'}`}>
                <span className="text-sm font-black text-[#111827] dark:text-white">{t.label}</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{t.hint}</span>
              </button>
            )
          })}
        </div>
        <p className="px-1 pb-2 pt-1 text-[11px] font-semibold text-gray-400">Eastern time. Not seeing them? Check your junk or spam folder and move our email to your inbox.</p>
        {error && <p className="px-1 pb-2 text-xs font-bold text-red-600">{error}</p>}
      </OhSheet>
    </>
  )
}
