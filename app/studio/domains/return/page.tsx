'use client'

// Back from PayPal after buying a domain. Polls the purchase - the backend registers it the moment
// PayPal says year one is paid, then points it at the website (domain_purchase_service.complete).
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import api from '@/lib/api-service'
import { PurchasedDomain, backHref } from '@/lib/domainShop'
import DomainReturnShell, { StepList, StepState } from '@/components/domains/DomainReturnShell'

function ReturnInner() {
  const params = useSearchParams()
  const id = params.get('purchase') || ''
  const back = params.get('back')
  const cancelled = params.get('cancelled') === '1'
  const [p, setP] = useState<PurchasedDomain | null>(null)
  const [slow, setSlow] = useState(false)
  const [cancelState, setCancelState] = useState<string | null>(null)
  const started = useRef(Date.now())

  useEffect(() => {
    if (!id) return
    if (cancelled) {
      api.sites.cancelDomainCheckout(id).then(r => setCancelState(r.data?.status || 'ABANDONED'))
      return
    }
    let stop = false
    const tick = async () => {
      const r = await api.sites.getDomainPurchase(id)
      if (stop) return
      if (r.success && r.data) setP(r.data)
      const s = r.data?.status
      if (s === 'ACTIVE' || s === 'FAILED' || s === 'ABANDONED') return
      if (Date.now() - started.current > 90_000) setSlow(true)
      if (Date.now() - started.current < 15 * 60_000) setTimeout(tick, 3000)
    }
    tick()
    return () => { stop = true }
  }, [id, cancelled])

  const href = backHref(back)
  const label = back === 'setup' ? 'Back to setup' : 'Back to my domain'

  if (cancelled && cancelState !== 'ACTIVE' && cancelState !== 'REGISTERING') {
    return (
      <DomainReturnShell eyebrow="No charge" title="You didn't buy it" backHref={href} backLabel={label} ready={!!cancelState}>
        <p className="mt-3 text-[15px] font-semibold text-gray-500 dark:text-white/60">You left PayPal before paying, so nothing was charged. Pick a name again any time.</p>
      </DomainReturnShell>
    )
  }
  if (p?.status === 'FAILED') {
    return (
      <DomainReturnShell eyebrow="Refunded" title={<>We couldn&apos;t get {p.domain}</>} backHref={href} backLabel={label}>
        <p className="mt-3 text-[15px] font-semibold text-gray-500 dark:text-white/60">Someone may have taken it a moment before you. Your payment is being refunded to PayPal in full - you&apos;ll see it in a few days. Try another name.</p>
      </DomainReturnShell>
    )
  }
  const s = p?.status
  const paid: StepState = s === 'REGISTERING' || s === 'ACTIVE' ? 'done' : 'doing'
  const reg: StepState = s === 'ACTIVE' ? 'done' : s === 'REGISTERING' ? 'doing' : 'todo'
  const live: StepState = s === 'ACTIVE' ? (p?.site_status === 'ACTIVE' ? 'done' : 'doing') : 'todo'
  return (
    <DomainReturnShell
      eyebrow={s === 'ACTIVE' ? 'It’s yours' : 'One moment'}
      title={s === 'ACTIVE' ? <>{p!.domain} is yours!</> : 'Getting your domain'}
      backHref={href} backLabel={label} ready={s === 'ACTIVE'}
    >
      <StepList steps={[
        { label: paid === 'done' ? 'Payment received' : 'Confirming your PayPal payment', state: paid },
        { label: `Registering ${p?.domain || 'your domain'} in your name`, state: reg },
        { label: 'Pointing it at your website', state: s === 'ACTIVE' ? 'done' : 'todo' },
        { label: 'Secure padlock + live', state: live },
      ]} />
      {s === 'ACTIVE' && (
        <>
          <p className="mt-6 text-[15px] font-semibold text-gray-600 dark:text-white/65">
            {p!.site_status === 'ACTIVE'
              ? <>Your website is open at <span className="font-mono font-bold text-[#111827] dark:text-white">www.{p!.domain}</span>.</>
              : <>We set everything up. New domains take a little while to reach every computer - your website opens at <span className="font-mono font-bold text-[#111827] dark:text-white">www.{p!.domain}</span> usually within an hour. We&apos;ll email you when it&apos;s live.</>}
          </p>
          {p!.email_confirmed !== true && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left text-[13px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" /><span>Check {p!.email || 'your email'} for a message from Name.com and click the confirm link inside. If it isn&apos;t clicked within 15 days, the domain pauses.</span>
            </p>
          )}
        </>
      )}
      {slow && s !== 'ACTIVE' && (
        <p className="mt-6 text-[13px] font-semibold text-gray-500 dark:text-white/55">PayPal is taking a little longer than usual. You can leave this page - we&apos;ll finish it and email you.</p>
      )}
    </DomainReturnShell>
  )
}

export default function DomainReturnPage() {
  return <Suspense fallback={null}><ReturnInner /></Suspense>
}
