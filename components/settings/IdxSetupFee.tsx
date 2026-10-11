'use client'

import { useEffect, useState } from 'react'
import { Check, Gift, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import { PRICING_PLANS } from '@/lib/pricing'
import type { User } from '@/types'

/** Going onto IDX for the first time costs a one-time setup fee (paid once, ever), unless a code waives it. */
export const owesIdxSetupFee = (user?: Pick<User, 'plan_tier' | 'idx_setup_settled_at'> | null) =>
  !!user && user.plan_tier !== 'IDX' && !user.idx_setup_settled_at

/** The fee + an optional code box, shown in the "switch to IDX" / "come back on IDX" windows.
 *  `onCode` gets the verified code (or null when cleared); the parent sends it with the request. */
export default function IdxSetupFee({ startsOn, onCode }: { startsOn?: string | null; onCode: (code: string | null) => void }) {
  const [fee, setFee] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [applied, setApplied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const id = PRICING_PLANS.IDX.paypalPlanId
    if (!id || id.startsWith('P-DEFAULT')) return
    api.paypal.planTerms(id).then(({ success, data }) => { if (success && data) setFee(data.setup_fee || null) })
  }, [])

  const apply = async () => {
    const code = text.trim()
    if (!code) return
    setChecking(true); setError('')
    const { success, data, error: err } = await api.auth.verifyBundleCode(code)
    setChecking(false)
    if (success && data && data.kind === 'paypal_plan' && data.plan_tier === 'IDX') {
      setApplied(data.code); onCode(data.code)
    } else {
      setError(success ? "That code isn't for the IDX plan." : (err || "That code isn't valid."))
    }
  }
  const clear = () => { setApplied(null); setText(''); onCode(null) }
  const feeText = fee ? `$${fee.toLocaleString(undefined, { minimumFractionDigits: fee % 1 ? 2 : 0 })}` : '$500'
  const when = startsOn ? new Date(startsOn).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : null

  return (
    <div className="mt-4 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] p-4 text-left">
      {applied ? (
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Code {applied} applied - the {feeText} setup fee is waived.</span>
          </p>
          <button type="button" onClick={clear} className="shrink-0 text-xs font-bold text-gray-500 underline hover:text-gray-800 dark:hover:text-white">Remove</button>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-[#111827] dark:text-white">One-time IDX setup fee: {feeText}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-400">
            PayPal charges it once when you approve. {when ? `Your first IDX month starts ${when}, when your current period ends.` : 'Your monthly IDX price starts after that.'} You only ever pay it once.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Gift className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                id="idx-fee-code"
                value={text}
                onChange={e => { setText(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
                placeholder="Have a code?"
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs font-black uppercase tracking-widest outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
            </div>
            <button type="button" onClick={apply} disabled={checking || !text.trim()}
              className="rounded-xl bg-[#111827] px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
        </>
      )}
    </div>
  )
}
