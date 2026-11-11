'use client'

// A payment request the admin sent (Admin > People > Payments). The payer opens the link, sees what
// it's for and how often it charges, and pays with any debit or credit card on PayPal's secure card
// form - once, and then it charges by itself (payment_request_service.py). No sign-in. A card that
// failed later can be replaced here too (same link).
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Lock, Repeat, ShieldCheck, Users, XCircle } from 'lucide-react'
import api from '@/lib/api-service'
import type { PublicPaymentRequest } from '@/types'
import CardPay from '@/components/CardPayButtons'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'

const EVERY: Record<string, string> = { once: 'one time', monthly: 'every month', quarterly: 'every 3 months', semiannual: 'every 6 months', yearly: 'every year' }
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
const day = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''

export default function PayPage() {
  const { token } = useParams<{ token: string }>()
  const [req, setReq] = useState<PublicPaymentRequest | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingSub, setPendingSub] = useState<string | null>(null)
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    document.title = 'Payment | OpenHousePal'
    api.paypal.getPaymentRequest(token).then(r => {
      if (r.success && r.data) setReq(r.data)
      else setMissing(true)
    })
  }, [token])

  const finish = useCallback(async (subscriptionId: string) => {
    setBusy(true); setError(''); setPendingSub(subscriptionId)
    const r = await api.paypal.confirmPaymentRequest(token, subscriptionId)
    setBusy(false)
    if (r.success && r.data) { setReq(r.data); setPendingSub(null); setJustPaid(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else if (r.error && /refunded/i.test(r.error)) {
      // Not kept (paid twice, or the request changed while this page was open) - show what's true now.
      setPendingSub(null); setError(r.error)
      const fresh = await api.paypal.getPaymentRequest(token)
      if (fresh.success && fresh.data) setReq(fresh.data)
    }
    else setError(r.error || 'We couldn’t confirm the payment yet - tap Finish to try again.')
  }, [token])

  if (!req && !missing) return <OhpLoader label="Loading payment" />

  const recurring = req?.cycle !== 'once'
  const done = req && (req.status === 'active' || req.status === 'paid')
  const closed = req && (req.status === 'cancelled' || req.status === 'ended')
  const covers = req ? [req.plan_name ? `OpenHousePal ${req.plan_name}` : null, req.seats ? `${req.seats} ${req.seats === 1 ? 'person' : 'people'}` : null, req.group_name].filter(Boolean).join(' · ') : ''

  return (
    <main className="min-h-screen bg-[#f6f2ea] px-4 py-8 text-[#111827] sm:py-14 dark:bg-[#0B0B0B] dark:text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center"><OhpWordmark className="h-7 text-[26px]" /></div>

        {missing || !req ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-10 w-10 text-gray-300" />
              <h1 className="text-xl font-black">This payment link isn’t valid</h1>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Check the link in your email, or reply to it and we’ll send a new one.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827] dark:from-[#C9A24D]/30 dark:to-[#C9A24D]/30" />
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9a7a35] dark:text-[#e6c47c]">
              {done ? (recurring ? 'All set' : 'Paid') : req.status === 'past_due' ? 'Payment issue' : 'Payment request'}
            </p>
            <h1 className="mt-1.5 text-[26px] font-black leading-tight tracking-tight [text-wrap:balance]">{req.title}</h1>
            {req.payer_name && <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">For {req.payer_name}</p>}

            <div className="mt-5 flex items-end gap-2">
              <span className="text-[40px] font-black leading-none tracking-tight">{money(req.amount)}</span>
              <span className="pb-1 text-sm font-bold text-gray-500 dark:text-gray-400">{EVERY[req.cycle]}{recurring && req.total_payments ? `, ${req.total_payments} payments` : ''}</span>
            </div>

            <div className="mt-5 space-y-2.5 rounded-2xl bg-[#faf7f1] p-4 dark:bg-white/[0.04]">
              {covers && <Row icon={Users} label="Covers" value={covers} />}
              {recurring && !done && !closed && (
                <Row icon={Repeat} label="How it works" value={`Charged when you pay, then automatically ${EVERY[req.cycle]} on the same day${req.total_payments ? ` until ${req.total_payments} payments are made` : ''}. You can ask us to stop it any time.`} />
              )}
              {done && recurring && req.next_charge_at && <Row icon={CalendarClock} label="Next charge" value={`${money(req.amount)} on ${day(req.next_charge_at)}`} />}
              {done && req.payments_count > 0 && <Row icon={CheckCircle2} label="Paid so far" value={`${req.payments_count} ${req.payments_count === 1 ? 'payment' : 'payments'}${req.last_paid_at ? ` · last on ${day(req.last_paid_at)}` : ''}`} />}
            </div>

            {req.note && !done && <p className="mt-4 whitespace-pre-line rounded-2xl border border-gray-200 p-4 text-sm font-medium leading-relaxed text-gray-600 dark:border-white/10 dark:text-gray-300">{req.note}</p>}

            {(done || closed) && error && (
              <p className="mt-6 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-semibold text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
            {done ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                <p className="flex items-center gap-2 text-base font-black text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /> {justPaid ? 'Thank you - you’re all set' : 'This is paid and set up'}</p>
                <p className="mt-1 text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80">
                  {recurring ? 'Your card is saved securely with PayPal and charges by itself - nothing else to do.' : 'Nothing else to do.'} PayPal emails a receipt for each payment.
                </p>
              </div>
            ) : closed ? (
              <div className="mt-6 flex items-start gap-2 rounded-2xl bg-gray-100 p-4 text-sm font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {req.status === 'ended' ? 'All payments for this are done.' : 'This payment request was cancelled - no more charges.'}
              </div>
            ) : (
              <div className="mt-6">
                {req.status === 'past_due' && (
                  <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-semibold text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> The last payment didn’t go through. Put in a card again below - it replaces the old one.
                  </p>
                )}
                {req.start ? (
                  <div className="relative">
                    <CardPay start={req.start} onApproved={finish} onError={setError} disabled={busy} />
                    {busy && <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/80 dark:bg-[#151517]/85"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>}
                  </div>
                ) : <p className="text-sm font-semibold text-gray-500">This request can’t be paid right now - reply to the email and we’ll sort it out.</p>}
                {error && (
                  <div className="mt-3 text-sm font-bold text-red-600 dark:text-red-400">
                    {error}
                    {pendingSub && <button onClick={() => finish(pendingSub)} className="ml-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-black text-white">Finish</button>}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Card details go straight to PayPal - OpenHousePal never sees them <Lock className="h-3 w-3" />
        </p>
      </div>
    </main>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="relative overflow-hidden rounded-[1.75rem] border border-white bg-white p-6 pt-7 shadow-[0_18px_50px_-24px_rgba(17,24,39,.35)] max-sm:p-5 dark:border-white/[0.06] dark:bg-[#151517]">{children}</div>
}

function Row({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-sm font-semibold leading-snug text-gray-700 dark:text-gray-200">{value}</p>
      </div>
    </div>
  )
}
