'use client'

// The Leads page's "Ready to check in" list (owner, 11/09): every lead with nothing suggested, nothing open and
// no word from you in two weeks (from the last two months). Each says why - free, no AI - and "Write it" writes
// the text you'd send them on the tap only (backend followup_writer). Folds away; remembered on this device.
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import type { CheckinItem } from '@/types'
import CheckinCard, { usagePct, type WriteEstimate } from '@/components/tasks/CheckinCard'

const FOLD_KEY = 'ohp_checkins_folded'
const SHOWN = 3

export default function CheckinsStrip({ onAdded }: { onAdded?: () => void }) {
  const [items, setItems] = useState<CheckinItem[] | null>(null)
  const [estimate, setEstimate] = useState<WriteEstimate | null>(null)
  const [folded, setFolded] = useState(false)
  const [all, setAll] = useState(false)
  useEffect(() => { try { setFolded(localStorage.getItem(FOLD_KEY) === '1') } catch { /* private mode */ } }, [])
  const load = useCallback(async () => {
    const res = await api.tasks.checkins()
    if (res.success && res.data) { setItems(res.data.items); setEstimate(res.data.estimate) }
  }, [])
  useEffect(() => { load() }, [load])
  const fold = () => setFolded(f => { try { localStorage.setItem(FOLD_KEY, f ? '0' : '1') } catch { /* private mode */ } return !f })
  if (!items?.length) return null
  const shown = all ? items : items.slice(0, SHOWN)
  return (
    <section className="mt-4 rounded-2xl border border-[#C9A24D]/30 bg-white p-3 dark:border-[#C9A24D]/20 dark:bg-[#141416] sm:p-4" data-testid="checkins-strip">
      <button type="button" onClick={fold} className="flex w-full items-start gap-3 text-left" aria-expanded={!folded}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Sparkles className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black text-[#111827] dark:text-white" data-testid="checkins-count">
            {items.length} lead{items.length === 1 ? '' : 's'} ready for a check-in
          </span>
          <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
            No word from you in two weeks or more. Tap Write it and the text is written from their open house, your notes and their Showcase - {estimate ? `${usagePct(estimate.usage_percent)} of your chat usage each` : 'a tiny bit of chat usage each'}.
          </span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform ${folded ? '' : 'rotate-180'}`} />
      </button>
      <AnimatePresence initial={false}>
        {!folded && (
          <motion.div key="list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 grid grid-cols-1 gap-x-3 lg:grid-cols-2 xl:grid-cols-3 [&>*]:mb-0 gap-y-3">
              {shown.map(it => (
                <CheckinCard key={it.lead_id} item={it} estimate={estimate} showName onAdded={() => { onAdded?.(); window.setTimeout(load, 1500) }} />
              ))}
            </div>
            {items.length > SHOWN && (
              <button type="button" onClick={() => setAll(a => !a)} className="mt-3 text-[12px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]" data-testid="checkins-more">
                {all ? 'Show fewer' : `Show all ${items.length}`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
