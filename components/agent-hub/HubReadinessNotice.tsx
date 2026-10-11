'use client'

// The IDX website is built from the agent's Agent Hub: name, photo, title, brokerage, area, bio,
// license, phone and email (backend content_adapters.get_agent_profile), plus Recent Sales for the
// Sold page and stats. This notice shows on every IDX screen until those are filled in, listing
// exactly what's missing - each item opens that step of the setup flow (/setup). Renders nothing
// once the hub is ready. The same items are steps on the dashboard's setup card.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

type Missing = { label: string; tab: string; required: boolean }  // tab = setup step id

export function hubMissing(config: Record<string, any> | null | undefined, user: any): Missing[] {
  const cfg = config || {}
  const p = cfg.profile || {}
  const c = cfg.contact || {}
  const has = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
  const sales = Array.isArray(cfg.recentSales) ? cfg.recentSales.length : 0
  const out: Missing[] = []
  // Same fallbacks the website itself uses (account details fill in where the hub is blank).
  if (!has(cfg.profilePhotoUrl) && !has(user?.photo_url)) out.push({ label: 'Your photo', tab: 'photo', required: true })
  if (!has(p.name) && !has(`${user?.first_name || ''}${user?.last_name || ''}`)) out.push({ label: 'Your name', tab: 'about', required: true })
  if (!has(p.title) && !has(user?.professional_title)) out.push({ label: 'Your title', tab: 'about', required: true })
  if (!has(p.brokerage) && !has(user?.brokerage)) out.push({ label: 'Brokerage name', tab: 'about', required: true })
  if (!has(p.market) && !has(user?.market)) out.push({ label: 'Area you serve', tab: 'about', required: true })
  if (!has(p.about)) out.push({ label: 'About me', tab: 'story', required: true })
  if (!has(p.licenseNumber) && !has(c.licenseNumber) && !has(user?.license_number)) out.push({ label: 'License number', tab: 'license', required: true })
  if (!has(c.call)) out.push({ label: 'Phone number', tab: 'contact', required: true })
  if (!has(c.email) && !has(user?.email)) out.push({ label: 'Email', tab: 'contact', required: true })
  if (!sales) out.push({ label: 'Recent sales', tab: 'sales', required: false })
  return out
}

export default function HubReadinessNotice({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { user } = useAuth()
  const [missing, setMissing] = useState<Missing[] | null>(null)

  useEffect(() => {
    let live = true
    const load = () => api.agentHub.getMine().then(r => { if (live) setMissing(hubMissing(r.success ? r.data?.config : null, user)) })
    load()
    // Coming back from the Agent Hub tab re-checks, so the notice clears as soon as it's done.
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { live = false; window.removeEventListener('focus', onFocus) }
  }, [user])

  if (!missing || missing.length === 0) return null
  const required = missing.filter(m => m.required)
  const firstTab = (required[0] || missing[0]).tab
  const urgent = required.length > 0

  return (
    <div role="status" className={`rounded-2xl border p-4 ${urgent ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]'} ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              {urgent ? 'Finish your Agent Hub first - your IDX website is built from it' : 'Add your recent sales to your Agent Hub'}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {urgent
                ? 'Your website shows your name, photo, bio, license and contact details straight from your Agent Hub. Until these are filled in, those parts of your site show up blank.'
                : 'Your website\'s Sold page and sales stats come from the Recent Sales on your Agent Hub.'}
            </p>
            {!compact && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missing.map(m => (
                  <li key={m.label}>
                    <Link href={`/setup?step=${m.tab}`} className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-black transition hover:-translate-y-0.5 ${m.required ? 'bg-white text-amber-800 ring-1 ring-amber-200 dark:bg-transparent dark:text-amber-300 dark:ring-amber-500/40' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>
                      {m.label}{m.required ? '' : ' (recommended)'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <Link href={`/setup?step=${firstTab}`} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
          Finish in setup <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

