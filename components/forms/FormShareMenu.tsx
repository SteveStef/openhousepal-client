'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { copyText } from '@/lib/copyText'

// Small popover (not a full modal) triggered from a form card's Share icon - quick Open/Copy
// access to both link surfaces without navigating anywhere. Everything else about a form (Edit,
// Campaigns, Stats, Results) lives on its detail page now; Share is the one action kept on the
// card itself since it's a pure fire-and-forget lookup, not a place to manage anything.
export default function FormShareMenu({
  ohpUrl, ohpLabel, websiteUrl, websiteLabel,
}: {
  ohpUrl: string
  ohpLabel: string
  websiteUrl?: string | null
  websiteLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [justCopied, setJustCopied] = useState<'ohp' | 'website' | ''>('')

  const copy = (which: 'ohp' | 'website', url: string) => {
    copyText(url)
    setJustCopied(which)
    setTimeout(() => setJustCopied(current => current === which ? '' : current), 1200)
  }

  return (
    <div className="relative">
      <button
        onClick={(event) => { event.stopPropagation(); setOpen(current => !current) }}
        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white"
        title="Share"
        aria-label="Share"
      >
        <Share2 className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(event) => { event.stopPropagation(); setOpen(false) }} />
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[85vw] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-[#151517]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">{ohpLabel}</p>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => window.open(ohpUrl, '_blank', 'noopener,noreferrer')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open link" aria-label="Open link">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => copy('ohp', ohpUrl)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy link" aria-label="Copy link">
                  {justCopied === 'ohp' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {websiteUrl && (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">{websiteLabel || 'Website Link'}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open link" aria-label="Open link">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => copy('website', websiteUrl)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy link" aria-label="Copy link">
                    {justCopied === 'website' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
