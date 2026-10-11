'use client'

// Where a campaign's visitors land after they submit (user 10/10). Shared by every place a campaign
// is made or edited: Forms' New Campaign window, Studio's create flow and the Studio editor.
// "Same as this form" (null) follows the form's own Redirect to Agent Hub switch - always the
// starting choice for a new campaign.
import { Check } from 'lucide-react'

export type CampaignRedirectMode = 'agent_hub' | 'sales' | 'none' | 'custom'
export interface CampaignRedirect { mode: CampaignRedirectMode | null; url: string }

export const DEFAULT_CAMPAIGN_REDIRECT: CampaignRedirect = { mode: null, url: '' }

const OPTIONS: { mode: CampaignRedirectMode; label: string; hint: string }[] = [
  { mode: 'agent_hub', label: 'My Agent Hub', hint: 'Your page with everything about you' },
  { mode: 'sales', label: 'My Sales & Listings', hint: 'Your current listings and recent sales' },
  { mode: 'none', label: 'Stay on the thank-you screen', hint: 'No redirect' },
  { mode: 'custom', label: 'My own link', hint: 'Any web page you choose' },
]

/** A short line for a campaign card: "After submitting: My Agent Hub". */
export function campaignRedirectLabel(mode: string | null | undefined, url: string | null | undefined, formGoesToHub: boolean): string {
  if (!mode) return `Same as this form (${formGoesToHub ? 'Agent Hub' : 'thank-you screen'})`
  if (mode === 'custom') return url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'My own link'
  return OPTIONS.find(o => o.mode === mode)?.label || 'Same as this form'
}

/** The body the campaign endpoints take. */
export function campaignRedirectPayload(value: CampaignRedirect) {
  return { redirect_mode: value.mode, redirect_url: value.mode === 'custom' ? value.url.trim() : null }
}

/** A typed custom link must look like a web address before it can be saved. */
export function campaignRedirectError(value: CampaignRedirect): string {
  if (value.mode !== 'custom') return ''
  const url = value.url.trim()
  if (!url) return 'Paste the link people should go to.'
  if (/\s/.test(url) || !/^(https?:\/\/)?[^/\s]+\.[^/\s]+/i.test(url)) return 'Enter a full web address, like yourwebsite.com/page.'
  return ''
}

export default function CampaignRedirectPicker({ value, onChange, formGoesToHub, compact = false }: {
  value: CampaignRedirect
  onChange: (v: CampaignRedirect) => void
  formGoesToHub: boolean
  compact?: boolean
}) {
  const row = (selected: boolean, label: string, hint: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 ${compact ? 'py-1.5' : 'py-2'} text-left transition ${selected ? 'border-[#C9A24D] bg-[#C9A24D]/10 dark:bg-[#C9A24D]/15' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-gray-700 dark:bg-[#0B0B0B]'}`}
      aria-pressed={selected}
    >
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#C9A24D] bg-[#C9A24D]' : 'border-gray-300 dark:border-gray-600'}`}>
        {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-[#111827] dark:text-white">{label}</span>
        {!compact && <span className="block text-[11px] font-medium text-gray-400">{hint}</span>}
      </span>
    </button>
  )
  const error = value.mode === 'custom' && value.url.trim() ? campaignRedirectError(value) : ''
  return (
    <div data-testid="campaign-redirect-picker">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">After they submit, send them to</p>
      <div className="mt-1.5 space-y-1.5">
        {row(value.mode === null, 'Same as this form', formGoesToHub ? 'Your Agent Hub (the form\'s setting)' : 'The thank-you screen (the form\'s setting)', () => onChange({ mode: null, url: value.url }), 'default')}
        {OPTIONS.map(o => row(value.mode === o.mode, o.label, o.hint, () => onChange({ mode: o.mode, url: value.url }), o.mode))}
      </div>
      {value.mode === 'custom' && (
        <div className="mt-2">
          <input
            value={value.url}
            onChange={e => onChange({ mode: 'custom', url: e.target.value })}
            placeholder="https://yourwebsite.com/page"
            aria-label="Your link"
            className="w-full rounded-lg border border-gray-300 bg-[#fbfaf7] px-3 py-2 text-sm font-semibold outline-none transition focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />
          {error && <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
