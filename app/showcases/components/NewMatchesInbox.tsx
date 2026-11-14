'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, ChevronDown, Search, Sparkles, X } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useEscapeToClose } from '@/components/ui/windowMotion'
import MotionModal from '@/components/ui/MotionModal'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import MatchPreview from '@/components/showcases/MatchPreview'
import LeadStar from '@/components/leads/LeadStar'
import { MatchActivity, MatchHome, homeFacts, matchedAgo, niceStreet, shortPrice } from '@/components/showcases/MatchBits'

// Every home the agent hasn't looked at, newest first, with whose it is (owner, 11/04). Tapping one opens
// it up right here to judge it (owner, 11/06). Dismiss clears it from the mailbox only: it stays in the
// client's Showcase. Open in their Showcase goes to that home there. Reading the list clears nothing.
export default function NewMatchesInbox({ isOpen, onClose, onChanged }: { isOpen: boolean; onClose: () => void; onChanged: (count: number) => void }) {
  const { user } = useAuth()
  const [items, setItems] = useState<MatchHome[] | null>(null)
  const [who, setWho] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const [undo, setUndo] = useState<MatchHome | null>(null)
  useEscapeToClose(onClose, isOpen)

  const load = useCallback(async () => {
    const r = await api.collections.getNewMatches()
    if (r.success && r.data) { setItems(r.data.items); onChanged(r.data.count) }
  }, [onChanged])
  useEffect(() => { if (isOpen) { setWho(null); setQuery(''); setOpened(null); setUndo(null); load() } }, [isOpen, load])
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 7000)
    return () => window.clearTimeout(t)
  }, [undo])
  // Came back to the tab - something may have been looked at elsewhere
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [isOpen, load])

  const clients = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>()
    for (const it of items || []) {
      const c = m.get(it.collection_id) || { id: it.collection_id, name: it.client || 'Client', n: 0 }
      c.n += 1; m.set(it.collection_id, c)
    }
    return Array.from(m.values()).sort((a, b) => b.n - a.n)
  }, [items])
  // Typing a client's name (or a street) narrows the list (owner, 11/05).
  const needle = query.trim().toLowerCase()
  const shown = (items || []).filter(it => (!who || it.collection_id === who) &&
    (!needle || [it.client, it.client_email, it.address, it.city].some(v => (v || '').toLowerCase().includes(needle))))

  const keyOf = (it: MatchHome) => `${it.collection_id}-${it.property_id}`
  const dismiss = (it: MatchHome) => {
    setOpened(o => (o === keyOf(it) ? null : o))
    setUndo(it)
    api.collections.setAgentSeen(it.collection_id, it.property_id, true).catch(() => {})
    setItems(list => {
      const next = (list || []).filter(x => keyOf(x) !== keyOf(it))
      onChanged(next.length)
      if (who && !next.some(x => x.collection_id === who)) setWho(null)
      return next
    })
  }
  const bringBack = () => {
    const it = undo
    if (!it) return
    setUndo(null)
    api.collections.setAgentSeen(it.collection_id, it.property_id, false).catch(() => {})
    setItems(list => {
      const next = [...(list || []), it].sort((a, b) => (b.matched_at || '').localeCompare(a.matched_at || ''))
      onChanged(next.length)
      return next
    })
  }

  return (
    <>
      <MotionModal open={isOpen} onBackdropClick={e => { if (e.target === e.currentTarget) onClose() }} className="bg-black/60">
        <div data-testid="new-matches" className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#3a2e18] px-4 py-4 text-white sm:px-5">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(232,201,122,.32),transparent_65%)]" />
            <div className="relative flex items-center gap-3">
              <motion.span initial={{ rotate: -14, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-md">
                <Sparkles className="h-5 w-5" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black tracking-tight sm:text-lg">New Matches</h2>
                <p className="truncate text-[11px] font-semibold text-white/60">Homes you haven&apos;t looked at yet, newest first</p>
              </div>
              {items && <span className="text-2xl font-black tabular-nums text-[#e8c97a]" data-testid="new-matches-count"><AnimatedNumber value={items.length} duration={500} /></span>}
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
          </div>

          {(items?.length || 0) > 0 && (
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a client's name" aria-label="Search a client's name" data-testid="new-matches-search"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-9 text-sm font-semibold text-[#111827] outline-none transition placeholder:text-gray-400 focus:border-[#C9A24D] dark:border-gray-800 dark:bg-[#0B0B0B] dark:text-white" />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear the search" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white"><X className="h-3.5 w-3.5" /></button>}
              </label>
            </div>
          )}

          {clients.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-3 py-2 [scrollbar-width:none] dark:border-gray-800">
              {[{ id: null as string | null, name: 'Everyone', n: items?.length || 0 }, ...clients].map(c => (
                <button key={c.id || 'all'} onClick={() => setWho(c.id)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black transition-colors ${who === c.id
                    ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
                    : 'border-gray-200 text-gray-600 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:text-gray-300'}`}>
                  {c.name} <span className="opacity-60">{c.n}</span>
                </button>
              ))}
            </div>
          )}

          <div className="min-h-[200px] flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-3">
            {!items ? (
              <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="ohp-skeleton h-[84px] rounded-xl" />)}</div>
            ) : items.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center" data-testid="new-matches-empty">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.1 }}
                  className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><Check className="h-6 w-6" strokeWidth={3} /></motion.span>
                <p className="font-serif text-lg font-black text-[#111827] dark:text-white">All caught up</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">New homes land here the moment they match a client&apos;s search.</p>
              </motion.div>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-sm font-semibold text-gray-500 dark:text-gray-400" data-testid="new-matches-none">Nothing matches that name.</p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={true}>
                  {shown.map((it, i) => (
                    <motion.li key={`${it.collection_id}-${it.property_id}`} layout="position" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 48, height: 0, marginTop: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: Math.min(i, 8) * 0.035 }}
                      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_24px_-22px_rgba(17,24,39,.6)] transition-[border-color,box-shadow] hover:border-[#C9A24D]/60 hover:shadow-[0_16px_32px_-22px_rgba(201,162,77,.8)] dark:border-gray-800 dark:bg-[#1a1a1d]">
                      <div className="flex items-stretch">
                        <button type="button" onClick={() => setOpened(o => (o === keyOf(it) ? null : keyOf(it)))} data-testid="new-match" aria-expanded={opened === keyOf(it)} aria-label={`${opened === keyOf(it) ? 'Close' : 'Open'} ${niceStreet(it.address)}`} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left">
                          <span className="relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                            {it.photo && <img src={resolveMediaUrl(it.photo)} alt="" loading="lazy" className="ohp-mls-tile h-full w-full object-cover" />}
                            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-3 text-[11px] font-black text-white">{shortPrice(it.price)}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-black text-[#111827] dark:text-white">{niceStreet(it.address) || 'Home'}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{[it.city, homeFacts(it)].filter(Boolean).join(' · ')}</span>
                            <span className="mt-1 flex min-w-0 items-center gap-1.5">
                              <span className="truncate rounded-full bg-[#C9A24D]/12 px-2 py-0.5 text-[10.5px] font-black text-[#8b7355] dark:text-[#e8c97a]"><LeadStar showcaseId={it.collection_id} email={it.client_email} className="mr-0.5 -mt-0.5 h-3 w-3" />{it.client || 'Client'}</span>
                              <span className="shrink-0 text-[10.5px] font-bold text-gray-400">{matchedAgo(it.matched_at)}</span>
                              <MatchActivity a={it.activity} />
                            </span>
                          </span>
                          <ChevronDown className={`h-5 w-5 shrink-0 text-gray-300 transition-transform duration-200 group-hover:text-[#C9A24D] ${opened === keyOf(it) ? 'rotate-180' : ''}`} />
                        </button>
                        <button type="button" onClick={() => dismiss(it)} title="Dismiss" aria-label={`Dismiss ${niceStreet(it.address)}`} data-testid="new-match-dismiss"
                          className="grid w-11 shrink-0 place-items-center border-l border-gray-100 text-gray-400 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:border-gray-800">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {opened === keyOf(it) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                            <MatchPreview it={it} agentId={user?.id} />
                            <div className="flex gap-2 p-2.5 pt-0">
                              <button type="button" onClick={() => dismiss(it)} data-testid="new-match-dismiss-big" className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-black text-gray-700 transition hover:border-rose-300 hover:text-rose-600 dark:border-gray-700 dark:text-gray-200">Dismiss</button>
                              <Link href={`/showcases?showcase=${it.collection_id}&property=${it.property_id}&from=matches`} data-testid="new-match-open" onClick={onClose}
                                className="flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#111827] text-sm font-black text-white transition hover:bg-black dark:bg-[#C9A24D] dark:text-[#111827]">
                                Open in their Showcase <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
          {undo && (
            <div className="flex items-center gap-3 border-t border-gray-100 bg-[#111827] px-4 py-2.5 text-white dark:border-gray-800" data-testid="new-match-undo-bar">
              <span className="min-w-0 flex-1 truncate text-xs font-bold">Dismissed {niceStreet(undo.address) || 'that home'}. It stays in their Showcase.</span>
              <button type="button" onClick={bringBack} data-testid="new-match-undo" className="shrink-0 text-xs font-black text-[#e8c97a] hover:underline">Undo</button>
            </div>
          )}
        </div>
      </MotionModal>
    </>
  )
}
