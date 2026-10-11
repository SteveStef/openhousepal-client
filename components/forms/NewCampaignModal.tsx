'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import CampaignRedirectPicker, { CampaignRedirect, DEFAULT_CAMPAIGN_REDIRECT, campaignRedirectError } from './CampaignRedirectPicker'

const EXAMPLE_NAMES = ['Villanova Mailer', 'Facebook Ad', 'September Postcard', 'Open House Flyer']

interface NewCampaignModalProps {
  onClose: () => void
  onCreate: (name: string, redirect: CampaignRedirect) => Promise<boolean>
  /** The form's own Redirect to Agent Hub switch - what "Same as this form" means. */
  formGoesToHub?: boolean
}

export default function NewCampaignModal({ onClose, onCreate, formGoesToHub = true }: NewCampaignModalProps) {
  const [name, setName] = useState('')
  const [redirect, setRedirect] = useState<CampaignRedirect>(DEFAULT_CAMPAIGN_REDIRECT)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give this campaign a name.'); return }
    const linkError = campaignRedirectError(redirect)
    if (linkError) { setError(linkError); return }
    setIsCreating(true)
    setError('')
    const success = await onCreate(trimmed, redirect)
    setIsCreating(false)
    if (!success) setError('Unable to create this campaign. Please try again.')
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleBackdropClick}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">New Campaign</p>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-xs font-semibold text-gray-400">Same form, new tracking link.</p>

        <div className="mt-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Campaign Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. Villanova Mailer"
            className="mt-1.5 w-full rounded-lg border border-gray-300 bg-[#fbfaf7] px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />
          <p className="mt-1.5 text-xs font-medium text-gray-400">Name it based on where you plan to use this link.</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLE_NAMES.map(example => (
              <button
                key={example}
                type="button"
                onClick={() => { setName(example); setError('') }}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:border-[#C9A24D] dark:hover:text-[#e8cf8a]"
              >
                {example}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <CampaignRedirectPicker value={redirect} onChange={v => { setRedirect(v); setError('') }} formGoesToHub={formGoesToHub} />
          </div>

          {error && <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-[#fbfaf7] px-3 py-2.5 text-xs font-black text-gray-600 transition active:scale-95 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-black text-white transition active:scale-95 hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
          >
            {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Create Campaign
          </button>
        </div>
      </div>
    </div>
  )
}
