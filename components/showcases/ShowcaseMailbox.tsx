'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import OhSheet from '@/components/open-house-manager/OhSheet'
import Pager from '@/components/ui/Pager'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import { MatchActivity, MatchHome, NewTag, homeFacts, matchedAgo, niceStreet, shortPrice } from '@/components/showcases/MatchBits'
import { activityAgo, activityKind, activityStreet } from '@/app/showcases/components/ShowcaseActivityInbox'
import type { ShowcaseActivityItem } from '@/types'

type Tab = 'all' | 'homes' | 'activity'
type Row = { at: number; home?: MatchHome; item?: ShowcaseActivityItem }
const PAGE = 20
const TABS: [Tab, string][] = [['all', 'Everything'], ['homes', 'Matches'], ['activity', 'Activity']]

/** One client's mailbox (owner, 11/07): their newest homes and everything they did, in one place. Opens
 *  from their lead and from their Showcase. Looking at it clears nothing; opening a home clears that home. */
export default function ShowcaseMailbox({ open, onClose, collectionId, who }: { open: boolean; onClose: () => void; collectionId: string; who?: string | null }) {
  const { user } = useAuth()
  const [homes, setHomes] = useState<MatchHome[] | null>(null)
  const [items, setItems] = useState<ShowcaseActivityItem[]>([])
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    setHomes(null); setFailed(false); setTab('all'); setPage(1)
    api.collections.mailbox(collectionId).then(r => {
      if (!live) return
      if (r.success && r.data) { setHomes(r.data.homes); setItems(r.data.activity) } else setFailed(true)
    })
    return () => { live = false }
  }, [open, collectionId])

  const rows = useMemo<Row[]>(() => {
    const h: Row[] = tab === 'activity' ? [] : (homes || []).map(home => ({ at: home.matched_at ? Date.parse(home.matched_at) : 0, home }))
    const a: Row[] = tab === 'homes' ? [] : items.map(item => ({ at: Date.parse(item.created_at), item }))
    return [...h, ...a].sort((x, y) => y.at - x.at)
  }, [homes, items, tab])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const cur = Math.min(page, pages)
  const shown = rows.slice((cur - 1) * PAGE, cur * PAGE)

  const openHome = (h: MatchHome) => {
    api.collections.trackPropertyView(h.collection_id, h.property_id).catch(() => {})
    setHomes(list => (list || []).map(x => (x.property_id === h.property_id ? { ...x, is_new: false } : x)))
    if (h.listing_key) setViewing(h.listing_key)
  }

  return (
    <>
      <OhSheet open={open} onClose={onClose} width="max-w-xl" title="Showcase mailbox" subtitle={who || undefined} icon={<Inbox className="h-5 w-5" />}>
        <div data-testid="showcase-mailbox">
          <div className="mb-3 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="tablist" aria-label="What to show">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setPage(1) }}
                className={`relative flex-1 rounded-xl px-2 py-2 text-[12px] font-black transition-colors ${tab === id ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {tab === id && <motion.span layoutId="showcase-mailbox-tab" transition={{ type: 'spring', stiffness: 460, damping: 36 }} className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          {failed ? (
            <p className="py-12 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">Couldn&apos;t load this right now.</p>
          ) : homes === null ? (
            <div className="flex min-h-[200px] items-center justify-center"><OhpSpinner size={28} label="Loading their mailbox" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">{tab === 'homes' ? 'No matches yet.' : 'Nothing here yet.'}</p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${tab}-${cur}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="space-y-1.5">
                {shown.map(r => (r.home ? <HomeRow key={`h-${r.home.property_id}`} h={r.home} onOpen={() => openHome(r.home!)} /> : <ActivityRow key={r.item!.id} item={r.item!} />))}
              </motion.div>
            </AnimatePresence>
          )}
          {pages > 1 && <Pager page={cur} pages={pages} onChange={n => setPage(Math.min(Math.max(1, n), pages))} prevLabel="Newer" nextLabel="Older" className="mt-3" />}
        </div>
      </OhSheet>
      {user && <PropertyQuickViewModal listingKey={viewing} agentId={user.id} onClose={() => setViewing(null)} />}
    </>
  )
}

function HomeRow({ h, onOpen }: { h: MatchHome; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid="mailbox-home"
      className="group flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-2 text-left transition hover:border-[#C9A24D]/40 dark:border-white/[0.07] dark:bg-[#141416]">
      <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
        {h.photo && <img src={resolveMediaUrl(h.photo)} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[13px] font-black text-[#111827] dark:text-white">{shortPrice(h.price)}</span>
          <span className="truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">{niceStreet(h.address)}</span>
        </span>
        <span className="block truncate text-[11px] font-semibold text-gray-400">{homeFacts(h)}{h.matched_at ? ` · ${matchedAgo(h.matched_at)}` : ''}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1"><MatchActivity a={h.activity} /><NewTag on={h.is_new} /></span>
    </button>
  )
}

function ActivityRow({ item }: { item: ShowcaseActivityItem }) {
  const k = activityKind(item)
  const Icon = k.icon
  const line = item.type === 'SHOWCASE_VIEW' ? activityStreet(item.property_address) : item.message === k.label ? '' : item.message
  const body = (
    <>
      <span className="relative h-11 w-14 shrink-0">
        {item.photo
          ? <img src={resolveMediaUrl(item.photo)} alt="" className="h-11 w-14 rounded-lg object-cover" />
          : <span className="block h-11 w-14 rounded-lg bg-gray-100 dark:bg-gray-800" />}
        <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${k.tone} text-white ring-2 ring-white dark:ring-[#141416]`}><Icon size={10} /></span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-[#111827] dark:text-white">{k.label}</span>
        <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{line}</span>
      </span>
      <span className="shrink-0 text-[10px] font-semibold text-gray-400">{activityAgo(item.created_at)}</span>
    </>
  )
  const cls = 'flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-gray-100 bg-white p-2 text-left transition dark:border-white/[0.07] dark:bg-[#141416]'
  return item.link
    ? <Link href={item.link} data-testid="mailbox-activity" className={`${cls} hover:border-[#C9A24D]/40`}>{body}</Link>
    : <div data-testid="mailbox-activity" className={cls}>{body}</div>
}
