'use client'

import { ReactNode, useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import { useSaveTracker } from '@/components/ui/SaveStatus'

// Follow-ups master switch - the same idea as the IDX website switch: an agent who doesn't use
// Follow-ups turns the whole feature off (no automatic follow-ups, hidden from the Dash, the Leads
// page and the daily email). Every situation's own setting is kept, so turning it back on restores
// exactly what they had. Stored server-side in User.followup_rules._enabled.
const EVENT = 'ohp:followups-enabled'
let cache: { value: boolean; at: number } | null = null
let inflight: Promise<boolean> | null = null

function fetchEnabled(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.value)
  if (!inflight) {
    inflight = api.tasks.autoRules().then(r => {
      const value = r.success && r.data ? r.data.enabled !== false : true
      cache = { value, at: Date.now() }
      inflight = null
      return value
    })
  }
  return inflight
}

export function useFollowupsEnabled() {
  const [enabled, setEnabledState] = useState<boolean | null>(cache ? cache.value : null)
  const [saving, setSaving] = useState(false)
  // On Settings / Setup the page's save status shows this save too (components/ui/SaveStatus).
  const tracker = useSaveTracker()
  useEffect(() => {
    let alive = true
    fetchEnabled().then(v => { if (alive) setEnabledState(v) })
    const onChange = (e: Event) => setEnabledState((e as CustomEvent<boolean>).detail)
    window.addEventListener(EVENT, onChange)
    return () => { alive = false; window.removeEventListener(EVENT, onChange) }
  }, [])
  const setEnabled = async (value: boolean) => {
    setSaving(true)
    const job = async () => {
      const res = await api.tasks.setAutoRules({ enabled: value })
      if (res.success) {
        cache = { value, at: Date.now() }
        window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
      }
      return res
    }
    const r = await (tracker ? tracker.track(job, { key: 'followups-enabled' }) : job())
    setSaving(false)
    return r.success
  }
  return { enabled, saving, setEnabled }
}

export default function FollowupsSwitch({ className = '', children }: { className?: string; children?: ReactNode }) {
  const { enabled, saving, setEnabled } = useFollowupsEnabled()
  const on = enabled !== false
  const toggle = async () => {
    if (on && !confirm('Turn off Follow-ups?\n\nNo new automatic follow-ups will be made, and Follow-ups disappears from your Dashboard, Leads page and daily email. Anything already on your calendar stays there. Your settings are kept - turn it back on any time.')) return
    await setEnabled(!on)
  }
  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
          {on ? <BellRing className="h-[18px] w-[18px]" /> : <BellOff className="h-[18px] w-[18px]" />}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Follow-ups</p>
          <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{enabled === null ? 'Checking…' : on ? 'On - we remind you who to reach out to' : 'Off - no automatic follow-ups'}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {on
              ? 'Already have a CRM that reminds you? Turn this off - OpenHousePal stops making follow-ups and hides them everywhere.'
              : 'Nothing new is added and it’s hidden from your Dashboard, Leads page and daily email. Turn it on to pick up where you left off.'}
          </p>
          {children}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Follow-ups on or off"
        disabled={enabled === null || saving}
        onClick={toggle}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        {saving && <Loader2 className="absolute -left-6 h-4 w-4 animate-spin text-gray-400" />}
      </button>
    </div>
  )
}

// The same master switch as a compact header control (Follow-ups page), sitting beside Add: a
// labelled pill - bell + "Follow-ups On/Off" + the toggle - so it's obvious what it switches.
export function FollowupsHeaderSwitch({ className = '' }: { className?: string }) {
  const { enabled, saving, setEnabled } = useFollowupsEnabled()
  const on = enabled !== false
  const toggle = async () => {
    if (on && !confirm('Turn off Follow-ups?\n\nNo new automatic follow-ups will be made, and Follow-ups disappears from your Dashboard, Leads page and daily email. Anything already on your calendar stays there. Your settings are kept - turn it back on any time.')) return
    await setEnabled(!on)
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Follow-ups on or off"
      title={on ? 'Follow-ups are on - we remind you who to reach out to. Click to turn off (e.g. if your CRM already reminds you).' : 'Follow-ups are off. Click to turn them back on.'}
      disabled={enabled === null || saving}
      onClick={toggle}
      className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl border py-1.5 pl-2 pr-1.5 text-left transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 ${on
        ? 'border-emerald-500/35 bg-white/85 shadow-[0_10px_24px_-14px_rgba(16,185,129,.8)] dark:border-emerald-400/30 dark:bg-white/[0.06]'
        : 'border-gray-300 bg-white/70 dark:border-white/15 dark:bg-white/[0.04]'} ${className}`}
    >
      <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${on ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/50'}`}>
        {on && <span className="absolute inset-0 animate-ping rounded-lg bg-emerald-400/40 [animation-duration:2.4s]" />}
        {on ? <BellRing className="relative h-3.5 w-3.5 group-hover:animate-[ohpRing_.6s_ease-in-out]" /> : <BellOff className="relative h-3.5 w-3.5" />}
      </span>
      <span className="leading-none">
        <span className="block whitespace-nowrap text-[9px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50 sm:tracking-[0.18em]">Follow-ups</span>
        <span className={`mt-1 block text-xs font-black ${on ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-white/60'}`}>{enabled === null ? 'Checking…' : on ? 'On' : 'Off'}</span>
      </span>
      <span className={`relative ml-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
        {saving && <Loader2 className="absolute left-1/2 h-3 w-3 -translate-x-1/2 animate-spin text-gray-500" />}
      </span>
      <style>{'@keyframes ohpRing{0%,100%{transform:rotate(0)}25%{transform:rotate(14deg)}50%{transform:rotate(-12deg)}75%{transform:rotate(8deg)}}'}</style>
    </button>
  )
}
