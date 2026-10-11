'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, ShieldCheck, ShieldAlert, Check } from 'lucide-react'
import api from '@/lib/api-service'
import { startAiActivity, endAiActivity } from '@/lib/aiActivity'

const TONE_LABELS: Record<string, string> = {
  professional: 'Professional', warm: 'Warm', energetic: 'Energetic', luxury: 'Luxury', concise: 'Concise',
}

/**
 * A "write / polish this with AI" button. Opens a small popover (optional tone + a free-text
 * instruction), calls POST /ai/copywrite, and hands the result back via onResult. Every call is
 * metered against the agent's Monthly AI Usage allowance server-side.
 */
export function AiWriteButton({
  purpose,
  getContext,
  onResult,
  label,
  tones,
  className = '',
  disabled = false,
  onSpent,
}: {
  purpose: string
  getContext: () => string
  onResult: (text: string) => void
  label?: string
  /** show a tone picker with these tone keys */
  tones?: string[]
  className?: string
  disabled?: boolean
  /** called after a successful generation, e.g. to refresh a usage meter */
  onSpent?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [tone, setTone] = useState<string>('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isPolish = purpose === 'bio_polish'
  const btnLabel = label ?? (isPolish ? 'Polish with AI' : 'Write with AI')

  const run = async () => {
    setBusy(true); setErr('')
    startAiActivity()
    const res = await api.ai.copywrite({
      purpose,
      context: getContext(),
      tone: tone || undefined,
      instruction: instruction.trim() || undefined,
    })
    endAiActivity()
    setBusy(false)
    if (res.success && res.data) {
      onResult(res.data.text)
      onSpent?.()
      setOpen(false)
      setInstruction('')
    } else {
      setErr(res.error || 'Could not generate. Try again.')
    }
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="group inline-flex items-center gap-1.5 rounded-lg border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#8b7355] transition hover:bg-[#C9A24D]/20 disabled:opacity-40 dark:text-[#d7b974]"
      >
        <Sparkles className="ohp-icon-draw h-3.5 w-3.5" /> {btnLabel}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-[#1A1A1C]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">{btnLabel}</span>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
          </div>

          {tones && tones.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {tones.map(t => (
                <button key={t} onClick={() => setTone(tone === t ? '' : t)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide transition ${
                    tone === t ? 'bg-[#C9A24D] text-[#111827]' : 'border border-gray-200 text-gray-400 dark:border-gray-600'
                  }`}>
                  {TONE_LABELS[t] || t}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder={isPolish ? 'Anything to keep or change? (optional)' : 'Add any extra instructions (optional)'}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />

          {err && <p className="mt-1.5 text-[11px] font-bold text-red-600 dark:text-red-400">{err}</p>}

          <button
            onClick={run}
            disabled={busy}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C9A24D] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#111827] transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? 'Writing…' : isPolish ? 'Polish' : 'Write it'}
          </button>
          <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Uses your monthly AI credits. Review before you publish.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Advisory Fair-Housing / MLS phrase check. Never rewrites — it lists risky phrases with a
 * suggested swap; the agent clicks "Use this" (does a plain string replace on the text) or
 * dismisses. Call the check on demand.
 */
export function ComplianceChips({
  text,
  onApply,
  className = '',
}: {
  text: string
  onApply: (nextText: string) => void
  className?: string
}) {
  const [flags, setFlags] = useState<{ phrase: string; issue: string; suggestion: string }[] | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)

  const check = async () => {
    setBusy(true)
    startAiActivity()
    const res = await api.ai.complianceCheck(text)
    endAiActivity()
    setBusy(false)
    setChecked(true)
    if (res.success && res.data) { setFlags(res.data.flags); setDismissed(new Set()) }
  }

  const apply = (phrase: string, suggestion: string) => {
    onApply(text.split(phrase).join(suggestion))
    setDismissed(d => new Set(d).add(phrase))
  }

  const visible = (flags || []).filter(f => !dismissed.has(f.phrase))

  return (
    <div className={className}>
      <button
        type="button"
        onClick={check}
        disabled={busy || !text.trim()}
        className="group inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D]/50 disabled:opacity-40 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="ohp-icon-draw h-3.5 w-3.5" />}
        Check Fair-Housing wording
      </button>

      {checked && visible.length === 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-green-600 dark:text-green-400">
          <ShieldCheck className="h-3.5 w-3.5" /> No risky phrases found. Your judgment still applies.
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {visible.map(f => (
            <div key={f.phrase} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-900/50 dark:bg-amber-900/15">
              <div className="flex items-start gap-1.5">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    “{f.phrase}” <span className="font-semibold text-amber-700 dark:text-amber-300">— {f.issue}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <button onClick={() => apply(f.phrase, f.suggestion)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white hover:bg-amber-700">
                      <Check className="h-3 w-3" /> Use “{f.suggestion}”
                    </button>
                    <button onClick={() => setDismissed(d => new Set(d).add(f.phrase))}
                      className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30">
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
