'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, ClipboardList, Eye, Mail, Users } from 'lucide-react'
import { TOOL_CARD_CSS } from '@/components/ui/LuxeSurface'
import { InboxButton } from '@/components/ui/InboxWindow'
import { invitesApi, type Invite } from '@/lib/invites'

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
  useEffect(() => {
    const load = () => invitesApi.list().then(r => { if (r.success) setInviteBadge(r.data.reduce((n, i) => n + (i.counts?.unseen || 0), 0)) })
    load()
    window.addEventListener(INVITES_CHANGED, load)
    return () => window.removeEventListener(INVITES_CHANGED, load)
  }, [])
  // The switch answers on the very next frame (owner, 10/31 - it felt late): it moves by itself
  // right away (painted first), and the page swaps its halves straight after that frame.
  const [shown, setShown] = useState(view)
  useEffect(() => { setShown(view) }, [view])
  const flip = (v: 'forms' | 'invites') => { if (v === shown) return; setShown(v); requestAnimationFrame(() => window.setTimeout(() => onChange(v), 0)) }
  const items = [
    { id: 'forms' as const, label: 'Forms', sub: 'Capture leads', icon: ClipboardList, badge: formBadge },
    { id: 'invites' as const, label: 'Invites', sub: 'Events & RSVPs', icon: Mail, badge: inviteBadge },
  ]
  return (
    <div className="mt-1" role="tablist" aria-label="Forms or Invites">
      <style>{TOOL_CARD_CSS + FORM_CARD_CSS}</style>
      <div className="relative grid grid-cols-2 gap-1 rounded-[22px] border border-[#C9A24D]/25 bg-white/80 p-1.5 shadow-[0_18px_40px_-34px_rgba(139,115,85,.9)] dark:border-white/[0.08] dark:bg-white/[0.04] sm:inline-grid sm:min-w-[420px]">
        {items.map(it => {
          const on = shown === it.id
          return (
            <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => flip(it.id)} data-testid={`switch-${it.id}`}
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

// ------------------------------------------------------------------ the Invites side of the page header
// (user, 10/24: the tabs glitched because the header lost its "New" row + stat cards on Invites and
// jumped in height - Invites now has its own, the same size: new RSVPs as one-tap chips, and the
// numbers + an inbox.)

const INVITES_CHANGED = 'ohp:invites-changed'
export const announceInvitesChanged = () => { try { window.dispatchEvent(new Event(INVITES_CHANGED)) } catch { /* ssr */ } }

function useInviteList() {
  const [list, setList] = useState<Invite[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => invitesApi.list().then(r => { if (live && r.success) setList(r.data) })
    load()
    window.addEventListener(INVITES_CHANGED, load)
    window.addEventListener('focus', load)
    return () => { live = false; window.removeEventListener(INVITES_CHANGED, load); window.removeEventListener('focus', load) }
  }, [])
  return list
}

/** Opens an invite's guest list (InvitesPanel listens for ?invite=). */
function useOpenInvite() {
  const router = useRouter()
  const pathname = usePathname()
  return (id: string) => {
    const q = new URLSearchParams(window.location.search)
    q.set('view', 'invites'); q.set('invite', id)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }
}

export function InvitesNewChips() {
  const list = useInviteList()
  const open = useOpenInvite()
  const fresh = (list || []).filter(i => i.counts.unseen > 0)
  return (
    <div className="flex min-h-[36px] items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none]" data-testid="invites-new-chips">
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">
        <span className="relative flex h-2 w-2">
          <span className={`relative inline-flex h-2 w-2 rounded-full ${fresh.length ? 'bg-red-500' : 'bg-emerald-500'}`} />
        </span>
        New
      </span>
      {fresh.map(inv => (
        <button key={inv.id} type="button" onClick={() => open(inv.id)}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {inv.counts.unseen} new RSVP{inv.counts.unseen === 1 ? '' : 's'}
          <span className="max-w-[160px] truncate font-semibold text-gray-400">· {inv.title}</span>
          <ArrowRight className="h-3 w-3 text-gray-400 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
      {list && fresh.length === 0 && <span className="text-xs font-semibold text-gray-500 dark:text-white/50">All caught up - new RSVPs show up here the moment they come in.</span>}
      {!list && <span className="h-4 w-56 animate-pulse rounded-full bg-[#C9A24D]/15" />}
    </div>
  )
}

export function InvitesHeaderStats() {
  const list = useInviteList()
  const open = useOpenInvite()
  const live = (list || []).filter(i => i.status === 'live' && !i.is_past).length
  const coming = (list || []).reduce((n, i) => n + (i.counts.guests_yes || 0), 0)
  const views = (list || []).reduce((n, i) => n + (i.view_count || 0), 0)
  const unseen = (list || []).reduce((n, i) => n + (i.counts.unseen || 0), 0)
  const firstNew = (list || []).find(i => i.counts.unseen > 0)
  const tile = (icon: React.ReactNode, label: string, short: string, value: number) => (
    <div className="block w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm dark:border-gray-800 dark:bg-[#151517] lg:px-4 lg:py-3.5">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[#8b7355] [&_svg]:h-3 [&_svg]:w-3 lg:[&_svg]:h-3.5 lg:[&_svg]:w-3.5">{icon}</span>
        <p className="min-w-0 truncate text-[9px] font-black uppercase leading-tight text-gray-400 lg:text-[10px]"><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></p>
      </div>
      <p className="mt-1 min-w-0 truncate text-xl font-black leading-none text-[#111827] dark:text-white lg:mt-2 lg:text-2xl">{list ? value : '-'}</p>
    </div>
  )
  return (
    <div className="flex w-full items-stretch gap-2" data-testid="invites-header-stats">
      <div className="grid flex-1 grid-cols-3 gap-2 sm:min-w-[340px] lg:min-w-[400px]">
        {tile(<Mail />, 'Live invites', 'Live', live)}
        {tile(<Users />, 'Guests coming', 'Going', coming)}
        {tile(<Eye />, 'Times opened', 'Views', views)}
      </div>
      <InboxButton label="RSVPs" count={unseen} onClick={() => { if (firstNew) open(firstNew.id) }} title="New RSVPs you haven't looked at yet" />
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

// Forms & Invites (owner, 10/31): nothing moves until it's pointed at - the cards' drifting symbol,
// sparkles, gold glows and edges, the header's shimmer - they all rest, and play while hovered or
// keyboard-focused. (This style sits on the Forms & Invites page only.)
const FORM_CARD_CSS = `
.pfc-mark{transform:rotate(-8deg);animation:pfcMark 14s ease-in-out infinite alternate}
@keyframes pfcMark{0%{transform:rotate(-8deg) translate(0,0)}100%{transform:rotate(4deg) translate(-8px,-6px)}}
.pfc-spark{width:3px;height:3px;border-radius:9999px;background:#e8c97a;box-shadow:0 0 8px 2px rgba(232,201,122,.65);opacity:0;animation:pfcSpark 5.5s ease-in-out infinite}
@keyframes pfcSpark{0%{opacity:0;transform:translateY(0) scale(.5)}35%{opacity:.95;transform:translateY(-10px) scale(1)}100%{opacity:0;transform:translateY(-34px) scale(.5)}}
@media (prefers-reduced-motion:reduce){.pfc-mark,.pfc-spark{animation:none}.pfc-spark{opacity:.5}}
:root :is(.lx-aurora-a,.lx-aurora-b,.lx-mark,.lx-spark,.lx-edge,.lx-ken,.lx-title em,.lx-urgent,.ohp-tool-edge,.pfc-mark,.pfc-spark,.fta-draw,.fta-flip,.fta-needle,.fta-orbit,.fta-rise,.fta-shine,.fta-swing,.fta-tick,.fta-twinkle,.fta-type){animation-play-state:paused}
:root :is(.group\\/lx,.group):is(:hover,:focus-within) :is(.lx-aurora-a,.lx-aurora-b,.lx-mark,.lx-spark,.lx-edge,.lx-ken,.lx-urgent,.lx-title em,.ohp-tool-edge,.pfc-mark,.pfc-spark,.fta-draw,.fta-flip,.fta-needle,.fta-orbit,.fta-rise,.fta-shine,.fta-swing,.fta-tick,.fta-twinkle,.fta-type){animation-play-state:running}
`
