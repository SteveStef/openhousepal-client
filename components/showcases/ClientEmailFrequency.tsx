'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Mail } from 'lucide-react'
import api from '@/lib/api-service'
import OhSheet from '@/components/open-house-manager/OhSheet'

type Frequency = 'daily' | 'weekly' | 'biweekly'
const CHOICES: { id: Frequency; label: string; short: string; hint: string }[] = [
  { id: 'daily', label: 'Daily', short: 'Daily', hint: 'New homes and price changes, the day they happen' },
  { id: 'weekly', label: 'Weekly', short: 'Weekly', hint: 'One email a week with everything new' },
  { id: 'biweekly', label: 'Every 2 weeks', short: '2 wks', hint: 'One email every two weeks' },
]

/** The client picks how often their Showcase emails come (owner, 11/07). A pull-up sheet on phones, a
 *  window on bigger screens. Hidden while their emails are off: the switch beside it comes first. */
export default function ClientEmailFrequency({ shareToken, on, onTurnedOn, fallback = null }: { shareToken: string; on: boolean; onTurnedOn?: () => void; fallback?: React.ReactNode }) {
  const [value, setValue] = useState<Frequency | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<Frequency | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api.public.getEmailFrequency(shareToken).then(r => {
      if (!live || !r.success || !r.data) return
      setValue(r.data.frequency); setBlocked(r.data.blocked)
    })
    return () => { live = false }
  }, [shareToken])

  if (!value || blocked || !on) return <>{fallback}</>
  const current = CHOICES.find(c => c.id === value) || CHOICES[0]

  const pick = async (id: Frequency) => {
    if (saving) return
    if (id === value) { setOpen(false); return }
    setSaving(id); setError('')
    const r = await api.public.setEmailFrequency(shareToken, id)
    setSaving(null)
    if (r.success && r.data) { setValue(r.data.frequency); onTurnedOn?.(); setOpen(false) }
    else setError("That didn't save. Please try again.")
  }

  return (
    <>
      <button type="button" onClick={() => { setError(''); setOpen(true) }} data-testid="client-email-frequency" aria-label={`Email updates: ${current.label}. Change how often`}
        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-[#8b7355] transition active:scale-95 dark:text-[#e8c97a] sm:text-[10px]">
        <span className="sm:hidden">{current.short}</span><span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      <OhSheet open={open} onClose={() => setOpen(false)} width="max-w-md" title="Email updates" subtitle="How often should we send them?" icon={<Mail className="h-5 w-5" />} zClass="z-[120]">
        <div className="space-y-2 pb-2" role="radiogroup" aria-label="How often">
          {CHOICES.map((c, i) => {
            const on = c.id === value
            return (
              <motion.button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => pick(c.id)} disabled={!!saving} data-testid={`client-frequency-${c.id}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30, delay: i * 0.05 }} whileTap={{ scale: 0.98 }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-70 ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.04]'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#111827] dark:text-white">{c.label}</span>
                  <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{c.hint}</span>
                </span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-300 dark:border-white/20'}`}>
                  {(on || saving === c.id) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </motion.button>
            )
          })}
          {error && <p className="px-1 text-xs font-bold text-red-600">{error}</p>}
        </div>
      </OhSheet>
    </>
  )
}
