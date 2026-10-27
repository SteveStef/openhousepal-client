'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useSettingsCompleteness } from '@/hooks/useSettingsCompleteness'

/**
 * The setup flow at the top of the dashboard - stays until every step for the agent's plan is
 * done. Unfinished and skipped steps are chips that open the flow right at that step (skipped ones
 * never disappear on their own). Replaces the old "Finish setting up" strip and the IDX
 * "finish your Agent Hub first" warning - both are steps of the flow now.
 */
export default function SetupChecklistCard({ className = '' }: { className?: string }) {
  const { setup, items, loaded } = useSettingsCompleteness()
  if (!loaded || !setup || setup.complete) return null
  const done = items.filter(i => !i.missing).length
  const total = items.length
  const pct = Math.round((done / Math.max(1, total)) * 100)
  const required = items.filter(i => i.missing && i.required)
  const todo = items.filter(i => i.missing && !i.required && !i.skipped)
  const skipped = items.filter(i => i.skipped)
  const fresh = setup.seen.length ? items.filter(i => i.missing && !i.skipped && !setup.seen.includes(i.key)).map(i => i.key) : []
  const next = required[0] || todo[0] || skipped[0]
  const onlySkipped = !required.length && !todo.length
  const title = onlySkipped ? 'A few steps are waiting for you' : fresh.length ? 'New steps for your plan' : done === 0 ? 'Let’s set up your account' : 'Finish setting up your account'
  const sub = onlySkipped
    ? 'You skipped these - tap one whenever you’re ready.'
    : required.length
      ? `${required.length === 1 ? 'One thing is' : `${required.length} things are`} required before your pages can go out.`
      : `${done} of ${total} done - only ${total - done} to go.`

  const r = 22
  const c = 2 * Math.PI * r
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      className={`relative overflow-hidden rounded-[26px] border border-[#C9A24D]/35 bg-gradient-to-br from-[#fffaf0] via-white to-[#f8f0de] p-4 shadow-[0_30px_60px_-44px_rgba(139,106,43,.9)] dark:border-[#C9A24D]/25 dark:from-[#1b1813] dark:via-[#151517] dark:to-[#121214] sm:p-5 ${className}`}>
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#e8c97a]/30 blur-3xl dark:bg-[#C9A24D]/12" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="relative inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center">
          <svg width="56" height="56" className="-rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(201,162,77,.2)" strokeWidth="5" />
            <motion.circle cx="28" cy="28" r={r} fill="none" stroke="url(#dashSetupRing)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
            <defs><linearGradient id="dashSetupRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b6a2b" /><stop offset="60%" stopColor="#C9A24D" /><stop offset="100%" stopColor="#e8c97a" /></linearGradient></defs>
          </svg>
          <span className="absolute text-[12px] font-black text-[#111827] dark:text-white">{done}/{total}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3.5 w-3.5" /> Account setup</p>
          <p className="mt-0.5 font-serif text-[20px] font-black leading-tight text-[#111827] dark:text-white sm:text-[22px]">{title}</p>
          <p className="mt-0.5 text-[13.5px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>
        </div>
        {next && (
          <Link href={onlySkipped ? next.href : '/setup'} className="group inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-5 text-[15px] font-black text-white shadow-[0_14px_28px_-14px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 transition hover:-translate-y-0.5 max-sm:w-full max-sm:justify-center dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
            {done === 0 ? 'Start setup' : onlySkipped ? 'Pick up where I left off' : 'Continue setup'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {[...required, ...todo, ...skipped].map(i => (
          <Link key={i.key} href={i.href} title={i.why}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition hover:-translate-y-0.5 ${i.required
              ? 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
              : i.skipped
                ? 'border-dashed border-gray-300 bg-white/70 text-gray-600 hover:border-[#C9A24D] dark:border-white/20 dark:bg-white/[0.03] dark:text-gray-300'
                : 'border-[#C9A24D]/30 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.05] dark:text-white'}`}>
            {i.label}
            {i.required && <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Required</span>}
            {i.skipped && <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Skipped</span>}
            {fresh.includes(i.key) && <span className="rounded-full bg-[#C9A24D] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">New</span>}
          </Link>
        ))}
      </div>
    </motion.div>
  )
}
