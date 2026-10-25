'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Check, Copy, ExternalLink, Globe, Lock, Settings, Share2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { OhpHouse } from '@/components/brand/OhpBrand'
import { copyText } from '@/lib/copyText'
import { isTouchPhone, shareLink } from '@/lib/mobileShare'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

interface CmaShareLinksModalProps {
  isOpen: boolean
  onClose: () => void
  openHousePalUrl: string | null
  websiteUrl?: string | null
}

// The CMA share window (user, 10/24: "much more stunning", both link versions):
//  (a) the OpenHousePal link - always there;
//  (b) the agent's own-domain link: needs the IDX plan (greyed out otherwise), then a connected
//      domain (a "set it up" card with a link straight to Settings > IDX domain until then).
// Each link: phone = Share (the phone's Share sheet), computer = Copy ("Link copied"), plus Open in
// a new tab. Phones get a sheet that slides up and drags down to close; computers a centred window.
export default function CmaShareLinksModal({ isOpen, onClose, openHousePalUrl, websiteUrl }: CmaShareLinksModalProps) {
  const { user } = useAuth()
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const sheetMotion = useSheetMotion()
  const open = isOpen && !!openHousePalUrl
  const { sheetRef, y } = useSwipeToClose(onClose, phone && open)
  const releasePagePin = usePagePin(open)
  useEscapeToClose(onClose, open)
  const [touch, setTouch] = useState(false)
  useEffect(() => { setTouch(isTouchPhone()) }, [])
  const isIdx = user?.plan_tier === 'IDX'
  // The links as they were when it opened - the page may clear them the moment it closes, while
  // the window is still animating away.
  const snap = useRef({ ohp: openHousePalUrl, web: websiteUrl ?? null })
  if (open) snap.current = { ohp: openHousePalUrl, web: websiteUrl ?? null }
  const { ohp: ohpUrl, web: webUrl } = snap.current
  const domainState: 'ready' | 'no-domain' | 'no-idx' = webUrl ? 'ready' : isIdx ? 'no-domain' : 'no-idx'

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence onExitComplete={releasePagePin}>
      {open && (
        <motion.div key="cma-share" data-scroll-lock="off" className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
          <motion.div aria-hidden className="absolute inset-0 bg-[#0B0B0B]/70" {...backdropMotion} />
          <motion.div
            ref={sheetRef}
            {...sheetMotion}
            style={{ y: phone && !reduce ? y : undefined }}
            role="dialog" aria-modal="true" aria-label="Share this CMA"
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-t-[28px] border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517] sm:rounded-[28px]"
          >
            {/* gold-lit header */}
            <div className="relative overflow-hidden bg-[#0f1115] px-5 pb-5 pt-2 text-white sm:px-6 sm:pt-6">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#C9A24D]/25 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[#C9A24D]/10 blur-3xl" />
              <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-white/25 sm:hidden" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-lg shadow-[#C9A24D]/30">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-serif text-xl font-black tracking-tight">Share this CMA</p>
                    <p className="text-xs font-semibold text-white/60">Your client opens the live report - no app, no sign-in.</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.88 }} whileHover={{ rotate: 90 }} onClick={onClose} aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            <motion.div
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.08 } } }}
              className="space-y-3 bg-[#faf9f7] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-[#0B0B0B] sm:p-5"
            >
              <motion.div variants={ITEM}>
                <LinkCard
                  icon={<><OhpHouse className="h-5 w-5 dark:hidden" /><OhpHouse onDark className="hidden h-5 w-5 dark:block" /></>}
                  label="OpenHousePal link"
                  hint="Works for every client, right away."
                  url={ohpUrl || ''}
                  touch={touch}
                />
              </motion.div>
              <motion.div variants={ITEM}>
                {domainState === 'ready' ? (
                  <LinkCard
                    icon={<Globe className="h-4 w-4 text-[#8b7355] dark:text-[#e8c97a]" />}
                    label="Your own domain"
                    hint="Your brand, your website address."
                    url={webUrl || ''}
                    touch={touch}
                    gold
                  />
                ) : domainState === 'no-domain' ? (
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-[#C9A24D]/50 bg-gradient-to-br from-[#C9A24D]/[0.09] to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15"><Globe className="h-4 w-4 text-[#8b7355] dark:text-[#e8c97a]" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">Your own domain</p>
                        <p className="mt-0.5 text-sm font-black text-[#111827] dark:text-white">Set up your domain to share CMAs on it</p>
                        <p className="mt-0.5 text-xs font-semibold leading-snug text-gray-500 dark:text-gray-400">Connect your website address once - every CMA link can then use it.</p>
                        <a href="/settings#idx-domain" target="_blank" rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
                          <Settings className="h-3.5 w-3.5" /> Settings &gt; IDX domain <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div aria-disabled className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/60 p-4 opacity-70 dark:border-gray-800 dark:bg-white/[0.02]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800"><Lock className="h-4 w-4 text-gray-400" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Your own domain</p>
                      <p className="mt-0.5 text-sm font-black text-gray-500 dark:text-gray-400">Requires IDX subscription for custom domain</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } },
} as const

function LinkCard({ icon, label, hint, url, touch, gold = false }: {
  icon: React.ReactNode; label: string; hint: string; url: string; touch: boolean; gold?: boolean
}) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const display = url.replace(/^https?:\/\//, '')
  const act = async () => {
    if (touch) { await shareLink(url, 'CMA'); return }
    await copyText(url)
    setDone(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), 1800)
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-3.5 shadow-sm dark:bg-[#151517] ${gold ? 'border-[#C9A24D]/60 shadow-[0_14px_34px_-22px_rgba(201,162,77,0.9)]' : 'border-gray-200 dark:border-gray-800'}`}>
      {gold && <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" />}
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${gold ? 'bg-[#C9A24D]/15' : 'bg-gray-100 dark:bg-gray-800'}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate rounded-xl bg-[#faf9f7] px-3 py-2.5 font-mono text-[12px] font-semibold text-[#111827] ring-1 ring-inset ring-gray-200 dark:bg-black/30 dark:text-white dark:ring-gray-800" title={url}>
          {display}
        </p>
        <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={act}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-black transition-colors ${done ? 'bg-emerald-600 text-white' : gold ? 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
          {touch ? <><Share2 className="h-3.5 w-3.5" /> Share</> : done ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Link copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </motion.button>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
