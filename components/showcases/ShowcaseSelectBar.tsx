'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FolderInput, Loader2, Send, Star, ThumbsDown, ThumbsUp, Trash2, Undo2, X } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { isPropertyAvailableStatus, normalizeImageUrl } from '@/lib/utils'
import type { Property } from '@/types'

// Select mode on the agent's view of a client's Showcase (user, 10/30): tap homes, then do one
// thing to all of them - send, recommend, love, pass, file into Sold/Removed, or remove. Each
// button flips to its "undo" when every picked home already has it. Phones: a bar pinned to the
// bottom edge; computers: a floating bar.

export type BulkAction = 'like' | 'unlike' | 'dislike' | 'undislike' | 'recommend' | 'unrecommend' | 'sold' | 'unsold' | 'remove'

const spring = { type: 'spring', stiffness: 420, damping: 36 } as const

export default function ShowcaseSelectBar({ open, selected, clientName, onClear, onDone, onSend, onAction }: {
  open: boolean
  selected: Property[]
  clientName: string
  onClear: () => void
  onDone: () => void
  onSend: () => void
  onAction: (action: BulkAction) => Promise<void>
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState<BulkAction | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => { setHost(document.body) }, [])

  const n = selected.length
  const every = (f: (p: Property) => boolean) => n > 0 && selected.every(f)
  const recommended = every(p => !!p.agentRecommended && !p.disliked)
  const loved = every(p => !!p.liked)
  const passed = every(p => !!p.disliked)
  const offMarket = selected.filter(p => !isPropertyAvailableStatus(p.MlsStatus))
  const filed = offMarket.length > 0 && offMarket.every(p => !!p.soldFiled)

  const run = async (a: BulkAction) => {
    if (!n || busy) return
    setBusy(a)
    try { await onAction(a) } finally { setBusy(null) }
  }

  // Everything but Send, as even tiles (icon over a short label) - all of them fit a 375px phone
  // with no sideways scrolling (owner, 10/30). Send is the gold button in the top row.
  const tiles: { key: string; action: BulkAction; label: string; short?: string; icon: React.ReactNode; tone?: 'red'; hidden?: boolean }[] = [
    { key: 'rec', action: recommended ? 'unrecommend' : 'recommend', label: recommended ? 'Unrecommend' : 'Recommend', icon: <Star className="h-5 w-5" fill={recommended ? 'currentColor' : 'none'} /> },
    { key: 'love', action: loved ? 'unlike' : 'like', label: loved ? 'Unlove' : 'Love', icon: <ThumbsUp className="h-5 w-5" fill={loved ? 'currentColor' : 'none'} /> },
    { key: 'pass', action: passed ? 'undislike' : 'dislike', label: passed ? 'Unpass' : 'Pass', icon: <ThumbsDown className="h-5 w-5" fill={passed ? 'currentColor' : 'none'} /> },
    { key: 'sold', action: filed ? 'unsold' : 'sold', label: filed ? 'Move back' : 'To Sold/Removed', short: filed ? 'Move back' : 'To Sold', icon: filed ? <Undo2 className="h-5 w-5" /> : <FolderInput className="h-5 w-5" />, hidden: !offMarket.length },
    { key: 'remove', action: 'remove', label: 'Remove', icon: <Trash2 className="h-5 w-5" />, tone: 'red' },
  ]
  const shown = tiles.filter(t => !t.hidden)
  // each tile's icon in its own colour (the same ones the card's buttons wear)
  const tileColor = (key: string) => key === 'remove' ? 'text-rose-300' : key === 'rec' ? 'text-[#e8c97a]' : key === 'love' ? 'text-emerald-300' : key === 'pass' ? 'text-red-300' : 'text-white'

  if (!host) return null
  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div key="select-bar" data-select-bar
              initial={{ y: 160, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: spring }} exit={{ y: 160, opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center sm:bottom-6">
              <div className="pointer-events-auto w-full rounded-t-[26px] border-t border-[#C9A24D]/30 bg-[#111214]/[0.97] px-4 pt-3 text-white shadow-[0_-24px_50px_-20px_rgba(0,0,0,.6)] sm:w-[min(640px,calc(100vw-3rem))] sm:rounded-[26px] sm:border sm:px-5 sm:pt-4 sm:shadow-[0_30px_80px_-24px_rgba(0,0,0,.75)]"
                style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}>
                <div className="flex items-center gap-2.5">
                  <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onDone} aria-label="Done selecting" data-select-done
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white">
                    <X className="h-4 w-4" />
                  </motion.button>
                  <p className="min-w-0 flex-1 truncate text-[16px] font-black" data-select-count>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={n} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.16 }} className="inline-block tabular-nums text-[#e8c97a]">{n}</motion.span>
                    </AnimatePresence>{' '}
                    selected
                  </p>
                  <AnimatePresence initial={false}>
                    {n > 0 && (
                      <motion.button key="clear" type="button" onClick={onClear} data-select-clear
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="shrink-0 rounded-full px-2.5 py-2 text-[11px] font-black uppercase tracking-widest text-white/60 transition hover:text-white">
                        Clear
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.button type="button" whileTap={n ? { scale: 0.95 } : undefined} disabled={!n || !!busy} onClick={onSend} data-bulk="send"
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-gradient-to-br from-[#e8c97a] via-[#C9A24D] to-[#a8823a] px-4 text-[14px] font-black text-[#16130e] shadow-[0_10px_24px_-12px_rgba(201,162,77,.9)] transition disabled:opacity-35">
                    <Send className="h-4 w-4" /> Send
                  </motion.button>
                </div>
                <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
                  {shown.map(t => {
                    const isBusy = busy === t.action
                    const off = !n || (!!busy && !isBusy)
                    return (
                      <motion.button key={t.key} type="button" whileTap={off ? undefined : { scale: 0.93 }} disabled={off} data-bulk={t.action}
                        onClick={() => (t.action === 'remove' ? setConfirmRemove(true) : run(t.action))}
                        className={`flex h-[60px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 transition disabled:opacity-35 ${t.tone === 'red' ? 'bg-rose-500/[0.12] hover:bg-rose-500/20' : 'bg-white/[0.07] hover:bg-white/[0.12]'}`}>
                        <span className={tileColor(t.key)}>{isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : t.icon}</span>
                        <span className="w-full truncate text-center text-[11px] font-black leading-none tracking-tight text-white/90">
                          {t.short ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        host,
      )}

      {/* Removing is for good (the search won't add them back) - so it asks first. */}
      <OhSheet open={confirmRemove} onClose={() => setConfirmRemove(false)} width="max-w-md" zClass="z-[70]"
        title={`Remove ${n} home${n === 1 ? '' : 's'}?`} subtitle={`From ${clientName ? `${clientName}’s` : 'this'} Showcase`} icon={<Trash2 className="h-5 w-5" />}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmRemove(false)}
              className="h-12 flex-1 rounded-2xl border border-gray-200 bg-white text-sm font-black text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
              Keep them
            </button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} data-confirm-remove disabled={busy === 'remove'}
              onClick={async () => { await run('remove'); setConfirmRemove(false) }}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-black text-white shadow-[0_14px_30px_-14px_rgba(225,29,72,.8)] disabled:opacity-60">
              {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
            </motion.button>
          </div>
        }>
        <div className="space-y-3">
          <div className="flex -space-x-3">
            {selected.slice(0, 5).map(p => (
              <span key={p.id} className="h-12 w-14 overflow-hidden rounded-xl border-2 border-white bg-gray-100 shadow-sm dark:border-[#0d0d0f] dark:bg-white/5">
                {p.ListPictureURL && <img src={normalizeImageUrl(p.ListPictureURL)} alt="" className="h-full w-full object-cover" />}
              </span>
            ))}
            {n > 5 && <span className="grid h-12 w-14 place-items-center rounded-xl border-2 border-white bg-[#111827] text-xs font-black text-white dark:border-[#0d0d0f]">+{n - 5}</span>}
          </div>
          <p className="text-sm font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
            {`${n === 1 ? 'It' : 'They'} will disappear from ${clientName ? `${clientName}’s` : 'their'} Showcase and won’t come back with new matches. You can still add a home back from its own page.`}
          </p>
        </div>
      </OhSheet>
    </>
  )
}
