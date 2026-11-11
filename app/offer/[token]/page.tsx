'use client'

// A sign-up offer (Admin > People > Offers): opened from a QR code at a presentation or a shared
// link. Shows exactly what each plan costs with the offer, then signs them up / takes them to
// checkout with it (backend offer_service.py holds their spot the moment they sign up).
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarClock, Check, Gift, Loader2, ShieldCheck, Sparkles, Users, XCircle } from 'lucide-react'
import api from '@/lib/api-service'
import type { OfferPlanView, OfferTier, PublicOffer } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'
import { PRICING_PLANS } from '@/lib/pricing'

const BRIGHT: OfferTier[] = ['BASIC', 'PREMIUM', 'IDX']
const SIGNUP_KEY: Record<OfferTier, string> = { BASIC: 'basic', PREMIUM: 'premium', IDX: 'idx', NO_MLS: 'no_mls', PRO_NO_MLS: 'pro_no_mls' }
const usd = (n: number) => `$${n.toFixed(2)}`
const day = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : ''

function priceLine(p: OfferPlanView) {
  if (!p.percent_off) return null
  if (p.discount_months == null) return `${p.percent_off}% off, every month`
  if (p.discount_months === 1) return `${p.percent_off}% off your first month, then ${usd(p.full_price)}/mo`
  return `${p.percent_off}% off your first ${p.discount_months} months, then ${usd(p.full_price)}/mo`
}

export default function OfferPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [offer, setOffer] = useState<PublicOffer | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<OfferTier | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Your OpenHousePal offer'
    api.paypal.getOffer(token).then(r => { if (r.success && r.data) setOffer(r.data); else setMissing(true) })
  }, [token])

  const hasPlan = !!user && (!!user.subscription_id || !['PENDING_PAYMENT', null, undefined, ''].includes(user.subscription_status as string | null))

  const take = async (tier: OfferTier) => {
    setError('')
    try { localStorage.setItem('ohp_signup_plan', SIGNUP_KEY[tier]) } catch {}
    if (!user) {
      // New here: sign up first - the sign-up page holds their spot right after the email check.
      try { localStorage.setItem('ohp_offer', token) } catch {}
      router.push(`/register?plan=${SIGNUP_KEY[tier]}`)
      return
    }
    setBusy(tier)
    const r = await api.paypal.claimOffer(token)
    setBusy(null)
    if (r.success) router.push('/checkout')
    else setError(r.error || 'This offer isn’t available any more.')
  }

  if (!offer && !missing) return <OhpLoader label="Loading your offer" />

  const live = offer?.status === 'live'
  const bright = (offer?.plans || []).filter(p => BRIGHT.includes(p.tier))
  const noMls = (offer?.plans || []).filter(p => !BRIGHT.includes(p.tier))
  const bestPct = Math.max(0, ...(offer?.plans || []).map(p => p.percent_off))

  return (
    <main className="min-h-screen bg-[#f6f2ea] px-4 pb-16 pt-8 text-[#111827] sm:pt-12 dark:bg-[#0B0B0B] dark:text-white">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex justify-center"><OhpWordmark className="h-7 text-[26px]" /></div>

        {missing || !offer || !live ? (
          <div className="mx-auto max-w-md rounded-[1.75rem] bg-white p-8 text-center shadow-[0_18px_50px_-24px_rgba(17,24,39,.35)] dark:bg-[#151517]">
            <XCircle className="mx-auto h-10 w-10 text-gray-300" />
            <h1 className="mt-3 text-xl font-black">{missing ? 'This offer link isn’t valid' : offer?.status === 'full' ? 'All the spots are taken' : 'This offer has ended'}</h1>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">You can still sign up at our regular prices, with a free trial on most plans.</p>
            <a href="/pricing" className="mt-5 inline-flex rounded-xl bg-[#111827] px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827]">See plans</a>
          </div>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[2rem] bg-[#111827] px-6 py-10 text-center text-white shadow-xl sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,77,.28),transparent_60%)]" />
              <div className="relative">
                <p className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#e6c47c]"><Sparkles className="h-3.5 w-3.5" /> Exclusive offer</p>
                <h1 className="mx-auto mt-4 max-w-2xl text-[32px] font-black leading-[1.1] tracking-tight [text-wrap:balance] sm:text-[44px]">
                  {offer.headline || (bestPct ? `Up to ${bestPct}% off OpenHousePal` : 'Your OpenHousePal offer')}
                </h1>
                <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                  {bestPct > 0 && <Chip icon={Gift}>{bestPct === Math.min(...offer.plans.map(p => p.percent_off)) ? `${bestPct}% off` : `Up to ${bestPct}% off`}{offer.duration === 'forever' ? ' for good' : offer.duration === 'first' ? ' your first month' : ` for ${offer.months} months`}</Chip>}
                  {offer.waive_idx_fee && offer.plans.some(p => p.tier === 'IDX') && <Chip icon={Check}>${offer.idx_setup_fee} IDX setup fee waived</Chip>}
                  {offer.trial && <Chip icon={ShieldCheck}>{offer.trial_days}-day free trial</Chip>}
                  {offer.expires_at && <Chip icon={CalendarClock}>Ends {day(offer.expires_at)}</Chip>}
                  {offer.spots_left <= 25 && <Chip icon={Users}>{offer.spots_left} {offer.spots_left === 1 ? 'spot' : 'spots'} left</Chip>}
                </div>
              </div>
            </section>

            {hasPlan && (
              <p className="mx-auto mt-6 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                This offer is for new accounts - your account already has a plan.
              </p>
            )}
            {error && <p className="mx-auto mt-6 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

            {bright.length > 0 && (
              <div className={`mt-8 grid gap-4 ${bright.length === 1 ? 'mx-auto max-w-md' : bright.length === 2 ? 'mx-auto max-w-3xl sm:grid-cols-2' : 'md:grid-cols-3'}`}>
                {bright.map(p => <PlanCard key={p.tier} p={p} trial={offer.trial} onTake={take} busy={busy === p.tier} disabled={hasPlan || authLoading || !!busy} />)}
              </div>
            )}
            {noMls.length > 0 && (
              <>
                <p className="mt-10 text-center text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{bright.length ? 'Not a Bright MLS agent?' : 'Plans'}</p>
                <div className={`mt-4 grid gap-4 ${noMls.length === 1 ? 'mx-auto max-w-md' : 'mx-auto max-w-3xl sm:grid-cols-2'}`}>
                  {noMls.map(p => <PlanCard key={p.tier} p={p} trial={offer.trial} onTake={take} busy={busy === p.tier} disabled={hasPlan || authLoading || !!busy} />)}
                </div>
              </>
            )}

            <p className="mx-auto mt-8 max-w-xl text-center text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
              Pay with any debit or credit card. Your price renews automatically as shown - cancel any time in Settings. {offer.trial ? 'Cancel during the free trial and you pay nothing.' : ''}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function Chip({ icon: Icon, children }: { icon: typeof Gift; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 ring-1 ring-white/15"><Icon className="h-3.5 w-3.5 text-[#e6c47c]" /> {children}</span>
}

function PlanCard({ p, trial, onTake, busy, disabled }: { p: OfferPlanView; trial: boolean; onTake: (t: OfferTier) => void; busy: boolean; disabled: boolean }) {
  const meta = PRICING_PLANS[p.tier]
  const line = priceLine(p)
  const today = p.trial_days > 0 ? p.setup_fee : p.offer_price + p.setup_fee
  return (
    <div className="relative flex flex-col rounded-[1.75rem] border border-gray-200/80 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(17,24,39,.4)] dark:border-white/[0.07] dark:bg-[#151517]">
      {p.percent_off > 0 && <span className="absolute -top-3 right-5 rounded-full bg-[#C9A24D] px-3 py-1 text-[11px] font-black text-[#111827] shadow">{p.percent_off}% off</span>}
      <p className="text-lg font-black">{meta.name}</p>
      {'tagline' in meta && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{(meta as { tagline: string }).tagline}</p>}
      <div className="mt-4 flex items-end gap-2">
        <span className="text-[40px] font-black leading-none tracking-tight">{usd(p.offer_price)}</span>
        <span className="pb-1 text-sm font-bold text-gray-400">/month</span>
      </div>
      <p className="mt-1.5 min-h-[20px] text-[13px] font-bold text-[#8b7355] dark:text-[#e6c47c]">{line || 'Regular price'}</p>
      {p.percent_off > 0 && <p className="text-xs font-semibold text-gray-400">Normally {usd(p.full_price)}/month</p>}
      <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm font-semibold text-gray-700 dark:border-white/[0.06] dark:text-gray-200">
        {trial && p.trial_days > 0 && <Li>{p.trial_days === 1 ? '1 day' : `${p.trial_days} days`} free - nothing to pay for the plan today</Li>}
        {p.tier === 'IDX' && (p.setup_fee > 0 ? <Li>${p.setup_fee.toFixed(0)} one-time setup fee at sign-up</Li> : <Li><b>No setup fee</b> <span className="font-medium text-gray-400">(normally ${p.normal_setup_fee.toFixed(0)})</span></Li>)}
        <Li>Due today: <b>{usd(today)}</b></Li>
      </ul>
      <button onClick={() => onTake(p.tier)} disabled={disabled}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] py-3.5 text-sm font-black text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Get this offer
      </button>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{children}</span></li>
}
