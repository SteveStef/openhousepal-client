'use client'

import Link from 'next/link'
import { ArrowRight, Check, EyeOff, Search, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getNavFeatureAccess } from '@/lib/navAccess'

// What Google can and can't find on a plan below IDX, and what IDX changes (owner, 10/30: one
// layered note in each create flow - Agent Hub, Sales, blog articles). openhousepal.com never lists
// an agent's Hub / Sales / Listings (proxy.ts noindex); a Premium article IS listed there (its page
// decides, app/[slug]/blogs/[blogSlug]/layout.tsx). With IDX they all live on the agent's own website.
// IDX agents see nothing; the No-MLS track (no IDX to move to) gets the facts without the upsell.
export type GoogleVisibilityKind = 'hub' | 'sales' | 'blog'

const COPY: Record<GoogleVisibilityKind, { what: string; listed: boolean; now: string; idx: string }> = {
  hub: {
    what: 'Your Agent Hub',
    listed: false,
    now: 'People open it from your link, QR codes, business cards and email signature - it doesn’t come up when someone Googles your name. Same for its Sales and Listings pages.',
    idx: 'Your Agent Hub, Sales and Listings also live on your own website - with your own domain if you like - where Google can find them when people search your name.',
  },
  sales: {
    what: 'Your Sales page',
    listed: false,
    now: 'Anyone you send it to - or who taps it on your Agent Hub - can see it, but Google doesn’t list it.',
    idx: 'Your sales show on your own website, where Google can find them - your track record in front of anyone searching your name or your town.',
  },
  blog: {
    what: 'This article',
    listed: true,
    now: 'Once it’s published, Google can find it on openhousepal.com - leave “Let Google find this article” on.',
    idx: 'It’s also published on your own website, so every article builds your own site on Google and links readers to your town pages and listings.',
  },
}

export default function GoogleVisibilityNote({ kind, planTier, className = '' }: { kind: GoogleVisibilityKind; planTier?: string | null; className?: string }) {
  const { user } = useAuth()
  const plan = planTier ?? user?.plan_tier
  if (!plan || plan === 'IDX') return null
  const idx = getNavFeatureAccess(plan, 'idx_website')
  const canUpgrade = idx.visible && idx.locked
  const c = COPY[kind]

  return (
    <div className={`rounded-2xl border border-[#e7dfcf] bg-[#fffdf8] p-3.5 shadow-[0_14px_34px_-30px_rgba(17,24,39,.55)] dark:border-white/10 dark:bg-white/[0.03] sm:p-4 ${className}`} data-testid={`google-note-${kind}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[#e8c97a] dark:bg-white/10">
          <Search className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">On Google</p>
          <p className="text-[15px] font-black leading-tight text-[#111827] dark:text-white">{c.what}</p>
        </div>
      </div>

      {/* stacked on every screen - side by side read busier on a computer (owner, 10/30) */}
      <div className="mt-3 grid gap-2">
        <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200/80 dark:bg-[#0e0e10] dark:ring-white/10">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${c.listed
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'}`}>
            {c.listed ? <Check className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {c.listed ? 'Google can find it' : 'Not on Google'}
          </span>
          <p className="mt-2 text-[13px] font-medium leading-snug text-gray-600 dark:text-gray-300">{c.now}</p>
        </div>

        {canUpgrade && (
          <div className="relative overflow-hidden rounded-xl bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.32),transparent_55%),linear-gradient(135deg,#0b0f0e,#111827_60%,#2a2218)] p-3 text-white">
            <span aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/20 px-2.5 py-1 text-[11px] font-black text-[#e8c97a]">
              <Sparkles className="h-3.5 w-3.5" /> With IDX: {c.listed ? 'on your own website too' : 'on Google'}
            </span>
            <p className="mt-2 text-[13px] font-medium leading-snug text-white/75">{c.idx}</p>
          </div>
        )}
      </div>

      {canUpgrade && (
        // A new tab, so it never pulls them out of the article / setup step they're in.
        <Link href={idx.upgradeHref} target="_blank" rel="noopener" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-[13px] font-black text-[#111827] shadow-[0_10px_24px_-12px_rgba(201,162,77,.9)] transition hover:-translate-y-0.5 sm:w-auto">
          See the IDX plan <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
