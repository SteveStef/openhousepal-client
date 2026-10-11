'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BellOff, Loader2 } from 'lucide-react'

// One click from a Spotlight alert email ("Stop these emails") - no sign-in, no second step.
function Unsubscribe() {
  const token = useSearchParams().get('token') || ''
  const [state, setState] = useState<{ status: 'working' | 'done' | 'error'; address?: string }>({ status: 'working' })
  useEffect(() => {
    if (!token) { setState({ status: 'error' }); return }
    fetch(`/api/website-property-sites/alerts-unsubscribe?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => setState(ok ? { status: 'done', address: b.address } : { status: 'error' }))
      .catch(() => setState({ status: 'error' }))
  }, [token])
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f1ec] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_4px_24px_rgba(44,36,32,0.06)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3ece0] text-[#8b7355]">
          {state.status === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellOff className="h-5 w-5" />}
        </div>
        <h1 className="mt-4 font-serif text-2xl font-bold text-[#2c2420]">
          {state.status === 'working' ? 'One moment…' : state.status === 'done' ? 'You’re unsubscribed' : 'That link didn’t work'}
        </h1>
        <p className="mt-2 text-sm text-[#5c534b]">
          {state.status === 'done'
            ? `You won’t get any more updates about ${state.address || 'this home'}.`
            : state.status === 'error' ? 'It may have expired. Reply to any update email and we’ll take you off the list.' : ''}
        </p>
      </div>
    </div>
  )
}

export default function SpotlightUnsubscribePage() {
  return <Suspense fallback={null}><Unsubscribe /></Suspense>
}
