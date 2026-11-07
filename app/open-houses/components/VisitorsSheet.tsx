'use client'

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import OhSheet from '@/components/open-house-manager/OhSheet'
import OpenHouseVisitors from './OpenHouseVisitors'
import api from '@/lib/api-service'

export type VisitorsSheetHandle = { open: (openHouse: any) => void }
type Loaded = { visitors: any[] | null; openHouse: any | null; error: string | null }

/** The Visitors window (owner, 11/07: "not a smooth pop up"). It keeps its own open / closed state, so
 *  the Opens page behind it never re-renders while it slides, and the guest list is only laid out once
 *  the sheet has stopped moving: the list loads during the slide, a light placeholder of the same size
 *  rides up meanwhile. Building the list mid-slide is what froze it for half a second on a phone. */
export const VisitorsSheet = forwardRef<VisitorsSheetHandle, {
  subtitleFor: (openHouse: any) => string
  /** The sheet has finished sliding away (quietly refresh that open house's guest count). */
  onClosed: (openHouseId: string) => void
}>(function VisitorsSheet({ subtitleFor, onClosed }, ref) {
  const [openHouse, setOpenHouse] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [settled, setSettled] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const ticket = useRef(0)
  const backstop = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    open(oh) {
      const mine = ++ticket.current
      setOpenHouse(oh); setLoaded(null); setSettled(false); setOpen(true)
      // Motion can be switched off, or a frame dropped: the list never waits on the slide for long.
      if (backstop.current) window.clearTimeout(backstop.current)
      backstop.current = window.setTimeout(() => setSettled(true), 800)
      Promise.all([api.openHouses.getVisitors(oh.id), api.openHouses.getById(oh.id)]).then(([v, o]) => {
        if (mine !== ticket.current) return
        setLoaded({
          visitors: v.success && v.data ? [...v.data].sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)) : null,
          openHouse: o.success && o.data ? o.data : null,
          error: v.success ? null : v.error || 'Failed to load visitors',
        })
      })
    },
  }), [])

  const close = useCallback(() => setOpen(false), [])
  const closed = useCallback(() => {
    ticket.current += 1
    setLoaded(null); setSettled(false)
    if (openHouse) onClosed(openHouse.id)
  }, [openHouse, onClosed])

  const ready = settled && !!loaded
  return (
    <OhSheet
      open={open}
      onClose={close}
      onOpened={() => setSettled(true)}
      onClosed={closed}
      width="max-w-6xl"
      title="Visitors"
      subtitle={openHouse ? subtitleFor(openHouse) : undefined}
      image={openHouse?.coverImageUrl || null}
      badge={openHouse ? (
        <span className="shrink-0 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-black tabular-nums text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]">{openHouse.visitorCount ?? 0}</span>
      ) : undefined}
    >
      {ready ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
          <OpenHouseVisitors
            openHouseEventId={openHouse.id}
            onClose={close}
            showcasesOn={openHouse.autoShowcase !== false || !!openHouse.passShowcase}
            preloaded={loaded}
          />
        </motion.div>
      ) : (
        <VisitorsPlaceholder count={openHouse?.visitorCount ?? 0} />
      )}
    </OhSheet>
  )
}, )

/** The size of what's coming, so the sheet doesn't jump when the guests land. A computer's window is
 *  centered, so a short placeholder made it snap taller the moment the list arrived: there it carries
 *  the table's heading and up to a window's worth of rows. Plain shapes: nothing costs the slide a frame. */
function VisitorsPlaceholder({ count }: { count: number }) {
  const rows = Math.max(1, Math.min(count, 7))
  // No guests yet: the "nobody has signed in" message is what's coming, so match that instead.
  if (count === 0) return <div aria-hidden data-testid="visitors-placeholder" className="h-[467px]" />
  return (
    <div aria-hidden data-testid="visitors-placeholder">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-[58px] rounded-2xl border border-gray-100 bg-white dark:border-white/[0.07] dark:bg-[#141416] sm:h-[46px]" />)}
      </div>
      <div className="space-y-2.5 md:space-y-1">
        <div className="hidden h-[85px] rounded-2xl border border-gray-100 bg-white dark:border-white/[0.07] dark:bg-[#141416] md:block" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`h-[352px] rounded-[22px] border border-gray-100 bg-white dark:border-white/[0.07] dark:bg-[#141416] md:h-[108px] md:rounded-2xl ${i >= 3 ? 'hidden md:block' : ''}`} />
        ))}
      </div>
    </div>
  )
}
