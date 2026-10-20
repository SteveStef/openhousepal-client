'use client'

// Back from the agent's domain company after one-click connect (Domain Connect). If the company can
// also set up the short-address forward, we go straight there; then we check the connection.
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api-service'
import { backHref } from '@/lib/domainShop'
import DomainReturnShell, { StepList } from '@/components/domains/DomainReturnShell'

function ConnectedInner() {
  const params = useSearchParams()
  const id = params.get('d') || ''
  const back = params.get('back') || 'website'
  const state = params.get('state') || 'site'
  const error = params.get('error')
  const [result, setResult] = useState<{ done: boolean; error: string | null; status?: string } | null>(null)

  useEffect(() => {
    if (!id) return
    api.sites.oneClickReturn(id, { state, error, back }).then(r => {
      if (r.success && r.data?.next_url) { window.location.href = r.data.next_url; return }
      setResult(r.success && r.data ? r.data : { done: false, error: 'failed' })
    })
  }, [id, state, error, back])

  const href = backHref(back)
  const label = back === 'setup' ? 'Back to setup' : 'Back to my domain'
  if (result?.error) {
    return (
      <DomainReturnShell eyebrow={result.error === 'cancelled' ? 'Nothing changed' : 'Not connected'}
        title={result.error === 'cancelled' ? 'You didn’t connect it' : 'That didn’t go through'} backHref={href} backLabel={label}>
        <p className="mt-3 text-[15px] font-semibold text-gray-500 dark:text-white/60">
          {result.error === 'cancelled'
            ? 'No changes were made at your domain company. You can try again, or follow the steps by hand.'
            : 'Your domain company didn’t make the change. Try once more, or use the step-by-step guide on the Domain screen.'}
        </p>
      </DomainReturnShell>
    )
  }
  const live = result?.status === 'ACTIVE'
  return (
    <DomainReturnShell eyebrow={result ? 'Connected' : 'One moment'} title={result ? (live ? 'Your domain is live!' : 'All set at your domain company') : 'Finishing up'}
      backHref={href} backLabel={label} ready={!!result}>
      <StepList steps={[
        { label: 'Records added at your domain company', state: result ? 'done' : 'doing' },
        { label: 'Secure padlock + live', state: live ? 'done' : result ? 'doing' : 'todo' },
      ]} />
      {result && !live && (
        <p className="mt-6 text-[15px] font-semibold text-gray-600 dark:text-white/65">Changes take a little while to reach every computer - usually under an hour. We keep checking and email you the moment it&apos;s live.</p>
      )}
    </DomainReturnShell>
  )
}

export default function DomainConnectedPage() {
  return <Suspense fallback={null}><ConnectedInner /></Suspense>
}
