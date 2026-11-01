'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import MotionModal from '@/components/ui/MotionModal'
import { tidyAllCaps } from '@/lib/cheatSheetContent'
import { VisitorShowcaseSwitch } from '@/app/open-houses/components/VisitorExtras'

export type LeadOhShowcase = {
  visitor_id: string | null
  open_house_id?: string | null
  address?: string | null
  signed_in_at?: string | null
  has_agent?: string | null
  plan?: boolean
  switchable?: boolean
  showcase_on?: boolean
  showcase_id?: string | null
  showcase_invite_at?: string | null
  showcase_invite_delay?: number | null
}

const street = (a?: string | null) => tidyAllCaps((a || '').split(',')[0].trim())

/**
 * The open house Visitors window's Showcase switch, on their lead (owner, 11/01) - for a guest who
 * signed in at one of the agent's open houses. `asked` = the agent just changed "has an agent" on
 * this lead: no agent -> "give them a Showcase?", has an agent with a Showcase on -> "turn it off?".
 * A hook so the lead's one Showcase card can hold the switch (phone + desktop copies share it);
 * `modal` is rendered once by the page. `onChanged` reloads the lead after a switch (a new Showcase).
 */
export function useLeadOhShowcase({ leadId, represented, asked, onAsked, onChanged }: {
  leadId: string
  represented: string | null
  asked: 'yes' | 'no' | null
  onAsked: () => void
  onChanged?: () => void
}) {
  const { showToast } = useToast()
  const [data, setData] = useState<LeadOhShowcase | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await api.leads.openHouseShowcase(leadId)
    if (r.success && r.data) setData(r.data)
    return r.success ? r.data ?? null : null
  }, [leadId])
  // Reload when the agent answer changes - the switch shows / hides with it. `asked` is set once the
  // save has finished (the page changes `represented` before it, optimistically).
  useEffect(() => { if (represented != null) load() }, [load, represented, asked])

  const set = async (on: boolean) => {
    if (!data?.visitor_id) return
    setBusy(true)
    setData({ ...data, showcase_on: on })
    const r = await api.openHouses.setVisitorShowcase(data.visitor_id, on)
    const at = r.data?.invite_at ? new Date(r.data.invite_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
    if (!r.success) showToast(r.error || "Couldn't change their Showcase", 'error')
    else if (on) showToast(`${r.data?.building ? 'Making their Showcase now' : 'Their Showcase is on'}${at ? ` - their invite email goes out at ${at}` : ''}`, 'success')
    else showToast(r.data?.invites_cancelled ? 'Their Showcase is off - the invite email was cancelled' : 'Their Showcase is off', 'success')
    const fresh = await load()
    // A Showcase still being built has no invite saved yet - keep the time it will go out.
    if (on && r.data?.invite_at && fresh && !fresh.showcase_invite_at) setData({ ...fresh, showcase_invite_at: r.data.invite_at })
    setBusy(false)
    if (r.success) onChanged?.()
  }

  // The question after a change - only when there's something to decide.
  // (Waits for data that already has the new answer - never decides on the pre-save copy.)
  const fresh = !!asked && !!data && (!data.visitor_id || (data.has_agent || '').toUpperCase() === (asked === 'yes' ? 'YES' : 'NO'))
  const question = fresh && data?.visitor_id && data.plan
    ? asked === 'no' && data.switchable && !data.showcase_on ? 'make'
      : asked === 'yes' && data.showcase_on ? 'stop' : null
    : null
  useEffect(() => { if (fresh && !question) onAsked() }, [fresh, question, onAsked])

  const show = !!(data?.visitor_id && data.plan && (data.switchable || data.showcase_on))
  const where = street(data?.address)

  const modal = (
    <MotionModal open={!!question} onBackdropClick={onAsked} className="z-[60] bg-black/55">
      <div onClick={e => e.stopPropagation()} data-testid="lead-showcase-ask" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#151517]">
        <h3 className="text-lg font-black text-[#111827] dark:text-white">
          {question === 'make' ? 'No agent - give them a Showcase?' : 'They have an agent - turn their Showcase off?'}
        </h3>
        <p className="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
          {question === 'make'
            ? <>A Showcase sends them homes like the one at {where || 'your open house'}, the same as a guest without an agent gets when they sign in.</>
            : <>Their Showcase keeps sending them homes. Turn it off now that they&apos;re working with another agent?</>}
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={onAsked} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-white/10 dark:text-white">
            {question === 'make' ? 'Not now' : 'Keep it on'}
          </button>
          <button onClick={async () => { onAsked(); await set(question === 'make') }} data-testid="lead-showcase-ask-yes"
            className="flex-1 rounded-xl bg-[#111827] py-2.5 text-sm font-bold text-white dark:bg-white dark:text-[#111827]">
            {question === 'make' ? 'Yes, turn it on' : 'Turn it off'}
          </button>
        </div>
      </div>
    </MotionModal>
  )

  return { data, busy, set, show, where, modal }
}

export type LeadOhShowcaseState = ReturnType<typeof useLeadOhShowcase>

/** The switch + where it came from. `withLink` = no Showcase box under it, so link to the Showcase here. */
export function LeadOhShowcaseSwitch({ oh, withLink }: { oh: LeadOhShowcaseState; withLink?: boolean }) {
  const { data, busy, set, where } = oh
  if (!oh.show || !data) return null
  return (
    <div data-testid="lead-oh-showcase">
      <VisitorShowcaseSwitch
        visitor={{ id: data.visitor_id!, showcase_on: data.showcase_on, showcase_invite_at: data.showcase_invite_at, showcase_invite_delay: data.showcase_invite_delay } as any}
        busy={busy} onToggle={() => set(!data.showcase_on)} />
      {(where || (withLink && data.showcase_id)) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] font-semibold text-gray-400">
          {where && <span>From your open house at {where}</span>}
          {withLink && data.showcase_id && (
            <Link href={`/showcases?showcase=${data.showcase_id}`} className="inline-flex items-center gap-0.5 font-black text-[#8b7355] hover:text-[#111827] dark:text-[#e8c97a]">
              Open their Showcase <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
