'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, CheckCircle2, Plus } from 'lucide-react'
import api from '@/lib/api-service'
import type { AgentTask } from '@/types'
import InboxWindow, { InboxButton } from '@/components/ui/InboxWindow'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import PageHeader from '@/components/PageHeader'
import TasksPanel, { CalendarChip } from '@/components/tasks/TasksPanel'
import AutoFollowupSettings from '@/components/tasks/AutoFollowupSettings'
import { FollowupsHeaderSwitch, useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'

export default function FollowUpsPage() {
  // Opened from a notification about one follow-up ("/leads/tasks?task=...") - that card glows.
  const focusTaskId = useSearchParams().get('task')
  const [openCount, setOpenCount] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const { enabled } = useFollowupsEnabled()
  const off = enabled === false

  // Inbox: every follow-up added in the last two weeks (most made automatically), newest first.
  // "New" = added since the agent last opened it (remembered on this device).
  const SEEN_KEY = 'followups:inboxSeenAt'
  const [inboxOpen, setInboxOpen] = useState(false)
  const [recent, setRecent] = useState<AgentTask[]>([])
  const [seenAt, setSeenAt] = useState<number>(0)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  useEffect(() => { try { setSeenAt(Number(localStorage.getItem(SEEN_KEY) || 0)) } catch { /* private mode */ } }, [])
  const loadRecent = useCallback(() => {
    api.tasks.list({ includeDone: true }).then(({ success, data }) => {
      if (!success || !data) return
      const since = Date.now() - 14 * 86400000
      setRecent(data.filter(t => new Date(t.created_at).getTime() >= since)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    })
  }, [])
  useEffect(() => { loadRecent() }, [loadRecent, openCount])
  const unseen = useMemo(() => recent.filter(t => new Date(t.created_at).getTime() > seenAt && !t.completed_at).length, [recent, seenAt])
  const [snapshotSeenAt, setSnapshotSeenAt] = useState(0)
  const openInbox = () => {
    setSnapshotSeenAt(seenAt)
    const now = Date.now()
    setSeenAt(now)
    try { localStorage.setItem(SEEN_KEY, String(now)) } catch { /* private mode */ }
    setInboxOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PageHeader
            icon={CalendarClock}
            kicker="Follow-ups"
            title={<>Never miss <em>a follow-up.</em></>}
            subtitle="Who to reach out to and when. Most are added for you automatically - choose which situations below."
            backHref="/leads"
            backLabel="Leads"
            subtitleClassName="max-w-none lg:whitespace-nowrap"
            asideClassName="w-full lg:w-auto lg:self-start lg:-mt-6"
            kickerNote={<span className="normal-case tracking-normal"><CalendarChip /></span>}
            noMargin
            actions={(
              // Open count, the master on/off switch, then Add. Desktop: Open + Add on top, the
              // switch on its own row underneath (fits in the header's existing height).
              <div className="grid grid-cols-[auto_auto_1fr] items-stretch gap-1.5 sm:grid-cols-[auto_auto_auto]">
                {!off && openCount != null && (
                  <div className="order-1 flex items-baseline justify-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-white/80 px-2.5 py-2 sm:px-3 dark:border-white/10 dark:bg-white/[0.06]">
                    <span className="font-serif text-xl font-black leading-none text-[#111827] dark:text-white">{openCount}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">Open</span>
                  </div>
                )}
                {!off && <div className="order-2 flex"><InboxButton label="Inbox" count={unseen} tone="red" idle="gold" onClick={openInbox} title="Every follow-up added in the last two weeks" /></div>}
                <FollowupsHeaderSwitch className="order-4 col-span-3 w-full !py-1 [&>span:nth-of-type(3)]:ml-auto" />
                {!off && <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAdding(v => !v)}
                  aria-expanded={adding}
                  className="group relative order-3 inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl sm:w-auto bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] sm:px-4 shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Plus className={`h-4 w-4 transition-transform duration-200 ${adding ? 'rotate-45' : ''}`} /> Add
                </motion.button>}
              </div>
            )}
          />
        </motion.div>

        {off ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
            <p className="font-serif text-lg font-black text-[#111827] dark:text-white">Follow-ups are turned off</p>
            <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-gray-500 dark:text-gray-400">No automatic follow-ups are being made. Your situations, messages and phone alerts are saved - flip the Follow-ups switch at the top to bring everything back.</p>
          </motion.div>
        ) : (
          <>
            <div className="mt-4">
              <TasksPanel onCountChange={setOpenCount} composerOpen={adding} onComposerClose={() => setAdding(false)} focusTaskId={focusTaskId} />
            </div>

            <AutoFollowupSettings />
          </>
        )}
      </div>

      <InboxWindow
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        title="Follow-ups Inbox"
        subtitle="Every follow-up added in the last two weeks - newest first"
        empty="Nothing new - follow-ups show up here the moment they're added."
        items={recent.map(t => ({
          id: t.id,
          title: t.title,
          subtitle: [t.completed_at ? 'Done' : null, t.context].filter(Boolean).join(' · ') || null,
          at: t.created_at,
          unread: new Date(t.created_at).getTime() > snapshotSeenAt && !t.completed_at,
          icon: t.completed_at ? CheckCircle2 : CalendarClock,
          onOpen: () => { setInboxOpen(false); if (t.lead?.id) setOpenLeadId(t.lead.id) },
        }))}
      />
      {openLeadId && <LeadDetailModal leadId={openLeadId} onClose={() => { setOpenLeadId(null); loadRecent() }} onChanged={loadRecent} />}
    </div>
  )
}
