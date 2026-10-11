'use client'

import { useState } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'

// The home value page's address box: whatever the owner types rides along into the agent's
// "What's my home worth?" form (SiteFormLauncher reads data-ohp-prefill at click time), which
// opens in a window over the page.
export default function HomeValueAddress({ basePrefix, luxe }: { basePrefix: string; luxe: boolean }) {
  const [address, setAddress] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); (e.currentTarget.querySelector('[data-ohp-form]') as HTMLElement | null)?.click() }}
      className={`flex w-full max-w-xl flex-col gap-2 p-2 sm:flex-row ${luxe ? 'rounded-[22px]' : 'rounded-2xl'}`}
      style={{ backgroundColor: 'var(--site-surface)', boxShadow: '0 24px 60px -24px rgba(0,0,0,.45)', border: '1px solid var(--site-line)' }}>
      <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <MapPin className="h-5 w-5 shrink-0" style={{ color: 'var(--site-accent)' }} />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Your home's address" aria-label="Your home's address" autoComplete="street-address"
          className="w-full min-w-0 bg-transparent py-3 text-[15px] font-semibold outline-none" style={{ color: 'var(--site-ink)' }} />
      </label>
      <a href={`${basePrefix}/contact`} data-ohp-form="home_value" data-ohp-form-title="What's my home worth?"
        data-ohp-prefill={JSON.stringify({ property_address: address.trim() })}
        className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-black transition hover:-translate-y-0.5 ${luxe ? 'rounded-[16px]' : 'rounded-xl'}`}
        style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
        Get my home value <ArrowRight className="h-4 w-4" />
      </a>
    </form>
  )
}
