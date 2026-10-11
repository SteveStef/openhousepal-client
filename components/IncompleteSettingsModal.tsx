'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettingsCompleteness } from '@/hooks/useSettingsCompleteness'

const DISMISSED_KEY = 'incompleteSettingsDismissedAt'
const NEW_ACCOUNT_WINDOW_DAYS = 30

// Invites newer accounts (first 30 days) into the setup flow (/setup) once per browser session
// while any step is still untouched. "Later" hides it for this session; after 30 days the
// dashboard's setup card keeps the nudge instead.
export default function IncompleteSettingsModal() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const { setup, items, loaded } = useSettingsCompleteness()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(!!sessionStorage.getItem(DISMISSED_KEY)) } catch { setDismissed(false) }
  }, [])

  if (!isAuthenticated || !user || !loaded || !setup || setup.finished || dismissed) return null
  // One popup at a time: a new IDX agent answers "Do you want to use your IDX website?" first.
  if (user.plan_tier === 'IDX' && !user.idx_domain_migration_agreed_at) return null
  // Never over the flow itself or a working surface.
  // ...nor over a page that IS one of the setup steps (they're already doing it there).
  const STEP_PAGES = ['/setup', '/settings', '/studio/brand-kit', '/studio/website', '/studio/integrations', '/studio/calendar', '/studio/reviews', '/studio/email-signature', '/studio/site']
  if (STEP_PAGES.some(x => pathname?.startsWith(x)) || /^\/studio\/design\/[^/]+/.test(pathname || '')) return null
  // Not over a deep link (an alert/email that opened something specific).
  if (typeof window !== 'undefined' && window.location.search.length > 1) return null
  const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (accountAgeDays > NEW_ACCOUNT_WINDOW_DAYS) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, new Date().toISOString()) } catch { /* private mode */ }
    setDismissed(true)
  }
  const done = items.filter(i => !i.missing).length
  const left = items.length - done
  const minutes = Math.max(2, Math.round(left * 0.75))

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-[#C9A24D]/30 bg-white shadow-2xl dark:border-white/10 dark:bg-[#151517]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#e8c97a]/35 blur-3xl dark:bg-[#C9A24D]/15" />
        <div className="relative p-7 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] ring-1 ring-[#C9A24D]/40"><Sparkles className="h-7 w-7" /></span>
          <h3 className="mt-5 font-serif text-[28px] font-black leading-tight tracking-tight text-[#111827] dark:text-white">{done === 0 ? <>Let&apos;s set up <em className="text-[#C9A24D]">your account</em></> : <>Let&apos;s <em className="text-[#C9A24D]">finish</em> your setup</>}</h3>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">One simple step at a time - about {minutes} minutes. You type each thing once and it shows up everywhere.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {items.slice(0, 8).map(i => (
              <span key={i.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${i.missing ? 'bg-[#f7f3ea] text-[#111827] dark:bg-white/5 dark:text-white' : 'bg-emerald-50 text-emerald-700 line-through dark:bg-emerald-500/10 dark:text-emerald-300'}`}>{!i.missing && <Check className="h-3 w-3" />}{i.label}</span>
            ))}
            {items.length > 8 && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-gray-400">+{items.length - 8} more</span>}
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button onClick={dismiss} className="flex-1 rounded-2xl border border-gray-200 bg-white px-6 py-3.5 font-bold text-[#111827] transition hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white">Later</button>
            <button onClick={() => { dismiss(); router.push('/setup') }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-6 py-3.5 font-black text-white ring-1 ring-[#C9A24D]/40 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
              {done === 0 ? 'Start' : 'Continue'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}
