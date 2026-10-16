'use client'

import { Check, Info } from 'lucide-react'

// The Zillow "Write a review" link - it drops a happy client straight onto Zillow's review form
// (zillow.com/reviews/write/?s=X1-ZU...). A profile link still works, it just makes them hunt for
// the button. Shared by Setup -> Reviews and Studio -> Reviews so both explain it the same way.
export const ZILLOW_REVIEW_PLACEHOLDER = 'https://www.zillow.com/reviews/write/?s=X1-ZU...'

export function zillowLinkKind(url: string): 'empty' | 'write' | 'profile' | 'other' {
  const u = url.trim().toLowerCase()
  if (!u) return 'empty'
  if (!u.includes('zillow.com')) return 'other'
  if (u.includes('/reviews/write')) return 'write'
  return 'profile'
}

export default function ZillowLinkHelp({ value, compact = false }: { value: string; compact?: boolean }) {
  const kind = zillowLinkKind(value)
  const steps: React.ReactNode[] = [
    <>Go to <b>zillow.com</b> and open <b>your agent profile</b> - the page clients see, with your photo and reviews. Can&apos;t find it? Use Zillow&apos;s <b>Find an agent</b> search and look up your name.</>,
    <>Scroll down to <b>Reviews</b> and find the <b>Write a review</b> button.</>,
    <><b>On a computer:</b> right-click <b>Write a review</b> and choose <b>Copy link address</b>.<br /><b>On a phone:</b> press and hold <b>Write a review</b> and tap <b>Copy link</b>.</>,
    <>Paste it here. It starts with <b>zillow.com/reviews/write/</b> - the letters after it are your own Zillow ID, that&apos;s normal.</>,
  ]
  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className={`flex gap-2.5 ${compact ? 'text-[11.5px]' : 'text-[13px]'} font-medium leading-snug text-gray-600 dark:text-gray-300`}>
            <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#006AFF] text-[10px] font-black text-white">{i + 1}</span>
            <span className="min-w-0">{s}</span>
          </li>
        ))}
      </ol>
      {kind === 'write' && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5 shrink-0" /> That&apos;s the one - clients will land right on your Zillow review form.</p>
      )}
      {kind === 'profile' && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] font-bold text-amber-700 dark:text-amber-300"><Info className="mt-[1px] h-3.5 w-3.5 shrink-0" /> That looks like your profile link. It works, but clients then have to find the button themselves - the <b>&nbsp;Write a review&nbsp;</b> link takes them straight to the form.</p>
      )}
      {kind === 'other' && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-rose-600 dark:text-rose-400"><Info className="h-3.5 w-3.5 shrink-0" /> That isn&apos;t a Zillow link - copy it from your Zillow profile (steps above).</p>
      )}
    </div>
  )
}
