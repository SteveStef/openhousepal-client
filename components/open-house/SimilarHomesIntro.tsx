'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Bell, Check, Home, QrCode } from 'lucide-react'
import type { Property } from '@/types'

// The first screen after scanning "Want to see more homes like these?" on a Similar Homes handout -
// before the (unchanged) sign-in steps. It says back what they tapped, shows that the rest of the
// homes are waiting in their own Showcase, and that it's 3 quick questions away.

const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] as const },
})

const QUESTIONS = ['Your name', 'Email & phone', 'Have an agent?']

export default function SimilarHomesIntro({ property, onStart }: { property: Property; onStart: () => void }) {
  const raw = String(property.FullStreetAddress || '').trim()
  const street = raw && raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : raw
  const photo = property.ListPictureURL || ''
  const agent: string | undefined = (property as any)?.agentName || undefined

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_24px_60px_-30px_rgba(17,24,39,.35)] dark:border-gray-800 dark:bg-[#151517]">
      <style>{`.shi-sweep{position:relative;overflow:hidden}.shi-sweep::after{content:"";position:absolute;inset:0;width:35%;transform:translateX(-130%) skewX(-12deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:shiSweep 3.4s ease-in-out 1.2s infinite}@keyframes shiSweep{0%{transform:translateX(-130%) skewX(-12deg)}55%,100%{transform:translateX(330%) skewX(-12deg)}}.shi-bob{animation:shiBob 4.5s ease-in-out infinite}@keyframes shiBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@media (prefers-reduced-motion:reduce){.shi-sweep::after,.shi-bob{animation:none}}`}</style>

      {/* what they scanned */}
      <div className="relative bg-[#FAFAF7] px-6 pb-7 pt-6 dark:bg-[#1A1A1C]">
        <motion.div {...rise(0)} className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C9A24D]/30 bg-white px-3 py-1 text-[9.5px] font-black uppercase tracking-[0.1em] text-[#8b7355] dark:bg-white/[0.04] dark:text-[#e8c97a]">
            <QrCode className="h-3 w-3" /> You scanned &ldquo;More homes like these&rdquo;
          </span>
        </motion.div>

        {/* the home they toured, with more homes fanned behind it */}
        <motion.div {...rise(1)} className="relative mx-auto mt-6 h-[170px] w-[250px]">
          {[-1, 1].map(side => (
            <motion.div key={side}
              initial={{ opacity: 0, rotate: 0, x: 0 }}
              animate={{ opacity: 1, rotate: side * 9, x: side * 58 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 170, damping: 18 }}
              className="absolute inset-x-6 top-3 bottom-1 overflow-hidden rounded-2xl border border-white shadow-lg dark:border-white/10">
              {photo ? <img src={photo} alt="" className="h-full w-full scale-110 object-cover blur-[6px] brightness-90" /> : <div className="h-full w-full bg-gray-200 dark:bg-gray-700" />}
              <div className="absolute inset-0 grid place-items-center bg-[#111827]/35"><Home className="h-6 w-6 text-white/90" /></div>
            </motion.div>
          ))}
          <div className="absolute inset-0 overflow-hidden rounded-2xl border-[3px] border-white shadow-[0_18px_40px_-16px_rgba(17,24,39,.55)] dark:border-[#151517]">
            {photo ? <img src={photo} alt={street} className="h-full w-full origin-top-right scale-[1.14] object-cover" /> : <div className="h-full w-full bg-gray-200 dark:bg-gray-700" />}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8">
              <p className="truncate text-[12px] font-black text-white">{street || 'This home'}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#e8c97a]">The home you toured</p>
            </div>
          </div>
          <span className="shi-bob absolute -right-9 -top-3 inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-lg ring-2 ring-white dark:bg-white dark:text-[#111827] dark:ring-[#151517]">
            <Bell className="h-2.5 w-2.5 text-[#C9A24D]" /> New ones as they list
          </span>
        </motion.div>
      </div>

      <div className="px-7 pb-7 pt-6 text-center">
        <motion.h1 {...rise(2)} className="text-[26px] font-black leading-[1.12] tracking-tight text-[#0B0B0B] dark:text-white">
          See the rest of the homes like this one
        </motion.h1>
        <motion.p {...rise(3)} className="mx-auto mt-3 max-w-sm text-[14px] font-medium leading-relaxed text-[#6B7280] dark:text-gray-400">
          {`Start your own Showcase - every home like ${street || 'this one'} in one place, updated the moment a new one hits the market. It's sent to you as soon as you finish.`}
        </motion.p>

        {/* the 3 questions */}
        <motion.div {...rise(4)} className="mt-6 rounded-2xl border border-gray-100 bg-[#FAFAF7] p-3.5 dark:border-gray-800 dark:bg-[#1A1A1C]">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">Just 3 quick questions</p>
          <div className="grid grid-cols-3 gap-2">
            {QUESTIONS.map((q, i) => (
              <motion.div key={q}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-1 py-2.5 shadow-sm dark:bg-white/[0.04]">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111827] text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">{i + 1}</span>
                <span className="text-[11px] font-black leading-tight text-[#111827] dark:text-white">{q}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.button {...rise(5)} type="button" onClick={onStart} whileTap={{ scale: 0.97 }}
          className="shi-sweep mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] py-4 text-[15px] font-black text-white shadow-[0_14px_30px_-14px_rgba(17,24,39,.8)] transition-colors hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D]">
          Start my Showcase <ArrowRight className="h-4 w-4" />
        </motion.button>

        <motion.p {...rise(6)} className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-bold text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-[#C9A24D]" /> Free</span>
          <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-[#C9A24D]" /> No password</span>
          <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-[#C9A24D]" /> About 20 seconds</span>
        </motion.p>
        {agent && <motion.p {...rise(7)} className="mt-4 text-[11px] font-semibold text-gray-400 dark:text-gray-500">Your Showcase comes from {agent}</motion.p>}
      </div>
    </div>
  )
}
