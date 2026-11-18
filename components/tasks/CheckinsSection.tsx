'use client'

// Check-ins on the Follow-ups page, under the Completed bar (owner, 11/13 - moved here from the Leads page).
// Who to reach back out to - only people with a real reason (a note, email opens / clicks, Showcase use, more
// than one open house), not contacted in a week and not already covered by a follow-up. Best first, in three
// groups so it never turns into one long list:
//   Recommended (the top 3) · Worth a check-in · Less likely to respond.
// Owner 11/18: a key feature, so it stands out (luxe band like the Dash's Follow-ups card) and starts
// COLLAPSED every visit - just the names, by group. "Show cards" (or tapping a name) opens the full cards;
// tapping a name jumps to that person's card. Backend: checkins_service (no AI to list them).
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import type { CheckinGroup, CheckinItem } from '@/types'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import CheckinCard, { type WriteEstimate } from './CheckinCard'

const PAGE = 6
const CHIPS = 8   // names shown per group while collapsed (then "+N more")
const GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
const EASE = [0.22, 1, 0.36, 1] as const
const DEFAULT_GROUPS: CheckinGroup[] = [
  { key: 'recommended', label: 'Recommended', hint: 'Most likely to answer - start here' },
  { key: 'worth', label: 'Worth a check-in', hint: 'Real reasons to reach back out' },
  { key: 'less', label: 'Less likely to respond', hint: 'Quieter, but you have a reason' },
]
const DOT: Record<CheckinGroup['key'], string> = { recommended: 'bg-[#C9A24D]', worth: 'bg-sky-500', less: 'bg-gray-400' }
// Recommended names are the loud ones; the other groups read quieter.
const CHIP: Record<CheckinGroup['key'], string> = {
  recommended: 'border-[#C9A24D]/60 bg-white text-[#111827] shadow-sm shadow-[#C9A24D]/20 hover:border-[#C9A24D] dark:border-[#C9A24D]/45 dark:bg-[#C9A24D]/[0.12] dark:text-white',
  worth: 'border-gray-200 bg-white/80 text-gray-700 hover:border-[#C9A24D]/70 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200',
  less: 'border-gray-200/80 bg-white/60 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-400',
}
const AVATAR: Record<CheckinGroup['key'], string> = {
  recommended: 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]',
  worth: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  less: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300',
}
const initials = (name: string) => name.replace(/\s*\(test\)\s*$/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'

export default function CheckinsSection({ refreshKey = 0, onAdded }: { refreshKey?: number; onAdded?: () => void }) {
  const [items, setItems] = useState<CheckinItem[] | null>(null)
  const [groups, setGroups] = useState<CheckinGroup[]>(DEFAULT_GROUPS)
  const [estimate, setEstimate] = useState<WriteEstimate | null>(null)
  // Starts collapsed every visit (names only) - owner 11/18.
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['recommended']))
  const [shown, setShown] = useState<Record<string, number>>({})
  const [moreChips, setMoreChips] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  // Added / hidden on this visit: the card stays where it is (with Undo / "Added") until the page is left.
  const [kept, setKept] = useState<Set<string>>(new Set())

  const keptRef = useRef(kept)
  keptRef.current = kept
  const firstLoad = useRef(true)
  useEffect(() => {
    let live = true
    api.tasks.checkins().then(res => {
      if (!live || !res.success || !res.data) return
      const fresh = res.data.items
      setItems(prev => {
        // keep the cards the agent just acted on, in their spot
        const stay = (prev || []).filter(p => keptRef.current.has(p.lead_id) && !fresh.some(f => f.lead_id === p.lead_id))
        return [...fresh, ...stay]
      })
      if (res.data.groups?.length) setGroups(res.data.groups)
      setEstimate(res.data.estimate)
      if (firstLoad.current) {
        firstLoad.current = false
        // nobody good enough for Recommended: open the next group instead
        if (!fresh.some(f => f.group === 'recommended')) setOpenGroups(new Set([fresh.some(f => f.group === 'worth') ? 'worth' : 'less']))
      }
    })
    return () => { live = false }
  }, [refreshKey])

  const byGroup = useMemo(() => {
    const g: Record<string, CheckinItem[]> = { recommended: [], worth: [], less: [] }
    for (const it of items || []) (g[it.group] ||= []).push(it)
    return g
  }, [items])

  const toggleGroup = (k: string) => setOpenGroups(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const keep = (id: string) => setKept(s => new Set(s).add(id))

  // A name tapped: open the cards + that group (far enough down the list), then glide to the card.
  const jumpTo = (it: CheckinItem) => {
    const list = byGroup[it.group] || []
    const idx = list.findIndex(x => x.lead_id === it.lead_id)
    setOpen(true)
    setOpenGroups(s => new Set(s).add(it.group))
    setShown(s => ({ ...s, [it.group]: Math.max(s[it.group] || PAGE, Math.ceil((idx + 1) / PAGE) * PAGE) }))
    setFlash(it.lead_id)
    // after the cards have opened (the height animation is ~0.35s)
    window.setTimeout(() => {
      document.getElementById(`checkin-${it.lead_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 420)
    window.setTimeout(() => setFlash(f => (f === it.lead_id ? null : f)), 2200)
  }

  if (!items?.length) return null
  const total = items.filter(i => !kept.has(i.lead_id)).length
  const top = byGroup.recommended.length

  return (
    <LuxeSurface as="section" icon={Sparkles}
      className="mt-4 rounded-2xl border border-[#C9A24D]/45 shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)] dark:border-[#C9A24D]/30"
      data-testid="checkins-section">
      <div className="p-3 sm:p-5">
        {/* Header - same shape as the Dash's Follow-ups card: dark icon tile, serif title, status pill. */}
        {/* The toggle always stays on the title's line; on a phone the count pill drops under the title. */}
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex min-w-0 items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white sm:text-xl">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#111827] text-[#e8c97a] shadow-sm dark:bg-white/10"><Sparkles className="h-4 w-4" /></span>
              Check-ins
            </span>
            {/* Phones get the shorter wording so the pill stays one line beside the Show cards button. */}
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2.5 py-0.5 text-[11px] font-black text-[#111827] shadow-sm shadow-[#C9A24D]/30" data-testid="checkins-count">
              {total} {total === 1 ? 'person' : 'people'}<span className="sm:hidden">&nbsp;to reach out to</span><span className="max-sm:hidden">&nbsp;worth reaching back out to</span>
            </span>
          </div>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="checkins-toggle"
            className="mt-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#C9A24D]/45 bg-white/80 px-3 py-1 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white/[0.06] dark:text-[#d7b974] dark:hover:text-[#111827]">
            <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide cards' : 'Show cards'}
          </button>
        </div>
        <p className="mt-1.5 text-[12px] font-semibold leading-snug text-gray-600 dark:text-gray-400">
          Not contacted in a week, with a reason - a note, opened emails or using their Showcase.{top ? ` Start with the top ${top}.` : ''}
        </p>
        <div className="mt-3 h-px bg-gradient-to-r from-[#C9A24D]/55 via-[#C9A24D]/15 to-transparent" />

        {/* The names, by group - always here, so it reads at a glance; a name jumps to its card. */}
        <div className="mt-3 space-y-2.5" data-testid="checkins-names">
          {groups.map(g => {
            const list = byGroup[g.key] || []
            if (!list.length) return null
            const all = moreChips.has(g.key)
            const chips = all ? list : list.slice(0, CHIPS)
            return (
              <div key={g.key} data-testid={`checkins-names-${g.key}`}>
                <p className="mb-1.5 flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[g.key]}`} />
                  <span className={`text-[10.5px] font-black uppercase tracking-widest ${g.key === 'recommended' ? 'text-[#8b7355] dark:text-[#e0c486]' : 'text-gray-500 dark:text-gray-400'}`}>{g.label}</span>
                  <span className="text-[10.5px] font-bold tabular-nums text-gray-400">{list.length}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map(it => (
                    <button key={it.lead_id} type="button" onClick={() => jumpTo(it)} title={[it.origin, it.headline].filter(Boolean).join(' · ')}
                      data-testid="checkins-name"
                      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12px] font-black transition hover:-translate-y-px ${CHIP[g.key]} ${kept.has(it.lead_id) ? 'opacity-50' : ''}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${AVATAR[g.key]}`}>{initials(it.name)}</span>
                      <span className="min-w-0 truncate">{it.name}</span>
                    </button>
                  ))}
                  {list.length > chips.length && (
                    <button type="button" onClick={() => setMoreChips(s => new Set(s).add(g.key))}
                      className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">
                      +{list.length - chips.length} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="cards" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.25 } }} className="overflow-hidden" data-testid="checkins-cards">
              <div className="mt-3 space-y-2 border-t border-[#C9A24D]/20 pt-3">
                {groups.map(g => {
                  const list = byGroup[g.key] || []
                  if (!list.length) return null
                  const gOpen = openGroups.has(g.key)
                  const n = shown[g.key] || PAGE
                  return (
                    <div key={g.key} data-testid={`checkins-group-${g.key}`}>
                      <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={gOpen}
                        className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/60 dark:hover:bg-white/[0.03]">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[g.key]}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white">{g.label}</span>
                        <span className="text-[11px] font-bold tabular-nums text-gray-400">{list.length}</span>
                        <span className="text-[11px] font-semibold text-gray-400 max-sm:hidden">· {g.hint}</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition ${gOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {gOpen && (
                        <div className="mt-1.5">
                          <div className={GRID}>
                            {list.slice(0, n).map(it => (
                              <div key={it.lead_id} id={`checkin-${it.lead_id}`}
                                className={`scroll-mt-24 rounded-2xl transition-shadow duration-500 ${flash === it.lead_id ? 'shadow-[0_0_0_3px_rgba(201,162,77,.75)]' : ''}`}>
                                <CheckinCard item={it} estimate={estimate} showName
                                  onAdded={() => { keep(it.lead_id); onAdded?.() }}
                                  onSkipped={() => keep(it.lead_id)} />
                              </div>
                            ))}
                          </div>
                          {list.length > n && (
                            <button type="button" onClick={() => setShown(s => ({ ...s, [g.key]: n + PAGE }))} data-testid={`checkins-more-${g.key}`}
                              className="mt-2 w-full text-center text-[11px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
                              Show {Math.min(PAGE, list.length - n)} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LuxeSurface>
  )
}
