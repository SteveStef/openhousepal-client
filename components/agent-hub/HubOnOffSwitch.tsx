'use client'

// The Agent Hub on/off switch (owner, 11/18: "people just don't want the feature"). On by default.
// Off = the Hub's own link (openhousepal.com/<name>), its Sales/Listings pages stop opening and drop
// out of Google, and nothing links to it any more (new Brag Sheet codes, Guest Passes, Spotlights,
// forms, the email signature). Forms, the review link and blogs keep working; an IDX agent's live
// website keeps showing it inside its own About / Sales pages. Nothing is deleted.
// Lives only here, at the top of Tools -> Agent Hub. Backend: PUT /agent-hub/me/visibility.
import { useEffect, useState } from 'react'
import { EyeOff, Globe } from 'lucide-react'
import api from '@/lib/api-service'
import OhpSwitch from '@/components/ui/OhpSwitch'
import DomainWarningSheet from '@/components/domains/DomainWarningSheet'

export default function HubOnOffSwitch({ onChange }: { onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState<boolean | null>(null)
  const [siteLive, setSiteLive] = useState(false)
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [askOff, setAskOff] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.agentHub.getMine().then(r => {
      if (r.success && r.data) {
        setOn(r.data.is_public !== false)
        setSiteLive(!!r.data.idx_site_live)
        setSlug(r.data.slug || '')
      }
    })
  }, [])

  const save = async (next: boolean) => {
    setBusy(true)
    setError('')
    const r = await api.public.setHubVisibility(next)
    setBusy(false)
    if (r?.success && r.data) {
      setOn(r.data.is_public)
      setSiteLive(!!r.data.idx_site_live)
      onChange?.(r.data.is_public)
    } else {
      setError("Couldn't save that - try again.")
    }
  }

  if (on === null) return null
  const link = slug ? `openhousepal.com/${slug}` : 'your Agent Hub link'
  return (
    <div data-testid="hub-onoff" className={`mt-4 flex items-start justify-between gap-4 rounded-2xl border p-4 shadow-sm sm:p-5 ${on
      ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'
      : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-900/10'}`}>
      <DomainWarningSheet open={askOff} onClose={() => setAskOff(false)} onConfirm={() => save(false)}
        title="Turn off your Agent Hub?" subtitle="Nothing is deleted"
        points={[
          { text: <><b className="font-mono">{link}</b> stops opening, and Google drops it over the next few weeks.</> },
          { text: <>Nothing links to it any more: new Brag Sheet QR codes, Guest Passes, Listing Spotlights, forms and your email signature leave it out. Copy your signature again to take the button off one you already pasted.</> },
          { text: <>Your forms, your review link and your blog posts keep working.</>, tone: 'ok' },
          ...(siteLive ? [{ text: <>Your IDX website&apos;s About and Sales pages keep showing it while your website is on.</>, tone: 'ok' as const }] : []),
          { text: <>Everything in it is kept - turn it back on any time and it&apos;s back exactly as it was.</>, tone: 'ok' },
        ]}
        confirmLabel="Turn it off" cancelLabel="Keep it on" />
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]' : 'bg-amber-500 text-white'}`}>
          {on ? <Globe className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#111827] dark:text-white">{on ? 'Your Agent Hub is on' : 'Your Agent Hub is off'}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {on
              ? <>Anyone with <span className="font-mono">{link}</span> can open it, and Google can find it. Don&apos;t use the Agent Hub? Turn it off.</>
              : <><span className="font-mono">{link}</span> doesn&apos;t open, it&apos;s out of Google, and nothing links to it. Your forms, review link and blogs still work{siteLive ? ', and your website still shows it' : ''}. You can keep editing it here.</>}
          </p>
          {error && <p className="mt-1.5 text-xs font-bold text-red-500">{error}</p>}
        </div>
      </div>
      <OhpSwitch on={on} busy={busy} disabled={busy} label="Agent Hub on or off" testId="hub-onoff-switch"
        onChange={next => (next ? save(true) : setAskOff(true))} />
    </div>
  )
}
