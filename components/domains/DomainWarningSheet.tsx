'use client'

// The big "are you sure?" window for domain actions that change where your website and links live
// (owner, 10/24: never a plain browser confirm). Phone = slide-up sheet you can pull down to close;
// computer = centred window. Lists, in plain words, everything that will happen.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2 } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'

export type WarningPoint = { text: React.ReactNode; tone?: 'bad' | 'ok' }

export default function DomainWarningSheet({ open, onClose, onConfirm, title, subtitle, intro, points, confirmLabel, cancelLabel = 'Keep it' }: {
  open: boolean
  onClose: () => void
  /** Runs the action; the window closes when it resolves. */
  onConfirm: () => Promise<unknown> | void
  title: string
  subtitle?: string
  intro?: React.ReactNode
  points: WarningPoint[]
  confirmLabel: string
  cancelLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (busy) return
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false); onClose() }
  }
  return (
    <OhSheet open={open} onClose={() => { if (!busy) onClose() }} width="max-w-lg" title={title} subtitle={subtitle}
      icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClose} disabled={busy}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-[12px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            {cancelLabel}
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={go} disabled={busy} data-testid="domain-warning-confirm"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-3 text-[12px] font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5 disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {confirmLabel}
          </motion.button>
        </div>
      }>
      {intro && <p className="text-[13.5px] font-semibold leading-relaxed text-gray-600 dark:text-white/70">{intro}</p>}
      <p className={`${intro ? 'mt-4 ' : ''}text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]`}>What happens</p>
      <ul className="mt-2.5 space-y-2">
        {points.map((pt, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
            className={`flex items-start gap-2.5 rounded-2xl border p-3 text-[13px] font-semibold leading-snug ${pt.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07] dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50/70 text-[#3b2f14] dark:border-amber-500/20 dark:bg-amber-500/[0.07] dark:text-amber-100'}`}>
            <span className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${pt.tone === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="min-w-0">{pt.text}</span>
          </motion.li>
        ))}
      </ul>
    </OhSheet>
  )
}
