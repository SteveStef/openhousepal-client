'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Mail } from 'lucide-react'
import { TOOL_CARD_CSS } from '@/components/ui/LuxeSurface'
import { invitesApi } from '@/lib/invites'

// The Forms & Invites page's own bits: the big Forms | Invites switch, and the warmer card look the
// form cards now wear (the Tools page's ivory-and-gold card: the faint grid, drifting sparkles, the
// tool's big symbol behind it, a gold edge on hover - no blur, so a page of them stays smooth).

export function FormsInvitesSwitch({ view, onChange, formBadge = 0 }: {
  view: 'forms' | 'invites'
  onChange: (v: 'forms' | 'invites') => void

  formBadge?: number
}) {
  // New RSVPs the agent hasn't looked at yet - a red count on the Invites side.
  const [inviteBadge, setInviteBadge] = useState(0)
  useEffect(() => { invitesApi.list().then(r => { if (r.success) setInviteBadge(r.data.reduce((n, i) => n + (i.counts?.unseen || 0), 0)) }) }, [view])
  const items = [
    { id: 'forms' as const, label: 'Forms', sub: 'Capture leads', icon: ClipboardList, badge: formBadge },
    { id: 'invites' as const, label: 'Invites', sub: 'Events & RSVPs', icon: Mail, badge: inviteBadge },
  ]
  return (
    <div className="mt-1" role="tablist" aria-label="Forms or Invites">
      <style>{TOOL_CARD_CSS + FORM_CARD_CSS}</style>
      <div className="relative grid grid-cols-2 gap-1 rounded-[22px] border border-[#C9A24D]/25 bg-white/80 p-1.5 shadow-[0_18px_40px_-34px_rgba(139,115,85,.9)] dark:border-white/[0.08] dark:bg-white/[0.04] sm:inline-grid sm:min-w-[420px]">
        {items.map(it => {
          const on = view === it.id
          return (
            <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.id)} data-testid={`switch-${it.id}`}
              className={`relative flex min-h-[58px] items-center gap-3 rounded-2xl px-3.5 text-left transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-[#111827] hover:bg-[#C9A24D]/[0.08] dark:text-white'}`}>
              {on && <motion.span layoutId="forms-invites-switch" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] shadow-lg shadow-[#111827]/25 dark:from-[#e8c97a] dark:to-[#C9A24D]" />}
              <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-white/10 text-[#e8c97a] dark:bg-black/10 dark:text-[#111827]' : 'bg-[#C9A24D]/12 text-[#8b6d2c] dark:text-[#e8c97a]'}`}>
                <it.icon className="h-[18px] w-[18px]" />
                {it.badge > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#111827]">{it.badge > 9 ? '9+' : it.badge}</span>}
              </span>
              <span className="relative min-w-0">
                <span className="block font-serif text-[17px] font-black leading-tight">{it.label}</span>
                <span className={`block truncate text-[11px] font-bold ${on ? 'text-white/60 dark:text-[#111827]/60' : 'text-gray-400'}`}>{it.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The form cards' surface (was a plain white card - "too serious" next to the Tools cards). */
export const PLAYFUL_FORM_CARD = 'lx-hero group/lx group relative isolate flex h-full flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] shadow-[0_20px_44px_-32px_rgba(139,115,85,.6)] transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.75)] dark:border-white/[0.08] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)]'

/** The living layer behind a form card's content: grid, a few sparkles, the big form symbol drifting
 *  in the corner and a gold edge sweep on hover. Pointer-transparent; staggered by `seed`. */
export function PlayfulFormCard({ seed = 0 }: { seed?: number }) {
  const d = -((seed * 1.7) % 7)
  const sparks: [string, string, number][] = [[`${16 + (seed * 7) % 50}%`, '18%', 0], [`${58 + (seed * 3) % 30}%`, '62%', 1.8], [`${28 + (seed * 5) % 40}%`, '86%', 3.2]]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <div className="ohp-tool-grid absolute inset-0" />
      <ClipboardList className="pfc-mark absolute -bottom-10 -right-8 h-40 w-40 text-[#C9A24D]/[0.11] dark:text-[#e8c97a]/[0.07]" strokeWidth={1.2} style={{ animationDelay: `${d}s` }} />
      {sparks.map((sp, k) => <span key={k} className="pfc-spark absolute" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2] + Math.abs(d) * 0.4}s` }} />)}
      <div className="ohp-tool-edge absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  )
}

const FORM_CARD_CSS = `
.pfc-mark{transform:rotate(-8deg);animation:pfcMark 14s ease-in-out infinite alternate}
@keyframes pfcMark{0%{transform:rotate(-8deg) translate(0,0)}100%{transform:rotate(4deg) translate(-8px,-6px)}}
.pfc-spark{width:3px;height:3px;border-radius:9999px;background:#e8c97a;box-shadow:0 0 8px 2px rgba(232,201,122,.65);opacity:0;animation:pfcSpark 5.5s ease-in-out infinite}
@keyframes pfcSpark{0%{opacity:0;transform:translateY(0) scale(.5)}35%{opacity:.95;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-34px) scale(.5)}}
@media (prefers-reduced-motion:reduce){.pfc-mark,.pfc-spark{animation:none}.pfc-spark{opacity:.5}}
`
