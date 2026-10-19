'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Globe } from 'lucide-react'
import api, { type DomainIssue } from '@/lib/api-service'

/** "Your website address needs a fix" - the server opens an agent's own domain like a visitor
 *  would (every 2 hours while it's new, then daily) and this says what's wrong and exactly what to
 *  change (user, 10/19 - "a normal person would've never known to do this"). Big on the Dash;
 *  `inline` on the IDX Domain card in Settings. Nothing at all when everything works. */
export default function DomainHealthBanner({ className = '', inline = false }: { className?: string; inline?: boolean }) {
  const [issues, setIssues] = useState<DomainIssue[]>([])
  useEffect(() => {
    let live = true
    api.sites.getDomainHealth().then(r => { if (live && r.success && r.data) setIssues(r.data.issues || []) })
    return () => { live = false }
  }, [])
  if (!issues.length) return null
  const list = (
    <ul className="space-y-2.5">
      {issues.map(i => (
        <li key={i.hostname + i.code}>
          <p className="text-[13px] font-black leading-snug text-[#111827] dark:text-white">{i.title}</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-gray-600 dark:text-gray-300">{i.fix}</p>
        </li>
      ))}
    </ul>
  )
  if (inline) {
    return (
      <div role="alert" className={`rounded-xl border border-red-200 bg-red-50 p-3.5 dark:border-red-500/30 dark:bg-red-500/10 ${className}`}>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" /> {issues.length === 1 ? 'One thing to fix' : `${issues.length} things to fix`}
        </p>
        {list}
      </div>
    )
  }
  return (
    <section role="alert" className={`relative overflow-hidden rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-500/30 dark:bg-[#151517] sm:p-6 ${className}`}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-red-500 to-amber-500" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <Globe className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-300">Your website address</p>
          <h2 className="mt-1 font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">
            {issues.length === 1 ? 'One fix and your domain is working everywhere' : `${issues.length} fixes and your domain is working everywhere`}
          </h2>
          <div className="mt-3">{list}</div>
        </div>
        <Link href="/settings#idx-domain"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827]">
          Show me how <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
