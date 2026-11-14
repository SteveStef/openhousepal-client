'use client'

// Check-ins on the Follow-ups page, under the Completed bar (owner, 11/13 - moved here from the Leads page).
// Who to reach back out to - only people with a real reason (a note, email opens / clicks, Showcase use, more
// than one open house), not contacted in a week and not already covered by a follow-up. Best first, in three
// groups so it never turns into one long list:
//   Recommended (the top 3, open) · Worth a check-in · Less likely to respond (each folded, 6 at a time).
// Backend: checkins_service (no AI to list them). The section folds away; remembered on this device.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import type { CheckinGroup, CheckinItem } from '@/types'
import CheckinCard, { type WriteEstimate } from './CheckinCard'

const FOLD_KEY = 'ohp_checkins_folded'
const PAGE = 6
const GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'
const DEFAULT_GROUPS: CheckinGroup[] = [
  { key: 'recommended', label: 'Recommended', hint: 'Most likely to answer - start here' },
  { key: 'worth', label: 'Worth a check-in', hint: 'Real reasons to reach back out' },
  { key: 'less', label: 'Less likely to respond', hint: 'Quieter, but you have a reason' },
]
const DOT: Record<CheckinGroup['key'], string> = { recommended: 'bg-[#C9A24D]', worth: 'bg-sky-500', less: 'bg-gray-400' }

export default function CheckinsSection({ refreshKey = 0, onAdded }: { refreshKey?: number; onAdded?: () => void }) {
  const [items, setItems] = useState<CheckinItem[] | null>(null)
  const [groups, setGroups] = useState<CheckinGroup[]>(DEFAULT_GROUPS)
  const [estimate, setEstimate] = useState<WriteEstimate | null>(null)
  const [folded, setFolded] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['recommended']))
  const [shown, setShown] = useState<Record<string, number>>({})
  // Added / hidden on this visit: the card stays where it is (with Undo / "Added") until the page is left.
  const [kept, setKept] = useState<Set<string>>(new Set())

  useEffect(() => { try { setFolded(localStorage.getItem(FOLD_KEY) === '1') } catch { /* private mode */ } }, [])
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

  const fold = () => setFolded(f => { try { localStorage.setItem(FOLD_KEY, f ? '0' : '1') } catch { /* private mode */ } return !f })
  const toggleGroup = (k: string) => setOpenGroups(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const keep = (id: string) => setKept(s => new Set(s).add(id))

  if (!items?.length) return null
  const total = items.filter(i => !kept.has(i.lead_id)).length
  const top = byGroup.recommended.length

  return (
    <section className="mt-4 rounded-xl border border-[#C9A24D]/30 bg-white dark:border-[#C9A24D]/20 dark:bg-[#151517]" data-testid="checkins-section">
      <button type="button" onClick={fold} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left" aria-expanded={!folded} data-testid="checkins-toggle">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Sparkles className="h-3.5 w-3.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-[#111827] dark:text-white" data-testid="checkins-count">
            Check-ins <span className="font-bold text-gray-400">· {total} {total === 1 ? 'person' : 'people'} worth reaching back out to</span>
          </span>
          <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
            Not contacted in a week, with a reason - a note, opened emails or using their Showcase.{top ? ` Start with the top ${top}.` : ''}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${folded ? '' : 'rotate-180'}`} />
      </button>
      <AnimatePresence initial={false}>
        {!folded && (
          <motion.div key="list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 border-t border-gray-100 p-2 dark:border-gray-800 sm:p-3">
              {groups.map(g => {
                const list = byGroup[g.key] || []
                if (!list.length) return null
                const open = openGroups.has(g.key)
                const n = shown[g.key] || PAGE
                return (
                  <div key={g.key} data-testid={`checkins-group-${g.key}`}>
                    <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={open}
                      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[g.key]}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#111827] dark:text-white">{g.label}</span>
                      <span className="text-[11px] font-bold tabular-nums text-gray-400">{list.length}</span>
                      <span className="text-[11px] font-semibold text-gray-400 max-sm:hidden">· {g.hint}</span>
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="mt-1.5">
                        <div className={GRID}>
                          {list.slice(0, n).map(it => (
                            <CheckinCard key={it.lead_id} item={it} estimate={estimate} showName
                              onAdded={() => { keep(it.lead_id); onAdded?.() }}
                              onSkipped={() => keep(it.lead_id)} />
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
    </section>
  )
}
