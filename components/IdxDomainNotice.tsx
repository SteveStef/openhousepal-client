'use client'

import { useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'

// Shared between Settings (an IDX agent's permanent reminder) and the upgrade flow (Settings ->
// Subscription's "Switch to IDX" confirmation, and the upgrade-required pitch when IDX is the
// target tier) - one place to keep the copy and layout in sync instead of two banners drifting
// apart. Click-to-expand instead of a wall of text always showing, since most of the time the
// one-line summary is all anyone needs.
const DETAILS = [
  'Every sign-in sheet, cheat sheet, form, blog post, and showcase link you generate from now on points to your IDX domain instead of the shared app link.',
  'This starts as a free subdomain under openhousepal.com (like the example above) - connect your own custom domain any time in Tools → Site.',
  'Anything you already shared or printed before switching still shows the old link - reprint or reshare it if you want that copy on your new domain too.',
  'Your login, dashboard, and Agent Hub link all stay exactly the same - only the tools you publish out move to the IDX domain.',
]

export function IdxDomainNotice({ baseUrl, defaultOpen = false, subtle = false, className = '' }: { baseUrl?: string | null; defaultOpen?: boolean; subtle?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen)

  // `subtle` - a quiet cream/gold card for placements (like Settings) where the full navy-and-
  // gold treatment would out-shout the page header. Same content, far less visual weight.
  if (subtle) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] dark:bg-[#C9A24D]/[0.08] ${className}`}>
        <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]">
            <Globe className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Everything Through IDX</p>
            <p className="break-words text-xs font-bold leading-snug text-[#111827] dark:text-gray-200">
              Sign-ins, cheat sheets, forms, blogs &amp; showcases {baseUrl ? 'now use' : 'will use your IDX domain'}
              {baseUrl && (
                <span className="mt-0.5 block break-all font-black text-[#8b7355] underline decoration-[#C9A24D]/50 underline-offset-2 dark:text-[#d7b974]">{baseUrl}</span>
              )}
            </p>
          </div>
          <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-[#8b7355] transition-transform duration-200 dark:text-[#d7b974] ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="border-t border-[#C9A24D]/20 px-4 py-3">
            <ul className="space-y-1.5">
              {DETAILS.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border-2 border-[#C9A24D] bg-gradient-to-r from-[#111827] via-[#172033] to-[#4a3820] shadow-[0_14px_32px_-16px_rgba(201,162,77,0.65)] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D] text-[#111827] shadow-md">
          <Globe className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Everything Through IDX</p>
          <p className="break-words text-sm font-bold leading-snug text-white">
            Sign-ins, cheat sheets, forms, blogs &amp; showcases {baseUrl ? 'now use' : 'will use your IDX domain'}
            {baseUrl && (
              <span className="mt-0.5 block break-all font-black text-[#C9A24D] underline decoration-[#C9A24D]/60 underline-offset-2">{baseUrl}</span>
            )}
          </p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-[#C9A24D] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-white/10 px-5 py-4">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Everything You Need to Know</p>
          <ul className="space-y-2">
            {DETAILS.map((detail, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-medium leading-relaxed text-gray-200">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
