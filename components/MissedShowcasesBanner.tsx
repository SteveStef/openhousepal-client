'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Layout, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

type Missed = Awaited<ReturnType<typeof api.openHouses.getMissedShowcases>>['data']

/**
 * The Basic agent's "you'd be getting these right now" backlog: guests without an agent who
 * signed in at their open houses and would already have their own Showcase + invite on Premium.
 * Not a hypothetical - upgrading runs backfill_missed_showcases() on the backend, which builds and
 * sends every one of these. Renders nothing unless the agent is on Basic with a real backlog.
 */
export default function MissedShowcasesBanner({ compact = false, ctaHref = '/upgrade-required?feature=Showcases&tier=PREMIUM', className = '' }: { compact?: boolean; ctaHref?: string; className?: string }) {
  const { user } = useAuth()
  const [missed, setMissed] = useState<Missed | null>(null)

  useEffect(() => {
    if (user?.plan_tier !== 'BASIC') return
    let cancelled = false
    api.openHouses.getMissedShowcases().then(res => {
      if (!cancelled && res.success && res.data) setMissed(res.data)
    })
    return () => { cancelled = true }
  }, [user?.plan_tier])

  if (!missed || !missed.upgrade_eligible || missed.count === 0) return null

  const names = missed.recent.slice(0, 3).map(item => item.name.split(' ')[0]).filter(Boolean)
  const others = missed.count - names.length
  const who = names.length
    ? `${names.join(', ')}${others > 0 ? ` and ${others} other${others === 1 ? '' : 's'}` : ''}`
    : `${missed.count} guest${missed.count === 1 ? '' : 's'}`

  return (
    <div className={`${className} relative overflow-hidden rounded-2xl border border-[#C9A24D]/50 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820] p-4 sm:p-5 text-white shadow-[0_14px_40px_-14px_rgba(201,162,77,0.6)]`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#C9A24D]/25 blur-2xl" />
      <div className={`relative flex ${compact ? 'flex-col gap-3' : 'flex-col gap-4 sm:flex-row sm:items-center'}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D] text-[#111827] shadow-md">
            <Layout className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">You&apos;re missing out right now</p>
            <p className="mt-0.5 text-base font-black leading-snug sm:text-lg">
              {missed.count} open house guest{missed.count === 1 ? '' : 's'} without an agent would already have their own Showcase.
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-gray-300">
              {who} signed in with no agent in the last {missed.window_days} days. On Premium, each would have gotten a personalized Showcase of matching homes plus instant alerts on new listings and price drops - with you as their agent. Upgrade and every one of them gets their Showcase and invite automatically.
            </p>
          </div>
        </div>
        <Link
          href={ctaHref}
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] px-5 py-3 text-sm font-black text-[#111827] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-[#C9A24D]/40"
        >
          <Sparkles className="h-4 w-4" />
          Send {missed.count === 1 ? 'Their' : `All ${missed.count}`} Showcase{missed.count === 1 ? '' : 's'}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
