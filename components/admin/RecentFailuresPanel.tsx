'use client'

// Admin "Recent failures" (user, 10/20: a CMA generation failed and nothing showed in admin).
// Every feature failure the backend already records - AI calls, CMA generations, AI Media, client
// emails, scheduled emails, broken mailbox / calendar connections - newest first: who, which
// feature, when, the code and the message. See backend admin_failures_service.py.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, Cpu, Image as ImageIcon, Loader2, Mail, MailCheck, RefreshCw, Search, Calculator, ShieldCheck, Link2, Sparkles } from 'lucide-react'
import api, { type EmailBlockState } from '@/lib/api-service'
import type { AdminFailure, AdminFailuresResponse } from '@/types'

const SOURCE: Record<AdminFailure['source'], { label: string, icon: React.ComponentType<{ className?: string }> }> = {
  ai: { label: 'AI call', icon: Cpu },
  cma: { label: 'CMA', icon: Calculator },
  media: { label: 'AI Media', icon: ImageIcon },
  email: { label: 'Email', icon: Mail },
  connection: { label: 'Connection', icon: Link2 },
}

function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function shortDay(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
}

// Check why an address is blocked and, when it only bounced, unblock it (Mailgun + our list).
function Unblock({ email: start, compact }: { email?: string, compact?: boolean }) {
  const [email, setEmail] = useState(start || '')
  const [st, setSt] = useState<EmailBlockState | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const check = async (addr = email) => {
    if (!addr.includes('@')) { setErr('Type an email address'); return }
    setBusy(true); setErr(''); setSt(null)
    const r = await api.admin.checkEmailBlock(addr.trim())
    setBusy(false)
    if (r.success && r.data) setSt(r.data); else setErr(r.error || 'Could not check that address')
  }
  const unblock = async () => {
    if (!st) return
    setBusy(true); setErr('')
    const r = await api.admin.unblockEmail(st.email)
    setBusy(false)
    if (r.success && r.data) setSt(r.data); else setErr(r.error || 'Could not unblock')
  }
  return (
    <div className={compact ? 'mt-1 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.04]' : ''}>
      {!start && (
        <form onSubmit={e => { e.preventDefault(); check() }} className="flex gap-2">
          <input value={email} onChange={e => { setEmail(e.target.value); setSt(null) }} type="email" inputMode="email" placeholder="name@example.com"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] max-sm:min-h-[44px] dark:border-gray-700 dark:bg-[#0f0f11] dark:text-white" />
          <button type="submit" disabled={busy} className="shrink-0 rounded-xl bg-[#111827] px-3.5 text-xs font-black text-white disabled:opacity-60 max-sm:min-h-[44px] dark:bg-white dark:text-[#111827]">
            {busy && !st ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
          </button>
        </form>
      )}
      {start && !st && (
        <button type="button" onClick={() => check(start)} disabled={busy}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-black text-[#111827] max-sm:min-h-[44px] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
          {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <MailCheck className="h-3.5 w-3.5 shrink-0" />} <span className="min-w-0 break-all">Why is {start} blocked?</span>
        </button>
      )}
      {st && (
        <div className="mt-2 space-y-2">
          <p className={`text-xs font-bold ${st.unblocked || !st.blocked ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-200'}`}>
            <span className="break-all">{st.email}</span>: {st.why}
          </p>
          {st.can_unblock && !st.unblocked && (
            <button type="button" onClick={unblock} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A24D] px-3.5 py-2 text-xs font-black text-white disabled:opacity-60 max-sm:min-h-[44px]">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />} Unblock this email
            </button>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-xs font-bold text-rose-600">{err}</p>}
    </div>
  )
}

export default function RecentFailuresPanel() {
  const [days, setDays] = useState(14)
  const [includeLimits, setIncludeLimits] = useState(false)
  const [data, setData] = useState<AdminFailuresResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [feature, setFeature] = useState<string>('')
  const [open, setOpen] = useState<string | null>(null)
  const [cleanedAt, setCleanedAt] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  useEffect(() => { api.admin.failuresCleaned().then(r => { if (r.success) setCleanedAt(r.data?.cleaned_at || null) }) }, [])
  const clean = async () => {
    setCleaning(true)
    const r = await api.admin.cleanFailures()
    setCleaning(false)
    if (r.success && r.data) { setCleanedAt(r.data.cleaned_at); setShowPast(false); setOpen(null) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await api.admin.getRecentFailures(days, includeLimits)
    if (r.success && r.data) setData(r.data)
    else setError(r.error || 'Could not load failures.')
    setLoading(false)
  }, [days, includeLimits])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.failures || []).filter(f =>
      (!feature || f.feature === feature)
      && (!q || [f.owner_name, f.owner_email, f.feature, f.code, f.message, f.ref].some(v => (v || '').toLowerCase().includes(q))))
  }, [data, query, feature])

  // Cleaned items move to Past - kept, just out of the way.
  const cut = cleanedAt ? new Date(cleanedAt).getTime() : 0
  const current = rows.filter(f => !f.at || new Date(f.at).getTime() > cut)
  const past = rows.filter(f => f.at && new Date(f.at).getTime() <= cut)

  // Chips count what's still on the list (not what was cleaned into Past).
  const fresh = useMemo(() => (data?.failures || []).filter(f => !f.at || new Date(f.at).getTime() > cut), [data, cut])
  const features = useMemo(() => {
    const n: Record<string, number> = {}
    for (const f of fresh) if (f.kind !== 'limit') n[f.feature] = (n[f.feature] || 0) + 1
    return Object.entries(n).sort((a, b) => b[1] - a[1])
  }, [fresh])
  const freshErrors = fresh.filter(f => f.kind !== 'limit').length

  return (
    <div className="space-y-4">
      {/* The admin page's own tab header already says what this is - just the controls here. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold max-sm:min-h-[44px] max-sm:flex-1 dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            {[1, 7, 14, 30, 90].map(d => <option key={d} value={d}>Last {d === 1 ? '24 hours' : `${d} days`}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 max-sm:min-h-[44px] max-sm:w-full max-sm:order-last dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            <input type="checkbox" checked={includeLimits} onChange={e => setIncludeLimits(e.target.checked)} className="h-4 w-4 accent-[#C9A24D]" />
            Also show spending-limit blocks
          </label>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white max-sm:min-h-[44px] dark:bg-white dark:text-[#111827]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={clean} disabled={cleaning || current.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-[#111827] disabled:opacity-50 max-sm:min-h-[44px] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            {cleaning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Clean
          </button>
        </div>
      </div>

      {/* by feature */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFeature('')} className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors max-sm:py-2 ${!feature ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 dark:bg-[#151517] dark:text-gray-300 dark:ring-gray-700'}`}>
            All · {freshErrors} {freshErrors === 1 ? 'error' : 'errors'}
          </button>
          {features.map(([name, n]) => (
            <button key={name} onClick={() => setFeature(f => (f === name ? '' : name))}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors max-sm:py-2 ${feature === name ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'}`}>
              {name} · {n}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agent, feature, error…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
      </div>

      <details className="group rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#151517]">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-[#111827] max-sm:min-h-[32px] dark:text-white">
          <MailCheck className="h-4 w-4 text-[#C9A24D]" /> Unblock an email
          <ChevronDown className="ml-auto h-4 w-4 text-gray-400 transition group-open:rotate-180" />
        </summary>
        <p className="mb-2 mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">For an address that bounced once. People who unsubscribed or marked an email as spam stay off - only they can turn emails back on.</p>
        <Unblock />
      </details>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /> Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-rose-600"><AlertTriangle className="h-5 w-5" /> {error}</div>
        ) : current.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-black text-gray-600 dark:text-gray-300">{past.length && !query && !feature ? 'All clean - nothing new since you cleaned' : `No failures ${query || feature ? 'match' : `in the last ${days === 1 ? '24 hours' : `${days} days`}`}`}</p>
          </div>
        ) : list(current, 'c')}
      </div>

      {past.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
          <button onClick={() => setShowPast(v => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-black text-gray-600 max-sm:min-h-[48px] dark:text-gray-300">
            Past · {past.length}
            <span className="text-[11px] font-semibold text-gray-400">cleaned {when(cleanedAt)}</span>
            <ChevronDown className={`ml-auto h-4 w-4 text-gray-400 transition ${showPast ? 'rotate-180' : ''}`} />
          </button>
          {showPast && <div className="border-t border-gray-100 opacity-80 dark:border-gray-800">{list(past, 'p')}</div>}
        </div>
      )}
    </div>
  )

  function list(items: AdminFailure[], tag: string) {
    return (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((f, i) => {
              const S = SOURCE[f.source] || SOURCE.ai
              const id = `${tag}${i}`
              const isOpen = open === id
              return (
                <li key={`${f.at}-${id}`}>
                  <button onClick={() => setOpen(isOpen ? null : id)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${f.kind === 'limit' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                      <S.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-sm font-black text-[#111827] dark:text-white">{f.feature}</p>
                        {f.code && <code className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${f.kind === 'limit' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>{f.code}</code>}
                        {f.kind === 'limit' && <span className="text-[10px] font-black uppercase tracking-wide text-amber-600">limit, not an error</span>}
                        {(f.count || 1) > 1 && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-black text-gray-600 dark:bg-white/10 dark:text-gray-300" data-testid="failure-repeat">
                            {f.count}× since {shortDay(f.first_at)}
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 ${isOpen ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>{f.message || 'No message recorded.'}</p>
                      {f.source === 'email' && f.audience === 'client' ? (
                        <p className="mt-1 text-[11px] font-bold text-gray-400 break-words" data-testid="failure-who">
                          {f.what ? `${f.what} · ` : ''}from {f.owner_name || 'an agent'}&rsquo;s account to their client <span className="break-all text-gray-500 dark:text-gray-300">{f.ref}</span>
                          <span className="block font-semibold">Not the agent&rsquo;s own email - fix the address on their lead</span>
                        </p>
                      ) : f.source === 'email' && f.audience === 'agent' ? (
                        <p className="mt-1 text-[11px] font-bold text-gray-400 break-words" data-testid="failure-who">
                          {f.what ? `${f.what} · ` : ''}to the agent {f.owner_name || ''} <span className="break-all text-gray-500 dark:text-gray-300">{f.ref || f.owner_email}</span>
                        </p>
                      ) : (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-gray-400">
                          <span className="min-w-0 break-all">{f.owner_name || 'Unknown agent'}{f.owner_email && f.owner_email !== f.owner_name ? ` · ${f.owner_email}` : ''}</span>
                          {f.ref && <span className="min-w-0 break-all">· {f.source === 'email' ? `to ${f.ref}` : f.ref}</span>}
                        </p>
                      )}
                      {/* Phones: the time sits under the details, so the title gets the full width. */}
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-gray-400 sm:hidden"><CalendarClock className="h-3.5 w-3.5" /> {when(f.at)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-gray-400 max-sm:hidden" title={f.at ? new Date(f.at).toLocaleString() : undefined}>
                      <CalendarClock className="h-3.5 w-3.5" /> {when(f.at)}
                    </span>
                  </button>
                  {isOpen && f.source === 'email' && f.ref?.includes('@') && (
                    <div className="px-4 pb-3 sm:pl-[60px]"><Unblock email={f.ref} compact /></div>
                  )}
                </li>
              )
            })}
          </ul>
    )
  }
}
