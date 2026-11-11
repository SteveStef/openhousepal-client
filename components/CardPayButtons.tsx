'use client'

// Every paid checkout (sign-up, Billing restart / plan change, domain buy) pays through PayPal's own
// on-page buttons. On our live account PayPal's "Debit or Credit Card" button works without a PayPal
// login, but paying by logging into PayPal is refused ("PayPal isn't available") until PayPal turns
// it on - so that button shows greyed out "coming soon" (user, 11/10). When PayPal fixes it, set
// NEXT_PUBLIC_PAYPAL_LOGIN_LIVE=true and every checkout shows the normal PayPal buttons again.
import { ReactNode } from 'react'
import { FUNDING, PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import type { CreateSubscriptionActions, OnApproveData } from '@paypal/paypal-js'
import { Loader2, Lock, X } from 'lucide-react'

export const PAYPAL_LOGIN_LIVE = process.env.NEXT_PUBLIC_PAYPAL_LOGIN_LIVE === 'true'

export const PAYPAL_SCRIPT_OPTIONS = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  vault: true,
  intent: 'subscription',
  currency: 'USD',
}

export type SubscriptionStart = { plan_id: string; custom_id?: string; start_time?: string | null }

function makeCreate(start: SubscriptionStart) {
  return (_data: Record<string, unknown>, actions: CreateSubscriptionActions) => actions.subscription.create({
    plan_id: start.plan_id,
    ...(start.custom_id ? { custom_id: start.custom_id } : {}),
    ...(start.start_time ? { start_time: start.start_time } : {}),
    application_context: {
      shipping_preference: 'NO_SHIPPING', brand_name: 'OpenHousePal', user_action: 'SUBSCRIBE_NOW',
      return_url: `${window.location.origin}${window.location.pathname}`, cancel_url: `${window.location.origin}${window.location.pathname}`,
    },
  })
}

/** The pay buttons themselves - must sit inside a PayPalScriptProvider (or use CardPay). */
export function CardPayButtons({ start, onApproved, onCancel, onError, disabled }: {
  start: SubscriptionStart
  onApproved: (subscriptionId: string) => void | Promise<void>
  onCancel?: () => void
  onError?: (message: string) => void
  disabled?: boolean
}) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer()
  const common = {
    createSubscription: makeCreate(start),
    onApprove: async (data: OnApproveData) => { await onApproved(data.subscriptionID || '') },
    onCancel: () => onCancel?.(),
    onError: () => onError?.('The card payment didn’t go through - check the card details and try again.'),
    disabled,
    forceReRender: [start.plan_id, start.custom_id, start.start_time],
  }
  return (
    <div className="space-y-2.5">
      {isPending && (
        <div className="flex h-[45px] items-center justify-center gap-2 rounded-md bg-gray-100 text-xs font-bold text-gray-500 dark:bg-white/5 dark:text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading secure checkout...
        </div>
      )}
      {isRejected && <p className="text-sm font-bold text-red-500">The payment form didn’t load - refresh the page and try again.</p>}
      {/* PayPal's secure frame is a light page: inside a dark-mode page the browser paints it on an
          opaque white box (the "white strip" under the card button). Seat it on a deliberate white
          panel in every mode - colorScheme light keeps the frame see-through onto it, and the card
          form that opens after a tap reads cleanly on it too (11/11). */}
      {PAYPAL_LOGIN_LIVE ? (
        <div style={{ colorScheme: 'light' }} className="rounded-xl border border-gray-200 bg-white p-2.5 pb-1 shadow-sm dark:border-white/10">
          <PayPalButtons {...common} style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe' }} />
        </div>
      ) : (
        <>
          <p className="text-center text-[12px] font-black text-[#111827] dark:text-white">Pay with any debit or credit card</p>
          <div style={{ colorScheme: 'light' }} className="rounded-xl border border-gray-200 bg-white p-2.5 pb-1 shadow-sm dark:border-white/10">
            <PayPalButtons {...common} fundingSource={FUNDING.CARD} style={{ layout: 'vertical', color: 'black', shape: 'rect', label: 'pay' }} />
          </div>
          <div aria-disabled="true" title="Paying with a PayPal account is coming soon"
            className="flex h-[42px] cursor-not-allowed select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-dashed border-gray-300 bg-gray-100 px-2 text-[12px] font-bold text-gray-400 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/35">
            PayPal account <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-white/50">Coming soon</span>
          </div>
        </>
      )}
      <p className="flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-gray-400">
        <Lock className="h-3 w-3" /> Secure checkout by PayPal - no PayPal account needed
      </p>
    </div>
  )
}

/** Buttons with their own PayPal script - for places that don't already load it. */
export default function CardPay(props: Parameters<typeof CardPayButtons>[0]) {
  return (
    <PayPalScriptProvider options={PAYPAL_SCRIPT_OPTIONS}>
      <CardPayButtons {...props} />
    </PayPalScriptProvider>
  )
}

/** A pop-up holding the card checkout - Billing's restart / plan change. */
export function CardPayModal({ open, title, note, start, busy, error, onApproved, onClose, children }: {
  open: boolean
  title: string
  note?: string
  start: SubscriptionStart | null
  busy?: boolean
  error?: string
  onApproved: (subscriptionId: string) => void | Promise<void>
  onClose: () => void
  children?: ReactNode
}) {
  if (!open || !start) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 max-sm:!m-0">
      <div className="absolute inset-0 bg-[#111827]/40 dark:bg-black/60" onClick={busy ? undefined : onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-white bg-[#FAFAF7] p-7 shadow-2xl max-sm:p-5 dark:border-gray-800 dark:bg-[#151517]">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
          className="absolute right-5 top-5 rounded-full p-2 text-gray-400 shadow-sm transition-colors hover:bg-white hover:text-[#111827] disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <h3 className="mb-2 pr-10 text-xl font-black tracking-tight text-[#111827] dark:text-white">{title}</h3>
        {note && <p className="mb-4 text-sm font-medium leading-relaxed text-[#6B7280] dark:text-gray-300">{note}</p>}
        {children}
        <div className="relative">
          <CardPay start={start} onApproved={onApproved} disabled={busy} />
          {busy && <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[#FAFAF7]/85 dark:bg-[#151517]/85"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>}
        </div>
        {error && <p className="mt-3 text-sm font-bold text-red-500">{error}</p>}
      </div>
    </div>
  )
}
